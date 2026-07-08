# HealthVerse AI — Backend

FastAPI backend for the disease-risk, health-score, and AI-assistant features.

## Setup (run this first, before building UI on top of it)

**Quick start**: `bash setup.sh` does everything below in one go, including
running the smoke test at the end to confirm the code itself is sound
before you even start the server.

Or step by step:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then paste your real OpenAI key into .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000/docs** — Swagger UI where you can call every
endpoint directly. This is genuinely useful for the hackathon demo itself:
you can show working predictions before the mobile UI is even wired up.

The diabetes and heart-disease models are already trained (`app/ml/*.pkl`
are committed). To retrain from scratch: `python -m app.ml.train`.

## Run the smoke test

```bash
python3 -m app.smoke_test
```

Checks the actual logic (diabetes model direction, rule-based risk
ordering, hypertension staging thresholds, health score aggregation, AQI
categories) plus that every name `main.py` imports genuinely exists —
this is exactly the kind of check that catches a duplicated or
disconnected piece of state, which is a real mistake I made and fixed
earlier in this build (see chat history if you want the full story).
Run this after any change to the backend, not just once at the start.

## Smoke test

`python3 -m app.smoke_test` — run this after any change. Stdlib-only, no
pytest needed. Checks the diabetes model scores sensibly, the rule-based
engines are correctly directioned (healthy < risky, right BP staging),
health score handles missing data without crashing, and every name
`main.py` imports from `app.*` actually exists (catches wiring mistakes
mechanically rather than relying on manually reading the code — this
exists because I found and fixed a real duplicate-state bug in the mobile
app by inspecting files instead of trusting my memory of the session, and
wanted the same discipline available as a two-second command going
forward, not just a one-off habit).

## Persistence (SQLite) — built, tested, currently unused by the mobile app

