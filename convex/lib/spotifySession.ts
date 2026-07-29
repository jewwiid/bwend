/**
 * Shared Spotify-session loading and refresh for Node actions.
 *
 * Spotify access tokens expire hourly. Feature actions should call this helper rather than
 * reimplementing token refresh and accidentally dropping a refresh token or granted scopes.
 */

import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  decodeTokenBlob,
  encodeTokenBlob,
  isTokenExpired,
  refreshAccessToken,
  type StoredTokens,
} from "./spotify";

export class SpotifySessionError extends Error {
  readonly status: number;
  readonly code: "reconnect_required";

  constructor(message: string, status = 421) {
    super(message);
    this.name = "SpotifySessionError";
    this.status = status;
    this.code = "reconnect_required";
  }
}

export interface FreshSpotifySession {
  profile: Doc<"bwendProfiles">;
  tokens: StoredTokens;
}

export async function requireFreshSpotifySession(
  ctx: ActionCtx,
  spotifyUserId: string
): Promise<FreshSpotifySession> {
  const profile = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
    spotifyUserId,
  });

  if (!profile) {
    throw new SpotifySessionError(
      "Your Spotify account isn't connected any more. Reconnect to continue.",
      404
    );
  }
  if (!profile.spotifyTokenBlob) {
    throw new SpotifySessionError("Your Spotify connection expired. Reconnect to continue.");
  }

  let tokens = decodeTokenBlob(profile.spotifyTokenBlob);
  if (!tokens) {
    throw new SpotifySessionError("Your Spotify connection expired. Reconnect to continue.");
  }
  if (!isTokenExpired(tokens)) return { profile, tokens };

  const refreshToken = tokens.refreshToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) {
    throw new SpotifySessionError("Your Spotify connection expired. Reconnect to continue.");
  }

  try {
    const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
    const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
    const nextScope = refreshed.scope ?? tokens.scope;
    const spotifyTokenBlob = encodeTokenBlob({
      accessToken: refreshed.accessToken,
      tokenType: refreshed.tokenType,
      expiresIn: refreshed.expiresIn,
      refreshToken: nextRefreshToken,
      scope: nextScope,
    });

    await ctx.runMutation(internal.bwendProfileMutations.updateTokenBlob, {
      spotifyUserId,
      spotifyTokenBlob,
    });

    tokens = {
      accessToken: refreshed.accessToken,
      refreshToken: nextRefreshToken,
      scope: nextScope,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
    return { profile, tokens };
  } catch {
    throw new SpotifySessionError("Your Spotify connection expired. Reconnect to continue.");
  }
}
