# Testing Checklist

Ordered by risk — do these in order. Each item says exactly what to do and
exactly what "correct" looks like, so there's no ambiguity while you're
moving fast against a deadline. Check things off as you go; write down
anything that doesn't match expected, then fix and re-check just that item
before moving on.

## Phase 0 — Backend sanity (2 min, do this first)

- [ ] `cd backend && bash setup.sh`
- [ ] `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- [ ] Open `http://localhost:8000/docs` — expect the full Swagger list of
      endpoints. If this doesn't load, nothing else will work — fix this first.
- [ ] In `/docs`, try `POST /predict/diabetes` with `{"age": 45, "sex": "M"}`
      — expect a JSON response with `risk_percent`, `risk_category`. This
      confirms the trained model loads correctly outside my sandbox.
- [ ] Try `POST /predict/kidney` with `{"age": 45}` — same expectation.
      This confirms the kidney model (real data, verified this session)
      also loads correctly.

## Phase 1 — Mobile boots at all (5 min)

- [ ] `cd mobile && bash setup.sh`, then copy `App.js` + `src/` into the
      generated `healthverse-mobile` project (see mobile/README.md)
- [ ] **Before** `npx expo start`: edit `src/api/client.js`, set
      `API_BASE_URL` to your machine's LAN IP (not `localhost`) if testing
      on a physical device — this is the single most likely thing to look
      like a bug but isn't. Emulator-specific values are in the README.
- [ ] `npx expo start`, scan QR with Expo Go (or press `a`/`i`)
- [ ] App opens without a white screen or immediate crash
- [ ] Bottom tab bar shows 4 tabs: Home, Assistant, Risk Check, More

## Phase 2 — Home screen (2 min)

- [ ] Home loads, shows the health score ring (may show partial/default
      score first time — expected, no risk data yet)
- [ ] Pull down to refresh — spinner shows, then updates
- [ ] If it shows a red error banner instead: check Phase 0 passed and
      `API_BASE_URL` is right

## Phase 3 — Core demo loop: Risk Check (5 min)

- [ ] Go to Risk Check tab, fill in age/sex/weight/height/BP (use round
      numbers, e.g. 45/M/70/170/130/85)
- [ ] Tap "Check my risk" — loading spinner shows
- [ ] Lands on Results screen showing **6 cards**: Diabetes, Heart, Kidney,
      Liver, Hypertension, Stroke — each with a risk % or category badge
- [ ] Tap "See it reflected in my Health Score" — returns to Home, ring
      has updated with new numbers (not the same as Phase 2's default)
- [ ] Go to Health Analytics (More tab) — should show one data point now

## Phase 4 — AI Assistant + Symptom Checker (5 min, needs OpenAI key set)

- [ ] Assistant tab, type "I have a headache" — expect a real, coherent
      reply within a few seconds, not an error
- [ ] Tap "Symptom checker" toggle, describe a symptom — expect it to ask
      a follow-up question before giving an assessment
- [ ] Type something urgent-sounding ("chest pain") — expect the coral
      "seek emergency care" banner to appear

## Phase 5 — Photo features (5 min, needs OpenAI key + camera)

- [ ] More -> AI Nutrition, take/pick a photo of any food — expect
      calorie/macro estimates with a confidence badge within ~10 sec
- [ ] More -> Smart Medicine -> "Scan a prescription" — take a photo of
      any printed text (a book page is fine for testing) — expect
      extracted text attempt, not a crash

## Phase 6 — Device-only features, no backend needed (5 min)

- [ ] More -> Emergency SOS — fill in a fake contact, tap "Send SOS" —
      expect your phone's real SMS app to open pre-filled (don't actually
      send it)
- [ ] More -> Fitness — expect a step count if on real hardware, or the
      "not available on simulator" message if on an emulator — both are
      correct, different, expected outcomes
- [ ] More -> Mental Health -> Start breathing exercise — expect the
      4-4-6 cycle to actually change phase and countdown correctly (this
      specific logic was verified by simulation, worth confirming for real)

## Phase 7 — Persistence (3 min)

- [ ] More -> Family Health, add a member, force-close the app completely,
      reopen — member should still be there (AsyncStorage persistence)
- [ ] Same check for a Mental Health mood check-in

## Phase 8 — Everything else in More (10 min)

- [ ] Voice Assistant — tap Speak, say something, expect transcription +
      spoken reply. This is the least-verified feature in the whole
      project — if something's going to misbehave, it's probably this one
- [ ] Doctor Report — after doing a Risk Check, generate a report, expect
      readable text, tap Share, expect the native share sheet to open
- [ ] Voice Assistant, Workout plan (Fitness tab) — expect real generated
      text, not an error

## If something breaks

Check the error message shown in-app first — every screen shows a
specific, actionable message (not just "error") for exactly this reason.
Most likely causes, in order of likelihood: `API_BASE_URL` wrong, backend
not running, OpenAI key not set/invalid, a permission denied on the phone.

`python3 check_consistency.py` (from `mobile/`) and `python3 -m
app.smoke_test` (from `backend/`) both still pass as of this session —
if something's broken, it's very likely something only a real device
triggers, which is exactly what this checklist exists to find.
