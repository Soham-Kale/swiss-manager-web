# Swiss-Manager (Web) — React + Flask

A web re-creation of the Swiss-Manager desktop workflow: **create tournament →
enter players → generate pairings → enter results → standings**, with the
FIDE **Dutch-system** pairing engine (py4swiss) on the backend.

- **Frontend:** React + Vite (JavaScript), styled to look like Swiss-Manager
  (menu bar, toolbar, tabbed "Tournament Data" dialog, pairings sheet, results
  pad, ranking).
- **Backend:** Python **Flask** + **SQLite**, wrapping the pairing engine.

## Run it

### 1. Backend
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows (mac/linux: source .venv/bin/activate)
pip install -r requirements.txt
flask --app app.server run --port 5000
```

### 2a. Quick start (no Node needed)
A pre-built UI ships in `frontend/dist`, and the backend serves it. Just open
**http://127.0.0.1:5000/** after starting the backend.

### 2b. Develop the UI (hot reload)
```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173  (proxies /api to Flask on :5000)
```
After changing UI code, `npm run build` refreshes `frontend/dist` so the Flask
server serves the latest.

> Requires Python 3.10+ and (for UI dev) Node 18+.

## How to use (mirrors Swiss-Manager)

1. **File ▸ New tournament** → pick *Swiss System* → fill the **Tournament Data**
   dialog (General + **Tiebreaks** tabs) → **OK**.
2. **Enter players** window: type the roster or **Import** an Excel/CSV/Chess-
   Results/JSON file. **Save** — seeds (No.) are assigned by rating automatically.
3. **Generate Round 1** (or Pairings ▸ Generate next round). The **Pairings/
   Results** sheet shows Bo./SNo./White/Pts/Res./Pts/Black/SNo.
4. **Enter results…** — click a board, click a result (1:0, ½:½, 0:1, forfeits).
   Save finalizes the round when every board has a result.
5. **Generate next round**, repeat. **Lists ▸ Ranking** shows standings with your
   chosen tiebreaks. **Output ▸ Export TRF** downloads the FIDE file.

## Project layout
```
swiss-manager-web/
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
│   │   └── components/     # MenuBar, Toolbar, dialogs, windows
│   ├── dist/               # pre-built UI (served by Flask)
│   ├── index.html, package.json, vite.config.js
└── README.md
```

## API (used by the UI)
`POST /api/tournaments` · `GET/PUT /api/tournaments/:id` · `GET /api/tournaments`
· `POST /api/tournaments/:id/players` · `POST /api/tournaments/:id/players/import`
· `POST /api/tournaments/:id/rounds/next` · `GET /api/tournaments/:id/rounds/:n`
· `POST /api/tournaments/:id/rounds/:n/results` · `.../finalize`
· `GET /api/tournaments/:id/standings` · `GET /api/tournaments/:id/export/trf`

## Notes
- Round 1 is seeded by the **No.** order (rating). Later rounds are paired by the
  Dutch engine from the entered results — no rematches, correct colours and byes.
- Tiebreaks currently computed: Buchholz, Buchholz Cut-1, Sonneborn-Berger,
  Number of Wins (the standard Swiss set); the dialog lets you order them.
- Auth is omitted for this build; add your existing auth when integrating.
