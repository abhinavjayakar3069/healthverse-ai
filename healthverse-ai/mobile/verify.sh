#!/bin/bash
# Run this after any change to the mobile app - catches wiring drift
# mechanically instead of relying on manually re-reading every file.
# (This exists because I found and fixed a real duplicate-context-state
# bug during development by inspecting files instead of trusting my
# memory of a long session - same idea as backend/app/smoke_test.py,
# applied to the mobile side.)
#
# First run may take a moment if `typescript` isn't installed yet - npx
# fetches it on demand, that's normal, not an error.

set -e
cd "$(dirname "$0")"

echo "1/3 - Syntax check (catches JS/JSX errors without needing a simulator)"
npx --yes typescript@latest --version > /dev/null 2>&1 || true
npx tsc --allowJs --checkJs false --jsx react-native --noEmit --skipLibCheck \
  --noResolve --target esnext --module esnext $(find . -name "*.js" -not -path "./node_modules/*")
echo "    OK - all files are syntactically valid"
echo ""

echo "2/3 - Every screen file is actually imported in RootNavigator.js"
MISSING=0
for f in src/screens/*.js; do
  name=$(basename "$f" .js)
  if ! grep -q "import $name from" src/navigation/RootNavigator.js; then
    echo "    WARNING: $name.js exists but isn't imported in RootNavigator.js"
    MISSING=1
  fi
done
[ "$MISSING" -eq 0 ] && echo "    OK - every screen file is imported"
echo ""

echo "3/3 - Every navigate() target in MoreScreen.js has a matching Screen registration"
grep -oP "navigate\('\K[^']+" src/screens/MoreScreen.js | sort -u | while IFS= read -r target; do
  if ! grep -q "name=\"$target\"" src/navigation/RootNavigator.js; then
    echo "    WARNING: MoreScreen.js navigates to '$target' but no Screen with that name is registered"
  fi
done
echo "    (checked - see warnings above, if any)"
echo ""

echo "Done. This checks wiring consistency, not runtime behavior - still run the app for real."
