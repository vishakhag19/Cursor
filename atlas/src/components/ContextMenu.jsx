export default function ContextMenu({ position, onClose, actions }) {
  if (!position) return null;
  return (
    <>
      <div className="ctx-backdrop" onClick={onClose} aria-hidden />
      <div
        className="context-menu m3-card"
        style={{ left: position.x, top: position.y }}
        role="menu"
      >
        <md-elevation aria-hidden="true" />
        <md-list>
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
              <div slot="headline">{a.label}</div>
            </md-list-item>
          ))}
        </md-list>
      </div>
    </>
  );
}
