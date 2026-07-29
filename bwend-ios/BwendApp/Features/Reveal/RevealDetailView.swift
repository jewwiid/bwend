import SwiftUI

// MARK: - RevealDetailView (Layer 3)
//
// The full breakdown: 6 animated bars, shared artists list, shared tracks list, and the
// qualitative compatibility read. CTA to start another blend.
//
// This is the only layer with data density — the payoff after the emotional moment + anchor.

struct RevealDetailView: View {
    let matchId: UUID

    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var match: PublicMatch?

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
        do { match = try await api.fetchMatch(id: matchId) }
        catch {}
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
    RevealDetailView(matchId: UUID())
        .environmentObject(APIClient())
        .environmentObject(Router())
}
