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
  const allowDismissRef = useRef(false);

  useEffect(() => {
    if (!open) {
      allowDismissRef.current = false;
      return undefined;
    }

    // Opened from the bookmark's pointerup/click — wait out any leftover
    // synthetic click before the backdrop can dismiss.
    allowDismissRef.current = false;
    let armed = false;
    function armDismiss() {
      if (armed) return;
      armed = true;
      allowDismissRef.current = true;
    }
    const armId = window.setTimeout(armDismiss, 320);

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (allowDismissRef.current) onClose?.();
      }
    }
    document.addEventListener("keydown", onKey);

    const focusId = window.setTimeout(() => {
      inputRef.current?.focus?.();
      inputRef.current?.select?.();
    }, 80);

    return () => {
      window.clearTimeout(armId);
      window.clearTimeout(focusId);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.();
  }

  function handleDismiss(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!allowDismissRef.current) return;
    onClose?.();
  }

  return createPortal(
    <>
      <button
        type="button"
        className="save-route-sheet-backdrop"
        aria-label="Dismiss save route"
        onPointerDown={handleDismiss}
        onClick={handleDismiss}
      />
      <div
        className="save-route-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Save route"
        onPointerDown={(e) => e.stopPropagation()}
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
