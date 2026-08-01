import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Each subscription stores its local timezone and preferred hour. The action filters the
// bounded enabled set and records a local date key to guarantee at-most-once daily delivery.
crons.interval(
  "daily blend notifications",
  { hours: 1 },
  internal.notificationActions.sendDailyBlends,
  {}
);

crons.daily(
  "privacy retention cleanup",
  { hourUTC: 3, minuteUTC: 15 },
  internal.accountMutations.cleanupExpiredInvites,
  {}
);

crons.daily(
  "disconnected account cleanup",
  { hourUTC: 3, minuteUTC: 30 },
  internal.accountMutations.cleanupDisconnectedAccounts,
  {}
);

crons.daily(
  "launch interest retention cleanup",
  { hourUTC: 3, minuteUTC: 45 },
  internal.waitlist.cleanupExpired,
  {}
);

export default crons;
