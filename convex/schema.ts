import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Landing page waitlist — untouched, existing functionality.
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // --- iOS app backend tables (ported from Vapor SimplifySchema) ---

  // Per-user data, keyed by Spotify user id.
  bwendProfiles: defineTable({
    spotifyUserId: v.string(),
    displayName: v.union(v.string(), v.null()),
    topTracks: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        artistIds: v.array(v.string()),
        releaseYear: v.union(v.number(), v.null()),
      })
    ),
    topArtists: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        genres: v.array(v.string()),
      })
    ),
    audioProfile: v.object({
      energy: v.number(),
      valence: v.number(),
      tempo: v.number(),
      danceability: v.number(),
      era: v.number(),
    }),
    spotifyTokenBlob: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spotify_user_id", ["spotifyUserId"]),

  // Shareable invites.
  invites: defineTable({
    code: v.string(),
    inviterSpotifyUserId: v.string(),
    inviteeSpotifyUserId: v.union(v.string(), v.null()),
    status: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("expired")
    ),
    createdAt: v.number(),
    claimedAt: v.union(v.number(), v.null()),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_inviter", ["inviterSpotifyUserId"]),

  // Completed pairings with frozen reveal data.
  matches: defineTable({
    inviteId: v.id("invites"),
    userASpotifyUserId: v.string(),
    userBSpotifyUserId: v.string(),
    vibeScore: v.number(),
    breakdown: v.object({
      trackOverlap: v.number(),
      artistOverlap: v.number(),
      energySim: v.number(),
      valenceSim: v.number(),
      tempoSim: v.number(),
      eraSim: v.number(),
    }),
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
  })
    .index("by_user_a", ["userASpotifyUserId"])
    .index("by_user_b", ["userBSpotifyUserId"]),
});
