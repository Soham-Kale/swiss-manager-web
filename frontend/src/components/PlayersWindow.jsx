import React, { useState, useRef } from "react";
import { api } from "../api.js";
import Button from "./ui/Button.jsx";
import Icon from "./ui/Icon.jsx";

const BLANK = { name: "", rating: "", federation: "", sex: "", title: "", club: "", fide_id: "" };

const COLS = [
  { k: "name", label: "Name", placeholder: "Lastname, Firstname" },
  { k: "fide_id", label: "FIDE ID", width: 110 },
  { k: "federation", label: "FED", width: 64, align: "center" },
  { k: "rating", label: "Rating", width: 74, align: "right" },
  { k: "sex", label: "Sex", width: 54, align: "center" },
  { k: "title", label: "Title", width: 64, align: "center" },
  { k: "club", label: "Club / City" },
];

export default function PlayersWindow({ tournament, onSaved, onGenerate, notify }) {
  const [rows, setRows] = useState(
    tournament.players.length
      ? tournament.players.map(p => ({ ...p, rating: p.rating || "" }))
      : Array.from({ length: 6 }, () => ({ ...BLANK }))
  );
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef();

  const setCell = (i, k, v) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows(rs => [...rs, { ...BLANK }]);
  const delRow = (i) => setRows(rs => rs.filter((_, j) => j !== i));

  const named = rows.filter(r => (r.name || "").trim());

  const save = async () => {
    const players = named.map(r => ({
      name: r.name.trim(), rating: +r.rating || 0, federation: r.federation || "",
      sex: r.sex || "", title: r.title || "", club: r.club || "", fide_id: r.fide_id || "",
    }));
    if (!players.length) return notify("Add at least one player", true);
    setBusy(true);
    try {
      const t = await api.setPlayers(tournament.id, players, true); // reseed by rating
      setRows(t.players.map(p => ({ ...p, rating: p.rating || "" })));
      await onSaved(t.id);
      notify(`${players.length} players saved (seeded by rating)`);
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };

  const runImport = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const t = await api.importPlayers(tournament.id, file);
      setRows(t.players.map(p => ({ ...p, rating: p.rating || "" })));
      await onSaved(t.id);
      notify(`Imported ${t.players.length} players`);
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };

  const onPick = async (e) => { await runImport(e.target.files[0]); e.target.value = ""; };
  const onDrop = async (e) => { e.preventDefault(); setOver(false); await runImport(e.dataTransfer.files?.[0]); };

  const seeded = tournament.players.length > 0;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="ttl">Players</div>
          <div className="sub">Starting numbers are assigned by rating when you save.</div>
        </div>
        <div className="spacer" />
        <span className="pill">{named.length} entered</span>
      </div>

      <div className="toolstrip">
        <Button icon="plus" size="sm" onClick={addRow}>Add row</Button>
        <div
          className={"dropzone" + (over ? " over" : "")}
          style={{ flex: 1, minWidth: 240, padding: "6px 12px" }}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <Icon name="upload" size={15} />
          <span>Drop a roster here, or <span className="linkish">browse</span> — Excel, CSV, JSON or a Chess-Results export</span>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.json"
               style={{ display: "none" }} onChange={onPick} />
      </div>

      <div className="card-body flush">
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="num" style={{ width: 52 }}>No.</th>
                {COLS.map(c => (
                  <th key={c.k} className={c.align === "right" ? "num" : c.align === "center" ? "ctr" : ""}
                      style={c.width ? { width: c.width } : undefined}>{c.label}</th>
                ))}
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="num"><span className="seedno">{seeded && r.start_no ? r.start_no : i + 1}</span></td>
                  {COLS.map(c => (
                    <td key={c.k}>
                      <input className="cellinput" value={r[c.k] ?? ""} placeholder={c.placeholder}
                             style={c.align === "right" ? { textAlign: "right" } : c.align === "center" ? { textAlign: "center" } : undefined}
                             onChange={e => setCell(i, c.k, e.target.value)} />
                    </td>
                  ))}
                  <td className="ctr">
                    <button className="iconbtn" title="Remove row" onClick={() => delRow(i)}>
                      <Icon name="close" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-foot">
        <Button variant="primary" icon="check" disabled={busy} onClick={save}>Save players</Button>
        <Button icon="swap" disabled={busy || !seeded} onClick={onGenerate}
                title={seeded ? "" : "Save players first"}>Generate round 1</Button>
        <span className="spacer" />
        <span className="hint">{named.length} of {rows.length} rows have a name</span>
      </div>
    </div>
  );
}
