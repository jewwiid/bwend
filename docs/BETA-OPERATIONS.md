# Bwend private-beta operations

## Product capacity

Spotify Development Mode currently permits up to five allowlisted Spotify users. Treat five
users as a hard product capacity, not a soft launch target. A person may complete Spotify
login without being allowlisted but subsequent Web API calls will fail with 403.

As of 29 July 2026, Spotify's published Extended Quota criteria require an established
organization, an active launched service, commercial viability, availability in key markets,
and at least 250,000 monthly active users. Bwend should not plan a Spotify-powered wider beta
on the assumption that an early-stage quota exception will be granted.

Current choices for going beyond five testers:

1. Keep Bwend as a five-person Spotify research beta.
2. Wait until the service meets Spotify's partner criteria.
3. Design a separately approved non-Spotify onboarding path, such as intentional manual music
   selections. This is a product decision and must not be presented as Spotify-derived taste.

References:

- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/concepts/rate-limits
- https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates

## Before adding a tester

- [ ] The app owner's Spotify Premium subscription is active.
- [ ] The tester is added under Spotify Dashboard → Users Management.
- [ ] The tester has accepted the current Beta Terms and Privacy Notice.
- [ ] The tester understands links are single-use, expire after seven days and are intended
      for someone they already know.
- [ ] Capacity remains available within the five-user allowlist.
- [ ] A rollback owner and test window are agreed.

Never store tester passwords or Spotify tokens in this repository or a shared beta ledger.

## Two-person real-device acceptance test

Run on two physical iPhones and record only pass/fail plus app/build versions:

- [ ] Fresh install and Spotify authorization on both accounts
- [ ] Existing session survives relaunch
- [ ] Taste Card loads all three time ranges
- [ ] Sender pastes a complete Spotify Blend share message and Bwend extracts the valid link
- [ ] Sender creates and shares an invite
- [ ] Sender displays the invite QR; the second iPhone Camera opens the same Universal Link
- [ ] Universal Link opens the recipient app at the intended invite
- [ ] Signed-out recipient sees the optional Spotify handoff without seeing the Taste Card
- [ ] “Open in Spotify” opens the expected Blend in the Spotify mobile app
- [ ] After both people join the Spotify Blend, each can explicitly select it from their own
      library; Bwend reports whether Spotify permits track reads
- [ ] Recipient cannot claim their own link
- [ ] Recipient claims once; a second claim is rejected
- [ ] Both users open the same frozen reveal
- [ ] Each user can independently save a private Spotify playlist
- [ ] Pending invite can be cancelled and becomes unusable
- [ ] Removing the saved Spotify Blend link also removes it from existing pending invites
- [ ] Expired invite is shown as expired
- [ ] Data export opens as JSON
- [ ] Disconnect removes Spotify access
- [ ] Account deletion removes the account and shared reveal
- [ ] VoiceOver can reach primary controls and Dynamic Type remains usable
- [ ] Light and Dark Mode remain legible
- [ ] A non-allowlisted visitor can explicitly join and remove themselves from the launch list

## Monitoring and incident response

Health check:

```bash
curl --fail --silent --show-error \
  https://helpful-owl-232.eu-west-1.convex.site/api/health
```

Expected fields are `ok`, `service`, `privacyVersion`, and `termsVersion`.

Severity:

- **SEV-1:** token exposure, cross-user data exposure, deletion failure, or invite ownership
  bypass. Stop onboarding, preserve logs without secrets, revoke affected credentials and
  roll back immediately.
- **SEV-2:** Spotify connection, claim, playlist, or account controls unavailable for all
  testers. Pause testing and roll back the failing deployment.
- **SEV-3:** isolated presentation or optional-feature failure. Record reproduction details and
  fix in the next beta build.

Spotify errors:

- `spotify_beta_access_required`: verify the account is allowlisted.
- `spotify_quota_exceeded`: stop retry loops; the Development Mode quota is exhausted.
- `spotify_rate_limited`: respect Spotify's retry window and retry later.
- `reconnect_required`: ask only the affected user to authorize Spotify again.

Rollback:

1. Select the last known-good Vercel production deployment and promote it.
2. Use Convex deployment history to restore the last known-good backend.
3. Smoke-test health, Terms, Privacy, CORS, Spotify connect and one authenticated invite read.
4. Record the incident timeline without OAuth tokens, session JWTs, or personal listening data.

## Release commands

```bash
npm run release:check
npm run deploy:convex:prod
npm run deploy:vercel
```

The local release check runs web lint/build/tests, Convex typecheck/self-checks, privacy
manifest validation, iPhone simulator tests and a signing-free Release device build.

`npm audit` currently reports `GHSA-qwww-vcr4-c8h2` in React Router 7.18.2. The advisory is for
React Router's RSC/server-action mode; Bwend is a client-only Vite `BrowserRouter` app and has
no React Router server actions. There is no fixed stable npm release yet (the suggested forced
downgrade exposes older router advisories), so keep the latest 7.x release pinned, recheck this
before each release, and upgrade as soon as a fixed stable version is published.
