(() => {
  const HIDDEN_ATTR = 'data-hide-aem-badge';
  const STYLE_ID = 'hide-aem-badge-style';

  const DEFAULTS = {
    enabled: true,
    badgeTexts: ['Processing Error'],
    caseSensitive: false,
    hideMode: 'container'
  };

  let settings = { ...DEFAULTS };
  let observer = null;

  function normalize(text) {
    if (!text) return '';
    const trimmed = text.trim();
    return settings.caseSensitive ? trimmed : trimmed.toLowerCase();
  }

  function getTargets() {
    return settings.badgeTexts
      .map((t) => (t || '').trim())
      .filter(Boolean)
      .map((t) => (settings.caseSensitive ? t : t.toLowerCase()));
  }

  function findContainer(label) {
    let el = label;
    let fallback = label;
    for (let i = 0; i < 7 && el; i++, el = el.parentElement) {
      const className = typeof el.className === 'string' ? el.className : '';
      if (
        el.matches?.('.vi3c6W_flex, [class*="spectrum-Badge"], [role="status"]') ||
        /badge|status|chip|tag/i.test(className)
      ) {
        return el;
      }

      const text = el.textContent?.trim() || '';
      if (text.length <= 160 && matchesTarget(text)) {
        fallback = el;
        const display = getComputedStyle(el).display;
        const rect = el.getBoundingClientRect();
        if (
          (display === 'flex' || display === 'inline-flex') &&
          rect.width < 500 &&
          rect.height < 100
        ) {
          return el;
        }
      }
    }
    return fallback;
  }

  function matchesTarget(text) {
    const targets = getTargets();
    if (!targets.length) return false;
    const normalized = normalize(text);
    return targets.some((t) => normalized === t || normalized.includes(t));
  }

  function hideElement(el) {
    if (!(el instanceof HTMLElement)) return;
    el.setAttribute(HIDDEN_ATTR, 'true');
    if (settings.hideMode !== 'css') {
      el.style.setProperty('display', 'none', 'important');
    }
  }

  function showElement(el) {
    if (!(el instanceof HTMLElement)) return;
    el.removeAttribute(HIDDEN_ATTR);
    el.style.removeProperty('display');
  }

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const elements = [];
    if (scope instanceof HTMLElement) elements.push(scope);
    elements.push(...scope.querySelectorAll('*'));

    const matched = elements.filter((el) => {
      const text = el.textContent?.trim() || '';
      return text.length > 0 && text.length <= 160 && matchesTarget(text);
    });
    const hasMatchedDescendant = new Set();
    for (const el of matched) {
      let parent = el.parentElement;
      while (parent && scope.contains(parent)) {
        hasMatchedDescendant.add(parent);
        if (parent === scope) break;
        parent = parent.parentElement;
      }
    }
    for (const el of matched) {
      if (!hasMatchedDescendant.has(el)) {
        hideElement(findContainer(el));
      }
    }
  }

  function unhideAll() {
    document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`).forEach(showElement);
  }

  function ensureStyleTag() {
    if (settings.hideMode !== 'css') {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(tag);
    }
    tag.textContent = `[${HIDDEN_ATTR}="true"] { display: none !important; }`;
  }

  function startObserver() {
    stopObserver();
    observer = new MutationObserver((mutations) => {
      if (!settings.enabled) return;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          if (mutation.target.parentElement) scan(mutation.target.parentElement);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) scan(node);
          else if (node.parentElement) scan(node.parentElement);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function apply() {
    ensureStyleTag();
    if (!settings.enabled) {
      stopObserver();
      unhideAll();
      return;
    }
    scan(document);
    startObserver();
  }

  function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage?.sync.get(DEFAULTS, (stored) => {
          settings = { ...DEFAULTS, ...stored };
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  try {
    chrome.storage?.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      let touched = false;
      for (const key of Object.keys(changes)) {
        if (key in DEFAULTS) {
          settings[key] = changes[key].newValue ?? DEFAULTS[key];
          touched = true;
        }
      }
      if (touched) {
        unhideAll();
        apply();
      }
    });
  } catch (e) {
    // storage API not available — fall back to defaults
  }

  loadSettings().then(apply);
})();
