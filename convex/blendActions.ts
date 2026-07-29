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
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  topTracks,
  topArtists,
  recentlyPlayed,
  libraryCounts,
  refreshAccessToken,
  decodeTokenBlob,
  encodeTokenBlob,
  isTokenExpired,
  hasScope,
  asTimeRange,
  type StoredTokens,
} from "./lib/spotify";
import { meanReleaseYear } from "./lib/vibeScore";

export const myBlend = internalAction({
  args: {
    spotifyUserId: v.string(),
    timeRange: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const timeRange = asTimeRange(args.timeRange);

    const profile: any = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
      spotifyUserId: args.spotifyUserId,
    });
    // `code` is what clients branch on. Status alone is ambiguous — a 404 here means "your
    // account no longer exists, sign in again", while a 404 from /invites means "that link is
    // wrong", and a client that signed the user out on both would be maddening.
    if (!profile) {
      return {
        status: 404,
        error: "Your Spotify account isn't connected any more. Reconnect to see your blend.",
        code: "reconnect_required",
        data: null,
      };
    }
    if (!profile.spotifyTokenBlob) {
      return {
        status: 421,
        error: "Your Spotify connection expired. Reconnect to see your blend.",
        code: "reconnect_required",
        data: null,
      };
    }

    let tokens = decodeTokenBlob(profile.spotifyTokenBlob);
    if (!tokens) {
      return {
        status: 421,
        error: "Your Spotify connection expired. Reconnect to see your blend.",
        code: "reconnect_required",
        data: null,
      };
    }

    // 1. Refresh the access token if it's expired (or predates absolute-expiry storage).
    try {
      tokens = await ensureFreshToken(ctx, args.spotifyUserId, tokens);
    } catch {
      // Refresh failed — the user revoked access, or the refresh token is dead. Only a fresh
      // authorization fixes this, so tell the client to send them back through connect.
      return {
        status: 421,
        error: "Your Spotify connection expired. Reconnect to see your blend.",
        code: "reconnect_required",
        data: null,
      };
    }

    // 2. Fetch everything in parallel. Only the two top-reads are required.
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
      return {
        status: 502,
        error: `Couldn't reach Spotify: ${(e as Error).message}`,
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

/**
 * Return usable tokens, refreshing and persisting when the access token has expired.
 *
 * The refreshed blob is written back so the next request doesn't refresh again — Spotify
 * rate-limits the token endpoint, and a read path that refreshes on every call will trip it.
 */
async function ensureFreshToken(
  ctx: any,
  spotifyUserId: string,
  tokens: StoredTokens
): Promise<StoredTokens> {
  if (!isTokenExpired(tokens)) return tokens;

  const refreshToken = tokens.refreshToken;
  if (!refreshToken) throw new Error("No refresh token stored.");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify credentials not configured.");

  const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);

  // Spotify omits `scope` on some refresh responses; keep the originally granted set so we
  // don't wrongly conclude the user lost a scope and hide their library section.
  const blob = encodeTokenBlob({
    accessToken: refreshed.accessToken,
    tokenType: refreshed.tokenType,
    expiresIn: refreshed.expiresIn,
    refreshToken: refreshed.refreshToken ?? refreshToken,
    scope: refreshed.scope ?? tokens.scope,
  });

  await ctx.runMutation(internal.bwendProfileMutations.updateTokenBlob, {
    spotifyUserId,
    spotifyTokenBlob: blob,
  });

  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? refreshToken,
    scope: refreshed.scope ?? tokens.scope,
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
  };
}
