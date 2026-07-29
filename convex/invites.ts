/**
 * Invite lifecycle HTTP handlers.
 *
 * These are httpActions (run in the Convex runtime). They handle request parsing + auth,
 * then delegate to internal actions for any Node-only work (Spotify API calls in claim).
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, jsonResponse } from "./auth";
import { generateUniqueInviteCode } from "./lib/inviteCode";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// MARK: Create

export const handleCreateInvite = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  // Generate a unique code — read all existing codes to avoid collisions.
  const existingCodes = await ctx.runQuery(internal.inviteQueries.allCodes);
  const code = generateUniqueInviteCode(new Set(existingCodes));
  if (!code) {
    return jsonResponse(500, { reason: "Couldn't allocate invite code." }, request);
  }

  const now = Date.now();
  const expiresAt = now + SEVEN_DAYS_MS;
  const selectedTrack = await parseSelectedTrack(request);

  await ctx.runMutation(internal.inviteMutations.create, {
    code,
    inviterSpotifyUserId: identity.spotifyUserId,
    status: "pending",
    ...(selectedTrack ? { selectedTrack } : {}),
    createdAt: now,
    expiresAt,
  });

  const publicBaseURL = process.env.PUBLIC_BASE_URL ?? "https://bwend.xyz";
  return jsonResponse(200, {
    code,
    url: `${publicBaseURL}/m/${code}`,
    expiresAt: new Date(expiresAt).toISOString(),
  }, request);
});

// MARK: Fetch (recipient preview)

export const handleFetchInvite = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  const code = extractLastPathSegment(request.url);
  if (!code) return jsonResponse(400, { reason: "Missing invite code." }, request);

  const invite = await ctx.runQuery(internal.inviteQueries.getByCode, { code });
  if (!invite) {
    return jsonResponse(404, { reason: "Invite not found." }, request);
  }

  if (invite.status === "expired" || invite.expiresAt < Date.now()) {
    return jsonResponse(410, { reason: "This invite has expired." }, request);
  }

  const inviterProfile = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
    spotifyUserId: invite.inviterSpotifyUserId,
  });

  const artists = (inviterProfile?.topArtists ?? []).slice(0, 6);

  return jsonResponse(200, {
    code: invite.code,
    inviterName: inviterProfile?.displayName ?? null,
    // Names kept for backwards compatibility with older app builds; `inviterArtists`
    // carries the photos so the invite has something to look at before the recipient
    // has connected anything of their own.
    inviterTopArtists: artists.map((a: { name: string }) => a.name),
    inviterArtists: artists.map((a: { id: string; name: string; imageURL: string | null }) => ({
      id: a.id,
      name: a.name,
      imageURL: a.imageURL ?? null,
    })),
    selectedTrack: invite.selectedTrack ?? null,
    expiresAt: new Date(invite.expiresAt).toISOString(),
    alreadyClaimed: invite.status === "claimed",
    isMine: identity.spotifyUserId === invite.inviterSpotifyUserId,
  }, request);
});

// MARK: Claim → Match (delegates to a Node action for the scoring + match write)

export const handleClaimInvite = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  // Parse the code from the URL.
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const code = pathParts[pathParts.length - 1] === "claim"
    ? pathParts[pathParts.length - 2]
    : pathParts[pathParts.length - 1];

  if (!code) return jsonResponse(400, { reason: "Missing invite code." }, request);

  // Delegate the scoring + match creation to the internal action.
  try {
    const result = await ctx.runAction(internal.claimActions.claim, {
      code,
      claimerSpotifyUserId: identity.spotifyUserId,
    });
    if (result.error) {
      return jsonResponse(result.status, { reason: result.error }, request);
    }
    return jsonResponse(200, result.data, request);
  } catch (e) {
    return jsonResponse(500, { reason: `Claim failed: ${(e as Error).message}` }, request);
  }
});

// MARK: - Helpers

function extractLastPathSegment(urlStr: string): string | null {
  const parsed = new URL(urlStr);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

interface SelectedTrackInput {
  id: string;
  name: string;
  artistName: string | null;
  imageURL: string | null;
  spotifyURL: string | null;
}

async function parseSelectedTrack(request: Request): Promise<SelectedTrackInput | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const track = (body as { selectedTrack?: unknown })?.selectedTrack;
  if (!track || typeof track !== "object") return null;
  const value = track as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    value.id.length === 0 ||
    value.name.length === 0
  ) {
    return null;
  }
  const nullableString = (input: unknown): string | null =>
    typeof input === "string" && input.length > 0 ? input : null;
  return {
    id: value.id.slice(0, 128),
    name: value.name.slice(0, 200),
    artistName: nullableString(value.artistName)?.slice(0, 200) ?? null,
    imageURL: nullableString(value.imageURL),
    spotifyURL: nullableString(value.spotifyURL),
  };
}
