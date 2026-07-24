import { useEffect, useRef, useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceSuggestionList from "./PlaceSuggestionList";
import ActionTip from "./ActionTip";
import { formatDistance, formatDuration } from "../utils/format";
import { TRAVEL_MODES, travelModeMeta } from "../utils/routePreferences";

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
  canUndo = false,
  onUndo,
  canReset = false,
  onResetSuggested,
  comparison = null,
  editBusy = false,
  onShowSteps = null,
  onSaveRoute = null,
  onOpenAssistant = null,
  onOpenPrefs = null,
  onOpenRoadRules = null,
  hasCustomEdits = false,
  travelMode = "driving",
  onTravelMode = null,
  showTollPassPrices = false,
}) {
  const [activeStop, setActiveStop] = useState(null);
  const [forceShowStops, setForceShowStops] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);
  const [placeList, setPlaceList] = useState({
    open: false,
    items: [],
    query: "",
    loading: false,
    select: null,
  });
  const wasLoadingRef = useRef(false);

  function handleListChange(index, payload) {
    if (activeStop !== index && !payload.open) return;
    if (payload.open || activeStop === index) {
      setPlaceList(payload);
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

  return (
    <section
      className={`mode-panel directions-panel ${hasCustomEdits ? "has-custom-edits" : ""} ${hasRouteResults ? "has-route-results" : ""} ${forceShowStops ? "show-stops" : ""}`}
    >
      <div className="dir-top-bar">
        <md-icon-button
          type="button"
          aria-label="Back to search"
          onClick={onClose}
        >
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <span className="md-typescale-title-medium dir-title">Directions</span>
        <div className="dir-top-actions">
          {onOpenPrefs ? (
            <ActionTip tip="Route preferences">
              <md-icon-button
                type="button"
                class="dir-prefs-btn"
                aria-label="Route preferences"
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

      {modeMeta.unsupported ? (
        <p className="hint tight md-typescale-body-medium" role="status">
          Public transit isn’t available in this prototype yet. Try Drive,
          Walk, or Bicycle.
        </p>
      ) : null}

      <div className="dir-stops-block">
        <div className="dir-stops">
          <div className="dir-stops-rail" aria-hidden>
            {stops.map((_, i) => (
              <span
                key={`dot-${i}`}
                className={`dir-rail-dot ${i === 0 ? "start" : i === stops.length - 1 ? "end" : "mid"}`}
              />
            ))}
          </div>

          <div className="dir-stops-fields">
            {stops.map((stop, i) => (
              <div className="dir-stop-row" key={`stop-${i}`}>
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
                  allowCurrentLocation={i === 0 || i === stops.length - 1}
                  recentPlaces={recentPlaces}
                  near={near}
                  onRequestLocation={onRequestLocation}
                  externalList
                  onFocusField={() => setActiveStop(i)}
                  onListChange={(payload) => handleListChange(i, payload)}
                />
                {stops.length > 2 && i > 0 && i < stops.length - 1 ? (
                  <div className="dir-stop-reorder">
                    {onMoveStop ? (
                      <>
                        <md-icon-button
                          type="button"
                          aria-label="Move stop up"
                          disabled={i <= 1 || undefined}
                          onClick={() => onMoveStop(i, i - 1)}
                        >
                          <md-icon>arrow_upward</md-icon>
                        </md-icon-button>
                        <md-icon-button
                          type="button"
                          aria-label="Move stop down"
                          disabled={i >= stops.length - 2 || undefined}
                          onClick={() => onMoveStop(i, i + 1)}
                        >
                          <md-icon>arrow_downward</md-icon>
                        </md-icon-button>
                      </>
                    ) : null}
                    <md-icon-button
                      type="button"
                      aria-label="Remove stop"
                      onClick={() => onRemoveStop(i)}
                    >
                      <md-icon>remove_circle_outline</md-icon>
                    </md-icon-button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

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

        <button type="button" className="dir-add-stop" onClick={onAddStop}>
          <md-icon>add</md-icon>
          <span className="md-typescale-body-medium">Add stop</span>
        </button>
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
          Drag the blue route to reshape · tap a card to preview · long-press a
          road for Prefer / Avoid / Never
        </p>
      )}

      {routeOptions.length > 0 && (
        <div className="dir-route-list" role="list" aria-label="Recommended routes">
          {routeOptions.map((opt, index) => {
            const active = opt.id === selectedRouteId;
            return (
              <div
                key={opt.id}
                role="listitem"
                className={`dir-route-card ${active ? "is-active" : ""} ${active && opt.edited ? "is-editing" : ""}`}
              >
                <button
                  type="button"
                  className="dir-route-select"
                  onClick={() => onSelectRoute(opt)}
                >
                  <div className="dir-route-body">
                    <div className="dir-route-title-row">
                      <md-icon class="dir-route-mode">{modeMeta.icon}</md-icon>
                      <div>
                        <div className="md-typescale-title-small">
                          {opt.label}
                        </div>
                        {opt.badge && (
                          <div className="md-typescale-body-small dir-route-badge">
                            {opt.badge}
                          </div>
                        )}
                        {!opt.badge && index > 0 && (
                          <div className="md-typescale-body-small dir-route-badge muted">
                            Option {index + 1}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="dir-route-stats">
                      <span className="dir-route-time md-typescale-title-medium">
                        {formatDuration(opt.duration)}
                      </span>
                      <span className="md-typescale-body-medium dir-route-dist">
                        {formatDistance(opt.distance)}
                      </span>
                      {opt.traffic ? (
                        <span
                          className="dir-route-traffic"
                          style={{ color: opt.traffic.color }}
                          title={opt.traffic.label}
                        >
                          <md-icon>{opt.traffic.icon}</md-icon>
                          <span className="md-typescale-body-small">
                            {opt.traffic.label}
                          </span>
                        </span>
                      ) : null}
                      {active && opt.edited && comparison?.label ? (
                        <span
                          className={`dir-route-delta tone-${comparison.tone} md-typescale-body-small`}
                          role="status"
                          title={comparison.label}
                        >
                          {editBusy
                            ? "Updating travel time…"
                            : comparison.label}
                        </span>
                      ) : null}
                    </div>
                    {opt.reason ? (
                      <p className="dir-route-reason md-typescale-body-small">
                        {opt.reason}
                      </p>
                    ) : null}
                    {opt.tradeOff && !active ? (
                      <p className="dir-route-tradeoff md-typescale-body-small">
                        vs recommended: {opt.tradeOff}
                      </p>
                    ) : null}
                    {opt.metrics?.turns != null ? (
                      <p className="dir-route-meta md-typescale-body-small">
                        {opt.metrics.turns} turn
                        {opt.metrics.turns === 1 ? "" : "s"}
                        {opt.metrics.highwayShare > 0.2
                          ? ` · ${Math.round(opt.metrics.highwayShare * 100)}% highway`
                          : " · mostly surface streets"}
                        {showTollPassPrices && opt.metrics?.mayHaveTolls
                          ? " · Toll pass ~$3–8"
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </button>
                {active ? (
                  <div className="dir-route-actions">
                    {onShowSteps && !saving ? (
                      <ActionTip tip="Steps">
                        <md-icon-button
                          type="button"
                          class="dir-route-steps-btn"
                          aria-label="View turn-by-turn steps"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(null);
                            onShowSteps();
                          }}
                        >
                          <md-icon>list</md-icon>
                        </md-icon-button>
                      </ActionTip>
                    ) : null}
                    {!saving ? (
                      <div
                        className="dir-route-more"
                        ref={menuFor === opt.id ? menuRef : null}
                      >
                        <ActionTip tip="More">
                          <md-icon-button
                            type="button"
                            class="dir-route-more-btn"
                            aria-label="More route actions"
                            aria-haspopup="menu"
                            aria-expanded={
                              menuFor === opt.id ? "true" : "false"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor((id) =>
                                id === opt.id ? null : opt.id,
                              );
                            }}
                          >
                            <md-icon>more_vert</md-icon>
                          </md-icon-button>
                        </ActionTip>
                        {menuFor === opt.id ? (
                          <div className="dir-route-menu" role="menu">
                            {onSaveRoute ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuFor(null);
                                  const from = stops[0]?.name || "Start";
                                  const to =
                                    stops[stops.length - 1]?.name ||
                                    "Destination";
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
                            {canUndo ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuFor(null);
                                  onUndo?.();
                                }}
                              >
                                <md-icon>undo</md-icon>
                                Undo
                              </button>
                            ) : null}
                            {canReset ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuFor(null);
                                  onResetSuggested?.();
                                }}
                              >
                                <md-icon>restart_alt</md-icon>
                                Reset to original
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {active && saving ? (
                  <form
                    className="dir-save-inline"
                    onClick={(e) => e.stopPropagation()}
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
