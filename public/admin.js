const adminKeyInput = document.getElementById("admin-key");
const unlockButton = document.getElementById("unlock");
const refreshButton = document.getElementById("refresh");
const lockButton = document.getElementById("lock");
const adminStatus = document.getElementById("admin-status");
const adminLatest = document.getElementById("admin-latest");
const historyEl = document.getElementById("history");

const SESSION_KEY = "privacy_admin_key";
let adminKey = sessionStorage.getItem(SESSION_KEY) || "";
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
 * @param {Array} userForecast - The PII_Items the user selected in the form
 * @param {Array} actualData - The PII the company actually holds (The "Source of Truth")
 * @returns {Object} - The score and a descriptive summary
 */
function calculateTransparencyScore(userForecast, actualData) {
  if (!userForecast || !actualData || actualData.length === 0) return { score: 0, status: "N/A" };

  // 1. Identify "Matches" (User was right)
  const matches = userForecast.filter((item) => actualData.includes(item));

  // 2. Identify "Misses" (User thought you had it, but you don't)
  const userParanoia = userForecast.filter((item) => !actualData.includes(item));

  // 3. Identify "Surprises" (Company has it, but user didn't know)
  const transparencyGaps = actualData.filter((item) => !userForecast.includes(item));

  // 4. Calculate the Score (Percentage of correct guesses vs Total actual data)
  const score = Math.round((matches.length / actualData.length) * 100);

  return {
    score: score,
    matches: matches,
    paranoia: userParanoia,
    gaps: transparencyGaps,
    summary: `User perception is ${score}% accurate. Found ${transparencyGaps.length} transparency gaps.`
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
      // INTEGRATION: Inside your renderHistory function, you can call it like this:
      // const actualStoredPII = ["First name", "Email address", "IP address"]; // Fetch this from your DB
      // const analysis = calculateTransparencyScore(entry.PII_Items, actualStoredPII);
      // console.log(analysis.summary);
      const actualStoredPII = Array.isArray(entry.Actual_PII_Items) ? entry.Actual_PII_Items : COMPANY_MASTER_PII;
      const analysis = calculateTransparencyScore(entry.PII_Items || [], actualStoredPII);
      return `<div class="history-item"><strong>#${idx + 1}</strong> ${entry.State} | ${entry.Category} | ${new Date(entry.Timestamp).toLocaleString()} | ${entry.Id}<br>${analysis.summary}</div>`;
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
