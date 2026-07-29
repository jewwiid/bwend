import SwiftUI

struct ListeningPortraitView: View {
    @EnvironmentObject private var api: APIClient

    @State private var portrait: ListeningPortrait?
    @State private var musicRole: MusicRole?
    @State private var listeningMoment: ListeningMoment?
    @State private var discoveryStyle: DiscoveryStyle?
    @State private var ownWords = ""
    @State private var aiConsent = false
    @State private var editing = false
    @State private var loading = true
    @State private var working = false
    @State private var errorMessage: String?
    @State private var confirmDelete = false

    private var showForm: Bool { portrait == nil || editing }

    var body: some View {
        ZStack {
            OrbBackground().opacity(0.35)

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header

                    if loading {
                        ProgressView("Loading your portrait…")
                            .tint(Color.Accent.cta)
                    } else {
                        if let portrait, !editing {
                            portraitCard(portrait)
                        }
                        if showForm {
                            questionnaire
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.bwend(size: 12))
                            .foregroundColor(.red)
                            .accessibilityLabel("Error: \(errorMessage)")
                    }
                }
                .padding(24)
            }
        }
        .background(Color.bwendBackground.ignoresSafeArea())
        .navigationTitle("Listening Portrait")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .alert("Delete your Listening Portrait?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await deletePortrait() }
            }
        } message: {
            Text("This immediately removes the portrait and your questionnaire answers.")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionLabel("Private · AI")
                Spacer()
                Image(systemName: "lock.fill")
                    .font(.system(size: 12))
                    .foregroundColor(Color.bwendTextMuted)
            }
            Text("What does music do for you?")
                .font(.bwend(size: 28, weight: .bold))
                .foregroundColor(Color.bwendText)
            Text("A reflection based only on answers you choose—not your Spotify songs, artists, history, or lyrics.")
                .font(.bwend(size: 14))
                .foregroundColor(Color.bwendTextSecondary)
                .lineSpacing(4)
        }
    }

    private func portraitCard(_ portrait: ListeningPortrait) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            Text(portrait.title)
                .font(.bwendSerifItalic(30))
                .foregroundColor(Color.bwendText)

            Text(portrait.summary)
                .font(.bwend(size: 15))
                .foregroundColor(Color.bwendTextSecondary)
                .lineSpacing(5)

            VStack(spacing: 10) {
                ForEach(portrait.traits) { trait in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(trait.label)
                            .font(.bwend(size: 14, weight: .bold))
                            .foregroundColor(Color.bwendText)
                        Text(trait.explanation)
                            .font(.bwend(size: 12))
                            .foregroundColor(Color.bwendTextSecondary)
                            .lineSpacing(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Color.bwendBgMuted)
                    .cornerRadius(BwendRadius.md)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Questions worth asking")
                ForEach(portrait.conversationStarters, id: \.self) { starter in
                    HStack(alignment: .top, spacing: 10) {
                        Text("♪")
                            .foregroundColor(Color.Accent.coral)
                        Text(starter)
                            .font(.bwend(size: 13))
                            .foregroundColor(Color.bwendText)
                    }
                }
            }

            Text("This is not a personality assessment, dating profile, or analysis of your Spotify history.")
                .font(.bwend(size: 11))
                .foregroundColor(Color.bwendTextMuted)
                .lineSpacing(3)

            HStack(spacing: 18) {
                Button("Change my answers") {
                    editing = true
                }
                .font(.bwend(size: 13, weight: .bold))
                .foregroundColor(Color.Accent.cta)

                Button("Delete", role: .destructive) {
                    confirmDelete = true
                }
                .font(.bwend(size: 13, weight: .bold))
            }
        }
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.card)
    }

    private var questionnaire: some View {
        VStack(alignment: .leading, spacing: 24) {
            ChoiceGrid(
                title: "Music is mostly a way to…",
                options: MusicRole.allCases,
                selection: $musicRole,
                label: \.label
            )

            ChoiceGrid(
                title: "It matters most during…",
                options: ListeningMoment.allCases,
                selection: $listeningMoment,
                label: \.label
            )

            ChoiceGrid(
                title: "When finding something to play…",
                options: DiscoveryStyle.allCases,
                selection: $discoveryStyle,
                label: \.label
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("In your own words (optional)")
                    .font(.bwend(size: 14, weight: .bold))
                    .foregroundColor(Color.bwendText)
                TextEditor(text: $ownWords)
                    .font(.bwend(size: 14))
                    .foregroundColor(Color.bwendText)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 96)
                    .padding(8)
                    .background(Color.bwendBackground)
                    .cornerRadius(BwendRadius.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: BwendRadius.md)
                            .stroke(Color.bwendBorder, lineWidth: 1)
                    )
                    .onChange(of: ownWords) { _, value in
                        if value.count > 280 { ownWords = String(value.prefix(280)) }
                    }
                    .accessibilityLabel("Describe what music adds to your day")
                HStack(alignment: .top) {
                    Text("Do not include names, song titles, artist names, or lyrics.")
                    Spacer()
                    Text("\(ownWords.count)/280")
                }
                .font(.bwend(size: 10))
                .foregroundColor(Color.bwendTextMuted)
            }

            Toggle(isOn: $aiConsent) {
                Text("I agree that Bwend may send these answers to OpenAI to generate my private portrait. OpenAI may retain API abuse-monitoring logs for up to 30 days. I can edit, export, or delete the result.")
                    .font(.bwend(size: 11))
                    .foregroundColor(Color.bwendTextSecondary)
                    .lineSpacing(3)
            }
            .tint(Color.Accent.cta)

            PrimaryButton(
                portrait == nil ? "Create my portrait" : "Regenerate portrait",
                loading: working,
                loadingTitle: "Creating…"
            ) {
                Task { await generate() }
            }
            .disabled(
                musicRole == nil ||
                listeningMoment == nil ||
                discoveryStyle == nil ||
                !aiConsent
            )

            if portrait != nil {
                Button("Cancel") {
                    editing = false
                    errorMessage = nil
                }
                .font(.bwend(size: 13, weight: .medium))
                .foregroundColor(Color.bwendTextSecondary)
            }
        }
        .padding(20)
        .background(Color.bwendBgCard)
        .cornerRadius(BwendRadius.card)
    }

    @MainActor
    private func load() async {
        guard loading else { return }
        defer { loading = false }
        do {
            let saved = try await api.listeningPortrait()
            portrait = saved
            if let saved {
                musicRole = saved.answers.musicRole
                listeningMoment = saved.answers.listeningMoment
                discoveryStyle = saved.answers.discoveryStyle
                ownWords = saved.answers.ownWords
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func generate() async {
        guard
            let musicRole,
            let listeningMoment,
            let discoveryStyle,
            aiConsent
        else {
            errorMessage = "Choose one answer in each section and accept the AI notice."
            return
        }

        working = true
        errorMessage = nil
        defer { working = false }
        do {
            portrait = try await api.generateListeningPortrait(
                musicRole: musicRole,
                listeningMoment: listeningMoment,
                discoveryStyle: discoveryStyle,
                ownWords: ownWords.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            aiConsent = false
            editing = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func deletePortrait() async {
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            _ = try await api.deleteListeningPortrait()
            portrait = nil
            musicRole = nil
            listeningMoment = nil
            discoveryStyle = nil
            ownWords = ""
            aiConsent = false
            editing = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ChoiceGrid<Option: Identifiable & Hashable>: View {
    let title: String
    let options: [Option]
    @Binding var selection: Option?
    let label: KeyPath<Option, String>

    private let columns = [GridItem(.adaptive(minimum: 125), spacing: 8)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.bwend(size: 14, weight: .bold))
                .foregroundColor(Color.bwendText)

            LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                ForEach(options) { option in
                    let selected = selection == option
                    Button {
                        selection = option
                    } label: {
                        Text(option[keyPath: label])
                            .font(.bwend(size: 12, weight: selected ? .bold : .regular))
                            .foregroundColor(selected ? Color.bwendBackground : Color.bwendText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .padding(.horizontal, 10)
                            .background(
                                Capsule().fill(selected ? Color.bwendText : Color.bwendBackground)
                            )
                            .overlay(
                                Capsule().stroke(Color.bwendBorder, lineWidth: selected ? 0 : 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        ListeningPortraitView()
            .environmentObject(APIClient())
    }
}
