import { useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 420;
const TOUCH_TIP_MS = 2200;
const MOVE_CANCEL_PX = 8;

/**
 * Hover/focus tip that uses position:fixed so it is never clipped by
 * overflow:hidden ancestors (route cards, scroll panels, md-icon-button).
 * On touch, a short press-and-hold shows the same tip.
 */
export default function ActionTip({ tip, children }) {
  const wrapRef = useRef(null);
  const [box, setBox] = useState(null);
  const pressTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const longPressedRef = useRef(false);
  const startPosRef = useRef(null);

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function clearTimers() {
    clearPressTimer();
    clearHideTimer();
  }

  function show() {
    const el = wrapRef.current;
    if (!el || !tip) return;
    clearHideTimer();
    const r = el.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 8, Math.max(8, r.right));
    setBox({
      top: Math.max(8, r.top - 8),
      left,
    });
  }

  function hide() {
    setBox(null);
  }

  function scheduleHide(ms = TOUCH_TIP_MS) {
    clearHideTimer();
    hideTimerRef.current = setTimeout(hide, ms);
  }

  function onPointerDown(e) {
    // Mouse / keyboard use hover + focus; touch/pen use press-and-hold.
    if (e.pointerType === "mouse") return;
    longPressedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    clearTimers();
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      longPressedRef.current = true;
      show();
      try {
        navigator.vibrate?.(8);
      } catch {
        /* ignore */
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!startPosRef.current || !pressTimerRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      clearPressTimer();
      startPosRef.current = null;
    }
  }

  function onPointerUp() {
    clearPressTimer();
    startPosRef.current = null;
    if (longPressedRef.current) {
      scheduleHide();
    }
  }

  function onPointerCancel() {
    clearTimers();
    startPosRef.current = null;
    longPressedRef.current = false;
    hide();
  }

  function onClickCapture(e) {
    // After a long-press tip, skip the underlying action once.
    if (!longPressedRef.current) return;
    longPressedRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  useEffect(() => {
    function onScroll() {
      if (!box) return;
      clearTimers();
      hide();
    }
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      clearTimers();
    };
  }, [box]);

  return (
    <span
      className="action-tip-wrap"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
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
