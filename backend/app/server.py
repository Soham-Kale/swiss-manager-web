"""Swiss-Manager web backend — Flask + SQLite + py4swiss pairing engine.

Run:
    pip install -r requirements.txt
    flask --app app.server run --port 5000
Serves the built React app (frontend/dist) at / when present, and the API at /api/*.
"""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from .db import init_db, get_conn, dumps, loads
from .engine import ByeType, GameResult, NoValidPairingError, TournamentError
from . import repository as repo
from .parse import parse_xlsx, parse_csvs, parse_json, parse_players, _rows_from_csv

_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
app = Flask(__name__, static_folder=str(_DIST) if _DIST.exists() else None)
CORS(app)
init_db()

DEFAULT_TIEBREAKS = ["Buchholz", "Buchholz Cut-1", "Sonneborn-Berger", "Direct Encounter", "Number of Wins"]

# UI result codes -> engine GameResult value
_RESULT_MAP = {
    "1:0": "1-0", "0:1": "0-1", "½:½": "0.5-0.5", "0.5:0.5": "0.5-0.5",
    "1F:0F": "1-0F", "0F:1F": "0-1F", "0F:0F": "0-0", "0:0": "0-0",
    # Unrated results score the same points (we don't track the rated flag here):
    "1U:0U": "1-0", "0U:1U": "0-1", "½:½U": "0.5-0.5",
    "1-0": "1-0", "0-1": "0-1", "0.5-0.5": "0.5-0.5", "1-0F": "1-0F", "0-1F": "0-1F", "0-0": "0-0",
}


def env(status, text, data=None):
    return jsonify({"status": status, "text": text, "data": data})


# ------------------------------- tournaments ------------------------------- #
@app.post("/api/tournaments")
def create_tournament():
    b = request.get_json(force=True) or {}
    conn = get_conn()
    try:
        cur = conn.execute(
            """INSERT INTO tournaments
               (name, rounds, organizer, director, chief_arbiter, deputy_arbiter, arbiter,
                city, federation, website, time_control, date_from, date_to,
                first_board_white, pairing_engine, tiebreaks, status)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'setup')""",
            (b.get("name") or "New Tournament", int(b.get("rounds") or 7),
             b.get("organizer", ""), b.get("director", ""), b.get("chief_arbiter", ""),
             b.get("deputy_arbiter", ""), b.get("arbiter", ""), b.get("city", ""),
             b.get("federation", ""), b.get("website", ""), b.get("time_control", ""),
             b.get("date_from", ""), b.get("date_to", ""),
             1 if b.get("first_board_white", True) else 0,
             b.get("pairing_engine", "dutch"),
             dumps(b.get("tiebreaks") or DEFAULT_TIEBREAKS)))
        conn.commit()
        return env(True, "Tournament created", {"id": cur.lastrowid})
    finally:
        conn.close()


@app.get("/api/tournaments")
def list_tournaments():
    conn = get_conn()
    try:
        rows = conn.execute("SELECT id,name,rounds,city,status,created_at FROM tournaments ORDER BY id DESC").fetchall()
        return env(True, "ok", [dict(r) for r in rows])
    finally:
        conn.close()


def _tournament_dto(conn, tid):
    t = conn.execute("SELECT * FROM tournaments WHERE id=?", (tid,)).fetchone()
    if not t:
        return None
    d = dict(t)
    d["first_board_white"] = bool(d["first_board_white"])
    d["tiebreaks"] = loads(d["tiebreaks"], [])
    d["players"] = [dict(p) for p in conn.execute(
        "SELECT * FROM players WHERE tid=? ORDER BY start_no", (tid,))]
    d["rounds"] = [dict(r) for r in conn.execute(
        "SELECT id,number,finalized FROM rounds WHERE tid=? ORDER BY number", (tid,))]
    return d


@app.get("/api/tournaments/<int:tid>")
def get_tournament(tid):
    conn = get_conn()
    try:
        d = _tournament_dto(conn, tid)
        if not d:
            return env(False, "not found"), 404
        return env(True, "ok", d)
    finally:
        conn.close()


