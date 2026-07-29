import type { InviteSummary } from "./api";

export function effectiveInviteStatus(
  invite: InviteSummary,
  now = Date.now(),
): InviteSummary["status"] {
  if (invite.status === "pending" && new Date(invite.expiresAt).getTime() <= now) {
    return "expired";
  }
  return invite.status;
}

export function partitionInvites(invites: InviteSummary[]): {
  active: InviteSummary[];
  history: InviteSummary[];
} {
  const now = Date.now();
  return {
    active: invites.filter((invite) => effectiveInviteStatus(invite, now) === "pending"),
    history: invites.filter((invite) => effectiveInviteStatus(invite, now) !== "pending"),
  };
}

export function expiryLabel(value: string, now = Date.now()): string {
  const remaining = new Date(value).getTime() - now;
  if (remaining <= 0) return "Expired";
  const hours = Math.ceil(remaining / (60 * 60 * 1000));
  if (hours < 24) return `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.ceil(hours / 24);
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}
