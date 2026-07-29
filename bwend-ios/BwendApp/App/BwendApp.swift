import SwiftUI

@main
struct BwendApp: App {
    @UIApplicationDelegateAdaptor(BwendAppDelegate.self) private var appDelegate

    @StateObject private var authManager = AuthManager()
    @StateObject private var api = APIClient()
    @StateObject private var router = Router()
    @StateObject private var notificationManager = NotificationManager.shared

    init() {
        // Register the bundled DM Sans + Fraunces OTF files before any view loads.
        BwendFont.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authManager)
                .environmentObject(api)
                .environmentObject(router)
                .environmentObject(notificationManager)
                .preferredColorScheme(nil)   // respect system until user toggles
                .tint(Color.Accent.cta)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
                .onAppear {
                    // Fix the wiring bug: wire the auth manager into the API client so requests
                    // can read the Bearer token. Previously this was never called.
                    api.attach(authManager)
                    notificationManager.configure(api: api, router: router)
                }
        }
    }

    /// Route incoming Universal Links (`https://bwend.xyz/m/<code>`) and custom-scheme callbacks
    /// (`bwend://m/<code>`) to the invite preview.
    ///
    /// Two cases:
    ///   1. User is already onboarded → push directly onto the navigation stack.
    ///   2. User is brand-new (no Spotify connected yet) → hold the code in
    ///      `router.pendingInviteCode`. After they finish onboarding, SpotifyConnectView checks
    ///      for it and routes them to the invite instead of the start screen. This is the path a
    ///      Hinge match takes when they tap the link without having the app set up yet.
    private func handleIncomingURL(_ url: URL) {
        guard let inviteCode = url.inviteCode else { return }

        if authManager.isOnboarded {
            router.route(to: .invitePreview(code: inviteCode))
        } else {
            router.pendingInviteCode = inviteCode
        }
    }
}

private extension URL {
    /// Extract the invite code from a URL of the form:
    ///   https://bwend.xyz/m/<code>
    ///   bwend://m/<code>
    var inviteCode: String? {
        let path = self.path
        guard path.hasPrefix("/m/") else { return nil }
        let code = String(path.dropFirst("/m/".count))
        return code.isEmpty ? nil : code
    }
}