@app.put("/api/tournaments/<int:tid>")
def update_tournament(tid):
    b = request.get_json(force=True) or {}
    fields = ["name", "rounds", "organizer", "director", "chief_arbiter", "deputy_arbiter",
              "arbiter", "city", "federation", "website", "time_control", "date_from",
              "date_to", "pairing_engine"]
    conn = get_conn()
    try:
        sets, vals = [], []
        for f in fields:
            if f in b:
                sets.append(f"{f}=?"); vals.append(b[f])
        if "first_board_white" in b:
            sets.append("first_board_white=?"); vals.append(1 if b["first_board_white"] else 0)
        if "tiebreaks" in b:
            sets.append("tiebreaks=?"); vals.append(dumps(b["tiebreaks"]))
        if sets:
            vals.append(tid)
            conn.execute(f"UPDATE tournaments SET {', '.join(sets)} WHERE id=?", vals)
            conn.commit()
        return env(True, "updated", _tournament_dto(conn, tid))
    finally:
        conn.close()


# --------------------------------- players --------------------------------- #
def _save_roster(conn, tid, players, reseed=True):
    if reseed:
        ordered = sorted(players, key=lambda p: (-(int(p.get("rating") or 0)), str(p.get("name") or "")))
        for i, p in enumerate(ordered, 1):
            p["start_no"] = i
        players = ordered
    else:
        players = sorted(players, key=lambda p: int(p.get("start_no") or 0))
    conn.execute("DELETE FROM players WHERE tid=?", (tid,))
    for p in players:
        conn.execute(
            """INSERT INTO players (tid,start_no,name,rating,fide_id,sex,title,federation,club,status)
               VALUES (?,?,?,?,?,?,?,?,?, 'active')""",
            (tid, int(p["start_no"]), p.get("name", ""), int(p.get("rating") or 0),
             p.get("fide_id"), p.get("sex"), p.get("title"),
             p.get("federation") or p.get("fed"), p.get("club")))
    conn.commit()


@app.post("/api/tournaments/<int:tid>/players")
def set_players(tid):
    b = request.get_json(force=True) or {}
    players = b.get("players") or []
    reseed = b.get("reseed", True)
    conn = get_conn()
    try:
        _save_roster(conn, tid, players, reseed=reseed)
        return env(True, f"{len(players)} players saved", _tournament_dto(conn, tid))
    finally:
        conn.close()


@app.post("/api/tournaments/<int:tid>/players/import")
def import_players(tid):
    f = request.files.get("file") or request.files.get("datafile")
    if not f or not f.filename:
        return env(False, "no file"), 400
    raw = f.read()
    try:
        if raw[:2] == b"PK":
            players, _ = parse_xlsx(raw)
        elif raw.lstrip()[:1] in (b"{", b"["):
            players, _ = parse_json(raw)
        else:
            players = parse_players(_rows_from_csv(raw.decode("utf-8-sig")))
    except Exception as e:  # noqa: BLE001
        return env(False, f"could not read file: {e}"), 400
    conn = get_conn()
    try:
        _save_roster(conn, tid, players, reseed=False if any(p.get("start_no") for p in players) else True)
        return env(True, f"Imported {len(players)} players", _tournament_dto(conn, tid))
    finally:
        conn.close()


# ---------------------------------- rounds --------------------------------- #
def _points_map(t):
    from .engine.standings import compute_standings
    return {r.player_id: r.points for r in compute_standings(t)}


def _round_dto(conn, tid, number):
    trow, t = repo.load_engine_tournament(conn, tid)
    rrow = conn.execute("SELECT * FROM rounds WHERE tid=? AND number=?", (tid, number)).fetchone()
    if not rrow:
        return None
    pts = _points_map(t)
    names = {p.start_no: p for p in t.players}
    boards = []
    for g in conn.execute("SELECT * FROM games WHERE round_id=? ORDER BY board_no", (rrow["id"],)):
        w = names.get(g["white_sno"])
        b = names.get(g["black_sno"]) if g["black_sno"] else None
        boards.append({
            "board_no": g["board_no"],
            "white_sno": g["white_sno"], "white_name": w.name if w else "",
            "white_rating": w.rating if w else 0,
            "white_pts": pts.get(f"S{g['white_sno']}", 0.0),
            "black_sno": g["black_sno"], "black_name": b.name if b else None,
            "black_rating": b.rating if b else 0,
            "black_pts": pts.get(f"S{g['black_sno']}", 0.0) if g["black_sno"] else None,
            "is_bye": g["black_sno"] is None, "bye": g["bye"], "result": g["result"],
        })
    return {"number": rrow["number"], "finalized": bool(rrow["finalized"]), "boards": boards}


