"""
Air quality via aqicn.org (World Air Quality Index project) - a free,
developer-friendly API that aggregates official government monitors,
including India's CPCB network. Get a free token (instant, no approval
wait) at https://aqicn.org/data-platform/token/

This is one piece of the "Disease Outbreak Map" feature. The other piece
(live dengue/flu/COVID case alerts) does NOT have a good public API as of
this writing - India's real surveillance systems (IDSP/NCVBDC) publish for
institutional/research use, not as a queryable developer API. Don't fake
this data; either drop outbreak alerts from the map for now, or (weaker
but real) surface WHO's global Disease Outbreak News as a non-hyperlocal
substitute. Air quality below is the part that's actually solid.

Untested here (no internet in my sandbox) - verify with your token first
thing before wiring up UI.
"""
import os
import requests  # add to requirements.txt: requests==2.32.3

AQICN_TOKEN = os.environ.get("AQICN_TOKEN")
DAILY_API_KEY = os.environ.get("DAILY_API_KEY")


def _aqi_category(aqi: int) -> dict:
    if aqi <= 50:
        return {"category": "Good", "advice": "Air quality is satisfactory."}
    if aqi <= 100:
        return {"category": "Moderate", "advice": "Unusually sensitive people should consider limiting prolonged outdoor exertion."}
    if aqi <= 150:
        return {"category": "Unhealthy for Sensitive Groups", "advice": "People with heart/lung conditions, children, and older adults should limit prolonged outdoor exertion."}
    if aqi <= 200:
        return {"category": "Unhealthy", "advice": "Everyone should limit prolonged outdoor exertion."}
    if aqi <= 300:
        return {"category": "Very Unhealthy", "advice": "Avoid outdoor activity if possible."}
    return {"category": "Hazardous", "advice": "Stay indoors and keep activity levels low."}


def get_air_quality(city_or_coords: str) -> dict:
    """
    city_or_coords: a city name (e.g. "Delhi") or "geo:lat;lon"
    (e.g. "geo:28.6139;77.2090"). aqicn resolves the nearest station.
    """
    if not AQICN_TOKEN:
        raise RuntimeError("Set AQICN_TOKEN env var - get a free token at aqicn.org/data-platform/token/")

    url = f"https://api.waqi.info/feed/{city_or_coords}/"
    resp = requests.get(url, params={"token": AQICN_TOKEN}, timeout=10)
    data = resp.json()

    if data.get("status") != "ok":
        return {"available": False, "reason": data.get("data", "station not found")}

    d = data["data"]
    aqi = d.get("aqi")
    info = _aqi_category(aqi) if isinstance(aqi, int) else {"category": "Unknown", "advice": ""}

    return {
        "available": True,
        "aqi": aqi,
        "category": info["category"],
        "advice": info["advice"],
        "station": d.get("city", {}).get("name"),
        "measured_at": d.get("time", {}).get("s"),
        "pollutants": {k: v.get("v") for k, v in d.get("iaqi", {}).items()},
    }


def create_video_room() -> dict:
    """Doctor video consultation - the one remaining piece of the original
    Doctor Dashboard idea. Needs a real Daily.co account (free tier
    exists) and DAILY_API_KEY set. Unlike air quality above, there's no
    way to test this without actual paid/free-tier credentials, so this
    is genuinely unverified, not just untested-by-convenience - I have
    neither the account nor internet access in my sandbox to try it."""
    if not DAILY_API_KEY:
        raise RuntimeError("Set DAILY_API_KEY env var - sign up free at daily.co, get a key from the dashboard")

    resp = requests.post(
        "https://api.daily.co/v1/rooms",
        headers={"Authorization": f"Bearer {DAILY_API_KEY}"},
        json={"properties": {"enable_chat": True}},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"room_url": data.get("url"), "room_name": data.get("name")}
