/**
 * /match/:id — the reveal. Score, the anchor track, what you share, and the breakdown.
 *
 * Breakdown components arrive as null when Spotify withheld the underlying signal; those
 * rows are omitted rather than drawn as an empty bar, which would read as "0% match".
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMatch, loadSession, type PublicMatch, type VibeBreakdown } from '../lib/api';
import { AppShell, SectionLabel, Artwork, Spinner, ErrorCard, PrimaryButton } from '../components/AppShell';

export function MatchPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<PublicMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMatch(await fetchMatch(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this blend.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!loadSession()) {
      navigate('/', { replace: true });
      return;
    }
    void load();
  }, [load, navigate]);

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Reading your blend…" />
      </AppShell>
    );
  }
  if (error || !match) {
    return (
      <AppShell>
        <ErrorCard message={error ?? 'Blend not found.'} onRetry={load} />
      </AppShell>
    );
  }

  const rows = breakdownRows(match.breakdown);

  return (
    <AppShell>
      <div className="space-y-10">
        <div className="space-y-2 text-center">
          <SectionLabel>
            {match.myName ?? 'You'} &amp; {match.partnerName ?? 'them'}
          </SectionLabel>
          <p className="text-ds-hero font-bold leading-display tracking-tighter">
            {match.vibeScore}
          </p>
          <p className="font-serif text-ds-lg italic text-[var(--color-accent-coral)]">
            taste match
          </p>
        </div>

        <p className="mx-auto max-w-lg text-center text-ds-lg leading-body text-[var(--color-text-secondary)]">
          {match.compatibilityRead}
        </p>

        {match.anchorTrack && (
          <div className="flex flex-col items-center gap-4">
            <SectionLabel>The song that brings you together</SectionLabel>
            <Artwork
              url={match.anchorTrack.imageURL}
              alt={match.anchorTrack.name}
              rounded="rounded-2xl"
              className="h-48 w-48"
            />
            <div className="text-center">
              <p className="text-ds-xl font-bold">{match.anchorTrack.name}</p>
              {match.anchorTrack.artistName && (
                <p className="text-ds-base text-[var(--color-text-muted)]">
                  {match.anchorTrack.artistName}
                </p>
              )}
            </div>
            {match.anchorTrack.spotifyURL && (
              <a
                href={match.anchorTrack.spotifyURL}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full bg-[#1DB954] px-6 py-3 text-ds-sm font-semibold text-white"
              >
                Play on Spotify
              </a>
            )}
          </div>
        )}

        {(match.sharedTopArtistNames.length > 0 || match.sharedTopTrackNames.length > 0) && (
          <div className="grid gap-6 sm:grid-cols-2">
            {match.sharedTopArtistNames.length > 0 && (
              <section className="rounded-2xl bg-[var(--color-bg-card)] p-6">
                <SectionLabel>Artists you share</SectionLabel>
                <ul className="mt-3 space-y-1.5">
                  {match.sharedTopArtistNames.map((name) => (
                    <li key={name} className="text-ds-base">{name}</li>
                  ))}
                </ul>
              </section>
            )}
            {match.sharedTopTrackNames.length > 0 && (
              <section className="rounded-2xl bg-[var(--color-bg-card)] p-6">
                <SectionLabel>Songs you share</SectionLabel>
                <ul className="mt-3 space-y-1.5">
                  {match.sharedTopTrackNames.map((name) => (
                    <li key={name} className="text-ds-base">{name}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <section className="space-y-4">
          <SectionLabel>What makes your vibe</SectionLabel>
          <div className="space-y-3 rounded-2xl bg-[var(--color-bg-card)] p-6">
            {rows.map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex justify-between text-ds-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums text-[var(--color-text-muted)]">
                    {Math.round(row.value * 100)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent-cta)]"
                    style={{ width: `${Math.round(row.value * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center">
          <PrimaryButton onClick={() => navigate('/blend')}>Back to your blend</PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

/** Null components weren't computable — Spotify withheld the signal — so they're skipped. */
function breakdownRows(b: VibeBreakdown): { label: string; value: number }[] {
  const rows: { label: string; value: number }[] = [
    { label: 'Shared tracks', value: b.trackOverlap },
    { label: 'Shared artists', value: b.artistOverlap },
  ];
  if (b.genreOverlap !== null) rows.push({ label: 'Genre match', value: b.genreOverlap });
  if (b.popularitySim !== null) rows.push({ label: 'Mainstream match', value: b.popularitySim });
  if (b.eraSim !== null) rows.push({ label: 'Era match', value: b.eraSim });
  if (b.discoverySim !== null) rows.push({ label: 'Discovery match', value: b.discoverySim });
  if (b.clockSim !== null) rows.push({ label: 'Same hours', value: b.clockSim });
  return rows;
}
