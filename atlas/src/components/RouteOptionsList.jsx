import { formatDistance, formatDuration } from "../utils/format";

/**
 * Lets the user pick among Fastest / Shortest / Alternative routes.
 * Routes are never auto-switched — selection is always explicit.
 *
 * `embedded` reuses the system place-suggest / landing list-row styling
 * (for the home Saved routes card) instead of bordered option cards.
 */
export default function RouteOptionsList({
  options = [],
  selectedId,
  onSelect,
  locked = false,
  onToggleLock,
  onDelete = null,
  embedded = false,
  title = "Route options",
  hint = "Pick the route you want. Maps will not switch it mid-trip unless you choose another option.",
}) {
  if (!options.length) return null;

  if (embedded) {
    return (
      <div className="route-options is-embedded">
        <ul className="place-suggest-list route-option-list" role="listbox">
          {options.map((opt) => {
            const active = selectedId != null && opt.id === selectedId;
            const meta = `${formatDuration(opt.duration)} · ${formatDistance(opt.distance)}`;
            return (
              <li key={opt.id}>
                <div
                  className={`landing-saved-item${active ? " is-active" : ""}`}
                >
                  <button
                    type="button"
                    className={`place-suggest-item landing-saved-open${
                      active ? " is-active" : ""
                    }`}
                    onClick={() => onSelect(opt)}
                  >
                    <span className="place-suggest-text landing-saved-open-text">
                      <span className="place-suggest-title landing-saved-open-title">
                        {opt.label}
                      </span>
                      <span className="place-suggest-sub landing-saved-open-meta">
                        {meta}
                      </span>
                    </span>
                    {active && !onDelete ? (
                      <md-icon class="route-check">check_circle</md-icon>
                    ) : null}
                  </button>
                  {onDelete ? (
                    <div className="landing-saved-actions">
                      <md-icon-button
                        type="button"
                        aria-label={`Delete ${opt.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(opt);
                        }}
                      >
                        <md-icon>delete</md-icon>
                      </md-icon-button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="route-options">
      <div className="route-options-header">
        <h3 className="md-typescale-title-small">{title}</h3>
        {onToggleLock && (
          <md-assist-chip
            label={locked ? "Route locked" : "Lock route"}
            selected={locked || undefined}
            onClick={onToggleLock}
            title="Prevent automatic changes to this route"
          >
            <md-icon slot="icon">{locked ? "lock" : "lock_open"}</md-icon>
          </md-assist-chip>
        )}
      </div>
      {hint ? (
        <p className="hint tight md-typescale-body-small">{hint}</p>
      ) : null}
      <div className="route-option-cards">
        {options.map((opt) => {
          const active = selectedId != null && opt.id === selectedId;
          return (
            <div
              key={opt.id}
              className={`route-option-row${active ? " is-active" : ""}${
                onDelete ? " has-delete" : ""
              }`}
            >
              <button
                type="button"
                className={`route-option-card${active ? " is-active" : ""}`}
                onClick={() => onSelect(opt)}
              >
                <div className="route-option-top">
                  <strong className="md-typescale-title-small">
                    {opt.label}
                  </strong>
                  {active && !onDelete && (
                    <md-icon class="route-check">check_circle</md-icon>
                  )}
                </div>
                <div className="md-typescale-body-medium">
                  {formatDuration(opt.duration)} · {formatDistance(opt.distance)}
                </div>
              </button>
              {onDelete ? (
                <div className="route-option-actions">
                  <md-icon-button
                    type="button"
                    aria-label={`Delete ${opt.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(opt);
                    }}
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

