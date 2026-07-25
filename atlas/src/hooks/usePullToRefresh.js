import { useEffect, useRef, useState } from "react";

const DEFAULT_THRESHOLD_PX = 64;
const MAX_PULL_PX = 128;

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

function topPullZonePx() {
  const h =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement?.clientHeight ||
    640;
  return Math.max(120, Math.round(h * 0.4));
}

/**
 * Mobile pull-to-refresh for overflow:hidden map SPAs.
 * Native browser PTR is usually blocked; this reloads the page instead.
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
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      pullPxRef.current = 0;
      setPullPx(0);
      return undefined;
    }

    function setPull(next) {
      pullPxRef.current = next;
      setPullPx(next);
    }

    function canStartFromTarget(target, clientY) {
      if (findScrolledAncestor(target)) return false;

      /*
       * Never steal vertical gestures from drawers, sheets, panels, or
       * dialogs — swiping those down collapses/dismisses them and must not
       * reload the page.
       */
      if (
        target?.closest?.(
          [
            ".dir-drive-sheet",
            ".dir-sheet-handle",
            ".place-bottom-sheet",
            ".panel",
            ".search-panel",
            ".directions-panel",
            ".context-menu",
            ".route-prefs-sheet",
            ".road-rules-sheet",
            ".map-controls",
            ".nav-active",
            ".route-assistant",
            "md-dialog",
            "[role='dialog']",
            "[role='bottomsheet']",
          ].join(", "),
        )
      ) {
        return false;
      }

      /* Only the map surface can start pull-to-refresh. */
      const onMap = Boolean(target?.closest?.(".leaflet-container"));
      if (!onMap) return false;

      /* Map: only start a refresh pull from the upper portion of the screen. */
      const top =
        (window.visualViewport?.offsetTop || 0) + topPullZonePx();
      return clientY <= top;
    }

    function onTouchStart(e) {
      if (refreshingRef.current) return;
      const t = touchFromEvent(e);
      if (!t || e.touches.length !== 1) return;
      if (!canStartFromTarget(e.target, t.clientY)) {
        tracking.current = null;
        return;
      }

      tracking.current = {
        startY: t.clientY,
        startX: t.clientX,
        active: false,
        onMap: Boolean(e.target?.closest?.(".leaflet-container")),
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
        if (dy < 8) return;
        /* Horizontal / map pan wins over refresh. */
        if (Math.abs(dx) > Math.abs(dy) * 0.65) {
          tracking.current = null;
          return;
        }
        track.active = true;
      }

      if (dy <= 0) {
        setPull(0);
        return;
      }

      const resisted = Math.min(MAX_PULL_PX, dy * 0.5);
      setPull(resisted);

      if (e.cancelable) e.preventDefault();
    }

    function finish() {
      const track = tracking.current;
      tracking.current = null;
      if (!track?.active || refreshingRef.current) {
        setPull(0);
        return;
      }

      const resisted = pullPxRef.current;
      if (resisted < threshold) {
        setPull(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setPull(Math.max(resisted, threshold));

      /* Defer so the spinner can paint before unload. */
      window.setTimeout(() => {
        try {
          onRefreshRef.current?.();
        } catch {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
        }
      }, 40);
    }

    const moveOpts = { passive: false, capture: true };
    const startOpts = { passive: true, capture: true };
    window.addEventListener("touchstart", onTouchStart, startOpts);
    window.addEventListener("touchmove", onTouchMove, moveOpts);
    window.addEventListener("touchend", finish, startOpts);
    window.addEventListener("touchcancel", finish, startOpts);

    return () => {
      window.removeEventListener("touchstart", onTouchStart, startOpts);
      window.removeEventListener("touchmove", onTouchMove, moveOpts);
      window.removeEventListener("touchend", finish, startOpts);
      window.removeEventListener("touchcancel", finish, startOpts);
    };
  }, [enabled, threshold]);

  return {
    pullPx: refreshing ? Math.max(pullPx, threshold * 0.8) : pullPx,
    refreshing,
    armed: pullPx >= threshold || refreshing,
  };
}
