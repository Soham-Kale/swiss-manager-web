import React, { useState, useEffect } from "react";
import { api } from "../api.js";

// Result pad mirrors Swiss-Manager exactly. "Supported" codes are scored and can
// finalize the round; the rarer arbiter codes (0:½, ½:0, Adjn) are shown for
// parity but not fed to the rating/pairing engine in this build.
const ROWS = [
  ["1:0", "½:½", "0:1"],
  ["1F:0F", "0F:1F", "0F:0F"],
  ["0:0", "0:½", "½:0"],
  ["1U:0U", "½:½U", "0U:1U"],
];
const SUPPORTED = new Set(["1:0", "0:1", "½:½", "1F:0F", "0F:1F", "0F:0F", "0:0", "1U:0U", "½:½U", "0U:1U"]);
const DISPLAY = {
  "1-0": "1:0", "0-1": "0:1", "0.5-0.5": "½:½",
  "1-0F": "1F:0F", "0-1F": "0F:1F", "0-0": "0F:0F", "pending": "",
};

export default function ResultsWindow({ tournament, round, setRound, onDone, onClose, notify }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState({}); // board_no -> ui code

  useEffect(() => { (async () => {
    try {
      const d = await api.getRound(tournament.id, round); setData(d);
      const init = {}; d.boards.forEach(b => { if (b.result !== "pending" && !b.is_bye) init[b.board_no] = DISPLAY[b.result]; });
      setPending(init); setSel(0);
    } catch (e) { notify(e.message, true); }
  })(); /* eslint-disable-next-line */ }, [round, tournament]);

  if (!data) return <div className="window"><div className="wbody">Loading…</div></div>;
  const playable = data.boards.filter(b => !b.is_bye);

  const setBoard = (bno, code) => setPending(p => ({ ...p, [bno]: code }));
  const apply = (code) => {
    const b = playable[sel]; if (!b) return;
    if (!SUPPORTED.has(code) && code !== "") { notify(`${code} is an arbiter code (shown for parity; not scored in this build)`, true); }
    setBoard(b.board_no, code);
    if (sel < playable.length - 1) setSel(sel + 1);
  };
  const applyAll = () => { // apply the currently-selected board's code to every playable board
    const b = playable[sel]; const code = b && pending[b.board_no];
    if (!code) return notify("Pick a result first, then All", true);
    const np = { ...pending }; playable.forEach(x => { np[x.board_no] = code; }); setPending(np);
  };
  const gotoMissing = () => {
    const i = playable.findIndex(b => !pending[b.board_no]);
    if (i >= 0) setSel(i); else notify("No missing results");
  };
  const clearAll = () => setPending({});
  const rounds = tournament.rounds.map(r => r.number);
  const navRound = (delta) => { const n = round + delta; if (rounds.includes(n)) setRound(n); };

  const save = async () => {
    const results = Object.entries(pending)
      .filter(([, c]) => SUPPORTED.has(c))
      .map(([board_no, result]) => ({ board_no: +board_no, result }));
    if (!results.length) return notify("Enter at least one result", true);
    setBusy(true);
    try {
      await api.setResults(tournament.id, round, results);
      const allDone = playable.every(b => SUPPORTED.has(pending[b.board_no]));
      if (allDone) { await api.finalizeRound(tournament.id, round); notify(`Round ${round} saved & finalized`); }
      else notify("Results saved (round not complete)");
      onDone();
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };

  const missing = playable.filter(b => !SUPPORTED.has(pending[b.board_no])).length;

  return (
    <div className="window">
      <div className="wtitle">
        <span>Enter/Change Results for Round {round}</span>
        <span className="btns"><span className="wb" onClick={onClose}>✕</span></span>
      </div>
      <div className="wbody">
        <div className="reswrap">
          <div className="reslist" style={{ maxHeight: 380, overflow: "auto", border: "1px solid #ccc" }}>
            <table className="grid">
              <thead><tr><th style={{ width: 30 }}></th><th style={{ width: 34 }}>Bo</th><th>White</th><th className="ctr" style={{ width: 70 }}>Result</th><th>Black</th></tr></thead>
              <tbody>
                {playable.map((b, i) => (
                  <tr key={b.board_no} onClick={() => setSel(i)}
                      style={{ cursor: "pointer", background: i === sel ? "#cfe0ff" : undefined }}>
                    <td className="ctr">{i === sel ? "▸" : ""}</td>
                    <td className="num">{b.board_no}</td>
                    <td>{b.white_sno} {b.white_name}</td>
                    <td className="ctr res-set">{pending[b.board_no] || "—"}</td>
                    <td>{b.black_sno} {b.black_name}</td>
                  </tr>
                ))}
                {data.boards.filter(b => b.is_bye).map(b => (
                  <tr key={"bye" + b.board_no}><td></td><td className="num">{b.board_no}</td>
                    <td>{b.white_sno} {b.white_name}</td><td className="ctr bye">bye</td><td className="bye">— bye (1) —</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="respad">
            {ROWS.map((row, ri) => row.map(code => (
              <div key={code} className="rb" onClick={() => apply(code)}>{code}</div>
            )))}
            <div className="rb" onClick={() => apply("")}>Empty</div>
            <div className="rb" onClick={() => notify("Adjourned (parity only)", true)}>Adjn</div>
            <div className="rb" onClick={() => setSel(s => Math.min(s + 1, playable.length - 1))}>▾</div>
            <div className="rb wide" onClick={applyAll}>All</div>
            <div className="rb wide" onClick={gotoMissing}>Missing</div>
            <div className="rb" onClick={() => navRound(-1)}>Rd-1</div>
            <div className="rb" onClick={() => navRound(+1)}>Rd+1</div>
            <div className="rb" onClick={() => notify("Color: parity only", true)}>Color</div>
            <div className="rb wide" onClick={clearAll}>Clear All</div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn primary" disabled={busy} onClick={save}>Save {missing === 0 ? "& finalize" : ""}</button>
          <button className="btn ok" onClick={onClose}>✔ End</button>
          <span style={{ marginLeft: "auto", color: missing ? "#a60" : "#0a7a3f" }}>
            {missing ? `${missing} board(s) missing a result` : "all boards entered"}
          </span>
        </div>
      </div>
    </div>
  );
}
