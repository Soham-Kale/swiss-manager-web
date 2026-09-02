"""Domain models for the Swiss Manager pairing engine.

These are the framework-agnostic data structures that the tournament state
machine, the pairing engine wrapper and the standings calculator all share.
They map 1:1 onto the backend tables described in the plan (tournament /
tournament_player / round / pairing), so porting this into FastAPI + a real DB
is a mechanical step.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class PlayerStatus(str, Enum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"          # left mid-event; not paired in future rounds
    LATE_ENTRY = "late_entry"        # joined after round 1


class GameResult(str, Enum):
    """The result of a single board, from White's perspective.

    Kept deliberately small and human-enterable; the engine wrapper translates
    these into FIDE TRF result tokens.
    """

    WHITE_WIN = "1-0"
    BLACK_WIN = "0-1"
    DRAW = "0.5-0.5"
    # Forfeits (game not played)
    WHITE_WIN_FORFEIT = "1-0F"      # White +, Black -
    BLACK_WIN_FORFEIT = "0-1F"      # Black +, White -
    DOUBLE_FORFEIT = "0-0F"         # both forfeit loss
    PENDING = "pending"             # not yet entered


class ByeType(str, Enum):
    PAIRING_ALLOCATED = "U"   # 1.0 pt — the odd player out, assigned by the engine
    HALF_POINT = "H"          # 0.5 pt — requested bye
    FULL_POINT = "F"          # 1.0 pt — organizer-granted full bye
    ZERO_POINT = "Z"          # 0.0 pt — known absence


@dataclass
class Player:
    """A tournament participant. `start_no` is the FIDE starting rank (seed),
    assigned by rating descending at round 1. `player_id` is our internal id
    (would be the registration user_id in production)."""

    player_id: str
    name: str                      # "Lastname, Firstname"
    rating: int = 0
    fide_id: Optional[str] = None
    sex: Optional[str] = None      # "m" | "w"
    title: Optional[str] = None    # "gm" | "im" | ...
    federation: Optional[str] = None
    status: PlayerStatus = PlayerStatus.ACTIVE
    start_no: int = 0              # assigned when the tournament is seeded


@dataclass
class Game:
    """One board in one round. A bye has black_id=None and a `bye` set."""

    board_no: int
    white_id: str
    black_id: Optional[str] = None
    result: GameResult = GameResult.PENDING
    bye: Optional[ByeType] = None
    result_source: str = "manual"          # "manual" | "digitized"
    pgn_ref: Optional[str] = None          # link to a digitized game, if any

    @property
    def is_bye(self) -> bool:
        return self.black_id is None

    @property
    def is_complete(self) -> bool:
        if self.is_bye:
            return self.bye is not None
        return self.result not in (GameResult.PENDING,)


@dataclass
class Round:
    number: int
    games: list[Game] = field(default_factory=list)
    finalized: bool = False

    @property
    def is_complete(self) -> bool:
        return bool(self.games) and all(g.is_complete for g in self.games)


class TournamentStatus(str, Enum):
    SETUP = "setup"
    RUNNING = "running"
    FINISHED = "finished"
