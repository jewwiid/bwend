# Bwend App Store review packet

This is the submission source of truth for the first iPhone release. Never commit reviewer
credentials, App Store Connect API keys, signing material, or Spotify secrets here.

## App Review notes — copy into App Store Connect

> Bwend is an iPhone-only music-connection companion for two people who have already met.
> Spotify authorization is core functionality: it lets the user build a private Taste Card
> from their own top music and claim or send a single-use link. It is not a generic social
> login and a non-Spotify account could not use the product's core features.
>
> Review flow:
> 1. Tap “Connect Spotify to start”.
> 2. Accept the Beta Terms and Privacy Notice.
> 3. Sign in with the dedicated Spotify review account supplied in App Review Information.
> 4. Open “Your blend” to see its Taste Card.
> 5. Optionally paste the Spotify Blend test invitation supplied in App Review Information.
> 6. Tap “Start a blend” to create a seven-day, single-use Bwend invite. The same Bwend link
>    includes an “Open in Spotify” handoff when the optional Spotify Blend URL was saved.
> 7. Show the locally generated QR to a second iPhone; scanning opens the same Universal Link.
> 8. After joining a Spotify Blend, optionally load the caller's own Spotify playlists and
>    explicitly select the created Blend. Spotify may expose metadata only or allow track reads.
> 9. Open “Privacy & data” to export, disconnect Spotify, or permanently delete the account.
>
> The app has no purchases, advertising, tracking, public people directory, messaging,
> location access, contacts access, or dating profiles. Notifications are disabled in this
> version. The optional AI Listening Portrait sends OpenAI only answers the user separately
> enters after explicit consent; it never sends Spotify tracks, artists, history, or lyrics.
> A user may optionally paste a Spotify Blend invite. Bwend validates and stores only that
> URL, never fetches its playlist or members, and opens it in the Spotify app from a private
> Bwend invite after showing Spotify's member-visibility disclosure.
> Separately, after joining, the user may choose a playlist from their own Spotify library.
> Bwend stores its playlist ID and reads it live only when requested; selected tracks are never
> sent to OpenAI. QR generation happens locally and sends the invite URL to no QR service.
>
> Universal Links for `https://www.bwend.xyz/m/*` open private invite previews. If testing a
> two-account match, use the second allowlisted Spotify account supplied below.

## Credentials to add in App Store Connect only

- Primary Spotify review account: `[EMAIL IN APP STORE CONNECT]`
- Password: `[PASSWORD IN APP STORE CONNECT]`
- Second allowlisted Spotify account: `[OPTIONAL SECOND EMAIL]`
- Spotify Blend invitation for optional handoff test: `[OPTIONAL SPOTIFY BLEND SHARE TEXT]`
- Any Spotify verification instructions: `[NOTES]`

Both accounts must be tested immediately before submission and must be on the Spotify
Development Mode allowlist until Spotify changes the app's quota mode.

## Required metadata and assets

- App name: `Bwend`
- Bundle identifier: `com.bwend.app`
- Primary category: Music
- Secondary category: Social Networking
- Privacy policy URL: `https://www.bwend.xyz/privacy`
- Support URL: blocked until a real support channel is published
- Terms URL: `https://www.bwend.xyz/terms`
- Copyright/legal seller: blocked until the contracting entity is confirmed
- Screenshots: 1–10 real screenshots at an accepted 6.9-inch iPhone size
- iPad screenshots: not required; the release target is iPhone-only
- Build toolchain: Xcode 26+ and the matching iOS 26+ SDK

Suggested screenshot flow:

1. Private music layer — welcome screen
2. Your Taste Card — top artists and tracks
3. One private link — invite creation/share
4. The overlap — vibe score and shared music
5. Your controls — export, disconnect, and deletion

Do not upload marketing mockups that imply messaging, dating discovery, notifications, or
other unavailable features.

## Privacy-label mapping

| App Store data category | Linked | Tracking | Purpose |
|---|---:|---:|---|
| User ID (pseudonymous Bwend ID) | Yes | No | App functionality |
| Product Interaction (Spotify listening/activity signals and explicitly selected playlist) | Yes | No | App functionality |
| Other User Content (optional Spotify Blend URL and portrait answers/result) | Yes | No | App functionality |

Runtime destinations to disclose and verify during the final network audit:

- Bwend API on Convex
- Spotify accounts and Web API
- Spotify-hosted artwork and open links
- OpenAI Responses API only after separate Listening Portrait consent
- MusicBrainz and ListenBrainz for server-side artist enrichment

## Blocking submission checks

- [ ] Replace every “beta” label and the pre-release Beta Terms with final public wording
      before App Store production review. The current wording is intentional for TestFlight
      only; App Review Guideline 2.2 does not allow beta or trial builds on the App Store.
- [ ] Contracting entity, seller name, support contact, privacy contact, governing law and
      jurisdiction are finalized and professionally reviewed.
- [ ] App Store Connect app record exists and agreements are active.
- [ ] Distribution certificate/profile and ASC API key are configured.
- [ ] Dedicated reviewer Spotify accounts are allowlisted and working.
- [ ] Signed archive uploads and processes successfully.
- [ ] Two-person flow passes on two physical iPhones.
- [ ] 6.9-inch screenshots show the actual submitted UI.
- [ ] App Store privacy labels match `PrivacyInfo.xcprivacy`, the public notice and observed
      network traffic.
- [ ] Account deletion is retested from `Privacy & data`.

Current Apple references:

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- https://developer.apple.com/support/offering-account-deletion-in-your-app
