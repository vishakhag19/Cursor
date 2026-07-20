import { useEffect, useRef } from "react";

/**
 * Controlled wrapper around <md-outlined-text-field>.
 * Material Web fires native `input` events; React props bridge value/disabled.
 */
export default function MdTextField({
  label,
  value = "",
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  className = "",
  supportingText,
  error = false,
  maxLength,
  onFocus,
  onBlur,
  id,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.value !== value) el.value = value ?? "";
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => onChange?.(e.target.value);
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [onChange]);

  return (
    <md-outlined-text-field
      ref={ref}
      id={id}
      class={className}
      label={label}
      placeholder={placeholder}
      type={type}
      disabled={disabled || undefined}
      error={error || undefined}
      supporting-text={supportingText}
      maxlength={maxLength}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
