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
    @State private var nowPlaying: NowPlayingResponse?
    @State private var nowPlayingUnavailable = false
    @State private var player: PlayerResponse?
    @State private var spotifyBlendURL: String?
    @State private var spotifyBlendInput = ""
    @State private var spotifyBlendBusy = false
    @State private var spotifyBlendMessage: String?
    @State private var confirmingSpotifyBlendRemoval = false
    @State private var spotifyBlendPlaylistId: String?
    @State private var spotifyPlaylists: [SpotifyPlaylistSummary] = []
    @State private var selectedSpotifyPlaylistId = ""
    @State private var spotifyBlendPlaylistRead: SpotifyBlendPlaylistRead?
    @State private var spotifyBlendPlaylistBusy = false
    @State private var spotifyBlendPlaylistMessage: String?

    /// Cache per window so flipping back and forth doesn't re-hit the network.
    @State private var cache: [BlendTimeRange: BlendResponse] = [:]

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.5)

            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    rangePicker

                    if let blend {
                        spotifyBlendSection
                        spotifyBlendPlaylistSection
                        if let nowPlaying, let track = nowPlaying.track {
                            NowPlayingStrip(nowPlaying: nowPlaying, track: track)
                        }
                        if let player {
                            PlayerDeviceCard(player: player)
                        }
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
        .task { await pollNowPlaying() }
        .task { await loadPlayer() }
        .confirmationDialog(
            "Remove your Spotify Blend?",
            isPresented: $confirmingSpotifyBlendRemoval,
            titleVisibility: .visible
        ) {
            Button("Remove from Bwend", role: .destructive) {
                Task { await removeSpotifyBlend() }
            }
            Button("Keep it", role: .cancel) {}
        } message: {
            Text("This also removes the Spotify Blend link from existing Bwend invites.")
        }
    }

    /// Presence is independent from the heavier blend payload. The task is cancelled
    /// automatically when the view disappears, and capability failures stop future polling.
    @MainActor
    private func pollNowPlaying() async {
        while !Task.isCancelled && !nowPlayingUnavailable {
            do {
                nowPlaying = try await api.nowPlaying()
            } catch let error as APIError {
                if case .http(let status, _) = error, status == 403 {
                    nowPlayingUnavailable = true
                }
            } catch {
                // Presence is best-effort. Keep the rest of the Blend screen intact.
            }

            do {
                try await Task.sleep(for: .seconds(30))
            } catch {
                return
            }
        }
    }

    @MainActor
    private func loadPlayer() async {
        player = try? await api.player()
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

    // MARK: - Spotify Blend handoff

    private var spotifyBlendSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 5) {
                    SectionLabel("Spotify Blend")
                    Text("One link, two ways to connect.")
                        .font(.bwend(size: 20, weight: .bold))
                        .foregroundColor(Color.bwendText)
                }
                Spacer()
                if let spotifyBlendURL, let url = URL(string: spotifyBlendURL) {
                    Link(destination: url) {
                        Text("OPEN SPOTIFY")
                            .font(.bwend(size: 11, weight: .bold))
                            .foregroundColor(Color.spotify)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("Paste the URL or Spotify's full invite message. New Bwend invites include it automatically.")
                    .font(.bwend(size: 13))
                    .foregroundColor(Color.bwendTextSecondary)
                    .lineSpacing(3)

                TextField(
                    "https://open.spotify.com/blend/taste-match/…",
                    text: $spotifyBlendInput,
                    axis: .vertical
                )
                .font(.bwend(size: 13))
                .foregroundColor(Color.bwendText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .lineLimit(2 ... 4)
                .padding(12)
                .background(Color.bwendBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: BwendRadius.md)
                        .stroke(Color.bwendBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: BwendRadius.md))
                .disabled(spotifyBlendBusy)
                .accessibilityLabel("Spotify Blend invite link")

                Text("Spotify may show Blend members your Spotify username and profile picture. Members can invite additional friends. Bwend never follows this invite link or reads its members.")
                    .font(.bwend(size: 11))
                    .foregroundColor(Color.bwendTextMuted)
                    .lineSpacing(3)

                HStack(spacing: 10) {
                    Button {
                        Task { await saveSpotifyBlend() }
                    } label: {
                        Text(spotifyBlendBusy ? "Saving…" : spotifyBlendURL == nil ? "Add to Taste Card" : "Replace link")
                            .font(.bwend(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color.Accent.cta))
                    }
                    .buttonStyle(.plain)
                    .disabled(spotifyBlendBusy || spotifyBlendInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    if spotifyBlendURL != nil {
                        Button("Remove", role: .destructive) {
                            confirmingSpotifyBlendRemoval = true
                        }
                        .font(.bwend(size: 13, weight: .bold))
                        .disabled(spotifyBlendBusy)
                    }
                }

                if let spotifyBlendMessage {
                    Text(spotifyBlendMessage)
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextSecondary)
                        .accessibilityLabel(spotifyBlendMessage)
                }
            }
            .padding(16)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.lg)
        }
    }

    private var spotifyBlendPlaylistSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Created on Spotify")
            Text("Read the Blend after it exists.")
                .font(.bwend(size: 20, weight: .bold))
                .foregroundColor(Color.bwendText)

            VStack(alignment: .leading, spacing: 12) {
                Text("The invite URL is not a playlist ID. After joining in Spotify, load your library and choose the created Blend yourself. Bwend reads it live only when you ask and never sends its tracks to AI.")
                    .font(.bwend(size: 13))
                    .foregroundColor(Color.bwendTextSecondary)
                    .lineSpacing(3)

                if !spotifyPlaylists.isEmpty {
                    Picker("Spotify playlist", selection: $selectedSpotifyPlaylistId) {
                        ForEach(spotifyPlaylists) { playlist in
                            Text("\(playlist.name) · \(playlist.trackCount) tracks")
                                .tag(playlist.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(Color.spotify)
                }

                HStack(spacing: 10) {
                    Button {
                        Task { await loadSpotifyPlaylists() }
                    } label: {
                        Text(spotifyBlendPlaylistBusy ? "Checking…" : "Load playlists")
                            .font(.bwend(size: 13, weight: .bold))
                    }
                    .buttonStyle(.bordered)
                    .disabled(spotifyBlendPlaylistBusy)

                    if !spotifyPlaylists.isEmpty {
                        Button {
                            Task { await selectSpotifyBlendPlaylist() }
                        } label: {
                            Text("Choose & read")
                                .font(.bwend(size: 13, weight: .bold))
                                .foregroundColor(.black)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.spotify)
                        .disabled(spotifyBlendPlaylistBusy || selectedSpotifyPlaylistId.isEmpty)
                    } else if spotifyBlendPlaylistId != nil {
                        Button {
                            Task { await readSelectedSpotifyBlendPlaylist() }
                        } label: {
                            Text("Read selected")
                                .font(.bwend(size: 13, weight: .bold))
                                .foregroundColor(.black)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.spotify)
                        .disabled(spotifyBlendPlaylistBusy)
                    }
                }

                if spotifyBlendPlaylistId != nil {
                    Button("Detach selected playlist", role: .destructive) {
                        Task { await removeSpotifyBlendPlaylist() }
                    }
                    .font(.bwend(size: 12, weight: .bold))
                    .disabled(spotifyBlendPlaylistBusy)
                }

                if let playlist = spotifyBlendPlaylistRead {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(playlist.name)
                                    .font(.bwend(size: 14, weight: .bold))
                                    .foregroundColor(Color.bwendText)
                                    .lineLimit(1)
                                Text("\(playlist.trackCount) tracks · \(playlist.tracksReadable ? "readable" : "metadata only")")
                                    .font(.bwend(size: 11))
                                    .foregroundColor(Color.bwendTextSecondary)
                            }
                            Spacer()
                            if let url = URL(string: playlist.spotifyURL) {
                                Link("OPEN", destination: url)
                                    .font(.bwend(size: 11, weight: .bold))
                                    .foregroundColor(Color.spotify)
                            }
                        }
                        ForEach(playlist.tracks.prefix(5)) { track in
                            Text("\(track.name)\(track.artistName.map { " · \($0)" } ?? "")")
                                .font(.bwend(size: 11))
                                .foregroundColor(Color.bwendTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    .padding(12)
                    .background(Color.bwendBackground)
                    .cornerRadius(BwendRadius.md)
                }

                if let spotifyBlendPlaylistMessage {
                    Text(spotifyBlendPlaylistMessage)
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextSecondary)
                        .accessibilityLabel(spotifyBlendPlaylistMessage)
                }
            }
            .padding(16)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.lg)
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
            spotifyBlendURL = response.spotifyBlendURL
            spotifyBlendInput = response.spotifyBlendURL ?? ""
            spotifyBlendPlaylistId = response.spotifyBlendPlaylistId
            if selectedSpotifyPlaylistId.isEmpty {
                selectedSpotifyPlaylistId = response.spotifyBlendPlaylistId ?? ""
            }
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

    @MainActor
    private func saveSpotifyBlend() async {
        spotifyBlendBusy = true
        spotifyBlendMessage = nil
        defer { spotifyBlendBusy = false }
        do {
            let response = try await api.saveSpotifyBlend(input: spotifyBlendInput)
            spotifyBlendURL = response.url
            spotifyBlendInput = response.url
            spotifyBlendMessage = "Saved. New Bwend invites will include this Spotify Blend."
        } catch let error as APIError {
            spotifyBlendMessage = error.errorDescription
        } catch {
            spotifyBlendMessage = error.localizedDescription
        }
    }

    @MainActor
    private func removeSpotifyBlend() async {
        spotifyBlendBusy = true
        spotifyBlendMessage = nil
        defer { spotifyBlendBusy = false }
        do {
            _ = try await api.removeSpotifyBlend()
            spotifyBlendURL = nil
            spotifyBlendInput = ""
            spotifyBlendMessage = "Removed from your Taste Card and existing Bwend invites."
        } catch let error as APIError {
            spotifyBlendMessage = error.errorDescription
        } catch {
            spotifyBlendMessage = error.localizedDescription
        }
    }

    @MainActor
    private func loadSpotifyPlaylists() async {
        spotifyBlendPlaylistBusy = true
        spotifyBlendPlaylistMessage = nil
        defer { spotifyBlendPlaylistBusy = false }
        do {
            spotifyPlaylists = try await api.spotifyPlaylists()
            if selectedSpotifyPlaylistId.isEmpty {
                selectedSpotifyPlaylistId = spotifyPlaylists.first?.id ?? ""
            }
            spotifyBlendPlaylistMessage = spotifyPlaylists.isEmpty
                ? "Spotify returned no playlists."
                : "Choose the Blend yourself—Bwend does not guess from playlist names."
        } catch let error as APIError {
            spotifyBlendPlaylistMessage = error.errorDescription
        } catch {
            spotifyBlendPlaylistMessage = error.localizedDescription
        }
    }

    @MainActor
    private func selectSpotifyBlendPlaylist() async {
        guard !selectedSpotifyPlaylistId.isEmpty else { return }
        spotifyBlendPlaylistBusy = true
        spotifyBlendPlaylistMessage = nil
        defer { spotifyBlendPlaylistBusy = false }
        do {
            let playlist = try await api.selectSpotifyBlendPlaylist(id: selectedSpotifyPlaylistId)
            spotifyBlendPlaylistId = playlist.id
            spotifyBlendPlaylistRead = playlist
            spotifyBlendPlaylistMessage = playlist.tracksReadable
                ? "Bwend can read \(playlist.trackCount) tracks from this selected Blend."
                : "Spotify exposes this playlist but does not allow Bwend to read its tracks."
        } catch let error as APIError {
            spotifyBlendPlaylistMessage = error.errorDescription
        } catch {
            spotifyBlendPlaylistMessage = error.localizedDescription
        }
    }

    @MainActor
    private func readSelectedSpotifyBlendPlaylist() async {
        spotifyBlendPlaylistBusy = true
        spotifyBlendPlaylistMessage = nil
        defer { spotifyBlendPlaylistBusy = false }
        do {
            spotifyBlendPlaylistRead = try await api.spotifyBlendPlaylist()
            guard let playlist = spotifyBlendPlaylistRead else {
                spotifyBlendPlaylistMessage = "Choose the created Blend from your Spotify library first."
                return
            }
            selectedSpotifyPlaylistId = playlist.id
            spotifyBlendPlaylistMessage = playlist.tracksReadable
                ? "Read \(playlist.trackCount) tracks live from Spotify."
                : "Spotify exposes the playlist but not its tracks to Bwend."
        } catch let error as APIError {
            spotifyBlendPlaylistMessage = error.errorDescription
        } catch {
            spotifyBlendPlaylistMessage = error.localizedDescription
        }
    }

    @MainActor
    private func removeSpotifyBlendPlaylist() async {
        spotifyBlendPlaylistBusy = true
        spotifyBlendPlaylistMessage = nil
        defer { spotifyBlendPlaylistBusy = false }
        do {
            _ = try await api.removeSpotifyBlendPlaylist()
            spotifyBlendPlaylistId = nil
            spotifyBlendPlaylistRead = nil
            selectedSpotifyPlaylistId = ""
            spotifyBlendPlaylistMessage = "The selected Spotify playlist was detached from Bwend."
        } catch let error as APIError {
            spotifyBlendPlaylistMessage = error.errorDescription
        } catch {
            spotifyBlendPlaylistMessage = error.localizedDescription
        }
    }
}

