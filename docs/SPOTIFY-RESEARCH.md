# Bwend × Spotify — research notes

Compiled against the **live** Spotify for Developers docs on 2026-07-29:
<https://developer.spotify.com/documentation/web-api>

This is the gap analysis: what bwend is built on today, what the live API
actually exposes, and what's still on the table to turn the marketing into
the product.

---

## TL;DR

The first native iPhone slice is now implemented end-to-end:

1. **Living Blend screen** — a cancellable 30-second Now Playing poll,
   playback/device awareness, and a safe fallback when Spotify quota
   denies player access.
2. **Track-led invites** — Spotify track search can create an invite whose
   selected track becomes the match anchor.
3. **A real private Spotify playlist** — either participant can explicitly
   save an idempotent, interleaved match playlist to their own account.
4. **Post-match discovery** — new releases and featured playlists appear
   as a lightweight "Listen next" rail.
5. **Daily Bwend notifications** — APNs registration, foreground and tap
   handling, match deep links, per-user local-time scheduling, invalid-token
   cleanup, and an hourly Convex cron are implemented last in the sequence.

The remaining launch work is operational: install the APNs key/team
credentials in Convex, reconnect existing Spotify users so they grant the
new read/player and private-playlist scopes, and verify the Spotify Player,
Search, Browse, and Playlist endpoints against the app's live quota mode.

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
| `schema.ts` | Profiles, invites, matches, saved playlists, and push-device records | — |
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
user-top-read
user-read-recently-played
user-library-read
playlist-read-private
user-follow-read
user-read-currently-playing
user-read-playback-state
playlist-modify-private
```

All except `playlist-modify-private` are read-only. That write scope is used only after
the user taps **Save to my Spotify**; Bwend does not modify playback.

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

These live endpoints now back the first iPhone slice:

| Endpoint | Scope needed | What it unlocks |
| --- | --- | --- |
| `GET /me/player` | `user-read-playback-state` | Active playback and device context |
| `GET /me/player/devices` | `user-read-playback-state` | Show an "Open Spotify" CTA for the active device |
| `GET /me/player/currently-playing` | `user-read-currently-playing` | A live Now Playing strip on the Blend screen |
| `PUT /me/player/play` (body: `uris`) | `user-modify-playback-state` (not currently requested) | "Play on Spotify" → actually starts playback on the anchor track |
| `POST /me/player/queue` | same | Add the anchor to queue without interrupting |
| `GET /search?q=...&type=track` | OAuth access token | Create a track-led invite |
| `GET /playlists/{id}` | `playlist-read-private` (already granted) | Show a real playlist when the match reveals one |
| `GET /playlists/{id}/items` | same | A shared-blend playlist, not just a single anchor |
| `POST /me/playlists` | `playlist-modify-private` | Create the user's private Bwend match playlist |
| `POST /playlists/{id}/items` | `playlist-modify-private` | Populate it with interleaved match tracks |
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

### Scope intentionally not added

| Scope | Why |
| --- | --- |
| `user-modify-playback-state` | Required for remote play/queue. The first native slice deliberately opens Spotify instead of controlling playback, keeping the permission surface smaller. |

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
| "A playlist that belongs to both of you" | `playlistActions.ts` + iOS reveal | ✅ Each participant can save a private, idempotent match playlist to their Spotify account. |
| "Decibels, BPM, acoustic range" | `LabsSection` body copy | ❌ **Can't be delivered.** These are the deprecated audio features. The marketing has not been updated to reflect the new world. |
| "Date energy" (per AGENTS.md) | — | ❌ Not built. |
| Spotify Native | `AppShowcaseSection` feature | ✅ "We use the real `/me/top/*`, not a curated list" — true. |
| "Taste match" | `MatchPage.tsx` header label | ✅ Live |
| "The Daily Blend" | `notificationActions.ts` + `crons.ts` | ✅ Daily local-time match reminder; broader daily matchmaking remains future work. |
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
2. ✅ **Refresh `README.md`** to document the web, Convex, and iPhone apps.
3. ✅ **Refresh `AGENTS.md` / `CLAUDE.md`** with the current private
   connection-companion product boundary.

### P1 — finish the product the marketing already promises

4. ✅ **User-triggered "Your Blend" playlist save.** Implemented as an
   idempotent per-user action rather than silently writing at claim time.
5. ✅ **"Now playing" strip on the native Blend screen.** Implemented with
   a 30-second cancellable poll and graceful quota fallback.
6. **Match list page** — `GET /api/matches` already exists; the
   web has no UI for it. A `MatchesListPage` at `/matches` that the
   match page can deep-link to.

### P2 — features the brand voice implies

**Messaging is out of scope** — no chat, no in-app reactions on tracks,
no per-message polling. Anything in the marketing that implies chat
needs to be cut before launch.

7. ✅ **Search-powered invite.** Implemented on iPhone; the selected track
   is persisted on the invite and becomes the claim anchor.
8. ✅ **Daily Bwend notification infrastructure.** Implemented with an
   hourly bounded Convex fanout, local-time deduplication, APNs token
   lifecycle, and reveal deep links. APNs production credentials are the
   remaining operational step.
9. ✅ **Discovery rail on the native match page.** Implemented with new
   releases and featured playlists; failure is intentionally non-blocking.

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
- `POST /v1/me/playlists` — confirm playlist creation is available to this
  app in live quota mode. The implementation uses the current endpoint and
  populates it through `POST /v1/playlists/{id}/items`.
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
