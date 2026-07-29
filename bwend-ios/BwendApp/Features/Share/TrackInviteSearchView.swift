import SwiftUI

/// Search Spotify and attach one intentional anchor track to a new invite.
struct TrackInviteSearchView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var router: Router

    @State private var query = ""
    @State private var results: [BlendTrack] = []
    @State private var searching = false
    @State private var creatingTrackID: String?
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.4)

            ScrollView {
                LazyVStack(spacing: 0) {
                    if searching {
                        ProgressView()
                            .padding(.vertical, 30)
                    } else if query.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 {
                        ContentUnavailableView(
                            "Choose the opening track",
                            systemImage: "music.note",
                            description: Text("Search for a song that says what an invite code can't.")
                        )
                        .padding(.top, 60)
                    } else if results.isEmpty && errorMessage == nil {
                        ContentUnavailableView.search(text: query)
                            .padding(.top, 60)
                    } else {
                        ForEach(results) { track in
                            Button {
                                Task { await createInvite(with: track) }
                            } label: {
                                HStack(spacing: 14) {
                                    RemoteArtwork(url: track.imageURL, fallbackSymbol: "music.note")
                                        .frame(width: 58, height: 58)
                                        .cornerRadius(BwendRadius.md)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(track.name)
                                            .font(.bwend(size: 15, weight: .bold))
                                            .foregroundColor(Color.bwendText)
                                            .lineLimit(1)
                                        Text(track.creditLine)
                                            .font(.bwend(size: 12))
                                            .foregroundColor(Color.bwendTextSecondary)
                                            .lineLimit(1)
                                    }
                                    Spacer()
                                    if creatingTrackID == track.id {
                                        ProgressView()
                                    } else {
                                        Image(systemName: "arrow.up.right")
                                            .foregroundColor(Color.bwendTextMuted)
                                    }
                                }
                                .padding(.vertical, 12)
                            }
                            .buttonStyle(.plain)
                            .disabled(creatingTrackID != nil)

                            Divider().overlay(Color.bwendBorderSubtle)
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.bwend(size: 13))
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.vertical, 20)
                    }
                }
                .padding(.horizontal, 24)
            }
        }
        .background(Color.bwendBackground.ignoresSafeArea())
        .navigationTitle("Invite with a track")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Song or artist")
        .task(id: query) { await search() }
    }

    @MainActor
    private func search() async {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count >= 2 else {
            results = []
            errorMessage = nil
            return
        }
        do {
            try await Task.sleep(for: .milliseconds(350))
            try Task.checkCancellation()
            searching = true
            defer { searching = false }
            results = try await api.searchTracks(query: normalized)
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch let error as APIError {
            searching = false
            errorMessage = error.errorDescription
        } catch {
            searching = false
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func createInvite(with track: BlendTrack) async {
        creatingTrackID = track.id
        errorMessage = nil
        defer { creatingTrackID = nil }
        do {
            let response = try await api.createInvite(selectedTrack: track)
            router.route(to: .shareInvite(code: response.code))
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        TrackInviteSearchView()
            .environmentObject(APIClient())
            .environmentObject(Router())
    }
}
