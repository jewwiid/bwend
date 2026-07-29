import { describe, expect, test } from "vitest";
import type { InviteSummary } from "./api";
import {
  effectiveInviteStatus,
  expiryLabel,
  partitionInvites,
} from "./invitePresentation";

function invite(code: string, status: InviteSummary["status"]): InviteSummary {
  return {
    code,
    url: `https://www.bwend.xyz/m/${code}`,
    status,
    selectedTrack: null,
    createdAt: "2026-07-29T12:00:00.000Z",
    claimedAt: status === "claimed" ? "2026-07-29T13:00:00.000Z" : null,
    expiresAt: "2026-08-05T12:00:00.000Z",
    matchId: status === "claimed" ? "match-id" : null,
    partnerName: status === "claimed" ? "Listener" : null,
  };
}

describe("invite presentation", () => {
  test("partitions waiting links from invite history", () => {
    const result = partitionInvites([
      invite("PENDING", "pending"),
      invite("MATCHED", "claimed"),
      invite("EXPIRED", "expired"),
    ]);

    expect(result.active.map((item) => item.code)).toEqual(["PENDING"]);
    expect(result.history.map((item) => item.code)).toEqual(["MATCHED", "EXPIRED"]);
  });

  test("describes hour, day, and expired boundaries", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");

    expect(expiryLabel("2026-07-29T13:00:00.000Z", now)).toBe("Expires in 1 hour");
    expect(expiryLabel("2026-07-31T12:00:00.000Z", now)).toBe("Expires in 2 days");
    expect(expiryLabel("2026-07-29T11:59:59.000Z", now)).toBe("Expired");
  });

  test("treats an overdue pending record as expired on the client", () => {
    const overdue = {
      ...invite("OVERDUE", "pending"),
      expiresAt: "2026-07-29T11:59:59.000Z",
    };
    const now = Date.parse("2026-07-29T12:00:00.000Z");

    expect(effectiveInviteStatus(overdue, now)).toBe("expired");
  });
});
