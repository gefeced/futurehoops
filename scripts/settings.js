window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.settings = (() => {
  const storageKey = "futurehoops_settings";
  const defaults = {
    advancedMode: false,
    showGhostLines: true,
    showDesignerGhosts: true,
    showAnnotationGhosts: false,
    showPlayerNumbers: true,
    showMobileWarning: true
  };
  const settings = { ...defaults };

  function loadSettings() {
    let source = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          source = parsed;
        }
      }
    } catch (error) {
      source = null;
    }

    Object.keys(defaults).forEach((key) => {
      if (source && typeof source[key] === "boolean") {
        settings[key] = source[key];
      } else {
        settings[key] = defaults[key];
      }
    });
    return settings;
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function getSetting(key) {
    if (key && Object.prototype.hasOwnProperty.call(settings, key)) {
      return settings[key];
    }
    return undefined;
  }

  function setSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(settings, key)) {
      return undefined;
    }
    settings[key] = Boolean(value);
    saveSettings();
    return settings[key];
  }

  function resetSettings() {
    Object.assign(settings, defaults);
    saveSettings();
    return settings;
  }

  function isAdvancedModeEnabled() {
    return settings.advancedMode === true;
  }

  loadSettings();

  const api = {
    settings,
    loadSettings,
    saveSettings,
    getSetting,
    setSetting,
    resetSettings,
    isAdvancedModeEnabled
  };

  window.FutureHoops.isAdvancedModeEnabled = isAdvancedModeEnabled;

  return api;
})();
