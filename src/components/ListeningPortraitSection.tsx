import { useEffect, useState } from 'react';
import {
  deleteListeningPortrait,
  generateListeningPortrait,
  getListeningPortrait,
  type DiscoveryStyle,
  type ListeningMoment,
  type ListeningPortrait,
  type ListeningPortraitAnswers,
  type MusicRole,
} from '../lib/api';
import { SectionLabel } from './AppShell';

type Option<T extends string> = { value: T; label: string };

const ROLE_OPTIONS: Option<MusicRole>[] = [
  { value: 'escape', label: 'Escape' },
  { value: 'connection', label: 'Connection' },
  { value: 'focus', label: 'Focus' },
  { value: 'energy', label: 'Energy' },
  { value: 'reflection', label: 'Reflection' },
];

const MOMENT_OPTIONS: Option<ListeningMoment>[] = [
  { value: 'morning', label: 'Slow mornings' },
  { value: 'movement', label: 'On the move' },
  { value: 'work', label: 'Work or study' },
  { value: 'late-night', label: 'Late nights' },
  { value: 'social', label: 'With people' },
];

const DISCOVERY_OPTIONS: Option<DiscoveryStyle>[] = [
  { value: 'comfort', label: 'Familiar favourites' },
  { value: 'balanced', label: 'A bit of both' },
  { value: 'explorer', label: 'Always exploring' },
];

const EMPTY_ANSWERS: Partial<ListeningPortraitAnswers> = { ownWords: '' };

