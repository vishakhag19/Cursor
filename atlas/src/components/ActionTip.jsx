import { useEffect, useRef, useState } from "react";

const HOVER_DELAY_MS = 1000;
const LONG_PRESS_MS = 420;
const TOUCH_TIP_MS = 2200;
const MOVE_CANCEL_PX = 8;
const TIP_GAP = 6;
const EST_TIP_HEIGHT = 36;

/**
 * Hover/focus tip that uses position:fixed so it is never clipped by
 * overflow:hidden ancestors (route cards, scroll panels, md-icon-button).
 * Hover waits a few seconds (discovery); touch uses press-and-hold.
 * Prefers below the control; flips above when the viewport is tight.
 */
export default function ActionTip({ tip, children, className = "" }) {
  const wrapRef = useRef(null);
  const tipRef = useRef(null);
  const [box, setBox] = useState(null);
  const hoverTimerRef = useRef(null);
  const pressTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const longPressedRef = useRef(false);
  const startPosRef = useRef(null);
  const refinedRef = useRef(false);

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

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
    clearHoverTimer();
    clearPressTimer();
    clearHideTimer();
  }

  function placeTip(anchorRect, tipHeight = EST_TIP_HEIGHT, tipWidth = 0) {
    const spaceBelow = window.innerHeight - anchorRect.bottom - TIP_GAP;
    const spaceAbove = anchorRect.top - TIP_GAP;
    const placeBelow =
      spaceBelow >= tipHeight || spaceBelow >= spaceAbove;

    let left = anchorRect.left + anchorRect.width / 2;
    if (tipWidth > 0) {
      const half = tipWidth / 2;
      left = Math.min(
        window.innerWidth - 8 - half,
        Math.max(8 + half, left),
      );
    }

    return {
      top: placeBelow
        ? anchorRect.bottom + TIP_GAP
        : anchorRect.top - TIP_GAP,
      left,
      placement: placeBelow ? "below" : "above",
    };
  }

  function show() {
    const el = wrapRef.current;
    if (!el || !tip) return;
    clearHideTimer();
    setBox(placeTip(el.getBoundingClientRect()));
  }

  function hide() {
    clearHoverTimer();
    setBox(null);
  }

  function scheduleShow() {
    clearHoverTimer();
    clearHideTimer();
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      show();
    }, HOVER_DELAY_MS);
  }

  function scheduleHide(ms = TOUCH_TIP_MS) {
    clearHideTimer();
    hideTimerRef.current = setTimeout(hide, ms);
  }

  function onPointerDown(e) {
    // Mouse / keyboard use delayed hover + focus; touch/pen use press-and-hold.
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

  // Refine placement once the tip is measured (avoids edge / bottom clipping).
  useEffect(() => {
    if (!box) {
      refinedRef.current = false;
      return;
    }
    if (refinedRef.current || !wrapRef.current || !tipRef.current) return;
    refinedRef.current = true;
    const anchor = wrapRef.current.getBoundingClientRect();
    const tipRect = tipRef.current.getBoundingClientRect();
    const next = placeTip(anchor, tipRect.height, tipRect.width);
    if (
      Math.abs(next.top - box.top) > 0.5 ||
      Math.abs(next.left - box.left) > 0.5 ||
      next.placement !== box.placement
    ) {
      setBox(next);
    }
  }, [box]);

  useEffect(() => {
    function onScroll() {
      if (!box && !hoverTimerRef.current) return;
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
      className={["action-tip-wrap", className].filter(Boolean).join(" ")}
      ref={wrapRef}
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
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
          ref={tipRef}
          className={`action-tip${box.placement === "above" ? " is-above" : ""}`}
          role="tooltip"
          style={{ top: `${box.top}px`, left: `${box.left}px` }}
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}
