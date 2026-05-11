window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiSim = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements, courtState, playState } = state;
  const { calc, sim, plays } = window.FutureHoops;

  function getCourtMetrics() {
    if (!courtState.canvas) {
      return null;
    }
    const width = courtState.canvas.width;
    const height = courtState.canvas.height;
    const hoopX = width / 2;
    const hoopY = height - 34;
    const arcRadius = width * 0.42;
    const keyWidth = width * 0.26;
    const keyHeight = height * 0.42;
    const layupRadius = arcRadius * 0.26;
    const midRadius = arcRadius * 0.72;
    return {
      width,
      height,
      hoopX,
      hoopY,
      arcRadius,
      keyWidth,
      keyHeight,
      layupRadius,
      midRadius
    };
  }

  function toCanvasPoint(point, metrics) {
    return {
      x: point[0] * metrics.width,
      y: point[1] * metrics.height
    };
  }

  function drawPartialPath(ctx, points, progress) {
    if (points.length < 2) {
      return;
    }
    const clamped = calc.clamp(progress, 0, 1);
    let total = 0;
    const segments = [];
    for (let i = 1; i < points.length; i += 1) {
      const length = Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y
      );
      segments.push({ length, from: points[i - 1], to: points[i] });
      total += length;
    }
    const target = total * clamped;
    let traveled = 0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (traveled + segment.length >= target) {
        const remaining = target - traveled;
        const ratio = segment.length === 0 ? 0 : remaining / segment.length;
        const x = segment.from.x + (segment.to.x - segment.from.x) * ratio;
        const y = segment.from.y + (segment.to.y - segment.from.y) * ratio;
        ctx.lineTo(x, y);
        break;
      } else {
        ctx.lineTo(segment.to.x, segment.to.y);
        traveled += segment.length;
      }
    }
    ctx.stroke();
  }

  function getPointAlongPath(points, progress) {
    if (points.length === 0) {
      return null;
    }
    if (points.length === 1) {
      return points[0];
    }
    const clamped = calc.clamp(progress, 0, 1);
    let total = 0;
    const segments = [];
    for (let i = 1; i < points.length; i += 1) {
      const length = Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y
      );
      segments.push({ length, from: points[i - 1], to: points[i] });
      total += length;
    }
    const target = total * clamped;
    let traveled = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (traveled + segment.length >= target) {
        const remaining = target - traveled;
        const ratio = segment.length === 0 ? 0 : remaining / segment.length;
        return {
          x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
          y: segment.from.y + (segment.to.y - segment.from.y) * ratio
        };
      }
      traveled += segment.length;
    }
    return points[points.length - 1];
  }

  function drawPlayRoutes(ctx, metrics, progress) {
    if (!courtState.playRoutes.length) {
      return;
    }
    courtState.playRoutes.forEach((route) => {
      const points = route.points.map((point) => toCanvasPoint(point, metrics));
      ctx.lineWidth = 2;
      ctx.strokeStyle = route.color || "rgba(57, 246, 255, 0.6)";
      ctx.setLineDash([8, 6]);
      drawPartialPath(ctx, points, progress);
      ctx.setLineDash([]);
    });
  }

  function drawPlayTargets(ctx, metrics) {
    if (!courtState.playTargets) {
      return;
    }
    const { primary, secondary } = courtState.playTargets;
    const primaryPoint = toCanvasPoint(primary, metrics);
    const secondaryPoint = toCanvasPoint(secondary, metrics);

    ctx.beginPath();
    ctx.strokeStyle = "#4cff9a";
    ctx.lineWidth = 2;
    ctx.arc(primaryPoint.x, primaryPoint.y, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#8d5bff";
    ctx.lineWidth = 2;
    ctx.arc(secondaryPoint.x, secondaryPoint.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawManualPath(ctx) {
    if (courtState.manualPath.length < 2) {
      return;
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(courtState.manualPath[0].x, courtState.manualPath[0].y);
    for (let i = 1; i < courtState.manualPath.length; i += 1) {
      ctx.lineTo(courtState.manualPath[i].x, courtState.manualPath[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCourt() {
    if (!courtState.ctx) {
      return;
    }
    const ctx = courtState.ctx;
    const metrics = getCourtMetrics();
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
      midRadius
    } = metrics;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(6, 10, 20, 0.9)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(57, 246, 255, 0.35)";
    ctx.lineWidth = 2;

    const padding = 14;
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

    const now = performance.now();
    let progress = 1;
    if (courtState.playAnimationStart) {
      progress =
        (now - courtState.playAnimationStart) / courtState.playAnimationDuration;
      if (progress >= 1) {
        progress = 1;
        courtState.playAnimationStart = null;
      }
    }

    drawPlayRoutes(ctx, metrics, progress);
    drawPlayTargets(ctx, metrics);
    drawManualPath(ctx);

    courtState.markers.forEach((marker) => {
      ctx.beginPath();
      ctx.fillStyle = marker.color;
      ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderCourt() {
    if (courtState.animating) {
      return;
    }
    courtState.animating = true;
    const tick = () => {
      drawCourt();
      if (courtState.playAnimationStart || courtState.drawing) {
        requestAnimationFrame(tick);
      } else {
        courtState.animating = false;
      }
    };
    requestAnimationFrame(tick);
  }

  function addShotMarker(x, y, result) {
    const color = result === "make" ? "#4cff9a" : "#ff7f6b";
    courtState.markers.push({ x, y, color });
    if (courtState.markers.length > 120) {
      courtState.markers.shift();
    }
    renderCourt();
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

  function getContestAngleFactor(x, y, metrics) {
    const defenderX = metrics.hoopX;
    const defenderY = metrics.hoopY - metrics.keyHeight * 0.75;
    const shotVecX = x - metrics.hoopX;
    const shotVecY = y - metrics.hoopY;
    const defVecX = defenderX - metrics.hoopX;
    const defVecY = defenderY - metrics.hoopY;
    const shotMag = Math.hypot(shotVecX, shotVecY);
    const defMag = Math.hypot(defVecX, defVecY);
    if (shotMag === 0 || defMag === 0) {
      return 1;
    }
    const dot = shotVecX * defVecX + shotVecY * defVecY;
    const angle = Math.acos(calc.clamp(dot / (shotMag * defMag), -1, 1));
    return calc.clamp(1 - angle / Math.PI, 0, 1);
  }

  function handleCourtShot(x, y) {
    if (!sim) {
      return;
    }
    const metrics = getCourtMetrics();
    if (!metrics) {
      return;
    }
    const distance = Math.hypot(x - metrics.hoopX, y - metrics.hoopY);
    const shotType = getShotTypeFromDistance(distance, metrics);
    const difficulty = getShotDifficulty(distance, shotType, metrics);
    const contestAngle = getContestAngleFactor(x, y, metrics);
    const result = sim.takeAction("shot", {
      shotType,
      difficulty,
      contestAngle
    });
    if (result?.entry) {
      addShotMarker(x, y, result.entry.result);
      ui.refreshActivePlayer?.();
      renderSimLog(sim.getLog());
    }
  }

  function handleCourtClick(event) {
    if (!courtState.canvas) {
      return;
    }
    if (courtState.drawMode) {
      return;
    }
    const rect = courtState.canvas.getBoundingClientRect();
    const scaleX = courtState.canvas.width / rect.width;
    const scaleY = courtState.canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    handleCourtShot(x, y);
  }

  function generateAiShotLocation() {
    const metrics = getCourtMetrics();
    if (!metrics) {
      return null;
    }
    const shotRoll = Math.random();
    const shotType = shotRoll > 0.7 ? "three" : shotRoll > 0.35 ? "mid" : "layup";
    let radius;
    if (shotType === "three") {
      radius = metrics.arcRadius * (1.05 + Math.random() * 0.2);
    } else if (shotType === "mid") {
      radius = metrics.layupRadius * 1.3 + Math.random() * (metrics.arcRadius * 0.45);
    } else {
      radius = Math.random() * (metrics.layupRadius * 0.9);
    }
    const angle = -Math.PI * (0.9 - Math.random() * 0.8);
    const x = metrics.hoopX + Math.cos(angle) * radius;
    const y = metrics.hoopY + Math.sin(angle) * radius;
    return {
      x: calc.clamp(x, 20, metrics.width - 20),
      y: calc.clamp(y, 20, metrics.height - 20)
    };
  }

  function calculatePathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
  }

  function setPlayInfo(message) {
    if (elements.playInfo) {
      elements.playInfo.textContent = message;
    }
  }

  function setOpportunityButtons(active) {
    const enabled = Boolean(active);
    if (elements.shootPrimary) {
      elements.shootPrimary.disabled = !enabled;
    }
    if (elements.passSecondary) {
      elements.passSecondary.disabled = !enabled;
    }
    if (elements.resetPlay) {
      elements.resetPlay.disabled = !enabled;
    }
    if (!active) {
      if (elements.shootPrimary) {
        elements.shootPrimary.textContent = "Shoot Primary";
      }
      if (elements.passSecondary) {
        elements.passSecondary.textContent = "Pass Secondary";
      }
      return;
    }
    const primaryLabel = `${active.primaryOption.label} (${active.primaryOption.shotType.toUpperCase()})`;
    const secondaryLabel = `${active.secondaryOption.label} (${active.secondaryOption.shotType.toUpperCase()})`;
    if (elements.shootPrimary) {
      elements.shootPrimary.textContent = `Shoot ${primaryLabel}`;
    }
    if (elements.passSecondary) {
      elements.passSecondary.textContent = `Pass ${secondaryLabel}`;
    }
  }

  function setPlayRoutes(playResult) {
    if (!playResult?.play) {
      courtState.playRoutes = [];
      courtState.playTargets = null;
      renderCourt();
      return;
    }
    courtState.playRoutes = playResult.play.routes || [];
    courtState.playTargets = {
      primary: playResult.primaryOption.spot,
      secondary: playResult.secondaryOption.spot
    };
    courtState.playAnimationStart = performance.now();
    renderCourt();
  }

  function clearPlayState() {
    playState.active = null;
    courtState.playRoutes = [];
    courtState.playTargets = null;
    courtState.playAnimationStart = null;
    setOpportunityButtons(null);
    setPlayInfo("Awaiting play call.");
    renderCourt();
  }

  function applyPlayFatigue(amount) {
    const player = ui.getActivePlayer?.();
    if (!player) {
      return;
    }
    player.fatigue = calc.clamp((player.fatigue ?? 0) + amount, 0, 100);
    ui.updateFatigue?.(player.fatigue);
    const performance = ui.updatePercentages ? ui.updatePercentages(player) : null;
    if (performance) {
      ui.refreshRatingPercents?.(performance);
    }
  }

  function runSelectedPlay() {
    if (!plays || !elements.playSelect) {
      return;
    }
    if (courtState.drawMode) {
      toggleDrawMode();
    }
    const selection = elements.playSelect.value;
    const result = plays.runPlay(selection);
    if (!result) {
      return;
    }
    playState.active = result;
    applyPlayFatigue(result.play.fatigueCost || 0);
    setPlayRoutes(result);
    setOpportunityButtons(result);
    setPlayInfo(
      `${result.play.name} | Defense: ${result.reaction.name} | Open +${Math.round(
        result.play.openBonus * 100
      )}%`
    );
  }

  function populatePlaySelect() {
    if (!plays || !elements.playSelect) {
      return;
    }
    elements.playSelect.innerHTML = "";
    plays.getPlayNames().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      elements.playSelect.appendChild(option);
    });
  }

  function takePlayShot(optionKey) {
    if (!sim || !playState.active) {
      return;
    }
    const option =
      optionKey === "secondary"
        ? playState.active.secondaryOption
        : playState.active.primaryOption;
    const metrics = getCourtMetrics();
    if (!metrics) {
      return;
    }
    const target = toCanvasPoint(option.spot, metrics);
    const distance = Math.hypot(target.x - metrics.hoopX, target.y - metrics.hoopY);
    const baseDifficulty = getShotDifficulty(distance, option.shotType, metrics);
    const openBonus = playState.active.play.openBonus || 0;
    const adjustedDifficulty = calc.clamp(
      baseDifficulty + playState.active.reaction.difficultyDelta - openBonus * 100,
      0,
      100
    );
    const contestAngle = getContestAngleFactor(target.x, target.y, metrics);
    const contestBoost =
      (playState.active.reaction.contestBoost || 0) - openBonus * 0.4;
    const turnoverBoost =
      (playState.active.play.turnoverRisk || 0) +
      (playState.active.reaction.turnoverBoost || 0);
    const result = sim.takeAction("shot", {
      shotType: option.shotType,
      difficulty: adjustedDifficulty,
      contestAngle,
      contestBoost,
      turnoverBoost
    });
    if (result?.entry) {
      addShotMarker(target.x, target.y, result.entry.result);
      ui.refreshActivePlayer?.();
      renderSimLog(sim.getLog());
    }
    clearPlayState();
  }

  function toggleDrawMode() {
    courtState.drawMode = !courtState.drawMode;
    courtState.manualPath = [];
    if (courtState.drawMode) {
      clearPlayState();
    }
    if (elements.courtCanvas) {
      elements.courtCanvas.classList.toggle("court-canvas--draw", courtState.drawMode);
    }
    if (elements.drawPlayToggle) {
      elements.drawPlayToggle.textContent = courtState.drawMode ? "Draw Play: On" : "Draw Play";
    }
    renderCourt();
  }

  function getCanvasPointFromEvent(event) {
    if (!courtState.canvas) {
      return null;
    }
    const rect = courtState.canvas.getBoundingClientRect();
    const scaleX = courtState.canvas.width / rect.width;
    const scaleY = courtState.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function handleDrawStart(event) {
    if (!courtState.drawMode) {
      return;
    }
    event.preventDefault();
    const point = getCanvasPointFromEvent(event);
    if (!point) {
      return;
    }
    courtState.drawing = true;
    courtState.manualPath = [point];
    renderCourt();
  }

  function handleDrawMove(event) {
    if (!courtState.drawMode || !courtState.drawing) {
      return;
    }
    event.preventDefault();
    const point = getCanvasPointFromEvent(event);
    if (!point) {
      return;
    }
    const last = courtState.manualPath[courtState.manualPath.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 4) {
      courtState.manualPath.push(point);
      renderCourt();
    }
  }

  function handleDrawEnd() {
    if (!courtState.drawMode || !courtState.drawing) {
      return;
    }
    courtState.drawing = false;
    if (!sim) {
      return;
    }
    if (courtState.manualPath.length < 2) {
      return;
    }
    const metrics = getCourtMetrics();
    if (!metrics) {
      return;
    }
    const lastPoint = courtState.manualPath[courtState.manualPath.length - 1];
    const distance = Math.hypot(lastPoint.x - metrics.hoopX, lastPoint.y - metrics.hoopY);
    const shotType = getShotTypeFromDistance(distance, metrics);
    const baseDifficulty = getShotDifficulty(distance, shotType, metrics);
    const pathLength = calculatePathLength(courtState.manualPath);
    const openness = calc.clamp(pathLength / (metrics.arcRadius * 2.8), 0.04, 0.2);
    const adjustedDifficulty = calc.clamp(baseDifficulty - openness * 100, 0, 100);
    const contestAngle = getContestAngleFactor(lastPoint.x, lastPoint.y, metrics);
    const result = sim.takeAction("shot", {
      shotType,
      difficulty: adjustedDifficulty,
      contestAngle,
      contestBoost: -openness * 0.4,
      turnoverBoost: -openness * 0.05
    });
    if (result?.entry) {
      addShotMarker(lastPoint.x, lastPoint.y, result.entry.result);
      ui.refreshActivePlayer?.();
      renderSimLog(sim.getLog());
      setPlayInfo(
        `Manual play | Open +${Math.round(openness * 100)}% | ${shotType.toUpperCase()}`
      );
    }
    courtState.manualPath = [];
    renderCourt();
  }

  function syncDefenderMode() {
    if (!elements.defenderMode || !sim) {
      return;
    }
    const mode = elements.defenderMode.value;
    sim.setDefenderMode(mode);
    const manualEnabled = mode === "manual";
    [elements.defenderRating, elements.contestLevel, elements.shotDifficulty].forEach(
      (input) => {
        if (input) {
          input.disabled = !manualEnabled;
        }
      }
    );
    if (manualEnabled) {
      syncDefenderValues();
    }
  }

  function syncDefenderValues() {
    if (!sim) {
      return;
    }
    const rating = Number(elements.defenderRating?.value ?? 0);
    const contest = Number(elements.contestLevel?.value ?? 0);
    const difficulty = Number(elements.shotDifficulty?.value ?? 0);

    if (elements.defenderRatingValue) {
      elements.defenderRatingValue.textContent = String(rating);
    }
    if (elements.contestLevelValue) {
      elements.contestLevelValue.textContent = contest.toFixed(2);
    }
    if (elements.shotDifficultyValue) {
      elements.shotDifficultyValue.textContent = String(difficulty);
    }

    sim.setManualDefender({
      rating,
      contest,
      difficulty
    });
  }

  function renderSimLog(logEntries) {
    if (!elements.simLog) {
      return;
    }
    elements.simLog.innerHTML = "";
    const entries = logEntries.slice(-12);
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "sim-log-row";
      const action = document.createElement("span");
      action.textContent = entry.action.toUpperCase();
      const shot = document.createElement("span");
      shot.textContent = entry.shotType.toUpperCase();
      const result = document.createElement("span");
      result.className = `sim-log-result sim-log-result--${entry.result}`;
      result.textContent = entry.result.toUpperCase();
      row.appendChild(action);
      row.appendChild(shot);
      row.appendChild(result);
      fragment.appendChild(row);
    });
    elements.simLog.appendChild(fragment);
  }

  Object.assign(ui, {
    drawCourt,
    renderCourt,
    populatePlaySelect,
    clearPlayState,
    toggleDrawMode,
    runSelectedPlay,
    takePlayShot,
    handleCourtClick,
    handleCourtShot,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd,
    generateAiShotLocation,
    syncDefenderMode,
    syncDefenderValues,
    renderSimLog
  });

  return ui;
})();
