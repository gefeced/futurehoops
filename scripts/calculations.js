window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.calc = (() => {
  const curves = {
    three: [
      { rating: 30, pct: 0.18 },
      { rating: 40, pct: 0.24 },
      { rating: 50, pct: 0.28 },
      { rating: 60, pct: 0.32 },
      { rating: 70, pct: 0.35 },
      { rating: 80, pct: 0.38 },
      { rating: 90, pct: 0.42 },
      { rating: 100, pct: 0.45 }
    ],
    mid: [
      { rating: 30, pct: 0.21 },
      { rating: 40, pct: 0.27 },
      { rating: 50, pct: 0.31 },
      { rating: 60, pct: 0.35 },
      { rating: 70, pct: 0.38 },
      { rating: 80, pct: 0.41 },
      { rating: 90, pct: 0.45 }
    ],
    layup: [
      { rating: 30, pct: 0.4 },
      { rating: 40, pct: 0.48 },
      { rating: 50, pct: 0.55 },
      { rating: 60, pct: 0.65 },
      { rating: 70, pct: 0.72 },
      { rating: 80, pct: 0.78 },
      { rating: 90, pct: 0.85 }
    ],
    ft: [
      { rating: 30, pct: 0.5 },
      { rating: 40, pct: 0.58 },
      { rating: 50, pct: 0.65 },
      { rating: 60, pct: 0.72 },
      { rating: 70, pct: 0.8 },
      { rating: 80, pct: 0.85 },
      { rating: 90, pct: 0.9 }
    ]
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function interpolate(points, rating) {
    const safeRating = clamp(rating ?? 0, 0, 100);
    const sorted = points.slice().sort((a, b) => a.rating - b.rating);

    if (safeRating <= sorted[0].rating) {
      const low = sorted[0];
      const high = sorted[1];
      return (
        low.pct +
        ((safeRating - low.rating) / (high.rating - low.rating)) *
          (high.pct - low.pct)
      );
    }

    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      if (safeRating <= current.rating) {
        return (
          previous.pct +
          ((safeRating - previous.rating) / (current.rating - previous.rating)) *
            (current.pct - previous.pct)
        );
      }
    }

    const last = sorted[sorted.length - 1];
    const beforeLast = sorted[sorted.length - 2];
    return (
      last.pct +
      ((safeRating - last.rating) / (last.rating - beforeLast.rating)) *
        (last.pct - beforeLast.pct)
    );
  }

  function confidenceModifier(confidence) {
    const value = clamp(confidence ?? 50, 0, 100);
    if (value <= 50) {
      return ((value - 50) / 50) * 0.1;
    }
    return ((value - 50) / 50) * 0.05;
  }

  function fatigueModifier(fatigue) {
    const value = clamp(fatigue ?? 0, 0, 100);
    if (value <= 50) {
      return -(value / 50) * 0.05;
    }
    return -0.05 - ((value - 50) / 50) * 0.1;
  }

  function ratingToPercent(type, rating) {
    const curve = curves[type];
    if (!curve) {
      return 0;
    }
    return clamp(interpolate(curve, rating), 0, 0.99);
  }

  function buildEntry(base, modified) {
    const basePercent = Math.round(base * 100);
    const modifiedPercent = Math.round(modified * 100);
    return {
      basePercent,
      modifiedPercent,
      delta: modifiedPercent - basePercent
    };
  }

  function getPerformanceProfile(player) {
    const { ratings, confidence, fatigue } = player;
    const shootingConfidence = confidence?.shooting ?? 50;
    const finishingConfidence = confidence?.finishing ?? 50;
    const defenseConfidence = confidence?.defense ?? 50;
    const fatigueMod = fatigueModifier(fatigue);

    const baseThree = ratingToPercent("three", ratings.three);
    const baseMid = ratingToPercent("mid", ratings.mid);
    const baseLayup = ratingToPercent("layup", ratings.layup);
    const baseFt = ratingToPercent("ft", ratings.ft);

    const shootingMod = confidenceModifier(shootingConfidence);
    const finishingMod = confidenceModifier(finishingConfidence);

    const modThree = clamp(baseThree + shootingMod + fatigueMod, 0, 0.99);
    const modMid = clamp(baseMid + shootingMod + fatigueMod, 0, 0.99);
    const modFt = clamp(baseFt + shootingMod + fatigueMod, 0, 0.99);
    const modLayup = clamp(baseLayup + finishingMod + fatigueMod, 0, 0.99);

    return {
      three: buildEntry(baseThree, modThree),
      mid: buildEntry(baseMid, modMid),
      layup: buildEntry(baseLayup, modLayup),
      ft: buildEntry(baseFt, modFt),
      modifiers: {
        confidence: {
          shooting: shootingConfidence,
          defense: defenseConfidence,
          finishing: finishingConfidence
        },
        fatigue: clamp(fatigue ?? 0, 0, 100),
        defenseModifier: Math.round(
          (confidenceModifier(defenseConfidence) + fatigueMod) * 100
        )
      }
    };
  }

  return {
    clamp,
    confidenceModifier,
    fatigueModifier,
    getPerformanceProfile,
    ratingToPercent
  };
})();
