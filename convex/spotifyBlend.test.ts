import { describe, expect, test } from "vitest";
import { normalizeSpotifyBlendURL } from "./lib/spotifyBlend";

describe("Spotify Blend URL normalization", () => {
  test("extracts the link from Spotify's full share message", () => {
    const shared =
      "Jude Okun has invited you to join a Blend on Spotify. Join on the Spotify mobile app. " +
      "https://open.spotify.com/blend/taste-match/fb222dd96752c99b?si=ZyrpkPylTGSBaFw5UALt7w&fallback=getapp&blendDecoration=5f9c38d2";

    expect(normalizeSpotifyBlendURL(shared)).toBe(
      "https://open.spotify.com/blend/taste-match/fb222dd96752c99b?si=ZyrpkPylTGSBaFw5UALt7w&fallback=getapp&blendDecoration=5f9c38d2"
    );
  });

  test("drops unrelated query parameters and sentence punctuation", () => {
    expect(
      normalizeSpotifyBlendURL(
        "Open https://open.spotify.com/blend/taste-match/abcdefgh?si=share&utm_source=tracking."
      )
    ).toBe("https://open.spotify.com/blend/taste-match/abcdefgh?si=share");
  });

  test.each([
    "http://open.spotify.com/blend/taste-match/abcdefgh",
    "https://open.spotify.com.evil.example/blend/taste-match/abcdefgh",
    "https://open.spotify.com/playlist/abcdefgh",
    "https://open.spotify.com/blend/taste-match/short",
    "not a URL",
  ])("rejects a non-Blend input: %s", (input) => {
    expect(normalizeSpotifyBlendURL(input)).toBeNull();
  });
});
