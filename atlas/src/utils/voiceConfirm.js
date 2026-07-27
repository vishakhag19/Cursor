/**
 * Browser TTS + yes/no speech recognition for mid-nav confirmations.
 * Uses the Web Speech API when available; callers should offer a tap fallback.
 */

const YES_RE =
  /\b(yes|yeah|yep|yup|sure|ok|okay|accept|please|do it|reroute|go ahead|affirmative)\b/i;
const NO_RE =
  /\b(no|nope|nah|reject|cancel|stay|don'?t|do not|negative|keep going)\b/i;

export function speechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function cancelSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak `text` aloud. Resolves when utterance ends (or immediately if unsupported).
 * @returns {Promise<boolean>} true if something was spoken
 */
export function speak(text, { lang = "en-US", rate = 1 } = {}) {
  return new Promise((resolve) => {
    if (!speechSynthesisSupported() || !text) {
      resolve(false);
      return;
    }
    cancelSpeech();
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = lang;
    utter.rate = rate;
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    utter.onend = () => finish(true);
    utter.onerror = () => finish(false);
    try {
      window.speechSynthesis.speak(utter);
    } catch {
      finish(false);
    }
  });
}

export function parseYesNo(transcript) {
  const t = String(transcript || "").trim();
  if (!t) return null;
  const yes = YES_RE.test(t);
  const no = NO_RE.test(t);
  if (yes && !no) return "yes";
  if (no && !yes) return "no";
  // Prefer the later cue when both match ("yes… no wait").
  if (yes && no) {
    const yesIdx = t.search(YES_RE);
    const noIdx = t.search(NO_RE);
    return noIdx > yesIdx ? "no" : "yes";
  }
  return null;
}

/**
 * Listen until the user says yes/no (or timeout / error).
 * @returns {{ promise: Promise<'yes'|'no'>, stop: () => void }}
 */
export function listenYesNo({
  lang = "en-US",
  timeoutMs = 14000,
  continuous = true,
} = {}) {
  let recognition = null;
  let timer = null;
  let settled = false;

  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      recognition?.stop();
    } catch {
      /* ignore */
    }
    recognition = null;
  };

  const promise = new Promise((resolve, reject) => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SR) {
      reject(new Error("Speech recognition is not supported"));
      return;
    }

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      stop();
      fn(value);
    };

    recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = continuous;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let heard = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        heard += `${event.results[i][0]?.transcript || ""} `;
      }
      const answer = parseYesNo(heard);
      if (answer) finish(resolve, answer);
    };

    recognition.onerror = (event) => {
      const err = event?.error || "recognition-error";
      // `no-speech` / `aborted` are soft — let timeout or caller handle.
      if (err === "aborted") {
        finish(reject, new Error("aborted"));
        return;
      }
      if (err === "no-speech") return;
      finish(reject, new Error(err));
    };

    recognition.onend = () => {
      if (settled) return;
      // Restart once if still within the window (some engines end after a pause).
      if (timer && recognition) {
        try {
          recognition.start();
        } catch {
          finish(reject, new Error("recognition-ended"));
        }
      }
    };

    timer = setTimeout(() => {
      finish(reject, new Error("timeout"));
    }, timeoutMs);

    try {
      recognition.start();
    } catch (err) {
      finish(reject, err instanceof Error ? err : new Error(String(err)));
    }
  });

  return { promise, stop };
}

/** Build a short spoken prompt for a mid-nav reroute offer. */
export function buildRerouteVoicePrompt(suggestion) {
  if (!suggestion) return "";
  const save =
    suggestion.saveMin != null
      ? ` A faster route could save about ${suggestion.saveMin} minutes.`
      : "";
  const reason = String(suggestion.reason || "There is a delay ahead.").replace(
    /\s*—\s*.*$/,
    "",
  );
  return `${reason}.${save} Would you like to reroute? Please say yes or no.`;
}
