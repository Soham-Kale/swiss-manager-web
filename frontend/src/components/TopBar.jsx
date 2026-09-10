import React from "react";
import { APP_NAME, APP_SHORT } from "../brand.js";
import Icon from "./ui/Icon.jsx";
import Button, { IconButton } from "./ui/Button.jsx";

export default function TopBar({ tournament, onAction, onOpenCommands, theme, onToggleTheme }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">{APP_SHORT}</span>
        <span className="brand-name">{APP_NAME}</span>
      </div>

      <button className="tsel" onClick={() => onAction("open")} title="Switch tournament">
        <Icon name="folder" size={14} />
        <span className={"tsel-name" + (tournament ? "" : " tsel-none")}>
          {tournament ? tournament.name : "No tournament open"}
        </span>
        <Icon name="chevronDown" size={13} />
      </button>

      <Button icon="plus" onClick={() => onAction("new")}>New</Button>

      <div className="spacer" />

      <button className="cmd-trigger" onClick={onOpenCommands}>
        <Icon name="search" size={14} />
        <span>Commands</span>
        <span className="kbd">{isMac ? "⌘K" : "Ctrl K"}</span>
      </button>

      <IconButton icon="download" label="Export TRF" disabled={!tournament}
                  onClick={() => onAction("export")} />
      <IconButton icon={theme === "dark" ? "sun" : "moon"}
                  label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                  onClick={onToggleTheme} />
      <IconButton icon="settings" label="Tournament settings" disabled={!tournament}
                  onClick={() => onAction("setup")} />
    </header>
  );
}
