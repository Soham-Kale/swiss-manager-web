import React, { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";
import MenuBar from "./components/MenuBar.jsx";
import Toolbar from "./components/Toolbar.jsx";
import NewTournamentDialog from "./components/NewTournamentDialog.jsx";
import PlayersWindow from "./components/PlayersWindow.jsx";
import PairingsWindow from "./components/PairingsWindow.jsx";
import ResultsWindow from "./components/ResultsWindow.jsx";
import StandingsWindow from "./components/StandingsWindow.jsx";
import OpenDialog from "./components/OpenDialog.jsx";

export default function App() {
  const [tournament, setTournament] = useState(null); // full DTO
  const [view, setView] = useState(null);             // players|pairings|results|standings
  const [round, setRound] = useState(null);           // active round number
  const [dialog, setDialog] = useState(null);         // 'new' | 'open'
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, err) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const refresh = useCallback(async (id) => {
    const t = await api.getTournament(id ?? tournament.id);
    setTournament(t);
    return t;
  }, [tournament]);

  const onCreated = async (id) => {
    const t = await api.getTournament(id);
    setTournament(t); setView("players"); setRound(null); setDialog(null);
    notify(`Tournament "${t.name}" created — enter players`);
  };

  const onOpen = async (id) => {
    const t = await api.getTournament(id);
    setTournament(t);
    const last = t.rounds.length ? t.rounds[t.rounds.length - 1].number : null;
    setRound(last); setView(last ? "pairings" : "players"); setDialog(null);
    notify(`Loaded "${t.name}"`);
  };

  const menuAction = async (action) => {
    try {
      if (action === "new") return setDialog("new");
      if (action === "open") return setDialog("open");
      if (!tournament && action !== "new" && action !== "open") return notify("Create or open a tournament first", true);
      if (action === "players") return setView("players");
      if (action === "pairings") { await showLatestOrGenerate(); return; }
      if (action === "generate") return generateNext();
      if (action === "results") { if (!round) return notify("Generate a round first", true); return setView("results"); }
      if (action === "standings") { setView("standings"); }
      if (action === "export") return doExport();
    } catch (e) { notify(e.message, true); }
  };

  const showLatestOrGenerate = async () => {
    const t = await refresh();
    if (t.rounds.length) { setRound(t.rounds[t.rounds.length - 1].number); setView("pairings"); }
    else await generateNext();
  };

  const generateNext = async () => {
    try {
      const d = await api.nextRound(tournament.id, tournament.pairing_engine || "dutch");
      await refresh();
      setRound(d.number); setView("pairings");
      notify(`Round ${d.number} paired`);
    } catch (e) { notify(e.message, true); }
  };

  const doExport = async () => {
    try {
      const d = await api.exportTrf(tournament.id);
      const blob = new Blob([d.trf], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${tournament.name || "tournament"}.trf`; a.click();
      notify("TRF exported");
    } catch (e) { notify(e.message, true); }
  };

  const disabled = !tournament;
  const roundsPlayed = tournament ? tournament.rounds.filter(r => r.finalized).length : 0;

  return (
    <div className="app">
      <div className="titlebar">
        <span className="logo" />
        Swiss-Manager <span className="sub">(Web) — {tournament ? tournament.name : "(no tournament)"} {tournament ? "(Swiss System)" : ""}</span>
      </div>

      <MenuBar onAction={menuAction} hasTournament={!!tournament} />
      <Toolbar onAction={menuAction} disabled={disabled} />

      <div className="infostrip">
        {tournament
          ? `${tournament.name}  ·  ${tournament.players.length} players  ·  ${roundsPlayed}/${tournament.rounds} rounds played  ·  status: ${tournament.status}`
          : 'Use  File ▸ New tournament  to begin.'}
      </div>

      <div className="work">
        {!tournament && !dialog && (
          <div className="empty">
            <h2>Swiss-Manager (Web)</h2>
            <p>Create a new tournament from <b>File ▸ New tournament</b>, or open an existing one.</p>
            <p><button className="btn primary" onClick={() => setDialog("new")}>New tournament…</button>
               &nbsp;<button className="btn" onClick={() => setDialog("open")}>Load tournament…</button></p>
          </div>
        )}

        {tournament && view === "players" && (
          <PlayersWindow tournament={tournament} onSaved={refresh} onClose={() => setView(null)} notify={notify}
            onGenerate={generateNext} />
        )}
        {tournament && view === "pairings" && round && (
          <PairingsWindow tournament={tournament} round={round} setRound={setRound}
            onEnterResults={() => setView("results")} onClose={() => setView(null)} notify={notify} />
        )}
        {tournament && view === "results" && round && (
          <ResultsWindow tournament={tournament} round={round}
            onDone={async () => { await refresh(); setView("pairings"); }} onClose={() => setView("pairings")} notify={notify} />
        )}
        {tournament && view === "standings" && (
          <StandingsWindow tournament={tournament} onClose={() => setView(null)} notify={notify} />
        )}
      </div>

      <div className="statusbar">
        <span>{tournament ? `Ranking-Ø: ${avgRating(tournament)}` : "Ready"}</span>
        <span className="sp">Cnt: {tournament ? tournament.players.length : 0}</span>
        <span>Rd: {roundsPlayed}</span>
      </div>

      {dialog === "new" && <NewTournamentDialog onCreated={onCreated} onCancel={() => setDialog(null)} notify={notify} />}
      {dialog === "open" && <OpenDialog onOpen={onOpen} onCancel={() => setDialog(null)} />}

      {toast && <div className={"toast" + (toast.err ? " err" : "")}>{toast.msg}</div>}
    </div>
  );
}

function avgRating(t) {
  const rated = t.players.filter(p => p.rating > 0);
  if (!rated.length) return 0;
  return Math.round(rated.reduce((s, p) => s + p.rating, 0) / rated.length);
}
