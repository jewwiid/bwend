# Bwend × Spotify — research notes

Compiled against the **live** Spotify for Developers docs on 2026-07-29:
<https://developer.spotify.com/documentation/web-api>

This is the gap analysis: what bwend is built on today, what the live API
actually exposes, and what's still on the table to turn the marketing into
the product.

---

## TL;DR

The bwend backend is **substantially complete** and the engineering around
the post-2024-11-27 Spotify deprecation is already mature — the codebase
header in `convex/lib/spotify.ts` and the new `TasteProfile` in
`convex/lib/vibeScore.ts` are themselves a writeup of the live API state.

What the landing page promises that the product doesn't yet deliver
(excluding chat, which is intentionally out of scope):

1. **No shared playback** — `/me/player/play` and `/me/player/queue` are
   live and documented; bwend has the scopes and the backend to ask for
   them but doesn't.
2. **No "now playing" on profile** — `/me/player/currently-playing` is
   one of the cheapest signals you can show on a blend, and would turn
   the `BlendPage` from a static receipt into a living thing.
3. **No discovery feed** — `/browse/featured-playlists` and
   `/browse/new-releases` are available with the existing token and would
   give the post-match "what now" a real surface.
4. **No search** — `/search` is the obvious way to invite someone by a
   track instead of a code.
5. **No active session awareness** — `/me/player` + `/me/player/devices`
   would let a match page know whether the user is even *in* Spotify.

**Deliberately out of scope:** chat / messaging. The landing page's
"Music-first chat" line and the iOS-style "React to their tracks first"
copy are aspirational features with no plan to ship them. They should
be cut from the marketing before launch — see §3.

The remaining "completion" work is mostly UX + a few extra tables, not
more Spotify plumbing.

---

## 1. What bwend already has, end-to-end

### Backend (`convex/`)

| File | Purpose | Spotify endpoints it touches |
| --- | --- | --- |
| `schema.ts` | 4 tables: `waitlist`, `bwendProfiles`, `invites`, `matches` | — |
| `spotifyConnect.ts` | HTTP entry to OAuth | — |
| `spotifyActions.ts` | `/api/auth/spotify` → token exchange + profile | `POST /api/token`, `GET /me`, `GET /me/top/tracks`, `GET /me/top/artists`, `GET /me/player/recently-played` |
| `blendActions.ts` | `/api/me/blend` → live profile + token refresh | `GET /me/top/{tracks,artists}`, `GET /me/player/recently-played`, `GET /me/{tracks,albums,playlists,following}?limit=1` |
| `invites.ts` | Create / fetch / claim invite by code | — |
| `claimActions.ts` | Score + write the match | — |
| `matches.ts` | List / fetch a single match | — |
| `lib/spotify.ts` | OAuth client + token storage + refresh | All of the above + `POST /api/token` (refresh grant) |
| `lib/vibeScore.ts` | 5-component score (track, artist, genre, popularity, era, discovery, clock) | Derived only from what the top-reads return |
| `lib/compatibilityReader.ts` | Rules-based 1–2 sentence compatibility blurb | — |

### Frontend (`src/`)

| File | Purpose |
| --- | --- |
| `App.tsx` + `main.tsx` | Vite + React Router + ConvexProvider |
| `BwendLandingPage.tsx` | Marketing site (single-file) |
| `components/AppShell.tsx` | Header, footer, spinner, error card, art fallback |
| `pages/CallbackPage.tsx` | PKCE callback → backend exchange → store session |
| `pages/BlendPage.tsx` | Signed-in user's own listening profile |
| `pages/InvitePage.tsx` | Recipient view of an invite code |
| `pages/MatchPage.tsx` | The reveal: score, anchor track, breakdown, share lists |
| `lib/spotifyAuth.ts` | PKCE primitives in the browser |
| `lib/api.ts` | Typed client for the Convex HTTP API |

### Scopes bwend requests

From `src/lib/spotifyAuth.ts`:

```
user-read-private
user-read-email
user-top-read
user-read-recently-played
user-library-read
playlist-read-private
user-follow-read
```

All seven are documented in the live Scopes page and are all read-only —
bwend never writes to a user's library, never modifies playlists, never
touches playback.

---

## 2. What the live API actually exposes (vs. the 2024 deprecation)

