import { formatDistance, formatDuration } from "../utils/format";
import ReroutePrompt from "./ReroutePrompt";

/**
 * Active turn-by-turn navigation (Feature 6 + 7).
 * Reroute suggestions interrupt here; Return to original stays available
 * after an accepted reroute.
 */
export default function NavigationUI({
  active = false,
  route,
  currentStepIndex = 0,
  onExit,
  rerouteSuggestion = null,
  onAcceptReroute = null,
  onRejectReroute = null,
  canReturnToOriginal = false,
  onReturnToOriginal = null,
  onDemoReroute = null,
}) {
  if (!route || !active) return null;

  const steps = route.steps || [];
  const step = steps[currentStepIndex] || steps[0];
  const nextStep = steps[currentStepIndex + 1];
  const showPrompt = Boolean(rerouteSuggestion);

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

      {showPrompt ? (
        <ReroutePrompt
          open
          suggestion={rerouteSuggestion}
          onAccept={onAcceptReroute}
          onReject={onRejectReroute}
        />
      ) : null}

      <div className="nav-footer">
        <div className="nav-footer-stats">
          <div className="nav-footer-eta md-typescale-headline-small">
            {formatDuration(route.duration)}
          </div>
          <div className="nav-footer-meta md-typescale-body-medium">
            {formatDistance(route.distance)} remaining
          </div>
        </div>
        <div className="nav-footer-actions">
          {!showPrompt && onDemoReroute ? (
            <md-outlined-button type="button" onClick={onDemoReroute}>
              Simulate reroute
            </md-outlined-button>
          ) : null}
          {canReturnToOriginal ? (
            <md-text-button type="button" onClick={onReturnToOriginal}>
              Return to original
            </md-text-button>
          ) : null}
          <md-filled-tonal-button type="button" onClick={onExit}>
            Exit
          </md-filled-tonal-button>
        </div>
      </div>
    </div>
  );
}
