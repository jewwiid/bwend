/**
 * /callback — Spotify redirects here with ?code=…&state=….
 *
 * Validates the callback, exchanges the code via our backend (which holds the client
 * secret), stores the session, then continues to wherever the user was headed.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  consumeCallback,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  redirectUri,
} from '../lib/spotifyAuth';
import { ApiError, connectSpotify, saveSession } from '../lib/api';
import { AppShell, Spinner, ErrorCard, PrimaryButton } from '../components/AppShell';

export function CallbackPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [spotifyAccessLimited, setSpotifyAccessLimited] = useState(false);

  // The authorization code is single-use. React StrictMode may double-invoke effects in
  // dev, and a second exchange with the same code fails — so guard to exactly one attempt.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const { code, codeVerifier, returnTo } = consumeCallback(search.toString());
        const response = await connectSpotify(
          code,
          codeVerifier,
          redirectUri(),
          CURRENT_PRIVACY_VERSION,
          CURRENT_TERMS_VERSION,
        );
        saveSession({
          token: response.token,
          displayName: response.displayName,
          userId: response.userId,
        });
        navigate(returnTo ?? '/blend', { replace: true });
      } catch (e) {
        setSpotifyAccessLimited(
          e instanceof ApiError && e.code === 'spotify_beta_access_required',
        );
        setError(e instanceof Error ? e.message : 'Something went wrong signing in.');
      }
    })();
  }, [search, navigate]);

  return (
    <AppShell>
      {error ? (
        <div className="space-y-6">
          <h1 className="text-ds-2xl font-bold">Couldn't finish signing in</h1>
          <ErrorCard message={error} />
          {spotifyAccessLimited ? (
            <a
              href="/?interest=invite_capacity#waitlist"
              className="ds-btn ds-btn-primary inline-flex w-full justify-center"
            >
              Join the launch list
            </a>
          ) : null}
          <PrimaryButton onClick={() => navigate('/', { replace: true })}>
            Back to start
          </PrimaryButton>
        </div>
      ) : (
        <Spinner label="Connecting your Spotify…" />
      )}
    </AppShell>
  );
}
