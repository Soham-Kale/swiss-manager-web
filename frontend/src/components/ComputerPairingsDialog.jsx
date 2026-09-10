import React, { useState } from "react";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import Icon from "./ui/Icon.jsx";
import { RadioGroup } from "./ui/Field.jsx";

// The engine actually run is the FIDE Dutch system via py4swiss; Burstein and
// Dubov are also wired. The remaining options are shown but not yet applied.
const SYSTEMS = [
  ["dutch", "FIDE Dutch (default)"],
  ["burstein", "Burstein"],
  ["dubov", "Dubov"],
];
const OPTIONS = [
  ["baku", "Baku acceleration (C.04.5.1)"],
  ["protectClub", "Protect same-club pairings"],
  ["forbidden", "Exclude forbidden pairings"],
  ["byeWeakest", "Bye to the weakest participant"],
  ["pairByTiebreak", "Pair by tiebreak, not start rank"],
  ["ignoreColor", "Ignore colour balance"],
];

export default function ComputerPairingsDialog({ round, onStart, onCancel, busy }) {
  const [system, setSystem] = useState("dutch");
  const [color1, setColor1] = useState("random");
  const [opts, setOpts] = useState({
    baku: false, protectClub: false, forbidden: false,
    byeWeakest: true, pairByTiebreak: false, ignoreColor: false,
  });
  const toggle = (k) => setOpts(s => ({ ...s, [k]: !s[k] }));

  return (
    <Modal title={`Generate pairings — round ${round}`} onClose={onCancel} width={680}
      footer={<>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon="swap" disabled={busy}
                onClick={() => onStart({ engine: system, baku: opts.baku, color1 })}>
          {busy ? "Pairing…" : "Generate"}
        </Button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "var(--s5)" }}>
        <div>
          <div className="group" style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)" }}>
            <div style={{ display: "flex", gap: "var(--s3)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)", flex: "none", marginTop: 2 }}>
                <Icon name="swap" size={18} />
              </span>
              <div>
                <div style={{ fontWeight: 620, marginBottom: 4 }}>Round {round}</div>
                <div className="hint">
                  Pairings are computed from every finalized round: no rematches, balanced
                  colours, and an automatic bye if the field is odd. Results already entered
                  are not changed.
                </div>
              </div>
            </div>
          </div>

          <RadioGroup label="Pairing system" name="ps" options={SYSTEMS}
                      value={system} onChange={setSystem} />
        </div>

        <div>
          <div className="group">
            <div className="glabel">Pairing options</div>
            {OPTIONS.map(([k, lbl]) => (
              <label key={k} className="radioline">
                <input type="checkbox" checked={opts[k]} onChange={() => toggle(k)} />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
          <RadioGroup label="Colour for board 1" name="c1"
                      options={[["random", "Random"], ["white", "White"], ["black", "Black"]]}
                      value={color1} onChange={setColor1} />
        </div>
      </div>
    </Modal>
  );
}
