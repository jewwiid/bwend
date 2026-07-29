/**
 * Authenticated device registration endpoints.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, requireAuth } from "./auth";

export const handleRegisterPushDevice = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { reason: "Invalid notification settings." }, request);
  }

  const deviceToken =
    typeof body.deviceToken === "string" ? body.deviceToken.trim().toLowerCase() : "";
  const environment = body.environment;
  const timezone = typeof body.timezone === "string" ? body.timezone : "";
  const dailyHour = typeof body.dailyHour === "number" ? body.dailyHour : 18;

  if (!/^[a-f0-9]{32,512}$/.test(deviceToken)) {
    return jsonResponse(400, { reason: "Invalid APNs device token." }, request);
  }
  if (environment !== "sandbox" && environment !== "production") {
    return jsonResponse(400, { reason: "Invalid APNs environment." }, request);
  }
  if (!isTimeZone(timezone)) {
    return jsonResponse(400, { reason: "Invalid timezone." }, request);
  }

  await ctx.runMutation(internal.pushSubscriptions.register, {
    spotifyUserId: authResult.spotifyUserId,
    deviceToken,
    environment,
    timezone,
    dailyHour,
  });
  return jsonResponse(200, { enabled: true }, request);
});

export const handleDisablePushDevice = httpAction(async (ctx, request) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  let deviceToken = "";
  try {
    const body = (await request.json()) as { deviceToken?: unknown };
    deviceToken = typeof body.deviceToken === "string" ? body.deviceToken.toLowerCase() : "";
  } catch {
    // The validation below returns the user-facing error.
  }
  if (!/^[a-f0-9]{32,512}$/.test(deviceToken)) {
    return jsonResponse(400, { reason: "Invalid APNs device token." }, request);
  }
  await ctx.runMutation(internal.pushSubscriptions.disable, {
    spotifyUserId: authResult.spotifyUserId,
    deviceToken,
  });
  return jsonResponse(200, { enabled: false }, request);
});

function isTimeZone(value: string): boolean {
  if (!value || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
