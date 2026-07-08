"""
Backend smoke test - run this after ANY change to catch regressions
mechanically instead of relying on manual reasoning about the codebase.

Run with:  python3 -m app.smoke_test

Deliberately stdlib-only (no pytest) so it runs anywhere Python does,
including environments without dev dependencies installed. Pydantic-
dependent checks (models.py) are skipped with a warning if pydantic isn't
installed, rather than failing the whole suite - useful in restricted
environments (this is exactly how I've been checking things without
FastAPI/pydantic available).
"""
import sys
import os
import warnings

warnings.filterwarnings("ignore")

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"

failures = []


def check(name, condition):
    if condition:
        print(f"  {PASS}  {name}")
    else:
        print(f"  {FAIL}  {name}")
        failures.append(name)


def section(title):
    print(f"\n{title}")


# ---------------------------------------------------------------------
section("Diabetes model (trained ML)")
from app.ml.predictor import predict_diabetes, predict_kidney

healthy = predict_diabetes({"age": 25, "sex": "M", "glucose_mgdl": 90, "bp_diastolic": 70})
risky = predict_diabetes({"age": 55, "sex": "F", "glucose_mgdl": 160, "bp_diastolic": 90, "family_history": "multiple"})
check("healthy profile scores lower than risky profile", healthy["risk_percent"] < risky["risk_percent"])
check("risk_percent is 0-100", 0 <= healthy["risk_percent"] <= 100 and 0 <= risky["risk_percent"] <= 100)
check("male patient never shows Pregnancies as a factor", not any(f["factor"] == "Pregnancies" for f in healthy["contributing_factors"]))
check("risk_category is a valid label", healthy["risk_category"] in ("Low", "Moderate", "High"))

# ---------------------------------------------------------------------
section("Kidney model (trained + verified this session) and liver (still untrained)")
from app.ml.predictor import predict_kidney, predict_liver

kidney_healthy = predict_kidney({"age": 30, "hypertensive": False, "diabetic": False})
kidney_risky = predict_kidney({"age": 60, "bp_diastolic": 95, "hypertensive": True, "diabetic": True, "swelling": True})
check("kidney: healthy profile scores lower than risky profile", kidney_healthy["risk_percent"] < kidney_risky["risk_percent"])
check("kidney: risk_percent is 0-100", 0 <= kidney_healthy["risk_percent"] <= 100 and 0 <= kidney_risky["risk_percent"] <= 100)
check("kidney: risk_category is a valid label", kidney_healthy["risk_category"] in ("Low", "Moderate", "High"))

try:
    predict_liver({"age": 50, "sex": "M"})
    check("liver_model.pkl exists and predict_liver ran (check its coefficient-direction warning + think about whether age/sex alone is honest enough to show)", True)
except FileNotFoundError:
    check("predict_liver raises a clean, catchable error when untrained (not a crash)", True)
except Exception as e:
    check(f"predict_liver fails ungracefully ({type(e).__name__}) - this needs fixing", False)

# ---------------------------------------------------------------------
section("Rule-based engines (heart, stroke, hypertension)")
from app.rules_engine import heart_disease_risk, stroke_risk, hypertension_assessment, prevention_tips

low_risk_patient = {"age": 28, "sex": "F", "bp_systolic": 110, "bp_diastolic": 70, "cholesterol": 170,
                     "fasting_glucose_mgdl": 85, "smoker": False, "family_history": "none", "physically_active": True}
high_risk_patient = {"age": 60, "sex": "M", "bp_systolic": 155, "bp_diastolic": 95, "cholesterol": 260,
                      "fasting_glucose_mgdl": 140, "smoker": True, "family_history": "multiple", "physically_active": False}

heart_low = heart_disease_risk(low_risk_patient)
heart_high = heart_disease_risk(high_risk_patient)
check("heart risk: healthy < risky", heart_low["risk_percent"] < heart_high["risk_percent"])
check("heart risk: healthy profile is Low category", heart_low["risk_category"] == "Low")
check("heart risk: risky profile is High category", heart_high["risk_category"] == "High")

stroke_low = stroke_risk(low_risk_patient)
stroke_high = stroke_risk(high_risk_patient)
check("stroke risk: healthy < risky", stroke_low["risk_percent"] < stroke_high["risk_percent"])

hyper_low = hypertension_assessment(low_risk_patient)
hyper_high = hypertension_assessment(high_risk_patient)
check("hypertension: 110/70 reads as Normal", hyper_low["stage"] == "Normal")
check("hypertension: 155/95 reads as Stage 2", hyper_high["stage"] == "Stage 2 Hypertension")

