# Bwend

Bwend is a private music-connection companion for two people who have already met elsewhere
or in person. A user connects Spotify, creates a seven-day invite, and shares it directly with
one other person. Bwend reveals ranked music overlap and can save a private Spotify playlist
after an explicit action.

It is intentionally not a dating marketplace: there is no public directory, swipe feed,
personal biography, location, contacts import, or sensitive-trait inference.

## Apps and services

- Web: React 19, TypeScript, Vite, Tailwind CSS 4
- iPhone: SwiftUI, iOS 17+, Spotify PKCE, Universal Links, APNs
- Backend: Convex functions, HTTP actions, database, crons
- Hosting: Vercel for the web and Convex for the API

## Local development

```bash
npm install
cp .env.example .env.local
npx convex dev
npm run dev
```

Set `VITE_SPOTIFY_CLIENT_ID` in `.env.local`. The Convex development deployment also needs:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI=bwend://spotify-callback`
- `SPOTIFY_ALLOWED_REDIRECT_URIS=http://localhost:5173/callback`
- `BWEND_SESSION_SECRET`
- `BWEND_ID_SECRET`
- `SPOTIFY_TOKEN_ENCRYPTION_KEY` (32 random bytes encoded as base64)
- `PUBLIC_BASE_URL`

APNs delivery additionally needs `APNS_KEY_ID`, `APNS_TEAM_ID`, and `APNS_PRIVATE_KEY`.
`APNS_BUNDLE_ID` defaults to `com.bwend.app`.

## Verification

```bash
npm run lint
npm run build
npx tsc --noEmit
npx convex dev --once
npx convex run privacyActions:selfCheck '{}'

cd bwend-ios
xcodegen generate
xcodebuild -project Bwend.xcodeproj -scheme Bwend \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

## Product routes

- `/` — product site and Spotify entry point
- `/privacy` — current pre-release privacy notice
- `/callback` — Spotify browser OAuth callback
- `/blend` — signed-in Taste Card, invites, and account controls
- `/m/:code` — private invite
- `/match/:id` — completed reveal

## Privacy and lifecycle

Spotify's raw account identifier is converted to a Bwend-only HMAC identifier before
persistence. OAuth credentials are encrypted with AES-256-GCM. Users can export their data,
disconnect Spotify, or delete their account from both clients. Unclaimed invites expire after
seven days; disconnected accounts are deleted after 30 days. See
[`docs/PRIVACY-ARCHITECTURE.md`](docs/PRIVACY-ARCHITECTURE.md).

## Deployment

```bash
npm run deploy:convex:prod
npm run deploy:vercel
```

Production uses `.env.production` for the public Convex URLs. Secret backend variables belong
in the production Convex deployment, never in Vite variables or source control.
