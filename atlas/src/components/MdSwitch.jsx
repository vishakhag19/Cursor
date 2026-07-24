import { useEffect, useRef } from "react";

/** Controlled Material switch that syncs the `selected` property. */
export default function MdSwitch({ selected, onChange, disabled, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.selected = Boolean(selected);
  }, [selected]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange?.(Boolean(el.selected));
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, [onChange]);

  return (
    <md-switch
      ref={ref}
      disabled={disabled || undefined}
      {...rest}
    />
  );
}
