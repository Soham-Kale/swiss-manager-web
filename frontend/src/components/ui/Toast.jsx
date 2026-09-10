import React from "react";
import Icon from "./Icon.jsx";

export default function Toast({ msg, err }) {
  return (
    <div className={"toast" + (err ? " err" : "")} role="status" aria-live="polite">
      <Icon name={err ? "close" : "check"} size={15} />
      <span>{msg}</span>
    </div>
  );
}
