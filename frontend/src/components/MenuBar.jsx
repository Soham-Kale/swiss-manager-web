import React, { useState, useRef, useEffect } from "react";

// Menu structure mirrors Swiss-Manager. Items with an `action` are wired; the
// rest are shown (faithful to the real menu) but inert in this build.
const MENUS = [
  ["File", [
    { label: "New tournament…", acc: "Ctrl+N", action: "new" },
    { label: "Load tournament…", acc: "F3", action: "open" },
    { label: "Save tournament", acc: "Ctrl+S" },
    { sep: true },
    { label: "Import FIDE Data Format TRF16" },
    { label: "XML-Import" },
    { label: "XML-Export" },
    { sep: true },
    { label: "Export TRF…", action: "export" },
    { label: "Exit" },
  ]],
  ["Input", [
    { label: "Enter players…", action: "players" },
    { label: "Tournament data…", action: "players" },
  ]],
  ["Pairings", [
    { label: "Pairings / Results (current round)", action: "pairings" },
    { label: "Generate next round", action: "generate" },
  ]],
  ["Reports", [{ label: "Startrank list", action: "players" }, { label: "Ranking crosstable", action: "standings" }]],
  ["Output", [{ label: "Export TRF…", action: "export" }]],
  ["Round", [
    { label: "Enter results…", action: "results" },
    { label: "Next round", action: "generate" },
  ]],
  ["Lists", [{ label: "Ranking", action: "standings" }, { label: "Players", action: "players" }]],
  ["Other", [{ label: "Install…" }]],
  ["Rating Lists", [{ label: "FIDE" }]],
  ["Internet", [{ label: "Upload to chess-results" }]],
  ["Windows", [{ label: "Cascade" }]],
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
                       onClick={() => { if (it.action) { onAction(it.action); } setOpen(null); }}>
                    <span>{it.label}</span>{it.acc && <span className="acc">{it.acc}</span>}
                  </div>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
