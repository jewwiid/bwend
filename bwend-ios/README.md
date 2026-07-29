# bwend-ios

SwiftUI iOS app for Bwend — invite someone to blend via a shareable URL, see a Vibe Score,
generate a custom "Bwend Blend" Spotify playlist for both of you.

**Auth: Sign in with Madamore.** Bwend uses the same Madamore account that powers madamore.com
and Ludus. No new password, no Sign in with Apple on this app — Madamore handles identity and
hands Bwend a short-lived JWT. Bwend is its own standalone product with its own bundle id
(`com.bwend.app`) and its own App Store presence.

## Quick start

```bash
# 1. Install xcodegen (already installed via brew on most setups).
brew install xcodegen

# 2. Generate the Xcode project from project.yml.
cd bwend-ios
xcodegen generate

# 3. Open in Xcode.
open Bwend.xcodeproj
```

In Xcode:
1. Pick a simulator (iPhone 15 Pro or later recommended).
2. Set your Spotify client id + backend URL as user-defined build settings
   (Project → Bwend → Build Settings → User-Defined):
   - `SPOTIFY_CLIENT_ID` — from <https://developer.spotify.com/dashboard>
   - `BWEND_API_URL` — `http://localhost:8080` for local dev with the backend running
3. Run `Cmd+R`. The app launches at the Welcome screen.

## Architecture

```
BwendApp/
  App/                  BwendApp.swift, RootView.swift, Router.swift
  Core/
    Auth/               AuthManager (Keychain), AppleSignIn, SpotifyAuth (PKCE)
    Networking/         APIClient (async/await URLSession)
    Models/             Domain DTOs matching backend response shapes
    DesignSystem/       Theme (real hex tokens), Typography (DM Sans + Fraunces), Components
  Features/
    Onboarding/         WelcomeView, SpotifyConnectView, ProfileSetupView
    Home/               HomeView (daily blend card + invite list)
    Share/              ShareView (native share sheet + invite-code preview)
    Match/              InvitePreviewView, MatchRevealView (animated Vibe Score)
    Blend/              BlendView (generate + open in Spotify)
    Settings/           Profile + mood editing, sign out
  Resources/
    Assets.xcassets     AppIcon, AccentColor, bg-primary
    PrivacyInfo.xcprivacy
    Info.plist
```

### Design system

The brand tokens live in `Core/DesignSystem/Theme.swift` and are pulled **verbatim from the web
app's `src/index.css`** — not from `AGENTS.md` / `CLAUDE.md` (those docs are stale; e.g. the real
hero is "designed to be heard" not "sounds like you", fonts are DM Sans + Fraunces not system
sans, real hexes differ from the docs).

When the web app's design tokens change, update `Theme.swift` to match.

### Auth: Madamore account handoff

The flow (mirrors Ludus):

1. User taps **Sign in with Madamore**.
2. `MadamoreAuth.signIn()` opens an `ASWebAuthenticationSession` to
   `madamore.com/bwend?return_to=bwend://auth/callback`.
3. The user signs in to Madamore (Password / Google / Apple — Madamore's Convex Auth supports
   all three). If they're already signed in to Madamore in Safari, no UI appears.
4. Madamore's `/bwend` bridge page calls the `bwendToken.issue` Convex action, which mints a
   short-lived RS256 JWT carrying the user's profile.
5. Madamore redirects to `bwend://auth/callback#madamoreToken=<jwt>`.
6. `ASWebAuthenticationSession` hands us the URL; we extract the token, store it in Keychain,
   and call `/users/me` to verify the Bwend backend accepts it.

The token is signed by Madamore's key and verified by the Bwend backend against Madamore's
public JWKS. Bwend never sees passwords, refresh tokens, or anything other than the JWT claims.

### Routing

`Router` is the single source of truth for navigation. Views call `router.route(to: .someCase)`.
Deep links from `https://bwend.xyz/m/<code>` land in `BwendApp.onOpenURL` and are routed to the
invite preview automatically.

## Spotify OAuth (per-user, after Madamore sign-in)

- **PKCE flow** via `ASWebAuthenticationSession` (system-managed Safari sheet — no cookie leakage).
- **Scopes:** `user-read-private user-read-email user-top-read playlist-modify-public`.
- **Redirect URI** registered in the Spotify dashboard:
  - Dev:  `bwend://spotify-callback` (custom scheme — works without a domain)
  - Prod: `https://bwend.xyz/auth/spotify/callback` (Universal Link)

The iOS app never sees refresh tokens — those stay server-side in the backend.

## Universal Links

`https://bwend.xyz/m/<code>` opens the app to the invite preview screen. Requires:

1. **Associated Domain** in entitlements: `applinks:bwend.xyz` (already in `Info.plist`).
2. **AASA file** at `https://bwend.xyz/.well-known/apple-app-site-association` — the template
   lives in `public/.well-known/apple-app-site-association`. Replace `TEAM_ID` with your Apple
   Developer team id and serve it from the backend (or your CDN).
