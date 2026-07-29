import SwiftUI

// MARK: - RevealMomentView (Layer 1)
//
// The shareable, screenshot-worthy moment. One giant score number, centered full-screen on
// cream. One playful emotional line in green Fraunces italic. Nothing else. Tap anywhere to
// advance to the anchor layer.
//
// Design ref: image 1 from the user — "92" huge, "If you're not best friends, you should be."

struct RevealMomentView: View {
    let matchId: String

    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var match: PublicMatch?
    @State private var scoreAppeared = false

    var body: some View {
        ZStack {
            Color.bwendBackground.ignoresSafeArea()

            if let match {
                VStack(spacing: 0) {
                    Spacer()

                    // The giant score.
                    Text("\(match.vibeScore)")
                        .font(.bwend(size: 140, weight: .bold))
                        .foregroundColor(Color.bwendText)
                        .scaleEffect(scoreAppeared ? 1.0 : 0.5)
                        .opacity(scoreAppeared ? 1.0 : 0.0)

                    // The emotional line — picked from the score band.
                    Text(emotionalLine(for: match.vibeScore))
                        .font(.bwendSerifItalic(20))
                        .foregroundColor(Color.spotify)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                        .padding(.top, 16)
                        .opacity(scoreAppeared ? 1.0 : 0.0)

                    Spacer()

                    // Tap hint at the bottom.
                    Text("tap to see more")
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextMuted)
                        .tracking(2)
                        .padding(.bottom, 40)
                        .opacity(scoreAppeared ? 0.7 : 0.0)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    router.route(to: .revealAnchor(matchId: matchId))
                }
                .onAppear {
                    withAnimation(.bwendHero) {
                        scoreAppeared = true
                    }
                }
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do { match = try await api.fetchMatch(id: matchId) }
        catch { /* surface error in v1.1 — the score is the moment, keep it clean */ }
    }

    /// Pick a playful line based on the score band. These are the "screenshot-worthy" copy.
    private func emotionalLine(for score: Int) -> String {
        switch score {
        case 90...:  return "If you're not best friends, you should be."
        case 75..<90: return "Your libraries speak the same language."
        case 60..<75: return "There's something here worth exploring."
        case 40..<60: return "Opposites attract — or at least interest each other."
        default:     return "An acquired taste, maybe. But a taste."
        }
    }
}

#Preview {
    RevealMomentView(matchId: "preview-match")
        .environmentObject(APIClient())
        .environmentObject(Router())
}
