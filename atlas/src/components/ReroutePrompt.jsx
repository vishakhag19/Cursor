import { useEffect, useRef, useState } from "react";
import {
  buildRerouteVoicePrompt,
  cancelSpeech,
  listenYesNo,
  speak,
  speechRecognitionSupported,
  speechSynthesisSupported,
} from "../utils/voiceConfirm";

/**
 * Mid-navigation reroute interruption (Feature 6) — audio-first.
 * Speaks the offer, then listens for “yes” / “no”. Tap Yes/No remains as
 * fallback when mic/TTS is unavailable or recognition times out.
 */
export default function ReroutePrompt({
  open,
  suggestion,
  onAccept,
  onReject,
}) {
  const rootRef = useRef(null);
  const onAcceptRef = useRef(onAccept);
  const onRejectRef = useRef(onReject);
  onAcceptRef.current = onAccept;
  onRejectRef.current = onReject;

  const visible = Boolean(open && suggestion);
  const [phase, setPhase] = useState("speaking"); // speaking | listening | fallback
  const [errorHint, setErrorHint] = useState("");
  const promptKey = suggestion
    ? `${suggestion.reason || ""}|${suggestion.saveMin ?? ""}`
    : "";

  useEffect(() => {
    if (!visible) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;

    const publishHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      const value = `${height}px`;
      document.documentElement.style.setProperty(
        "--reroute-prompt-height",
        value,
      );
      document
        .querySelector(".app.nav-mode")
        ?.style.setProperty("--reroute-prompt-height", value);
    };

    publishHeight();
    const ro = new ResizeObserver(publishHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--reroute-prompt-height");
      document
        .querySelector(".app.nav-mode")
        ?.style.removeProperty("--reroute-prompt-height");
    };
  }, [visible, phase, promptKey, errorHint]);

  useEffect(() => {
    if (!visible || !suggestion) {
      setPhase("speaking");
      setErrorHint("");
      return undefined;
    }

    let cancelled = false;
    let stopListen = null;

    async function run() {
      setPhase("speaking");
      setErrorHint("");
      const prompt = buildRerouteVoicePrompt(suggestion);

      if (speechSynthesisSupported()) {
        await speak(prompt);
      } else {
        setErrorHint("Voice unavailable — tap Yes or No.");
        setPhase("fallback");
        return;
      }
      if (cancelled) return;

      if (!speechRecognitionSupported()) {
        setErrorHint("Mic unavailable — tap Yes or No.");
        setPhase("fallback");
        return;
      }

      setPhase("listening");
      const session = listenYesNo({ timeoutMs: 14000 });
      stopListen = session.stop;
      try {
        const answer = await session.promise;
        if (cancelled) return;
        if (answer === "yes") {
          await speak("Okay, rerouting.");
          if (!cancelled) onAcceptRef.current?.();
        } else {
          await speak("Okay, staying on your current route.");
          if (!cancelled) onRejectRef.current?.();
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || "";
        if (msg === "aborted") return;
        setErrorHint(
          msg === "timeout"
            ? "Didn’t catch that — tap Yes or No."
            : "Couldn’t hear you — tap Yes or No.",
        );
        setPhase("fallback");
      }
    }

    run();

    return () => {
      cancelled = true;
      stopListen?.();
      cancelSpeech();
    };
    // promptKey identifies this offer; handlers via refs.
  }, [visible, promptKey, suggestion]);

  if (!visible) return null;

  const statusLabel =
    phase === "speaking"
      ? "Speaking reroute offer…"
      : phase === "listening"
        ? "Listening — say yes or no"
        : "Waiting for your answer";

  return (
    <div
      ref={rootRef}
      className={`reroute-prompt reroute-prompt--voice is-${phase}`}
      role="status"
      aria-live="polite"
      aria-label="Reroute voice prompt"
    >
      <div className="reroute-prompt-voice-row">
        <span className="reroute-prompt-mic" aria-hidden>
          <md-icon>
            {phase === "listening"
              ? "mic"
              : phase === "speaking"
                ? "volume_up"
                : "mic_off"}
          </md-icon>
        </span>
        <div className="reroute-prompt-copy">
          <div className="reroute-prompt-kicker md-typescale-label-large">
            {statusLabel}
          </div>
          <p className="reroute-prompt-reason md-typescale-body-medium">
            {suggestion.reason}
          </p>
          {errorHint ? (
            <p className="reroute-prompt-detail md-typescale-body-small">
              {errorHint}
            </p>
          ) : phase === "listening" ? (
            <p className="reroute-prompt-detail md-typescale-body-small">
              Say <strong>yes</strong> to reroute, or <strong>no</strong> to
              stay.
            </p>
          ) : null}
        </div>
      </div>

      {phase === "fallback" ? (
        <div className="reroute-prompt-actions">
          <md-filled-button
            type="button"
            onClick={async () => {
              await speak("Okay, rerouting.");
              onAcceptRef.current?.();
            }}
          >
            Yes
          </md-filled-button>
          <md-outlined-button
            type="button"
            onClick={async () => {
              await speak("Okay, staying on your current route.");
              onRejectRef.current?.();
            }}
          >
            No
          </md-outlined-button>
        </div>
      ) : null}
    </div>
  );
}
