import React, { useState, useEffect, useMemo, useRef } from "react";
import Icon from "./ui/Icon.jsx";

// The complete command set, grouped. Items with an `action` are wired; the rest
// are listed and greyed out because they aren't implemented yet.
const MENUS = [
  ["File", [
    { label: "New tournament...", acc: "Strg+N", action: "new" },
    { label: "Load tournament...", acc: "F3", action: "open" },
    { label: "Save tournament", acc: "Strg+S" },
    { label: "Save tournament as..." },
    { label: "Merge tournament" },
    { label: "Backup tournament" },
    { label: "Import FIDE Data Format TRF16" },
    { label: "XML-Import" },
    { label: "XML-Export" },
    { label: "Export TRF...", action: "export" },
    { label: "Import PGN-File" },
    { label: "Import PGN-File (Results)" },
    { label: "Notepad..." },
    { label: "Printer setup..." },
    { label: "Last tournaments read" },
    { label: "Exit" },
  ]],
  ["Input", [
    { label: "Enter players...", action: "players" },
    { label: "Update players...", acc: "Strg+F6", action: "players" },
    { label: "Enter results...", acc: "F7", action: "results" },
    { label: "Set up tournament...", action: "setup" },
    { label: "Enter teams..." },
    { label: "Enter round dates and times..." },
    { label: "Enter dates for player pairings..." },
    { label: "Resort starting rank list", action: "resort" },
    { label: "Resort pairing list" },
    { label: "Remove players" },
  ]],
  ["Pairings", [
    { label: "Computer pairings...", acc: "F6", action: "computerPairings" },
    { label: "Set new player..." },
    { label: "Manual pairings..." },
    { label: "Exclude player...", action: "exclude" },
    { label: "Give player bye", action: "givebye" },
    { label: "Reactivate player...", action: "reactivate" },
    { label: "Forbidden pairings..." },
  ]],
  ["Reports", [
    { label: "Rating list(s)...", acc: "F4" },
    { label: "Tournament status", action: "status" },
    { label: "Players", acc: "F11", action: "players" },
    { label: "Byes" },
    { label: "Exclusions" },
    { label: "Title statistics" },
    { label: "Federation statistics" },
    { label: "Game statistics" },
    { label: "Rating statistics FIDE" },
    { label: "FIDE title info" },
    { label: "FIDE Tournament Report - IT3" },
    { label: "FA Norm Report - FA1" },
    { label: "IA Norm Report - IA1" },
  ]],
  ["Output", [
    { label: "Screen", acc: "Umsch+F2" },
    { label: "Printer", acc: "F2" },
    { label: "File", acc: "Umsch+F3" },
    { label: "Print parameters" },
    { label: "Output several lists" },
  ]],
  ["Round", [
    { label: "Select round", action: "rounds" },
  ]],
  ["Lists", [
    { label: "Alphabetical", action: "list:alphabetical" },
    { label: "Starting rank", acc: "Strg+B", action: "list:startrank" },
    { label: "Standings", acc: "F5", action: "standings" },
    { label: "Pairings", acc: "F10", action: "pairings" },
    { label: "Results", acc: "F9", action: "pairings" },
    { label: "Starting rank crosstable", action: "list:startcross" },
    { label: "Ranking crosstable", action: "list:rankcross" },
    { label: "Match cards" },
    { label: "Match cards (Excel)" },
    { label: "Category prizes" },
    { label: "Board", acc: "F8" },
    { label: "Pairings checklist", acc: "Umsch+F12" },
    { label: "FIDE..." },
  ]],
  ["Other", [{ label: "Install..." }]],
  ["Rating Lists", [
    { label: "Import rating lists" },
    { label: "Update FIDE rating list" },
    { label: "Update IND rating list" },
  ]],
  ["Internet", [
    { label: "Restrict tournament upload to file creator" },
    { label: "Upload tournament" },
    { label: "Download tournament" },
    { label: "Check for update" },
  ]],
  ["Windows", [{ label: "Cascade" }, { label: "Tile" }]],
  ["Help", [{ label: "About" }]],
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function CommandMenu({ onAction, onClose }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);

  // Flatten to a single navigable list, preserving group order.
  const flat = useMemo(() => {
    const nq = norm(q);
    const out = [];
    for (const [group, items] of MENUS) {
      const hits = items.filter((it) => !nq || norm(it.label).includes(nq) || norm(group).includes(nq));
      if (hits.length) out.push({ group }, ...hits.map((it) => ({ ...it, group })));
    }
    return out;
  }, [q]);

  const runnable = flat.filter((r) => r.action);
  useEffect(() => { setCursor(0); }, [q]);

  const move = (d) => {
    if (!runnable.length) return;
    setCursor((c) => (c + d + runnable.length) % runnable.length);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = runnable[cursor];
      if (pick) { onAction(pick.action); onClose(); }
    } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  useEffect(() => {
    listRef.current?.querySelector(".cmdk-row.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let runIdx = -1;

  return (
    <div className="cmd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command menu">
        <input className="cmdk-input" autoFocus placeholder="Search commands…"
               value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        <div className="cmdk-list" ref={listRef}>
          {flat.length === 0 && <div className="cmdk-empty">No commands match “{q}”.</div>}
          {flat.map((row, i) => {
            if (row.group && !row.label) return <div key={"g" + i} className="cmdk-group">{row.group}</div>;
            const enabled = !!row.action;
            if (enabled) runIdx += 1;
            const myIdx = runIdx;              // capture per-row; runIdx keeps moving
            const on = enabled && myIdx === cursor;
            return (
              <div key={i}
                   className={"cmdk-row" + (on ? " on" : "") + (enabled ? "" : " disabled")}
                   onMouseEnter={() => { if (enabled) setCursor(myIdx); }}
                   onClick={() => { if (enabled) { onAction(row.action); onClose(); } }}>
                <span>{row.label}</span>
                {row.acc && <span className="acc">{row.acc}</span>}
              </div>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <Icon name="search" size={12} />
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> run</span>
          <span><span className="kbd">Esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
