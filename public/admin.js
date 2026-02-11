const adminKeyInput = document.getElementById("admin-key");
const unlockButton = document.getElementById("unlock");
const refreshButton = document.getElementById("refresh");
const lockButton = document.getElementById("lock");
const adminStatus = document.getElementById("admin-status");
const adminLatest = document.getElementById("admin-latest");
const historyEl = document.getElementById("history");

const SESSION_KEY = "privacy_admin_key";
let adminKey = sessionStorage.getItem(SESSION_KEY) || "";

if (adminKey) {
  adminKeyInput.value = adminKey;
}

function renderHistory(submissions) {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    historyEl.innerHTML = "";
    adminLatest.textContent = "No submissions yet.";
    return;
  }

  adminLatest.textContent = JSON.stringify(submissions[0], null, 2);
  historyEl.innerHTML = submissions
    .map(
      (entry, idx) =>
        `<div class="history-item"><strong>#${idx + 1}</strong> ${entry.State} | ${entry.Category} | ${new Date(entry.Timestamp).toLocaleString()} | ${entry.Id}</div>`
    )
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
