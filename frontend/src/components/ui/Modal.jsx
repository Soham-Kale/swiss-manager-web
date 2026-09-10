import React, { useEffect, useRef } from "react";
import { IconButton } from "./Button.jsx";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: Esc to close, focus trap, background scroll lock,
 * click-outside to dismiss. `width` sets the max-width in px.
 */
export default function Modal({ title, onClose, children, footer, width = 460 }) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    restoreTo.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const first = ref.current?.querySelector(FOCUSABLE);
    (first || ref.current)?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const items = [...(ref.current?.querySelectorAll(FOCUSABLE) || [])].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}
           style={{ maxWidth: width }} ref={ref} tabIndex={-1}>
        <div className="dtitle">
          <span>{title}</span>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="dbody">{children}</div>
        {footer && <div className="dfoot">{footer}</div>}
      </div>
    </div>
  );
}
