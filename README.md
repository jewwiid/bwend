# Bwend

Bwend is a private music-connection companion for two people who have already met elsewhere
or in person. A user connects Spotify, creates a seven-day invite, and shares it directly with
one other person. Bwend reveals ranked music overlap and can save a private Spotify playlist
after an explicit action. A user may also attach a Spotify Blend invite to their private Taste
Card so the same Bwend link offers an intentional handoff to Spotify.
After joining in Spotify, the user may separately choose the created playlist from their own
library so Bwend can read it live where Spotify permits. In-person invites can be shown as a
locally generated QR code; playlist creation still requires an explicit post-reveal action.

It is intentionally not a dating marketplace: there is no public directory, swipe feed,
personal biography, location, contacts import, or sensitive-trait inference.

## Apps and services

- Web: React 19, TypeScript, Vite, Tailwind CSS 4
- iPhone: SwiftUI, iOS 17+, Spotify PKCE, Universal Links
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
- `OPENAI_API_KEY` (server-only; optional Listening Portrait generation)
- `OPENAI_MODEL` (optional; defaults to `gpt-5.6-luna`)

Push notifications are feature-gated out of the current beta binary. When re-enabled later,
APNs delivery additionally needs `APNS_KEY_ID`, `APNS_TEAM_ID`, and `APNS_PRIVATE_KEY`;
`APNS_BUNDLE_ID` defaults to `com.bwend.app`.

## Verification

```bash
npm run lint
npm run build
npm test
npm run release:audit
npx tsc --noEmit
npx convex dev --once
npx convex run privacyActions:selfCheck '{}'
npx convex run listeningPortrait:selfCheck '{}'

cd bwend-ios
xcodegen generate
xcodebuild -project Bwend.xcodeproj -scheme Bwend \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO test
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
seven days; disconnected accounts are deleted after 30 days. The optional private Listening
Portrait uses only separately consented questionnaire answers—never Spotify content or lyrics—
and can be regenerated or deleted independently. Optional Spotify Blend URLs are validated but
never fetched; removing one clears it from existing invite snapshots. A selected created-Blend
playlist id is stored only after the user chooses it from their own Spotify library.
The email-only launch-interest list is separated from Spotify accounts, requires explicit
consent, expires after two years, and supports token-based immediate deletion. See
[`docs/PRIVACY-ARCHITECTURE.md`](docs/PRIVACY-ARCHITECTURE.md).

## Deployment

```bash
npm run deploy:convex:prod
npm run deploy:vercel
```

Production uses `.env.production` for the public Convex URLs. Secret backend variables belong
in the production Convex deployment, never in Vite variables or source control. Development
and production Convex deployments require their own `OPENAI_API_KEY` values.

Release owners should use [`docs/BETA-OPERATIONS.md`](docs/BETA-OPERATIONS.md) for the
five-person Spotify test protocol and [`docs/APP-STORE-REVIEW.md`](docs/APP-STORE-REVIEW.md)
for submission notes, privacy labels, screenshots and remaining external blockers. The
[`docs/IN-PERSON-TEST-PLAYBOOK.md`](docs/IN-PERSON-TEST-PLAYBOOK.md) covers face-to-face
testing, QR handoffs, content consent, and the public-interest fallback. Run the complete local
release gate with:

```bash
npm run release:check
```
