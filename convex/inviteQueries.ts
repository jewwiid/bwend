/**
 * Internal queries for invites — called from httpAction handlers.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

const selectedTrackValidator = v.object({
  id: v.string(),
  name: v.string(),
  artistName: v.union(v.string(), v.null()),
  imageURL: v.union(v.string(), v.null()),
  spotifyURL: v.union(v.string(), v.null()),
});

const inviteValidator = v.object({
  _id: v.id("invites"),
  _creationTime: v.number(),
  code: v.string(),
  inviterSpotifyUserId: v.string(),
  inviteeSpotifyUserId: v.union(v.string(), v.null()),
  selectedTrack: v.optional(selectedTrackValidator),
  status: v.union(v.literal("pending"), v.literal("claimed"), v.literal("expired")),
  createdAt: v.number(),
  claimedAt: v.union(v.number(), v.null()),
  expiresAt: v.number(),
});

/** Get all invite codes (for collision avoidance when creating new codes). */
export const allCodes = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    // Bounded collect — collision detection needs all codes, but we cap at 10k defensively.
    const invites = await ctx.db.query("invites").take(10000);
    return invites.map((i) => i.code);
  },
});

/** Get an invite by its code. */
export const getByCode = internalQuery({
  args: { code: v.string() },
  returns: v.union(v.null(), inviteValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

/** List the caller's sent invites, newest first, with enough context to manage them. */
export const listByInviter = internalQuery({
  args: {
    spotifyUserId: v.string(),
    now: v.number(),
  },
  returns: v.array(
    v.object({
      code: v.string(),
      status: v.union(v.literal("pending"), v.literal("claimed"), v.literal("expired")),
      selectedTrack: v.union(selectedTrackValidator, v.null()),
      createdAt: v.number(),
      claimedAt: v.union(v.number(), v.null()),
      expiresAt: v.number(),
      matchId: v.union(v.id("matches"), v.null()),
      partnerName: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_inviter", (q) => q.eq("inviterSpotifyUserId", args.spotifyUserId))
      .order("desc")
      .take(50);

    return await Promise.all(
      invites.map(async (invite) => {
        const effectiveStatus =
          invite.status === "pending" && invite.expiresAt < args.now
            ? "expired"
            : invite.status;
        const match =
          invite.status === "claimed"
            ? await ctx.db
                .query("matches")
                .withIndex("by_invite_id", (q) => q.eq("inviteId", invite._id))
                .first()
            : null;
        const partner =
          invite.inviteeSpotifyUserId !== null
            ? await ctx.db
                .query("bwendProfiles")
                .withIndex("by_spotify_user_id", (q) =>
                  q.eq("spotifyUserId", invite.inviteeSpotifyUserId!)
                )
                .first()
            : null;

        return {
          code: invite.code,
          status: effectiveStatus,
          selectedTrack: invite.selectedTrack ?? null,
          createdAt: invite.createdAt,
          claimedAt: invite.claimedAt,
          expiresAt: invite.expiresAt,
          matchId: match?._id ?? null,
          partnerName: partner?.displayName ?? null,
        };
      })
    );
  },
});