@app.post("/api/tournaments/<int:tid>/rounds/next")
def next_round(tid):
    engine = (request.args.get("engine") or "dutch").lower()
    conn = get_conn()
    try:
        try:
            trow, t = repo.load_engine_tournament(conn, tid)
        except KeyError:
            return env(False, "not found"), 404
        if not t.players:
            return env(False, "Add players first"), 400
        try:
            rnd = t.generate_next_round(pairing_engine=engine)
        except NoValidPairingError as e:
            return env(False, f"No valid pairing: {e}"), 409
        except TournamentError as e:
            return env(False, str(e)), 400
        repo.persist_round(conn, tid, rnd)
        conn.execute("UPDATE tournaments SET status=? WHERE id=?", (t.status.value, tid))
        conn.commit()
        return env(True, f"Round {rnd.number} paired", _round_dto(conn, tid, rnd.number))
    finally:
        conn.close()


@app.get("/api/tournaments/<int:tid>/rounds/<int:n>")
def get_round(tid, n):
    conn = get_conn()
    try:
        d = _round_dto(conn, tid, n)
        if not d:
            return env(False, "round not found"), 404
        return env(True, "ok", d)
    finally:
        conn.close()


@app.post("/api/tournaments/<int:tid>/rounds/<int:n>/results")
def set_results(tid, n):
    b = request.get_json(force=True) or {}
    conn = get_conn()
    try:
        rrow = conn.execute("SELECT * FROM rounds WHERE tid=? AND number=?", (tid, n)).fetchone()
        if not rrow:
            return env(False, "round not found"), 404
        for item in b.get("results", []):
            code = _RESULT_MAP.get(str(item.get("result")))
            if not code:
                continue
            conn.execute("UPDATE games SET result=? WHERE round_id=? AND board_no=? AND black_sno IS NOT NULL",
                         (code, rrow["id"], int(item["board_no"])))
        conn.commit()
        return env(True, "results saved", _round_dto(conn, tid, n))
    finally:
        conn.close()


@app.post("/api/tournaments/<int:tid>/rounds/<int:n>/finalize")
def finalize_round(tid, n):
    conn = get_conn()
    try:
        trow, t = repo.load_engine_tournament(conn, tid)
        try:
            t.finalize_round(n)
        except TournamentError as e:
            return env(False, str(e)), 400
        conn.execute("UPDATE rounds SET finalized=1 WHERE tid=? AND number=?", (tid, n))
        conn.execute("UPDATE tournaments SET status=? WHERE id=?", (t.status.value, tid))
        conn.commit()
        return env(True, f"Round {n} finalized", {"status": t.status.value})
    finally:
        conn.close()


@app.get("/api/tournaments/<int:tid>/standings")
def standings(tid):
    conn = get_conn()
    try:
        trow, t = repo.load_engine_tournament(conn, tid)
        from .engine.standings import compute_standings
        rows = [{"rank": r.rank, "start_no": r.start_no, "name": r.name, "rating": r.rating,
                 "points": r.points, "buchholz": r.buchholz, "buchholz_cut1": r.buchholz_cut1,
                 "sonneborn_berger": r.sonneborn_berger, "wins": r.wins}
                for r in compute_standings(t)]
        return env(True, "ok", {"standings": rows})
    except KeyError:
        return env(False, "not found"), 404
    finally:
        conn.close()


@app.get("/api/tournaments/<int:tid>/export/trf")
def export_trf(tid):
    conn = get_conn()
    try:
        trow, t = repo.load_engine_tournament(conn, tid)
        return env(True, "ok", {"trf": t.export_trf()})
    except KeyError:
        return env(False, "not found"), 404
    finally:
        conn.close()


# --------------------------- serve the built SPA --------------------------- #
@app.get("/")
def index():
    if _DIST.exists():
        return send_from_directory(str(_DIST), "index.html")
    return "Swiss-Manager API running. Build the frontend (npm run build) to serve the UI here.", 200


@app.get("/<path:path>")
def spa(path):
    if _DIST.exists() and (_DIST / path).exists():
        return send_from_directory(str(_DIST), path)
    if _DIST.exists():
        return send_from_directory(str(_DIST), "index.html")
    return env(False, "not found"), 404
