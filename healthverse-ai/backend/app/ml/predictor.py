"""
Turns real (partial, self-reported) patient input into a risk prediction
using the trained scikit-learn pipelines: diabetes (trained, verified) and
kidney (trained, verified). Liver is lazy-loaded and only works once trained
(see _load_liver_model). Heart disease is intentionally NOT here: an earlier
version of this file loaded heart_model.pkl and predicted from it, but that
model's coefficients turned out to be backwards (selection bias in the
Cleveland dataset - see backend/README.md, "Why heart disease is rule-based,
not ML"), so it was dropped in favor of the transparent point-system in
app/rules_engine.py. heart_model.pkl / train_heart_model() are kept only as
a reference for anyone who wants to retry with a less-biased dataset later.

IMPORTANT HONESTY NOTE (read this before demoing):
Several clinical fields for the models below require lab tests a phone app
cannot collect. For those fields we substitute the training-set median/mode.
This means predictions are most accurate when the user supplies real
clinical numbers, and progressively less precise as more fields fall back to
defaults. `data_completeness` in the response tells you exactly how much of
the prediction is real input vs. population default - surface this in the
UI rather than hiding it. This is a legitimate, common pattern for
consumer health-screening tools (they screen for "should you talk to a
doctor", they do not diagnose).
"""
import os
import pickle
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, "diabetes_model.pkl"), "rb") as f:
    _diabetes = pickle.load(f)


def _risk_category(pct):
    if pct < 30:
        return "Low"
    elif pct < 60:
        return "Moderate"
    else:
        return "High"


def _top_contributing_factors(model_bundle, feature_values, known_fields, top_n=3):
    """Uses the logistic regression coefficients on standardized inputs to
    explain which factors pushed risk up or down the most. Only considers
    fields the user actually provided (known_fields) - a defaulted/imputed
    value isn't a real "reason" for their score, even if it's numerically
    large, and showing it as one would be misleading."""
    pipeline = model_bundle["pipeline"]
    feature_names = model_bundle["feature_names"]
    scaler = pipeline.named_steps["scaler"]
    clf = pipeline.named_steps["clf"]

    x = np.array([feature_values])
    x_scaled = scaler.transform(x)[0]
    contributions = x_scaled * clf.coef_[0]

    eligible = [i for i, name in enumerate(feature_names) if name in known_fields]
    order = sorted(eligible, key=lambda i: -abs(contributions[i]))[:top_n]
    factors = []
    for i in order:
        factors.append({
            "factor": feature_names[i],
            "direction": "increases risk" if contributions[i] > 0 else "lowers risk",
        })
    return factors


FRIENDLY_NAMES = {
    "Glucose": "Blood sugar", "BloodPressure": "Blood pressure", "BMI": "BMI",
    "Age": "Age", "Pregnancies": "Pregnancies", "DiabetesPedigreeFunction": "Family history",
    "SkinThickness": "Skin thickness", "Insulin": "Insulin level",
    "trestbps": "Resting blood pressure", "chol": "Cholesterol", "fbs": "Fasting blood sugar",
    "thalach": "Max heart rate", "exang": "Exercise-induced chest pain", "sex": "Sex",
    "cp": "Chest pain pattern", "restecg": "Resting ECG", "oldpeak": "ST depression",
    "slope": "ST slope", "ca": "Vessels seen on angiogram", "thal": "Thalassemia test",
    "bp": "Blood pressure", "htn": "Hypertension", "dm": "Diabetes", "appet": "Appetite",
    "pe": "Swelling (edema)", "ane": "Anemia", "bu": "Blood urea", "sc": "Serum creatinine",
    "age": "Age", "sg": "Urine specific gravity", "al": "Urine albumin", "su": "Urine sugar",
    "cad": "Coronary artery disease",
}

# Kidney model uses lazy loading, unlike diabetes/heart above: this file
# doesn't exist until someone runs train_kidney_model() themselves (I
# couldn't fetch the dataset into my sandbox - see train.py docstring), so
# loading it eagerly at import time would crash the entire backend, taking
# working diabetes/heart predictions down with it. Loading only on first
# real call means the rest of the API stays up regardless.
_kidney = None


