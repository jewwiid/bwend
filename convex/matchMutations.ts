/**
 * Internal mutations for matches — called from the claim handler.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const breakdownValidator = v.object({
  trackOverlap: v.number(),
  artistOverlap: v.number(),
  genreOverlap: v.union(v.number(), v.null()),
  popularitySim: v.union(v.number(), v.null()),
  eraSim: v.union(v.number(), v.null()),
  discoverySim: v.union(v.number(), v.null()),
  clockSim: v.union(v.number(), v.null()),
});

const anchorTrackValidator = v.union(
  v.null(),
  v.object({
    id: v.string(),
    name: v.string(),
    artistName: v.union(v.string(), v.null()),
    imageURL: v.union(v.string(), v.null()),
    spotifyURL: v.union(v.string(), v.null()),
  })
);

/**
 * Atomically consume a pending invite and create its match.
 *
 * The score is prepared by the action, but this mutation re-checks the invite and performs both
 * writes in one transaction. Convex OCC guarantees that only one simultaneous claimer succeeds.
 */
export const finalizeClaim = internalMutation({
  args: {
    inviteId: v.id("invites"),
    claimerSpotifyUserId: v.string(),
    vibeScore: v.number(),
    breakdown: breakdownValidator,
    anchorTrack: anchorTrackValidator,
    sharedTopArtistNames: v.array(v.string()),
    sharedTopTrackNames: v.array(v.string()),
    compatibilityRead: v.string(),
    claimedAt: v.number(),
  },
  returns: v.union(
    v.object({ outcome: v.literal("claimed"), matchId: v.id("matches") }),
    v.object({ outcome: v.literal("not_found") }),
    v.object({ outcome: v.literal("not_claimable") }),
    v.object({ outcome: v.literal("expired") }),
    v.object({ outcome: v.literal("own_invite") })
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return { outcome: "not_found" as const };
    if (invite.status !== "pending") return { outcome: "not_claimable" as const };
    if (invite.expiresAt < args.claimedAt) {
      await ctx.db.patch(invite._id, { status: "expired" });
      return { outcome: "expired" as const };
    }
    if (invite.inviterSpotifyUserId === args.claimerSpotifyUserId) {
      return { outcome: "own_invite" as const };
    }

    const matchId = await ctx.db.insert("matches", {
      inviteId: invite._id,
      userASpotifyUserId: invite.inviterSpotifyUserId,
      userBSpotifyUserId: args.claimerSpotifyUserId,
      vibeScore: args.vibeScore,
      breakdown: args.breakdown,
      anchorTrack: args.anchorTrack,
      sharedTopArtistNames: args.sharedTopArtistNames,
      sharedTopTrackNames: args.sharedTopTrackNames,
      compatibilityRead: args.compatibilityRead,
      createdAt: args.claimedAt,
    });
    await ctx.db.patch(invite._id, {
      status: "claimed",
      inviteeSpotifyUserId: args.claimerSpotifyUserId,
      claimedAt: args.claimedAt,
    });

    return { outcome: "claimed" as const, matchId };
  },
});
