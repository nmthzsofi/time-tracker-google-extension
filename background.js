const DEFAULT_STATE = {
  running: false,
  startTimeMs: null,
  elapsedMs: 0,
  lastEndedSession: null, // used for UX if you want
};

async function getState() {
  const { timerState } = await chrome.storage.local.get("timerState");
  return timerState ?? { ...DEFAULT_STATE };
}

async function setState(next) {
  await chrome.storage.local.set({ timerState: next });
}

function nowMs() {
  return Date.now();
}

function computeElapsedMs(state) {
  if (!state.running || !state.startTimeMs) return state.elapsedMs;
  return state.elapsedMs + (nowMs() - state.startTimeMs);
}

chrome.runtime.onInstalled.addListener(async () => {
  // Ensure side panel is available on click for the current window.
  // (This is optional but helps UX.)
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const state = await getState();
  await setState(state);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const state = await getState();

    if (msg?.type === "GET_TIMER") {
      sendResponse({
        ok: true,
        state: { ...state, computedElapsedMs: computeElapsedMs(state) },
      });
      return;
    }

    if (msg?.type === "START") {
      if (!state.running) {
        const next = {
          ...state,
          running: true,
          startTimeMs: nowMs(),
        };
        await setState(next);
        sendResponse({
          ok: true,
          state: { ...next, computedElapsedMs: computeElapsedMs(next) },
        });
        return;
      }
      sendResponse({
        ok: true,
        state: { ...state, computedElapsedMs: computeElapsedMs(state) },
      });
      return;
    }

    if (msg?.type === "PAUSE") {
      if (state.running) {
        const elapsed = computeElapsedMs(state);
        const next = {
          ...state,
          running: false,
          startTimeMs: null,
          elapsedMs: elapsed,
        };
        await setState(next);
        sendResponse({
          ok: true,
          state: { ...next, computedElapsedMs: computeElapsedMs(next) },
        });
        return;
      }
      sendResponse({
        ok: true,
        state: { ...state, computedElapsedMs: computeElapsedMs(state) },
      });
      return;
    }

    if (msg?.type === "RESET") {
      const next = { ...DEFAULT_STATE };
      await setState(next);
      sendResponse({ ok: true, state: { ...next, computedElapsedMs: 0 } });
      return;
    }

    if (msg?.type === "END_SESSION") {
      // End = pause + produce a session payload for saving.
      const endedAt = nowMs();
      const totalMs = computeElapsedMs(state);

      const session = {
        startedAtMs: state.startTimeMs ? state.startTimeMs : null,
        endedAtMs: endedAt,
        totalMs,
      };

      // Reset timer after ending.
      const next = { ...DEFAULT_STATE, lastEndedSession: session };
      await setState(next);

      sendResponse({ ok: true, session });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true; // keep the message channel open for async
});