def _load_kidney_model():
    global _kidney
    if _kidney is None:
        path = os.path.join(BASE_DIR, "kidney_model.pkl")
        if not os.path.exists(path):
            raise FileNotFoundError(
                "kidney_model.pkl not found. Run: python -m app.ml.train "
                "(kidney_clean.csv is already in data/ - no ucimlrepo/internet "
                "needed anymore, that data fetch succeeded this session)."
            )
        with open(path, "rb") as f:
            _kidney = pickle.load(f)
    return _kidney


def predict_kidney(patient: dict) -> dict:
    """
    patient: age, bp_diastolic (reused from the shared intake form),
      diabetic (bool, from existing diabetes check), hypertensive (bool,
      from existing BP reading), appetite ('good'|'poor'),
      swelling (bool), anemia_diagnosed (bool)

    Trained on real data (158 patients, Tamil Nadu hospital, see
    train.py) and verified: 100% test accuracy, and the coefficient-
    direction check passed (bp/htn/dm/bu/sc all correctly increase risk).
    Worth understanding WHY accuracy is 100% though, not just trusting the
    headline number: several of this dataset's fields (urine albumin,
    specific gravity) are direct diagnostic lab markers that separate CKD/
    non-CKD almost perfectly by themselves - e.g. every non-CKD patient in
    this data has albumin exactly 0. That's a real, clinically-grounded
    signal, not a modeling artifact - but it also means the model's real-
    world accuracy for a typical phone user (who can't supply those lab
    values) will be much lower than 100%, since it falls back to
    population medians for anything not provided. `data_completeness`
    tells you exactly how much of a given prediction is real input versus
    default - that number matters more than the training accuracy for any
    individual user's result.
    """
    model = _load_kidney_model()
    defaults = model["defaults"]
    feature_names = model["feature_names"]

    provided = {
        "age": patient.get("age"),
        "bp": patient.get("bp_diastolic"),
        "htn": 1 if patient.get("hypertensive") else (0 if "hypertensive" in patient else None),
        "dm": 1 if patient.get("diabetic") else (0 if "diabetic" in patient else None),
        "appet": {"good": 1, "poor": 0}.get(patient.get("appetite")),
        "pe": 1 if patient.get("swelling") else (0 if "swelling" in patient else None),
        "ane": 1 if patient.get("anemia_diagnosed") else (0 if "anemia_diagnosed" in patient else None),
    }

    feature_values = []
    known_fields = set()
    for name in feature_names:
        val = provided.get(name)
        if val is not None:
            known_fields.add(name)
        else:
            val = defaults[name]
        feature_values.append(val)

    proba = model["pipeline"].predict_proba([feature_values])[0][1]
    pct = round(proba * 100, 1)
    factors = _top_contributing_factors(model, feature_values, known_fields)

    return {
        "condition": "Kidney Disease",
        "risk_percent": pct,
        "risk_category": _risk_category(pct),
        "contributing_factors": [
            {"factor": FRIENDLY_NAMES.get(f["factor"], f["factor"]), "direction": f["direction"]}
            for f in factors
        ],
        "data_completeness": f"{len(known_fields)}/{len(feature_names)} fields from you, rest estimated",
    }


