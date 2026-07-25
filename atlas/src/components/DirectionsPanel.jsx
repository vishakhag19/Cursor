import { useEffect, useRef, useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceSuggestionList from "./PlaceSuggestionList";
import ActionTip from "./ActionTip";
import { formatDistance, formatDuration } from "../utils/format";
import {
  TRAVEL_MODES,
  travelModeMeta,
  ROUTE_OPTION_FIELDS,
} from "../utils/routePreferences";

const AVOID_CHIP_FIELDS = ROUTE_OPTION_FIELDS.filter((f) =>
  ["avoidTolls", "avoidHighways", "avoidFerries"].includes(f.id),
);

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
  onOpenAssistant = null,
  onOpenPrefs = null,
  prefsOpen = false,
  onOpenRoadRules = null,
  hasCustomEdits = false,
  travelMode = "driving",
  onTravelMode = null,
  showTollPassPrices = false,
  routePrefs = null,
  onRoutePrefsChange = null,
}) {
  const [activeStop, setActiveStop] = useState(null);
  const [forceShowStops, setForceShowStops] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const menuRef = useRef(null);
  const dragGhostRef = useRef(null);
  const [placeList, setPlaceList] = useState({
    open: false,
    items: [],
    query: "",
    loading: false,
    select: null,
  });
  const wasLoadingRef = useRef(false);

  function clearDragGhost() {
    const ghost = dragGhostRef.current;
    if (ghost?.parentNode) ghost.parentNode.removeChild(ghost);
    dragGhostRef.current = null;
  }

  function beginStopDrag(e, index) {
    e.dataTransfer.setData("text/atlas-stop", String(index));
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";

    const field = e.currentTarget.closest(".dir-stop-field");
    const label =
      index === 0
        ? "Starting point"
        : index === stops.length - 1
          ? "Destination"
          : `Stop ${index}`;
    const value = (stopTexts[index] || "").trim() || label;

    clearDragGhost();
    const ghost = document.createElement("div");
    ghost.className = "dir-stop-drag-ghost";
    ghost.innerHTML =
      '<span class="dir-stop-drag-ghost-label"></span><span class="dir-stop-drag-ghost-value"></span>';
    ghost.querySelector(".dir-stop-drag-ghost-label").textContent = label;
    ghost.querySelector(".dir-stop-drag-ghost-value").textContent = value;
    const width = field?.offsetWidth || 260;
    ghost.style.width = `${width}px`;
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;

    const rect = ghost.getBoundingClientRect();
    const offsetX = field
      ? Math.min(
          Math.max(e.clientX - field.getBoundingClientRect().left, 16),
          width - 16,
        )
      : rect.width - 28;
    const offsetY = rect.height / 2;
    e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    setDragFrom(index);
    setDragOver(index);
  }

  function endStopDrag() {
    clearDragGhost();
    setDragFrom(null);
    setDragOver(null);
  }

  useEffect(() => () => clearDragGhost(), []);

  function handleListChange(index, payload) {
    // Opening always wins for that field (activeStop setState can lag focus).
    if (payload.open) {
      setActiveStop(index);
      setPlaceList(payload);
      return;
    }
    // Ignore close events from fields that no longer own the list.
    setActiveStop((current) => {
      if (current != null && current !== index) return current;
      setPlaceList(payload);
      return current === index ? null : current;
    });
  }

  function clearPlaceList() {
    setPlaceList({
      open: false,
      items: [],
      query: "",
      loading: false,
      select: null,
    });
    setActiveStop(null);
  }

  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
      return;
    }
    if (wasLoadingRef.current && routeOptions.length > 0) {
      wasLoadingRef.current = false;
      setForceShowStops(false);
      clearPlaceList();
    }
  }, [loading, routeOptions.length]);

  useEffect(() => {
    if (menuFor == null) return undefined;
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuFor(null);
      }
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menuFor]);

  const bothEndsSet = stops.filter(Boolean).length >= 2;
  const hasRouteResults = bothEndsSet && routeOptions.length > 0;
  const modeMeta = travelModeMeta(travelMode);
  const modesRef = useRef(null);
  const selectedRoute =
    routeOptions.find((r) => r.id === selectedRouteId) ||
    routeOptions[0] ||
    null;

  useEffect(() => {
    const root = modesRef.current;
    if (!root) return;
    const active = root.querySelector('.dir-travel-mode.is-active');
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [travelMode]);

  return (
    <section
      className={`mode-panel directions-panel ${hasCustomEdits ? "has-custom-edits" : ""} ${hasRouteResults ? "has-route-results" : ""} ${forceShowStops ? "show-stops" : ""}`}
    >
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
            {hasRouteResults ? modeMeta.label || "Directions" : "Directions"}
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

        {routePrefs && onRoutePrefsChange ? (
          <div className="dir-avoid-chips" role="group" aria-label="Avoid">
            {AVOID_CHIP_FIELDS.map((f) => {
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

      {modeMeta.unsupported ? (
        <p className="hint tight md-typescale-body-medium" role="status">
          Public transit isn’t available in this prototype yet. Try Drive,
          Walk, or Bicycle.
        </p>
      ) : null}

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
              const rowClass = [
                "dir-stop-row",
                multi ? "has-controls" : "",
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
                onDragOver={
                  multi
                    ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOver !== i) setDragOver(i);
                      }
                    : undefined
                }
                onDragLeave={
                  multi
                    ? (e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setDragOver((cur) => (cur === i ? null : cur));
                        }
                      }
                    : undefined
                }
                onDrop={
                  multi
                    ? (e) => {
                        e.preventDefault();
                        const raw =
                          e.dataTransfer.getData("text/atlas-stop") ||
                          e.dataTransfer.getData("text/plain");
                        endStopDrag();
                        if (raw === "" || raw == null) return;
                        const from = Number(raw);
                        if (
                          Number.isFinite(from) &&
                          from >= 0 &&
                          from < stops.length &&
                          onMoveStop
                        ) {
                          onMoveStop(from, i);
                        }
                      }
                    : undefined
                }
              >
                <div className="dir-stop-field">
                  <SuggestInput
                    id={`dir-stop-${i}`}
                    label={
                      i === 0
                        ? "Starting point"
                        : i === stops.length - 1
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
                      i === 0
                        ? "Choose starting point"
                        : i === stops.length - 1
                          ? "Choose destination"
                          : "Add stop"
                    }
                    currentLocation={currentLocation}
                    allowCurrentLocation
                    recentPlaces={recentPlaces}
                    near={near}
                    onRequestLocation={onRequestLocation}
                    externalList
                    onFocusField={() => setActiveStop(i)}
                    onListChange={(payload) => handleListChange(i, payload)}
                  />
                  {multi ? (
                    <div className="dir-stop-reorder">
                      <div
                        className="dir-stop-drag"
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to reorder"
                        title="Drag to reorder"
                        draggable
                        onDragStart={(e) => beginStopDrag(e, i)}
                        onDragEnd={endStopDrag}
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
                      </div>
                      <md-icon-button
                        type="button"
                        aria-label="Remove stop"
                        onClick={() => onRemoveStop(i)}
                      >
                        <md-icon>close</md-icon>
                      </md-icon-button>
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>

          {stops.length <= 2 ? (
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
        </div>

        {placeList.open && (placeList.items.length > 0 || placeList.loading) && (
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
        )}

        {/* Hide while suggestions are open — avoids a second Add stop under the list */}
        {!(placeList.open && (placeList.items.length > 0 || placeList.loading)) ? (
          <button type="button" className="dir-add-stop" onClick={onAddStop}>
            <md-icon>add</md-icon>
            <span className="md-typescale-body-medium">Add stop</span>
          </button>
        ) : null}
      </div>

      {loading && (
        <p className="hint tight md-typescale-body-medium" role="status">
          Finding routes…
        </p>
      )}

      {error && (
        <p className="error-msg md-typescale-body-medium" role="alert">
          {error}
        </p>
      )}

      {hasRouteResults && (
        <p className="dir-drag-hint md-typescale-body-small">
          Drag the blue route to reshape · tap another route on the map to
          switch · long-press a road for Prefer / Avoid / Never
        </p>
      )}

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
              {onStart ? (
                <md-filled-button
                  type="button"
                  class="dir-start-btn dir-start-btn-inline"
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
              ) : null}
              <div className="dir-route-more" ref={menuRef}>
                <ActionTip tip="More">
                  <md-icon-button
                    type="button"
                    aria-label="More route actions"
                    aria-haspopup="menu"
                    aria-expanded={menuFor ? "true" : "false"}
                    onClick={() =>
                      setMenuFor((v) => (v ? null : "selected"))
                    }
                  >
                    <md-icon>more_vert</md-icon>
                  </md-icon-button>
                </ActionTip>
                {menuFor ? (
                  <div className="dir-route-menu" role="menu">
                    {onSaveRoute ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          const from = stops[0]?.name || "Start";
                          const to =
                            stops[stops.length - 1]?.name || "Destination";
                          setSaveName(`${from} to ${to}`);
                          setSaving(true);
                        }}
                      >
                        <md-icon>bookmark</md-icon>
                        Save route
                      </button>
                    ) : null}
                    {onOpenRoadRules ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          onOpenRoadRules();
                        }}
                      >
                        <md-icon>rule</md-icon>
                        Your road rules
                      </button>
                    ) : null}
                    {onOpenAssistant ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          onOpenAssistant();
                        }}
                      >
                        <md-icon>auto_awesome</md-icon>
                        Ask assistant
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {saving ? (
            <form
              className="dir-save-inline"
              onSubmit={(e) => {
                e.preventDefault();
                const name = saveName.trim() || "Saved route";
                onSaveRoute?.(name);
                setSaving(false);
                setSaveName("");
              }}
            >
              <input
                className="dir-save-input md-typescale-body-medium"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                maxLength={80}
                placeholder="Route name (optional)"
                aria-label="Route name"
                autoFocus
              />
              <div className="dir-save-actions">
                <md-text-button
                  type="button"
                  onClick={() => {
                    setSaving(false);
                    setSaveName("");
                  }}
                >
                  Cancel
                </md-text-button>
                <md-filled-tonal-button type="submit">
                  Save path
                </md-filled-tonal-button>
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
          <md-outlined-button type="button" onClick={onAddStop}>
            <md-icon slot="icon">add</md-icon>
            Add stops
          </md-outlined-button>
        </div>
      ) : null}
    </section>
  );
}
