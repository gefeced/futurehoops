window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiState = (() => {
  const elements = {};
  const courtState = {
    canvas: null,
    ctx: null,
    markers: [],
    playRoutes: [],
    playTargets: null,
    playAnimationStart: null,
    playAnimationDuration: 900,
    manualPath: [],
    drawMode: false,
    drawing: false,
    animating: false
  };
  const playState = {
    active: null
  };
  const designerState = {
    canvas: null,
    ctx: null,
    mode: "edit",
    placeTarget: "offense",
    selectedObject: null,
    selectedStepId: null,
    previewRunner: null,
    previewFrame: null,
    previewLastFrame: 0,
    previewStepIndex: null,
    previewRestoreStepId: null,
    previewScreenSet: new Set(),
    routeFade: null,
    dragging: false,
    dragOffset: { x: 0, y: 0 },
    dragStart: null,
    dragMoved: false,
    pointerDownSameSelection: false,
    drawing: false,
    annotationDraft: null,
    annotationMode: { type: "straight", color: "#ffffff" },
    annotationsByStep: {},
    passFrom: null,
    autosaveTimer: null,
    play: null,
    plays: [],
    status: "Ready to draw."
  };
  const gameConfig = {
    shotClock: 24,
    maxLog: 12,
    sprintDrain: 6,
    playExpireMs: 12000
  };
  const gameSpacingSpots = [
    { x: 0.18, y: 0.28 },
    { x: 0.82, y: 0.28 },
    { x: 0.22, y: 0.62 },
    { x: 0.78, y: 0.62 }
  ];
  const gameTeammateNames = ["Vector", "Circuit", "Delta", "Ion"];
  const gameState = {
    canvas: null,
    ctx: null,
    active: false,
    paused: false,
    lastFrame: null,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      sprint: false
    },
    actionsLocked: {
      shot: false,
      pass: false,
      play: false
    },
    user: null,
    offense: [],
    teammates: [],
    defenders: [],
    control: {
      side: "offense",
      pid: null,
      entity: null,
      contestUntil: 0,
      stealCooldownUntil: 0
    },
    mode: "offense",
    ghost: {
      enabled: false,
      current: {},
      last: {},
      lastSampleAt: 0
    },
    ball: {
      x: 0,
      y: 0,
      carrier: null,
      holderPid: null,
      pass: null,
      holdUntil: 0
    },
    possession: {
      id: 0,
      shotClock: 24,
      resetAt: null
    },
    log: [],
    play: {
      active: null,
      routes: [],
      targets: null,
      phase: "idle",
      menuOpen: false,
      expiresAt: 0,
      designer: null,
      runner: null
    }
  };
  const mobile = {
    leftOpen: false,
    rightOpen: false,
    warningDismissed: false
  };

  return {
    elements,
    courtState,
    playState,
    designerState,
    gameConfig,
    gameSpacingSpots,
    gameTeammateNames,
    gameState,
    mobile,
    gameModeUnlocked: false,
    isMobile: false,
    activeIndex: 0,
    fatigueTimer: null
  };
})();