section("Hypertension staging - exact boundary values (off-by-one is an easy bug here)")
from app.rules_engine import hypertension_stage

check("119/79 -> Normal", hypertension_stage(119, 79)["stage"] == "Normal")
check("120/79 -> Elevated (systolic boundary alone)", hypertension_stage(120, 79)["stage"] == "Elevated")
check("115/81 -> Stage 1 (diastolic boundary alone, normal systolic)", hypertension_stage(115, 81)["stage"] == "Stage 1 Hypertension")
check("139/89 -> Stage 1 (upper edge)", hypertension_stage(139, 89)["stage"] == "Stage 1 Hypertension")
check("140/89 -> Stage 2 (systolic crosses)", hypertension_stage(140, 89)["stage"] == "Stage 2 Hypertension")
check("180/120 -> Stage 2, not Crisis (exclusive boundary)", hypertension_stage(180, 120)["stage"] == "Stage 2 Hypertension")
check("181/100 -> Hypertensive Crisis", hypertension_stage(181, 100)["stage"] == "Hypertensive Crisis")

section("Air quality categorization - exact boundary values")
from app.environment import _aqi_category

check("AQI 50 -> Good (inclusive upper edge)", _aqi_category(50)["category"] == "Good")
check("AQI 51 -> Moderate", _aqi_category(51)["category"] == "Moderate")
check("AQI 100 -> Moderate (inclusive upper edge)", _aqi_category(100)["category"] == "Moderate")
check("AQI 101 -> Unhealthy for Sensitive Groups", _aqi_category(101)["category"] == "Unhealthy for Sensitive Groups")
check("AQI 300 -> Very Unhealthy (inclusive upper edge)", _aqi_category(300)["category"] == "Very Unhealthy")
check("AQI 301 -> Hazardous", _aqi_category(301)["category"] == "Hazardous")

tips = prevention_tips(heart_high["contributing_factors"])
check("prevention_tips returns non-empty list for a risky profile", len(tips) > 0)

# ---------------------------------------------------------------------
section("Persistence (db.py) - the one piece fully testable end-to-end")
from app import db as _db

_test_device = "smoke-test-device"
_original_db_path = _db.DB_PATH
_db.DB_PATH = "/tmp/smoke_test_healthverse.db"
if os.path.exists(_db.DB_PATH):
    os.remove(_db.DB_PATH)
_db.init_db()

_m = _db.add_family_member(_test_device, {"name": "Test Person", "relation": "Parent", "age": 60})
check("add_family_member returns an id", "id" in _m)
check("list_family_members finds it back", any(m["name"] == "Test Person" for m in _db.list_family_members(_test_device)))
check("device isolation - a different device sees nothing", _db.list_family_members("other-device") == [])
check("remove_family_member removes it", _db.remove_family_member(_test_device, _m["id"]) is True)
check("...and it's actually gone", _db.list_family_members(_test_device) == [])

_db.add_mood_checkin(_test_device, 4)
check("mood checkin round-trips", len(_db.list_mood_checkins(_test_device)) == 1)

_db.add_score_snapshot(_test_device, 87, {"Heart": 90})
history = _db.list_score_history(_test_device)
check("score snapshot round-trips with sub_scores intact", history[0]["subScores"] == {"Heart": 90})

_db.set_emergency_profile(_test_device, {"bloodGroup": "O+", "contactName": "X", "contactPhone": "1", "medicalNotes": "none"})
_db.set_emergency_profile(_test_device, {"bloodGroup": "AB-", "contactName": "X", "contactPhone": "1", "medicalNotes": "updated"})
profile = _db.get_emergency_profile(_test_device)
check("emergency profile upsert updates rather than duplicating", profile["blood_group"] == "AB-")

os.remove(_db.DB_PATH)
_db.DB_PATH = _original_db_path

# ---------------------------------------------------------------------
section("End-to-end: the real Risk Check -> Health Score user journey")
from app.health_score import heart_subscore, sleep_subscore, stress_subscore, fitness_subscore, nutrition_subscore, overall_health_score
# Not isolated unit checks like above - this runs the actual sequence
# RiskCheckScreen + HomeScreen trigger together, the way a real user's
# first session does, and checks the outputs are sensible as a whole.
journey_patient = {
    "age": 52, "sex": "M", "bp_systolic": 138, "bp_diastolic": 88,
    "cholesterol": 215, "fasting_glucose_mgdl": 118, "smoker": False,
    "family_history": "one", "weight_kg": 88, "height_cm": 172,
    "physically_active": True,
}
j_diabetes = predict_diabetes({**journey_patient, "glucose_mgdl": journey_patient["fasting_glucose_mgdl"]})
j_heart = heart_disease_risk(journey_patient)
j_hyper = hypertension_assessment(journey_patient)
j_stroke = stroke_risk(journey_patient)
j_kidney = predict_kidney({"age": 52, "bp_diastolic": 88, "hypertensive": True, "diabetic": False})

