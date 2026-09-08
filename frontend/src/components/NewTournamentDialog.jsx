import React, { useState } from "react";
import { api } from "../api.js";

const TYPES = [
  "Swiss System", "Swiss System with Team Tiebreak", "Swiss System for Teams",
  "Round Robin", "Round Robin for Teams", "KO-System", "KO-System for Teams",
];

// Exact Swiss-Manager "Available Tiebreaks" list (with SM codes).
const AVAILABLE_TB = [
  "Points (game points) [1]",
  "Manually input in field rankcorr. in player dialog [5]",
  "Sum of the ratings of the opponents (without one result) [23]",
  "Match Points (variable) [44]",
  "Recursive rating performance [54]",
  "Performance (variable with parameter) [60]",
  "Aranz System (Win: 1 / Draw: 0.6 black, 0.4 white / lost: 0) [61]",
  "Games descending (more is better) [65]",
  "Greater number of victories/games (WIN,WON,BPG,BWG) [68]",
  "Special Gamepoints for white and black [76]",
  "Average of Opponents' Buchholz (AOB) [77]",
  "Rounds Elected to Play (REP) [79]",
  "Average Rating of Opponents (ARO) [80]",
  "Direct Encounter [DE] [81]",
  "Buchholz Tie-Break Variable (2023) [84]",
  "Sonneborn Berger Tie-Break Variable (2023) [85]",
  "FIDE Tiebreak (Progressive Score) [86]",
  "Koya System [KS] [87]",
  "Performance Tie-Breaks (TPR, APRO, PTP, APPO) [88]",
];
const DEFAULT_TB = [
  "Buchholz Tie-Break Variable (2023) [84]",
  "Direct Encounter [DE] [81]",
  "Greater number of victories/games (WIN,WON,BPG,BWG) [68]",
  "Sonneborn Berger Tie-Break Variable (2023) [85]",
];
const TABS = ["General", "Tiebreaks", "Lists", "Board List", "FIDE Title", "Other", "Arbiter"];

