"""SQLite persistence (stdlib sqlite3) for the Swiss-Manager web app.

Tables mirror the domain: tournaments, players, rounds, games. The pairing
engine (app/engine) stays DB-agnostic; repository.py maps rows <-> engine.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get("SWISS_DB", str(Path(__file__).resolve().parents[1] / "swiss_manager.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rounds INTEGER NOT NULL DEFAULT 7,
  organizer TEXT DEFAULT '',
  director TEXT DEFAULT '',
  chief_arbiter TEXT DEFAULT '',
  deputy_arbiter TEXT DEFAULT '',
  arbiter TEXT DEFAULT '',
  city TEXT DEFAULT '',
  federation TEXT DEFAULT '',
  website TEXT DEFAULT '',
  time_control TEXT DEFAULT '',
  date_from TEXT DEFAULT '',
  date_to TEXT DEFAULT '',
  first_board_white INTEGER DEFAULT 1,
  pairing_engine TEXT DEFAULT 'dutch',
  tiebreaks TEXT DEFAULT '[]',
  status TEXT DEFAULT 'setup',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tid INTEGER NOT NULL,
  start_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  rating INTEGER DEFAULT 0,
  fide_id TEXT,
  sex TEXT,
  title TEXT,
  federation TEXT,
  club TEXT,
  status TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tid INTEGER NOT NULL,
  number INTEGER NOT NULL,
  finalized INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  board_no INTEGER NOT NULL,
  white_sno INTEGER NOT NULL,
  black_sno INTEGER,
  result TEXT DEFAULT 'pending',
  bye TEXT
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def dumps(v) -> str:
    return json.dumps(v)


def loads(s, default):
    try:
        return json.loads(s) if s else default
    except (json.JSONDecodeError, TypeError):
        return default
