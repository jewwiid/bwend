import Foundation
import Security
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
    @Published private(set) var credentialStorageError: String?

    private let keychain = KeychainStore(service: "com.bwend.app.session")

    init() {
        Task {
            do {
                if let token = try await keychain.read(key: "sessionToken") {
                    self.sessionToken = token
                }
            } catch {
                credentialStorageError = error.localizedDescription
            }
        }
    }

    /// Called after POST /auth/spotify succeeds. Stores the session JWT + display name.
    func applySession(token: String, displayName: String?) async throws {
        try await keychain.write(key: "sessionToken", value: token)
        self.sessionToken = token
        self.displayName = displayName
        self.isOnboarded = true
    }

    func signOut() {
        sessionToken = nil
        displayName = nil
        isOnboarded = false
        Task {
            do {
                try await keychain.delete(key: "sessionToken")
            } catch {
                credentialStorageError = error.localizedDescription
            }
        }
    }
}

// MARK: - Keychain wrapper

enum KeychainStoreError: LocalizedError {
    case unexpectedStatus(OSStatus)
    case invalidData

    var errorDescription: String? {
        switch self {
        case .unexpectedStatus(let status):
            let message = SecCopyErrorMessageString(status, nil) as String? ?? "Unknown error"
            return "Secure session storage failed: \(message) (\(status))."
        case .invalidData:
            return "Secure session storage returned unreadable data."
        }
    }
}

actor KeychainStore {
    let service: String

    init(service: String) {
        self.service = service
    }

    func write(key: String, value: String) throws {
        let identity: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        key,
        ]
        var attributes = identity
        attributes[kSecValueData as String]  = Data(value.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        let addStatus = SecItemAdd(attributes as CFDictionary, nil)
        if addStatus == errSecDuplicateItem {
            let updateStatus = SecItemUpdate(
                identity as CFDictionary,
                [kSecValueData as String: Data(value.utf8)] as CFDictionary
            )
            guard updateStatus == errSecSuccess else {
                throw KeychainStoreError.unexpectedStatus(updateStatus)
            }
        } else if addStatus != errSecSuccess {
            throw KeychainStoreError.unexpectedStatus(addStatus)
        }
    }

    func read(key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        key,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            throw KeychainStoreError.unexpectedStatus(status)
        }
        guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            throw KeychainStoreError.invalidData
        }
        return value
    }

    func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainStoreError.unexpectedStatus(status)
        }
    }
}
