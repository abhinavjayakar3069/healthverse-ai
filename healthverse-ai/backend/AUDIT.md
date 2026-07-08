# Data & API Audit — HealthVerse AI

Full pass through every feature from the original idea: what real data/API
it needs, whether it exists and is actually usable, and what I'd recommend
given ~2.5 days left with zero mobile UI built yet. Nothing here is
guessed — every "no good option" below was verified by searching, not
assumed from memory (several things I expected to exist have actually been
discontinued — see below).

Legend: ✅ have it / real & easy · ⚠️ real but nontrivial · ❌ no good free option found

| # | Feature | Status | Real source | Notes |
|---|---|---|---|---|
| 1 | AI Health Assistant | ✅ | Gemini API (switched from OpenAI - free tier, no billing card) | Built, working |
| 2 | Disease Prediction — Diabetes | ✅ | Pima Indians dataset (trained model) | Built, validated |
| 2 | Disease Prediction — Heart/Stroke/Hypertension | ✅ | Rule-based, AHA/ACC+ADA+WHO guidelines | Built (see backend README for why not ML) |
| 2 | Disease Prediction — Kidney | ✅ | UCI Chronic Kidney Disease dataset (158 clean patients, Tamil Nadu hospital), fetched via lisds.github.io's textbook mirror after 4 other access paths failed | Trained and verified. 100% test accuracy - understand why before treating it as a headline number (some fields are direct diagnostic lab markers that near-perfectly separate the classes by themselves, e.g. urine albumin) - see backend README. Coefficient-direction check passes. |
| 2 | Disease Prediction — Liver | ✅ | LLM reasoning via `/assess/liver` (recommended) after training data stayed blocked across 5 distinct paths; `/predict/liver` ML model kept as untested reference | Genuinely working now, wired into Risk Check/Result. Reasons over age/sex/alcohol-use/any lab values provided rather than needing a fixed feature set - arguably better suited to this problem than a classifier would be, since the dataset would only ever cover ~2/10 fields for a typical phone user anyway. |
| 3 | Health Score | ✅ | Built from the above | Done |
| 4a | Medicine — OCR prescriptions | ✅ | Gemini vision (same pattern as nutrition photos) | Built. Extracted medicines populate the reminder form as suggestions to confirm, never auto-added - handwriting misreads are a real safety issue, not just a UX detail |
| 4b | Medicine — Pill recognition by photo | ❌ | **None.** NIH's Pillbox (the one real public pill-image database) was permanently retired in Jan 2021 and NLM has stated they won't reinstate it. Remaining options are commercial (LogMeal, FatSecret, etc.), no meaningful free tier. | Recommend cutting this specific sub-feature, or clearly labeling any AI guess as unverified and not a substitute for a pharmacist |
| 4c | Medicine — Drug interaction warnings | ✅ | LLM reasoning via `/medicine/check-interactions`, same pattern as liver risk, after the free RxNav interaction API was discontinued in 2024 | Built and wired in - not a verified clinical database check, and says so in every response, but genuinely working and better than nothing given no free structured alternative exists |
| 4d | Medicine — Reminders | ✅ | None needed — local notifications | Easy |
| 5 | Symptom Checker | ✅ | Gemini | Built |
| 6 | Mental Health — mood/breathing/meditation | ✅ | None needed — local content + existing chat | Easy, no new API |
| 6 | Mental Health — emotion detection | ❌ | Facial emotion detection needs a dedicated vision model; text-mood via LLM is feasible, camera-based is not realistic in this timeframe | Recommend text-based only |
| 7 | AI Nutrition (photo) | ⚠️→✅ | Dedicated food-recognition APIs (LogMeal, Spike, FatSecret) are commercial only. Built a free workaround instead: Gemini vision + your existing (free) key | Built (`analyze_meal_photo`). Accuracy is approximate the same way every photo-nutrition tool's is — surface `confidence`/`note` in the UI |
| 8 | Sleep AI | ⚠️ | Self-report already built. Snoring = audio processing, phone usage = OS screen-time APIs (Android-feasible, iOS heavily restricted) | Keep self-report only for the deadline |
| 9 | Fitness — wearable integration | ⚠️ | Google Fit API **closed to new developer sign-ups since May 2024**, full shutdown end of 2026 — don't build against it. Real replacement is Health Connect (Android) + HealthKit (iOS), both real but need a custom native build, not plain Expo Go | Self-report for the demo; real integration is genuinely a post-hackathon project |
| 10 | Emergency SOS | ✅ | None needed — device geolocation + contacts + SMS/call intents (Expo Location, Linking) | Easy, real, no external data needed |
| 11 | Doctor Dashboard — reports/summaries | ✅ | None needed — reuses existing Gemini setup + `Share.share()` | Built as "Doctor Report": generates a shareable clinical-style summary from the patient's own risk data. Reframed from "doctor logs in to view patients" to "patient generates something to bring to their doctor" — avoids needing backend accounts/auth this project doesn't have. |
| 11 | Doctor Dashboard — live chat/video consult | ❌ | Twilio Video / Agora / Daily.co all real, free tiers exist | Still not included — needs real third-party account setup + a genuine multi-user backend (patient/doctor identities, message persistence), which is a materially bigger lift than everything else in this list |
| 12 | Health Analytics | ✅ | None needed — charting on data already collected | Easy |
| 13 | Family Health | ✅ | None needed — data modeling/auth question, not a data-availability one | Easy but needs schema time |
| 14a | Outbreak Map — Air Quality | ✅ | **Real.** data.gov.in itself has a live real-time AQI resource (CPCB stations); aqicn.org's free developer API is the easier integration path and includes the same Indian stations | Built (`get_air_quality`) |
| 14b | Outbreak Map — Pollen | ⚠️ | Google Pollen API is real, 5,000 free calls/month, but requires enabling billing (card on file) even to stay in the free tier | Doable, ~30-60 min setup overhead, not blocking |
| 14c | Outbreak Map — Dengue/Flu/COVID alerts | ❌ | **None found.** India's real surveillance (IDSP/NCVBDC) publishes for institutional/research use, not as a queryable public API. | Don't fake this. Either drop live outbreak alerts, or substitute WHO's global Disease Outbreak News feed (real, but not hyperlocal — a materially weaker feature) |
| 15 | Voice Assistant | ✅ | Gemini native audio input (speech-to-text, multilingual - replaces Whisper, genuinely untested with real audio yet, see ai_assistant.py) + on-device TTS (`expo-speech`, free) | Real and buildable. Regional Indian language quality varies by language — test with your actual target languages early, don't assume uniform quality. Verify Gemini accepts your recorded .m4a files specifically before relying on this - see the caveat in transcribe_audio()'s docstring |

## Bottom line for the next 2.5 days

Everything marked ❌ above is a genuine dead end, not a search failure —
don't spend hours hunting for these, they don't exist for free right now.

Everything marked ✅ is either already built or trivial (no new API/data
needed, just engineering time).

The ⚠️ items are real but each costs meaningfully more time than a ✅. With
no mobile screens built yet, I'd treat kidney/liver models, nutrition
photo UI, air quality UI, and voice as genuine stretch goals — valuable if
there's time on day 3, but the app needs to work end-to-end on the ✅ items
first. Better to demo 6 features that work perfectly than 15 where half
are flaky.
