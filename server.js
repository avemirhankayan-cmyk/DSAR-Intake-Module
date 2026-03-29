// Add this right after your 'const' declarations
if (!process.env.OPENAI_API_KEY || !process.env.ADMIN_KEY) {
  console.warn("⚠️ WARNING: Environment variables are missing.");
  console.warn("The app will run, but LLM features and Admin security will be disabled.");
  // Optional: process.exit(1); // Un-comment this to force the app to stop entirely
}
const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_KEY = process.env.ADMIN_KEY || "demo-admin-key";
const ACTUAL_PII_PROVIDER_URL = process.env.ACTUAL_PII_PROVIDER_URL || "";
const ACTUAL_PII_PROVIDER_TOKEN = process.env.ACTUAL_PII_PROVIDER_TOKEN || "";
const ACTUAL_PII_PROVIDER_TIMEOUT_MS = Number(process.env.ACTUAL_PII_PROVIDER_TIMEOUT_MS || 4000);
const ACTUAL_PII_STORE_PATH =
  process.env.ACTUAL_PII_STORE_PATH || path.join(__dirname, "data", "actual_pii_store.json");
const submissions = [];
let actualPiiStoreLoaded = false;
let actualPiiStore = {};

const CA_RIGHTS = [
  "See what info you have about me",
  "Delete my info",
  "Fix wrong info",
  "Get a copy of my info",
  "Stop selling or sharing my info",
  "Limit use of sensitive info",
  "Do not treat me unfairly for making a request"
];

const CA_CATEGORIES = [
  "Access my info",
  "Delete my info",
  "Fix my info",
  "Get a copy of my info",
  "Stop sale or sharing",
  "Limit sensitive info use",
  "General privacy request"
];

const COMPREHENSIVE_RIGHTS = [
  "See what data you have about me",
  "Fix wrong data",
  "Delete my data",
  "Get a copy of my data",
  "Stop targeted ads",
  "Stop sale of my data",
  "Stop profiling for major decisions",
  "Appeal if you deny my request"
];

const COMPREHENSIVE_CATEGORIES = [
  "Access my data",
  "Delete my data",
  "Fix my data",
  "Get a copy of my data",
  "Stop targeted ads",
  "Stop data sale",
  "Stop profiling",
  "Appeal a denied request",
  "General privacy request"
];

const LIMITED_RIGHTS = [
  "See what data you have about me",
  "Delete my data",
  "Get a copy of my data",
  "Stop targeted ads",
  "Stop sale of my data"
];

const LIMITED_CATEGORIES = [
  "Access my data",
  "Delete my data",
  "Get a copy of my data",
  "Stop targeted ads",
  "Stop data sale",
  "General privacy request"
];

const FLORIDA_RIGHTS = [
  "See what data you have about me",
  "Delete my data",
  "Fix wrong data",
  "Stop sale of my data",
  "Stop targeted ads",
  "Use this only when Florida law applies to the company"
];

const FLORIDA_CATEGORIES = [
  "Access my data",
  "Delete my data",
  "Fix my data",
  "Stop targeted ads",
  "Stop data sale",
  "General privacy request"
];

const NO_BROAD_LAW_RIGHTS = [
  "See what personal data you have about me",
  "Delete personal data linked to my account (when allowed)",
  "Fix wrong personal data",
  "Get a copy of my data",
  "Stop sale or sharing of my data (if applicable)",
  "Stop targeted advertising (if applicable)",
  "Tell me if my state law gives additional rights"
];

const NO_BROAD_LAW_CATEGORIES = [
  "Access my data",
  "Delete my data",
  "Fix my data",
  "Get a copy of my data",
  "Stop targeted ads",
  "Stop data sale",
  "General privacy request"
];

const NEVADA_RIGHTS = [
  "Ask you not to sell certain covered personal data",
  "See what personal data you have about me",
  "Delete personal data linked to my account (when allowed)",
  "Get a copy of my data",
  "General privacy request"
];

const NEVADA_CATEGORIES = [
  "Stop data sale",
  "Access my data",
  "Delete my data",
  "Get a copy of my data",
  "General privacy request"
];

const WASHINGTON_RIGHTS = [
  "See what consumer health data you have about me",
  "Delete my consumer health data",
  "Withdraw consent for collecting or sharing consumer health data",
  "Ask who received my consumer health data",
  "General privacy request"
];

