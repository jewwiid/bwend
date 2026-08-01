"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  currentUserPlaylists,
  hasScope,
  readSpotifyPlaylist,
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

const playlistValidator = v.object({
  id: v.string(),
  name: v.string(),
  imageURL: v.union(v.string(), v.null()),
  spotifyURL: v.string(),
  trackCount: v.number(),
  collaborative: v.boolean(),
});

const playlistReadValidator = v.object({
  id: v.string(),
  name: v.string(),
  imageURL: v.union(v.string(), v.null()),
  spotifyURL: v.string(),
  trackCount: v.number(),
  collaborative: v.boolean(),
  tracksReadable: v.boolean(),
  tracks: v.array(trackValidator),
});

const errorValidator = v.object({
  status: v.number(),
  error: v.string(),
  code: v.union(v.string(), v.null()),
  data: v.null(),
});

export const list = internalAction({
  args: { bwendUserId: v.string() },
  returns: v.union(
    v.object({ status: v.number(), error: v.null(), code: v.null(), data: v.array(playlistValidator) }),
    errorValidator
  ),
  handler: async (ctx, args) => {
    try {
      const { tokens } = await requireFreshSpotifySession(ctx, args.bwendUserId);
      if (!hasScope(tokens, "playlist-read-private")) return scopeError();
      const data = await currentUserPlaylists(tokens.accessToken, 50);
      return { status: 200, error: null, code: null, data } as const;
    } catch (error) {
      return readError(error, "Couldn't load your Spotify playlists.");
    }
  },
});

export const getSelected = internalAction({
  args: { bwendUserId: v.string() },
  returns: v.union(
    v.object({
      status: v.number(),
      error: v.null(),
      code: v.null(),
      data: v.union(playlistReadValidator, v.null()),
    }),
    errorValidator
  ),
  handler: async (ctx, args) => {
    try {
      const { profile, tokens } = await requireFreshSpotifySession(ctx, args.bwendUserId);
      if (!profile.spotifyBlendPlaylistId) {
        return { status: 200, error: null, code: null, data: null } as const;
      }
      if (!hasScope(tokens, "playlist-read-private")) return scopeError();
      const data = await readSpotifyPlaylist(tokens.accessToken, profile.spotifyBlendPlaylistId);
      return { status: 200, error: null, code: null, data } as const;
    } catch (error) {
      return readError(error, "Couldn't read that Spotify Blend right now.");
    }
  },
});

export const select = internalAction({
  args: { bwendUserId: v.string(), playlistId: v.string() },
  returns: v.union(
    v.object({ status: v.number(), error: v.null(), code: v.null(), data: playlistReadValidator }),
    errorValidator
  ),
  handler: async (ctx, args) => {
    const playlistId = args.playlistId.trim();
    if (!/^[A-Za-z0-9]{8,64}$/.test(playlistId)) {
      return failure(400, "Choose a playlist from your Spotify library.", "invalid_playlist_id");
    }
    try {
      const { tokens } = await requireFreshSpotifySession(ctx, args.bwendUserId);
      if (!hasScope(tokens, "playlist-read-private")) return scopeError();

      // Never accept an arbitrary public playlist id: it must be present in the caller's
      // current Spotify library at selection time.
      const playlists = await currentUserPlaylists(tokens.accessToken, 50);
      if (!playlists.some((playlist) => playlist.id === playlistId)) {
        return failure(
          404,
          "That playlist is not in the first 50 playlists of your Spotify library.",
          "playlist_not_in_library"
        );
      }
      const data = await readSpotifyPlaylist(tokens.accessToken, playlistId);
      const updated = await ctx.runMutation(internal.spotifyBlendMutations.updatePlaylist, {
        bwendUserId: args.bwendUserId,
        spotifyBlendPlaylistId: playlistId,
        selectedAt: Date.now(),
      });
      if (!updated) return failure(404, "Reconnect Spotify to restore your Taste Card.", "reconnect_required");
      return { status: 200, error: null, code: null, data } as const;
    } catch (error) {
      return readError(error, "Couldn't read that Spotify Blend right now.");
    }
  },
});

function scopeError() {
  return failure(
    403,
    "Reconnect Spotify to choose and read a private Blend playlist.",
    "spotify_scope_required"
  );
}

function failure(status: number, error: string, code: string | null = null) {
  return { status, error, code, data: null } as const;
}

function readError(error: unknown, fallback: string) {
  if (error instanceof SpotifySessionError) {
    return failure(error.status, error.message, error.code);
  }
  const rateFailure = spotifyRateLimitFailure(error);
  if (rateFailure) return failure(rateFailure.status, rateFailure.error, rateFailure.code);
  if (error instanceof SpotifyAPIError) {
    return failure(
      error.status === 401 ? 421 : error.status,
      error.status === 403 ? `${fallback} Spotify denied access to its tracks.` : fallback,
      error.status === 403 ? "spotify_capability_unavailable" : null
    );
  }
  return failure(502, fallback);
}
