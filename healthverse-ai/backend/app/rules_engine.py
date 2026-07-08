"""
Transparent, points-based risk scoring for conditions where either (a) no
clean self-report-friendly dataset exists (hypertension staging, stroke), or
(b) the available trained model turned out to be unsafe to use (heart
disease - see ml/predictor.py docstring: the Cleveland dataset's coefficients
run backwards on sex/chest-pain/cholesterol/BP due to referral bias in how
that data was collected).

Every threshold below is a standard, publicly documented clinical guideline
value (AHA/ACC 2017 blood pressure staging, ADA fasting glucose categories,
WHO BMI categories, ATP III cholesterol categories) - not proprietary
scoring, and not a diagnosis. This is a general risk-factor screener, and
its output should always carry a "talk to a doctor" framing rather than a
diagnostic one.
"""


def bmi_from(weight_kg, height_cm):
    if not weight_kg or not height_cm:
        return None
    h_m = height_cm / 100
    return round(weight_kg / (h_m ** 2), 1)


def bmi_category(bmi):
    if bmi is None:
        return None
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25:
        return "Normal"
    if bmi < 30:
        return "Overweight"
    return "Obese"


def hypertension_stage(systolic, diastolic):
    """AHA/ACC 2017 guideline staging."""
    if systolic is None or diastolic is None:
        return None
    if systolic > 180 or diastolic > 120:
        stage, note = "Hypertensive Crisis", "Seek medical attention promptly."
    elif systolic >= 140 or diastolic >= 90:
        stage, note = "Stage 2 Hypertension", "Medical evaluation recommended."
    elif systolic >= 130 or diastolic >= 80:
        stage, note = "Stage 1 Hypertension", "Lifestyle changes recommended; discuss with a doctor."
    elif systolic >= 120:
        stage, note = "Elevated", "Good time to focus on prevention."
    else:
        stage, note = "Normal", "Keep up the good habits."
    return {"stage": stage, "note": note}


def glucose_category(fasting_glucose_mgdl):
    """ADA fasting plasma glucose categories."""
    if fasting_glucose_mgdl is None:
        return None
    if fasting_glucose_mgdl >= 126:
        return "Diabetes range"
    if fasting_glucose_mgdl >= 100:
        return "Prediabetes range"
    return "Normal"


def _risk_percent_from_points(points, max_reasonable=14):
    pct = min(95, round((points / max_reasonable) * 90, 1))
    return pct


def _category(pct):
    if pct < 30:
        return "Low"
    elif pct < 60:
        return "Moderate"
    return "High"


def heart_disease_risk(patient: dict) -> dict:
    """
    patient: age, sex ('M'/'F'), bp_systolic, bp_diastolic, cholesterol,
             fasting_glucose_mgdl, smoker (bool), family_history ('none'|'one'|'multiple'),
             weight_kg, height_cm, physically_active (bool)
    """
    points = {}

    age = patient.get("age")
    sex = patient.get("sex")
    if age is not None:
        # Women's cardiovascular risk trails men's by roughly a decade on
        # average (a standard, widely-taught epidemiological pattern),
        # modeled here as an effective-age offset.
        effective_age = age if sex == "M" else age - 10
        if effective_age >= 65:
            points["Age"] = 3
        elif effective_age >= 55:
            points["Age"] = 2
        elif effective_age >= 45:
            points["Age"] = 1

    bp = hypertension_stage(patient.get("bp_systolic"), patient.get("bp_diastolic"))
    if bp:
        bp_points = {"Normal": 0, "Elevated": 1, "Stage 1 Hypertension": 2,
                     "Stage 2 Hypertension": 3, "Hypertensive Crisis": 4}
        points["Blood pressure"] = bp_points[bp["stage"]]

    chol = patient.get("cholesterol")
    if chol is not None:
        if chol >= 240:
            points["Cholesterol"] = 2
        elif chol >= 200:
            points["Cholesterol"] = 1

    glucose_cat = glucose_category(patient.get("fasting_glucose_mgdl"))
    if glucose_cat == "Diabetes range":
        points["Diabetes"] = 3  # standard teaching: diabetes = CHD risk equivalent
    elif glucose_cat == "Prediabetes range":
        points["Blood sugar"] = 1

    if patient.get("smoker"):
        points["Smoking"] = 2

    fh = patient.get("family_history")
    if fh == "multiple":
        points["Family history"] = 2
    elif fh == "one":
        points["Family history"] = 1

    bmi = patient.get("bmi") or bmi_from(patient.get("weight_kg"), patient.get("height_cm"))
    if bmi_category(bmi) == "Obese":
        points["Weight (BMI)"] = 1

    if patient.get("physically_active") is False:
        points["Inactivity"] = 1

    total = sum(points.values())
    pct = _risk_percent_from_points(total)
    top_factors = sorted(points.items(), key=lambda kv: -kv[1])[:3]

    return {
        "condition": "Heart Disease",
        "risk_percent": pct,
        "risk_category": _category(pct),
        "contributing_factors": [{"factor": k, "direction": "increases risk"} for k, v in top_factors if v > 0],
        "method": "rule-based (standard clinical risk factors)",
    }