private struct PlayerDeviceCard: View {
    @Environment(\.openURL) private var openURL

    let player: PlayerResponse

    private var activeDevice: PlaybackDevice? {
        player.state?.device ?? player.devices.first(where: \.isActive)
    }

    var body: some View {
        if let device = activeDevice {
            Button {
                if let url = URL(string: "spotify:") {
                    openURL(url)
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: symbol(for: device.type))
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(Color.spotify)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.spotify.opacity(0.12)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Listening on")
                            .font(.bwend(size: 11, weight: .bold))
                            .foregroundColor(Color.bwendTextMuted)
                            .textCase(.uppercase)
                            .tracking(1.1)
                        Text(device.name)
                            .font(.bwend(size: 14, weight: .bold))
                            .foregroundColor(Color.bwendText)
                    }
                    Spacer()
                    Text("Open Spotify")
                        .font(.bwend(size: 12, weight: .bold))
                        .foregroundColor(Color.spotify)
                }
                .padding(14)
                .background(Color.bwendBgCard)
                .cornerRadius(BwendRadius.lg)
            }
            .buttonStyle(.plain)
        }
    }

    private func symbol(for type: String) -> String {
        switch type.lowercased() {
        case "smartphone": return "iphone"
        case "computer": return "laptopcomputer"
        case "speaker": return "hifispeaker.fill"
        case "tv": return "tv"
        default: return "airplayaudio"
        }
    }
}

private struct NowPlayingStrip: View {
    let nowPlaying: NowPlayingResponse
    let track: BlendTrack

    var body: some View {
        SpotifyLink(url: track.spotifyURL) {
            HStack(spacing: 14) {
                RemoteArtwork(url: track.imageURL, fallbackSymbol: "waveform")
                    .frame(width: 58, height: 58)
                    .cornerRadius(BwendRadius.md)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(nowPlaying.isPlaying ? Color.spotify : Color.bwendTextMuted)
                            .frame(width: 7, height: 7)
                        Text(nowPlaying.isPlaying ? "Now playing" : "Paused")
                            .font(.bwend(size: 11, weight: .bold))
                            .foregroundColor(Color.bwendTextMuted)
                            .textCase(.uppercase)
                            .tracking(1.2)
                    }
                    Text(track.name)
                        .font(.bwend(size: 15, weight: .bold))
                        .foregroundColor(Color.bwendText)
                        .lineLimit(1)
                    Text(track.creditLine)
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextSecondary)
                        .lineLimit(1)
                }

                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color.bwendTextMuted)
            }
            .padding(14)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.lg)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                "\(nowPlaying.isPlaying ? "Now playing" : "Paused"), \(track.name), \(track.creditLine)"
            )
        }
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
