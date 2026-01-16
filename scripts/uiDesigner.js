window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiDesigner = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements, designerState } = state;
  const { data, calc, stepEditor, stepRender, stepRunner } = window.FutureHoops;
  const settingsApi = window.FutureHoops.settings;
  const stepRunnerDefaults = stepRunner || {};
  const designerStorageKey = "futurehoops.playDesigner.v1";
  const annotationStorageKey = "futurehoops.playDesigner.annotations.v1";

  function generateId(prefix) {
    const safePrefix =
      typeof prefix === "string" && prefix.trim() ? prefix.trim() : "id";
    return `${safePrefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function normalizeLegacyPlayers(players) {
    if (!Array.isArray(players)) {
      return [];
    }
    return players.map((player, index) => {
      const team = player?.team === "defense" ? "defense" : "offense";
      const x = calc.clamp(Number(player?.x ?? 0.5), 0.05, 0.95);
      const y = calc.clamp(Number(player?.y ?? 0.7), 0.05, 0.95);
      const movementPath = Array.isArray(player?.movementPath)
        ? player.movementPath
            .map((point) => ({
              x: calc.clamp(Number(point?.x ?? x), 0.02, 0.98),
              y: calc.clamp(Number(point?.y ?? y), 0.02, 0.98)
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [];
      const behavior = team === "defense" && player?.behavior === "ai" ? "ai" : "route";
      const id =
        typeof player?.id === "string"
          ? player.id
          : typeof player?.pid === "string"
            ? player.pid
            : `player-${Date.now()}-${index}`;
      return {
        id,
        label: typeof player?.label === "string" ? player.label : null,
        team,
        x,
        y,
        movementPath,
        behavior
      };
    });
  }

  function buildLegacyPlayersFromV2(play) {
    const legacyPlayers = [];
    const offensePlayers = Array.isArray(play?.offensePlayers) ? play.offensePlayers : [];
    const defensePlayers = Array.isArray(play?.defensePlayers) ? play.defensePlayers : [];
    const routeMap = new Map();
    const firstStep = Array.isArray(play?.steps) ? play.steps[0] : null;

    if (firstStep && Array.isArray(firstStep.actions)) {
      firstStep.actions.forEach((action) => {
        if (action?.type !== "MOVE_ROUTE" || typeof action?.pid !== "string") {
          return;
        }
        const points = Array.isArray(action?.points)
          ? action.points
              .map((point) => ({
                x: calc.clamp(Number(point?.x ?? 0.5), 0.02, 0.98),
                y: calc.clamp(Number(point?.y ?? 0.7), 0.02, 0.98)
              }))
              .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
          : [];
        if (points.length) {
          routeMap.set(action.pid, points);
        }
      });
    }

    const buildLegacyPlayer = (player, index, team) => {
      const pid =
        typeof player?.pid === "string"
          ? player.pid
          : typeof player?.id === "string"
            ? player.id
            : `player-${Date.now()}-${index}`;
      return {
        id: pid,
        label: typeof player?.label === "string" ? player.label : null,
        team,
        x: calc.clamp(Number(player?.x ?? 0.5), 0.05, 0.95),
        y: calc.clamp(Number(player?.y ?? 0.7), 0.05, 0.95),
        movementPath: routeMap.get(pid) || [],
        behavior: team === "defense" && player?.behavior === "ai" ? "ai" : "route"
      };
    };

    offensePlayers.forEach((player, index) => {
      legacyPlayers.push(buildLegacyPlayer(player, index, "offense"));
    });
    defensePlayers.forEach((player, index) => {
      legacyPlayers.push(buildLegacyPlayer(player, index, "defense"));
    });
    return legacyPlayers;
  }

  function buildPlayersById(players) {
    const map = new Map();
    players.forEach((player) => {
      if (player?.id) {
        map.set(player.id, player);
      }
    });
    return map;
  }

  function normalizeLegacyPasses(passes) {
    if (!Array.isArray(passes)) {
      return [];
    }
    return passes
      .map((pass, index) => {
        const speed = Number(pass?.speed ?? 1);
        const arc = Number(pass?.arc ?? 0.35);
        const time = Number(pass?.time ?? index * 1.4);
        return {
          from: typeof pass?.from === "string" ? pass.from : "",
          to: typeof pass?.to === "string" ? pass.to : "",
          speed: calc.clamp(Number.isFinite(speed) ? speed : 1, 0.4, 3),
          arc: calc.clamp(Number.isFinite(arc) ? arc : 0.35, 0, 1),
          time: calc.clamp(Number.isFinite(time) ? time : 0, 0, 30)
        };
      })
      .filter((pass) => pass.from && pass.to);
  }

  function buildLegacyPassesFromSteps(steps) {
    if (!Array.isArray(steps)) {
      return [];
    }
    const passes = [];
    steps.forEach((step) => {
      if (!Array.isArray(step?.actions)) {
        return;
      }
      step.actions.forEach((action) => {
        if (action?.type !== "PASS") {
          return;
        }
        if (typeof action?.fromPid !== "string" || typeof action?.toPid !== "string") {
          return;
        }
        const passAt = Number.isFinite(action?.passAtSec) ? action.passAtSec : 0.5;
        passes.push({
          from: action.fromPid,
          to: action.toPid,
          speed: 1,
          arc: 0.35,
          time: calc.clamp(passAt, 0, 30)
        });
      });
    });
    return passes;
  }

  function normalizeLegacyBall(ball, steps, playersById) {
    const snapshotBall = Array.isArray(steps)
      ? steps.find((step) => step?.snapshots?.ball)?.snapshots.ball
      : null;
    const fallbackX = Number.isFinite(ball?.x)
      ? ball.x
      : Number.isFinite(snapshotBall?.x)
        ? snapshotBall.x
        : 0.5;
    const fallbackY = Number.isFinite(ball?.y)
      ? ball.y
      : Number.isFinite(snapshotBall?.y)
        ? snapshotBall.y
        : 0.7;
    const fallbackHolder =
      typeof ball?.holderPid === "string"
        ? ball.holderPid
        : typeof snapshotBall?.holderPid === "string"
          ? snapshotBall.holderPid
          : null;

    const start = ball?.start;
    const safeStart = {
      x: calc.clamp(Number(start?.x ?? fallbackX), 0.02, 0.98),
      y: calc.clamp(Number(start?.y ?? fallbackY), 0.02, 0.98),
      attachedTo:
        typeof start?.attachedTo === "string" ? start.attachedTo : fallbackHolder
    };
    if (safeStart.attachedTo && !playersById.has(safeStart.attachedTo)) {
      safeStart.attachedTo = null;
    }

    let passes = normalizeLegacyPasses(ball?.passes);
    if (!passes.length) {
      passes = buildLegacyPassesFromSteps(steps);
    }

    let preferredHolder =
      typeof ball?.holderPid === "string" ? ball.holderPid : safeStart.attachedTo;
    if (preferredHolder && !playersById.has(preferredHolder)) {
      preferredHolder = safeStart.attachedTo;
    }
    const holder = preferredHolder && playersById.has(preferredHolder)
      ? playersById.get(preferredHolder)
      : null;
    let x = Number.isFinite(ball?.x) ? Number(ball.x) : safeStart.x;
    let y = Number.isFinite(ball?.y) ? Number(ball.y) : safeStart.y;
    if (holder) {
      x = holder.x;
      y = holder.y;
    }
    x = calc.clamp(x, 0.02, 0.98);
    y = calc.clamp(y, 0.02, 0.98);
    const holderPid = holder ? preferredHolder : null;
    if (holderPid) {
      safeStart.attachedTo = holderPid;
    }

    return {
      x,
      y,
      holderPid,
      start: safeStart,
      passes
    };
  }

  function buildSnapshot(playersById, ballState) {
    const players = {};
    playersById.forEach((player, pid) => {
      players[pid] = { x: player.x, y: player.y };
    });
    return {
      players,
      ball: {
        x: ballState.x,
        y: ballState.y,
        holderPid: ballState.holderPid ?? null
      }
    };
  }

  function normalizeStepSnapshots(snapshots, playersById, ballState) {
    const players = {};
    if (snapshots?.players && typeof snapshots.players === "object") {
      Object.entries(snapshots.players).forEach(([pid, point]) => {
        const x = Number(point?.x);
        const y = Number(point?.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          players[pid] = {
            x: calc.clamp(x, 0.02, 0.98),
            y: calc.clamp(y, 0.02, 0.98)
          };
        }
      });
    }
    playersById.forEach((player, pid) => {
      if (!players[pid]) {
        players[pid] = { x: player.x, y: player.y };
      }
    });

    const ballSnap = snapshots?.ball;
    let x = Number(ballSnap?.x);
    let y = Number(ballSnap?.y);
    let holderPid =
      typeof ballSnap?.holderPid === "string" ? ballSnap.holderPid : ballState.holderPid;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      x = ballState.x;
      y = ballState.y;
    }
    if (holderPid && !playersById.has(holderPid)) {
      holderPid = null;
    }

    return {
      players,
      ball: {
        x: calc.clamp(x, 0.02, 0.98),
        y: calc.clamp(y, 0.02, 0.98),
        holderPid
      }
    };
  }

  function buildStepActionsFromLegacy(play) {
    const actions = [];
    if (Array.isArray(play?.players)) {
      play.players.forEach((player) => {
        if (!player?.movementPath || player.movementPath.length < 2) {
          return;
        }
        const points = player.movementPath
          .map((point) => ({
            x: calc.clamp(Number(point?.x ?? player.x), 0.02, 0.98),
            y: calc.clamp(Number(point?.y ?? player.y), 0.02, 0.98)
          }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
        if (points.length < 2 || typeof player?.id !== "string") {
          return;
        }
        actions.push({
          id: generateId("action"),
          type: "MOVE_ROUTE",
          pid: player.id,
          points,
          speedMode: "DEFAULT",
          startAtSec: 0
        });
      });
    }

    if (Array.isArray(play?.ball?.passes)) {
      play.ball.passes.forEach((pass) => {
        if (typeof pass?.from !== "string" || typeof pass?.to !== "string") {
          return;
        }
        const passAt = Number.isFinite(pass?.time) ? pass.time : 0.5;
        actions.push({
          id: generateId("action"),
          type: "PASS",
          fromPid: pass.from,
          toPid: pass.to,
          passAtSec: calc.clamp(passAt, 0, 30),
          travelMode: "REALISTIC"
        });
      });
    }
    return actions;
  }

  function buildStepFromLegacy(play, playersById, ballState, existingStep) {
    return {
      id: existingStep?.id || generateId("step"),
      index: 1,
      name:
        typeof existingStep?.name === "string" && existingStep.name.trim()
          ? existingStep.name.trim()
          : "Step 1",
      durationSec: Number.isFinite(existingStep?.durationSec) ? existingStep.durationSec : 2.0,
      endMode: "HYBRID",
      allowParallel:
        typeof existingStep?.allowParallel === "boolean" ? existingStep.allowParallel : true,
      ghostPreviewMode: "PREV_ONLY",
      snapshots: buildSnapshot(playersById, ballState),
      actions: buildStepActionsFromLegacy(play)
    };
  }

  // Migration rules: wrap legacy routes/passes into Step 1 actions, seed snapshots
  // from current positions, and default durationSec=2.0 with HYBRID endMode.
  function migratePlayToV2(oldPlay) {
    const source = oldPlay && typeof oldPlay === "object" ? oldPlay : {};
    const now = Date.now();
    const legacyPlayers = normalizeLegacyPlayers(source.players);
    const playersById = buildPlayersById(legacyPlayers);
    const ball = normalizeLegacyBall(source.ball, source.steps, playersById);
    const ballState = { x: ball.x, y: ball.y, holderPid: ball.holderPid };
    const step = buildStepFromLegacy(
      { ...source, players: legacyPlayers, ball },
      playersById,
      ballState,
      source.steps?.[0]
    );

    const offensePlayers = legacyPlayers
      .filter((player) => player.team === "offense")
      .map((player) => ({
        pid: player.id,
        x: player.x,
        y: player.y
      }));
    const defensePlayers = legacyPlayers
      .filter((player) => player.team === "defense")
      .map((player) => ({
        pid: player.id,
        x: player.x,
        y: player.y
      }));

    return {
      id: typeof source.id === "string" ? source.id : `play-${Date.now()}`,
      name:
        typeof source.name === "string" && source.name.trim()
          ? source.name.trim()
          : "Untitled Play",
      tags: Array.isArray(source.tags) ? source.tags.filter(Boolean).map(String) : [],
      notes: typeof source.notes === "string" ? source.notes : "",
      schemaVersion: 2,
      courtMeta:
        source.courtMeta && typeof source.courtMeta === "object" ? source.courtMeta : undefined,
      offensePlayers,
      defensePlayers: defensePlayers.length ? defensePlayers : undefined,
      ball,
      players: legacyPlayers,
      steps: [step],
      createdAt: Number.isFinite(source.createdAt) ? source.createdAt : now,
      updatedAt: Number.isFinite(source.updatedAt)
        ? source.updatedAt
        : Number.isFinite(source.createdAt)
          ? source.createdAt
          : now
    };
  }

  function buildTeamPlayers(legacyPlayers, offenseSeed, defenseSeed) {
    const normalizeSeed = (players, team) => {
      if (!Array.isArray(players) || !players.length) {
        return legacyPlayers
          .filter((player) => player.team === team)
          .map((player) => ({
            pid: player.id,
            x: player.x,
            y: player.y
          }));
      }
      return players.map((player, index) => {
        const pid =
          typeof player?.pid === "string"
            ? player.pid
            : typeof player?.id === "string"
              ? player.id
              : `player-${Date.now()}-${index}`;
        const fallback =
          legacyPlayers.find((entry) => entry.id === pid) ||
          legacyPlayers.filter((entry) => entry.team === team)[index];
        return {
          pid,
          x: calc.clamp(Number(player?.x ?? fallback?.x ?? 0.5), 0.05, 0.95),
          y: calc.clamp(Number(player?.y ?? fallback?.y ?? 0.7), 0.05, 0.95)
        };
      });
    };

    return {
      offensePlayers: normalizeSeed(offenseSeed, "offense"),
      defensePlayers: normalizeSeed(defenseSeed, "defense")
    };
  }

  function normalizeSteps(steps, playersById, ballState, teamPlayers) {
    if (!Array.isArray(steps)) {
      return [];
    }
    const offensePidSet = new Set(
      teamPlayers.offensePlayers.map((player) => player.pid)
    );
    const defensePidSet = new Set(
      teamPlayers.defensePlayers.map((player) => player.pid)
    );
    const hasDefense = defensePidSet.size > 0;

    return steps
      .map((step, index) => {
        const stepIndex = Number.isFinite(step?.index) ? step.index : index + 1;
        const name =
          typeof step?.name === "string" && step.name.trim()
            ? step.name.trim()
            : `Step ${stepIndex}`;
        const durationSec = Number.isFinite(step?.durationSec) ? step.durationSec : 2.0;
        const allowParallel =
          typeof step?.allowParallel === "boolean" ? step.allowParallel : true;
        const snapshots = normalizeStepSnapshots(step?.snapshots, playersById, ballState);
        const actions = Array.isArray(step?.actions)
          ? step.actions
              .map((action) => {
                if (!action || typeof action !== "object") {
                  return null;
                }
                if (action.type === "MOVE_ROUTE") {
                  const pid = typeof action.pid === "string" ? action.pid : null;
                  if (!pid || !playersById.has(pid)) {
                    return null;
                  }
                  if (!hasDefense && !offensePidSet.has(pid)) {
                    return null;
                  }
                  const points = Array.isArray(action.points)
                    ? action.points
                        .map((point) => ({
                          x: calc.clamp(Number(point?.x ?? 0.5), 0.02, 0.98),
                          y: calc.clamp(Number(point?.y ?? 0.7), 0.02, 0.98)
                        }))
                        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
                    : [];
                  if (points.length < 2) {
                    return null;
                  }
                  return {
                    id: typeof action.id === "string" ? action.id : generateId("action"),
                    type: "MOVE_ROUTE",
                    pid,
                    points,
                    speedMode: "DEFAULT",
                    startAtSec: Number.isFinite(action.startAtSec) ? action.startAtSec : 0
                  };
                }
                if (action.type === "PASS") {
                  const fromPid = typeof action.fromPid === "string" ? action.fromPid : null;
                  const toPid = typeof action.toPid === "string" ? action.toPid : null;
                  if (!fromPid || !toPid) {
                    return null;
                  }
                  if (!playersById.has(fromPid) || !playersById.has(toPid)) {
                    return null;
                  }
                  if (!hasDefense) {
                    if (!offensePidSet.has(fromPid) || !offensePidSet.has(toPid)) {
                      return null;
                    }
                  }
                  const passAt =
                    Number.isFinite(action.passAtSec) ? action.passAtSec : 0.5;
                  return {
                    id: typeof action.id === "string" ? action.id : generateId("action"),
                    type: "PASS",
                    fromPid,
                    toPid,
                    passAtSec: calc.clamp(passAt, 0, 30),
                    travelMode: "REALISTIC"
                  };
                }
                if (action.type === "SCREEN_TAG") {
                  const pid = typeof action.pid === "string" ? action.pid : null;
                  if (!pid || !playersById.has(pid)) {
                    return null;
                  }
                  if (!hasDefense && !offensePidSet.has(pid)) {
                    return null;
                  }
                  return {
                    id: typeof action.id === "string" ? action.id : generateId("action"),
                    type: "SCREEN_TAG",
                    pid,
                    active: typeof action.active === "boolean" ? action.active : true,
                    startAtSec: Number.isFinite(action.startAtSec) ? action.startAtSec : 0,
                    endAtSec: Number.isFinite(action.endAtSec) ? action.endAtSec : null
                  };
                }
                return null;
              })
              .filter(Boolean)
          : [];

        return {
          id: typeof step?.id === "string" ? step.id : generateId("step"),
          index: stepIndex,
          name,
          durationSec,
          endMode: "HYBRID",
          allowParallel,
          ghostPreviewMode: "PREV_ONLY",
          snapshots,
          actions
        };
      })
      .filter(Boolean);
  }

  function normalizePlay(play) {
    const base =
      play && typeof play === "object" && play.schemaVersion === 2
        ? { ...play }
        : migratePlayToV2(play);
    const now = Date.now();
    const id = typeof base.id === "string" ? base.id : `play-${Date.now()}`;
    const name =
      typeof base.name === "string" && base.name.trim() ? base.name.trim() : "Untitled Play";
    const tags = Array.isArray(base.tags) ? base.tags.filter(Boolean).map(String) : [];
    const notes = typeof base.notes === "string" ? base.notes : "";
    const createdAt = Number.isFinite(base.createdAt) ? base.createdAt : now;
    const updatedAt = Number.isFinite(base.updatedAt) ? base.updatedAt : createdAt;

    const legacyPlayers = normalizeLegacyPlayers(
      Array.isArray(base.players) ? base.players : buildLegacyPlayersFromV2(base)
    );
    const playersById = buildPlayersById(legacyPlayers);
    const ball = normalizeLegacyBall(base.ball, base.steps, playersById);
    const ballState = { x: ball.x, y: ball.y, holderPid: ball.holderPid };

    const teamPlayers = buildTeamPlayers(
      legacyPlayers,
      base.offensePlayers,
      base.defensePlayers
    );
    if (data?.ensureRosterConsistency) {
      const requiredPlayers = [];
      teamPlayers.offensePlayers.forEach((player) => {
        requiredPlayers.push({ pid: player.pid, team: "offense" });
      });
      teamPlayers.defensePlayers.forEach((player) => {
        requiredPlayers.push({ pid: player.pid, team: "defense" });
      });
      if (requiredPlayers.length) {
        data.ensureRosterConsistency(requiredPlayers);
        data.saveRoster?.();
      }
    }
    let steps = normalizeSteps(base.steps, playersById, ballState, teamPlayers);
    if (!steps.length) {
      steps = [buildStepFromLegacy({ ...base, players: legacyPlayers, ball }, playersById, ballState)];
    }

    return {
      ...base,
      id,
      name,
      tags,
      notes,
      schemaVersion: 2,
      courtMeta:
        base.courtMeta && typeof base.courtMeta === "object" ? base.courtMeta : undefined,
      offensePlayers: teamPlayers.offensePlayers,
      defensePlayers: teamPlayers.defensePlayers.length ? teamPlayers.defensePlayers : undefined,
      ball,
      players: legacyPlayers,
      steps,
      createdAt,
      updatedAt
    };
  }

  function syncDesignerPlaySteps(play) {
    if (!play) {
      return play;
    }
    const legacyPlayers = Array.isArray(play.players) ? play.players : [];
    const playersById = buildPlayersById(legacyPlayers);
    const ball = normalizeLegacyBall(play.ball, play.steps, playersById);
    const ballState = { x: ball.x, y: ball.y, holderPid: ball.holderPid };

    let steps = Array.isArray(play.steps) ? play.steps : [];
    if (!steps.length || steps.length === 1) {
      steps = [
        buildStepFromLegacy(
          { ...play, players: legacyPlayers, ball },
          playersById,
          ballState,
          steps[0]
        )
      ];
    }

    return {
      ...play,
      ball,
      steps
    };
  }

  function createDesignerPlay(name) {
    const nextName = name?.trim() || "Untitled Play";
    const now = Date.now();
    return normalizePlay({
      id: `play-${now}`,
      name: nextName,
      tags: [],
      notes: "",
      schemaVersion: 2,
      players: [],
      ball: {
        x: 0.5,
        y: 0.7,
        holderPid: null,
        start: { x: 0.5, y: 0.7, attachedTo: null },
        passes: []
      },
      createdAt: now,
      updatedAt: now
    });
  }

  function normalizeDesignerPlay(play) {
    return normalizePlay(play);
  }

  function loadDesignerPlays() {
    try {
      const raw = window.localStorage.getItem(designerStorageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((play) => normalizePlay(play));
    } catch (error) {
      return [];
    }
  }

  function saveDesignerPlays(playsList) {
    try {
      const payload = Array.isArray(playsList)
        ? playsList.map((play) => preparePlayForStorage(play))
        : [];
      window.localStorage.setItem(designerStorageKey, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function loadAnnotationStore() {
    try {
      const raw = window.localStorage.getItem(annotationStorageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error) {
      // Ignore storage failures.
    }
    return {};
  }

  function saveAnnotationStore(store) {
    try {
      window.localStorage.setItem(annotationStorageKey, JSON.stringify(store));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function normalizeAnnotation(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const id = typeof raw.id === "string" ? raw.id : generateId("annot");
    const type = raw.type === "squiggle" ? "squiggle" : "straight";
    const color = typeof raw.color === "string" ? raw.color : "#ffffff";
    const points = Array.isArray(raw.points) ? raw.points : [];
    const cleanPoints = points
      .map((point) => ({
        x: calc.clamp(Number(point?.x ?? 0.5), 0, 1),
        y: calc.clamp(Number(point?.y ?? 0.5), 0, 1)
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (cleanPoints.length < 2) {
      return null;
    }
    return { id, type, color, points: cleanPoints };
  }

  function loadDesignerAnnotations(playId, steps = []) {
    if (!playId) {
      return {};
    }
    const store = loadAnnotationStore();
    const raw = store && typeof store === "object" ? store[playId] : null;
    const stepIds = steps.map((step) => step.id);
    const map = {};
    stepIds.forEach((stepId) => {
      const list = Array.isArray(raw?.[stepId]) ? raw[stepId] : [];
      map[stepId] = list.map(normalizeAnnotation).filter(Boolean);
    });
    return map;
  }

  function saveDesignerAnnotations(playId, annotationsByStep) {
    if (!playId) {
      return;
    }
    const store = loadAnnotationStore();
    store[playId] = annotationsByStep || {};
    saveAnnotationStore(store);
  }

  function getAnnotationsForStep(stepId) {
    if (!stepId) {
      return [];
    }
    if (!designerState.annotationsByStep) {
      designerState.annotationsByStep = {};
    }
    if (!Array.isArray(designerState.annotationsByStep[stepId])) {
      designerState.annotationsByStep[stepId] = [];
    }
    return designerState.annotationsByStep[stepId];
  }

  function setAnnotationsForStep(stepId, list) {
    if (!stepId) {
      return;
    }
    if (!designerState.annotationsByStep) {
      designerState.annotationsByStep = {};
    }
    designerState.annotationsByStep[stepId] = Array.isArray(list) ? list : [];
    saveDesignerAnnotations(designerState.play?.id, designerState.annotationsByStep);
  }

  function addAnnotationToStep(stepId, annotation) {
    const list = getAnnotationsForStep(stepId);
    list.push(annotation);
    setAnnotationsForStep(stepId, list);
  }

  function removeAnnotationFromStep(stepId, annotationId) {
    if (!stepId || !annotationId) {
      return;
    }
    const list = getAnnotationsForStep(stepId).filter((item) => item.id !== annotationId);
    setAnnotationsForStep(stepId, list);
  }

  function clearAnnotationsForStep(stepId) {
    setAnnotationsForStep(stepId, []);
  }

  function removeAnnotationsForPlay(playId) {
    if (!playId) {
      return;
    }
    const store = loadAnnotationStore();
    if (store && typeof store === "object") {
      delete store[playId];
      saveAnnotationStore(store);
    }
  }

  function preparePlayForStorage(play) {
    if (!play) {
      return play;
    }
    const clone = JSON.parse(JSON.stringify(play));
    if (stepEditor?.ensureStepArray && stepEditor?.applyStepToView) {
      stepEditor.ensureStepArray(clone);
      stepEditor.applyStepToView(clone, 0);
    }
    if (Array.isArray(clone.players)) {
      clone.players.forEach((player) => {
        if (player && Object.prototype.hasOwnProperty.call(player, "labelEnabled")) {
          delete player.labelEnabled;
        }
      });
      const offensePlayers = clone.players.filter((player) => player.team === "offense");
      const defensePlayers = clone.players.filter((player) => player.team === "defense");
      clone.offensePlayers = offensePlayers.map((player) => ({
        pid: player.id,
        x: player.x,
        y: player.y
      }));
      clone.defensePlayers = defensePlayers.length
        ? defensePlayers.map((player) => ({
            pid: player.id,
            x: player.x,
            y: player.y
          }))
        : undefined;
    }
    return clone;
  }

  function persistDesignerPlay({ silent = false } = {}) {
    if (!designerState.play) {
      return;
    }
    syncDesignerInputs();
    const now = Date.now();
    designerState.play.createdAt =
      Number.isFinite(designerState.play.createdAt) ? designerState.play.createdAt : now;
    designerState.play.updatedAt = now;
    const existingIndex = designerState.plays.findIndex(
      (play) => play.id === designerState.play.id
    );
    if (existingIndex >= 0) {
      designerState.plays[existingIndex] = designerState.play;
    } else {
      designerState.plays.push(designerState.play);
    }
    saveDesignerPlays(designerState.plays);
    renderDesignerPlaybook();
    ui.populateGamePlaySelect?.();
    if (!silent) {
      setDesignerStatus("Play saved.");
    }
  }

  function queueDesignerSave() {
    if (designerState.autosaveTimer) {
      clearTimeout(designerState.autosaveTimer);
    }
    designerState.autosaveTimer = setTimeout(() => {
      designerState.autosaveTimer = null;
    persistDesignerPlay({ silent: true });
    }, 400);
  }

  function setDesignerStatus(message) {
    designerState.status = message;
    if (elements.designerStatus) {
      elements.designerStatus.textContent = message;
    }
  }

  function getCurrentStepIndex() {
    if (!designerState.play?.steps?.length) {
      return 0;
    }
    return stepEditor?.resolveStepIndex
      ? stepEditor.resolveStepIndex(designerState.play, designerState.selectedStepId)
      : 0;
  }

  function getCurrentStep() {
    if (!designerState.play?.steps?.length) {
      return null;
    }
    return designerState.play.steps[getCurrentStepIndex()] || null;
  }

  function setCurrentStep(stepId) {
    if (!designerState.play?.steps?.length) {
      return;
    }
    const index = stepEditor?.resolveStepIndex
      ? stepEditor.resolveStepIndex(designerState.play, stepId)
      : 0;
    const step = designerState.play.steps[index];
    if (!step) {
      return;
    }
    designerState.selectedStepId = step.id;
    designerState.passFrom = null;
    designerState.drawing = false;
    designerState.dragging = false;
    designerState.annotationDraft = null;
    if (stepEditor?.applyStepToView) {
      stepEditor.applyStepToView(designerState.play, index);
    }
    setDesignerSelection(null);
    renderDesignerStepList();
    renderDesignerStepSettings();
    renderDesignerPlayerList();
    renderDesignerContext();
    renderDesignerCourt();
  }

  function getDesignerPlayerLabel(playerId) {
    if (!designerState.play?.players?.length) {
      return "Player";
    }
    const player = designerState.play.players.find((item) => item.id === playerId);
    if (!player) {
      return "Player";
    }
    const rosterPlayer = data?.getPlayerById ? data.getPlayerById(playerId) : null;
    if (rosterPlayer) {
      const prefix = rosterPlayer.team === "defense" ? "D" : "O";
      const number = Number.isInteger(rosterPlayer.number) ? rosterPlayer.number : null;
      const name = rosterPlayer.name || "Player";
      return number ? `${prefix}${number} ${name}` : `${prefix} ${name}`;
    }
    const group = designerState.play.players.filter((item) => item.team === player.team);
    const index = group.findIndex((item) => item.id === playerId);
    const prefix = player.team === "defense" ? "Defense" : "Offense";
    return `${prefix} ${index + 1}`;
  }

  function renderDesignerStepList() {
    if (!elements.designerStepList || !designerState.play?.steps?.length) {
      return;
    }
    elements.designerStepList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    designerState.play.steps.forEach((step) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `step-item${step.id === designerState.selectedStepId ? " is-active" : ""}`;
      const isDefault =
        typeof step.name === "string" && step.name.trim() === `Step ${step.index}`;
      const indexSpan = document.createElement("span");
      indexSpan.className = "step-item-index";
      indexSpan.textContent = `Step ${step.index}`;
      item.appendChild(indexSpan);
      if (!isDefault) {
        const nameSpan = document.createElement("span");
        nameSpan.className = "step-item-name";
        nameSpan.textContent = step.name;
        item.appendChild(nameSpan);
      }
      item.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        setCurrentStep(step.id);
      });
      fragment.appendChild(item);
    });
    elements.designerStepList.appendChild(fragment);

    const onlyOne = designerState.play.steps.length <= 1;
    if (elements.designerDeleteStep) {
      elements.designerDeleteStep.disabled = onlyOne;
    }
    if (elements.designerStepUp) {
      elements.designerStepUp.disabled = onlyOne || getCurrentStepIndex() === 0;
    }
    if (elements.designerStepDown) {
      elements.designerStepDown.disabled =
        onlyOne || getCurrentStepIndex() === designerState.play.steps.length - 1;
    }
  }

  function renderDesignerStepSettings() {
    const step = getCurrentStep();
    if (!step) {
      return;
    }
    if (elements.designerStepName) {
      elements.designerStepName.value = step.name || `Step ${step.index}`;
    }
    if (elements.designerStepDuration) {
      elements.designerStepDuration.value = Number(step.durationSec ?? 2).toFixed(1);
    }
    if (elements.designerStepParallel) {
      elements.designerStepParallel.checked = Boolean(step.allowParallel);
    }
    if (elements.designerGhostToggle) {
      elements.designerGhostToggle.checked = step.ghostPreviewMode === "PREV_ONLY";
    }
  }

  function renderDesignerContext() {
    if (!elements.designerContext) {
      renderDesignerMiddlePanel();
      return;
    }
    const selection = designerState.selectedObject;
    const step = getCurrentStep();
    const panels = Array.from(elements.designerContext.querySelectorAll(".context-panel"));
    panels.forEach((panel) => panel.classList.remove("is-active"));
    const empty = elements.designerContext.querySelector("[data-context-empty]");
    if (!selection || !step) {
      if (empty) {
        empty.style.display = "block";
      }
      renderDesignerMiddlePanel();
      return;
    }
    if (empty) {
      empty.style.display = "none";
    }
    const panel = elements.designerContext.querySelector(
      `.context-panel[data-context="${selection.type}"]`
    );
    if (panel) {
      panel.classList.add("is-active");
    }

    if (selection.type === "player" && elements.designerContextPlayerLabel) {
      elements.designerContextPlayerLabel.textContent = getDesignerPlayerLabel(selection.id);
      const player = designerState.play?.players?.find((item) => item.id === selection.id);
      const labelValue = typeof player?.label === "string" ? player.label : "";
      const labelEnabled =
        typeof player?.labelEnabled === "boolean" ? player.labelEnabled : Boolean(labelValue);
      if (player && typeof player.labelEnabled !== "boolean") {
        player.labelEnabled = labelEnabled;
      }
      if (elements.designerScreenToggle) {
        elements.designerScreenToggle.checked = stepEditor?.hasScreenTag
          ? stepEditor.hasScreenTag(step, selection.id)
          : false;
      }
      if (elements.designerTagInput) {
        elements.designerTagInput.value = labelValue;
      }
      if (elements.designerTagToggle) {
        elements.designerTagToggle.checked = labelEnabled;
      }
    }
    if (selection.type === "route" && elements.designerContextRouteLabel) {
      const action = step.actions?.find((entry) => entry.id === selection.id);
      const label = action?.pid ? `${getDesignerPlayerLabel(action.pid)} Route` : "Route";
      elements.designerContextRouteLabel.textContent = label;
    }
    if (selection.type === "pass" && elements.designerContextPassLabel) {
      const action = step.actions?.find((entry) => entry.id === selection.id);
      const label = action
        ? `${getDesignerPlayerLabel(action.fromPid)} -> ${getDesignerPlayerLabel(action.toPid)}`
        : "Pass";
      elements.designerContextPassLabel.textContent = label;
      const duration = Number(step.durationSec ?? 2);
      if (elements.designerPassSlider) {
        elements.designerPassSlider.max = String(duration);
      }
      if (elements.designerPassTime) {
        elements.designerPassTime.max = String(duration);
      }
      const passAt = Number(action?.passAtSec ?? 0.5);
      const clampedPassAt = calc.clamp(passAt, 0, duration);
      if (action) {
        action.passAtSec = clampedPassAt;
      }
      if (elements.designerPassTime) {
        elements.designerPassTime.value = clampedPassAt.toFixed(1);
      }
      if (elements.designerPassSlider) {
        elements.designerPassSlider.value = String(clampedPassAt);
      }
    }
    if (selection.type === "ball" && elements.designerBallHolder) {
      renderDesignerBallHolder();
    }
    renderDesignerMiddlePanel();
  }

  function setDesignerSelection(type, id) {
    if (!type) {
      designerState.selectedObject = null;
    } else {
      designerState.selectedObject = { type, id };
    }
    renderDesignerContext();
  }

  function renderDesignerMiddlePanel() {
    if (!elements.designerMiddlePanel) {
      return;
    }
    const selection = designerState.selectedObject;
    const step = getCurrentStep();
    let mode = "preview";
    if (selection?.type === "player") {
      mode = "player";
    } else if (selection?.type === "route") {
      mode = "route";
    } else if (selection?.type === "pass") {
      mode = "pass";
    }
    const panels = Array.from(
      elements.designerMiddlePanel.querySelectorAll("[data-designer-middle]")
    );
    panels.forEach((panel) => {
      const isActive = panel.dataset.designerMiddle === mode;
      panel.classList.toggle("is-active", isActive);
    });

    if (elements.designerMidPlayName) {
      elements.designerMidPlayName.textContent = designerState.play?.name || "Play Preview";
    }
    const stepCount = designerState.play?.steps?.length ?? 0;
    let stepLabel = "Step -- / --";
    if (designerState.previewRunner) {
      const status = designerState.previewRunner.getStatus();
      stepLabel = `Step ${status.stepIndex + 1} / ${status.stepCount}`;
      if (elements.designerMidPreviewPause) {
        elements.designerMidPreviewPause.textContent = status.isPaused ? "Resume" : "Pause";
        elements.designerMidPreviewPause.disabled = false;
      }
      if (elements.designerMidPreviewPlay) {
        elements.designerMidPreviewPlay.disabled = !status.isPaused;
      }
      if (elements.designerMidPreviewStop) {
        elements.designerMidPreviewStop.disabled = false;
      }
    } else if (stepCount && step) {
      stepLabel = `Step ${getCurrentStepIndex() + 1} / ${stepCount}`;
      if (elements.designerMidPreviewPause) {
        elements.designerMidPreviewPause.textContent = "Pause";
        elements.designerMidPreviewPause.disabled = true;
      }
      if (elements.designerMidPreviewPlay) {
        elements.designerMidPreviewPlay.disabled = false;
      }
      if (elements.designerMidPreviewStop) {
        elements.designerMidPreviewStop.disabled = true;
      }
    } else {
      if (elements.designerMidPreviewPause) {
        elements.designerMidPreviewPause.textContent = "Pause";
        elements.designerMidPreviewPause.disabled = true;
      }
      if (elements.designerMidPreviewPlay) {
        elements.designerMidPreviewPlay.disabled = !designerState.play;
      }
      if (elements.designerMidPreviewStop) {
        elements.designerMidPreviewStop.disabled = true;
      }
    }
    if (elements.designerMidStep) {
      elements.designerMidStep.textContent = stepLabel;
    }

    if (mode === "player" && selection?.id) {
      const rosterPlayer = data?.getPlayerById ? data.getPlayerById(selection.id) : null;
      const name = rosterPlayer?.name || getDesignerPlayerLabel(selection.id);
      const number = Number.isInteger(rosterPlayer?.number) ? `#${rosterPlayer.number}` : "#--";
      const position = rosterPlayer?.position || "--";
      const archetype = rosterPlayer?.archetype || "--";
      if (elements.designerMidPlayerName) {
        elements.designerMidPlayerName.textContent = name;
      }
      if (elements.designerMidPlayerMeta) {
        elements.designerMidPlayerMeta.textContent = `${number} / ${position} / ${archetype}`;
      }
      if (elements.designerMidCoreRatings) {
        elements.designerMidCoreRatings.innerHTML = "";
        const core = rosterPlayer?.coreRatings || {};
        const coreRows = [
          { label: "Shoot", value: core.shooting },
          { label: "Finish", value: core.finishing },
          { label: "Pass", value: core.passing },
          { label: "Defense", value: core.defense },
          { label: "Speed", value: core.speed },
          { label: "Stamina", value: core.stamina }
        ];
        coreRows.forEach((row) => {
          const item = document.createElement("div");
          item.className = "designer-mid-row";
          item.innerHTML = `<span>${row.label}</span><span>${Number(row.value ?? 0)}</span>`;
          elements.designerMidCoreRatings.appendChild(item);
        });
      }
      if (elements.designerMidConfidence) {
        elements.designerMidConfidence.innerHTML = "";
        const conf = rosterPlayer?.confidenceMatrix || rosterPlayer?.confidence || {};
        const confRows = [
          { label: "Shoot", value: conf.shooting },
          { label: "Finish", value: conf.finishing },
          { label: "Pass", value: conf.passing },
          { label: "Defense", value: conf.defense }
        ];
        confRows.forEach((row) => {
          const item = document.createElement("div");
          item.className = "designer-mid-row";
          item.innerHTML = `<span>${row.label}</span><span>${Number(row.value ?? 0)}</span>`;
          elements.designerMidConfidence.appendChild(item);
        });
      }
    }

    if (mode === "route" && selection?.id && elements.designerMidRouteLabel) {
      const action = step?.actions?.find((entry) => entry.id === selection.id);
      const label = action?.pid ? `${getDesignerPlayerLabel(action.pid)} Route` : "Route";
      elements.designerMidRouteLabel.textContent = label;
    }

    if (mode === "pass" && selection?.id && elements.designerMidPassLabel) {
      const action = step?.actions?.find((entry) => entry.id === selection.id);
      const label = action
        ? `${getDesignerPlayerLabel(action.fromPid)} -> ${getDesignerPlayerLabel(action.toPid)}`
        : "Pass";
      elements.designerMidPassLabel.textContent = label;
      const duration = Number(step?.durationSec ?? 2);
      if (elements.designerMidPassSlider) {
        elements.designerMidPassSlider.max = String(duration);
      }
      if (elements.designerMidPassTime) {
        elements.designerMidPassTime.max = String(duration);
      }
      const passAt = Number(action?.passAtSec ?? 0.5);
      const clampedPassAt = calc.clamp(passAt, 0, duration);
      if (action) {
        action.passAtSec = clampedPassAt;
      }
      if (elements.designerMidPassTime) {
        elements.designerMidPassTime.value = clampedPassAt.toFixed(1);
      }
      if (elements.designerMidPassSlider) {
        elements.designerMidPassSlider.value = String(clampedPassAt);
      }
    }
  }

  function renderDesignerPreviewHud() {
    if (!elements.designerPreviewControls || !designerState.previewRunner) {
      return;
    }
    const status = designerState.previewRunner.getStatus();
    if (elements.designerPreviewStep) {
      elements.designerPreviewStep.textContent = `Step ${status.stepIndex + 1} / ${status.stepCount}`;
    }
    if (elements.designerPreviewTimer) {
      elements.designerPreviewTimer.textContent = `${status.elapsed.toFixed(1)} / ${status.duration.toFixed(1)}s`;
    }
    if (elements.designerPreviewPause) {
      elements.designerPreviewPause.textContent = status.isPaused ? "Play" : "Pause";
    }
    renderDesignerMiddlePanel();
  }

  function applyRunnerStateToDesigner(state) {
    if (!designerState.play || !state) {
      return;
    }
    state.players.forEach((playerState) => {
      const player = designerState.play.players.find(
        (item) => item.id === playerState.pid
      );
      if (!player) {
        return;
      }
      player.x = playerState.x;
      player.y = playerState.y;
    });
    if (state.ball) {
      setDesignerBallState({
        x: state.ball.x,
        y: state.ball.y,
        holderPid: state.ball.holderPid
      });
    }
    designerState.previewScreenSet = state.screenSet || new Set();
    renderDesignerCourt();
    renderDesignerPreviewHud();
  }

  function tickDesignerPreview(timestamp) {
    if (!designerState.previewRunner) {
      return;
    }
    const delta = Math.min((timestamp - designerState.previewLastFrame) / 1000, 0.05);
    designerState.previewLastFrame = timestamp;
    designerState.previewRunner.tick(delta);
    designerState.previewFrame = requestAnimationFrame(tickDesignerPreview);
  }

  function startDesignerPreview() {
    if (!designerState.play || !stepRunner?.StepRunner) {
      setDesignerStatus("Preview unavailable.");
      return;
    }
    stopDesignerPreview({ silent: true });
    designerState.previewRestoreStepId = designerState.selectedStepId;
    if (designerState.play.steps?.length) {
      designerState.selectedStepId = designerState.play.steps[0].id;
      renderDesignerStepList();
      renderDesignerStepSettings();
    }
    designerState.previewStepIndex = designerState.play.steps?.length ? 0 : null;
    designerState.routeFade = null;
    const runner = new stepRunner.StepRunner(designerState.play, {
      mode: "AUTO",
      context: {
        passSpeed: stepRunnerDefaults.passSpeed,
        defaultStepDuration: stepRunnerDefaults.defaultStepDuration
      },
      onUpdate: (state) => {
        applyRunnerStateToDesigner(state);
      },
      onStepChange: ({ step, index }) => {
        if (step?.id) {
          designerState.selectedStepId = step.id;
        }
        const previousIndex = designerState.previewStepIndex;
        if (
          stepRender?.buildRouteLines &&
          Number.isFinite(previousIndex) &&
          Number.isFinite(index) &&
          previousIndex !== index &&
          designerState.play?.players?.length
        ) {
          const playersById = new Map();
          designerState.play.players.forEach((player) => {
            playersById.set(player.id, player);
          });
          const fromStep = designerState.play.steps?.[previousIndex] || null;
          const fromRoutes = fromStep
            ? stepRender.buildRouteLines(fromStep, playersById)
            : [];
          const toRoutes = step ? stepRender.buildRouteLines(step, playersById) : [];
          designerState.routeFade = {
            fromRoutes,
            toRoutes,
            startAt: performance.now(),
            duration: 220
          };
        }
        if (Number.isFinite(index)) {
          designerState.previewStepIndex = index;
        }
        renderDesignerStepList();
        renderDesignerStepSettings();
        renderDesignerPreviewHud();
      },
      onFinish: () => {
        stopDesignerPreview({ fromRunner: true });
      }
    });
    designerState.previewRunner = runner;
    designerState.previewLastFrame = performance.now();
    if (elements.designerPreviewControls) {
      elements.designerPreviewControls.setAttribute("aria-hidden", "false");
    }
    renderDesignerPreviewHud();
    designerState.previewFrame = requestAnimationFrame(tickDesignerPreview);
    setDesignerStatus("Preview running.");
  }

  function stopDesignerPreview({ fromRunner = false, silent = false } = {}) {
    if (!designerState.previewRunner) {
      return;
    }
    if (!fromRunner) {
      designerState.previewRunner.stop("stopped");
    }
    if (designerState.previewFrame) {
      cancelAnimationFrame(designerState.previewFrame);
      designerState.previewFrame = null;
    }
    designerState.previewRunner = null;
    designerState.previewStepIndex = null;
    designerState.previewScreenSet = new Set();
    designerState.routeFade = null;
    if (elements.designerPreviewControls) {
      elements.designerPreviewControls.setAttribute("aria-hidden", "true");
    }
    const restoreId = designerState.previewRestoreStepId;
    designerState.previewRestoreStepId = null;
    if (restoreId) {
      setCurrentStep(restoreId);
    } else if (designerState.play?.steps?.length) {
      setCurrentStep(designerState.play.steps[0].id);
    }
    if (!silent) {
      setDesignerStatus("Preview stopped.");
    }
    renderDesignerMiddlePanel();
  }

  function toggleDesignerPreviewPause() {
    if (!designerState.previewRunner) {
      return;
    }
    designerState.previewRunner.togglePause();
    renderDesignerPreviewHud();
  }

  function setDesignerPlay(play) {
    if (designerState.previewRunner) {
      stopDesignerPreview({ silent: true });
    }
    designerState.play = normalizeDesignerPlay(play);
    designerState.annotationsByStep = loadDesignerAnnotations(
      designerState.play?.id,
      designerState.play?.steps || []
    );
    designerState.annotationDraft = null;
    if (stepEditor?.renumberSteps) {
      stepEditor.renumberSteps(designerState.play);
    }
    if (elements.designerPlayName) {
      elements.designerPlayName.value = designerState.play.name;
    }
    if (elements.designerPlayTags) {
      elements.designerPlayTags.value = designerState.play.tags.join(", ");
    }
    if (elements.designerPlayNotes) {
      elements.designerPlayNotes.value = designerState.play.notes;
    }
    designerState.selectedStepId = designerState.play.steps?.[0]?.id || null;
    if (designerState.selectedStepId) {
      setCurrentStep(designerState.selectedStepId);
    } else {
      setDesignerSelection(null);
      renderDesignerCourt();
    }
    renderDesignerPlaybook();
    syncAnnotationTypeButtons();
    syncAnnotationPalette();
    setDesignerStatus("Play loaded.");
  }

  function renderDesignerPlaybook() {
    if (!elements.designerPlaySelect) {
      return;
    }
    elements.designerPlaySelect.innerHTML = "";
    designerState.plays.forEach((play) => {
      const option = document.createElement("option");
      option.value = play.id;
      option.textContent = play.name;
      elements.designerPlaySelect.appendChild(option);
    });
    if (designerState.play) {
      elements.designerPlaySelect.value = designerState.play.id;
    }
    renderDesignerStepList();
    renderDesignerStepSettings();
    renderDesignerPlayerList();
    renderDesignerContext();
  }

  function renderDesignerPlayerList() {
    if (!elements.designerPlayerList || !designerState.play) {
      return;
    }
    elements.designerPlayerList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const offensePlayers = designerState.play.players.filter((player) => player.team === "offense");
    const defensePlayers = designerState.play.players.filter((player) => player.team === "defense");

    const buildRow = (player, index) => {
      const row = document.createElement("div");
      row.className = "play-player-row";
      const label = document.createElement("button");
      label.type = "button";
      label.className = "sim-btn";
      const teamLabel = player.team === "defense" ? "D" : "O";
      const rosterPlayer = data?.getPlayerById ? data.getPlayerById(player.id) : null;
      const rosterNumber = Number.isInteger(rosterPlayer?.number)
        ? rosterPlayer.number
        : index + 1;
      const rosterName = rosterPlayer?.name || player.team;
      label.textContent = `${teamLabel}${rosterNumber} | ${rosterName}`;
      label.addEventListener("click", () => {
        setDesignerSelection("player", player.id);
        renderDesignerCourt();
      });
      row.appendChild(label);

      if (player.team === "defense") {
        const select = document.createElement("select");
        select.className = "play-select";
        select.innerHTML = `
          <option value="route">Route</option>
          <option value="ai">AI</option>
        `;
        select.value = player.behavior === "ai" ? "ai" : "route";
        select.addEventListener("change", () => {
          player.behavior = select.value === "ai" ? "ai" : "route";
          setDesignerStatus("Defender behavior updated.");
          queueDesignerSave();
        });
        row.appendChild(select);
      } else {
        const note = document.createElement("span");
        const holderPid =
          typeof designerState.play.ball?.holderPid === "string"
            ? designerState.play.ball.holderPid
            : designerState.play.ball?.start?.attachedTo;
        note.textContent = holderPid === player.id ? "Ball Holder" : "Offense";
        row.appendChild(note);
      }

      fragment.appendChild(row);
    };

    offensePlayers.forEach((player, index) => buildRow(player, index));
    defensePlayers.forEach((player, index) => buildRow(player, index));
    elements.designerPlayerList.appendChild(fragment);
    renderDesignerBallHolder();
  }

  function renderDesignerBallHolder() {
    if (!elements.designerBallHolder || !designerState.play) {
      return;
    }
    elements.designerBallHolder.innerHTML = "";
    const freeOption = document.createElement("option");
    freeOption.value = "";
    freeOption.textContent = "Free Ball";
    elements.designerBallHolder.appendChild(freeOption);
    designerState.play.players
      .filter((player) => player.team === "offense")
      .forEach((player, index) => {
        const option = document.createElement("option");
        option.value = player.id;
        const rosterPlayer = data?.getPlayerById ? data.getPlayerById(player.id) : null;
        const rosterNumber = Number.isInteger(rosterPlayer?.number)
          ? rosterPlayer.number
          : index + 1;
        const rosterName = rosterPlayer?.name || `Offense ${rosterNumber}`;
        option.textContent = `O${rosterNumber} | ${rosterName}`;
        elements.designerBallHolder.appendChild(option);
      });
    const holderPid =
      typeof designerState.play.ball?.holderPid === "string"
        ? designerState.play.ball.holderPid
        : designerState.play.ball?.start?.attachedTo;
    elements.designerBallHolder.value = holderPid || "";
  }

  function getDesignerBallPosition() {
    if (!designerState.play?.ball) {
      return null;
    }
    const ball = designerState.play.ball;
    const holderPid =
      typeof ball.holderPid === "string"
        ? ball.holderPid
        : typeof ball.start?.attachedTo === "string"
          ? ball.start.attachedTo
          : null;
    let x = Number.isFinite(ball.x) ? ball.x : Number(ball.start?.x ?? 0.5);
    let y = Number.isFinite(ball.y) ? ball.y : Number(ball.start?.y ?? 0.7);
    const attached = holderPid
      ? designerState.play.players.find((player) => player.id === holderPid)
      : null;
    if (attached) {
      x = attached.x;
      y = attached.y;
    }
    return {
      x: calc.clamp(x, 0.02, 0.98),
      y: calc.clamp(y, 0.02, 0.98),
      holderPid
    };
  }

  function setDesignerBallState({ x, y, holderPid }) {
    if (!designerState.play?.ball) {
      return;
    }
    const ball = designerState.play.ball;
    const nextX = calc.clamp(
      Number.isFinite(x) ? x : Number(ball.x ?? ball.start?.x ?? 0.5),
      0.02,
      0.98
    );
    const nextY = calc.clamp(
      Number.isFinite(y) ? y : Number(ball.y ?? ball.start?.y ?? 0.7),
      0.02,
      0.98
    );
    const nextHolder = typeof holderPid === "string" ? holderPid : null;
    ball.x = nextX;
    ball.y = nextY;
    ball.holderPid = nextHolder;
    if (!ball.start || typeof ball.start !== "object") {
      ball.start = { x: nextX, y: nextY, attachedTo: nextHolder };
    } else {
      ball.start.x = nextX;
      ball.start.y = nextY;
      ball.start.attachedTo = nextHolder;
    }
  }

  function getDesignerMetrics() {
    if (!designerState.canvas) {
      return null;
    }
    const width = designerState.canvas.width;
    const height = designerState.canvas.height;
    const hoopX = width / 2;
    const hoopY = height - 34;
    const arcRadius = width * 0.42;
    const keyWidth = width * 0.26;
    const keyHeight = height * 0.42;
    const layupRadius = arcRadius * 0.26;
    const midRadius = arcRadius * 0.72;
    const padding = 14;
    return {
      width,
      height,
      hoopX,
      hoopY,
      arcRadius,
      keyWidth,
      keyHeight,
      layupRadius,
      midRadius,
      padding
    };
  }

  function toDesignerCanvasPoint(point, metrics) {
    return {
      x: point.x * metrics.width,
      y: point.y * metrics.height
    };
  }

  function toDesignerNormalizedPoint(point, metrics) {
    return {
      x: calc.clamp(point.x / metrics.width, 0.02, 0.98),
      y: calc.clamp(point.y / metrics.height, 0.02, 0.98)
    };
  }

  function getAnnotationPoints(annotation) {
    const points = Array.isArray(annotation?.points) ? annotation.points : [];
    if (points.length < 2) {
      return [];
    }
    if (annotation.type === "straight") {
      return [points[0], points[points.length - 1]];
    }
    return points;
  }

  function drawSmoothPath(ctx, points) {
    if (points.length < 2) {
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }
    for (let i = 1; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      const mid = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
      ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function drawArrowHead(ctx, tip, prev, color, selected) {
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.5) {
      return;
    }
    const angle = Math.atan2(dy, dx);
    const headLength = selected ? 12 : 10;
    const headWidth = selected ? 8 : 7;
    const left = {
      x: tip.x - headLength * Math.cos(angle) + headWidth * Math.sin(angle),
      y: tip.y - headLength * Math.sin(angle) - headWidth * Math.cos(angle)
    };
    const right = {
      x: tip.x - headLength * Math.cos(angle) - headWidth * Math.sin(angle),
      y: tip.y - headLength * Math.sin(angle) + headWidth * Math.cos(angle)
    };
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = selected ? 2.5 : 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.stroke();
  }

  function drawAnnotation(ctx, annotation, metrics, { alpha = 1, selected = false } = {}) {
    const normalizedPoints = getAnnotationPoints(annotation);
    if (normalizedPoints.length < 2) {
      return;
    }
    const points = normalizedPoints.map((point) => toDesignerCanvasPoint(point, metrics));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawSmoothPath(ctx, points);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = selected ? 5 : 4;
    ctx.stroke();
    ctx.strokeStyle = annotation.color || "#ffffff";
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();
    const tip = points[points.length - 1];
    const prev = points[points.length - 2];
    drawArrowHead(ctx, tip, prev, annotation.color || "#ffffff", selected);
    ctx.restore();
  }

  function drawAnnotationsForStep(ctx, stepId, metrics, { alpha = 1, selectedId = null } = {}) {
    const annotations = getAnnotationsForStep(stepId);
    annotations.forEach((annotation) => {
      const isSelected = annotation.id === selectedId;
      drawAnnotation(ctx, annotation, metrics, { alpha, selected: isSelected });
    });
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - a.x, point.y - a.y);
    }
    const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + clamped * dx, y: a.y + clamped * dy };
    return Math.hypot(point.x - proj.x, point.y - proj.y);
  }

  function hitTestAnnotations(point, annotations, threshold) {
    for (let i = 0; i < annotations.length; i += 1) {
      const annotation = annotations[i];
      const points = getAnnotationPoints(annotation);
      for (let j = 0; j < points.length - 1; j += 1) {
        const a = points[j];
        const b = points[j + 1];
        if (distanceToSegment(point, a, b) <= threshold) {
          return annotation;
        }
      }
    }
    return null;
  }

  function drawDesignerCourt() {
    if (!designerState.ctx) {
      return;
    }
    const ctx = designerState.ctx;
    const metrics = getDesignerMetrics();
    if (!metrics) {
      return;
    }
    const {
      width,
      height,
      hoopX,
      hoopY,
      arcRadius,
      keyWidth,
      keyHeight,
      layupRadius,
      midRadius,
      padding
    } = metrics;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(6, 10, 20, 0.9)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(57, 246, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, width - padding * 2, height - padding);
    ctx.strokeRect(hoopX - keyWidth / 2, hoopY - keyHeight, keyWidth, keyHeight);

    ctx.beginPath();
    ctx.arc(hoopX, hoopY, arcRadius, Math.PI * 1.05, Math.PI * -0.05);
    ctx.stroke();

    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(hoopX, hoopY, midRadius, Math.PI * 1.05, Math.PI * -0.05);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(hoopX, hoopY, layupRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(hoopX, hoopY, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hoopX - 24, hoopY - 12);
    ctx.lineTo(hoopX + 24, hoopY - 12);
    ctx.stroke();

    if (designerState.play) {
      const showAdvancedTags = settingsApi?.getSetting
        ? settingsApi.getSetting("advancedMode") === true
        : false;
      const step = getCurrentStep();
      const selection = designerState.selectedObject;
      const playersById = new Map();
      designerState.play.players.forEach((player) => {
        playersById.set(player.id, player);
      });
      const showPlayerNumbers = settingsApi?.getSetting
        ? settingsApi.getSetting("showPlayerNumbers") !== false
        : true;
      const playerNumbers = new Map();
      if (showPlayerNumbers) {
        let offenseNumber = 1;
        let defenseNumber = 1;
        designerState.play.players.forEach((player) => {
          if (player.team === "defense") {
            if (defenseNumber <= 5) {
              playerNumbers.set(player.id, defenseNumber);
            }
            defenseNumber += 1;
          } else {
            if (offenseNumber <= 5) {
              playerNumbers.set(player.id, offenseNumber);
            }
            offenseNumber += 1;
          }
        });
      }

      const allowGhostPreview = settingsApi?.getSetting
        ? settingsApi.getSetting("showDesignerGhosts") !== false
        : true;
      if (allowGhostPreview && step) {
        const currentIndex = getCurrentStepIndex();
        const previousStep =
          currentIndex > 0 ? designerState.play.steps[currentIndex - 1] : null;
        if (previousStep && stepEditor?.ensureStepSnapshots) {
          stepEditor.ensureStepSnapshots(designerState.play, currentIndex - 1);
        }
        if (previousStep) {
          const ghostPlayersById = new Map();
          const snapPlayers = previousStep.snapshots?.players || {};
          designerState.play.players.forEach((player) => {
            const snap = snapPlayers[player.id];
            ghostPlayersById.set(player.id, {
              x: calc.clamp(Number(snap?.x ?? player.x), 0.02, 0.98),
              y: calc.clamp(Number(snap?.y ?? player.y), 0.02, 0.98),
              team: player.team
            });
          });
          const ghostRoutes = stepRender?.buildRouteLines
            ? stepRender.buildRouteLines(previousStep, ghostPlayersById)
            : [];
          ghostRoutes.forEach((route) => {
            const team = ghostPlayersById.get(route.pid)?.team;
            const color =
              team === "defense" ? "rgba(255, 127, 107, 0.25)" : "rgba(57, 246, 255, 0.25)";
            const points = route.points.map((point) =>
              toDesignerCanvasPoint(point, metrics)
            );
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i += 1) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }
      }

      const drawRoutes = (routes, { alpha = 1, allowSelection = true } = {}) => {
        if (!routes?.length) {
          return;
        }
        const previousAlpha = ctx.globalAlpha;
        ctx.globalAlpha = previousAlpha * alpha;
        routes.forEach((route) => {
          const player = playersById.get(route.pid);
          if (!player) {
            return;
          }
          const points = route.points.map((point) =>
            toDesignerCanvasPoint(point, metrics)
          );
          const isSelected =
            allowSelection && selection?.type === "route" && selection.id === route.actionId;
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.strokeStyle = isSelected
            ? "#4cff9a"
            : player.team === "defense"
              ? "rgba(255, 127, 107, 0.7)"
              : "rgba(57, 246, 255, 0.6)";
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        });
        ctx.globalAlpha = previousAlpha;
      };

      if (step) {
        let drewRoutes = false;
        if (designerState.previewRunner && designerState.routeFade) {
          const fade = designerState.routeFade;
          const duration = Number.isFinite(fade.duration) ? fade.duration : 220;
          const elapsed = performance.now() - (fade.startAt || 0);
          if (elapsed < duration) {
            const progress = duration ? elapsed / duration : 1;
            drawRoutes(fade.fromRoutes, { alpha: 1 - progress, allowSelection: false });
            drawRoutes(fade.toRoutes, { alpha: progress, allowSelection: true });
            drewRoutes = true;
          } else {
            designerState.routeFade = null;
          }
        }

        if (!drewRoutes) {
          const routes = stepRender?.buildRouteLines
            ? stepRender.buildRouteLines(step, playersById)
            : [];
          drawRoutes(routes);
        }

        const passes = stepRender?.buildPassLines
          ? stepRender.buildPassLines(step, playersById)
          : [];
        passes.forEach((pass) => {
          const start = toDesignerCanvasPoint(pass.start, metrics);
          const end = toDesignerCanvasPoint(pass.end, metrics);
          const isSelected = selection?.type === "pass" && selection.id === pass.actionId;
          ctx.strokeStyle = isSelected ? "#ffd166" : "rgba(255, 209, 102, 0.7)";
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        });

        const annotationSelectionId =
          selection?.type === "annotation" ? selection.id : null;
        const annotationGhostEnabled =
          settingsApi?.getSetting ? settingsApi.getSetting("showAnnotationGhosts") === true : false;
        if (annotationGhostEnabled) {
          const ghostIndex = getCurrentStepIndex();
          const previousStep =
            ghostIndex > 0 ? designerState.play.steps[ghostIndex - 1] : null;
          if (previousStep) {
            drawAnnotationsForStep(ctx, previousStep.id, metrics, {
              alpha: 0.35,
              selectedId: null
            });
          }
        }
        drawAnnotationsForStep(ctx, step.id, metrics, {
          alpha: 1,
          selectedId: annotationSelectionId
        });
        if (designerState.annotationDraft) {
          drawAnnotation(ctx, designerState.annotationDraft, metrics, { alpha: 0.6 });
        }

        const screenSet = designerState.previewRunner
          ? designerState.previewScreenSet || new Set()
          : stepRender?.buildScreenSet
            ? stepRender.buildScreenSet(step)
            : new Set();

        designerState.play.players.forEach((player) => {
          const pos = toDesignerCanvasPoint(player, metrics);
          ctx.beginPath();
          ctx.fillStyle = player.team === "defense" ? "#ff7f6b" : "#39f6ff";
          ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2);
          ctx.fill();
          if (screenSet.has(player.id)) {
            ctx.beginPath();
            ctx.strokeStyle = "#ff4d4d";
            ctx.lineWidth = 2;
            ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (selection?.type === "player" && selection.id === player.id) {
            ctx.beginPath();
            ctx.strokeStyle = "#4cff9a";
            ctx.lineWidth = 2;
            ctx.arc(pos.x, pos.y, 13, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (showPlayerNumbers && playerNumbers.has(player.id)) {
            ctx.save();
            ctx.font = "bold 10px \"Oxanium\", \"Space Grotesk\", sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillStyle = "#ffffff";
            const number = String(playerNumbers.get(player.id));
            ctx.strokeText(number, pos.x, pos.y);
            ctx.fillText(number, pos.x, pos.y);
            ctx.restore();
          }
          if (showAdvancedTags) {
            const label = typeof player.label === "string" ? player.label.trim() : "";
            const labelEnabled =
              typeof player.labelEnabled === "boolean" ? player.labelEnabled : Boolean(label);
            if (label && labelEnabled) {
              ctx.save();
              ctx.font = "12px \"Oxanium\", \"Space Grotesk\", sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.lineWidth = 2;
              ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
              ctx.fillStyle = "#ffffff";
              ctx.strokeText(label, pos.x, pos.y - 12);
              ctx.fillText(label, pos.x, pos.y - 12);
              ctx.restore();
            }
          }
        });
      }

      const ballPoint = getDesignerBallPosition();
      if (ballPoint) {
        const ballPos = toDesignerCanvasPoint(ballPoint, metrics);
        ctx.beginPath();
        ctx.fillStyle = "#ffd166";
        ctx.arc(ballPos.x, ballPos.y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (selection?.type === "ball") {
          ctx.beginPath();
          ctx.strokeStyle = "#ffd166";
          ctx.lineWidth = 2;
          ctx.arc(ballPos.x, ballPos.y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function renderDesignerCourt() {
    drawDesignerCourt();
  }

  function getDesignerPointFromEvent(event) {
    if (!designerState.canvas) {
      return null;
    }
    const rect = designerState.canvas.getBoundingClientRect();
    const scaleX = designerState.canvas.width / rect.width;
    const scaleY = designerState.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function findDesignerHit(point, metrics) {
    if (!designerState.play) {
      return null;
    }
    if (designerState.previewRunner) {
      return null;
    }
    const normalized = toDesignerNormalizedPoint(point, metrics);
    const hitPlayer = designerState.play.players.find((player) => {
      const canvasPoint = toDesignerCanvasPoint(player, metrics);
      return Math.hypot(canvasPoint.x - point.x, canvasPoint.y - point.y) < 12;
    });
    if (hitPlayer) {
      return { type: "player", player: hitPlayer };
    }
    const ballPoint = getDesignerBallPosition();
    if (ballPoint) {
      const ballCanvas = toDesignerCanvasPoint(ballPoint, metrics);
      if (Math.hypot(ballCanvas.x - point.x, ballCanvas.y - point.y) < 8) {
        return { type: "ball" };
      }
    }
    const step = getCurrentStep();
    if (step && stepRender?.buildRouteLines) {
      const playersById = new Map();
      designerState.play.players.forEach((player) => {
        playersById.set(player.id, player);
      });
      const routes = stepRender.buildRouteLines(step, playersById);
      const routeHit = stepRender.hitTestRoute(normalized, routes, 0.02);
      if (routeHit) {
        return { type: "route", actionId: routeHit.actionId, pid: routeHit.pid };
      }
      const passes = stepRender.buildPassLines(step, playersById);
      const passHit = stepRender.hitTestPass(normalized, passes, 0.02);
      if (passHit) {
        return { type: "pass", actionId: passHit.actionId };
      }
    }
    if (step) {
      const annotations = getAnnotationsForStep(step.id);
      const annotationHit = hitTestAnnotations(normalized, annotations, 0.02);
      if (annotationHit) {
        return { type: "annotation", id: annotationHit.id };
      }
    }
    return null;
  }

  function createDesignerPlayer(team, normalizedPoint) {
    if (!designerState.play) {
      return;
    }
    if (designerState.play.players.length >= 10) {
      setDesignerStatus("Max 10 players reached.");
      return;
    }
    const teamCount = designerState.play.players.filter(
      (player) => player.team === team
    ).length;
    if (teamCount >= 5) {
      setDesignerStatus("Max 5 players per team.");
      return;
    }
    const rosterPool =
      data?.getActiveTeamPlayers?.(team) ||
      (team === "defense"
        ? data?.getDefensePlayers?.() || []
        : data?.getOffensePlayers?.() || []);
    const usedIds = new Set(designerState.play.players.map((player) => player.id));
    let rosterPlayer = rosterPool.find((player) => !usedIds.has(player.id));
    let rosterCreated = false;
    if (!rosterPlayer && data?.addRosterPlayer) {
      rosterPlayer = data.addRosterPlayer({ team });
      rosterCreated = Boolean(rosterPlayer);
    }
    if (!rosterPlayer) {
      setDesignerStatus("Roster slots full.");
      return;
    }
    const newPlayer = {
      id: rosterPlayer.id,
      team,
      x: normalizedPoint.x,
      y: normalizedPoint.y,
      movementPath: [],
      behavior: team === "defense" ? "route" : "route"
    };
    designerState.play.players.push(newPlayer);
    if (team === "defense") {
      if (!Array.isArray(designerState.play.defensePlayers)) {
        designerState.play.defensePlayers = [];
      }
      designerState.play.defensePlayers.push({
        pid: newPlayer.id,
        x: newPlayer.x,
        y: newPlayer.y
      });
    } else {
      if (!Array.isArray(designerState.play.offensePlayers)) {
        designerState.play.offensePlayers = [];
      }
      designerState.play.offensePlayers.push({
        pid: newPlayer.id,
        x: newPlayer.x,
        y: newPlayer.y
      });
    }
    if (stepEditor?.addPlayerToSnapshots) {
      stepEditor.addPlayerToSnapshots(designerState.play, newPlayer);
    }
    setDesignerSelection("player", newPlayer.id);
    if (rosterCreated) {
      renderCarousel();
    }
    renderDesignerPlaybook();
    renderDesignerCourt();
    setDesignerStatus("Player added.");
    queueDesignerSave();
  }

  function setDesignerTool(mode) {
    const allowed = ["edit", "route", "pass", "delete", "annotation"];
    const nextMode = allowed.includes(mode) ? mode : "edit";
    designerState.mode = nextMode;
    designerState.drawing = false;
    designerState.dragging = false;
    designerState.passFrom = null;
    if (nextMode !== "annotation") {
      designerState.annotationDraft = null;
    }
    syncAnnotationTypeButtons();
    syncAnnotationPalette();
    if (elements.designerToolButtons.length) {
      elements.designerToolButtons.forEach((button) => {
        const isActive = button.dataset.designerTool === nextMode;
        button.classList.toggle("is-active", isActive);
      });
    }
    if (elements.designerPlaceGroup) {
      elements.designerPlaceGroup.style.display = nextMode === "edit" ? "grid" : "none";
    }
    if (nextMode === "edit") {
      setDesignerStatus("Edit mode.");
    } else {
      setDesignerStatus(`Tool: ${nextMode}`);
    }
  }

  function setDesignerPlaceTarget(target) {
    designerState.placeTarget = target;
    if (elements.designerPlaceButtons.length) {
      elements.designerPlaceButtons.forEach((button) => {
        const isActive = button.dataset.designerPlace === target;
        button.classList.toggle("is-active", isActive);
      });
    }
    setDesignerStatus(`Placing: ${target}`);
  }

  function getAnnotationPalette() {
    const isAdvanced = settingsApi?.getSetting
      ? settingsApi.getSetting("advancedMode") === true
      : false;
    return isAdvanced
      ? ["#ffffff", "#ff4d4d", "#39f6ff", "#ffd166", "#4cff9a", "#ff9f1c"]
      : ["#ffffff", "#ff4d4d"];
  }

  function syncAnnotationTypeButtons() {
    if (!elements.designerAnnotationTypeButtons.length) {
      return;
    }
    elements.designerAnnotationTypeButtons.forEach((button) => {
      const isActive =
        designerState.mode === "annotation" &&
        button.dataset.annotationType === designerState.annotationMode.type;
      button.classList.toggle("is-active", isActive);
    });
  }

  function syncAnnotationPalette() {
    const allowed = getAnnotationPalette();
    if (!allowed.includes(designerState.annotationMode.color)) {
      designerState.annotationMode.color = allowed[0];
    }
    if (elements.designerAnnotationColorButtons.length) {
      elements.designerAnnotationColorButtons.forEach((button) => {
        const isActive =
          designerState.mode === "annotation" &&
          button.dataset.annotationColor === designerState.annotationMode.color;
        button.classList.toggle("is-active", isActive);
      });
    }
  }

  function setDesignerAnnotationType(type) {
    designerState.annotationMode.type = type === "squiggle" ? "squiggle" : "straight";
    syncAnnotationTypeButtons();
    setDesignerStatus(`Annotation: ${designerState.annotationMode.type}`);
  }

  function setDesignerAnnotationColor(color) {
    const allowed = getAnnotationPalette();
    const nextColor = allowed.includes(color) ? color : allowed[0];
    designerState.annotationMode.color = nextColor;
    syncAnnotationPalette();
  }

  function handleDesignerPointerDown(event) {
    if (!designerState.play) {
      return;
    }
    if (designerState.previewRunner) {
      return;
    }
    event.preventDefault();
    const metrics = getDesignerMetrics();
    if (!metrics) {
      return;
    }
    const point = getDesignerPointFromEvent(event);
    if (!point) {
      return;
    }
    const step = getCurrentStep();
    if (!step) {
      return;
    }
    const adjusted = {
      x: point.x - designerState.dragOffset.x,
      y: point.y - designerState.dragOffset.y
    };
    const normalized = toDesignerNormalizedPoint(
      designerState.dragging ? adjusted : point,
      metrics
    );
    const hit = findDesignerHit(point, metrics);
    const stepIndex = getCurrentStepIndex();
    const selection = designerState.selectedObject;

    designerState.pointerDownSameSelection = false;
    designerState.dragMoved = false;
    designerState.dragStart = null;

    if (designerState.mode === "delete") {
      if (hit?.type === "player") {
        const playerId = hit.player.id;
        const ballHolder =
          typeof designerState.play.ball?.holderPid === "string"
            ? designerState.play.ball.holderPid
            : designerState.play.ball?.start?.attachedTo;
        if (ballHolder === playerId) {
          setDesignerBallState({ x: hit.player.x, y: hit.player.y, holderPid: null });
        }
        designerState.play.players = designerState.play.players.filter(
          (player) => player.id !== playerId
        );
        if (stepEditor?.removePlayerFromSteps) {
          stepEditor.removePlayerFromSteps(designerState.play, playerId);
        }
        if (Array.isArray(designerState.play.offensePlayers)) {
          designerState.play.offensePlayers = designerState.play.offensePlayers.filter(
            (player) => player.pid !== playerId
          );
        }
        if (Array.isArray(designerState.play.defensePlayers)) {
          designerState.play.defensePlayers = designerState.play.defensePlayers.filter(
            (player) => player.pid !== playerId
          );
        }
        setDesignerSelection(null);
        renderDesignerPlaybook();
        renderDesignerCourt();
        setDesignerStatus("Player removed.");
        queueDesignerSave();
      } else if (hit?.type === "route") {
        if (stepEditor?.removeRouteAction) {
          stepEditor.removeRouteAction(step, hit.pid || hit.actionId);
        }
        const player = designerState.play.players.find((item) => item.id === hit.pid);
        if (player) {
          player.movementPath = [];
        }
        setDesignerSelection(null);
        renderDesignerCourt();
        setDesignerStatus("Route removed.");
        queueDesignerSave();
      } else if (hit?.type === "pass") {
        if (stepEditor?.removeAction) {
          stepEditor.removeAction(step, hit.actionId);
        }
        if (stepEditor?.applyStepToView) {
          stepEditor.applyStepToView(designerState.play, stepIndex);
        }
        setDesignerSelection(null);
        renderDesignerCourt();
        setDesignerStatus("Pass removed.");
        queueDesignerSave();
      } else if (hit?.type === "ball") {
        const ballPoint = getDesignerBallPosition();
        if (ballPoint) {
          setDesignerBallState({ x: ballPoint.x, y: ballPoint.y, holderPid: null });
        }
        if (stepEditor?.updateSnapshotFromView) {
          stepEditor.updateSnapshotFromView(designerState.play, stepIndex);
        }
        setDesignerSelection(null);
        renderDesignerCourt();
        setDesignerStatus("Ball cleared.");
        queueDesignerSave();
      } else if (hit?.type === "annotation") {
        removeAnnotationFromStep(step.id, hit.id);
        setDesignerSelection(null);
        renderDesignerCourt();
        setDesignerStatus("Annotation removed.");
        queueDesignerSave();
      }
      return;
    }

    if (designerState.mode === "annotation") {
      if (hit?.type === "annotation") {
        if (selection?.type === "annotation" && selection.id === hit.id) {
          setDesignerSelection(null);
        } else {
          setDesignerSelection("annotation", hit.id);
        }
        renderDesignerCourt();
        return;
      }
      designerState.annotationDraft = {
        id: generateId("annot"),
        type: designerState.annotationMode.type,
        color: designerState.annotationMode.color,
        points: [normalized]
      };
      setDesignerSelection(null);
      setDesignerStatus("Drawing annotation.");
      renderDesignerCourt();
      return;
    }

    if (designerState.mode === "pass") {
      if (hit?.type !== "player") {
        designerState.passFrom = null;
        setDesignerStatus("Select a player to start a pass.");
        return;
      }
      if (hit.player.team === "defense") {
        setDesignerStatus("Passes must start on offense.");
        return;
      }
      if (!designerState.passFrom) {
        designerState.passFrom = hit.player.id;
        setDesignerSelection("player", hit.player.id);
        setDesignerStatus("Select a target for the pass.");
        renderDesignerCourt();
        return;
      }
      if (designerState.passFrom === hit.player.id) {
        setDesignerStatus("Pick a different receiver.");
        return;
      }
      if (hit.player.team === "defense") {
        setDesignerStatus("Passes must end on offense.");
        return;
      }
      const passAt = calc.clamp(0.5, 0, step.durationSec ?? 2);
      const action = stepEditor?.addPassAction
        ? stepEditor.addPassAction(step, designerState.passFrom, hit.player.id, passAt)
        : null;
      if (stepEditor?.applyStepToView) {
        stepEditor.applyStepToView(designerState.play, stepIndex);
      }
      designerState.passFrom = null;
      renderDesignerCourt();
      setDesignerStatus("Pass added.");
      if (action) {
        setDesignerSelection("pass", action.id);
      }
      queueDesignerSave();
      return;
    }

    if (designerState.mode === "route") {
      if (hit?.type !== "player") {
        setDesignerStatus("Select a player to draw a route.");
        return;
      }
      designerState.drawing = true;
      setDesignerSelection("player", hit.player.id);
      hit.player.movementPath = [
        {
          x: hit.player.x,
          y: hit.player.y
        }
      ];
      renderDesignerCourt();
      return;
    }

    if (hit?.type === "route") {
      if (selection?.type === "route" && selection.id === hit.actionId) {
        setDesignerSelection(null);
      } else {
        setDesignerSelection("route", hit.actionId);
      }
      renderDesignerCourt();
      return;
    }
    if (hit?.type === "pass") {
      if (selection?.type === "pass" && selection.id === hit.actionId) {
        setDesignerSelection(null);
      } else {
        setDesignerSelection("pass", hit.actionId);
      }
      renderDesignerCourt();
      return;
    }
    if (hit?.type === "annotation") {
      if (selection?.type === "annotation" && selection.id === hit.id) {
        setDesignerSelection(null);
      } else {
        setDesignerSelection("annotation", hit.id);
      }
      renderDesignerCourt();
      return;
    }
    if (hit?.type === "player") {
      const isSameSelection =
        selection?.type === "player" && selection.id === hit.player.id;
      if (!isSameSelection) {
        setDesignerSelection("player", hit.player.id);
      }
      designerState.dragging = true;
      designerState.dragMoved = false;
      designerState.pointerDownSameSelection = isSameSelection;
      designerState.dragStart = { x: point.x, y: point.y };
      designerState.dragOffset = {
        x: point.x - hit.player.x * metrics.width,
        y: point.y - hit.player.y * metrics.height
      };
      renderDesignerCourt();
      return;
    }
    if (hit?.type === "ball") {
      const ballPoint = getDesignerBallPosition();
      if (!ballPoint) {
        return;
      }
      const isSameSelection = selection?.type === "ball";
      if (!isSameSelection) {
        setDesignerSelection("ball");
        setDesignerBallState({ x: ballPoint.x, y: ballPoint.y, holderPid: null });
      }
      designerState.dragging = true;
      designerState.dragMoved = false;
      designerState.pointerDownSameSelection = isSameSelection;
      designerState.dragStart = { x: point.x, y: point.y };
      designerState.dragOffset = {
        x: point.x - ballPoint.x * metrics.width,
        y: point.y - ballPoint.y * metrics.height
      };
      renderDesignerCourt();
      return;
    }
    if (!hit && selection?.type === "player" && designerState.mode === "edit") {
      setDesignerSelection(null);
      renderDesignerCourt();
      return;
    }
    if (!selection) {
      if (designerState.placeTarget === "ball") {
        setDesignerBallState({ x: normalized.x, y: normalized.y, holderPid: null });
        if (stepEditor?.updateSnapshotFromView) {
          stepEditor.updateSnapshotFromView(designerState.play, stepIndex);
        }
        setDesignerSelection("ball");
        renderDesignerCourt();
        setDesignerStatus("Ball placed.");
        queueDesignerSave();
        return;
      }
      createDesignerPlayer(designerState.placeTarget, normalized);
      return;
    }
  }

  function handleDesignerPointerMove(event) {
    const metrics = getDesignerMetrics();
    if (!metrics || !designerState.play) {
      return;
    }
    if (designerState.previewRunner) {
      return;
    }
    if (!designerState.drawing && !designerState.dragging && !designerState.annotationDraft) {
      return;
    }
    event.preventDefault();
    const point = getDesignerPointFromEvent(event);
    if (!point) {
      return;
    }
    if (designerState.dragging && designerState.dragStart && !designerState.dragMoved) {
      const distance = Math.hypot(
        point.x - designerState.dragStart.x,
        point.y - designerState.dragStart.y
      );
      if (distance > 1) {
        designerState.dragMoved = true;
      }
    }
    const normalized = toDesignerNormalizedPoint(point, metrics);
    const selection = designerState.selectedObject;
    const stepIndex = getCurrentStepIndex();
    const step = getCurrentStep();

    if (designerState.annotationDraft) {
      const last =
        designerState.annotationDraft.points[
          designerState.annotationDraft.points.length - 1
        ];
      if (!last || Math.hypot(normalized.x - last.x, normalized.y - last.y) > 0.02) {
        designerState.annotationDraft.points.push({ x: normalized.x, y: normalized.y });
        renderDesignerCourt();
      }
      return;
    }

    if (designerState.drawing && selection?.type === "player") {
      const player = designerState.play.players.find(
        (item) => item.id === selection.id
      );
      if (!player) {
        return;
      }
      const last = player.movementPath[player.movementPath.length - 1];
      if (!last || Math.hypot(normalized.x - last.x, normalized.y - last.y) > 0.02) {
        player.movementPath.push({ x: normalized.x, y: normalized.y });
        if (step && stepEditor?.upsertRouteAction) {
          stepEditor.upsertRouteAction(step, player.id, player.movementPath);
        }
        renderDesignerCourt();
      }
      return;
    }

    if (designerState.dragging) {
      if (selection?.type === "player") {
        const player = designerState.play.players.find(
          (item) => item.id === selection.id
        );
        if (!player) {
          return;
        }
        player.x = normalized.x;
        player.y = normalized.y;
        if (player.movementPath.length) {
          player.movementPath[0] = { x: player.x, y: player.y };
        }
        if (step && player.movementPath.length >= 2 && stepEditor?.upsertRouteAction) {
          stepEditor.upsertRouteAction(step, player.id, player.movementPath);
        }
        if (stepEditor?.updateSnapshotFromView) {
          stepEditor.updateSnapshotFromView(designerState.play, stepIndex);
        }
        renderDesignerCourt();
      } else if (selection?.type === "ball") {
        setDesignerBallState({ x: normalized.x, y: normalized.y, holderPid: null });
        if (stepEditor?.updateSnapshotFromView) {
          stepEditor.updateSnapshotFromView(designerState.play, stepIndex);
        }
        renderDesignerCourt();
      }
    }
  }

  function handleDesignerPointerUp() {
    if (designerState.previewRunner) {
      return;
    }
    const step = getCurrentStep();
    const stepIndex = getCurrentStepIndex();
    const selection = designerState.selectedObject;
    let changed = false;
    if (designerState.annotationDraft) {
      const draft = designerState.annotationDraft;
      designerState.annotationDraft = null;
      if (step && draft.points.length >= 2) {
        const normalizedPoints =
          draft.type === "straight"
            ? [draft.points[0], draft.points[draft.points.length - 1]]
            : draft.points;
        const annotation = {
          id: draft.id,
          type: draft.type,
          color: draft.color,
          points: normalizedPoints
        };
        addAnnotationToStep(step.id, annotation);
        setDesignerSelection("annotation", annotation.id);
        renderDesignerCourt();
        setDesignerStatus("Annotation saved.");
        changed = true;
      } else {
        renderDesignerCourt();
        setDesignerStatus("Annotation canceled.");
      }
    }
    if (designerState.drawing) {
      designerState.drawing = false;
      if (step && selection?.type === "player") {
        const player = designerState.play.players.find(
          (item) => item.id === selection.id
        );
        if (player && player.movementPath.length >= 2 && stepEditor?.upsertRouteAction) {
          stepEditor.upsertRouteAction(step, player.id, player.movementPath);
          changed = true;
        } else if (stepEditor?.removeRouteAction) {
          stepEditor.removeRouteAction(step, selection.id);
          changed = true;
        }
      }
      setDesignerStatus("Route saved.");
    }
    if (designerState.dragging) {
      const moved = designerState.dragMoved;
      designerState.dragging = false;
      if (moved) {
        if (stepEditor?.updateSnapshotFromView) {
          stepEditor.updateSnapshotFromView(designerState.play, stepIndex);
          changed = true;
        }
        if (step && selection?.type === "player") {
          const player = designerState.play.players.find(
            (item) => item.id === selection.id
          );
          if (player && player.movementPath.length >= 2 && stepEditor?.upsertRouteAction) {
            stepEditor.upsertRouteAction(step, player.id, player.movementPath);
            changed = true;
          }
        }
      } else if (designerState.pointerDownSameSelection) {
        setDesignerSelection(null);
        renderDesignerCourt();
      }
    }
    designerState.dragStart = null;
    designerState.pointerDownSameSelection = false;
    designerState.dragMoved = false;
    if (changed) {
      queueDesignerSave();
    }
  }

  function syncDesignerInputs() {
    if (!designerState.play) {
      return;
    }
    if (elements.designerPlayName) {
      designerState.play.name = elements.designerPlayName.value.trim() || "Untitled Play";
    }
    if (elements.designerPlayTags) {
      designerState.play.tags = elements.designerPlayTags.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    if (elements.designerPlayNotes) {
      designerState.play.notes = elements.designerPlayNotes.value.trim();
    }
  }

  function saveDesignerPlay() {
    if (!designerState.play) {
      return;
    }
    persistDesignerPlay({ silent: false });
  }

  function loadSelectedDesignerPlay() {
    if (!elements.designerPlaySelect) {
      return;
    }
    const selectedId = elements.designerPlaySelect.value;
    const match = designerState.plays.find((play) => play.id === selectedId);
    if (match) {
      setDesignerPlay(match);
    }
  }

  function deleteSelectedDesignerPlay() {
    if (!designerState.play) {
      return;
    }
    removeAnnotationsForPlay(designerState.play.id);
    designerState.plays = designerState.plays.filter(
      (play) => play.id !== designerState.play.id
    );
    saveDesignerPlays(designerState.plays);
    if (designerState.plays.length) {
      setDesignerPlay(designerState.plays[0]);
    } else {
      setDesignerPlay(createDesignerPlay());
    }
    ui.populateGamePlaySelect?.();
    setDesignerStatus("Play deleted.");
  }

  function createNewDesignerPlay() {
    const nextPlay = createDesignerPlay(
      `New Play ${designerState.plays.length + 1}`
    );
    designerState.plays.push(nextPlay);
    saveDesignerPlays(designerState.plays);
    setDesignerPlay(nextPlay);
    ui.populateGamePlaySelect?.();
    setDesignerStatus("New play created.");
  }

  function clearDesignerRoutes() {
    if (!designerState.play) {
      return;
    }
    const step = getCurrentStep();
    if (step && Array.isArray(step.actions)) {
      step.actions = step.actions.filter((action) => action.type !== "MOVE_ROUTE");
    }
    designerState.play.players.forEach((player) => {
      player.movementPath = [];
    });
    if (designerState.selectedObject?.type === "route") {
      setDesignerSelection(null);
    }
    renderDesignerCourt();
    setDesignerStatus("Routes cleared.");
    queueDesignerSave();
  }

  function deleteSelectedAnnotation() {
    const step = getCurrentStep();
    if (!step) {
      return;
    }
    const selection = designerState.selectedObject;
    if (selection?.type !== "annotation") {
      setDesignerStatus("Select an annotation to delete.");
      return;
    }
    removeAnnotationFromStep(step.id, selection.id);
    setDesignerSelection(null);
    renderDesignerCourt();
    setDesignerStatus("Annotation removed.");
    queueDesignerSave();
  }

  function clearDesignerAnnotations() {
    const step = getCurrentStep();
    if (!step) {
      return;
    }
    clearAnnotationsForStep(step.id);
    if (designerState.selectedObject?.type === "annotation") {
      setDesignerSelection(null);
    }
    renderDesignerCourt();
    setDesignerStatus("Annotations cleared.");
    queueDesignerSave();
  }

  function removeDesignerAnnotationsForStep(stepId) {
    if (!stepId) {
      return;
    }
    clearAnnotationsForStep(stepId);
  }

  function clearDesignerPasses() {
    if (!designerState.play) {
      return;
    }
    const step = getCurrentStep();
    if (step && Array.isArray(step.actions)) {
      step.actions = step.actions.filter((action) => action.type !== "PASS");
    }
    if (stepEditor?.applyStepToView) {
      stepEditor.applyStepToView(designerState.play, getCurrentStepIndex());
    }
    if (designerState.selectedObject?.type === "pass") {
      setDesignerSelection(null);
    }
    renderDesignerCourt();
    setDesignerStatus("Passes cleared.");
    queueDesignerSave();
  }


  Object.assign(ui, {
    normalizePlay,
    createDesignerPlay,
    normalizeDesignerPlay,
    loadDesignerPlays,
    saveDesignerPlays,
    preparePlayForStorage,
    persistDesignerPlay,
    queueDesignerSave,
    setDesignerStatus,
    getCurrentStepIndex,
    getCurrentStep,
    setCurrentStep,
    getDesignerPlayerLabel,
    renderDesignerStepList,
    renderDesignerStepSettings,
    renderDesignerContext,
    setDesignerSelection,
    renderDesignerPreviewHud,
    applyRunnerStateToDesigner,
    startDesignerPreview,
    stopDesignerPreview,
    toggleDesignerPreviewPause,
    setDesignerPlay,
    renderDesignerPlaybook,
    renderDesignerPlayerList,
    renderDesignerBallHolder,
    getDesignerBallPosition,
    setDesignerBallState,
    renderDesignerCourt,
    setDesignerTool,
    setDesignerPlaceTarget,
    setDesignerAnnotationType,
    setDesignerAnnotationColor,
    syncAnnotationPalette,
    handleDesignerPointerDown,
    handleDesignerPointerMove,
    handleDesignerPointerUp,
    syncDesignerInputs,
    saveDesignerPlay,
    loadSelectedDesignerPlay,
    deleteSelectedDesignerPlay,
    createNewDesignerPlay,
    clearDesignerRoutes,
    deleteSelectedAnnotation,
    clearDesignerAnnotations,
    removeDesignerAnnotationsForStep,
    clearDesignerPasses
  });

  return ui;
})();
