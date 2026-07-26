import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceSuggestionList from "./PlaceSuggestionList";
import ActionTip from "./ActionTip";
import SaveRouteSheet from "./SaveRouteSheet";
import { formatDistance, formatDuration } from "../utils/format";
import { resolveSaveEndpointName } from "../api/geocode";
import {
  TRAVEL_MODES,
  travelModeMeta,
  ROUTE_PREF_CHIP_FIELDS,
  NON_DRIVE_MODE_HINT,
} from "../utils/routePreferences";

const SAVE_TAP_MOVE_PX = 10;

function useIsCompact(query = "(max-width: 800px)") {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return compact;
}

/** Sheet heights as fractions of the viewport — 10% steps up to full screen. */
const SHEET_SNAPS = [
  "s10",
  "s20",
  "s30",
  "s40",
  "s50",
  "s60",
  "s70",
  "s80",
  "s90",
  "s100",
];
const SHEET_FRACTIONS = {
  s10: 0.1,
  s20: 0.2,
  s30: 0.3,
  s40: 0.4,
  s50: 0.5,
  s60: 0.6,
  s70: 0.7,
  s80: 0.8,
  s90: 0.9,
  s100: 1,
};
const SHEET_MAX_SNAP = SHEET_SNAPS[SHEET_SNAPS.length - 1];

function isMobileSheetViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 800px)").matches
  );
}

function sheetSnapHeights() {
  const vh = window.innerHeight;
  const heights = {};
  for (const id of SHEET_SNAPS) {
    heights[id] = Math.max(64, Math.round(vh * SHEET_FRACTIONS[id]));
  }
  return heights;
}

function nearestSheetSnap(height, heights, velocityY) {
  const ordered = SHEET_SNAPS.map((id) => ({ id, h: heights[id] }));
  // Negative velocityY = finger moving up → prefer taller snap
  if (velocityY < -1.1) {
    /* Strong upward fling → full screen */
    return SHEET_MAX_SNAP;
  }
  if (velocityY < -0.45) {
    const taller = ordered.find((s) => s.h > height + 8);
    return taller?.id || SHEET_MAX_SNAP;
  }
  if (velocityY > 1.1) {
    return SHEET_SNAPS[0];
  }
  if (velocityY > 0.45) {
    const shorter = [...ordered].reverse().find((s) => s.h < height - 8);
    return shorter?.id || SHEET_SNAPS[0];
  }
  const entries = ordered.map((s) => ({
    id: s.id,
    dist: Math.abs(s.h - height),
  }));
  entries.sort((a, b) => a.dist - b.dist);
  return entries[0].id;
}

/**
 * Directions panel — recommendations with traffic + reasons (Features 1, 7),
 * prefs entry (2), multi-stop reorder (3), save exact path (5).
 */
