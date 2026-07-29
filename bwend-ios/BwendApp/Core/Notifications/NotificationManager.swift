import SwiftUI
import UserNotifications

@MainActor
final class NotificationManager: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    static var isAvailable: Bool {
        Bundle.main.object(forInfoDictionaryKey: "BWEND_NOTIFICATIONS_ENABLED") as? Bool ?? false
    }

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var dailyBlendsEnabled: Bool
    @Published private(set) var registrationError: String?

    private weak var api: APIClient?
    private weak var router: Router?
    private var deviceToken: String?
    private var pendingMatchID: String?

    private static let enabledKey = "bwend.notifications.daily.enabled"

    private override init() {
        dailyBlendsEnabled = Self.isAvailable
            && UserDefaults.standard.bool(forKey: Self.enabledKey)
        super.init()
    }

    func configure(api: APIClient, router: Router) {
        self.api = api
        self.router = router
        guard Self.isAvailable else {
            dailyBlendsEnabled = false
            UserDefaults.standard.removeObject(forKey: Self.enabledKey)
            return
        }

        if let pendingMatchID {
            router.route(to: .revealMoment(matchId: pendingMatchID))
            self.pendingMatchID = nil
        }

        Task { await refreshAuthorizationStatus() }
        if dailyBlendsEnabled {
            // APNs registration is independent from alert authorization. Re-register at launch
            // so APNs can rotate and redeliver the opaque device token.
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func enableDailyBlends() async -> Bool {
        guard Self.isAvailable else { return false }
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let granted: Bool

        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            granted = true
        case .notDetermined:
            do {
                granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                registrationError = error.localizedDescription
                return false
            }
        case .denied:
            authorizationStatus = .denied
            registrationError = "Notifications are off. You can enable them in Settings."
            return false
        @unknown default:
            granted = false
        }

        guard granted else { return false }
        dailyBlendsEnabled = true
        UserDefaults.standard.set(true, forKey: Self.enabledKey)
        registrationError = nil

        UIApplication.shared.registerForRemoteNotifications()
        if let deviceToken {
            await upload(deviceToken)
        }
        await refreshAuthorizationStatus()
        return true
    }

    func disableDailyBlends() async {
        dailyBlendsEnabled = false
        UserDefaults.standard.set(false, forKey: Self.enabledKey)
        registrationError = nil
        guard let api, let deviceToken else { return }
        do {
            _ = try await api.disablePushDevice(token: deviceToken)
        } catch {
            // Local opt-out takes effect immediately. A later successful registration will
            // reconcile server state if this request was offline.
            registrationError = error.localizedDescription
        }
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    func receiveDeviceToken(_ data: Data) {
        // APNs device tokens are opaque. Hex encoding makes the bytes transport-safe without
        // assuming a fixed token length.
        let token = data.map { String(format: "%02x", $0) }.joined()
        deviceToken = token
        guard dailyBlendsEnabled else { return }
        Task { await upload(token) }
    }

    func receiveRegistrationFailure(_ error: Error) {
#if targetEnvironment(simulator)
        // Simulator does not register with APNs. Use an .apns payload or `simctl push` to test.
        registrationError = nil
#else
        registrationError = error.localizedDescription
#endif
    }

    func refreshAuthorizationStatus() async {
        authorizationStatus = await UNUserNotificationCenter.current()
            .notificationSettings()
            .authorizationStatus
    }

    private func upload(_ token: String) async {
        guard let api else { return }
#if DEBUG
        let environment = "sandbox"
#else
        let environment = "production"
#endif
        do {
            _ = try await api.registerPushDevice(
                token: token,
                environment: environment,
                timezone: TimeZone.current.identifier,
                dailyHour: 18
            )
            registrationError = nil
        } catch {
            registrationError = error.localizedDescription
        }
    }

    // Foreground notifications are otherwise suppressed by iOS.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard response.actionIdentifier != UNNotificationDismissActionIdentifier,
              let matchID = response.notification.request.content.userInfo["matchId"] as? String
        else { return }

        if let router {
            router.route(to: .revealMoment(matchId: matchID))
        } else {
            pendingMatchID = matchID
        }
    }
}

@MainActor
final class BwendAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationManager.shared

        let openAction = UNNotificationAction(
            identifier: "OPEN_DAILY_BLEND",
            title: "Open blend",
            options: [.foreground]
        )
        let category = UNNotificationCategory(
            identifier: "DAILY_BLEND",
            actions: [openAction],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([category])
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationManager.shared.receiveDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationManager.shared.receiveRegistrationFailure(error)
    }
}
