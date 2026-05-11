window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.sim = (() => {
  const { calc, data } = window.FutureHoops;
  const state = {
    currentPossession: null,
    possessionCount: 0,
    possessionLog: [],
    defenderMode: "ai",
    manualDefender: {
      rating: 70,
      contest: 0.5,
      difficulty: 45
    }
  };

  const teammates = [
    {
      name: "Delta",
      ratings: { three: 76, mid: 72, layup: 74, ft: 80 }
    },
    {
      name: "Circuit",
      ratings: { three: 68, mid: 74, layup: 78, ft: 76 }
    },
    {
      name: "Ion",
      ratings: { three: 70, mid: 70, layup: 82, ft: 72 }
    },
    {
      name: "Vector",
      ratings: { three: 74, mid: 78, layup: 70, ft: 82 }
    }
  ];

  const actionMap = {
    three: { shotType: "three", confidenceKey: "shooting", fatigueCost: 3, label: "3PT" },
    mid: { shotType: "mid", confidenceKey: "shooting", fatigueCost: 3, label: "MID" },
    layup: { shotType: "layup", confidenceKey: "finishing", fatigueCost: 3, label: "LAYUP" },
    ft: { shotType: "ft", confidenceKey: "shooting", fatigueCost: 2, label: "FT" },
    drive: {
      shotType: "layup",
      confidenceKey: "finishing",
      fatigueCost: 4,
      label: "DRIVE",
      extraDifficulty: 10
    },
    pass: { shotType: null, confidenceKey: null, fatigueCost: 2, label: "PASS" }
  };

  function getActivePlayer() {
    if (window.FutureHoops.ui && typeof window.FutureHoops.ui.getActivePlayer === "function") {
      return window.FutureHoops.ui.getActivePlayer();
    }
    return data.players[0];
  }

  function clamp01(value) {
    return calc.clamp(value, 0, 1);
  }

  function startPossession() {
    if (state.currentPossession) {
      return state.currentPossession;
    }
    state.possessionCount += 1;
    state.currentPossession = {
      id: state.possessionCount,
      actions: []
    };
    return state.currentPossession;
  }

  function endPossession() {
    const ended = state.currentPossession;
    state.currentPossession = null;
    return ended;
  }

  function setDefenderMode(mode) {
    state.defenderMode = mode === "manual" ? "manual" : "ai";
  }

  function setManualDefender(values) {
    state.manualDefender = {
      ...state.manualDefender,
      ...values
    };
  }

  function generateAiDefender(actionType) {
    const rating = Math.round(55 + Math.random() * 30);
    let contest = 0.25 + Math.random() * 0.55;
    let difficulty = 30 + Math.random() * 40;

    if (actionType === "three") {
      contest += 0.08;
      difficulty += 10;
    }
    if (actionType === "drive") {
      contest += 0.05;
      difficulty += 8;
    }

    return {
      defenderRating: calc.clamp(rating, 40, 98),
      contestLevel: clamp01(contest),
      shotDifficulty: calc.clamp(Math.round(difficulty), 10, 95)
    };
  }

  function getDefenderContext(actionType) {
    if (state.defenderMode === "manual") {
      return {
        defenderRating: calc.clamp(state.manualDefender.rating, 0, 100),
        contestLevel: clamp01(state.manualDefender.contest),
        shotDifficulty: calc.clamp(state.manualDefender.difficulty, 0, 100)
      };
    }
    return generateAiDefender(actionType);
  }

  function resolveShot({ shotType, rating, confidenceValue, fatigue, context, extraDifficulty }) {
    const base = calc.ratingToPercent(shotType, rating);
    const confidenceMod = calc.confidenceModifier(confidenceValue);
    const fatigueMod = calc.fatigueModifier(fatigue);
    const defensePenalty = (context.defenderRating / 100) * context.contestLevel * 0.12;
    const difficultyValue = calc.clamp(
      context.shotDifficulty + (extraDifficulty || 0),
      0,
      100
    );
    const difficultyPenalty = (difficultyValue / 100) * 0.12;
    const final = calc.clamp(
      base + confidenceMod + fatigueMod - defensePenalty - difficultyPenalty,
      0.02,
      0.95
    );
    const roll = Math.random();
    return {
      base,
      final,
      roll,
      made: roll < final,
      defensePenalty,
      difficultyPenalty,
      confidenceMod,
      fatigueMod
    };
  }

  function applyFatigue(player, amount) {
    player.fatigue = calc.clamp((player.fatigue ?? 0) + amount, 0, 100);
  }

  function adjustConfidence(player, key, delta) {
    if (!key) {
      return;
    }
    const current = player.confidence?.[key] ?? 50;
    player.confidence[key] = calc.clamp(current + delta, 0, 100);
  }

  function getTurnoverChance(player, context, actionType) {
    const fatigueFactor = (player.fatigue / 100) * 0.12;
    const pressure =
      (context.defenderRating / 100) * (0.04 + context.contestLevel * 0.08);
    const difficultyFactor = (context.shotDifficulty / 100) * 0.08;
    let actionPenalty = 0.02;
    if (actionType === "drive") {
      actionPenalty = 0.06;
    }
    if (actionType === "pass") {
      actionPenalty = 0.05;
    }
    return calc.clamp(0.03 + fatigueFactor + pressure + difficultyFactor + actionPenalty, 0, 0.45);
  }

  function logEntry(entry) {
    state.possessionLog.push(entry);
    if (state.currentPossession) {
      state.currentPossession.actions.push(entry);
    }
  }

  function selectTeammateShot() {
    const teammate = teammates[Math.floor(Math.random() * teammates.length)];
    const shotTypes = ["three", "mid", "layup"];
    const shotType = shotTypes[Math.floor(Math.random() * shotTypes.length)];
    return {
      teammate,
      shotType,
      rating: teammate.ratings[shotType]
    };
  }

  function getShotConfig(shotType) {
    if (!shotType) {
      return null;
    }
    return {
      shotType,
      confidenceKey: shotType === "layup" ? "finishing" : "shooting",
      fatigueCost: shotType === "ft" ? 2 : 3,
      label: shotType === "three" ? "3PT" : shotType.toUpperCase()
    };
  }

  function takeAction(actionType, payload = {}) {
    const action =
      actionType === "shot"
        ? getShotConfig(payload.shotType)
        : actionMap[actionType];
    if (!action) {
      return null;
    }

    const player = getActivePlayer();
    if (!player) {
      return null;
    }

    if (!state.currentPossession) {
      startPossession();
    }

    const contextAction = actionType === "shot" ? action.shotType : actionType;
    const context = getDefenderContext(contextAction);
    if (typeof payload.defenderRating === "number") {
      context.defenderRating = calc.clamp(payload.defenderRating, 0, 100);
    }
    if (typeof payload.contestLevel === "number") {
      context.contestLevel = clamp01(payload.contestLevel);
    }
    if (typeof payload.contestBoost === "number") {
      context.contestLevel = clamp01(context.contestLevel + payload.contestBoost);
    }
    if (typeof payload.contestAngle === "number") {
      const angleFactor = clamp01(payload.contestAngle);
      context.contestLevel = clamp01(context.contestLevel * (0.4 + 0.6 * angleFactor));
    }
    if (typeof payload.difficulty === "number") {
      const blended = (context.shotDifficulty + payload.difficulty) / 2;
      context.shotDifficulty = calc.clamp(blended, 0, 100);
    }
    applyFatigue(player, action.fatigueCost);

    let turnoverChance = getTurnoverChance(player, context, actionType);
    if (typeof payload.turnoverBoost === "number") {
      turnoverChance = calc.clamp(turnoverChance + payload.turnoverBoost, 0, 0.9);
    }
    if (typeof payload.turnoverOverride === "number") {
      turnoverChance = clamp01(payload.turnoverOverride);
    }
    if (Math.random() < turnoverChance) {
      const entry = {
        action: actionType,
        shotType: action.label,
        result: "turnover"
      };
      logEntry(entry);
      endPossession();
      return { entry, context };
    }

    if (actionType === "pass") {
      const teammateShot = selectTeammateShot();
      const result = resolveShot({
        shotType: teammateShot.shotType,
        rating: teammateShot.rating,
        confidenceValue: 50,
        fatigue: 0,
        context,
        extraDifficulty: 0
      });

      const entry = {
        action: "pass",
        shotType: `${teammateShot.teammate.name} ${teammateShot.shotType}`,
        result: result.made ? "make" : "miss"
      };
      logEntry(entry);
      endPossession();
      return { entry, context, result };
    }

    const confidenceValue = player.confidence?.[action.confidenceKey] ?? 50;
    const shotResult = resolveShot({
      shotType: action.shotType,
      rating: player.ratings[action.shotType],
      confidenceValue,
      fatigue: player.fatigue,
      context,
      extraDifficulty: action.extraDifficulty || payload.extraDifficulty || 0
    });

    if (shotResult.made) {
      adjustConfidence(player, action.confidenceKey, 3);
    } else {
      adjustConfidence(player, action.confidenceKey, -4);
    }

    const entry = {
      action: actionType,
      shotType: action.label,
      result: shotResult.made ? "make" : "miss"
    };
    logEntry(entry);
    endPossession();
    return { entry, context, result: shotResult };
  }

  function getLog() {
    return state.possessionLog.slice();
  }

  function getState() {
    return {
      currentPossession: state.currentPossession,
      possessionCount: state.possessionCount,
      possessionLog: state.possessionLog.slice()
    };
  }

  return {
    startPossession,
    endPossession,
    takeAction,
    setDefenderMode,
    setManualDefender,
    getLog,
    getState
  };
})();
