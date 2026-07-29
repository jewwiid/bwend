import Foundation

// MARK: - API DTOs
//
// The simplified contract: connect Spotify (issues token), create invite, claim (computes match),
// read match with everything the 3-layer reveal needs.

/// Response from POST /auth/spotify. Contains the Bwend session JWT + basic profile.
struct SpotifyConnectResponse: Codable, Equatable {
    let token: String
    let spotifyId: String
    let displayName: String?
    let topTrackCount: Int
    let topArtistCount: Int
}

/// Response from POST /invites. The shareable code + URL.
struct CreateInviteResponse: Codable, Equatable {
    let code: String
    let url: String
    let expiresAt: Date
}

/// Response from GET /invites/{code} — the recipient preview.
struct InvitePreview: Codable, Equatable {
    let code: String
    let inviterName: String?
    /// Bare names, kept for compatibility. Prefer `inviterArtists` — it carries the photos.
    let inviterTopArtists: [String]
    let inviterArtists: [ArtistBrief]?
    let expiresAt: Date
    let alreadyClaimed: Bool
    let isMine: Bool
}

/// An artist reduced to what the UI needs: a name and a face.
struct ArtistBrief: Codable, Equatable, Hashable, Identifiable {
    let id: String
    let name: String
    let imageURL: String?
}

/// Response from POST /invites/{code}/claim — the match is created here.
struct ClaimResponse: Codable, Equatable {
    let matchId: UUID
    let vibeScore: Int
    let breakdown: VibeBreakdown
}

/// The score breakdown. All values 0–1.
///
/// A nil component means Spotify didn't give us the signal to compare — it was excluded
/// from the score entirely rather than counted as zero, so it's hidden in the UI instead
/// of being drawn as an empty bar. (Energy/mood/tempo are gone for good: Spotify
/// deprecated the audio-features endpoint they came from on 2024-11-27.)
struct VibeBreakdown: Codable, Equatable, Hashable {
    let trackOverlap: Double
    let artistOverlap: Double
    let genreOverlap: Double?
    let popularitySim: Double?
    let eraSim: Double?
    /// How similarly the two of you chase new music vs stay loyal.
    let discoverySim: Double?
    /// Overlap in the hours you actually listen. Nil without the recently-played scope.
    let clockSim: Double?
}

/// Response from GET /matches/{id} — everything the 3-layer reveal needs.
struct PublicMatch: Codable, Equatable, Identifiable {
    let id: UUID
    let vibeScore: Int
    let breakdown: VibeBreakdown
    let myName: String?
    let partnerName: String?
    let anchorTrack: AnchorTrack?
    let sharedTopArtistNames: [String]
    let sharedTopTrackNames: [String]
    let compatibilityRead: String
    let createdAt: Date
}

/// The single "song that brings you together." Frozen at claim time.
struct AnchorTrack: Codable, Equatable, Hashable {
    let id: String
    let name: String
    let artistName: String?
    let imageURL: String?
    let spotifyURL: String?
}

// MARK: - Blend (your own listening profile)

/// Response from GET /me/blend. Everything the Blend screen renders.
struct BlendResponse: Codable, Equatable {
    let displayName: String?
    let timeRange: String
    /// Mean release year across the window. Nil when no release dates were parseable.
    let era: Double?
    let topArtists: [BlendArtist]
    let topTracks: [BlendTrack]
    /// Nil when the user hasn't granted `user-read-recently-played`.
    let recentlyPlayed: [BlendTrack]?
    let library: LibraryCounts
}

struct BlendArtist: Codable, Equatable, Hashable, Identifiable {
    let id: String
    let name: String
    let imageURL: String?
    let spotifyURL: String?
}

struct BlendTrack: Codable, Equatable, Hashable, Identifiable {
    let id: String
    let name: String
    let artistName: String?
    let artistNames: [String]
    let albumName: String?
    let imageURL: String?
    let spotifyURL: String?
    let durationMs: Int?
    let explicit: Bool?
    let releaseYear: Double?

    /// "Artist A, Artist B" — every credited artist, falling back to the primary.
    var creditLine: String {
        artistNames.isEmpty ? (artistName ?? "") : artistNames.joined(separator: ", ")
    }

    /// "3:42". Empty when Spotify didn't supply a duration.
    var durationText: String {
        guard let durationMs, durationMs > 0 else { return "" }
        let total = durationMs / 1000
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// Library totals. Each is nil when the matching scope wasn't granted.
struct LibraryCounts: Codable, Equatable, Hashable {
    let savedTracks: Int?
    let savedAlbums: Int?
    let playlists: Int?
    let followedArtists: Int?

    var isEmpty: Bool {
        savedTracks == nil && savedAlbums == nil && playlists == nil && followedArtists == nil
    }
}

/// The three windows Spotify exposes for top reads.
enum BlendTimeRange: String, CaseIterable, Identifiable {
    case short = "short_term"
    case medium = "medium_term"
    case long = "long_term"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .short:  return "Last month"
        case .medium: return "6 months"
        case .long:   return "All time"
        }
    }
}

/// Response from GET /matches — a summary row for the history list on StartView.
struct MatchSummary: Codable, Equatable, Identifiable {
    let id: UUID
    let partnerName: String?
    let vibeScore: Int
    let anchorTrackName: String?
    let createdAt: Date
}
