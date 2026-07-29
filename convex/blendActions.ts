/**
 * Internal action backing GET /api/me/blend — the user's own listening profile.
 *
 * Reads live from Spotify rather than replaying the connect-time snapshot, because the
 * time-range switcher needs data the snapshot doesn't hold (short_term / long_term) and the
 * recently-played and library sections are inherently live.
 *
 * Access tokens expire after an hour, so this refreshes on demand and writes the new blob
 * back. Everything past the two top-reads is best-effort: a user who connected before the
 * extra scopes existed still gets their artists and tracks.
 */

"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  topTracks,
  topArtists,
  recentlyPlayed,
  libraryCounts,
  hasScope,
  asTimeRange,
  spotifyRateLimitFailure,
} from "./lib/spotify";
import { meanReleaseYear } from "./lib/vibeScore";
import {
  requireFreshSpotifySession,
  SpotifySessionError,
} from "./lib/spotifySession";

export const myBlend = internalAction({
  args: {
    spotifyUserId: v.string(),
    timeRange: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const timeRange = asTimeRange(args.timeRange);

    let profile;
    let tokens;
    try {
      ({ profile, tokens } = await requireFreshSpotifySession(ctx, args.spotifyUserId));
    } catch (error) {
      const sessionError =
        error instanceof SpotifySessionError
          ? error
          : new SpotifySessionError("Your Spotify connection expired. Reconnect to see your blend.");
      return {
        status: sessionError.status,
        error: sessionError.message,
        code: sessionError.code,
        data: null,
      };
    }

    // Fetch everything in parallel. Only the two top-reads are required.
    const wantsRecent = hasScope(tokens, "user-read-recently-played");
    const wantsLibrary =
      hasScope(tokens, "user-library-read") ||
      hasScope(tokens, "playlist-read-private") ||
      hasScope(tokens, "user-follow-read");

    let artists, tracks;
    try {
      [artists, tracks] = await Promise.all([
        topArtists(tokens.accessToken, timeRange),
        topTracks(tokens.accessToken, timeRange),
      ]);
    } catch (e) {
      const rateFailure = spotifyRateLimitFailure(e);
      if (rateFailure) {
        return { ...rateFailure, data: null };
      }
      return {
        status: 502,
        error: "Couldn't reach Spotify right now. Please try again.",
        code: null,
        data: null,
      };
    }

    const [recent, library] = await Promise.all([
      wantsRecent
        ? recentlyPlayed(tokens.accessToken, 50)
            .then((r) => r.tracks)
            .catch(() => null)
        : Promise.resolve(null),
      wantsLibrary
        ? libraryCounts(tokens.accessToken).catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      status: 200,
      error: null,
      data: {
        displayName: profile.displayName,
        timeRange,
        era: meanReleaseYear(tracks),
        topArtists: artists,
        topTracks: tracks,
        recentlyPlayed: recent,
        library: library ?? {
          savedTracks: null,
          savedAlbums: null,
          playlists: null,
          followedArtists: null,
        },
      },
    };
  },
});
