/**
 * Mid-navigation reroute interruption (Feature 6).
 * Accept and Reject are equally prominent — neither is buried.
 * Desktop: actions sit beside the copy; mobile: stacked below.
 */
export default function ReroutePrompt({
  open,
  suggestion,
  onAccept,
  onReject,
}) {
  if (!open || !suggestion) return null;

  return (
    <div
      className="reroute-prompt"
      role="alertdialog"
      aria-label="Reroute suggested"
      aria-describedby="reroute-reason"
    >
      <div className="reroute-prompt-handle" aria-hidden />
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
        <md-outlined-button type="button" onClick={onReject}>
          Reject
        </md-outlined-button>
        <md-filled-button type="button" onClick={onAccept}>
          Accept
        </md-filled-button>
      </div>
    </div>
  );
}
