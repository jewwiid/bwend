/**
 * POST /api/matches/<id>/playlist — save this match as a private Spotify playlist.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, requireAuth } from "./auth";

export const handleSaveMatchPlaylist = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const playlistIndex = parts.lastIndexOf("playlist");
  const matchId = playlistIndex > 0 ? parts[playlistIndex - 1] : null;
  if (!matchId) return jsonResponse(400, { reason: "Missing match id." }, request);

  const result = await ctx.runAction(internal.playlistActions.saveMatchPlaylist, {
    spotifyUserId: authResult.spotifyUserId,
    matchId,
  });
  if (result.error) {
    return jsonResponse(
      result.status,
      result.code ? { reason: result.error, code: result.code } : { reason: result.error },
      request
    );
  }
  return jsonResponse(result.status, result.data, request);
});
