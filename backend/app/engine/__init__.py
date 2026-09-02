"""Pure Swiss pairing engine (py4swiss-backed). DB-agnostic domain layer."""
from .models import (
    ByeType, Game, GameResult, Player, PlayerStatus, Round, TournamentStatus,
)
from .tournament import Tournament, TournamentError
from .pairing import NoValidPairingError

__all__ = [
    "Tournament", "TournamentError", "NoValidPairingError",
    "Player", "Game", "Round", "GameResult", "ByeType",
    "PlayerStatus", "TournamentStatus",
]
