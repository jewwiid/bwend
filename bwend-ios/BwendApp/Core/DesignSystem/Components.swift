import SwiftUI

// MARK: - Primary button (rose)
//
// Mirrors the .accent-cta pill from the web. Filled when enabled, muted when disabled.

struct PrimaryButton: View {
    let title: String
    var loadingTitle: String? = nil
    let isLoading: Bool
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    init(_ title: String, loading: Bool = false, loadingTitle: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.loadingTitle = loadingTitle
        self.isLoading = loading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                        .controlSize(.small)
                }
                Text(isLoading ? (loadingTitle ?? title) : title)
                    .font(.bwend(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .tracking(0.3)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                Capsule()
                    .fill(isEnabled ? Color.Accent.cta : Color.bwendTextDisabled)
            )
            .contentShape(Capsule())
            .animation(.bwendQuick, value: isLoading)
            .animation(.bwendQuick, value: isEnabled)
        }
        .disabled(isLoading || !isEnabled)
        .accessibilityIdentifier("primaryButton")
    }
}

// MARK: - Section label
//
// The uppercase tracked small caps used throughout the app.

struct SectionLabel: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .font(.bwend(size: 11, weight: .medium))
            .foregroundColor(Color.bwendTextMuted)
            .tracking(3.0)
    }
}

// MARK: - Orb background
//
// Static blurred gradient orbs — matches the two glow orbs around the phone mockup on the web.

struct OrbBackground: View {
    @State private var animate = false

    var body: some View {
        ZStack {
            // Top-right warm-yellow glow.
            Circle()
                .fill(Color.Accent.warmYellow.opacity(0.20))
                .frame(width: 280, height: 280)
                .blur(radius: 80)
                .offset(x: 140, y: -260)
                .offset(y: animate ? -10 : 10)

            // Bottom-left lavender glow.
            Circle()
                .fill(Color.Accent.lavender.opacity(0.20))
                .frame(width: 300, height: 300)
                .blur(radius: 90)
                .offset(x: -150, y: 320)
                .offset(y: animate ? 10 : -10)
        }
        .ignoresSafeArea()
        .onAppear {
            withAnimation(.easeInOut(duration: 6).repeatForever(autoreverses: true)) {
                animate = true
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Preview

#Preview("Components") {
    ScrollView {
        VStack(spacing: 24) {
            SectionLabel("The Ritual")
            PrimaryButton("Sign up") {}
            PrimaryButton("Joining…", loading: true) {}
        }
        .padding()
    }
    .background(Color.bwendBackground)
}
