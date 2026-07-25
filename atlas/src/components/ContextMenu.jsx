import { useEffect, useState } from "react";

function useIsCompact(query = "(max-width: 800px)") {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return compact;
}

/**
 * Map long-press / right-click menu.
 * Mobile: bottom sheet. Desktop: floating card at the press point.
 */
export default function ContextMenu({ position, onClose, actions }) {
  const isCompact = useIsCompact();

  useEffect(() => {
    if (!position || !isCompact) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [position, isCompact, onClose]);

  if (!position) return null;

  return (
    <>
      <button
        type="button"
        className={`ctx-backdrop${isCompact ? " is-sheet" : ""}`}
        onClick={onClose}
        aria-label="Dismiss map options"
      />
      <div
        className={`context-menu m3-card${isCompact ? " is-sheet" : ""}`}
        style={
          isCompact
            ? undefined
            : { left: position.x, top: position.y }
        }
        role={isCompact ? "dialog" : "menu"}
        aria-label="Map options"
      >
        {isCompact ? (
          <div className="ctx-sheet-handle" aria-hidden>
            <div className="ctx-sheet-grabber" />
          </div>
        ) : null}
        {isCompact ? (
          <div className="ctx-sheet-header">
            <h2 className="md-typescale-title-medium ctx-sheet-title">
              Map options
            </h2>
            <md-icon-button
              type="button"
              aria-label="Close"
              onClick={onClose}
            >
              <md-icon>close</md-icon>
            </md-icon-button>
          </div>
        ) : (
          <md-elevation aria-hidden="true" />
        )}
        <md-list class="ctx-sheet-list">
          {actions.map((a) => (
            <md-list-item
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => {
                a.onClick();
                onClose();
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