The codebase's own header comment in `convex/lib/spotify.ts` is the most
honest documentation of this. The live `get-audio-features` reference
now flags the endpoint as `"deprecated": true` in its OpenAPI schema.
Same for `get-several-audio-features`, `get-audio-analysis`, and
`get-recommendations`. `preview_url` is now `"deprecated": true` on every
track object.

The codebase's empirical observation still holds:

| Endpoint | Status on the live API | What bwend does |
| --- | --- | --- |
| `GET /me/top/tracks?time_range=` | Live, ranks preserved | Primary taste signal |
| `GET /me/top/artists?time_range=` | Live, ranks preserved | Primary taste signal |
| `GET /me/player/recently-played?limit=50` | Live, capped at 50 plays | Clock + discovery inputs |
| `GET /me/tracks?limit=1` | Live, returns `total` only | Library count |
| `GET /me/albums?limit=1` | Live, returns `total` only | Library count |
| `GET /me/playlists?limit=1` | Live, returns `total` only | Library count |
| `GET /me/following?type=artist&limit=1` | Live, returns `total` only | Library count |
| `GET /audio-features` | **Deprecated** (no replacement at the object level) | Not used — scorer is rank-weighted instead |
| `GET /audio-analysis` | **Deprecated** | Not used |
| `GET /recommendations` | **Deprecated** | Not used — anchor is picked from the two libraries |
| `GET /related-artists` | **Deprecated** | Not used |
| `track.popularity` | Field marked deprecated in schema; **omitted for new apps** | Scorer drops the component when null |
| `artist.genres` | Field NOT marked deprecated in schema; **empty array for new apps** | Scorer drops the component when null |
| `track.preview_url` | **Always null** as of Nov 2024 | Not relied on — we link to open.spotify.com |

The fallback architecture (rank-weighted overlap + era + discovery +
clock) is the correct response to the deprecation. There is no
"Spotify AI" replacement endpoint for new apps — the codebase is right
to not chase one.

### New things that *are* alive and bwend doesn't use

These are the live endpoints that don't require a new scope and would
unlock the features the marketing already implies:

| Endpoint | Scope needed (already in hand) | What it unlocks |
| --- | --- | --- |
| `GET /me/player` | none extra (user-modify-playback-state isn't required to *read* the player — but in practice most new apps need to be in **Extended Quota** mode to read the player) | "Last played 4 hours ago", device list, premium check |
| `GET /me/player/devices` | same | Show "Open Spotify" CTA per device on the blend page |
| `GET /me/player/currently-playing` | same | A live "now playing" strip on the blend; also the cheapest possible presence signal for a match |
| `PUT /me/player/play` (body: `uris`) | `user-modify-playback-state` (not currently requested) | "Play on Spotify" → actually starts playback on the anchor track |
| `POST /me/player/queue` | same | Add the anchor to queue without interrupting |
| `GET /search?q=...&type=track` | none extra (uses the implicit user-read-private grant) | Invite by track URL or by search; "send someone a track" link |
| `GET /playlists/{id}` | `playlist-read-private` (already granted) | Show a real playlist when the match reveals one |
| `GET /playlists/{id}/items` | same | A shared-blend playlist, not just a single anchor |
| `POST /users/{user_id}/playlists` | `playlist-modify-public` or `playlist-modify-private` (NOT granted) | Auto-create a "Your Blend" playlist in the user's account |
| `POST /playlists/{id}/items` | same | Populate that playlist with the shared tracks |
| `GET /browse/featured-playlists` | none | Discovery feed on the match page |
| `GET /browse/new-releases` | none | "What to listen next" rail |
| `GET /artists/{id}/albums` | none | Artist page on the blend |
| `GET /artists/{id}/top-tracks` | none | "More by this artist" on a track |
| `GET /me/playlists?limit=50` | `playlist-read-private` (granted) | Read the user's playlists, surface "Festival People" / "Soft life" mood data — which the marketing copy already references |
| `GET /me/tracks?limit=50` | `user-library-read` (granted) | Saved songs list — would be a great "On repeat" section |

**One important caveat:** the Player endpoints are gated behind
**Extended Quota Mode** for apps created after the deprecation wave.
bwend's app appears to be one of them (it can't get audio-features back
even with extended quota, per the codebase comments). The Player
endpoints may also be EQ-gated — need to confirm with a live `GET
/me/player` call against the deployed app before relying on any of
this in the UI.

### New scope worth adding

