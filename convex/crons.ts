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

export default crons;
