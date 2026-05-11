window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.data = (() => {
  const ratingDefinitions = [
    { key: "shooting", label: "Shooting" },
    { key: "three", label: "3PT" },
    { key: "mid", label: "Midrange" },
    { key: "layup", label: "Layup" },
    { key: "ft", label: "Free Throw" },
    { key: "defense", label: "Defense" },
    { key: "speed", label: "Speed" },
    { key: "dribbling", label: "Dribbling" },
    { key: "passing", label: "Passing" }
  ];

  const archetypeFocusMap = {
    Shooter: "Shot Creation",
    Slasher: "Rim Pressure",
    "Two-Way": "Dual Threat",
    Playmaker: "Play Engineering"
  };

  const rosterStorageKey = "futurehoops_roster";
  const roster = { players: {} };
  const players = [];

  const seedPlayers = [
    {
      id: "FH-001",
      name: "A. Nova",
      number: 1,
      position: "SG",
      team: "offense",
      archetype: "Shooter",
      ratings: {
        shooting: 86,
        three: 88,
        mid: 84,
        layup: 78,
        ft: 90,
        defense: 62,
        speed: 84,
        dribbling: 80,
        passing: 76
      },
      confidence: {
        shooting: 78,
        defense: 55,
        finishing: 72,
        passing: 62
      },
      fatigue: 28
    },
    {
      id: "FH-002",
      name: "J. Vortex",
      number: 2,
      position: "PG",
      team: "offense",
      archetype: "Playmaker",
      ratings: {
        shooting: 79,
        three: 76,
        mid: 82,
        layup: 81,
        ft: 88,
        defense: 66,
        speed: 90,
        dribbling: 92,
        passing: 94
      },
      confidence: {
        shooting: 70,
        defense: 63,
        finishing: 78,
        passing: 80
      },
      fatigue: 34
    },
    {
      id: "FH-003",
      name: "K. Flux",
      number: 3,
      position: "SF",
      team: "offense",
      archetype: "Two-Way",
      ratings: {
        shooting: 80,
        three: 78,
        mid: 82,
        layup: 80,
        ft: 82,
        defense: 85,
        speed: 82,
        dribbling: 76,
        passing: 78
      },
      confidence: {
        shooting: 72,
        defense: 80,
        finishing: 74,
        passing: 68
      },
      fatigue: 22
    },
    {
      id: "FH-004",
      name: "M. Titan",
      number: 4,
      position: "PF",
      team: "offense",
      archetype: "Slasher",
      ratings: {
        shooting: 72,
        three: 66,
        mid: 74,
        layup: 88,
        ft: 78,
        defense: 84,
        speed: 78,
        dribbling: 70,
        passing: 72
      },
      confidence: {
        shooting: 64,
        defense: 76,
        finishing: 82,
        passing: 60
      },
      fatigue: 40
    }
  ];

  const defaultRatings = {
    shooting: 75,
    three: 72,
    mid: 74,
    layup: 78,
    ft: 76,
    defense: 60,
    speed: 78,
    dribbling: 74,
    passing: 70
  };

  const defaultConfidence = {
    shooting: 60,
    finishing: 60,
    passing: 60,
    defense: 60
  };

  const positionOrder = ["PG", "SG", "SF", "PF", "C"];

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const normalizeRating = (value, fallback) => {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return Math.round(clamp(num, 0, 100));
    }
    return fallback;
  };

  const normalizeCount = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return 0;
    }
    return Math.max(0, Math.round(num));
  };

  const normalizeRosterNumber = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return null;
    }
    const rounded = Math.round(num);
    if (rounded < 1 || rounded > 5) {
      return null;
    }
    return rounded;
  };

  const averageValues = (values, fallback) => {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) {
      return fallback;
    }
    const total = valid.reduce((sum, value) => sum + value, 0);
    return Math.round(total / valid.length);
  };

  const buildConfidenceMatrix = (matrix, legacy) => {
    const merged = {
      ...(legacy && typeof legacy === "object" ? legacy : {}),
      ...(matrix && typeof matrix === "object" ? matrix : {})
    };
    return {
      shooting: normalizeRating(merged.shooting, defaultConfidence.shooting),
      finishing: normalizeRating(merged.finishing, defaultConfidence.finishing),
      passing: normalizeRating(merged.passing, defaultConfidence.passing),
      defense: normalizeRating(merged.defense, defaultConfidence.defense)
    };
  };

  const buildCoreRatings = (core, ratings) => {
    const baseCore = core && typeof core === "object" ? core : {};
    const baseRatings = ratings && typeof ratings === "object" ? ratings : {};
    const shootingFallback = averageValues(
      [
        Number(baseRatings.shooting),
        Number(baseRatings.three),
        Number(baseRatings.mid),
        Number(baseRatings.ft)
      ],
      defaultRatings.shooting
    );
    return {
      shooting: normalizeRating(baseCore.shooting, shootingFallback),
      finishing: normalizeRating(baseCore.finishing, baseRatings.layup ?? defaultRatings.layup),
      passing: normalizeRating(baseCore.passing, baseRatings.passing ?? defaultRatings.passing),
      defense: normalizeRating(baseCore.defense, baseRatings.defense ?? defaultRatings.defense),
      speed: normalizeRating(baseCore.speed, baseRatings.speed ?? defaultRatings.speed),
      stamina: normalizeRating(baseCore.stamina, 70)
    };
  };

  const buildRatingsFromCore = (core, ratings) => {
    const baseRatings = ratings && typeof ratings === "object" ? ratings : {};
    const shooting = normalizeRating(baseRatings.shooting, core.shooting);
    const three = normalizeRating(baseRatings.three, shooting);
    const mid = normalizeRating(baseRatings.mid, shooting);
    const ft = normalizeRating(baseRatings.ft, shooting);
    const layup = normalizeRating(baseRatings.layup, core.finishing);
    const defense = normalizeRating(baseRatings.defense, core.defense);
    const speed = normalizeRating(baseRatings.speed, core.speed);
    const passing = normalizeRating(baseRatings.passing, core.passing);
    const dribblingFallback = Math.round((core.passing + core.speed) / 2);
    const dribbling = normalizeRating(baseRatings.dribbling, dribblingFallback);
    return {
      shooting,
      three,
      mid,
      layup,
      ft,
      defense,
      speed,
      dribbling,
      passing
    };
  };

  const buildCoreRatingsFromRatings = (ratings, core) => {
    const baseRatings = ratings && typeof ratings === "object" ? ratings : {};
    const baseCore = core && typeof core === "object" ? core : {};
    const shooting = averageValues(
      [
        Number(baseRatings.shooting),
        Number(baseRatings.three),
        Number(baseRatings.mid),
        Number(baseRatings.ft)
      ],
      baseCore.shooting ?? defaultRatings.shooting
    );
    return {
      shooting: normalizeRating(shooting, defaultRatings.shooting),
      finishing: normalizeRating(baseRatings.layup, baseCore.finishing ?? defaultRatings.layup),
      passing: normalizeRating(baseRatings.passing, baseCore.passing ?? defaultRatings.passing),
      defense: normalizeRating(baseRatings.defense, baseCore.defense ?? defaultRatings.defense),
      speed: normalizeRating(baseRatings.speed, baseCore.speed ?? defaultRatings.speed),
      stamina: normalizeRating(baseCore.stamina, 70)
    };
  };

  const buildPerformanceStats = (performance) => {
    const base = performance && typeof performance === "object" ? performance : {};
    return {
      shotsTaken: normalizeCount(base.shotsTaken),
      shotsMade: normalizeCount(base.shotsMade),
      assists: normalizeCount(base.assists),
      steals: normalizeCount(base.steals),
      turnovers: normalizeCount(base.turnovers)
    };
  };

  const getDefaultPosition = (number) => {
    if (Number.isInteger(number) && number >= 1 && number <= positionOrder.length) {
      return positionOrder[number - 1];
    }
    return "SG";
  };

  const generateRosterId = () =>
    `FH-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const normalizeRosterPlayer = (raw, fallback = {}) => {
    const source = raw && typeof raw === "object" ? raw : {};
    const id =
      typeof source.id === "string"
        ? source.id
        : typeof fallback.id === "string"
          ? fallback.id
          : generateRosterId();
    const team = source.team === "defense" ? "defense" : "offense";
    const number = normalizeRosterNumber(source.number);
    const name =
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim()
        : typeof fallback.name === "string"
          ? fallback.name
          : "Prospect";
    const position =
      typeof source.position === "string"
        ? source.position
        : typeof fallback.position === "string"
          ? fallback.position
          : getDefaultPosition(number);
    const archetype =
      typeof source.archetype === "string"
        ? source.archetype
        : typeof fallback.archetype === "string"
          ? fallback.archetype
          : "Shooter";

    const confidenceMatrix = buildConfidenceMatrix(
      source.confidenceMatrix,
      source.confidence
    );
    const coreRatings = buildCoreRatings(source.coreRatings, source.ratings);
    const ratings = buildRatingsFromCore(coreRatings, source.ratings);
    const fatigue = normalizeRating(source.fatigue, 30);

    const player = {
      id,
      name,
      number,
      position,
      team,
      archetype,
      confidenceMatrix,
      coreRatings,
      performance: buildPerformanceStats(source.performance),
      ratings,
      confidence: confidenceMatrix,
      fatigue
    };

    if (typeof source.accent === "string") {
      player.accent = source.accent;
    }

    return player;
  };

  const buildDefaultRoster = () => {
    const defaultRoster = { players: {} };
    seedPlayers.forEach((player) => {
      const normalized = normalizeRosterPlayer(player, { id: player.id });
      defaultRoster.players[normalized.id] = normalized;
    });
    return defaultRoster;
  };

  const getAvailableNumber = (team, playersMap = roster.players) => {
    const used = new Set();
    Object.values(playersMap).forEach((player) => {
      if (player.team !== team) {
        return;
      }
      if (Number.isInteger(player.number)) {
        used.add(player.number);
      }
    });
    for (let number = 1; number <= 5; number += 1) {
      if (!used.has(number)) {
        return number;
      }
    }
    return null;
  };

  const createPlaceholderPlayer = (id, team, number) => {
    const safeTeam = team === "defense" ? "defense" : "offense";
    const safeNumber = Number.isInteger(number) ? number : null;
    const labelNumber = safeNumber ? ` ${safeNumber}` : "";
    const name = safeTeam === "defense" ? `Defender${labelNumber}` : `Prospect${labelNumber}`;
    const archetype = safeTeam === "defense" ? "Lockdown" : "Shooter";
    const ratings = {
      ...defaultRatings,
      defense: safeTeam === "defense" ? 78 : defaultRatings.defense
    };
    return normalizeRosterPlayer(
      {
        id,
        name,
        team: safeTeam,
        number: safeNumber,
        position: getDefaultPosition(safeNumber),
        archetype,
        ratings,
        confidence: defaultConfidence,
        fatigue: 30
      },
      { id }
    );
  };

  const enforceTeamNumbers = (team, playersMap) => {
    const teamPlayers = Object.values(playersMap).filter(
      (player) => player.team === team
    );
    const used = new Set();
    const needsNumber = [];

    teamPlayers.forEach((player) => {
      const number = normalizeRosterNumber(player.number);
      if (number && !used.has(number)) {
        player.number = number;
        used.add(number);
      } else {
        needsNumber.push(player);
      }
    });

    const available = [];
    for (let number = 1; number <= 5; number += 1) {
      if (!used.has(number)) {
        available.push(number);
      }
    }

    needsNumber.forEach((player) => {
      const nextNumber = available.shift();
      if (nextNumber) {
        player.number = nextNumber;
        used.add(nextNumber);
      }
    });
  };

  const ensureRosterConsistency = (requiredPlayers = []) => {
    const nextPlayers = {};
    if (!roster.players || typeof roster.players !== "object") {
      roster.players = {};
    }

    Object.entries(roster.players).forEach(([key, value]) => {
      const normalized = normalizeRosterPlayer(value, { id: key });
      nextPlayers[normalized.id] = normalized;
    });

    if (Array.isArray(requiredPlayers)) {
      requiredPlayers.forEach((entry) => {
        const pid = typeof entry?.pid === "string" ? entry.pid : null;
        if (!pid) {
          return;
        }
        if (nextPlayers[pid]) {
          if (entry.team === "defense" || entry.team === "offense") {
            nextPlayers[pid].team = entry.team;
          }
          return;
        }
        const team = entry.team === "defense" ? "defense" : "offense";
        const number = getAvailableNumber(team, nextPlayers);
        nextPlayers[pid] = createPlaceholderPlayer(pid, team, number);
      });
    }

    roster.players = nextPlayers;
    enforceTeamNumbers("offense", roster.players);
    enforceTeamNumbers("defense", roster.players);
    refreshRosterPlayers();
    return roster;
  };

  const refreshRosterPlayers = () => {
    players.length = 0;
    const offensePlayers = getOffensePlayers();
    const defensePlayers = getDefensePlayers();
    offensePlayers.forEach((player) => players.push(player));
    defensePlayers.forEach((player) => players.push(player));
  };

  const getTeamPlayers = (team) =>
    Object.values(roster.players)
      .filter((player) => player.team === team)
      .sort((a, b) => {
        const aNum = Number.isInteger(a.number) ? a.number : 99;
        const bNum = Number.isInteger(b.number) ? b.number : 99;
        if (aNum === bNum) {
          return String(a.name).localeCompare(String(b.name));
        }
        return aNum - bNum;
      });

  const getOffensePlayers = () => getTeamPlayers("offense");

  const getDefensePlayers = () => getTeamPlayers("defense");

  const getActiveTeamPlayers = (team) =>
    getTeamPlayers(team).filter(
      (player) =>
        Number.isInteger(player.number) && player.number >= 1 && player.number <= 5
    );

  const getPlayerById = (pid) => {
    if (!pid || !roster.players) {
      return null;
    }
    return roster.players[pid] || null;
  };

  const syncPlayerCoreRatings = (player) => {
    if (!player || !player.ratings) {
      return;
    }
    player.coreRatings = buildCoreRatingsFromRatings(player.ratings, player.coreRatings);
  };

  const syncPlayerConfidenceMatrix = (player) => {
    if (!player) {
      return;
    }
    const nextMatrix = buildConfidenceMatrix(
      player.confidenceMatrix,
      player.confidence
    );
    player.confidenceMatrix = nextMatrix;
    player.confidence = nextMatrix;
  };

  const addRosterPlayer = ({
    team = "offense",
    id,
    name,
    position,
    archetype
  } = {}) => {
    ensureRosterConsistency();
    const safeTeam = team === "defense" ? "defense" : "offense";
    const number = getAvailableNumber(safeTeam);
    if (!number) {
      return null;
    }
    const playerId = typeof id === "string" ? id : generateRosterId();
    if (roster.players[playerId]) {
      return roster.players[playerId];
    }
    const labelNumber = number ? ` ${number}` : "";
    const fallbackName =
      safeTeam === "defense" ? `Defender${labelNumber}` : `Prospect${labelNumber}`;
    const entry = normalizeRosterPlayer(
      {
        id: playerId,
        name: typeof name === "string" && name.trim() ? name.trim() : fallbackName,
        number,
        position: typeof position === "string" ? position : getDefaultPosition(number),
        team: safeTeam,
        archetype:
          typeof archetype === "string"
            ? archetype
            : safeTeam === "defense"
              ? "Lockdown"
              : "Shooter",
        ratings: defaultRatings,
        confidence: defaultConfidence,
        fatigue: 30
      },
      { id: playerId }
    );
    roster.players[playerId] = entry;
    ensureRosterConsistency();
    saveRoster();
    return entry;
  };

  const serializePlayer = (player) => ({
    id: player.id,
    name: player.name,
    number: player.number,
    position: player.position,
    team: player.team,
    archetype: player.archetype,
    confidenceMatrix: player.confidenceMatrix,
    coreRatings: player.coreRatings,
    performance: player.performance,
    ratings: player.ratings,
    confidence: player.confidence,
    fatigue: player.fatigue,
    accent: player.accent
  });

  const saveRoster = () => {
    try {
      const payload = { players: {} };
      Object.values(roster.players).forEach((player) => {
        payload.players[player.id] = serializePlayer(player);
      });
      window.localStorage.setItem(rosterStorageKey, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage failures.
    }
  };

  const loadRoster = () => {
    let source = null;
    try {
      const raw = window.localStorage.getItem(rosterStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          source = parsed;
        }
      }
    } catch (error) {
      source = null;
    }

    const baseRoster = source && typeof source.players === "object"
      ? source
      : buildDefaultRoster();
    roster.players = {};
    Object.entries(baseRoster.players || {}).forEach(([key, value]) => {
      const normalized = normalizeRosterPlayer(value, { id: key });
      roster.players[normalized.id] = normalized;
    });
    ensureRosterConsistency();
    if (!source) {
      saveRoster();
    }
    return roster;
  };

  loadRoster();

  return {
    ratingDefinitions,
    archetypeFocusMap,
    roster,
    players,
    getPlayerById,
    getOffensePlayers,
    getDefensePlayers,
    getActiveTeamPlayers,
    saveRoster,
    loadRoster,
    ensureRosterConsistency,
    syncPlayerCoreRatings,
    syncPlayerConfidenceMatrix,
    addRosterPlayer
  };
})();
