# HealthVerse AI

## Status as of this session

**Backend** (`/backend`) — built and tested. Diabetes (trained ML model),
heart/stroke/hypertension (rule-based), health score, AI chat, symptom
checker, nutrition-photo analysis, air quality all working. Full detail
and the "why heart disease isn't ML" story in `backend/README.md`.

**Data/API audit** (`backend/AUDIT.md`) — every feature from the original
idea checked against real, current data sources. Nothing faked; anything
that doesn't have a real free option is labeled clearly rather than
papered over.

**Mobile** (`/mobile`) — Expo/React Navigation app. Every one of the 15
original feature categories now has real, working functionality (Home,
chat + symptom checker, Risk Check, Emergency SOS, AI Nutrition, Mental
Health, Family Health, Health Analytics, Disease Outbreak/Air Quality,
Smart Medicine reminders + prescription scanning, Voice Assistant, Fitness
step-counting + workout plans, Doctor Report, plus the More hub tying it
together). A handful of specific sub-pieces within those categories are
still explicitly not included, each for a documented reason rather than
being overlooked: pill-photo identification (NIH retired the only free
database in 2021 and nothing replaced it), cross-device wearable sync
(Health Connect/HealthKit need a custom native build, not plain Expo Go),
live doctor chat/video (needs real backend accounts + a video SDK), and
live India disease-outbreak alerts (no public API exists). Drug
interaction checking *is* included now, the same way liver risk is: the
free structured API for it was discontinued in 2024, so it uses LLM
reasoning instead - not a verified clinical database, and it says so in
every response, but genuinely working. Kidney disease prediction is
trained, verified (real data, 158 patients, 100% test accuracy — see
backend README for what that number does and doesn't mean), and wired
into the Risk Check/Result flow alongside diabetes/heart/hypertension/
stroke. Liver disease is genuinely working too now, just differently:
its training dataset stayed blocked across five distinct paths tried, so
instead of a trained classifier it uses LLM reasoning over whatever's
actually available (age/sex minimum, ideally alcohol use and any lab
values) — arguably a better fit anyway, since that dataset would only
ever cover ~2/10 fields for a typical phone user. The original trained-
classifier attempt is kept in the code as an untested reference (see
backend README's liver section) but isn't what the app actually uses.
Syntax-verified across all 27 files but **not run on a device** — I don't
have a simulator or emulator here. Run it first thing. Voice Assistant is
the least-verified *working* feature (audio has the most moving parts and
I can't test audio at all in my sandbox) — try that one early too, not
just the app in general.

## Order to do things in when you're back

1. `cd backend`, follow its README, run `uvicorn` — confirm `/docs` loads
   and a couple of endpoints respond (2 min, catches any environment
   issues immediately, independent of anything else)
2. `cd mobile`, follow its README, get `npx expo start` running — fix the
   `API_BASE_URL` gotcha (explained in mobile/README.md) before anything
   else, it's the #1 thing that looks like a bug but isn't
3. Walk through Home -> Risk Check -> back to Home and confirm the score
   updates — that's your core demo loop working end-to-end
4. From there: liver disease needs its own real dataset the same way
   kidney just got one (see backend README's liver section for the
   access story so far) - that plus wearable sync and the doctor
   video/chat piece are the remaining real gaps, all documented in
   `backend/AUDIT.md`

## Everything else

Full technical detail lives in `backend/README.md` and `mobile/README.md`
— didn't want to duplicate it all up here and risk it drifting out of
sync. `DEMO_SCRIPT.md` has a 3-minute walkthrough plus prepared answers
for the questions worth expecting. `TESTING_CHECKLIST.md` is the exact,
ordered list for the one thing I genuinely cannot do myself — running
this on a real device — so that phase goes as fast as possible when you
do it.
