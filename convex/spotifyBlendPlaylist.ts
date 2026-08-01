import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, requireAuth } from "./auth";

export const handleListSpotifyPlaylists = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const result = await ctx.runAction(internal.spotifyBlendPlaylistActions.list, {
    bwendUserId: authResult.spotifyUserId,
  });
  return respond(result, request);
});

export const handleGetSpotifyBlendPlaylist = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const result = await ctx.runAction(internal.spotifyBlendPlaylistActions.getSelected, {
    bwendUserId: authResult.spotifyUserId,
  });
  return respond(result, request);
});

export const handleSelectSpotifyBlendPlaylist = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { reason: "Choose a Spotify playlist." }, request);
  }
  const playlistId = (body as { playlistId?: unknown })?.playlistId;
  if (typeof playlistId !== "string") {
    return jsonResponse(400, { reason: "Choose a Spotify playlist." }, request);
  }
  const result = await ctx.runAction(internal.spotifyBlendPlaylistActions.select, {
    bwendUserId: authResult.spotifyUserId,
    playlistId,
  });
  return respond(result, request);
});

export const handleDeleteSpotifyBlendPlaylist = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const updated = await ctx.runMutation(internal.spotifyBlendMutations.updatePlaylist, {
    bwendUserId: authResult.spotifyUserId,
    spotifyBlendPlaylistId: null,
    selectedAt: null,
  });
  return updated
    ? jsonResponse(200, { ok: true, removed: true }, request)
    : jsonResponse(
        404,
        { reason: "Reconnect Spotify to restore your Taste Card.", code: "reconnect_required" },
        request
      );
});

function respond(
  result: { status: number; error: string | null; code: string | null; data: unknown },
  request: Request
) {
  return result.error
    ? jsonResponse(
        result.status,
        result.code ? { reason: result.error, code: result.code } : { reason: result.error },
        request
      )
    : jsonResponse(result.status, result.data, request);
}
