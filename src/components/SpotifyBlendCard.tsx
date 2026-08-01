import { useEffect, useState } from 'react';
import { removeSpotifyBlend, saveSpotifyBlend } from '../lib/api';

export function SpotifyBlendCard({
  initialURL,
  onChange,
}: {
  initialURL: string | null;
  onChange: (url: string | null) => void;
}) {
  const [savedURL, setSavedURL] = useState(initialURL);
  const [input, setInput] = useState(initialURL ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedURL(initialURL);
    setInput(initialURL ?? '');
  }, [initialURL]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveSpotifyBlend(input);
      setSavedURL(result.url);
      setInput(result.url);
      onChange(result.url);
      setMessage('Saved. New Bwend invites will include this Spotify Blend.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this Spotify Blend.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!window.confirm('Remove this Spotify Blend from your Taste Card and Bwend invites?')) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await removeSpotifyBlend();
      setSavedURL(null);
      setInput('');
      onChange(null);
      setMessage('Removed from your Taste Card and existing Bwend invites.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove this Spotify Blend.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ds-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Spotify Blend
          </p>
          <h2 className="mt-2 text-ds-xl font-semibold">One link, two ways to connect.</h2>
        </div>
        {savedURL && (
          <a
            href={savedURL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2 text-ds-xs font-bold tracking-wide"
          >
            <img src="/spotify-icon.svg" alt="" className="h-4 w-4" />
            OPEN SPOTIFY
          </a>
        )}
      </div>

      <form
        onSubmit={onSave}
        className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5"
      >
        <label htmlFor="spotify-blend-url" className="text-ds-sm font-semibold">
          Your Spotify Blend invite
        </label>
        <p className="mt-1 text-ds-xs leading-relaxed text-[var(--color-text-secondary)]">
          Paste the URL or Spotify&apos;s full invite message. Bwend validates the link but never
          reads the playlist or its members. New Bwend invites snapshot it automatically.
        </p>
        <textarea
          id="spotify-blend-url"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          rows={3}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://open.spotify.com/blend/taste-match/…"
          className="mt-4 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 text-ds-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-cta)] disabled:opacity-60"
        />
        <p className="mt-3 text-ds-xs leading-relaxed text-[var(--color-text-muted)]">
          Spotify says people who join a Blend may see each other&apos;s Spotify username and
          profile picture, and members can invite additional friends.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="rounded-full bg-[var(--color-accent-cta)] px-5 py-2.5 text-ds-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : savedURL ? 'Replace link' : 'Add to Taste Card'}
          </button>
          {savedURL && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="rounded-full px-5 py-2.5 text-ds-sm font-semibold text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {message && (
          <p className="mt-3 text-ds-xs text-[var(--color-text-secondary)]" aria-live="polite">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
