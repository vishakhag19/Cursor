import { formatDistance, formatDuration } from "../utils/format";

/** Turn-by-turn steps — panel-embedded or floating sheet. */
export default function StepsSheet({
  route,
  onClose,
  onStart,
  embedded = false,
  className = "",
}) {
  if (!route) return null;
  const steps = route.steps || [];

  return (
    <div
      className={`steps-sheet ${embedded ? "is-embedded" : ""} ${className}`.trim()}
      role={embedded ? "region" : "dialog"}
      aria-label="Trip steps"
    >
      <div className="steps-sheet-header">
        <md-icon-button type="button" aria-label="Back" onClick={onClose}>
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <div className="steps-sheet-heading">
          <div className="md-typescale-title-medium">Steps</div>
          <div className="md-typescale-body-small steps-sheet-meta">
            {formatDuration(route.duration)} · {formatDistance(route.distance)}
          </div>
        </div>
      </div>
      <ol className="steps-list">
        {steps.map((s, i) => (
          <li key={`${s.instruction}-${i}`} className="steps-item">
            <span className="steps-item-icon" aria-hidden>
              <md-icon>{s.icon || "directions"}</md-icon>
            </span>
            <span className="steps-item-body">
              <span className="steps-item-text md-typescale-body-large">
                {s.instruction}
              </span>
              {s.distance > 0 && (
                <span className="steps-item-dist md-typescale-body-medium">
                  {formatDistance(s.distance)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="steps-sheet-footer">
        <md-filled-button type="button" class="steps-start-btn" onClick={onStart}>
          <span slot="icon" className="steps-start-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
              <path
                fill="currentColor"
                d="M12 3.2 5.2 20.1l.65.34L12 17.4l6.15 3.04.65-.34z"
              />
            </svg>
          </span>
          Start
        </md-filled-button>
      </div>
    </div>
  );
}
