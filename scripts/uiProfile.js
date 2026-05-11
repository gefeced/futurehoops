window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiProfile = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements } = state;
  const { data, calc } = window.FutureHoops;
  let rosterSaveTimer;
  let lineupLock = false;

  function queueRosterSave() {
    if (!data?.saveRoster) {
      return;
    }
    if (rosterSaveTimer) {
      clearTimeout(rosterSaveTimer);
    }
    rosterSaveTimer = setTimeout(() => {
      rosterSaveTimer = null;
      data.saveRoster();
    }, 250);
  }

  function getInitials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function getOffenseRoster() {
    if (!data?.getOffensePlayers) {
      return [];
    }
    return data.getOffensePlayers();
  }

  function buildOffenseLineup(roster) {
    const lineup = Array.from({ length: 5 }, () => null);
    if (!Array.isArray(roster)) {
      return lineup;
    }
    roster.forEach((player) => {
      const number = Number.isInteger(player.number) ? player.number : null;
      if (!number || number < 1 || number > 5) {
        return;
      }
      if (!lineup[number - 1]) {
        lineup[number - 1] = player.id;
      }
    });
    return lineup;
  }

  function normalizeLineupSelection(lineup, roster, changedIndex) {
    const normalized = Array.from({ length: 5 }, (_, index) => {
      const pid = lineup[index];
      return typeof pid === "string" && pid ? pid : null;
    });
    const used = new Set();
    normalized.forEach((pid, index) => {
      if (!pid) {
        return;
      }
      if (used.has(pid)) {
        if (index !== changedIndex) {
          normalized[index] = null;
        }
        return;
      }
      used.add(pid);
    });
    roster.forEach((player) => {
      if (used.has(player.id)) {
        return;
      }
      const emptySlot = normalized.findIndex((pid) => !pid);
      if (emptySlot === -1) {
        return;
      }
      normalized[emptySlot] = player.id;
      used.add(player.id);
    });
    return normalized;
  }

  function applyOffenseLineup(lineup, { silent = false } = {}) {
    if (!Array.isArray(lineup) || lineupLock) {
      return false;
    }
    const roster = getOffenseRoster();
    const nextNumbers = new Map();
    lineup.forEach((pid, index) => {
      if (typeof pid === "string" && pid) {
        nextNumbers.set(pid, index + 1);
      }
    });
    lineupLock = true;
    let changed = false;
    roster.forEach((player) => {
      const nextNumber = nextNumbers.get(player.id) || null;
      if (player.number !== nextNumber) {
        player.number = nextNumber;
        changed = true;
      }
    });
    if (changed && data?.ensureRosterConsistency) {
      data.ensureRosterConsistency();
    }
    if (changed) {
      data.saveRoster?.();
    }
    lineupLock = false;
    if (changed && !silent) {
      const activeId = data.players[state.activeIndex]?.id || null;
      renderCarousel();
      if (activeId) {
        const nextIndex = data.players.findIndex((player) => player.id === activeId);
        setActive(nextIndex >= 0 ? nextIndex : 0, false);
      }
      ui.updateGameStats?.();
      ui.syncGameDefenders?.();
      ui.resetGamePossession?.(true);
    }
    return changed;
  }

  function renderLineupSelectors() {
    if (!elements.lineupGrid || !data?.getOffensePlayers) {
      return;
    }
    const roster = getOffenseRoster();
    elements.lineupGrid.innerHTML = "";
    if (!roster.length) {
      return;
    }
    const lineup = buildOffenseLineup(roster);
    const fragment = document.createDocumentFragment();

    for (let slot = 1; slot <= 5; slot += 1) {
      const wrapper = document.createElement("label");
      wrapper.className = "lineup-slot";
      const title = document.createElement("span");
      title.textContent = `Slot ${slot}`;
      const select = document.createElement("select");
      select.dataset.lineupSlot = String(slot);
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Unassigned";
      select.appendChild(emptyOption);
      roster.forEach((player) => {
        const option = document.createElement("option");
        option.value = player.id;
        const numberLabel = Number.isInteger(player.number) ? `#${player.number}` : "#--";
        option.textContent = `${numberLabel} ${player.name}`;
        select.appendChild(option);
      });
      select.value = lineup[slot - 1] || "";
      select.addEventListener("change", () => {
        const lineupSelection = Array.from(
          elements.lineupGrid.querySelectorAll("select[data-lineup-slot]")
        ).map((input) => input.value || null);
        const normalized = normalizeLineupSelection(
          lineupSelection,
          roster,
          slot - 1
        );
        applyOffenseLineup(normalized);
      });
      wrapper.appendChild(title);
      wrapper.appendChild(select);
      fragment.appendChild(wrapper);
    }

    elements.lineupGrid.appendChild(fragment);
  }

  function createPlayerCard(player, index) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "player-card";
    card.dataset.index = String(index);
    card.setAttribute("role", "listitem");
    card.style.setProperty("--card-accent", player.accent || "#39f6ff");
    const numberLabel = Number.isInteger(player.number) ? `#${player.number}` : "#--";
    const teamLabel = player.team === "defense" ? "Defense" : "Offense";

    card.innerHTML = `
      <div class="player-card__avatar">${getInitials(player.name)}</div>
      <div>
        <div class="player-card__name">${numberLabel} ${player.name}</div>
        <div class="player-card__role">${teamLabel} - ${player.position} - ${player.archetype}</div>
      </div>
    `;

    card.addEventListener("click", () => setActive(index, true));
    return card;
  }

  function renderCarousel() {
    elements.playerTrack.innerHTML = "";
    data.players.forEach((player, index) => {
      elements.playerTrack.appendChild(createPlayerCard(player, index));
    });
    renderLineupSelectors();
  }

  function createRatingCard(definition) {
    const card = document.createElement("div");
    card.className = "rating-card";
    card.dataset.rating = definition.key;
    card.innerHTML = `
      <div class="rating-head">
        <span>${definition.label}</span>
        <span class="rating-value">0</span>
      </div>
      <div class="rating-bar"><div class="rating-fill"></div></div>
      <input class="rating-input" type="range" min="0" max="100" step="1" />
      <div class="rating-meta">
        <div class="rating-meta-row">
          <span>Base %</span>
          <span class="rating-percent rating-percent--base">--</span>
        </div>
        <div class="rating-meta-row">
          <span>Modified %</span>
          <span class="rating-percent rating-percent--mod">--</span>
        </div>
        <div class="rating-delta" data-delta="neutral">--</div>
      </div>
    `;
    return card;
  }

  function renderRatings() {
    elements.ratingsGrid.innerHTML = "";
    data.ratingDefinitions.forEach((definition) => {
      elements.ratingsGrid.appendChild(createRatingCard(definition));
    });
  }

  function setActive(index, scrollIntoView) {
    const player = data.players[index];
    if (!player) {
      return;
    }

    state.activeIndex = index;
    const cards = Array.from(document.querySelectorAll(".player-card"));
    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === index;
      card.classList.toggle("active", isActive);
      card.setAttribute("aria-pressed", String(isActive));
      if (isActive && scrollIntoView) {
        card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });

    elements.profileInitials.textContent = getInitials(player.name);
    elements.playerNameInput.value = player.name;
    elements.playerPositionSelect.value = player.position;
    elements.playerArchetypeSelect.value = player.archetype;
    const numberLabel = Number.isInteger(player.number) ? `#${player.number}` : "#--";
    elements.profileId.textContent = `${numberLabel} - ${player.id}`;
    elements.archetypeFocus.textContent =
      data.archetypeFocusMap[player.archetype] || "Balanced";

    const performance = updatePercentages(player);
    updateRatings(player, performance);
    updateConfidence(player.confidence);
    updateFatigue(player.fatigue);
    startFatigueRecovery();
    ui.clearPlayState?.();
    ui.updateGameStats?.();
    ui.syncGameDefenders?.();
  }

  function getActivePlayer() {
    return data.players[state.activeIndex];
  }

  function updateRatings(player, performance) {
    const resolvedPerformance = performance || calc.getPerformanceProfile(player);
    const ratingCards = Array.from(document.querySelectorAll(".rating-card"));
    ratingCards.forEach((card) => {
      const key = card.dataset.rating;
      const value = player.ratings[key] ?? 0;
      card.querySelector(".rating-value").textContent = value;

      const fill = card.querySelector(".rating-fill");
      fill.style.width = "0%";
      requestAnimationFrame(() => {
        fill.style.width = `${value}%`;
      });

      const input = card.querySelector(".rating-input");
      input.value = value;
      input.oninput = (event) => {
        const nextValue = Number(event.target.value);
        player.ratings[key] = nextValue;
        if (data?.syncPlayerCoreRatings) {
          data.syncPlayerCoreRatings(player);
        }
        card.querySelector(".rating-value").textContent = nextValue;
        fill.style.width = `${nextValue}%`;
        const updatedPerformance = updatePercentages(player);
        updateRatingPercent(card, key, updatedPerformance);
        queueRosterSave();
      };

      updateRatingPercent(card, key, resolvedPerformance);
    });
  }

  function updateRatingPercent(card, key, performance) {
    const baseEl = card.querySelector(".rating-percent--base");
    const modEl = card.querySelector(".rating-percent--mod");
    const deltaEl = card.querySelector(".rating-delta");
    const entry = performance?.[key];

    if (entry) {
      baseEl.textContent = `${entry.basePercent}%`;
      modEl.textContent = `${entry.modifiedPercent}%`;
      const delta = entry.delta;
      const deltaText = `${delta > 0 ? "+" : ""}${delta}%`;
      deltaEl.textContent = deltaText;
      deltaEl.dataset.delta = delta === 0 ? "neutral" : delta > 0 ? "up" : "down";
    } else {
      baseEl.textContent = "--";
      modEl.textContent = "--";
      deltaEl.textContent = "--";
      deltaEl.dataset.delta = "neutral";
    }
  }

  function refreshRatingPercents(performance) {
    const ratingCards = Array.from(document.querySelectorAll(".rating-card"));
    ratingCards.forEach((card) => {
      updateRatingPercent(card, card.dataset.rating, performance);
    });
  }

  function updateConfidence(confidence) {
    elements.confidenceRows.forEach((row) => {
      const key = row.dataset.confidence;
      const value = confidence[key] ?? 0;
      row.querySelector(".metric-value").textContent = value;
      const input = row.querySelector(".metric-input");
      if (input) {
        input.value = value;
      }
      const fill = row.querySelector(".metric-fill");
      fill.style.width = "0%";
      requestAnimationFrame(() => {
        fill.style.width = `${value}%`;
      });
    });
  }

  function updateFatigue(value) {
    elements.fatigueValue.textContent = value;
    elements.fatigueFill.style.width = `${value}%`;
    if (elements.fatigueInput) {
      elements.fatigueInput.value = value;
    }
  }

  function updatePercentages(player) {
    const performance = calc.getPerformanceProfile(player);
    player.performanceProfile = performance;
    elements.pct3.textContent = `${performance.three.modifiedPercent}%`;
    elements.pctMid.textContent = `${performance.mid.modifiedPercent}%`;
    elements.pctLay.textContent = `${performance.layup.modifiedPercent}%`;
    elements.pctFt.textContent = `${performance.ft.modifiedPercent}%`;
    return performance;
  }

  function refreshActivePlayer() {
    const player = data.players[state.activeIndex];
    if (!player) {
      return;
    }
    updateConfidence(player.confidence);
    updateFatigue(player.fatigue);
    const performance = updatePercentages(player);
    refreshRatingPercents(performance);
    ui.updateGameStats?.();
    queueRosterSave();
  }

  function startFatigueRecovery() {
    if (state.fatigueTimer) {
      clearInterval(state.fatigueTimer);
    }
    state.fatigueTimer = setInterval(() => {
      const player = data.players[state.activeIndex];
      if (!player || player.fatigue <= 0) {
        return;
      }
      player.fatigue = Math.max(0, player.fatigue - 1);
      updateFatigue(player.fatigue);
      const performance = updatePercentages(player);
      refreshRatingPercents(performance);
    }, 3000);
  }

  function handleProfileUpdate() {
    const player = data.players[state.activeIndex];
    if (!player) {
      return;
    }

    player.name = elements.playerNameInput.value.trim() || "Unnamed";
    player.position = elements.playerPositionSelect.value;
    player.archetype = elements.playerArchetypeSelect.value;
    elements.archetypeFocus.textContent =
      data.archetypeFocusMap[player.archetype] || "Balanced";

    elements.profileInitials.textContent = getInitials(player.name);
    renderCarousel();
    setActive(state.activeIndex, false);
    queueRosterSave();
  }

  function createNewPlayer() {
    const current = data.players[state.activeIndex];
    const team = current?.team === "defense" ? "defense" : "offense";
    if (!data?.addRosterPlayer) {
      return;
    }
    const newPlayer = data.addRosterPlayer({ team });
    if (!newPlayer) {
      return;
    }
    renderCarousel();
    const newIndex = data.players.findIndex((player) => player.id === newPlayer.id);
    setActive(newIndex >= 0 ? newIndex : 0, true);
  }

  Object.assign(ui, {
    queueRosterSave,
    renderCarousel,
    renderLineupSelectors,
    renderRatings,
    setActive,
    getActivePlayer,
    refreshActivePlayer,
    updateRatings,
    updateConfidence,
    updateFatigue,
    updatePercentages,
    refreshRatingPercents,
    startFatigueRecovery,
    handleProfileUpdate,
    createNewPlayer
  });

  return ui;
})();
