#!/bin/bash
# Mobile setup - run this instead of typing each expo install by hand.
# Run from wherever you want the new project created (NOT inside this
# healthverse-ai folder) - this creates a fresh sibling project.
set -e

echo "== Scaffolding a fresh Expo project (pulls current SDK versions) =="
npx create-expo-app@latest healthverse-mobile
cd healthverse-mobile

echo "== Installing navigation dependencies =="
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

echo "== Installing feature dependencies =="
npx expo install react-native-svg
npx expo install expo-location
npx expo install expo-image-picker
npx expo install expo-notifications
npx expo install expo-av
npx expo install expo-speech
npx expo install expo-sensors
npx expo install @react-native-async-storage/async-storage

echo ""
echo "Dependencies installed into ./healthverse-mobile."
echo "Next steps:"
echo "  1. Copy this project's App.js (overwrite the default) and the"
echo "     entire src/ folder into ./healthverse-mobile"
echo "  2. Edit src/api/client.js -> set API_BASE_URL to your backend's"
echo "     actual reachable address (NOT localhost if using a physical"
echo "     device or Android emulator - see README.md's networking note)"
echo "  3. cd healthverse-mobile && npx expo start"
echo "  4. From the healthverse-ai project root: python3 mobile/check_consistency.py"
echo "     (run this after any further edits to catch wiring mistakes fast)"
