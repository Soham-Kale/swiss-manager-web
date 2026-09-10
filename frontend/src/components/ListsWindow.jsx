import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import Button from "./ui/Button.jsx";
import { Segmented } from "./ui/Field.jsx";

const MODES = [
  ["alphabetical", "Alphabetical"],
  ["startrank", "Starting rank"],
  ["startcross", "Rank crosstable"],
  ["rankcross", "Ranking crosstable"],
];
const TITLES = Object.fromEntries(MODES);

const SCORE_CHAR = {
  "1-0": ["1", "0"], "0-1": ["0", "1"], "0.5-0.5": ["½", "½"],
  "1-0F": ["+", "-"], "0-1F": ["-", "+"], "0-0": ["-", "-"],
};

export default function ListsWindow({ tournament, mode, setMode, notify }) {
  const [rounds, setRounds] = useState(null);
  const [standings, setStandings] = useState(null);
  const isCross = mode === "startcross" || mode === "rankcross";
  const tid = tournament.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isCross) return;
      setRounds(null);
      try {
        const rs = await Promise.all(tournament.rounds.map(r => api.getRound(tid, r.number)));
        if (!alive) return;
        setRounds(rs);
        if (mode === "rankcross") {
          const s = await api.standings(tid);
          if (alive) setStandings(s);
        }
      } catch (e) { notify(e.message, true); }
    })();
    return () => { alive = false; };
  }, [tid, mode, isCross, tournament.rounds, notify]);

  const players = [...tournament.players];
  if (mode === "alphabetical") players.sort((a, b) => a.name.localeCompare(b.name));
  else players.sort((a, b) => a.start_no - b.start_no);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="ttl">{TITLES[mode] || "Lists"}</div>
          <div className="sub">{tournament.name}</div>
        </div>
        <div className="spacer" />
        <span className="pill">{tournament.players.length} players</span>
      </div>

      <div className="toolstrip">
        <Segmented ariaLabel="List type" options={MODES} value={mode} onChange={setMode} />
      </div>

      <div className="card-body flush">
        {!isCross && (
          <div className="tablewrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="num" style={{ width: 56 }}>{mode === "startrank" ? "No." : "#"}</th>
                  <th>Name</th>
                  <th className="ctr" style={{ width: 64 }}>FED</th>
                  <th className="num" style={{ width: 72 }}>Rating</th>
                  <th className="ctr" style={{ width: 54 }}>Sex</th>
                  <th>Club / City</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.start_no}>
                    <td className="num"><span className="seedno">{mode === "startrank" ? p.start_no : i + 1}</span></td>
                    <td>{p.name}</td>
                    <td className="ctr">{p.federation || ""}</td>
                    <td className="num">{p.rating || ""}</td>
                    <td className="ctr">{p.sex || ""}</td>
                    <td>{p.club || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isCross && !rounds && <div className="empty">Building crosstable…</div>}
        {isCross && rounds && (
          <Crosstable tournament={tournament} rounds={rounds} mode={mode} standings={standings} />
        )}
      </div>

      <div className="card-foot">
        <Button icon="printer" onClick={() => window.print()}>Print</Button>
        {isCross && (
          <span className="hint" style={{ marginLeft: "auto" }}>
            Cell = opponent no. + colour (w/b) + result. “· 1” = bye.
          </span>
        )}
      </div>
    </div>
  );
}

function Crosstable({ tournament, rounds, mode, standings }) {
  // start_no -> { roundNumber -> cell }
  const byPlayer = {};
  const snoName = {};
  tournament.players.forEach(p => { snoName[p.start_no] = p; byPlayer[p.start_no] = {}; });

  // Games are stored by start number. A roster edit can leave a finalized round
  // pointing at a number that no longer exists, so only record cells for players
  // still on the roster rather than indexing into undefined.
  rounds.forEach(r => {
    r.boards.forEach(b => {
      if (b.is_bye) {
        if (byPlayer[b.white_sno]) byPlayer[b.white_sno][r.number] = { bye: true };
        return;
      }
      const [ws, bs] = SCORE_CHAR[b.result] || ["", ""];
      if (byPlayer[b.white_sno]) byPlayer[b.white_sno][r.number] = { opp: b.black_sno, color: "w", s: ws };
      if (byPlayer[b.black_sno]) byPlayer[b.black_sno][r.number] = { opp: b.white_sno, color: "b", s: bs };
    });
  });

  let order = [...tournament.players].sort((a, b) => a.start_no - b.start_no);
  const rankOf = {};
  if (mode === "rankcross" && standings) {
    order = standings.standings.map(s => snoName[s.start_no]).filter(Boolean);
    standings.standings.forEach(s => { rankOf[s.start_no] = { rank: s.rank, pts: s.points }; });
  }
  const rnums = rounds.map(r => r.number);

  return (
    <div className="tablewrap">
      <table className="grid">
        <thead>
          <tr>
            <th className="num" style={{ width: 48 }}>{mode === "rankcross" ? "Rk." : "No."}</th>
            <th>Name</th>
            <th className="num" style={{ width: 66 }}>Rating</th>
            {rnums.map(n => <th key={n} className="ctr" style={{ width: 58 }}>{n}</th>)}
            <th className="num" style={{ width: 56 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {order.map((p, i) => (
            <tr key={p.start_no}>
              <td className="num">
                <span className={"seedno" + (mode === "rankcross" && rankOf[p.start_no]?.rank <= 3 ? ` rank${rankOf[p.start_no].rank}` : "")}>
                  {mode === "rankcross" ? (rankOf[p.start_no]?.rank ?? i + 1) : p.start_no}
                </span>
              </td>
              <td>{p.name}</td>
              <td className="num">{p.rating || ""}</td>
              {rnums.map(n => {
                const c = byPlayer[p.start_no]?.[n];
                const txt = c?.bye ? "· 1" : c ? `${c.opp}${c.color}${c.s}` : "";
                return <td key={n} className="ctr mono">{txt}</td>;
              })}
              <td className="num"><b>{rankOf[p.start_no] ? fmt(rankOf[p.start_no].pts) : ""}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmt = (v) => v == null ? "" : (Number.isInteger(v) ? v : (+v).toFixed(1));
