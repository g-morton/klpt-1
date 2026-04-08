const JOURNEYS_KEY = "klpt-journeys";
const ACTIVE_JOURNEY_KEY = "klpt-active-journey-id";
const LEGACY_STORAGE_KEYS = ["klpt-observations", "klptObservations", "observations"];
const STEP_STORAGE_KEY = "klpt-current-step";
const DRAFT_CHILD_NAME_KEY = "klpt-draft-child-name";
const DRAFT_DOMAIN_KEY = "klpt-draft-domain";
const DRAFT_SUBDOMAIN_KEY = "klpt-draft-subdomain";
const DRAFT_ELEMENT_KEY = "klpt-draft-element";
const DEFAULT_STEP_ID = "domains";
const DOMAINS_DATA_PATH = "assets/data/domains.json";
const NAVIGATION_DATA_PATH = "assets/data/navigation.json";
const MAX_SESSIONS = 5;
const FLOW_STEPS = ["domains", "subdomains", "elements"];
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
  const domainName = journey.path?.domainName || "";
  const title = journey.childName?.trim() || domainName || "New observation";
  const friendlyTime = journey.friendlyUpdatedAt || formatSessionTime(journey.updatedAt || journey.createdAt);
  const lastChoice =
    journey.lastSelection?.label ||
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
    document.body.dataset.step ||
    params.get("step") ||
    localStorage.getItem(STEP_STORAGE_KEY) ||
    DEFAULT_STEP_ID
  );
}

