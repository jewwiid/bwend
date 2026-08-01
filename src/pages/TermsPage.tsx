import { Link } from 'react-router-dom';
import { AppShell, SectionLabel } from '../components/AppShell';

const sections = [
  {
    title: 'The beta service',
    body: [
      'Bwend is a pre-release music-connection companion. It lets two people who already met elsewhere create and claim a private invitation, compare selected Spotify listening signals, and optionally save a private Spotify playlist.',
      'Bwend is not a dating service, people directory, background-check service, or source of professional, psychological, or relationship advice.',
    ],
  },
  {
    title: 'Eligibility and accounts',
    body: [
      'You must be legally able to accept these terms and eligible to use Spotify in your jurisdiction. Your Spotify connection acts as your Bwend sign-in. Keep access to your device and Bwend session secure and do not impersonate another person.',
      'Beta capacity may be limited. Access can be suspended when necessary to protect users, investigate misuse, comply with law, or keep the service reliable.',
    ],
  },
  {
    title: 'Invites and respectful use',
    body: [
      'Send an invite only to someone you reasonably expect to receive it. Each invite is private, works once, and expires after seven days if unused. You can cancel a pending invite at any time. If you attach a Spotify Blend invite, the recipient may open it from the Bwend link before connecting to Bwend.',
      'An invite QR code contains the same private Bwend URL, not extra profile data. Playlist creation still requires an explicit action after a Bwend reveal; scanning does not silently create or modify a Spotify playlist.',
      'Do not use Bwend to harass, threaten, stalk, discriminate, scrape data, probe another person’s account, bypass access controls, distribute malware, or use the service unlawfully. A vibe score describes music overlap only and must not be presented as a judgment about a person.',
    ],
  },
  {
    title: 'Your content and data',
    body: [
      'You keep ownership of words you submit to the optional Listening Portrait. You give Bwend only the limited permission needed to process, store, display, export, and delete that content as part of the feature you requested.',
      'How Bwend handles Spotify data, invites, AI questionnaire answers, retention, export, and deletion is described in the Privacy Notice.',
    ],
  },
  {
    title: 'Spotify, OpenAI, and Apple',
    body: [
      'Spotify, OpenAI, Apple, and other third-party services are governed by their own terms and availability. Bwend is not endorsed by those providers and cannot guarantee that an external API, Spotify Blend invite, playlist-reading permission, or platform feature will remain available. Joining a Spotify Blend may reveal your Spotify username and profile picture to its members and allow members to invite others.',
      'Bwend sends OpenAI only optional Listening Portrait questionnaire answers after separate consent. Spotify listening history, tracks, artists, and lyrics are not sent to OpenAI.',
    ],
  },
  {
    title: 'Beta availability',
    body: [
      'The beta may contain errors, change without notice, or be unavailable. Features and stored beta data may be modified or removed as the service develops. Do not rely on Bwend as the only copy of anything important.',
      'To the maximum extent permitted by law, the beta is provided as available without promises that every result will be accurate, uninterrupted, or suitable for a particular relationship or decision. Nothing here excludes rights or liability that cannot legally be excluded.',
    ],
  },
  {
    title: 'Leaving Bwend',
    body: [
      'You can disconnect Spotify, export your data, or delete your Bwend account from the app. Account deletion removes Bwend records as described in the Privacy Notice; playlists already saved to Spotify remain in Spotify until you remove them there.',
      'Bwend may end this beta or your access for serious misuse. Provisions that naturally continue—such as ownership, lawful limitations, and records of prior acceptance—continue after access ends.',
    ],
  },
];

export function TermsPage() {
  return (
    <AppShell>
      <article className="mx-auto max-w-2xl">
        <SectionLabel>Beta Terms</SectionLabel>
        <h1 className="mt-4 font-serif text-4xl italic tracking-tight sm:text-5xl">
          Clear rules for a small beta.
        </h1>
        <p className="mt-5 text-ds-lg leading-relaxed text-[var(--color-text-secondary)]">
          Version 2026-08-01.beta-v2. By connecting Spotify or using the beta, you accept
          these terms.
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-ds-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-ds-base leading-relaxed text-[var(--color-text-secondary)]">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          <p className="text-ds-sm leading-relaxed text-[var(--color-text-secondary)]">
            These are pre-release beta terms. The final public version must identify the
            contracting legal entity, contact channel, governing law, and jurisdiction after
            professional legal review. Read the current{' '}
            <Link to="/privacy" className="font-semibold text-[var(--color-accent-cta)] hover:underline">
              Privacy Notice
            </Link>
            .
          </p>
        </div>
      </article>
    </AppShell>
  );
}
