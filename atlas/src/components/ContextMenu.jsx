export default function ContextMenu({ position, onClose, actions }) {
  if (!position) return null;
  return (
    <>
      <div className="ctx-backdrop" onClick={onClose} aria-hidden />
      <div
        className="context-menu"
        style={{ left: position.x, top: position.y }}
        role="menu"
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            role="menuitem"
            onClick={() => {
              a.onClick();
              onClose();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
