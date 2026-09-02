"""Pairing engine wrapper around the py4swiss library (Dutch system).

This is the only module that knows about py4swiss / TRF. Everything else in the
package speaks in terms of the domain models. The wrapper:

  1. Serializes the current tournament state into a py4swiss ``ParsedTrf``
     (built through the library's own section objects — no hand-aligned columns).
  2. Asks the requested engine (Dutch by default) for the next round's pairings.
  3. Translates the engine's ``Pairing(white, black)`` output (by start number)
     back into domain ``Game`` objects (board numbers + a bye where black == 0).

It also exposes ``to_trf_text`` for the end-of-event federation export.

py4swiss embeds bbpPairings' maximum-weight-matching algorithm; it is
MIT + Apache-2.0 licensed (permissive — safe to ship in a proprietary stack).
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from py4swiss.engines import BursteinEngine, DubovEngine, DutchEngine
from py4swiss.trf.codes import PlayerCode
from py4swiss.trf.parsed_trf import ParsedTrf
from py4swiss.trf.results import ColorToken, ResultToken, RoundResult, ScoringPointSystem
from py4swiss.trf.sections import PlayerSection, TournamentSection, XSection
from py4swiss.trf.sections.x_section import XSectionConfiguration

from .models import ByeType, Game, GameResult, PlayerStatus

if TYPE_CHECKING:
    from .tournament import Tournament

_ENGINES = {"dutch": DutchEngine, "dubov": DubovEngine, "burstein": BursteinEngine}

# Points (times ten) used both for the TRF points column and our standings.
# Mirrors py4swiss' default ScoringPointSystem so validate_contents() passes.
_SCORING = ScoringPointSystem()


class NoValidPairingError(RuntimeError):
    """Raised when the engine cannot produce a legal pairing for the round
    (equivalent to bbpPairings exit code 1). The organizer must intervene."""


# --------------------------------------------------------------------------- #
# Result translation: domain GameResult -> a pair of TRF RoundResult tokens
# --------------------------------------------------------------------------- #
def _tokens_for_result(result: GameResult) -> tuple[ResultToken, ResultToken]:
    """Return (white_token, black_token) for a played/forfeited game."""
    return {
        GameResult.WHITE_WIN: (ResultToken.WIN, ResultToken.LOSS),
        GameResult.BLACK_WIN: (ResultToken.LOSS, ResultToken.WIN),
        GameResult.DRAW: (ResultToken.DRAW, ResultToken.DRAW),
        GameResult.WHITE_WIN_FORFEIT: (ResultToken.FORFEIT_WIN, ResultToken.FORFEIT_LOSS),
        GameResult.BLACK_WIN_FORFEIT: (ResultToken.FORFEIT_LOSS, ResultToken.FORFEIT_WIN),
        GameResult.DOUBLE_FORFEIT: (ResultToken.FORFEIT_LOSS, ResultToken.FORFEIT_LOSS),
    }[result]


_BYE_TOKEN = {
    ByeType.PAIRING_ALLOCATED: ResultToken.PAIRING_ALLOCATED_BYE,
    ByeType.HALF_POINT: ResultToken.HALF_POINT_BYE,
    ByeType.FULL_POINT: ResultToken.FULL_POINT_BYE,
    ByeType.ZERO_POINT: ResultToken.ZERO_POINT_BYE,
}


def points_times_ten(token: ResultToken, color: ColorToken) -> int:
    """Points*10 awarded for a (result, color) pair, per the scoring system."""
    return _SCORING.score_dict[(token, color)]


def _round_results_for_player(tournament: "Tournament", start_no: int) -> list[RoundResult]:
    """Build the ordered per-round RoundResult list for one player (by start_no),
    across every finalized round, exactly as the TRF expects."""
    pid = tournament.player_by_start_no(start_no).player_id
    results: list[RoundResult] = []

    for rnd in tournament.finalized_rounds():
        game = tournament.game_for_player(rnd, pid)
        if game is None:
            # Player not in this round's pairing (e.g. joined late / withdrew):
            # a zero-point bye keeps the round index aligned.
            results.append(RoundResult(id=0, color=ColorToken.BYE_OR_NOT_PAIRED,
                                       result=ResultToken.ZERO_POINT_BYE))
            continue

        if game.is_bye:
            results.append(RoundResult(id=0, color=ColorToken.BYE_OR_NOT_PAIRED,
                                       result=_BYE_TOKEN[game.bye]))
            continue

        white_tok, black_tok = _tokens_for_result(game.result)
        if game.white_id == pid:
            opp = tournament.player_by_id(game.black_id).start_no
            results.append(RoundResult(id=opp, color=ColorToken.WHITE, result=white_tok))
        else:
            opp = tournament.player_by_id(game.white_id).start_no
            results.append(RoundResult(id=opp, color=ColorToken.BLACK, result=black_tok))

    return results


def build_parsed_trf(tournament: "Tournament") -> ParsedTrf:
    """Serialize the whole tournament state into a py4swiss ParsedTrf."""
    player_sections: list[PlayerSection] = []
    zeroed: set[int] = set()

    for player in tournament.players_by_seed():
        rr = _round_results_for_player(tournament, player.start_no)
        pts10 = sum(points_times_ten(r.result, r.color) for r in rr)

        player_sections.append(
            PlayerSection(
                code=PlayerCode("001"),
                starting_number=player.start_no,
                sex=None,                       # kept minimal for the POC
                title=None,
                name=player.name,
                fide_rating=player.rating or None,
                fide_federation=player.federation,
                fide_number=int(player.fide_id) if (player.fide_id or "").isdigit() else None,
                birth_date=None,
                points_times_ten=pts10,
                rank=0,
                results=rr,
            )
        )
        # Withdrawn players must not be paired again: tell the engine to skip them.
        if player.status == PlayerStatus.WITHDRAWN:
            zeroed.add(player.start_no)

    x_section = XSection(
        number_of_rounds=tournament.num_rounds,
        zeroed_ids=zeroed,
        configuration=XSectionConfiguration(first_round_color=tournament.first_board_white),
    )
    tournament_section = TournamentSection(
        tournament_name=tournament.name,
        city=tournament.city or None,
        federation=tournament.federation or None,
        chief_arbiter=tournament.chief_arbiter or None,
        number_of_players=str(len(player_sections)),
    )
    return ParsedTrf(
        player_sections=player_sections,
        tournament_section=tournament_section,
        x_section=x_section,
    )


def generate_next_round_games(tournament: "Tournament", engine: str = "dutch") -> list[Game]:
    """Generate the next round's board list. Returns domain Game objects with
    board numbers assigned (bye = black_id None, PAIRING_ALLOCATED)."""
    engine_cls = _ENGINES[engine]
    trf = build_parsed_trf(tournament)
    trf.validate_contents()   # catches inconsistent points/results early

    try:
        pairings = engine_cls.generate_pairings(trf)
    except Exception as exc:  # noqa: BLE001 - library raises on unpairable states
        raise NoValidPairingError(str(exc)) from exc

    if not pairings:
        raise NoValidPairingError("engine returned no pairings")

    games: list[Game] = []
    for board_no, pairing in enumerate(pairings, start=1):
        white = tournament.player_by_start_no(pairing.white)
        if pairing.black == 0:
            games.append(Game(board_no=board_no, white_id=white.player_id,
                              black_id=None, bye=ByeType.PAIRING_ALLOCATED))
        else:
            black = tournament.player_by_start_no(pairing.black)
            games.append(Game(board_no=board_no, white_id=white.player_id,
                              black_id=black.player_id))
    return games


def to_trf_text(tournament: "Tournament") -> str:
    """Return the full TRF file text for federation submission / archive."""
    import tempfile

    trf = build_parsed_trf(tournament)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "tournament.trf"
        trf.write_to_file(path)
        return path.read_text(encoding="utf-8")
