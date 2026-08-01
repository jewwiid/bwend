import { useEffect, useState } from 'react';
import {
  getSpotifyBlendPlaylist,
  listSpotifyPlaylists,
  removeSpotifyBlend,
  removeSpotifyBlendPlaylist,
  saveSpotifyBlend,
  selectSpotifyBlendPlaylist,
  type SpotifyBlendPlaylistRead,
  type SpotifyPlaylistSummary,
} from '../lib/api';

export function SpotifyBlendCard({
  initialURL,
  initialPlaylistId,
  onChange,
  onPlaylistChange,
}: {
  initialURL: string | null;
  initialPlaylistId: string | null;
  onChange: (url: string | null) => void;
  onPlaylistChange: (playlistId: string | null) => void;
}) {
  const [savedURL, setSavedURL] = useState(initialURL);
  const [input, setInput] = useState(initialURL ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [playlistId, setPlaylistId] = useState(initialPlaylistId ?? '');
  const [playlistRead, setPlaylistRead] = useState<SpotifyBlendPlaylistRead | null>(null);
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedURL(initialURL);
    setInput(initialURL ?? '');
  }, [initialURL]);

  useEffect(() => {
    setPlaylistId(initialPlaylistId ?? '');
    setPlaylistRead(null);
  }, [initialPlaylistId]);

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

  async function loadPlaylists() {
    setPlaylistBusy(true);
    setPlaylistMessage(null);
    try {
      const result = await listSpotifyPlaylists();
      setPlaylists(result);
      if (!playlistId && result.length > 0) setPlaylistId(result[0].id);
      setPlaylistMessage(
        result.length > 0
          ? 'Choose the Blend yourself—Bwend does not guess from playlist names.'
          : 'No playlists were returned by Spotify.',
      );
    } catch (error) {
      setPlaylistMessage(error instanceof Error ? error.message : 'Could not load Spotify playlists.');
    } finally {
      setPlaylistBusy(false);
    }
  }

  async function selectPlaylist() {
    if (!playlistId) return;
    setPlaylistBusy(true);
    setPlaylistMessage(null);
    try {
      const result = await selectSpotifyBlendPlaylist(playlistId);
      setPlaylistRead(result);
      onPlaylistChange(result.id);
      setPlaylistMessage(
        result.tracksReadable
          ? `Bwend can read ${result.trackCount} tracks from this selected Blend.`
          : 'Spotify exposes this playlist in your library but does not allow Bwend to read its tracks.',
      );
    } catch (error) {
      setPlaylistMessage(error instanceof Error ? error.message : 'Could not read that Spotify Blend.');
    } finally {
      setPlaylistBusy(false);
    }
  }

  async function refreshSelectedPlaylist() {
    setPlaylistBusy(true);
    setPlaylistMessage(null);
    try {
      const result = await getSpotifyBlendPlaylist();
      setPlaylistRead(result);
      if (!result) {
        setPlaylistMessage('Choose the created Blend from your Spotify library first.');
      } else {
        setPlaylistId(result.id);
        setPlaylistMessage(
          result.tracksReadable
            ? `Read ${result.trackCount} tracks live from Spotify.`
            : 'Spotify exposes the playlist but not its tracks to Bwend.',
        );
      }
    } catch (error) {
      setPlaylistMessage(error instanceof Error ? error.message : 'Could not refresh that Spotify Blend.');
    } finally {
      setPlaylistBusy(false);
    }
  }

  async function removeSelectedPlaylist() {
    setPlaylistBusy(true);
    setPlaylistMessage(null);
    try {
      await removeSpotifyBlendPlaylist();
      setPlaylistId('');
      setPlaylistRead(null);
      onPlaylistChange(null);
      setPlaylistMessage('The selected Spotify playlist was detached from Bwend.');
    } catch (error) {
      setPlaylistMessage(error instanceof Error ? error.message : 'Could not detach that playlist.');
    } finally {
      setPlaylistBusy(false);
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
          Paste the URL or Spotify&apos;s full invite message. Bwend validates but never follows
          this invite link or reads its members. New Bwend invites snapshot it automatically.
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

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
        <h3 className="text-ds-base font-semibold">Read the Blend after it is created</h3>
        <p className="mt-1 text-ds-xs leading-relaxed text-[var(--color-text-secondary)]">
          Spotify&apos;s invite URL cannot be converted into a playlist. After you join, load your
          Spotify library and explicitly choose the resulting Blend. Bwend reads it live only
          when you ask and never sends its tracks to AI.
        </p>

        {playlists.length > 0 ? (
          <div className="mt-4 space-y-3">
            <label htmlFor="spotify-blend-playlist" className="text-ds-xs font-semibold">
              Playlist in your Spotify library
            </label>
            <select
              id="spotify-blend-playlist"
              value={playlistId}
              onChange={(event) => setPlaylistId(event.target.value)}
              disabled={playlistBusy}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 text-ds-sm"
            >
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} · {playlist.trackCount} tracks
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadPlaylists()}
            disabled={playlistBusy}
            className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-ds-sm font-semibold disabled:opacity-50"
          >
            {playlistBusy ? 'Checking…' : 'Load Spotify playlists'}
          </button>
          {playlists.length > 0 ? (
            <button
              type="button"
              onClick={() => void selectPlaylist()}
              disabled={playlistBusy || !playlistId}
              className="rounded-full bg-[#1DB954] px-5 py-2.5 text-ds-sm font-bold text-black disabled:opacity-50"
            >
              Choose and read
            </button>
          ) : initialPlaylistId ? (
            <button
              type="button"
              onClick={() => void refreshSelectedPlaylist()}
              disabled={playlistBusy}
              className="rounded-full bg-[#1DB954] px-5 py-2.5 text-ds-sm font-bold text-black disabled:opacity-50"
            >
              Read selected Blend
            </button>
          ) : null}
          {initialPlaylistId ? (
            <button
              type="button"
              onClick={() => void removeSelectedPlaylist()}
              disabled={playlistBusy}
              className="rounded-full px-5 py-2.5 text-ds-sm font-semibold text-red-600 disabled:opacity-50"
            >
              Detach playlist
            </button>
          ) : null}
        </div>

        {playlistRead ? (
          <div className="mt-5 rounded-xl bg-[var(--color-bg-secondary)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{playlistRead.name}</p>
                <p className="text-ds-xs text-[var(--color-text-secondary)]">
                  {playlistRead.trackCount} tracks · {playlistRead.tracksReadable ? 'readable' : 'metadata only'}
                </p>
              </div>
              <a
                href={playlistRead.spotifyURL}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 text-ds-xs font-bold text-[#16883d] dark:text-[#4ade80]"
              >
                OPEN SPOTIFY
              </a>
            </div>
            {playlistRead.tracks.length > 0 ? (
              <ol className="mt-3 space-y-1 text-ds-xs text-[var(--color-text-secondary)]">
                {playlistRead.tracks.slice(0, 5).map((track) => (
                  <li key={track.id} className="truncate">
                    {track.name}{track.artistName ? ` · ${track.artistName}` : ''}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        {playlistMessage ? (
          <p className="mt-3 text-ds-xs text-[var(--color-text-secondary)]" aria-live="polite">
            {playlistMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
