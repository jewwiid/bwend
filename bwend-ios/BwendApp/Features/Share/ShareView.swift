import SwiftUI

// MARK: - InvitePreviewView
//
// Recipient-side: shows the optional public Spotify handoff before onboarding, then the private
// Taste Card and "Reveal our vibe" CTA after the recipient connects Spotify.

struct InvitePreviewView: View {
    let code: String

    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var preview: InvitePreview?
    @State private var handoff: InviteHandoff?
    @State private var claiming = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.5)

            ScrollView {
                VStack(spacing: 28) {
                    // Gate: if not onboarded, prompt connect first.
                    if !auth.isOnboarded {
                        notOnboardedState
                    } else if let preview {
                        VStack(spacing: 8) {
                            SectionLabel("You've been invited")
                            VStack(spacing: 2) {
                                Text("Someone wants to")
                                    .font(.bwend(size: 22, weight: .bold))
                                    .foregroundColor(Color.bwendText)
                                HStack(spacing: 4) {
                                    Text("blend")
                                        .font(.bwendSerifItalic(22))
                                        .foregroundColor(Color.Accent.cta)
                                    Text("with you.")
                                        .font(.bwend(size: 22, weight: .bold))
                                        .foregroundColor(Color.bwendText)
                                }
                            }
                            .multilineTextAlignment(.center)

                            // Prefer the version with photos; fall back to the name list for
                            // older backends that only send `inviterTopArtists`.
                            if let artists = preview.inviterArtists, !artists.isEmpty {
                                VStack(alignment: .leading, spacing: 14) {
                                    SectionLabel("They listen to")

                                    LazyVGrid(
                                        columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3),
                                        spacing: 14
                                    ) {
                                        ForEach(artists.prefix(6)) { artist in
                                            VStack(spacing: 6) {
                                                RemoteArtwork(url: artist.imageURL, fallbackSymbol: "person.fill")
                                                    .aspectRatio(1, contentMode: .fill)
                                                    .clipShape(Circle())
                                                Text(artist.name)
                                                    .font(.bwend(size: 12, weight: .medium))
                                                    .foregroundColor(Color.bwendText)
                                                    .lineLimit(1)
                                            }
                                        }
                                    }
                                }
                                .padding(20)
                                .background(Color.bwendBgCard)
                                .cornerRadius(BwendRadius.lg)
                            } else if !preview.inviterTopArtists.isEmpty {
                                VStack(alignment: .leading, spacing: 12) {
                                    SectionLabel("They listen to")
                                    VStack(alignment: .leading, spacing: 6) {
                                        ForEach(preview.inviterTopArtists.prefix(5), id: \.self) { artist in
                                            HStack(spacing: 10) {
                                                Image(systemName: "music.note")
                                                    .font(.system(size: 12))
                                                    .foregroundColor(Color.Accent.peach)
                                                Text(artist)
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

                            if let track = preview.selectedTrack {
                                VStack(alignment: .leading, spacing: 12) {
                                    SectionLabel("They sent you a track")
                                    HStack(spacing: 14) {
                                        RemoteArtwork(url: track.imageURL, fallbackSymbol: "music.note")
                                            .frame(width: 72, height: 72)
                                            .cornerRadius(BwendRadius.md)
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(track.name)
                                                .font(.bwend(size: 16, weight: .bold))
                                                .foregroundColor(Color.bwendText)
                                            if let artist = track.artistName {
                                                Text(artist)
                                                    .font(.bwend(size: 13))
                                                    .foregroundColor(Color.bwendTextSecondary)
                                            }
                                        }
                                        Spacer()
                                    }
                                }
                                .padding(20)
                                .background(Color.bwendBgCard)
                                .cornerRadius(BwendRadius.lg)
                            }

                            if let value = preview.spotifyBlendURL, let url = URL(string: value) {
                                SpotifyBlendHandoff(url: url)
                            }

                            PrimaryButton(
                                preview.alreadyClaimed ? "Already claimed" : "Reveal our vibe",
                                loading: claiming,
                                loadingTitle: "Computing score…"
                            ) {
                                Task { await claim() }
                            }
                            .disabled(preview.alreadyClaimed)
                        }
                    } else {
                        ProgressView()
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.bwend(size: 13))
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 60)
            }
        }
        .navigationTitle("Invite")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @ViewBuilder
    private var notOnboardedState: some View {
        VStack(spacing: 16) {
            SectionLabel("You've been invited")
            Text("Connect Spotify to reveal your vibe with them.")
                .font(.bwend(size: 18, weight: .bold))
                .foregroundColor(Color.bwendText)
                .multilineTextAlignment(.center)
            if let value = handoff?.spotifyBlendURL, let url = URL(string: value) {
                SpotifyBlendHandoff(url: url)
            }
            PrimaryButton("Connect Spotify") {
                router.route(to: .spotifyConnect)
            }
        }
        .padding(.top, 40)
    }

    @MainActor
    private func load() async {
        do {
            if auth.isOnboarded {
                preview = try await api.fetchInvite(code: code)
            } else {
                handoff = try await api.fetchInviteHandoff(code: code)
            }
        }
        catch let e as APIError { errorMessage = e.errorDescription }
        catch { errorMessage = error.localizedDescription }
    }

    @MainActor
    private func claim() async {
        claiming = true
        defer { claiming = false }
        do {
            let response = try await api.claimInvite(code: code)
            router.reset(to: .revealMoment(matchId: response.matchId))
        } catch let e as APIError {
            errorMessage = e.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - ShareView
//
// Shows the freshly-created invite URL with a native share sheet + copy button.
// Live-polls the invite status so the inviter sees when their partner has claimed.

struct ShareView: View {
    let inviteCode: String

    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router

    @State private var invite: InvitePreview?
    @State private var claimed = false
    @State private var errorMessage: String?

    private var shareURL: URL? {
        URL(string: "https://www.bwend.xyz/m/\(inviteCode)")
    }

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.5)

            ScrollView {
                VStack(spacing: 28) {
                VStack(spacing: 8) {
                    SectionLabel("Share invite")

                    Text("Send this link to whoever you want to blend with.")
                        .font(.bwend(size: 15))
                        .foregroundColor(Color.bwendTextSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }

                if let url = shareURL {
                    VStack(spacing: 16) {
                        InviteQRCode(url: url)

                        Text("Scan face-to-face with the Camera app. They connect and claim; after the reveal, either person can explicitly make their private Bwend playlist.")
                            .font(.bwend(size: 12))
                            .foregroundColor(Color.bwendTextSecondary)
                            .multilineTextAlignment(.center)
                            .lineSpacing(3)
                            .padding(.horizontal, 8)

                        HStack(spacing: 12) {
                            Button {
                                UIPasteboard.general.string = url.absoluteString
                            } label: {
                                Label("Copy", systemImage: "doc.on.doc")
                                    .font(.bwend(size: 14, weight: .medium))
                                    .foregroundColor(Color.bwendText)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .background(Capsule().fill(Color.bwendBgCard))
                            }
                            .buttonStyle(.plain)

                            ShareLink(
                                item: url,
                                subject: Text("A private Bwend invite"),
                                message: Text("I made a private Bwend invite for us. Open this one link to see our music overlap and, if included, join my Spotify Blend.")
                            ) {
                                Label("Share", systemImage: "square.and.arrow.up")
                                    .font(.bwend(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .background(Capsule().fill(Color.Accent.cta))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if let value = invite?.spotifyBlendURL, let url = URL(string: value) {
                    HStack(spacing: 12) {
                        Image(systemName: "music.note.list")
                            .foregroundColor(Color.spotify)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Spotify Blend included")
                                .font(.bwend(size: 14, weight: .bold))
                                .foregroundColor(Color.bwendText)
                            Text("Your friend can open it from this Bwend invite.")
                                .font(.bwend(size: 12))
                                .foregroundColor(Color.bwendTextSecondary)
                        }
                        Spacer()
                        Link("OPEN", destination: url)
                            .font(.bwend(size: 11, weight: .bold))
                            .foregroundColor(Color.spotify)
                    }
                    .padding(14)
                    .background(Color.bwendBgCard)
                    .cornerRadius(BwendRadius.lg)
                }

                if claimed {
                    VStack(spacing: 12) {
                        SectionLabel("They're in!")
                        Text("Your friend joined the blend.")
                            .font(.bwend(size: 15))
                            .foregroundColor(Color.bwendText)
                            .multilineTextAlignment(.center)
                        // The inviter doesn't have the matchId from the claim response (that went
                        // to the recipient). For v1 we route back to start; v1.1 can add a
                        // "my matches" endpoint that returns the latest match for this invite.
                        PrimaryButton("Back to start") {
                            router.reset(to: .start)
                        }
                    }
                }

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("Share")
        .navigationBarTitleDisplayMode(.inline)
        .task { await poll() }
    }

    /// Poll the invite every 4 seconds until it's claimed.
    @MainActor
    private func poll() async {
        while !Task.isCancelled && !claimed {
            do {
                if let preview = try? await api.fetchInvite(code: inviteCode) {
                    self.invite = preview
                    if preview.alreadyClaimed {
                        self.claimed = true
                        return
                    }
                }
            }
            try? await Task.sleep(nanoseconds: 4_000_000_000)
        }
    }
}

private struct SpotifyBlendHandoff: View {
    let url: URL

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("Also on Spotify")
            Text("Join their Spotify Blend")
                .font(.bwend(size: 18, weight: .bold))
                .foregroundColor(Color.bwendText)
            Text("Spotify may show members your Spotify username and profile picture. Members can invite other friends. Bwend does not follow this invite or read its members.")
                .font(.bwend(size: 12))
                .foregroundColor(Color.bwendTextSecondary)
                .lineSpacing(3)
            Link(destination: url) {
                Text("OPEN SPOTIFY")
                    .font(.bwend(size: 13, weight: .bold))
                    .foregroundColor(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color.spotify))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }
}

#Preview {
    NavigationStack {
        ShareView(inviteCode: "abcd1234")
            .environmentObject(APIClient())
            .environmentObject(Router())
    }
}
