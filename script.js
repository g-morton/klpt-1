const JOURNEYS_KEY = "klpt-journeys";
const ACTIVE_JOURNEY_KEY = "klpt-active-journey-id";
const LEGACY_STORAGE_KEYS = ["klpt-observations", "klptObservations", "observations"];
const STEP_STORAGE_KEY = "klpt-current-step";
const DRAFT_CHILD_NAME_KEY = "klpt-draft-child-name";
const DRAFT_DOMAIN_KEY = "klpt-draft-domain";
const DRAFT_SUBDOMAIN_KEY = "klpt-draft-subdomain";
const DRAFT_ELEMENT_KEY = "klpt-draft-element";
const DRAFT_BEHAVIOUR_KEY = "klpt-draft-behaviour";
const REPORT_NOTES_KEY = "klpt-report-notes";
const DEFAULT_STEP_ID = "domains";
const DOMAINS_DATA_PATH = "assets/data/domains.json";
const NAVIGATION_DATA_PATH = "assets/data/navigation.json";
const MAX_SESSIONS = 5;
const FLOW_STEPS = ["domains", "subdomains", "elements", "behaviours"];
const STEP_ORDER = ["domains", "subdomains", "elements", "behaviours", "statement", "review"];
const JOURNEY_SCHEMA_VERSION = 2;
const STEP_GRADIENTS = [
  "linear-gradient(90deg, #4e9bd0 0%, #5aa8db 100%)",
  "linear-gradient(90deg, #86c8ec 0%, #a6d8f2 100%)",
  "linear-gradient(90deg, #84c96d 0%, #9fd88a 100%)",
  "linear-gradient(90deg, #f0b15d 0%, #f39a57 100%)",
  "linear-gradient(90deg, #db6f82 0%, #e58ea0 100%)",
  "linear-gradient(90deg, #9b86d8 0%, #b6a5ea 100%)"
];
const STEP_HELPER_MAP = {
  domains: "assets/images/helper-1.svg",
  subdomains: "assets/images/helper-2.svg",
  elements: "assets/images/helper-3.svg",
  behaviours: "assets/images/helper-3.svg",
  statement: "assets/images/helper-4.svg",
  review: "assets/images/helper-5.svg"
};
let deleteModalEscapeHandler = null;

function readLegacySessions() {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn("Unable to parse legacy sessions for key:", key, error);
    }
  }

  return [];
}

function readJourneys() {
  try {
    const raw = localStorage.getItem(JOURNEYS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to parse journeys:", error);
    return [];
  }
}

function writeJourneys(journeys) {
  localStorage.setItem(JOURNEYS_KEY, JSON.stringify(journeys));
}

function newJourneyId() {
  return `obs-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function hashToAvatarIndex(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 8;
}

function formatSessionTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved session";
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((todayStart - dateStart) / 86400000);

  const timeLabel = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date).toLowerCase();

  let dayLabel = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(date);

  if (dayDiff === 0) {
    dayLabel = "Today";
  } else if (dayDiff === 1) {
    dayLabel = "Yesterday";
  }

  return `${dayLabel} - ${timeLabel}`;
}

function formatCreatedTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Created recently";
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((todayStart - dateStart) / 86400000);

  const timeLabel = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date).toLowerCase();

  let dayLabel = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(date);

  if (dayDiff === 0) {
    dayLabel = "today";
  } else if (dayDiff === 1) {
    dayLabel = "yesterday";
  }

  return `Created ${dayLabel} at ${timeLabel}`;
}

function normaliseSession(session, index) {
  return {
    title: session.title || session.name || `Observation ${index + 1}`,
    subtitle: formatSessionTime(session.updatedAt || session.createdAt || session.date),
    avatarIndex: Number.isInteger(session.avatarIndex)
      ? session.avatarIndex % 8
      : index % 8
  };
}

function normaliseJourneyForSession(journey, index) {
  const state = getJourneyState(journey);
  const domainName = journey.path?.domainName || "";
  const title = state.childName.trim() || domainName || "New observation";
  const friendlyTime = journey.friendlyUpdatedAt || formatSessionTime(journey.updatedAt || journey.createdAt);
  const lastChoice =
    state.lastSelection?.label ||
    journey.path?.elementName ||
    journey.path?.subDomainName ||
    journey.path?.domainName ||
    "";
  return {
    id: journey.id || "",
    title,
    subtitle: lastChoice ? `${friendlyTime} | ${lastChoice}` : friendlyTime,
    createdAt: journey.createdAt || journey.updatedAt || "",
    avatarIndex: Number.isInteger(journey.avatarIndex)
      ? journey.avatarIndex % 8
      : hashToAvatarIndex(journey.id || String(index))
  };
}

function readSessions() {
  const journeys = readJourneys()
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, MAX_SESSIONS);

  if (journeys.length > 0) {
    return journeys.map(normaliseJourneyForSession);
  }

  return readLegacySessions()
    .slice(0, MAX_SESSIONS)
    .map(normaliseSession);
}

function createSessionCard(session, index) {
  const item = typeof session?.subtitle === "string" ? session : normaliseSession(session, index);
  const card = document.createElement("article");
  const button = document.createElement("button");
  const spriteIndex = item.avatarIndex % 8;
  const col = spriteIndex % 4;
  const row = Math.floor(spriteIndex / 4);

  card.className = "session-card";
  button.className = "session-card__main";
  button.type = "button";
  button.setAttribute("aria-label", `Open ${item.title}`);
  button.innerHTML = `
    <span class="session-card__avatar" style="--avatar-col:${col}; --avatar-row:${row};" aria-hidden="true"></span>
    <span class="session-card__body">
      <span class="session-card__title">${item.title}</span>
      <span class="session-card__meta">${item.subtitle}</span>
    </span>
    <span class="session-card__chevron" aria-hidden="true">
      <i class="fa-solid fa-angle-right"></i>
    </span>
  `;
  button.addEventListener("click", () => {
    if (!item.id) {
      window.location.href = "observation.html";
      return;
    }
    openJourneySession(item.id);
  });

  card.append(button);

  if (item.id) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "session-card__delete";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${item.title}`);
    deleteButton.innerHTML = '<i class="fa-solid fa-times" aria-hidden="true"></i>';
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openDeleteSessionDialog(item);
    });
    card.append(deleteButton);
  }

  return card;
}

function iconClassForHelp(icon) {
  const iconMap = {
    lightbulb: "fa-regular fa-lightbulb",
    circle_info: "fa-solid fa-circle-info",
    wand_magic_sparkles: "fa-solid fa-wand-magic-sparkles"
  };

  return iconMap[icon] || iconMap.lightbulb;
}

function toLabel(value) {
  if (!value) {
    return "Helpful Tip";
  }

  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getActiveStepId() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("step") ||
    localStorage.getItem(STEP_STORAGE_KEY) ||
    document.body.dataset.step ||
    DEFAULT_STEP_ID
  );
}

function setActiveStep(stepId) {
  document.body.dataset.step = stepId || DEFAULT_STEP_ID;
  localStorage.setItem(STEP_STORAGE_KEY, document.body.dataset.step);
  updateHelperFigure(document.body.dataset.step);
  syncChildNameVisibility(document.body.dataset.step);
}

function updateHelperFigure(stepId) {
  const helper = document.querySelector(".action-panel__helper");
  if (!helper) {
    return;
  }

  const nextSrc = STEP_HELPER_MAP[stepId] || STEP_HELPER_MAP[DEFAULT_STEP_ID];
  if (helper.getAttribute("src") === nextSrc) {
    return;
  }

  helper.setAttribute("src", nextSrc);
}

function stepGradientFor(stepId) {
  const index = STEP_ORDER.indexOf(stepId);
  return STEP_GRADIENTS[index >= 0 ? index : 0];
}

function syncChildNameVisibility(stepId) {
  const childNameField = document.querySelector(".child-name-field");
  if (!childNameField) {
    return;
  }
  childNameField.hidden = stepId !== "domains";
}

