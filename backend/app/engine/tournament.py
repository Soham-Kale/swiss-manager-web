"""Tournament state machine — the orchestration layer.

Holds roster + rounds and enforces the legal transitions:

    setup --(seed + generate R1)--> running
    running: record results -> finalize round -> generate next round ...
    running --(last round finalized)--> finished

This is the object a FastAPI service would wrap per tournament id, persisting
its state to the DB tables from the plan. All pairing/TRF logic is delegated to
``engine.py``; all standings to ``standings.py``.
"""

from __future__ import annotations

from typing import Optional

from . import pairing as engine
from .models import (
    ByeType,
    Game,
    GameResult,
    Player,
    PlayerStatus,
    Round,
    TournamentStatus,
)


class TournamentError(RuntimeError):
    pass


class Tournament:
    def __init__(
        self,
        name: str,
        num_rounds: int,
        city: str = "",
        federation: str = "",
        chief_arbiter: str = "Arbiter",
        first_board_white: bool = True,
    ) -> None:
        self.name = name
        self.num_rounds = num_rounds
        self.city = city
        self.federation = federation
        self.chief_arbiter = chief_arbiter
        self.first_board_white = first_board_white
        self.status = TournamentStatus.SETUP
        self.players: list[Player] = []
        self.rounds: list[Round] = []
        self._by_id: dict[str, Player] = {}

    # ---------------- roster ----------------
    def add_player(self, player: Player) -> None:
        if player.player_id in self._by_id:
            raise TournamentError(f"duplicate player_id {player.player_id}")
        self.players.append(player)
        self._by_id[player.player_id] = player

    def seed(self) -> None:
        """Assign FIDE starting numbers by rating desc, then name. Round-1 only."""
        if self.status != TournamentStatus.SETUP:
            raise TournamentError("can only seed during setup")
        ordered = sorted(self.players, key=lambda p: (-p.rating, p.name))
        for i, p in enumerate(ordered, start=1):
            p.start_no = i

    # ---------------- lookups ----------------
    def player_by_id(self, pid: str) -> Player:
        return self._by_id[pid]

    def player_by_start_no(self, start_no: int) -> Player:
        for p in self.players:
            if p.start_no == start_no:
                return p
        raise KeyError(start_no)

    def players_by_seed(self) -> list[Player]:
        return sorted(self.players, key=lambda p: p.start_no)

    def finalized_rounds(self) -> list[Round]:
        return [r for r in self.rounds if r.finalized]

    @staticmethod
    def game_for_player(rnd: Round, pid: str) -> Optional[Game]:
        for g in rnd.games:
            if g.white_id == pid or g.black_id == pid:
                return g
        return None

    # ---------------- round lifecycle ----------------
    def current_round(self) -> Optional[Round]:
        return self.rounds[-1] if self.rounds else None

    def generate_next_round(self, pairing_engine: str = "dutch") -> Round:
        if self.status == TournamentStatus.FINISHED:
            raise TournamentError("tournament already finished")
        if not self.players:
            raise TournamentError("no players")

        prev = self.current_round()
        if prev is not None and not prev.finalized:
            raise TournamentError(f"round {prev.number} is not finalized yet")
        if len(self.finalized_rounds()) >= self.num_rounds:
            raise TournamentError("all rounds already played")

        if self.status == TournamentStatus.SETUP:
            if any(p.start_no == 0 for p in self.players):
                self.seed()
            self.status = TournamentStatus.RUNNING

        games = engine.generate_next_round_games(self, engine=pairing_engine)
        rnd = Round(number=len(self.rounds) + 1, games=games)
        self.rounds.append(rnd)
        return rnd

    def record_result(self, round_no: int, board_no: int, result: GameResult,
                      source: str = "manual", pgn_ref: str | None = None) -> None:
        g = self._game(round_no, board_no)
        if g.is_bye:
            raise TournamentError("cannot set a result on a bye board")
        g.result = result
        g.result_source = source
        g.pgn_ref = pgn_ref

    def set_bye(self, round_no: int, player_id: str, bye_type: ByeType) -> None:
        """Organizer override: change a player's bye type (e.g. requested HPB)."""
        rnd = self.rounds[round_no - 1]
        g = self.game_for_player(rnd, player_id)
        if g is None or not g.is_bye:
            raise TournamentError("player has no bye this round")
        g.bye = bye_type

    def withdraw(self, player_id: str) -> None:
        """Mark a player withdrawn — excluded from all future pairings."""
        self.player_by_id(player_id).status = PlayerStatus.WITHDRAWN

    def finalize_round(self, round_no: int) -> None:
        rnd = self.rounds[round_no - 1]
        if not rnd.is_complete:
            missing = [g.board_no for g in rnd.games if not g.is_complete]
            raise TournamentError(f"round {round_no} has open boards: {missing}")
        rnd.finalized = True
        if len(self.finalized_rounds()) >= self.num_rounds:
            self.status = TournamentStatus.FINISHED

    # ---------------- outputs ----------------
    def standings(self):
        from .standings import compute_standings
        return compute_standings(self)

    def export_trf(self) -> str:
        return engine.to_trf_text(self)

    def _game(self, round_no: int, board_no: int) -> Game:
        rnd = self.rounds[round_no - 1]
        for g in rnd.games:
            if g.board_no == board_no:
                return g
        raise TournamentError(f"no board {board_no} in round {round_no}")
