import React, { useState, useEffect } from "react";
import { api } from "../api.js";

const TITLES = {
  alphabetical: "Alphabetical list",
  startrank: "Starting rank list",
  startcross: "Starting rank crosstable",
  rankcross: "Ranking crosstable",
};
const SCORE_CHAR = { "1-0": ["1", "0"], "0-1": ["0", "1"], "0.5-0.5": ["½", "½"],
  "1-0F": ["+", "-"], "0-1F": ["-", "+"], "0-0": ["-", "-"] };

export default function ListsWindow({ tournament, mode, onClose, notify }) {
  const [rounds, setRounds] = useState(null);
  const [standings, setStandings] = useState(null);
  const isCross = mode === "startcross" || mode === "rankcross";

  useEffect(() => { (async () => {
    try {
      if (isCross) {
        const rs = await Promise.all(tournament.rounds.map(r => api.getRound(tournament.id, r.number)));
        setRounds(rs);
        if (mode === "rankcross") setStandings(await api.standings(tournament.id));
      }
    } catch (e) { notify(e.message, true); }
  })(); /* eslint-disable-next-line */ }, [mode, tournament]);

  const players = [...tournament.players];
  if (mode === "alphabetical") players.sort((a, b) => a.name.localeCompare(b.name));
  else players.sort((a, b) => a.start_no - b.start_no);

  return (
    <div className="window">
      <div className="wtitle"><span>{TITLES[mode]} — {tournament.name}</span>
        <span className="btns"><span className="wb" onClick={onClose}>✕</span></span></div>
      <div className="wbody">
        {!isCross && (
          <table className="grid">
            <thead><tr><th className="num" style={{ width: 46 }}>{mode === "startrank" ? "SNo." : "No."}</th>
              <th>Name</th><th className="ctr" style={{ width: 50 }}>FED</th><th className="num" style={{ width: 60 }}>Rtg</th>
              <th className="ctr" style={{ width: 44 }}>sex</th><th>Club/City</th></tr></thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.start_no}><td className="num">{mode === "startrank" ? p.start_no : i + 1}</td>
                  <td>{p.name}</td><td className="ctr">{p.federation || ""}</td><td className="num">{p.rating || ""}</td>
                  <td className="ctr">{p.sex || ""}</td><td>{p.club || ""}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {isCross && !rounds && <div>Loading crosstable…</div>}
        {isCross && rounds && <Crosstable tournament={tournament} rounds={rounds} mode={mode} standings={standings} />}
        <div style={{ marginTop: 10 }}><button className="btn" onClick={() => window.print()}>Print</button></div>
      </div>
    </div>
  );
}

function Crosstable({ tournament, rounds, mode, standings }) {
  // Map: start_no -> { roundNumber -> cell }
  const byPlayer = {};
  const snoName = {}; tournament.players.forEach(p => { snoName[p.start_no] = p; byPlayer[p.start_no] = {}; });
  rounds.forEach(r => {
    r.boards.forEach(b => {
      if (b.is_bye) { byPlayer[b.white_sno][r.number] = { bye: true }; return; }
      const [ws, bs] = SCORE_CHAR[b.result] || ["", ""];
      byPlayer[b.white_sno][r.number] = { opp: b.black_sno, color: "w", s: ws };
      byPlayer[b.black_sno][r.number] = { opp: b.white_sno, color: "b", s: bs };
    });
  });

  let order = [...tournament.players].sort((a, b) => a.start_no - b.start_no);
  let rankOf = {};
  if (mode === "rankcross" && standings) {
    order = standings.standings.map(s => snoName[s.start_no]).filter(Boolean);
    standings.standings.forEach(s => { rankOf[s.start_no] = { rank: s.rank, pts: s.points }; });
  }
  const rnums = rounds.map(r => r.number);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="grid">
        <thead>
          <tr>
            <th className="num" style={{ width: 34 }}>{mode === "rankcross" ? "Rk." : "SNo."}</th>
            <th>Name</th><th className="num" style={{ width: 54 }}>Rtg</th>
            {rnums.map(n => <th key={n} className="ctr" style={{ width: 52 }}>{n}</th>)}
            <th className="num" style={{ width: 46 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {order.map((p, i) => (
            <tr key={p.start_no}>
              <td className="num">{mode === "rankcross" ? (rankOf[p.start_no]?.rank ?? i + 1) : p.start_no}</td>
              <td>{p.name}</td><td className="num">{p.rating || ""}</td>
              {rnums.map(n => {
                const c = byPlayer[p.start_no]?.[n];
                let txt = "";
                if (c?.bye) txt = "· 1";
                else if (c) txt = `${c.opp}${c.color}${c.s}`;
                return <td key={n} className="ctr mono">{txt}</td>;
              })}
              <td className="num"><b>{rankOf[p.start_no] ? fmt(rankOf[p.start_no].pts) : ""}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 6 }}>Cell = opponent SNo. + colour (w/b) + result (1 / ½ / 0). “· 1” = bye.</p>
    </div>
  );
}
const fmt = (v) => v == null ? "" : (Number.isInteger(v) ? v : (+v).toFixed(1));
