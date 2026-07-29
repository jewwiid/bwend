/**
 * Creates an idempotent private Spotify playlist for one user and one Bwend match.
 */

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  addPlaylistItems,
  createPrivatePlaylist,
  hasScope,
  SpotifyAPIError,
  spotifyRateLimitFailure,
} from "./lib/spotify";
import {
  requireFreshSpotifySession,
  SpotifySessionError,
} from "./lib/spotifySession";

interface SavePlaylistResult {
  status: number;
  error: string | null;
  code: string | null;
  data: {
    spotifyPlaylistId: string;
    spotifyURL: string;
    alreadyExisted: boolean;
  } | null;
}

export const saveMatchPlaylist = internalAction({
  args: {
    spotifyUserId: v.string(),
    matchId: v.string(),
  },
  returns: v.object({
    status: v.number(),
    error: v.union(v.string(), v.null()),
    code: v.union(v.string(), v.null()),
    data: v.union(
      v.object({
        spotifyPlaylistId: v.string(),
        spotifyURL: v.string(),
        alreadyExisted: v.boolean(),
      }),
      v.null()
    ),
  }),
  handler: async (ctx, args): Promise<SavePlaylistResult> => {
    try {
      const match: Doc<"matches"> | null = await ctx.runQuery(internal.matchQueries.getById, {
        matchId: args.matchId,
      });
      if (!match) return failure(404, "Match not found.");
      const isParticipant =
        match.userASpotifyUserId === args.spotifyUserId ||
        match.userBSpotifyUserId === args.spotifyUserId;
      if (!isParticipant) return failure(403, "Not your match.");

      const existing: Doc<"matchPlaylists"> | null = await ctx.runQuery(
        internal.playlistRecords.getByMatchAndUser,
        {
          matchId: match._id,
          spotifyUserId: args.spotifyUserId,
        }
      );
      if (existing) {
        return {
          status: 200,
          error: null,
          code: null,
          data: {
            spotifyPlaylistId: existing.spotifyPlaylistId,
            spotifyURL: existing.spotifyURL,
            alreadyExisted: true,
          },
        };
      }

      const { tokens } = await requireFreshSpotifySession(ctx, args.spotifyUserId);
      if (!hasScope(tokens, "playlist-modify-private")) {
        return failure(
          403,
          "Reconnect Spotify before saving a private blend playlist.",
          "spotify_scope_required"
        );
      }

      const [profileA, profileB] = await Promise.all([
        ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
          spotifyUserId: match.userASpotifyUserId,
        }),
        ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
          spotifyUserId: match.userBSpotifyUserId,
        }),
      ]);
      if (!profileA || !profileB) return failure(421, "Both Spotify profiles are required.");

      const trackIds = interleaveTrackIds(
        match.anchorTrack?.id ?? null,
        profileA.topTracks,
        profileB.topTracks
      );
      if (trackIds.length === 0) return failure(422, "This blend has no tracks to save yet.");

      const names = [profileA.displayName, profileB.displayName].filter(
        (name): name is string => Boolean(name)
      );
      const title = `Bwend · ${names.join(" + ") || "Your blend"}`.slice(0, 100);
      const playlist = await createPrivatePlaylist(
        tokens.accessToken,
        title,
        "A music-first match made with Bwend."
      );
      await addPlaylistItems(tokens.accessToken, playlist.id, trackIds);
      await ctx.runMutation(internal.playlistRecords.save, {
        matchId: match._id,
        spotifyUserId: args.spotifyUserId,
        spotifyPlaylistId: playlist.id,
        spotifyURL: playlist.spotifyURL,
        createdAt: Date.now(),
      });

      return {
        status: 201,
        error: null,
        code: null,
        data: {
          spotifyPlaylistId: playlist.id,
          spotifyURL: playlist.spotifyURL,
          alreadyExisted: false,
        },
      };
    } catch (error) {
      if (error instanceof SpotifySessionError) {
        return failure(error.status, error.message, error.code);
      }
      const rateFailure = spotifyRateLimitFailure(error);
      if (rateFailure) {
        return failure(rateFailure.status, rateFailure.error, rateFailure.code);
      }
      if (error instanceof SpotifyAPIError) {
        return failure(
          error.status,
          error.status === 403
            ? "Spotify didn't allow playlist creation for this account."
            : "Couldn't create the Spotify playlist.",
          error.status === 403 ? "spotify_capability_unavailable" : null
        );
      }
      return failure(502, "Couldn't create the Spotify playlist.");
    }
  },
});

function failure(
  status: number,
  error: string,
  code: string | null = null
): SavePlaylistResult {
  return { status, error, code, data: null };
}

function interleaveTrackIds(
  anchorId: string | null,
  tracksA: Array<{ id: string }>,
  tracksB: Array<{ id: string }>
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const append = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  };
  append(anchorId);
  const count = Math.max(tracksA.length, tracksB.length);
  for (let index = 0; index < count && result.length < 25; index++) {
    append(tracksA[index]?.id);
    append(tracksB[index]?.id);
  }
  return result;
}
