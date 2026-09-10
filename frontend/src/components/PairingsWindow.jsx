import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import Button from "./ui/Button.jsx";
import { Segmented, Pill } from "./ui/Field.jsx";

const RES_LABEL = {
  "1-0": "1 – 0", "0-1": "0 – 1", "0.5-0.5": "½ – ½",
  "1-0F": "1F – 0F", "0-1F": "0F – 1F", "0-0": "0F – 0F", "pending": "",
};

export default function PairingsWindow({ tournament, round, setRound, onEnterResults, notify, onGenerateNext }) {
  const [data, setData] = useState(null);
  const tid = tournament.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await api.getRound(tid, round); if (alive) setData(d); }
      catch (e) { notify(e.message, true); }
    })();
    return () => { alive = false; };
  }, [tid, round, notify]);

  const rounds = tournament.rounds.map(r => r.number);
  const totalRounds = tournament.total_rounds || 0;
  const roundsDone = tournament.rounds.filter(r => r.finalized).length;
  const isLast = round === tournament.rounds.length;
  const canGenerate = data?.finalized && isLast && roundsDone < totalRounds;

  const exportCsv = () => {
    if (!data) return;
    const head = ["Board", "White No.", "White", "Pts", "Result", "Pts", "Black", "Black No."];
    const lines = [head.join(",")];
    data.boards.forEach(b => {
      lines.push([
        b.board_no, b.white_sno, `"${b.white_name}"`, b.white_pts,
        b.is_bye ? "bye" : RES_LABEL[b.result] || "",
        b.is_bye ? "" : b.black_pts, b.is_bye ? "" : `"${b.black_name}"`,
        b.is_bye ? "" : b.black_sno,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tournament.name}_R${round}_pairings.csv`;
    a.click();
  };

  if (!data) return <div className="card"><div className="empty">Loading pairings…</div></div>;

  const meta = [
    ["Organizer", tournament.organizer], ["Director", tournament.director],
    ["Chief arbiter", tournament.chief_arbiter], ["Deputy", tournament.deputy_arbiter],
    ["Arbiter", tournament.arbiter], ["Town", tournament.city],
    ["Federation", tournament.federation], ["Date", tournament.date_from],
  ].filter(([, v]) => v);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="ttl">Round {round} pairings</div>
          <div className="sub">{tournament.name}</div>
        </div>
        <div className="spacer" />
        {data.finalized ? <Pill tone="ok">Finalized</Pill> : <Pill tone="warn">In progress</Pill>}
      </div>

      {meta.length > 0 && (
        <div className="sheetmeta">
          {meta.map(([k, v]) => (
            <div className="r" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}
        </div>
      )}

      <div className="toolstrip">
        <Segmented ariaLabel="Round"
                   options={rounds.map(n => [n, `R${n}${tournament.rounds.find(r => r.number === n)?.finalized ? " ✓" : ""}`])}
                   value={round} onChange={setRound} />
        <span className="spacer" />
        <span className="hint">{data.boards.length} boards</span>
      </div>

      <div className="card-body flush">
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="num" style={{ width: 52 }}>Bo.</th>
                <th className="num" style={{ width: 52 }}>No.</th>
                <th>White</th>
                <th className="num" style={{ width: 52 }}>Pts</th>
                <th className="ctr" style={{ width: 92 }}>Result</th>
                <th className="num" style={{ width: 52 }}>Pts</th>
                <th>Black</th>
                <th className="num" style={{ width: 52 }}>No.</th>
              </tr>
            </thead>
            <tbody>
              {data.boards.map(b => (
                <tr key={b.board_no}>
                  <td className="num">{b.board_no}</td>
                  <td className="num"><span className="seedno">{b.white_sno}</span></td>
                  <td>{b.white_name}</td>
                  <td className="num">{fmt(b.white_pts)}</td>
                  <td className="ctr">
                    {b.is_bye ? <span className="bye">bye</span>
                      : (RES_LABEL[b.result] || <span className="hint">— — —</span>)}
                  </td>
                  <td className="num">{b.is_bye ? "" : fmt(b.black_pts)}</td>
                  <td>{b.is_bye ? <span className="bye">— bye —</span> : b.black_name}</td>
                  <td className="num">{b.is_bye ? "" : <span className="seedno">{b.black_sno}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-foot">
        {!data.finalized && <Button variant="primary" icon="edit" onClick={onEnterResults}>Enter results</Button>}
        {canGenerate && <Button variant="primary" icon="swap" onClick={onGenerateNext}>Generate round {round + 1}</Button>}
        <Button icon="download" onClick={exportCsv}>CSV</Button>
        <Button icon="printer" onClick={() => window.print()}>Print</Button>
      </div>
    </div>
  );
}

const fmt = (p) => (p === null || p === undefined) ? "" : (Number.isInteger(p) ? p : p.toFixed(1));
