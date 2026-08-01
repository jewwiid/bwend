import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, requireAuth } from "./auth";
import { normalizeSpotifyBlendURL } from "./lib/spotifyBlend";

export const handleGetSpotifyBlend = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const profile = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
    spotifyUserId: authResult.spotifyUserId,
  });
  if (!profile) {
    return jsonResponse(
      404,
      { reason: "Reconnect Spotify to restore your Taste Card.", code: "reconnect_required" },
      request
    );
  }

  return jsonResponse(200, { url: profile.spotifyBlendURL ?? null }, request);
});

export const handleSaveSpotifyBlend = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { reason: "Paste a Spotify Blend invite link." }, request);
  }

  const input = (body as { input?: unknown })?.input;
  const spotifyBlendURL =
    typeof input === "string" ? normalizeSpotifyBlendURL(input) : null;
  if (!spotifyBlendURL) {
    return jsonResponse(
      400,
      {
        reason: "Paste a Spotify Blend invite from open.spotify.com/blend/taste-match/…",
        code: "invalid_spotify_blend_url",
      },
      request
    );
  }

  const result = await ctx.runMutation(internal.spotifyBlendMutations.update, {
    bwendUserId: authResult.spotifyUserId,
    spotifyBlendURL,
    revokeInviteSnapshots: false,
  });
  if (!result.updated) {
    return jsonResponse(
      404,
      { reason: "Reconnect Spotify to restore your Taste Card.", code: "reconnect_required" },
      request
    );
  }

  return jsonResponse(200, { url: spotifyBlendURL }, request);
});

export const handleDeleteSpotifyBlend = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const result = await ctx.runMutation(internal.spotifyBlendMutations.update, {
    bwendUserId: authResult.spotifyUserId,
    spotifyBlendURL: null,
    revokeInviteSnapshots: true,
  });
  if (!result.updated) {
    return jsonResponse(
      404,
      { reason: "Reconnect Spotify to restore your Taste Card.", code: "reconnect_required" },
      request
    );
  }

  return jsonResponse(
    200,
    { ok: true, removed: true, revokedInviteCount: result.revokedInviteCount },
    request
  );
});
