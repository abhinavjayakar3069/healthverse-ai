# Demo Script — HealthVerse AI

A ~3-minute walkthrough that leads with what's genuinely strong, and a
prepared set of answers for the questions a sharp judge (or you, testing
this yourself) will actually ask. Adjust timing to whatever slot you get.

## The 3-minute walkthrough

**0:00 — Open on Home.** The health score ring is the strongest visual in
the app — lead with it, not a slide. Say what it is in one sentence: "One
score, built from real risk factors and your own habits, not a gimmick
number." Point at the Heart/Sleep/Stress/Fitness/Nutrition breakdown.

**0:30 — Risk Check.** Fill it live if you can (takes 15 seconds with
round numbers). Hit submit, land on results. This is the moment to say
the one sentence that separates this project from most hackathon health
apps: **"Diabetes risk is a real trained model. Heart disease isn't — we
found our first version had a dataset bias problem and swapped it for a
transparent rule-based engine instead of shipping something that lies to
healthy people."** That single sentence does more work than any feature
count. Judges have seen fifteen "AI predicts your risk" pitches; they
have not seen one that caught and explained its own model's bias.

**1:15 — Assistant, toggle to Symptom Checker.** Ask it something simple
("I've had a headache for two days"). Let it ask a follow-up. This shows
the guided-flow behavior, not just a chatbot wrapper.

**1:45 — Pick ONE more feature based on your audience:**
- Technical judges: Emergency SOS (real device GPS + SMS, zero backend
  dependency, works even if your API is down) or the Doctor Report (AI
  summary generation from structured data).
- Product/design judges: the More hub — scroll it once, let them see
  every original idea accounted for, nothing silently dropped.

**2:30 — Close with the audit, not a features list.** "We know exactly
what's real and what isn't in every corner of this app, down to *why* —
some things don't have a good API to build on yet, and we said so instead
of faking a demo." This is the actual thesis of the project: engineering
honesty as a feature, not just code.

## Questions a sharp judge will ask, and the honest answer

**"What's the model accuracy?"**
Diabetes: ~71% test accuracy, 0.81 ROC-AUC, on the Pima Indians dataset
(768 patients) — solid for a hackathon timeframe, not clinical-grade.
Heart/stroke/hypertension are rule-based (AHA/ACC, ADA, WHO guidelines),
not ML, and here's why (see above) — say it before they ask, it's a
strength not a gap.

**"Is this a real diagnosis tool?"**
No — general risk-factor screening, framed that way everywhere in the
app. Every result carries a "talk to a doctor" note, not a diagnosis.

**"Why isn't [X] built?"** (pill photo ID / drug interactions / live
outbreak alerts)
Because the free public data/API for it is genuinely gone or never
existed — NIH retired the pill-image database in 2021, the free drug-
interaction API was discontinued in 2024, and India's real disease
surveillance isn't exposed as a public API. Not a time constraint, a real
constraint — and worth saying plainly rather than dodging.

**"Does it work offline / what if the demo wifi dies?"**
Emergency SOS and step-counting (Fitness) don't need the backend at all.
Everything else needs the FastAPI server reachable — know your `API_BASE_URL`
setup cold before you're in front of anyone (see mobile/README.md's
localhost-vs-LAN-IP note; this is the #1 thing that looks like a bug
during a live demo but isn't).

**"What haven't you tested?"**
Answer this one straight, it builds more credibility than dodging it:
liver disease is code-complete but unverified (real dataset access was
blocked across every path tried — GitHub raw, Kaggle, the official UCI
archive, HuggingFace, an R package's docs — say that specifically, it's a
better answer than "we didn't get to it"). Kidney disease *was* blocked
the same way at first, then a data-science course site turned out to
mirror it — worth telling that story if asked, since it's a good example
of not giving up at the first dead end, but also not pretending a partial
search was exhaustive. And when kidney's data did come through, checking
it mattered: it scored 100% test accuracy, which sounds impressive but
needed a second look — several of its fields (urine albumin, specific
gravity) are direct diagnostic lab markers that separate the two classes
almost by definition, not because the model learned something subtle.
Say that unprompted; it's a stronger answer than letting a judge ask
"...100%, really?" first. The whole mobile app's first real device run
also happened during/after this session, not before, if asked.

## What NOT to do

Don't lead with the feature count (15! or "14 of 15!"). Count-of-features
is the least interesting true thing about this project and every other
team will do that. Lead with the heart-disease-bias catch and the "we
said so when something wasn't real" pattern — that's the part a judge
who's seen 40 pitches today will actually remember.
