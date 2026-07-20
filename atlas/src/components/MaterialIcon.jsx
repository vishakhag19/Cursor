export function MaterialIcon({ name, filled = false, className = "", size }) {
  const style = size ? { fontSize: typeof size === "number" ? `${size}px` : size } : undefined;
  return (
    <span
      className={`material-symbols-outlined ${filled ? "filled" : ""} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
