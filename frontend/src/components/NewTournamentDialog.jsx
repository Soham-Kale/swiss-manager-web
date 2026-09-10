import React, { useState } from "react";
import { api } from "../api.js";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import Icon from "./ui/Icon.jsx";
import Field, { RadioGroup } from "./ui/Field.jsx";

const TYPES = [
  "Swiss System", "Swiss System with Team Tiebreak", "Swiss System for Teams",
];

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

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULTS = {
  name: "", remarks: "", organizer: "", website: "", email: "", time_control: "",
  director: "", chief_arbiter: "", deputy_arbiter: "", arbiter: "", federation: "",
  city: "", rounds: 9, age_groups: "U08,U10,U12,U14,U16,U18,U20,S50,S65",
  date_from: today(), date_to: today(), cutoff: "2026-01-01", rtg_min: 1000,
  replays: 1, bye_points: 1, sorting: "National rating", first_board_white: true,
  pairings_by: "Game points (1, ½, 0)", rated_fide: "No", rated_national: "No",
  time_type: "Standard", tourn_type: "Real tournament",
  pairing_engine: "dutch", tiebreaks: DEFAULT_TB,
};

/**
 * Seed the form from an existing tournament.
 *
 * Only known form fields are copied. Spreading the whole DTO would also pull in
 * `rounds` — which the API sends as the array of played rounds, not the
 * scheduled count — and `+[…]` is NaN, which serializes to null and violates the
 * NOT NULL constraint on save. The scheduled count lives in `total_rounds`.
 */
function seedFrom(initial) {
  if (!initial) return { ...DEFAULTS };
  const f = { ...DEFAULTS };
  for (const k of ["name", "organizer", "website", "time_control", "director",
                   "chief_arbiter", "deputy_arbiter", "arbiter", "federation", "city",
                   "date_from", "date_to", "pairing_engine"]) {
    if (initial[k] != null && initial[k] !== "") f[k] = initial[k];
  }
  if (typeof initial.first_board_white === "boolean") f.first_board_white = initial.first_board_white;
  if (Array.isArray(initial.tiebreaks) && initial.tiebreaks.length) f.tiebreaks = initial.tiebreaks;
  const total = Number(initial.total_rounds);
  if (Number.isFinite(total) && total > 0) f.rounds = total;
  return f;
}

