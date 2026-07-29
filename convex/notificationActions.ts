/**
 * Hourly Daily Blend APNs fan-out.
 *
 * Requires APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, and optionally APNS_BUNDLE_ID.
 * No credentials means a safe no-op, so development deployments can run the cron.
 */

"use node";

import { sign } from "node:crypto";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

interface APNsConfiguration {
  keyId: string;
  teamId: string;
  privateKey: string;
  bundleId: string;
}

interface DeliveryResult {
  delivered: boolean;
  invalidToken: boolean;
}

export const sendDailyBlends = internalAction({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    eligible: v.number(),
    delivered: v.number(),
    disabled: v.number(),
  }),
  handler: async (ctx) => {
    const configuration = apnsConfiguration();
    if (!configuration) {
      return { configured: false, eligible: 0, delivered: 0, disabled: 0 };
    }

    const subscriptions: Doc<"pushSubscriptions">[] = await ctx.runQuery(
      internal.pushSubscriptions.listEnabled,
      {}
    );
    let eligible = 0;
    let delivered = 0;
    let disabled = 0;
    const jwt = makeAPNsJWT(configuration);

    // Sequential delivery is deliberate at this MVP scale: it avoids a burst of hundreds of
    // outbound requests and remains bounded by listEnabled.take(500).
    for (const subscription of subscriptions) {
      const local = localDateParts(new Date(), subscription.timezone);
      if (
        local.hour !== subscription.dailyHour ||
        subscription.lastDailySentKey === local.dateKey
      ) {
        continue;
      }

      const [asA, asB] = await Promise.all([
        ctx.runQuery(internal.matchQueries.byUserA, {
          spotifyUserId: subscription.spotifyUserId,
        }),
        ctx.runQuery(internal.matchQueries.byUserB, {
          spotifyUserId: subscription.spotifyUserId,
        }),
      ]);
      const latest = [...asA, ...asB].sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!latest) continue;
      eligible += 1;

      const partnerId =
        latest.userASpotifyUserId === subscription.spotifyUserId
          ? latest.userBSpotifyUserId
          : latest.userASpotifyUserId;
      const partner = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
        spotifyUserId: partnerId,
      });
      const partnerName = partner?.displayName ?? "your match";
      const trackName = latest.anchorTrack?.name;
      const body = trackName
        ? `${trackName} is today's reason to revisit your blend with ${partnerName}.`
        : `Your blend with ${partnerName} is ready for another listen.`;

      const result = await sendAPNs(
        configuration,
        jwt,
        subscription,
        latest._id,
        body
      );
      if (result.invalidToken) {
        await ctx.runMutation(internal.pushSubscriptions.disableById, {
          subscriptionId: subscription._id,
        });
        disabled += 1;
      } else if (result.delivered) {
        await ctx.runMutation(internal.pushSubscriptions.markDailySent, {
          subscriptionId: subscription._id,
          dateKey: local.dateKey,
        });
        delivered += 1;
      }
    }

    return { configured: true, eligible, delivered, disabled };
  },
});

function apnsConfiguration(): APNsConfiguration | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) return null;
  return {
    keyId,
    teamId,
    privateKey,
    bundleId: process.env.APNS_BUNDLE_ID ?? "com.bwend.app",
  };
}

function makeAPNsJWT(configuration: APNsConfiguration): string {
  const header = base64URL(JSON.stringify({ alg: "ES256", kid: configuration.keyId }));
  const payload = base64URL(
    JSON.stringify({ iss: configuration.teamId, iat: Math.floor(Date.now() / 1000) })
  );
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: configuration.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function sendAPNs(
  configuration: APNsConfiguration,
  jwt: string,
  subscription: Doc<"pushSubscriptions">,
  matchId: string,
  body: string
): Promise<DeliveryResult> {
  const host =
    subscription.environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";
  const response = await fetch(`${host}/3/device/${subscription.deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": configuration.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": `daily-${matchId}`,
    },
    body: JSON.stringify({
      aps: {
        alert: { title: "Your daily Bwend", body },
        sound: "default",
        "thread-id": "daily-blend",
        category: "DAILY_BLEND",
      },
      matchId,
    }),
  });
  if (response.ok) return { delivered: true, invalidToken: false };

  const error = (await response.json().catch(() => null)) as { reason?: string } | null;
  const invalidToken =
    response.status === 410 ||
    error?.reason === "BadDeviceToken" ||
    error?.reason === "Unregistered";
  return { delivered: false, invalidToken };
}

function localDateParts(date: Date, timeZone: string): { hour: number; dateKey: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    hour: Number(parts.hour),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function base64URL(value: string): string {
  return Buffer.from(value).toString("base64url");
}