const WASHINGTON_CATEGORIES = [
  "Access my health data",
  "Delete my health data",
  "Withdraw consent",
  "Third-party disclosure list",
  "General privacy request"
];

const MAINE_RIGHTS = [
  "Ask my internet provider what data it collects about me",
  "Ask my provider to stop using, disclosing, selling or allowing access without consent",
  "Get account-related data details where available",
  "General privacy request"
];

const MAINE_CATEGORIES = [
  "Access my ISP data",
  "Stop ISP data use or sharing",
  "Get a copy of my data",
  "General privacy request"
];

const ALL_US_STATES = [
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

const COMPREHENSIVE_STATE_LAWS = {
  Colorado: "Colorado Privacy Act (CPA)",
  Connecticut: "Connecticut Data Privacy Act (CTDPA)",
  Delaware: "Delaware Personal Data Privacy Act (DPDPA)",
  Indiana: "Indiana Consumer Data Protection Act",
  Kentucky: "Kentucky Consumer Data Protection Act (KCDPA)",
  Maryland: "Maryland Online Data Privacy Act (MODPA)",
  Minnesota: "Minnesota Consumer Data Privacy Act (MCDPA)",
  Montana: "Montana Consumer Data Privacy Act (MTCDPA)",
  Nebraska: "Nebraska Data Privacy Act (NDPA)",
  "New Hampshire": "New Hampshire Privacy Act (NHPA)",
  "New Jersey": "New Jersey Data Privacy Act (NJDPA)",
  Oregon: "Oregon Consumer Privacy Act (OCPA)",
  "Rhode Island": "Rhode Island Data Transparency and Privacy Protection Act",
  Tennessee: "Tennessee Information Protection Act (TIPA)",
  Texas: "Texas Data Privacy and Security Act (TDPSA)",
  Virginia: "Virginia Consumer Data Protection Act (VCDPA)"
};

const FEDERAL_ENTITY_PROFILES = {
  general: {
    label: "General business",
    law: "",
    rights: [],
    categories: []
  },
  hipaa: {
    label: "Healthcare provider or health plan (HIPAA)",
    law: "HIPAA Privacy Rule",
    rights: [
      "See and get a copy of my health records",
      "Ask to fix wrong information in my health records",
      "Get a list of certain disclosures of my health information",
      "Ask for confidential communications (for example, different mailing address)",
      "Ask to limit certain uses or disclosures of my health information",
      "Get a copy of your Notice of Privacy Practices"
    ],
    categories: [
      "Access my health data",
      "Correct my health data",
      "Disclosure accounting",
      "Confidential communications",
      "Restrict health data use",
      "General privacy request"
    ]
  },
  glba: {
    label: "Financial institution (GLBA)",
    law: "Gramm-Leach-Bliley Act (GLBA)",
    rights: [
      "Get your privacy notice explaining your data-sharing practices",
      "Opt out of certain sharing with non-affiliated third parties",
      "Ask for details about how my financial data is used and shared",
      "Ask how to limit certain marketing-related sharing where applicable"
    ],
    categories: [
      "Get privacy notice",
      "Stop data sharing",
      "Marketing sharing limits",
      "General privacy request"
    ]
  },
  fcra: {
    label: "Consumer reporting agency or credit reporting context (FCRA)",
    law: "Fair Credit Reporting Act (FCRA)",
    rights: [
      "Get a copy of my credit report file",
      "Dispute inaccurate or incomplete information",
      "Ask that outdated negative information be removed when required",
      "Place or manage a fraud alert or security freeze",
      "Know if information in my file was used against me"
    ],
    categories: [
      "Access my credit file",
      "Dispute inaccurate credit info",
      "Fraud alert or security freeze",
      "Adverse action details",
      "General privacy request"
    ]
  },
  ferpa: {
    label: "School or university (FERPA)",
    law: "Family Educational Rights and Privacy Act (FERPA)",
    rights: [
      "Inspect and review my education records",
      "Ask to correct inaccurate education records",
      "Control disclosure of education records where consent is required",
      "File a FERPA complaint"
    ],
    categories: [
      "Access education records",
      "Correct education records",
      "Control education record disclosure",
      "FERPA complaint",
      "General privacy request"
    ]
  },
  coppa: {
    label: "Child-directed online service under 13 (COPPA parent rights)",
    law: "Children's Online Privacy Protection Act (COPPA)",
    rights: [
      "Review what personal information is collected from my child",
      "Delete personal information collected from my child",
      "Refuse further collection or use of my child's data",
      "Revoke prior consent for my child's data processing"
    ],
    categories: [
      "Review child's data",
      "Delete child's data",
      "Revoke consent",
      "Stop child data collection",
      "General privacy request"
    ]
  }
};

const FEDERAL_ENTITY_KEYS = ["hipaa", "glba", "fcra", "ferpa", "coppa"];
const PII_OPTIONS = [
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

function uniqueList(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

function buildStateProfile(state) {
  if (state === "California") {
    return { law: "CCPA/CPRA", rights: CA_RIGHTS, categories: CA_CATEGORIES };
  }

  if (state === "Florida") {
    return { law: "Florida Digital Bill of Rights (scope-limited)", rights: FLORIDA_RIGHTS, categories: FLORIDA_CATEGORIES };
  }

  if (state === "Utah") {
    return { law: "Utah Consumer Privacy Act (UCPA)", rights: LIMITED_RIGHTS, categories: LIMITED_CATEGORIES };
  }

  if (state === "Iowa") {
    return { law: "Iowa Consumer Data Protection Act", rights: LIMITED_RIGHTS, categories: LIMITED_CATEGORIES };
  }

  if (state === "Nevada") {
    return { law: "Nevada online sale opt-out law (limited scope)", rights: NEVADA_RIGHTS, categories: NEVADA_CATEGORIES };
  }

  if (state === "Washington") {
    return {
      law: "Washington My Health My Data Act (scope-limited)",
      rights: WASHINGTON_RIGHTS,
      categories: WASHINGTON_CATEGORIES
    };
  }

  if (state === "Maine") {
    return {
      law: "Maine ISP privacy law (provider-specific scope)",
      rights: MAINE_RIGHTS,
      categories: MAINE_CATEGORIES
    };
  }

  if (COMPREHENSIVE_STATE_LAWS[state]) {
    return {
      law: COMPREHENSIVE_STATE_LAWS[state],
      rights: COMPREHENSIVE_RIGHTS,
      categories: COMPREHENSIVE_CATEGORIES
    };
  }

  return {
    law: "No broad statewide consumer privacy law (general intake profile)",
    rights: NO_BROAD_LAW_RIGHTS,
    categories: NO_BROAD_LAW_CATEGORIES
  };
}

const RIGHTS_AND_CATEGORIES = Object.fromEntries(
  ALL_US_STATES.map((state) => [state, buildStateProfile(state)])
);

const DEFAULT_PROFILE = {
  law: "General intake profile",
  rights: NO_BROAD_LAW_RIGHTS,
  categories: NO_BROAD_LAW_CATEGORIES
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function normalizeText(value, maxLen = 2000) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLen);
}

function normalizeRights(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 160))
    .slice(0, 20);
}

function normalizePiiItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueList(
    value
      .filter((item) => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().slice(0, 160))
      .filter((item) => PII_OPTIONS.includes(item))
      .slice(0, 30)
  );
}

async function ensureActualPiiStoreLoaded() {
  if (actualPiiStoreLoaded) {
    return;
  }

  try {
    const raw = await fs.readFile(ACTUAL_PII_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    actualPiiStore = parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    actualPiiStore = {};
  }

  actualPiiStoreLoaded = true;
}

async function persistActualPiiStore() {
  await fs.mkdir(path.dirname(ACTUAL_PII_STORE_PATH), { recursive: true });
  await fs.writeFile(ACTUAL_PII_STORE_PATH, JSON.stringify(actualPiiStore, null, 2), "utf8");
}

function extractActualPiiFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = [payload.actualPiiItems, payload.Actual_PII_Items, payload.items];
  const found = candidates.find((item) => Array.isArray(item));
  if (!found) {
    return null;
  }

  return normalizePiiItems(found);
}

async function fetchActualPiiFromProvider(submission) {
  if (!ACTUAL_PII_PROVIDER_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ACTUAL_PII_PROVIDER_TIMEOUT_MS);

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (ACTUAL_PII_PROVIDER_TOKEN) {
      headers.Authorization = "Bearer " + ACTUAL_PII_PROVIDER_TOKEN;
    }

    const response = await fetch(ACTUAL_PII_PROVIDER_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        requestId: submission.Id,
        state: submission.State,
        subjectReference: submission.Subject_Reference || "",
        category: submission.Category,
        forecastPiiItems: submission.PII_Items || [],
        selectedRights: submission.Selected_Rights || []
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return extractActualPiiFromPayload(payload);
  } catch (_err) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getActualPiiItemsForSubmission(submission) {
  const externalResult = await fetchActualPiiFromProvider(submission);
  if (externalResult !== null) {
    return externalResult;
  }

  await ensureActualPiiStoreLoaded();
  return normalizePiiItems(actualPiiStore[submission.Id] || []);
}
function requireAdmin(req, res, next) {
  const providedKey = req.get("x-admin-key");
  if (!providedKey || providedKey !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function cloneProfile(profile, source) {
  return {
    law: profile.law,
    rights: [...profile.rights],
    categories: [...profile.categories],
    source
  };
}

function getFederalProfile(entityType) {
  const key = typeof entityType === "string" && entityType.trim() ? entityType.trim() : "general";
  const profile = FEDERAL_ENTITY_PROFILES[key] || FEDERAL_ENTITY_PROFILES.general;
  return {
    key,
    label: profile.label,
    law: profile.law,
    rights: [...profile.rights],
    categories: [...profile.categories]
  };
}

function normalizeEntityTypes(value) {
  const raw = [];

  if (Array.isArray(value)) {
    raw.push(...value);
  } else if (typeof value === "string" && value.trim()) {
    raw.push(...value.split(","));
  }

  return uniqueList(
    raw
      .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
      .filter((item) => FEDERAL_ENTITY_KEYS.includes(item))
  );
}

async function getCombinedProfile(state, entityTypesInput) {
  const profile = RIGHTS_AND_CATEGORIES[state] || DEFAULT_PROFILE;
  const stateProfile = cloneProfile(profile, "static");
  const entityTypes = normalizeEntityTypes(entityTypesInput);
  const federalProfiles = entityTypes.map((type) => getFederalProfile(type));

  const mergedFederalRights = federalProfiles.flatMap((item) => item.rights);
  const mergedFederalCategories = federalProfiles.flatMap((item) => item.categories);
  const mergedFederalLaws = uniqueList(federalProfiles.map((item) => item.law).filter(Boolean));
  const mergedFederalLabels = uniqueList(federalProfiles.map((item) => item.label).filter(Boolean));

  const rights = uniqueList([...stateProfile.rights, ...mergedFederalRights]);
  const categories = uniqueList([...stateProfile.categories, ...mergedFederalCategories, "General privacy request"]);
  const federalLaw = mergedFederalLaws.join(" + ");
  const law = federalLaw ? `${stateProfile.law} + ${federalLaw}` : stateProfile.law;

  return {
    law,
    rights,
    categories,
    source: "static",
    stateLaw: stateProfile.law,
    federalLaw,
    entityTypes: entityTypes.length > 0 ? entityTypes : ["general"],
    entityLabels: entityTypes.length > 0 ? mergedFederalLabels : ["State privacy rights only"],
    entityType: entityTypes[0] || "general",
    entityLabel: entityTypes.length > 0 ? mergedFederalLabels.join(" + ") : "State privacy rights only"
  };
}

function heuristicCategory(categories, userIntent) {
  const text = (userIntent || "").toLowerCase();

  const checks = [
    {
      keys: ["delete", "erase", "remove"],
      pick: ["Delete my info", "Delete my data", "Deletion request"]
    },
    {
      keys: ["correct", "fix", "update", "wrong"],
      pick: ["Fix my info", "Fix my data", "Correction request"]
    },
    {
      keys: ["copy", "export", "portability", "download"],
      pick: ["Get a copy of my info", "Get a copy of my data"]
    },
    {
      keys: ["targeted ads", "ads", "advertising", "tracking"],
      pick: ["Stop targeted ads", "Opt-out request"]
    },
    {
      keys: ["sell", "sharing", "share", "sale"],
      pick: ["Stop sale or sharing", "Stop data sale", "Opt-out request"]
    },
    {
      keys: ["sensitive", "limit"],
      pick: ["Limit sensitive info use"]
    },
    {
      keys: ["profile", "profiling", "automated decision"],
      pick: ["Stop profiling"]
    },
    {
      keys: ["appeal", "denied", "reconsider", "review decision"],
      pick: ["Appeal a denied request"]
    },
    {
      keys: ["access", "see", "what data", "what info", "know what"],
      pick: ["Access my info", "Access my data", "Access request"]
    }
  ];

  for (const rule of checks) {
    if (rule.keys.some((k) => text.includes(k))) {
      const match = rule.pick.find((candidate) => categories.includes(candidate));
      if (match) {
        return { category: match, confidence: 0.7, source: "heuristic" };
      }
    }
  }

  return { category: "General privacy request", confidence: 0.4, source: "heuristic" };
}

function inferCategoryFromRights(selectedRights, categories) {
  const text = selectedRights.join(" ").toLowerCase();

  const checks = [
    { keys: ["delete", "erase", "remove"], picks: ["Delete my info", "Delete my data", "Deletion request"] },
    { keys: ["correct", "fix", "update", "wrong"], picks: ["Fix my info", "Fix my data", "Correction request"] },
    { keys: ["copy", "export", "portability", "download"], picks: ["Get a copy of my info", "Get a copy of my data"] },
    { keys: ["targeted ads", "advertising", "tracking"], picks: ["Stop targeted ads", "Opt-out request"] },
    { keys: ["sell", "sharing", "sale"], picks: ["Stop sale or sharing", "Stop data sale", "Opt-out request"] },
    { keys: ["profile", "profiling", "automated decision"], picks: ["Stop profiling"] },
    { keys: ["access", "see", "know what"], picks: ["Access my info", "Access my data", "Access request"] }
  ];

  for (const check of checks) {
    if (!check.keys.some((key) => text.includes(key))) {
      continue;
    }
    const match = check.picks.find((pick) => categories.includes(pick));
    if (match) {
      return match;
    }
  }

  return categories.includes("General privacy request") ? "General privacy request" : categories[0] || "General privacy request";
}

async function llmCategory(state, userIntent, categories, entityType, lawContext) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You classify privacy requests into one category. Return strict JSON with keys category, confidence, reason."
        },
        {
          role: "user",
          content:
            `State: ${state}\nEntity context: ${entityType || "general"}\nLaw context: ${lawContext}\nAllowed categories: ${categories.join(", ")}\n` +
            `User intent: ${userIntent}\nPick the single best category from the allowed list.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_err) {
    return null;
  }

  if (!parsed?.category || !categories.includes(parsed.category)) {
    return null;
  }

  return {
    category: parsed.category,
    confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : 0.85,
    reason: parsed.reason || "LLM matched the request intent.",
    source: "llm"
  };
}

app.post("/api/analyze-intent", async (req, res) => {
  const state = req.body?.state;
  const userIntent = req.body?.intent;

  if (!state || !userIntent) {
    return res.status(400).json({ error: "state and intent are required" });
  }

  const entityTypes = normalizeEntityTypes(
    req.body?.entityTypes || req.body?.Entity_Types || req.body?.entityType || req.body?.Entity_Type
  );
  const profile = await getCombinedProfile(state, entityTypes);
  const categories = profile.categories;

  try {
    const llmResult = await llmCategory(state, userIntent, categories, profile.entityLabel, profile.law);
    if (llmResult) {
      return res.json({
        ...llmResult,
        availableCategories: categories,
        lawContext: profile.law,
        stateLaw: profile.stateLaw,
        rightsSource: profile.source,
        federalLaw: profile.federalLaw,
        entityType: profile.entityType,
        entityTypes: profile.entityTypes,
        entityLabel: profile.entityLabel,
        entityLabels: profile.entityLabels
      });
    }
  } catch (_err) {
    // Fall through to heuristic classifier if LLM is unavailable.
  }

  return res.json({
    ...heuristicCategory(categories, userIntent),
    availableCategories: categories,
    lawContext: profile.law,
    stateLaw: profile.stateLaw,
    rightsSource: profile.source,
    federalLaw: profile.federalLaw,
    entityType: profile.entityType,
    entityTypes: profile.entityTypes,
    entityLabel: profile.entityLabel,
    entityLabels: profile.entityLabels
  });
});

app.get("/api/rights/:state", async (req, res) => {
  const state = req.params.state;
  const entityTypes = normalizeEntityTypes(req.query?.entityTypes || req.query?.entityType);
  const profile = await getCombinedProfile(state, entityTypes);
  return res.json(profile);
});

app.get("/api/pii-options", (_req, res) => {
  return res.json({ options: PII_OPTIONS });
});

app.post("/api/submissions", async (req, res) => {
  const state = normalizeText(req.body?.State || req.body?.state, 80);
  const requestedCategory = normalizeText(req.body?.Category || req.body?.category, 160);
  const userIntent = normalizeText(req.body?.User_Intent || req.body?.user_intent || req.body?.intent, 4000);
  const subjectReference = normalizeText(
    req.body?.Subject_Reference || req.body?.subject_reference || req.body?.subjectReference,
    200
  );
  const entityTypes = normalizeEntityTypes(
    req.body?.Entity_Types ||
      req.body?.entity_types ||
      req.body?.entityTypes ||
      req.body?.Entity_Type ||
      req.body?.entity_type ||
      req.body?.entityType
  );
  const selectedRights = normalizeRights(req.body?.Selected_Rights || req.body?.selected_rights);
  const piiItems = normalizePiiItems(req.body?.PII_Items || req.body?.pii_items || req.body?.piiItems);

  if (!state) {
    return res.status(400).json({ error: "State is required" });
  }

  const profile = await getCombinedProfile(state, entityTypes);

  if (selectedRights.length === 0) {
    return res.status(400).json({ error: "At least one selected right is required" });
  }

  if (!selectedRights.every((right) => profile.rights.includes(right))) {
    return res.status(400).json({ error: "One or more selected rights are not valid for the selected profile" });
  }

  if (piiItems.length === 0) {
    return res.status(400).json({ error: "At least one PII item is required" });
  }

  if (requestedCategory && !profile.categories.includes(requestedCategory)) {
    return res.status(400).json({ error: "Category is not valid for the selected profile" });
  }

  const category = requestedCategory || inferCategoryFromRights(selectedRights, profile.categories);
  const effectiveIntent =
    userIntent ||
    `Structured request: ${category}. Rights: ${selectedRights.join("; ")}. PII: ${piiItems.join("; ")}.`;
  const submission = {
    Id: `REQ-${Date.now()}`,
    State: state,
    Subject_Reference: subjectReference,
    Entity_Types: profile.entityTypes,
    Entity_Labels: profile.entityLabels,
    Entity_Type: profile.entityType,
    Entity_Label: profile.entityLabel,
    Category: category,
    Selected_Rights: selectedRights,
    PII_Items: piiItems,
    User_Intent: effectiveIntent,
    Timestamp: new Date().toISOString(),
    Law_Context: profile.law,
    State_Law_Context: profile.stateLaw,
    Federal_Law_Context: profile.federalLaw
  };

  submissions.unshift(submission);
  if (submissions.length > 500) {
    submissions.length = 500;
  }

  return res.status(201).json({ ok: true, id: submission.Id, submission });
});

app.get("/api/admin/submissions", requireAdmin, async (req, res) => {
  const enriched = await Promise.all(
    submissions.map(async (entry) => ({
      ...entry,
      Actual_PII_Items: await getActualPiiItemsForSubmission(entry)
    }))
  );

  return res.json({
    count: enriched.length,
    submissions: enriched
  });
});

app.post("/api/admin/submissions/:id/actual-pii", requireAdmin, async (req, res) => {
  const id = normalizeText(req.params.id, 80);
  const rawItems =
    req.body?.Actual_PII_Items ?? req.body?.actual_pii_items ?? req.body?.actualPiiItems;

  if (!Array.isArray(rawItems)) {
    return res.status(400).json({ error: "Actual_PII_Items must be an array" });
  }

  const normalizedItems = normalizePiiItems(rawItems);
  if (rawItems.length > 0 && normalizedItems.length === 0) {
    return res.status(400).json({ error: "No valid PII items were provided" });
  }

  const target = submissions.find((entry) => entry.Id === id);
  if (!target) {
    return res.status(404).json({ error: "Submission not found" });
  }

  await ensureActualPiiStoreLoaded();
  actualPiiStore[id] = normalizedItems;
  await persistActualPiiStore();

  return res.json({ ok: true, id, Actual_PII_Items: normalizedItems });
});

app.get("/admin", (_req, res) => {
  return res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Privacy Rights Intake Module running on http://${HOST}:${PORT}`);
  if (!process.env.ADMIN_KEY) {
    console.log("Admin key is using demo default. Set ADMIN_KEY env var for production-like testing.");
  }
});

server.on("error", (err) => {
  console.error("Server startup error:", err.message);
});
