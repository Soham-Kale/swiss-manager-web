import React, { useState, useRef } from "react";
import { api } from "../api.js";

const BLANK = { name: "", rating: "", federation: "", sex: "", title: "", club: "", fide_id: "" };

export default function PlayersWindow({ tournament, onSaved, onClose, onGenerate, notify }) {
  const [rows, setRows] = useState(
    tournament.players.length
      ? tournament.players.map(p => ({ ...p, rating: p.rating || "" }))
      : Array.from({ length: 6 }, () => ({ ...BLANK }))
  );
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const setCell = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, { ...BLANK }]);
  const delRow = (i) => setRows(rs => rs.filter((_, j) => j !== i));

  const save = async () => {
    const players = rows.filter(r => (r.name || "").trim())
      .map(r => ({ name: r.name.trim(), rating: +r.rating || 0, federation: r.federation || "",
                   sex: r.sex || "", title: r.title || "", club: r.club || "", fide_id: r.fide_id || "" }));
    if (!players.length) return notify("Add at least one player", true);
    setBusy(true);
    try {
      const t = await api.setPlayers(tournament.id, players, true); // reseed by rating
      setRows(t.players.map(p => ({ ...p, rating: p.rating || "" })));
      await onSaved(t.id);
      notify(`${players.length} players saved (seeded by rating)`);
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  };

  const doImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setBusy(true);
    try {
      const t = await api.importPlayers(tournament.id, file);
      setRows(t.players.map(p => ({ ...p, rating: p.rating || "" })));
      await onSaved(t.id);
      notify(`Imported ${t.players.length} players`);
    } catch (e) { notify(e.message, true); } finally { setBusy(false); e.target.value = ""; }
  };

  const seeded = tournament.players.length > 0;

  return (
    <div className="window">
      <div className="wtitle">
        <span>Enter players — {tournament.name}</span>
        <span className="btns"><span className="wb" onClick={onClose}>✕</span></span>
      </div>
      <div className="wbody">
        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={addRow}>+ Add row</button>
          <button className="btn" onClick={() => fileRef.current.click()}>Import from Excel / CSV / Chess-Results…</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.json" style={{ display: "none" }} onChange={doImport} />
          <span style={{ color: "#666" }}>Seeding (No.) is assigned automatically by rating when you save.</span>
        </div>

        <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #ccc" }}>
          <table className="grid">
            <thead>
              <tr>
                <th className="num" style={{ width: 44 }}>No.</th>
                <th>Name</th>
                <th style={{ width: 120 }}>FideID</th>
                <th className="ctr" style={{ width: 50 }}>FED</th>
                <th className="num" style={{ width: 60 }}>Rtg</th>
                <th className="ctr" style={{ width: 44 }}>sex</th>
                <th className="ctr" style={{ width: 60 }}>Typ</th>
                <th>Club/City</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="num">{seeded && r.start_no ? r.start_no : i + 1}</td>
                  <td><input style={cell} value={r.name} onChange={e => setCell(i, "name", e.target.value)} placeholder="Lastname, Firstname" /></td>
                  <td><input style={cell} value={r.fide_id || ""} onChange={e => setCell(i, "fide_id", e.target.value)} /></td>
                  <td><input style={{ ...cell, textAlign: "center" }} value={r.federation || ""} onChange={e => setCell(i, "federation", e.target.value)} /></td>
                  <td><input style={{ ...cell, textAlign: "right" }} value={r.rating} onChange={e => setCell(i, "rating", e.target.value)} /></td>
                  <td><input style={{ ...cell, textAlign: "center" }} value={r.sex || ""} onChange={e => setCell(i, "sex", e.target.value)} /></td>
                  <td><input style={{ ...cell, textAlign: "center" }} value={r.title || ""} onChange={e => setCell(i, "title", e.target.value)} /></td>
                  <td><input style={cell} value={r.club || ""} onChange={e => setCell(i, "club", e.target.value)} /></td>
                  <td className="ctr"><span className="linkish" onClick={() => delRow(i)}>✕</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button className="btn primary" disabled={busy} onClick={save}>Save players</button>
          <button className="btn" disabled={busy || !seeded} onClick={onGenerate}
                  title={seeded ? "" : "Save players first"}>Generate Round 1 ▸</button>
          <span style={{ marginLeft: "auto", color: "#555" }}>{rows.filter(r => (r.name || "").trim()).length} players</span>
        </div>
      </div>
    </div>
  );
}

const cell = { width: "100%", border: "1px solid transparent", background: "transparent", padding: "2px 4px" };
