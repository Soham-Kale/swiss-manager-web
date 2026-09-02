import React, { useState, useEffect } from "react";
import { api } from "../api.js";

// Result codes as in Swiss-Manager's Enter/Change Results pad.
const PAD = [
  ["1:0", "1:0"], ["½:½", "½:½"], ["0:1", "0:1"],
  ["1F:0F", "1F:0F"], ["0F:1F", "0F:1F"], ["0F:0F", "0F:0F"],
];
const DISPLAY = { "1-0": "1:0", "0-1": "0:1", "0.5-0.5": "½:½", "1-0F": "1F:0F", "0-1F": "0F:1F", "0-0": "0F:0F", "pending": "" };

export default function ResultsWindow({ tournament, round, onDone, onClose, notify }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState({}); // board_no -> ui code

  useEffect(() => { (async () => {
    try { const d = await api.getRound(tournament.id, round); setData(d);
      const init = {}; d.boards.forEach(b => { if (b.result !== "pending" && !b.is_bye) init[b.board_no] = DISPLAY[b.result]; });
      setPending(init);
    } catch (e) { notify(e.message, true); }
  })(); /* eslint-disable-next-line */ }, [round, tournament]);

  if (!data) return <div className="window"><div className="wbody">Loading…</div></div>;
  const playable = data.boards.filter(b => !b.is_bye);

  const apply = (code) => {
    const b = playable[sel]; if (!b) return;
    setPending(p => ({ ...p, [b.board_no]: code }));
    if (sel < playable.length - 1) setSel(sel + 1); // auto-advance
  };
  const clearAll = () => setPending({});

  const save = async () => {
    const results = Object.entries(pending).map(([board_no, result]) => ({ board_no: +board_no, result }));
    if (!results.length) return notify("Enter at least one result", true);
    setBusy(true);
    try {
      await api.setResults(tournament.id, round, results);
      // finalize if every playable board has a result
      const allDone = playable.every(b => pending[b.board_no]);
      if (allDone) {
        await api.finalizeRound(tournament.id, round);
        notify(`Round ${round} results saved & finalized`);
      } else {
        notify("Results saved (round not yet complete)");
      }
      onDone();
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };

  const missing = playable.filter(b => !pending[b.board_no]).length;

  return (
    <div className="window">
      <div className="wtitle">
        <span>Enter/Change Results for Round {round}</span>
        <span className="btns"><span className="wb" onClick={onClose}>✕</span></span>
      </div>
      <div className="wbody">
        <div className="reswrap">
          <div className="reslist" style={{ maxHeight: 360, overflow: "auto", border: "1px solid #ccc" }}>
            <table className="grid">
              <thead><tr><th style={{ width: 34 }}>Bo</th><th>White</th><th className="ctr" style={{ width: 64 }}>Result</th><th>Black</th></tr></thead>
              <tbody>
                {playable.map((b, i) => (
                  <tr key={b.board_no} onClick={() => setSel(i)}
                      style={{ cursor: "pointer", outline: i === sel ? "2px solid #3f7fe0" : "none" }}>
                    <td className="num">{b.board_no}</td>
                    <td>{b.white_sno} {b.white_name}</td>
                    <td className="ctr res-set">{pending[b.board_no] || "—"}</td>
                    <td>{b.black_sno} {b.black_name}</td>
                  </tr>
                ))}
                {data.boards.filter(b => b.is_bye).map(b => (
                  <tr key={"bye" + b.board_no}><td className="num">{b.board_no}</td><td>{b.white_sno} {b.white_name}</td>
                    <td className="ctr bye">bye</td><td className="bye">— bye (1) —</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="respad">
            {PAD.map(([code, label]) => <div key={code} className="rb" onClick={() => apply(code)}>{label}</div>)}
            <div className="rb wide" onClick={() => apply("")}>Empty</div>
            <div className="rb wide" onClick={() => setSel(s => Math.min(s + 1, playable.length - 1))}>Next board ▾</div>
            <div className="rb wide" onClick={clearAll}>Clear All</div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn primary" disabled={busy} onClick={save}>Save {missing === 0 ? "& finalize" : ""}</button>
          <button className="btn" onClick={onClose}>End</button>
          <span style={{ marginLeft: "auto", color: missing ? "#a60" : "#0a7a3f" }}>
            {missing ? `${missing} board(s) missing a result` : "all boards entered"}
          </span>
        </div>
      </div>
    </div>
  );
}
