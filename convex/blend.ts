/**
 * GET /api/me/blend — the caller's own listening profile.
 *
 * Thin HTTP handler; the Spotify work happens in the Node action. Optional query param
 * `time_range` accepts short_term | medium_term | long_term (defaults to medium_term).
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, jsonResponse } from "./auth";

export const handleMyBlend = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  const timeRange = new URL(request.url).searchParams.get("time_range") ?? "medium_term";

  try {
    const result: any = await ctx.runAction(internal.blendActions.myBlend, {
      spotifyUserId: identity.spotifyUserId,
      timeRange,
    });
    if (result.error) {
      return jsonResponse(
        result.status,
        result.code ? { reason: result.error, code: result.code } : { reason: result.error },
        request,
      );
    }
    return jsonResponse(200, result.data, request);
  } catch (e) {
    return jsonResponse(500, { reason: `Couldn't load your blend: ${(e as Error).message}` }, request);
  }
});
