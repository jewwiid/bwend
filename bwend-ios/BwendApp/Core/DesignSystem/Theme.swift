import SwiftUI
import UIKit

// MARK: - Color tokens
//
// Sourced verbatim from src/index.css (the web app's authoritative design tokens).
// Do NOT regenerate from AGENTS.md / CLAUDE.md — those docs are stale and the hex values
// they list do not match the actual CSS. Update this file only when index.css changes.
//
// Adaptive colors: every semantic token below is a `Color` that resolves to one hex in
// light mode and another in dark mode, exactly like `Color(.label)`. Use `Color.bwend*`
// in views — never `Color.Light.*` or `Color.Dark.*` directly (those only hold the raw hexes).

extension Color {
    /// Light mode surface + text tokens. Raw hexes only — do not reference from views.
    enum Light {
        static let bgPrimary      = Color(hex: 0xFDFBF7)
        static let bgSecondary    = Color(hex: 0xF5F0E8)
        static let bgCard         = Color(hex: 0xFFFFFF)
        static let bgElevated     = Color(hex: 0xFFFFFF)
        static let bgMuted        = Color(hex: 0xEFE9DF)
        static let textPrimary    = Color(hex: 0x14120F)
        static let textSecondary  = Color(hex: 0x4A4540)
        static let textMuted      = Color(hex: 0x8A847A)
        static let textDisabled   = Color(hex: 0xB5AEA3)
        static let border         = Color(hex: 0xE4DDD4)
        static let borderSubtle   = Color(hex: 0xEFE8DF)
        static let ink            = Color(hex: 0x14120F)
    }

    /// Dark mode surface + text tokens. Raw hexes only — do not reference from views.
    enum Dark {
        static let bgPrimary      = Color(hex: 0x121118)
        static let bgSecondary    = Color(hex: 0x1A1822)
        static let bgCard         = Color(hex: 0x22202C)
        static let bgElevated     = Color(hex: 0x2A2735)
        static let bgMuted        = Color(hex: 0x18161E)
        static let textPrimary    = Color(hex: 0xF5F3EF)
        static let textSecondary  = Color(hex: 0xB8B3A8)
        static let textMuted      = Color(hex: 0x7F7A72)
        static let textDisabled   = Color(hex: 0x5C5852)
        static let border         = Color.white.opacity(0.10)
        static let borderSubtle   = Color.white.opacity(0.06)
        static let ink            = Color(hex: 0xF5F3EF)
    }

    /// Mood-based accent palette. These are the canonical light-mode hexes; in dark mode the
    /// rose and lavender are slightly warmed. All accent tokens auto-adapt.
    enum Accent {
        static let cta          = Color.adaptive(light: Color(hex: 0xE8919A), dark: Color(hex: 0xE07A86))
        static let peach        = Color(hex: 0xEAB4A8)
        static let coral        = Color(hex: 0xD88A82)
        static let lavender     = Color.adaptive(light: Color(hex: 0xC2B8D1), dark: Color(hex: 0xA898C4))
        static let warmYellow   = Color(hex: 0xECD08A)
        static let blush        = Color(hex: 0xE2B7B7)
    }

    /// Brand colors. Stable across modes.
    static let spotify    = Color(hex: 0x1DB954)
    static let focusRing  = Color(hex: 0xEAB4A8)

    // MARK: Semantic adaptive tokens (USE THESE IN VIEWS)

    /// App background. `--color-bg-primary`.
    static let bwendBackground   = Color.adaptive(light: Light.bgPrimary,   dark: Dark.bgPrimary)

    /// Secondary surface. `--color-bg-secondary`.
    static let bwendBgSecondary  = Color.adaptive(light: Light.bgSecondary, dark: Dark.bgSecondary)

    /// Card surface. `--color-bg-card`.
    static let bwendBgCard       = Color.adaptive(light: Light.bgCard,      dark: Dark.bgCard)

    /// Elevated surface (sheets, popovers). `--color-bg-elevated`.
    static let bwendBgElevated   = Color.adaptive(light: Light.bgElevated,  dark: Dark.bgElevated)

    /// Muted surface (chips, code blocks). `--color-bg-muted`.
    static let bwendBgMuted      = Color.adaptive(light: Light.bgMuted,     dark: Dark.bgMuted)

    /// Primary text. `--color-text-primary`.
    static let bwendText         = Color.adaptive(light: Light.textPrimary, dark: Dark.textPrimary)

    /// Secondary text. `--color-text-secondary`.
    static let bwendTextSecondary = Color.adaptive(light: Light.textSecondary, dark: Dark.textSecondary)

    /// Muted text. `--color-text-muted`.
    static let bwendTextMuted    = Color.adaptive(light: Light.textMuted,   dark: Dark.textMuted)

    /// Disabled text. `--color-text-disabled`.
    static let bwendTextDisabled = Color.adaptive(light: Light.textDisabled, dark: Dark.textDisabled)

    /// Border. `--color-border`.
    static let bwendBorder       = Color.adaptive(light: Light.border,      dark: Dark.border)

    /// Subtle border. `--color-border-subtle`.
    static let bwendBorderSubtle = Color.adaptive(light: Light.borderSubtle, dark: Dark.borderSubtle)

    /// Ink (dark surface for hero panels). `--color-ink`.
    static let bwendInk          = Color.adaptive(light: Light.ink,         dark: Dark.ink)

    /// Convenience: resolve a mood slug to its accent color (matches the web app's mapping).
    static func mood(_ slug: String) -> Color {
        switch slug {
        case "late-night-drives", "soft-life-playlists":   return Accent.peach
        case "sunday-reset", "whatever-shuffle-brings":    return Accent.lavender
        case "gym-energy", "sad-songs-honest-talks":       return Accent.coral
        case "wine-and-slow-songs":                        return Accent.warmYellow
        case "festival-people":                            return Accent.blush
        default:                                           return Accent.cta
        }
    }
}

extension Color {
    /// Initialize from a 0xRRGGBB integer. Avoids the verbosity of the webColor: parser
    /// and keeps the hex values inline with src/index.css.
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8)  & 0xFF) / 255.0
        let b = Double( hex        & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }

    /// Build a Color that resolves to `light` in light mode and `dark` in dark mode.
    /// Uses UIColor's dynamic provider so it adapts at draw time — no `@Environment(\.colorScheme)`
    /// threading required.
    static func adaptive(light: Color, dark: Color) -> Color {
        Color(uiColor: UIColor { trait in
            // SwiftUI Color → UIColor via UIColor(_:) is available on iOS 14+.
            trait.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

// MARK: - Radii
//
// Sourced from --radius-ds-* tokens. The web uses larger inline radii (40–56px) for marketing
// cards; we use the design-system scale for in-app chrome.

enum BwendRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let card: CGFloat = 20
    static let pill: CGFloat = .infinity
}

// MARK: - Motion
//
// Mirrors --ease-in-out-smooth: cubic-bezier(0.16, 1, 0.3, 1).

extension Animation {
    /// The signature Bwend ease. Spring-based because SwiftUI springs read better than
    /// cubic-bezier curves on iOS, but tuned to feel like the web's --ease-in-out-smooth.
    static let bwendSmooth = Animation.spring(response: 0.5, dampingFraction: 0.85)

    /// Quick tap feedback.
    static let bwendQuick = Animation.spring(response: 0.25, dampingFraction: 0.8)

    /// Slow hero entrance — used for the score-ring count-up.
    static let bwendHero = Animation.spring(response: 0.9, dampingFraction: 0.78)
}