async function renderStepper() {
  const stepper = document.getElementById("stepper");
  const progressLabel = document.getElementById("progress-label");
  if (!stepper) {
    return;
  }

  try {
    const response = await fetch(NAVIGATION_DATA_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const navigation = await response.json();
    const activeStepId = getActiveStepId();
    const selectedDomain = getSelectedDomain();
    const hasSubDomains = Array.isArray(selectedDomain?.subDomains) && selectedDomain.subDomains.length > 0;
    const steps = (navigation.steps || []).filter((step) => {
      if (!FLOW_STEPS.includes(step.id)) {
        return false;
      }
      if (step.id === "subdomains" && !hasSubDomains) {
        return false;
      }
      return true;
    });
    const activeIndex = Math.max(steps.findIndex((step) => step.id === activeStepId), 0);
    const selectedElements = getSelectedElements();
    const selectedElementLabel = selectedElements.length
      ? `${selectedElements[0]?.name || ""}${selectedElements.length > 1 ? ` +${selectedElements.length - 1}` : ""}`
      : "";
    const selectedTrackCount = observationState.selectedBehaviourIds.length;
    const totalTrackCount = getSelectedElementIds().length;
    const selectedBehaviourLabel = selectedTrackCount > 0
      ? `${selectedTrackCount}/${totalTrackCount || selectedTrackCount} tracks`
      : "";
    const labelByStep = {
      domains: getSelectedDomain()?.name || "",
      subdomains: getSelectedSubDomain()?.name || "",
      elements: selectedElementLabel,
      behaviours: selectedBehaviourLabel
    };

    const items = steps.map((step, index) => {
      const item = document.createElement("div");
      item.className = "stepper__item";
      item.dataset.stepId = step.id;
      item.style.setProperty("--step-color", STEP_GRADIENTS[index % STEP_GRADIENTS.length]);
      const chipLabel = (labelByStep[step.id] || "").trim();
      const canJump = canNavigateToStep(step.id);

      if (index < activeIndex) {
        item.classList.add("is-complete");
      }

      if (index === activeIndex) {
        item.classList.add("is-active");
      }

      if (chipLabel) {
        item.classList.add("is-filled");
      }

      if (canJump) {
        item.classList.add("is-clickable");
      } else {
        item.classList.add("is-locked");
      }

      const chipButton = document.createElement("button");
      chipButton.type = "button";
      chipButton.className = "stepper__chip";
      chipButton.innerHTML = chipLabel || "&nbsp;";
      chipButton.disabled = !canJump;
      chipButton.setAttribute("aria-label", step.title || chipLabel || `Step ${index + 1}`);
      chipButton.title = step.title || chipLabel || `Step ${index + 1}`;
      chipButton.addEventListener("click", () => {
        navigateToStep(step.id);
      });
      item.append(chipButton);

      return item;
    });

    stepper.replaceChildren(...items);
    if (progressLabel) {
      progressLabel.textContent = steps[activeIndex]?.title || "Step";
    }
  } catch (error) {
    console.warn("Unable to load navigation data:", error);
    stepper.replaceChildren();
    if (progressLabel) {
      progressLabel.textContent = "Step";
    }
  }
}

async function renderHelpTip() {
  const eyebrow = document.querySelector(".tip-card__eyebrow");
  const title = document.querySelector(".tip-card__title");
  const body = document.querySelector(".tip-card__body");
  const icon = document.querySelector(".tip-card__icon i");

  if (!eyebrow || !title || !body || !icon) {
    return;
  }

  try {
    const response = await fetch("assets/data/help.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const helpData = await response.json();
    const activeStepId = getActiveStepId();
    const stepEntry = helpData.steps?.find((step) => step.id === activeStepId);
    const entry = stepEntry || helpData.default || {};

    eyebrow.textContent = toLabel(activeStepId);
    title.textContent = entry.title || "Helpful Tip";
    body.textContent = entry.body || "";
    icon.className = iconClassForHelp(entry.icon);
  } catch (error) {
    console.warn("Unable to load help tip data:", error);
    eyebrow.textContent = "Helpful Tip";
    title.textContent = "Stay on track";
    body.textContent = "Use the guidance on each page to move through your observation with confidence.";
    icon.className = iconClassForHelp("lightbulb");
  }
}

const observationState = {
  layer: "domains",
  selectedDomainId: "",
  selectedSubDomainId: "",
  selectedElementId: "",
  selectedElementIds: [],
  focusedBehaviourId: "",
  selectedBehaviourIds: [],
  selectedBehaviourByElement: {}
};
let domainsCache = [];
let behaviourCarouselIndexByElement = {};

function currentStepFromLayer(layer) {
  if (layer === "subdomains") {
    return "subdomains";
  }
  if (layer === "elements") {
    return "elements";
  }
  if (layer === "behaviours") {
    return "behaviours";
  }
  return "domains";
}

function canNavigateToStep(stepId) {
  const domain = getSelectedDomain();
  const hasSubDomains = Array.isArray(domain?.subDomains) && domain.subDomains.length > 0;
  if (stepId === "domains") {
    return true;
  }
  if (stepId === "subdomains") {
    return Boolean(domain) && hasSubDomains;
  }
  if (stepId === "elements") {
    if (!domain) {
      return false;
    }
    if (hasSubDomains) {
      return Boolean(observationState.selectedSubDomainId);
    }
    return true;
  }
  if (stepId === "behaviours") {
    return getSelectedElementIds().length > 0;
  }
  return false;
}

function navigateToStep(stepId) {
  if (!FLOW_STEPS.includes(stepId) || !canNavigateToStep(stepId)) {
    return;
  }
  observationState.layer = stepId;
  setActiveStep(currentStepFromLayer(observationState.layer));
  persistObservationDraft();
  upsertActiveJourney();
  renderStepper();
  renderHelpTip();
  renderCurrentLayerOptions();
}

function getSelectedEntityId() {
  if (observationState.layer === "behaviours") {
    return observationState.focusedBehaviourId;
  }
  if (observationState.layer === "elements") {
    return observationState.selectedElementId;
  }
  if (observationState.layer === "subdomains") {
    return observationState.selectedSubDomainId;
  }
  return observationState.selectedDomainId;
}

function getSelectedElementIds() {
  const ids = Array.isArray(observationState.selectedElementIds)
    ? observationState.selectedElementIds
    : [];
  const normalised = ids.filter((id) => typeof id === "string" && id);
  if (normalised.length) {
    return [...new Set(normalised)];
  }
  return observationState.selectedElementId ? [observationState.selectedElementId] : [];
}

function updateNextButtonVisibility() {
  const nextButton = document.getElementById("next-step-button");
  if (!nextButton) {
    return;
  }

  const label = nextButton.querySelector("span:last-child");
  if (observationState.layer === "behaviours") {
    if (label) {
      label.textContent = "Report";
    }
    nextButton.hidden = !hasBehaviourSelectionForAllTracks();
    return;
  }

  if (label) {
    label.textContent = "Next";
  }

  if (observationState.layer === "elements") {
    nextButton.hidden = !getSelectedElementIds().length;
    return;
  }

  nextButton.hidden = !getSelectedEntityId();
}

function getSelectedDomain() {
  return domainsCache.find((domain) => domain.id === observationState.selectedDomainId) || null;
}

function getSelectedSubDomain() {
  const domain = getSelectedDomain();
  if (!domain || !Array.isArray(domain.subDomains)) {
    return null;
  }

  return domain.subDomains.find((sub) => sub.id === observationState.selectedSubDomainId) || null;
}

function buildOptionHint(layer, item) {
  return "";
}

function getSelectedElement() {
  const selectedIds = getSelectedElementIds();
  const selectedId = observationState.selectedElementId || selectedIds[0] || "";
  const subDomain = getSelectedSubDomain();
  if (subDomain && Array.isArray(subDomain.elements)) {
    return subDomain.elements.find((item) => item.id === selectedId) || null;
  }
  const domain = getSelectedDomain();
  if (domain && Array.isArray(domain.elements)) {
    return domain.elements.find((item) => item.id === selectedId) || null;
  }
  return null;
}

function getSelectedElements() {
  const selectedIds = getSelectedElementIds();
  if (!selectedIds.length) {
    return [];
  }
  const subDomain = getSelectedSubDomain();
  const pool = Array.isArray(subDomain?.elements)
    ? subDomain.elements
    : (Array.isArray(getSelectedDomain()?.elements) ? getSelectedDomain().elements : []);
  return selectedIds
    .map((id) => pool.find((item) => item.id === id))
    .filter((item) => Boolean(item));
}

function getBehavioursForElement(elementId) {
  const element = getSelectedElements().find((item) => item.id === elementId);
  return element && Array.isArray(element.behaviours) ? element.behaviours : [];
}

function getSelectedBehaviourByElement(elementId) {
  if (!elementId) {
    return "";
  }
  const map = observationState.selectedBehaviourByElement;
  if (!map || typeof map !== "object") {
    return "";
  }
  return typeof map[elementId] === "string" ? map[elementId] : "";
}

function syncSelectedBehaviourIdsFromTracks() {
  const selectedIds = getSelectedElementIds()
    .map((elementId) => getSelectedBehaviourByElement(elementId))
    .filter((id) => typeof id === "string" && id);
  observationState.selectedBehaviourIds = [...new Set(selectedIds)];
  if (!observationState.selectedBehaviourIds.includes(observationState.focusedBehaviourId)) {
    observationState.focusedBehaviourId = observationState.selectedBehaviourIds[0] || "";
  }
}

function hasBehaviourSelectionForAllTracks() {
  const elementIds = getSelectedElementIds();
  if (!elementIds.length) {
    return false;
  }
  return elementIds.every((elementId) => Boolean(getSelectedBehaviourByElement(elementId)));
}

function createSelectionOption(layer, item, selectedValue) {
  const button = document.createElement("button");
  const selectedIds = Array.isArray(selectedValue) ? selectedValue : [];
  const isSelected = layer === "elements"
    ? selectedIds.includes(item.id)
    : item.id === selectedValue;

  button.className = "selection-option";
  button.type = "button";
  button.dataset.itemId = item.id;
  button.setAttribute("aria-label", isSelected ? `Remove ${item.name}` : `Choose ${item.name}`);

  if (isSelected) {
    button.classList.add("is-selected");
  }

  const optionHint = buildOptionHint(layer, item);
  button.innerHTML = `
    <span class="selection-option__mark" aria-hidden="true">
      <i class="fa-solid ${isSelected ? "fa-check" : "fa-question"}"></i>
    </span>
    <span class="selection-option__content">
      <span class="selection-option__title">${item.name}</span>
      ${optionHint ? `<span class="selection-option__hint">${optionHint}</span>` : ""}
    </span>
  `;

  return button;
}

function previewNames(items, count = 2) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  return items
    .slice(0, count)
    .map((entry) => entry?.name)
    .filter(Boolean)
    .join(", ");
}

function stripHtml(value) {
  if (!value) {
    return "";
  }
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength = 240) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function firstSentence(value) {
  const cleaned = stripHtml(value);
  if (!cleaned) {
    return "";
  }
  const match = cleaned.match(/(.+?[.!?])(?:\s|$)/);
  return (match ? match[1] : cleaned).trim();
}

function buildOptionOverview(layer, item) {
  if (!item) {
    return "Tap next to continue through the observation flow.";
  }

  if (layer === "domains") {
    const subDomains = Array.isArray(item.subDomains) ? item.subDomains : [];
    const elements = Array.isArray(item.elements) ? item.elements : [];

    if (subDomains.length > 0) {
      const subPreview = previewNames(subDomains);
      return subPreview
        ? `Includes focus areas such as ${subPreview}.`
        : "Includes multiple focus areas to guide selection.";
    }

    if (elements.length > 0) {
      const elementPreview = previewNames(elements);
      return elementPreview
        ? `Includes elements such as ${elementPreview}.`
        : "Includes a range of observable elements.";
    }
  }

  if (layer === "subdomains") {
    const elements = Array.isArray(item.elements) ? item.elements : [];
    const elementPreview = previewNames(elements);
    return elementPreview
      ? `Covers elements such as ${elementPreview}.`
      : "Covers a range of observable elements.";
  }

  if (layer === "elements") {
    const behaviours = Array.isArray(item.behaviours) ? item.behaviours : [];
    const behaviourPreview = previewNames(behaviours);
    return behaviourPreview
      ? `Includes behaviour levels such as ${behaviourPreview}.`
      : "Includes behaviour levels to help pinpoint current learning.";
  }

  if (layer === "behaviours") {
    return "Choose the behaviour level that best matches this observation.";
  }

  return stripHtml(item.summary || item.description) || "Tap next to continue through the observation flow.";
}

function updateTipFromSelection(layer, item) {
  if (!item) {
    return;
  }

  const eyebrow = document.querySelector(".tip-card__eyebrow");
  const title = document.querySelector(".tip-card__title");
  const body = document.querySelector(".tip-card__body");
  const icon = document.querySelector(".tip-card__icon i");

  if (eyebrow) {
    if (layer === "domains") {
      eyebrow.textContent = "Selected Domain";
    } else if (layer === "subdomains") {
      eyebrow.textContent = "Selected Subdomain";
    } else if (layer === "elements") {
      eyebrow.textContent = "Selected Element";
    } else {
      eyebrow.textContent = "Selected Behaviour";
    }
  }
  if (title) {
    title.textContent = item.name;
  }
  if (body) {
    const details = stripHtml(item.summary || item.description);
    const overview = buildOptionOverview(layer, item);
    if (layer === "behaviours") {
      body.textContent = details || "";
    } else {
      body.textContent = details ? `${details} ${overview}` : overview;
    }
  }
  if (icon) {
    icon.className = "fa-solid fa-circle-info";
  }
}

function updateSelectionHeader() {
  const eyebrow = document.querySelector(".selection-group__eyebrow");
  const title = document.getElementById("domain-options-title");
  const childNameField = document.querySelector(".child-name-field");

  if (!title) {
    return;
  }

  if (observationState.layer === "subdomains") {
    if (eyebrow) {
      eyebrow.textContent = "Step 2";
    }
    title.textContent = "Choose a subdomain";
  } else if (observationState.layer === "elements") {
    if (eyebrow) {
      eyebrow.textContent = "Step 3";
    }
    title.textContent = "Choose element(s)";
  } else if (observationState.layer === "behaviours") {
    if (eyebrow) {
      eyebrow.textContent = "Step 4";
    }
    title.textContent = "Choose a behaviour";
  } else {
    if (eyebrow) {
      eyebrow.textContent = "Step 1";
    }
    title.textContent = "Choose a domain";
  }

  if (childNameField) {
    childNameField.hidden = observationState.layer !== "domains";
  }
}

function renderBreadcrumbs() {
  const wrap = document.getElementById("observation-breadcrumbs");
  if (!wrap) {
    return;
  }

  const domain = getSelectedDomain();
  const subDomain = getSelectedSubDomain();
  const elements = getSelectedElements();
  const chips = [];

  if (domain?.name) {
    chips.push({ stepId: "domains", label: domain.name });
  }
  if (subDomain?.name) {
    chips.push({ stepId: "subdomains", label: subDomain.name });
  }
  if (elements.length > 0) {
    const firstLabel = elements[0]?.name || "";
    const extraCount = Math.max(elements.length - 1, 0);
    chips.push({
      stepId: "elements",
      label: extraCount > 0 ? `${firstLabel} +${extraCount}` : firstLabel
    });
  }

  if (!chips.length) {
    wrap.replaceChildren();
    return;
  }

  const nodes = chips.map((chip) => {
    const node = document.createElement("span");
    node.className = "observation-breadcrumb";
    node.style.setProperty("--chip-bg", stepGradientFor(chip.stepId));
    node.textContent = chip.label;
    return node;
  });

  wrap.replaceChildren(...nodes);
}

function updateObservationContextTitle() {
  const title = document.getElementById("observation-context-title");
  if (!title) {
    return;
  }

  if (observationState.layer === "behaviours") {
    title.textContent = "Choose behaviours";
    return;
  }
  if (observationState.layer === "elements") {
    title.textContent = "Choose elements";
    return;
  }
  if (observationState.layer === "subdomains") {
    title.textContent = "Choose a subdomain";
    return;
  }
  title.textContent = "New observation";
}

function persistObservationDraft() {
  localStorage.setItem(DRAFT_DOMAIN_KEY, observationState.selectedDomainId || "");
  localStorage.setItem(DRAFT_SUBDOMAIN_KEY, observationState.selectedSubDomainId || "");
  localStorage.setItem(DRAFT_ELEMENT_KEY, JSON.stringify(getSelectedElementIds()));
  localStorage.setItem(DRAFT_BEHAVIOUR_KEY, JSON.stringify({
    byElement: observationState.selectedBehaviourByElement || {},
    ids: observationState.selectedBehaviourIds || []
  }));
}

function clearObservationDraft() {
  localStorage.removeItem(DRAFT_DOMAIN_KEY);
  localStorage.removeItem(DRAFT_SUBDOMAIN_KEY);
  localStorage.removeItem(DRAFT_ELEMENT_KEY);
  localStorage.removeItem(DRAFT_BEHAVIOUR_KEY);
  localStorage.removeItem(DRAFT_CHILD_NAME_KEY);
  localStorage.removeItem(ACTIVE_JOURNEY_KEY);
}

function readDraftBehaviourState() {
  const empty = { ids: [], byElement: {} };
  try {
    const raw = localStorage.getItem(DRAFT_BEHAVIOUR_KEY);
    if (!raw) {
      return empty;
    }
    if (raw.trim().startsWith("[") === false) {
      if (raw.trim().startsWith("{")) {
        const parsedObject = JSON.parse(raw);
        const byElementRaw = parsedObject?.byElement && typeof parsedObject.byElement === "object"
          ? parsedObject.byElement
          : parsedObject;
        const byElement = Object.fromEntries(
          Object.entries(byElementRaw || {}).filter(([key, value]) =>
            typeof key === "string" && key && typeof value === "string" && value
          )
        );
        const ids = Array.isArray(parsedObject?.ids)
          ? parsedObject.ids.filter((id) => typeof id === "string" && id)
          : Object.values(byElement);
        return { ids: [...new Set(ids)], byElement };
      }
      const ids = [raw.trim()].filter(Boolean);
      return { ids, byElement: {} };
    }
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [];
    return { ids, byElement: {} };
  } catch (error) {
    return empty;
  }
}

function readDraftElementIds() {
  try {
    const raw = localStorage.getItem(DRAFT_ELEMENT_KEY);
    if (!raw) {
      return [];
    }
    if (raw.trim().startsWith("[") === false) {
      return [raw.trim()].filter(Boolean);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [];
  } catch (error) {
    return [];
  }
}

function toFriendlyDateTimeValue(date) {
  const value = date instanceof Date ? date : new Date();
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function toFriendlyObservationTime(value) {
  if (!value) {
    return toFriendlyDateTimeValue(new Date());
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return toFriendlyDateTimeValue(parsed);
  }
  return String(value);
}

function readReportNotesStore() {
  try {
    const raw = localStorage.getItem(REPORT_NOTES_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeReportNotesStore(store) {
  localStorage.setItem(REPORT_NOTES_KEY, JSON.stringify(store));
}

function reportNotesStorageKey(journeyId) {
  return journeyId || "__draft__";
}

function normaliseReportNotes(value) {
  const safe = value && typeof value === "object" ? value : {};
  return {
    observerName: typeof safe.observerName === "string" ? safe.observerName : "",
    observationTime: typeof safe.observationTime === "string" ? safe.observationTime : "",
    extraEvidence: typeof safe.extraEvidence === "string" ? safe.extraEvidence : "",
    supportLearning: typeof safe.supportLearning === "string" ? safe.supportLearning : ""
  };
}

function getStoredReportNotes(journeyId) {
  const store = readReportNotesStore();
  const key = reportNotesStorageKey(journeyId);
  return normaliseReportNotes(store[key]);
}

function saveStoredReportNotes(journeyId, notes) {
  const store = readReportNotesStore();
  const key = reportNotesStorageKey(journeyId);
  store[key] = normaliseReportNotes(notes);
  writeReportNotesStore(store);
}

function buildStateFromDraft() {
  const behaviourState = readDraftBehaviourState();
  const elementIds = readDraftElementIds();
  const behaviourId = behaviourState.ids[0] || "";
  return {
    currentStep: normaliseStepId(localStorage.getItem(STEP_STORAGE_KEY) || "behaviours"),
    layer: "behaviours",
    childName: (localStorage.getItem(DRAFT_CHILD_NAME_KEY) || "").trim(),
    lastSelection: null,
    selection: {
      domainId: localStorage.getItem(DRAFT_DOMAIN_KEY) || "",
      subDomainId: localStorage.getItem(DRAFT_SUBDOMAIN_KEY) || "",
      elementId: elementIds[0] || "",
      elementIds,
      behaviourId,
      behaviourByElement: behaviourState.byElement || {},
      behaviourIds: behaviourState.ids || []
    }
  };
}

function getActiveJourneyId() {
  return localStorage.getItem(ACTIVE_JOURNEY_KEY) || "";
}

function setActiveJourneyId(id) {
  localStorage.setItem(ACTIVE_JOURNEY_KEY, id);
}

function normaliseStepId(stepId) {
  return STEP_ORDER.includes(stepId) ? stepId : DEFAULT_STEP_ID;
}

function getJourneyState(journey) {
  const safeJourney = journey && typeof journey === "object" ? journey : {};
  const state = safeJourney.state && typeof safeJourney.state === "object"
    ? safeJourney.state
    : {};
  const legacyPath = safeJourney.path && typeof safeJourney.path === "object"
    ? safeJourney.path
    : {};
  const selection = state.selection && typeof state.selection === "object"
    ? state.selection
    : {};
  const rawBehaviourIds = Array.isArray(selection.behaviourIds)
    ? selection.behaviourIds
    : Array.isArray(legacyPath.behaviourIds)
      ? legacyPath.behaviourIds
      : [];
  const rawBehaviourByElement = selection.behaviourByElement && typeof selection.behaviourByElement === "object"
    ? selection.behaviourByElement
    : (legacyPath.behaviourByElement && typeof legacyPath.behaviourByElement === "object"
      ? legacyPath.behaviourByElement
      : {});
  const behaviourByElement = Object.fromEntries(
    Object.entries(rawBehaviourByElement).filter(([elementId, behaviourId]) =>
      typeof elementId === "string" && elementId && typeof behaviourId === "string" && behaviourId
    )
  );
  const behaviourIdsFromMap = Object.values(behaviourByElement);
  const rawElementIds = Array.isArray(selection.elementIds)
    ? selection.elementIds
    : Array.isArray(legacyPath.elementIds)
      ? legacyPath.elementIds
      : (selection.elementId || legacyPath.elementId ? [selection.elementId || legacyPath.elementId] : []);

  const currentStep = normaliseStepId(state.currentStep || safeJourney.currentStep || DEFAULT_STEP_ID);
  const layerFromStep = FLOW_STEPS.includes(currentStep) ? currentStep : "behaviours";

  return {
    currentStep,
    layer: FLOW_STEPS.includes(state.layer) ? state.layer : layerFromStep,
    childName: typeof state.childName === "string"
      ? state.childName
      : (typeof safeJourney.childName === "string" ? safeJourney.childName : ""),
    lastSelection: state.lastSelection || safeJourney.lastSelection || null,
    selection: {
      domainId: selection.domainId || legacyPath.domainId || "",
      subDomainId: selection.subDomainId || legacyPath.subDomainId || "",
      elementId: selection.elementId || legacyPath.elementId || "",
      elementIds: rawElementIds.filter((id) => typeof id === "string" && id),
      behaviourId: selection.behaviourId || legacyPath.behaviourId || "",
      behaviourByElement,
      behaviourIds: rawBehaviourIds
        .filter((id) => typeof id === "string" && id)
        .concat(behaviourIdsFromMap)
        .filter((id, index, list) => list.indexOf(id) === index)
    }
  };
}

function restoreDraftFromJourney(journey) {
  const state = getJourneyState(journey);
  localStorage.setItem(DRAFT_DOMAIN_KEY, state.selection.domainId || "");
  localStorage.setItem(DRAFT_SUBDOMAIN_KEY, state.selection.subDomainId || "");
  localStorage.setItem(DRAFT_ELEMENT_KEY, JSON.stringify(state.selection.elementIds || []));
  localStorage.setItem(DRAFT_BEHAVIOUR_KEY, JSON.stringify({
    byElement: state.selection.behaviourByElement || {},
    ids: state.selection.behaviourIds || []
  }));
  localStorage.setItem(DRAFT_CHILD_NAME_KEY, state.childName || "");
  return state;
}

function resolveResumeStepId(state) {
  if (!state || !state.selection) {
    return DEFAULT_STEP_ID;
  }

  const hasDomain = Boolean(state.selection.domainId);
  const hasSubDomain = Boolean(state.selection.subDomainId);
  const hasElement = Boolean(
    state.selection.elementId ||
    (Array.isArray(state.selection.elementIds) && state.selection.elementIds.length > 0)
  );
  const hasBehaviour = Boolean(
    state.selection.behaviourId ||
    (Array.isArray(state.selection.behaviourIds) && state.selection.behaviourIds.length > 0)
  );

  if (hasBehaviour && hasElement) {
    return "behaviours";
  }
  if (hasElement) {
    return "elements";
  }
  if (hasSubDomain) {
    return "subdomains";
  }
  if (hasDomain) {
    return "domains";
  }

  return normaliseStepId(state.currentStep || DEFAULT_STEP_ID);
}

function isReportAvailable(state) {
  if (!state || !state.selection) {
    return false;
  }
  const elementIds = Array.isArray(state.selection.elementIds)
    ? state.selection.elementIds.filter((id) => typeof id === "string" && id)
    : [];
  if (!elementIds.length) {
    return false;
  }

  const behaviourByElement = state.selection.behaviourByElement && typeof state.selection.behaviourByElement === "object"
    ? state.selection.behaviourByElement
    : {};
  const hasMappedBehaviourPerElement = elementIds.every((elementId) => {
    const behaviourId = behaviourByElement[elementId];
    return typeof behaviourId === "string" && behaviourId;
  });
  if (hasMappedBehaviourPerElement) {
    return true;
  }

  const behaviourIds = Array.isArray(state.selection.behaviourIds)
    ? state.selection.behaviourIds.filter((id) => typeof id === "string" && id)
    : [];
  return behaviourIds.length >= elementIds.length;
}

function openJourneySession(journeyId) {
  if (!journeyId) {
    window.location.href = "observation.html";
    return;
  }

  const journeys = readJourneys();
  const journey = journeys.find((item) => item.id === journeyId);
  if (!journey) {
    window.location.href = "observation.html";
    return;
  }

  const state = restoreDraftFromJourney(journey);
  const stepId = resolveResumeStepId(state);
  setActiveJourneyId(journeyId);
  if (isReportAvailable(state)) {
    localStorage.setItem(STEP_STORAGE_KEY, "review");
    window.location.href = "report.html";
    return;
  }
  localStorage.setItem(STEP_STORAGE_KEY, stepId);
  window.location.href = `observation.html?step=${encodeURIComponent(stepId)}`;
}

function buildJourneyPatch() {
  const domain = getSelectedDomain();
  const subDomain = getSelectedSubDomain();
  const selectedElements = getSelectedElements();
  const selectedElement = selectedElements[0] || null;
  const selectedElementBehaviours = selectedElements
    .flatMap((element) => (Array.isArray(element.behaviours) ? element.behaviours : []))
    .filter((behaviour, index, list) => behaviour?.id && list.findIndex((item) => item.id === behaviour.id) === index);
  const selectedBehaviour =
    selectedElementBehaviours.find(
      (item) => item.id === observationState.focusedBehaviourId
    ) || null;
  const selectedEntityId = getSelectedEntityId();
  const selectedForLayer = optionsForCurrentLayer().find((item) => item.id === selectedEntityId) || null;
  const childName = (localStorage.getItem(DRAFT_CHILD_NAME_KEY) || "").trim();

  const behaviourPool = selectedElementBehaviours;
  const selectedBehaviours = behaviourPool.filter((item) =>
    observationState.selectedBehaviourIds.includes(item.id)
  );

  const selection = {
    domainId: observationState.selectedDomainId || "",
    subDomainId: observationState.selectedSubDomainId || "",
    elementId: observationState.selectedElementId || getSelectedElementIds()[0] || "",
    elementIds: getSelectedElementIds(),
    behaviourId: observationState.focusedBehaviourId || "",
    behaviourIds: observationState.selectedBehaviourIds.slice(),
    behaviourByElement: { ...(observationState.selectedBehaviourByElement || {}) }
  };

  const currentStep = normaliseStepId(
    localStorage.getItem(STEP_STORAGE_KEY) || currentStepFromLayer(observationState.layer)
  );

  return {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    childName,
    currentStep,
    status: "draft",
    state: {
      currentStep,
      layer: observationState.layer,
      childName,
      lastSelection: selectedForLayer
        ? {
            layer: observationState.layer,
            id: selectedEntityId || "",
            label: selectedForLayer.name || ""
          }
        : null,
      selection
    },
    lastSelection: selectedForLayer
      ? {
          layer: observationState.layer,
          id: selectedEntityId || "",
          label: selectedForLayer.name || ""
        }
      : null,
    path: {
      domainId: selection.domainId,
      domainName: domain?.name || "",
      subDomainId: selection.subDomainId,
      subDomainName: subDomain?.name || "",
      elementId: selection.elementId,
      elementIds: selection.elementIds,
      elementName: selectedElement?.name || "",
      elementNames: selectedElements.map((item) => item.name),
      behaviourId: selection.behaviourId,
      behaviourName: selectedBehaviour?.name || "",
      behaviourByElement: selection.behaviourByElement,
      behaviourIds: selection.behaviourIds,
      behaviourNames: selectedBehaviours.map((item) => item.name)
    }
  };
}

function upsertActiveJourney() {
  const now = new Date().toISOString();
  const friendlyUpdatedAt = formatSessionTime(now);
  const journeys = readJourneys();
  let journeyId = getActiveJourneyId();
  const patch = buildJourneyPatch();

  if (!journeyId) {
    const id = newJourneyId();
    const avatarIndex = hashToAvatarIndex(id);
    const newJourney = {
      id,
      createdAt: now,
      updatedAt: now,
      friendlyUpdatedAt,
      avatarIndex,
      ...patch
    };
    journeys.unshift(newJourney);
    writeJourneys(journeys);
    setActiveJourneyId(id);
    return newJourney;
  }

  const index = journeys.findIndex((journey) => journey.id === journeyId);
  if (index === -1) {
    localStorage.removeItem(ACTIVE_JOURNEY_KEY);
    return upsertActiveJourney();
  }

  journeys[index] = {
    ...journeys[index],
    ...patch,
    lastSelection: patch.lastSelection || journeys[index].lastSelection || null,
    path: {
      ...(journeys[index].path || {}),
      ...(patch.path || {})
    },
    updatedAt: now,
    friendlyUpdatedAt
  };
  writeJourneys(journeys);
  return journeys[index];
}

function deleteJourneyById(journeyId) {
  if (!journeyId) {
    return;
  }

  const journeys = readJourneys();
  const nextJourneys = journeys.filter((journey) => journey.id !== journeyId);
  writeJourneys(nextJourneys);

  if (getActiveJourneyId() === journeyId) {
    localStorage.removeItem(ACTIVE_JOURNEY_KEY);
  }

  renderSessions();
}

function closeDeleteSessionDialog() {
  if (deleteModalEscapeHandler) {
    document.removeEventListener("keydown", deleteModalEscapeHandler);
    deleteModalEscapeHandler = null;
  }

  const dialog = document.querySelector(".delete-session-modal");
  if (dialog) {
    dialog.remove();
  }
}

function openDeleteSessionDialog(session) {
  if (!session?.id) {
    return;
  }

  closeDeleteSessionDialog();

  const avatarIndex = session.avatarIndex % 8;
  const col = avatarIndex % 4;
  const row = Math.floor(avatarIndex / 4);
  const createdText = formatCreatedTimestamp(session.createdAt);

  const modal = document.createElement("div");
  modal.className = "delete-session-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "delete-session-title");
  modal.innerHTML = `
    <div class="delete-session-modal__backdrop"></div>
    <section class="delete-session-modal__panel">
      <header class="delete-session-modal__header">
        <span class="delete-session-modal__avatar session-card__avatar" style="--avatar-col:${col}; --avatar-row:${row};" aria-hidden="true"></span>
        <div class="delete-session-modal__copy">
          <h3 id="delete-session-title">Delete this observation?</h3>
          <p>${createdText}</p>
        </div>
      </header>
      <div class="delete-session-modal__actions">
        <button class="delete-session-modal__keep" type="button">Keep</button>
        <button class="delete-session-modal__delete" type="button">Delete</button>
      </div>
    </section>
  `;

  document.body.append(modal);

  const keepButton = modal.querySelector(".delete-session-modal__keep");
  const deleteButton = modal.querySelector(".delete-session-modal__delete");
  const backdrop = modal.querySelector(".delete-session-modal__backdrop");
  const panel = modal.querySelector(".delete-session-modal__panel");

  keepButton?.addEventListener("click", closeDeleteSessionDialog);
  deleteButton?.addEventListener("click", () => {
    deleteJourneyById(session.id);
    closeDeleteSessionDialog();
  });
  backdrop?.addEventListener("click", closeDeleteSessionDialog);
  modal.addEventListener("click", (event) => {
    if (!panel?.contains(event.target)) {
      closeDeleteSessionDialog();
    }
  });

  keepButton?.focus();

  deleteModalEscapeHandler = (event) => {
    if (event.key !== "Escape") {
      return;
    }
    closeDeleteSessionDialog();
  };
  document.addEventListener("keydown", deleteModalEscapeHandler);
}

function optionsForCurrentLayer() {
  if (observationState.layer === "behaviours") {
    const behaviours = getSelectedElements()
      .flatMap((element) => (Array.isArray(element.behaviours) ? element.behaviours : []));
    if (!behaviours.length) {
      return [];
    }
    const seen = new Set();
    return behaviours.filter((item) => {
      if (!item?.id || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }

  if (observationState.layer === "subdomains") {
    const domain = getSelectedDomain();
    return domain && Array.isArray(domain.subDomains) ? domain.subDomains : [];
  }

  if (observationState.layer === "elements") {
    const subDomain = getSelectedSubDomain();
    if (subDomain && Array.isArray(subDomain.elements)) {
      return subDomain.elements;
    }
    const domain = getSelectedDomain();
    return domain && Array.isArray(domain.elements) ? domain.elements : [];
  }

  return domainsCache;
}

function selectedIdForCurrentLayer() {
  if (observationState.layer === "elements") {
    return getSelectedElementIds();
  }
  return getSelectedEntityId();
}

function applySelection(layer, item) {
  let tipItem = item;

  if (layer === "domains") {
    observationState.selectedDomainId = item.id;
    observationState.selectedSubDomainId = "";
    observationState.selectedElementId = "";
    observationState.selectedElementIds = [];
    observationState.focusedBehaviourId = "";
    observationState.selectedBehaviourIds = [];
    observationState.selectedBehaviourByElement = {};
    behaviourCarouselIndexByElement = {};
  } else if (layer === "subdomains") {
    observationState.selectedSubDomainId = item.id;
    observationState.selectedElementId = "";
    observationState.selectedElementIds = [];
    observationState.focusedBehaviourId = "";
    observationState.selectedBehaviourIds = [];
    observationState.selectedBehaviourByElement = {};
    behaviourCarouselIndexByElement = {};
  } else if (layer === "elements") {
    const selectedIds = getSelectedElementIds();
    if (selectedIds.includes(item.id)) {
      observationState.selectedElementIds = selectedIds.filter((id) => id !== item.id);
      observationState.selectedElementId = observationState.selectedElementIds[0] || "";
      tipItem = getSelectedElement();
    } else {
      observationState.selectedElementIds = [...selectedIds, item.id];
      observationState.selectedElementId = item.id;
    }
    observationState.focusedBehaviourId = "";
    observationState.selectedBehaviourIds = [];
    observationState.selectedBehaviourByElement = {};
    behaviourCarouselIndexByElement = {};
  } else {
    observationState.focusedBehaviourId = item.id;
  }

  persistObservationDraft();
  if (tipItem) {
    updateTipFromSelection(layer, tipItem);
  } else {
    renderHelpTip();
  }
  updateNextButtonVisibility();
  upsertActiveJourney();
  renderStepper();
}

function setBehaviourCarouselIndexForElement(elementId, nextIndex) {
  const behaviours = getBehavioursForElement(elementId);
  if (!Array.isArray(behaviours) || behaviours.length === 0) {
    behaviourCarouselIndexByElement[elementId] = 0;
    return;
  }
  const length = behaviours.length;
  behaviourCarouselIndexByElement[elementId] = ((nextIndex % length) + length) % length;
}

function createBehaviourCard(behaviour, elementId, options = {}) {
  if (!behaviour) {
    const fallback = document.createElement("article");
    fallback.className = "behaviour-card";
    fallback.innerHTML = `
      <h4>No behaviour available</h4>
      <p class="behaviour-card__description">Select an element first, then choose a behaviour level.</p>
    `;
    return fallback;
  }

  const card = document.createElement("article");
  const isSelected = getSelectedBehaviourByElement(elementId) === behaviour.id;
  const behaviourSentence = firstSentence(behaviour.description);
  card.className = `behaviour-card${isSelected ? " is-selected" : ""}`;

  card.innerHTML = `
    <h4 class="behaviour-card__title">${behaviour.name}</h4>
    <p class="behaviour-card__description">${truncateText(behaviourSentence, 120)}</p>
  `;

  card.addEventListener("click", () => {
    observationState.focusedBehaviourId = behaviour.id;
    observationState.selectedBehaviourByElement = {
      ...(observationState.selectedBehaviourByElement || {}),
      [elementId]: behaviour.id
    };
    syncSelectedBehaviourIdsFromTracks();
    persistObservationDraft();
    upsertActiveJourney();
    updateTipFromSelection("behaviours", behaviour);
    renderStepper();
    if (options.onFocus) {
      options.onFocus();
      return;
    }
    renderCurrentLayerOptions();
  });

  return card;
}

function renderBehaviourTrack(element) {
  const behaviours = Array.isArray(element?.behaviours) ? element.behaviours : [];
  const wrapper = document.createElement("section");
  wrapper.className = "behaviour-track";
  const heading = document.createElement("h4");
  heading.className = "behaviour-track__label";
  heading.textContent = element?.name || "Element";
  wrapper.append(heading);

  if (behaviours.length === 0) {
    const empty = document.createElement("p");
    empty.className = "behaviour-track__empty";
    empty.textContent = "No behaviours available for this element yet.";
    wrapper.append(empty);
    return wrapper;
  }

  const selectedBehaviourId = getSelectedBehaviourByElement(element.id);
  const selectedIndex = behaviours.findIndex((item) => item.id === selectedBehaviourId);
  if (!Number.isInteger(behaviourCarouselIndexByElement[element.id]) ||
    behaviourCarouselIndexByElement[element.id] >= behaviours.length) {
    behaviourCarouselIndexByElement[element.id] = selectedIndex >= 0 ? selectedIndex : 0;
  }
  setBehaviourCarouselIndexForElement(element.id, behaviourCarouselIndexByElement[element.id]);
  const activeIndex = behaviourCarouselIndexByElement[element.id];
  const active = behaviours[activeIndex] || behaviours[0];
  const total = behaviours.length;
  const farPrevIndex = (activeIndex - 2 + total) % total;
  const prevIndex = (activeIndex - 1 + total) % total;
  const nextIndex = (activeIndex + 1) % total;
  const farNextIndex = (activeIndex + 2) % total;
  const root = document.createElement("div");
  root.className = "behaviour-carousel";
  root.innerHTML = `
    <button class="behaviour-carousel__nav" type="button" aria-label="Previous behaviour for ${element.name}">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
    </button>
    <div class="behaviour-carousel__viewport">
      <div class="behaviour-carousel__track">
        <div class="behaviour-carousel__item behaviour-carousel__item--far-prev"></div>
        <div class="behaviour-carousel__item behaviour-carousel__item--prev"></div>
        <div class="behaviour-carousel__item behaviour-carousel__item--active"></div>
        <div class="behaviour-carousel__item behaviour-carousel__item--next"></div>
        <div class="behaviour-carousel__item behaviour-carousel__item--far-next"></div>
      </div>
    </div>
    <button class="behaviour-carousel__nav" type="button" aria-label="Next behaviour for ${element.name}">
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>
  `;

  const viewport = root.querySelector(".behaviour-carousel__viewport");
  const track = root.querySelector(".behaviour-carousel__track");
  const farPrevSlot = root.querySelector(".behaviour-carousel__item--far-prev");
  const prevSlot = root.querySelector(".behaviour-carousel__item--prev");
  const activeSlot = root.querySelector(".behaviour-carousel__item--active");
  const nextSlot = root.querySelector(".behaviour-carousel__item--next");
  const farNextSlot = root.querySelector(".behaviour-carousel__item--far-next");

  farPrevSlot?.append(createBehaviourCard(behaviours[farPrevIndex], element.id));
  prevSlot?.append(createBehaviourCard(behaviours[prevIndex], element.id, {
    onFocus: () => slideTo(-1)
  }));
  activeSlot?.append(createBehaviourCard(active, element.id));
  nextSlot?.append(createBehaviourCard(behaviours[nextIndex], element.id, {
    onFocus: () => slideTo(1)
  }));
  farNextSlot?.append(createBehaviourCard(behaviours[farNextIndex], element.id));

  let isSliding = false;
  const slideTo = (direction) => {
    if (!track || isSliding) {
      return;
    }
    isSliding = true;
    track.classList.add(direction > 0 ? "is-slide-next" : "is-slide-prev");
    let settled = false;

    const complete = () => {
      if (settled) {
        return;
      }
      settled = true;
      isSliding = false;
      setBehaviourCarouselIndexForElement(element.id, behaviourCarouselIndexByElement[element.id] + direction);
      renderCurrentLayerOptions();
    };

    const onTransitionEnd = () => {
      track.removeEventListener("transitionend", onTransitionEnd);
      complete();
    };

    track.addEventListener("transitionend", onTransitionEnd, { once: true });
    window.setTimeout(() => {
      if (isSliding) {
        complete();
      }
    }, 320);
  };

  const navButtons = root.querySelectorAll(".behaviour-carousel__nav");
  navButtons[0]?.addEventListener("click", (event) => {
    event.preventDefault();
    slideTo(-1);
  });
  navButtons[1]?.addEventListener("click", (event) => {
    event.preventDefault();
    slideTo(1);
  });

  let swipeStartX = 0;
  const onSwipeEnd = (endX) => {
    const delta = endX - swipeStartX;
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta < 0) {
      slideTo(1);
    } else {
      slideTo(-1);
    }
  };

  viewport?.addEventListener("pointerdown", (event) => {
    swipeStartX = Number.isFinite(event.clientX) ? event.clientX : 0;
  });
  viewport?.addEventListener("pointerup", (event) => {
    if (!Number.isFinite(event.clientX)) {
      return;
    }
    onSwipeEnd(event.clientX);
  });
  viewport?.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches?.[0];
    swipeStartX = touch ? touch.clientX : 0;
  }, { passive: true });
  viewport?.addEventListener("touchend", (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    onSwipeEnd(touch.clientX);
  });

  wrapper.append(root);
  return wrapper;
}

function renderBehaviourTracks() {
  const list = document.getElementById("domain-options");
  if (!list) {
    return;
  }

  const elements = getSelectedElements();
  if (!elements.length) {
    list.replaceChildren();
    return;
  }
  const tracks = elements.map((element) => renderBehaviourTrack(element));
  list.replaceChildren(...tracks);
  const focused =
    optionsForCurrentLayer().find((item) => item.id === observationState.focusedBehaviourId) ||
    optionsForCurrentLayer().find((item) => observationState.selectedBehaviourIds.includes(item.id)) ||
    null;
  if (focused) {
    updateTipFromSelection("behaviours", focused);
  }
}

function renderCurrentLayerOptions() {
  const list = document.getElementById("domain-options");
  if (!list) {
    return;
  }
  list.dataset.layer = observationState.layer;

  updateSelectionHeader();
  updateObservationContextTitle();
  updateHelperFigure(currentStepFromLayer(observationState.layer));
  if (observationState.layer === "behaviours") {
    renderBehaviourTracks();
    updateNextButtonVisibility();
    return;
  }

  const options = optionsForCurrentLayer();
  const selectedId = selectedIdForCurrentLayer();
  const buttons = options.map((item) => {
    const button = createSelectionOption(observationState.layer, item, selectedId);
    button.addEventListener("click", () => {
      applySelection(observationState.layer, item);
      renderCurrentLayerOptions();
    });
    return button;
  });

  list.replaceChildren(...buttons);
  updateNextButtonVisibility();
}

function goToNextLayer() {
  if (observationState.layer === "domains") {
    const domain = getSelectedDomain();
    if (!domain) {
      return;
    }

    const hasSubDomains = Array.isArray(domain.subDomains) && domain.subDomains.length > 0;
    observationState.layer = hasSubDomains ? "subdomains" : "elements";
    setActiveStep(currentStepFromLayer(observationState.layer));
    upsertActiveJourney();
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "subdomains") {
    if (!observationState.selectedSubDomainId) {
      return;
    }

    observationState.layer = "elements";
    setActiveStep(currentStepFromLayer(observationState.layer));
    upsertActiveJourney();
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "elements") {
    if (!getSelectedElementIds().length) {
      return;
    }

    observationState.layer = "behaviours";
    setActiveStep("behaviours");
    upsertActiveJourney();
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "behaviours") {
    if (!hasBehaviourSelectionForAllTracks()) {
      return;
    }

    setActiveStep("review");
    upsertActiveJourney();
    window.location.href = "report.html";
  }
}

function goToPreviousLayer() {
  if (observationState.layer === "behaviours") {
    observationState.layer = "elements";
    setActiveStep(currentStepFromLayer(observationState.layer));
    upsertActiveJourney();
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "elements") {
    const domain = getSelectedDomain();
    const hasSubDomains = Array.isArray(domain?.subDomains) && domain.subDomains.length > 0;
    observationState.layer = hasSubDomains ? "subdomains" : "domains";
    setActiveStep(currentStepFromLayer(observationState.layer));
    upsertActiveJourney();
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "subdomains") {
    observationState.layer = "domains";
    setActiveStep(currentStepFromLayer(observationState.layer));
    upsertActiveJourney();
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  window.location.href = "index.html";
}

async function initObservationFlow() {
  try {
    const response = await fetch(DOMAINS_DATA_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    domainsCache = data.domains || [];

    const activeJourney = readJourneys().find((journey) => journey.id === getActiveJourneyId());
    const journeyState = getJourneyState(activeJourney);
    const draftDomain = localStorage.getItem(DRAFT_DOMAIN_KEY) || journeyState.selection.domainId || "";
    const draftSubDomain = localStorage.getItem(DRAFT_SUBDOMAIN_KEY) || journeyState.selection.subDomainId || "";
    const draftElements = readDraftElementIds();
    const fallbackJourneyElements = Array.isArray(journeyState.selection.elementIds)
      ? journeyState.selection.elementIds.filter((id) => typeof id === "string" && id)
      : (journeyState.selection.elementId ? [journeyState.selection.elementId] : []);
    const draftBehaviourState = readDraftBehaviourState();

    observationState.selectedDomainId = draftDomain;
    observationState.selectedSubDomainId = draftSubDomain;
    observationState.selectedElementIds = draftElements.length ? draftElements : fallbackJourneyElements;
    observationState.selectedElementId = observationState.selectedElementIds[0] || "";
    const journeyBehaviourByElement =
      journeyState.selection.behaviourByElement && typeof journeyState.selection.behaviourByElement === "object"
        ? journeyState.selection.behaviourByElement
        : {};
    const behaviourByElement = Object.keys(draftBehaviourState.byElement).length
      ? draftBehaviourState.byElement
      : journeyBehaviourByElement;
    observationState.selectedBehaviourByElement = { ...behaviourByElement };
    observationState.selectedBehaviourIds = draftBehaviourState.ids.length
      ? draftBehaviourState.ids
      : Array.isArray(journeyState.selection.behaviourIds)
        ? journeyState.selection.behaviourIds.filter((id) => typeof id === "string" && id)
        : [];
    if (!Object.keys(observationState.selectedBehaviourByElement).length &&
      observationState.selectedBehaviourIds.length &&
      observationState.selectedElementIds.length) {
      observationState.selectedBehaviourByElement[observationState.selectedElementIds[0]] =
        observationState.selectedBehaviourIds[0];
    }
    syncSelectedBehaviourIdsFromTracks();
    observationState.focusedBehaviourId = observationState.selectedBehaviourIds[0] || journeyState.selection.behaviourId || "";

    if (journeyState.childName && !localStorage.getItem(DRAFT_CHILD_NAME_KEY)) {
      localStorage.setItem(DRAFT_CHILD_NAME_KEY, journeyState.childName);
    }

    const activeStep = getActiveStepId();
    observationState.layer = FLOW_STEPS.includes(activeStep) ? activeStep : "behaviours";
    if (observationState.layer === "behaviours" && !getSelectedElementIds().length) {
      observationState.layer = "elements";
      setActiveStep("elements");
    }
    if (observationState.layer === "behaviours") {
      behaviourCarouselIndexByElement = {};
      for (const element of getSelectedElements()) {
        const behaviours = Array.isArray(element.behaviours) ? element.behaviours : [];
        const selectedBehaviourId = getSelectedBehaviourByElement(element.id);
        const selectedIndex = behaviours.findIndex((item) => item.id === selectedBehaviourId);
        behaviourCarouselIndexByElement[element.id] = selectedIndex >= 0 ? selectedIndex : 0;
      }
      if (!observationState.focusedBehaviourId) {
        observationState.focusedBehaviourId = observationState.selectedBehaviourIds[0] || "";
      }
    }

    renderCurrentLayerOptions();

    const options = optionsForCurrentLayer();
    const selected = options.find((item) => item.id === selectedIdForCurrentLayer());
    if (selected) {
      updateTipFromSelection(observationState.layer, selected);
    }
    renderStepper();
  } catch (error) {
    console.warn("Unable to load domains data:", error);
    const list = document.getElementById("domain-options");
    if (list) {
      list.replaceChildren();
    }
  }
}

function renderSessions() {
  const list = document.getElementById("sessions-list");
  if (!list) {
    return;
  }
  const sessionsSection = list.closest(".sessions");

  const sessions = readSessions().slice(0, MAX_SESSIONS);
  if (sessions.length === 0) {
    document.body.classList.add("is-home-empty");
    if (sessionsSection) {
      sessionsSection.hidden = true;
    }
    list.replaceChildren();
    return;
  }

  document.body.classList.remove("is-home-empty");
  if (sessionsSection) {
    sessionsSection.hidden = false;
  }
  list.replaceChildren(...sessions.map(createSessionCard));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) {
            return;
          }

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((error) => {
        console.warn("Unable to register service worker:", error);
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

function bindPageActions() {
  const startButton = document.querySelector(".hero__orb");
  if (startButton) {
    startButton.addEventListener("click", () => {
      clearObservationDraft();
      setActiveStep(DEFAULT_STEP_ID);
    });
  }
}

function bindObservationDraft() {
  const input = document.getElementById("child-name-input");
  if (!input) {
    return;
  }

  input.value = localStorage.getItem(DRAFT_CHILD_NAME_KEY) || "";
  input.addEventListener("input", () => {
    localStorage.setItem(DRAFT_CHILD_NAME_KEY, input.value.trim());
    if (getActiveJourneyId()) {
      upsertActiveJourney();
    }
  });
}

function bindObservationActions() {
  const nextButton = document.getElementById("next-step-button");
  if (nextButton) {
    nextButton.addEventListener("click", () => {
      goToNextLayer();
    });
  }

  const backButton = document.getElementById("observation-back-button");
  if (backButton) {
    backButton.addEventListener("click", () => {
      goToPreviousLayer();
    });
  }

  const homeButton = document.getElementById("observation-home-button");
  if (homeButton) {
    homeButton.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }
}

function findSelectedContext(domains, state) {
  const selection = state?.selection || {};
  const domain = domains.find((item) => item.id === selection.domainId) || null;
  const hasSubDomains = Array.isArray(domain?.subDomains) && domain.subDomains.length > 0;
  const subDomain = hasSubDomains
    ? (domain.subDomains.find((item) => item.id === selection.subDomainId) || null)
    : null;
  const elementPool = hasSubDomains
    ? (Array.isArray(subDomain?.elements) ? subDomain.elements : [])
    : (Array.isArray(domain?.elements) ? domain.elements : []);
  const elementIds = Array.isArray(selection.elementIds)
    ? selection.elementIds
    : (selection.elementId ? [selection.elementId] : []);
  const selectedElements = elementIds
    .map((id) => elementPool.find((element) => element.id === id))
    .filter((element) => Boolean(element));
  return {
    domain,
    subDomain,
    selectedElements
  };
}

function likelyProgressionText(behaviours, selectedIndex) {
  if (selectedIndex < 0 || selectedIndex >= behaviours.length) {
    return "A likely progression path could not be determined for this selection.";
  }
  const current = behaviours[selectedIndex];
  const next = behaviours[selectedIndex + 1];
  if (!next) {
    return `This sits at the most advanced progression currently listed, showing strong development in ${current.name.toLowerCase()}.`;
  }
  const nextSentence = firstSentence(next.description);
  if (!nextSentence) {
    return `A likely next progression is moving from ${current.name} toward ${next.name}.`;
  }
  return `A likely next progression is ${next.name}. Children at this stage often ${nextSentence.charAt(0).toLowerCase()}${nextSentence.slice(1)}`;
}

function createReportCard(title, lines, className = "") {
  const card = document.createElement("article");
  card.className = `report-card${className ? ` ${className}` : ""}`;
  const heading = document.createElement("h3");
  heading.textContent = title;
  card.append(heading);
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    card.append(paragraph);
  }
  return card;
}

function joinReadableList(values) {
  const items = (Array.isArray(values) ? values : [])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (!items.length) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function collectReportTracks(context, state) {
  const behaviourByElement = state.selection.behaviourByElement || {};
  const fallbackBehaviourId = state.selection.behaviourId || "";
  return context.selectedElements.map((element) => {
    const behaviours = Array.isArray(element.behaviours) ? element.behaviours : [];
    const selectedBehaviourId = behaviourByElement[element.id] || fallbackBehaviourId;
    const selectedIndex = behaviours.findIndex((item) => item.id === selectedBehaviourId);
    const selectedBehaviour = selectedIndex >= 0 ? behaviours[selectedIndex] : null;
    return {
      element,
      behaviours,
      selectedBehaviour,
      selectedIndex
    };
  });
}

function initReportNotesForm(journeyId) {
  const observerNameInput = document.getElementById("report-observer-name");
  const observationTimeInput = document.getElementById("report-observation-time");
  const extraEvidenceInput = document.getElementById("report-extra-evidence");
  const supportLearningInput = document.getElementById("report-support-learning");
  if (!observerNameInput || !observationTimeInput || !extraEvidenceInput || !supportLearningInput) {
    return;
  }

  const stored = getStoredReportNotes(journeyId);
  const initial = {
    observerName: stored.observerName || "",
    observationTime: toFriendlyObservationTime(stored.observationTime),
    extraEvidence: stored.extraEvidence || "",
    supportLearning: stored.supportLearning || ""
  };

  observerNameInput.value = initial.observerName;
  observationTimeInput.value = initial.observationTime;
  extraEvidenceInput.value = initial.extraEvidence;
  supportLearningInput.value = initial.supportLearning;

  saveStoredReportNotes(journeyId, initial);

  const persist = () => {
    saveStoredReportNotes(journeyId, {
      observerName: observerNameInput.value.trim(),
      observationTime: toFriendlyObservationTime(observationTimeInput.value.trim()),
      extraEvidence: extraEvidenceInput.value.trim(),
      supportLearning: supportLearningInput.value.trim()
    });
    observationTimeInput.value = toFriendlyObservationTime(observationTimeInput.value.trim());
  };

  observerNameInput.addEventListener("input", persist);
  observationTimeInput.addEventListener("change", persist);
  observationTimeInput.addEventListener("blur", persist);
  extraEvidenceInput.addEventListener("input", persist);
  supportLearningInput.addEventListener("input", persist);
}

async function initReportPage() {
  const content = document.getElementById("report-content");
  if (!content) {
    return;
  }

  const backButton = document.getElementById("report-back-button");
  if (backButton) {
    backButton.addEventListener("click", () => {
      window.location.href = "observation.html?step=behaviours";
    });
  }

  const homeButton = document.getElementById("report-home-button");
  if (homeButton) {
    homeButton.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const savePdfButton = document.getElementById("report-save-pdf-button");
  if (savePdfButton) {
    savePdfButton.addEventListener("click", () => {
      window.print();
    });
  }

  const printButton = document.getElementById("report-print-button");
  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }

  let domains = [];
  try {
    const response = await fetch(DOMAINS_DATA_PATH);
    if (response.ok) {
      const data = await response.json();
      domains = Array.isArray(data?.domains) ? data.domains : [];
    }
  } catch (error) {
    console.warn("Unable to load domains for report:", error);
  }

  const activeJourneyId = getActiveJourneyId();
  const activeJourney = readJourneys().find((journey) => journey.id === activeJourneyId);
  const state = activeJourney ? getJourneyState(activeJourney) : buildStateFromDraft();
  initReportNotesForm(activeJourneyId);
  const context = findSelectedContext(domains, state);
  const childName = state.childName || "this child";
  const tracks = collectReportTracks(context, state);
  const elementNames = tracks.map((track) => track.element.name);
  const behaviourNames = tracks
    .map((track) => track.selectedBehaviour?.name || "")
    .filter(Boolean);
  const domainText = context.domain?.name ? ` in ${context.domain.name}` : "";
  const subDomainText = context.subDomain?.name ? `, with a focus on ${context.subDomain.name}` : "";
  const overviewLine = tracks.length
    ? `You recorded an observation for ${childName}${domainText}${subDomainText}, focusing on ${joinReadableList(elementNames)}.`
    : `You recorded an observation for ${childName}${domainText}${subDomainText}.`;
  const behaviourLine = behaviourNames.length
    ? `Across the journey, the observed behaviours were ${joinReadableList(behaviourNames)}.`
    : "No behaviours have been selected yet for this journey.";
  const detailsLines = tracks.length
    ? tracks.map((track) => {
      if (!track.selectedBehaviour) {
        return `${track.element.name}: no behaviour was selected in the saved journey.`;
      }
      return `${track.element.name}: ${track.selectedBehaviour.name}. ${stripHtml(track.selectedBehaviour.description || "")}`;
    })
    : [
      "This report does not yet include selected elements and behaviours.",
      "Return to the observation flow and complete behaviour selections to generate a full summary."
    ];
  const progressionLines = tracks.length
    ? tracks.map((track) =>
      `${track.element.name}: ${likelyProgressionText(track.behaviours, track.selectedIndex)}`
    )
    : ["Progression ideas will appear once element and behaviour selections are available."];

  const cards = [
    createReportCard("What you observed", [overviewLine, behaviourLine]),
    createReportCard("Detailed breakdown", detailsLines),
    createReportCard("Progression ideas", progressionLines, "report-card--progression")
  ];

  content.replaceChildren(...cards);
}

if (document.body.dataset.page === "home") {
  setActiveStep(document.body.dataset.step || DEFAULT_STEP_ID);
  renderSessions();
  bindPageActions();
}

if (document.body.dataset.page === "observation") {
  setActiveStep(getActiveStepId());
  renderStepper();
  bindObservationDraft();
  bindObservationActions();
  initObservationFlow();
}

if (document.body.dataset.page === "report") {
  setActiveStep("review");
  initReportPage();
}

renderHelpTip();
registerServiceWorker();
