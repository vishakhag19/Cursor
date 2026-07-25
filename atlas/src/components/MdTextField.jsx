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
  onKeyDown,
  id,
}) {
  const ref = useRef(null);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  const onKeyDownRef = useRef(onKeyDown);
  onChangeRef.current = onChange;
  onFocusRef.current = onFocus;
  onBlurRef.current = onBlur;
  onKeyDownRef.current = onKeyDown;

  // Sync from props only when the field is not being edited — assigning
  // `el.value` while focused fights keystrokes (backspace/typing feel broken).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.matches(":focus-within")) return;
    if (el.value !== (value ?? "")) el.value = value ?? "";
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onInput = (e) => onChangeRef.current?.(e.target.value);
    const onKey = (e) => onKeyDownRef.current?.(e);
    const onFocusIn = (e) => onFocusRef.current?.(e);
    const onFocusOut = (e) => onBlurRef.current?.(e);
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKey);
    // focus/blur don't bubble from the inner <input>; listen on the host.
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, []);

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
    />
  );
}