check("journey: all conditions return a valid risk_category", all(
    r.get("risk_category") in ("Low", "Moderate", "High") for r in [j_diabetes, j_heart, j_stroke, j_kidney]
) and j_hyper.get("risk_category") in ("Low", "Moderate", "High"))

j_score = overall_health_score({
    "Heart": heart_subscore(j_heart["risk_percent"], j_hyper["risk_percent"]),
    "Sleep": sleep_subscore(7, 4),
    "Stress": stress_subscore(5),
    "Fitness": fitness_subscore(160),
    "Nutrition": nutrition_subscore(fruit_veg_servings_per_day=4),
})
check("journey: health score consumes real risk outputs and returns 0-100", 0 <= j_score["overall"] <= 100)
check("journey: no sub-score silently dropped when all inputs present", len(j_score["missing"]) == 0)

# ---------------------------------------------------------------------
section("Health score aggregation")
from app.health_score import (
    heart_subscore, sleep_subscore, stress_subscore,
    fitness_subscore, nutrition_subscore, overall_health_score,
)

check("heart_subscore inverts risk correctly", heart_subscore(10, 5) == 92 or heart_subscore(10, 5) == 93)
check("missing categories are excluded from the average, not zeroed",
      overall_health_score({"Heart": 90, "Sleep": None, "Stress": None})["overall"] == 90)
check("all-missing input returns None rather than crashing",
      overall_health_score({"Heart": None, "Sleep": None})["overall"] is None)

# ---------------------------------------------------------------------
section("Pydantic models (main.py request shapes)")
try:
    from app.models import DiabetesRequest, HeartRiskRequest, NutritionPhotoRequest, ChatRequest
    req = DiabetesRequest(age=40, sex="M")
    check("DiabetesRequest accepts minimal input", req.age == 40)
    nreq = NutritionPhotoRequest(image_base64="abc123")
    check("NutritionPhotoRequest defaults mime_type", nreq.mime_type == "image/jpeg")
except ImportError:
    print(f"  {SKIP}  pydantic not installed in this environment - install requirements.txt to run this section")

# ---------------------------------------------------------------------
section("main.py wiring (every import actually resolves)")
import ast
with open("app/main.py") as f:
    main_source = f.read()
tree = ast.parse(main_source)
imports_by_module = {}
for node in ast.walk(tree):
    if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("app"):
        imports_by_module.setdefault(node.module, set()).update(n.name for n in node.names)

import importlib
unresolved = []
skipped_modules = []
for module_path, names in imports_by_module.items():
    if module_path == "app":
        # `from app import db` style - these are submodule imports, not
        # named attributes of the app package. A fresh importlib.import_module("app")
        # won't have submodules as attributes until something has actually
        # imported them (Python's lazy submodule loading), so hasattr()
        # would false-positive-fail here even though the import is fine.
        # Check the submodule file exists instead - that's what actually
        # matters for "from app import db" to work.
        for n in names:
            if not os.path.isfile(f"app/{n}.py") and not os.path.isfile(f"app/{n}/__init__.py"):
                unresolved.append(f"app.{n} (no such submodule file)")
        continue
    try:
        mod = importlib.import_module(module_path)
        unresolved += [f"{module_path}.{n}" for n in names if not hasattr(mod, n)]
    except ImportError:
        # Module needs a third-party package not installed in this
        # environment (pydantic, openai, etc.) - fall back to checking the
        # names are at least defined in the file, via AST, rather than
        # fully resolving the import. Same reasoning either way: a name
        # main.py imports should genuinely exist in the target module.
        skipped_modules.append(module_path)
        with open(module_path.replace(".", "/") + ".py") as f:
            mod_tree = ast.parse(f.read())
        defined = {n.name for n in ast.walk(mod_tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef))}
        unresolved += [f"{module_path}.{n}" for n in names if n not in defined]

check(f"every name main.py imports from app.* actually exists ({sum(len(v) for v in imports_by_module.values())} names checked)", len(unresolved) == 0)
if skipped_modules:
    print(f"       (checked via AST, not import, for modules needing uninstalled packages: {skipped_modules})")
if unresolved:
    print(f"       unresolved: {unresolved}")

# ---------------------------------------------------------------------
print(f"\n{'='*40}")
if failures:
    print(f"{FAIL}  {len(failures)} check(s) failed: {failures}")
    sys.exit(1)
else:
    print(f"{PASS}  All checks passed.")
