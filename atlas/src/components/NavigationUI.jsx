import { formatDistance, formatDuration } from "../utils/format";

/**
 * Google Maps mobile–style navigation chrome.
 * - Idle (pre-start): bottom sheet with ETA + Start
 * - Active: top maneuver banner + bottom trip summary + Exit
 */
export default function NavigationUI({
  active = false,
  route,
  destinationName = "Destination",
  currentStepIndex = 0,
  onStart,
  onExit,
  onShowSteps,
}) {
  if (!route) return null;

  const steps = route.steps || [];
  const step = steps[currentStepIndex] || steps[0];
  const nextStep = steps[currentStepIndex + 1];

  if (!active) {
    return (
      <div className="nav-sheet" role="region" aria-label="Start navigation">
        <div className="nav-sheet-handle" aria-hidden />
        <div className="nav-sheet-summary">
          <div>
            <div className="nav-sheet-eta md-typescale-headline-small">
              {formatDuration(route.duration)}
            </div>
            <div className="nav-sheet-meta md-typescale-body-medium">
              {formatDistance(route.distance)}
              {destinationName ? ` · to ${destinationName}` : ""}
            </div>
          </div>
        </div>
        <div className="nav-sheet-actions">
          <md-filled-button class="nav-start-btn" type="button" onClick={onStart}>
            <md-icon slot="icon">navigation</md-icon>
            Start
          </md-filled-button>
          {steps.length > 0 && (
            <md-outlined-button type="button" onClick={onShowSteps}>
              Steps
            </md-outlined-button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="nav-active" role="region" aria-label="Navigation">
      <div className="nav-banner">
        <div className="nav-banner-icon" aria-hidden>
          <md-icon>{step?.icon || "navigation"}</md-icon>
        </div>
        <div className="nav-banner-body">
          {step?.distance > 0 && (
            <div className="nav-banner-distance md-typescale-title-medium">
              {formatDistance(step.distance)}
            </div>
          )}
          <div className="nav-banner-instruction md-typescale-title-large">
            {step?.instruction || "Continue on the route"}
          </div>
          {nextStep && (
            <div className="nav-banner-then md-typescale-body-medium">
              Then: {nextStep.instruction}
            </div>
          )}
        </div>
        <md-icon-button
          type="button"
          class="nav-exit-btn"
          aria-label="Exit navigation"
          onClick={onExit}
        >
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>

      <div className="nav-footer">
        <div className="nav-footer-stats">
          <div className="nav-footer-eta md-typescale-headline-small">
            {formatDuration(route.duration)}
          </div>
          <div className="nav-footer-meta md-typescale-body-medium">
            {formatDistance(route.distance)} remaining
          </div>
        </div>
        <md-filled-tonal-button type="button" onClick={onExit}>
          Exit
        </md-filled-tonal-button>
      </div>
    </div>
  );
}
