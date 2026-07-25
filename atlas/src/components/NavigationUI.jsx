import { createPortal } from "react-dom";
import { formatDistance, formatDuration } from "../utils/format";
import ReroutePrompt from "./ReroutePrompt";

/**
 * Active turn-by-turn navigation — Google Maps mobile layout:
 * dark teal maneuver banner + bottom bar with close, ETA, alt routes.
 * Portaled to document.body so map / panel stacking cannot swallow Exit.
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
  onShowAlternatives = null,
}) {
  if (!route || !active || typeof document === "undefined") return null;

  const steps = route.steps || [];
  const step = steps[currentStepIndex] || steps[0];
  const nextStep = steps[currentStepIndex + 1];
  const showPrompt = Boolean(rerouteSuggestion);

  function handleExit(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onExit?.();
  }

  return createPortal(
    <div className="nav-active" role="region" aria-label="Navigation">
      <div className="nav-banner-stack">
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
          </div>
        <button
          type="button"
          className="nav-banner-close"
          aria-label="Exit navigation"
          onClick={handleExit}
        >
          <md-icon>close</md-icon>
        </button>
        </div>
        {nextStep ? (
          <div className="nav-banner-then" aria-label="Then">
            <span className="nav-banner-then-label">Then</span>
            <md-icon>{nextStep.icon || "arrow_upward"}</md-icon>
          </div>
        ) : null}
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
        <button
          type="button"
          className="nav-footer-close"
          aria-label="Exit navigation"
          onClick={handleExit}
        >
          <md-icon>close</md-icon>
        </button>

        <div className="nav-footer-stats">
          <div className="nav-footer-eta md-typescale-headline-small">
            {formatDuration(route.duration)}
            <md-icon class="nav-footer-eco" aria-hidden>
              eco
            </md-icon>
          </div>
          <div className="nav-footer-meta md-typescale-body-medium">
            {formatDistance(route.distance)}
            {canReturnToOriginal ? " · Rerouted" : ""}
          </div>
          {canReturnToOriginal ? (
            <button
              type="button"
              className="nav-footer-return"
              onClick={onReturnToOriginal}
            >
              Return to original
            </button>
          ) : null}
        </div>

        {onShowAlternatives ? (
          <button
            type="button"
            className="nav-footer-alts"
            aria-label="Show alternate routes"
            onClick={onShowAlternatives}
          >
            <md-icon>alt_route</md-icon>
          </button>
        ) : (
          <span className="nav-footer-alts-spacer" aria-hidden />
        )}
      </div>
    </div>,
    document.body,
  );
}
