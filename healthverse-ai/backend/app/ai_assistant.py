"""
Wraps the OpenAI API for two features: the general AI Health Assistant chat,
and the structured Symptom Checker. Both share the same safety-constrained
system prompt so the model never drifts into diagnosing or prescribing.

Needs OPENAI_API_KEY set as an environment variable (see .env.example).
This module isn't executed by me during development (no internet in my
sandbox) - the logic is straightforward OpenAI SDK usage, so test it first
thing once you add your key, before building UI on top of it.
"""
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL = "gpt-4o-mini"  # good cost/quality tradeoff for a hackathon demo; swap freely

SYSTEM_PROMPT = """You are a health information assistant inside a wellness app.

Rules you must always follow:
- You are NOT a doctor and never claim to diagnose. Use language like "this could be
  consistent with..." or "one possibility is...", never "you have X."
- Never suggest specific drug names, dosages, or treatment regimens. You can name a
  general category of care (e.g. "an antihistamine" not a specific brand/dose).
- If the person describes any red-flag symptom - chest pain, severe difficulty
  breathing, sudden numbness/weakness on one side, confusion, severe uncontrolled
  bleeding, suicidal thoughts, or similar - tell them clearly to seek emergency care
  or call emergency services right away, before anything else.
- Keep answers short, plain-language, and practical. Explain medical terms simply.
- Always close with a brief reminder that this isn't a substitute for seeing a doctor,
  varying the phrasing naturally rather than repeating a fixed disclaimer.
- Never guilt, alarm, or lecture the person - stay calm and supportive.
"""

RED_FLAG_TERMS = [
    "chest pain", "can't breathe", "cannot breathe", "difficulty breathing",
    "severe bleeding", "suicidal", "kill myself", "one side of my body",
    "face drooping", "slurred speech",
]


def _contains_red_flag(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in RED_FLAG_TERMS)


def chat_response(message: str, history: list[dict] | None = None) -> dict:
    """
    history: list of {"role": "user"|"assistant", "content": "..."} from
    earlier turns in this conversation (send the whole thread each time -
    the API has no memory of its own).
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.4,
        max_tokens=500,
    )
    reply = response.choices[0].message.content
    return {
        "reply": reply,
        "flagged_urgent": _contains_red_flag(message),
    }


SYMPTOM_CHECKER_PROMPT = SYSTEM_PROMPT + """
You are running the Symptom Checker flow specifically. Behavior:
1. If key details are missing (duration, severity, associated symptoms like fever
   temperature or breathing difficulty), ask 1-3 short, specific follow-up questions
   before giving any assessment. Do not lecture - just ask.
2. Once you have enough detail (or the person has already answered follow-ups),
   respond with exactly these three sections:
   - Possible causes: 2-4 general possibilities, phrased as possibilities not facts
   - Risk level: Low / Moderate / High, with a one-line reason
   - Recommendation: whether to self-monitor, see a doctor soon, or seek emergency
     care now
"""


def symptom_check(message: str, history: list[dict] | None = None) -> dict:
    messages = [{"role": "system", "content": SYMPTOM_CHECKER_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=500,
    )
    reply = response.choices[0].message.content
    return {
        "reply": reply,
        "flagged_urgent": _contains_red_flag(message),
    }


NUTRITION_PROMPT = """You analyze a photo of a meal and estimate its nutrition.
Respond ONLY with valid JSON, no markdown formatting, no commentary, matching
exactly this shape:
{"items": ["food 1", "food 2"], "calories": 000, "protein_g": 00, "carbs_g": 00,
 "fat_g": 00, "sugar_g": 00, "confidence": "low"|"medium"|"high",
 "note": "one short sentence on what would improve accuracy, e.g. unclear portion size"}
