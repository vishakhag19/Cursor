import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces } from "../api/geocode";

export default function SuggestInput({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  disabled = false,
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(q);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <input
        id={id}
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {loading && <span className="suggest-spinner" aria-hidden />}
      {open && suggestions.length > 0 && (
        <ul className="suggestions" id={listId} role="listbox">
          {suggestions.map((s) => (
            <li key={s.id} role="option">
              <button
                type="button"
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                  setSuggestions([]);
                }}
              >
                <span className="suggest-name">{s.name}</span>
                <span className="suggest-meta">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
