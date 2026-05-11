window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.stepRender = (() => {
  const { calc } = window.FutureHoops;
  const clamp = (value, min, max) => {
    if (calc?.clamp) {
      return calc.clamp(value, min, max);
    }
    return Math.min(Math.max(value, min), max);
  };

  function buildRouteLines(step, playersById) {
    if (!step?.actions?.length) {
      return [];
    }
    return step.actions
      .filter((action) => action?.type === "MOVE_ROUTE")
      .map((action) => {
        const player = playersById.get(action.pid);
        if (!player) {
          return null;
        }
        const points = Array.isArray(action.points)
          ? action.points
              .map((point) => ({
                x: clamp(Number(point?.x ?? player.x), 0.02, 0.98),
                y: clamp(Number(point?.y ?? player.y), 0.02, 0.98)
              }))
              .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
          : [];
        if (!points.length) {
          return null;
        }
        const start = { x: player.x, y: player.y };
        const first = points[0];
        if (Math.hypot(first.x - start.x, first.y - start.y) > 0.001) {
          points.unshift(start);
        }
        return {
          actionId: action.id,
          pid: action.pid,
          points
        };
      })
      .filter(Boolean);
  }

  function buildPassLines(step, playersById) {
    if (!step?.actions?.length) {
      return [];
    }
    return step.actions
      .filter((action) => action?.type === "PASS")
      .map((action) => {
        const from = playersById.get(action.fromPid);
        const to = playersById.get(action.toPid);
        if (!from || !to) {
          return null;
        }
        return {
          actionId: action.id,
          fromPid: action.fromPid,
          toPid: action.toPid,
          start: { x: from.x, y: from.y },
          end: { x: to.x, y: to.y },
          passAtSec: Number(action.passAtSec ?? 0.5)
        };
      })
      .filter(Boolean);
  }

  function buildScreenSet(step) {
    const set = new Set();
    if (!step?.actions?.length) {
      return set;
    }
    step.actions.forEach((action) => {
      if (action?.type === "SCREEN_TAG" && action.active && action.pid) {
        set.add(action.pid);
      }
    });
    return set;
  }

  function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const projX = start.x + clamped * dx;
    const projY = start.y + clamped * dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }

  function hitTestRoute(point, routes, threshold) {
    if (!routes?.length) {
      return null;
    }
    let best = null;
    let bestDist = threshold;
    routes.forEach((route) => {
      const points = route.points || [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const dist = distanceToSegment(point, points[i], points[i + 1]);
        if (dist <= bestDist) {
          bestDist = dist;
          best = route;
        }
      }
    });
    return best;
  }

  function hitTestPass(point, passes, threshold) {
    if (!passes?.length) {
      return null;
    }
    let best = null;
    let bestDist = threshold;
    passes.forEach((pass) => {
      const dist = distanceToSegment(point, pass.start, pass.end);
      if (dist <= bestDist) {
        bestDist = dist;
        best = pass;
      }
    });
    return best;
  }

  return {
    buildRouteLines,
    buildPassLines,
    buildScreenSet,
    hitTestRoute,
    hitTestPass
  };
})();
