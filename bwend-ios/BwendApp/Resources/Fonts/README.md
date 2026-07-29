# Fonts

Bwend bundles two OFL-licensed fonts from Google Fonts:

- **DM Sans** (body / UI) — `DMSans-Regular.otf`, `DMSans-Medium.otf`, `DMSans-Bold.otf`
- **Fraunces** (display italic for emphasis words) — `Fraunces-Italic.otf`

## How to add them

1. Download from Google Fonts:
   - DM Sans: <https://fonts.google.com/specimen/DM+Sans>
   - Fraunces: <https://fonts.google.com/specimen/Fraunces>
2. Drop the four `.otf` files into this directory.
3. That's it — `BwendFont.register()` (called from `BwendApp.init()`) picks them up at launch
   by name. The names must match exactly (see `Typography.swift`).

## Why these fonts?

They match the web landing page exactly (`src/index.css`):

```css
--font-sans: 'DM Sans', -apple-system, ...;
--font-serif: 'Fraunces', Georgia, ...;
```

If you change fonts here, also change them on the web — and vice versa.

## Licensing

Both fonts are SIL Open Font License 1.1 — safe to bundle and ship in a closed-source app.
Keep the `LICENSE.txt` files alongside the `.otf` files for compliance (Google ships them in
the same download zip).
