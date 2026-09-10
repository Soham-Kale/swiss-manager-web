import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import Button from "./ui/Button.jsx";
import { Segmented } from "./ui/Field.jsx";

// Result pad. "Supported" codes are scored and can finalize the round; the rarer
// arbiter codes (0:½, ½:0, Adjn) are available for parity but are not fed to the
// scoring/pairing engine in this build.
const PAD = [
  ["Standard", ["1:0", "½:½", "0:1"]],
  ["Forfeit", ["1F:0F", "0F:1F", "0F:0F"]],
  ["Arbiter", ["0:0", "0:½", "½:0"]],
  ["Unrated", ["1U:0U", "½:½U", "0U:1U"]],
];
const SUPPORTED = new Set(["1:0", "0:1", "½:½", "1F:0F", "0F:1F", "0F:0F", "0:0", "1U:0U", "½:½U", "0U:1U"]);
const QUICK = ["1:0", "½:½", "0:1"];
const DISPLAY = {
  "1-0": "1:0", "0-1": "0:1", "0.5-0.5": "½:½",
  "1-0F": "1F:0F", "0-1F": "0F:1F", "0-0": "0F:0F", "pending": "",
};

export default function ResultsWindow({ tournament, round, setRound, onDone, onClose, notify }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState({}); // board_no -> ui code
  const tid = tournament.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.getRound(tid, round);
        if (!alive) return;
        setData(d);
        const init = {};
        d.boards.forEach(b => { if (b.result !== "pending" && !b.is_bye) init[b.board_no] = DISPLAY[b.result]; });
        setPending(init); setSel(0);
      } catch (e) { notify(e.message, true); }
    })();
    return () => { alive = false; };
  }, [tid, round, notify]);

  if (!data) return <div className="card"><div className="empty">Loading boards…</div></div>;

  const playable = data.boards.filter(b => !b.is_bye);
  const byes = data.boards.filter(b => b.is_bye);
  const setBoard = (bno, code) => setPending(p => ({ ...p, [bno]: code }));

  const apply = (code) => {
    const b = playable[sel];
    if (!b) return;
    if (code && !SUPPORTED.has(code)) notify(`${code} is an arbiter code — shown for parity, not scored`, true);
    setBoard(b.board_no, code);
    if (sel < playable.length - 1) setSel(sel + 1);
  };
  const applyAll = () => {
    const b = playable[sel];
    const code = b && pending[b.board_no];
    if (!code) return notify("Pick a result first, then All", true);
    const np = { ...pending };
    playable.forEach(x => { np[x.board_no] = code; });
    setPending(np);
  };
  const gotoMissing = () => {
    const i = playable.findIndex(b => !pending[b.board_no]);
    if (i >= 0) setSel(i); else notify("No missing results");
  };
  const clearAll = () => setPending({});
  const rounds = tournament.rounds.map(r => r.number);

  const save = async () => {
    const results = Object.entries(pending)
      .filter(([, c]) => SUPPORTED.has(c))
      .map(([board_no, result]) => ({ board_no: +board_no, result }));
    if (!results.length) return notify("Enter at least one result", true);
    setBusy(true);
    try {
      await api.setResults(tournament.id, round, results);
      const allDone = playable.every(b => SUPPORTED.has(pending[b.board_no]));
      if (allDone) {
        await api.finalizeRound(tournament.id, round);
        notify(`Round ${round} saved & finalized`);
      } else notify("Results saved (round not complete)");
      onDone();
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };

  const missing = playable.filter(b => !SUPPORTED.has(pending[b.board_no])).length;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="ttl">Enter results — round {round}</div>
          <div className="sub">Click a result on any board, or use the pad for arbiter codes.</div>
        </div>
        <div className="spacer" />
        <span className={"pill " + (missing ? "warn" : "ok")}>
          <i className="dot" />{missing ? `${missing} missing` : "All entered"}
        </span>
      </div>

      <div className="toolstrip">
        <Segmented ariaLabel="Round" options={rounds.map(n => [n, `R${n}`])} value={round} onChange={setRound} />
        <span className="spacer" />
        <Button size="sm" onClick={gotoMissing}>Next missing</Button>
        <Button size="sm" onClick={applyAll}>Apply to all</Button>
        <Button size="sm" onClick={clearAll}>Clear all</Button>
      </div>

      <div className="card-body">
        <div className="reswrap">
          <div>
            <div className="tablewrap short">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="num" style={{ width: 46 }}>Bo.</th>
                    <th>White</th>
                    <th className="ctr" style={{ width: 128 }}>Result</th>
                    <th>Black</th>
                    <th className="ctr" style={{ width: 60 }}>Set</th>
                  </tr>
                </thead>
                <tbody>
                  {playable.map((b, i) => (
                    <tr key={b.board_no} className={i === sel ? "sel" : undefined}
                        onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                      <td className="num">{b.board_no}</td>
                      <td><span className="seedno">{b.white_sno}</span> {b.white_name}</td>
                      <td className="ctr">
                        <span className="quick">
                          {QUICK.map(code => (
                            <button key={code}
                                    className={pending[b.board_no] === code ? "on" : ""}
                                    onClick={(e) => { e.stopPropagation(); setSel(i); setBoard(b.board_no, code); }}>
                              {code}
                            </button>
                          ))}
                        </span>
                      </td>
                      <td><span className="seedno">{b.black_sno}</span> {b.black_name}</td>
                      <td className="ctr res-set">{pending[b.board_no] || <span className="hint">—</span>}</td>
                    </tr>
                  ))}
                  {byes.map(b => (
                    <tr key={"bye" + b.board_no}>
                      <td className="num">{b.board_no}</td>
                      <td><span className="seedno">{b.white_sno}</span> {b.white_name}</td>
                      <td className="ctr bye">bye</td>
                      <td className="bye">— bye —</td>
                      <td className="ctr bye">1</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="respad">
            {PAD.map(([group, codes]) => (
              <React.Fragment key={group}>
                <div className="pl">{group}</div>
                {codes.map(code => (
                  <div key={code} className="rb" onClick={() => apply(code)}>{code}</div>
                ))}
              </React.Fragment>
            ))}
            <div className="pl">Other</div>
            <div className="rb" onClick={() => apply("")}>Empty</div>
            <div className="rb" onClick={() => notify("Adjourned — parity only", true)}>Adjn</div>
            <div className="rb" onClick={() => setSel(s => Math.min(s + 1, playable.length - 1))}>▾</div>
            <div className="rb wide" onClick={() => notify("Colour swap — parity only", true)}>Colour</div>
          </div>
        </div>
      </div>

      <div className="card-foot">
        <Button variant="primary" icon="check" disabled={busy} onClick={save}>
          {missing === 0 ? "Save & finalize round" : "Save results"}
        </Button>
        <Button onClick={onClose}>Back to pairings</Button>
        <span className="spacer" />
        <span className="hint">{playable.length} playable boards{byes.length ? ` · ${byes.length} bye` : ""}</span>
      </div>
    </div>
  );
}
