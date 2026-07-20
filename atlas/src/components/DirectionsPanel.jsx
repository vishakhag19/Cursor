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
  summary,
  loading,
  error,
}) {
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
            placeholder="Starting point"
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
          />
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
          Enter a start and destination, or right-click the map to set points.
        </p>
      )}
    </section>
  );
}
