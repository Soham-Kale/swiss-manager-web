import React from "react";
import Icon from "./ui/Icon.jsx";

/**
 * Primary navigation: the tournament workflow, in order, with live state.
 * `view` is the active content view; `onAction` reuses App's action contract.
 */
export default function Sidebar({ tournament, view, onAction }) {
  const players = tournament?.players?.length || 0;
  const roundsGenerated = tournament?.rounds?.length || 0;
  const roundsDone = tournament?.rounds?.filter((r) => r.finalized).length || 0;
  const total = tournament?.total_rounds || 0;
  const openRound = tournament?.rounds?.find((r) => !r.finalized);

  const steps = [
    {
      key: "setup", icon: "settings", label: "Setup", action: "setup",
      enabled: !!tournament, done: !!tournament,
    },
    {
      key: "players", icon: "users", label: "Players", action: "players",
      enabled: !!tournament, done: players > 0,
      badge: players || null,
    },
    {
      key: "pairings", icon: "swap", label: "Pairings", action: "pairings",
      enabled: players > 0, done: roundsGenerated > 0,
      badge: roundsGenerated || null,
    },
    {
      key: "results", icon: "edit", label: "Results", action: "results",
      enabled: roundsGenerated > 0, done: roundsDone > 0 && !openRound,
      badge: openRound ? `R${openRound.number}` : null,
      badgeTone: openRound ? "warn" : "",
    },
    {
      key: "standings", icon: "trophy", label: "Standings", action: "standings",
      enabled: roundsDone > 0, done: false,
    },
    {
      key: "list", icon: "list", label: "Lists & crosstables", action: "list:startrank",
      enabled: players > 0, done: false,
    },
  ];

  return (
    <nav className="sidebar" aria-label="Tournament workflow">
      <div className="side-label">Workflow</div>

      {steps.map((s) => (
        <button key={s.key}
                className={"nav-item" + (view === s.key ? " active" : "")}
                disabled={!s.enabled}
                onClick={() => onAction(s.action)}>
          <span className="ico"><Icon name={s.icon} size={16} /></span>
          <span className="lbl">{s.label}</span>
          {s.badge != null
            ? <span className={"badge " + (s.badgeTone || "")}>{s.badge}</span>
            : s.done ? <span className="badge ok"><Icon name="check" size={11} strokeWidth={2.6} /></span> : null}
        </button>
      ))}

      {tournament && total > 0 && (
        <div className="side-progress">
          <div className="pl">
            <span>Progress</span>
            <span>{roundsDone} / {total}</span>
          </div>
          <div className="track" role="progressbar" aria-valuenow={roundsDone} aria-valuemin={0} aria-valuemax={total}>
            <i style={{ width: `${Math.min(100, (roundsDone / total) * 100)}%` }} />
          </div>
        </div>
      )}
    </nav>
  );
}
