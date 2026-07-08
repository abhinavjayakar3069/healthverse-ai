"""
Train diabetes and heart disease risk prediction models.

Run once during setup:  python -m app.ml.train
Produces: diabetes_model.pkl, heart_model.pkl (saved next to this file)

Datasets:
- Pima Indians Diabetes Dataset (768 patients, National Institute of Diabetes
  and Digestive and Kidney Diseases)
- UCI Heart Disease / Cleveland Clinic dataset (303 patients)
Both are standard, freely redistributable ML teaching datasets.
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
import pickle
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "..", "data")


def train_diabetes_model():
    cols = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
            "Insulin", "BMI", "DiabetesPedigreeFunction", "Age", "Outcome"]
    df = pd.read_csv(os.path.join(DATA_DIR, "diabetes_raw.csv"), names=cols)

    # In this dataset, 0 is used as a missing-value marker for these columns
    # (nobody has 0 blood pressure or 0 BMI) - impute with the column median.
    zero_as_missing = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
    for col in zero_as_missing:
        median_val = df.loc[df[col] != 0, col].median()
        df[col] = df[col].replace(0, median_val)

    X = df.drop("Outcome", axis=1)
    y = df["Outcome"]
    feature_names = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000)),
    ])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    print(f"[Diabetes Model] Test Accuracy: {acc:.3f} | ROC-AUC: {auc:.3f}")
    print(classification_report(y_test, y_pred, target_names=["No Diabetes", "Diabetes"]))

    # Save per-feature medians so the API can fill in fields a phone app
    # can't realistically collect (e.g. Insulin needs a blood draw).
    defaults = {col: float(df[col].median()) for col in feature_names}

    with open(os.path.join(BASE_DIR, "diabetes_model.pkl"), "wb") as f:
        pickle.dump({"pipeline": pipeline, "feature_names": feature_names, "defaults": defaults}, f)

    return acc, auc


def train_heart_model():
    df = pd.read_csv(os.path.join(DATA_DIR, "heart.csv"))
    X = df.drop("target", axis=1)
    y = df["target"]
    feature_names = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000)),
    ])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    print(f"[Heart Disease Model] Test Accuracy: {acc:.3f} | ROC-AUC: {auc:.3f}")
    print(classification_report(y_test, y_pred, target_names=["No Heart Disease", "Heart Disease"]))

    # Save per-feature defaults so the API can fill in fields that need a
    # clinical test (ECG, stress test, angiogram) rather than self-report.
    # Continuous fields -> median, categorical/coded fields -> mode.
    categorical = {"sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"}
    defaults = {}
    for col in feature_names:
        if col in categorical:
            defaults[col] = float(df[col].mode()[0])
        else:
            defaults[col] = float(df[col].median())

    with open(os.path.join(BASE_DIR, "heart_model.pkl"), "wb") as f:
        pickle.dump({"pipeline": pipeline, "feature_names": feature_names, "defaults": defaults}, f)

    return acc, auc


def _check_coefficient_directions(pipeline, feature_names, expected_positive):
    """Automated version of the manual check that caught the heart disease
    model's bias (see backend README). Rather than relying on me - or
    whoever touches this next - to remember to inspect coefficients by
    hand, this runs every time the model trains and fails loudly if a
    factor that should clinically increase risk comes out negative.
    expected_positive: list of feature names that should have a positive
    coefficient (i.e. higher/presence = higher risk) based on real medical
    knowledge, not just what this specific sample happens to show."""
    clf = pipeline.named_steps["clf"]
    problems = []
    for name in expected_positive:
        if name not in feature_names:
            continue
        idx = feature_names.index(name)
        coef = clf.coef_[0][idx]
        if coef < 0:
            problems.append(f"{name} has a NEGATIVE coefficient ({coef:+.3f}) - clinically backwards")
    if problems:
        print("\n*** COEFFICIENT DIRECTION WARNING ***")
        for p in problems:
            print(f"  - {p}")
        print("This is the same kind of dataset-bias issue found with the heart")
        print("disease model. DO NOT use this model's live predictions until")
        print("this is understood - consider a rule-based fallback instead.\n")
    else:
        print("Coefficient directions check out against clinical expectations.")
    return problems


def train_kidney_model():
    """
    Trained and verified - see the coefficient-direction check this
    function runs and prints. Data fetch took 5 attempts across two
    sessions before succeeding (see below); once real data was in hand,
    this got the same scrutiny as diabetes and heart disease, not less.

    Data: real, cleaned Chronic Kidney Disease dataset (158 patients with
    complete records, out of the original 400) - Rubini, Soundarapandian &
    Eswaran (2015), UCI ML Repository, https://doi.org/10.24432/C5G020
    (CC BY 4.0), via the cleaned distribution at lisds.github.io's Data
    Science textbook (github.com/lisds/textbook), a hospital in Tamil
    Nadu, India. Fetched successfully after GitHub raw mirrors, Kaggle,
    the official UCI archive (served as .zip, unreadable by my fetch
    tool), and HuggingFace all failed - this was the fifth attempt and
    the first to work.
    """
    col_map = {
        "Age": "age", "Blood Pressure": "bp", "Specific Gravity": "sg", "Albumin": "al",
        "Sugar": "su", "Red Blood Cells": "rbc", "Pus Cell": "pc", "Pus Cell clumps": "pcc",
        "Bacteria": "ba", "Blood Glucose Random": "bgr", "Blood Urea": "bu",
        "Serum Creatinine": "sc", "Sodium": "sod", "Potassium": "pot", "Hemoglobin": "hemo",
        "Packed Cell Volume": "pcv", "White Blood Cell Count": "wc",
        "Red Blood Cell Count": "rc", "Hypertension": "htn", "Diabetes Mellitus": "dm",
        "Coronary Artery Disease": "cad", "Appetite": "appet", "Pedal Edema": "pe",
        "Anemia": "ane", "Class": "target",
    }
    df = pd.read_csv(os.path.join(DATA_DIR, "kidney_clean.csv"))
    df = df.rename(columns=col_map)

    binary_yesno = {"yes": 1, "no": 0}
    binary_normal = {"normal": 1, "abnormal": 0}
    binary_present = {"present": 1, "notpresent": 0}
    binary_appet = {"good": 1, "poor": 0}
    for col in ["htn", "dm", "cad", "pe", "ane"]:
        df[col] = df[col].map(binary_yesno)
    for col in ["rbc", "pc"]:
        df[col] = df[col].map(binary_normal)
    for col in ["pcc", "ba"]:
        df[col] = df[col].map(binary_present)
    df["appet"] = df["appet"].map(binary_appet)

    y = df["target"].astype(int)
    X = df.drop(columns=["target"])
    feature_names = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000)),
    ])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    print(f"[Kidney Disease Model] Test Accuracy: {acc:.3f} | ROC-AUC: {auc:.3f}")
    print(classification_report(y_test, y_pred, target_names=["No CKD", "CKD"]))

    # Clinically, all of these should INCREASE predicted CKD risk. If any
    # comes out negative, that's the same referral-bias red flag found in
    # the heart disease model - don't ship it live without investigating.
    problems = _check_coefficient_directions(pipeline, feature_names, expected_positive=["bp", "htn", "dm", "bu", "sc"])

    categorical = {"rbc", "pc", "pcc", "ba", "htn", "dm", "cad", "appet", "pe", "ane"}
    defaults = {}
    for col in feature_names:
        if col in categorical:
            defaults[col] = float(X[col].mode()[0])
        else:
            defaults[col] = float(X[col].median())

    with open(os.path.join(BASE_DIR, "kidney_model.pkl"), "wb") as f:
        pickle.dump({"pipeline": pipeline, "feature_names": feature_names, "defaults": defaults}, f)

    return acc, auc, problems


def train_liver_model():
    """
    UNTESTED - same situation as kidney: could not fetch this dataset into
    my sandbox. Written against the documented schema using the official
    ucimlrepo access method.

    IMPORTANT LIMITATION - more severe than kidney or heart disease: of
    this dataset's 10 fields, only age and gender are things a phone app
    can self-report. Everything else (bilirubin, ALT/AST liver enzymes,
    total protein, albumin, albumin/globulin ratio) requires an actual
    blood test. Realistically this model is only useful to someone who has
    a recent liver function test report in hand to type in - for anyone
    else, data_completeness will show ~2/10 and the prediction is mostly
    running on population defaults. Consider whether that's honest enough
    to expose in the UI at all, versus keeping it backend-only/API-only
    for now with a very clear "needs your lab report" framing.

    I also don't know ucimlrepo's exact column name casing for this
    dataset with certainty (unlike diabetes/heart, which I confirmed
    directly from real CSV headers) - inspect `feature_names` after
    fetching and adjust FRIENDLY_NAMES / predictor.py if names differ from
    what's assumed here.

    Needs: pip install ucimlrepo
    Source: Ramana, Venkateswarlu et al., UCI ML Repository, ILPD (Indian
    Liver Patient Dataset), id 225, CC BY 4.0. 583 patients (416 liver
    disease / 167 not) from Andhra Pradesh, India.
    """
    from ucimlrepo import fetch_ucirepo

    dataset = fetch_ucirepo(id=225)
    X = dataset.data.features.copy()
    y = dataset.data.targets.copy()
    y_col = y.columns[0]

    gender_col = next((c for c in X.columns if c.lower() == "gender"), None)
    if gender_col:
        X[gender_col] = X[gender_col].astype(str).str.strip().str.lower().map(
            {"male": 1, "female": 0, "m": 1, "f": 0}
        )

    feature_names = list(X.columns)
    for col in feature_names:
        X[col] = pd.to_numeric(X[col], errors="coerce")
        X[col] = X[col].fillna(X[col].median())

    # This dataset's target encoding varies by distribution version (1/2,
    # yes/no, etc.) - identify the "has disease" class by count rather than
    # assuming a specific raw value: it's documented as 416 disease-positive
    # vs 167 negative, so the disease class is reliably the majority value
    # here (itself a sign this sample was curated for research, not drawn
    # to reflect real-world prevalence - similar caveat to heart disease).
    value_counts = y[y_col].value_counts()
    positive_value = value_counts.idxmax()
    y_binary = (y[y_col] == positive_value).astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_binary, test_size=0.2, random_state=42, stratify=y_binary
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000)),
    ])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    print(f"[Liver Disease Model] Test Accuracy: {acc:.3f} | ROC-AUC: {auc:.3f}")
    print(f"Feature names as returned by ucimlrepo: {feature_names}")
    print(classification_report(y_test, y_pred, target_names=["No Liver Disease", "Liver Disease"]))

    # Elevated bilirubin and liver enzymes should clinically INCREASE risk.
    # Column names guessed from common distributions of this dataset -
    # check the printed feature_names above if this check silently skips
    # everything (means the guessed names didn't match).
    bilirubin_col = next((c for c in feature_names if "bilirubin" in c.lower() and "total" in c.lower()), None)
    alt_col = next((c for c in feature_names if "alamine" in c.lower() or "sgpt" in c.lower()), None)
    expected = [c for c in [bilirubin_col, alt_col] if c]
    if expected:
        _check_coefficient_directions(pipeline, feature_names, expected_positive=expected)
    else:
        print("Could not auto-detect bilirubin/ALT column names to sanity-check - "
              "inspect coefficients manually against feature_names above.")

    categorical = {gender_col} if gender_col else set()
    defaults = {}
    for col in feature_names:
        if col in categorical:
            defaults[col] = float(X[col].mode()[0])
        else:
            defaults[col] = float(X[col].median())

    with open(os.path.join(BASE_DIR, "liver_model.pkl"), "wb") as f:
        pickle.dump({"pipeline": pipeline, "feature_names": feature_names, "defaults": defaults}, f)

    return acc, auc


if __name__ == "__main__":
    print("Training diabetes model...")
    train_diabetes_model()
    print()
    print("Training heart disease model...")
    train_heart_model()
    print()
    print("Training kidney disease model...")
    train_kidney_model()
    print()
    print("Training liver disease model (untested by me - see docstring, severe self-report limitation)...")
    try:
        train_liver_model()
    except ImportError:
        print("Skipped: run `pip install ucimlrepo` first, then re-run this script.")
    print()
    print("Done. Models saved to app/ml/*.pkl")
