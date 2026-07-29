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

## Data separation

- Spotify's raw account id is converted to `bw_<HMAC-SHA256>` before persistence.
- Spotify's display name is not persisted. The product uses a generated `Listener XXXX` alias.
- Spotify OAuth tokens are encrypted using AES-256-GCM with a unique random 96-bit nonce.
- Session JWTs contain only the pseudonymous Bwend identifier, issuer, and timestamps.
- The iPhone session JWT is stored in Keychain using
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- OAuth and APNs credentials are excluded from account exports.

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

## Consent and user controls

Spotify connection requires an affirmative acceptance of the current privacy-notice version.
The version and timestamp are stored with the Taste Card.

Authenticated controls:

- `GET /api/account/export` — portable JSON without credentials;
- `POST /api/account/disconnect` — immediately deletes the Spotify token and disables push;
- `POST /api/account/delete` — immediately deletes the Bwend profile, links, matches,
  playlist records, and push registrations.

Account deletion also removes shared reveal records for the other participant. Spotify
playlists already created in a user's Spotify account remain there until the user deletes
them in Spotify.

## Retention

- Pending invite: seven days, then daily cleanup deletes it.
- Spotify credential: deleted immediately on disconnect.
- Disconnected Taste Card and related data: 30-day recovery window, then daily deletion.
- Explicit account deletion: immediate.
- Invalid APNs token: disabled when APNs reports it unregistered.

Privacy operations are bounded to protect backend resource limits. An account above the
automatic bound fails closed for manual handling rather than being partially erased.

## Required server configuration

Development and production deployments need independent secrets:

- `BWEND_ID_SECRET` — high-entropy HMAC secret used for Bwend identifiers.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY` — 32 random bytes encoded as base64url.
- `BWEND_SESSION_SECRET` — existing session-signing secret.

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
