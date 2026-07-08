"""
Wraps the Gemini API (Google's Gen AI SDK, package `google-genai`) for the
AI Health Assistant chat, Symptom Checker, and several other AI-assisted
features. All conversational features share the same safety-constrained
system instruction so the model never drifts into diagnosing or prescribing.

Needs GEMINI_API_KEY set as an environment variable (see .env.example) - get
a free key at https://aistudio.google.com (no billing card required; the
Gemini Flash models used here are covered by the free tier as of this
writing - double check current limits in AI Studio -> Quotas, since free
tier terms do shift over time).

Converted from an earlier OpenAI-based version. Two things changed shape
in the process, worth knowing before you build on this:
1. Gemini's chat history format is [{role: "user"|"model", parts: [...]}],
   not OpenAI's [{role: "user"|"assistant", content: "..."}]. The mobile
   app still sends the OpenAI-style shape (unchanged) - _history_to_contents()
   below does the conversion, so nothing else in this repo needed to change.
2. There's no direct Gemini equivalent of Whisper. transcribe_audio() below
   asks Gemini to transcribe the audio directly (it does accept audio input),
   but Gemini's documented supported audio MIME types are wav/mp3/aiff/aac/
   ogg/flac - "audio/mp4" for .m4a (what Expo actually records) is NOT
   explicitly listed as supported. This is the single most likely thing to
   need adjustment once you test with a real recording - if it fails, check
   the Gemini API docs' current audio support page first.

This module isn't executed by me during development (no internet in my
sandbox) - the code follows the documented google-genai SDK patterns as of
mid-2026, but every function here is UNTESTED against the real API. Test
each one for real as soon as you have a key, before building UI on top.
"""
import os
import json
import base64
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"  # free-tier eligible, natively multimodal (text/image/audio)

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


def _history_to_contents(history: list[dict] | None) -> list[types.Content]:
    """Converts the app's OpenAI-style history ([{"role": "user"|"assistant",
    "content": "..."}], as sent by the mobile client unchanged) into Gemini's
    Content objects ([{role: "user"|"model", parts: [...]}])."""
    contents = []
    for turn in history or []:
        role = "model" if turn.get("role") == "assistant" else "user"
        text = turn.get("content", "")
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))
    return contents


def chat_response(message: str, history: list[dict] | None = None) -> dict:
    """
    history: list of {"role": "user"|"assistant", "content": "..."} from
    earlier turns in this conversation (send the whole thread each time -
    the API has no memory of its own).
    """
    contents = _history_to_contents(history)
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

    response = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.4,
            max_output_tokens=500,
        ),
    )
    return {
        "reply": response.text,
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
    contents = _history_to_contents(history)
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

    response = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYMPTOM_CHECKER_PROMPT,
            temperature=0.3,
            max_output_tokens=500,
        ),
    )
    return {
        "reply": response.text,
        "flagged_urgent": _contains_red_flag(message),
    }


NUTRITION_PROMPT = """You analyze a photo of a meal and estimate its nutrition.
Respond with valid JSON matching exactly this shape:
{"items": ["food 1", "food 2"], "calories": 000, "protein_g": 00, "carbs_g": 00,
 "fat_g": 00, "sugar_g": 00, "confidence": "low"|"medium"|"high",
 "note": "one short sentence on what would improve accuracy, e.g. unclear portion size"}
Base portion-size assumptions on visible plate/container size. If you can't
identify the food with reasonable confidence, set confidence to "low" and say
why in note rather than guessing wildly."""


def analyze_meal_photo(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """image_base64: base64-encoded JPEG/PNG, no data-URI prefix.
    NOTE: like the rest of this file, untested in my sandbox (no internet/key
    here) - Gemini's vision estimates are approximate the same way every
    photo-nutrition product's are (commercial ones test at ~65-89% accuracy
    even with dedicated food-recognition models) - surface `confidence` and
    `note` in the UI, and let users tap to adjust the estimate."""
    image_bytes = base64.b64decode(image_base64)

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[
                types.Part.from_text(text="Analyze this meal."),
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=NUTRITION_PROMPT,
            temperature=0.2,
            max_output_tokens=300,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """Asks Gemini to transcribe audio directly (no Whisper equivalent needed -
    Gemini accepts audio input natively). filename's extension is used to guess
    a MIME type; Expo's default recording presets produce .m4a on both iOS and
    Android.
    UNTESTED, and genuinely uncertain - Gemini's documented supported audio
    formats are wav/mp3/aiff/aac/ogg/flac; "audio/mp4" for .m4a is not
    explicitly listed as supported as of this writing. Verify this first
    thing with a real recording once you have a key - if it fails, check
    the current Gemini API audio-support docs for the right MIME type/format
    (you may need to have Expo record in a different format, e.g. .wav)."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "m4a"
    mime_map = {
        "m4a": "audio/mp4", "mp4": "audio/mp4", "mp3": "audio/mp3",
        "wav": "audio/wav", "aac": "audio/aac", "ogg": "audio/ogg",
        "flac": "audio/flac", "webm": "audio/webm", "aiff": "audio/aiff",
    }
    mime_type = mime_map.get(ext, "audio/mp4")

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[
                types.Part.from_text(text=(
                    "Transcribe this audio exactly. Return ONLY the raw "
                    "transcribed text - no commentary, no quotation marks, "
                    "no markdown formatting."
                )),
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            ]),
        ],
        config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=1000),
    )
    return response.text.strip()


PRESCRIPTION_OCR_PROMPT = """You read a photo of a prescription and extract medicines.
Respond with valid JSON matching exactly this shape:
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
    image_bytes = base64.b64decode(image_base64)

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[
                types.Part.from_text(text="Read this prescription."),
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=PRESCRIPTION_OCR_PROMPT,
            temperature=0.1,
            max_output_tokens=400,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


LIVER_RISK_PROMPT = """You assess general liver disease risk from whatever information
the person provides - demographics, lifestyle factors (especially alcohol use, a major
real-world risk factor), and any lab values they have (bilirubin, ALT/SGPT, AST/SGOT,
albumin, alkaline phosphatase, etc.).

Respond with valid JSON matching exactly:
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
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[types.Part.from_text(text=json.dumps(patient_data))]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=LIVER_RISK_PROMPT,
            temperature=0.2,
            max_output_tokens=350,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


DRUG_INTERACTION_PROMPT = """You check for potential interactions between a list of
medications using general pharmacological knowledge. This is NOT a substitute for a
verified clinical drug-interaction database (the free public API for that was
discontinued in 2024 - see backend README) - be explicit about that limitation.

Respond with valid JSON matching exactly:
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
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[
                types.Part.from_text(text=f"Medications: {', '.join(medications)}"),
            ]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=DRUG_INTERACTION_PROMPT,
            temperature=0.1,
            max_output_tokens=500,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


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
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[types.Part.from_text(text=json.dumps(patient_data))]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=DOCTOR_REPORT_PROMPT,
            temperature=0.2,
            max_output_tokens=600,
        ),
    )
    return response.text


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

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[types.Part.from_text(text="\n".join(details))]),
        ],
        config=types.GenerateContentConfig(
            system_instruction=WORKOUT_PROMPT,
            temperature=0.5,
            max_output_tokens=700,
        ),
    )
    return response.text
