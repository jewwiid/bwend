# Bwend for iPhone

The SwiftUI client for Bwend's private, invite-only music connection flow. It uses Spotify
Authorization Code + PKCE as the account entry point and stores only the short-lived Bwend
session in Keychain. Spotify tokens remain encrypted in Convex.

## Build

```bash
brew install xcodegen
cd bwend-ios
xcodegen generate
open Bwend.xcodeproj
```

For a signing-free simulator check:

```bash
xcodebuild -project Bwend.xcodeproj -scheme Bwend \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO test
```

`project.yml` is the source of truth. It configures bundle ID `com.bwend.app`, Apple team
`7JSY6J5R99`, the production Convex HTTP endpoint, Spotify client ID, push entitlement, and
the `www.bwend.xyz` associated domain.

## Current flow

1. Review the privacy notice and connect Spotify through a system authentication session.
2. See a private Taste Card derived from ranked tracks, artists, era, discovery, and listening
   hours when Spotify provides those signals.
3. Optionally create a private AI Listening Portrait from a separate three-question form.
   Spotify tracks, artists, history, and lyrics are not sent to the AI provider.
4. Choose a track, create a seven-day link, and share it with someone already met elsewhere.
5. The recipient connects Spotify and claims the link.
6. Both people see the same reveal and may independently save a private playlist to Spotify.

There is no public profile, discovery feed, photo, biography, location, contacts access, or
dating-app import.

## Spotify scopes

The app requests account type, top music, recent listening, library counts, current playback,
and private-playlist access. It does not request email. The only write permission is
`playlist-modify-private`, used after the user taps the save action.

Register `bwend://spotify-callback` in the Spotify developer dashboard.

## Privacy and notifications

- The session JWT is stored with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- Account & Privacy provides export, disconnect, and immediate deletion.
- Notification permission is requested only after the user enables daily blends.
- APNs registration is stored server-side and can be disabled from the app.
- `PrivacyInfo.xcprivacy` declares no tracking and the Bwend user ID, music data, and optional
  Listening Portrait content used for app functionality.

Server delivery requires `APNS_KEY_ID`, `APNS_TEAM_ID`, and `APNS_PRIVATE_KEY` in the Convex
production environment. The beta build keeps `BWEND_NOTIFICATIONS_ENABLED` false until those
credentials and real-device delivery have been verified; the notification controls remain
hidden while the flag is off.

## Universal Links

Invite URLs use `https://www.bwend.xyz/m/<code>`. The deployed AASA file must contain
`7JSY6J5R99.com.bwend.app`, match the app entitlement, and be served without redirects at
`/.well-known/apple-app-site-association`.

## TestFlight prerequisites

The repository includes `fastlane beta`, but upload requires external Apple account setup:

- registered App ID with Associated Domains and Push Notifications;
- App Store Connect app record;
- distribution certificate and provisioning profile;
- private Match repository and `MATCH_PASSWORD`;
- `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, and `ASC_API_KEY_FILEPATH`;
- `SPOTIFY_CLIENT_ID` and `BWEND_API_URL`.

Then run:

```bash
cd bwend-ios
fastlane beta
```

Use Music as the primary App Store category and Social Networking as secondary. Bwend is not a
Dating-category service. App Store privacy answers must match the manifest and the final,
counsel-reviewed public privacy notice.
