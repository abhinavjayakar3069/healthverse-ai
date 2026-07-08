"""
HealthVerse AI backend.

Run with:  uvicorn app.main:app --reload --port 8000
Then open:  http://localhost:8000/docs  for interactive Swagger docs
(great for demoing to judges without needing the mobile app running).
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    DiabetesRequest, HeartRiskRequest, StrokeRiskRequest,
    HealthScoreRequest, ChatRequest, NutritionPhotoRequest, KidneyRiskRequest, LiverRiskRequest,
    DoctorReportRequest, WorkoutPlanRequest, FamilyMemberCreate, MoodCheckinCreate,
    ScoreSnapshotCreate, EmergencyProfileUpdate, DrugInteractionRequest,
)
from app.ml.predictor import predict_diabetes, predict_kidney, predict_liver
from app.rules_engine import (
    heart_disease_risk, stroke_risk, hypertension_assessment, prevention_tips,
)
from app.health_score import (
    heart_subscore, sleep_subscore, stress_subscore,
    fitness_subscore, nutrition_subscore, overall_health_score,
)
from app.ai_assistant import (
    chat_response, symptom_check, analyze_meal_photo, transcribe_audio,
    generate_doctor_report, generate_workout_plan, analyze_prescription_photo,
    assess_liver_risk, check_drug_interactions,
)
from app.environment import get_air_quality, create_video_room
from app import db

db.init_db()

app = FastAPI(title="HealthVerse AI API", version="0.1.0")

# Wide open for hackathon dev speed. Before any real deployment, replace
# allow_origins with your actual app's origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "service": "HealthVerse AI API"}


@app.post("/predict/diabetes")
def diabetes_prediction(req: DiabetesRequest):
    result = predict_diabetes(req.model_dump())
    result["prevention_tips"] = prevention_tips(result["contributing_factors"])
    return result


@app.post("/predict/heart")
def heart_prediction(req: HeartRiskRequest):
    result = heart_disease_risk(req.model_dump())
    result["prevention_tips"] = prevention_tips(result["contributing_factors"])
    return result


@app.post("/predict/kidney")
def kidney_prediction(req: KidneyRiskRequest):
    """Trained ML model, verified (see ml/predictor.py docstring for what
    the 100% test accuracy does and doesn't mean). Still returns a clear
    503 rather than a crash if kidney_model.pkl somehow isn't present."""
    try:
        return predict_kidney(req.model_dump())
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/predict/liver")
def liver_prediction(req: LiverRiskRequest):
    """Untested model, AND only age/sex are truly self-reportable - see
    ml/predictor.py docstring before wiring this into any UI. Returns a
    clear 503 (not a crash) until you've run training. See /assess/liver
    for a genuinely usable alternative that doesn't need this dataset."""
    try:
        patient = {"age": req.age, "sex": req.sex}
        if req.lab_values:
            patient.update(req.lab_values)
        return predict_liver(patient)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/assess/liver")
def liver_assessment(req: LiverRiskRequest):
    """LLM-reasoning alternative to /predict/liver, built because that
    dataset stayed blocked and, honestly, would only ever cover ~2/10
    fields for a typical phone user anyway. This reasons over whatever's
    actually provided (age/sex minimum, ideally alcohol use and any lab
    values) rather than needing a fixed feature set - this is the
    recommended endpoint for liver risk, not the ML one above."""
    try:
        patient = {"age": req.age, "sex": req.sex}
        if req.alcohol_use:
            patient["alcohol_use"] = req.alcohol_use
        if req.lab_values:
            patient.update(req.lab_values)
        result = assess_liver_risk(patient)
        reasoning = result.get("reasoning", "")
        note = result.get("note")
        if note:
            reasoning = f"{reasoning} {note}".strip()
        # Reshaped to match the other risk endpoints' response shape so
        # the same RiskCard component can render it without special-casing.
        return {
            "condition": "Liver Disease",
            "risk_percent": None,
            "risk_category": result.get("risk_level"),
            "reasoning": reasoning,
            "data_completeness": result.get("data_completeness"),
            "method": "LLM reasoning (not a trained classifier - see backend README)",
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Liver risk assessment error: {e}")


@app.post("/predict/stroke")
def stroke_prediction(req: StrokeRiskRequest):
    result = stroke_risk(req.model_dump())
    result["prevention_tips"] = prevention_tips(result["contributing_factors"])
    return result


@app.post("/predict/hypertension")
def hypertension_prediction(req: HeartRiskRequest):
    return hypertension_assessment(req.model_dump())


@app.post("/health-score")
def health_score(req: HealthScoreRequest):
    sub_scores = {
        "Heart": heart_subscore(req.heart_risk_pct, req.hypertension_pct),
        "Sleep": sleep_subscore(req.sleep_hours, req.sleep_quality_1to5),
        "Stress": stress_subscore(req.stress_level_1to10),
        "Fitness": fitness_subscore(req.active_minutes_per_week),
        "Nutrition": nutrition_subscore(req.fruit_veg_servings_per_day),
    }
    return overall_health_score(sub_scores)


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        return chat_response(req.message, req.history)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI assistant error: {e}")


@app.post("/symptom-checker")
def symptom_checker(req: ChatRequest):
    try:
        return symptom_check(req.message, req.history)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI assistant error: {e}")


@app.post("/nutrition/analyze-photo")
def nutrition_photo(req: NutritionPhotoRequest):
    """Send a base64 JPEG/PNG (no data-URI prefix) in the JSON body. See
    ai_assistant.py docstring: estimates are approximate, same as any
    photo-nutrition tool."""
    try:
        return analyze_meal_photo(req.image_base64, req.mime_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Nutrition analysis error: {e}")


@app.post("/medicine/scan-prescription")
def scan_prescription(req: NutritionPhotoRequest):
    """Same request shape as nutrition photo (base64 image + mime type) -
    reused rather than duplicated since it's identical. See
    ai_assistant.py docstring: never auto-add a low-confidence read as a
    reminder without the user confirming it first."""
    try:
        return analyze_prescription_photo(req.image_base64, req.mime_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Prescription scan error: {e}")


@app.post("/medicine/check-interactions")
def check_interactions(req: DrugInteractionRequest):
    """LLM-reasoning alternative to a structured interaction database -
    the free RxNav API for this was discontinued in 2024 (see backend
    README). Explicitly general-knowledge, not a verified clinical check;
    the prompt requires it to say so in every response."""
    if len(req.medications) < 2:
        return {"interactions": [], "note": "Add at least two medications to check for interactions between them."}
    try:
        return check_drug_interactions(req.medications)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Interaction check error: {e}")


@app.post("/fitness/workout-plan")
def workout_plan(req: WorkoutPlanRequest):
    try:
        return {"plan": generate_workout_plan(req.model_dump())}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Workout plan generation error: {e}")


@app.get("/environment/air-quality")
def air_quality(location: str):
    """location: city name ("Delhi") or "geo:lat;lon" for precise coordinates."""
    try:
        return get_air_quality(location)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Air quality lookup error: {e}")


@app.post("/doctor/create-video-room")
def create_doctor_video_room():
    """Genuinely unverified - needs a real Daily.co account, which I
    don't have. See environment.py docstring."""
    try:
        return create_video_room()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Video room creation error: {e}")


@app.post("/voice/transcribe")
async def voice_transcribe(file: UploadFile = File(...)):
    """Upload an audio recording (multipart/form-data, field name 'file').
    Returns {"text": "..."}. See ai_assistant.py docstring - the filename
    extension must match the actual recording format for Whisper to parse
    it correctly."""
    audio_bytes = await file.read()
    try:
        text = transcribe_audio(audio_bytes, file.filename or "audio.m4a")
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription error: {e}")


@app.post("/doctor-report")
def doctor_report(req: DoctorReportRequest):
    """The 'view reports, AI summaries' slice of the original Doctor
    Dashboard idea - deliberately not live chat or video (those need real
    backend accounts + a video SDK, neither of which exists here)."""
    try:
        return {"report": generate_doctor_report(req.patient_data)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Report generation error: {e}")


# --- Persistence ---
# device_id: a UUID the mobile app generates once and stores locally (see
# mobile README) - not real authentication, just enough to keep one
# installation's data separate from another's for a demo. See db.py
# docstring for the honest limitation here.

@app.get("/family/{device_id}")
def get_family_members(device_id: str):
    return db.list_family_members(device_id)


@app.post("/family/{device_id}")
def add_family_member(device_id: str, req: FamilyMemberCreate):
    return db.add_family_member(device_id, req.model_dump())


@app.delete("/family/{device_id}/{member_id}")
def delete_family_member(device_id: str, member_id: str):
    removed = db.remove_family_member(device_id, member_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found for this device")
    return {"removed": True}


@app.get("/mood/{device_id}")
def get_mood_checkins(device_id: str, limit: int = 20):
    return db.list_mood_checkins(device_id, limit)


@app.post("/mood/{device_id}")
def add_mood_checkin(device_id: str, req: MoodCheckinCreate):
    if not 1 <= req.mood <= 5:
        raise HTTPException(status_code=422, detail="mood must be 1-5")
    return db.add_mood_checkin(device_id, req.mood)


@app.get("/health-score/history/{device_id}")
def get_score_history(device_id: str, limit: int = 30):
    return db.list_score_history(device_id, limit)


@app.post("/health-score/history/{device_id}")
def add_score_snapshot(device_id: str, req: ScoreSnapshotCreate):
    return db.add_score_snapshot(device_id, req.overall, req.sub_scores)


@app.get("/emergency-profile/{device_id}")
def get_emergency_profile(device_id: str):
    profile = db.get_emergency_profile(device_id)
    if profile is None:
        return {"bloodGroup": None, "contactName": None, "contactPhone": None, "medicalNotes": None}
    return profile


@app.post("/emergency-profile/{device_id}")
def update_emergency_profile(device_id: str, req: EmergencyProfileUpdate):
    return db.set_emergency_profile(device_id, req.model_dump())
