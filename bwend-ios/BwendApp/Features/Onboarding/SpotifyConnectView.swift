import SwiftUI

// MARK: - SpotifyConnectView
//
// The sign-in step. Runs Spotify PKCE, sends the code to the backend, stores the returned
// Bwend session JWT, then routes to StartView. If the user arrived here from an invite link,
// we route them back to the invite preview after connect completes.

struct SpotifyConnectView: View {
    static let privacyVersion = "2026-08-01.2"
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var connecting = false
    @State private var errorMessage: String?
    @State private var privacyConsentGranted = false
    @State private var showingPrivacyNotice = false
    private let spotifyAuth = SpotifyAuth()

    var body: some View {
        ZStack {
            OrbBackground()

            VStack(alignment: .leading, spacing: 32) {
                SectionLabel("The Ritual · Step 01")

                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: -2) {
                        Text("Sync your")
                            .font(.bwend(size: 36, weight: .bold))
                            .foregroundColor(Color.bwendText)
                        HStack(spacing: 6) {
                            Text("taste")
                                .font(.bwendSerifItalic(36))
                                .foregroundColor(Color.spotify)
                            Text(".")
                                .font(.bwend(size: 36, weight: .bold))
                                .foregroundColor(Color.bwendText)
                        }
                    }
                    Text("Connect your Spotify. We analyze your library to find the patterns in your replay history.")
                        .font(.bwend(size: 15))
                        .foregroundColor(Color.bwendTextSecondary)
                        .lineSpacing(5)
                }

                Spacer()

                VStack(spacing: 12) {
                    Toggle(isOn: $privacyConsentGranted) {
                        Text("I agree to the Beta Terms and consent to Bwend using my Spotify listening data only for private Taste Cards and blends I choose to share.")
                            .font(.bwend(size: 12))
                            .foregroundColor(Color.bwendTextSecondary)
                            .lineSpacing(3)
                    }
                    .toggleStyle(.switch)

                    HStack(spacing: 18) {
                        Button("Privacy notice") {
                            showingPrivacyNotice = true
                        }
                        Link("Beta Terms", destination: URL(string: "https://www.bwend.xyz/terms")!)
                    }
                    .font(.bwend(size: 12, weight: .medium))
                    .foregroundColor(Color.Accent.cta)

                    PrimaryButton(
                        "Connect Spotify",
                        loading: connecting,
                        loadingTitle: "Reading your library…"
                    ) {
                        Task { await connect() }
                    }
                    .disabled(!privacyConsentGranted)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.bwend(size: 13))
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }

                    Text("We never post on your behalf. We only read your top tracks and artists to compute your vibe with someone.")
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextMuted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 60)
        }
        .animation(.bwendSmooth, value: errorMessage)
        .sheet(isPresented: $showingPrivacyNotice) {
            PrivacyNoticeView()
        }
    }

    @MainActor
    private func connect() async {
        connecting = true
        defer { connecting = false }
        errorMessage = nil

        do {
            let result = try await spotifyAuth.authorize()
            guard privacyConsentGranted else {
                errorMessage = "Review and accept the privacy notice before connecting."
                return
            }
            let response = try await api.connectSpotify(
                code: result.code,
                codeVerifier: result.codeVerifier,
                privacyConsentVersion: Self.privacyVersion,
                termsVersion: APIClient.termsVersion
            )
            try await auth.applySession(token: response.token, displayName: response.displayName)

            // If the user arrived from a deep link (e.g. someone sent them www.bwend.xyz/m/abc),
            // route them straight to the invite preview instead of the start screen.
            if let pendingCode = router.pendingInviteCode {
                router.pendingInviteCode = nil
                router.reset(to: .invitePreview(code: pendingCode))
            } else {
                router.reset(to: .start)
            }
        } catch let e as APIError {
            errorMessage = e.errorDescription
            if let detail = e.diagnosticDetail {
                print("[bwend] Spotify connect failed — \(detail)")
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    SpotifyConnectView()
        .environmentObject(AuthManager())
        .environmentObject(APIClient())
        .environmentObject(Router())
}
