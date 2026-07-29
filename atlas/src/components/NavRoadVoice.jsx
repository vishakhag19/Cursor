import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelSpeech,
  listenPhrase,
  speechRecognitionSupported,
} from "../utils/voiceConfirm";

/**
 * Mid-nav voice session for “avoid …” / “prefer …” commands.
 * Returns pill + mic button nodes for NavigationUI to place.
 */
export function useNavRoadVoice({
  active = false,
  busy = false,
  disabled = false,
  statusText = "",
  onCommand = null,
} = {}) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState("");
  const stopListenRef = useRef(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const voiceSupported = speechRecognitionSupported();

  const stopListening = useCallback(() => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    setListening(false);
    setHint("");
  }, []);

  useEffect(() => {
    if (!active) {
      stopListening();
      cancelSpeech();
      return;
    }
    if (disabled) {
      // ReroutePrompt owns TTS while the mic is disabled — only stop listening.
      stopListening();
    }
  }, [active, disabled, stopListening]);

  useEffect(
    () => () => {
      stopListenRef.current?.();
      // NavigationUI often unmounts without flipping active→false first.
      cancelSpeech();
    },
    [],
  );

  const startListening = useCallback(async () => {
    if (!active || busy || listening || disabled) return;
    if (!voiceSupported) {
      setHint("Voice isn’t supported here");
      return;
    }
    setHint("Listening… say avoid or prefer a road");
    setListening(true);
    const session = listenPhrase({ timeoutMs: 12000 });
    stopListenRef.current = session.stop;
    try {
      const heard = await session.promise;
      setListening(false);
      stopListenRef.current = null;
      setHint("");
      if (heard) onCommandRef.current?.(heard);
    } catch (err) {
      setListening(false);
      stopListenRef.current = null;
      const msg = err?.message || "";
      if (msg === "aborted") {
        setHint("");
        return;
      }
      setHint(
        msg === "timeout"
          ? "Didn’t catch that — tap the mic and try again"
          : "Couldn’t hear you — tap the mic again",
      );
    }
  }, [active, busy, listening, disabled, voiceSupported]);

  const showPill = listening || busy || Boolean(hint) || Boolean(statusText);
  const pillCopy = busy
    ? statusText || "Updating route…"
    : listening
      ? "Listening — say avoid or prefer a road"
      : statusText || hint;

  const pill = showPill ? (
    <div
      className={`nav-road-voice ${listening ? "is-listening" : ""} ${busy ? "is-busy" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="nav-road-voice-mic" aria-hidden>
        <md-icon>
          {busy ? "sync" : listening ? "mic" : "record_voice_over"}
        </md-icon>
      </span>
      <span className="nav-road-voice-copy md-typescale-body-medium">
        {pillCopy}
      </span>
    </div>
  ) : null;

  const micButton = (
    <button
      type="button"
      className={`nav-footer-voice${listening ? " is-listening" : ""}`}
      aria-label={listening ? "Stop listening" : "Say avoid or prefer a road"}
      aria-pressed={listening ? "true" : "false"}
      disabled={busy || disabled || undefined}
      onClick={() => (listening ? stopListening() : startListening())}
    >
      <md-icon>{listening ? "stop" : "mic"}</md-icon>
    </button>
  );

  return { pill, micButton, listening };
}

/** @deprecated Prefer useNavRoadVoice — kept for import compatibility. */
export default function NavRoadVoice() {
  return null;
}
