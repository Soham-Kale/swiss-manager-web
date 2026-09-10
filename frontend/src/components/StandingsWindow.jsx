import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import Button from "./ui/Button.jsx";

/**
 * Map a configured tiebreak label onto a computed standings column.
 *
 * Labels reach us in two shapes: the plain names the API defaults to
 * ("Buchholz Cut-1") and the coded names the setup dialog offers
 * ("Buchholz Tie-Break Variable (2023) [84]"). Matching on keywords rather than
 * exact strings means both resolve, and new label variants keep working.
 * Returns null for tiebreaks this build doesn't compute, so they're skipped.
 */
function resolveTiebreak(label) {
  const s = String(label).toLowerCase();
  if (s.includes("buchholz")) {
    return s.includes("cut") ? ["buchholz_cut1", "BH-C1"] : ["buchholz", "BH"];
  }
  if (s.includes("sonneborn")) return ["sonneborn_berger", "SB"];
  if (s.includes("victories") || s.includes("number of wins") || /\bwins?\b/.test(s)) return ["wins", "Wins"];
  return null; // Direct Encounter, Koya, ARO, performance… not computed here
}

export default function StandingsWindow({ tournament, notify }) {
  const [rows, setRows] = useState(null);
  const tid = tournament.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await api.standings(tid); if (alive) setRows(d.standings); }
      catch (e) { notify(e.message, true); }
    })();
    return () => { alive = false; };
  }, [tid, notify]);

  // Resolve configured tiebreaks to columns, dropping duplicates and unknowns.
  const cols = [];
  for (const tb of tournament.tiebreaks || []) {
    const c = resolveTiebreak(tb);
    if (c && !cols.some(([k]) => k === c[0])) cols.push(c);
  }

  const played = tournament.rounds.filter(r => r.finalized).length;

  const exportCsv = () => {
    if (!rows) return;
    const head = ["Rank", "No.", "Name", "Rating", "Points", ...cols.map(([, l]) => l)];
    const lines = [head.join(",")];
    rows.forEach(r => lines.push([r.rank, r.start_no, `"${r.name}"`, r.rating, r.points,
      ...cols.map(([k]) => r[k])].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tournament.name}_standings.csv`;
    a.click();
  };

  if (!rows) return <div className="card"><div className="empty">Calculating standings…</div></div>;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="ttl">Standings</div>
          <div className="sub">
            {played ? `After ${played} round${played === 1 ? "" : "s"}` : "No rounds finalized yet"}
            {cols.length ? ` · tiebreaks: ${cols.map(([, l]) => l).join(", ")}` : ""}
          </div>
        </div>
        <div className="spacer" />
        <span className="pill">{rows.length} players</span>
      </div>

      <div className="card-body flush">
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="num" style={{ width: 56 }}>Rank</th>
                <th className="num" style={{ width: 52 }}>No.</th>
                <th>Name</th>
                <th className="num" style={{ width: 70 }}>Rating</th>
                <th className="num" style={{ width: 60 }}>Pts</th>
                {cols.map(([, lbl]) => <th key={lbl} className="num" style={{ width: 68 }}>{lbl}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.start_no}>
                  <td className="num">
                    <span className={"seedno" + (r.rank <= 3 ? ` rank${r.rank}` : "")}>{r.rank}</span>
                  </td>
                  <td className="num">{r.start_no}</td>
                  <td style={r.rank <= 3 ? { fontWeight: 600 } : undefined}>{r.name}</td>
                  <td className="num">{r.rating || ""}</td>
                  <td className="num"><b>{fmt(r.points)}</b></td>
                  {cols.map(([key, lbl]) => <td key={lbl} className="num">{fmt(r[key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-foot">
        <Button icon="download" onClick={exportCsv}>CSV</Button>
        <Button icon="printer" onClick={() => window.print()}>Print</Button>
        {cols.length === 0 && (
          <span className="hint" style={{ marginLeft: "auto" }}>
            No computed tiebreaks selected — set them in tournament setup.
          </span>
        )}
      </div>
    </div>
  );
}

const fmt = (v) => (v === null || v === undefined) ? ""
  : (Number.isInteger(v) ? String(v) : String(+(+v).toFixed(2)));