Base portion-size assumptions on visible plate/container size. If you can't
identify the food with reasonable confidence, set confidence to "low" and say
why in note rather than guessing wildly."""


def analyze_meal_photo(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """image_base64: base64-encoded JPEG/PNG, no data-URI prefix.
    NOTE: like the rest of this file, untested in my sandbox (no internet/key
    here) - GPT-4o vision estimates are approximate the same way every
    photo-nutrition product's are (commercial ones test at ~65-89% accuracy
    even with dedicated food-recognition models) - surface `confidence` and
    `note` in the UI, and let users tap to adjust the estimate."""
    import json

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": NUTRITION_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analyze this meal."},
                    {"type": "image_url", "image_url": {
                        "url": f"data:{mime_type};base64,{image_base64}"
                    }},
                ],
            },
        ],
        temperature=0.2,
        max_tokens=300,
    )
    raw = response.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """Whisper speech-to-text. filename's extension matters - the OpenAI SDK
    infers audio format from it, not from actual file content, so it must
    match what was actually recorded (Expo's default recording presets
    produce .m4a on both iOS and Android - if the mobile side changes
    recording options, this extension needs to match).
    UNTESTED - no internet/audio tooling in my sandbox to verify end-to-end.
    Whisper supports: m4a, mp3, wav, webm, mp4, mpga, mpeg."""
    import io

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename  # SDK reads this to set the multipart filename/format
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
    )
    return transcript.text


PRESCRIPTION_OCR_PROMPT = """You read a photo of a prescription and extract medicines.
Respond ONLY with valid JSON, no markdown formatting, no commentary, matching
exactly this shape:
{"medicines": [{"name": "...", "dosage": "...", "frequency": "...", "confidence": "low"|"medium"|"high"}],
 "legible": true|false,
 "note": "one short sentence - e.g. handwriting was hard to read, or confirm with a pharmacist"}
Rules:
- If handwriting is illegible or you're guessing, set confidence "low" and say so in note -
  do NOT invent a plausible-sounding medicine name you can't actually read
- Printed/typed prescriptions are far more reliable than handwritten ones - if handwritten,
  lean toward lower confidence
- Never suggest a dosage or medicine that isn't visibly written on the prescription
- This extraction is not a substitute for pharmacist verification - the app surfaces
  that separately, you just need to be honest about your own uncertainty here"""


def analyze_prescription_photo(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """Same approach as analyze_meal_photo, different prompt. UNTESTED - no
    internet/key in my sandbox. OCR accuracy on handwritten prescriptions
    is inherently poor regardless of model - printed/typed ones work much
    better. Always surface `confidence` and `legible` in the UI and let the
    user correct extracted values before saving them as reminders; never
    auto-add a low-confidence read as a dosage without user confirmation -
    a misread medicine name or dose is a real safety issue, not just a UX
    nicety."""
    import json

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": PRESCRIPTION_OCR_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Read this prescription."},
                    {"type": "image_url", "image_url": {
                        "url": f"data:{mime_type};base64,{image_base64}"
                    }},
                ],
            },
        ],
        temperature=0.1,
        max_tokens=400,
    )
    raw = response.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


LIVER_RISK_PROMPT = """You assess general liver disease risk from whatever information
the person provides - demographics, lifestyle factors (especially alcohol use, a major
real-world risk factor), and any lab values they have (bilirubin, ALT/SGPT, AST/SGOT,
albumin, alkaline phosphatase, etc.).

Respond ONLY with valid JSON, no markdown, matching exactly:
{"risk_level": "Low"|"Moderate"|"High"|"Unable to assess",
 "reasoning": "2-3 sentences explaining which factors drove this, in plain language",
 "data_completeness": "one short phrase on how much you had to go on, e.g. 'based on
   demographics only - lab values would sharpen this considerably'",
 "note": "one sentence recommending a doctor/hepatologist for anything concerning"}

Rules:
- If you only have age/sex with no lab values or lifestyle info, say so honestly in
  data_completeness and lean toward "Unable to assess" rather than guessing
- Heavy alcohol use is one of the most important real-world risk factors - weigh it
  seriously if mentioned, even without lab values
- Never state a specific diagnosis (e.g. "cirrhosis") - risk level and general
  reasoning only