function setActiveStep(stepId) {
  document.body.dataset.step = stepId || DEFAULT_STEP_ID;
  localStorage.setItem(STEP_STORAGE_KEY, document.body.dataset.step);
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
    const steps = navigation.steps || [];
    const activeIndex = Math.max(steps.findIndex((step) => step.id === activeStepId), 0);
    const items = steps.map((step, index) => {
      const item = document.createElement("div");
      item.className = "stepper__item";
      item.dataset.stepId = step.id;
      item.style.setProperty(
        "--step-color",
        [
          "linear-gradient(90deg, #4e9bd0 0%, #5aa8db 100%)",
          "linear-gradient(90deg, #86c8ec 0%, #a6d8f2 100%)",
          "linear-gradient(90deg, #84c96d 0%, #9fd88a 100%)",
          "linear-gradient(90deg, #f0b15d 0%, #f39a57 100%)",
          "linear-gradient(90deg, #db6f82 0%, #e58ea0 100%)",
          "linear-gradient(90deg, #9b86d8 0%, #b6a5ea 100%)"
        ][index % 6]
      );

      if (index < activeIndex) {
        item.classList.add("is-complete");
      }

      if (index === activeIndex) {
        item.classList.add("is-active");
      }

      item.innerHTML = `
        <div class="stepper__chip">${index + 1}. ${step.title}</div>
        <div class="stepper__line" aria-hidden="true"></div>
      `;

      return item;
    });

    stepper.replaceChildren(...items);
    if (progressLabel) {
      progressLabel.textContent = `Step ${activeIndex + 1} of ${steps.length}`;
    }
  } catch (error) {
    console.warn("Unable to load navigation data:", error);
    stepper.replaceChildren();
    if (progressLabel) {
      progressLabel.textContent = "Step 1";
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
  selectedElementId: ""
};
let domainsCache = [];

function currentStepFromLayer(layer) {
  if (layer === "subdomains") {
    return "subdomains";
  }
  if (layer === "elements") {
    return "elements";
  }
  return "domains";
}

function getSelectedEntityId() {
  if (observationState.layer === "elements") {
    return observationState.selectedElementId;
  }
  if (observationState.layer === "subdomains") {
    return observationState.selectedSubDomainId;
  }
  return observationState.selectedDomainId;
}

function updateNextButtonVisibility() {
  const nextButton = document.getElementById("next-step-button");
  if (!nextButton) {
    return;
  }

  const label = nextButton.querySelector("span:last-child");
  if (label) {
    label.textContent = observationState.layer === "elements" ? "Continue" : "Next";
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
  if (layer === "domains") {
    const subCount = Array.isArray(item.subDomains) ? item.subDomains.length : 0;
    const elementCount = Array.isArray(item.elements) ? item.elements.length : 0;
    if (subCount > 0) {
      return `${subCount} focus area${subCount === 1 ? "" : "s"}`;
    }
    if (elementCount > 0) {
      return `${elementCount} element${elementCount === 1 ? "" : "s"} available`;
    }
    return "Tap to explore";
  }

  if (layer === "subdomains") {
    const elementCount = Array.isArray(item.elements) ? item.elements.length : 0;
    return `${elementCount} element${elementCount === 1 ? "" : "s"}`;
  }

  const behaviourCount = Array.isArray(item.behaviours) ? item.behaviours.length : 0;
  return `${behaviourCount} behaviour${behaviourCount === 1 ? "" : "s"}`;
}

function createSelectionOption(layer, item, selectedId) {
  const button = document.createElement("button");
  const isSelected = item.id === selectedId;

  button.className = "selection-option";
  button.type = "button";
  button.dataset.itemId = item.id;
  button.setAttribute("aria-label", `Choose ${item.name}`);

  if (isSelected) {
    button.classList.add("is-selected");
  }

  button.innerHTML = `
    <span class="selection-option__mark" aria-hidden="true">
      <i class="fa-solid ${isSelected ? "fa-check" : "fa-question"}"></i>
    </span>
    <span class="selection-option__content">
      <span class="selection-option__title">${item.name}</span>
      <span class="selection-option__hint">${buildOptionHint(layer, item)}</span>
    </span>
    <span class="selection-option__chevron" aria-hidden="true">
      <i class="fa-solid fa-angle-right"></i>
    </span>
  `;

  return button;
}

function updateTipFromSelection(layer, item) {
  const eyebrow = document.querySelector(".tip-card__eyebrow");
  const title = document.querySelector(".tip-card__title");
  const body = document.querySelector(".tip-card__body");
  const icon = document.querySelector(".tip-card__icon i");

  if (eyebrow) {
    eyebrow.textContent = layer === "domains" ? "Selected Domain" : layer === "subdomains" ? "Selected Subdomain" : "Selected Element";
  }
  if (title) {
    title.textContent = item.name;
  }
  if (body) {
    body.textContent = item.summary || item.description || "Tap next to continue through the observation flow.";
  }
  if (icon) {
    icon.className = "fa-solid fa-circle-info";
  }
}

function updateSelectionHeader() {
  const eyebrow = document.querySelector(".selection-group__eyebrow");
  const title = document.getElementById("domain-options-title");
  const intro = document.getElementById("placeholder-copy");

  if (!eyebrow || !title || !intro) {
    return;
  }

  if (observationState.layer === "subdomains") {
    eyebrow.textContent = "Step 2";
    title.textContent = "Choose a subdomain";
    intro.textContent = "Choose the focus area that best fits your selected domain.";
  } else if (observationState.layer === "elements") {
    eyebrow.textContent = "Step 3";
    title.textContent = "Choose an element";
    intro.textContent = "Select the element that most closely matches your observation.";
  } else {
    eyebrow.textContent = "Step 1";
    title.textContent = "Choose a domain";
    intro.textContent = "Begin by optionally adding the child's name, then choose the domain that best matches what you observed.";
  }
}

function updateObservationContextTitle() {
  const title = document.getElementById("observation-context-title");
  if (!title) {
    return;
  }

  const domain = getSelectedDomain();
  title.textContent = domain?.name || "New observation";
}

function persistObservationDraft() {
  localStorage.setItem(DRAFT_DOMAIN_KEY, observationState.selectedDomainId || "");
  localStorage.setItem(DRAFT_SUBDOMAIN_KEY, observationState.selectedSubDomainId || "");
  localStorage.setItem(DRAFT_ELEMENT_KEY, observationState.selectedElementId || "");
}

function clearObservationDraft() {
  localStorage.removeItem(DRAFT_DOMAIN_KEY);
  localStorage.removeItem(DRAFT_SUBDOMAIN_KEY);
  localStorage.removeItem(DRAFT_ELEMENT_KEY);
  localStorage.removeItem(DRAFT_CHILD_NAME_KEY);
  localStorage.removeItem(ACTIVE_JOURNEY_KEY);
}

function getActiveJourneyId() {
  return localStorage.getItem(ACTIVE_JOURNEY_KEY) || "";
}

function setActiveJourneyId(id) {
  localStorage.setItem(ACTIVE_JOURNEY_KEY, id);
}

function buildJourneyPatch() {
  const domain = getSelectedDomain();
  const subDomain = getSelectedSubDomain();
  const selectedElement = optionsForCurrentLayer().find(
    (item) => item.id === observationState.selectedElementId
  ) || null;
  const selectedEntityId = getSelectedEntityId();
  const selectedForLayer = optionsForCurrentLayer().find((item) => item.id === selectedEntityId) || null;
  const childName = (localStorage.getItem(DRAFT_CHILD_NAME_KEY) || "").trim();

  return {
    childName,
    currentStep: currentStepFromLayer(observationState.layer),
    status: "draft",
    lastSelection: selectedForLayer
      ? {
          layer: observationState.layer,
          id: selectedEntityId || "",
          label: selectedForLayer.name || ""
        }
      : null,
    path: {
      domainId: observationState.selectedDomainId || "",
      domainName: domain?.name || "",
      subDomainId: observationState.selectedSubDomainId || "",
      subDomainName: subDomain?.name || "",
      elementId: observationState.selectedElementId || "",
      elementName: selectedElement?.name || ""
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
  return getSelectedEntityId();
}

function applySelection(layer, item) {
  if (layer === "domains") {
    observationState.selectedDomainId = item.id;
    observationState.selectedSubDomainId = "";
    observationState.selectedElementId = "";
  } else if (layer === "subdomains") {
    observationState.selectedSubDomainId = item.id;
    observationState.selectedElementId = "";
  } else {
    observationState.selectedElementId = item.id;
  }

  persistObservationDraft();
  updateTipFromSelection(layer, item);
  updateNextButtonVisibility();
}

function renderCurrentLayerOptions() {
  const list = document.getElementById("domain-options");
  if (!list) {
    return;
  }

  updateSelectionHeader();
  updateObservationContextTitle();
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

    upsertActiveJourney();
    const hasSubDomains = Array.isArray(domain.subDomains) && domain.subDomains.length > 0;
    observationState.layer = hasSubDomains ? "subdomains" : "elements";
    setActiveStep(currentStepFromLayer(observationState.layer));
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "subdomains") {
    if (!observationState.selectedSubDomainId) {
      return;
    }

    upsertActiveJourney();
    observationState.layer = "elements";
    setActiveStep(currentStepFromLayer(observationState.layer));
    renderStepper();
    renderHelpTip();
    renderCurrentLayerOptions();
    return;
  }

  if (observationState.layer === "elements") {
    if (!observationState.selectedElementId) {
      return;
    }

    upsertActiveJourney();
    setActiveStep("behaviours");
    renderStepper();
  }
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
    const draftDomain = localStorage.getItem(DRAFT_DOMAIN_KEY) || activeJourney?.path?.domainId || "";
    const draftSubDomain = localStorage.getItem(DRAFT_SUBDOMAIN_KEY) || activeJourney?.path?.subDomainId || "";
    const draftElement = localStorage.getItem(DRAFT_ELEMENT_KEY) || activeJourney?.path?.elementId || "";

    observationState.selectedDomainId = draftDomain;
    observationState.selectedSubDomainId = draftSubDomain;
    observationState.selectedElementId = draftElement;

    if (activeJourney?.childName && !localStorage.getItem(DRAFT_CHILD_NAME_KEY)) {
      localStorage.setItem(DRAFT_CHILD_NAME_KEY, activeJourney.childName);
    }

    const activeStep = getActiveStepId();
    observationState.layer = FLOW_STEPS.includes(activeStep) ? activeStep : "domains";

    renderCurrentLayerOptions();

    const options = optionsForCurrentLayer();
    const selected = options.find((item) => item.id === selectedIdForCurrentLayer());
    if (selected) {
      updateTipFromSelection(observationState.layer, selected);
    }
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

renderHelpTip();
registerServiceWorker();
