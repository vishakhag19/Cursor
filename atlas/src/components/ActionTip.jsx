import { useRef, useState } from "react";

/**
 * Hover/focus tip that uses position:fixed so it is never clipped by
 * overflow:hidden ancestors (route cards, scroll panels, md-icon-button).
 */
export default function ActionTip({ tip, children }) {
  const wrapRef = useRef(null);
  const [box, setBox] = useState(null);

  function show() {
    const el = wrapRef.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    setBox({
      top: Math.max(8, r.top - 8),
      left: Math.min(window.innerWidth - 8, r.right),
    });
  }

  function hide() {
    setBox(null);
  }

  return (
    <span
      className="action-tip-wrap"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {box ? (
        <span
          className="action-tip"
          role="tooltip"
          style={{ top: `${box.top}px`, left: `${box.left}px` }}
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}