export default function NewTournamentDialog({ onCreated, onCancel, notify, initial }) {
  const editing = !!initial;
  const [step, setStep] = useState(editing ? "data" : "type");
  const [type, setType] = useState("Swiss System");
  const [tab, setTab] = useState("General");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "", remarks: "", organizer: "", website: "", email: "", time_control: "",
    director: "", chief_arbiter: "", deputy_arbiter: "", arbiter: "", federation: "",
    city: "", rounds: 9, age_groups: "U08,U10,U12,U14,U16,U18,U20,S50,S65",
    date_from: today(), date_to: today(), cutoff: "2026-01-01", rtg_min: 1000,
    replays: 1, bye_points: 1, sorting: "National rating", first_board_white: true,
    pairings_by: "Game points (1, ½, 0)", rated_fide: "No", rated_national: "No",
    time_type: "Standard", tourn_type: "Real tournament",
    pairing_engine: "dutch", tiebreaks: DEFAULT_TB,
    ...(initial || {}),
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const create = async () => {
    if (!f.name.trim()) { setTab("General"); return notify("Enter a tournament name", true); }
    setBusy(true);
    const payload = {
      name: f.name, rounds: +f.rounds, organizer: f.organizer, director: f.director,
      chief_arbiter: f.chief_arbiter, deputy_arbiter: f.deputy_arbiter, arbiter: f.arbiter,
      city: f.city, federation: f.federation, website: f.website, time_control: f.time_control,
      date_from: f.date_from, date_to: f.date_to, first_board_white: f.first_board_white,
      pairing_engine: f.pairing_engine, tiebreaks: f.tiebreaks,
    };
    try {
      if (editing) { await api.updateTournament(initial.id, payload); onCreated(initial.id); }
      else { const { id } = await api.createTournament(payload); onCreated(id); }
    } catch (e) { notify(e.message, true); setBusy(false); }
  };

  const addTb = (tb) => !f.tiebreaks.includes(tb) && set("tiebreaks", [...f.tiebreaks, tb]);
  const rmTb = (tb) => set("tiebreaks", f.tiebreaks.filter(x => x !== tb));
  const moveTb = (i, d) => { const a = [...f.tiebreaks], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set("tiebreaks", a); };

  return (
    <div className="overlay">
      <div className="dialog" style={{ minWidth: step === "data" ? 720 : 440 }}>
        <div className="dtitle">
          <span>{step === "type" ? "Select Tournament Type" : "Tournament Data Dialog (Swiss System)"}</span>
          <span className="linkish" style={{ color: "#fff" }} onClick={onCancel}>✕</span>
        </div>

        {step === "type" && (
          <>
            <div className="dbody">
              <div className="group"><div className="glabel">Tournament Type</div>
                {TYPES.map(t => <label key={t} className="radioline"><input type="radio" checked={type === t} onChange={() => setType(t)} /> {t}</label>)}
              </div>
            </div>
            <div className="dfoot"><button className="btn primary" onClick={() => setStep("data")}>✓ OK</button><button className="btn" onClick={onCancel}>✕ Cancel</button></div>
          </>
        )}

        {step === "data" && (
          <>
            <div className="dbody">
              <div className="tabs">
                {TABS.map(t => <div key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</div>)}
              </div>

              {tab === "General" && (
                <div>
                  <div className="field"><label>Tournament Name</label><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></div>
                  <div className="field"><label>Remarks</label><textarea value={f.remarks} onChange={e => set("remarks", e.target.value)} /></div>
                  <div className="field"><label>Organizer(s)</label><input value={f.organizer} onChange={e => set("organizer", e.target.value)} /></div>
                  <div className="field"><label>Website</label><div className="two"><input style={{ flex: 1 }} value={f.website} onChange={e => set("website", e.target.value)} /><span>Email</span><input style={{ flex: 1 }} value={f.email} onChange={e => set("email", e.target.value)} /></div></div>
                  <div className="field"><label>Time Control</label><input value={f.time_control} onChange={e => set("time_control", e.target.value)} /></div>
                  <div className="field"><label>Tournament Director</label><input value={f.director} onChange={e => set("director", e.target.value)} /></div>
                  <div className="field"><label>Chief Arbiter</label><div className="two"><input style={{ flex: 1 }} value={f.chief_arbiter} onChange={e => set("chief_arbiter", e.target.value)} /><span>Deputy Chief Arbiter</span><input style={{ flex: 1 }} value={f.deputy_arbiter} onChange={e => set("deputy_arbiter", e.target.value)} /></div></div>
                  <div className="field"><label>Arbiter</label><input value={f.arbiter} onChange={e => set("arbiter", e.target.value)} /></div>
                  <div className="field"><label>Federation</label><input value={f.federation} onChange={e => set("federation", e.target.value)} placeholder="e.g. IND" /></div>
                  <div className="field"><label>Location</label><input value={f.city} onChange={e => set("city", e.target.value)} /></div>
                  <div className="field"><label>Rounds</label><input type="number" min="1" style={{ width: 70 }} value={f.rounds} onChange={e => set("rounds", +e.target.value)} /></div>
                  <div className="field"><label>Date from / to</label><div className="two"><input type="date" value={f.date_from} onChange={e => set("date_from", e.target.value)} /><span>to</span><input type="date" value={f.date_to} onChange={e => set("date_to", e.target.value)} /></div></div>
                  <div className="field"><label>Age Groups</label><input value={f.age_groups} onChange={e => set("age_groups", e.target.value)} /></div>
                  <div className="field"><label>Cutoff Date</label><div className="two"><input type="date" value={f.cutoff} onChange={e => set("cutoff", e.target.value)} /><span>Rtg.min for Rtg-Ø</span><input style={{ width: 80 }} value={f.rtg_min} onChange={e => set("rtg_min", e.target.value)} /></div></div>
                  <div className="field"><label>Replays (Double RR=2)</label><input style={{ width: 60 }} value={f.replays} onChange={e => set("replays", e.target.value)} /></div>
                  <div className="field"><label>Points for the Bye Player</label><input style={{ width: 60 }} value={f.bye_points} onChange={e => set("bye_points", e.target.value)} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div className="group"><div className="glabel">Sorting/Display</div>
                      {["National rating", "International rating", "Int. rating then Nat. rating", "Rating maximum (Nat./Int.)", "National rating only", "International rating only"].map(o =>
                        <label key={o} className="radioline"><input type="radio" checked={f.sorting === o} onChange={() => set("sorting", o)} /> {o}</label>)}
                    </div>
                    <div>
                      <div className="group"><div className="glabel">Color for home game</div>
                        <label className="radioline"><input type="radio" checked={f.first_board_white} onChange={() => set("first_board_white", true)} /> White</label>
                        <label className="radioline"><input type="radio" checked={!f.first_board_white} onChange={() => set("first_board_white", false)} /> Black</label>
                      </div>
                      <div className="group"><div className="glabel">Pairings according to</div>
                        {["Game points (1, ½, 0)", "Match points (2, 1, 0)", "Game points (3, 1, 0)"].map(o =>
                          <label key={o} className="radioline"><input type="radio" checked={f.pairings_by === o} onChange={() => set("pairings_by", o)} /> {o}</label>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div className="group"><div className="glabel">Rated FIDE</div>
                      {["Yes", "No"].map(o => <label key={o} className="radioline"><input type="radio" checked={f.rated_fide === o} onChange={() => set("rated_fide", o)} /> {o}</label>)}
                    </div>
                    <div className="group"><div className="glabel">Rated national</div>
                      {["Yes", "No"].map(o => <label key={o} className="radioline"><input type="radio" checked={f.rated_national === o} onChange={() => set("rated_national", o)} /> {o}</label>)}
                    </div>
                    <div className="group"><div className="glabel">Time Control</div>
                      {["Standard", "Rapid", "Blitz"].map(o => <label key={o} className="radioline"><input type="radio" checked={f.time_type === o} onChange={() => set("time_type", o)} /> {o}</label>)}
                    </div>
                  </div>
                  <div className="group"><div className="glabel">Tournament Type</div>
                    {["Real tournament", "Real tournament Online", "Test tournament"].map(o =>
                      <label key={o} className="radioline" style={{ display: "inline-flex", marginRight: 16 }}><input type="radio" checked={f.tourn_type === o} onChange={() => set("tourn_type", o)} /> {o}</label>)}
                  </div>
                  <div className="field"><label>Pairing engine</label>
                    <select value={f.pairing_engine} onChange={e => set("pairing_engine", e.target.value)} style={{ width: 170 }}>
                      <option value="dutch">FIDE Dutch (Gacrux/JaVaFo)</option>
                      <option value="burstein">Burstein</option>
                      <option value="dubov">Dubov</option>
                    </select>
                  </div>
                </div>
              )}

              {tab === "Tiebreaks" && (
                <div>
                  <div className="group"><div className="glabel">Interim/final standing in accordance with this order</div>
                    {f.tiebreaks.length === 0 && <div style={{ color: "#777" }}>None selected.</div>}
                    {f.tiebreaks.map((tb, i) => (
                      <div key={tb} className="radioline" style={{ justifyContent: "space-between" }}>
                        <span>{i + 1}. {tb}</span>
                        <span>
                          <button className="btn" style={{ padding: "0 7px" }} onClick={() => moveTb(i, -1)}>Line-1</button>{" "}
                          <button className="btn" style={{ padding: "0 7px" }} onClick={() => moveTb(i, +1)}>Line+1</button>{" "}
                          <button className="btn" style={{ padding: "0 7px" }} onClick={() => rmTb(tb)}>Remove</button>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="group"><div className="glabel">Available Tiebreaks (double-click to add)</div>
                    <div style={{ maxHeight: 200, overflow: "auto" }}>
                      {AVAILABLE_TB.map(tb => (
                        <div key={tb} className="radioline" style={{ cursor: "pointer", opacity: f.tiebreaks.includes(tb) ? .4 : 1 }}
                             onClick={() => addTb(tb)}>{tb}</div>
                      ))}
                    </div>
                  </div>
                  <p className="hint">Computed in this build: Buchholz, Buchholz Cut-1, Sonneborn-Berger, Number of Wins (FIDE-2026 virtual-opponent). Other codes are selectable for parity; more calculators can be added.</p>
                </div>
              )}

              {tab === "Lists" && (
                <div>
                  <div className="group"><div className="glabel">For Category Prize List</div>
                    <div className="field"><label>Lines per Category</label><input style={{ width: 60 }} defaultValue={8} /></div>
                    <label className="radioline"><input type="checkbox" /> Best female</label>
                    <label className="radioline"><input type="checkbox" /> Best rank improvement</label>
                    <label className="radioline"><input type="checkbox" defaultChecked /> Appropriate to field type</label>
                    <label className="radioline"><input type="checkbox" /> Appropriate to field club name</label>
                  </div>
                  <div className="group"><div className="glabel">Performance rating (Rp)</div>
                    <label className="radioline"><input type="radio" name="rp" defaultChecked /> FIDE rating, national rating, then default value</label>
                    <label className="radioline"><input type="radio" name="rp" /> FIDE rating then default value</label>
                    <label className="radioline"><input type="radio" name="rp" /> Only FIDE rating, other games ignored</label>
                    <div className="field"><label>Default value</label><input style={{ width: 70 }} defaultValue={1400} /></div>
                  </div>
                  <div className="group"><div className="glabel">Team evaluation</div>
                    <div className="field"><label>Players per team</label><input style={{ width: 50 }} defaultValue={3} /></div>
                    <div className="field"><label>Minimum players per team</label><input style={{ width: 50 }} defaultValue={0} /></div>
                  </div>
                  <div className="field"><label>Board offset in pairing list</label><input style={{ width: 50 }} defaultValue={0} /></div>
                </div>
              )}

              {["Board List", "FIDE Title", "Other", "Arbiter"].includes(tab) && (
                <div className="empty" style={{ padding: 30 }}>
                  <b>{tab}</b><br /><span className="hint">Panel present for parity with Swiss-Manager; not needed for pairing/standings in this build.</span>
                </div>
              )}
            </div>
            <div className="dfoot">
              {!editing && <button className="btn" onClick={() => setStep("type")}>◂ Back</button>}
              <button className="btn primary" disabled={busy} onClick={create}>✓ OK</button>
              <button className="btn" onClick={onCancel}>✕ Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function today() { return new Date().toISOString().slice(0, 10); }