- This is a general risk-factor screener, not a diagnostic tool - the note should
  reflect that without being repetitive about it"""


def assess_liver_risk(patient_data: dict) -> dict:
    """Alternative to a trained classifier for liver disease: reasons over
    whatever data is actually available (age/sex at minimum, ideally lab
    values and alcohol use) using general medical knowledge, the same way
    symptom_check already does. Built as a genuine alternative after the
    training dataset access stayed blocked across every path tried (see
    backend README's liver section) - not a stopgap pretending to be the
    real thing, but arguably a better fit anyway: this dataset's 10 fixed
    lab fields would only ever cover ~2/10 for a typical phone user, while
    this reasons over whatever someone actually has, flexibly, and can
    weigh real factors (alcohol use) the dataset doesn't even include.
    UNTESTED - no internet/key in my sandbox to verify the real call."""
    import json

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": LIVER_RISK_PROMPT},
            {"role": "user", "content": json.dumps(patient_data)},
        ],
        temperature=0.2,
        max_tokens=350,
    )
    raw = response.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


DRUG_INTERACTION_PROMPT = """You check for potential interactions between a list of
medications using general pharmacological knowledge. This is NOT a substitute for a
verified clinical drug-interaction database (the free public API for that was
discontinued in 2024 - see backend README) - be explicit about that limitation.

Respond ONLY with valid JSON, no markdown, matching exactly:
{"interactions": [{"drugs": ["Drug A", "Drug B"], "severity": "minor"|"moderate"|"major",
  "description": "1-2 plain-language sentences on what the concern is"}],
 "note": "one sentence recommending pharmacist/doctor verification before relying on this"}

Rules:
- If you're not confident two drugs interact, don't list them - false negatives are
  safer to correct with a pharmacist than false alarms are to dismiss, but don't
  invent interactions you're not reasonably confident about either
- Never suggest a dosage change or which drug to stop taking - flag the concern and
  defer to a professional
- If the list has only one medication or you find no notable interactions, return an
  empty interactions array, not a fabricated one just to have something to show
- Use the medications' generic names in your response even if brand names were given,
  noting the generic name once if it helps clarity"""


def check_drug_interactions(medications: list[str]) -> dict:
    """LLM-reasoning alternative to a structured interaction database, for
    the same reason liver risk got one: the free RxNav interaction API
    was discontinued in 2024 and nothing free replaced it (see backend
    README). This is explicitly general-knowledge, not a verified
    clinical check - the prompt requires it to say so. UNTESTED - no
    internet/key in my sandbox to verify the real call."""
    import json

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": DRUG_INTERACTION_PROMPT},
            {"role": "user", "content": f"Medications: {', '.join(medications)}"},
        ],
        temperature=0.1,
        max_tokens=500,
    )
    raw = response.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


DOCTOR_REPORT_PROMPT = """Summarize this patient's self-reported health data into a
clear, clinical-style summary a doctor could read in under a minute before a
consultation. Rules:
- Organize by category (risk assessments, vitals, lifestyle) with short headers
- State facts and the numbers given - do NOT add recommendations, diagnoses, or
  interpretations beyond what a neutral summary requires
- Note explicitly that all data is self-reported by the patient via an app, not
  clinically verified, so the doctor knows to confirm anything important
- Plain, professional language - this is for a doctor's few minutes of prep time,
  not a patient-facing explanation
- End with one line noting this is a self-generated summary, not a medical record"""


def generate_doctor_report(patient_data: dict) -> str:
    """Turns the patient's in-app risk results + health score history into a
    shareable summary for an actual doctor visit. This is the 'view reports,
    AI summaries' part of the original Doctor Dashboard idea - deliberately
    NOT live chat with a doctor or video consultation, which need real
    backend accounts and a video SDK (Twilio/Agora/Daily.co) respectively,
    neither of which exists here. UNTESTED - no internet/key in my sandbox."""
    import json

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": DOCTOR_REPORT_PROMPT},
            {"role": "user", "content": json.dumps(patient_data)},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    return response.choices[0].message.content


WORKOUT_PROMPT = """You are a fitness assistant generating a workout plan. You are not a
doctor or certified trainer standing in for one - if the person mentions an
injury or medical condition, tell them to clear the plan with a doctor or
physiotherapist first, briefly, then proceed with a conservative version.

Produce a plan for the number of days/week given, matching their equipment
access and experience level. For each day: a short name (e.g. "Day 1: Upper
body"), 4-6 exercises with sets/reps (or duration for cardio), and a one-line
note on form or intensity. Keep it practical and specific, not generic
platitudes. Plain text, no markdown headers - this renders in a mobile app."""


def generate_workout_plan(profile: dict) -> str:
    """UNTESTED - no internet in my sandbox to call the real API. Prompt
    construction and message shape follow the same pattern as chat_response,
    which is the one thing here I'm confident about without live-testing."""
    details = [
        f"Goal: {profile.get('goal', 'general_fitness')}",
        f"Experience: {profile.get('experience', 'beginner')}",
        f"Days per week: {profile.get('days_per_week', 3)}",
        f"Equipment: {profile.get('equipment', 'none')}",
    ]
    if profile.get("age"):
        details.append(f"Age: {profile['age']}")
    if profile.get("sex"):
        details.append(f"Sex: {profile['sex']}")
    if profile.get("injuries_notes"):
        details.append(f"Injuries/limitations noted: {profile['injuries_notes']}")

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": WORKOUT_PROMPT},
            {"role": "user", "content": "\n".join(details)},
        ],
        temperature=0.5,
        max_tokens=700,
    )
    return response.choices[0].message.content
