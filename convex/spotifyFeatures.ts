/**
 * HTTP handlers for read-only Spotify product features.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, requireAuth } from "./auth";

export const handleNowPlaying = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const result = await ctx.runAction(internal.spotifyFeatureActions.nowPlaying, {
    spotifyUserId: authResult.spotifyUserId,
  });
  return result.error
    ? jsonResponse(
        result.status,
        result.code ? { reason: result.error, code: result.code } : { reason: result.error },
        request
      )
    : jsonResponse(200, result.data, request);
});

export const handlePlayer = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const result = await ctx.runAction(internal.spotifyFeatureActions.player, {
    spotifyUserId: authResult.spotifyUserId,
  });
  return result.error
    ? jsonResponse(
        result.status,
        result.code ? { reason: result.error, code: result.code } : { reason: result.error },
        request
      )
    : jsonResponse(200, result.data, request);
});

export const handleSearchTracks = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await ctx.runAction(internal.spotifyFeatureActions.search, {
    spotifyUserId: authResult.spotifyUserId,
    query,
  });
  return result.error
    ? jsonResponse(
        result.status,
        result.code ? { reason: result.error, code: result.code } : { reason: result.error },
        request
      )
    : jsonResponse(200, result.data, request);
});

export const handleDiscovery = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const result = await ctx.runAction(internal.spotifyFeatureActions.discovery, {
    spotifyUserId: authResult.spotifyUserId,
  });
  return result.error
    ? jsonResponse(
        result.status,
        result.code ? { reason: result.error, code: result.code } : { reason: result.error },
        request
      )
    : jsonResponse(200, result.data, request);
});
