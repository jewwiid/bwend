#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IOS_DESTINATION="${IOS_TEST_DESTINATION:-platform=iOS Simulator,name=iPhone 17 Pro}"

cd "${PROJECT_ROOT}"
npm run lint
npm run build
npm test
npm run release:audit
npx convex dev --once
npx convex run privacyActions:selfCheck '{}'
npx convex run listeningPortrait:selfCheck '{}'
git diff --check

cd "${PROJECT_ROOT}/bwend-ios"
xcodegen generate
plutil -lint BwendApp/Info.plist BwendApp/Resources/PrivacyInfo.xcprivacy BwendApp/Bwend.entitlements
xcodebuild \
  -project Bwend.xcodeproj \
  -scheme Bwend \
  -sdk iphonesimulator \
  -destination "${IOS_DESTINATION}" \
  CODE_SIGNING_ALLOWED=NO \
  test
xcodebuild \
  -project Bwend.xcodeproj \
  -scheme Bwend \
  -configuration Release \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  CODE_SIGNING_ALLOWED=NO \
  build

echo "Release checks passed."