3. **Apple CDN crawls the file** periodically. After deploy, expect a 5–30 min delay before the
   app starts deep-linking.

## ASC setup — what you need to do before TestFlight

The code is ready. These are the human-in-the-loop steps that only **you** can do:

### 1. Apple Developer Portal (`developer.apple.com`)

- [ ] **App ID** — register `com.bwend.app` (App IDs → Identifiers → +).
      No special capabilities required — Sign in with Apple lives on Madamore's app id, not Bwend's.
- [ ] **Distribution certificate** — Certs, Identifiers & Profiles → Certificates → + →
      Apple Distribution.
- [ ] **Provisioning profile** — App Store profile for `com.bwend.app` bound to the
      distribution cert. (Easier: let `fastlane match` create this for you — see below.)

### 2. App Store Connect (`appstoreconnect.apple.com`)

- [ ] **My Apps → + → New App** — name `Bwend`, primary language English, bundle id
      `com.bwend.app`, SKU `bwend`.
- [ ] **App Information** — category: **Music** + **Social Networking**. Age rating: 4+.
- [ ] **App Privacy** — fill from `PrivacyInfo.xcprivacy` (no tracking, data linked to user:
      email, user id, audio data, other user content).
- [ ] **No Sign-in-with-Apple capability needed here** — that's owned by Madamore's app id,
      not Bwend's. Apple will still approve the app because authentication is handled by a
      web view (ASWebAuthenticationSession) rather than a native Sign in with Apple button.

### 3. Fastlane match (one-time signing setup)

```bash
# Create a private git repo (e.g. github.com/you/bwend-fastlane-match) — must be PRIVATE.
fastlane match init -g git@github.com:you/bwend-fastlane-match.git

# Generate + sync certs into the match repo.
fastlane match appstore --app_identifier com.bwend.app

# Create an ASC API key in App Store Connect → Users → Access → Keys → +.
# Save the .p8 file. Note the Key ID and Issuer ID.
```

### 4. Secrets (set in your CI env or local shell)

```bash
export SPOTIFY_CLIENT_ID=...                           # from Spotify dashboard
export BWEND_API_URL=https://api.bwend.xyz             # backend prod URL
export ASC_API_KEY_ID=...                              # from ASC
export ASC_API_ISSUER_ID=...                           # from ASC
export ASC_API_KEY_FILEPATH=~/.asc/AuthKey_XXXXXXXXXX.p8
export MATCH_PASSWORD=...                              # fastlane match repo password
```

### 5. Ship to TestFlight

```bash
cd bwend-ios
fastlane beta
```

Fastlane will: regenerate the project, sync certs, bump build number, archive, upload to
TestFlight. First build takes ~30 min to process; subsequent builds are faster.

## Tests

There's no XCTest target yet — the SwiftUI views are mostly presentation and the backend has the
real test coverage. When we add unit tests:

```bash
fastlane ci     # runs xcodegen + xcodebuild test
```

## Privacy & App Store category

- **Category:** Music + Social Networking (NOT Dating). This avoids Apple's stricter
  matchmaking review tier and the 17+ rating. The matching logic is internal; the marketing is
  music-first.
- **No tracking:** `NSUserTrackingUsageDescription` is set defensively but we never call
  `ATTrackingManager.requestTrackingAuthorization`. Privacy labels declare zero tracking.
- **No third-party SDKs:** everything is first-party. App Privacy Review should be smooth.
- **Encryption:** `ITSAppUsesNonExemptEncryption = false` — we use HTTPS only, no custom crypto
  that would trigger the ERN review.

## Known caveats (v1)

- **Fonts** — `Resources/Fonts/` is currently empty. Drop `DMSans-Regular.otf`,
  `DMSans-Medium.otf`, `DMSans-Bold.otf`, `Fraunces-Italic.otf` (Google Fonts, OFL-licensed) in
  there and `BwendFont.register()` picks them up. Until then the app falls back to system fonts.
- **No MusicKit playback** — v1 links out to Spotify rather than embedding a player. v1.1 plan.
- **No daily discovery** — v1 is invite-only (you and someone you already know). The "one blend
  a day" matchmaking from the landing page is v2.

## Brand assets

The app icon and in-app logo are sourced from the canonical Bwend logo SVG at
`BwendApp/Resources/Brand/bwend-logo.svg` (the original artwork — black rounded square +
three green blend dots + white "bwend" wordmark).

If the logo ever changes:

1. Replace `Resources/Brand/bwend-logo.svg` with the new version.
2. Re-render the master 1024×1024 PNG:
   ```bash
   magick -density 600 Resources/Brand/bwend-logo.svg -resize 1024x1024 /tmp/logo-1024.png
   ```
3. Regenerate all AppIcon sizes from that PNG (see the script that produced
   `AppIcon.appiconset/`). Each slot's PNG dimensions must equal `logical size × scale factor`.
4. Update `Logo.imageset/` the same way for the in-app SwiftUI `Image("Logo")` usages.
