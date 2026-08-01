import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cancelInvite,
  myInvites,
  type InviteSummary,
} from '../lib/api';
import {
  effectiveInviteStatus,
  expiryLabel,
  partitionInvites,
} from '../lib/invitePresentation';
import { Artwork, SectionLabel, Spinner } from './AppShell';
import { InviteQRCode } from './InviteQRCode';

interface InvitesSectionProps {
  refreshKey: number;
}

export function InvitesSection({ refreshKey }: InvitesSectionProps) {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvites(await myInvites());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your invites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const { active, history } = useMemo(() => partitionInvites(invites), [invites]);

  async function copy(invite: InviteSummary) {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopiedCode(invite.code);
      window.setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      setError('Copying was blocked. Open the invite and use your browser share menu.');
    }
  }

  async function cancel(invite: InviteSummary) {
    if (!window.confirm('Cancel this invite? Anyone with the link will no longer be able to use it.')) {
      return;
    }
    setCancellingCode(invite.code);
    setError(null);
    try {
      await cancelInvite(invite.code);
      setInvites((current) => current.filter((item) => item.code !== invite.code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel this invite.');
    } finally {
      setCancellingCode(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <SectionLabel>Your invites</SectionLabel>
          <p className="mt-2 text-ds-sm text-[var(--color-text-secondary)]">
            Each link works once and expires after seven days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-ds-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading && invites.length === 0 ? <Spinner label="Loading invites…" /> : null}
      {error ? (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-ds-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!loading && invites.length === 0 ? (
        <div className="rounded-2xl bg-[var(--color-bg-card)] p-6 text-center">
          <p className="font-semibold">No invites yet</p>
          <p className="mt-1 text-ds-sm text-[var(--color-text-secondary)]">
            Create one above, then send it to one person you want to blend with.
          </p>
        </div>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-3">
          <p className="text-ds-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Waiting
          </p>
          {active.map((invite) => (
            <InviteCard
              key={invite.code}
              invite={invite}
              copied={copiedCode === invite.code}
              cancelling={cancellingCode === invite.code}
              onCopy={() => void copy(invite)}
              onCancel={() => void cancel(invite)}
              onOpen={() => navigate(`/m/${invite.code}`)}
            />
          ))}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="space-y-3">
          <p className="text-ds-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            History
          </p>
          {history.map((invite) => (
            <InviteCard
              key={invite.code}
              invite={invite}
              copied={false}
              cancelling={false}
              onCopy={() => void copy(invite)}
              onCancel={() => undefined}
              onOpen={() => {
                if (invite.matchId) navigate(`/match/${invite.matchId}`);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface InviteCardProps {
  invite: InviteSummary;
  copied: boolean;
  cancelling: boolean;
  onCopy: () => void;
  onCancel: () => void;
  onOpen: () => void;
}

function InviteCard({
  invite,
  copied,
  cancelling,
  onCopy,
  onCancel,
  onOpen,
}: InviteCardProps) {
  const [showQR, setShowQR] = useState(false);
  const status = effectiveInviteStatus(invite);
  const pending = status === 'pending';
  const claimed = status === 'claimed';
  const detail = claimed
    ? `Matched with ${invite.partnerName ?? 'someone'}`
    : status === 'expired'
      ? 'Expired'
      : expiryLabel(invite.expiresAt);

  return (
    <article className="rounded-2xl bg-[var(--color-bg-card)] p-4 sm:p-5">
      <div className="flex gap-4">
        {invite.selectedTrack ? (
          <Artwork
            url={invite.selectedTrack.imageURL}
            alt={invite.selectedTrack.name}
            className="h-14 w-14 shrink-0"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-xl">
            ↗
          </div>
        )}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold">
            {invite.selectedTrack?.name ?? `Invite ${invite.code}`}
          </p>
          <p className="mt-1 text-ds-sm text-[var(--color-text-secondary)]">{detail}</p>
          <p className="mt-1 font-mono text-ds-xs tracking-wider text-[var(--color-text-muted)]">
            {invite.code}
          </p>
          {invite.spotifyBlendURL && (
            <p className="mt-1 text-ds-xs font-semibold text-[#16883d] dark:text-[#4ade80]">
              Spotify Blend included
            </p>
          )}
        </button>
        <span
          className={`h-fit rounded-full px-3 py-1 text-ds-xs font-semibold ${
            claimed
              ? 'bg-[var(--color-accent-lavender)]/25'
              : pending
                ? 'bg-[var(--color-accent-warm-yellow)]/25'
                : 'bg-[var(--color-bg-secondary)]'
          }`}
        >
          {claimed ? 'Matched' : pending ? 'Pending' : 'Expired'}
        </span>
      </div>

      {pending ? (
        <div className="mt-4 space-y-4">
          {showQR ? <InviteQRCode url={invite.url} /> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-ds-sm font-semibold"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={() => setShowQR((value) => !value)}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-ds-sm font-semibold"
            >
              {showQR ? 'Hide QR' : 'Show QR'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="rounded-full px-4 py-2 text-ds-sm font-semibold text-red-600 disabled:opacity-50 dark:text-red-300"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
