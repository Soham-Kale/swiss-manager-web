import React, { useState, useCallback, useEffect } from "react";
import { api } from "./api.js";
import { APP_NAME } from "./brand.js";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import CommandMenu from "./components/CommandMenu.jsx";
import NewTournamentDialog from "./components/NewTournamentDialog.jsx";
import OpenDialog from "./components/OpenDialog.jsx";
import ComputerPairingsDialog from "./components/ComputerPairingsDialog.jsx";
import PlayersWindow from "./components/PlayersWindow.jsx";
import PairingsWindow from "./components/PairingsWindow.jsx";
import ResultsWindow from "./components/ResultsWindow.jsx";
import StandingsWindow from "./components/StandingsWindow.jsx";
import ListsWindow from "./components/ListsWindow.jsx";
import Button from "./components/ui/Button.jsx";
import Toast from "./components/ui/Toast.jsx";
import Icon from "./components/ui/Icon.jsx";

function readTheme() {
  try { return localStorage.getItem("cpm-theme") || "system"; } catch { return "system"; }
}

export default function App() {
  const [tournament, setTournament] = useState(null);
  const [view, setView] = useState(null);        // players|pairings|results|standings|list
  const [listMode, setListMode] = useState(null);
  const [round, setRound] = useState(null);
  const [dialog, setDialog] = useState(null);     // new|open|edit|computerPairings
  const [commands, setCommands] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(readTheme);

  // Apply the theme choice; "system" leaves the attribute off so the media query wins.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try { localStorage.setItem("cpm-theme", theme); } catch { /* private mode */ }
  }, [theme]);

  const toggleTheme = () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark"
      || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    setTheme(dark ? "light" : "dark");
  };

  // Ctrl/Cmd-K opens the command menu from anywhere.
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommands((c) => !c);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const notify = useCallback((msg, err) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3200); }, []);
  const refresh = useCallback(async (id) => {
    const t = await api.getTournament(id ?? tournament.id);
    setTournament(t);
    return t;
  }, [tournament]);

  const onCreated = async (id) => {
    const t = await api.getTournament(id);
    setTournament(t); setView("players"); setRound(null); setDialog(null);
    notify(`Tournament "${t.name}" saved`);
  };
  const onOpen = async (id) => {
    const t = await api.getTournament(id);
    setTournament(t);
    const last = t.rounds.length ? t.rounds[t.rounds.length - 1].number : null;
    setRound(last); setView(last ? "pairings" : "players"); setDialog(null);
    notify(`Loaded "${t.name}"`);
  };

  const generate = async ({ engine }) => {
    setBusy(true);
    try {
      const d = await api.nextRound(tournament.id, engine || tournament.pairing_engine || "dutch");
      await refresh(); setRound(d.number); setView("pairings"); setDialog(null);
      notify(`Round ${d.number} paired`);
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };
  const resort = async () => {
    try {
      const t = await api.setPlayers(tournament.id, tournament.players.map(p => ({ ...p })), true);
      setTournament(t); notify("Starting rank re-sorted by rating");
    } catch (e) { notify(e.message, true); }
  };
  const doExport = async () => {
    try {
      const d = await api.exportTrf(tournament.id);
      const blob = new Blob([d.trf], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${tournament.name || "tournament"}.trf`;
      a.click();
      notify("TRF exported");
    } catch (e) { notify(e.message, true); }
  };

  const menuAction = async (action) => {
    try {
      if (action === "new") return setDialog("new");
      if (action === "open") return setDialog("open");
      if (!tournament) return notify("Create or open a tournament first", true);
      if (action === "setup") return setDialog("edit");
      if (action === "players") return setView("players");
      if (action === "resort") return resort();
      // "generate" is emitted by the sidebar/pairings sheet; it opens the same
      // dialog as the Pairings ▸ Computer pairings command.
      if (action === "computerPairings" || action === "generate") return setDialog("computerPairings");
      if (action === "pairings") {
        const t = await refresh();
        if (t.rounds.length) { setRound(t.rounds[t.rounds.length - 1].number); setView("pairings"); }
        else setDialog("computerPairings");
        return;
      }
      if (action === "results") {
        const t = await refresh();
        if (!t.rounds.length) return notify("Generate a round first", true);
        const open = t.rounds.find(r => !r.finalized) || t.rounds[t.rounds.length - 1];
        setRound(open.number); return setView("results");
      }
      if (action === "standings" || action === "status") return setView("standings");
      if (action === "export") return doExport();
      if (action.startsWith("list:")) { setListMode(action.split(":")[1]); setView("list"); return; }
      if (["exclude", "givebye", "reactivate", "rounds"].includes(action))
        return notify("Not available yet — player exclude / bye / reactivate / round select", true);
    } catch (e) { notify(e.message, true); }
  };

  const roundsPlayed = tournament ? tournament.rounds.filter(r => r.finalized).length : 0;
  const totalRounds = tournament?.total_rounds ?? 0;

  return (
    <div className="app">
      <TopBar tournament={tournament} onAction={menuAction}
              onOpenCommands={() => setCommands(true)}
              theme={theme} onToggleTheme={toggleTheme} />

      <Sidebar tournament={tournament} view={view} onAction={menuAction} />

      <main className="main">
        <div className="main-inner">
          {!tournament && !dialog && (
            <div className="card">
              <div className="empty">
                <div className="art"><Icon name="trophy" size={24} /></div>
                <h2>{APP_NAME}</h2>
                <p className="hint">
                  Run a Swiss-system event end to end — seed the field, generate FIDE-compliant
                  pairings, record results and publish standings.
                </p>
                <div className="row">
                  <Button variant="primary" icon="plus" onClick={() => setDialog("new")}>New tournament</Button>
                  <Button icon="folder" onClick={() => setDialog("open")}>Load tournament</Button>
                </div>
              </div>
            </div>
          )}

          {tournament && view === "players" && (
            <PlayersWindow tournament={tournament} onSaved={refresh} notify={notify}
                           onGenerate={() => setDialog("computerPairings")} />
          )}
          {tournament && view === "pairings" && round && (
            <PairingsWindow tournament={tournament} round={round} setRound={setRound}
                            onEnterResults={() => setView("results")} notify={notify}
                            onGenerateNext={() => setDialog("computerPairings")} />
          )}
          {tournament && view === "results" && round && (
            <ResultsWindow tournament={tournament} round={round} setRound={setRound}
                           onDone={async () => { await refresh(); setView("pairings"); }}
                           onClose={() => setView("pairings")} notify={notify} />
          )}
          {tournament && view === "standings" && (
            <StandingsWindow tournament={tournament} notify={notify} />
          )}
          {tournament && view === "list" && (
            <ListsWindow tournament={tournament} mode={listMode} setMode={setListMode} notify={notify} />
          )}

          {tournament && !view && (
            <div className="card"><div className="empty">
              <div className="art"><Icon name="list" size={24} /></div>
              <h2>{tournament.name}</h2>
              <p className="hint">Pick a step from the sidebar to continue.</p>
            </div></div>
          )}
        </div>
      </main>

      <footer className="statusbar">
        {tournament ? (
          <>
            <span><b>{tournament.players.length}</b> players</span>
            <span>Round <b>{roundsPlayed}</b>{totalRounds ? <> / <b>{totalRounds}</b></> : null}</span>
            <span>Avg rating <b>{avgRating(tournament)}</b></span>
            <span className="spacer" />
            <span>{tournament.status}</span>
          </>
        ) : <span>Ready</span>}
      </footer>

      {commands && <CommandMenu onAction={menuAction} onClose={() => setCommands(false)} />}
      {dialog === "new" && <NewTournamentDialog onCreated={onCreated} onCancel={() => setDialog(null)} notify={notify} />}
      {dialog === "edit" && <NewTournamentDialog initial={tournament} onCreated={onCreated} onCancel={() => setDialog(null)} notify={notify} />}
      {dialog === "open" && <OpenDialog onOpen={onOpen} onCancel={() => setDialog(null)} />}
      {dialog === "computerPairings" && (
        <ComputerPairingsDialog round={(tournament?.rounds.length || 0) + 1} busy={busy}
                                onStart={generate} onCancel={() => setDialog(null)} />
      )}

      {toast && <Toast msg={toast.msg} err={toast.err} />}
    </div>
  );
}

function avgRating(t) {
  const r = t.players.filter(p => p.rating > 0);
  return r.length ? Math.round(r.reduce((s, p) => s + p.rating, 0) / r.length) : 0;
}
