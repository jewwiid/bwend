# Bwend repository rules

## Product boundary

Bwend is a private music-connection companion for two people who already met elsewhere or in
person. It is not a dating marketplace. Do not add a public directory, swipe feed, searchable
personal profiles, location, contacts import, dating-app imports, or sensitive-trait inference.

The shareable surface is a Taste Card. It may contain music taste, a generated private alias,
and an intentionally shared blend—not photos, biographies, demographic attributes, or dating
preferences.

## Stack

- Web: React 19, TypeScript, Vite, Tailwind CSS 4
- iPhone: SwiftUI on iOS 17+
- Backend: Convex
- Production web: Vercel

## Design

Use the CSS tokens in `src/index.css` as the source of truth. Preserve the warm editorial
visual language, DM Sans body type, Fraunces display type, rounded surfaces, light/dark modes,
and restrained motion. Keep web and SwiftUI product language aligned.

## Privacy requirements

- Never persist raw Spotify account IDs or display names.
- Never expose or log OAuth tokens, session secrets, APNs keys, or encryption keys.
- Keep Spotify tokens encrypted at rest.
- Preserve explicit consent, export, disconnect, deletion, and retention behavior.
- Do not claim pseudonymous data is anonymous.
- Keep the public notice and `docs/PRIVACY-ARCHITECTURE.md` consistent with implementation.

## Verification

Run web lint/build, TypeScript, a one-shot Convex deploy, the privacy self-check, and a
signing-free iOS simulator build before release changes are considered complete.
