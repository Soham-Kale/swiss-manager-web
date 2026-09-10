import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

export default function OpenDialog({ onOpen, onCancel }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => { api.listTournaments().then(setList).catch(() => setList([])); }, []);

  const shown = (list || []).filter(t =>
    !q || `${t.name} ${t.city || ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title="Load tournament" onClose={onCancel} width={620}
           footer={<Button onClick={onCancel}>Cancel</Button>}>
      <input placeholder="Search tournaments…" value={q} onChange={e => setQ(e.target.value)}
             style={{ width: "100%", marginBottom: "var(--s4)" }} />

      {!list ? (
        <div className="empty">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="empty">{list.length ? `Nothing matches “${q}”.` : "No tournaments yet — create one first."}</div>
      ) : (
        <div className="tablewrap short">
          <table className="grid">
            <thead>
              <tr>
                <th className="num" style={{ width: 48 }}>ID</th>
                <th>Name</th>
                <th className="num" style={{ width: 60 }}>Rds</th>
                <th>City</th>
                <th style={{ width: 92 }}>Status</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {shown.map(t => (
                <tr key={t.id}>
                  <td className="num">{t.id}</td>
                  <td style={{ fontWeight: 560 }}>{t.name}</td>
                  <td className="num">{t.rounds}</td>
                  <td>{t.city}</td>
                  <td>
                    <span className={"pill " + (t.status === "finished" ? "ok" : t.status === "running" ? "accent" : "")}>
                      <i className="dot" />{t.status}
                    </span>
                  </td>
                  <td><Button size="sm" variant="primary" onClick={() => onOpen(t.id)}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
