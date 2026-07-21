import SuggestInput from "./SuggestInput";
import { formatDistance, formatDuration, placeLabel } from "../utils/format";

/**
 * Directions panel — Material Web controls, edit pencil on the selected route.
 */
export default function DirectionsPanel({
  stops,
  stopTexts,
  onStopText,
  onStopSelect,
  onAddStop,
  onRemoveStop,
  onSwap,
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
      <div className="dir-top-bar">
        <span className="md-typescale-title-medium dir-title">Directions</span>
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

      <div className="btn-row">
        <md-filled-button
          type="button"
          onClick={onSearch}
          disabled={!canRoute || loading || undefined}
        >
          {loading ? "Finding routes…" : "Get directions"}
        </md-filled-button>
      </div>

      {editMode && (
        <div className="edit-toolbar">
          <div className="edit-toolbar-head">
            <p className="hint md-typescale-body-small edit-hint">
              Drag the route to bend it. Release to drop a via point.
            </p>
            <md-filled-tonal-button type="button" onClick={onToggleEdit}>
              <md-icon slot="icon">check</md-icon>
              Done
            </md-filled-tonal-button>
          </div>

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
              Reset
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
          {routeOptions.map((opt, index) => {
            const active = opt.id === selectedRouteId;
            return (
              <div
                key={opt.id}
                className={`dir-route-card ${active ? "is-active" : ""} ${editMode && active ? "is-editing" : ""}`}
              >
                {active && <span className="dir-route-bar" aria-hidden />}
                <button
                  type="button"
                  className="dir-route-select"
                  onClick={() => onSelectRoute(opt)}
                  disabled={editMode && !active ? true : undefined}
                >
                  <div className="dir-route-body">
                    <div className="dir-route-title-row">
                      <md-icon class="dir-route-mode">directions_car</md-icon>
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
                {active && (
                  <md-icon-button
                    type="button"
                    class={`dir-route-edit-btn ${editMode ? "is-edit-active" : ""}`}
                    aria-label={editMode ? "Done editing" : "Edit route"}
                    title={editMode ? "Done editing" : "Edit route"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEdit();
                    }}
                  >
                    <md-icon>{editMode ? "check" : "edit"}</md-icon>
                  </md-icon-button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!routeOptions.length && !error && !loading && (
        <p className="hint md-typescale-body-medium">
          Enter start and destination, then get directions.
        </p>
      )}

      {hasRoutes && stops.some(Boolean) && (
        <p className="hint tight md-typescale-body-small dir-stops-summary">
          {stops.map((s) => (s ? placeLabel(s) : "…")).join(" → ")}
        </p>
      )}
    </section>
  );
}