export default function NewTournamentDialog({ onCreated, onCancel, notify, initial }) {
  const editing = !!initial;
  const [step, setStep] = useState(editing ? "data" : "type");
  const [type, setType] = useState("Swiss System");
  const [tab, setTab] = useState("General");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => seedFrom(initial));
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!f.name.trim()) { setTab("General"); return notify("Enter a tournament name", true); }
    const rounds = Number(f.rounds);
    if (!Number.isFinite(rounds) || rounds < 1) { setTab("General"); return notify("Rounds must be at least 1", true); }
    setBusy(true);
    const payload = {
      name: f.name, rounds, organizer: f.organizer, director: f.director,
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
  const moveTb = (i, d) => {
    const a = [...f.tiebreaks], j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set("tiebreaks", a);
  };

  // ---- step 1: tournament type ----
  if (step === "type") {
    return (
      <Modal title="Select tournament type" onClose={onCancel} width={460}
        footer={<>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => setStep("data")}>Continue</Button>
        </>}>
        <RadioGroup label="Tournament type" name="ttype" options={TYPES} value={type} onChange={setType} />
        <p className="hint">Pairing and standings in this build are implemented for the Swiss system.</p>
      </Modal>
    );
  }

  // ---- step 2: tournament data ----
  return (
    <Modal title={editing ? "Tournament settings" : "New tournament"} onClose={onCancel} width={760}
      footer={<>
        {!editing && <Button onClick={() => setStep("type")}>Back</Button>}
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={busy} onClick={submit}>
          {editing ? "Save changes" : "Create tournament"}
        </Button>
      </>}>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "General" && (
        <div>
          <Field label="Tournament name">
            <input style={{ width: "100%" }} value={f.name} autoFocus
                   onChange={e => set("name", e.target.value)} placeholder="e.g. City Open 2026" />
          </Field>
          <Field label="Remarks">
            <textarea value={f.remarks} onChange={e => set("remarks", e.target.value)} />
          </Field>
          <Field label="Organizer(s)">
            <input style={{ width: "100%" }} value={f.organizer} onChange={e => set("organizer", e.target.value)} />
          </Field>
          <Field label="Website / email">
            <div className="two">
              <input style={{ flex: 1 }} value={f.website} onChange={e => set("website", e.target.value)} />
              <input style={{ flex: 1 }} value={f.email} onChange={e => set("email", e.target.value)} placeholder="email" />
            </div>
          </Field>
          <Field label="Time control">
            <input style={{ width: "100%" }} value={f.time_control} onChange={e => set("time_control", e.target.value)} />
          </Field>
          <Field label="Tournament director">
            <input style={{ width: "100%" }} value={f.director} onChange={e => set("director", e.target.value)} />
          </Field>
          <Field label="Chief arbiter / deputy">
            <div className="two">
              <input style={{ flex: 1 }} value={f.chief_arbiter} onChange={e => set("chief_arbiter", e.target.value)} />
              <input style={{ flex: 1 }} value={f.deputy_arbiter} onChange={e => set("deputy_arbiter", e.target.value)} placeholder="deputy" />
            </div>
          </Field>
          <Field label="Arbiter">
            <input style={{ width: "100%" }} value={f.arbiter} onChange={e => set("arbiter", e.target.value)} />
          </Field>
          <Field label="Federation">
            <input style={{ width: 140 }} value={f.federation} onChange={e => set("federation", e.target.value)} placeholder="e.g. IND" />
          </Field>
          <Field label="Location">
            <input style={{ width: "100%" }} value={f.city} onChange={e => set("city", e.target.value)} />
          </Field>
          <Field label="Rounds">
            <input type="number" min="1" style={{ width: 90 }} value={f.rounds}
                   onChange={e => set("rounds", e.target.value)} />
          </Field>
          <Field label="Date from / to">
            <div className="two">
              <input type="date" value={f.date_from} onChange={e => set("date_from", e.target.value)} />
              <span>to</span>
              <input type="date" value={f.date_to} onChange={e => set("date_to", e.target.value)} />
            </div>
          </Field>
          <Field label="Age groups">
            <input style={{ width: "100%" }} value={f.age_groups} onChange={e => set("age_groups", e.target.value)} />
          </Field>
          <Field label="Cutoff / min. rating">
            <div className="two">
              <input type="date" value={f.cutoff} onChange={e => set("cutoff", e.target.value)} />
              <input style={{ width: 100 }} value={f.rtg_min} onChange={e => set("rtg_min", e.target.value)} />
            </div>
          </Field>
          <Field label="Replays / bye points">
            <div className="two">
              <input style={{ width: 80 }} value={f.replays} onChange={e => set("replays", e.target.value)} />
              <input style={{ width: 80 }} value={f.bye_points} onChange={e => set("bye_points", e.target.value)} />
            </div>
          </Field>
          <Field label="Pairing engine">
            <select style={{ width: 220 }} value={f.pairing_engine} onChange={e => set("pairing_engine", e.target.value)}>
              <option value="dutch">FIDE Dutch</option>
              <option value="burstein">Burstein</option>
              <option value="dubov">Dubov</option>
            </select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s3)" }}>
            <RadioGroup label="Sorting / display" name="sorting" value={f.sorting}
                        onChange={v => set("sorting", v)}
                        options={["National rating", "International rating", "Int. rating then Nat. rating",
                                  "Rating maximum (Nat./Int.)", "National rating only", "International rating only"]} />
            <div>
              <RadioGroup label="Colour for home game" name="fbw"
                          options={[[true, "White"], [false, "Black"]]}
                          value={f.first_board_white} onChange={v => set("first_board_white", v)} />
              <RadioGroup label="Pairings according to" name="pby" value={f.pairings_by}
                          onChange={v => set("pairings_by", v)}
                          options={["Game points (1, ½, 0)", "Match points (2, 1, 0)", "Game points (3, 1, 0)"]} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--s3)" }}>
            <RadioGroup label="Rated FIDE" name="rf" options={["Yes", "No"]}
                        value={f.rated_fide} onChange={v => set("rated_fide", v)} />
            <RadioGroup label="Rated national" name="rn" options={["Yes", "No"]}
                        value={f.rated_national} onChange={v => set("rated_national", v)} />
            <RadioGroup label="Time control" name="tt" options={["Standard", "Rapid", "Blitz"]}
                        value={f.time_type} onChange={v => set("time_type", v)} />
          </div>
          <RadioGroup label="Tournament type" name="tty"
                      options={["Real tournament", "Real tournament Online", "Test tournament"]}
                      value={f.tourn_type} onChange={v => set("tourn_type", v)} />
        </div>
      )}

      {tab === "Tiebreaks" && (
        <div>
          <div className="group">
            <div className="glabel">Applied in this order</div>
            {f.tiebreaks.length === 0 && <div className="hint">None selected.</div>}
            {f.tiebreaks.map((tb, i) => (
              <div key={tb} className="radioline" style={{ justifyContent: "space-between", gap: "var(--s3)" }}>
                <span><span className="seedno">{i + 1}</span> {tb}</span>
                <span style={{ display: "flex", gap: 4, flex: "none" }}>
                  <Button size="sm" onClick={() => moveTb(i, -1)} disabled={i === 0}>↑</Button>
                  <Button size="sm" onClick={() => moveTb(i, +1)} disabled={i === f.tiebreaks.length - 1}>↓</Button>
                  <Button size="sm" onClick={() => rmTb(tb)}>Remove</Button>
                </span>
              </div>
            ))}
          </div>
          <div className="group">
            <div className="glabel">Available tiebreaks — click to add</div>
            <div style={{ maxHeight: 220, overflow: "auto" }}>
              {AVAILABLE_TB.map(tb => {
                const added = f.tiebreaks.includes(tb);
                return (
                  <div key={tb} className="radioline"
                       style={{ cursor: added ? "default" : "pointer", opacity: added ? .45 : 1 }}
                       onClick={() => addTb(tb)}>
                    <Icon name={added ? "check" : "plus"} size={13} />
                    <span>{tb}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="hint">
            Computed in this build: Buchholz, Buchholz Cut-1, Sonneborn-Berger and number of
            wins (FIDE-2026 virtual-opponent method). Others can be selected and ordered here;
            they are ignored in the standings until a calculator exists.
          </p>
        </div>
      )}

      {tab === "Lists" && (
        <div>
          <div className="group">
            <div className="glabel">Category prize list</div>
            <Field label="Lines per category"><input style={{ width: 80 }} defaultValue={8} /></Field>
            <label className="radioline"><input type="checkbox" /><span>Best female</span></label>
            <label className="radioline"><input type="checkbox" /><span>Best rank improvement</span></label>
            <label className="radioline"><input type="checkbox" defaultChecked /><span>Appropriate to field type</span></label>
            <label className="radioline"><input type="checkbox" /><span>Appropriate to field club name</span></label>
          </div>
          <div className="group">
            <div className="glabel">Performance rating (Rp)</div>
            <label className="radioline"><input type="radio" name="rp" defaultChecked /><span>FIDE rating, national rating, then default</span></label>
            <label className="radioline"><input type="radio" name="rp" /><span>FIDE rating then default</span></label>
            <label className="radioline"><input type="radio" name="rp" /><span>Only FIDE rating, other games ignored</span></label>
            <Field label="Default value"><input style={{ width: 90 }} defaultValue={1400} /></Field>
          </div>
          <div className="group">
            <div className="glabel">Team evaluation</div>
            <Field label="Players per team"><input style={{ width: 70 }} defaultValue={3} /></Field>
            <Field label="Minimum per team"><input style={{ width: 70 }} defaultValue={0} /></Field>
          </div>
          <Field label="Board offset"><input style={{ width: 70 }} defaultValue={0} /></Field>
        </div>
      )}

      {["Board List", "FIDE Title", "Other", "Arbiter"].includes(tab) && (
        <div className="empty">
          <div className="art"><Icon name="settings" size={22} /></div>
          <h3>{tab}</h3>
          <p className="hint">This panel isn’t needed for pairing or standings in this build.</p>
        </div>
      )}
    </Modal>
  );
}
