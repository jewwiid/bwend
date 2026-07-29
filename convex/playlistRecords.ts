/**
 * Persistence for per-user saved match playlists.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const playlistRecordValidator = v.object({
  _id: v.id("matchPlaylists"),
  _creationTime: v.number(),
  matchId: v.id("matches"),
  spotifyUserId: v.string(),
  spotifyPlaylistId: v.string(),
  spotifyURL: v.string(),
  createdAt: v.number(),
});

export const getByMatchAndUser = internalQuery({
  args: {
    matchId: v.id("matches"),
    spotifyUserId: v.string(),
  },
  returns: v.union(v.null(), playlistRecordValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matchPlaylists")
      .withIndex("by_match_and_user", (q) =>
        q.eq("matchId", args.matchId).eq("spotifyUserId", args.spotifyUserId)
      )
      .first();
  },
});

export const save = internalMutation({
  args: {
    matchId: v.id("matches"),
    spotifyUserId: v.string(),
    spotifyPlaylistId: v.string(),
    spotifyURL: v.string(),
    createdAt: v.number(),
  },
  returns: v.id("matchPlaylists"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("matchPlaylists")
      .withIndex("by_match_and_user", (q) =>
        q.eq("matchId", args.matchId).eq("spotifyUserId", args.spotifyUserId)
      )
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("matchPlaylists", args);
  },
});
