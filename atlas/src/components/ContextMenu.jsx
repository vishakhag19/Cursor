import { useEffect } from "react";

/**
 * Road-rule chooser after "Pick on map" — always a bottom sheet.
 * Prefer / Avoid / Never only (no Directions actions).
 */
export default function ContextMenu({
  position,
  onClose,
  actions,
  title = "Choose a road rule",
}) {
  useEffect(() => {
    if (!position) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [position, onClose]);

  if (!position) return null;

  return (
    <>
      <button
        type="button"
        className="ctx-backdrop is-sheet"
        onClick={onClose}
        aria-label="Dismiss road rule options"
      />
      <div
        className="context-menu m3-card is-sheet"
        role="dialog"
        aria-label={title}
      >
        <div className="ctx-sheet-handle" aria-hidden>
          <div className="ctx-sheet-grabber" />
        </div>
        <div className="ctx-sheet-header">
          <h2 className="md-typescale-title-medium ctx-sheet-title">{title}</h2>
          <md-icon-button type="button" aria-label="Close" onClick={onClose}>
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>
        <md-list class="ctx-sheet-list">
          {actions.map((a) => (
            <md-list-item
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => {
                /* Action owns dismiss / navigation (e.g. reopen prefs). */
                a.onClick();
              }}
            >
              {a.icon ? (
                <md-icon slot="start" class="ctx-action-icon">
                  {a.icon}
                </md-icon>
              ) : null}
              <div slot="headline">{a.label}</div>
            </md-list-item>
          ))}
        </md-list>
      </div>
    </>
  );
}
