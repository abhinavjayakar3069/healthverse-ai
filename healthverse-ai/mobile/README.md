# HealthVerse AI — Mobile

React Native (Expo) app consuming the backend. **I could not run or test
this the way I tested the Python backend** — no simulator/emulator and no
internet for `npm install` in my sandbox. Everything here follows
standard, well-established Expo/React Navigation patterns, but please run
it first thing and expect to spend a little time on it — that's the honest
expectation, not "should just work."

## Verify before you run it

`bash verify.sh` — run this after any change, same idea as the backend's
`smoke_test.py`. Checks JS/JSX syntax across every file, that every screen
file is actually imported in the navigator, and that every `navigate()`
call in the More hub points at a real registered screen. It won't catch
runtime bugs, but it catches wiring mistakes in about 2 seconds instead of
however long it'd take to find them by tapping around the app.

## Setup

**Quick start**: `bash setup.sh` runs everything below in one go.

I didn't hand-write `package.json` with pinned versions, on purpose:
Expo SDK versions move roughly every few months, and guessing versions
from memory risks giving you an incompatible set. Instead, scaffold fresh
(pulls whatever's actually current) and drop these files in:

```bash
npx create-expo-app@latest healthverse-mobile
cd healthverse-mobile

npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
npx expo install react-native-svg
npx expo install expo-location
npx expo install expo-image-picker
npx expo install expo-notifications
npx expo install expo-av
npx expo install expo-speech
npx expo install expo-sensors
npx expo install @react-native-async-storage/async-storage

# Now copy this project's App.js (overwrite the default one) and the whole
# src/ folder into your new healthverse-mobile project.

npx expo start
```

Scan the QR code with Expo Go (fastest), or press `a`/`i` for an
emulator/simulator if you have one set up.

## First thing to fix: the backend URL

`src/api/client.js` has `API_BASE_URL = 'http://localhost:8000'`. On a
phone or the Android emulator, `localhost` means *the phone*, not your
laptop. Before anything else works:

- **Physical phone (Expo Go)**: change it to your computer's LAN IP, e.g.
  `http://192.168.1.42:8000` (find it with `ipconfig`/`ifconfig`). Phone
  and laptop need to be on the same Wi-Fi.
- **Android emulator**: use `http://10.0.2.2:8000`.
- **iOS simulator**: `localhost` works as-is since it shares your Mac's
  network.

## What's built

- **Home** — the Health Score dashboard (the circular score + Heart/Sleep/
  Stress/Fitness/Nutrition breakdown from your original pitch)
- **Assistant** — AI Health Assistant chat, with a toggle at the top to
  switch into Symptom Checker mode (same UI, different backend endpoint
  and system prompt, separate conversation history)
- **Risk Check** — intake form -> calls diabetes/heart/hypertension/stroke
  endpoints together -> results screen with contributing factors and tips
- **More** — a hub listing all 15 original features. All fifteen have
  real functionality now (a few specific sub-pieces within them are still
  explicitly gapped - see below): Assistant, Disease Prediction, Health
  Score, Symptom Checker, Emergency SOS (real device geolocation +
  `tel:`/`sms:`), AI Nutrition (camera/gallery -> GPT-4o vision), Mental
  Health (mood check-in + breathing exercise), Family Health (multi-member
  profiles), Health Analytics (SVG line chart of `scoreHistory`, no new
  charting dependency, one snapshot per Home visit), Disease Outbreak Map
  (live air quality via device location - outbreak alerts explicitly
  labeled unavailable rather than silently missing, since no public India
  surveillance API exists), Smart Medicine (real local notifications via
  `expo-notifications`, PLUS prescription photo scanning via GPT-4o vision
  - extracted medicines populate the form as tap-to-fill suggestions, never
  auto-added as a reminder, since a misread dose is a safety issue not a
  UX nicety - PLUS drug interaction checking via LLM reasoning, since the
  free structured API for that was discontinued in 2024; explicitly not a
  verified clinical check and says so in every response), Voice Assistant
  (record -> Whisper transcription -> chat reply -> spoken back via
  on-device TTS), Fitness (real step counting via `expo-sensors` Pedometer,
  PLUS AI-generated workout plans - cross-device wearable sync still needs
  a native build
  and isn't included), and Doctor Report (generates a shareable
  clinical-style summary from your risk assessments + health score history
  via `Share.share()`, the core React Native API - the "view reports, AI
  summaries" slice of the original Doctor Dashboard idea; live chat with a
  doctor and video consultation are NOT included, both need real backend
  accounts and a video SDK - Twilio/Agora/Daily.co - that don't exist here).
  Voice is the least verified thing in this project - audio recording/
  upload has more moving parts than anything else here and I have zero
  ability to test audio in my sandbox. Try it early.

  Correction to something I said earlier in this session: I'd lumped all
  of "Fitness AI" in with Health Connect/HealthKit's native-build
  complexity and called the whole thing a post-hackathon item. That was
  too quick - step counting specifically doesn't need any of that, it's
  plain on-device sensor access. Workout plans and wearable sync still
  need the native build path and are still not included.

  Two scoping notes worth knowing: Family Health is profile management
  only, not yet wired to *run* a risk check or health score *for* a
  specific member (would mean restructuring how Risk Check/Home store
  data, which already work - didn't want to risk breaking those for a
  fast add). Mental Health, Family Health, and Health Analytics all
  persist locally now (see below) - none of them reset on app restart
  anymore.

Shared state (profile, lifestyle inputs, risk results, emergency contact,
family members, score history, mood check-ins) lives in
`src/context/AppContext.js` and persists on-device via
`@react-native-async-storage/async-storage` - survives closing/reopening
the app, though it stays on that one phone (no account, no cross-device
sync - a bigger, different problem than the one this solves). Hydrates
once on launch, saves on every change, and one corrupt stored key can't
crash the app or take the other five down with it (each is parsed
independently). Mood check-ins were the last piece added to this pattern -
initially left as a local-only exception to keep the first pass's blast
radius smaller, closed once the rest was verified solid. No backend user
accounts exist either way - that's a bigger, separate piece of work.

The backend also has a parallel, independently-tested SQLite persistence
layer (`backend/app/db.py` - family members, mood check-ins, score
history, emergency profile, keyed by a device_id) that the mobile app
does NOT call. It was built as a step toward real multi-device sync, but
the on-device AsyncStorage approach above already solves the actual
problem ("survives an app restart") more simply and without a network
dependency for basic CRUD - using both together would be redundant,
conflicting complexity for the same data. The backend layer is real,
tested, and available if multi-device sync becomes an actual requirement
later; it's just not wired to anything in this app today. See backend
README's persistence section for the full reasoning.

## Per-screen error boundaries

Every screen is wrapped in its own `ErrorBoundary` (`src/components/ErrorBoundary.js`)
in `RootNavigator.js`. If one screen crashes, it shows a "something went
wrong, try again" fallback instead of a white screen taking down the
whole app - other tabs keep working. Given no device testing has happened
yet, this is real insurance against exactly the kind of surprise a first
run tends to produce.

## Consistency checker

`python3 check_consistency.py` (from this `mobile/` directory) - catches
the exact bug class that caused every real issue found this session: a
screen destructuring a context field, calling an api.client method, or
navigating to a route that doesn't actually exist. All three fail
silently until someone taps the right thing on a real device; this
catches them statically in about a second. Run it after any edit that
touches `AppContext.js`, `api/client.js`, or `RootNavigator.js`.

## Doctor video consultation (dormant, needs an account + dev client)

`src/screens/DoctorVideoScreen.js` - real join code against
`@daily-co/react-native-daily-js`, not wired into navigation. To activate:

1. Sign up free at [daily.co](https://daily.co), get an API key from the dashboard
2. Set `DAILY_API_KEY` in `backend/.env` (same pattern as `OPENAI_API_KEY`)
3. Needs the same dev-client switch as wearable sync above (native code,
   not available in Expo Go), plus:

```bash
npx expo install @daily-co/react-native-daily-js @react-native-async-storage/async-storage react-native-background-timer react-native-get-random-values
npx expo install @daily-co/react-native-webrtc@124.0.6-daily.1 --save-exact
npx expo install config-plugin-rn-daily-js
```

Add to `app.json`:
```json
{
  "expo": {
    "plugins": ["config-plugin-rn-daily-js"]
  }
}
```

Then `npx expo prebuild` and run via the dev client. Once activated,
uncomment the `require('@daily-co/react-native-daily-js')` line in
`DoctorVideoScreen.js` (currently deferred so this file doesn't crash on
import before the package exists) and wire the screen into
`RootNavigator.js`'s More stack the same way `DoctorReportScreen` is.

Genuinely unverified - no account, no dev client, no internet in my
sandbox to try any part of this end-to-end. Package versions/APIs above
are transcribed from Daily's docs as of this session - worth a quick
check against their current README given how fast WebRTC tooling moves.

## Wearable sync (dormant, needs a workflow switch)

`src/hooks/useHealthPlatformSteps.js` - real integration code against
`react-native-health-connect` (Android) and `@kingstinct/react-native-healthkit`
(iOS), not wired into any screen yet so it can't break the current Expo
Go setup. To activate:

```bash
npx expo install expo-dev-client
npx expo install react-native-health-connect expo-health-connect expo-build-properties
```

Add to `app.json` (merge into your existing config, don't replace it):
```json
{
  "expo": {
    "plugins": [
      "expo-health-connect",
      ["expo-build-properties", {
        "android": { "compileSdkVersion": 35, "targetSdkVersion": 35, "minSdkVersion": 26 }
      }]
    ]
  }
}
```

For Android, add to `android/app/src/main/java/.../MainActivity.kt`
(package name and class will already match your project - only the two
marked lines are new):
```kotlin
import android.os.Bundle
import com.facebook.react.ReactActivity
// ... your existing imports ...
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate  // NEW

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"  // whatever it already says, leave as-is

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    HealthConnectPermissionDelegate.setPermissionDelegate(this, "com.google.android.apps.healthdata")  // NEW
  }
}
```

Then `npx expo prebuild` and run on a real device via the dev client (not
Expo Go). iOS needs the equivalent HealthKit capability added in Xcode -
`@kingstinct/react-native-healthkit`'s own README has the current steps
since this is more Xcode-project-specific than a drop-in snippet.

These snippets are transcribed from the packages' own documentation as of
this session - always worth a quick check against their current README in
case the API moved since. None of this is tested - no native build
tooling in my sandbox.

## Not built yet (see backend `AUDIT.md` for the full picture)

Full wearable/cross-device sync (Health Connect/HealthKit need a native
build beyond Expo Go) and Doctor Dashboard's live chat/video (needs real
backend accounts + a video SDK). Kidney/liver disease
models: real data confirmed to exist, but I couldn't fetch it into my
sandbox this session — download from Kaggle (`mansoordaku/ckdisease`)
and it'll drop into the same `train.py` pattern as diabetes.

## Design choices

Sage green + warm off-white instead of the generic "medical blue on white"
look — deliberate, not default. Tokens are in `src/theme.js` if you want
to adjust. Tab icons are emoji for now (zero extra dependencies, zero
chance of breaking the demo) — swap for `@expo/vector-icons` when there's
time to polish.
