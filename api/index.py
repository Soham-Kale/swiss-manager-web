"""Vercel serverless entrypoint for the Swiss-Manager Flask backend.

Vercel's @vercel/python runtime looks for a WSGI callable named `app` in this
module. The Flask app lives in backend/app/server.py, so we put `backend/` on
sys.path and re-export it.

Note: Vercel's filesystem is read-only apart from /tmp, so the SQLite file has
to live there. /tmp is per-instance and ephemeral -- data does not survive a
cold start. Point SWISS_DB at a hosted database (e.g. Postgres/Turso) for real
persistence.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("SWISS_DB", "/tmp/swiss_manager.db")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.server import app  # noqa: E402  (import needs sys.path set first)

__all__ = ["app"]
