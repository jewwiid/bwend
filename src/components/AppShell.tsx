/**
 * Shared chrome for the signed-in web app. Uses the same design tokens as the landing page
 * so the app and the marketing site don't look like two different products.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-serif text-xl italic tracking-tight">
            bwend
          </Link>
          <Link
            to="/blend"
            className="text-ds-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Your blend
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-ds-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
      {children}
    </h2>
  );
}

/**
 * Image with a graceful fallback.
 *
 * Spotify strips artwork from some payloads, and a broken <img> is worse than a tidy
 * placeholder — so a missing or failed URL renders as a muted tile instead.
 */
export function Artwork({
  url,
  alt,
  className = '',
  rounded = 'rounded-lg',
}: {
  url: string | null;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  if (!url) {
    return (
      <div
        aria-hidden
        className={`flex items-center justify-center bg-[var(--color-bg-muted)] ${rounded} ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-1/3 w-1/3 fill-[var(--color-text-disabled)]">
          <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`object-cover ${rounded} ${className}`}
    />
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--color-accent-peach)] border-t-[var(--color-accent-cta)]" />
      {label && <p className="text-ds-sm text-[var(--color-text-muted)]">{label}</p>}
    </div>
  );
}

export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
      <p className="text-ds-base">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-ds-sm font-bold text-[var(--color-accent-cta)] hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-[var(--color-accent-cta)] px-7 py-3.5 text-ds-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
