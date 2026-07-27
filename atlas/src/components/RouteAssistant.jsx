import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelSpeech,
  listenPhrase,
  speechRecognitionSupported,
} from "../utils/voiceConfirm";

/**
 * Text chat for the routing assistant.
 * Mic: say “avoid …” / “prefer …” — the system confirms aloud after applying.
 */
export default function RouteAssistant({
  open,
  onClose,
  messages,
  busy = false,
  onSend,
  /** When true on open, start listening once for a voice command. */
  autoListen = false,
  onAutoListenConsumed = null,
}) {
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stopListenRef = useRef(null);
  const voiceSupported = speechRecognitionSupported();

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (!listening) {
      const t = setTimeout(() => inputRef.current?.focus?.(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, messages.length, busy, listening]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      setVoiceHint("");
      cancelSpeech();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !autoListen) return undefined;
    onAutoListenConsumed?.();
    const t = setTimeout(() => {
      startListening();
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per autoListen pulse
  }, [open, autoListen]);

  async function startListening() {
    if (busy || listening) return;
    if (!voiceSupported) {
      setVoiceHint("Voice isn’t supported in this browser — type instead.");
      return;
    }
    setVoiceHint("Listening… say “avoid Oak St” or “prefer Main St”.");
    setListening(true);
    const session = listenPhrase({ timeoutMs: 12000 });
    stopListenRef.current = session.stop;
    try {
      const heard = await session.promise;
      setVoiceHint("");
      setListening(false);
      stopListenRef.current = null;
      setDraft("");
      if (heard && !busy) onSend?.(heard, { voice: true });
    } catch (err) {
      setListening(false);
      stopListenRef.current = null;
      const msg = err?.message || "";
      if (msg === "aborted") {
        setVoiceHint("");
        return;
      }
      setVoiceHint(
        msg === "timeout"
          ? "Didn’t catch that — tap the mic and try again."
          : "Couldn’t hear you — tap the mic or type instead.",
      );
    }
  }

  function stopListening() {
    stopListenRef.current?.();
    stopListenRef.current = null;
    setListening(false);
    setVoiceHint("");
  }

  if (!open) return null;

  function submit(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || busy || listening) return;
    setDraft("");
    setVoiceHint("");
    onSend?.(text, { voice: false });
  }

  const ui = (
    <>
      <button
        type="button"
        className="route-assistant-backdrop"
        aria-label="Dismiss route assistant"
        onClick={onClose}
      />
      <div className="route-assistant" role="dialog" aria-label="Route assistant">
        <div className="route-assistant-header">
          <div className="route-assistant-title-row">
            <md-icon class="route-assistant-icon">auto_awesome</md-icon>
            <div>
              <div className="md-typescale-title-small">Route assistant</div>
              <div className="md-typescale-body-small route-assistant-sub">
                Say “avoid …” or “prefer …” — I’ll confirm out loud
              </div>
            </div>
          </div>
          <md-icon-button
            type="button"
            aria-label="Close assistant"
            onClick={onClose}
          >
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
          {listening ? (
            <div className="route-assistant-bubble is-agent is-listening">
              <md-icon>mic</md-icon>
              <span className="md-typescale-body-small">Listening for a road…</span>
            </div>
          ) : null}
        </div>

        {voiceHint ? (
          <p className="route-assistant-voice-hint md-typescale-body-small" role="status">
            {voiceHint}
          </p>
        ) : null}

        <form className="route-assistant-compose" onSubmit={submit}>
          <input
            ref={inputRef}
            className="route-assistant-input md-typescale-body-medium"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Try “avoid Oak St” or “prefer Main St”'
            disabled={busy || listening || undefined}
            aria-label="Message the route assistant"
            autoComplete="off"
          />
          <md-icon-button
            type="button"
            class={`route-assistant-mic${listening ? " is-listening" : ""}`}
            aria-label={listening ? "Stop listening" : "Speak avoid or prefer a road"}
            aria-pressed={listening ? "true" : "false"}
            disabled={busy || undefined}
            onClick={() => (listening ? stopListening() : startListening())}
          >
            <md-icon>{listening ? "stop" : "mic"}</md-icon>
          </md-icon-button>
          <md-icon-button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || busy || listening || undefined}
          >
            <md-icon>send</md-icon>
          </md-icon-button>
        </form>

        <div
          className="route-assistant-chips"
          role="group"
          aria-label="Suggestions"
        >
          {[
            "Avoid this traffic — reroute",
            "Prefer a quieter road",
            "Undo last change",
          ].map((hint) => (
            <button
              key={hint}
              type="button"
              className="route-assistant-chip"
              disabled={busy || listening || undefined}
              onClick={() => onSend?.(hint, { voice: false })}
            >
              {hint}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return createPortal(ui, document.body);
}
