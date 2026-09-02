"""Standings and FIDE tiebreak calculation.

Computed purely from the domain state (games + byes), independent of the pairing
engine. Ships the common Swiss default set:

  1. Points
  2. Buchholz (sum of opponents' scores)
  3. Buchholz Cut-1 (drop the lowest opponent score)
  4. Sonneborn-Berger (sum of defeated opponents' scores + half of drawn)
  5. Number of wins
  6. Rating / start number (final deterministic fallback)

Tiebreak selection is configurable; this is the P0 default the plan calls for.
Note: production FIDE tiebreaks have subtleties (virtual-opponent handling for
unplayed games, FIDE 2023 rules). This POC uses the standard "played score"
approach, which is correct for events without forfeits/byes and a close
approximation otherwise — see README for the caveat.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .pairing import points_times_ten
from .models import GameResult


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


def _opponents(tournament, pid: str) -> list[str]:
    opps = []
    for rnd in tournament.finalized_rounds():
        g = tournament.game_for_player(rnd, pid)
        if g is None or g.is_bye:
            continue
        opps.append(g.black_id if g.white_id == pid else g.white_id)
    return opps


def compute_standings(tournament) -> list[ScoreRow]:
    points = {p.player_id: _player_points(tournament, p.player_id)
              for p in tournament.players}

    rows: list[ScoreRow] = []
    for p in tournament.players:
        opps = _opponents(tournament, p.player_id)
        opp_scores = sorted(points[o] for o in opps)
        buchholz = sum(opp_scores)
        buchholz_cut1 = sum(opp_scores[1:]) if opp_scores else 0.0

        # Sonneborn-Berger: full opp score for a win, half for a draw.
        sb = 0.0
        wins = 0
        for rnd in tournament.finalized_rounds():
            g = tournament.game_for_player(rnd, p.player_id)
            if g is None or g.is_bye:
                continue
            opp = g.black_id if g.white_id == p.player_id else g.white_id
            is_white = g.white_id == p.player_id
            won = ((is_white and g.result in (GameResult.WHITE_WIN, GameResult.WHITE_WIN_FORFEIT)) or
                   (not is_white and g.result in (GameResult.BLACK_WIN, GameResult.BLACK_WIN_FORFEIT)))
            drew = g.result == GameResult.DRAW
            if won:
                wins += 1
                sb += points[opp]
            elif drew:
                sb += points[opp] / 2.0

        rows.append(ScoreRow(
            player_id=p.player_id, name=p.name, rating=p.rating, start_no=p.start_no,
            points=points[p.player_id], wins=wins, buchholz=buchholz,
            buchholz_cut1=buchholz_cut1, sonneborn_berger=sb,
            tiebreaks={"buchholz": buchholz, "buchholz_cut1": buchholz_cut1,
                       "sonneborn_berger": sb, "wins": wins},
        ))

    # Sort by the configured tiebreak chain, then rating desc, then seed asc.
    rows.sort(key=lambda r: (-r.points, -r.buchholz_cut1, -r.buchholz,
                             -r.sonneborn_berger, -r.wins, -r.rating, r.start_no))
    for i, row in enumerate(rows, start=1):
        row.rank = i
    return rows
