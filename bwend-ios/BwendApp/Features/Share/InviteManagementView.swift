import SwiftUI

/// Sent-link history and management. Pending links can be reshared or revoked; claimed links
/// lead back to their frozen blend reveal.
struct InviteManagementView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var router: Router

    @State private var invites: [InviteSummary] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var cancellingCode: String?
    @State private var pendingCancellation: InviteSummary?

    private var pendingInvites: [InviteSummary] {
        invites.filter { $0.effectiveStatus(at: Date()) == "pending" }
    }

    private var inviteHistory: [InviteSummary] {
        invites.filter { $0.effectiveStatus(at: Date()) != "pending" }
    }

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.45)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 22) {
                    header

                    if loading && invites.isEmpty {
                        ProgressView("Loading invites…")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    } else if invites.isEmpty {
                        emptyState
                    } else {
                        if !pendingInvites.isEmpty {
                            inviteSection(title: "Waiting", invites: pendingInvites)
                        }
                        if !inviteHistory.isEmpty {
                            inviteSection(title: "History", invites: inviteHistory)
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.bwend(size: 12))
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(Color.red.opacity(0.08))
                            .cornerRadius(BwendRadius.md)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
            }
            .refreshable { await load() }
        }
        .background(Color.bwendBackground.ignoresSafeArea())
        .navigationTitle("Your invites")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .confirmationDialog(
            "Cancel this invite?",
            isPresented: Binding(
                get: { pendingCancellation != nil },
                set: { if !$0 { pendingCancellation = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Cancel invite", role: .destructive) {
                guard let invite = pendingCancellation else { return }
                Task { await cancel(invite) }
            }
            Button("Keep invite", role: .cancel) {
                pendingCancellation = nil
            }
        } message: {
            Text("Anyone with this link will no longer be able to use it.")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Sent links")
            Text("Every invite works once.")
                .font(.bwend(size: 28, weight: .bold))
                .foregroundColor(Color.bwendText)
            Text("Pending links expire after seven days. You can reshare or cancel them here.")
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendTextSecondary)
                .lineSpacing(4)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "link")
                .font(.system(size: 28, weight: .semibold))
                .foregroundColor(Color.Accent.cta)
            Text("No invites yet")
                .font(.bwend(size: 18, weight: .bold))
                .foregroundColor(Color.bwendText)
            Text("Start a blend, then send the link to one person.")
                .font(.bwend(size: 13))
                .foregroundColor(Color.bwendTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton("Create an invite") {
                Task { await createInvite() }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.card)
    }

    @ViewBuilder
    private func inviteSection(title: String, invites: [InviteSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(title)
            ForEach(invites) { invite in
                inviteCard(invite)
            }
        }
    }

    private func inviteCard(_ invite: InviteSummary) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Button {
                open(invite)
            } label: {
                HStack(spacing: 14) {
                    if let track = invite.selectedTrack {
                        RemoteArtwork(url: track.imageURL, fallbackSymbol: "music.note")
                            .frame(width: 54, height: 54)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundColor(Color.Accent.cta)
                            .frame(width: 54, height: 54)
                            .background(Color.bwendBgMuted)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(invite.selectedTrack?.name ?? "Invite \(invite.code)")
                            .font(.bwend(size: 15, weight: .bold))
                            .foregroundColor(Color.bwendText)
                            .lineLimit(1)
                        Text(detail(for: invite))
                            .font(.bwend(size: 12))
                            .foregroundColor(Color.bwendTextSecondary)
                        Text(invite.code.uppercased())
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundColor(Color.bwendTextMuted)
                        if invite.spotifyBlendURL != nil {
                            Text("Spotify Blend included")
                                .font(.bwend(size: 11, weight: .bold))
                                .foregroundColor(Color.spotify)
                        }
                    }

                    Spacer()

                    Text(statusLabel(for: invite))
                        .font(.bwend(size: 11, weight: .bold))
                        .foregroundColor(Color.bwendText)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(statusColor(for: invite))
                        .clipShape(Capsule())
                }
            }
            .buttonStyle(.plain)

            if invite.effectiveStatus(at: Date()) == "pending",
               let url = URL(string: invite.url) {
                HStack(spacing: 10) {
                    ShareLink(item: url) {
                        Label("Share again", systemImage: "square.and.arrow.up")
                            .font(.bwend(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Capsule().fill(Color.Accent.cta))
                    }

                    Button(role: .destructive) {
                        pendingCancellation = invite
                    } label: {
                        Text(cancellingCode == invite.code ? "Cancelling…" : "Cancel")
                            .font(.bwend(size: 13, weight: .bold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                    }
                    .disabled(cancellingCode != nil)
                }
            }
        }
        .padding(16)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.lg)
    }

    private func detail(for invite: InviteSummary) -> String {
        if invite.isClaimed {
            return "Matched with \(invite.partnerName ?? "someone")"
        }
        if invite.effectiveStatus(at: Date()) == "expired" {
            return "This link has expired"
        }
        return invite.expiryDescription(at: Date())
    }

    private func statusLabel(for invite: InviteSummary) -> String {
        if invite.isClaimed { return "Matched" }
        if invite.effectiveStatus(at: Date()) == "pending" { return "Pending" }
        return "Expired"
    }

    private func statusColor(for invite: InviteSummary) -> Color {
        if invite.isClaimed { return Color.Accent.lavender.opacity(0.25) }
        if invite.effectiveStatus(at: Date()) == "pending" {
            return Color.Accent.warmYellow.opacity(0.28)
        }
        return Color.bwendBgMuted
    }

    private func open(_ invite: InviteSummary) {
        if let matchId = invite.matchId {
            router.route(to: .revealMoment(matchId: matchId))
        } else if invite.effectiveStatus(at: Date()) == "pending" {
            router.route(to: .shareInvite(code: invite.code))
        }
    }

    @MainActor
    private func load() async {
        loading = true
        errorMessage = nil
        do {
            invites = try await api.myInvites()
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    @MainActor
    private func cancel(_ invite: InviteSummary) async {
        cancellingCode = invite.code
        pendingCancellation = nil
        errorMessage = nil
        do {
            _ = try await api.cancelInvite(code: invite.code)
            invites.removeAll { $0.code == invite.code }
        } catch {
            errorMessage = error.localizedDescription
        }
        cancellingCode = nil
    }

    @MainActor
    private func createInvite() async {
        do {
            let response = try await api.createInvite()
            router.route(to: .shareInvite(code: response.code))
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        InviteManagementView()
            .environmentObject(APIClient())
            .environmentObject(Router())
    }
}