| Scope | Why |
| --- | --- |
| `user-modify-playback-state` | Required for `PUT /me/player/play` and `POST /me/player/queue`. Without it, the existing "Play on Spotify" button in `MatchPage.tsx` is just an `open.spotify.com` link — fine, but you can't add to queue or auto-resume on their active device. |
| `playlist-modify-public` or `playlist-modify-private` | Required to create a real "Your Blend" playlist in the user's account. Currently the marketing promises "a playlist that belongs to both of you" but the data is just a stored list, not a Spotify playlist. |

Neither scope is currently in `SPOTIFY_SCOPES` in `src/lib/spotifyAuth.ts`.

---

## 3. The marketing ↔ product gap

The landing page in `BwendLandingPage.tsx` (and the AGENTS.md section
list) promises:

| Promise in copy | Code path | Status |
| --- | --- | --- |
| Connect to Spotify | `pages/CallbackPage.tsx` + `POST /api/auth/spotify` | ✅ Live |
| "Your top tracks, moods, and late-night repeats" | `pages/BlendPage.tsx` renders `/me/top/tracks` + `/me/top/artists` | ✅ Top tracks & artists; "moods" is a static tag list in the marketing, not a feature |
| One blend a day, picked on purpose | `pickAnchorTrack` in `claimActions.ts` | ⚠️ Anchor is a single shared track, not a daily recommendation; "one per day" not enforced |
| Vibe Score | `score()` in `lib/vibeScore.ts` | ✅ Live, 5 components, breakdown visible on match page |
| Music-first chat | "React to their tracks first" copy in `HowItWorksSection` and `FeaturesSection` | ❌ **Out of scope by product decision.** Cut from marketing before launch — there's no plan to build it. |
| "A playlist that belongs to both of you" | `FeaturesSection` row 1 copy | ❌ **Not a real Spotify playlist.** The stored match has `sharedTopTrackNames` as a flat list, not a `/playlists/{id}/items` payload. |
| "Decibels, BPM, acoustic range" | `LabsSection` body copy | ❌ **Can't be delivered.** These are the deprecated audio features. The marketing has not been updated to reflect the new world. |
| "Date energy" (per AGENTS.md) | — | ❌ Not built. |
| Spotify Native | `AppShowcaseSection` feature | ✅ "We use the real `/me/top/*`, not a curated list" — true. |
| "Taste match" | `MatchPage.tsx` header label | ✅ Live |
| "The Daily Blend" | `ComparisonSection` card title | ⚠️ As above — single match per invite, not a daily feed |
| "Turn into moment" (per AGENTS.md) | — | ❌ Not built. |

### The "Decibels, BPM, acoustic range" line is a real liability

This is the single most inaccurate line on the landing page. It used to
be true (the old `AudioProfile` had it). The 2024-11-27 deprecation
removed it. The codebase correctly removed the feature but the
landing-page copy in `BwendLandingPage.tsx:498` was not updated:

```
Decibels, BPM, acoustic range: signals that point to someone on your
wavelength, whether that's lo-fi mornings or techno nights.
```

That line needs to either be removed or rewritten to describe what the
new TasteProfile actually measures (release year + spread + discovery
+ listening hours + rank-weighted overlap).

---

## 4. What "complete bwend" actually means

In priority order, sorted by what is cheapest and most user-visible:

### P0 — fix what's broken or lying

1. **Rewrite the "Decibels, BPM" paragraph** in `LabsSection` to match
   the real scorer. ~5 minutes. Touches one file.
2. **Refresh `README.md`** — it's wildly out of date. It still claims
   React 18, claims the only project structure is the marketing page,
   doesn't mention the `convex/` backend, the invite flow, the
   `/blend`/`/match`/`/m/:code` routes, the env vars the iOS app needs.
   This is the first thing an interested dev reads.
3. **Refresh `AGENTS.md` / `CLAUDE.md`** — the Key Sections list at
   the top still describes a v0 marketing-only product. The How It
   Works section still says "Connect → See → Share → Turn into moment"
   — none of those are wired except Connect. Update to match what's
   actually in the repo.

### P1 — finish the product the marketing already promises

4. **Auto-create a "Your Blend" playlist in the user's account** at
   claim time. Requires `playlist-modify-{public,private}` in
   `SPOTIFY_SCOPES` (one-line edit) and a new internal action in
   `convex/`. About 2 hours of work end-to-end. This single feature
   makes "a playlist that belongs to both of you" stop being a lie.
