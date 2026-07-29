import SwiftUI

// MARK: - BlendView
//
// The user's own listening profile — the thing they get back for connecting Spotify.
// Before this screen existed, connecting produced a greeting and an invite button, and
// nothing else happened until a second person claimed the link.
//
// Everything here comes from /me/top/tracks and /me/top/artists. Spotify deprecated audio
// features, genres and popularity for this app, so artwork and rank ARE the content — hence
// the emphasis on large images over stat rows.

struct BlendView: View {
    @EnvironmentObject var api: APIClient
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var router: Router

    @State private var blend: BlendResponse?
    @State private var timeRange: BlendTimeRange = .medium
    @State private var loading = false
    @State private var errorMessage: String?

    /// Cache per window so flipping back and forth doesn't re-hit the network.
    @State private var cache: [BlendTimeRange: BlendResponse] = [:]

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.5)

            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    rangePicker

                    if let blend {
                        artistsSection(blend)
                        tracksSection(blend)
                        if let recent = blend.recentlyPlayed, !recent.isEmpty {
                            recentSection(recent)
                        }
                        statsSection(blend)
                    } else if loading {
                        loadingState
                    } else if let errorMessage {
                        errorState(errorMessage)
                    }

                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
            }
            .refreshable { await load(timeRange, force: true) }
        }
        .background(Color.bwendBackground.ignoresSafeArea())
        .navigationTitle("Your blend")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load(timeRange) }
    }

    // MARK: - Time range

    @ViewBuilder
    private var rangePicker: some View {
        HStack(spacing: 8) {
            ForEach(BlendTimeRange.allCases) { range in
                let selected = range == timeRange
                Button {
                    timeRange = range
                    Task { await load(range) }
                } label: {
                    Text(range.label)
                        .font(.bwend(size: 13, weight: selected ? .bold : .regular))
                        .foregroundColor(selected ? Color.bwendBackground : Color.bwendTextSecondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule().fill(selected ? Color.bwendText : Color.bwendBgCard)
                        )
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    // MARK: - Artists

    @ViewBuilder
    private func artistsSection(_ blend: BlendResponse) -> some View {
        if !blend.topArtists.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                SectionLabel("On repeat")

                let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(blend.topArtists.prefix(9)) { artist in
                        SpotifyLink(url: artist.spotifyURL) {
                            VStack(spacing: 8) {
                                RemoteArtwork(url: artist.imageURL, fallbackSymbol: "person.fill")
                                    .aspectRatio(1, contentMode: .fill)
                                    .clipShape(Circle())

                                Text(artist.name)
                                    .font(.bwend(size: 12, weight: .medium))
                                    .foregroundColor(Color.bwendText)
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Tracks

    @ViewBuilder
    private func tracksSection(_ blend: BlendResponse) -> some View {
        if !blend.topTracks.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                SectionLabel("Your top tracks")

                VStack(spacing: 0) {
                    ForEach(Array(blend.topTracks.prefix(10).enumerated()), id: \.element.id) { index, track in
                        SpotifyLink(url: track.spotifyURL) {
                            TrackRow(rank: index + 1, track: track)
                        }
                        if index < min(9, blend.topTracks.count - 1) {
                            Divider().overlay(Color.bwendBorderSubtle)
                        }
                    }
                }
                .padding(.vertical, 4)
                .background(Color.bwendBgCard)
                .cornerRadius(BwendRadius.lg)
            }
        }
    }

    // MARK: - Recently played

    @ViewBuilder
    private func recentSection(_ recent: [BlendTrack]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Lately")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(recent.prefix(12)) { track in
                        SpotifyLink(url: track.spotifyURL) {
                            VStack(alignment: .leading, spacing: 8) {
                                RemoteArtwork(url: track.imageURL, fallbackSymbol: "music.note")
                                    .frame(width: 128, height: 128)
                                    .cornerRadius(BwendRadius.md)

                                Text(track.name)
                                    .font(.bwend(size: 12, weight: .medium))
                                    .foregroundColor(Color.bwendText)
                                    .lineLimit(1)
                                Text(track.creditLine)
                                    .font(.bwend(size: 11))
                                    .foregroundColor(Color.bwendTextMuted)
                                    .lineLimit(1)
                            }
                            .frame(width: 128, alignment: .leading)
                        }
                    }
                }
                .padding(.horizontal, 24)
            }
            // Cancel the parent's horizontal padding so the strip bleeds to the screen edge,
            // then re-add it inside — otherwise the first card looks inset and the last one
            // gets clipped mid-scroll.
            .padding(.horizontal, -24)
        }
    }

    // MARK: - Stats

    @ViewBuilder
    private func statsSection(_ blend: BlendResponse) -> some View {
        let items = statItems(blend)
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                SectionLabel("Your numbers")

                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                    spacing: 12
                ) {
                    ForEach(items, id: \.label) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.value)
                                .font(.bwend(size: 22, weight: .bold))
                                .foregroundColor(Color.bwendText)
                            Text(item.label)
                                .font(.bwend(size: 12))
                                .foregroundColor(Color.bwendTextMuted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(Color.bwendBgCard)
                        .cornerRadius(BwendRadius.md)
                    }
                }
            }
        }
    }

    /// Only stats we actually have. Spotify withholds several of these depending on the
    /// scopes the user granted, and an empty tile reads as a bug.
    private func statItems(_ blend: BlendResponse) -> [(label: String, value: String)] {
        var out: [(label: String, value: String)] = []
        if let era = blend.era {
            out.append((label: "Your era", value: String(Int(era.rounded()))))
        }
        let lib = blend.library
        if let n = lib.savedTracks     { out.append((label: "Saved songs",      value: n.formatted())) }
        if let n = lib.savedAlbums     { out.append((label: "Saved albums",     value: n.formatted())) }
        if let n = lib.playlists       { out.append((label: "Playlists",        value: n.formatted())) }
        if let n = lib.followedArtists { out.append((label: "Artists followed", value: n.formatted())) }
        return out
    }

    // MARK: - Placeholder states

    @ViewBuilder
    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Reading your library…")
                .font(.bwend(size: 13))
                .foregroundColor(Color.bwendTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    @ViewBuilder
    private func errorState(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(message)
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendText)
            Button("Try again") {
                Task { await load(timeRange, force: true) }
            }
            .font(.bwend(size: 13, weight: .bold))
            .foregroundColor(Color.Accent.cta)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }

    // MARK: - Loading

    @MainActor
    private func load(_ range: BlendTimeRange, force: Bool = false) async {
        if !force, let cached = cache[range] {
            blend = cached
            return
        }

        loading = true
        errorMessage = nil
        // Clear so a slow window switch doesn't leave the previous range's data on screen
        // under the newly-selected chip.
        if force || cache[range] == nil { blend = nil }

        do {
            let response = try await api.myBlend(timeRange: range)
            cache[range] = response
            // Ignore a response that lost the race with a newer selection.
            if range == timeRange { blend = response }
        } catch let e as APIError {
            // The session is valid but there's nothing behind it — profile deleted, Spotify
            // access revoked, refresh token dead. Without this the user is stranded on an
            // error card with no route back to the connect screen.
            if e.requiresReconnect {
                auth.signOut()
                router.reset(to: .spotifyConnect)
                return
            }
            if range == timeRange { errorMessage = e.errorDescription }
        } catch {
            if range == timeRange { errorMessage = error.localizedDescription }
        }
        loading = false
    }
}

