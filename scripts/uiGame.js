window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiGame = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements, gameState, gameConfig, gameSpacingSpots } = state;
  const { calc, data, plays, sim, stepRunner } = window.FutureHoops;
  const settingsApi = window.FutureHoops.settings;
  const stepRunnerDefaults = stepRunner || {};
  const passSpeed = 320;
  const controlModes = ["offense", "defense", "both"];
  const joystickState = {
    active: false,
    pointerId: null,
    origin: { x: 0, y: 0 },
    radius: 48
  };

  const getRosterPlayer = (pid) =>
    pid && data?.getPlayerById ? data.getPlayerById(pid) : null;

  const getOffenseEntities = () =>
    [gameState.user, ...gameState.teammates].filter(Boolean);

  const getDefenseEntities = () => gameState.defenders.filter(Boolean);

  const getEntityNumber = (entity) => {
    const rosterPlayer = getRosterPlayer(entity?.pid);
    if (Number.isInteger(rosterPlayer?.number)) {
      return rosterPlayer.number;
    }
    if (Number.isInteger(entity?.number)) {
      return entity.number;
    }
    return null;
  };

  const getNumberLabel = (entity, fallback = "#?") => {
    const number = getEntityNumber(entity);
    return Number.isInteger(number) ? `#${number}` : fallback;
  };

  const getGhostKey = (entity) => entity?.pid || entity?.id || null;

  function getGamePointFromEvent(event) {
    if (!gameState.canvas) {
      return null;
    }
    const rect = gameState.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    const scaleX = gameState.canvas.width / rect.width;
    const scaleY = gameState.canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return { x, y };
  }

  function resetJoystickInput() {
    gameState.input.up = false;
    gameState.input.down = false;
    gameState.input.left = false;
    gameState.input.right = false;
    gameState.input.sprint = false;
  }

  function updateJoystickInput(dx, dy, radius) {
    const threshold = 0.18;
    const nx = radius ? dx / radius : 0;
    const ny = radius ? dy / radius : 0;
    gameState.input.left = nx < -threshold;
    gameState.input.right = nx > threshold;
    gameState.input.up = ny < -threshold;
    gameState.input.down = ny > threshold;
    gameState.input.sprint = false;
  }

  function updateJoystickVisual(dx, dy) {
    if (!elements.mobileJoystickStick) {
      return;
    }
    elements.mobileJoystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function handleMobileJoystickStart(event) {
    if (!state.isMobile || !gameState.active) {
      return;
    }
    if (event.pointerType && event.pointerType !== "touch") {
      return;
    }
    if (!elements.mobileJoystick) {
      return;
    }
    const rect = elements.mobileJoystick.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    joystickState.active = true;
    joystickState.pointerId = event.pointerId;
    joystickState.origin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    joystickState.radius = Math.min(rect.width, rect.height) / 2;
    document.body.classList.add("joystick-active");
    elements.mobileJoystick.setPointerCapture?.(event.pointerId);
    handleMobileJoystickMove(event);
    event.preventDefault();
  }

  function handleMobileJoystickMove(event) {
    if (!joystickState.active || event.pointerId !== joystickState.pointerId) {
      return;
    }
    const dx = event.clientX - joystickState.origin.x;
    const dy = event.clientY - joystickState.origin.y;
    const distance = Math.hypot(dx, dy);
    const radius = joystickState.radius || 1;
    const scale = distance > radius ? radius / distance : 1;
    const clampedX = dx * scale;
    const clampedY = dy * scale;
    updateJoystickInput(clampedX, clampedY, radius);
    updateJoystickVisual(clampedX, clampedY);
    event.preventDefault();
  }

  function handleMobileJoystickEnd(event) {
    if (!joystickState.active || event.pointerId !== joystickState.pointerId) {
      return;
    }
    joystickState.active = false;
    joystickState.pointerId = null;
    resetJoystickInput();
    updateJoystickVisual(0, 0);
    document.body.classList.remove("joystick-active");
    event.preventDefault();
  }

  function cloneGhostPaths(paths) {
    const next = {};
    Object.entries(paths || {}).forEach(([key, entry]) => {
      if (!entry?.points) {
        return;
      }
      next[key] = {
        team: entry.team,
        points: entry.points.map((point) => ({ x: point.x, y: point.y }))
      };
    });
    return next;
  }

  function finalizeGhostPossession() {
    if (!gameState.ghost) {
      return;
    }
    if (Object.keys(gameState.ghost.current || {}).length) {
      gameState.ghost.last = cloneGhostPaths(gameState.ghost.current);
    }
    gameState.ghost.current = {};
    gameState.ghost.lastSampleAt = 0;
  }

  function recordGhostPositions() {
    if (!gameState.ghost) {
      return;
    }
    const now = performance.now();
    if (now - gameState.ghost.lastSampleAt < 120) {
      return;
    }
    gameState.ghost.lastSampleAt = now;
    const record = (entity) => {
      const key = getGhostKey(entity);
      if (!key) {
        return;
      }
      if (!gameState.ghost.current[key]) {
        gameState.ghost.current[key] = { team: entity.team || "offense", points: [] };
      }
      const entry = gameState.ghost.current[key];
      const lastPoint = entry.points[entry.points.length - 1];
      if (!lastPoint || Math.hypot(entity.x - lastPoint.x, entity.y - lastPoint.y) > 3) {
        entry.points.push({ x: entity.x, y: entity.y });
        if (entry.points.length > 240) {
          entry.points.shift();
        }
      }
    };
    gameState.offense.forEach(record);
    gameState.defenders.forEach(record);
  }

  function setGhostPathsEnabled(enabled) {
    if (!gameState.ghost) {
      return;
    }
    const allowGhost = settingsApi?.getSetting
      ? settingsApi.getSetting("showGhostLines") !== false
      : true;
    gameState.ghost.enabled = allowGhost ? Boolean(enabled) : false;
    if (elements.gameGhostToggle) {
      elements.gameGhostToggle.checked = gameState.ghost.enabled;
      elements.gameGhostToggle.disabled = !allowGhost;
    }
  }

  const getOffenseEntityByPid = (pid) =>
    getOffenseEntities().find((entity) => entity.pid === pid);

  const getOffenseEntityByNumber = (number) =>
    getOffenseEntities().find((entity) => getEntityNumber(entity) === number);

  const getDefenseEntityByNumber = (number) =>
    getDefenseEntities().find((entity) => getEntityNumber(entity) === number);

  function syncActiveProfileForPid(pid) {
    if (!pid || !data?.players || !ui.setActive) {
      return;
    }
    const index = data.players.findIndex((player) => player.id === pid);
    if (index >= 0) {
      ui.setActive(index, false);
    }
  }

  function setControlEntity(side, entity) {
    gameState.control.side = side;
    gameState.control.entity = entity || null;
    gameState.control.pid = entity?.pid || null;
    if (gameState.control.pid) {
      syncActiveProfileForPid(gameState.control.pid);
    }
  }

  function getControlledEntity() {
    if (gameState.control.entity) {
      return gameState.control.entity;
    }
    return gameState.user || gameState.defenders[0] || null;
  }

  function getControlledRosterPlayer() {
    const pid = gameState.control.pid || gameState.user?.pid;
    const rosterPlayer = getRosterPlayer(pid);
    if (rosterPlayer) {
      return rosterPlayer;
    }
    return ui.getActivePlayer?.() || null;
  }

  function isOffensePossession() {
    const holderPid = gameState.ball.holderPid;
    if (holderPid) {
      const holderPlayer = getRosterPlayer(holderPid);
      if (holderPlayer) {
        return holderPlayer.team !== "defense";
      }
    }
    if (gameState.ball.carrier?.team) {
      return gameState.ball.carrier.team === "offense";
    }
    return true;
  }

  function syncGameModeButtons() {
    if (!elements.gameModeButtons?.length) {
      return;
    }
    elements.gameModeButtons.forEach((button) => {
      const isActive = button.dataset.gameMode === gameState.mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncControlEntity() {
    const offensePossession = isOffensePossession();
    const useDefense =
      gameState.mode === "defense" || (gameState.mode === "both" && !offensePossession);
    if (useDefense) {
      const defender =
        getDefenseEntityByNumber(1) || gameState.defenders[0] || null;
      setControlEntity("defense", defender);
      updateGameStats();
      return;
    }
    setControlEntity("offense", gameState.user);
    updateGameStats();
  }

  function setGameControlMode(mode) {
    const nextMode = controlModes.includes(mode) ? mode : "offense";
    gameState.mode = nextMode;
    syncGameModeButtons();
    syncControlEntity();
  }

  function setGamePlayStatus(message) {
    if (elements.gamePlayStatus) {
      elements.gamePlayStatus.textContent = message;
    }
  }

  function getGameCourtMetrics() {
    if (!gameState.canvas) {
      return null;
    }
    const width = gameState.canvas.width;
    const height = gameState.canvas.height;
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

  function getShotTypeFromDistance(distance, metrics) {
    if (distance <= metrics.layupRadius) {
      return "layup";
    }
    if (distance <= metrics.arcRadius) {
      return "mid";
    }
    return "three";
  }

  function getShotDifficulty(distance, shotType, metrics) {
    const distanceFactor = distance / metrics.arcRadius;
    const base =
      shotType === "three" ? 55 : shotType === "mid" ? 35 : shotType === "layup" ? 18 : 40;
    return calc.clamp(Math.round(base + distanceFactor * 25), 5, 95);
  }

  function calculatePathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
  }

  function clampGamePosition(entity, metrics, radius = 8) {
    entity.x = calc.clamp(
      entity.x,
      metrics.padding + radius,
      metrics.width - metrics.padding - radius
    );
    entity.y = calc.clamp(
      entity.y,
      metrics.padding + radius,
      metrics.height - metrics.padding - radius
    );
  }

  function updateGameStats() {
    const player = getControlledRosterPlayer();
    if (!player) {
      return;
    }
    if (elements.gamePlayerName) {
      elements.gamePlayerName.textContent = player.name;
    }
    if (elements.gamePlayerRole) {
      elements.gamePlayerRole.textContent = `${player.position} - ${player.archetype}`;
    }
    if (elements.gameFatigueFill) {
      const fatigue = calc.clamp(player.fatigue ?? 0, 0, 100);
      elements.gameFatigueFill.style.width = `${fatigue}%`;
    }
    if (elements.gameFatigueValue) {
      elements.gameFatigueValue.textContent = String(Math.round(player.fatigue ?? 0));
    }
    if (elements.gameConfidenceShooting) {
      elements.gameConfidenceShooting.textContent = String(player.confidence?.shooting ?? 50);
    }
    if (elements.gameConfidenceDefense) {
      elements.gameConfidenceDefense.textContent = String(player.confidence?.defense ?? 50);
    }
    if (elements.gameConfidenceFinishing) {
      elements.gameConfidenceFinishing.textContent = String(player.confidence?.finishing ?? 50);
    }
    const performance = calc.getPerformanceProfile(player);
    if (elements.gamePct3) {
      elements.gamePct3.textContent = `${performance.three.modifiedPercent}%`;
    }
    if (elements.gamePctMid) {
      elements.gamePctMid.textContent = `${performance.mid.modifiedPercent}%`;
    }
    if (elements.gamePctLay) {
      elements.gamePctLay.textContent = `${performance.layup.modifiedPercent}%`;
    }
    if (elements.gameShotClock) {
      elements.gameShotClock.textContent = gameState.possession.shotClock.toFixed(1);
    }
    if (elements.gamePossession) {
      elements.gamePossession.textContent = String(Math.max(gameState.possession.id, 1));
    }
  }

  function renderGameLog() {
    if (!elements.gameLog) {
      return;
    }
    elements.gameLog.innerHTML = "";
    const entries = gameState.log.slice(-gameConfig.maxLog);
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "game-log-row";
      const action = document.createElement("span");
      action.textContent = entry.action.toUpperCase();
      const detail = document.createElement("span");
      detail.textContent = entry.detail.toUpperCase();
      const result = document.createElement("span");
      result.className = entry.result
        ? `game-log-result game-log-result--${entry.result}`
        : "game-log-result";
      result.textContent = entry.result ? entry.result.toUpperCase() : "--";
      row.appendChild(action);
      row.appendChild(detail);
      row.appendChild(result);
      fragment.appendChild(row);
    });
    elements.gameLog.appendChild(fragment);
  }

  function pushGameLog(entry) {
    gameState.log.push(entry);
    if (gameState.log.length > gameConfig.maxLog * 3) {
      gameState.log.shift();
    }
    renderGameLog();
  }

  function populateGamePlaySelect() {
    if (!plays || !elements.gamePlaySelect) {
      return;
    }
    elements.gamePlaySelect.innerHTML = "";
    const baseGroup = document.createElement("optgroup");
    baseGroup.label = "FutureHoops";
    plays.getPlayNames().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      baseGroup.appendChild(option);
    });
    elements.gamePlaySelect.appendChild(baseGroup);

    const customPlays = ui.loadDesignerPlays?.() || [];
    if (customPlays.length) {
      const designerGroup = document.createElement("optgroup");
      designerGroup.label = "Designer";
      customPlays.forEach((play) => {
        const option = document.createElement("option");
        option.value = `designer:${play.id}`;
        option.textContent = play.name;
        designerGroup.appendChild(option);
      });
      elements.gamePlaySelect.appendChild(designerGroup);
    }
  }

  function getDesignerPlayById(playId) {
    if (!playId) {
      return null;
    }
    const playbook = ui.loadDesignerPlays?.() || [];
    return playbook.find((play) => play.id === playId) || null;
  }

  function buildDesignerRouteData(player, metrics) {
    const path = player.movementPath || [];
    const startsWithPlayer =
      path.length &&
      Math.hypot(path[0].x - player.x, path[0].y - player.y) < 0.001;
    const normalizedPoints = startsWithPlayer
      ? path
      : [{ x: player.x, y: player.y }, ...path];
    const points = normalizedPoints.map((point) => ({
      x: point.x * metrics.width,
      y: point.y * metrics.height
    }));
    const length = calculatePathLength(points);
    const duration = Math.max(length / 120, 0.6);
    return { points, length, duration };
  }

  function computeDesignerModifiers(play, metrics) {
    const offensePlayers = play.players.filter((player) => player.team === "offense");
    let totalLength = 0;
    offensePlayers.forEach((player) => {
      if (player.movementPath?.length) {
        const points = player.movementPath.map((point) => ({
          x: point.x * metrics.width,
          y: point.y * metrics.height
        }));
        totalLength += calculatePathLength(points);
      }
    });
    const avgLength = offensePlayers.length ? totalLength / offensePlayers.length : 0;
    const movementBonus = calc.clamp(avgLength / (metrics.arcRadius * 1.4), 0, 0.12);
    const passBonus = calc.clamp(play.ball.passes.length * 0.015, 0, 0.08);
    const openBonus = calc.clamp(0.03 + movementBonus + passBonus, 0.02, 0.18);
    const turnoverRisk = calc.clamp(0.04 + play.ball.passes.length * 0.03, 0.03, 0.24);
    const fatigueCost = Math.round(
      calc.clamp(3 + (totalLength / (metrics.arcRadius * 2)) * 6 + play.ball.passes.length, 2, 12)
    );
    return {
      openBonus,
      turnoverRisk,
      fatigueCost
    };
  }

  function renderGameStepHud() {
    if (!elements.gameStepHud) {
      return;
    }
    const runnerState = gameState.play.runner;
    if (!runnerState?.runner) {
      elements.gameStepHud.setAttribute("aria-hidden", "true");
      return;
    }
    const status = runnerState.runner.getStatus();
    elements.gameStepHud.setAttribute("aria-hidden", "false");
    if (elements.gameStepPlayName) {
      elements.gameStepPlayName.textContent = runnerState.play?.name || "Play";
    }
    if (elements.gameStepIndex) {
      elements.gameStepIndex.textContent = `Step ${status.stepIndex + 1} / ${status.stepCount}`;
    }
    if (elements.gameStepTimer) {
      elements.gameStepTimer.textContent = `${status.elapsed.toFixed(1)} / ${status.duration.toFixed(1)}s`;
    }
    if (elements.gameStepAuto) {
      elements.gameStepAuto.checked = status.mode === "AUTO";
    }
    if (elements.gameStepPlayPause) {
      elements.gameStepPlayPause.textContent = status.isPaused ? "Play" : "Pause";
    }
    if (elements.gameStepPrev) {
      elements.gameStepPrev.disabled = status.mode === "AUTO" || status.stepIndex === 0;
    }
    if (elements.gameStepNext) {
      elements.gameStepNext.disabled = status.stepIndex >= status.stepCount - 1;
    }
  }

  function applyRunnerStateToGame(state) {
    const runnerState = gameState.play.runner;
    if (!runnerState || !state) {
      return;
    }
    const metrics = runnerState.metrics || getGameCourtMetrics();
    if (!metrics) {
      return;
    }
    const screenEntities = new Set();
    state.players.forEach((playerState) => {
      const entity = runnerState.map.get(playerState.pid);
      if (!entity) {
        return;
      }
      entity.x = playerState.x * metrics.width;
      entity.y = playerState.y * metrics.height;
      entity.targetX = entity.x;
      entity.targetY = entity.y;
      clampGamePosition(entity, metrics, entity.radius);
      if (state.screenSet?.has(playerState.pid)) {
        screenEntities.add(entity);
      }
    });
    runnerState.screenEntities = screenEntities;
    if (state.ball) {
      const holderEntity = state.ball.holderPid
        ? runnerState.map.get(state.ball.holderPid)
        : null;
      if (holderEntity) {
        gameState.ball.carrier = holderEntity;
        gameState.ball.holderPid = state.ball.holderPid;
        gameState.ball.x = holderEntity.x;
        gameState.ball.y = holderEntity.y;
      } else {
        gameState.ball.carrier = null;
        gameState.ball.holderPid = null;
        gameState.ball.x = state.ball.x * metrics.width;
        gameState.ball.y = state.ball.y * metrics.height;
      }
    }
    renderGameStepHud();
  }

  function startGameStepRunner(play) {
    const metrics = getGameCourtMetrics();
    if (!metrics || !play || !stepRunner?.StepRunner) {
      setGamePlayStatus("Step runner unavailable.");
      return;
    }
    if (!gameState.user) {
      seedGameRoster(metrics);
    }
    const offensePlayers = play.players.filter((player) => player.team === "offense");
    const defensePlayers = play.players.filter((player) => player.team === "defense");
    if (!offensePlayers.length) {
      setGamePlayStatus("Play needs offense players.");
      return;
    }
    stopGameStepRunner({ silent: true });
    gameState.play.active = null;
    gameState.play.targets = null;
    gameState.play.routes = [];
    gameState.play.phase = "idle";
    gameState.play.expiresAt = 0;
    gameState.play.designer = null;

    const map = new Map();
    const offenseEntities = [gameState.user, ...gameState.teammates];
    offensePlayers.forEach((player, index) => {
      const entity = offenseEntities[index];
      if (entity) {
        map.set(player.id, entity);
      }
    });
    defensePlayers.forEach((player, index) => {
      const entity = gameState.defenders[index];
      if (entity) {
        map.set(player.id, entity);
      }
    });

    const modifiers = computeDesignerModifiers(play, metrics);
    const runnerState = {
      play,
      runner: null,
      map,
      screenEntities: new Set(),
      modifiers,
      metrics
    };
    gameState.play.runner = runnerState;
    const runner = new stepRunner.StepRunner(play, {
      mode: "AUTO",
      context: {
        passSpeed: stepRunnerDefaults.passSpeed,
        defaultStepDuration: stepRunnerDefaults.defaultStepDuration,
        defenseEnabled: defensePlayers.length > 0
      },
      onUpdate: (state) => {
        applyRunnerStateToGame(state);
      },
      onStepChange: () => {
        renderGameStepHud();
      },
      onFinish: () => {
        stopGameStepRunner({ fromRunner: true });
        setGamePlayStatus(`${play.name} complete`);
      }
    });
    runnerState.runner = runner;
    applyRunnerStateToGame(runner.getRuntimeState());
    renderGameStepHud();
    setGamePlayStatus(`${play.name} | Steps running`);
    toggleGamePlayMenu(false);
  }

  function stopGameStepRunner({ fromRunner = false, silent = false } = {}) {
    const runnerState = gameState.play.runner;
    if (!runnerState) {
      return;
    }
    if (!fromRunner) {
      runnerState.runner.stop("stopped");
    }
    gameState.play.runner = null;
    if (elements.gameStepHud) {
      elements.gameStepHud.setAttribute("aria-hidden", "true");
    }
    if (!silent) {
      setGamePlayStatus("Play stopped.");
    }
  }

  function setDesignerPlayRoutes(play, assignments, defenderAssignments) {
    const routes = [];
    assignments.forEach((assignment) => {
      if (assignment.player.movementPath?.length) {
        const startsWithPlayer =
          Math.hypot(
            assignment.player.movementPath[0].x - assignment.player.x,
            assignment.player.movementPath[0].y - assignment.player.y
          ) < 0.001;
        const pathPoints = startsWithPlayer
          ? assignment.player.movementPath
          : [
              { x: assignment.player.x, y: assignment.player.y },
              ...assignment.player.movementPath
            ];
        routes.push({
          points: pathPoints.map((point) => [point.x, point.y]),
          color: "rgba(57, 246, 255, 0.6)"
        });
      }
    });
    defenderAssignments.forEach((assignment) => {
      const behavior = assignment.player?.behavior === "ai" ? "ai" : "route";
      if (behavior === "route" && assignment.player.movementPath?.length) {
        const startsWithPlayer =
          Math.hypot(
            assignment.player.movementPath[0].x - assignment.player.x,
            assignment.player.movementPath[0].y - assignment.player.y
          ) < 0.001;
        const pathPoints = startsWithPlayer
          ? assignment.player.movementPath
          : [
              { x: assignment.player.x, y: assignment.player.y },
              ...assignment.player.movementPath
            ];
        routes.push({
          points: pathPoints.map((point) => [point.x, point.y]),
          color: "rgba(255, 127, 107, 0.6)"
        });
      }
    });
    return routes;
  }

  function getPassLineDistance(defender, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = calc.clamp(((defender.x - start.x) * dx + (defender.y - start.y) * dy) / lengthSq, 0, 1);
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.hypot(defender.x - projX, defender.y - projY);
  }

  function startDesignerGamePlay(play) {
    const metrics = getGameCourtMetrics();
    if (!metrics || !play) {
      return;
    }
    const offensePlayers = play.players.filter((player) => player.team === "offense");
    const defensePlayers = play.players.filter((player) => player.team === "defense");
    if (!offensePlayers.length) {
      setGamePlayStatus("Play needs offense players.");
      return;
    }
    const ballStartId = play.ball.start.attachedTo;
    const userPlayer =
      offensePlayers.find((player) => player.id === ballStartId) || offensePlayers[0];
    const assignments = [];
    const assignmentMap = new Map();
    if (gameState.user) {
      assignments.push({ player: userPlayer, entity: gameState.user });
      assignmentMap.set(userPlayer.id, gameState.user);
    }
    let teammateIndex = 0;
    offensePlayers.forEach((player) => {
      if (player.id === userPlayer.id) {
        return;
      }
      const mate = gameState.teammates[teammateIndex];
      if (mate) {
        assignments.push({ player, entity: mate });
        assignmentMap.set(player.id, mate);
        teammateIndex += 1;
      }
    });

    const defenderAssignments = defensePlayers
      .map((player, index) => {
        const defender = gameState.defenders[index];
        if (!defender) {
          return null;
        }
        return { player, entity: defender };
      })
      .filter(Boolean);

    assignments.forEach((assignment) => {
      const rosterPlayer = getRosterPlayer(assignment.player.id);
      assignment.entity.pid = assignment.player.id;
      assignment.entity.team = "offense";
      assignment.entity.number = rosterPlayer?.number ?? assignment.entity.number ?? null;
      assignment.entity.name = rosterPlayer?.name ?? assignment.entity.name;
      assignment.entity.x = assignment.player.x * metrics.width;
      assignment.entity.y = assignment.player.y * metrics.height;
      assignment.entity.targetX = assignment.entity.x;
      assignment.entity.targetY = assignment.entity.y;
      clampGamePosition(assignment.entity, metrics, assignment.entity.radius);
      assignment.route = buildDesignerRouteData(assignment.player, metrics);
    });

    defenderAssignments.forEach((assignment) => {
      const rosterPlayer = getRosterPlayer(assignment.player.id);
      assignment.entity.pid = assignment.player.id;
      assignment.entity.team = "defense";
      assignment.entity.number = rosterPlayer?.number ?? assignment.entity.number ?? null;
      assignment.entity.name = rosterPlayer?.name ?? assignment.entity.name;
      assignment.entity.x = assignment.player.x * metrics.width;
      assignment.entity.y = assignment.player.y * metrics.height;
      clampGamePosition(assignment.entity, metrics, assignment.entity.radius);
      assignment.route = buildDesignerRouteData(assignment.player, metrics);
    });

    const passList = play.ball.passes
      .map((pass, index) => {
        const fromEntity = assignmentMap.get(pass.from);
        const toEntity = assignmentMap.get(pass.to);
        if (!fromEntity || !toEntity) {
          return null;
        }
        return {
          ...pass,
          time: Number.isFinite(pass.time) ? pass.time : index * 1.4,
          fromEntity,
          toEntity
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);

    const maxRouteDuration = Math.max(
      0,
      ...assignments.map((assignment) => assignment.route?.duration || 0),
      ...defenderAssignments.map((assignment) => assignment.route?.duration || 0)
    );
    const lastPassTime = passList.length
      ? Math.max(...passList.map((pass) => pass.time))
      : 0;

    const modifiers = computeDesignerModifiers(play, metrics);
    gameState.play.designer = {
      active: play,
      startedAt: performance.now(),
      phase: "running",
      assignments,
      defenderAssignments,
      passes: passList,
      passIndex: 0,
      ballFlight: null,
      modifiers,
      duration: Math.max(maxRouteDuration, lastPassTime + 1),
      routes: setDesignerPlayRoutes(play, assignments, defenderAssignments)
    };

    if (play.ball.start.attachedTo && assignmentMap.has(play.ball.start.attachedTo)) {
      gameState.ball.carrier = assignmentMap.get(play.ball.start.attachedTo);
      gameState.ball.holderPid = play.ball.start.attachedTo;
    } else {
      gameState.ball.carrier = null;
      gameState.ball.holderPid = null;
      gameState.ball.x = play.ball.start.x * metrics.width;
      gameState.ball.y = play.ball.start.y * metrics.height;
    }
    gameState.ball.pass = null;
    if (gameState.ball.carrier) {
      setControlledOffenseEntity(gameState.ball.carrier);
    } else {
      syncControlEntity();
    }

    const player = getControlledRosterPlayer();
    if (player) {
      player.fatigue = calc.clamp((player.fatigue ?? 0) + modifiers.fatigueCost, 0, 100);
    }
    updateGameStats();
    setGamePlayStatus(`${play.name} | Play running`);
    toggleGamePlayMenu(false);
  }

  function syncGameDefenders() {
    if (!gameState.defenders.length) {
      return;
    }
    gameState.defenders.forEach((defender, index) => {
      const rosterPlayer =
        getRosterPlayer(defender.pid) ||
        (data?.getDefensePlayers ? data.getDefensePlayers()[index] : null);
      const base =
        rosterPlayer?.ratings?.defense ??
        rosterPlayer?.coreRatings?.defense ??
        65;
      if (Number.isInteger(rosterPlayer?.number)) {
        defender.number = rosterPlayer.number;
      }
      defender.rating = calc.clamp(Math.round(base), 45, 95);
    });
  }

  function getGameTeamRoster(team) {
    if (!data?.getOffensePlayers) {
      return [];
    }
    if (data.ensureRosterConsistency) {
      data.ensureRosterConsistency();
    }
    const getRoster =
      team === "defense" ? data.getDefensePlayers?.bind(data) : data.getOffensePlayers;
    if (typeof getRoster !== "function") {
      return [];
    }
    let roster = getRoster();
    let selected = roster
      .filter(
        (player) =>
          Number.isInteger(player.number) && player.number >= 1 && player.number <= 5
      )
      .sort((a, b) => a.number - b.number);
    if (selected.length < 5 && data.addRosterPlayer) {
      const needed = 5 - selected.length;
      for (let i = 0; i < needed; i += 1) {
        const created = data.addRosterPlayer({ team });
        if (!created) {
          break;
        }
      }
      if (data.ensureRosterConsistency) {
        data.ensureRosterConsistency();
      }
      roster = getRoster();
      selected = roster
        .filter(
          (player) =>
            Number.isInteger(player.number) && player.number >= 1 && player.number <= 5
        )
        .sort((a, b) => a.number - b.number);
    }
    return selected.slice(0, 5);
  }

  function seedGameRoster(metrics) {
    if (!data?.getOffensePlayers) {
      return;
    }
    const offenseRoster = getGameTeamRoster("offense");
    if (!offenseRoster.length) {
      return;
    }
    const defenseRoster = getGameTeamRoster("defense");
    const ballHandler =
      offenseRoster.find((player) => player.number === 1) || offenseRoster[0];
    const userX = metrics.width * 0.5;
    const userY = metrics.height * 0.64;
    const offenseEntities = offenseRoster.map((player) => ({
      pid: player.id,
      number: Number.isInteger(player.number) ? player.number : null,
      name: player.name,
      team: "offense",
      x: userX,
      y: userY,
      targetX: userX,
      targetY: userY,
      radius: 9,
      color: "#39f6ff",
      speed: 120
    }));

    const ballEntity =
      offenseEntities.find((entity) => entity.pid === ballHandler.id) ||
      offenseEntities[0];
    const spacingEntities = offenseEntities.filter((entity) => entity !== ballEntity);
    spacingEntities.forEach((entity, index) => {
      const spot = gameSpacingSpots[index % gameSpacingSpots.length];
      const x = spot.x * metrics.width;
      const y = spot.y * metrics.height;
      entity.x = x;
      entity.y = y;
      entity.targetX = x;
      entity.targetY = y;
      entity.radius = 8;
    });

    ballEntity.x = userX;
    ballEntity.y = userY;
    ballEntity.targetX = userX;
    ballEntity.targetY = userY;
    ballEntity.radius = 9;
    gameState.offense = offenseEntities;
    gameState.user = ballEntity;
    gameState.teammates = offenseEntities.filter((entity) => entity !== ballEntity);
    gameState.offense.forEach((entity) => {
      entity.color = entity === gameState.user ? "#4cff9a" : "#39f6ff";
    });

    gameState.defenders = defenseRoster.map((player, index) => {
      const offensePlayer = gameState.offense[index % gameState.offense.length];
      const offset = index % 2 === 0 ? 18 : -18;
      const x = calc.clamp(
        offensePlayer.x + offset,
        metrics.padding + 8,
        metrics.width - metrics.padding - 8
      );
      const y = calc.clamp(
        offensePlayer.y - 22,
        metrics.padding + 8,
        metrics.height - metrics.padding - 8
      );
      return {
        pid: player.id,
        number: Number.isInteger(player.number) ? player.number : null,
        name: player.name,
        team: "defense",
        x,
        y,
        radius: 8,
        color: "#ff7f6b",
        rating: calc.clamp(Math.round(player.ratings?.defense ?? 65), 45, 95),
        speed: 125
      };
    });

    gameState.ball.carrier = gameState.user;
    gameState.ball.holderPid = gameState.user?.pid || null;
    gameState.ball.pass = null;
    gameState.ball.x = gameState.user.x;
    gameState.ball.y = gameState.user.y;
    syncGameDefenders();
    syncControlEntity();
  }

  function resetGamePossession(force) {
    const metrics = getGameCourtMetrics();
    if (!metrics) {
      return;
    }
    finalizeGhostPossession();
    if (force && gameState.possession.id === 0) {
      gameState.possession.id = 1;
    } else if (!force) {
      gameState.possession.id = Math.max(1, gameState.possession.id + 1);
    }
    gameState.possession.shotClock = gameConfig.shotClock;
    gameState.possession.resetAt = null;
    seedGameRoster(metrics);
    clearGameModePlay();
    updateGameStats();
  }

  function scheduleGamePossessionReset(delayMs) {
    gameState.possession.resetAt = performance.now() + delayMs;
  }

  function updateGameShotClock(delta) {
    if (gameState.possession.resetAt) {
      return;
    }
    gameState.possession.shotClock = Math.max(
      0,
      gameState.possession.shotClock - delta
    );
    if (gameState.possession.shotClock <= 0) {
      handleShotClockViolation();
    }
    if (elements.gameShotClock) {
      elements.gameShotClock.textContent = gameState.possession.shotClock.toFixed(1);
    }
  }

  function handleShotClockViolation() {
    if (gameState.possession.resetAt) {
      return;
    }
    pushGameLog({
      action: "clock",
      detail: "shot clock",
      result: "turnover"
    });
    scheduleGamePossessionReset(800);
  }

  function getMovementSpeed(player, sprinting) {
    const rating = calc.clamp(player?.ratings?.speed ?? 70, 0, 100);
    const base = 110 + rating * 0.7;
    const fatigue = calc.clamp(player?.fatigue ?? 0, 0, 100);
    const fatigueFactor = calc.clamp(1 - fatigue / 140, 0.4, 1);
    let speed = base * fatigueFactor;
    if (sprinting) {
      speed *= 1.35;
    }
    return speed;
  }

  function updateUserMovement(delta, metrics) {
    if (gameState.paused) {
      return;
    }
    const controlledEntity = getControlledEntity();
    if (!controlledEntity) {
      return;
    }
    const input = gameState.input;
    let dx = 0;
    let dy = 0;
    if (input.up) {
      dy -= 1;
    }
    if (input.down) {
      dy += 1;
    }
    if (input.left) {
      dx -= 1;
    }
    if (input.right) {
      dx += 1;
    }
    if (dx === 0 && dy === 0) {
      return;
    }
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const player = getControlledRosterPlayer();
    const sprinting = input.sprint;
    const speed = getMovementSpeed(player, sprinting);
    controlledEntity.x += dx * speed * delta;
    controlledEntity.y += dy * speed * delta;
    clampGamePosition(controlledEntity, metrics, controlledEntity.radius);

    if (sprinting && player) {
      const nextFatigue = calc.clamp(
        (player.fatigue ?? 0) + gameConfig.sprintDrain * delta,
        0,
        100
      );
      if (Math.abs(nextFatigue - (player.fatigue ?? 0)) > 0.01) {
        player.fatigue = nextFatigue;
        updateGameStats();
      }
    }
  }

  function getTeammateSpot(index, metrics) {
    const spot = gameSpacingSpots[index % gameSpacingSpots.length];
    return {
      x: spot.x * metrics.width,
      y: spot.y * metrics.height
    };
  }

  function updateTeammateTargets(metrics) {
    const ball = gameState.user;
    const spacingRadius = metrics.width * 0.18;
    gameState.teammates.forEach((mate, index) => {
      let target = getTeammateSpot(index, metrics);
      if (gameState.play.active && gameState.play.targets) {
        if (index === 0) {
          target = toCanvasPoint(gameState.play.targets.primary, metrics);
        }
        if (index === 1) {
          target = toCanvasPoint(gameState.play.targets.secondary, metrics);
        }
      }
      const dx = target.x - ball.x;
      const dy = target.y - ball.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < spacingRadius) {
        const push = spacingRadius - dist;
        target.x += (dx / dist) * push;
        target.y += (dy / dist) * push;
      }
      const nearestDefender = getNearestEntity(gameState.defenders, target);
      if (nearestDefender) {
        const ddx = target.x - nearestDefender.x;
        const ddy = target.y - nearestDefender.y;
        const ddef = Math.hypot(ddx, ddy) || 1;
        if (ddef < metrics.width * 0.18) {
          target.x += (ddx / ddef) * 18;
          target.y += (ddy / ddef) * 18;
        }
      }
      mate.targetX = target.x;
      mate.targetY = target.y;
    });
  }

  function updateDesignerTeammateTargets(metrics) {
    const designerPlay = gameState.play.designer;
    if (!designerPlay?.active) {
      return false;
    }
    const elapsed = (performance.now() - designerPlay.startedAt) / 1000;
    const assignedEntities = new Set(
      designerPlay.assignments.map((assignment) => assignment.entity)
    );
    gameState.teammates.forEach((mate) => {
      if (!assignedEntities.has(mate)) {
        mate.targetX = mate.x;
        mate.targetY = mate.y;
      }
    });
    designerPlay.assignments.forEach((assignment) => {
      if (assignment.entity === gameState.user) {
        return;
      }
      const route = assignment.route;
      if (!route || route.points.length < 2) {
        assignment.entity.targetX = assignment.entity.x;
        assignment.entity.targetY = assignment.entity.y;
        return;
      }
      const progress = route.duration ? elapsed / route.duration : 1;
      const target = getPointAlongPath(route.points, progress);
      if (target) {
        assignment.entity.targetX = target.x;
        assignment.entity.targetY = target.y;
      }
    });
    return true;
  }

  function moveEntity(entity, targetX, targetY, speed, delta, metrics) {
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.5) {
      return;
    }
    const step = Math.min(distance, speed * delta);
    entity.x += (dx / distance) * step;
    entity.y += (dy / distance) * step;
    clampGamePosition(entity, metrics, entity.radius);
  }

  function getNearestEntity(entities, point) {
    let best = null;
    let bestDist = Infinity;
    entities.forEach((entity) => {
      const dx = entity.x - point.x;
      const dy = entity.y - point.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = entity;
      }
    });
    return best;
  }

  function updateTeammates(delta, metrics) {
    if (!gameState.teammates.length) {
      return;
    }
    if (!updateDesignerTeammateTargets(metrics)) {
      updateTeammateTargets(metrics);
    }
    gameState.teammates.forEach((mate) => {
      moveEntity(mate, mate.targetX, mate.targetY, mate.speed, delta, metrics);
    });
  }

  function updateDefenders(delta, metrics) {
    if (!gameState.defenders.length) {
      return;
    }
    const designerPlay = gameState.play.designer;
    const designerElapsed = designerPlay?.active
      ? (performance.now() - designerPlay.startedAt) / 1000
      : 0;
    const offense = [gameState.user, ...gameState.teammates];
    const ballHandler = gameState.user;
    const ballDistance = Math.hypot(
      ballHandler.x - metrics.hoopX,
      ballHandler.y - metrics.hoopY
    );
    const helpOnDrive = ballDistance < metrics.keyHeight * 0.9;
    gameState.defenders.forEach((defender) => {
      if (gameState.control.side === "defense" && gameState.control.entity === defender) {
        return;
      }
      const assignment = designerPlay?.defenderAssignments?.find(
        (item) => item.entity === defender
      );
      if (assignment) {
        const behavior = assignment.player?.behavior === "ai" ? "ai" : "route";
        if (behavior === "route") {
          if (assignment.route?.points?.length > 1) {
            const progress = assignment.route.duration
              ? designerElapsed / assignment.route.duration
              : 1;
            const target = getPointAlongPath(assignment.route.points, progress);
            if (target) {
              moveEntity(defender, target.x, target.y, defender.speed, delta, metrics);
            }
          }
          return;
        }
      }
      const target = getNearestEntity(offense, defender);
      if (!target) {
        return;
      }
      const helpFactor = helpOnDrive ? 0.35 : 0.18;
      let targetX = target.x * (1 - helpFactor) + metrics.hoopX * helpFactor;
      let targetY = target.y * (1 - helpFactor) + metrics.hoopY * helpFactor;
      if (helpOnDrive && target !== ballHandler) {
        targetX += (ballHandler.x - targetX) * 0.15;
        targetY += (ballHandler.y - targetY) * 0.15;
      }
      const closeOut =
        target !== ballHandler &&
        Math.hypot(defender.x - target.x, defender.y - target.y) >
          metrics.arcRadius * 0.45;
      const speed = defender.speed * (closeOut ? 1.2 : 1);
      moveEntity(defender, targetX, targetY, speed, delta, metrics);
    });
  }

  function updateGamePlayPhase(metrics) {
    if (!gameState.play.active) {
      return;
    }
    const now = performance.now();
    if (gameState.play.expiresAt && now > gameState.play.expiresAt) {
      clearGameModePlay();
      return;
    }
    if (gameState.play.phase !== "setup" || !gameState.play.targets) {
      return;
    }
    const primaryTarget = toCanvasPoint(gameState.play.targets.primary, metrics);
    const secondaryTarget = toCanvasPoint(gameState.play.targets.secondary, metrics);
    const primary = gameState.teammates[0];
    const secondary = gameState.teammates[1];
    const nearPrimary =
      primary && Math.hypot(primary.x - primaryTarget.x, primary.y - primaryTarget.y) < 12;
    const nearSecondary =
      secondary &&
      Math.hypot(secondary.x - secondaryTarget.x, secondary.y - secondaryTarget.y) < 12;
    if (nearPrimary && nearSecondary) {
      gameState.play.phase = "live";
      setGamePlayStatus(
        `${gameState.play.active.play.name} live | Defense: ${gameState.play.active.reaction.name}`
      );
    }
  }

  function handleDesignerTurnover(reason) {
    pushGameLog({
      action: "play",
      detail: reason,
      result: "turnover"
    });
    gameState.ball.pass = null;
    gameState.ball.carrier = null;
    gameState.ball.holderPid = null;
    clearGameModePlay();
    scheduleGamePossessionReset(900);
  }

  function startDesignerPass(pass, metrics) {
    const from = { x: pass.fromEntity.x, y: pass.fromEntity.y };
    const to = { x: pass.toEntity.x, y: pass.toEntity.y };
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const speed = calc.clamp(pass.speed || 1, 0.4, 3);
    const duration = Math.max(distance / (260 * speed), 0.3);
    const nearest = Math.min(
      ...gameState.defenders.map((defender) => getPassLineDistance(defender, from, to))
    );
    const receiverDelta = Math.hypot(
      pass.toEntity.x - (pass.toEntity.targetX ?? pass.toEntity.x),
      pass.toEntity.y - (pass.toEntity.targetY ?? pass.toEntity.y)
    );
    let turnoverChance = 0.04 + (distance / metrics.arcRadius) * 0.06;
    if (nearest < 18) {
      turnoverChance += 0.08;
    }
    if (nearest < 12) {
      turnoverChance += 0.08;
    }
    if (receiverDelta > 18) {
      turnoverChance += 0.06;
    }
    if (pass.time < 0.5) {
      turnoverChance += 0.05;
    }
    if (gameState.play.designer?.modifiers?.turnoverRisk) {
      turnoverChance += gameState.play.designer.modifiers.turnoverRisk;
    }
    turnoverChance = calc.clamp(turnoverChance, 0.03, 0.5);
    if (Math.random() < turnoverChance) {
      handleDesignerTurnover("bad timing");
      return false;
    }
    gameState.play.designer.ballFlight = {
      from,
      to,
      arc: calc.clamp(pass.arc || 0.35, 0, 1),
      duration,
      startedAt: performance.now(),
      toEntity: pass.toEntity
    };
    gameState.ball.carrier = null;
    gameState.ball.holderPid = null;
    return true;
  }

  function updateDesignerPlay(metrics) {
    const designerPlay = gameState.play.designer;
    if (!designerPlay?.active) {
      return;
    }
    const now = performance.now();
    const elapsed = (now - designerPlay.startedAt) / 1000;
    if (!designerPlay.ballFlight && designerPlay.passIndex < designerPlay.passes.length) {
      const nextPass = designerPlay.passes[designerPlay.passIndex];
      if (elapsed >= nextPass.time) {
        const started = startDesignerPass(nextPass, metrics);
        if (!started) {
          return;
        }
        designerPlay.passIndex += 1;
      }
    }

    if (
      elapsed > designerPlay.duration &&
      !designerPlay.ballFlight &&
      designerPlay.passIndex >= designerPlay.passes.length &&
      designerPlay.phase !== "complete"
    ) {
      designerPlay.phase = "complete";
      setGamePlayStatus(`${designerPlay.active.name} complete | Shoot or pass`);
    }
  }

  function syncOffenseColors() {
    if (!gameState.offense.length) {
      return;
    }
    gameState.offense.forEach((entity) => {
      entity.color = entity === gameState.user ? "#4cff9a" : "#39f6ff";
    });
  }

  function setControlledOffenseEntity(entity) {
    if (!entity) {
      return;
    }
    gameState.user = entity;
    gameState.teammates = gameState.offense.filter((item) => item !== entity);
    syncOffenseColors();
    setControlEntity("offense", entity);
    updateGameStats();
  }

  function startGamePass(fromEntity, toEntity) {
    const startX = fromEntity.x;
    const startY = fromEntity.y;
    const endX = toEntity.x;
    const endY = toEntity.y;
    const distance = Math.hypot(endX - startX, endY - startY);
    const travelTime = Math.max(distance / passSpeed, 0.2);
    gameState.ball.pass = {
      fromPid: fromEntity.pid,
      toPid: toEntity.pid,
      startX,
      startY,
      endX,
      endY,
      t: 0,
      travelTime
    };
    gameState.ball.holderPid = null;
    gameState.ball.carrier = null;
    gameState.ball.x = startX;
    gameState.ball.y = startY;
    pushGameLog({
      action: "pass",
      detail: `${getNumberLabel(fromEntity)} passed to ${getNumberLabel(toEntity)}`
    });
  }

  function finishGamePass(pass) {
    const receiver = getOffenseEntityByPid(pass.toPid);
    gameState.ball.pass = null;
    if (!receiver) {
      gameState.ball.carrier = null;
      gameState.ball.holderPid = null;
      scheduleGamePossessionReset(900);
      return;
    }
    gameState.ball.carrier = receiver;
    gameState.ball.holderPid = receiver.pid;
    gameState.ball.x = receiver.x;
    gameState.ball.y = receiver.y;
    setControlledOffenseEntity(receiver);
    pushGameLog({
      action: "pass",
      detail: `${getNumberLabel(receiver)} caught the ball`
    });
  }

  function interceptGamePass(defender) {
    const label = getNumberLabel(defender, "DEF");
    pushGameLog({
      action: "pass",
      detail: `${label} intercepted the pass`,
      result: "turnover"
    });
    gameState.ball.pass = null;
    gameState.ball.carrier = null;
    gameState.ball.holderPid = null;
    clearGameModePlay();
    scheduleGamePossessionReset(900);
  }

  function getInterceptingDefender(point) {
    const threshold = 8;
    return gameState.defenders.find(
      (defender) => Math.hypot(defender.x - point.x, defender.y - point.y) < threshold
    );
  }

  function releaseRunnerForManualAction() {
    if (gameState.play.runner?.runner) {
      stopGameStepRunner({ silent: true });
    }
  }

  function attemptNumberPass(number) {
    if (!gameState.user || gameState.paused || gameState.possession.resetAt) {
      return;
    }
    releaseRunnerForManualAction();
    if (gameState.control.side !== "offense") {
      return;
    }
    if (!gameState.ball.holderPid || gameState.ball.pass || gameState.play.designer?.ballFlight) {
      return;
    }
    if (gameState.control.pid !== gameState.ball.holderPid) {
      return;
    }
    const fromEntity = getOffenseEntityByPid(gameState.ball.holderPid);
    const toEntity = getOffenseEntityByNumber(number);
    if (!fromEntity || !toEntity || fromEntity === toEntity) {
      return;
    }
    startGamePass(fromEntity, toEntity);
  }

  function attemptTapPass(toEntity) {
    if (!toEntity) {
      return false;
    }
    if (!gameState.user || gameState.paused || gameState.possession.resetAt) {
      return false;
    }
    releaseRunnerForManualAction();
    if (gameState.control.side !== "offense") {
      return false;
    }
    if (gameState.mode === "defense" || (gameState.mode === "both" && !isOffensePossession())) {
      return false;
    }
    if (!gameState.ball.holderPid || gameState.ball.pass || gameState.play.designer?.ballFlight) {
      return false;
    }
    if (gameState.control.pid !== gameState.ball.holderPid) {
      return false;
    }
    const fromEntity = getOffenseEntityByPid(gameState.ball.holderPid);
    if (!fromEntity || fromEntity === toEntity) {
      return false;
    }
    startGamePass(fromEntity, toEntity);
    return true;
  }

  function switchControlledDefender(number) {
    const defender = getDefenseEntityByNumber(number);
    if (!defender) {
      return;
    }
    setControlEntity("defense", defender);
    updateGameStats();
  }

  function handleGameCourtTap(event) {
    if (!state.isMobile || !gameState.active || gameState.paused || !gameState.user) {
      return;
    }
    if (event.pointerType && event.pointerType !== "touch") {
      return;
    }
    const point = getGamePointFromEvent(event);
    if (!point) {
      return;
    }
    const offensePossession = isOffensePossession();
    if (gameState.mode === "offense" || (gameState.mode === "both" && offensePossession)) {
      const target = getNearestEntity(gameState.offense, point);
      if (!target) {
        return;
      }
      const distance = Math.hypot(target.x - point.x, target.y - point.y);
      if (distance > (target.radius || 9) + 12) {
        return;
      }
      attemptTapPass(target);
      return;
    }
    if (gameState.mode === "defense" || (gameState.mode === "both" && !offensePossession)) {
      const defender = getNearestEntity(gameState.defenders, point);
      if (!defender) {
        return;
      }
      const distance = Math.hypot(defender.x - point.x, defender.y - point.y);
      if (distance > (defender.radius || 9) + 12) {
        return;
      }
      setControlEntity("defense", defender);
      updateGameStats();
    }
  }

  function handleNumberInput(number) {
    if (gameState.paused) {
      return;
    }
    const offensePossession = isOffensePossession();
    if (gameState.mode === "offense" || (gameState.mode === "both" && offensePossession)) {
      attemptNumberPass(number);
      return;
    }
    if (gameState.mode === "defense" || (gameState.mode === "both" && !offensePossession)) {
      switchControlledDefender(number);
    }
  }

  function handleDefensiveContest() {
    if (gameState.control.side !== "defense" || gameState.paused) {
      return;
    }
    const defender = gameState.control.entity;
    if (!defender) {
      return;
    }
    const now = performance.now();
    defender.contestUntil = now + 400;
    gameState.control.contestUntil = defender.contestUntil;
  }

  function switchPossession(newHolder) {
    gameState.possession.id = Math.max(1, gameState.possession.id + 1);
    gameState.possession.shotClock = gameConfig.shotClock;
    gameState.possession.resetAt = null;
    clearGameModePlay();
    gameState.ball.pass = null;
    gameState.ball.carrier = newHolder || null;
    gameState.ball.holderPid = newHolder?.pid || null;
    if (newHolder) {
      gameState.ball.x = newHolder.x;
      gameState.ball.y = newHolder.y;
    }
    syncControlEntity();
    updateGameStats();
  }

  function handleDefensiveSteal() {
    if (gameState.control.side !== "defense" || gameState.paused) {
      return;
    }
    const now = performance.now();
    if (now < (gameState.control.stealCooldownUntil || 0)) {
      return;
    }
    gameState.control.stealCooldownUntil = now + 600;
    const defender = gameState.control.entity;
    if (!defender) {
      return;
    }
    const holderPid = gameState.ball.holderPid;
    if (!holderPid) {
      return;
    }
    const ballHolder = getOffenseEntityByPid(holderPid);
    if (!ballHolder) {
      return;
    }
    const distance = Math.hypot(defender.x - ballHolder.x, defender.y - ballHolder.y);
    const range = 20;
    if (distance > range) {
      pushGameLog({
        action: "steal",
        detail: `${getNumberLabel(defender)} missed the steal`
      });
      return;
    }
    const handler = getRosterPlayer(holderPid);
    const handlerRating = handler?.ratings?.dribbling ?? handler?.coreRatings?.passing ?? 70;
    const defenderRating = defender.rating ?? 70;
    const distanceFactor = calc.clamp(1 - distance / range, 0, 1);
    const ratingFactor = calc.clamp((defenderRating - handlerRating) / 160, -0.2, 0.3);
    const stealChance = calc.clamp(0.12 + distanceFactor * 0.35 + ratingFactor, 0.05, 0.55);
    if (Math.random() < stealChance) {
      pushGameLog({
        action: "steal",
        detail: `${getNumberLabel(defender)} stole the ball`,
        result: "turnover"
      });
      switchPossession(defender);
      return;
    }
    pushGameLog({
      action: "steal",
      detail: `${getNumberLabel(defender)} missed the steal`
    });
  }

  function updateBallPosition(metrics, delta) {
    if (gameState.ball.pass) {
      const pass = gameState.ball.pass;
      pass.t = calc.clamp(pass.t + delta / pass.travelTime, 0, 1);
      const progress = pass.t;
      gameState.ball.x = pass.startX + (pass.endX - pass.startX) * progress;
      gameState.ball.y = pass.startY + (pass.endY - pass.startY) * progress;
      const intercepted = getInterceptingDefender(gameState.ball);
      if (intercepted) {
        interceptGamePass(intercepted);
        return;
      }
      if (progress >= 1) {
        finishGamePass(pass);
      }
      return;
    }
    const designerPlay = gameState.play.designer;
    if (designerPlay?.ballFlight) {
      const flight = designerPlay.ballFlight;
      const now = performance.now();
      const progress = calc.clamp((now - flight.startedAt) / flight.duration, 0, 1);
      const arcHeight = 18 + flight.arc * 28;
      gameState.ball.x = flight.from.x + (flight.to.x - flight.from.x) * progress;
      gameState.ball.y =
        flight.from.y + (flight.to.y - flight.from.y) * progress - Math.sin(Math.PI * progress) * arcHeight;
      const intercepted = gameState.defenders.some(
        (defender) => Math.hypot(defender.x - gameState.ball.x, defender.y - gameState.ball.y) < 8
      );
      if (intercepted) {
        designerPlay.ballFlight = null;
        handleDesignerTurnover("intercepted");
        return;
      }
      if (progress >= 1) {
        designerPlay.ballFlight = null;
        gameState.ball.carrier = flight.toEntity;
        gameState.ball.holderPid = flight.toEntity?.pid || null;
        gameState.ball.x = flight.toEntity.x;
        gameState.ball.y = flight.toEntity.y;
      }
      return;
    }
    if (gameState.ball.carrier) {
      if (!gameState.ball.holderPid && gameState.ball.carrier.pid) {
        gameState.ball.holderPid = gameState.ball.carrier.pid;
      }
      gameState.ball.x = gameState.ball.carrier.x;
      gameState.ball.y = gameState.ball.carrier.y;
    } else if (gameState.ball.holderPid) {
      const holder =
        getOffenseEntityByPid(gameState.ball.holderPid) ||
        getDefenseEntities().find((entity) => entity.pid === gameState.ball.holderPid);
      if (holder) {
        gameState.ball.carrier = holder;
        gameState.ball.x = holder.x;
        gameState.ball.y = holder.y;
        return;
      }
    } else if (gameState.user) {
      gameState.ball.x = gameState.user.x;
      gameState.ball.y = gameState.user.y;
    }
  }

  function getGameContest(point, metrics) {
    const nearest = getNearestEntity(gameState.defenders, point);
    if (!nearest) {
      return {
        contestLevel: 0.1,
        defenderRating: 60
      };
    }
    const distance = Math.hypot(nearest.x - point.x, nearest.y - point.y);
    const contestRadius = metrics.arcRadius * 0.45;
    let contestLevel = calc.clamp(1 - distance / contestRadius, 0, 1);
    let defenderRating = nearest.rating;
    const controlled = gameState.control.side === "defense" ? gameState.control.entity : null;
    if (controlled?.contestUntil) {
      const now = performance.now();
      const remaining = controlled.contestUntil - now;
      if (remaining > 0) {
        const contestDistance = Math.hypot(controlled.x - point.x, controlled.y - point.y);
        const contestRange = metrics.arcRadius * 0.32;
        if (contestDistance <= contestRange) {
          const distanceFactor = calc.clamp(1 - contestDistance / contestRange, 0, 1);
          const timingFactor = calc.clamp(remaining / 400, 0, 1);
          const bonus = calc.clamp(0.2 + distanceFactor * 0.45 + timingFactor * 0.35, 0, 0.9);
          contestLevel = Math.min(1, Math.max(contestLevel, bonus));
          defenderRating = controlled.rating ?? defenderRating;
        }
      }
    }
    return {
      contestLevel,
      defenderRating
    };
  }

  function drawGamePlayRoutes(ctx, metrics) {
    const routes = [...gameState.play.routes];
    if (gameState.play.designer?.routes?.length) {
      routes.push(...gameState.play.designer.routes);
    }
    if (!routes.length) {
      return;
    }
    routes.forEach((route) => {
      const points = route.points.map((point) => toCanvasPoint(point, metrics));
      if (points.length < 2) {
        return;
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = route.color || "rgba(57, 246, 255, 0.6)";
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawGhostPaths(ctx) {
    const allowGhost = settingsApi?.getSetting
      ? settingsApi.getSetting("showGhostLines") !== false
      : true;
    if (!allowGhost || !gameState.ghost?.enabled) {
      return;
    }
    const drawPaths = (paths, alpha) => {
      Object.values(paths || {}).forEach((entry) => {
        if (!entry?.points || entry.points.length < 2) {
          return;
        }
        ctx.beginPath();
        ctx.lineWidth = 1;
        const base =
          entry.team === "defense"
            ? `rgba(255, 127, 107, ${alpha})`
            : `rgba(57, 246, 255, ${alpha})`;
        ctx.strokeStyle = base;
        ctx.moveTo(entry.points[0].x, entry.points[0].y);
        for (let i = 1; i < entry.points.length; i += 1) {
          ctx.lineTo(entry.points[i].x, entry.points[i].y);
        }
        ctx.stroke();
      });
    };
    drawPaths(gameState.ghost.last, 0.18);
    drawPaths(gameState.ghost.current, 0.35);
  }

  function drawGamePlayers(ctx) {
    const screenEntities = gameState.play.runner?.screenEntities;
    const showPlayerNumbers = settingsApi?.getSetting
      ? settingsApi.getSetting("showPlayerNumbers") !== false
      : true;
    const renderPlayer = (player, number) => {
      if (!player) {
        return;
      }
      ctx.beginPath();
      ctx.fillStyle = player.color;
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
      if (player.pid && player.pid === gameState.ball.holderPid) {
        ctx.beginPath();
        ctx.strokeStyle = "#4cff9a";
        ctx.lineWidth = 2;
        ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (screenEntities && screenEntities.has(player)) {
        ctx.beginPath();
        ctx.strokeStyle = "#ff4d4d";
        ctx.lineWidth = 2;
        ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (showPlayerNumbers && Number.isFinite(number)) {
        ctx.save();
        const fontSize = Math.max(10, Math.round(player.radius * 1.1));
        ctx.font = `bold ${fontSize}px "Oxanium", "Space Grotesk", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.18));
        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillStyle = "#ffffff";
        const label = String(number);
        ctx.strokeText(label, player.x, player.y);
        ctx.fillText(label, player.x, player.y);
        ctx.restore();
      }
    };
    let offenseNumber = 1;
    if (gameState.user) {
      renderPlayer(gameState.user, offenseNumber);
      offenseNumber += 1;
    }
    gameState.teammates.forEach((mate) => {
      renderPlayer(mate, offenseNumber);
      offenseNumber += 1;
    });
    let defenseNumber = 1;
    gameState.defenders.forEach((defender) => {
      renderPlayer(defender, defenseNumber);
      defenseNumber += 1;
    });
  }

  function drawGameBall(ctx) {
    if (gameState.ball.pass) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(76, 255, 154, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(gameState.ball.pass.startX, gameState.ball.pass.startY);
      ctx.lineTo(gameState.ball.pass.endX, gameState.ball.pass.endY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.fillStyle = "#ffd166";
    ctx.arc(gameState.ball.x, gameState.ball.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGameCourt() {
    if (!gameState.ctx) {
      return;
    }
    const ctx = gameState.ctx;
    const metrics = getGameCourtMetrics();
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

    drawGamePlayRoutes(ctx, metrics);
    drawGhostPaths(ctx);
    drawGamePlayers(ctx);
    drawGameBall(ctx);
  }

  function handleGameShot() {
    if (
      !sim ||
      !gameState.user ||
      gameState.paused ||
      gameState.possession.resetAt ||
      gameState.play.runner?.runner
    ) {
      return;
    }
    if (
      !gameState.ball.holderPid ||
      gameState.control.side !== "offense" ||
      gameState.control.pid !== gameState.ball.holderPid
    ) {
      return;
    }
    const metrics = getGameCourtMetrics();
    if (!metrics) {
      return;
    }
    const distance = Math.hypot(
      gameState.user.x - metrics.hoopX,
      gameState.user.y - metrics.hoopY
    );
    const shotType = getShotTypeFromDistance(distance, metrics);
    const baseDifficulty = getShotDifficulty(distance, shotType, metrics);
    const contest = getGameContest(gameState.user, metrics);
    let difficulty = calc.clamp(baseDifficulty + contest.contestLevel * 32, 0, 100);
    let contestBoost = 0;
    let turnoverBoost = 0;

    if (gameState.play.active && gameState.play.phase === "live") {
      const { play, reaction } = gameState.play.active;
      const openBonus = play.openBonus || 0;
      difficulty = calc.clamp(
        difficulty + reaction.difficultyDelta - openBonus * 100,
        0,
        100
      );
      contestBoost = (reaction.contestBoost || 0) - openBonus * 0.5;
      turnoverBoost = (play.turnoverRisk || 0) + (reaction.turnoverBoost || 0);
    }
    if (gameState.play.designer?.active) {
      const modifiers = gameState.play.designer.modifiers || {
        openBonus: 0,
        turnoverRisk: 0
      };
      difficulty = calc.clamp(difficulty - modifiers.openBonus * 100, 0, 100);
      contestBoost -= modifiers.openBonus * 0.5;
      turnoverBoost += modifiers.turnoverRisk;
    }
    if (gameState.play.runner?.modifiers) {
      const modifiers = gameState.play.runner.modifiers;
      difficulty = calc.clamp(difficulty - modifiers.openBonus * 100, 0, 100);
      contestBoost -= modifiers.openBonus * 0.5;
      turnoverBoost += modifiers.turnoverRisk;
    }

    const result = sim.takeAction("shot", {
      shotType,
      defenderRating: contest.defenderRating,
      contestLevel: contest.contestLevel,
      contestBoost,
      difficulty,
      turnoverBoost
    });
    if (result?.entry) {
      pushGameLog({
        action: "shot",
        detail: shotType,
        result: result.entry.result
      });
      ui.refreshActivePlayer?.();
      updateGameStats();
    }
    clearGameModePlay();
    scheduleGamePossessionReset(900);
  }

  function triggerGameShot() {
    handleGameShot();
  }

  function handleGamePass() {
    if (!gameState.user || gameState.paused || gameState.possession.resetAt) {
      return;
    }
    releaseRunnerForManualAction();
    if (gameState.control.side !== "offense") {
      return;
    }
    if (gameState.mode === "defense" || (gameState.mode === "both" && !isOffensePossession())) {
      return;
    }
    if (!gameState.ball.holderPid || gameState.ball.pass || gameState.play.designer?.ballFlight) {
      return;
    }
    if (gameState.control.pid !== gameState.ball.holderPid) {
      return;
    }
    const fromEntity = getOffenseEntityByPid(gameState.ball.holderPid);
    if (!fromEntity) {
      return;
    }
    const teammate = getNearestEntity(gameState.teammates, fromEntity);
    if (!teammate) {
      return;
    }
    startGamePass(fromEntity, teammate);
  }

  function toggleGamePlayMenu(forceState) {
    const shouldOpen =
      typeof forceState === "boolean" ? forceState : !gameState.play.menuOpen;
    gameState.play.menuOpen = shouldOpen;
    gameState.paused = shouldOpen;
    if (elements.gamePlayMenu) {
      elements.gamePlayMenu.classList.toggle("is-open", shouldOpen);
      elements.gamePlayMenu.setAttribute("aria-hidden", String(!shouldOpen));
    }
  }

  function runGamePlay() {
    if (!plays || !elements.gamePlaySelect) {
      return;
    }
    if (gameState.play.runner?.runner) {
      stopGameStepRunner({ silent: true });
    }
    const selection = elements.gamePlaySelect.value;
    if (selection.startsWith("designer:")) {
      const playId = selection.replace("designer:", "");
      const designerPlay = getDesignerPlayById(playId);
      if (!designerPlay) {
        return;
      }
      clearGameModePlay();
      startGameStepRunner(designerPlay);
      return;
    }
    const result = plays.runPlay(selection);
    if (!result) {
      return;
    }
    gameState.play.active = result;
    gameState.play.routes = result.play.routes || [];
    gameState.play.targets = {
      primary: result.primaryOption.spot,
      secondary: result.secondaryOption.spot
    };
    gameState.play.phase = "setup";
    gameState.play.expiresAt = performance.now() + gameConfig.playExpireMs;
    setGamePlayStatus(
      `${result.play.name} | Defense: ${result.reaction.name} | Open +${Math.round(
        result.play.openBonus * 100
      )}%`
    );
    if (result.play.fatigueCost) {
      const player = getControlledRosterPlayer();
      if (player) {
        player.fatigue = calc.clamp(
          (player.fatigue ?? 0) + result.play.fatigueCost,
          0,
          100
        );
      }
    }
    updateGameStats();
    toggleGamePlayMenu(false);
  }

  function clearGameModePlay() {
    gameState.play.active = null;
    gameState.play.routes = [];
    gameState.play.targets = null;
    gameState.play.phase = "idle";
    gameState.play.expiresAt = 0;
    gameState.play.designer = null;
    stopGameStepRunner({ silent: true });
    setGamePlayStatus("Awaiting play call.");
  }

  function updateGame(delta) {
    const metrics = getGameCourtMetrics();
    if (!metrics) {
      return;
    }
    if (gameState.possession.resetAt && performance.now() >= gameState.possession.resetAt) {
      resetGamePossession(false);
      return;
    }
    if (!gameState.paused) {
      updateGameShotClock(delta);
      if (gameState.play.runner?.runner) {
        gameState.play.runner.runner.tick(delta);
        recordGhostPositions();
      } else {
        updateUserMovement(delta, metrics);
        updateTeammates(delta, metrics);
        updateDefenders(delta, metrics);
        updateDesignerPlay(metrics);
        updateGamePlayPhase(metrics);
        updateBallPosition(metrics, delta);
        recordGhostPositions();
      }
    }
  }

  function gameLoop(timestamp) {
    if (!gameState.lastFrame) {
      gameState.lastFrame = timestamp;
    }
    const delta = Math.min((timestamp - gameState.lastFrame) / 1000, 0.05);
    gameState.lastFrame = timestamp;
    if (gameState.active) {
      updateGame(delta);
      drawGameCourt();
    }
    requestAnimationFrame(gameLoop);
  }

  function initGameMode() {
    gameState.canvas = elements.gameCourt;
    gameState.ctx = elements.gameCourt ? elements.gameCourt.getContext("2d") : null;
    if (!gameState.canvas || !gameState.ctx) {
      return;
    }
    populateGamePlaySelect();
    resetGamePossession(true);
    renderGameLog();
    setGameControlMode(gameState.mode);
    setGhostPathsEnabled(gameState.ghost.enabled);
    requestAnimationFrame(gameLoop);
  }

  function handleGameKeyDown(event) {
    if (!gameState.active) {
      return;
    }
    const numericKey = Number(event.key);
    if (Number.isInteger(numericKey) && numericKey >= 1 && numericKey <= 5) {
      event.preventDefault();
      if (!event.repeat) {
        handleNumberInput(numericKey);
      }
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    const runnerActive = Boolean(gameState.play.runner?.runner);
    if (event.code === "ArrowUp") {
      gameState.input.up = true;
    }
    if (event.code === "ArrowDown") {
      gameState.input.down = true;
    }
    if (event.code === "ArrowLeft") {
      gameState.input.left = true;
    }
    if (event.code === "ArrowRight") {
      gameState.input.right = true;
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      gameState.input.sprint = true;
    }
    if (event.code === "Space" && !gameState.actionsLocked.shot) {
      gameState.actionsLocked.shot = true;
      handleGameShot();
    }
    if (event.code === "KeyZ" && !gameState.actionsLocked.pass) {
      gameState.actionsLocked.pass = true;
      handleGamePass();
    }
    if (event.code === "KeyC") {
      handleDefensiveContest();
    }
    if (event.code === "KeyV") {
      handleDefensiveSteal();
    }
    if (event.code === "KeyX" && !gameState.actionsLocked.play && !runnerActive) {
      gameState.actionsLocked.play = true;
      toggleGamePlayMenu();
    }
  }

  function handleGameKeyUp(event) {
    if (event.code === "ArrowUp") {
      gameState.input.up = false;
    }
    if (event.code === "ArrowDown") {
      gameState.input.down = false;
    }
    if (event.code === "ArrowLeft") {
      gameState.input.left = false;
    }
    if (event.code === "ArrowRight") {
      gameState.input.right = false;
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      gameState.input.sprint = false;
    }
    if (event.code === "Space") {
      gameState.actionsLocked.shot = false;
    }
    if (event.code === "KeyZ") {
      gameState.actionsLocked.pass = false;
    }
    if (event.code === "KeyX") {
      gameState.actionsLocked.play = false;
    }
  }


  Object.assign(ui, {
    setGamePlayStatus,
    setGameControlMode,
    setGhostPathsEnabled,
    updateGameStats,
    renderGameLog,
    pushGameLog,
    populateGamePlaySelect,
    getDesignerPlayById,
    renderGameStepHud,
    applyRunnerStateToGame,
    startGameStepRunner,
    stopGameStepRunner,
    syncGameDefenders,
    resetGamePossession,
    scheduleGamePossessionReset,
    updateGameShotClock,
    handleShotClockViolation,
    updateGame,
    initGameMode,
    handleGameKeyDown,
    handleGameKeyUp,
    handleGameCourtTap,
    handleMobileJoystickStart,
    handleMobileJoystickMove,
    handleMobileJoystickEnd,
    triggerGameShot,
    toggleGamePlayMenu,
    runGamePlay,
    clearGameModePlay
  });

  return ui;
})();
