import { useEffect, useRef, useState } from "react";

/**
 * Text chat sheet for the routing assistant.
 * Messages may include `spoken` for a future voice / TTS layer.
 */
export default function RouteAssistant({
  open,
  onClose,
  messages,
  busy = false,
  onSend,
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    // Focus after open so the map keeps gesture priority until the sheet shows.
    const t = setTimeout(() => inputRef.current?.focus?.(), 80);
    return () => clearTimeout(t);
  }, [open, messages.length, busy]);

  if (!open) return null;

  function submit(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onSend?.(text);
  }

  return (
    <div className="route-assistant" role="dialog" aria-label="Route assistant">
      <div className="route-assistant-header">
        <div className="route-assistant-title-row">
          <md-icon class="route-assistant-icon">auto_awesome</md-icon>
          <div>
            <div className="md-typescale-title-small">Route assistant</div>
            <div className="md-typescale-body-small route-assistant-sub">
              Ask in plain language · voice later
            </div>
          </div>
        </div>
        <md-icon-button type="button" aria-label="Close assistant" onClick={onClose}>
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>

      <div className="route-assistant-messages" ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`route-assistant-bubble ${m.role === "user" ? "is-user" : "is-agent"}`}
          >
            <p className="md-typescale-body-medium">{m.text}</p>
          </div>
        ))}
        {busy ? (
          <div className="route-assistant-bubble is-agent is-busy">
            <md-circular-progress indeterminate aria-label="Working" />
            <span className="md-typescale-body-small">Updating route…</span>
          </div>
        ) : null}
      </div>

      <form className="route-assistant-compose" onSubmit={submit}>
        <input
          ref={inputRef}
          className="route-assistant-input md-typescale-body-medium"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Try “avoid Oak St” or “take Main instead of 5th”'
          disabled={busy || undefined}
          aria-label="Message the route assistant"
          autoComplete="off"
        />
        <md-icon-button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || busy || undefined}
        >
          <md-icon>send</md-icon>
        </md-icon-button>
      </form>

      <div className="route-assistant-chips" role="group" aria-label="Suggestions">
        {[
          "Avoid this traffic — reroute",
          "Take a quieter road",
          "Undo last change",
        ].map((hint) => (
          <button
            key={hint}
            type="button"
            className="route-assistant-chip"
            disabled={busy || undefined}
            onClick={() => onSend?.(hint)}
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}