def stroke_risk(patient: dict) -> dict:
    """Hypertension is the single largest modifiable stroke risk factor
    (standard clinical teaching) so it's weighted heavily here."""
    points = {}

    age = patient.get("age")
    if age is not None:
        if age >= 65:
            points["Age"] = 3
        elif age >= 55:
            points["Age"] = 2
        elif age >= 45:
            points["Age"] = 1

    bp = hypertension_stage(patient.get("bp_systolic"), patient.get("bp_diastolic"))
    if bp:
        bp_points = {"Normal": 0, "Elevated": 1, "Stage 1 Hypertension": 3,
                     "Stage 2 Hypertension": 4, "Hypertensive Crisis": 5}
        points["Blood pressure"] = bp_points[bp["stage"]]

    glucose_cat = glucose_category(patient.get("fasting_glucose_mgdl"))
    if glucose_cat == "Diabetes range":
        points["Diabetes"] = 2

    if patient.get("smoker"):
        points["Smoking"] = 2

    if patient.get("physically_active") is False:
        points["Inactivity"] = 1

    fh = patient.get("family_history")
    if fh == "multiple":
        points["Family history"] = 1

    total = sum(points.values())
    pct = _risk_percent_from_points(total, max_reasonable=12)
    top_factors = sorted(points.items(), key=lambda kv: -kv[1])[:3]

    return {
        "condition": "Stroke",
        "risk_percent": pct,
        "risk_category": _category(pct),
        "contributing_factors": [{"factor": k, "direction": "increases risk"} for k, v in top_factors if v > 0],
        "method": "rule-based (standard clinical risk factors)",
    }


def hypertension_assessment(patient: dict) -> dict:
    bp = hypertension_stage(patient.get("bp_systolic"), patient.get("bp_diastolic"))
    if not bp:
        return {"condition": "Hypertension", "risk_percent": None, "risk_category": None,
                "note": "Blood pressure reading required."}
    stage_to_pct = {"Normal": 5, "Elevated": 25, "Stage 1 Hypertension": 50,
                    "Stage 2 Hypertension": 75, "Hypertensive Crisis": 95}
    pct = stage_to_pct[bp["stage"]]
    return {
        "condition": "Hypertension",
        "risk_percent": pct,
        "risk_category": _category(pct),
        "stage": bp["stage"],
        "note": bp["note"],
        "method": "rule-based (AHA/ACC 2017 staging)",
    }


PREVENTION_TIPS = {
    "Age": "Regular checkups matter more as you get older - annual screening catches issues early.",
    "Blood pressure": "Reduce sodium, keep up regular activity, manage stress, and monitor readings at home.",
    "Cholesterol": "Favor unsaturated fats, add fiber, and limit processed/fried food.",
    "Diabetes": "Work with a doctor on blood sugar management; diet and activity both help significantly.",
    "Blood sugar": "Cut back on refined carbs and sugary drinks; regular activity improves insulin sensitivity.",
    "Smoking": "Quitting smoking is the single biggest change you can make for heart and stroke risk.",
    "Family history": "You can't change genetics, but you can control the modifiable factors more tightly.",
    "Weight (BMI)": "Even a 5-10% weight reduction meaningfully lowers cardiometabolic risk.",
    "Inactivity": "Aim for 150 minutes/week of moderate activity - brisk walking counts.",
}


def prevention_tips(contributing_factors):
    return [PREVENTION_TIPS[f["factor"]] for f in contributing_factors if f["factor"] in PREVENTION_TIPS]
