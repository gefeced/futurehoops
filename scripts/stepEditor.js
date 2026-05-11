window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.stepEditor = (() => {
  const { calc } = window.FutureHoops;
  const clamp = (value, min, max) => {
    if (calc?.clamp) {
      return calc.clamp(value, min, max);
    }
    return Math.min(Math.max(value, min), max);
  };
  const generateId = (prefix) => {
    const safePrefix = typeof prefix === "string" && prefix.trim() ? prefix.trim() : "id";
    return `${safePrefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  const DEFAULT_DURATION = 2.0;

  function resolveStepIndex(play, stepId) {
    if (!play?.steps?.length) {
      return 0;
    }
    if (!stepId) {
      return 0;
    }
    const index = play.steps.findIndex((step) => step.id === stepId);
    return index >= 0 ? index : 0;
  }

  function getStep(play, stepId) {
    if (!play?.steps?.length) {
      return null;
    }
    return play.steps[resolveStepIndex(play, stepId)] || null;
  }

  function isDefaultStepName(name) {
    return typeof name === "string" && /^Step\s+\d+$/.test(name.trim());
  }

  function renumberSteps(play) {
    if (!play?.steps?.length) {
      return;
    }
    play.steps.forEach((step, index) => {
      const nextIndex = index + 1;
      step.index = nextIndex;
      if (!step.name || isDefaultStepName(step.name)) {
        step.name = `Step ${nextIndex}`;
      }
    });
  }

  function buildSnapshotFromPlayers(play) {
    const players = {};
    if (Array.isArray(play?.players)) {
      play.players.forEach((player) => {
        if (!player?.id) {
          return;
        }
        players[player.id] = {
          x: clamp(Number(player.x ?? 0.5), 0.02, 0.98),
          y: clamp(Number(player.y ?? 0.7), 0.02, 0.98)
        };
      });
    }

    const start = play?.ball?.start;
    const attachedTo =
      typeof start?.attachedTo === "string" ? start.attachedTo : play?.ball?.holderPid;
    let ballX = Number(start?.x ?? play?.ball?.x ?? 0.5);
    let ballY = Number(start?.y ?? play?.ball?.y ?? 0.7);
    if (attachedTo && players[attachedTo]) {
      ballX = players[attachedTo].x;
      ballY = players[attachedTo].y;
    }

    return {
      players,
      ball: {
        x: clamp(ballX, 0.02, 0.98),
        y: clamp(ballY, 0.02, 0.98),
        holderPid: attachedTo || null
      }
    };
  }

  function createStep(snapshot) {
    return {
      id: generateId("step"),
      index: 1,
      name: "Step 1",
      durationSec: DEFAULT_DURATION,
      endMode: "HYBRID",
      allowParallel: true,
      ghostPreviewMode: "PREV_ONLY",
      snapshots: snapshot || null,
      actions: []
    };
  }

  function ensureStepArray(play) {
    if (!play) {
      return;
    }
    if (!Array.isArray(play.steps) || !play.steps.length) {
      play.steps = [createStep(buildSnapshotFromPlayers(play))];
    }
  }

  // Snapshot computation for the editor:
  // - Start from the previous step snapshot.
  // - Apply MOVE_ROUTE actions to land players at their final points.
  // - If PASS actions exist, ball holder becomes the last receiver in the step.
  function computeSnapshotForStep(play, stepIndex) {
    if (!play?.steps?.length || stepIndex <= 0) {
      return buildSnapshotFromPlayers(play);
    }

    const previousStep = play.steps[stepIndex - 1];
    const previousSnapshot =
      previousStep?.snapshots && typeof previousStep.snapshots === "object"
        ? previousStep.snapshots
        : buildSnapshotFromPlayers(play);

    const players = {};
    const basePlayers = previousSnapshot.players || {};
    Object.keys(basePlayers).forEach((pid) => {
      players[pid] = {
        x: clamp(Number(basePlayers[pid]?.x ?? 0.5), 0.02, 0.98),
        y: clamp(Number(basePlayers[pid]?.y ?? 0.7), 0.02, 0.98)
      };
    });

    if (Array.isArray(play.players)) {
      play.players.forEach((player) => {
        if (!player?.id || players[player.id]) {
          return;
        }
        players[player.id] = {
          x: clamp(Number(player.x ?? 0.5), 0.02, 0.98),
          y: clamp(Number(player.y ?? 0.7), 0.02, 0.98)
        };
      });
    }

    const actions = Array.isArray(previousStep?.actions) ? previousStep.actions : [];
    actions.forEach((action) => {
      if (action?.type !== "MOVE_ROUTE" || typeof action?.pid !== "string") {
        return;
      }
      if (!Array.isArray(action.points) || action.points.length < 1) {
        return;
      }
      const lastPoint = action.points[action.points.length - 1];
      if (!Number.isFinite(lastPoint?.x) || !Number.isFinite(lastPoint?.y)) {
        return;
      }
      players[action.pid] = {
        x: clamp(Number(lastPoint.x), 0.02, 0.98),
        y: clamp(Number(lastPoint.y), 0.02, 0.98)
      };
    });

    let holderPid =
      typeof previousSnapshot.ball?.holderPid === "string" ? previousSnapshot.ball.holderPid : null;
    let ballX = Number(previousSnapshot.ball?.x ?? 0.5);
    let ballY = Number(previousSnapshot.ball?.y ?? 0.7);

    const passActions = actions
      .filter((action) => action?.type === "PASS" && typeof action?.toPid === "string")
      .sort((a, b) => (b.passAtSec ?? 0) - (a.passAtSec ?? 0));
    if (passActions.length) {
      holderPid = passActions[0].toPid;
    }
    if (holderPid && players[holderPid]) {
      ballX = players[holderPid].x;
      ballY = players[holderPid].y;
    }

    if (holderPid && !players[holderPid]) {
      holderPid = null;
    }

    return {
      players,
      ball: {
        x: clamp(ballX, 0.02, 0.98),
        y: clamp(ballY, 0.02, 0.98),
        holderPid
      }
    };
  }

  function ensureStepSnapshots(play, stepIndex) {
    ensureStepArray(play);
    if (!play?.steps?.length) {
      return null;
    }
    const safeIndex = Math.max(0, Math.min(stepIndex, play.steps.length - 1));
    if (safeIndex > 0) {
      ensureStepSnapshots(play, safeIndex - 1);
    }
    const step = play.steps[safeIndex];
    if (!step.snapshots || typeof step.snapshots !== "object") {
      step.snapshots = computeSnapshotForStep(play, safeIndex);
      return step;
    }

    const computed = computeSnapshotForStep(play, safeIndex);
    if (!step.snapshots.players || typeof step.snapshots.players !== "object") {
      step.snapshots.players = {};
    }
    Object.keys(computed.players).forEach((pid) => {
      if (!step.snapshots.players[pid]) {
        step.snapshots.players[pid] = computed.players[pid];
      }
    });
    if (!step.snapshots.ball || typeof step.snapshots.ball !== "object") {
      step.snapshots.ball = computed.ball;
    } else {
      if (!Number.isFinite(step.snapshots.ball.x)) {
        step.snapshots.ball.x = computed.ball.x;
      }
      if (!Number.isFinite(step.snapshots.ball.y)) {
        step.snapshots.ball.y = computed.ball.y;
      }
      if (
        typeof step.snapshots.ball.holderPid !== "string" &&
        computed.ball.holderPid
      ) {
        step.snapshots.ball.holderPid = computed.ball.holderPid;
      }
    }
    return step;
  }

  function applyStepToView(play, stepIndex) {
    ensureStepArray(play);
    const step = ensureStepSnapshots(play, stepIndex);
    if (!step) {
      return null;
    }
    if (!Array.isArray(play.players)) {
      play.players = [];
    }
    const snapshots = step.snapshots || buildSnapshotFromPlayers(play);
    const playersById = new Map();
    play.players.forEach((player) => {
      if (!player?.id) {
        return;
      }
      const snap = snapshots.players?.[player.id];
      if (snap) {
        player.x = clamp(Number(snap.x), 0.02, 0.98);
        player.y = clamp(Number(snap.y), 0.02, 0.98);
      }
      playersById.set(player.id, player);
    });

    const routeActions = Array.isArray(step.actions)
      ? step.actions.filter((action) => action?.type === "MOVE_ROUTE")
      : [];
    play.players.forEach((player) => {
      const action = routeActions.find((entry) => entry.pid === player.id);
      if (!action || !Array.isArray(action.points)) {
        player.movementPath = [];
        return;
      }
      const points = action.points
        .map((point) => ({
          x: clamp(Number(point?.x ?? player.x), 0.02, 0.98),
          y: clamp(Number(point?.y ?? player.y), 0.02, 0.98)
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (!points.length) {
        player.movementPath = [];
        return;
      }
      const start = { x: player.x, y: player.y };
      const first = points[0];
      if (Math.hypot(first.x - start.x, first.y - start.y) > 0.001) {
        points.unshift(start);
      }
      player.movementPath = points;
    });

    const passActions = Array.isArray(step.actions)
      ? step.actions.filter((action) => action?.type === "PASS")
      : [];
    if (!play.ball) {
      play.ball = {};
    }
    play.ball.passes = passActions.map((action) => ({
      from: action.fromPid,
      to: action.toPid,
      speed: 1,
      arc: 0.35,
      time: clamp(Number(action.passAtSec ?? 0.5), 0, 30)
    }));

    const holderPid =
      typeof snapshots.ball?.holderPid === "string" ? snapshots.ball.holderPid : null;
    const ballX = Number(snapshots.ball?.x ?? 0.5);
    const ballY = Number(snapshots.ball?.y ?? 0.7);
    play.ball.x = clamp(ballX, 0.02, 0.98);
    play.ball.y = clamp(ballY, 0.02, 0.98);
    play.ball.holderPid = holderPid;
    play.ball.start = {
      x: play.ball.x,
      y: play.ball.y,
      attachedTo: holderPid
    };

    if (holderPid && playersById.has(holderPid)) {
      const holder = playersById.get(holderPid);
      play.ball.start.x = holder.x;
      play.ball.start.y = holder.y;
    }

    return step;
  }

  function updateSnapshotFromView(play, stepIndex) {
    const step = ensureStepSnapshots(play, stepIndex);
    if (!step) {
      return null;
    }
    if (!step.snapshots.players || typeof step.snapshots.players !== "object") {
      step.snapshots.players = {};
    }
    if (Array.isArray(play?.players)) {
      play.players.forEach((player) => {
        if (!player?.id) {
          return;
        }
        step.snapshots.players[player.id] = {
          x: clamp(Number(player.x ?? 0.5), 0.02, 0.98),
          y: clamp(Number(player.y ?? 0.7), 0.02, 0.98)
        };
      });
    }

    if (!step.snapshots.ball || typeof step.snapshots.ball !== "object") {
      step.snapshots.ball = {};
    }
    const ballState = play?.ball || {};
    let holderPid =
      typeof ballState.holderPid === "string"
        ? ballState.holderPid
        : typeof ballState.start?.attachedTo === "string"
          ? ballState.start.attachedTo
          : null;
    let ballX = Number(
      Number.isFinite(ballState.x) ? ballState.x : ballState.start?.x ?? 0.5
    );
    let ballY = Number(
      Number.isFinite(ballState.y) ? ballState.y : ballState.start?.y ?? 0.7
    );
    if (holderPid && step.snapshots.players[holderPid]) {
      ballX = step.snapshots.players[holderPid].x;
      ballY = step.snapshots.players[holderPid].y;
    }
    ballX = clamp(ballX, 0.02, 0.98);
    ballY = clamp(ballY, 0.02, 0.98);
    step.snapshots.ball.x = ballX;
    step.snapshots.ball.y = ballY;
    step.snapshots.ball.holderPid = holderPid;

    if (play?.ball) {
      play.ball.x = ballX;
      play.ball.y = ballY;
      play.ball.holderPid = holderPid;
      if (!play.ball.start || typeof play.ball.start !== "object") {
        play.ball.start = { x: ballX, y: ballY, attachedTo: holderPid };
      } else {
        play.ball.start.x = ballX;
        play.ball.start.y = ballY;
        play.ball.start.attachedTo = holderPid;
      }
    }

    return step;
  }

  function ensureActions(step) {
    if (!Array.isArray(step.actions)) {
      step.actions = [];
    }
  }

  function upsertRouteAction(step, pid, points) {
    if (!step || !pid) {
      return null;
    }
    ensureActions(step);
    if (!Array.isArray(points) || points.length < 2) {
      return null;
    }
    let action = step.actions.find(
      (entry) => entry.type === "MOVE_ROUTE" && entry.pid === pid
    );
    if (!action) {
      action = {
        id: generateId("action"),
        type: "MOVE_ROUTE",
        pid,
        points: [],
        speedMode: "DEFAULT",
        startAtSec: 0
      };
      step.actions.push(action);
    }
    action.points = points
      .map((point) => ({
        x: clamp(Number(point?.x ?? 0.5), 0.02, 0.98),
        y: clamp(Number(point?.y ?? 0.7), 0.02, 0.98)
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    return action;
  }

  function removeRouteAction(step, pidOrId) {
    if (!step || !Array.isArray(step.actions)) {
      return;
    }
    step.actions = step.actions.filter((action) => {
      if (action?.type !== "MOVE_ROUTE") {
        return true;
      }
      if (action.id === pidOrId || action.pid === pidOrId) {
        return false;
      }
      return true;
    });
  }

  function addPassAction(step, fromPid, toPid, passAtSec) {
    if (!step || !fromPid || !toPid) {
      return null;
    }
    ensureActions(step);
    const action = {
      id: generateId("action"),
      type: "PASS",
      fromPid,
      toPid,
      passAtSec: clamp(Number(passAtSec ?? 0.5), 0, 30),
      travelMode: "REALISTIC"
    };
    step.actions.push(action);
    return action;
  }

  function updatePassAction(step, actionId, passAtSec) {
    if (!step || !actionId) {
      return null;
    }
    const action = step.actions?.find((entry) => entry.id === actionId);
    if (!action || action.type !== "PASS") {
      return null;
    }
    action.passAtSec = clamp(Number(passAtSec ?? action.passAtSec ?? 0.5), 0, 30);
    return action;
  }

  function removeAction(step, actionId) {
    if (!step || !Array.isArray(step.actions)) {
      return;
    }
    step.actions = step.actions.filter((action) => action.id !== actionId);
  }

  function hasScreenTag(step, pid) {
    if (!step?.actions?.length || !pid) {
      return false;
    }
    return step.actions.some(
      (action) => action?.type === "SCREEN_TAG" && action.pid === pid && action.active
    );
  }

  function toggleScreenTag(step, pid, active) {
    if (!step || !pid) {
      return null;
    }
    ensureActions(step);
    const existing = step.actions.find(
      (action) => action?.type === "SCREEN_TAG" && action.pid === pid
    );
    if (!active) {
      if (existing) {
        step.actions = step.actions.filter((action) => action !== existing);
      }
      return null;
    }
    if (existing) {
      existing.active = true;
      return existing;
    }
    const action = {
      id: generateId("action"),
      type: "SCREEN_TAG",
      pid,
      active: true,
      startAtSec: 0,
      endAtSec: null
    };
    step.actions.push(action);
    return action;
  }

  function addStep(play, afterStepId) {
    ensureStepArray(play);
    if (!play?.steps?.length) {
      return null;
    }
    const insertIndex = resolveStepIndex(play, afterStepId) + 1;
    const snapshot = computeSnapshotForStep(play, insertIndex);
    const step = createStep(snapshot);
    play.steps.splice(insertIndex, 0, step);
    renumberSteps(play);
    return step;
  }

  function deleteStep(play, stepId) {
    if (!play?.steps?.length || play.steps.length <= 1) {
      return play?.steps?.[0]?.id || null;
    }
    const index = resolveStepIndex(play, stepId);
    play.steps.splice(index, 1);
    renumberSteps(play);
    const nextIndex = Math.max(0, Math.min(index, play.steps.length - 1));
    return play.steps[nextIndex]?.id || play.steps[0]?.id || null;
  }

  function moveStep(play, stepId, direction) {
    if (!play?.steps?.length || !direction) {
      return stepId;
    }
    const index = resolveStepIndex(play, stepId);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= play.steps.length) {
      return stepId;
    }
    const [step] = play.steps.splice(index, 1);
    play.steps.splice(nextIndex, 0, step);
    renumberSteps(play);
    return step.id;
  }

  function addPlayerToSnapshots(play, player) {
    if (!play?.steps?.length || !player?.id) {
      return;
    }
    play.steps.forEach((step) => {
      if (!step.snapshots || typeof step.snapshots !== "object") {
        return;
      }
      if (!step.snapshots.players || typeof step.snapshots.players !== "object") {
        step.snapshots.players = {};
      }
      step.snapshots.players[player.id] = {
        x: clamp(Number(player.x ?? 0.5), 0.02, 0.98),
        y: clamp(Number(player.y ?? 0.7), 0.02, 0.98)
      };
    });
  }

  function removePlayerFromSteps(play, pid) {
    if (!play?.steps?.length || !pid) {
      return;
    }
    play.steps.forEach((step) => {
      if (step.snapshots?.players?.[pid]) {
        delete step.snapshots.players[pid];
      }
      if (step.snapshots?.ball?.holderPid === pid) {
        step.snapshots.ball.holderPid = null;
      }
      if (!Array.isArray(step.actions)) {
        return;
      }
      step.actions = step.actions.filter((action) => {
        if (!action) {
          return false;
        }
        if (action.type === "MOVE_ROUTE" || action.type === "SCREEN_TAG") {
          return action.pid !== pid;
        }
        if (action.type === "PASS") {
          return action.fromPid !== pid && action.toPid !== pid;
        }
        return true;
      });
    });
  }

  return {
    resolveStepIndex,
    getStep,
    renumberSteps,
    ensureStepArray,
    ensureStepSnapshots,
    computeSnapshotForStep,
    applyStepToView,
    updateSnapshotFromView,
    upsertRouteAction,
    removeRouteAction,
    addPassAction,
    updatePassAction,
    removeAction,
    hasScreenTag,
    toggleScreenTag,
    addStep,
    deleteStep,
    moveStep,
    addPlayerToSnapshots,
    removePlayerFromSteps
  };
})();
