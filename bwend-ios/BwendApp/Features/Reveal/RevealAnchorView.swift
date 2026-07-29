import SwiftUI

// MARK: - RevealAnchorView (Layer 2)
//
// Names + score + the one song that brings you together. The human anchor before any data.
// Design ref: image 2 from the user — "Jude + Alexandra", "92% taste match", album art focal point.
//
// Tap "see why" to advance to the full breakdown (Layer 3).

struct RevealAnchorView: View {
    let matchId: String

    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var match: PublicMatch?

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.3)

            ScrollView {
                VStack(spacing: 32) {
                    if let match {
                        // Names + score.
                        VStack(spacing: 6) {
                            Text("\(match.myName ?? "You") + \(match.partnerName ?? "them")")
                                .font(.bwend(size: 22, weight: .bold))
                                .foregroundColor(Color.bwendText)
                            Text("\(match.vibeScore)% taste match")
                                .font(.bwendSerifItalic(18))
                                .foregroundColor(Color.spotify)
                        }

                        // The anchor song — the centerpiece.
                        if let anchor = match.anchorTrack {
                            VStack(spacing: 16) {
                                Text("The song that brings you together")
                                    .font(.bwend(size: 13))
                                    .foregroundColor(Color.bwendTextSecondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 32)

                                VStack(spacing: 12) {
                                    // Real album art, captured at connect time. It can't be
                                    // fetched on demand — /v1/tracks?ids= is 403 for this app
                                    // — so `imageURL` is nil for matches created before the
                                    // artwork was stored. Those fall back to the gradient.
                                    if let art = anchor.imageURL {
                                        RemoteArtwork(url: art, fallbackSymbol: "music.note")
                                            .frame(width: 200, height: 200)
                                            .cornerRadius(16)
                                    } else {
                                        RoundedRectangle(cornerRadius: 16)
                                            .fill(
                                                LinearGradient(
                                                    colors: [Color.Accent.peach, Color.Accent.lavender],
                                                    startPoint: .topLeading,
                                                    endPoint: .bottomTrailing
                                                )
                                            )
                                            .frame(width: 200, height: 200)
                                            .overlay(
                                                Image(systemName: "music.note")
                                                    .font(.system(size: 56))
                                                    .foregroundColor(.white.opacity(0.8))
                                            )
                                    }

                                    Text(anchor.name)
                                        .font(.bwend(size: 20, weight: .bold))
                                        .foregroundColor(Color.bwendText)
                                        .multilineTextAlignment(.center)

                                    if let artist = anchor.artistName {
                                        Text(artist)
                                            .font(.bwend(size: 15))
                                            .foregroundColor(Color.bwendTextSecondary)
                                    }
                                }

                                // Copy adapts: this is a recommendation, not a shared track.
                                Text("Based on both of your libraries, you'd love this.")
                                    .font(.bwendSerifItalic(13))
                                    .foregroundColor(Color.bwendTextMuted)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 32)
                            }
                        }

                        PrimaryButton("See why") {
                            router.route(to: .revealDetail(matchId: matchId))
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
        .navigationTitle("Your blend")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do { match = try await api.fetchMatch(id: matchId) }
        catch {}
    }
}

#Preview {
    RevealAnchorView(matchId: "preview-match")
        .environmentObject(APIClient())
        .environmentObject(Router())
}
