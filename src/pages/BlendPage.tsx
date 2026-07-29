/**
 * /blend — the user's own listening profile, the web counterpart of the iOS BlendView.
 *
 * Everything shown here comes from /me/top/tracks and /me/top/artists. Spotify killed audio
 * features, genres and popularity for this app, so artwork and rank are the content.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  myBlend,
  createInvite,
  loadSession,
  clearSession,
  creditLine,
  durationText,
  ApiError,
  deleteAccount,
  disconnectSpotify,
  exportAccountData,
  type BlendResponse,
  type TimeRange,
} from '../lib/api';
import { AppShell, SectionLabel, Artwork, Spinner, ErrorCard } from '../components/AppShell';

const RANGES: { value: TimeRange; label: string }[] = [
  { value: 'short_term', label: 'Last month' },
  { value: 'medium_term', label: '6 months' },
  { value: 'long_term', label: 'All time' },
];

export function BlendPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>('medium_term');
  const [blend, setBlend] = useState<BlendResponse | null>(null);
  const [cache, setCache] = useState<Partial<Record<TimeRange, BlendResponse>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);

  const session = loadSession();

  const load = useCallback(
    async (target: TimeRange, force = false) => {
      if (!force && cache[target]) {
        setBlend(cache[target]!);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      setBlend(null);
      try {
        const response = await myBlend(target);
        setCache((prev) => ({ ...prev, [target]: response }));
        setBlend(response);
      } catch (e) {
        // Nothing behind the session any more — request() has already cleared it, so send
        // them somewhere they can actually reconnect instead of an unfixable error card.
        if (e instanceof ApiError && e.requiresReconnect) {
          navigate('/', { replace: true });
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not load your blend.');
      } finally {
        setLoading(false);
      }
    },
    [cache, navigate],
  );

  useEffect(() => {
    if (!session) {
      navigate('/', { replace: true });
      return;
    }
    void load(range);
    // `load` changes identity whenever the cache does; re-running on that would refetch
    // every time a window is cached. Range is the only real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function onCreateInvite() {
    setCreatingInvite(true);
    try {
      const response = await createInvite();
      setInviteUrl(response.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create an invite.');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function onCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the URL is on screen to copy manually.
    }
  }

  async function onExport() {
    setPrivacyBusy(true);
    setError(null);
    try {
      const snapshot = await exportAccountData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bwend-data-export.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export your data.');
    } finally {
      setPrivacyBusy(false);
    }
  }

  async function onDisconnect() {
    if (!window.confirm('Disconnect Spotify now? Your remaining Bwend data will be erased after 30 days unless you reconnect.')) return;
    setPrivacyBusy(true);
    try {
      await disconnectSpotify();
      clearSession();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect Spotify.');
      setPrivacyBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm('Permanently delete your Bwend account and shared blend reveals? This cannot be undone.')) return;
    setPrivacyBusy(true);
    try {
      await deleteAccount();
      clearSession();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your account.');
      setPrivacyBusy(false);
    }
  }

  const stats = blend ? statItems(blend) : [];

  return (
    <AppShell>
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-ds-hero-sm font-bold leading-display tracking-tighter">
          Hi, {blend?.displayName ?? session?.displayName ?? 'friend'}.
        </h1>
        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate('/', { replace: true });
          }}
          className="shrink-0 text-ds-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Sign out
        </button>
      </div>

      {/* Invite */}
      <div className="mb-10 rounded-2xl bg-gradient-to-br from-[var(--color-accent-peach)] to-[var(--color-accent-lavender)] p-6 text-white">
        <p className="text-ds-xs font-medium uppercase tracking-[0.2em] opacity-80">
          Start a blend
        </p>
        <p className="mt-2 text-ds-2xl font-bold leading-display">
          Invite someone to <span className="font-serif italic">blend</span>.
        </p>
        {inviteUrl ? (
          <div className="mt-4 space-y-3">
            <p className="break-all rounded-xl bg-white/20 px-4 py-3 text-ds-sm">{inviteUrl}</p>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-full bg-white px-5 py-2.5 text-ds-sm font-semibold text-[var(--color-text-primary)]"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onCreateInvite}
            disabled={creatingInvite}
            className="mt-4 rounded-full bg-white px-5 py-2.5 text-ds-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-60"
          >
            {creatingInvite ? 'Creating…' : 'Create invite link'}
          </button>
        )}
      </div>

      {/* Time range */}
      <div className="mb-8 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={`rounded-full px-4 py-2 text-ds-sm transition-colors ${
              r.value === range
                ? 'bg-[var(--color-ink)] font-bold text-[var(--color-bg-primary)]'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <Spinner label="Reading your library…" />}
      {error && !loading && <ErrorCard message={error} onRetry={() => load(range, true)} />}

      {blend && !loading && (
        <div className="space-y-12">
          {blend.topArtists.length > 0 && (
            <section className="space-y-4">
              <SectionLabel>On repeat</SectionLabel>
              <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {blend.topArtists.slice(0, 12).map((artist) => (
                  <li key={artist.id}>
                    <SpotifyLink url={artist.spotifyURL}>
                      <Artwork
                        url={artist.imageURL}
                        alt={artist.name}
                        rounded="rounded-full"
                        className="aspect-square w-full"
                      />
                      <p className="mt-2 truncate text-center text-ds-xs font-medium">
                        {artist.name}
                      </p>
                    </SpotifyLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {blend.topTracks.length > 0 && (
            <section className="space-y-4">
              <SectionLabel>Your top tracks</SectionLabel>
              <ol className="overflow-hidden rounded-2xl bg-[var(--color-bg-card)]">
                {blend.topTracks.slice(0, 10).map((track, i) => (
                  <li
                    key={track.id}
                    className="border-b border-[var(--color-border-subtle)] last:border-b-0"
                  >
                    <SpotifyLink url={track.spotifyURL}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="w-5 shrink-0 text-right text-ds-xs text-[var(--color-text-muted)]">
                          {i + 1}
                        </span>
                        <Artwork
                          url={track.imageURL}
                          alt={track.albumName ?? track.name}
                          className="h-12 w-12 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ds-sm font-medium">
                            {track.name}
                            {track.explicit && (
                              <span className="ml-1.5 rounded-[2px] border border-[var(--color-text-muted)] px-1 text-[9px] align-middle text-[var(--color-text-muted)]">
                                E
                              </span>
                            )}
                          </p>
                          <p className="truncate text-ds-xs text-[var(--color-text-muted)]">
                            {creditLine(track)}
                          </p>
                        </div>
                        <span className="shrink-0 text-ds-xs tabular-nums text-[var(--color-text-muted)]">
                          {durationText(track)}
                        </span>
                      </div>
                    </SpotifyLink>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {blend.recentlyPlayed && blend.recentlyPlayed.length > 0 && (
            <section className="space-y-4">
              <SectionLabel>Lately</SectionLabel>
              <ul className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2">
                {blend.recentlyPlayed.slice(0, 12).map((track) => (
                  <li key={track.id} className="w-32 shrink-0">
                    <SpotifyLink url={track.spotifyURL}>
                      <Artwork
                        url={track.imageURL}
                        alt={track.albumName ?? track.name}
                        className="h-32 w-32"
                      />
                      <p className="mt-2 truncate text-ds-xs font-medium">{track.name}</p>
                      <p className="truncate text-ds-xs text-[var(--color-text-muted)]">
                        {creditLine(track)}
                      </p>
                    </SpotifyLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stats.length > 0 && (
            <section className="space-y-4">
              <SectionLabel>Your numbers</SectionLabel>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-[var(--color-bg-card)] p-4"
                  >
                    <dd className="text-ds-xl font-bold">{stat.value}</dd>
                    <dt className="mt-1 text-ds-xs text-[var(--color-text-muted)]">
                      {stat.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="space-y-4">
            <SectionLabel>Privacy & data</SectionLabel>
            <div className="rounded-2xl bg-[var(--color-bg-card)] p-5">
              <p className="text-ds-sm text-[var(--color-text-secondary)]">
                Bwend has no public dating profile or people search. Your Taste Card appears
                only in blends you choose to send or claim.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={privacyBusy}
                  onClick={onExport}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-ds-sm font-semibold disabled:opacity-50"
                >
                  Export my data
                </button>
                <button
                  type="button"
                  disabled={privacyBusy}
                  onClick={onDisconnect}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-ds-sm font-semibold disabled:opacity-50"
                >
                  Disconnect Spotify
                </button>
                <button
                  type="button"
                  disabled={privacyBusy}
                  onClick={onDelete}
                  className="rounded-full px-4 py-2 text-ds-sm font-semibold text-red-600 disabled:opacity-50"
                >
                  Delete account
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

/** Only stats we actually have — an empty tile reads as a bug. */
function statItems(blend: BlendResponse): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (blend.era !== null) out.push({ label: 'Your era', value: String(Math.round(blend.era)) });
  const { savedTracks, savedAlbums, playlists, followedArtists } = blend.library;
  if (savedTracks !== null) out.push({ label: 'Saved songs', value: savedTracks.toLocaleString() });
  if (savedAlbums !== null) out.push({ label: 'Saved albums', value: savedAlbums.toLocaleString() });
  if (playlists !== null) out.push({ label: 'Playlists', value: playlists.toLocaleString() });
  if (followedArtists !== null)
    out.push({ label: 'Artists followed', value: followedArtists.toLocaleString() });
  return out;
}

/** Opens Spotify when there's a URL, renders inert when there isn't. */
function SpotifyLink({ url, children }: { url: string | null; children: React.ReactNode }) {
  if (!url) return <>{children}</>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="block">
      {children}
    </a>
  );
}
