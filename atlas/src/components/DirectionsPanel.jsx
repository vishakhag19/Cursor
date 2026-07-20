import SuggestInput from "./SuggestInput";
import { formatDistance, formatDuration, placeLabel } from "../utils/format";

const TRAVEL = [
  { id: "driving", icon: "directions_car", label: "Drive" },
  { id: "walking", icon: "directions_walk", label: "Walk" },
  { id: "cycling", icon: "directions_bike", label: "Bike" },
];

/**
 * Google Maps–style directions panel with interactive route editing controls.
 */
export default function DirectionsPanel({
  stops,
  stopTexts,
  onStopText,
  onStopSelect,
  onAddStop,
  onRemoveStop,
  onSwap,
  travelMode,
  onTravelMode,
  onClose,
  onSearch,
  routeOptions,
  selectedRouteId,
  onSelectRoute,
  loading,
  error,
  currentLocation,
  near = null,
  editMode = false,
  onToggleEdit,
  canUndo = false,
  onUndo,
  canReset = false,
  onResetSuggested,
  comparison = null,
  editBusy = false,
}) {
  const canRoute = stops.filter(Boolean).length >= 2;
  const hasRoutes = routeOptions.length > 0;

  return (
    <section className="mode-panel directions-panel">
      <div className="dir-modes" role="tablist" aria-label="Travel mode">
        {TRAVEL.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            className={`dir-mode ${travelMode === m.id ? "is-active" : ""}`}
            aria-selected={travelMode === m.id}
            onClick={() => onTravelMode(m.id)}
            title={m.label}
          >
            <md-icon>{m.icon}</md-icon>
          </button>
        ))}
        <span className="dir-modes-spacer" />
        <md-icon-button type="button" aria-label="Close directions" onClick={onClose}>
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>

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
                onSelect={(place) => onStopSelect(i, place)}
                placeholder={
                  i === 0
                    ? "Choose starting point"
                    : i === stops.length - 1
                      ? "Choose destination"
                      : "Add stop"
                }
                currentLocation={currentLocation}
                allowCurrentLocation={i === 0}
                near={near}
              />
              {stops.length > 2 && (
                <md-icon-button
                  type="button"
                  aria-label="Remove stop"
                  onClick={() => onRemoveStop(i)}
                >
                  <md-icon>close</md-icon>
                </md-icon-button>
              )}
            </div>
          ))}
        </div>

        <md-icon-button
          class="dir-swap"
          type="button"
          aria-label="Swap start and destination"
          onClick={onSwap}
        >
          <md-icon>swap_vert</md-icon>
        </md-icon-button>
      </div>

      <button type="button" className="dir-add-stop" onClick={onAddStop}>
        <md-icon>add</md-icon>
        <span className="md-typescale-body-medium">Add Stops</span>
      </button>

      <div className="btn-row wrap">
        <md-filled-button
          type="button"
          onClick={onSearch}
          disabled={!canRoute || loading || undefined}
        >
          {loading ? "Finding routes…" : "Get directions"}
        </md-filled-button>
        {hasRoutes && (
          <md-filled-tonal-button
            type="button"
            onClick={onToggleEdit}
            class={editMode ? "is-edit-active" : ""}
          >
            <md-icon slot="icon">{editMode ? "close" : "edit_location_alt"}</md-icon>
            {editMode ? "Done editing" : "Edit route"}
          </md-filled-tonal-button>
        )}
      </div>

      {editMode && (
        <div className="edit-toolbar">
          <p className="hint md-typescale-body-small edit-hint">
            Drag any point on the blue route to bend it through a new street.
            Atlas snaps to the nearest road and previews the path live.
          </p>

          {comparison && (
            <div
              className={`comparison-chip tone-${comparison.tone}`}
              role="status"
            >
              <md-icon>
                {comparison.tone === "better"
                  ? "trending_down"
                  : comparison.tone === "worse"
                    ? "trending_up"
                    : "schedule"}
              </md-icon>
              <span className="md-typescale-label-large">{comparison.label}</span>
              {editBusy && (
                <span className="comparison-busy md-typescale-label-small">
                  Updating…
                </span>
              )}
            </div>
          )}

          <div className="btn-row wrap edit-actions">
            <md-outlined-button
              type="button"
              onClick={onUndo}
              disabled={!canUndo || undefined}
            >
              <md-icon slot="icon">undo</md-icon>
              Undo
            </md-outlined-button>
            <md-outlined-button
              type="button"
              onClick={onResetSuggested}
              disabled={!canReset || undefined}
            >
              <md-icon slot="icon">restart_alt</md-icon>
              Reset to suggested
            </md-outlined-button>
          </div>
        </div>
      )}

      {error && (
        <p className="error-msg md-typescale-body-medium" role="alert">
          {error}
        </p>
      )}

      {routeOptions.length > 0 && (
        <div className="dir-route-list">
          <p className="hint tight md-typescale-body-small">
            {editMode
              ? "Editing the selected route. Finish editing to compare other options."
              : "Tap a route below or click its line on the map."}
          </p>
          {routeOptions.map((opt, index) => {
            const active = opt.id === selectedRouteId;
            return (
              <button
                key={opt.id}
                type="button"
                className={`dir-route-card ${active ? "is-active" : ""}`}
                onClick={() => onSelectRoute(opt)}
                disabled={editMode && !active ? true : undefined}
              >
                {active && <span className="dir-route-bar" aria-hidden />}
                <div className="dir-route-body">
                  <div className="dir-route-title-row">
                    <md-icon class="dir-route-mode">
                      {TRAVEL.find((t) => t.id === travelMode)?.icon ||
                        "directions_car"}
                    </md-icon>
                    <div>
                      <div className="md-typescale-title-small">{opt.label}</div>
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
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!routeOptions.length && !error && !loading && (
        <p className="hint md-typescale-body-medium">
          Enter start and destination to see the shortest route options.
          {stops[0]
            ? ""
            : " Tap Starting point to use Your location or pick a place."}
        </p>
      )}

      {stops.some(Boolean) && (
        <p className="hint tight md-typescale-body-small">
          Stops:{" "}
          {stops.map((s) => (s ? placeLabel(s) : "…")).join(" → ")}
        </p>
      )}
    </section>
  );
}
