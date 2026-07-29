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
    // Both arrays are stored in Spotify's rank order (index 0 = most played). Scoring
    // discounts matches by rank, so the order is load-bearing — don't sort these.
    topTracks: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        artistIds: v.array(v.string()),
        artistName: v.union(v.string(), v.null()),
        artistNames: v.array(v.string()),
        albumName: v.union(v.string(), v.null()),
        // Album art / artist photos are captured at connect time because they cannot be
        // backfilled: /v1/tracks?ids= and /v1/artists?ids= are both 403 for this app.
        imageURL: v.union(v.string(), v.null()),
        spotifyURL: v.union(v.string(), v.null()),
        durationMs: v.union(v.number(), v.null()),
        explicit: v.union(v.boolean(), v.null()),
        releaseYear: v.union(v.number(), v.null()),
        popularity: v.union(v.number(), v.null()),
      })
    ),
    topArtists: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        genres: v.array(v.string()),
        imageURL: v.union(v.string(), v.null()),
        spotifyURL: v.union(v.string(), v.null()),
        popularity: v.union(v.number(), v.null()),
      })
    ),
    // Replaces the old audioProfile (energy/valence/tempo/danceability/era), which was
    // built from Spotify's now-deprecated /audio-features endpoint. Nulls mean "Spotify
    // did not provide this signal" and cause the matching component to be dropped.
    tasteProfile: v.object({
      genres: v.array(v.object({ name: v.string(), weight: v.number() })),
      popularity: v.union(v.number(), v.null()),
      era: v.union(v.number(), v.null()),
      eraSpread: v.union(v.number(), v.null()),
      discovery: v.union(v.number(), v.null()),
      // 24 bins, one per hour (UTC), summing to 1.
      clock: v.union(v.array(v.number()), v.null()),
    }),
    spotifyTokenBlob: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spotify_user_id", ["spotifyUserId"]),

  // Artist enrichment cache — the signal Spotify stopped providing, sourced from MusicBrainz
  // (genres, country) and ListenBrainz (similar artists).
  //
  // Keyed by Spotify artist id because that's what user profiles store, but `similar` is in
  // MBID space because that's ListenBrainz's key space. Cached rather than fetched per request:
  // MusicBrainz allows one request per second, so per-match lookups would be both unusably slow
  // and abusive. One row is shared by every user who listens to that artist.
  artists: defineTable({
    spotifyId: v.string(),
    name: v.string(),
    mbid: v.union(v.string(), v.null()),
    genres: v.array(v.string()),
    country: v.union(v.string(), v.null()),
    similar: v.array(
      v.object({ mbid: v.string(), name: v.string(), score: v.number() })
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("enriched"),
      // Resolved to nothing after repeated attempts. Retried after a long horizon — artists
      // do get added to MusicBrainz over time.
      v.literal("unresolved")
    ),
    attempts: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spotify_id", ["spotifyId"])
    .index("by_status", ["status", "updatedAt"]),

  // Shareable invites.
  invites: defineTable({
    code: v.string(),
    inviterSpotifyUserId: v.string(),
    inviteeSpotifyUserId: v.union(v.string(), v.null()),
    // Optional for backward compatibility with invites created before track-led invites.
    // When present, this becomes the match anchor instead of an automatically selected track.
    selectedTrack: v.optional(
      v.object({
        id: v.string(),
        name: v.string(),
        artistName: v.union(v.string(), v.null()),
        imageURL: v.union(v.string(), v.null()),
        spotifyURL: v.union(v.string(), v.null()),
      })
    ),
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
    // Null components were not computable (Spotify withheld the underlying signal) and
    // were excluded from the score rather than counted as zero.
    breakdown: v.object({
      trackOverlap: v.number(),
      artistOverlap: v.number(),
      genreOverlap: v.union(v.number(), v.null()),
      popularitySim: v.union(v.number(), v.null()),
      eraSim: v.union(v.number(), v.null()),
      discoverySim: v.union(v.number(), v.null()),
      clockSim: v.union(v.number(), v.null()),
    }),
    anchorTrack: v.union(
      v.null(),
      v.object({
        id: v.string(),
        name: v.string(),
        artistName: v.union(v.string(), v.null()),
        imageURL: v.union(v.string(), v.null()),
        spotifyURL: v.union(v.string(), v.null()),
      })
    ),
    sharedTopArtistNames: v.array(v.string()),
    sharedTopTrackNames: v.array(v.string()),
    compatibilityRead: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_a", ["userASpotifyUserId"])
    .index("by_user_b", ["userBSpotifyUserId"]),

  // One saved Spotify playlist per user per match. A playlist belongs to the Spotify
  // account that created it; both people can independently save the same blend.
  matchPlaylists: defineTable({
    matchId: v.id("matches"),
    spotifyUserId: v.string(),
    spotifyPlaylistId: v.string(),
    spotifyURL: v.string(),
    createdAt: v.number(),
  })
    .index("by_match_and_user", ["matchId", "spotifyUserId"])
    .index("by_spotify_user_id", ["spotifyUserId"]),

  // APNs device registrations. Tokens are opaque and may rotate, so the server upserts every
  // successful registration callback. Notification delivery is implemented after the product
  // surfaces so this table is intentionally independent from alert authorization state.
  pushSubscriptions: defineTable({
    spotifyUserId: v.string(),
    deviceToken: v.string(),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    timezone: v.string(),
    dailyHour: v.number(),
    enabled: v.boolean(),
    lastDailySentKey: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_device_token", ["deviceToken"])
    .index("by_spotify_user_id", ["spotifyUserId"])
    .index("by_enabled", ["enabled"]),
});
