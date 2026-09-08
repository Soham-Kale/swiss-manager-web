import React, { useState, useEffect } from "react";
import { api } from "../api.js";

const RES_LABEL = { "1-0": "1 - 0", "0-1": "0 - 1", "0.5-0.5": "½ - ½", "1-0F": "1F - 0F", "0-1F": "0F - 1F", "0-0": "0F - 0F", "pending": "" };

export default function PairingsWindow({ tournament, round, setRound, onEnterResults, onClose, notify, onGenerateNext }) {
  const [data, setData] = useState(null);
  const load = async (n) => {
    try { setData(await api.getRound(tournament.id, n)); }
    catch (e) { notify(e.message, true); }
  };
  useEffect(() => { load(round); /* eslint-disable-next-line */ }, [round, tournament]);

  const rounds = tournament.rounds.map(r => r.number);
  const gen = () => onGenerateNext && onGenerateNext();
  const exportExcel = () => {
    if (!data) return;
    const head = ["Bo.", "SNo.", "White", "Pts", "Res.", "Pts", "Black", "SNo."];
    const lines = [head.join(",")];
    data.boards.forEach(b => {
      lines.push([b.board_no, b.white_sno, `"${b.white_name}"`, b.white_pts,
        b.is_bye ? "bye" : RES_LABEL[b.result] || "", b.is_bye ? "" : b.black_pts,
        b.is_bye ? "" : `"${b.black_name}"`, b.is_bye ? "" : b.black_sno].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${tournament.name}_R${round}_pairings.csv`; a.click();
  };

  if (!data) return <div className="window"><div className="wbody">Loading…</div></div>;

  return (
    <div className="window">
      <div className="wtitle">
        <span>Pairings/Results for Round {round} ({tournament.rounds.length})</span>
        <span className="btns"><span className="wb" onClick={onClose}>✕</span></span>
      </div>
      <div className="wsub">{tournament.name}</div>
      <div className="wbody">
        <div className="sheetmeta">
          {row("Organizer(s)", tournament.organizer)}
          {row("Tournament Director", tournament.director)}
          {row("Chief Arbiter", tournament.chief_arbiter)}
          {row("Deputy Chief Arbiter", tournament.deputy_arbiter)}
          {row("Arbiter", tournament.arbiter)}
          {row("Town", tournament.city)}
          {row("Federation", tournament.federation)}
          {row("Date", tournament.date_from)}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
          <b>Round</b>
          <select value={round} onChange={e => setRound(+e.target.value)}>
            {rounds.map(n => <option key={n} value={n}>Round {n}{tournament.rounds.find(r => r.number === n)?.finalized ? " ✓" : ""}</option>)}
          </select>
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>{data.finalized ? "finalized" : "in progress"}</span>
        </div>

        <table className="grid">
          <thead>
            <tr>
              <th className="num" style={{ width: 40 }}>Bo.</th>
              <th className="num" style={{ width: 46 }}>SNo.</th>
              <th>White</th>
              <th className="num" style={{ width: 42 }}>Pts</th>
              <th className="ctr" style={{ width: 70 }}>Res.</th>
              <th className="num" style={{ width: 42 }}>Pts</th>
              <th>Black</th>
              <th className="num" style={{ width: 46 }}>SNo.</th>
            </tr>
          </thead>
          <tbody>
            {data.boards.map(b => (
              <tr key={b.board_no}>
                <td className="num">{b.board_no}</td>
                <td className="num">{b.white_sno}</td>
                <td>{b.white_name}</td>
                <td className="num">{fmt(b.white_pts)}</td>
                <td className="ctr">{b.is_bye ? <span className="bye">bye</span> : (RES_LABEL[b.result] || "· · ·")}</td>
                <td className="num">{b.is_bye ? "" : fmt(b.black_pts)}</td>
                <td>{b.is_bye ? <span className="bye">— bye —</span> : b.black_name}</td>
                <td className="num">{b.is_bye ? "" : b.black_sno}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!data.finalized && <button className="btn primary" onClick={onEnterResults}>Enter results…</button>}
          <button className="btn" onClick={exportExcel}>Excel</button>
          <button className="btn" onClick={() => window.print()}>Print</button>
          {data.finalized && round === tournament.rounds.length &&
            tournament.rounds.filter(r => r.finalized).length < tournament.rounds &&
            <button className="btn primary" onClick={gen}>Generate next round ▸</button>}
        </div>
      </div>
    </div>
  );
}

const row = (k, v) => <div className="r"><div className="k">{k}</div><div>: {v || ""}</div></div>;
const fmt = (p) => (p === null || p === undefined) ? "" : (Number.isInteger(p) ? p : p.toFixed(1));
