import SwiftUI

// MARK: - WelcomeView
//
// The launch screen. One job: get the user to connect Spotify, because that IS the sign-in.
// Product language mirrors the private connection-companion boundary on the web.

struct WelcomeView: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            OrbBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    // MARK: Hero
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Image("Logo")
                                .resizable()
                                .interpolation(.high)
                                .frame(width: 32, height: 32)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            Text("Pre-launch. Gathering interest.")
                                .font(.bwend(size: 11, weight: .medium))
                                .foregroundColor(Color.bwendTextMuted)
                                .tracking(3)
                        }
                        .padding(.bottom, 8)

                        VStack(alignment: .leading, spacing: -4) {
                            Text("The music layer")
                                .font(.bwend(size: 44, weight: .bold))
                            HStack(spacing: 8) {
                                Text("designed to be")
                                    .font(.bwend(size: 44, weight: .bold))
                                Text("heard.")
                                    .font(.bwendSerifItalic(44))
                                    .foregroundColor(Color.Accent.cta)
                            }
                        }
                        .foregroundColor(Color.bwendText)

                        Text("After you meet or match elsewhere, connect Spotify and share one private link. See your music overlap, an anchor track, and what you already have in common.")
                            .font(.bwend(size: 16))
                            .foregroundColor(Color.bwendTextSecondary)
                            .lineSpacing(5)
                            .padding(.top, 8)
                    }
                    .padding(.top, 24)

                    // MARK: CTA
                    PrimaryButton("Connect Spotify to start") {
                        router.route(to: .spotifyConnect)
                    }
                    .padding(.top, 16)

                    // MARK: Pillars
                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel("How it works")
                        VStack(alignment: .leading, spacing: 8) {
                            PillarRow(text: "Connect your Spotify")
                            PillarRow(text: "Share with someone you already met")
                            PillarRow(text: "See your vibe score + what you share")
                        }
                    }
                    .padding(.top, 24)
                    .padding(.horizontal, 4)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 60)
            }
        }
    }
}

private struct PillarRow: View {
    let text: String
    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.Accent.peach)
                .frame(width: 6, height: 6)
            Text(text)
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendText)
            Spacer()
        }
    }
}

#Preview {
    WelcomeView()
        .environmentObject(Router())
}