def predict_diabetes(patient: dict) -> dict:
    """
    patient (all optional except age, sex, bmi/weight+height, glucose recommended):
      age, sex ('M'/'F'), pregnancies, glucose_mgdl, bp_diastolic,
      bmi (or weight_kg + height_cm), family_history ('none'|'one'|'multiple')
    """
    defaults = _diabetes["defaults"]
    feature_names = _diabetes["feature_names"]

    bmi = patient.get("bmi")
    if bmi is None and patient.get("weight_kg") and patient.get("height_cm"):
        h_m = patient["height_cm"] / 100
        bmi = round(patient["weight_kg"] / (h_m ** 2), 1)

    fh_map = {"none": 0.15, "one": 0.4, "multiple": 0.8}
    dpf = fh_map.get(patient.get("family_history"), defaults["DiabetesPedigreeFunction"])

    provided = {
        "Pregnancies": patient.get("pregnancies", 0 if patient.get("sex") == "M" else None),
        "Glucose": patient.get("glucose_mgdl"),
        "BloodPressure": patient.get("bp_diastolic"),
        "SkinThickness": None,   # needs a caliper measurement - not phone-collectible
        "Insulin": None,          # needs a blood draw - not phone-collectible
        "BMI": bmi,
        "DiabetesPedigreeFunction": dpf,
        "Age": patient.get("age"),
    }

    feature_values = []
    known_fields = set()
    for name in feature_names:
        val = provided.get(name)
        if val is not None:
            known_fields.add(name)
        else:
            val = defaults[name]
        feature_values.append(val)
    fields_provided = len(known_fields)

    # Pregnancies=0 for a male patient is medically certain, not a guess, so
    # it correctly affects the math above - but showing "Pregnancies" as a
    # personal risk factor to a man in the UI reads as a bug, not an insight.
    # Exclude it from the *explanation* only, not from the prediction itself.
    if patient.get("sex") == "M":
        known_fields.discard("Pregnancies")

    proba = _diabetes["pipeline"].predict_proba([feature_values])[0][1]
    pct = round(proba * 100, 1)
    factors = _top_contributing_factors(_diabetes, feature_values, known_fields)

    return {
        "condition": "Diabetes",
        "risk_percent": pct,
        "risk_category": _risk_category(pct),
        "contributing_factors": [
            {"factor": FRIENDLY_NAMES.get(f["factor"], f["factor"]), "direction": f["direction"]}
            for f in factors
        ],
        "data_completeness": f"{fields_provided}/{len(feature_names)} fields from you, rest estimated",
    }


_liver = None


def _load_liver_model():
    global _liver
    if _liver is None:
        path = os.path.join(BASE_DIR, "liver_model.pkl")
        if not os.path.exists(path):
            raise FileNotFoundError(
                "liver_model.pkl not found. Run: pip install ucimlrepo && "
                "python -m app.ml.train (see train_liver_model in train.py - "
                "untested by me, AND only ~2 of 10 fields are phone-"
                "self-reportable even in principle; check the coefficient-"
                "direction warning and think hard about whether this belongs "
                "in a consumer UI at all vs. a 'paste your lab report' flow)."
            )
        with open(path, "rb") as f:
            _liver = pickle.load(f)
    return _liver


def predict_liver(patient: dict) -> dict:
    """
    patient: age, sex ('M'/'F'), plus any lab values the caller happens to
      have (total_bilirubin, alt, ast, etc. - pass using whatever field
      names train_liver_model() printed as feature_names for your ucimlrepo
      fetch, since I couldn't confirm exact casing without fetching it).
    Realistically only useful with real lab values supplied - age+sex
    alone will mostly reflect population defaults, not this person.
    """
    model = _load_liver_model()
    defaults = model["defaults"]
    feature_names = model["feature_names"]

    feature_values = []
    known_fields = set()
    for name in feature_names:
        val = patient.get(name)
        if val is not None:
            known_fields.add(name)
        else:
            val = defaults[name]
        feature_values.append(val)

    proba = model["pipeline"].predict_proba([feature_values])[0][1]
    pct = round(proba * 100, 1)
    factors = _top_contributing_factors(model, feature_values, known_fields)

    return {
        "condition": "Liver Disease",
        "risk_percent": pct,
        "risk_category": _risk_category(pct),
        "contributing_factors": [
            {"factor": FRIENDLY_NAMES.get(f["factor"], f["factor"]), "direction": f["direction"]}
            for f in factors
        ],
        "data_completeness": f"{len(known_fields)}/{len(feature_names)} fields from you, rest estimated",
        "caveat": ("This model is untested by its author, AND most of its fields need an actual "
                   "blood test - without real lab values this is mostly a population average, "
                   "not a reading of this specific person. See backend README before using."),
    }

# Note: there is deliberately no predict_heart() here. See the module
# docstring above and backend/README.md ("Why heart disease is rule-based,
# not ML") for why the earlier ML-based heart predictor was removed rather
# than fixed. Use app.rules_engine.heart_disease_risk() instead.
