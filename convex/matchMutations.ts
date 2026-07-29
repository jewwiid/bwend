/**
 * Internal mutations for matches — called from the claim handler.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Create a new match with frozen reveal data. */
export const create = internalMutation({
  args: {
    inviteId: v.id("invites"),
    userASpotifyUserId: v.string(),
    userBSpotifyUserId: v.string(),
    vibeScore: v.number(),
    breakdown: v.any(),
    anchorTrack: v.union(
      v.null(),
      v.object({
        id: v.string(),
        name: v.string(),
        artistName: v.union(v.string(), v.null()),
      })
    ),
    sharedTopArtistNames: v.array(v.string()),
    sharedTopTrackNames: v.array(v.string()),
    compatibilityRead: v.string(),
    createdAt: v.number(),
  },
  returns: v.id("matches"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("matches", {
      inviteId: args.inviteId,
      userASpotifyUserId: args.userASpotifyUserId,
      userBSpotifyUserId: args.userBSpotifyUserId,
      vibeScore: args.vibeScore,
      breakdown: args.breakdown,
      anchorTrack: args.anchorTrack,
      sharedTopArtistNames: args.sharedTopArtistNames,
      sharedTopTrackNames: args.sharedTopTrackNames,
      compatibilityRead: args.compatibilityRead,
      createdAt: args.createdAt,
    });
  },
});
