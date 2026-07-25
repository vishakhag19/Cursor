import { useEffect, useRef, useState } from "react";
import { formatDistance, formatDuration } from "../utils/format";

/**
 * Lets the user pick among Fastest / Shortest / Alternative routes.
 * Routes are never auto-switched — selection is always explicit.
 *
 * `embedded` reuses the system place-suggest / landing list-row styling
 * (for the home Saved routes card) instead of bordered option cards.
 */
export default function RouteOptionsList({
  options = [],
  selectedId,
  onSelect,
  locked = false,
  onToggleLock,
  onDelete = null,
  onRename = null,
  embedded = false,
  title = "Route options",
  hint = "Pick the route you want. Maps will not switch it mid-trip unless you choose another option.",
}) {
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const renameInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!editingId) return undefined;
    const id = window.setTimeout(() => {
      renameInputRef.current?.focus?.();
      renameInputRef.current?.select?.();
    }, 40);
    return () => window.clearTimeout(id);
  }, [editingId]);

  useEffect(() => {
    if (editingId && !options.some((o) => o.id === editingId)) {
      setEditingId(null);
      setEditName("");
    }
    if (menuId && !options.some((o) => o.id === menuId)) {
      setMenuId(null);
    }
  }, [options, editingId, menuId]);

  useEffect(() => {
    if (!menuId) return undefined;
    function onDocPointer(e) {
      if (menuRef.current?.contains?.(e.target)) return;
      setMenuId(null);
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuId(null);
    }
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  function beginRename(opt) {
    setMenuId(null);
    setEditingId(opt.id);
    setEditName(opt.label || "");
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
  }

  function commitRename(opt) {
    const next = editName.trim();
    if (!next || next === opt.label) {
      cancelRename();
      return;
    }
    onRename?.(opt, next);
    cancelRename();
  }

  if (!options.length) return null;

  if (embedded) {
    const showActions = Boolean(onRename || onDelete);
    return (
      <div className="route-options is-embedded">
        <ul className="place-suggest-list route-option-list" role="listbox">
          {options.map((opt) => {
            const active = selectedId != null && opt.id === selectedId;
            const meta = `${formatDuration(opt.duration)} · ${formatDistance(opt.distance)}`;
            const editing = editingId === opt.id;
            const menuOpen = menuId === opt.id;
            return (
              <li key={opt.id}>
                <div
                  className={`landing-saved-item${active ? " is-active" : ""}${
                    editing ? " is-renaming" : ""
                  }`}
                >
                  {editing ? (
                    <form
                      className="landing-saved-rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename(opt);
                      }}
                    >
                      <input
                        ref={renameInputRef}
                        className="landing-saved-rename-input"
                        type="text"
                        value={editName}
                        maxLength={80}
                        aria-label="Route name"
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                      <div className="landing-saved-actions">
                        <md-icon-button
                          type="button"
                          aria-label="Save name"
                          onClick={(e) => {
                            e.stopPropagation();
                            commitRename(opt);
                          }}
                        >
                          <md-icon>check</md-icon>
                        </md-icon-button>
                        <md-icon-button
                          type="button"
                          aria-label="Cancel rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRename();
                          }}
                        >
                          <md-icon>close</md-icon>
                        </md-icon-button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`place-suggest-item landing-saved-open${
                          active ? " is-active" : ""
                        }`}
                        onClick={() => {
                          setMenuId(null);
                          onSelect(opt);
                        }}
                      >
                        <span className="place-suggest-text landing-saved-open-text">
                          <span className="place-suggest-title landing-saved-open-title">
                            {opt.label}
                          </span>
                          <span className="place-suggest-sub landing-saved-open-meta">
                            {meta}
                          </span>
                        </span>
                        {active && !showActions ? (
                          <md-icon class="route-check">check_circle</md-icon>
                        ) : null}
                      </button>
                      {showActions ? (
                        <div
                          className="landing-saved-actions"
                          ref={menuOpen ? menuRef : null}
                        >
                          <md-icon-button
                            type="button"
                            aria-label={`More actions for ${opt.label}`}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen ? "true" : "false"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId((id) => (id === opt.id ? null : opt.id));
                            }}
                          >
                            <md-icon>more_vert</md-icon>
                          </md-icon-button>
                          {menuOpen ? (
                            <div
                              className="landing-saved-menu"
                              role="menu"
                              aria-label={`${opt.label} actions`}
                            >
                              {onRename ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="landing-saved-menu-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    beginRename(opt);
                                  }}
                                >
                                  <md-icon>edit</md-icon>
                                  <span>Edit name</span>
                                </button>
                              ) : null}
                              {onDelete ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="landing-saved-menu-item is-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuId(null);
                                    onDelete(opt);
                                  }}
                                >
                                  <md-icon>delete</md-icon>
                                  <span>Delete</span>
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="route-options">
      <div className="route-options-header">
        <h3 className="md-typescale-title-small">{title}</h3>
        {onToggleLock && (
          <md-assist-chip
            label={locked ? "Route locked" : "Lock route"}
            selected={locked || undefined}
            onClick={onToggleLock}
            title="Prevent automatic changes to this route"
          >
            <md-icon slot="icon">{locked ? "lock" : "lock_open"}</md-icon>
          </md-assist-chip>
        )}
      </div>
      {hint ? (
        <p className="hint tight md-typescale-body-small">{hint}</p>
      ) : null}
      <div className="route-option-cards">
        {options.map((opt) => {
          const active = selectedId != null && opt.id === selectedId;
          return (
            <div
              key={opt.id}
              className={`route-option-row${active ? " is-active" : ""}${
                onDelete ? " has-delete" : ""
              }`}
            >
              <button
                type="button"
                className={`route-option-card${active ? " is-active" : ""}`}
                onClick={() => onSelect(opt)}
              >
                <div className="route-option-top">
                  <strong className="md-typescale-title-small">
                    {opt.label}
                  </strong>
                  {active && !onDelete && (
                    <md-icon class="route-check">check_circle</md-icon>
                  )}
                </div>
                <div className="md-typescale-body-medium">
                  {formatDuration(opt.duration)} · {formatDistance(opt.distance)}
                </div>
              </button>
              {onDelete ? (
                <div className="route-option-actions">
                  <md-icon-button
                    type="button"
                    aria-label={`Delete ${opt.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(opt);
                    }}
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
