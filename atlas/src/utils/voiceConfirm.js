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

/** Invalidates in-flight speak() retries when cancelSpeech() runs. */
let speechEpoch = 0;

export function cancelSpeech() {
  // Bump epoch so in-flight speak() retries do not restart after an intentional stop
  // (e.g. exiting live navigation).
  speechEpoch += 1;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

function waitForVoices(timeoutMs = 800) {
  return new Promise((resolve) => {
    if (!speechSynthesisSupported()) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing?.length) {
      resolve(existing);
      return;
    }
    let done = false;
    const finish = (voices) => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener?.("voiceschanged", onChange);
      resolve(voices || []);
    };
    const onChange = () => finish(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener?.("voiceschanged", onChange);
    setTimeout(() => finish(window.speechSynthesis.getVoices()), timeoutMs);
  });
}

/**
 * Speak `text` aloud. Resolves when utterance ends (or immediately if unsupported).
 * Retries once after Chrome's cancel()/paused quirks, unless cancelSpeech() ran.
 * @returns {Promise<boolean>} true if something was spoken
 */
export function speak(text, { lang = "en-US", rate = 1 } = {}) {
  const epochAtStart = speechEpoch;
  const stillCurrent = () => speechEpoch === epochAtStart;

  async function speakOnce(attempt) {
    if (!speechSynthesisSupported() || !text || !stillCurrent()) return false;

    // Soft-clear the queue without bumping epoch (so our own retry can proceed).
    if (attempt === 0) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 60));
      if (!stillCurrent()) return false;
    }

    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }

    const voices = await waitForVoices();
    if (!stillCurrent()) return false;

    const preferred =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => String(v.lang || "").startsWith(lang.slice(0, 2))) ||
      voices.find((v) => v.default) ||
      voices[0] ||
      null;

    return new Promise((resolve) => {
      if (!stillCurrent()) {
        resolve(false);
        return;
      }

      const utter = new SpeechSynthesisUtterance(String(text));
      utter.lang = lang;
      utter.rate = rate;
      if (preferred) utter.voice = preferred;

      let settled = false;
      const safety = setTimeout(() => {
        // Some engines never fire onend after a soft cancel — don't hang callers.
        finish(Boolean(window.speechSynthesis.speaking) && stillCurrent());
      }, Math.min(20000, 2500 + String(text).length * 80));

      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        resolve(Boolean(ok) && stillCurrent());
      };

      utter.onend = () => finish(true);
      utter.onerror = () => finish(false);

      try {
        window.speechSynthesis.speak(utter);
        // Chrome can leave synth paused after tab switches.
        try {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        } catch {
          /* ignore */
        }
      } catch {
        finish(false);
      }
    });
  }

  return (async () => {
    const first = await speakOnce(0);
    if (!stillCurrent()) return false;
    if (first) return true;
    await new Promise((r) => setTimeout(r, 120));
    if (!stillCurrent()) return false;
    return speakOnce(1);
  })();
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

/**
 * Listen for a free-form phrase (e.g. “avoid Oak Street”).
 * Resolves with the final transcript, or rejects on timeout / error.
 * @returns {{ promise: Promise<string>, stop: () => void }}
 */
export function listenPhrase({
  lang = "en-US",
  timeoutMs = 12000,
} = {}) {
  let recognition = null;
  let timer = null;
  let settled = false;
  let interim = "";

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
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let finalText = "";
      interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += `${piece} `;
        else interim += `${piece} `;
      }
      const trimmed = finalText.trim();
      if (trimmed) finish(resolve, trimmed);
    };

    recognition.onerror = (event) => {
      const err = event?.error || "recognition-error";
      if (err === "aborted") {
        finish(reject, new Error("aborted"));
        return;
      }
      if (err === "no-speech") return;
      finish(reject, new Error(err));
    };

    recognition.onend = () => {
      if (settled) return;
      const fallback = interim.trim();
      if (fallback) {
        finish(resolve, fallback);
        return;
      }
      finish(reject, new Error("recognition-ended"));
    };

    timer = setTimeout(() => {
      const fallback = interim.trim();
      if (fallback) finish(resolve, fallback);
      else finish(reject, new Error("timeout"));
    }, timeoutMs);

    try {
      // Avoid picking up any leftover TTS.
      cancelSpeech();
      recognition.start();
    } catch (err) {
      finish(reject, err instanceof Error ? err : new Error(String(err)));
    }
  });

  return { promise, stop };
}