// MARK: - Track row

private struct TrackRow: View {
    let rank: Int
    let track: BlendTrack

    var body: some View {
        HStack(spacing: 12) {
            Text("\(rank)")
                .font(.bwend(size: 12, weight: .medium))
                .foregroundColor(Color.bwendTextMuted)
                .frame(width: 18, alignment: .trailing)

            RemoteArtwork(url: track.imageURL, fallbackSymbol: "music.note")
                .frame(width: 46, height: 46)
                .cornerRadius(BwendRadius.sm)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 5) {
                    Text(track.name)
                        .font(.bwend(size: 14, weight: .medium))
                        .foregroundColor(Color.bwendText)
                        .lineLimit(1)
                    if track.explicit == true {
                        Text("E")
                            .font(.bwend(size: 8, weight: .bold))
                            .foregroundColor(Color.bwendTextMuted)
                            .padding(2)
                            .background(
                                RoundedRectangle(cornerRadius: 2)
                                    .stroke(Color.bwendTextMuted, lineWidth: 0.8)
                            )
                    }
                }
                Text(track.creditLine)
                    .font(.bwend(size: 12))
                    .foregroundColor(Color.bwendTextMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            if !track.durationText.isEmpty {
                Text(track.durationText)
                    .font(.bwend(size: 11))
                    .foregroundColor(Color.bwendTextMuted)
                    .monospacedDigit()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .contentShape(Rectangle())
    }
}

// MARK: - Remote artwork

/// Async image with a themed placeholder.
///
/// Spotify's CDN URLs are stable and cacheable, so AsyncImage's built-in URLCache handling
/// is enough — no image library needed.
struct RemoteArtwork: View {
    let url: String?
    let fallbackSymbol: String

    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            case .failure, .empty:
                placeholder
            @unknown default:
                placeholder
            }
        }
        .clipped()
    }

    private var placeholder: some View {
        ZStack {
            Color.bwendBgMuted
            Image(systemName: fallbackSymbol)
                .font(.system(size: 15))
                .foregroundColor(Color.bwendTextDisabled)
        }
    }
}

// MARK: - Spotify link

/// Wraps content in a tap target that opens Spotify, or renders it plainly when there's no
/// URL — so a missing link degrades to non-interactive rather than a dead button.
private struct SpotifyLink<Content: View>: View {
    let url: String?
    @ViewBuilder var content: Content

    var body: some View {
        if let url = url.flatMap(URL.init(string:)) {
            Link(destination: url) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }
}

#Preview {
    NavigationStack {
        BlendView()
            .environmentObject(APIClient())
    }
}
