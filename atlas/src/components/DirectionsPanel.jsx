import SuggestInput from "./SuggestInput";
import { formatDistance, formatDuration } from "../utils/format";

export default function DirectionsPanel({
  fromText,
  toText,
  onFromText,
  onToText,
  onFromSelect,
  onToSelect,
  onSwap,
  onSubmit,
  onClear,
  onUseCurrentFrom,
  onUseCurrentTo,
  currentLocation,
  geoStatus,
  summary,
  loading,
  error,
}) {
  const hasLocation = Boolean(currentLocation);

  return (
    <section className="mode-panel">
      <form
        className="directions-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        autoComplete="off"
      >
        <div className="stop-row">
          <span className="stop-dot start" aria-hidden />
          <SuggestInput
            id="dir-from"
            value={fromText}
            onChange={onFromText}
            onSelect={onFromSelect}
            placeholder="Starting point or Your location"
            currentLocation={currentLocation}
          />
        </div>
        <div className="stop-row">
          <span className="stop-dot end" aria-hidden />
          <SuggestInput
            id="dir-to"
            value={toText}
            onChange={onToText}
            onSelect={onToSelect}
            placeholder="Destination"
            currentLocation={currentLocation}
          />
        </div>

        <div className="btn-row wrap">
          <button
            className="btn btn-ghost loc-btn"
            type="button"
            onClick={onUseCurrentFrom}
            disabled={!hasLocation && geoStatus !== "locating"}
            title={
              hasLocation
                ? "Start from your current location"
                : "Waiting for location…"
            }
          >
            Start from my location
          </button>
          <button
            className="btn btn-ghost loc-btn"
            type="button"
            onClick={onUseCurrentTo}
            disabled={!hasLocation}
            title="Set destination to your current location"
          >
            End at my location
          </button>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Routing…" : "Get directions"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onSwap}
            title="Swap"
            aria-label="Swap start and destination"
          >
            ↕
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </form>

      {geoStatus === "denied" && (
        <p className="hint tight">
          Location access is blocked. Allow it in your browser to use “Your location”.
        </p>
      )}

      {error && <p className="error-msg">{error}</p>}

      {summary && (
        <div className="route-summary">
          <strong>
            {formatDuration(summary.duration)} · {formatDistance(summary.distance)}
          </strong>
          <span>Fastest driving route via OpenStreetMap roads</span>
        </div>
      )}

      {!summary && !error && (
        <p className="hint">
          Enter a start and destination, pick “Your location”, or right-click the map.
        </p>
      )}
    </section>
  );
}
