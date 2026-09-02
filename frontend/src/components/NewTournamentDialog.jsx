import React, { useState } from "react";
import { api } from "../api.js";

const TYPES = [
  "Swiss System", "Swiss System with Team Tiebreak", "Swiss System for Teams",
  "Round Robin", "Round Robin for Teams", "KO-System", "KO-System for Teams",
];

const ALL_TIEBREAKS = [
  "Buchholz", "Buchholz Cut-1", "Sonneborn-Berger", "Direct Encounter",
  "Number of Wins", "Average Rating of Opponents", "Progressive Score",
];

export default function NewTournamentDialog({ onCreated, onCancel, notify }) {
  const [step, setStep] = useState("type");      // type | data
  const [type, setType] = useState("Swiss System");
  const [tab, setTab] = useState("general");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "", organizer: "", website: "", time_control: "", director: "",
    chief_arbiter: "", deputy_arbiter: "", arbiter: "", federation: "", city: "",
    rounds: 7, date_from: today(), date_to: today(), pairing_engine: "dutch",
    first_board_white: true,
    tiebreaks: ["Buchholz", "Buchholz Cut-1", "Sonneborn-Berger", "Direct Encounter", "Number of Wins"],
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const create = async () => {
    if (!f.name.trim()) { setTab("general"); return notify("Enter a tournament name", true); }
    setBusy(true);
    try {
      const { id } = await api.createTournament(f);
      onCreated(id);
    } catch (e) { notify(e.message, true); setBusy(false); }
  };

  const toggleTb = (tb) => set("tiebreaks",
    f.tiebreaks.includes(tb) ? f.tiebreaks.filter(x => x !== tb) : [...f.tiebreaks, tb]);
  const moveTb = (i, dir) => {
    const a = [...f.tiebreaks]; const j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; set("tiebreaks", a);
  };

  return (
    <div className="overlay">
      <div className="dialog" style={{ minWidth: step === "data" ? 640 : 420 }}>
        <div className="dtitle">
          <span>{step === "type" ? "Select Tournament Type" : "Tournament Data Dialog (Swiss System)"}</span>
          <span className="linkish" style={{ color: "#fff" }} onClick={onCancel}>✕</span>
        </div>

        {step === "type" && (
          <>
            <div className="dbody">
              <div className="group">
                <div className="glabel">Tournament Type</div>
                {TYPES.map((t) => (
                  <label key={t} className="radioline">
                    <input type="radio" name="ttype" checked={type === t} onChange={() => setType(t)} /> {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="dfoot">
              <button className="btn primary" onClick={() => setStep("data")}>OK</button>
              <button className="btn" onClick={onCancel}>Cancel</button>
            </div>
          </>
        )}

        {step === "data" && (
          <>
            <div className="dbody">
              <div className="tabs">
                <div className={"tab" + (tab === "general" ? " active" : "")} onClick={() => setTab("general")}>General</div>
                <div className={"tab" + (tab === "tiebreaks" ? " active" : "")} onClick={() => setTab("tiebreaks")}>Tiebreaks</div>
              </div>

              {tab === "general" && (
                <div>
                  <div className="field"><label>Tournament Name</label><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></div>
                  <div className="field"><label>Organizer(s)</label><input value={f.organizer} onChange={e => set("organizer", e.target.value)} /></div>
                  <div className="field"><label>Website</label><input value={f.website} onChange={e => set("website", e.target.value)} /></div>
                  <div className="field"><label>Time Control</label><input value={f.time_control} onChange={e => set("time_control", e.target.value)} /></div>
                  <div className="field"><label>Tournament Director</label><input value={f.director} onChange={e => set("director", e.target.value)} /></div>
                  <div className="field"><label>Chief Arbiter</label><input value={f.chief_arbiter} onChange={e => set("chief_arbiter", e.target.value)} /></div>
                  <div className="field"><label>Deputy Chief Arbiter</label><input value={f.deputy_arbiter} onChange={e => set("deputy_arbiter", e.target.value)} /></div>
                  <div className="field"><label>Arbiter</label><input value={f.arbiter} onChange={e => set("arbiter", e.target.value)} /></div>
                  <div className="field"><label>Federation</label><input value={f.federation} onChange={e => set("federation", e.target.value)} placeholder="e.g. IND" /></div>
                  <div className="field"><label>Location</label><input value={f.city} onChange={e => set("city", e.target.value)} /></div>
                  <div className="field"><label>Rounds</label><input type="number" min="1" style={{ width: 80 }} value={f.rounds} onChange={e => set("rounds", +e.target.value)} /></div>
                  <div className="field"><label>Date from / to</label>
                    <div className="two">
                      <input type="date" value={f.date_from} onChange={e => set("date_from", e.target.value)} />
                      <input type="date" value={f.date_to} onChange={e => set("date_to", e.target.value)} />
                    </div>
                  </div>
                  <div className="group">
                    <div className="glabel">Color for home game (board 1)</div>
                    <label className="radioline"><input type="radio" checked={f.first_board_white} onChange={() => set("first_board_white", true)} /> White</label>
                    <label className="radioline"><input type="radio" checked={!f.first_board_white} onChange={() => set("first_board_white", false)} /> Black</label>
                  </div>
                  <div className="field"><label>Pairing engine</label>
                    <select value={f.pairing_engine} onChange={e => set("pairing_engine", e.target.value)} style={{ width: 160 }}>
                      <option value="dutch">Dutch (FIDE)</option>
                      <option value="burstein">Burstein</option>
                      <option value="dubov">Dubov</option>
                    </select>
                  </div>
                </div>
              )}

              {tab === "tiebreaks" && (
                <div>
                  <div className="group">
                    <div className="glabel">Interim/final standing — in this order (top first)</div>
                    {f.tiebreaks.length === 0 && <div style={{ color: "#777" }}>None selected. Add from the list below.</div>}
                    {f.tiebreaks.map((tb, i) => (
                      <div key={tb} className="radioline" style={{ justifyContent: "space-between" }}>
                        <span>{i + 1}. {tb}</span>
                        <span>
                          <button className="btn" style={{ padding: "1px 7px" }} onClick={() => moveTb(i, -1)}>↑</button>{" "}
                          <button className="btn" style={{ padding: "1px 7px" }} onClick={() => moveTb(i, +1)}>↓</button>{" "}
                          <button className="btn" style={{ padding: "1px 7px" }} onClick={() => toggleTb(tb)}>✕</button>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="group">
                    <div className="glabel">Available tiebreaks</div>
                    {ALL_TIEBREAKS.filter(tb => !f.tiebreaks.includes(tb)).map(tb => (
                      <label key={tb} className="radioline">
                        <input type="checkbox" checked={false} onChange={() => toggleTb(tb)} /> {tb}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="dfoot">
              <button className="btn" onClick={() => setStep("type")}>◂ Back</button>
              <button className="btn primary" disabled={busy} onClick={create}>OK</button>
              <button className="btn" onClick={onCancel}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function today() { return new Date().toISOString().slice(0, 10); }
