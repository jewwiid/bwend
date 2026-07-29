/**
 * Match handlers: fetch (full reveal data) + list (history summaries).
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, jsonResponse } from "./auth";

// MARK: List my matches

export const handleListMatches = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  // Query matches where caller is user A or user B. We need two queries since Convex
  // doesn't have OR filters — merge and sort in JS.
  const asUserA = await ctx.runQuery(internal.matchQueries.byUserA, {
    spotifyUserId: identity.spotifyUserId,
  });
  const asUserB = await ctx.runQuery(internal.matchQueries.byUserB, {
    spotifyUserId: identity.spotifyUserId,
  });

  const all = [...asUserA, ...asUserB]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  // Batch-resolve partner names.
  const partnerIds = all.map((m: any) =>
    m.userASpotifyUserId === identity.spotifyUserId
      ? m.userBSpotifyUserId
      : m.userASpotifyUserId
  );
  const profiles = await ctx.runQuery(internal.bwendProfileQueries.batchBySpotifyUserIds, {
    spotifyUserIds: partnerIds,
  });
  const nameById = new Map(profiles.map((p: any) => [p.spotifyUserId, p.displayName]));

  const summaries = all.map((m: any) => ({
    id: m._id,
    partnerName: nameById.get(
      m.userASpotifyUserId === identity.spotifyUserId
        ? m.userBSpotifyUserId
        : m.userASpotifyUserId
    ) ?? "Someone",
    vibeScore: m.vibeScore,
    anchorTrackName: m.anchorTrack?.name ?? null,
    createdAt: new Date(m.createdAt).toISOString(),
  }));

  return jsonResponse(200, summaries);
});

// MARK: Fetch single match

export const handleFetchMatch = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const identity = authResult;

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const matchId = pathParts[pathParts.length - 1];

  if (!matchId) return jsonResponse(400, { reason: "Missing match id." });

  const match: any = await ctx.runQuery(internal.matchQueries.getById, { matchId });
  if (!match) {
    return jsonResponse(404, { reason: "Match not found." });
  }

  const iAmA = match.userASpotifyUserId === identity.spotifyUserId;
  const iAmB = match.userBSpotifyUserId === identity.spotifyUserId;
  if (!iAmA && !iAmB) {
    return jsonResponse(403, { reason: "Not your match." });
  }

  const partnerSpotifyId = iAmA ? match.userBSpotifyUserId : match.userASpotifyUserId;

  // Resolve both names.
  const [myProfile, partnerProfile] = await Promise.all([
    ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
      spotifyUserId: identity.spotifyUserId,
    }),
    ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
      spotifyUserId: partnerSpotifyId,
    }),
  ]);

  return jsonResponse(200, {
    id: match._id,
    vibeScore: match.vibeScore,
    breakdown: match.breakdown,
    myName: myProfile?.displayName ?? identity.name ?? null,
    partnerName: partnerProfile?.displayName ?? null,
    anchorTrack: match.anchorTrack,
    sharedTopArtistNames: match.sharedTopArtistNames,
    sharedTopTrackNames: match.sharedTopTrackNames,
    compatibilityRead: match.compatibilityRead,
    createdAt: new Date(match.createdAt).toISOString(),
  });
});
