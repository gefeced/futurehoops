window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.stepRunner = (() => {
  const { calc, stepEditor } = window.FutureHoops;

  const defaultStepDuration = 2.0;
  const passSpeed = 0.9;
  const defaultDefenseSpeed = 0.35;

  const clamp = (value, min, max) => {
    if (calc?.clamp) {
      return calc.clamp(value, min, max);
    }
    return Math.min(Math.max(value, min), max);
  };

  const buildPoint = (point, fallback) => {
    const x = Number.isFinite(point?.x) ? point.x : fallback?.x ?? 0.5;
    const y = Number.isFinite(point?.y) ? point.y : fallback?.y ?? 0.7;
    return {
      x: clamp(x, 0.02, 0.98),
      y: clamp(y, 0.02, 0.98)
    };
  };

  const getPointAlongPath = (points, progress) => {
    if (!points.length) {
      return null;
    }
    if (points.length === 1) {
      return points[0];
    }
    const clamped = clamp(progress, 0, 1);
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
  };

  const moveTowards = (pos, target, speed, delta) => {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (!Number.isFinite(dist) || dist < 0.0001) {
      return pos;
    }
    const step = Math.min(dist, speed * delta);
    return {
      x: clamp(pos.x + (dx / dist) * step, 0.02, 0.98),
      y: clamp(pos.y + (dy / dist) * step, 0.02, 0.98)
    };
  };

  class StepRunner {
    constructor(play, { mode = "AUTO", onUpdate, onStepChange, onFinish, context = {} } = {}) {
      this.play = play;
      this.mode = mode === "MANUAL" ? "MANUAL" : "AUTO";
      this.onUpdate = typeof onUpdate === "function" ? onUpdate : null;
      this.onStepChange = typeof onStepChange === "function" ? onStepChange : null;
      this.onFinish = typeof onFinish === "function" ? onFinish : null;
      this.context = context || {};
      this.passSpeed = Math.max(
        0.05,
        Number.isFinite(this.context.passSpeed) ? this.context.passSpeed : passSpeed
      );
      this.defenseSpeed = Math.max(
        0.05,
        Number.isFinite(this.context.defenseSpeed)
          ? this.context.defenseSpeed
          : defaultDefenseSpeed
      );
      this.defaultDuration = Number.isFinite(this.context.defaultStepDuration)
        ? this.context.defaultStepDuration
        : defaultStepDuration;
      this.defenseEnabled = this.context.defenseEnabled !== false;
      this.warned = new Set();
      this.reset();
    }

    reset() {
      this.currentStepIndex = 0;
      this.stepElapsed = 0;
      this.isPaused = false;
      this.isFinished = false;
      this.playerStates = new Map();
      this.ballState = { x: 0.5, y: 0.7, holderPid: null };
      this.moveActions = [];
      this.passActions = [];
      this.screenActions = [];
      this.activePass = null;
      this.defenseAssignments = new Map();
      this.screenSet = new Set();
      this.stepComplete = false;
      this.loadStep(0, true);
    }

    warnOnce(key, message) {
      if (this.warned.has(key)) {
        return;
      }
      this.warned.add(key);
      if (console?.warn) {
        console.warn(message);
      }
    }

    getStepCount() {
      return Array.isArray(this.play?.steps) ? this.play.steps.length : 0;
    }

    getCurrentStep() {
      if (!Array.isArray(this.play?.steps)) {
        return null;
      }
      return this.play.steps[this.currentStepIndex] || null;
    }

    getStatus() {
      const step = this.getCurrentStep();
      const duration = Number.isFinite(step?.durationSec) ? step.durationSec : this.defaultDuration;
      return {
        stepIndex: this.currentStepIndex,
        stepCount: this.getStepCount(),
        elapsed: clamp(this.stepElapsed, 0, duration),
        duration,
        mode: this.mode,
        isPaused: this.isPaused,
        isFinished: this.isFinished
      };
    }

    getRuntimeState() {
      const players = [];
      this.playerStates.forEach((value, pid) => {
        players.push({ pid, ...value });
      });
      return {
        players,
        ball: { ...this.ballState },
        screenSet: new Set(this.screenSet),
        stepIndex: this.currentStepIndex,
        step: this.getCurrentStep(),
        elapsed: this.stepElapsed
      };
    }

    setMode(mode) {
      this.mode = mode === "MANUAL" ? "MANUAL" : "AUTO";
    }

    pause() {
      this.isPaused = true;
    }

    resume() {
      this.isPaused = false;
    }

    togglePause() {
      this.isPaused = !this.isPaused;
    }

    stop(reason = "stopped") {
      if (this.isFinished) {
        return;
      }
      this.isFinished = true;
      if (this.onFinish) {
        this.onFinish({ reason });
      }
    }

    nextStep() {
      if (this.currentStepIndex >= this.getStepCount() - 1) {
        this.stop("finished");
        return;
      }
      this.finalizeStep();
      this.loadStep(this.currentStepIndex + 1);
    }

    prevStep() {
      const prevIndex = Math.max(0, this.currentStepIndex - 1);
      this.loadStep(prevIndex);
    }

    goToStep(index) {
      const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, this.getStepCount() - 1));
      this.loadStep(safeIndex);
    }

    loadStep(index, initial = false) {
      if (!this.play || !Array.isArray(this.play.steps) || !this.play.steps.length) {
        this.warnOnce("no-steps", "[StepRunner] Play has no steps to run.");
        this.stop("invalid");
        return;
      }
      const safeIndex = Math.max(0, Math.min(index, this.play.steps.length - 1));
      this.currentStepIndex = safeIndex;
      this.stepElapsed = 0;
      this.stepComplete = false;
      this.activePass = null;
      this.screenSet = new Set();
      if (stepEditor?.ensureStepSnapshots) {
        stepEditor.ensureStepSnapshots(this.play, safeIndex);
      }
      const step = this.play.steps[safeIndex];
      this.applySnapshots(step);
      this.prepareActions(step);
      this.prepareDefenseAssignments();
      if (!initial && this.onStepChange) {
        this.onStepChange({ step, index: safeIndex });
      }
      if (this.onUpdate) {
        this.onUpdate(this.getRuntimeState());
      }
    }

    applySnapshots(step) {
      this.playerStates.clear();
      const fallbackPlayers = Array.isArray(this.play?.players) ? this.play.players : [];
      fallbackPlayers.forEach((player) => {
        if (!player?.id) {
          return;
        }
        const point = buildPoint(player, player);
        const behavior =
          player?.team === "defense" && player?.behavior === "ai" ? "ai" : "route";
        this.playerStates.set(player.id, {
          x: point.x,
          y: point.y,
          team: player.team,
          behavior
        });
      });

      if (step?.snapshots?.players) {
        Object.entries(step.snapshots.players).forEach(([pid, point]) => {
          if (!pid) {
            return;
          }
          const existing = this.playerStates.get(pid);
          const fallback = existing || { x: 0.5, y: 0.7 };
          const built = buildPoint(point, fallback);
          const team = existing?.team || "offense";
          const behavior = existing?.behavior || (team === "defense" ? "route" : "route");
          this.playerStates.set(pid, { x: built.x, y: built.y, team, behavior });
        });
      }

      const snapBall = step?.snapshots?.ball;
      const ballFromPlay = this.play?.ball || {};
      let holderPid =
        typeof snapBall?.holderPid === "string"
          ? snapBall.holderPid
          : typeof ballFromPlay.holderPid === "string"
            ? ballFromPlay.holderPid
            : typeof ballFromPlay.start?.attachedTo === "string"
              ? ballFromPlay.start.attachedTo
              : null;
      if (holderPid && !this.playerStates.has(holderPid)) {
        holderPid = null;
      }
      const fallbackBall = {
        x: ballFromPlay.x ?? ballFromPlay.start?.x ?? 0.5,
        y: ballFromPlay.y ?? ballFromPlay.start?.y ?? 0.7
      };
      const ballPoint = buildPoint(snapBall, fallbackBall);
      this.ballState = {
        x: ballPoint.x,
        y: ballPoint.y,
        holderPid
      };
      if (holderPid && this.playerStates.has(holderPid)) {
        const holder = this.playerStates.get(holderPid);
        this.ballState.x = holder.x;
        this.ballState.y = holder.y;
      }
    }

    prepareActions(step) {
      this.moveActions = [];
      this.passActions = [];
      this.screenActions = [];
      if (!Array.isArray(step?.actions)) {
        return;
      }
      const duration = Number.isFinite(step.durationSec) ? step.durationSec : this.defaultDuration;
      step.actions.forEach((action) => {
        if (!action || typeof action !== "object") {
          return;
        }
        if (action.type === "MOVE_ROUTE") {
          const pid = typeof action.pid === "string" ? action.pid : null;
          if (!pid || !this.playerStates.has(pid)) {
            this.warnOnce(`move-${action.id || pid}`, "[StepRunner] MOVE_ROUTE has invalid pid.");
            return;
          }
          const points = Array.isArray(action.points)
            ? action.points
                .map((point) => buildPoint(point, this.playerStates.get(pid)))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            : [];
          if (points.length < 1) {
            this.warnOnce(`move-${action.id || pid}-points`, "[StepRunner] MOVE_ROUTE missing points.");
            return;
          }
          const start = this.playerStates.get(pid);
          if (start && Math.hypot(points[0].x - start.x, points[0].y - start.y) > 0.001) {
            points.unshift({ x: start.x, y: start.y });
          }
          const startAtSec = clamp(Number(action.startAtSec ?? 0), 0, duration);
          const span = Math.max(0.05, duration - startAtSec);
          if (startAtSec >= duration - 0.01) {
            this.warnOnce(
              `move-${action.id || pid}-late`,
              "[StepRunner] MOVE_ROUTE starts after step duration."
            );
          }
          this.moveActions.push({
            id: action.id || `move-${pid}`,
            pid,
            points,
            startAtSec,
            durationSec: span,
            done: false
          });
          return;
        }
        if (action.type === "PASS") {
          const fromPid = typeof action.fromPid === "string" ? action.fromPid : null;
          const toPid = typeof action.toPid === "string" ? action.toPid : null;
          if (!fromPid || !toPid) {
            this.warnOnce(
              `pass-${action.id || "unknown"}`,
              "[StepRunner] PASS missing from/to pid."
            );
            return;
          }
          const passAtSec = clamp(Number(action.passAtSec ?? 0.5), 0, duration);
          this.passActions.push({
            id: action.id || `pass-${fromPid}-${toPid}`,
            fromPid,
            toPid,
            passAtSec,
            state: "pending"
          });
          return;
        }
        if (action.type === "SCREEN_TAG") {
          const pid = typeof action.pid === "string" ? action.pid : null;
          if (!pid || !this.playerStates.has(pid)) {
            this.warnOnce(
              `screen-${action.id || pid}`,
              "[StepRunner] SCREEN_TAG has invalid pid."
            );
            return;
          }
          const startAtSec = clamp(Number(action.startAtSec ?? 0), 0, duration);
          const endAtSec = Number.isFinite(action.endAtSec) ? action.endAtSec : null;
          this.screenActions.push({
            id: action.id || `screen-${pid}`,
            pid,
            active: action.active !== false,
            startAtSec,
            endAtSec
          });
        }
      });
    }

    prepareDefenseAssignments() {
      if (!this.defenseEnabled) {
        this.defenseAssignments.clear();
        return;
      }
      const offense = [];
      const defense = [];
      this.playerStates.forEach((player, pid) => {
        if (player.team === "defense") {
          defense.push({ pid, ...player });
        } else {
          offense.push({ pid, ...player });
        }
      });
      defense.forEach((defender) => {
        if (defender.behavior !== "ai") {
          this.defenseAssignments.delete(defender.pid);
          return;
        }
        if (this.defenseAssignments.has(defender.pid)) {
          const existing = this.defenseAssignments.get(defender.pid);
          if (offense.some((player) => player.pid === existing)) {
            return;
          }
        }
        let best = null;
        let bestDist = Infinity;
        offense.forEach((player) => {
          const dx = player.x - defender.x;
          const dy = player.y - defender.y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = player.pid;
          }
        });
        if (best) {
          this.defenseAssignments.set(defender.pid, best);
        }
      });
    }

    updateDefenseAI(delta, step) {
      if (!this.defenseEnabled) {
        return;
      }
      const moveOverride = new Set(
        this.moveActions.map((action) => action.pid)
      );
      this.playerStates.forEach((player, pid) => {
        if (player.team !== "defense") {
          return;
        }
        if (player.behavior !== "ai") {
          return;
        }
        if (moveOverride.has(pid)) {
          return;
        }
        const assignment = this.defenseAssignments.get(pid);
        if (!assignment || !this.playerStates.has(assignment)) {
          return;
        }
        const offense = this.playerStates.get(assignment);
        const ball = this.ballState;
        const guardX = offense.x * 0.6 + ball.x * 0.4;
        const guardY = offense.y * 0.6 + ball.y * 0.4;
        const target = {
          x: clamp(guardX, 0.02, 0.98),
          y: clamp(guardY, 0.02, 0.98)
        };
        const next = moveTowards(player, target, this.defenseSpeed, delta);
        this.playerStates.set(pid, { ...player, x: next.x, y: next.y });
      });
    }

    updateMoves(step) {
      const duration = Number.isFinite(step?.durationSec) ? step.durationSec : this.defaultDuration;
      this.moveActions.forEach((action) => {
        if (action.done) {
          return;
        }
        if (action.startAtSec >= duration) {
          action.done = true;
          return;
        }
        if (this.stepElapsed < action.startAtSec) {
          return;
        }
        const progress = action.durationSec
          ? (this.stepElapsed - action.startAtSec) / action.durationSec
          : 1;
        const point = getPointAlongPath(action.points, progress);
        if (point) {
          const player = this.playerStates.get(action.pid);
          if (player) {
            this.playerStates.set(action.pid, {
              ...player,
              x: point.x,
              y: point.y
            });
          }
        }
        if (progress >= 1 || this.stepElapsed >= duration) {
          action.done = true;
        }
      });
    }

    startPass(action) {
      const from = this.playerStates.get(action.fromPid);
      const to = this.playerStates.get(action.toPid);
      if (!from || !to) {
        this.warnOnce(
          `pass-${action.id}-missing`,
          "[StepRunner] PASS missing from/to players."
        );
        action.state = "done";
        return;
      }
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const duration = Math.max(distance / this.passSpeed, 0.1);
      this.activePass = {
        actionId: action.id,
        fromPid: action.fromPid,
        toPid: action.toPid,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        startedAt: this.stepElapsed,
        duration
      };
      action.state = "active";
      this.ballState.holderPid = null;
    }

    updatePasses(step) {
      const duration = Number.isFinite(step?.durationSec) ? step.durationSec : this.defaultDuration;
      if (this.activePass) {
        const flight = this.activePass;
        const progress = clamp(
          (this.stepElapsed - flight.startedAt) / flight.duration,
          0,
          1
        );
        this.ballState.x = flight.from.x + (flight.to.x - flight.from.x) * progress;
        this.ballState.y = flight.from.y + (flight.to.y - flight.from.y) * progress;
        if (progress >= 1) {
          this.ballState.holderPid = flight.toPid;
          const receiver = this.playerStates.get(flight.toPid);
          if (receiver) {
            this.ballState.x = receiver.x;
            this.ballState.y = receiver.y;
          }
          const action = this.passActions.find((item) => item.id === flight.actionId);
          if (action) {
            action.state = "done";
          }
          this.activePass = null;
        }
      }

      this.passActions.forEach((action) => {
        if (action.state !== "pending") {
          return;
        }
        if (action.passAtSec > duration) {
          this.warnOnce(
            `pass-${action.id}-late`,
            "[StepRunner] PASS scheduled after step duration."
          );
          action.state = "done";
          return;
        }
        if (this.stepElapsed >= action.passAtSec && !this.activePass) {
          this.startPass(action);
        }
      });

      if (!this.activePass && this.ballState.holderPid) {
        const holder = this.playerStates.get(this.ballState.holderPid);
        if (holder) {
          this.ballState.x = holder.x;
          this.ballState.y = holder.y;
        }
      }
    }

    updateScreens(step) {
      const duration = Number.isFinite(step?.durationSec) ? step.durationSec : this.defaultDuration;
      this.screenSet = new Set();
      this.screenActions.forEach((action) => {
        if (!action.active) {
          return;
        }
        const endAt = Number.isFinite(action.endAtSec) ? action.endAtSec : duration;
        if (this.stepElapsed >= action.startAtSec && this.stepElapsed <= endAt) {
          this.screenSet.add(action.pid);
        }
      });
    }

    finalizeStep() {
      const snapshot = {
        players: {},
        ball: {
          x: this.ballState.x,
          y: this.ballState.y,
          holderPid: this.ballState.holderPid
        }
      };
      this.playerStates.forEach((player, pid) => {
        snapshot.players[pid] = { x: player.x, y: player.y };
      });
      const nextStep = this.play?.steps?.[this.currentStepIndex + 1];
      if (nextStep) {
        if (!nextStep.snapshots || typeof nextStep.snapshots !== "object") {
          nextStep.snapshots = { players: {}, ball: {} };
        }
        if (!nextStep.snapshots.players || typeof nextStep.snapshots.players !== "object") {
          nextStep.snapshots.players = {};
        }
        Object.entries(snapshot.players).forEach(([pid, point]) => {
          if (!nextStep.snapshots.players[pid]) {
            nextStep.snapshots.players[pid] = { x: point.x, y: point.y };
          }
        });
        if (!nextStep.snapshots.ball || typeof nextStep.snapshots.ball !== "object") {
          nextStep.snapshots.ball = { ...snapshot.ball };
        } else {
          if (!Number.isFinite(nextStep.snapshots.ball.x)) {
            nextStep.snapshots.ball.x = snapshot.ball.x;
          }
          if (!Number.isFinite(nextStep.snapshots.ball.y)) {
            nextStep.snapshots.ball.y = snapshot.ball.y;
          }
          if (
            typeof nextStep.snapshots.ball.holderPid !== "string" &&
            snapshot.ball.holderPid
          ) {
            nextStep.snapshots.ball.holderPid = snapshot.ball.holderPid;
          }
        }
      }
    }

    tick(delta) {
      if (this.isPaused || this.isFinished) {
        return;
      }
      const step = this.getCurrentStep();
      if (!step) {
        this.stop("invalid");
        return;
      }
      const duration = Number.isFinite(step.durationSec) ? step.durationSec : this.defaultDuration;
      this.stepElapsed += delta;
      this.updateMoves(step);
      this.updateDefenseAI(delta, step);
      this.updatePasses(step);
      this.updateScreens(step);

      const hasActions =
        this.moveActions.length || this.passActions.length || this.screenActions.length;
      const movesDone = this.moveActions.every((action) => action.done);
      const passesDone = this.passActions.every((action) => action.state === "done");
      const screensDone = this.screenActions.every((action) => {
        if (!action.active) {
          return true;
        }
        const endAt = Number.isFinite(action.endAtSec) ? action.endAtSec : duration;
        return this.stepElapsed >= endAt;
      });
      const allDone = hasActions && movesDone && passesDone && screensDone;
      if (this.stepElapsed >= duration || allDone) {
        this.stepComplete = true;
        this.stepElapsed = Math.min(this.stepElapsed, duration);
      }

      if (this.stepComplete && this.mode === "AUTO") {
        if (this.currentStepIndex >= this.getStepCount() - 1) {
          this.finalizeStep();
          this.stop("finished");
          return;
        }
        this.finalizeStep();
        this.loadStep(this.currentStepIndex + 1);
        return;
      }

      if (this.onUpdate) {
        this.onUpdate(this.getRuntimeState());
      }
    }
  }

  return {
    StepRunner,
    passSpeed,
    defaultStepDuration,
    defaultDefenseSpeed
  };
})();
