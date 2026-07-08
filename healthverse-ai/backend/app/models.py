from pydantic import BaseModel
from typing import Optional, Literal


class DiabetesRequest(BaseModel):
    age: int
    sex: Literal["M", "F"]
    pregnancies: Optional[int] = None
    glucose_mgdl: Optional[float] = None
    bp_diastolic: Optional[float] = None
    bmi: Optional[float] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    family_history: Optional[Literal["none", "one", "multiple"]] = None


class HeartRiskRequest(BaseModel):
    age: int
    sex: Literal["M", "F"]
    bp_systolic: Optional[float] = None
    bp_diastolic: Optional[float] = None
    cholesterol: Optional[float] = None
    fasting_glucose_mgdl: Optional[float] = None
    smoker: Optional[bool] = None
    family_history: Optional[Literal["none", "one", "multiple"]] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    physically_active: Optional[bool] = None


class StrokeRiskRequest(HeartRiskRequest):
    pass


class KidneyRiskRequest(BaseModel):
    age: int
    bp_diastolic: Optional[float] = None
    hypertensive: Optional[bool] = None
    diabetic: Optional[bool] = None
    appetite: Optional[Literal["good", "poor"]] = None
    swelling: Optional[bool] = None
    anemia_diagnosed: Optional[bool] = None


class LiverRiskRequest(BaseModel):
    age: int
    sex: Literal["M", "F"]
    alcohol_use: Optional[Literal["none", "moderate", "heavy"]] = None
    # Lab values are optional and open-ended by design: I don't know
    # ucimlrepo's exact column names for this dataset without having
    # fetched it (see train.py docstring), so this accepts whatever keys
    # train_liver_model() prints as feature_names rather than hardcoding
    # names that might not match.
    lab_values: Optional[dict] = None


class HealthScoreRequest(BaseModel):
    heart_risk_pct: Optional[float] = None
    hypertension_pct: Optional[float] = None
    sleep_hours: Optional[float] = None
    sleep_quality_1to5: Optional[int] = None
    stress_level_1to10: Optional[int] = None
    active_minutes_per_week: Optional[float] = None
    fruit_veg_servings_per_day: Optional[float] = None


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[dict]] = None


class DoctorReportRequest(BaseModel):
    patient_data: dict


class FamilyMemberCreate(BaseModel):
    name: str
    relation: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[Literal["M", "F"]] = None
    bloodGroup: Optional[str] = None
    conditions: Optional[str] = None


class MoodCheckinCreate(BaseModel):
    mood: int  # 1-5


class ScoreSnapshotCreate(BaseModel):
    overall: float
    sub_scores: dict


class EmergencyProfileUpdate(BaseModel):
    bloodGroup: Optional[str] = None
    contactName: Optional[str] = None
    contactPhone: Optional[str] = None
    medicalNotes: Optional[str] = None


class DrugInteractionRequest(BaseModel):
    medications: list[str]


class NutritionPhotoRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"


class WorkoutPlanRequest(BaseModel):
    age: Optional[int] = None
    sex: Optional[Literal["M", "F"]] = None
    goal: Literal["strength", "cardio", "weight_loss", "general_fitness"] = "general_fitness"
    experience: Literal["beginner", "intermediate", "advanced"] = "beginner"
    days_per_week: int = 3
    equipment: Literal["none", "home_basic", "full_gym"] = "none"
    injuries_notes: Optional[str] = None

# Note: response shapes for /predict/* endpoints deliberately aren't typed
# with a shared Pydantic response_model. Each condition returns a
# different set of extra fields (prevention_tips, caveat, stage, note,
# method) beyond the common ones, and Pydantic response models silently
# strip any field not explicitly declared - typing this generically would
# have quietly dropped real data from the API without erroring. A
# previous unused RiskResponse class here would have done exactly that if
# someone wired it in later without noticing; removed rather than left as
# a trap.
