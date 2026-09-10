# Chess Pairing Manager — React + Flask

Run a Swiss-system chess tournament end to end: **create tournament → enter
players → generate pairings → enter results → standings**, with the FIDE
**Dutch-system** pairing engine (py4swiss) on the backend.

- **Frontend:** React + Vite, with a sidebar workflow (Setup → Players →
  Pairings → Results → Standings → Lists), a command palette (Ctrl/Cmd-K) for
  every action, and light/dark theming.
- **Backend:** Python **Flask** + **SQLite**, wrapping the pairing engine.

## Run it

### 1. Backend
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows (mac/linux: source .venv/bin/activate)
pip install -r requirements.txt
flask --app app.server run --port 5000
```

### 2a. Quick start (serve the built UI)
`frontend/dist` is not committed to the repo (see `.gitignore`), so build it
once and Flask will serve it:
```bash
cd frontend
npm install
npm run build
```
Then open **http://127.0.0.1:5000/** after starting the backend.

### 2b. Develop the UI (hot reload)
```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173  (proxies /api to Flask on :5000)
```
After changing UI code, `npm run build` refreshes `frontend/dist` so the Flask
server serves the latest.

> Requires Python 3.10+ and (for UI dev) Node 18+.

## How to use

1. **New tournament** (top bar, or Ctrl/Cmd-K → "New tournament...") → fill the
   **General** and **Tiebreaks** tabs → **Create**.
2. **Players** step: type the roster or drop in an Excel/CSV/Chess-Results/JSON
   file. **Save** — starting numbers are assigned by rating automatically.
3. **Generate round 1** (from the Players card, or the Pairings step). The
   pairings sheet shows board / no. / player / points / result for both sides.
4. **Enter results** — click a quick-result button on a row, or use the result
   pad for forfeits and arbiter codes. Saving finalizes the round once every
   board has a result.
5. **Generate the next round**, repeat. **Standings** shows the ranking with
   your chosen tiebreaks; **Lists** has the roster and both crosstables.
   The top bar's export button downloads the FIDE TRF file.

Every command from the original desktop-style menu (including items not yet
wired to real behaviour) is still reachable through the command palette —
open it from the top bar or with Ctrl/Cmd-K.

## Project layout
```
├── backend/
│   ├── app/
│   │   ├── server.py       # Flask API (/api/*) + serves the built UI
│   │   ├── db.py           # SQLite schema + connection
│   │   ├── repository.py   # DB rows <-> pairing engine
│   │   ├── parse.py        # Excel / CSV / JSON / Chess-Results import
│   │   └── engine/         # py4swiss Dutch-system engine + standings
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # app shell + view routing
│   │   ├── api.js          # backend client
│   │   ├── brand.js        # product name, in one place
│   │   ├── styles.css      # design tokens + component styles
│   │   └── components/
│   │       ├── ui/         # Button, Modal, Field, Toast, Icon
│   │       ├── TopBar.jsx, Sidebar.jsx, CommandMenu.jsx
│   │       └── PlayersWindow, PairingsWindow, ResultsWindow,
│   │           StandingsWindow, ListsWindow, dialogs
│   ├── dist/               # build output (gitignored — run `npm run build`)
│   └── index.html, package.json, vite.config.js
└── README.md
```

## API (used by the UI)
`POST /api/tournaments` · `GET/PUT /api/tournaments/:id` · `GET /api/tournaments`
· `POST /api/tournaments/:id/players` · `POST /api/tournaments/:id/players/import`
· `POST /api/tournaments/:id/rounds/next` · `GET /api/tournaments/:id/rounds/:n`
· `POST /api/tournaments/:id/rounds/:n/results` · `.../finalize`
· `GET /api/tournaments/:id/standings` · `GET /api/tournaments/:id/export/trf`

Full request/response payloads, the SQL schema (current + a minimal
from-scratch version), and the domain rules a backend must enforce are in
**[docs/API.md](docs/API.md)** — the reference for anyone implementing or
porting the backend.

## Notes
- Round 1 is seeded by rating. Later rounds are paired by the Dutch engine from
  the entered results — no rematches, correct colours and byes.
- Tiebreaks currently computed: Buchholz, Buchholz Cut-1, Sonneborn-Berger,
  Number of Wins; the tournament dialog lets you pick and order them, including
  labels for tiebreaks this build doesn't compute yet.
- Auth is omitted for this build; add your existing auth when integrating.
