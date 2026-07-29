import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { decodeTokenBlob, encodeTokenBlob } from "./lib/spotify";
import { pseudonymousUserId } from "./lib/privacy";

/** Credential-safe operational check: never reads or returns a real user's data. */
export const selfCheck = internalAction({
  args: {},
  returns: v.object({
    tokenEncryption: v.boolean(),
    identityPseudonymisation: v.boolean(),
  }),
  handler: async () => {
    const blob = await encodeTokenBlob({
      accessToken: "self-check-access",
      refreshToken: "self-check-refresh",
      scope: "user-top-read",
      tokenType: "Bearer",
      expiresIn: 60,
    });
    const decoded = await decodeTokenBlob(blob);
    const userId = await pseudonymousUserId("self-check-spotify-id");
    return {
      tokenEncryption:
        blob.startsWith("enc.v1.") &&
        !blob.includes("self-check-access") &&
        decoded?.accessToken === "self-check-access" &&
        decoded.storageVersion === "encrypted",
      identityPseudonymisation:
        userId.startsWith("bw_") && !userId.includes("self-check-spotify-id"),
    };
  },
});
