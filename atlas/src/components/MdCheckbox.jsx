import { useEffect, useRef } from "react";

/** Controlled Material checkbox that syncs the `checked` property. */
export default function MdCheckbox({ checked, onChange, disabled, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.checked = Boolean(checked);
  }, [checked]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange?.(el.checked);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, [onChange]);

  return (
    <md-checkbox
      ref={ref}
      disabled={disabled || undefined}
      {...rest}
    />
  );
}
