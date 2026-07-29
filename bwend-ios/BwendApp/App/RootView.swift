import SwiftUI

// MARK: - RootView
//
// Owns the single NavigationStack for the entire app. The auth gate picks which root screen
// shows inside it (Welcome vs Start), but both share the same nav stack — so a tap on
// "Connect Spotify" in WelcomeView can push SpotifyConnectView, even though the user hasn't
// onboarded yet. Deep links from incoming URLs also land in this stack.

struct RootView: View {
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var router: Router

    var body: some View {
        NavigationStack(path: $router.path) {
            Group {
                if auth.sessionToken == nil || !auth.isOnboarded {
                    WelcomeView()
                } else {
                    StartView()
                }
            }
            .background(Color.bwendBackground.ignoresSafeArea())
            .navigationDestination(for: Router.Route.self) { route in
                destination(for: route)
            }
        }
        .preferredColorScheme(nil)
    }

    @ViewBuilder
    private func destination(for route: Router.Route) -> some View {
        switch route {
        case .spotifyConnect:
            SpotifyConnectView()
        case .start:
            StartView()
        case .blend:
            BlendView()
        case .shareInvite(let code):
            ShareView(inviteCode: code)
        case .trackInviteSearch:
            TrackInviteSearchView()
        case .invitePreview(let code):
            InvitePreviewView(code: code)
        case .revealMoment(let matchId):
            RevealMomentView(matchId: matchId)
        case .revealAnchor(let matchId):
            RevealAnchorView(matchId: matchId)
        case .revealDetail(let matchId):
            RevealDetailView(matchId: matchId)
        }
    }
}
