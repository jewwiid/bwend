/**
 * Spotify connect — the auth entry point HTTP handler.
 *
 * Delegates to an internal action for the Node-only work (Spotify API calls).
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./auth";

export const handleSpotifyConnect = httpAction(async (ctx, request) => {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { reason: "Invalid JSON body." });
  }

  const code = body.code;
  if (!code) {
    return jsonResponse(400, { reason: "Missing 'code' in request body." });
  }

  try {
    const result = await ctx.runAction(internal.spotifyActions.connect, { code });
    if (result.error) {
      return jsonResponse(result.status, { reason: result.error });
    }
    return jsonResponse(200, result.data);
  } catch (e) {
    return jsonResponse(500, { reason: `Connect failed: ${(e as Error).message}` });
  }
});
