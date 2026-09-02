import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function OpenDialog({ onOpen, onCancel }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.listTournaments().then(setList).catch(() => setList([])); }, []);
  return (
    <div className="overlay">
      <div className="dialog" style={{ minWidth: 520 }}>
        <div className="dtitle"><span>Load tournament</span><span className="linkish" style={{ color: "#fff" }} onClick={onCancel}>✕</span></div>
        <div className="dbody">
          {!list ? "Loading…" : list.length === 0 ? <div style={{ color: "#666" }}>No tournaments yet. Create one first.</div> : (
            <table className="grid">
              <thead><tr><th style={{ width: 40 }}>ID</th><th>Name</th><th style={{ width: 60 }}>Rds</th><th>City</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.map(t => (
                  <tr key={t.id}>
                    <td className="num">{t.id}</td><td>{t.name}</td><td className="num">{t.rounds}</td>
                    <td>{t.city}</td><td>{t.status}</td>
                    <td><button className="btn" onClick={() => onOpen(t.id)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="dfoot"><button className="btn" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  );
}
