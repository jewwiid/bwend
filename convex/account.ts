import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, requireAuth } from "./auth";

export const handleExportAccount = httpAction(async (ctx, request) => {
  const identity = await requireAuth(request);
  if (identity instanceof Response) return identity;
  const snapshot = await ctx.runQuery(internal.accountQueries.exportSnapshot, {
    spotifyUserId: identity.spotifyUserId,
  });
  if (!snapshot) return jsonResponse(404, { reason: "Account not found." }, request);
  return jsonResponse(200, snapshot, request);
});

export const handleDisconnectSpotify = httpAction(async (ctx, request) => {
  const identity = await requireAuth(request);
  if (identity instanceof Response) return identity;
  const disconnected = await ctx.runMutation(internal.accountMutations.disconnectSpotify, {
    spotifyUserId: identity.spotifyUserId,
  });
  return jsonResponse(200, { ok: true, disconnected }, request);
});

export const handleDeleteAccount = httpAction(async (ctx, request) => {
  const identity = await requireAuth(request);
  if (identity instanceof Response) return identity;
  const deleted = await ctx.runMutation(internal.accountMutations.eraseAccount, {
    spotifyUserId: identity.spotifyUserId,
  });
  return jsonResponse(200, { ok: true, deleted }, request);
});
