import Foundation
import SwiftUI

// MARK: - AuthManager
//
// Owns the Bwend session JWT (issued by the backend at Spotify connect time), persists it to
// Keychain, exposes an ObservableObject for views. Identity is Spotify-native — connecting
// Spotify IS the sign-in.

@MainActor
final class AuthManager: ObservableObject {
    @Published private(set) var sessionToken: String?

    /// Whether the user has completed onboarding (connected Spotify). Persisted to UserDefaults
    /// so returning users skip the connect screen on cold launch.
    @AppStorage("isOnboarded") var isOnboarded: Bool = false

    /// The display name from the connect response. Shown on the start screen + reveal.
    @Published private(set) var displayName: String?

    private let keychain = KeychainStore(service: "com.bwend.app.session")

    init() {
        if let token = keychain.read(key: "sessionToken") {
            self.sessionToken = token
        }
    }

    /// Called after POST /auth/spotify succeeds. Stores the session JWT + display name.
    func applySession(token: String, displayName: String?) {
        self.sessionToken = token
        self.displayName = displayName
        keychain.write(key: "sessionToken", value: token)
        self.isOnboarded = true
    }

    func signOut() {
        sessionToken = nil
        displayName = nil
        isOnboarded = false
        keychain.delete(key: "sessionToken")
    }
}

// MARK: - Keychain wrapper

struct KeychainStore {
    let service: String

    func write(key: String, value: String) {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        key,
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String]  = Data(value.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        key,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
