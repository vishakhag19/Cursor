import { formatDistance, formatDuration } from "../utils/format";

/** Turn-by-turn steps — panel-embedded or floating sheet. */
export default function StepsSheet({
  route,
  onClose,
  onStart,
  embedded = false,
}) {
  if (!route) return null;
  const steps = route.steps || [];

  return (
    <div
      className={`steps-sheet ${embedded ? "is-embedded" : ""}`}
      role={embedded ? "region" : "dialog"}
      aria-label="Trip steps"
    >
      <div className="steps-sheet-header">
        <div>
          <div className="md-typescale-title-medium">Steps</div>
          <div className="md-typescale-body-small steps-sheet-meta">
            {formatDuration(route.duration)} · {formatDistance(route.distance)}
          </div>
        </div>
        <md-icon-button type="button" aria-label="Close steps" onClick={onClose}>
          <md-icon>close</md-icon>
        </md-icon-button>
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
        <md-filled-button type="button" onClick={onStart}>
          <md-icon slot="icon">navigation</md-icon>
          Start
        </md-filled-button>
      </div>
    </div>
  );
}
