import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const MAX_INVITES_TO_REVOKE = 500;

/** Save or remove the caller's optional Spotify Blend deep link. */
export const update = internalMutation({
  args: {
    bwendUserId: v.string(),
    spotifyBlendURL: v.union(v.string(), v.null()),
    revokeInviteSnapshots: v.boolean(),
  },
  returns: v.object({
    updated: v.boolean(),
    revokedInviteCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.bwendUserId))
      .first();
    if (!profile) return { updated: false, revokedInviteCount: 0 };

    await ctx.db.patch(profile._id, {
      spotifyBlendURL: args.spotifyBlendURL,
      updatedAt: Date.now(),
    });

    if (!args.revokeInviteSnapshots) {
      return { updated: true, revokedInviteCount: 0 };
    }

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_inviter", (q) => q.eq("inviterSpotifyUserId", args.bwendUserId))
      .take(MAX_INVITES_TO_REVOKE + 1);
    if (invites.length > MAX_INVITES_TO_REVOKE) {
      throw new Error("Spotify Blend removal exceeds the automatic invite safety bound.");
    }

    let revokedInviteCount = 0;
    for (const invite of invites) {
      if (invite.spotifyBlendURL) {
        await ctx.db.patch(invite._id, { spotifyBlendURL: null });
        revokedInviteCount += 1;
      }
    }
    return { updated: true, revokedInviteCount };
  },
});
