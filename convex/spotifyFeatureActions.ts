/**
 * Read-only Spotify product features used by the web and iPhone clients.
 *
 * Every action shares the same token-refresh helper. Endpoint-level 403s are capability
 * failures, not dead Bwend sessions, so callers can hide an unavailable surface without
 * signing the user out.
 */

"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  availableDevices,
  currentlyPlaying,
  discovery as fetchDiscovery,
  hasScope,
  playbackState,
  searchTracks,
  SpotifyAPIError,
  spotifyRateLimitFailure,
} from "./lib/spotify";
import {
  requireFreshSpotifySession,
  SpotifySessionError,
} from "./lib/spotifySession";

const trackValidator = v.object({
  id: v.string(),
  name: v.string(),
  artistIds: v.array(v.string()),
  artistName: v.union(v.string(), v.null()),
  artistNames: v.array(v.string()),
  albumName: v.union(v.string(), v.null()),
  imageURL: v.union(v.string(), v.null()),
  spotifyURL: v.union(v.string(), v.null()),
  durationMs: v.union(v.number(), v.null()),
  explicit: v.union(v.boolean(), v.null()),
  releaseYear: v.union(v.number(), v.null()),
  popularity: v.union(v.number(), v.null()),
});

const deviceValidator = v.object({
  id: v.union(v.string(), v.null()),
  name: v.string(),
  type: v.string(),
  isActive: v.boolean(),
  isRestricted: v.boolean(),
  volumePercent: v.union(v.number(), v.null()),
});

const errorResultValidator = {
  status: v.number(),
  error: v.string(),
  code: v.union(v.string(), v.null()),
  data: v.null(),
};

const nowPlayingDataValidator = v.object({
  isPlaying: v.boolean(),
  progressMs: v.union(v.number(), v.null()),
  fetchedAt: v.number(),
  track: v.union(trackValidator, v.null()),
});

export const nowPlaying = internalAction({
  args: { spotifyUserId: v.string() },
  returns: v.union(
    v.object({
      status: v.number(),
      error: v.null(),
      code: v.null(),
      data: v.union(nowPlayingDataValidator, v.null()),
    }),
    v.object(errorResultValidator)
  ),
  handler: async (ctx, args) => {
    try {
      const { tokens } = await requireFreshSpotifySession(ctx, args.spotifyUserId);
      if (!hasScope(tokens, "user-read-currently-playing")) {
        return capabilityError("Reconnect Spotify to show what you're playing right now.");
      }
      const data = await currentlyPlaying(tokens.accessToken);
      return { status: 200, error: null, code: null, data };
    } catch (error) {
      return featureError(error, "Couldn't load your current track.");
    }
  },
});

export const player = internalAction({
  args: { spotifyUserId: v.string() },
  returns: v.union(
    v.object({
      status: v.number(),
      error: v.null(),
      code: v.null(),
      data: v.object({
        state: v.union(
          v.object({
            isPlaying: v.boolean(),
            progressMs: v.union(v.number(), v.null()),
            fetchedAt: v.number(),
            track: v.union(trackValidator, v.null()),
            device: v.union(deviceValidator, v.null()),
          }),
          v.null()
        ),
        devices: v.array(deviceValidator),
      }),
    }),
    v.object(errorResultValidator)
  ),
  handler: async (ctx, args) => {
    try {
      const { tokens } = await requireFreshSpotifySession(ctx, args.spotifyUserId);
      if (!hasScope(tokens, "user-read-playback-state")) {
        return capabilityError("Reconnect Spotify to show your active listening device.");
      }
      const [state, devices] = await Promise.all([
        playbackState(tokens.accessToken),
        availableDevices(tokens.accessToken),
      ]);
      return { status: 200, error: null, code: null, data: { state, devices } };
    } catch (error) {
      return featureError(error, "Couldn't load your Spotify devices.");
    }
  },
});

export const search = internalAction({
  args: {
    spotifyUserId: v.string(),
    query: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.number(),
      error: v.null(),
      code: v.null(),
      data: v.array(trackValidator),
    }),
    v.object(errorResultValidator)
  ),
  handler: async (ctx, args) => {
    const query = args.query.trim().slice(0, 100);
    if (query.length < 2) {
      return { status: 200, error: null, code: null, data: [] };
    }
    try {
      const { tokens } = await requireFreshSpotifySession(ctx, args.spotifyUserId);
      const data = await searchTracks(tokens.accessToken, query);
      return { status: 200, error: null, code: null, data };
    } catch (error) {
      return featureError(error, "Spotify search isn't available right now.");
    }
  },
});

export const discovery = internalAction({
  args: { spotifyUserId: v.string() },
  returns: v.union(
    v.object({
      status: v.number(),
      error: v.null(),
      code: v.null(),
      data: v.array(
        v.object({
          id: v.string(),
          kind: v.union(v.literal("album"), v.literal("playlist")),
          name: v.string(),
          subtitle: v.union(v.string(), v.null()),
          imageURL: v.union(v.string(), v.null()),
          spotifyURL: v.union(v.string(), v.null()),
        })
      ),
    }),
    v.object(errorResultValidator)
  ),
  handler: async (ctx, args) => {
    try {
      const { tokens } = await requireFreshSpotifySession(ctx, args.spotifyUserId);
      const data = await fetchDiscovery(tokens.accessToken);
      return { status: 200, error: null, code: null, data };
    } catch (error) {
      return featureError(error, "Spotify discovery isn't available right now.");
    }
  },
});

function capabilityError(message: string) {
  return {
    status: 403,
    error: message,
    code: "spotify_scope_required",
    data: null,
  } as const;
}

function featureError(error: unknown, fallback: string) {
  if (error instanceof SpotifySessionError) {
    return {
      status: error.status,
      error: error.message,
      code: error.code,
      data: null,
    } as const;
  }
  const rateFailure = spotifyRateLimitFailure(error);
  if (rateFailure) {
    return { ...rateFailure, data: null } as const;
  }
  if (error instanceof SpotifyAPIError) {
    return {
      status: error.status === 401 ? 421 : error.status,
      error: error.status === 403 ? `${fallback} Spotify denied this capability.` : fallback,
      code: error.status === 403 ? "spotify_capability_unavailable" : null,
      data: null,
    } as const;
  }
  return { status: 502, error: fallback, code: null, data: null } as const;
}
