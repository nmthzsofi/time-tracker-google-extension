const STORAGE_KEYS = {
  spreadsheetId: "1nYJmOKuaEae3fuv9MHcD22uv6JirZNi5p9nIX8lnMIQ",
};

async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) reject(new Error("No auth token returned"));
      else resolve(token);
    });
  });
}

async function getStoredSpreadsheetId() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.spreadsheetId);
  return data[STORAGE_KEYS.spreadsheetId] || null;
}

async function setStoredSpreadsheetId(spreadsheetId) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.spreadsheetId]: spreadsheetId,
  });
}

async function sheetsFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  return await res.json();
}

async function ensureSpreadsheet(token) {
  let spreadsheetId = await getStoredSpreadsheetId();
  if (spreadsheetId) return spreadsheetId;

  // Create a spreadsheet in the user's Drive
  const created = await sheetsFetch(
    "https://sheets.googleapis.com/v4/spreadsheets",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        properties: { title: "Time Tracker Sessions" },
        sheets: [{ properties: { title: "Sessions" } }],
      }),
    },
  );

  spreadsheetId = created.spreadsheetId;
  await setStoredSpreadsheetId(spreadsheetId);

  // Add header row
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sessions!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        values: [
          [
            "Task",
            "Type",
            "Start (ISO)",
            "End (ISO)",
            "Duration (hh:mm:ss)",
            "Duration (minutes)",
          ],
        ],
      }),
    },
  );

  return spreadsheetId;
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

async function appendSessionToSheets({
  taskName,
  taskType,
  startedAtMs,
  endedAtMs,
  totalMs,
}) {
  const token = await getAuthToken(true);
  const spreadsheetId = await ensureSpreadsheet(token);

  const startIso = startedAtMs ? new Date(startedAtMs).toISOString() : "";
  const endIso = new Date(endedAtMs).toISOString();
  const durationHms = formatMs(totalMs);
  const durationMin = (totalMs / 60000).toFixed(2);

  // Append row
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sessions!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        values: [
          [taskName, taskType, startIso, endIso, durationHms, durationMin],
        ],
      }),
    },
  );
}
