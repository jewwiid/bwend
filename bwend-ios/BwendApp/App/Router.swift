import SwiftUI

// MARK: - Router
//
// Centralized navigation state for the simplified flow.
// Routes: welcome → spotifyConnect → start → shareInvite / invitePreview → revealMoment →
//         revealAnchor → revealDetail.

@MainActor
final class Router: ObservableObject {
    @Published var path = NavigationPath()

    /// When a deep link arrives but the user isn't onboarded yet, we hold the invite code here.
    /// After onboarding completes (SpotifyConnectView), we check this and route to the preview
    /// instead of the default StartView. This is the key to the "someone sends me a link from
    /// Hinge" flow — a brand-new user can still land directly on the invite.
    @Published var pendingInviteCode: String?

    enum Route: Hashable {
        case spotifyConnect
        case start
        case blend
        case listeningPortrait
        case shareInvite(code: String)
        case invitePreview(code: String)
        case trackInviteSearch
        case inviteManagement
        case accountPrivacy
        case revealMoment(matchId: String)
        case revealAnchor(matchId: String)
        case revealDetail(matchId: String)
    }

    func route(to destination: Route) {
        path.append(destination)
    }

    func reset(to destination: Route) {
        path = NavigationPath()
        path.append(destination)
    }
}
