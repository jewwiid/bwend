import Foundation
import AuthenticationServices
import CryptoKit

// MARK: - Spotify PKCE auth
//
// Uses ASWebAuthenticationSession to present Spotify's login flow in Safari's SFAuthenticationViewController
// (system-managed, prevents cookie leakage into the app). Returns the auth code to our callback scheme.

@MainActor
final class SpotifyAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    /// The scopes we need. All read-only — the app never writes to anyone's Spotify account.
    ///
    /// Everything below `user-top-read` powers the Blend screen. They're requested together
    /// so the user consents once; each is independently optional at read time, so someone who
    /// connected before these existed still gets their top artists and tracks.
    static let scopes = [
        "user-read-private",
        "user-read-email",
        "user-top-read",
        "user-read-recently-played",   // "what you've been on lately"
        "user-library-read",           // saved songs + albums counts
        "playlist-read-private",       // playlist count
        "user-follow-read",            // followed-artists count
        "user-read-currently-playing", // live track on the Blend screen
        "user-read-playback-state",    // active Spotify Connect device
        "playlist-modify-private",     // explicit "Save to my Spotify" action
    ].joined(separator: " ")

    /// Spotify client id. Configure via Info.plist `SPOTIFY_CLIENT_ID`.
    static let clientID = Bundle.main.object(forInfoDictionaryKey: "SPOTIFY_CLIENT_ID") as? String ?? ""

    /// Custom scheme the Spotify dashboard must allow: bwend://spotify-callback
    static let redirectScheme = "bwend"
    static let redirectPath = "spotify-callback"
    static let redirectURI = "\(redirectScheme)://\(redirectPath)"

    private var currentSession: ASWebAuthenticationSession?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    /// The result of the PKCE auth flow — both the code and the verifier that generated it.
    /// The backend needs the verifier to complete the token exchange.
    struct AuthResult {
        let code: String
        let codeVerifier: String
    }

    /// Start the OAuth flow. Returns the auth code + PKCE verifier.
    func authorize() async throws -> AuthResult {
        let verifier = Self.generateCodeVerifier()
        let challenge = Self.codeChallenge(for: verifier)
        let state = Self.generateState()

        var components = URLComponents(string: "https://accounts.spotify.com/authorize")!
        components.queryItems = [
            .init(name: "client_id",             value: Self.clientID),
            .init(name: "response_type",         value: "code"),
            .init(name: "redirect_uri",          value: Self.redirectURI),
            .init(name: "code_challenge_method", value: "S256"),
            .init(name: "code_challenge",        value: challenge),
            .init(name: "state",                 value: state),
            .init(name: "scope",                 value: Self.scopes),
        ]

        guard let url = components.url else { throw SpotifyAuthError.invalidURL }

        // ASWebAuthenticationSession can invoke its completion handler more than once.
        // Guard the continuation to one resume.
        let resumeGate = ResumeGate()
        let code = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: Self.redirectScheme
            ) { callbackURL, error in
                guard resumeGate.claim() else { return }

                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL,
                      let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                      let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                    continuation.resume(throwing: SpotifyAuthError.missingCode)
                    return
                }
                continuation.resume(returning: code)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.currentSession = session
            session.start()
        }

        return AuthResult(code: code, codeVerifier: verifier)
    }

    // MARK: - PKCE helpers

    static func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 64)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    static func codeChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest).base64URLEncodedString()
    }

    static func generateState() -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }
}

enum SpotifyAuthError: Error {
    case invalidURL
    case missingCode
}

/// Thread-safe one-shot continuation guard. `claim()` returns true exactly once — the first
/// caller wins, subsequent callers are no-ops. Prevents double-resume crashes when
/// ASWebAuthenticationSession fires its completion more than once.
final class ResumeGate: @unchecked Sendable {
    private var claimed = false
    private let lock = NSLock()

    func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if claimed { return false }
        claimed = true
        return true
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
