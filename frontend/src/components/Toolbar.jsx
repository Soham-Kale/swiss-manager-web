import React from "react";

// Compact toolbar echoing Swiss-Manager's icon strip. Labels are short glyph-ish
// abbreviations with tooltips.
const BTNS = [
  { t: "New tournament", g: "🗎", action: "new", always: true },
  { t: "Load tournament", g: "📂", action: "open", always: true },
  { t: "Save", g: "💾" },
  { sep: true },
  { t: "Enter players", g: "👤+", action: "players" },
  { t: "Startrank list", g: "≣", action: "players" },
  { sep: true },
  { t: "Generate next round", g: "⇄", action: "generate" },
  { t: "Pairings / Results", g: "1:0", action: "pairings" },
  { t: "Enter results", g: "✎", action: "results" },
  { sep: true },
  { t: "Ranking", g: "🏆", action: "standings" },
  { t: "Export TRF", g: "TRF", action: "export" },
];

export default function Toolbar({ onAction, disabled }) {
  return (
    <div className="toolbar">
      {BTNS.map((b, i) => b.sep
        ? <div key={i} className="tbsep" />
        : <button key={i} className="tbtn" title={b.t}
                  disabled={disabled && !b.always}
                  onClick={() => onAction(b.action)}>{b.g}</button>)}
    </div>
  );
}
