"""
Lightweight persistence so Family Health, Mental Health check-ins, and
Health Score history survive an app restart - currently all pure
in-memory React state that resets every time the app closes.

No user accounts/login exist in this project, so records are keyed by a
`device_id` the mobile app generates once and stores locally (see mobile
README for the AsyncStorage piece) - not real authentication, just enough
to keep one installation's data separate from another's for a hackathon
demo. Anyone with the device_id string could read that device's data;
don't use this design for anything beyond a demo without adding real auth.

SQLite + stdlib sqlite3 - no new dependency, single file database,
zero setup. This is the one persistence-layer piece of this project I can
actually run and test end-to-end myself, since it needs no network and no
uninstalled package.
"""
import sqlite3
import json
import os
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "healthverse.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relation TEXT,
    age INTEGER,
    sex TEXT,
    blood_group TEXT,
    conditions TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_device ON family_members(device_id);

CREATE TABLE IF NOT EXISTS mood_checkins (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    mood INTEGER NOT NULL,
    at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mood_device ON mood_checkins(device_id);

CREATE TABLE IF NOT EXISTS health_score_history (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    overall REAL,
    sub_scores TEXT,
    at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_score_device ON health_score_history(device_id);

CREATE TABLE IF NOT EXISTS emergency_profile (
    device_id TEXT PRIMARY KEY,
    blood_group TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    medical_notes TEXT
);
"""


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)


def _now():
    return datetime.now(timezone.utc).isoformat()


# --- Family members ---

def list_family_members(device_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM family_members WHERE device_id = ? ORDER BY created_at", (device_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def add_family_member(device_id: str, member: dict) -> dict:
    member_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """INSERT INTO family_members
               (id, device_id, name, relation, age, sex, blood_group, conditions, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (member_id, device_id, member.get("name"), member.get("relation"),
             member.get("age"), member.get("sex"), member.get("bloodGroup"),
             member.get("conditions"), _now()),
        )
    return {**member, "id": member_id}


def remove_family_member(device_id: str, member_id: str) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            "DELETE FROM family_members WHERE id = ? AND device_id = ?", (member_id, device_id)
        )
        return cur.rowcount > 0


# --- Mood check-ins ---

def add_mood_checkin(device_id: str, mood: int) -> dict:
    checkin_id = str(uuid.uuid4())
    at = _now()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO mood_checkins (id, device_id, mood, at) VALUES (?, ?, ?, ?)",
            (checkin_id, device_id, mood, at),
        )
    return {"id": checkin_id, "mood": mood, "at": at}


def list_mood_checkins(device_id: str, limit: int = 20) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM mood_checkins WHERE device_id = ? ORDER BY at DESC LIMIT ?",
            (device_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


# --- Health score history ---

def add_score_snapshot(device_id: str, overall: float, sub_scores: dict) -> dict:
    entry_id = str(uuid.uuid4())
    at = _now()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO health_score_history (id, device_id, overall, sub_scores, at) VALUES (?, ?, ?, ?, ?)",
            (entry_id, device_id, overall, json.dumps(sub_scores), at),
        )
    return {"id": entry_id, "overall": overall, "subScores": sub_scores, "at": at}


def list_score_history(device_id: str, limit: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM health_score_history WHERE device_id = ? ORDER BY at ASC LIMIT ?",
            (device_id, limit),
        ).fetchall()
        return [
            {"id": r["id"], "overall": r["overall"], "subScores": json.loads(r["sub_scores"]), "at": r["at"]}
            for r in rows
        ]


# --- Emergency profile ---

def get_emergency_profile(device_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM emergency_profile WHERE device_id = ?", (device_id,)
        ).fetchone()
        return dict(row) if row else None


def set_emergency_profile(device_id: str, profile: dict) -> dict:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO emergency_profile (device_id, blood_group, contact_name, contact_phone, medical_notes)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(device_id) DO UPDATE SET
                 blood_group=excluded.blood_group, contact_name=excluded.contact_name,
                 contact_phone=excluded.contact_phone, medical_notes=excluded.medical_notes""",
            (device_id, profile.get("bloodGroup"), profile.get("contactName"),
             profile.get("contactPhone"), profile.get("medicalNotes")),
        )
    return profile
