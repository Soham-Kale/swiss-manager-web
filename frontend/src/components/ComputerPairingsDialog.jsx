import React, { useState } from "react";

// Mirrors Swiss-Manager's "Pairings for round N" dialog. The engine we run is
// the FIDE Dutch (JaVaFo/bbpPairings) core via py4swiss, so those options are the
// live ones; the rest are shown for parity.
export default function ComputerPairingsDialog({ round, onStart, onCancel, busy }) {
  const [system, setSystem] = useState("dutch-local");
  const [opts, setOpts] = useState({
    baku: false, protectClub: false, forbidden: false,
    byeWeakest: true, pairByTiebreak: false, ignoreColor: false,
  });
  const [color1, setColor1] = useState("random");
  const set = (k) => setOpts((s) => ({ ...s, [k]: !s[k] }));

  const engineFor = () => {
    if (system.startsWith("burstein")) return "burstein";
    if (system.startsWith("dubov")) return "dubov";
    return "dutch";
  };

  return (
    <div className="overlay">
      <div className="dialog" style={{ minWidth: 720 }}>
        <div className="dtitle"><span>Pairings for round {round}</span>
          <span className="linkish" style={{ color: "#fff" }} onClick={onCancel}>✕</span></div>
        <div className="dbody">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #c4c4c4", padding: 10, minHeight: 240, color: "#555" }}>
              If you have any problems, please use the Gacrux option on chess-results.com.
            </div>
            <div>
              <div className="group">
                <div className="glabel">Pairing system</div>
                {[
                  ["dutch-local", "FIDE (Gacrux engine by Otto Milvang) local"],
                  ["dutch-cr", "FIDE (Gacrux engine) chess-results.com"],
                  ["javafo-local", "FIDE (JaVaFo engine, rrweb.org/javafo) local"],
                  ["javafo-cr", "FIDE (JaVaFo engine) chess-results.com"],
                ].map(([v, l]) => (
                  <label key={v} className="radioline">
                    <input type="radio" name="ps" checked={system === v} onChange={() => setSystem(v)} /> {l}
                  </label>
                ))}
              </div>
              <div className="group">
                <div className="glabel">Pairing Options</div>
                <label className="radioline"><input type="checkbox" checked={opts.baku} onChange={() => set("baku")} /> Baku Acceleration C.04.5.1</label>
                <label className="radioline"><input type="checkbox" checked={opts.protectClub} onChange={() => set("protectClub")} /> Protect round (same club-number)</label>
                <label className="radioline"><input type="checkbox" checked={opts.forbidden} onChange={() => set("forbidden")} /> Exclude forbidden pairings</label>
                <label className="radioline"><input type="checkbox" checked={opts.byeWeakest} onChange={() => set("byeWeakest")} /> Bye for weakest participant</label>
                <label className="radioline"><input type="checkbox" checked={opts.pairByTiebreak} onChange={() => set("pairByTiebreak")} /> Pair according to tiebreak, not start rank</label>
                <label className="radioline"><input type="checkbox" checked={opts.ignoreColor} onChange={() => set("ignoreColor")} /> Ignore color</label>
              </div>
              <div className="group">
                <div className="glabel">Color no. 1</div>
                {["random", "white", "black"].map((c) => (
                  <label key={c} className="radioline">
                    <input type="radio" name="c1" checked={color1 === c} onChange={() => setColor1(c)} /> {c[0].toUpperCase() + c.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="dfoot">
          <button className="btn primary" disabled={busy}
            onClick={() => onStart({ engine: engineFor(), baku: opts.baku, color1 })}>Start</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
