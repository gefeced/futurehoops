window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiJournal = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements } = state;
  const journalStorageKey = "futurehoops_journal_entries";
  const journalTagStorageKey = "futurehoops_journal_tags";
  const defaultJournalTags = ["Review", "Guide", "Journal"];
  const journalState = {
    entries: [],
    tags: [...defaultJournalTags],
    activeEntryId: null,
    filterTag: "all",
    autosaveTimer: null,
    listOpen: true
  };

  function generateJournalId() {
    return `journal-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function formatJournalDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function normalizeTag(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function dedupeTags(values) {
    const seen = new Set();
    const tags = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const next = normalizeTag(value);
      const key = next.toLowerCase();
      if (!next || seen.has(key)) {
        return;
      }
      seen.add(key);
      tags.push(next);
    });
    return tags;
  }

  function normalizeMediaItem(item, fallbackId) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const url = typeof item.url === "string" ? item.url : "";
    if (!url) {
      return null;
    }
    const type = item.type === "video" ? "video" : "image";
    return {
      id: typeof item.id === "string" ? item.id : fallbackId,
      type,
      url,
      name: typeof item.name === "string" ? item.name : `${type}-${fallbackId}`
    };
  }

  function normalizeJournalEntry(entry) {
    const source = entry && typeof entry === "object" ? entry : {};
    const nowIso = new Date().toISOString();
    return {
      id: typeof source.id === "string" ? source.id : generateJournalId(),
      title: typeof source.title === "string" ? source.title : "",
      body: typeof source.body === "string" ? source.body : "",
      tags: dedupeTags(source.tags),
      media: (Array.isArray(source.media) ? source.media : [])
        .map((item, index) => normalizeMediaItem(item, `media-${index}`))
        .filter(Boolean),
      createdAt: typeof source.createdAt === "string" ? source.createdAt : nowIso,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : nowIso
    };
  }

  function sortJournalEntries(entries) {
    return entries.slice().sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
  }

  function getActiveJournalEntry() {
    return journalState.entries.find((entry) => entry.id === journalState.activeEntryId) || null;
  }

  function setJournalStatus(message) {
    if (elements.journalStatus) {
      elements.journalStatus.textContent = message;
    }
  }

  function saveJournalEntries() {
    try {
      window.localStorage.setItem(
        journalStorageKey,
        JSON.stringify(journalState.entries)
      );
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function saveJournalTags() {
    try {
      window.localStorage.setItem(
        journalTagStorageKey,
        JSON.stringify(journalState.tags)
      );
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function loadJournalEntries() {
    try {
      const raw = window.localStorage.getItem(journalStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return sortJournalEntries(parsed.map(normalizeJournalEntry));
    } catch (error) {
      return [];
    }
  }

  function loadJournalTags() {
    try {
      const raw = window.localStorage.getItem(journalTagStorageKey);
      const parsed = raw ? JSON.parse(raw) : defaultJournalTags;
      const tags = dedupeTags(Array.isArray(parsed) ? parsed : defaultJournalTags);
      return tags.length ? tags : [...defaultJournalTags];
    } catch (error) {
      return [...defaultJournalTags];
    }
  }

  function syncJournalStorage() {
    journalState.entries = loadJournalEntries();
    journalState.tags = loadJournalTags();
    if (!journalState.entries.length) {
      const entry = createJournalEntry({ silent: true });
      journalState.activeEntryId = entry.id;
      saveJournalEntries();
    } else if (!getActiveJournalEntry()) {
      journalState.activeEntryId = journalState.entries[journalState.entries.length - 1].id;
    }
  }

  function ensureJournalTags(tags) {
    const nextTags = dedupeTags([...journalState.tags, ...tags]);
    journalState.tags = nextTags.length ? nextTags : [...defaultJournalTags];
    saveJournalTags();
  }

  function createJournalEntry({ silent = false } = {}) {
    const nowIso = new Date().toISOString();
    const entry = normalizeJournalEntry({
      id: generateJournalId(),
      title: "",
      body: "",
      tags: ["Journal"],
      media: [],
      createdAt: nowIso,
      updatedAt: nowIso
    });
    ensureJournalTags(entry.tags);
    journalState.entries = sortJournalEntries([...journalState.entries, entry]);
    journalState.activeEntryId = entry.id;
    saveJournalEntries();
    if (!silent) {
      setJournalStatus("New journal entry created.");
    }
    return entry;
  }

  function persistActiveJournalEntry({ silent = false } = {}) {
    const entry = getActiveJournalEntry();
    if (!entry) {
      return;
    }
    entry.updatedAt = new Date().toISOString();
    journalState.entries = sortJournalEntries(journalState.entries);
    saveJournalEntries();
    renderJournalList();
    renderJournalMeta();
    if (!silent) {
      setJournalStatus("Journal saved.");
    }
  }

  function queueJournalSave() {
    if (journalState.autosaveTimer) {
      clearTimeout(journalState.autosaveTimer);
    }
    journalState.autosaveTimer = setTimeout(() => {
      journalState.autosaveTimer = null;
      persistActiveJournalEntry({ silent: true });
      setJournalStatus("Journal autosaved.");
    }, 350);
  }

  function renderJournalMeta() {
    const entry = getActiveJournalEntry();
    if (!elements.journalMeta) {
      return;
    }
    if (!entry) {
      elements.journalMeta.textContent = "No entry selected.";
      return;
    }
    elements.journalMeta.textContent =
      `Created ${formatJournalDate(entry.createdAt)} | Updated ${formatJournalDate(entry.updatedAt)}`;
  }

  function getFilteredJournalEntries() {
    if (journalState.filterTag === "all") {
      return journalState.entries;
    }
    return journalState.entries.filter((entry) => entry.tags.includes(journalState.filterTag));
  }

  function renderJournalFilter() {
    if (!elements.journalFilterTag) {
      return;
    }
    const current = journalState.filterTag;
    elements.journalFilterTag.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Tags";
    elements.journalFilterTag.appendChild(allOption);
    journalState.tags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      elements.journalFilterTag.appendChild(option);
    });
    elements.journalFilterTag.value = current;
  }

  function setActiveJournalEntry(entryId) {
    if (!journalState.entries.some((entry) => entry.id === entryId)) {
      return;
    }
    journalState.activeEntryId = entryId;
    renderJournalEditor();
    renderJournalList();
    renderJournalMeta();
    setJournalStatus("Journal loaded.");
  }

  function renderJournalList() {
    if (!elements.journalEntryList) {
      return;
    }
    const entries = getFilteredJournalEntries();
    elements.journalEntryList.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "journal-empty";
      empty.textContent = "No journal entries match this filter.";
      elements.journalEntryList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `journal-entry-item${entry.id === journalState.activeEntryId ? " is-active" : ""}`;
      const title = document.createElement("div");
      title.className = "journal-entry-title";
      title.textContent = entry.title || "Untitled Entry";
      const date = document.createElement("div");
      date.className = "journal-entry-date";
      date.textContent = formatJournalDate(entry.createdAt);
      const tags = document.createElement("div");
      tags.className = "journal-entry-tags";
      tags.textContent = entry.tags.length ? entry.tags.join(" • ") : "No Tags";
      button.append(title, date, tags);
      button.addEventListener("click", () => {
        setActiveJournalEntry(entry.id);
      });
      fragment.appendChild(button);
    });
    elements.journalEntryList.appendChild(fragment);
  }

  function renderJournalTagButtons() {
    if (!elements.journalTagList) {
      return;
    }
    const entry = getActiveJournalEntry();
    elements.journalTagList.innerHTML = "";
    if (!entry) {
      return;
    }
    const fragment = document.createDocumentFragment();
    journalState.tags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tag-chip${entry.tags.includes(tag) ? " is-active" : ""}`;
      button.textContent = tag;
      button.addEventListener("click", () => {
        if (entry.tags.includes(tag)) {
          entry.tags = entry.tags.filter((value) => value !== tag);
        } else {
          entry.tags = dedupeTags([...entry.tags, tag]);
        }
        queueJournalSave();
        renderJournalTagButtons();
        renderJournalList();
        renderJournalSettingsTags();
      });
      fragment.appendChild(button);
    });
    elements.journalTagList.appendChild(fragment);
  }

  function renderJournalMedia() {
    if (!elements.journalMediaGrid) {
      return;
    }
    const entry = getActiveJournalEntry();
    elements.journalMediaGrid.innerHTML = "";
    if (!entry?.media?.length) {
      return;
    }
    const fragment = document.createDocumentFragment();
    entry.media.forEach((item) => {
      const card = document.createElement("div");
      card.className = "journal-media-card";
      const media = document.createElement(item.type === "video" ? "video" : "img");
      media.className = "journal-media-preview";
      media.src = item.url;
      if (item.type === "video") {
        media.controls = true;
      } else {
        media.alt = item.name || "Journal media";
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "sim-btn";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        entry.media = entry.media.filter((mediaItem) => mediaItem.id !== item.id);
        queueJournalSave();
        renderJournalMedia();
      });
      card.append(media, remove);
      fragment.appendChild(card);
    });
    elements.journalMediaGrid.appendChild(fragment);
  }

  function renderJournalEditor() {
    const entry = getActiveJournalEntry();
    if (elements.journalTitleInput) {
      elements.journalTitleInput.value = entry?.title || "";
    }
    if (elements.journalBodyInput) {
      elements.journalBodyInput.value = entry?.body || "";
    }
    renderJournalTagButtons();
    renderJournalMedia();
    renderJournalMeta();
  }

  function renderJournalSettingsTags() {
    if (!elements.journalSettingsTagList) {
      return;
    }
    elements.journalSettingsTagList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    journalState.tags.forEach((tag) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip tag-chip--removable";
      chip.textContent = tag;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-chip-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${tag}`);
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        if (journalState.tags.length <= 1) {
          setJournalStatus("At least one journal tag must remain.");
          return;
        }
        journalState.tags = journalState.tags.filter((value) => value !== tag);
        journalState.entries.forEach((entry) => {
          entry.tags = entry.tags.filter((value) => value !== tag);
        });
        if (journalState.filterTag === tag) {
          journalState.filterTag = "all";
        }
        saveJournalTags();
        saveJournalEntries();
        renderJournalSettingsTags();
        renderJournalFilter();
        renderJournalTagButtons();
        renderJournalList();
        setJournalStatus(`Removed tag "${tag}".`);
      });
      chip.appendChild(remove);
      fragment.appendChild(chip);
    });
    elements.journalSettingsTagList.appendChild(fragment);
  }

  function renderJournalView() {
    renderJournalFilter();
    renderJournalList();
    renderJournalEditor();
    renderJournalSettingsTags();
  }

  function addJournalTagFromSettings() {
    const nextTag = normalizeTag(elements.journalTagInput?.value);
    if (!nextTag) {
      setJournalStatus("Enter a journal tag first.");
      return;
    }
    const exists = journalState.tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase());
    if (exists) {
      setJournalStatus("That journal tag already exists.");
      return;
    }
    journalState.tags = dedupeTags([...journalState.tags, nextTag]);
    saveJournalTags();
    if (elements.journalTagInput) {
      elements.journalTagInput.value = "";
    }
    renderJournalFilter();
    renderJournalTagButtons();
    renderJournalSettingsTags();
    setJournalStatus(`Added tag "${nextTag}".`);
  }

  function navigateJournalEntry(direction) {
    const entries = getFilteredJournalEntries();
    const index = entries.findIndex((entry) => entry.id === journalState.activeEntryId);
    if (index < 0) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) {
      return;
    }
    setActiveJournalEntry(entries[nextIndex].id);
  }

  function toggleJournalList() {
    journalState.listOpen = !journalState.listOpen;
    if (elements.journalListCard) {
      elements.journalListCard.style.display = journalState.listOpen ? "grid" : "none";
    }
  }

  function detectMediaType(file) {
    return file.type.startsWith("video/") ? "video" : "image";
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function attachJournalMedia(files) {
    const entry = getActiveJournalEntry();
    if (!entry || !files?.length) {
      return;
    }
    try {
      const items = await Promise.all(
        Array.from(files).map(async (file, index) => ({
          id: `media-${Date.now()}-${index}`,
          type: detectMediaType(file),
          url: await readFileAsDataUrl(file),
          name: file.name
        }))
      );
      entry.media = [...entry.media, ...items];
      queueJournalSave();
      renderJournalMedia();
      setJournalStatus("Media attached.");
    } catch (error) {
      setJournalStatus("Unable to attach media.");
    }
  }

  function exportJournalData() {
    const payload = {
      format: "futurehoops-journal",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tags: journalState.tags,
      entries: journalState.entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "journal-data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setJournalStatus("Journal data exported.");
  }

  async function importJournalData(file) {
    if (!file) {
      return;
    }
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      if (!payload || payload.format !== "futurehoops-journal" || payload.schemaVersion !== 1) {
        throw new Error("Invalid journal import file.");
      }
      journalState.tags = dedupeTags(payload.tags);
      if (!journalState.tags.length) {
        journalState.tags = [...defaultJournalTags];
      }
      journalState.entries = sortJournalEntries(
        (Array.isArray(payload.entries) ? payload.entries : []).map(normalizeJournalEntry)
      );
      if (!journalState.entries.length) {
        createJournalEntry({ silent: true });
      }
      journalState.activeEntryId = journalState.entries[journalState.entries.length - 1].id;
      journalState.filterTag = "all";
      saveJournalTags();
      saveJournalEntries();
      renderJournalView();
      setJournalStatus("Journal data imported.");
    } catch (error) {
      setJournalStatus(error?.message || "Unable to import journal data.");
    }
  }

  function bindJournalEvents() {
    elements.journalPrevButton?.addEventListener("click", () => navigateJournalEntry(-1));
    elements.journalNextButton?.addEventListener("click", () => navigateJournalEntry(1));
    elements.journalListToggle?.addEventListener("click", () => toggleJournalList());
    elements.journalNewEntryButton?.addEventListener("click", () => {
      createJournalEntry();
      renderJournalView();
    });
    elements.journalTitleInput?.addEventListener("input", (event) => {
      const entry = getActiveJournalEntry();
      if (!entry) {
        return;
      }
      entry.title = event.target.value;
      queueJournalSave();
      renderJournalList();
    });
    elements.journalBodyInput?.addEventListener("input", (event) => {
      const entry = getActiveJournalEntry();
      if (!entry) {
        return;
      }
      entry.body = event.target.value;
      queueJournalSave();
    });
    elements.journalFilterTag?.addEventListener("change", (event) => {
      journalState.filterTag = event.target.value;
      renderJournalList();
    });
    elements.journalMediaButton?.addEventListener("click", () => {
      elements.journalMediaInput?.click();
    });
    elements.journalMediaInput?.addEventListener("change", () => {
      const files = elements.journalMediaInput.files;
      attachJournalMedia(files);
      elements.journalMediaInput.value = "";
    });
    elements.journalExportButton?.addEventListener("click", () => exportJournalData());
    elements.journalImportButton?.addEventListener("click", () => {
      elements.journalImportInput?.click();
    });
    elements.journalImportInput?.addEventListener("change", () => {
      const [file] = elements.journalImportInput.files || [];
      importJournalData(file);
      elements.journalImportInput.value = "";
    });
    elements.journalAddTagButton?.addEventListener("click", () => addJournalTagFromSettings());
    elements.journalTagInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addJournalTagFromSettings();
      }
    });
  }

  function initJournal() {
    syncJournalStorage();
    renderJournalView();
    bindJournalEvents();
  }

  function resetJournalData() {
    try {
      window.localStorage.removeItem(journalStorageKey);
      window.localStorage.removeItem(journalTagStorageKey);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  Object.assign(ui, {
    initJournal,
    exportJournalData,
    importJournalData,
    resetJournalData
  });

  return ui;
})();
