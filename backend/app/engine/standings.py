"""Standings and FIDE tiebreak calculation — FIDE Tie-Break Regulations
effective 1 March 2026 (virtual-opponent method for unplayed games).

  1. Points
  2. Buchholz — sum of every opponent's score; each UNPLAYED round (bye/forfeit)
     is counted via a "virtual opponent" (dummy).
  3. Buchholz Cut-1 — Buchholz minus the single lowest contribution.
  4. Sonneborn-Berger — sum over rounds of opponent_score × points_scored.
  5. Number of wins.
  6. Rating / start number (final deterministic fallback).

Virtual opponent (FIDE 2026, Art. 16.4): for each unplayed round the dummy is
given the PARTICIPANT'S OWN score, capped at:
  - forfeits: the scheduled opponent's score;
  - all other unplayed rounds (byes): 0.5 × (rounds played)  [draw-points × rounds].
The result the player "scored" against the dummy is the points awarded for that
unplayed game (1 for full/pairing bye, 0.5 for half-bye, 0 for zero-point bye).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .pairing import points_times_ten
from .models import GameResult, ByeType


@dataclass
class ScoreRow:
    player_id: str
    name: str
    rating: int
    start_no: int
    points: float = 0.0
    wins: int = 0
    buchholz: float = 0.0
    buchholz_cut1: float = 0.0
    sonneborn_berger: float = 0.0
    rank: int = 0
    tiebreaks: dict = field(default_factory=dict)


def _player_points(tournament, pid: str) -> float:
    """Total points (as a float) a player has scored so far."""
    total10 = 0
    for rnd in tournament.finalized_rounds():
        g = tournament.game_for_player(rnd, pid)
        if g is None:
            continue
        if g.is_bye:
            from .pairing import _BYE_TOKEN  # local import to avoid cycle at load
            from py4swiss.trf.results import ColorToken
            total10 += points_times_ten(_BYE_TOKEN[g.bye], ColorToken.BYE_OR_NOT_PAIRED)
            continue
        from .pairing import _tokens_for_result
        from py4swiss.trf.results import ColorToken
        w_tok, b_tok = _tokens_for_result(g.result)
        if g.white_id == pid:
            total10 += points_times_ten(w_tok, ColorToken.WHITE)
        else:
            total10 += points_times_ten(b_tok, ColorToken.BLACK)
    return total10 / 10.0


_BYE_POINTS = {
    ByeType.PAIRING_ALLOCATED: 1.0, ByeType.FULL_POINT: 1.0,
    ByeType.HALF_POINT: 0.5, ByeType.ZERO_POINT: 0.0,
}


def _played_points(result, is_white):
    """(points_scored, is_win, is_forfeit) for a played or forfeited game."""
    if result == GameResult.WHITE_WIN:
        return (1.0 if is_white else 0.0, is_white, False)
    if result == GameResult.BLACK_WIN:
        return (0.0 if is_white else 1.0, not is_white, False)
    if result == GameResult.DRAW:
        return (0.5, False, False)
    if result == GameResult.WHITE_WIN_FORFEIT:
        return (1.0 if is_white else 0.0, is_white, True)
    if result == GameResult.BLACK_WIN_FORFEIT:
        return (0.0 if is_white else 1.0, not is_white, True)
    if result == GameResult.DOUBLE_FORFEIT:
        return (0.0, False, True)
    return (0.0, False, False)  # pending / unknown


def compute_standings(tournament) -> list[ScoreRow]:
    """Ranking with FIDE-2026 virtual-opponent tie-breaks (see module docstring)."""
    players = tournament.players
    finals = tournament.finalized_rounds()
    completed = len(finals)
    points = {p.player_id: _player_points(tournament, p.player_id) for p in players}
    draw_cap = 0.5 * completed  # non-forfeit virtual opponent ceiling

    rows: list[ScoreRow] = []
    for p in players:
        own = points[p.player_id]
        # each entry: (opponent_score_for_buchholz, points_the_player_scored)
        contribs: list[tuple[float, float]] = []
        wins = 0
        for rnd in finals:
            g = tournament.game_for_player(rnd, p.player_id)
            if g is None:
                # not paired this round -> virtual opponent, scored 0
                contribs.append((min(own, draw_cap), 0.0))
                continue
            if g.is_bye:
                bpts = _BYE_POINTS.get(g.bye, 1.0)
                contribs.append((min(own, draw_cap), bpts))  # dummy = own, capped
                continue
            is_white = g.white_id == p.player_id
            opp = g.black_id if is_white else g.white_id
            scored, won, forfeit = _played_points(g.result, is_white)
            if forfeit:
                # forfeited game is "unplayed" -> dummy = own, capped at opp's score
                contribs.append((min(own, points.get(opp, 0.0)), scored))
            else:
                contribs.append((points.get(opp, 0.0), scored))
            if won:
                wins += 1

        buchholz = sum(c[0] for c in contribs)
        cut = min((c[0] for c in contribs), default=0.0)   # drop single lowest
        buchholz_cut1 = buchholz - cut
        sb = sum(c[0] * c[1] for c in contribs)

        rows.append(ScoreRow(
            player_id=p.player_id, name=p.name, rating=p.rating, start_no=p.start_no,
            points=round(own, 2), wins=wins,
            buchholz=round(buchholz, 2), buchholz_cut1=round(buchholz_cut1, 2),
            sonneborn_berger=round(sb, 2),
            tiebreaks={"buchholz": buchholz, "buchholz_cut1": buchholz_cut1,
                       "sonneborn_berger": sb, "wins": wins},
        ))

    rows.sort(key=lambda r: (-r.points, -r.buchholz_cut1, -r.buchholz,
                             -r.sonneborn_berger, -r.wins, -r.rating, r.start_no))
    for i, row in enumerate(rows, start=1):
        row.rank = i
    return rows