5. **"Now playing" strip on the blend page.** Adds
   `GET /me/player/currently-playing` to `blendActions.ts`, a new
   `nowPlaying` field on `BlendResponse`, and a 30-second poll on
   `BlendPage`. Requires confirming the endpoint is reachable under
   the current quota mode. About 4 hours including the quota check.
6. **Match list page** — `GET /api/matches` already exists; the
   web has no UI for it. A `MatchesListPage` at `/matches` that the
   match page can deep-link to.

### P2 — features the brand voice implies

**Messaging is out of scope** — no chat, no in-app reactions on tracks,
no per-message polling. Anything in the marketing that implies chat
needs to be cut before launch.

7. **Search-powered invite.** `/search?q=...&type=track` returns a
   track, the recipient connects and sees their score against the
   inviter's library. Requires a new internal action + an extension
   to `claimActions.ts` (anchor can come from the inviter's chosen
   track instead of being auto-picked).
8. **Real "Daily Blend"** — a per-user dispatch that runs once a day
   via Convex cron, pulls an active invite partner or picks the
   highest-vibe-score profile in the user's circle, and pushes a push
   notification through the iOS app. Requires push-notification
   credentials on the iOS side and a Convex cron in
   `convex/crons.ts` (which doesn't exist yet).
9. **Discovery rail on the match page.** `/browse/new-releases` and
    `/browse/featured-playlists` are cheap reads. A "while you two
    wait" section under the reveal with 4–6 new releases and 2–3
    featured playlists would give the reveal somewhere to go.

### P3 — quality of life

10. **Status-aware anchor** — if `GET /me/player` shows the user is
    currently playing, the reveal page could say "they're listening
    to X right now" instead of just "your anchor track is Y".
11. **Disconnect Spotify** — there's no way to revoke the app from the
    web. iOS has it. Convex already has a token blob; deleting the
    row is one mutation.
12. **Update the landing-page Stats section.** The
    `StatsSection` ("Soon / Open / You") is a placeholder for a
    product that hasn't launched. Either ship with real stats
    (current waitlist count, top city) or remove the section.
13. **Per-source cap on the waitlist** — if you ever gate invites by
    waitlist position, you'll need a per-source cap on the
    `joinWaitlist` mutation. (Cross-project pattern — see
    `agent_memory_summary`.)
14. **Cross-repo naming drift check.** Run
    `grep -rn "swipe\|swiping\|smoke-test" bwend-ios/` against the
    web copy. Whatever feature the iOS app renames, the landing page
    must follow.
15. **Cut the "Music-first chat" / "React to their tracks first" lines
    from the landing page.** Since chat is out of scope, the
    `FeaturesSection` "Music-first chat" card and the
    `HowItWorksSection` step 3 body need to be rewritten to describe
    what the product actually does (e.g. "Play the anchor on Spotify,
    see who you share with" instead of an in-app reaction loop).

---

## 5. Things to verify against the live API before building

These are not blockers but are cheap to check and would change the
plan if they come back wrong:

- `GET /v1/me/player` — does it 200 with the existing token? If it
  403s, the "now playing" / "active device" features die and you'll
  need to apply for Extended Quota.
- `GET /v1/search?q=foo&type=track` — is it reachable for this app?
  The schema still lists it but I've seen search return 403 for
  newer apps in the same way audio-features does.
- `POST /v1/users/{user_id}/playlists` — same question. The
  `/playlists` POST path was renamed from `/tracks` to `/items` in
  the live docs; make sure the existing library actually uses the
  new path.
- The new `user-personalized` scope. What does it gate? No app-level
  endpoints reference it yet. Worth watching for an actual
  personalization API.

---

## 6. Sources

- <https://developer.spotify.com/documentation/web-api> (reference index)
- <https://developer.spotify.com/documentation/web-api/reference/get-audio-features> (confirms deprecation)
- <https://developer.spotify.com/documentation/web-api/reference/get-recently-played> (response schema + 50-play cap)
- <https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks> (time_range + rank semantics)
- <https://developer.spotify.com/documentation/web-api/concepts/scopes> (full scope list, includes new `user-personalized`)
- <https://developer.spotify.com/policy> and `/terms` (the no-AI-training, no-commercial-streaming, attribution, and broadcast prohibitions — all live and all matter for what bwend is allowed to do with the data it pulls)

The codebase's own headers — `convex/lib/spotify.ts` and
`convex/lib/vibeScore.ts` — remain the most current empirical record of
what this specific app can reach. Treat the live docs as the spec and
those headers as the truth.
