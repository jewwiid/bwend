/**
 * /m/:code — the invite link.
 *
 * This path previously served a static page that tried to deep-link into the iOS app and,
 * failing that, pointed at a nonexistent App Store listing. Now it's a real page: preview
 * who invited you, connect Spotify, and get the match.
 *
 * When the iOS app IS installed, Universal Links means iOS intercepts this URL before the
 * browser ever loads it — so this page renders only for people without the app, which is
 * exactly who needs it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchInvite,
  fetchInviteHandoff,
  claimInvite,
  loadSession,
  ApiError,
  type InvitePreview,
  type InviteHandoff,
} from '../lib/api';
import { beginSpotifyLogin } from '../lib/spotifyAuth';
import { AppShell, SectionLabel, Artwork, Spinner, ErrorCard, PrimaryButton } from '../components/AppShell';

export function InvitePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [handoff, setHandoff] = useState<InviteHandoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const signedIn = loadSession() !== null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview(await fetchInvite(code));
    } catch (e) {
      // 401 just means "not signed in yet" — that's the normal path for a fresh recipient,
      // not an error worth showing them.
      if (e instanceof ApiError && e.status === 401) setPreview(null);
      else setError(e instanceof Error ? e.message : 'Could not load this invite.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  const loadHandoff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHandoff(await fetchInviteHandoff(code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this invite.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (signedIn) void load();
    else void loadHandoff();
  }, [signedIn, load, loadHandoff]);

  async function onClaim() {
    setClaiming(true);
    setError(null);
    try {
      const result = await claimInvite(code);
      navigate(`/match/${result.matchId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this blend.');
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Loading invite…" />
      </AppShell>
    );
  }

  // Not signed in — the entry point for someone who just received the link.
  if (!signedIn) {
    return (
      <AppShell>
        <div className="space-y-8 text-center">
          <div className="space-y-3">
            <SectionLabel>You've been invited</SectionLabel>
            <h1 className="text-ds-hero-sm font-bold leading-display tracking-tighter">
              Someone wants to <span className="font-serif italic">blend</span> with you.
            </h1>
            <p className="mx-auto max-w-md text-ds-base text-[var(--color-text-secondary)]">
              Connect Spotify to see how your music lines up — your top artists, the songs you
              share, and the one track that brings you together.
            </p>
          </div>
          {handoff?.spotifyBlendURL && (
            <SpotifyBlendHandoff url={handoff.spotifyBlendURL} />
          )}
          <PrimaryButton onClick={() => beginSpotifyLogin(`/m/${code}`)}>
            Connect Spotify
          </PrimaryButton>
          <p className="text-ds-xs text-[var(--color-text-muted)]">
            Listening access is read-only. A private playlist is created only when you
            explicitly save one.
          </p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <ErrorCard message={error} onRetry={load} />
      </AppShell>
    );
  }

  if (!preview) {
    return (
      <AppShell>
        <ErrorCard message="This invite couldn't be found." />
      </AppShell>
    );
  }

  if (preview.isMine) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-ds-2xl font-bold">This is your own invite</h1>
          <p className="text-ds-base text-[var(--color-text-secondary)]">
            Send this link to someone else — you can't blend with yourself.
          </p>
          <PrimaryButton onClick={() => navigate('/blend')}>Go to your blend</PrimaryButton>
        </div>
      </AppShell>
    );
  }

  if (preview.alreadyClaimed) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-ds-2xl font-bold">This invite has already been used</h1>
          <p className="text-ds-base text-[var(--color-text-secondary)]">
            Each link works once. Ask for a fresh one.
          </p>
          {preview.spotifyBlendURL && <SpotifyBlendHandoff url={preview.spotifyBlendURL} />}
          <PrimaryButton onClick={() => navigate('/blend')}>Go to your blend</PrimaryButton>
        </div>
      </AppShell>
    );
  }

  const artists = preview.inviterArtists ?? [];

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <SectionLabel>You've been invited</SectionLabel>
          <h1 className="text-ds-hero-sm font-bold leading-display tracking-tighter">
            {preview.inviterName ?? 'Someone'} wants to{' '}
            <span className="font-serif italic">blend</span> with you.
          </h1>
        </div>

        {artists.length > 0 ? (
          <div className="rounded-2xl bg-[var(--color-bg-card)] p-6">
            <SectionLabel>They listen to</SectionLabel>
            <ul className="mt-4 grid grid-cols-3 gap-4">
              {artists.slice(0, 6).map((artist) => (
                <li key={artist.id}>
                  <Artwork
                    url={artist.imageURL}
                    alt={artist.name}
                    rounded="rounded-full"
                    className="aspect-square w-full"
                  />
                  <p className="mt-2 truncate text-center text-ds-xs font-medium">
                    {artist.name}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : preview.inviterTopArtists.length > 0 ? (
          <div className="rounded-2xl bg-[var(--color-bg-card)] p-6">
            <SectionLabel>They listen to</SectionLabel>
            <ul className="mt-3 space-y-1.5">
              {preview.inviterTopArtists.slice(0, 5).map((name) => (
                <li key={name} className="text-ds-base">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview.spotifyBlendURL && <SpotifyBlendHandoff url={preview.spotifyBlendURL} />}

        <div className="text-center">
          <PrimaryButton onClick={onClaim} disabled={claiming}>
            {claiming ? 'Blending…' : 'See your blend'}
          </PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

function SpotifyBlendHandoff({ url }: { url: string }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
      <div className="flex items-start gap-4">
        <img src="/spotify-icon.svg" alt="" className="mt-1 h-8 w-8 shrink-0" />
        <div>
          <SectionLabel>Also on Spotify</SectionLabel>
          <h2 className="mt-2 text-ds-xl font-semibold">Join their Spotify Blend.</h2>
          <p className="mt-2 text-ds-sm leading-relaxed text-[var(--color-text-secondary)]">
            Spotify may show Blend members your Spotify username and profile picture. Members
            can invite other friends. This opens Spotify; Bwend does not follow this invite or read its members.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex rounded-full bg-[#1DB954] px-5 py-2.5 text-ds-sm font-bold text-black"
          >
            OPEN SPOTIFY
          </a>
        </div>
      </div>
    </section>
  );
}
