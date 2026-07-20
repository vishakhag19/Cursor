import SuggestInput from "./SuggestInput";
import { formatDistance, formatDuration, placeLabel } from "../utils/format";

const TRAVEL = [
  { id: "driving", icon: "directions_car", label: "Drive" },
  { id: "walking", icon: "directions_walk", label: "Walk" },
  { id: "cycling", icon: "directions_bike", label: "Bike" },
];

/**
 * Google Maps–style directions panel:
 * travel modes, A/B (+ optional stops), top shortest route options.
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
}) {
  const canRoute = stops.filter(Boolean).length >= 2;

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
                label={i === 0 ? "Starting point" : i === stops.length - 1 ? "Destination" : `Stop ${i}`}
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
        <span className="md-typescale-body-medium">Add destination</span>
      </button>

      <div className="btn-row">
        <md-filled-button type="button" onClick={onSearch} disabled={!canRoute || loading || undefined}>
          {loading ? "Finding routes…" : "Get directions"}
        </md-filled-button>
      </div>

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
              <button
                key={opt.id}
                type="button"
                className={`dir-route-card ${active ? "is-active" : ""}`}
                onClick={() => onSelectRoute(opt)}
              >
                {active && <span className="dir-route-bar" aria-hidden />}
                <div className="dir-route-body">
                  <div className="dir-route-title-row">
                    <md-icon class="dir-route-mode">{TRAVEL.find((t) => t.id === travelMode)?.icon || "directions_car"}</md-icon>
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
          Enter start and destination to see the {5} shortest route options.
          {stops[0] ? "" : " Tip: type “Your location” in Starting point."}
        </p>
      )}

      {stops.some(Boolean) && (
        <p className="hint tight md-typescale-body-small">
          Stops:{" "}
          {stops
            .map((s) => (s ? placeLabel(s) : "…"))
            .join(" → ")}
        </p>
      )}
    </section>
  );
}
