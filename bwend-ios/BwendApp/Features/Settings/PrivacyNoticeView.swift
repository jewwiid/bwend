import SwiftUI

struct PrivacyNoticeView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Privacy, without the mystery.")
                        .font(.bwend(size: 30, weight: .bold))
                        .foregroundColor(Color.bwendText)

                    noticeSection(
                        "What Bwend keeps",
                        "A Bwend-only identifier, an encrypted Spotify connection, your top music and a derived taste fingerprint, the blends you intentionally create, and an optional Spotify Blend invite URL you add."
                    )
                    noticeSection(
                        "What Bwend does not build",
                        "No public dating profile, photo, biography, location, contacts, gender, sexuality, dating preferences, or imported Hinge or Tinder data."
                    )
                    noticeSection(
                        "Who sees your music",
                        "Your Taste Card is private by default. Another person sees selected music and a compatibility reveal only after you send or claim a Bwend link. If you attach a Spotify Blend URL, it opens Spotify; Bwend never reads its playlist or members. Spotify may show Blend members your Spotify username and profile picture."
                    )
                    noticeSection(
                        "Your controls",
                        "You can export your Bwend data, disconnect Spotify immediately, or erase your account in Privacy & data. Unclaimed links expire after seven days. A disconnected account is erased after a 30-day recovery window."
                    )
                    noticeSection(
                        "Sensitive inferences",
                        "Bwend does not use music to infer health, ethnicity, religion, politics, sexuality, or other sensitive traits. The score describes music overlap only."
                    )
                    noticeSection(
                        "Optional AI Listening Portrait",
                        "If you opt in, Bwend sends only the questionnaire answers you select or write to OpenAI. Spotify songs, artists, listening history, and lyrics are never sent. The result is private, editable, exportable, and deletable. OpenAI may retain API abuse-monitoring logs for up to 30 days."
                    )

                    Text("Privacy notice version \(SpotifyConnectView.privacyVersion)")
                        .font(.bwend(size: 11))
                        .foregroundColor(Color.bwendTextMuted)

                    Link("Read the Beta Terms", destination: URL(string: "https://www.bwend.xyz/terms")!)
                        .font(.bwend(size: 13, weight: .bold))
                        .foregroundColor(Color.Accent.cta)
                }
                .padding(24)
            }
            .background(Color.bwendBackground.ignoresSafeArea())
            .navigationTitle("Privacy notice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func noticeSection(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.bwend(size: 15, weight: .bold))
                .foregroundColor(Color.bwendText)
            Text(body)
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendTextSecondary)
                .lineSpacing(4)
        }
    }
}

#Preview {
    PrivacyNoticeView()
}
