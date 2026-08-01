import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];

function requireText(path, pattern, explanation) {
  const value = read(path);
  if (!pattern.test(value)) failures.push(`${path}: ${explanation}`);
}

function forbidText(path, pattern, explanation) {
  const value = read(path);
  if (pattern.test(value)) failures.push(`${path}: ${explanation}`);
}

requireText(
  "bwend-ios/project.yml",
  /TARGETED_DEVICE_FAMILY:\s*"1"/,
  "the current release must remain iPhone-only"
);
forbidText(
  "bwend-ios/project.yml",
  /TARGETED_DEVICE_FAMILY:\s*"1,2"/,
  "iPad support requires a separately tested layout and 13-inch screenshots"
);
requireText(
  "bwend-ios/project.yml",
  /BWEND_NOTIFICATIONS_ENABLED:\s*false/,
  "notifications must stay disabled until APNs is verified on real devices"
);
forbidText(
  "bwend-ios/BwendApp/Bwend.entitlements",
  /aps-environment/,
  "the disabled notification feature must not ship a push entitlement"
);
forbidText(
  "bwend-ios/project.yml",
  /NSAppleMusicUsageDescription/,
  "do not declare an Apple Music permission when the app does not use MusicKit"
);
requireText(
  "bwend-ios/BwendApp/Resources/PrivacyInfo.xcprivacy",
  /<key>NSPrivacyTracking<\/key>\s*<false\/>/,
  "privacy manifest must declare that Bwend does not track"
);
requireText(
  "bwend-ios/BwendApp/Resources/PrivacyInfo.xcprivacy",
  /NSPrivacyAccessedAPICategoryUserDefaults[\s\S]*CA92\.1/,
  "UserDefaults use needs the approved app-only reason"
);

const termsVersion = "2026-08-01.beta-v2";
for (const path of [
  "convex/lib/privacyConstants.ts",
  "src/lib/spotifyAuth.ts",
  "bwend-ios/BwendApp/Core/Networking/APIClient.swift",
]) {
  if (!read(path).includes(termsVersion)) {
    failures.push(`${path}: current Beta Terms version is not aligned`);
  }
}

const privacyVersion = "2026-08-01.2";
for (const path of [
  "convex/lib/privacyConstants.ts",
  "src/lib/spotifyAuth.ts",
  "bwend-ios/BwendApp/Features/Onboarding/SpotifyConnectView.swift",
]) {
  if (!read(path).includes(privacyVersion)) {
    failures.push(`${path}: current privacy version is not aligned`);
  }
}

if (failures.length > 0) {
  console.error("Release configuration audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release configuration audit passed.");
