import { useEffect, useRef } from "react";

/**
 * Material primary tabs with controlled active index.
 * @see https://github.com/material-components/material-web/tree/main/docs
 */
export default function MdTabs({ activeIndex = 0, onChange, children, className = "", ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.activeTabIndex !== activeIndex) {
      el.activeTabIndex = activeIndex;
    }
  }, [activeIndex]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange?.(el.activeTabIndex);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, [onChange]);

  return (
    <md-tabs ref={ref} class={className} {...rest}>
      {children}
    </md-tabs>
  );
}
