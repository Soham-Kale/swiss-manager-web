"""Map DB rows <-> the in-memory engine.Tournament, and run the pairing engine."""

from __future__ import annotations

from .db import get_conn, loads
from .engine import (
    ByeType, Game, GameResult, Player, PlayerStatus, Round, Tournament, TournamentStatus,
)
from .engine import pairing as pairing_engine

_RESULT_TO_ENUM = {g.value: g for g in GameResult}
_BYE_TO_ENUM = {b.value: b for b in ByeType}


def _pid(sno: int) -> str:
    return f"S{sno}"


def load_engine_tournament(conn, tid: int):
    trow = conn.execute("SELECT * FROM tournaments WHERE id=?", (tid,)).fetchone()
    if not trow:
        raise KeyError(tid)
    t = Tournament(
        name=trow["name"], num_rounds=trow["rounds"], city=trow["city"] or "",
        federation=trow["federation"] or "", chief_arbiter=trow["chief_arbiter"] or "Arbiter",
        first_board_white=bool(trow["first_board_white"]),
    )
    t.status = TournamentStatus(trow["status"]) if trow["status"] in {s.value for s in TournamentStatus} else TournamentStatus.SETUP

    for p in conn.execute("SELECT * FROM players WHERE tid=? ORDER BY start_no", (tid,)):
        t.add_player(Player(
            player_id=_pid(p["start_no"]), name=p["name"], rating=p["rating"] or 0,
            fide_id=p["fide_id"], sex=p["sex"], title=p["title"], federation=p["federation"],
            status=PlayerStatus(p["status"]) if p["status"] in {s.value for s in PlayerStatus} else PlayerStatus.ACTIVE,
            start_no=p["start_no"],
        ))

    for r in conn.execute("SELECT * FROM rounds WHERE tid=? ORDER BY number", (tid,)):
        rnd = Round(number=r["number"], finalized=bool(r["finalized"]))
        for g in conn.execute("SELECT * FROM games WHERE round_id=? ORDER BY board_no", (r["id"],)):
            rnd.games.append(Game(
                board_no=g["board_no"], white_id=_pid(g["white_sno"]),
                black_id=_pid(g["black_sno"]) if g["black_sno"] else None,
                result=_RESULT_TO_ENUM.get(g["result"], GameResult.PENDING),
                bye=_BYE_TO_ENUM.get(g["bye"]) if g["bye"] else None,
            ))
        t.rounds.append(rnd)
    return trow, t


def sno_of(t: Tournament, pid: str) -> int:
    return t.player_by_id(pid).start_no


def persist_round(conn, tid: int, rnd: Round) -> None:
    cur = conn.execute("INSERT INTO rounds (tid, number, finalized) VALUES (?,?,0)",
                       (tid, rnd.number))
    rid = cur.lastrowid
    for g in rnd.games:
        conn.execute(
            "INSERT INTO games (round_id, board_no, white_sno, black_sno, result, bye) "
            "VALUES (?,?,?,?,?,?)",
            (rid, g.board_no, int(g.white_id[1:]),
             int(g.black_id[1:]) if g.black_id else None,
             g.result.value, g.bye.value if g.bye else None))
    conn.commit()
