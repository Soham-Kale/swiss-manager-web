import React, { useState, useEffect } from "react";
import { api } from "../api.js";

const TB_COL = {
  "Buchholz": ["buchholz", "BH"],
  "Buchholz Cut-1": ["buchholz_cut1", "BH-C1"],
  "Sonneborn-Berger": ["sonneborn_berger", "SB"],
  "Number of Wins": ["wins", "Wins"],
};

export default function StandingsWindow({ tournament, onClose, notify }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { (async () => {
    try { setRows((await api.standings(tournament.id)).standings); }
    catch (e) { notify(e.message, true); }
  })(); /* eslint-disable-next-line */ }, [tournament]);

  const cols = (tournament.tiebreaks || []).map(tb => TB_COL[tb]).filter(Boolean);

  if (!rows) return <div className="window"><div className="wbody">Loading…</div></div>;
  return (
    <div className="window">
      <div className="wtitle">
        <span>Ranking — {tournament.name}</span>
        <span className="btns"><span className="wb" onClick={onClose}>✕</span></span>
      </div>
      <div className="wsub">Final Ranking / Interim standings after {tournament.rounds.filter(r => r.finalized).length} round(s)</div>
      <div className="wbody">
        <table className="grid">
          <thead>
            <tr>
              <th className="num" style={{ width: 40 }}>Rk.</th>
              <th className="num" style={{ width: 46 }}>SNo.</th>
              <th>Name</th>
              <th className="num" style={{ width: 60 }}>Rtg</th>
              <th className="num" style={{ width: 46 }}>Pts</th>
              {cols.map(([, lbl]) => <th key={lbl} className="num" style={{ width: 60 }}>{lbl}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.start_no}>
                <td className="num">{r.rank}</td>
                <td className="num">{r.start_no}</td>
                <td>{r.name}</td>
                <td className="num">{r.rating || ""}</td>
                <td className="num"><b>{fmt(r.points)}</b></td>
                {cols.map(([key, lbl]) => <td key={lbl} className="num">{fmt(r[key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </div>
    </div>
  );
}
const fmt = (v) => (v === null || v === undefined) ? ""
  : (Number.isInteger(v) ? String(v) : (+v).toFixed(2).replace(/\.?0+$/, ""));
