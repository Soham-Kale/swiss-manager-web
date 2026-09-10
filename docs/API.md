# Backend & API Reference

Single source of truth for anyone implementing, extending, or re-implementing the
Chess Pairing Manager backend: the database schema, the HTTP contract, and the
request/response shape of every endpoint the frontend calls.

The current backend is Flask + SQLite (`backend/app/`). This document describes
the contract at the HTTP boundary, so a developer could reimplement the backend
in another stack (Node, Django, etc.) against the same frontend without reading
the Python source.

- [1. Architecture at a glance](#1-architecture-at-a-glance)
- [2. Database schema](#2-database-schema)
- [3. API conventions](#3-api-conventions)
- [4. Endpoints](#4-endpoints)
- [5. Domain rules a backend must enforce](#5-domain-rules-a-backend-must-enforce)
- [6. Known gaps / open issues](#6-known-gaps--open-issues)

---

## 1. Architecture at a glance

```
Frontend (React)
    │  fetch() — see frontend/src/api.js for the exact calls
    ▼
Flask routes (backend/app/server.py)   — HTTP contract, documented below
    │
    ├─ backend/app/db.py               — SQLite connection + schema
    ├─ backend/app/repository.py       — DB rows  <->  in-memory engine.Tournament
    ├─ backend/app/parse.py            — Excel / CSV / JSON / Chess-Results import
    └─ backend/app/engine/             — pure, DB-agnostic pairing + standings
        ├─ models.py                  — Player, Game, Round, enums
        ├─ pairing.py                 — py4swiss (FIDE Dutch/Dubov/Burstein) wrapper
        ├─ standings.py               — Buchholz / Buchholz Cut-1 / SB / wins
        └─ tournament.py              — state machine: setup → running → finished
```

Key design point for anyone rebuilding this backend: **the pairing engine is
pure and DB-agnostic.** On every request that needs to pair or score a round,
the whole tournament (roster + all finalized rounds) is loaded from SQL into an
in-memory `Tournament` object (`repository.load_engine_tournament`), the engine
operates on that object, and the result is written back. There is no
incremental state kept in the engine between requests — each request is a full
rebuild. A reimplementation is free to use a different storage engine as long
as it can produce the same in-memory shape before calling the pairing engine.

### Player identity: a wrinkle to reproduce carefully

Internally, the engine identifies a player by the string `"S{start_no}"` (see
`repository.py:_pid`), **not** by the database's `players.id`. Games in the
`games` table store **starting numbers** (`white_sno`, `black_sno`), not row
ids. This means:

- Re-seeding the roster (which reassigns `start_no`) after any round has been
  played will silently repoint every past game to a different person. This is
  a known bug in the current implementation (see §6) — **do not reproduce it**;
  a from-scratch backend should key games on a stable player id and keep
  `start_no` as a separate, per-round-1 seeding attribute.
- Any new backend must still expose `start_no` in every player/board payload,
  because the frontend displays and reasons about seed numbers, not internal
  ids.

---

## 2. Database schema

### 2a. Full schema (current SQLite implementation)

```sql
CREATE TABLE tournaments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  rounds            INTEGER NOT NULL DEFAULT 7,   -- scheduled number of rounds
  organizer         TEXT DEFAULT '',
  director          TEXT DEFAULT '',
  chief_arbiter     TEXT DEFAULT '',
  deputy_arbiter    TEXT DEFAULT '',
  arbiter           TEXT DEFAULT '',
  city              TEXT DEFAULT '',
  federation        TEXT DEFAULT '',
  website           TEXT DEFAULT '',
  time_control      TEXT DEFAULT '',
  date_from         TEXT DEFAULT '',               -- ISO date string, e.g. "2026-09-10"
  date_to           TEXT DEFAULT '',
  first_board_white INTEGER DEFAULT 1,             -- boolean as 0/1
  pairing_engine    TEXT DEFAULT 'dutch',           -- 'dutch' | 'dubov' | 'burstein'
  tiebreaks         TEXT DEFAULT '[]',              -- JSON array of tiebreak label strings
  status            TEXT DEFAULT 'setup',           -- 'setup' | 'running' | 'finished'
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tid         INTEGER NOT NULL REFERENCES tournaments(id),
  start_no    INTEGER NOT NULL,       -- FIDE starting rank / seed (1..N)
  name        TEXT NOT NULL,          -- "Lastname, Firstname"
  rating      INTEGER DEFAULT 0,
  fide_id     TEXT,
  sex         TEXT,                   -- 'm' | 'w'
  title       TEXT,                   -- 'gm' | 'im' | ...
  federation  TEXT,
  club        TEXT,
  status      TEXT DEFAULT 'active'   -- 'active' | 'withdrawn' | 'late_entry'
);

CREATE TABLE rounds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tid        INTEGER NOT NULL REFERENCES tournaments(id),
  number     INTEGER NOT NULL,        -- 1-based round number
  finalized  INTEGER DEFAULT 0        -- boolean as 0/1
);

CREATE TABLE games (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id   INTEGER NOT NULL REFERENCES rounds(id),
  board_no   INTEGER NOT NULL,
  white_sno  INTEGER NOT NULL,        -- players.start_no of White (see note above)
  black_sno  INTEGER,                 -- NULL = this board is a bye
  result     TEXT DEFAULT 'pending',  -- see "Result codes" table below
  bye        TEXT                    -- 'U' | 'H' | 'F' | 'Z' | NULL (see below)
);
```

**Enumerations used in the `games` table:**

| `result` value | Meaning |
|---|---|
| `pending` | not yet entered |
| `1-0` | White wins |
| `0-1` | Black wins |
| `0.5-0.5` | Draw |
| `1-0F` | White wins by forfeit (Black forfeited) |
| `0-1F` | Black wins by forfeit (White forfeited) |
| `0-0` | Double forfeit (both lose, no points) |

| `bye` value | Meaning | Points awarded |
|---|---|---|
| `U` | pairing-allocated bye (odd player out) | 1.0 |
| `H` | half-point bye (player requested) | 0.5 |
| `F` | full-point bye (organizer-granted) | 1.0 |
| `Z` | zero-point bye (known absence) | 0.0 |

**Player `status` enum:** `active` (normal) · `withdrawn` (excluded from future
pairings) · `late_entry` (joined after round 1 — informational only today, no
special pairing treatment implemented).

**Tournament `status` enum:** `setup` (no rounds generated yet) → `running`
(at least one round generated, not all finalized) → `finished` (all scheduled
rounds finalized).

### 2b. Minimal schema (if rebuilding from scratch)

If you are redesigning the storage layer rather than reusing this exact SQLite
schema, this is the minimum needed to support every endpoint below, with the
`start_no`-as-identity problem fixed:

```sql
-- Tournament: one row per event.
CREATE TABLE tournaments (
  id                 <PK>,
  name               TEXT NOT NULL,
  total_rounds       INTEGER NOT NULL,        -- renamed from "rounds" to avoid the
                                               -- ambiguity documented in §6
  status             TEXT NOT NULL DEFAULT 'setup',
  pairing_engine     TEXT NOT NULL DEFAULT 'dutch',
  tiebreaks          JSON NOT NULL DEFAULT '[]',
  first_board_white  BOOLEAN NOT NULL DEFAULT true,
  -- free-form event metadata, all optional:
  organizer, director, chief_arbiter, deputy_arbiter, arbiter,
  city, federation, website, time_control, date_from, date_to  TEXT
);

-- Player: one row per registered participant. player_id is the stable identity
-- games reference — NOT start_no, which can be reassigned on re-seed.
CREATE TABLE players (
  id           <PK>,               -- stable identity — reference this from games
  tournament_id FK -> tournaments,
  start_no     INTEGER NOT NULL,   -- current seed; may be reassigned by re-seeding
  name, rating, fide_id, sex, title, federation, club,
  status       TEXT NOT NULL DEFAULT 'active'  -- active | withdrawn | late_entry
);

-- Round: one row per generated round.
CREATE TABLE rounds (
  id            <PK>,
  tournament_id FK -> tournaments,
  number        INTEGER NOT NULL,
  finalized     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tournament_id, number)
);

-- Game: one row per board in a round.
CREATE TABLE games (
  id          <PK>,
  round_id    FK -> rounds,
  board_no    INTEGER NOT NULL,
  white_id    FK -> players.id,     -- NOT start_no
  black_id    FK -> players.id NULL, -- NULL = bye
  result      TEXT NOT NULL DEFAULT 'pending',
  bye         TEXT NULL,            -- U | H | F | Z
  UNIQUE (round_id, board_no)
);
```

This is enough to reconstruct, for any round, everyone's cumulative score
(needed for pairing and standings) purely by replaying `games` joined through
`rounds` in round order.

---

## 3. API conventions

**Base path.** All endpoints are under `/api`. In development the frontend
talks to Flask directly on `:5000`; Vite's dev server proxies `/api/*` to it.

**Envelope.** Every response — success or failure — is JSON shaped as:

```json
{ "status": true | false, "text": "human-readable message", "data": <payload or null> }
```

The frontend's `api.js` client throws when `status` is `false` or the HTTP
status is non-2xx, using `text` as the error message. **A conforming backend
must always return this envelope**, even on validation errors — the frontend
does not have a separate error-shape parser.

**HTTP status codes used:**

| Code | When |
|---|---|
| 200 | success |
| 400 | validation / precondition failure (e.g. "no players", bad file, unfinalized round) |
| 404 | tournament or round not found |
| 409 | pairing engine could not produce a legal pairing |

> Two current backend gaps to fix in a reimplementation, not to reproduce:
> an unknown tournament id currently causes a 500 (unhandled `KeyError`) on
> the round-detail endpoint, and `rounds/0/finalize` aliases to the last round
> via Python's negative-index behaviour instead of 404ing. Both should be
> explicit 404s in a new implementation.

**Content types.** JSON body for all endpoints except player import, which is
`multipart/form-data` with a single file field (`file` or `datafile`).

**IDs.** All resource ids (`tid`, round `n`) are positive integers in the URL
path.

---

## 4. Endpoints

### 4.1 `POST /api/tournaments` — create a tournament

**Request body:**
```json
{
  "name": "City Open 2026",
  "rounds": 9,
  "organizer": "", "director": "", "chief_arbiter": "", "deputy_arbiter": "", "arbiter": "",
  "city": "", "federation": "", "website": "", "time_control": "",
  "date_from": "2026-09-10", "date_to": "2026-09-14",
  "first_board_white": true,
  "pairing_engine": "dutch",
  "tiebreaks": ["Buchholz Tie-Break Variable (2023) [84]", "..."]
}
```
All fields except `name` and `rounds` are optional; every field has a server-side
default (see schema). `tiebreaks` defaults to
`["Buchholz", "Buchholz Cut-1", "Sonneborn-Berger", "Direct Encounter", "Number of Wins"]`
if omitted.

**Response `data`:**
```json
{ "id": 1 }
```

---

### 4.2 `GET /api/tournaments` — list tournaments

No request body. Returns summary rows only (not the full roster/rounds).

**Response `data`:**
```json
[
  { "id": 1, "name": "City Open 2026", "rounds": 9, "city": "Pune",
    "status": "running", "created_at": "2026-09-10 08:15:00" }
]
```

---

### 4.3 `GET /api/tournaments/:id` — full tournament detail

No request body.

**Response `data`** (the "tournament DTO" — every window in the frontend
consumes this shape):
```json
{
  "id": 1,
  "name": "City Open 2026",
  "rounds": [                          // <-- ARRAY of played/generated rounds, NOT a count
    { "id": 1, "number": 1, "finalized": 1 },
    { "id": 2, "number": 2, "finalized": 0 }
  ],
  "total_rounds": 9,                   // <-- the scheduled round count (see §6 for why
                                        //     this key exists separately from "rounds")
  "organizer": "", "director": "", "chief_arbiter": "", "deputy_arbiter": "", "arbiter": "",
  "city": "", "federation": "", "website": "", "time_control": "",
  "date_from": "2026-09-10", "date_to": "2026-09-14",
  "first_board_white": true,
  "pairing_engine": "dutch",
  "tiebreaks": ["Buchholz Tie-Break Variable (2023) [84]", "..."],
  "status": "running",                 // setup | running | finished
  "created_at": "2026-09-10 08:15:00",
  "players": [
    { "id": 3, "tid": 1, "start_no": 1, "name": "Nakamura, Hikaru", "rating": 2780,
      "fide_id": null, "sex": "m", "title": "GM", "federation": "USA", "club": null,
      "status": "active" }
  ]
}
```
404 (`{status:false, text:"not found"}`) if the id doesn't exist.

> **Important for a new backend:** `rounds` is deliberately overloaded here —
> it's the array of generated rounds, while `total_rounds` is the scheduled
> count from the `tournaments.rounds` column. Any reimplementation should
> either keep both keys (for frontend compatibility) or, better, rename the
> column to `total_rounds` from the start and never let `rounds` mean two
> different things (see §6, this was a bug in the original build).

---

### 4.4 `PUT /api/tournaments/:id` — update tournament settings

**Request body:** any subset of the create-body fields (partial update — only
supplied keys are changed):
```json
{ "name": "City Open 2026 (renamed)", "rounds": 9, "city": "Pune",
  "tiebreaks": ["..."] }
```

**Response `data`:** the same tournament DTO as §4.3, after the update.

> `rounds` here must always be sent as the scheduled-count integer (never the
> rounds array) — see §6 for the exact failure mode this caused.

---

### 4.5 `POST /api/tournaments/:id/players` — replace the roster

**Request body:**
```json
{
  "players": [
    { "name": "Nakamura, Hikaru", "rating": 2780, "federation": "USA",
      "sex": "m", "title": "GM", "club": "", "fide_id": "" }
  ],
  "reseed": true
}
```
- `reseed: true` (default) — server **replaces the entire roster** and assigns
  fresh `start_no` values by sorting on `(-rating, name)`.
- `reseed: false` — server expects each player object to already carry a
  `start_no` and preserves it as given.

**Response `data`:** the full tournament DTO (§4.3), roster updated.

⚠️ **This endpoint deletes and reinserts every player row.** If any round has
already been played, existing games (which reference `start_no`) will silently
point at different people after a reseed. See §6 — do not reproduce this in a
new backend; key games on a stable player id instead.

---

### 4.6 `POST /api/tournaments/:id/players/import` — import a roster file

**Request:** `multipart/form-data`, field name `file` (or `datafile`), one of:
- `.xlsx` (players sheet + optional pairings sheet, or a Chess-Results.com export)
- `.csv` (players only)
- `.json` (`{"players":[...]}`, `{"roster":[...]}`, or a bare array)

**Response `data`:** the full tournament DTO (§4.3), roster replaced.
`reseed` is inferred: `false` if any parsed row carries a `start_no`, else
`true`.

400 with `text: "no file"` if the field is missing; 400 with a parse error
message if the file can't be read.

---

### 4.7 `POST /api/tournaments/:id/rounds/next?engine=dutch` — generate the next round

**Query param:** `engine` — `dutch` (default) | `dubov` | `burstein`.
**Request body:** none.

Generates pairings from every currently-finalized round (no rematches, balanced
colours, automatic bye for an odd field), persists the new round + boards, and
advances tournament `status` to `running` (from `setup`).

**Response `data`:** the round DTO — see §4.8 response shape.

Errors:
- 400 `"Add players first"` — no roster.
- 400 — previous round not finalized yet, or `"all rounds already played"`.
- 409 `"No valid pairing: …"` — the engine could not produce a legal pairing
  (e.g. impossible constraints); organizer must intervene manually. This case
  has no manual-override endpoint in the current build.
- 404 — tournament not found.

---

### 4.8 `GET /api/tournaments/:id/rounds/:n` — one round's boards

No request body.

**Response `data`** (the "round DTO"):
```json
{
  "number": 1,
  "finalized": true,
  "boards": [
    {
      "board_no": 1,
      "white_sno": 1, "white_name": "Nakamura, Hikaru", "white_rating": 2780,
      "white_pts": 1.0,
      "black_sno": 2, "black_name": "Gukesh, D", "black_rating": 2760,
      "black_pts": 0.5,
      "is_bye": false,
      "bye": null,
      "result": "1-0"
    },
    {
      "board_no": 5,
      "white_sno": 9, "white_name": "Rao, Meera", "white_rating": 1875,
      "white_pts": 1.0,
      "black_sno": null, "black_name": null, "black_rating": 0, "black_pts": null,
      "is_bye": true,
      "bye": "U",
      "result": "pending"
    }
  ]
}
```
`*_pts` are each player's **cumulative points from all finalized rounds**
(computed via `compute_standings`), not this board's result. 404 if the round
doesn't exist.

---

### 4.9 `POST /api/tournaments/:id/rounds/:n/results` — enter results

**Request body:**
```json
{ "results": [ { "board_no": 1, "result": "1:0" }, { "board_no": 2, "result": "½:½" } ] }
```

**Accepted UI result codes** (frontend's `_RESULT_MAP` on the server side),
mapped to the stored `games.result` enum:

| UI code(s) sent | Stored as |
|---|---|
| `1:0`, `1-0`, `1U:0U` | `1-0` |
| `0:1`, `0-1`, `0U:1U` | `0-1` |
| `½:½`, `0.5:0.5`, `0.5-0.5`, `½:½U` | `0.5-0.5` |
| `1F:0F`, `1-0F` | `1-0F` |
| `0F:1F`, `0-1F` | `0-1F` |
| `0F:0F`, `0:0` | `0-0` |

Any code not in this table is silently **skipped** (not an error) — no
response field indicates which boards were skipped, so a stricter
reimplementation should consider returning a per-board acknowledgment instead.
A board with `black_sno IS NULL` (a bye) cannot have its result set through
this endpoint.

**Response `data`:** the round DTO (§4.8), boards updated.

---

### 4.10 `POST /api/tournaments/:id/rounds/:n/finalize` — lock the round

**Request body:** none (send `{}`).

Fails with 400 if any playable board still has `result = "pending"`. On
success, marks the round `finalized`, and if this was the last scheduled
round, advances tournament `status` to `finished`.

**Response `data`:**
```json
{ "status": "running" }   // or "finished"
```

---

### 4.11 `GET /api/tournaments/:id/standings` — computed ranking

No request body.

**Response `data`:**
```json
{
  "standings": [
    {
      "rank": 1, "start_no": 9, "name": "Rao, Meera", "rating": 1875,
      "points": 1.0, "buchholz": 0.5, "buchholz_cut1": 0.0,
      "sonneborn_berger": 0.5, "wins": 0
    }
  ]
}
```
Ranking order: points desc → Buchholz Cut-1 desc → Buchholz desc →
Sonneborn-Berger desc → wins desc → rating desc → start_no asc.
Computed from all **finalized** rounds only. 404 if tournament not found.

---

### 4.12 `GET /api/tournaments/:id/export/trf` — FIDE TRF export

No request body.

**Response `data`:**
```json
{ "trf": "012 City Open 2026\n022 Pune\n...\n" }
```
Full FIDE TRF-file text, built from the same `ParsedTrf` structure used
internally for pairing. 404 if tournament not found.

---

## 5. Domain rules a backend must enforce

These are the invariants the pairing/standings engine relies on — reproduce
them exactly, regardless of storage engine:

1. **Round 1 seeding:** on first pairing, if any player has no `start_no`
   assigned, seed the whole roster by `(rating desc, name asc)` before pairing.
2. **Sequential rounds:** you cannot generate round *n+1* until round *n* is
   finalized, and all scheduled rounds are generated before `status` becomes
   `finished`.
3. **No rematches, balanced colour, single bye:** delegated to the pairing
   engine (FIDE Dutch/Dubov/Burstein via py4swiss in the reference
   implementation) — a reimplementation must use an engine that guarantees
   these FIDE pairing rules, not hand-rolled logic.
4. **Bye scoring:** `U`/`F` = 1.0 pt, `H` = 0.5 pt, `Z` = 0.0 pt. A bye board
   has no opponent and cannot carry a `result`.
5. **Standings tiebreak formulas** (FIDE 2026 virtual-opponent method):
   - **Buchholz** = sum of each round's opponent score, with an unplayed round
     (bye/forfeit) scored against a "virtual opponent" capped at
     `0.5 × (rounds played)` for byes, or the actual scheduled opponent's score
     for a forfeit.
   - **Buchholz Cut-1** = Buchholz minus the single lowest contributing round.
   - **Sonneborn-Berger** = Σ (opponent's score × points scored against them).
   - **Wins** = count of decisive (non-draw, non-forfeit-neutral) results won.
6. **Withdrawn players** (`status = 'withdrawn'`) must be excluded from all
   future pairings but keep their historical results and standings row.

---

## 6. Known gaps / open issues

Documented here so a backend developer doesn't have to rediscover them, and so
a **from-scratch** implementation can deliberately avoid reproducing them:

| # | Issue | Where | Recommended fix in a new backend |
|---|---|---|---|
| 1 | Re-seeding the roster (`players` endpoint, `reseed:true`) after any round is played silently repoints existing games to different people, because games store `start_no` and reseeding reassigns it. | `_save_roster` / `games.white_sno`, `black_sno` | Key `games` on a stable player id (see §2b schema); never repoint historical games when `start_no` changes. |
| 2 | `0F:0F` (double forfeit) is accepted as input but stored as `"0-0"`, which doesn't match the engine's `GameResult.DOUBLE_FORFEIT` value `"0-0F"` — the board reads back as `pending` forever and can never finalize. | `_RESULT_MAP`, `games.result` values | Store the double-forfeit code exactly as the engine's enum expects it. |
| 3 | `_tournament_dto` overwrites the scalar `rounds` count with the rounds array; `total_rounds` was added as a workaround. | `server.py:_tournament_dto` | Don't reuse the same key for two different shapes — use `total_rounds` (or similar) as the only name for the scheduled count from the start. |
| 4 | Unknown tournament id on `GET rounds/:n` → unhandled 500, not 404. `rounds/0/finalize` aliases to the last round (Python negative-index quirk) instead of 404ing. | `repository.load_engine_tournament`, `Tournament.finalize_round` | Validate ids explicitly and return 404 for anything out of range, including 0 and negative round numbers. |
| 5 | Removing a player from the roster after they've played leaves their historical boards referencing a `start_no` no longer in the roster (orphaned reference, not a foreign key violation because there's no FK on `start_no`). | roster save path | With a real FK on `players.id` (§2b), this becomes impossible by construction — consider soft-delete (`status`) instead of hard delete for anyone who has played a game. |
| 6 | No auth on any endpoint; CORS is wide open (`CORS(app)` with no origin restriction). | `server.py` | Add authentication/authorization and restrict CORS origins before any non-local deployment. |
| 7 | `set_bye` and `withdraw` exist in the engine (`Tournament.set_bye`, `Tournament.withdraw`) but have no HTTP endpoint. | `engine/tournament.py` | Expose `POST /api/tournaments/:id/players/:start_no/withdraw` and `POST /api/tournaments/:id/rounds/:n/bye` if this functionality is needed. |
| 8 | Vercel deployment (`api/index.py`) points SQLite at `/tmp`, which is ephemeral per serverless instance — no real persistence in that deployment target. | `api/index.py` | Point at a hosted database (Postgres, Turso, etc.) for any deployment beyond local/dev. |

---

*For the exact request-building code the frontend uses against this contract,
see `frontend/src/api.js`. For the tiebreak label vocabulary the Tournament
Settings dialog offers (including labels this build does not yet compute),
see `AVAILABLE_TB` in `frontend/src/components/NewTournamentDialog.jsx`.*
