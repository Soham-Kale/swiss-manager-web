import React from "react";
import Icon from "./Icon.jsx";

/** variant: default | primary | ghost | ok | danger   size: sm | md | lg */
export default function Button({
  variant = "default", size = "md", icon, children, className = "", ...rest
}) {
  const cls = ["btn",
    variant !== "default" ? variant : "",
    size !== "md" ? size : "",
    className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, size = 16, className = "", ...rest }) {
  return (
    <button type="button" className={"iconbtn " + className} title={label} aria-label={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}
