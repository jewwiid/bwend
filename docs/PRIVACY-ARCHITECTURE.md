# Bwend privacy architecture

Version: **2026-07-29**

Bwend is a private music-connection companion. It is designed for two people who already
met elsewhere or in person. It does not provide a public people directory, dating profile,
candidate search, or swipe feed.

## Product boundary

Users share a seven-day Bwend link or an in-person QR/AirDrop invitation. Both people connect
Spotify and intentionally enter the same private blend. Bwend does not import, scrape, or
store Hinge, Tinder, or other dating-service profiles.

The shareable surface is a **Taste Card**, not a personal profile. Bwend does not ask for or
store a photo, biography, date of birth, location, contacts, gender, sexuality, dating
preference, or relationship intent.

The optional **Listening Portrait** is private and separate from the Taste Card. It is a
reflection based only on a short first-party questionnaire. It is not included in invites,
matches, or other users' views.

## Data separation

- Spotify's raw account id is converted to `bw_<HMAC-SHA256>` before persistence.
- Spotify's display name is not persisted. The product uses a generated `Listener XXXX` alias.
- Spotify OAuth tokens are encrypted using AES-256-GCM with a unique random 96-bit nonce.
- Session JWTs contain only the pseudonymous Bwend identifier, issuer, and timestamps.
- The iPhone session JWT is stored in Keychain using
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- OAuth and APNs credentials are excluded from account exports.
- The Listening Portrait pipeline accepts only questionnaire fields. It has no code path to
  read a Spotify profile, tracks, artists, listening history, or lyrics.

Pseudonymised records are still treated as personal data. Bwend does not claim that an
account-linked Taste Card is anonymous.

## Purpose limitation

Listening data is used only to:

1. build the user's private Taste Card;
2. calculate a blend the user intentionally sends or claims;
3. create a Spotify playlist after an explicit save action;
4. show the user's own Spotify playback context; and
5. send a daily notification the user explicitly enables.

Bwend must not infer health, ethnicity, religion, politics, sexuality, or other sensitive
traits from music.

## Optional AI processing

The Listening Portrait requires separate affirmative consent version
`2026-07-29.ai-portrait.v1`. The user selects how music functions in their life, when they
listen, how they discover music, and may add up to 280 characters in their own words.

Convex sends only those answers to the OpenAI Responses API. Requests use structured output,
`store: false`, a privacy-preserving safety identifier, and the server-side
`OPENAI_API_KEY`. The prompt prohibits personality diagnosis, sensitive-trait inference,
compatibility prediction, and claims based on hidden data. Bwend does not send Spotify
content or lyrics to OpenAI.

The generated result and source answers remain private. Users can edit and regenerate them,
export them with the rest of their account, delete them independently, or erase them through
account deletion. OpenAI may retain abuse-monitoring logs for up to 30 days under standard
API data controls; Zero Data Retention requires separate OpenAI approval.

## Consent and user controls

Spotify connection requires an affirmative acceptance of the current privacy-notice version.
The version and timestamp are stored with the Taste Card.

Authenticated controls:

- `GET /api/account/export` — portable JSON without credentials;
- `POST /api/account/disconnect` — immediately deletes the Spotify token and disables push;
- `POST /api/account/delete` — immediately deletes the Bwend profile, links, matches,
  playlist records, and push registrations.
- `GET /api/me/listening-portrait` — returns only the caller's private portrait;
- `POST /api/me/listening-portrait` — generates or regenerates after separate AI consent;
- `DELETE /api/me/listening-portrait` — immediately deletes the portrait and source answers.

Account deletion also removes shared reveal records for the other participant. Spotify
playlists already created in a user's Spotify account remain there until the user deletes
them in Spotify.

## Retention

- Pending invite: seven days, then daily cleanup deletes it.
- Spotify credential: deleted immediately on disconnect.
- Disconnected Taste Card and related data: 30-day recovery window, then daily deletion.
- Explicit account deletion: immediate.
- Listening Portrait deletion: immediate.
- Invalid APNs token: disabled when APNs reports it unregistered.

Privacy operations are bounded to protect backend resource limits. An account above the
automatic bound fails closed for manual handling rather than being partially erased.

## Required server configuration

Development and production deployments need independent secrets:

- `BWEND_ID_SECRET` — high-entropy HMAC secret used for Bwend identifiers.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY` — 32 random bytes encoded as base64url.
- `BWEND_SESSION_SECRET` — existing session-signing secret.
- `OPENAI_API_KEY` — server-only key for optional portrait generation.
- `OPENAI_MODEL` — optional model override; defaults to `gpt-5.6-luna`.

Never rotate the identity secret without a planned identity migration. Token-encryption-key
rotation needs a decrypt-old/encrypt-new migration before the old key is removed.

## Launch checklist

- Review the notice and lawful basis with qualified counsel in each launch jurisdiction.
- Publish controller identity, contact details, subprocessors, transfers, retention, and
  data-subject-right instructions.
- Complete and record a DPIA screening for the music compatibility score.
- Test export, disconnect, deletion, legacy token migration, and scheduled cleanup in
  production-like data.
- Configure the production HMAC and encryption secrets separately from development.
- Configure the production OpenAI key separately and set spend/rate alerts.
