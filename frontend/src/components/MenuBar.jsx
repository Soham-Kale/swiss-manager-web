import React, { useState, useRef, useEffect } from "react";

// Menus mirror Swiss-Manager exactly (see reference screenshots). Items with an
// `action` are wired; the rest are shown faithfully but disabled (grey), just as
// Swiss-Manager greys out items that don't yet apply.
const MENUS = [
  ["File", [
    { label: "New tournament...", acc: "Strg+N", action: "new" },
    { label: "Load tournament...", acc: "F3", action: "open" },
    { label: "Save tournament", acc: "Strg+S" },
    { label: "Save tournament as..." },
    { label: "Merge tournament" },
    { label: "Backup tournament" },
    { sep: true },
    { label: "Import FIDE Data Format TRF16" },
    { label: "XML-Import ▸" },
    { label: "XML-Export ▸" },
    { label: "Export TRF...", action: "export" },
    { label: "Import PGN-File" },
    { label: "Import PGN-File (Results)" },
    { sep: true },
    { label: "Notepad..." },
    { label: "Printer setup..." },
    { label: "Last tournaments read ▸" },
    { sep: true },
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
    { sep: true },
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
    { sep: true },
    { label: "Players", acc: "F11", action: "players" },
    { label: "Byes" },
    { label: "Exclusions" },
    { sep: true },
    { label: "Title statistics" },
    { label: "Federation statistics" },
    { label: "Game statistics" },
    { sep: true },
    { label: "Rating statistics FIDE" },
    { label: "FIDE title info" },
    { label: "FIDE Tournament Report - IT3" },
    { label: "FA Norm Report - FA1" },
    { label: "IA Norm Report - IA1" },
  ]],
  ["Output", [
    { label: "✓ Screen", acc: "Umsch+F2" },
    { label: "Printer", acc: "F2" },
    { label: "File", acc: "Umsch+F3" },
    { sep: true },
    { label: "✓ Print parameters" },
    { label: "Output several lists" },
  ]],
  ["Round", [
    { label: "Select round ▸", action: "rounds" },
  ]],
  ["Lists", [
    { label: "Alphabetical", action: "list:alphabetical" },
    { label: "Starting rank", acc: "Strg+B", action: "list:startrank" },
    { label: "Standings", acc: "F5", action: "standings" },
    { sep: true },
    { label: "Pairings", acc: "F10", action: "pairings" },
    { label: "Results", acc: "F9", action: "pairings" },
    { sep: true },
    { label: "Starting rank crosstable", action: "list:startcross" },
    { label: "Ranking crosstable", action: "list:rankcross" },
    { sep: true },
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
    { label: "Swiss-Manager Homepage" },
    { label: "Chess-Results.com Homepage" },
    { label: "✓ Restrict tournament upload to file creator" },
    { label: "Upload tournament to Chess-Results.com" },
    { label: "Download tournament from Chess-Results.com" },
    { label: "Check for Swiss-Manager Update" },
  ]],
  ["Windows", [{ label: "Cascade" }, { label: "Tile" }]],
  ["Help", [{ label: "About Swiss-Manager (Web)" }]],
];

export default function MenuBar({ onAction }) {
  const [open, setOpen] = useState(null);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="menubar" ref={ref}>
      {MENUS.map(([name, items]) => (
        <div key={name} className={"item" + (open === name ? " open" : "")}
             onClick={() => setOpen(open === name ? null : name)}
             onMouseEnter={() => open && setOpen(name)}>
          {name}
          {open === name && (
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              {items.map((it, i) => it.sep
                ? <div key={i} className="sep" />
                : <div key={i} className={"row" + (it.action ? "" : " disabled")}
                       onClick={() => { if (it.action) onAction(it.action); setOpen(null); }}>
                    <span>{it.label}</span>{it.acc && <span className="acc">{it.acc}</span>}
                  </div>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
