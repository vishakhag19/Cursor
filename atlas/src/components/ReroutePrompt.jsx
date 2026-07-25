import { useEffect, useRef } from "react";

/**
 * Mid-navigation reroute interruption (Feature 6).
 * Accept and Reject are equally prominent — neither is buried.
 * Publishes its height so map controls (layers / recenter) can lift above it.
 */
export default function ReroutePrompt({
  open,
  suggestion,
  onAccept,
  onReject,
}) {
  const rootRef = useRef(null);
  const visible = Boolean(open && suggestion);

  useEffect(() => {
    if (!visible) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;

    const publishHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      const value = `${height}px`;
      document.documentElement.style.setProperty(
        "--reroute-prompt-height",
        value,
      );
      document
        .querySelector(".app.nav-mode")
        ?.style.setProperty("--reroute-prompt-height", value);
    };

    publishHeight();
    const ro = new ResizeObserver(publishHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--reroute-prompt-height");
      document
        .querySelector(".app.nav-mode")
        ?.style.removeProperty("--reroute-prompt-height");
    };
  }, [visible, suggestion?.reason, suggestion?.detail]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className="reroute-prompt"
      role="alertdialog"
      aria-label="Reroute suggested"
      aria-describedby="reroute-reason"
    >
      <div className="reroute-prompt-copy">
        <div className="reroute-prompt-kicker md-typescale-label-large">
          Reroute suggested
        </div>
        <p
          id="reroute-reason"
          className="reroute-prompt-reason md-typescale-title-small"
        >
          {suggestion.reason}
        </p>
        {suggestion.detail ? (
          <p className="reroute-prompt-detail md-typescale-body-medium">
            {suggestion.detail}
          </p>
        ) : null}
      </div>
      <div className="reroute-prompt-actions">
        <md-filled-button type="button" onClick={onAccept}>
          Accept
        </md-filled-button>
        <md-outlined-button type="button" onClick={onReject}>
          Reject
        </md-outlined-button>
      </div>
    </div>
  );
}
