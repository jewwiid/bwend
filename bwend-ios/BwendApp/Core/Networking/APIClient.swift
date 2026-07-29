import Foundation

// MARK: - Network errors

enum APIError: Error, LocalizedError {
    case invalidURL
    case noSession
    case http(status: Int, body: String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:                            return "Bad request URL."
        case .noSession:                             return "Please sign in to continue."
        case .http(let status, let body):
            if let data = body.data(using: .utf8),
               let decoded = try? JSONDecoder.api.decode(ServerReason.self, from: data) {
                return decoded.reason
            }
            // No `reason` in the body — the failure came from somewhere other than our own
            // handler (a proxy, a gateway, a crash). `localizedString(forStatusCode:)` alone
            // yields bare HTTP jargon like "bad gateway", which tells the user nothing and
            // hides that anything is worth reporting, so keep the status visible and say so.
            let statusText = HTTPURLResponse.localizedString(forStatusCode: status).capitalized
            return "Something went wrong on our end (\(status) \(statusText)). Please try again."
        case .decoding(let e):                       return "Couldn't read response: \(e.localizedDescription)"
        case .transport(let e):                      return e.localizedDescription
        }
    }

    /// The raw server payload, for logging. Never shown to the user.
    var diagnosticDetail: String? {
        switch self {
        case .http(let status, let body): return "HTTP \(status) — \(body)"
        case .decoding(let e):            return "decoding — \(e)"
        case .transport(let e):           return "transport — \(e)"
        case .invalidURL, .noSession:     return nil
        }
    }

    /// True when the only way forward is a fresh Spotify authorization — the profile is gone,
    /// the refresh token is dead, or the session no longer verifies.
    ///
    /// Driven by the server's `code`, not the status: a 404 from /me/blend means "your account
    /// is gone", while a 404 from /invites means "bad link", and signing the user out for the
    /// second would be maddening.
    var requiresReconnect: Bool {
        switch self {
        case .noSession:
            return true
        case .http(let status, let body):
            if status == 401 { return true }
            guard let data = body.data(using: .utf8),
                  let decoded = try? JSONDecoder.api.decode(ServerReason.self, from: data)
            else { return false }
            return decoded.code == "reconnect_required"
        default:
            return false
        }
    }
}

private struct ServerReason: Decodable {
    let reason: String
    let code: String?
}

// MARK: - APIClient
//
// Thin async/await wrapper around URLSession. All endpoints return the typed DTO from Models.swift.
// Bearer token is injected per-request from the AuthManager.

@MainActor
final class APIClient: ObservableObject {
    /// Base URL. Configure via Info.plist `BWEND_API_URL` or default to local dev.
    static let baseURL = Bundle.main.object(forInfoDictionaryKey: "BWEND_API_URL") as? String
        ?? "http://localhost:8080"

    private let session: URLSession
    private weak var authManager: AuthManager?

    init(session: URLSession = .shared) {
        self.session = session
    }

    /// Called once at app launch (in BwendApp) to wire the auth manager so requests can read
    /// the Bearer token. This fixes the bug where authManager stayed nil and every request threw.
    func attach(_ authManager: AuthManager) {
        self.authManager = authManager
    }

    // MARK: - Public API

    /// POST /auth/spotify — the auth entry point. Sends the Spotify auth code + PKCE verifier,
    /// receives a Bwend session JWT + the user's basic profile. NOT authed (no existing token yet
    /// — this is where you get one).
    func connectSpotify(code: String, codeVerifier: String) async throws -> SpotifyConnectResponse {
        try await post("/auth/spotify", body: ["code": code, "codeVerifier": codeVerifier], authed: false)
    }

    /// GET /me/blend — the caller's own listening profile for the given window.
    func myBlend(timeRange: BlendTimeRange = .medium) async throws -> BlendResponse {
        try await get("/me/blend?time_range=\(timeRange.rawValue)")
    }

    /// POST /invites — create a shareable invite.
    func createInvite() async throws -> CreateInviteResponse {
        try await post("/invites", body: [:], authed: true)
    }

    /// GET /invites/{code}
    func fetchInvite(code: String) async throws -> InvitePreview {
        try await get("/invites/\(code)")
    }

    /// POST /invites/{code}/claim
    func claimInvite(code: String) async throws -> ClaimResponse {
        try await post("/invites/\(code)/claim", body: [:], authed: true)
    }

    /// GET /matches/{id}
    func fetchMatch(id: UUID) async throws -> PublicMatch {
        try await get("/matches/\(id)")
    }

    /// GET /matches — the caller's past matches, newest first.
    func myMatches() async throws -> [MatchSummary] {
        try await get("/matches")
    }

    // MARK: - Internals

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await perform("GET", path, body: nil, authed: true)
    }

    private func post<T: Decodable>(_ path: String, body: [String: Any], authed: Bool) async throws -> T {
        try await perform("POST", path, body: body, authed: authed)
    }

    private func perform<T: Decodable>(
        _ method: String,
        _ path: String,
        body: [String: Any]?,
        authed: Bool
    ) async throws -> T {
        guard let url = URL(string: Self.baseURL + path) else { throw APIError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authed {
            guard let token = authManager?.sessionToken else { throw APIError.noSession }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(status: 0, body: String(data: data, encoding: .utf8) ?? "")
        }

        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }

        do {
            return try JSONDecoder.api.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

extension JSONDecoder {
    /// Shared decoder. snake_case → camelCase handled here so model types stay clean.
    static let api: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