export function ListeningPortraitSection() {
  const [portrait, setPortrait] = useState<ListeningPortrait | null>(null);
  const [answers, setAnswers] =
    useState<Partial<ListeningPortraitAnswers>>(EMPTY_ANSWERS);
  const [editing, setEditing] = useState(false);
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getListeningPortrait()
      .then((saved) => {
        if (!active) return;
        setPortrait(saved);
        if (saved) setAnswers(saved.answers);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load your portrait.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const showForm = !portrait || editing;

  async function onGenerate() {
    if (!answers.musicRole || !answers.listeningMoment || !answers.discoveryStyle) {
      setError('Choose one answer in each section.');
      return;
    }
    if (!consented) {
      setError('Accept the AI notice before generating.');
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const generated = await generateListeningPortrait({
        musicRole: answers.musicRole,
        listeningMoment: answers.listeningMoment,
        discoveryStyle: answers.discoveryStyle,
        ownWords: answers.ownWords?.trim() ?? '',
      });
      setPortrait(generated);
      setAnswers(generated.answers);
      setConsented(false);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not generate your portrait.');
    } finally {
      setWorking(false);
    }
  }

  async function onDelete() {
    if (!window.confirm('Delete your Listening Portrait and questionnaire answers?')) return;
    setWorking(true);
    setError(null);
    try {
      await deleteListeningPortrait();
      setPortrait(null);
      setAnswers(EMPTY_ANSWERS);
      setEditing(false);
      setConsented(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete your portrait.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <SectionLabel>Your Listening Portrait</SectionLabel>
        <span className="rounded-full bg-[var(--color-accent-lavender)]/20 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          Private · AI
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[var(--color-bg-card)]">
        {loading ? (
          <p className="p-6 text-ds-sm text-[var(--color-text-muted)]">
            Loading your portrait…
          </p>
        ) : (
          <>
            {portrait && !editing && (
              <div className="space-y-7 p-6 sm:p-8">
                <div>
                  <p className="font-serif text-3xl italic tracking-tight">{portrait.title}</p>
                  <p className="mt-3 max-w-2xl text-ds-base leading-relaxed text-[var(--color-text-secondary)]">
                    {portrait.summary}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {portrait.traits.map((trait) => (
                    <div
                      key={trait.label}
                      className="rounded-xl bg-[var(--color-bg-secondary)] p-4"
                    >
                      <p className="text-ds-sm font-bold">{trait.label}</p>
                      <p className="mt-1 text-ds-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {trait.explanation}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-ds-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    Questions worth asking
                  </p>
                  <ul className="mt-3 space-y-2">
                    {portrait.conversationStarters.map((starter) => (
                      <li key={starter} className="flex gap-3 text-ds-sm">
                        <span aria-hidden="true" className="text-[var(--color-accent-coral)]">♪</span>
                        <span>{starter}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-ds-xs leading-relaxed text-[var(--color-text-muted)]">
                  This reflects only answers you gave us. It is not a personality assessment,
                  dating profile, or analysis of your Spotify history.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => setEditing(true)}
                    className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-ds-sm font-semibold text-[var(--color-bg-primary)] disabled:opacity-50"
                  >
                    Change my answers
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={onDelete}
                    className="rounded-full px-4 py-2 text-ds-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Delete portrait
                  </button>
                </div>
              </div>
            )}

            {showForm && (
              <div className="space-y-7 p-6 sm:p-8">
                <div>
                  <p className="text-ds-xl font-bold">What does music do for you?</p>
                  <p className="mt-2 max-w-2xl text-ds-sm leading-relaxed text-[var(--color-text-secondary)]">
                    Answer three small questions. Bwend sends only these answers to OpenAI—not
                    your Spotify songs, artists, listening history, or lyrics.
                  </p>
                </div>

                <ChoiceGroup
                  label="Music is mostly a way to…"
                  options={ROLE_OPTIONS}
                  value={answers.musicRole}
                  onChange={(musicRole) => setAnswers((current) => ({ ...current, musicRole }))}
                />
                <ChoiceGroup
                  label="It matters most during…"
                  options={MOMENT_OPTIONS}
                  value={answers.listeningMoment}
                  onChange={(listeningMoment) =>
                    setAnswers((current) => ({ ...current, listeningMoment }))
                  }
                />
                <ChoiceGroup
                  label="When finding something to play…"
                  options={DISCOVERY_OPTIONS}
                  value={answers.discoveryStyle}
                  onChange={(discoveryStyle) =>
                    setAnswers((current) => ({ ...current, discoveryStyle }))
                  }
                />

                <label className="block">
                  <span className="text-ds-sm font-semibold">
                    In your own words <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                  </span>
                  <textarea
                    value={answers.ownWords ?? ''}
                    maxLength={280}
                    rows={3}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, ownWords: event.target.value }))
                    }
                    placeholder="What does music add to your day?"
                    className="mt-2 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 text-ds-sm outline-none transition focus:border-[var(--color-accent-coral)]"
                  />
                  <span className="mt-1 flex justify-between gap-4 text-ds-xs text-[var(--color-text-muted)]">
                    <span>Do not include names, song titles, artist names, or lyrics.</span>
                    <span>{answers.ownWords?.length ?? 0}/280</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-bg-secondary)] p-4">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={(event) => setConsented(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-accent-coral)]"
                  />
                  <span className="text-ds-xs leading-relaxed text-[var(--color-text-secondary)]">
                    I agree that Bwend may send these questionnaire answers to OpenAI to
                    generate my private portrait. OpenAI may retain API abuse-monitoring logs
                    for up to 30 days. I can edit, export, or delete the result.
                  </span>
                </label>

                {error && <p role="alert" className="text-ds-sm text-red-600">{error}</p>}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={working}
                    onClick={onGenerate}
                    className="rounded-full bg-[var(--color-accent-cta)] px-5 py-2.5 text-ds-sm font-bold text-white disabled:opacity-50"
                  >
                    {working ? 'Creating…' : portrait ? 'Regenerate portrait' : 'Create my portrait'}
                  </button>
                  {portrait && (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        setEditing(false);
                        setError(null);
                      }}
                      className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-ds-sm font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && portrait && !editing && (
              <p role="alert" className="px-6 pb-6 text-ds-sm text-red-600">{error}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value?: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-ds-sm font-semibold">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-full px-4 py-2 text-ds-sm transition ${
                selected
                  ? 'bg-[var(--color-ink)] font-semibold text-[var(--color-bg-primary)]'
                  : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
