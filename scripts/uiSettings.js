window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiSettings = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements } = state;
  const settingsApi = window.FutureHoops.settings;

  function syncSettingsPanel() {
    if (!settingsApi) {
      return;
    }
    if (elements.settingsAdvancedToggle) {
      elements.settingsAdvancedToggle.checked =
        settingsApi.getSetting("advancedMode") === true;
    }
    if (elements.settingsGhostToggle) {
      elements.settingsGhostToggle.checked =
        settingsApi.getSetting("showGhostLines") !== false;
    }
    if (elements.settingsDesignerGhostToggle) {
      elements.settingsDesignerGhostToggle.checked =
        settingsApi.getSetting("showDesignerGhosts") !== false;
    }
    if (elements.settingsAnnotationGhostToggle) {
      elements.settingsAnnotationGhostToggle.checked =
        settingsApi.getSetting("showAnnotationGhosts") === true;
    }
    if (elements.settingsPlayerNumberToggle) {
      elements.settingsPlayerNumberToggle.checked =
        settingsApi.getSetting("showPlayerNumbers") !== false;
    }
    if (elements.settingsMobileWarningToggle) {
      elements.settingsMobileWarningToggle.checked =
        settingsApi.getSetting("showMobileWarning") !== false;
    }
  }

  function applyAdvancedModeSetting() {
    if (!settingsApi) {
      return;
    }
    const isAdvanced = settingsApi.getSetting("advancedMode") === true;
    if (elements.hud) {
      elements.hud.dataset.advancedMode = String(isAdvanced);
    }
    ui.syncMobileLayout?.();
    ui.syncAnnotationPalette?.();
    ui.renderDesignerCourt?.();
  }

  function applyGhostSetting() {
    if (!settingsApi) {
      return;
    }
    const allowGhost = settingsApi.getSetting("showGhostLines") !== false;
    if (elements.gameGhostToggle) {
      elements.gameGhostToggle.disabled = !allowGhost;
      if (!allowGhost) {
        elements.gameGhostToggle.checked = false;
      }
    }
    if (!allowGhost) {
      ui.setGhostPathsEnabled?.(false);
      return;
    }
    if (elements.gameGhostToggle) {
      ui.setGhostPathsEnabled?.(elements.gameGhostToggle.checked);
    }
  }

  function applyDesignerGhostSetting() {
    ui.renderDesignerCourt?.();
  }

  function applyAnnotationGhostSetting() {
    ui.renderDesignerCourt?.();
  }

  function applyPlayerNumberSetting() {
    ui.renderDesignerCourt?.();
  }

  function applyMobileWarningSetting({ resetDismissed = false } = {}) {
    if (resetDismissed) {
      state.mobile.warningDismissed = false;
    }
    ui.updateMobileMode?.();
  }

  function resetAllData() {
    try {
      window.localStorage.removeItem("futurehoops.playDesigner.v1");
      window.localStorage.removeItem("futurehoops.playDesigner.annotations.v1");
      window.localStorage.removeItem("futurehoops_roster");
      window.localStorage.removeItem("futurehoops_settings");
      window.localStorage.removeItem("futurehoops_journal_entries");
      window.localStorage.removeItem("futurehoops_journal_tags");
    } catch (error) {
      // Ignore storage failures.
    }
    window.location.reload();
  }

  Object.assign(ui, {
    syncSettingsPanel,
    applyAdvancedModeSetting,
    applyGhostSetting,
    applyDesignerGhostSetting,
    applyAnnotationGhostSetting,
    applyPlayerNumberSetting,
    applyMobileWarningSetting,
    resetAllData
  });
})();
