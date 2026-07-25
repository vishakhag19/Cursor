import { useEffect, useRef, useState } from "react";

const DEFAULT_THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;
const TOP_EDGE_PX = 96;

function isScrollableOverflow(el) {
  if (!el || el === document.body || el === document.documentElement) {
    return false;
  }
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + 1;
}

function findScrolledAncestor(start) {
  let node = start;
  while (node && node !== document.body) {
    if (isScrollableOverflow(node) && node.scrollTop > 0) return node;
    node = node.parentElement;
  }
  return null;
}

function touchFromEvent(e) {
  return e.touches?.[0] || e.changedTouches?.[0] || null;
}

/**
 * Mobile pull-to-refresh for overflow:hidden SPAs (native PTR is disabled).
 * Skips map pans (except a top chrome strip) and scrolled inner lists.
 */
export default function usePullToRefresh({
  enabled,
  onRefresh,
  threshold = DEFAULT_THRESHOLD_PX,
}) {
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const tracking = useRef(null);
  const pullPxRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    function setPull(next) {
      pullPxRef.current = next;
      setPullPx(next);
    }

    function onTouchStart(e) {
      if (refreshingRef.current) return;
      const t = touchFromEvent(e);
      if (!t || e.touches.length !== 1) return;

      const target = e.target;
      if (target?.closest?.(".leaflet-container")) {
        /* Only allow PTR from the top chrome strip over the map. */
        if (t.clientY > TOP_EDGE_PX + (window.visualViewport?.offsetTop || 0)) {
          tracking.current = null;
          return;
        }
      }
      if (findScrolledAncestor(target)) {
        tracking.current = null;
        return;
      }

      tracking.current = {
        startY: t.clientY,
        startX: t.clientX,
        active: false,
      };
    }

    function onTouchMove(e) {
      const track = tracking.current;
      if (!track || refreshingRef.current) return;
      const t = touchFromEvent(e);
      if (!t) return;

      const dy = t.clientY - track.startY;
      const dx = t.clientX - track.startX;

      if (!track.active) {
        if (dy < 10) return;
        if (Math.abs(dx) > Math.abs(dy) * 0.7) {
          tracking.current = null;
          return;
        }
        track.active = true;
      }

      if (dy <= 0) {
        setPull(0);
        return;
      }

      const resisted = Math.min(MAX_PULL_PX, dy * 0.45);
      setPull(resisted);

      if (e.cancelable && track.active) {
        e.preventDefault();
      }
    }

    function finish() {
      const track = tracking.current;
      tracking.current = null;
      if (!track?.active || refreshingRef.current) {
        setPull(0);
        return;
      }

      const resisted = pullPxRef.current;
      setPull(0);

      if (resisted >= threshold) {
        refreshingRef.current = true;
        setRefreshing(true);
        try {
          onRefresh?.();
        } catch {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
    }

    const moveOpts = { passive: false, capture: true };
    const bubbleOpts = { passive: true, capture: true };
    window.addEventListener("touchstart", onTouchStart, bubbleOpts);
    window.addEventListener("touchmove", onTouchMove, moveOpts);
    window.addEventListener("touchend", finish, bubbleOpts);
    window.addEventListener("touchcancel", finish, bubbleOpts);

    return () => {
      window.removeEventListener("touchstart", onTouchStart, bubbleOpts);
      window.removeEventListener("touchmove", onTouchMove, moveOpts);
      window.removeEventListener("touchend", finish, bubbleOpts);
      window.removeEventListener("touchcancel", finish, bubbleOpts);
    };
  }, [enabled, onRefresh, threshold]);

  return {
    pullPx: refreshing ? Math.max(pullPx, threshold * 0.75) : pullPx,
    refreshing,
    armed: pullPx >= threshold || refreshing,
  };
}
