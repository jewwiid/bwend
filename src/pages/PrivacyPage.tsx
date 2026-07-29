import { Link } from 'react-router-dom';
import { AppShell, SectionLabel } from '../components/AppShell';

const sections = [
  {
    title: 'What Bwend is',
    body: [
      'Bwend is a private music-connection companion for two people who have already met elsewhere or in person. It does not provide a public directory, swipe feed, dating profile, or candidate search.',
      'A shared Taste Card is not a personal profile. Bwend does not ask for a photo, biography, date of birth, location, contacts, gender, sexuality, dating preferences, relationship intent, or data from Hinge, Tinder, or another dating service.',
    ],
  },
  {
    title: 'Data we use',
    body: [
      'When you connect Spotify, Bwend stores a pseudonymous Bwend identifier, an encrypted Spotify connection, your top music and a derived taste fingerprint, the blends you intentionally create or join, and playlist-save records. If you separately opt into a Listening Portrait, Bwend also stores your questionnaire answers, the generated portrait, and its AI consent record.',
      'Spotify display names are not stored. OAuth credentials are encrypted at rest and are never included in an account export. Pseudonymous records are still treated as personal data.',
    ],
  },
  {
    title: 'Why we use it',
    body: [
      'Listening data is used only to build your private Taste Card, calculate a blend you intentionally send or claim, create a Spotify playlist after you ask us to, and show your own Spotify playback context.',
      'Bwend does not use music to infer health, ethnicity, religion, politics, sexuality, or other sensitive traits. Bwend does not sell your listening data.',
    ],
  },
  {
    title: 'Optional AI Listening Portrait',
    body: [
      'A Listening Portrait is generated only after separate, affirmative consent. Bwend sends OpenAI only the questionnaire choices and optional words you provide for this feature. Spotify tracks, artists, listening history, audio data, and lyrics are never sent to OpenAI.',
      'The portrait reflects how you say you use music; it is not a personality assessment, sensitive-trait inference, compatibility prediction, or dating profile. Bwend requests that OpenAI not store the response, while OpenAI may retain API abuse-monitoring logs for up to 30 days under its standard API data controls.',
    ],
  },
  {
    title: 'Sharing and retention',
    body: [
      'Your Taste Card or blend is shared only through a private link you choose to send. A Listening Portrait remains visible only to you. Unclaimed invite links expire after seven days.',
      'You can delete a Listening Portrait and its questionnaire answers immediately without deleting your account. Disconnecting Spotify immediately removes the stored Spotify credential. The disconnected Taste Card and related data are deleted after a 30-day recovery window. Choosing Delete account removes Bwend data immediately. A playlist already saved to Spotify remains there until you delete it in Spotify.',
    ],
  },
  {
    title: 'Your controls',
    body: [
      'From Privacy & data in the web app, or Account & Privacy on iPhone, you can export a portable copy of your Bwend data, disconnect Spotify, or delete your account. The Listening Portrait screen also lets you change your answers, regenerate, or immediately delete the portrait. You can revoke Bwend from your Spotify account settings.',
      'Bwend is in pre-release. Controller identity, a dedicated privacy contact, subprocessors, international-transfer details, and jurisdiction-specific rights information must be published before public launch. Until then, do not treat this notice as a substitute for the final reviewed legal notice.',
    ],
  },
];

export function PrivacyPage() {
  return (
    <AppShell>
      <article className="mx-auto max-w-2xl">
        <SectionLabel>Privacy</SectionLabel>
        <h1 className="mt-4 font-serif text-4xl italic tracking-tight sm:text-5xl">
          Private by design.
        </h1>
        <p className="mt-5 text-ds-lg leading-relaxed text-[var(--color-text-secondary)]">
          This product notice explains Bwend&apos;s current pre-release data design. Version
          2026-07-29.
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-ds-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-ds-base leading-relaxed text-[var(--color-text-secondary)]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          <p className="text-ds-sm leading-relaxed text-[var(--color-text-secondary)]">
            Already connected? Your export, disconnect, and deletion controls are in{' '}
            <Link to="/blend" className="font-semibold text-[var(--color-accent-cta)] hover:underline">
              Your blend
            </Link>
            . You can also read the current <Link to="/terms" className="font-semibold text-[var(--color-accent-cta)] hover:underline">
              Beta Terms
            </Link>.
          </p>
        </div>
      </article>
    </AppShell>
  );
}