Family Health, Mental Health check-ins, Health Score history, and the
Emergency profile all needed to survive an app restart. I built this
SQLite layer (`app/db.py`, Python's built-in `sqlite3`, no new
dependency) to solve that - fully tested end-to-end (see
`smoke_test.py`'s "Persistence" section, the one piece of new backend
work this session I could verify myself without a phone or network.

**Then I found the mobile app already had its own solution** for the
same problem, built earlier in this session before context got trimmed:
`AppContext.js` persists the same data directly on-device via
`@react-native-async-storage/async-storage` - no network dependency for
basic CRUD, no device_id scheme needed, already correctly handling the
hydration-race-condition edge case. That's a simpler, lower-risk fix for
the actual problem ("survives a restart"), so the mobile app uses that,
not this.

This SQLite layer is still real and still passes every test - it's the
foundation you'd want if this ever needs actual multi-device sync (a
different, bigger problem than what's solved today). It's just not wired
to anything right now. New endpoints exist (`GET/POST /family/{device_id}`,
`DELETE /family/{device_id}/{member_id}`, `GET/POST /mood/{device_id}`,
`GET/POST /health-score/history/{device_id}`, `GET/POST
/emergency-profile/{device_id}`, all in `/docs`) in case you want them
later; nothing currently calls them.

Same device_id caveat as always: not real authentication, just enough to
separate one installation's data from another's for a demo.

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/predict/diabetes` | POST | Trained ML model (logistic regression, ~71% accuracy / 0.81 ROC-AUC on held-out test data) |
| `/predict/kidney` | POST | Trained ML model - **trained and verified this session**, see below |
| `/predict/liver` | POST | Trained ML model - **untested by me, and only ~2/10 fields are self-reportable even in principle**, see below |
| `/predict/heart` | POST | Rule-based risk score (see "Why heart disease is rule-based" below) |
| `/predict/stroke` | POST | Rule-based risk score |
| `/predict/hypertension` | POST | AHA/ACC 2017 blood pressure staging |
| `/health-score` | POST | Aggregates sub-scores into the dashboard `/100` score |
| `/chat` | POST | AI Health Assistant (OpenAI-backed) |
| `/symptom-checker` | POST | Structured symptom flow (OpenAI-backed) |

All request/response shapes are in `app/models.py` and visible live in
`/docs`.

## Kidney disease model — trained and verified

Took five attempts across two sessions to get real data (GitHub raw
mirrors blocked by robots.txt, Kaggle needs login, the official UCI
archive serves a `.zip` my fetch tool can't read as text, HuggingFace
didn't have a fetchable tabular copy) — a data-science textbook site
(lisds.github.io, mirroring the same UCI dataset with missing rows
already dropped) finally worked. `data/kidney_clean.csv` has the real
158-patient result; `train_kidney_model()` in `app/ml/train.py` trains
against it directly, no `ucimlrepo`/internet needed anymore for this one.

**Real result**: 100% test accuracy, and the coefficient-direction check
passes (bp/hypertension/diabetes/blood urea/creatinine all correctly
increase predicted risk). Worth understanding *why* accuracy is 100%
before treating it as a headline win, though: several fields in this
dataset (urine albumin, specific gravity) are direct diagnostic lab
markers, not epidemiological risk factors — every single non-CKD patient
in the data has albumin exactly 0. That's a real clinical signal, not a
modeling artifact, but it also means a typical phone user (who can't
supply those lab values) will see `data_completeness` far below 100% and
a correspondingly less certain result — the training accuracy describes
the dataset, not what any given user should expect to get.

## Liver disease — two endpoints, use `/assess/liver`

**`/assess/liver` (recommended)**: LLM reasoning, not a trained classifier
— built after the training dataset stayed genuinely blocked across every
path tried (GitHub raw, Kaggle, official UCI archive, HuggingFace, an R
package's docs — five distinct attempts, all confirmed dead ends, not one
half-hearted search). This turned out to arguably be the better fit
anyway: the dataset's 10 fixed lab fields would only ever cover ~2/10 for
a typical phone user (only age/gender are self-reportable; bilirubin,
liver enzymes, protein/albumin all need a blood test), while this reasons
over whatever's actually available — age/sex at minimum, ideally alcohol
use (a major real-world risk factor the dataset doesn't even include) and
any lab values someone happens to have. Same honesty pattern as
symptom-checking: it says plainly when it doesn't have enough to go on
rather than guessing.

**`/predict/liver` (kept for reference, not recommended)**: the original
trained-classifier attempt. Still untested — same fetch situation as
kidney initially was, but no breakthrough came for this one. Two things
worth knowing if you dig into it: I don't know ucimlrepo's exact column
names for this dataset with full confidence (`train_liver_model()` prints
the real `feature_names` - check that output before assuming anything),
and it still needs `pip install ucimlrepo && python -m app.ml.train`,
reads the coefficient-direction check before trusting it, and fails
safely (503, not a crash) until trained.

## Why heart disease is rule-based, not ML

I trained a model on the standard UCI/Cleveland heart disease dataset the
same way as diabetes, but checking its learned coefficients turned up a
real problem: **it had learned that being male, having classic chest pain,
and having higher cholesterol all *lower* predicted risk** — backwards from
real cardiology. This is a known property of that specific dataset: it only
contains patients who were already referred for cardiac catheterization, so
its correlations reflect *who got referred*, not general-population risk
(a classic case of selection/collider bias). Shipping that model would mean
telling healthy people they're high-risk and vice versa.

The diabetes model's coefficients, by contrast, all point the direction
real medicine expects (glucose ↑ risk, BMI ↑ risk, age ↑ risk), so it's
safe to use. Training code for both is still in `app/ml/train.py` if you
want to inspect this yourself or try a less-biased combined dataset later
(Cleveland+Hungary+Switzerland+VA is the standard upgrade path).

Heart disease, stroke, and hypertension instead use `app/rules_engine.py`
— transparent point systems built from standard public guidelines (AHA/ACC
blood pressure staging, ADA glucose categories, WHO BMI categories). Every
threshold is cited in the code comments. This is also just good practice
for a demo: you can explain *exactly* why a score came out the way it did,
which a black-box model can't give you on stage.

## `data_completeness` — read this before building the input form

Several clinical fields (resting ECG, exercise stress test results,
angiogram findings) can't be self-reported from a phone. The API fills
these with population averages/medians and reports how many fields were
real vs. estimated in `data_completeness`. **Surface this in the UI**
("6/8 fields from you — add a recent blood test for a sharper estimate")
rather than hiding it; it's honest and it's a good hackathon talking point.

## Not medical advice

Every prediction endpoint is a general risk-factor screener, not a
diagnostic tool. The mobile app should keep a visible "this isn't a
diagnosis — talk to a doctor" framing near every risk score and symptom
result, and the AI assistant's system prompt (`app/ai_assistant.py`) is
built to reinforce that rather than override it.

## Next up

Mobile app (React Native) consuming these endpoints — say the word and
I'll start on that next.
