import SwiftUI

// MARK: - Typography
//
// Two fonts (DM Sans body, Fraunces italic for emphasis) matching the web app.
// We bundle the OTF files and register them at launch via BwendFont.register().

enum BwendFont {
    enum Sans {
        static let regular    = "DMSans-Regular"
        static let medium     = "DMSans-Medium"
        static let bold       = "DMSans-Bold"
    }
    enum Serif {
        static let italic     = "Fraunces-Italic"
    }

    /// Register the bundled OTF files with CoreText. Called from App.init().
    /// Safe to call multiple times; CTFontManagerRegisterFontsForURL is idempotent for dupes.
    static func register() {
        for name in [
            Sans.regular, Sans.medium, Sans.bold, Serif.italic
        ] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "otf") else { continue }
            // Cast NSURL → CFURL for the CoreText API.
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

extension Font {
    /// Body sans (DM Sans).
    static func bwend(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        // Fall back to system rounded if the bundle is missing the OTF (e.g. fresh checkout).
        let name: String
        switch weight {
        case .bold:      name = BwendFont.Sans.bold
        case .medium:    name = BwendFont.Sans.medium
        default:         name = BwendFont.Sans.regular
        }
        return Font.custom(name, size: size)
    }

    /// Fraunces italic — used for the single emphasis word inside hero headlines
    /// (e.g. "designed", "last", "scientists", "ever" on the web app).
    static func bwendSerifItalic(_ size: CGFloat) -> Font {
        Font.custom(BwendFont.Serif.italic, size: size)
    }
}
