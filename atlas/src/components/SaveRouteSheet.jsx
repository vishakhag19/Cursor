import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

/**
 * Mobile save-route bottom sheet — name field + Save.
 * Dismiss via Save, X, backdrop, or Escape; Drive sheet stays underneath.
 */
export default function SaveRouteSheet({
  open,
  name = "",
  error = "",
  onNameChange,
  onSave,
  onClose,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    }
    document.addEventListener("keydown", onKey);
    const focusId = window.setTimeout(() => {
      inputRef.current?.focus?.();
      inputRef.current?.select?.();
    }, 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(focusId);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.();
  }

  return createPortal(
    <>
      <button
        type="button"
        className="save-route-sheet-backdrop"
        aria-label="Dismiss save route"
        onClick={onClose}
      />
      <div
        className="save-route-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Save route"
      >
        <div className="save-route-sheet-handle" aria-hidden>
          <div className="save-route-sheet-grabber" />
        </div>
        <div className="save-route-sheet-header">
          <h2 className="md-typescale-title-medium save-route-sheet-title">
            Save route
          </h2>
          <md-icon-button type="button" aria-label="Close" onClick={onClose}>
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>
        <form className="save-route-sheet-body" onSubmit={handleSubmit}>
          <div className={`dir-save-field${error ? " is-error" : ""}`}>
            <input
              ref={inputRef}
              id="save-route-sheet-name"
              className="dir-save-field-input"
              type="text"
              value={name}
              maxLength={80}
              placeholder="Route name"
              aria-label="Route name"
              aria-invalid={error ? "true" : "false"}
              onChange={(e) => onNameChange?.(e.target.value)}
            />
          </div>
          {error ? (
            <p
              className="dir-save-field-error md-typescale-body-small"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <md-filled-button
            type="submit"
            class="save-route-sheet-submit"
            disabled={Boolean(error) || undefined}
          >
            Save
          </md-filled-button>
        </form>
      </div>
    </>,
    document.body,
  );
}
