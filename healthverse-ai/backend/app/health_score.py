"""
Aggregates whatever sub-scores are available into the "87/100" style
dashboard score. Gracefully handles missing categories (e.g. no wearable
connected yet) by averaging only what's present, rather than penalizing
the user for data we don't have.
"""


def heart_subscore(heart_risk_pct, hypertension_pct):
    parts = [p for p in [heart_risk_pct, hypertension_pct] if p is not None]
    if not parts:
        return None
    avg_risk = sum(parts) / len(parts)
    return round(100 - avg_risk)


def sleep_subscore(hours_per_night, quality_1to5=None):
    if hours_per_night is None:
        return None
    # 7-9 hours is the standard adult recommendation (sleep foundations / CDC).
    if 7 <= hours_per_night <= 9:
        base = 100
    else:
        distance = min(abs(hours_per_night - 7), abs(hours_per_night - 9))
        base = max(40, 100 - distance * 12)
    if quality_1to5:
        base = round(base * 0.7 + (quality_1to5 / 5 * 100) * 0.3)
    return round(base)


def stress_subscore(stress_level_1to10):
    if stress_level_1to10 is None:
        return None
    return round(100 - (stress_level_1to10 - 1) * (100 / 9))


def fitness_subscore(active_minutes_per_week):
    if active_minutes_per_week is None:
        return None
    # WHO guideline: 150 min/week moderate activity.
    return round(min(100, (active_minutes_per_week / 150) * 100))


def nutrition_subscore(fruit_veg_servings_per_day=None, self_rating_1to5=None):
    if fruit_veg_servings_per_day is not None:
        # WHO guideline: 5 servings/day.
        return round(min(100, (fruit_veg_servings_per_day / 5) * 100))
    if self_rating_1to5 is not None:
        return round((self_rating_1to5 / 5) * 100)
    return None


def overall_health_score(sub_scores: dict):
    """sub_scores: dict like {'Heart': 90, 'Sleep': None, 'Stress': 68, ...}
    Missing (None) categories are excluded from the average, not zeroed."""
    present = {k: v for k, v in sub_scores.items() if v is not None}
    if not present:
        return {"overall": None, "sub_scores": sub_scores, "missing": list(sub_scores.keys())}
    overall = round(sum(present.values()) / len(present))
    missing = [k for k, v in sub_scores.items() if v is None]
    return {"overall": overall, "sub_scores": sub_scores, "missing": missing}