export default function DirectionsPanel({
  stops,
  stopTexts,
  onStopText,
  onStopSelect,
  onAddStop,
  onRemoveStop,
  onMoveStop = null,
  onSwap,
  onClose,
  onCollapsePanel = null,
  collapseIcon = "chevron_left",
  /** Imperative handle: { handleBack(): boolean, isBackable(): boolean } */
  backRef = null,
  /** Report sheet height fraction so the map can stay framed. */
  onSheetHeightChange = null,
  routeOptions,
  selectedRouteId,
  onSelectRoute,
  loading,
  error,
  currentLocation,
  near = null,
  recentPlaces = [],
  onRequestLocation = null,
  comparison = null,
  editBusy = false,
  onShowSteps = null,
  onStart = null,
  onSaveRoute = null,
  onUnsaveRoute = null,
  savedRoutes = [],
  onOpenAssistant = null,
  assistantOpen = false,
  onOpenPrefs = null,
  prefsOpen = false,
  hasCustomEdits = false,
  travelMode = "driving",
  onTravelMode = null,
  showTollPassPrices = false,
  routePrefs = null,
  onRoutePrefsChange = null,
}) {
  const [activeStop, setActiveStop] = useState(null);
  const activeStopRef = useRef(null);
  const [forceShowStops, setForceShowStops] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragGhostRef = useRef(null);
  const stopDragRef = useRef(null);
  const dragOverRef = useRef(null);
  const [placeList, setPlaceList] = useState({
    open: false,
    items: [],
    query: "",
    loading: false,
    select: null,
  });
  const wasLoadingRef = useRef(false);
  const [sheetSnap, setSheetSnap] = useState("s30");
  const [sheetDragPx, setSheetDragPx] = useState(null);
  const [saveNameError, setSaveNameError] = useState("");
  const isCompact = useIsCompact();
  const saveTapRef = useRef(null);
  const saveOpenTokenRef = useRef(0);
  const saveGestureLockRef = useRef(0);
  const sheetRef = useRef(null);
  const sheetHandleRef = useRef(null);
  const sheetBodyRef = useRef(null);
  const sheetDragRef = useRef(null);

  function setActiveStopIndex(index) {
    activeStopRef.current = index;
    setActiveStop(index);
  }

  function clearDragGhost() {
    const ghost = dragGhostRef.current;
    if (ghost?.parentNode) ghost.parentNode.removeChild(ghost);
    dragGhostRef.current = null;
  }

  function setDropTarget(index) {
    dragOverRef.current = index;
    setDragOver(index);
  }

  function detachStopDragListeners() {
    const drag = stopDragRef.current;
    if (!drag) return;
    if (drag.onMove) {
      window.removeEventListener("pointermove", drag.onMove);
    }
    if (drag.onUp) {
      window.removeEventListener("pointerup", drag.onUp);
      window.removeEventListener("pointercancel", drag.onUp);
    }
    if (drag.raf != null) {
      cancelAnimationFrame(drag.raf);
      drag.raf = null;
    }
  }

  function placeDragGhost(clientX, clientY) {
    const ghost = dragGhostRef.current;
    if (!ghost) return;
    const w = ghost.offsetWidth || 260;
    const h = ghost.offsetHeight || 48;
    const x = Math.max(8, clientX - Math.min(56, w / 3));
    const y = Math.max(8, clientY - h / 2);
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function ensureDragGhost(index) {
    if (dragGhostRef.current) return dragGhostRef.current;
    const label =
      index === 0
        ? "Starting point"
        : index === stops.length - 1
          ? "Destination"
          : `Stop ${index}`;
    const value = (stopTexts[index] || "").trim() || label;
    const ghost = document.createElement("div");
    ghost.className = "dir-stop-drag-ghost is-pointer";
    ghost.innerHTML =
      '<span class="dir-stop-drag-ghost-label"></span><span class="dir-stop-drag-ghost-value"></span>';
    ghost.querySelector(".dir-stop-drag-ghost-label").textContent = label;
    ghost.querySelector(".dir-stop-drag-ghost-value").textContent = value;
    const field = document.querySelector(`#dir-stop-${index}`)?.closest?.(
      ".dir-stop-field",
    );
    ghost.style.width = `${Math.min(field?.offsetWidth || 260, 280)}px`;
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    return ghost;
  }

  /** Prefer row midpoints so drop target updates as soon as the finger crosses. */
  function stopIndexFromClientY(clientY) {
    const rows = document.querySelectorAll(
      ".dir-stops-fields > .dir-stop-row",
    );
    if (!rows.length) return dragOverRef.current;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < rows.length; i += 1) {
      const rect = rows[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function beginStopPointerDrag(e, index) {
    if (!onMoveStop || stops.length < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Kill sheet / scroll gestures immediately — drag starts on slightest touch.
    e.preventDefault();
    e.stopPropagation();
    detachStopDragListeners();

    const handle = e.currentTarget;
    try {
      handle.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      const drag = stopDragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      if (ev.cancelable) ev.preventDefault();
      drag.lastX = ev.clientX;
      drag.lastY = ev.clientY;
      if (!drag.active) {
        // 1px — effectively the slightest touch starts the drag.
        if (
          Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 1
        ) {
          return;
        }
        drag.active = true;
        ensureDragGhost(drag.from);
        placeDragGhost(ev.clientX, ev.clientY);
      }
      if (drag.raf != null) return;
      drag.raf = requestAnimationFrame(() => {
        const d = stopDragRef.current;
        if (!d) return;
        d.raf = null;
        if (!d.active) return;
        placeDragGhost(d.lastX, d.lastY);
        const over = stopIndexFromClientY(d.lastY);
        if (over != null && over !== dragOverRef.current) {
          setDropTarget(over);
        }
      });
    };

    const onUp = (ev) => {
      const drag = stopDragRef.current;
      if (!drag || (ev && drag.pointerId !== ev.pointerId)) return;
      const from = drag.from;
      const to = dragOverRef.current;
      const wasActive = drag.active;
      detachStopDragListeners();
      try {
        handle.releasePointerCapture?.(drag.pointerId);
      } catch {
        /* ignore */
      }
      stopDragRef.current = null;
      document.body.classList.remove("is-stop-reordering");
      clearDragGhost();
      setDragFrom(null);
      setDropTarget(null);
      if (
        wasActive &&
        onMoveStop &&
        to != null &&
        from !== to &&
        to >= 0 &&
        to < stops.length
      ) {
        onMoveStop(from, to);
      }
    };

    stopDragRef.current = {
      from: index,
      pointerId: e.pointerId,
      startY: e.clientY,
      startX: e.clientX,
      lastX: e.clientX,
      lastY: e.clientY,
      active: false,
      raf: null,
      onMove,
      onUp,
    };
    setDragFrom(index);
    setDropTarget(index);

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    // Block competing scroll immediately; ghost appears on the first 1px move.
    document.body.classList.add("is-stop-reordering");
  }

  useEffect(
    () => () => {
      detachStopDragListeners();
      clearDragGhost();
      document.body.classList.remove("is-stop-reordering");
      stopDragRef.current = null;
    },
    [],
  );

  function handleListChange(index, payload) {
    // Opening always wins for that field (activeStop setState can lag focus).
    if (payload.open) {
      setActiveStopIndex(index);
      setPlaceList(payload);
      return;
    }
    // Ignore close events from fields that no longer own the list.
    if (activeStopRef.current != null && activeStopRef.current !== index) {
      return;
    }
    setPlaceList(payload);
    if (activeStopRef.current === index) {
      setActiveStopIndex(null);
    }
  }

  function clearPlaceList() {
    setPlaceList({
      open: false,
      items: [],
      query: "",
      loading: false,
      select: null,
    });
    setActiveStopIndex(null);
  }

  const closeSaveForm = useCallback(() => {
    saveOpenTokenRef.current += 1;
    setSaving(false);
    setSaveName("");
    setSaveNameError("");
  }, []);

  const openSaveForm = useCallback(() => {
    setSaveNameError("");
    setSaving(true);
    const token = ++saveOpenTokenRef.current;
    const fromPlace = stops[0];
    const toPlace = stops[stops.length - 1];
    const roughFrom =
      fromPlace && !fromPlace.isCurrentLocation
        ? fromPlace.name || "Start"
        : "Start";
    const roughTo =
      toPlace && !toPlace.isCurrentLocation
        ? toPlace.name || "Destination"
        : "Destination";
    setSaveName(`${roughFrom} to ${roughTo}`);
    void Promise.all([
      resolveSaveEndpointName(fromPlace, "Start"),
      resolveSaveEndpointName(toPlace, "Destination"),
    ]).then(([from, to]) => {
      if (saveOpenTokenRef.current !== token) return;
      setSaveName(`${from} to ${to}`);
    });
  }, [stops]);

  /**
   * Bookmark logic:
   * - Filled (already saved) → unsave immediately; never open the save sheet
   * - Outline (not saved) → open the save sheet
   * Touch often delivers pointerup then a leftover click; lock the gesture so
   * the leftover click cannot reverse the action (unsave → open sheet).
   */
  function lockSaveGesture(ms = 500) {
    saveGestureLockRef.current = Date.now() + ms;
  }

  function activateSaveButton() {
    if (Date.now() < saveGestureLockRef.current) return;

    // Prefer the saved state captured at pointerdown for this gesture.
    const tap = saveTapRef.current;
    const unsaveId =
      (tap?.wasSaved && tap.savedId) ||
      (routeIsSaved && savedMatch?.id) ||
      null;

    if (unsaveId) {
      onUnsaveRoute?.(unsaveId);
      closeSaveForm();
      lockSaveGesture();
      return;
    }

    if (saving) return;
    if (tap) tap.opened = true;
    openSaveForm();
    lockSaveGesture();
  }

  function onSavePointerDown(e) {
    // Mouse / keyboard use click. Touch / pen need press tracking so the
    // scrollable Drive sheet can't cancel the gesture before click fires.
    if (e.pointerType === "mouse") return;
    if (typeof e.button === "number" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    saveTapRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      opened: false,
      wasSaved: routeIsSaved,
      savedId: savedMatch?.id || null,
    };
  }

  function onSavePointerMove(e) {
    const tap = saveTapRef.current;
    if (!tap || tap.id !== e.pointerId || tap.moved) return;
    const dx = e.clientX - tap.x;
    const dy = e.clientY - tap.y;
    if (dx * dx + dy * dy > SAVE_TAP_MOVE_PX * SAVE_TAP_MOVE_PX) {
      tap.moved = true;
    }
  }

  function onSavePointerEnd(e) {
    if (e.pointerType === "mouse") return;
    const tap = saveTapRef.current;
    if (!tap || tap.id !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (tap.moved) {
      saveTapRef.current = null;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    activateSaveButton();
    // Keep tap intent until after any residual click, then clear.
    window.setTimeout(() => {
      if (saveTapRef.current?.id === tap.id) saveTapRef.current = null;
    }, 500);
  }

  function onSaveClick(e) {
    // Mouse click + keyboard activation. Touch residual clicks are locked out.
    e.preventDefault();
    e.stopPropagation();
    activateSaveButton();
  }

  function submitSaveForm() {
    const name = saveName.trim() || "Saved route";
    if (saveName.length > 80) {
      setSaveNameError("Name must be 80 characters or fewer");
      return;
    }
    const saved = onSaveRoute?.(name);
    // Lock out residual taps so the reappearing bookmark cannot unsave.
    lockSaveGesture(900);
    if (saved === false) return;
    closeSaveForm();
  }

  function handleSystemBack() {
    if (saving) {
      closeSaveForm();
      return true;
    }
    if (placeList.open) {
      clearPlaceList();
      return true;
    }
    if (forceShowStops) {
      setForceShowStops(false);
      clearPlaceList();
      return true;
    }
    if (isMobileSheetViewport() && sheetSnap !== "s10") {
      setSheetSnap("s10");
      return true;
    }
    onClose?.();
    return false;
  }

  useImperativeHandle(
    backRef,
    () => ({
      handleBack: handleSystemBack,
      isBackable: () => true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saving, placeList.open, forceShowStops, sheetSnap, onClose],
  );

  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
      return;
    }
    if (wasLoadingRef.current && routeOptions.length > 0) {
      wasLoadingRef.current = false;
      /* Keep the stops card visible so Add stop / edits stay available. */
      clearPlaceList();
      if (isMobileSheetViewport() && sheetSnap === "s10") {
        setSheetSnap("s30");
      }
    }
  }, [loading, routeOptions.length, sheetSnap]);

  useEffect(() => {
    if (!onSheetHeightChange) return;
    const frac = SHEET_FRACTIONS[sheetSnap] ?? 0.3;
    onSheetHeightChange(frac);
  }, [sheetSnap, onSheetHeightChange]);

  useEffect(() => {
    if (!isMobileSheetViewport()) {
      setSheetSnap("s30");
      setSheetDragPx(null);
    }
  }, []);

  const bothEndsSet = stops.filter(Boolean).length >= 2;
  const hasRouteResults = bothEndsSet && routeOptions.length > 0;
  const modeMeta = travelModeMeta(travelMode);
  const modesRef = useRef(null);
  const selectedRoute =
    routeOptions.find((r) => r.id === selectedRouteId) ||
    routeOptions[0] ||
    null;
  const sheetChromeOnly = sheetSnap === "s10" && sheetDragPx == null;

  // Exact route id, loaded-saved id (`saved-${entry.id}`), or geometry fingerprint.
  const savedMatch =
    selectedRoute &&
    (savedRoutes.find(
      (s) =>
        (s.route?.id && s.route.id === selectedRoute.id) ||
        (s.route?.id && s.route.id === selectedRoute.originalRouteId) ||
        (selectedRoute.savedEntryId && selectedRoute.savedEntryId === s.id) ||
        selectedRoute.id === `saved-${s.id}`,
    ) ||
      savedRoutes.find((s) => {
        const r = s.route;
        if (!r?.geometry?.length || !selectedRoute.geometry?.length) return false;
        return (
          Math.round(r.distance) === Math.round(selectedRoute.distance) &&
          Math.round(r.duration) === Math.round(selectedRoute.duration) &&
          r.geometry.length === selectedRoute.geometry.length &&
          r.geometry[0][0] === selectedRoute.geometry[0][0] &&
          r.geometry[0][1] === selectedRoute.geometry[0][1] &&
          r.geometry[r.geometry.length - 1][0] ===
            selectedRoute.geometry[selectedRoute.geometry.length - 1][0] &&
          r.geometry[r.geometry.length - 1][1] ===
            selectedRoute.geometry[selectedRoute.geometry.length - 1][1]
        );
      }));
  const routeIsSaved = Boolean(savedMatch);

  useEffect(() => {
    const root = modesRef.current;
    if (!root) return;
    const active = root.querySelector(".dir-travel-mode.is-active");
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [travelMode]);

  function onSheetHandlePointerDown(e) {
    if (!isMobileSheetViewport()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const heights = sheetSnapHeights();
    const measured = sheetRef.current?.getBoundingClientRect?.().height;
    const startHeight = Math.round(
      measured || heights[sheetSnap] || heights.s30,
    );
    sheetDragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight,
      lastY: e.clientY,
      lastT: performance.now(),
      velocityY: 0,
      heights,
    };
    setSheetDragPx(startHeight);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onSheetHandlePointerMove(e) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    const dy = e.clientY - drag.lastY;
    drag.velocityY = dy / dt;
    drag.lastY = e.clientY;
    drag.lastT = now;
    const minH = drag.heights.s10;
    const maxH = drag.heights[SHEET_MAX_SNAP];
    const next = Math.min(
      maxH,
      Math.max(minH, drag.startHeight - (e.clientY - drag.startY)),
    );
    drag.currentHeight = next;
    setSheetDragPx(next);
  }

  function endSheetDrag(e) {
    const drag = sheetDragRef.current;
    if (!drag || (e && drag.pointerId !== e.pointerId)) return;
    const minH = drag.heights.s10;
    const maxH = drag.heights[SHEET_MAX_SNAP];
    const height =
      drag.currentHeight ??
      Math.min(
        maxH,
        Math.max(minH, drag.startHeight - (drag.lastY - drag.startY)),
      );
    const snap = nearestSheetSnap(height, drag.heights, drag.velocityY);
    sheetDragRef.current = null;
    setSheetSnap(snap);
    setSheetDragPx(null);
  }

  const sheetStyle =
    sheetDragPx != null
      ? { height: `${sheetDragPx}px`, maxHeight: `${sheetDragPx}px` }
      : undefined;

  return (
    <section
      className={`mode-panel directions-panel ${hasCustomEdits ? "has-custom-edits" : ""} ${hasRouteResults ? "has-route-results" : ""} ${forceShowStops ? "show-stops" : ""} ${placeList.open ? "has-stop-suggest" : ""} is-sheet-${sheetSnap}${sheetDragPx != null ? " is-sheet-dragging" : ""}${saving && isCompact ? " is-saving-route" : ""}`}
    >
      {/* Mobile: floating top card (+ reshape actions). Desktop: flattened via display:contents. */}
      <div className="dir-mobile-top-stack">
      <div className="dir-mobile-stop-card">
      <div className="dir-stops-block">
        <div
          className={`dir-stops ${stops.length > 2 ? "has-mid-stops" : ""}`}
        >
          <div className="dir-stops-rail" aria-hidden>
            {stops.map((_, i) => (
              <span
                key={`dot-${i}`}
                className={`dir-rail-dot ${i === 0 ? "start" : i === stops.length - 1 ? "end" : "mid"}`}
              />
            ))}
          </div>

          <div className="dir-stops-fields">
            {stops.map((stop, i) => {
              const multi = stops.length > 2;
              const canReorder = Boolean(onMoveStop) && stops.length >= 2;
              const isStart = i === 0;
              const isDest = i === stops.length - 1;
              const showTrailing = canReorder || multi;
              const showSwap = isStart && !multi;
              const showAdd =
                isDest &&
                !(
                  placeList.open &&
                  (placeList.items.length > 0 ||
                    placeList.loading ||
                    Boolean((placeList.query || "").trim()))
                );
              const rowClass = [
                "dir-stop-row",
                showTrailing ? "has-controls" : "",
                canReorder ? "can-reorder" : "",
                dragFrom === i ? "is-dragging" : "",
                dragOver === i && dragFrom != null && dragFrom !== i
                  ? "is-drop-target"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
              <div
                className={rowClass}
                key={`stop-${i}`}
              >
                <div className="dir-stop-field">
                    <SuggestInput
                    id={`dir-stop-${i}`}
                    label={
                      isStart
                        ? "Starting point"
                        : isDest
                          ? "Destination"
                          : `Stop ${i}`
                    }
                    value={stopTexts[i] || ""}
                    onChange={(v) => onStopText(i, v)}
                    onSelect={(place) => {
                      onStopSelect(i, place);
                      clearPlaceList();
                    }}
                    placeholder={
                      isStart
                        ? "Starting point"
                        : isDest
                          ? "Destination"
                          : `Stop ${i}`
                    }
                    currentLocation={currentLocation}
                    allowCurrentLocation
                    recentPlaces={recentPlaces}
                    near={near}
                    onRequestLocation={onRequestLocation}
                    bare
                    externalList
                    onFocusField={() => setActiveStopIndex(i)}
                    onListChange={(payload) => handleListChange(i, payload)}
                  />
                  {showTrailing ? (
                    <div className="dir-stop-reorder">
                      {canReorder ? (
                        <button
                          type="button"
                          className="dir-stop-drag"
                          aria-label="Drag to reorder stop"
                          title="Drag to reorder"
                          onPointerDown={(e) => beginStopPointerDrag(e, i)}
                          onKeyDown={(e) => {
                            if (!onMoveStop) return;
                            if (e.key === "ArrowUp" && i > 0) {
                              e.preventDefault();
                              onMoveStop(i, i - 1);
                            } else if (
                              e.key === "ArrowDown" &&
                              i < stops.length - 1
                            ) {
                              e.preventDefault();
                              onMoveStop(i, i + 1);
                            }
                          }}
                        >
                          <md-icon>drag_indicator</md-icon>
                        </button>
                      ) : (
                        <span className="dir-stop-drag-spacer" aria-hidden />
                      )}
                      {multi ? (
                        <md-icon-button
                          type="button"
                          class="dir-stop-clear"
                          aria-label="Remove stop"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            clearPlaceList();
                            onRemoveStop(i);
                          }}
                        >
                          <md-icon>close</md-icon>
                        </md-icon-button>
                      ) : (
                        <md-icon-button
                          type="button"
                          class="dir-stop-clear"
                          aria-label={
                            isStart
                              ? "Clear starting point"
                              : "Clear destination"
                          }
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            /* Keep focus so SuggestInput can open defaults
                               with Current location on top. */
                            setActiveStopIndex(i);
                            onStopSelect(i, null);
                          }}
                        >
                          <md-icon>close</md-icon>
                        </md-icon-button>
                      )}
                    </div>
                  ) : null}
                </div>

                <div
                  className="dir-stop-row-action"
                  aria-hidden={showSwap || showAdd ? undefined : true}
                >
                  {showSwap ? (
                    <ActionTip tip="Swap start and destination">
                      <md-icon-button
                        class="dir-swap"
                        type="button"
                        aria-label="Swap start and destination"
                        onClick={onSwap}
                      >
                        <md-icon>swap_vert</md-icon>
                      </md-icon-button>
                    </ActionTip>
                  ) : null}
                  {showAdd ? (
                    <ActionTip tip="Add stop">
                      <md-icon-button
                        class="dir-add-stop"
                        type="button"
                        aria-label="Add stop"
                        onClick={() => {
                          onAddStop?.();
                          setForceShowStops(true);
                          if (isMobileSheetViewport()) setSheetSnap("s20");
                        }}
                      >
                        <md-icon>add</md-icon>
                      </md-icon-button>
                    </ActionTip>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Always below start / mid / destination fields. */}
        {placeList.open &&
        (placeList.items.length > 0 ||
          placeList.loading ||
          Boolean((placeList.query || "").trim())) ? (
          <div className="dir-stop-suggest-scroll">
            <PlaceSuggestionList
              items={placeList.items}
              query={placeList.query}
              loading={placeList.loading}
              onSelect={(place) => {
                if (placeList.select) placeList.select(place);
                else if (activeStop != null) {
                  onStopSelect(activeStop, place);
                  clearPlaceList();
                }
              }}
            />
          </div>
        ) : null}
      </div>
      </div>
      </div>

      {/* Mobile: bottom Drive sheet. Desktop: flattened via display:contents + order. */}
      <div
        ref={sheetRef}
        className={`dir-drive-sheet is-${sheetSnap}${sheetChromeOnly ? " is-chrome-only" : ""}`}
        style={sheetStyle}
      >
        <div
          ref={sheetHandleRef}
          className="dir-sheet-grabber-hit"
          aria-label="Drag to resize route sheet"
          onPointerDown={onSheetHandlePointerDown}
          onPointerMove={onSheetHandlePointerMove}
          onPointerUp={endSheetDrag}
          onPointerCancel={endSheetDrag}
          onDoubleClick={() => {
            if (!isMobileSheetViewport()) return;
            setSheetSnap((cur) =>
              cur === SHEET_MAX_SNAP ? "s30" : SHEET_MAX_SNAP,
            );
          }}
        >
          <div className="dir-sheet-grabber" aria-hidden />
        </div>
        <div className="dir-sticky-chrome">
            <div className="dir-top-bar">
              <md-icon-button
                type="button"
                aria-label="Back to search"
                onClick={onClose}
              >
                <md-icon>arrow_back</md-icon>
              </md-icon-button>
              <span className="md-typescale-title-medium dir-title">
                {modeMeta.label || "Directions"}
              </span>
              <div className="dir-top-actions">
                {onOpenPrefs ? (
                  <ActionTip tip={prefsOpen ? "Close route options" : "Route options"}>
                    <md-icon-button
                      type="button"
                      class={`dir-prefs-btn ${prefsOpen ? "is-active" : ""}`}
                      aria-label={prefsOpen ? "Close route options" : "Route options"}
                      aria-pressed={prefsOpen ? "true" : "false"}
                      onClick={onOpenPrefs}
                    >
                      <md-icon>tune</md-icon>
                    </md-icon-button>
                  </ActionTip>
                ) : null}
                {onOpenAssistant ? (
                  <ActionTip tip={assistantOpen ? "Close assistant" : "Ask route assistant"}>
                    <md-icon-button
                      type="button"
                      class={`dir-assistant-btn ${assistantOpen ? "is-active" : ""}`}
                      aria-label={assistantOpen ? "Close assistant" : "Ask route assistant"}
                      aria-pressed={assistantOpen ? "true" : "false"}
                      onClick={onOpenAssistant}
                    >
                      <md-icon>auto_awesome</md-icon>
                    </md-icon-button>
                  </ActionTip>
                ) : null}
                {hasRouteResults && (
                  <button
                    type="button"
                    className="dir-change-stops"
                    onClick={() => {
                      if (forceShowStops) {
                        setForceShowStops(false);
                        clearPlaceList();
                      } else {
                        setForceShowStops(true);
                      }
                    }}
                  >
                    <md-icon>
                      {forceShowStops ? "check" : "edit_location_alt"}
                    </md-icon>
                    <span className="md-typescale-label-large">
                      {forceShowStops ? "Done" : "Change"}
                    </span>
                  </button>
                )}
                {onCollapsePanel ? (
                  <ActionTip tip="Collapse panel">
                    <md-icon-button
                      type="button"
                      class="collapse-panel-btn dir-collapse-btn"
                      aria-label="Collapse panel"
                      onClick={onCollapsePanel}
                    >
                      <md-icon>{collapseIcon}</md-icon>
                    </md-icon-button>
                  </ActionTip>
                ) : null}
                <ActionTip tip="Close">
                  <md-icon-button
                    type="button"
                    class="dir-close-btn"
                    aria-label="Close directions"
                    onClick={onClose}
                  >
                    <md-icon>close</md-icon>
                  </md-icon-button>
                </ActionTip>
              </div>
            </div>

            <div
              className="dir-travel-modes"
              role="tablist"
              aria-label="Travel mode"
              ref={modesRef}
            >
              {TRAVEL_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={travelMode === m.id ? "true" : "false"}
                  className={`dir-travel-mode ${travelMode === m.id ? "is-active" : ""}`}
                  title={m.label}
                  onClick={() => onTravelMode?.(m.id)}
                >
                  <md-icon>{m.icon}</md-icon>
                  <span className="dir-travel-mode-label">{m.label}</span>
                </button>
              ))}
            </div>

            {travelMode === "driving" && routePrefs && onRoutePrefsChange ? (
              <div
                className="dir-avoid-chips"
                role="group"
                aria-label="Route options"
              >
                {ROUTE_PREF_CHIP_FIELDS.map((f) => {
                  const on = Boolean(routePrefs[f.id]);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`dir-avoid-chip ${on ? "is-on" : ""}`}
                      aria-pressed={on ? "true" : "false"}
                      onClick={() =>
                        onRoutePrefsChange({ ...routePrefs, [f.id]: !on })
                      }
                    >
                      {on ? <md-icon>check</md-icon> : null}
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

        <div className="dir-drive-body" ref={sheetBodyRef}>
      {modeMeta.unsupported ? (
        <p className="hint tight md-typescale-body-medium" role="status">
          {NON_DRIVE_MODE_HINT}
        </p>
      ) : null}

      {loading && (
        <p className="hint tight md-typescale-body-medium" role="status">
          Finding routes…
        </p>
      )}

      {error && !modeMeta.unsupported ? (
        <p className="error-msg md-typescale-body-medium" role="alert">
          {error}
        </p>
      ) : null}

      {selectedRoute ? (
        <div className="dir-selected-route">
          <div className="dir-selected-summary">
            <div className="dir-selected-stats">
              <span className="dir-route-time md-typescale-headline-small">
                {formatDuration(selectedRoute.duration)}
              </span>
              <span className="md-typescale-body-medium dir-route-dist">
                {formatDistance(selectedRoute.distance)}
                {selectedRoute.traffic
                  ? ` · ${selectedRoute.traffic.label}`
                  : ""}
              </span>
              {selectedRoute.edited && comparison?.label ? (
                <span
                  className={`dir-route-delta tone-${comparison.tone} md-typescale-body-small`}
                >
                  {editBusy ? "Updating…" : comparison.label}
                </span>
              ) : null}
              {selectedRoute.reason ? (
                <p className="dir-route-reason md-typescale-body-small">
                  {selectedRoute.reason}
                </p>
              ) : null}
            </div>
            <div className="dir-selected-actions">
              {onSaveRoute ? (
                <button
                  type="button"
                  className={`dir-save-btn${routeIsSaved ? " is-saved" : ""}`}
                  aria-label={routeIsSaved ? "Unsave route" : "Save route"}
                  aria-pressed={routeIsSaved ? "true" : "false"}
                  onPointerDown={onSavePointerDown}
                  onPointerMove={onSavePointerMove}
                  onPointerUp={onSavePointerEnd}
                  onPointerCancel={onSavePointerEnd}
                  onClick={onSaveClick}
                >
                  <md-icon key={routeIsSaved ? "saved" : "unsaved"}>
                    {routeIsSaved ? "bookmark" : "bookmark_border"}
                  </md-icon>
                </button>
              ) : null}
            </div>
          </div>

          {saving && !isCompact ? (
            <form
              className="dir-save-inline"
              onSubmit={(e) => {
                e.preventDefault();
                submitSaveForm();
              }}
            >
              <div className={`dir-save-field${saveNameError ? " is-error" : ""}`}>
                <input
                  id="dir-save-route-name"
                  className="dir-save-field-input"
                  type="text"
                  value={saveName}
                  maxLength={80}
                  placeholder="Route name"
                  aria-label="Route name"
                  aria-invalid={saveNameError ? "true" : "false"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSaveName(v);
                    setSaveNameError(
                      v.length > 80
                        ? "Name must be 80 characters or fewer"
                        : "",
                    );
                  }}
                />
              </div>
              {saveNameError ? (
                <p className="dir-save-field-error md-typescale-body-small" role="alert">
                  {saveNameError}
                </p>
              ) : null}
              <div className="dir-save-actions btn-row">
                <md-filled-button
                  type="button"
                  disabled={Boolean(saveNameError) || undefined}
                  onClick={submitSaveForm}
                >
                  Save route
                </md-filled-button>
                <md-outlined-button
                  type="button"
                  onClick={closeSaveForm}
                >
                  Cancel
                </md-outlined-button>
              </div>
            </form>
          ) : null}

          {(selectedRoute.steps || []).length > 0 ? (
            <ol className="dir-inline-steps" aria-label="Turn-by-turn steps">
              {(selectedRoute.steps || []).map((s, i) => (
                <li key={`${s.instruction}-${i}`} className="dir-inline-step">
                  <span className="dir-inline-step-icon" aria-hidden>
                    <md-icon>{s.icon || "directions"}</md-icon>
                  </span>
                  <span className="dir-inline-step-body">
                    <span className="md-typescale-body-large">
                      {s.instruction}
                    </span>
                    {s.distance > 0 ? (
                      <span className="md-typescale-body-small dir-inline-step-dist">
                        {formatDistance(s.distance)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
        </div>

      {selectedRoute && onStart ? (
        <div className="dir-bottom-actions" role="toolbar" aria-label="Route actions">
          <md-filled-button
            type="button"
            class="dir-start-btn"
            onClick={onStart}
          >
            <span slot="icon" className="steps-start-icon" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M12 3.2 5.2 20.1l.65.34L12 17.4l6.15 3.04.65-.34z"
                />
              </svg>
            </span>
            Start
          </md-filled-button>
        </div>
      ) : null}
      </div>

      <SaveRouteSheet
        open={saving && isCompact}
        name={saveName}
        error={saveNameError}
        onNameChange={(v) => {
          setSaveName(v);
          setSaveNameError(
            v.length > 80 ? "Name must be 80 characters or fewer" : "",
          );
        }}
        onSave={submitSaveForm}
        onClose={closeSaveForm}
      />
    </section>
  );
}
