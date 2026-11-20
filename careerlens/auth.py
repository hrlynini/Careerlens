"""Accounts: sign up, log in, sessions and user profiles, stored in a local SQLite file.

Passwords are hashed with PBKDF2-HMAC-SHA256 (210k iterations, random 16-byte salt) from the standard
library. Logins return a random session token that the frontend sends as `Authorization: Bearer <token>`.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "careerlens.db"
SESSION_DAYS = 30
_ITERATIONS = 210_000
_lock = threading.Lock()

PROFILE_FIELDS = {
    "headline": 120, "location": 80, "experience": 20, "target_role": 80, "bio": 600,
    "linkedin": 200, "github": 200, "portfolio": 200,
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(ValueError):
    """User-facing auth problem (bad credentials, duplicate email, invalid input)."""


def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            profile TEXT NOT NULL DEFAULT '{}',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at REAL NOT NULL
        );
    """)
    return conn


@contextmanager
def _conn():
    """One connection per operation: commit on success, roll back on error, always close."""
    conn = _db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS).hex()


def _public(row: sqlite3.Row) -> dict:
    profile = json.loads(row["profile"] or "{}")
    return {"id": row["id"], "email": row["email"], "name": row["name"],
            "created_at": row["created_at"], "profile": {k: profile.get(k, "") for k in PROFILE_FIELDS}
            | {"skills": profile.get("skills", [])}}


def _new_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                 (token, user_id, time.time() + SESSION_DAYS * 86400))
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))  # tidy up old sessions
    return token


def signup(name: str, email: str, password: str) -> tuple[str, dict]:
    name, email = name.strip(), email.strip().lower()
    if len(name) < 2:
        raise AuthError("Please enter your name.")
    if not EMAIL_RE.match(email):
        raise AuthError("Please enter a valid email address.")
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.")
    salt = secrets.token_hex(16)
    with _lock, _conn() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                (email, name, _hash(password, salt), salt, time.time()))
        except sqlite3.IntegrityError:
            raise AuthError("An account with this email already exists. Try logging in.")
        token = _new_session(conn, cur.lastrowid)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return token, _public(row)


def login(email: str, password: str) -> tuple[str, dict]:
    with _lock, _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        # Same message for unknown email and wrong password, so emails can't be probed.
        if row is None or not hmac.compare_digest(row["password_hash"], _hash(password, row["salt"])):
            raise AuthError("Incorrect email or password.")
        return _new_session(conn, row["id"]), _public(row)


def user_for_token(token: str) -> dict | None:
    if not token:
        return None
    with _lock, _conn() as conn:
        row = conn.execute(
            "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id "
            "WHERE sessions.token = ? AND sessions.expires_at > ?", (token, time.time())).fetchone()
        return _public(row) if row else None


def logout(token: str) -> None:
    with _lock, _conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def update_profile(user_id: int, name: str | None, profile: dict) -> dict:
    clean = {k: str(profile.get(k, ""))[:limit].strip() for k, limit in PROFILE_FIELDS.items()}
    skills = profile.get("skills", [])
    clean["skills"] = [str(s).strip()[:40] for s in skills if str(s).strip()][:30] if isinstance(skills, list) else []
    with _lock, _conn() as conn:
        if name is not None:
            if len(name.strip()) < 2:
                raise AuthError("Please enter your name.")
            conn.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip()[:80], user_id))
        conn.execute("UPDATE users SET profile = ? WHERE id = ?", (json.dumps(clean), user_id))
        return _public(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


def change_password(user_id: int, current: str, new: str) -> None:
    if len(new) < 8:
        raise AuthError("New password must be at least 8 characters.")
    with _lock, _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not hmac.compare_digest(row["password_hash"], _hash(current, row["salt"])):
            raise AuthError("Current password is incorrect.")
        salt = secrets.token_hex(16)
        conn.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (_hash(new, salt), salt, user_id))
