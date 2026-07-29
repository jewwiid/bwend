import SwiftUI

// MARK: - RevealDetailView (Layer 3)
//
// The full breakdown: 6 animated bars, shared artists list, shared tracks list, and the
// qualitative compatibility read. CTA to start another blend.
//
// This is the only layer with data density — the payoff after the emotional moment + anchor.

struct RevealDetailView: View {
    let matchId: String

    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var match: PublicMatch?
    @State private var discoveryItems: [DiscoveryItem] = []
    @State private var savingPlaylist = false
    @State private var savedPlaylistURL: String?
    @State private var playlistError: String?

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.3)

            ScrollView {
                VStack(spacing: 28) {
                    if let match {
                        // Qualitative compatibility read — the 1-2 sentence summary.
                        if !match.compatibilityRead.isEmpty {
                            Text(match.compatibilityRead)
                                .font(.bwendSerifItalic(18))
                                .foregroundColor(Color.bwendText)
                                .multilineTextAlignment(.center)
                                .lineSpacing(5)
                                .padding(.horizontal, 16)
                                .padding(.top, 16)
                        }

                        // Score breakdown bars.
                        breakdownSection(match.breakdown)

                        // Shared artists.
                        if !match.sharedTopArtistNames.isEmpty {
                            sharedSection(
                                label: "You both listen to",
                                items: match.sharedTopArtistNames,
                                icon: "music.mic"
                            )
                        }

                        // Shared tracks.
                        if !match.sharedTopTrackNames.isEmpty {
                            sharedSection(
                                label: "You both have in your tops",
                                items: match.sharedTopTrackNames,
                                icon: "music.note"
                            )
                        }

                        playlistSection(match)

                        if !discoveryItems.isEmpty {
                            discoverySection
                        }

                        // CTA.
                        PrimaryButton("Start another blend") {
                            router.reset(to: .start)
                        }
                        .padding(.top, 8)
                    } else {
                        ProgressView()
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
                .padding(.bottom, 60)
            }
        }
        .navigationTitle("What makes your vibe")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @ViewBuilder
    private func playlistSection(_ match: PublicMatch) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Take it with you")
            Text("Save a private mix built from both of your top tracks.")
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendTextSecondary)

            if let urlString = savedPlaylistURL ?? match.savedPlaylistURL,
               let url = URL(string: urlString) {
                Link(destination: url) {
                    Label("Open your Bwend playlist", systemImage: "arrow.up.right")
                        .font(.bwend(size: 14, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Capsule().fill(Color.spotify))
                }
            } else {
                PrimaryButton(
                    "Save to my Spotify",
                    loading: savingPlaylist,
                    loadingTitle: "Building playlist…"
                ) {
                    Task { await savePlaylist() }
                }
            }

            if let playlistError {
                Text(playlistError)
                    .font(.bwend(size: 12))
                    .foregroundStyle(.red)
            }
        }
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }

    private var discoverySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Listen next")
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 12) {
                    ForEach(discoveryItems) { item in
                        if let urlString = item.spotifyURL, let url = URL(string: urlString) {
                            Link(destination: url) {
                                VStack(alignment: .leading, spacing: 8) {
                                    RemoteArtwork(url: item.imageURL, fallbackSymbol: "music.note")
                                        .frame(width: 132, height: 132)
                                        .cornerRadius(BwendRadius.md)
                                    Text(item.name)
                                        .font(.bwend(size: 12, weight: .bold))
                                        .foregroundColor(Color.bwendText)
                                        .lineLimit(1)
                                    Text(item.subtitle ?? item.kind.rawValue.capitalized)
                                        .font(.bwend(size: 11))
                                        .foregroundColor(Color.bwendTextMuted)
                                        .lineLimit(1)
                                }
                                .frame(width: 132, alignment: .leading)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private func breakdownSection(_ b: VibeBreakdown) -> some View {
        // Optional components are omitted when Spotify didn't return the underlying signal,
        // rather than rendered as a zeroed bar that would read as "no match".
        let rows: [(label: String, value: Double)] = [
            ("Shared tracks",  b.trackOverlap),
            ("Shared artists", b.artistOverlap),
        ] + [
            ("Genre match",      b.genreOverlap),
            ("Mainstream match", b.popularitySim),
            ("Era match",        b.eraSim),
            ("Discovery match",  b.discoverySim),
            ("Same hours",       b.clockSim),
        ].compactMap { label, value in
            value.map { (label, $0) }
        }

        VStack(alignment: .leading, spacing: 14) {
            ForEach(rows, id: \.label) { row in
                BreakdownRow(label: row.label, value: row.value)
            }
        }
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }

    @ViewBuilder
    private func sharedSection(label: String, items: [String], icon: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(label)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(items.prefix(10), id: \.self) { item in
                    HStack(spacing: 10) {
                        Image(systemName: icon)
                            .font(.system(size: 12))
                            .foregroundColor(Color.Accent.peach)
                        Text(item)
                            .font(.bwend(size: 15))
                            .foregroundColor(Color.bwendText)
                        Spacer()
                    }
                }
            }
        }
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }

    @MainActor
    private func load() async {
        async let matchTask = api.fetchMatch(id: matchId)
        async let discoveryTask = try? api.discovery()
        do {
            match = try await matchTask
            savedPlaylistURL = match?.savedPlaylistURL
        } catch {}
        discoveryItems = await discoveryTask ?? []
    }

    @MainActor
    private func savePlaylist() async {
        savingPlaylist = true
        playlistError = nil
        defer { savingPlaylist = false }
        do {
            let response = try await api.saveMatchPlaylist(id: matchId)
            savedPlaylistURL = response.spotifyURL
        } catch let error as APIError {
            playlistError = error.errorDescription
        } catch {
            playlistError = error.localizedDescription
        }
    }
}

// MARK: - BreakdownRow

private struct BreakdownRow: View {
    let label: String
    let value: Double

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.bwend(size: 13))
                .foregroundColor(Color.bwendTextSecondary)
            Spacer()
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.bwendBgMuted)
                        .frame(height: 6)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.Accent.cta)
                        .frame(width: geo.size.width * value, height: 6)
                        .animation(.bwendHero, value: value)
                }
            }
            .frame(width: 80, height: 6)
            Text("\(Int(value * 100))%")
                .font(.bwend(size: 13, weight: .bold))
                .foregroundColor(Color.bwendText)
                .frame(width: 40, alignment: .trailing)
        }
    }
}

#Preview {
    RevealDetailView(matchId: "preview-match")
        .environmentObject(APIClient())
        .environmentObject(Router())
}
