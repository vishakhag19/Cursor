/** Debug-mode NDJSON logger → Vite middleware → /opt/cursor/logs/debug.log */
export function agentLog(payload) {
  try {
    fetch("/__agent_debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, timestamp: Date.now() }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
