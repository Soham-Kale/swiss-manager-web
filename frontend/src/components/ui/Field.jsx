import React from "react";

export default function Field({ label, children, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ minWidth: 0 }}>
        {children}
        {hint && <div className="hint" style={{ marginTop: 4 }}>{hint}</div>}
      </div>
    </div>
  );
}

export function TextField({ label, value, onChange, hint, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input style={{ width: "100%" }} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function RadioGroup({ label, options, value, onChange, name }) {
  return (
    <div className="group">
      <div className="glabel">{label}</div>
      {options.map((o) => {
        const [val, lbl] = Array.isArray(o) ? o : [o, o];
        return (
          <label key={val} className="radioline">
            <input type="radio" name={name} checked={value === val} onChange={() => onChange(val)} />
            <span>{lbl}</span>
          </label>
        );
      })}
    </div>
  );
}

export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const [val, lbl] = Array.isArray(o) ? o : [o, o];
        return (
          <button key={val} role="tab" aria-selected={value === val}
                  className={value === val ? "on" : ""} onClick={() => onChange(val)}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({ tone = "", children }) {
  return <span className={"pill " + tone}><i className="dot" />{children}</span>;
}
