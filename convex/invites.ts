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
    return jsonResponse(500, { reason: "Couldn't allocate invite code." });
  }

  const now = Date.now();
  const expiresAt = now + SEVEN_DAYS_MS;

  await ctx.runMutation(internal.inviteMutations.create, {
    code,
    inviterSpotifyUserId: identity.spotifyUserId,
    status: "pending",
    createdAt: now,
    expiresAt,
  });

  const publicBaseURL = process.env.PUBLIC_BASE_URL ?? "https://bwend.xyz";
  return jsonResponse(200, {
    code,
    url: `${publicBaseURL}/m/${code}`,
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

// MARK: Fetch (recipient preview)

export const handleFetchInvite = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  const code = extractLastPathSegment(request.url);
  if (!code) return jsonResponse(400, { reason: "Missing invite code." });

  const invite = await ctx.runQuery(internal.inviteQueries.getByCode, { code });
  if (!invite) {
    return jsonResponse(404, { reason: "Invite not found." });
  }

  if (invite.status === "expired" || invite.expiresAt < Date.now()) {
    return jsonResponse(410, { reason: "This invite has expired." });
  }

  const inviterProfile = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
    spotifyUserId: invite.inviterSpotifyUserId,
  });

  const inviterTopArtists = (inviterProfile?.topArtists ?? [])
    .slice(0, 5)
    .map((a: { name: string }) => a.name);

  return jsonResponse(200, {
    code: invite.code,
    inviterTopArtists,
    expiresAt: new Date(invite.expiresAt).toISOString(),
    alreadyClaimed: invite.status === "claimed",
    isMine: identity.spotifyUserId === invite.inviterSpotifyUserId,
  });
});

// MARK: Claim → Match (delegates to a Node action for Spotify recommendations)

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

  if (!code) return jsonResponse(400, { reason: "Missing invite code." });

  // Delegate all the Node-only work (Spotify recommendations) to the internal action.
  try {
    const result = await ctx.runAction(internal.claimActions.claim, {
      code,
      claimerSpotifyUserId: identity.spotifyUserId,
    });
    if (result.error) {
      return jsonResponse(result.status, { reason: result.error });
    }
    return jsonResponse(200, result.data);
  } catch (e) {
    return jsonResponse(500, { reason: `Claim failed: ${(e as Error).message}` });
  }
});

// MARK: - Helpers

function extractLastPathSegment(urlStr: string): string | null {
  const parsed = new URL(urlStr);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
