window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiAthleteProfile = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements } = state;
  const storageKey = "futurehoops.profileHub.v1";
  let bound = false;
  let activeModal = null;

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function defaultProfileHubState() {
    return {
      activeSubtab: "overview",
      bountiesSignedUp: false,
      profile: {
        name: "",
        team: "",
        position: "",
        classYear: "",
        hometown: "",
        jersey: "",
        bio: ""
      },
      stats: {
        ppg: "",
        rpg: "",
        apg: "",
        spg: "",
        bpg: "",
        fg: "",
        three: "",
        ft: ""
      },
      games: [],
      bounties: []
    };
  }

  function normalizeGame(raw) {
    return {
      id: typeof raw?.id === "string" ? raw.id : createId("game"),
      opponent: typeof raw?.opponent === "string" ? raw.opponent : "",
      date: typeof raw?.date === "string" ? raw.date : "",
      points: raw?.points === "" || raw?.points == null ? "" : Number(raw.points) || 0,
      rebounds:
        raw?.rebounds === "" || raw?.rebounds == null ? "" : Number(raw.rebounds) || 0,
      assists: raw?.assists === "" || raw?.assists == null ? "" : Number(raw.assists) || 0,
      result: raw?.result === "L" ? "L" : "W",
      notes: typeof raw?.notes === "string" ? raw.notes : ""
    };
  }

  function normalizeBounty(raw) {
    return {
      id: typeof raw?.id === "string" ? raw.id : createId("bounty"),
      title: typeof raw?.title === "string" ? raw.title : "",
      unit: typeof raw?.unit === "string" ? raw.unit : "",
      current: raw?.current === "" || raw?.current == null ? "" : Number(raw.current) || 0,
      target: raw?.target === "" || raw?.target == null ? "" : Number(raw.target) || 0,
      dueDate: typeof raw?.dueDate === "string" ? raw.dueDate : "",
      status:
        raw?.status === "paused" || raw?.status === "complete" ? raw.status : "active",
      notes: typeof raw?.notes === "string" ? raw.notes : ""
    };
  }

  function normalizeProfileHubState(raw) {
    const base = defaultProfileHubState();
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      activeSubtab: source.activeSubtab === "bounties" ? "bounties" : "overview",
      bountiesSignedUp: source.bountiesSignedUp === true,
      profile: {
        name: typeof source.profile?.name === "string" ? source.profile.name : "",
        team: typeof source.profile?.team === "string" ? source.profile.team : "",
        position: typeof source.profile?.position === "string" ? source.profile.position : "",
        classYear:
          typeof source.profile?.classYear === "string" ? source.profile.classYear : "",
        hometown:
          typeof source.profile?.hometown === "string" ? source.profile.hometown : "",
        jersey: typeof source.profile?.jersey === "string" ? source.profile.jersey : "",
        bio: typeof source.profile?.bio === "string" ? source.profile.bio : ""
      },
      stats: {
        ppg: source.stats?.ppg ?? base.stats.ppg,
        rpg: source.stats?.rpg ?? base.stats.rpg,
        apg: source.stats?.apg ?? base.stats.apg,
        spg: source.stats?.spg ?? base.stats.spg,
        bpg: source.stats?.bpg ?? base.stats.bpg,
        fg: source.stats?.fg ?? base.stats.fg,
        three: source.stats?.three ?? base.stats.three,
        ft: source.stats?.ft ?? base.stats.ft
      },
      games: Array.isArray(source.games) ? source.games.map(normalizeGame) : [],
      bounties: Array.isArray(source.bounties) ? source.bounties.map(normalizeBounty) : []
    };
  }

  function getProfileHubState() {
    if (!state.athleteProfileHub) {
      state.athleteProfileHub = defaultProfileHubState();
    }
    return state.athleteProfileHub;
  }

  function saveProfileHubState() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(getProfileHubState()));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function loadProfileHubState() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return defaultProfileHubState();
      }
      return normalizeProfileHubState(JSON.parse(raw));
    } catch (error) {
      return defaultProfileHubState();
    }
  }

  function setProfileHubStatus(message) {
    if (elements.athleteProfileStatus) {
      elements.athleteProfileStatus.textContent = message || "Profile ready.";
    }
  }

  function setModalVisible(modal, visible) {
    if (!modal) {
      return;
    }
    modal.classList.toggle("is-open", visible);
    modal.setAttribute("aria-hidden", String(!visible));
    if (elements.modalOverlay) {
      elements.modalOverlay.classList.toggle("is-visible", visible);
      elements.modalOverlay.setAttribute("aria-hidden", String(!visible));
    }
  }

  function openLocalModal(modal) {
    activeModal = modal;
    setModalVisible(modal, true);
  }

  function closeLocalModal(modal = activeModal) {
    if (!modal) {
      return;
    }
    setModalVisible(modal, false);
    if (activeModal === modal) {
      activeModal = null;
    }
  }

  function syncProfileForm() {
    const hub = getProfileHubState();
    const { profile, stats } = hub;
    if (elements.athleteProfileName) {
      elements.athleteProfileName.value = profile.name;
    }
    if (elements.athleteProfileTeam) {
      elements.athleteProfileTeam.value = profile.team;
    }
    if (elements.athleteProfilePosition) {
      elements.athleteProfilePosition.value = profile.position;
    }
    if (elements.athleteProfileClassYear) {
      elements.athleteProfileClassYear.value = profile.classYear;
    }
    if (elements.athleteProfileHometown) {
      elements.athleteProfileHometown.value = profile.hometown;
    }
    if (elements.athleteProfileJersey) {
      elements.athleteProfileJersey.value = profile.jersey;
    }
    if (elements.athleteProfileBio) {
      elements.athleteProfileBio.value = profile.bio;
    }
    if (elements.athleteStatPpg) {
      elements.athleteStatPpg.value = stats.ppg;
    }
    if (elements.athleteStatRpg) {
      elements.athleteStatRpg.value = stats.rpg;
    }
    if (elements.athleteStatApg) {
      elements.athleteStatApg.value = stats.apg;
    }
    if (elements.athleteStatSpg) {
      elements.athleteStatSpg.value = stats.spg;
    }
    if (elements.athleteStatBpg) {
      elements.athleteStatBpg.value = stats.bpg;
    }
    if (elements.athleteStatFg) {
      elements.athleteStatFg.value = stats.fg;
    }
    if (elements.athleteStatThree) {
      elements.athleteStatThree.value = stats.three;
    }
    if (elements.athleteStatFt) {
      elements.athleteStatFt.value = stats.ft;
    }
  }

  function renderSummaryStrip() {
    if (!elements.athleteSummaryStrip) {
      return;
    }
    const hub = getProfileHubState();
    const stats = hub.stats;
    const items = [
      { label: "PPG", value: stats.ppg || "--" },
      { label: "RPG", value: stats.rpg || "--" },
      { label: "APG", value: stats.apg || "--" },
      { label: "FG%", value: stats.fg || "--" }
    ];
    elements.athleteSummaryStrip.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const block = document.createElement("div");
      block.className = "athlete-summary-item";
      const label = document.createElement("span");
      label.textContent = item.label;
      const value = document.createElement("strong");
      value.textContent = String(item.value);
      block.append(label, value);
      fragment.appendChild(block);
    });
    elements.athleteSummaryStrip.appendChild(fragment);
  }

  function renderProfileBadge() {
    const hub = getProfileHubState();
    if (elements.athleteProfileBadge) {
      const name = hub.profile.name?.trim();
      elements.athleteProfileBadge.textContent = name ? name.split(" ")[0] : "Prospect";
    }
    if (elements.athleteBountyBadge) {
      elements.athleteBountyBadge.textContent = hub.bountiesSignedUp
        ? "Signed Up"
        : "Not Signed Up";
    }
  }

  function renderGames() {
    if (!elements.athleteGameList) {
      return;
    }
    const hub = getProfileHubState();
    const games = [...hub.games].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    elements.athleteGameList.innerHTML = "";
    if (elements.athleteGameCount) {
      elements.athleteGameCount.textContent = `${games.length} Game${games.length === 1 ? "" : "s"}`;
    }
    if (!games.length) {
      const empty = document.createElement("div");
      empty.className = "athlete-empty";
      empty.textContent = "No past games yet. Add your first game on the left.";
      elements.athleteGameList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    games.forEach((game) => {
      const card = document.createElement("div");
      card.className = `athlete-game-card athlete-game-card--${game.result === "L" ? "loss" : "win"}`;
      const top = document.createElement("div");
      top.className = "athlete-game-top";
      const info = document.createElement("div");
      const opponent = document.createElement("div");
      opponent.className = "athlete-game-opponent";
      opponent.textContent = `vs ${game.opponent || "Opponent"}`;
      const date = document.createElement("div");
      date.className = "athlete-game-date";
      date.textContent = game.date || "No date";
      info.append(opponent, date);
      const result = document.createElement("div");
      result.className = "athlete-game-result";
      result.textContent = game.result;
      top.append(info, result);
      const line = document.createElement("div");
      line.className = "athlete-game-line";
      line.textContent = `${game.points || 0} PTS • ${game.rebounds || 0} REB • ${game.assists || 0} AST`;
      const notes = document.createElement("div");
      notes.className = "athlete-game-notes";
      notes.textContent = game.notes || "No notes added.";
      const remove = document.createElement("button");
      remove.className = "sim-btn";
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        hub.games = hub.games.filter((entry) => entry.id !== game.id);
        saveProfileHubState();
        renderGames();
        setProfileHubStatus("Game removed.");
      });
      card.append(top, line, notes, remove);
      fragment.appendChild(card);
    });
    elements.athleteGameList.appendChild(fragment);
  }

  function renderBounties() {
    if (!elements.athleteBountyList) {
      return;
    }
    const hub = getProfileHubState();
    elements.athleteBountyList.innerHTML = "";
    if (!hub.bounties.length) {
      const empty = document.createElement("div");
      empty.className = "athlete-empty";
      empty.textContent = "No bounties created yet. Set your first goal on the left.";
      elements.athleteBountyList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    hub.bounties.forEach((bounty) => {
      const card = document.createElement("div");
      card.className = "athlete-bounty-card";
      const progress = Number(bounty.target) > 0
        ? Math.max(0, Math.min(100, (Number(bounty.current || 0) / Number(bounty.target)) * 100))
        : 0;
      const head = document.createElement("div");
      head.className = "athlete-bounty-head";
      const headInfo = document.createElement("div");
      const title = document.createElement("div");
      title.className = "athlete-bounty-title";
      title.textContent = bounty.title || "Untitled Bounty";
      const meta = document.createElement("div");
      meta.className = "athlete-bounty-meta";
      meta.textContent = `${bounty.status.toUpperCase()}${bounty.dueDate ? ` • DUE ${bounty.dueDate}` : ""}`;
      headInfo.append(title, meta);
      const value = document.createElement("div");
      value.className = "athlete-bounty-value";
      value.textContent = `${bounty.current || 0} / ${bounty.target || 0}`;
      head.append(headInfo, value);

      const progressWrap = document.createElement("div");
      progressWrap.className = "athlete-bounty-progress";
      const progressFill = document.createElement("div");
      progressFill.className = "athlete-bounty-progress-fill";
      progressFill.style.width = `${progress}%`;
      progressWrap.appendChild(progressFill);

      const inline = document.createElement("div");
      inline.className = "athlete-bounty-inline";
      const currentGroup = document.createElement("label");
      currentGroup.className = "input-group";
      const currentSpan = document.createElement("span");
      currentSpan.textContent = "Current";
      const currentInput = document.createElement("input");
      currentInput.type = "number";
      currentInput.min = "0";
      currentInput.step = "1";
      currentInput.value = String(bounty.current || 0);
      currentInput.dataset.bountyEdit = "current";
      currentGroup.append(currentSpan, currentInput);
      const statusGroup = document.createElement("label");
      statusGroup.className = "input-group";
      const statusSpan = document.createElement("span");
      statusSpan.textContent = "Status";
      const statusSelect = document.createElement("select");
      statusSelect.dataset.bountyEdit = "status";
      ["active", "paused", "complete"].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        option.selected = bounty.status === status;
        statusSelect.appendChild(option);
      });
      statusGroup.append(statusSpan, statusSelect);
      inline.append(currentGroup, statusGroup);

      const notes = document.createElement("div");
      notes.className = "athlete-bounty-notes";
      notes.textContent = bounty.notes || "No notes added.";
      const unit = document.createElement("div");
      unit.className = "athlete-bounty-meta";
      unit.textContent = bounty.unit ? `UNIT: ${bounty.unit.toUpperCase()}` : "UNIT: CUSTOM";
      const actions = document.createElement("div");
      actions.className = "athlete-bounty-actions";
      const saveBtn = document.createElement("button");
      saveBtn.className = "sim-btn";
      saveBtn.type = "button";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => {
        const currentInput = card.querySelector('[data-bounty-edit="current"]');
        const statusInput = card.querySelector('[data-bounty-edit="status"]');
        bounty.current = currentInput?.value === "" ? "" : Number(currentInput?.value) || 0;
        bounty.status = statusInput?.value || "active";
        saveProfileHubState();
        renderBounties();
        setProfileHubStatus("Bounty updated.");
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "sim-btn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        hub.bounties = hub.bounties.filter((entry) => entry.id !== bounty.id);
        saveProfileHubState();
        renderBounties();
        setProfileHubStatus("Bounty removed.");
      });
      actions.append(saveBtn, deleteBtn);
      card.append(head, progressWrap, inline, notes, unit, actions);
      fragment.appendChild(card);
    });
    elements.athleteBountyList.appendChild(fragment);
  }

  function renderSubtab() {
    const hub = getProfileHubState();
    const active = hub.activeSubtab === "bounties" ? "bounties" : "overview";
    elements.athleteSubtabButtons?.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.athleteSubtab === active);
    });
    elements.athleteProfileViews?.forEach((view) => {
      view.classList.toggle("is-active", view.dataset.athleteView === active);
    });
  }

  function renderProfileHub() {
    syncProfileForm();
    renderSummaryStrip();
    renderProfileBadge();
    renderGames();
    renderBounties();
    renderSubtab();
  }

  function updateProfileField(key, value) {
    const hub = getProfileHubState();
    hub.profile[key] = value;
    saveProfileHubState();
    renderProfileBadge();
    setProfileHubStatus("Profile updated.");
  }

  function updateStatField(key, value) {
    const hub = getProfileHubState();
    hub.stats[key] = value;
    saveProfileHubState();
    renderSummaryStrip();
    setProfileHubStatus("Statistics updated.");
  }

  function clearGameForm() {
    if (elements.athleteGameOpponent) {
      elements.athleteGameOpponent.value = "";
    }
    if (elements.athleteGameDate) {
      elements.athleteGameDate.value = "";
    }
    if (elements.athleteGamePoints) {
      elements.athleteGamePoints.value = "";
    }
    if (elements.athleteGameRebounds) {
      elements.athleteGameRebounds.value = "";
    }
    if (elements.athleteGameAssists) {
      elements.athleteGameAssists.value = "";
    }
    if (elements.athleteGameResult) {
      elements.athleteGameResult.value = "W";
    }
    if (elements.athleteGameNotes) {
      elements.athleteGameNotes.value = "";
    }
  }

  function clearBountyForm() {
    if (elements.athleteBountyTitle) {
      elements.athleteBountyTitle.value = "";
    }
    if (elements.athleteBountyUnit) {
      elements.athleteBountyUnit.value = "";
    }
    if (elements.athleteBountyCurrent) {
      elements.athleteBountyCurrent.value = "";
    }
    if (elements.athleteBountyTarget) {
      elements.athleteBountyTarget.value = "";
    }
    if (elements.athleteBountyDueDate) {
      elements.athleteBountyDueDate.value = "";
    }
    if (elements.athleteBountyStatus) {
      elements.athleteBountyStatus.value = "active";
    }
    if (elements.athleteBountyNotes) {
      elements.athleteBountyNotes.value = "";
    }
  }

  function addGame() {
    const opponent = elements.athleteGameOpponent?.value.trim() || "";
    if (!opponent) {
      setProfileHubStatus("Enter an opponent first.");
      return;
    }
    const hub = getProfileHubState();
    hub.games.push(
      normalizeGame({
        opponent,
        date: elements.athleteGameDate?.value || "",
        points: elements.athleteGamePoints?.value || "",
        rebounds: elements.athleteGameRebounds?.value || "",
        assists: elements.athleteGameAssists?.value || "",
        result: elements.athleteGameResult?.value || "W",
        notes: elements.athleteGameNotes?.value.trim() || ""
      })
    );
    saveProfileHubState();
    clearGameForm();
    renderGames();
    setProfileHubStatus("Game added.");
  }

  function addBounty() {
    const title = elements.athleteBountyTitle?.value.trim() || "";
    if (!title) {
      setProfileHubStatus("Enter a bounty title first.");
      return;
    }
    const hub = getProfileHubState();
    hub.bounties.push(
      normalizeBounty({
        title,
        unit: elements.athleteBountyUnit?.value.trim() || "",
        current: elements.athleteBountyCurrent?.value || "",
        target: elements.athleteBountyTarget?.value || "",
        dueDate: elements.athleteBountyDueDate?.value || "",
        status: elements.athleteBountyStatus?.value || "active",
        notes: elements.athleteBountyNotes?.value.trim() || ""
      })
    );
    saveProfileHubState();
    clearBountyForm();
    renderBounties();
    setProfileHubStatus("Bounty created.");
  }

  function maybeOpenBountiesSignup() {
    const hub = getProfileHubState();
    if (!hub.bountiesSignedUp && elements.bountiesSignupModal) {
      openLocalModal(elements.bountiesSignupModal);
    }
  }

  function setAthleteSubtab(subtab) {
    const hub = getProfileHubState();
    hub.activeSubtab = subtab === "bounties" ? "bounties" : "overview";
    saveProfileHubState();
    renderSubtab();
    if (hub.activeSubtab === "bounties") {
      maybeOpenBountiesSignup();
      setProfileHubStatus("Bounties tab open.");
    } else {
      setProfileHubStatus("Profile overview open.");
    }
  }

  function handleAthleteProfileTabActivated() {
    renderProfileHub();
    if (getProfileHubState().activeSubtab === "bounties") {
      maybeOpenBountiesSignup();
    }
  }

  function bindProfileHubEvents() {
    if (bound) {
      return;
    }
    bound = true;

    const profileBindings = [
      ["athleteProfileName", "name"],
      ["athleteProfileTeam", "team"],
      ["athleteProfilePosition", "position"],
      ["athleteProfileClassYear", "classYear"],
      ["athleteProfileHometown", "hometown"],
      ["athleteProfileJersey", "jersey"],
      ["athleteProfileBio", "bio"]
    ];
    profileBindings.forEach(([elementKey, field]) => {
      const element = elements[elementKey];
      if (!element) {
        return;
      }
      element.addEventListener("input", () => {
        updateProfileField(field, element.value);
      });
    });

    const statBindings = [
      ["athleteStatPpg", "ppg"],
      ["athleteStatRpg", "rpg"],
      ["athleteStatApg", "apg"],
      ["athleteStatSpg", "spg"],
      ["athleteStatBpg", "bpg"],
      ["athleteStatFg", "fg"],
      ["athleteStatThree", "three"],
      ["athleteStatFt", "ft"]
    ];
    statBindings.forEach(([elementKey, field]) => {
      const element = elements[elementKey];
      if (!element) {
        return;
      }
      element.addEventListener("input", () => {
        updateStatField(field, element.value);
      });
    });

    elements.athleteSubtabButtons?.forEach((button) => {
      button.addEventListener("click", () => {
        setAthleteSubtab(button.dataset.athleteSubtab);
      });
    });

    elements.athleteAddGame?.addEventListener("click", addGame);
    elements.athleteAddBounty?.addEventListener("click", addBounty);

    elements.bountiesSignupLater?.addEventListener("click", () => {
      closeLocalModal(elements.bountiesSignupModal);
      setProfileHubStatus("Bounty signup skipped.");
    });

    elements.bountiesSignupYes?.addEventListener("click", () => {
      const hub = getProfileHubState();
      hub.bountiesSignedUp = true;
      saveProfileHubState();
      renderProfileBadge();
      closeLocalModal(elements.bountiesSignupModal);
      setProfileHubStatus("Signed up for bounties.");
    });
  }

  function initAthleteProfile() {
    state.athleteProfileHub = loadProfileHubState();
    bindProfileHubEvents();
    renderProfileHub();
  }

  Object.assign(ui, {
    initAthleteProfile,
    renderAthleteProfile: renderProfileHub,
    handleAthleteProfileTabActivated,
    setAthleteSubtab
  });

  return ui;
})();
