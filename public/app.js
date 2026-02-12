const DEFAULT_RIGHTS = [
  "See what personal data you have about me",
  "Delete personal data linked to my account (when allowed)",
  "Fix wrong personal data",
  "Get a copy of my data"
];

const DEFAULT_PII_OPTIONS = [
  "First name",
  "Middle name",
  "Last name",
  "Date of birth",
  "Social Security Number",
  "Government ID number",
  "Driver's license number",
  "Passport number",
  "Tax ID number",
  "Email address",
  "Phone number",
  "Home address",
  "Mailing address",
  "IP address",
  "Device identifier",
  "Account username",
  "Account number",
  "Payment card information",
  "Bank account information",
  "Biometric data",
  "Photo or video",
  "Geolocation data",
  "Health information",
  "Education records",
  "Employment information"
];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming"
];

const form = document.getElementById("intake-form");
const stateSelect = document.getElementById("state");
const rightsList = document.getElementById("rights-list");
const piiList = document.getElementById("pii-list");
const rightsMetaEl = document.getElementById("rights-meta");
const submitStatusEl = document.getElementById("submit-status");
const allFederalCheckbox = document.getElementById("context-all");
const entityTypeCheckboxes = Array.from(document.querySelectorAll('input[name="entity_types"]'));

let currentRights = [...DEFAULT_RIGHTS];
let currentPiiOptions = [...DEFAULT_PII_OPTIONS];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function populateStateOptions() {
  const options = US_STATES.map((state) => `<option value="${state}">${state}</option>`).join("");
  stateSelect.insertAdjacentHTML("beforeend", options);
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((checkbox) => {
    const encoded = checkbox.getAttribute("data-label") || "";
    try {
      return decodeURIComponent(encoded);
    } catch (_err) {
      return encoded;
    }
  });
}

function getSelectedRights() {
  return getCheckedValues("selected_rights");
}

function getSelectedPiiItems() {
  return getCheckedValues("pii_items");
}

function getSelectedEntityTypes() {
  return entityTypeCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}

function inferCategoryFromRights(selectedRights) {
  const text = selectedRights.join(" ").toLowerCase();
  if (text.includes("delete") || text.includes("erase") || text.includes("remove")) {
    return "Delete my data";
  }
  if (text.includes("fix") || text.includes("correct") || text.includes("update")) {
    return "Fix my data";
  }
  if (text.includes("copy") || text.includes("export") || text.includes("portability")) {
    return "Get a copy of my data";
  }
  if (text.includes("access") || text.includes("see what") || text.includes("know what")) {
    return "Access my data";
  }
  if (text.includes("targeted ads") || text.includes("advertising")) {
    return "Stop targeted ads";
  }
  if (text.includes("sell") || text.includes("sharing") || text.includes("sale")) {
    return "Stop data sale";
  }
  return "General privacy request";
}

function syncAllFederalCheckbox() {
  allFederalCheckbox.checked =
    entityTypeCheckboxes.length > 0 && entityTypeCheckboxes.every((checkbox) => checkbox.checked);
}

function renderCheckboxGroup(container, inputName, items, previouslySelected = []) {
  const selectedSet = new Set(previouslySelected);
  container.innerHTML = items
    .map((item, index) => {
      const safeLabel = escapeHtml(item);
      const rawValue = encodeURIComponent(item);
      const id = `${inputName}-${index}`;
      const checked = selectedSet.has(item) ? "checked" : "";
      return `<label class="checkbox-row" for="${id}"><input id="${id}" type="checkbox" name="${inputName}" value="${safeLabel}" data-label="${rawValue}" ${checked} /> <span>${safeLabel}</span></label>`;
    })
    .join("");
}

function resetRightsSection() {
  currentRights = [...DEFAULT_RIGHTS];
  rightsMetaEl.textContent = "";
  rightsList.innerHTML = '<div class="rights-placeholder">Select a state to view your options.</div>';
}

