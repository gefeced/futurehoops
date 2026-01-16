window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

(() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements, courtState, designerState, gameState } = state;
  const { sim } = window.FutureHoops;
  const settingsApi = window.FutureHoops.settings;
  const mobileCache = new Map();
  const mobileMoved = new Set();

  function cacheMobileElement(element) {
    if (!element || mobileCache.has(element)) {
      return;
    }
    mobileCache.set(element, {
      parent: element.parentElement,
      nextSibling: element.nextElementSibling
    });
  }

  function moveMobileElement(element, target) {
    if (!element || !target) {
      return;
    }
    cacheMobileElement(element);
    if (element.parentElement !== target) {
      target.appendChild(element);
    }
    mobileMoved.add(element);
  }

  function restoreMobileElements() {
    mobileMoved.forEach((element) => {
      const cached = mobileCache.get(element);
      if (!cached?.parent) {
        return;
      }
      if (cached.nextSibling && cached.nextSibling.parentElement === cached.parent) {
        cached.parent.insertBefore(element, cached.nextSibling);
      } else {
        cached.parent.appendChild(element);
      }
    });
    mobileMoved.clear();
  }

  function setMobileWarningVisible(visible) {
    if (!elements.mobileWarning) {
      return;
    }
    elements.mobileWarning.classList.toggle("is-visible", visible);
    elements.mobileWarning.setAttribute("aria-hidden", String(!visible));
  }

  function updateMobilePanelState() {
    const isLeftOpen = state.mobile.leftOpen;
    const isRightOpen = state.mobile.rightOpen;
    document.body.classList.toggle("mobile-left-open", isLeftOpen);
    document.body.classList.toggle("mobile-right-open", isRightOpen);
    if (elements.mobileLeftPanel) {
      elements.mobileLeftPanel.setAttribute("aria-hidden", String(!isLeftOpen));
    }
    if (elements.mobileRightPanel) {
      elements.mobileRightPanel.setAttribute("aria-hidden", String(!isRightOpen));
    }
    if (elements.mobilePanelOverlay) {
      elements.mobilePanelOverlay.setAttribute(
        "aria-hidden",
        String(!(isLeftOpen || isRightOpen))
      );
    }
  }

  function closeMobilePanels() {
    state.mobile.leftOpen = false;
    state.mobile.rightOpen = false;
    updateMobilePanelState();
  }

  function toggleMobilePanel(side) {
    if (!state.isMobile) {
      return;
    }
    const isLeft = side === "left";
    const isOpen = isLeft ? state.mobile.leftOpen : state.mobile.rightOpen;
    state.mobile.leftOpen = false;
    state.mobile.rightOpen = false;
    if (!isOpen) {
      if (isLeft) {
        state.mobile.leftOpen = true;
      } else {
        state.mobile.rightOpen = true;
      }
    }
    updateMobilePanelState();
  }

  function syncMobileToggles(tab) {
    const show = state.isMobile && tab === "designer";
    if (elements.mobileLeftToggle) {
      elements.mobileLeftToggle.classList.toggle("is-hidden", !show);
    }
    if (elements.mobileRightToggle) {
      elements.mobileRightToggle.classList.toggle("is-hidden", !show);
    }
    if (!show) {
      return;
    }
    elements.mobileLeftToggle.textContent = "Tools";
    elements.mobileRightToggle.textContent = "Play Details";
  }

  function syncMobileLayout() {
    const tab = elements.hud?.dataset.activeTab || "profile";
    restoreMobileElements();
    if (!state.isMobile) {
      closeMobilePanels();
      syncMobileToggles(tab);
      return;
    }
    if (tab === "designer") {
      moveMobileElement(elements.designerToolsPanel, elements.mobileLeftContent);
      moveMobileElement(elements.designerDetailsPanel, elements.mobileRightContent);
    } else if (tab === "game") {
      moveMobileElement(elements.gameStatsPanel, elements.mobileLeftContent);
      moveMobileElement(elements.gameLogPanel, elements.mobileRightContent);
    }
    syncMobileToggles(tab);
    closeMobilePanels();
  }

  function updateMobileMode() {
    const isMobile = window.innerWidth < 900;
    const showWarning =
      settingsApi?.getSetting ? settingsApi.getSetting("showMobileWarning") !== false : true;
    if (state.isMobile !== isMobile) {
      state.isMobile = isMobile;
      document.body.classList.toggle("mobile-mode", isMobile);
    }
    if (isMobile && showWarning && !state.mobile.warningDismissed) {
      setMobileWarningVisible(true);
    } else {
      setMobileWarningVisible(false);
    }
    syncMobileLayout();
  }

  function cacheElements() {
    elements.playerTrack = document.getElementById("playerTrack");
    elements.ratingsGrid = document.getElementById("ratingsGrid");
    elements.profileInitials = document.getElementById("profileInitials");
    elements.playerNameInput = document.getElementById("playerName");
    elements.playerPositionSelect = document.getElementById("playerPosition");
    elements.playerArchetypeSelect = document.getElementById("playerArchetype");
    elements.profileId = document.getElementById("profileId");
    elements.archetypeFocus = document.getElementById("archetypeFocus");
    elements.fatigueFill = document.getElementById("fatigueFill");
    elements.fatigueValue = document.getElementById("fatigueValue");
    elements.fatigueInput = document.getElementById("fatigueInput");
    elements.pct3 = document.getElementById("pct3");
    elements.pctMid = document.getElementById("pctMid");
    elements.pctLay = document.getElementById("pctLay");
    elements.pctFt = document.getElementById("pctFt");
    elements.confidenceRows = Array.from(document.querySelectorAll(".metric-row"));
    elements.addPlayerBtn = document.getElementById("addPlayer");
    elements.scrollLeftBtn = document.querySelector(".carousel-btn.left");
    elements.scrollRightBtn = document.querySelector(".carousel-btn.right");
    elements.lineupPanel = document.getElementById("lineupPanel");
    elements.lineupGrid = document.getElementById("lineupGrid");
    elements.settingsAdvancedToggle = document.getElementById("settingsAdvancedToggle");
    elements.settingsAdvancedInfo = document.getElementById("settingsAdvancedInfo");
    elements.settingsChangelogButton = document.getElementById("settingsChangelogButton");
    elements.settingsGhostToggle = document.getElementById("settingsGhostToggle");
    elements.settingsDesignerGhostToggle = document.getElementById("settingsDesignerGhostToggle");
    elements.settingsAnnotationGhostToggle = document.getElementById(
      "settingsAnnotationGhostToggle"
    );
    elements.settingsPlayerNumberToggle = document.getElementById(
      "settingsPlayerNumberToggle"
    );
    elements.settingsMobileWarningToggle = document.getElementById(
      "settingsMobileWarningToggle"
    );
    elements.settingsResetAll = document.getElementById("settingsResetAll");
    elements.modalOverlay = document.getElementById("modalOverlay");
    elements.advancedModeModal = document.getElementById("advancedModeModal");
    elements.advancedModeModalClose = document.getElementById("advancedModeModalClose");
    elements.gameModeModal = document.getElementById("gameModeModal");
    elements.gameModeModalClose = document.getElementById("gameModeModalClose");
    elements.gameModeModalEnter = document.getElementById("gameModeModalEnter");
    elements.gameModeModalError = document.getElementById("gameModeModalError");
    elements.gameModePassword = document.getElementById("gameModePassword");
    elements.settingsOverviewInfo = document.getElementById("settingsOverviewInfo");
    elements.settingsOverviewModal = document.getElementById("settingsOverviewModal");
    elements.settingsOverviewModalClose = document.getElementById("settingsOverviewModalClose");
    elements.settingsChangelogModal = document.getElementById("settingsChangelogModal");
    elements.settingsChangelogModalClose = document.getElementById("settingsChangelogModalClose");
    elements.confirmActionModal = document.getElementById("confirmActionModal");
    elements.confirmActionModalTitle = document.getElementById("confirmActionModalTitle");
    elements.confirmActionModalBody = document.getElementById("confirmActionModalBody");
    elements.confirmActionModalCancel = document.getElementById("confirmActionModalCancel");
    elements.confirmActionModalConfirm = document.getElementById("confirmActionModalConfirm");
    elements.resetDataModal = document.getElementById("resetDataModal");
    elements.resetDataModalCancel = document.getElementById("resetDataModalCancel");
    elements.resetDataModalConfirm = document.getElementById("resetDataModalConfirm");
    elements.mobileWarning = document.getElementById("mobileWarning");
    elements.mobileWarningClose = document.getElementById("mobileWarningClose");
    elements.mobileLeftToggle = document.getElementById("mobileLeftToggle");
    elements.mobileRightToggle = document.getElementById("mobileRightToggle");
    elements.mobilePanelOverlay = document.getElementById("mobilePanelOverlay");
    elements.mobileLeftPanel = document.getElementById("mobileLeftPanel");
    elements.mobileRightPanel = document.getElementById("mobileRightPanel");
    elements.mobileLeftContent = document.getElementById("mobileLeftContent");
    elements.mobileRightContent = document.getElementById("mobileRightContent");
    elements.mobileLeftClose = document.getElementById("mobileLeftClose");
    elements.mobileRightClose = document.getElementById("mobileRightClose");
    elements.mobileJoystick = document.getElementById("mobileJoystick");
    elements.mobileJoystickStick = document.getElementById("mobileJoystickStick");
    elements.mobileShootBtn = document.getElementById("mobileShootBtn");
    elements.mobilePlayBtn = document.getElementById("mobilePlayBtn");
    elements.simStart = document.getElementById("simStart");
    elements.simEnd = document.getElementById("simEnd");
    elements.simActionButtons = Array.from(document.querySelectorAll("[data-sim-action]"));
    elements.defenderMode = document.getElementById("defenderMode");
    elements.defenderRating = document.getElementById("defenderRating");
    elements.defenderRatingValue = document.getElementById("defenderRatingValue");
    elements.contestLevel = document.getElementById("contestLevel");
    elements.contestLevelValue = document.getElementById("contestLevelValue");
    elements.shotDifficulty = document.getElementById("shotDifficulty");
    elements.shotDifficultyValue = document.getElementById("shotDifficultyValue");
    elements.simLog = document.getElementById("simLog");
    elements.courtCanvas = document.getElementById("courtCanvas");
    elements.simAiShot = document.getElementById("simAiShot");
    elements.playSelect = document.getElementById("playSelect");
    elements.runPlay = document.getElementById("runPlay");
    elements.drawPlayToggle = document.getElementById("drawPlayToggle");
    elements.shootPrimary = document.getElementById("shootPrimary");
    elements.passSecondary = document.getElementById("passSecondary");
    elements.resetPlay = document.getElementById("resetPlay");
    elements.playInfo = document.getElementById("playInfo");
    elements.hud = document.querySelector(".hud");
    elements.tabButtons = Array.from(document.querySelectorAll("[data-tab-button]"));
    elements.gameCourt = document.getElementById("gameCourt");
    elements.gameLog = document.getElementById("gameLog");
    elements.gameShotClock = document.getElementById("gameShotClock");
    elements.gamePossession = document.getElementById("gamePossession");
    elements.gamePlayStatus = document.getElementById("gamePlayStatus");
    elements.gamePlayerName = document.getElementById("gamePlayerName");
    elements.gamePlayerRole = document.getElementById("gamePlayerRole");
    elements.gameFatigueFill = document.getElementById("gameFatigueFill");
    elements.gameFatigueValue = document.getElementById("gameFatigueValue");
    elements.gamePct3 = document.getElementById("gamePct3");
    elements.gamePctMid = document.getElementById("gamePctMid");
    elements.gamePctLay = document.getElementById("gamePctLay");
    elements.gameConfidenceShooting = document.getElementById("gameConfidenceShooting");
    elements.gameConfidenceDefense = document.getElementById("gameConfidenceDefense");
    elements.gameConfidenceFinishing = document.getElementById("gameConfidenceFinishing");
    elements.gameModeButtons = Array.from(document.querySelectorAll("[data-game-mode]"));
    elements.gameGhostToggle = document.getElementById("gameGhostToggle");
    elements.gamePlayMenu = document.getElementById("gamePlayMenu");
    elements.gamePlaySelect = document.getElementById("gamePlaySelect");
    elements.gamePlayRun = document.getElementById("gamePlayRun");
    elements.gamePlayCancel = document.getElementById("gamePlayCancel");
    elements.designerCourt = document.getElementById("designerCourt");
    elements.designerStepList = document.getElementById("designerStepList");
    elements.designerAddStep = document.getElementById("designerAddStep");
    elements.designerDeleteStep = document.getElementById("designerDeleteStep");
    elements.designerStepUp = document.getElementById("designerStepUp");
    elements.designerStepDown = document.getElementById("designerStepDown");
    elements.designerStepName = document.getElementById("designerStepName");
    elements.designerStepDuration = document.getElementById("designerStepDuration");
    elements.designerStepParallel = document.getElementById("designerStepParallel");
    elements.designerGhostToggle = document.getElementById("designerGhostToggle");
    elements.designerContext = document.getElementById("designerContext");
    elements.designerContextPlayerLabel = document.getElementById("designerContextPlayerLabel");
    elements.designerContextRouteLabel = document.getElementById("designerContextRouteLabel");
    elements.designerContextPassLabel = document.getElementById("designerContextPassLabel");
    elements.designerContextBallLabel = document.getElementById("designerContextBallLabel");
    elements.designerScreenToggle = document.getElementById("designerScreenToggle");
    elements.designerTagToggle = document.getElementById("designerTagToggle");
    elements.designerTagInput = document.getElementById("designerTagInput");
    elements.designerDeleteRoute = document.getElementById("designerDeleteRoute");
    elements.designerPassTime = document.getElementById("designerPassTime");
    elements.designerPassSlider = document.getElementById("designerPassSlider");
    elements.designerDeletePass = document.getElementById("designerDeletePass");
    elements.designerBallHolder = document.getElementById("designerBallHolder");
    elements.designerPlaceGroup = document.getElementById("designerPlaceGroup");
    elements.designerAnnotationGroup = document.getElementById("designerAnnotationGroup");
    elements.designerPlayName = document.getElementById("designerPlayName");
    elements.designerPlayTags = document.getElementById("designerPlayTags");
    elements.designerPlayNotes = document.getElementById("designerPlayNotes");
    elements.designerNewPlay = document.getElementById("designerNewPlay");
    elements.designerSavePlay = document.getElementById("designerSavePlay");
    elements.designerDeletePlay = document.getElementById("designerDeletePlay");
    elements.designerPlaySelect = document.getElementById("designerPlaySelect");
    elements.designerLoadPlay = document.getElementById("designerLoadPlay");
    elements.designerPlayerList = document.getElementById("designerPlayerList");
    elements.designerClearPasses = document.getElementById("designerClearPasses");
    elements.designerClearSelection = document.getElementById("designerClearSelection");
    elements.designerClearRoutes = document.getElementById("designerClearRoutes");
    elements.designerPreviewPlay = document.getElementById("designerPreviewPlay");
    elements.designerPreviewControls = document.getElementById("designerPreviewControls");
    elements.designerPreviewStep = document.getElementById("designerPreviewStep");
    elements.designerPreviewTimer = document.getElementById("designerPreviewTimer");
    elements.designerPreviewPause = document.getElementById("designerPreviewPause");
    elements.designerPreviewStop = document.getElementById("designerPreviewStop");
    elements.designerMiddlePanel = document.getElementById("designerMiddlePanel");
    elements.designerMidPlayName = document.getElementById("designerMidPlayName");
    elements.designerMidStep = document.getElementById("designerMidStep");
    elements.designerMidPreviewPlay = document.getElementById("designerMidPreviewPlay");
    elements.designerMidPreviewPause = document.getElementById("designerMidPreviewPause");
    elements.designerMidPreviewStop = document.getElementById("designerMidPreviewStop");
    elements.designerMidPlayerName = document.getElementById("designerMidPlayerName");
    elements.designerMidPlayerMeta = document.getElementById("designerMidPlayerMeta");
    elements.designerMidCoreRatings = document.getElementById("designerMidCoreRatings");
    elements.designerMidConfidence = document.getElementById("designerMidConfidence");
    elements.designerMidRouteLabel = document.getElementById("designerMidRouteLabel");
    elements.designerMidDeleteRoute = document.getElementById("designerMidDeleteRoute");
    elements.designerMidPassLabel = document.getElementById("designerMidPassLabel");
    elements.designerMidPassTime = document.getElementById("designerMidPassTime");
    elements.designerMidPassSlider = document.getElementById("designerMidPassSlider");
    elements.designerMidDeletePass = document.getElementById("designerMidDeletePass");
    elements.designerStatus = document.getElementById("designerStatus");
    elements.designerToolButtons = Array.from(
      document.querySelectorAll("[data-designer-tool]")
    );
    elements.designerPlaceButtons = Array.from(
      document.querySelectorAll("[data-designer-place]")
    );
    elements.designerAnnotationTypeButtons = Array.from(
      document.querySelectorAll("[data-annotation-type]")
    );
    elements.designerAnnotationColorButtons = Array.from(
      document.querySelectorAll("[data-annotation-color]")
    );
    elements.designerDeleteAnnotation = document.getElementById("designerDeleteAnnotation");
    elements.designerClearAnnotations = document.getElementById("designerClearAnnotations");
    elements.designerToolsPanel = document.getElementById("designerToolsPanel");
    elements.designerDetailsPanel = document.getElementById("designerDetailsPanel");
    elements.designerContextBlock = document.getElementById("designerContextBlock");
    elements.gameStatsPanel = document.getElementById("gameStatsPanel");
    elements.gameLogPanel = document.getElementById("gameLogPanel");
    elements.gameStepHud = document.getElementById("gameStepHud");
    elements.gameStepPlayName = document.getElementById("gameStepPlayName");
    elements.gameStepIndex = document.getElementById("gameStepIndex");
    elements.gameStepTimer = document.getElementById("gameStepTimer");
    elements.gameStepAuto = document.getElementById("gameStepAuto");
    elements.gameStepPlayPause = document.getElementById("gameStepPlayPause");
    elements.gameStepPrev = document.getElementById("gameStepPrev");
    elements.gameStepNext = document.getElementById("gameStepNext");
    elements.gameStepStop = document.getElementById("gameStepStop");
  }

  function setActiveTab(tab) {
    if (!elements.hud) {
      return;
    }
    const allowedTabs = ["profile", "game", "designer", "settings"];
    const nextTab = allowedTabs.includes(tab) ? tab : "profile";
    elements.hud.dataset.activeTab = nextTab;
    elements.tabButtons.forEach((button) => {
      const isActive = button.dataset.tabButton === nextTab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    if (nextTab !== "designer" && designerState.previewRunner) {
      ui.stopDesignerPreview?.({ silent: true });
    }
    gameState.active = nextTab === "game";
    if (!gameState.active) {
      if (gameState.play.menuOpen) {
        ui.toggleGamePlayMenu?.(false);
      }
      gameState.input.up = false;
      gameState.input.down = false;
      gameState.input.left = false;
      gameState.input.right = false;
      gameState.input.sprint = false;
      gameState.actionsLocked.shot = false;
      gameState.actionsLocked.pass = false;
      gameState.actionsLocked.play = false;
      if (nextTab === "designer") {
        ui.renderDesignerCourt?.();
      }
      syncMobileLayout();
      return;
    }
    gameState.lastFrame = performance.now();
    if (!gameState.user) {
      ui.resetGamePossession?.(true);
    }
    ui.updateGameStats?.();
    ui.renderGameLog?.();
    syncMobileLayout();
  }

  function init() {
    cacheElements();
    ui.syncSettingsPanel?.();
    ui.applyAdvancedModeSetting?.();
    courtState.canvas = elements.courtCanvas;
    courtState.ctx = elements.courtCanvas ? elements.courtCanvas.getContext("2d") : null;
    designerState.canvas = elements.designerCourt;
    designerState.ctx = elements.designerCourt ? elements.designerCourt.getContext("2d") : null;
    designerState.plays = ui.loadDesignerPlays?.() || [];
    if (designerState.plays.length) {
      ui.setDesignerPlay?.(designerState.plays[0]);
    } else {
      const starter = ui.createDesignerPlay?.("New Play 1");
      if (starter) {
        designerState.plays = [starter];
        ui.saveDesignerPlays?.(designerState.plays);
        ui.setDesignerPlay?.(starter);
      }
    }
    ui.setDesignerTool?.("edit");
    ui.setDesignerPlaceTarget?.("offense");
    ui.renderCarousel?.();
    ui.renderRatings?.();
    ui.populatePlaySelect?.();
    ui.clearPlayState?.();
    ui.bindEvents?.();
    ui.setActive?.(0, false);
    ui.syncDefenderMode?.();
    ui.syncDefenderValues?.();
    if (sim) {
      ui.renderSimLog?.(sim.getLog());
    }
    ui.drawCourt?.();
    ui.initGameMode?.();
    ui.applyGhostSetting?.();
    setActiveTab("profile");
    updateMobileMode();
    window.addEventListener("resize", updateMobileMode);
  }

  Object.assign(ui, {
    init,
    setActiveTab,
    toggleMobilePanel,
    closeMobilePanels,
    syncMobileLayout,
    updateMobileMode
  });
})();
