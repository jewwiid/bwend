import SwiftUI

struct AccountPrivacyView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var router: Router

    @State private var exportURL: URL?
    @State private var working = false
    @State private var errorMessage: String?
    @State private var confirmDisconnect = false
    @State private var confirmDelete = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel("Private by default")
                    Text("Bwend is a connection companion, not a dating directory.")
                        .font(.bwend(size: 24, weight: .bold))
                        .foregroundColor(Color.bwendText)
                    Text("There is no public profile or people search. Your music is revealed only through links you choose to send or claim.")
                        .font(.bwend(size: 14))
                        .foregroundColor(Color.bwendTextSecondary)
                        .lineSpacing(4)
                }

                controlCard(
                    icon: "square.and.arrow.up",
                    title: "Export my data",
                    body: "Download your Taste Card, optional Listening Portrait, consent records, invites, blends, and settings as JSON."
                ) {
                    Task { await exportData() }
                }

                if let exportURL {
                    ShareLink(item: exportURL) {
                        Label("Share exported JSON", systemImage: "doc.badge.arrow.up")
                            .font(.bwend(size: 14, weight: .bold))
                            .foregroundColor(Color.Accent.cta)
                    }
                }

                controlCard(
                    icon: "link.badge.minus",
                    title: "Disconnect Spotify",
                    body: "Deletes the stored Spotify credential now. Your Taste Card remains for 30 days so you can reconnect."
                ) {
                    confirmDisconnect = true
                }

                controlCard(
                    icon: "trash",
                    title: "Delete my Bwend account",
                    body: "Immediately erases your Taste Card, Listening Portrait, questionnaire answers, invites, blends, saved-playlist records, and push registrations from Bwend."
                ) {
                    confirmDelete = true
                }

                NavigationLink {
                    PrivacyNoticeView()
                } label: {
                    Text("Read the privacy notice")
                        .font(.bwend(size: 13, weight: .medium))
                        .foregroundColor(Color.Accent.cta)
                }

                Text("Playlists already saved inside Spotify remain in Spotify until you delete them there.")
                    .font(.bwend(size: 11))
                    .foregroundColor(Color.bwendTextMuted)

                if working {
                    ProgressView().tint(Color.Accent.cta)
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(.bwend(size: 12))
                        .foregroundColor(.red)
                }
            }
            .padding(24)
        }
        .background(Color.bwendBackground.ignoresSafeArea())
        .navigationTitle("Privacy & data")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Disconnect Spotify?", isPresented: $confirmDisconnect) {
            Button("Cancel", role: .cancel) {}
            Button("Disconnect", role: .destructive) {
                Task { await disconnect() }
            }
        } message: {
            Text("Spotify access will stop immediately. Bwend will erase the remaining account after 30 days unless you reconnect.")
        }
        .alert("Delete your Bwend account?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete permanently", role: .destructive) {
                Task { await deleteAccount() }
            }
        } message: {
            Text("This cannot be undone and removes shared blend reveals for both participants.")
        }
    }

    private func controlCard(
        icon: String,
        title: String,
        body: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(Color.Accent.cta)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(Color.Accent.peach.opacity(0.18)))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.bwend(size: 14, weight: .bold))
                        .foregroundColor(Color.bwendText)
                    Text(body)
                        .font(.bwend(size: 12))
                        .foregroundColor(Color.bwendTextSecondary)
                        .multilineTextAlignment(.leading)
                        .lineSpacing(3)
                }
                Spacer()
            }
            .padding(18)
            .background(Color.bwendBgCard)
            .cornerRadius(BwendRadius.lg)
        }
        .buttonStyle(.plain)
        .disabled(working)
    }

    @MainActor
    private func exportData() async {
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            let data = try await api.exportAccountData()
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("bwend-data-export.json")
            try data.write(to: url, options: .atomic)
            exportURL = url
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func disconnect() async {
        working = true
        errorMessage = nil
        do {
            _ = try await api.disconnectSpotify()
            auth.signOut()
            router.reset(to: .spotifyConnect)
        } catch {
            errorMessage = error.localizedDescription
            working = false
        }
    }

    @MainActor
    private func deleteAccount() async {
        working = true
        errorMessage = nil
        do {
            _ = try await api.deleteAccount()
            auth.signOut()
            router.reset(to: .spotifyConnect)
        } catch {
            errorMessage = error.localizedDescription
            working = false
        }
    }
}

#Preview {
    NavigationStack {
        AccountPrivacyView()
            .environmentObject(AuthManager())
            .environmentObject(APIClient())
            .environmentObject(Router())
    }
}
