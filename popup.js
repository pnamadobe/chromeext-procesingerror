const DEFAULT_BADGE_ITEMS = [
  { text: 'Processing Error', enabled: true },
  { text: 'Processing', enabled: false },
  { text: 'Failed', enabled: false },
  { text: 'Unpublished', enabled: false }
];

const DEFAULTS = {
  enabled: true,
  badgeTexts: ['Processing Error'],
  badgeItems: DEFAULT_BADGE_ITEMS,
  caseSensitive: false,
  hideMode: 'container'
};

const $ = (id) => document.getElementById(id);
const enabledEl = $('enabled');
const caseEl = $('caseSensitive');
const badgeListEl = $('badgeList');
const addFormEl = $('addForm');
const newBadgeInputEl = $('newBadgeText');
const statusEl = $('status');
const activeStateTextEl = $('activeStateText');
const modeButtons = Array.from(document.querySelectorAll('.seg-btn[data-mode]'));

let state = {
  enabled: DEFAULTS.enabled,
  caseSensitive: DEFAULTS.caseSensitive,
  hideMode: DEFAULTS.hideMode,
  badgeItems: DEFAULT_BADGE_ITEMS.map((item) => ({ ...item }))
};

let statusTimer = null;

function setStatus(msg) {
  statusEl.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = 'Changes apply instantly';
  }, 1400);
}

function normalizeBadgeItems(stored) {
  if (Array.isArray(stored.badgeItems) && stored.badgeItems.length > 0) {
    return stored.badgeItems
      .filter((item) => item && typeof item.text === 'string' && item.text.trim())
      .map((item) => ({
        text: item.text.trim(),
        enabled: !!item.enabled
      }));
  }

  const activeTexts = Array.isArray(stored.badgeTexts)
    ? stored.badgeTexts.map((t) => (t || '').trim()).filter(Boolean)
    : DEFAULTS.badgeTexts;

  const activeSet = new Set(activeTexts.map((t) => t.toLowerCase()));
  const merged = DEFAULT_BADGE_ITEMS.map((preset) => ({
    text: preset.text,
    enabled: activeSet.has(preset.text.toLowerCase())
  }));

  for (const text of activeTexts) {
    if (!merged.some((item) => item.text.toLowerCase() === text.toLowerCase())) {
      merged.push({ text, enabled: true });
    }
  }

  return merged;
}

function syncUI() {
  enabledEl.checked = state.enabled;
  caseEl.checked = state.caseSensitive;
  document.body.classList.toggle('disabled-state', !state.enabled);
  activeStateTextEl.textContent = state.enabled
    ? 'Active on Adobe Experience Cloud'
    : 'Paused';

  for (const btn of modeButtons) {
    btn.classList.toggle('active', btn.dataset.mode === state.hideMode);
  }

  renderBadgeList();
}

function renderBadgeList() {
  badgeListEl.innerHTML = '';

  state.badgeItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'badge-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'badge-name';
    nameSpan.textContent = item.text;
    nameSpan.title = item.text;

    const actions = document.createElement('div');
    actions.className = 'badge-actions';

    if (state.badgeItems.length > 1) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.title = `Remove "${item.text}"`;
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.badgeItems.splice(index, 1);
        persist('Removed badge filter');
        syncUI();
      });
      actions.appendChild(removeBtn);
    }

    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    switchLabel.title = `Toggle hiding "${item.text}"`;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = item.enabled;
    input.addEventListener('change', () => {
      state.badgeItems[index].enabled = input.checked;
      persist(input.checked ? `Hiding "${item.text}"` : `Showing "${item.text}"`);
    });

    const slider = document.createElement('span');
    slider.className = 'slider';

    switchLabel.appendChild(input);
    switchLabel.appendChild(slider);
    actions.appendChild(switchLabel);

    row.appendChild(nameSpan);
    row.appendChild(actions);
    badgeListEl.appendChild(row);
  });
}

function persist(statusMessage = 'Updated') {
  const badgeTexts = state.badgeItems
    .filter((item) => item.enabled)
    .map((item) => item.text.trim())
    .filter(Boolean);

  const payload = {
    enabled: state.enabled,
    caseSensitive: state.caseSensitive,
    hideMode: state.hideMode,
    badgeItems: state.badgeItems,
    badgeTexts
  };

  chrome.storage.sync.set(payload, () => {
    setStatus(statusMessage);
  });
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    state = {
      enabled: stored.enabled ?? DEFAULTS.enabled,
      caseSensitive: !!stored.caseSensitive,
      hideMode: stored.hideMode || DEFAULTS.hideMode,
      badgeItems: normalizeBadgeItems(stored)
    };
    syncUI();
  });
}

enabledEl.addEventListener('change', () => {
  state.enabled = enabledEl.checked;
  syncUI();
  persist(state.enabled ? 'Enabled' : 'Disabled');
});

caseEl.addEventListener('change', () => {
  state.caseSensitive = caseEl.checked;
  persist('Updated match sensitivity');
});

for (const btn of modeButtons) {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (!mode || mode === state.hideMode) return;
    state.hideMode = mode;
    syncUI();
    persist(`Hide mode: ${mode === 'container' ? 'Container' : 'CSS-only'}`);
  });
}

addFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = newBadgeInputEl.value.trim();
  if (!text) return;

  const existing = state.badgeItems.find(
    (item) => item.text.toLowerCase() === text.toLowerCase()
  );
  if (existing) {
    existing.enabled = true;
  } else {
    state.badgeItems.push({ text, enabled: true });
  }

  newBadgeInputEl.value = '';
  syncUI();
  persist(`Added "${text}"`);
});

$('reset').addEventListener('click', () => {
  state = {
    enabled: DEFAULTS.enabled,
    caseSensitive: DEFAULTS.caseSensitive,
    hideMode: DEFAULTS.hideMode,
    badgeItems: DEFAULT_BADGE_ITEMS.map((item) => ({ ...item }))
  };
  syncUI();
  persist('Reset to defaults');
});

load();
