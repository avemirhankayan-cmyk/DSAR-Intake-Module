const adminKeyInput = document.getElementById("admin-key");
const unlockButton = document.getElementById("unlock");
const refreshButton = document.getElementById("refresh");
const lockButton = document.getElementById("lock");
const adminStatus = document.getElementById("admin-status");
const adminLatest = document.getElementById("admin-latest");
const historyEl = document.getElementById("history");

const SESSION_KEY = "privacy_admin_key";
let adminKey = sessionStorage.getItem(SESSION_KEY) || "";

// Demo fallback "source of truth" list used when the backend hasn't been configured
// to attach Actual_PII_Items yet.
const COMPANY_MASTER_PII = [
  "First name",
  "Last name",
  "Email address",
  "Phone number",
  "Home address",
  "IP address"
];

if (adminKey) {
  adminKeyInput.value = adminKey;
}

/**
 * Calculates the Transparency Score (The "Quant" Gap Analysis)
 * @param {Array} userForecast - The PII items the user selected in the form
 * @param {Array} actualData - The PII the company actually holds (the "source of truth")
 * @returns {Object} - score/status plus a short summary
 */
function calculateTransparencyScore(userForecast, actualData) {
  const normalizedForecast = Array.isArray(userForecast) ? userForecast : [];
  const normalizedActual = Array.isArray(actualData) ? actualData : [];

  if (normalizedActual.length === 0) {
    return {
      score: null,
      status: "N/A",
      matches: [],
      paranoia: normalizedForecast,
      gaps: [],
      summary: "Transparency score: N/A (no actual stored PII provided yet)."
    };
  }

  const matches = normalizedForecast.filter((item) => normalizedActual.includes(item));
  const userParanoia = normalizedForecast.filter((item) => !normalizedActual.includes(item));
  const transparencyGaps = normalizedActual.filter((item) => !normalizedForecast.includes(item));

  const score = Math.round((matches.length / normalizedActual.length) * 100);

  return {
    score,
    status: "OK",
    matches,
    paranoia: userParanoia,
    gaps: transparencyGaps,
    summary: `Transparency score: ${score}%. Found ${transparencyGaps.length} transparency gaps.`
  };
}

function renderHistory(submissions) {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    historyEl.innerHTML = "";
    adminLatest.textContent = "No submissions yet.";
    return;
  }

  adminLatest.textContent = JSON.stringify(submissions[0], null, 2);

  historyEl.innerHTML = submissions
    .map((entry, idx) => {
      // If the backend attached actual PII, prefer it.
      // Otherwise, fall back to a demo list so the UI doesn't show "undefined".
      const actualStoredPII =
        Array.isArray(entry.Actual_PII_Items) && entry.Actual_PII_Items.length > 0
          ? entry.Actual_PII_Items
          : COMPANY_MASTER_PII;

      const analysis = calculateTransparencyScore(entry.PII_Items || [], actualStoredPII);
      const summary = analysis && analysis.summary ? analysis.summary : "Transparency score: N/A.";

      return `<div class="history-item"><strong>#${idx + 1}</strong> ${entry.State} | ${entry.Category} | ${new Date(entry.Timestamp).toLocaleString()} | ${entry.Id}<br>${summary}</div>`;
    })
    .join("");
}

async function loadSubmissions() {
  if (!adminKey) {
    adminStatus.textContent = "Enter admin key to load submissions.";
    return;
  }

  adminStatus.textContent = "Loading submissions...";
  try {
    const response = await fetch("/api/admin/submissions", {
      headers: { "x-admin-key": adminKey }
    });

    if (response.status === 401) {
      adminStatus.textContent = "Invalid admin key.";
      return;
    }

    if (!response.ok) {
      throw new Error(`failed with ${response.status}`);
    }

    const payload = await response.json();
    adminStatus.textContent = `Loaded ${payload.count} submission(s).`;
    renderHistory(payload.submissions || []);
  } catch (_err) {
    adminStatus.textContent = "Could not load submissions.";
  }
}

unlockButton.addEventListener("click", () => {
  adminKey = adminKeyInput.value.trim();
  if (!adminKey) {
    adminStatus.textContent = "Admin key is required.";
    return;
  }
  sessionStorage.setItem(SESSION_KEY, adminKey);
  loadSubmissions();
});

refreshButton.addEventListener("click", () => {
  loadSubmissions();
});

lockButton.addEventListener("click", () => {
  adminKey = "";
  adminKeyInput.value = "";
  sessionStorage.removeItem(SESSION_KEY);
  adminLatest.textContent = "No submissions loaded.";
  historyEl.innerHTML = "";
  adminStatus.textContent = "Locked.";
});

if (adminKey) {
  loadSubmissions();
}
