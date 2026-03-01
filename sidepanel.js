let uiTick = null;
let endedSession = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

async function send(type, payload = {}) {
  return await chrome.runtime.sendMessage({ type, ...payload });
}

async function refresh() {
  const res = await send("GET_TIMER");
  if (!res.ok) return;
  const ms = res.state.computedElapsedMs ?? 0;
  document.getElementById("time").textContent = formatMs(ms);
}

function setStatus(text, cls) {
  const el = document.getElementById("status");
  el.className = "small " + (cls || "");
  el.textContent = text || "";
}

function showEndCard(show) {
  document.getElementById("endCard").style.display = show ? "block" : "none";
}

function describeSession(session) {
  return `Duration: ${formatMs(session.totalMs)} (ended ${new Date(session.endedAtMs).toLocaleString()})`;
}

document.getElementById("start").addEventListener("click", async () => {
  await send("START");
  await refresh();
});

document.getElementById("pause").addEventListener("click", async () => {
  await send("PAUSE");
  await refresh();
});

document.getElementById("reset").addEventListener("click", async () => {
  await send("RESET");
  endedSession = null;
  showEndCard(false);
  setStatus("");
  await refresh();
});

document.getElementById("end").addEventListener("click", async () => {
  const res = await send("END_SESSION");
  if (!res.ok) return;

  endedSession = res.session;
  showEndCard(true);
  document.getElementById("taskName").value = "";
  document.getElementById("taskType").value = "University";
  document.getElementById("sessionInfo").textContent =
    describeSession(endedSession);
  setStatus("Session ended. Add a task name then save.", "");
  await refresh();
});

document.getElementById("cancelSave").addEventListener("click", async () => {
  endedSession = null;
  showEndCard(false);
  setStatus("");
});

document.getElementById("save").addEventListener("click", async () => {
  try {
    setStatus("Saving… (Google sign-in popup may appear)", "");
    const taskName = document.getElementById("taskName").value.trim();
    if (!taskName) {
      setStatus("Please enter a task name.", "error");
      return;
    }
    const taskType = document.getElementById("taskType").value;
    if (!endedSession) {
      setStatus("No ended session found.", "error");
      return;
    }

    await appendSessionToSheets({
      taskName,
      taskType,
      startedAtMs: endedSession.startedAtMs,
      endedAtMs: endedSession.endedAtMs,
      totalMs: endedSession.totalMs,
    });

    setStatus("Saved to Google Sheets ✅", "ok");
    endedSession = null;
    showEndCard(false);
  } catch (e) {
    console.error(e);
    setStatus(`Save failed: ${e?.message || String(e)}`, "error");
  }
});

// Update display every second (UI only). The timer itself is timestamp-based.
(async function init() {
  await refresh();
  uiTick = setInterval(refresh, 1000);
})();
