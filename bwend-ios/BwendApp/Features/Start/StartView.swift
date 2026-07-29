import SwiftUI

// MARK: - StartView
//
// The single-button launchpad. Replaces the old Home hub. One job: let the user start a blend
// (create invite → share). Owns the NavigationStack so deep links from incoming URLs land here.

struct StartView: View {
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var api: APIClient
    @EnvironmentObject var router: Router
    @EnvironmentObject var notifications: NotificationManager

    @State private var creating = false
    @State private var pastMatches: [MatchSummary] = []
    @State private var errorMessage: String?
    /// Loaded purely so the Blend card can show real faces instead of an empty shell.
    /// Failure is silent — the card still works, it just renders without the preview strip.
    @State private var blendPreview: [BlendArtist] = []

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.6)

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header

                    blendCard

                    listeningPortraitCard

                    startCard

                    Button {
                        router.route(to: .trackInviteSearch)
                    } label: {
                        Label("Send a track with your invite", systemImage: "music.note.list")
                            .font(.bwend(size: 14, weight: .bold))
                            .foregroundColor(Color.bwendText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.bwendBgCard)
                            .cornerRadius(BwendRadius.md)
                    }
                    .buttonStyle(.plain)

                    inviteManagementCard

                    if !pastMatches.isEmpty {
                        historySection
                    }

                    accountSection

                    if NotificationManager.isAvailable {
                        notificationSection
                    }

                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
            }
            .refreshable { await load() }
        }
        .background(Color.bwendBackground.ignoresSafeArea())
        .task {
            // Re-run while either section is still empty — a user with past blends but no
            // loaded artists would otherwise never get the preview strip.
            if pastMatches.isEmpty || blendPreview.isEmpty { await load() }
        }
    }

    @ViewBuilder
    private var inviteManagementCard: some View {
        Button {
            router.route(to: .inviteManagement)
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "link.badge.plus")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color.Accent.cta)
                    .frame(width: 42, height: 42)
                    .background(Circle().fill(Color.Accent.peach.opacity(0.18)))

                VStack(alignment: .leading, spacing: 3) {
                    Text("Your invites")
                        .font(.bwend(size: 15, weight: .bold))
                        .foregroundColor(Color.bwendText)
                    Text("Reshare pending links or return to completed blends.")
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextSecondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color.bwendTextMuted)
            }
            .padding(18)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.lg)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("inviteManagementCard")
    }

    // MARK: - Sections

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Hi, \(auth.displayName ?? "friend").")
                .font(.bwend(size: 28, weight: .bold))
                .foregroundColor(Color.bwendText)
            Text("One blend at a time. Music first.")
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendTextSecondary)
        }
    }

    @ViewBuilder
    private var blendCard: some View {
        Button {
            router.route(to: .blend)
        } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionLabel("Your blend")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.bwendTextMuted)
                }

                if blendPreview.isEmpty {
                    Text("See your top artists, tracks and era.")
                        .font(.bwend(size: 15))
                        .foregroundColor(Color.bwendTextSecondary)
                } else {
                    // Overlapping faces — reads as "your music" at a glance without
                    // needing a second line of copy.
                    HStack(spacing: -12) {
                        ForEach(blendPreview.prefix(5)) { artist in
                            RemoteArtwork(url: artist.imageURL, fallbackSymbol: "person.fill")
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.bwendBgCard, lineWidth: 2))
                        }
                        Spacer()
                    }

                    Text(blendPreview.prefix(3).map(\.name).joined(separator: " · "))
                        .font(.bwend(size: 13))
                        .foregroundColor(Color.bwendTextMuted)
                        .lineLimit(1)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.card)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("yourBlendCard")
    }

    @ViewBuilder
    private var listeningPortraitCard: some View {
        Button {
            router.route(to: .listeningPortrait)
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "waveform.badge.magnifyingglass")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color.Accent.cta)
                    .frame(width: 42, height: 42)
                    .background(Circle().fill(Color.Accent.lavender.opacity(0.2)))

                VStack(alignment: .leading, spacing: 3) {
                    Text("Your Listening Portrait")
                        .font(.bwend(size: 15, weight: .bold))
                        .foregroundColor(Color.bwendText)
                    Text("A private reflection from answers you choose to share.")
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextSecondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color.bwendTextMuted)
            }
            .padding(18)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.lg)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listeningPortraitCard")
    }

    @ViewBuilder
    private var startCard: some View {
        Button {
            Task { await createInvite() }
        } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionLabel("Start a blend")
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white.opacity(0.8))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Invite someone to")
                        .font(.bwend(size: 24, weight: .bold))
                        .foregroundColor(.white)
                    HStack(spacing: 4) {
                        Text("blend")
                            .font(.bwendSerifItalic(24))
                            .foregroundColor(.white)
                        Text(".")
                            .font(.bwend(size: 24, weight: .bold))
                            .foregroundColor(.white)
                    }
                }

                Text("Send a link. They connect Spotify, you both see your vibe score and the song that brings you together.")
                    .font(.bwend(size: 13))
                    .foregroundColor(.white.opacity(0.85))
                    .lineSpacing(4)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.bwend(size: 12))
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    colors: [Color.Accent.peach, Color.Accent.lavender],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(BwendRadius.card)
        }
        .buttonStyle(.plain)
        .disabled(creating)
        .accessibilityIdentifier("startBlendCard")
    }

    @ViewBuilder
    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Past blends")

            ForEach(pastMatches) { match in
                Button {
                    router.route(to: .revealMoment(matchId: match.id))
                } label: {
                    HStack(spacing: 14) {
                        // Score badge.
                        ZStack {
                            Circle()
                                .fill(Color.Accent.peach.opacity(0.3))
                                .frame(width: 48, height: 48)
                            Text("\(match.vibeScore)")
                                .font(.bwend(size: 16, weight: .bold))
                                .foregroundColor(Color.bwendText)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(match.partnerName ?? "Someone")
                                .font(.bwend(size: 15, weight: .medium))
                                .foregroundColor(Color.bwendText)
                            if let track = match.anchorTrackName {
                                Text("♪ \(track)")
                                    .font(.bwend(size: 12))
                                    .foregroundColor(Color.bwendTextMuted)
                                    .lineLimit(1)
                            } else {
                                Text(match.createdAt.formatted(.relative(presentation: .named)))
                                    .font(.bwend(size: 12))
                                    .foregroundColor(Color.bwendTextMuted)
                            }
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color.bwendTextMuted)
                    }
                    .padding(14)
                    .background(Color.bwendBgCard)
                    .cornerRadius(BwendRadius.md)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// The only way out of a signed-in state. Without it, anyone whose Spotify access is
    /// revoked — or who simply wants a different account — is stuck in the app permanently.
    @ViewBuilder
    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Divider().overlay(Color.bwendBorderSubtle)

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Connected to Spotify")
                        .font(.bwend(size: 13))
                        .foregroundColor(Color.bwendTextSecondary)
                    if let name = auth.displayName {
                        Text(name)
                            .font(.bwend(size: 12))
                            .foregroundColor(Color.bwendTextMuted)
                    }
                }

                Spacer()

                Button {
                    router.route(to: .accountPrivacy)
                } label: {
                    Text("Privacy & data")
                        .font(.bwend(size: 13, weight: .medium))
                        .foregroundColor(Color.Accent.cta)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule().stroke(Color.bwendBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("privacyDataButton")
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private var notificationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color.Accent.cta)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(Color.Accent.peach.opacity(0.18)))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Your daily Bwend")
                        .font(.bwend(size: 14, weight: .bold))
                        .foregroundColor(Color.bwendText)
                    Text(
                        notifications.dailyBlendsEnabled
                            ? "A music-first nudge is scheduled for 6pm."
                            : "One thoughtful reason to revisit a blend each day."
                    )
                    .font(.bwend(size: 12))
                    .foregroundColor(Color.bwendTextSecondary)
                }

                Spacer()
            }

            if notifications.authorizationStatus == .denied {
                Button("Open notification settings") {
                    notifications.openSystemSettings()
                }
                .font(.bwend(size: 13, weight: .bold))
                .foregroundColor(Color.Accent.cta)
            } else {
                Button {
                    Task {
                        if notifications.dailyBlendsEnabled {
                            await notifications.disableDailyBlends()
                        } else {
                            _ = await notifications.enableDailyBlends()
                        }
                    }
                } label: {
                    Text(notifications.dailyBlendsEnabled ? "Turn off" : "Notify me daily")
                        .font(.bwend(size: 13, weight: .bold))
                        .foregroundColor(
                            notifications.dailyBlendsEnabled ? Color.bwendText : .white
                        )
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(
                            Capsule().fill(
                                notifications.dailyBlendsEnabled
                                    ? Color.bwendBgMuted
                                    : Color.Accent.cta
                            )
                        )
                }
                .buttonStyle(.plain)
            }

            if let error = notifications.registrationError {
                Text(error)
                    .font(.bwend(size: 11))
                    .foregroundStyle(.red)
            }
        }
        .padding(18)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }

    // MARK: - Actions

    @MainActor
    private func load() async {
        // Independent: a failure to load past matches shouldn't blank the blend preview,
        // and the blend read is the slower of the two (it goes out to Spotify).
        async let matchesTask = try? api.myMatches()

        do {
            let blend = try await api.myBlend()
            blendPreview = blend.topArtists
        } catch let e as APIError where e.requiresReconnect {
            // Nothing behind the session any more. Route to connect rather than rendering a
            // half-empty home screen the user can't fix.
            auth.signOut()
            router.reset(to: .spotifyConnect)
            return
        } catch {
            blendPreview = []
        }

        pastMatches = await matchesTask ?? []
    }

    @MainActor
    private func createInvite() async {
        creating = true
        errorMessage = nil
        do {
            let response = try await api.createInvite()
            router.route(to: .shareInvite(code: response.code))
        } catch let e as APIError {
            errorMessage = e.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        creating = false
    }
}

#Preview {
    StartView()
        .environmentObject(AuthManager())
        .environmentObject(APIClient())
        .environmentObject(Router())
        .environmentObject(NotificationManager.shared)
}
