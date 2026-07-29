import { describe, expect, test } from "vitest";
import {
  spotifyAPIError,
  spotifyRateLimitFailure,
} from "./lib/spotify";

describe("Spotify operational errors", () => {
  test("distinguishes Development Mode quota exhaustion", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          status: 429,
          message: "Too many requests",
          reason: "QUOTA_EXCEEDED",
        },
      }),
      { status: 429 }
    );

    const error = await spotifyAPIError("/me/top/tracks", response);

    expect(error.reason).toBe("QUOTA_EXCEEDED");
    expect(spotifyRateLimitFailure(error)).toEqual({
      status: 429,
      error: "Bwend has reached Spotify's current private-beta quota. Please try again later.",
      code: "spotify_quota_exceeded",
    });
  });

  test("preserves Retry-After for ordinary rate limiting", async () => {
    const response = new Response(
      JSON.stringify({ error: { status: 429, message: "Slow down" } }),
      {
        status: 429,
        headers: { "Retry-After": "17" },
      }
    );

    const error = await spotifyAPIError("/search", response);
    const failure = spotifyRateLimitFailure(error);

    expect(error.retryAfterSeconds).toBe(17);
    expect(failure?.code).toBe("spotify_rate_limited");
    expect(failure?.error).toContain("17 seconds");
  });
});