async function loadPiiOptions() {
  try {
    const response = await fetch("/api/pii-options");
    if (!response.ok) {
      throw new Error(`pii options failed with ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data.options) && data.options.length > 0) {
      currentPiiOptions = data.options;
    }
  } catch (_err) {
    currentPiiOptions = [...DEFAULT_PII_OPTIONS];
  }

  renderCheckboxGroup(piiList, "pii_items", currentPiiOptions, []);
}

async function loadProfile() {
  const state = stateSelect.value;
  const entityTypes = getSelectedEntityTypes();
  const previouslySelectedRights = getSelectedRights();

  if (!state) {
    resetRightsSection();
    return;
  }

  rightsMetaEl.textContent = "Looking up applicable rights...";
  rightsList.innerHTML = '<div class="rights-placeholder">Loading state rights...</div>';

  try {
    const query =
      entityTypes.length > 0 ? `?entityTypes=${encodeURIComponent(entityTypes.join(","))}` : "";
    const response = await fetch(`/api/rights/${encodeURIComponent(state)}${query}`);
    if (!response.ok) {
      throw new Error(`rights failed with ${response.status}`);
    }
    const data = await response.json();

    currentRights = Array.isArray(data.rights) && data.rights.length > 0 ? data.rights : [...DEFAULT_RIGHTS];

    const lawText = typeof data.law === "string" && data.law.trim() ? data.law.trim() : "General intake";
    const labels =
      Array.isArray(data.entityLabels) && data.entityLabels.length > 0
        ? data.entityLabels.join(" + ")
        : "State privacy rights only";

    renderCheckboxGroup(rightsList, "selected_rights", currentRights, previouslySelectedRights);
    rightsMetaEl.textContent = `Law context: ${lawText} | Scope: ${labels}`;
  } catch (_err) {
    currentRights = [...DEFAULT_RIGHTS];
    renderCheckboxGroup(rightsList, "selected_rights", currentRights, previouslySelectedRights);
    rightsMetaEl.textContent = "Could not load profile. Showing default rights.";
  }
}

stateSelect.addEventListener("change", () => {
  submitStatusEl.textContent = "";
  loadProfile();
});

allFederalCheckbox.addEventListener("change", () => {
  const checked = allFederalCheckbox.checked;
  entityTypeCheckboxes.forEach((checkbox) => {
    checkbox.checked = checked;
  });
  submitStatusEl.textContent = "";
  loadProfile();
});

entityTypeCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    syncAllFederalCheckbox();
    submitStatusEl.textContent = "";
    loadProfile();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const state = stateSelect.value;
  const entityTypes = getSelectedEntityTypes();
  const selectedRights = getSelectedRights();
  const selectedPiiItems = getSelectedPiiItems();

  if (!state) {
    submitStatusEl.textContent = "State is required.";
    return;
  }

  if (selectedRights.length === 0) {
    submitStatusEl.textContent = "Select at least one privacy right.";
    return;
  }

  if (!selectedRights.every((item) => currentRights.includes(item))) {
    submitStatusEl.textContent = "Please re-select rights from the current list.";
    return;
  }

  if (selectedPiiItems.length === 0) {
    submitStatusEl.textContent = "Select at least one PII item.";
    return;
  }

  if (!selectedPiiItems.every((item) => currentPiiOptions.includes(item))) {
    submitStatusEl.textContent = "Please re-select PII items from the current list.";
    return;
  }

  const payload = {
    State: state,
    Entity_Types: entityTypes,
    Selected_Rights: selectedRights,
    PII_Items: selectedPiiItems,
    User_Intent: `Structured request based on selected rights and PII. Rights: ${selectedRights.join(
      "; "
    )}. PII: ${selectedPiiItems.join("; ")}.`
  };

  submitStatusEl.textContent = "Submitting request...";

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let backendError = `submit failed with ${response.status}`;
      try {
        const errPayload = await response.json();
        if (typeof errPayload?.error === "string" && errPayload.error.trim()) {
          backendError = errPayload.error.trim();
        }
      } catch (_err) {
        // Keep fallback message when error payload is not JSON.
      }
      throw new Error(backendError);
    }

    const data = await response.json();
    submitStatusEl.textContent = `Request submitted. Reference: ${data.id}`;
    form.reset();
    entityTypeCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    allFederalCheckbox.checked = false;
    renderCheckboxGroup(piiList, "pii_items", currentPiiOptions, []);
    resetRightsSection();
  } catch (err) {
    submitStatusEl.textContent = `Could not submit: ${err.message}`;
  }
});

populateStateOptions();
loadPiiOptions();
resetRightsSection();
