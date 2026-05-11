window.FutureHoops = window.FutureHoops || {};
window.FutureHoops.ui = window.FutureHoops.ui || {};

window.FutureHoops.uiEvents = (() => {
  const ui = window.FutureHoops.ui;
  const state = window.FutureHoops.uiState;
  const { elements, designerState, gameState } = state;
  const { data, calc, sim, stepEditor } = window.FutureHoops;
  const settingsApi = window.FutureHoops.settings;
  let activeModal = null;
  let confirmAction = null;
  let importConflictResolver = null;

  function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
    if (elements.confirmActionModalTitle) {
      elements.confirmActionModalTitle.textContent = title || "Confirm Action";
    }
    if (elements.confirmActionModalBody) {
      elements.confirmActionModalBody.innerHTML = "";
      const para = document.createElement("p");
      para.textContent = message || "Are you sure you want to continue?";
      elements.confirmActionModalBody.appendChild(para);
    }
    if (elements.confirmActionModalConfirm) {
      elements.confirmActionModalConfirm.textContent = confirmLabel || "Confirm";
    }
    confirmAction = typeof onConfirm === "function" ? onConfirm : null;
    openModal(elements.confirmActionModal);
  }

  function resolveImportConflict(choice) {
    const resolver = importConflictResolver;
    importConflictResolver = null;
    closeModal(elements.importConflictModal);
    if (typeof resolver === "function") {
      resolver(choice);
    }
  }

  function chooseDesignerImportConflict({ incomingName, existingName }) {
    if (elements.importConflictModalTitle) {
      elements.importConflictModalTitle.textContent = "Play Already Exists";
    }
    if (elements.importConflictModalBody) {
      elements.importConflictModalBody.innerHTML = "";
      const first = document.createElement("p");
      first.textContent =
        `A play named "${existingName || incomingName || "this play"}" already exists.`;
      const second = document.createElement("p");
      second.textContent = "Choose whether to overwrite it, create a new imported copy, or cancel.";
      elements.importConflictModalBody.appendChild(first);
      elements.importConflictModalBody.appendChild(second);
    }
    if (importConflictResolver) {
      importConflictResolver(null);
      importConflictResolver = null;
    }
    openModal(elements.importConflictModal);
    return new Promise((resolve) => {
      importConflictResolver = resolve;
    });
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

  function openModal(modal) {
    if (!modal) {
      return;
    }
    if (modal === elements.gameModeModal && elements.gameModeModalError) {
      elements.gameModeModalError.textContent = "";
      elements.gameModeModalError.classList.remove("is-visible");
      if (elements.gameModePassword) {
        elements.gameModePassword.value = "";
        elements.gameModePassword.focus();
      }
    }
    activeModal = modal;
    setModalVisible(modal, true);
  }

  function closeModal(modal) {
    if (!modal) {
      return;
    }
    setModalVisible(modal, false);
    if (activeModal === modal) {
      activeModal = null;
    }
    if (modal === elements.confirmActionModal) {
      confirmAction = null;
    }
    if (modal === elements.importConflictModal && importConflictResolver) {
      const resolver = importConflictResolver;
      importConflictResolver = null;
      resolver(null);
    }
  }

  function bindEvents() {
    elements.playerNameInput.addEventListener("change", ui.handleProfileUpdate);
    elements.playerPositionSelect.addEventListener("change", ui.handleProfileUpdate);
    elements.playerArchetypeSelect.addEventListener("change", ui.handleProfileUpdate);

    elements.addPlayerBtn.addEventListener("click", ui.createNewPlayer);

    elements.confidenceRows.forEach((row) => {
      const input = row.querySelector(".metric-input");
      if (!input) {
        return;
      }
      input.addEventListener("input", (event) => {
        const player = data.players[state.activeIndex];
        if (!player) {
          return;
        }
        const key = row.dataset.confidence;
        const value = Number(event.target.value);
        player.confidence[key] = value;
        if (data?.syncPlayerConfidenceMatrix) {
          data.syncPlayerConfidenceMatrix(player);
        }
        ui.updateConfidence?.(player.confidence);
        const performance = ui.updatePercentages ? ui.updatePercentages(player) : null;
        if (performance) {
          ui.refreshRatingPercents?.(performance);
        }
        ui.updateGameStats?.();
        ui.queueRosterSave?.();
      });
    });

    if (elements.fatigueInput) {
      elements.fatigueInput.addEventListener("input", (event) => {
        const player = data.players[state.activeIndex];
        if (!player) {
          return;
        }
        const value = Number(event.target.value);
        player.fatigue = value;
        ui.updateFatigue?.(player.fatigue);
        const performance = ui.updatePercentages ? ui.updatePercentages(player) : null;
        if (performance) {
          ui.refreshRatingPercents?.(performance);
        }
        ui.startFatigueRecovery?.();
        ui.updateGameStats?.();
        ui.queueRosterSave?.();
      });
    }

    elements.scrollLeftBtn.addEventListener("click", () => {
      elements.playerTrack.scrollBy({ left: -220, behavior: "smooth" });
    });

    elements.scrollRightBtn.addEventListener("click", () => {
      elements.playerTrack.scrollBy({ left: 220, behavior: "smooth" });
    });

    if (elements.mobileWarningClose) {
      elements.mobileWarningClose.addEventListener("click", () => {
        state.mobile.warningDismissed = true;
        elements.mobileWarning.classList.remove("is-visible");
        elements.mobileWarning.setAttribute("aria-hidden", "true");
      });
    }

    if (elements.settingsGhostToggle) {
      elements.settingsGhostToggle.addEventListener("change", () => {
        if (settingsApi?.setSetting) {
          settingsApi.setSetting("showGhostLines", elements.settingsGhostToggle.checked);
        }
        ui.applyGhostSetting?.();
      });
    }

    if (elements.settingsDesignerGhostToggle) {
      elements.settingsDesignerGhostToggle.addEventListener("change", () => {
        if (settingsApi?.setSetting) {
          settingsApi.setSetting(
            "showDesignerGhosts",
            elements.settingsDesignerGhostToggle.checked
          );
        }
        ui.applyDesignerGhostSetting?.();
      });
    }

    if (elements.settingsAnnotationGhostToggle) {
      elements.settingsAnnotationGhostToggle.addEventListener("change", () => {
        if (settingsApi?.setSetting) {
          settingsApi.setSetting(
            "showAnnotationGhosts",
            elements.settingsAnnotationGhostToggle.checked
          );
        }
        ui.applyAnnotationGhostSetting?.();
      });
    }

    if (elements.settingsPlayerNumberToggle) {
      elements.settingsPlayerNumberToggle.addEventListener("change", () => {
        if (settingsApi?.setSetting) {
          settingsApi.setSetting(
            "showPlayerNumbers",
            elements.settingsPlayerNumberToggle.checked
          );
        }
        ui.applyPlayerNumberSetting?.();
      });
    }

    if (elements.settingsAdvancedToggle) {
      elements.settingsAdvancedToggle.addEventListener("change", () => {
        if (settingsApi?.setSetting) {
          settingsApi.setSetting("advancedMode", elements.settingsAdvancedToggle.checked);
        }
        ui.applyAdvancedModeSetting?.();
      });
    }

    if (elements.settingsAdvancedInfo) {
      elements.settingsAdvancedInfo.addEventListener("click", () => {
        openModal(elements.advancedModeModal);
      });
    }

    if (elements.settingsChangelogButton) {
      elements.settingsChangelogButton.addEventListener("click", () => {
        openModal(elements.settingsChangelogModal);
      });
    }

    if (elements.settingsOverviewInfo) {
      elements.settingsOverviewInfo.addEventListener("click", () => {
        openModal(elements.settingsOverviewModal);
      });
    }

    if (elements.settingsMobileWarningToggle) {
      elements.settingsMobileWarningToggle.addEventListener("change", () => {
        if (settingsApi?.setSetting) {
          settingsApi.setSetting(
            "showMobileWarning",
            elements.settingsMobileWarningToggle.checked
          );
        }
        ui.applyMobileWarningSetting?.({
          resetDismissed: elements.settingsMobileWarningToggle.checked
        });
      });
    }

    if (elements.settingsResetAll) {
      elements.settingsResetAll.addEventListener("click", () => {
        openModal(elements.resetDataModal);
      });
    }

    if (elements.advancedModeModalClose) {
      elements.advancedModeModalClose.addEventListener("click", () => {
        closeModal(elements.advancedModeModal);
      });
    }

    if (elements.settingsOverviewModalClose) {
      elements.settingsOverviewModalClose.addEventListener("click", () => {
        closeModal(elements.settingsOverviewModal);
      });
    }

    if (elements.settingsChangelogModalClose) {
      elements.settingsChangelogModalClose.addEventListener("click", () => {
        closeModal(elements.settingsChangelogModal);
      });
    }

    if (elements.confirmActionModalCancel) {
      elements.confirmActionModalCancel.addEventListener("click", () => {
        confirmAction = null;
        closeModal(elements.confirmActionModal);
      });
    }

    if (elements.confirmActionModalConfirm) {
      elements.confirmActionModalConfirm.addEventListener("click", () => {
        if (confirmAction) {
          confirmAction();
        }
        confirmAction = null;
        closeModal(elements.confirmActionModal);
      });
    }

    if (elements.importConflictModalCancel) {
      elements.importConflictModalCancel.addEventListener("click", () => {
        resolveImportConflict(null);
      });
    }

    if (elements.importConflictModalCopy) {
      elements.importConflictModalCopy.addEventListener("click", () => {
        resolveImportConflict("copy");
      });
    }

    if (elements.importConflictModalOverwrite) {
      elements.importConflictModalOverwrite.addEventListener("click", () => {
        resolveImportConflict("overwrite");
      });
    }

    if (elements.gameModeModalClose) {
      elements.gameModeModalClose.addEventListener("click", () => {
        closeModal(elements.gameModeModal);
      });
    }

    if (elements.gameModeModalEnter) {
      elements.gameModeModalEnter.addEventListener("click", () => {
        const password = elements.gameModePassword
          ? elements.gameModePassword.value.trim()
          : "";
        if (password === "1000") {
          state.gameModeUnlocked = true;
          closeModal(elements.gameModeModal);
          ui.setActiveTab?.("game");
          return;
        }
        if (elements.gameModeModalError) {
          elements.gameModeModalError.textContent =
            "Incorrect password. Game Mode remains locked.";
          elements.gameModeModalError.classList.add("is-visible");
        }
      });
    }

    if (elements.gameModePassword) {
      elements.gameModePassword.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          elements.gameModeModalEnter?.click();
        }
      });
      elements.gameModePassword.addEventListener("input", () => {
        if (elements.gameModeModalError) {
          elements.gameModeModalError.textContent = "";
          elements.gameModeModalError.classList.remove("is-visible");
        }
      });
    }

    if (elements.resetDataModalCancel) {
      elements.resetDataModalCancel.addEventListener("click", () => {
        closeModal(elements.resetDataModal);
      });
    }

    if (elements.resetDataModalConfirm) {
      elements.resetDataModalConfirm.addEventListener("click", () => {
        closeModal(elements.resetDataModal);
        ui.resetAllData?.();
      });
    }

    if (elements.mobileLeftToggle) {
      elements.mobileLeftToggle.addEventListener("click", () => {
        ui.toggleMobilePanel?.("left");
      });
    }

    if (elements.mobileRightToggle) {
      elements.mobileRightToggle.addEventListener("click", () => {
        ui.toggleMobilePanel?.("right");
      });
    }

    if (elements.mobilePanelOverlay) {
      elements.mobilePanelOverlay.addEventListener("click", () => {
        ui.closeMobilePanels?.();
      });
    }

    if (elements.modalOverlay) {
      elements.modalOverlay.addEventListener("click", () => {
        if (activeModal) {
          closeModal(activeModal);
        }
      });
    }

    if (elements.mobileLeftClose) {
      elements.mobileLeftClose.addEventListener("click", () => {
        ui.closeMobilePanels?.();
      });
    }

    if (elements.mobileRightClose) {
      elements.mobileRightClose.addEventListener("click", () => {
        ui.closeMobilePanels?.();
      });
    }

    if (elements.defenderMode && sim) {
      elements.defenderMode.addEventListener("change", () => {
        ui.syncDefenderMode?.();
      });
    }

    if (elements.defenderRating) {
      elements.defenderRating.addEventListener("input", () => {
        ui.syncDefenderValues?.();
      });
    }

    if (elements.contestLevel) {
      elements.contestLevel.addEventListener("input", () => {
        ui.syncDefenderValues?.();
      });
    }

    if (elements.shotDifficulty) {
      elements.shotDifficulty.addEventListener("input", () => {
        ui.syncDefenderValues?.();
      });
    }

    if (elements.simStart && sim) {
      elements.simStart.addEventListener("click", () => {
        sim.startPossession();
      });
    }

    if (elements.simEnd && sim) {
      elements.simEnd.addEventListener("click", () => {
        sim.endPossession();
      });
    }

    if (elements.simActionButtons.length && sim) {
      elements.simActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const actionType = button.dataset.simAction;
          const result = sim.takeAction(actionType);
          if (result?.entry) {
            ui.refreshActivePlayer?.();
            ui.renderSimLog?.(sim.getLog());
          }
        });
      });
    }

    if (elements.courtCanvas) {
      elements.courtCanvas.addEventListener("click", ui.handleCourtClick);
      elements.courtCanvas.addEventListener("pointerdown", ui.handleDrawStart);
      elements.courtCanvas.addEventListener("pointermove", ui.handleDrawMove);
    }

    if (elements.designerCourt) {
      elements.designerCourt.addEventListener("pointerdown", ui.handleDesignerPointerDown);
      elements.designerCourt.addEventListener("pointermove", ui.handleDesignerPointerMove);
    }

    if (elements.gameCourt) {
      elements.gameCourt.addEventListener("pointerdown", ui.handleGameCourtTap);
    }

    if (elements.simAiShot && sim) {
      elements.simAiShot.addEventListener("click", () => {
        const location = ui.generateAiShotLocation?.();
        if (!location) {
          return;
        }
        ui.handleCourtShot?.(location.x, location.y);
      });
    }

    window.addEventListener("pointerup", ui.handleDrawEnd);
    window.addEventListener("pointerup", ui.handleDesignerPointerUp);
    window.addEventListener("pointermove", ui.handleMobileJoystickMove);
    window.addEventListener("pointerup", ui.handleMobileJoystickEnd);
    window.addEventListener("pointercancel", ui.handleMobileJoystickEnd);

    if (elements.runPlay) {
      elements.runPlay.addEventListener("click", ui.runSelectedPlay);
    }

    if (elements.drawPlayToggle) {
      elements.drawPlayToggle.addEventListener("click", () => {
        ui.toggleDrawMode?.();
      });
    }

    if (elements.shootPrimary) {
      elements.shootPrimary.addEventListener("click", () => {
        ui.takePlayShot?.("primary");
      });
    }

    if (elements.passSecondary) {
      elements.passSecondary.addEventListener("click", () => {
        ui.takePlayShot?.("secondary");
      });
    }

    if (elements.resetPlay) {
      elements.resetPlay.addEventListener("click", () => {
        ui.clearPlayState?.();
      });
    }

    if (elements.designerToolButtons.length) {
      elements.designerToolButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const nextTool = button.dataset.designerTool;
          if (designerState.mode === nextTool) {
            ui.setDesignerTool?.("edit");
            return;
          }
          ui.setDesignerTool?.(nextTool);
        });
      });
    }

    if (elements.designerPlaceButtons.length) {
      elements.designerPlaceButtons.forEach((button) => {
        button.addEventListener("click", () => {
          ui.setDesignerPlaceTarget?.(button.dataset.designerPlace);
        });
      });
    }

    if (elements.designerClearSelection) {
      elements.designerClearSelection.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        ui.setDesignerSelection?.(null);
        ui.renderDesignerCourt?.();
      });
    }

    if (elements.designerClearRoutes) {
      elements.designerClearRoutes.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        openConfirmModal({
          title: "Clear Routes",
          message: "Clear all routes in the current step? This cannot be undone.",
          confirmLabel: "Clear Routes",
          onConfirm: () => {
            ui.clearDesignerRoutes?.();
          }
        });
      });
    }

    if (elements.designerClearPasses) {
      elements.designerClearPasses.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        openConfirmModal({
          title: "Clear Passes",
          message: "Clear all passes in the current step? This cannot be undone.",
          confirmLabel: "Clear Passes",
          onConfirm: () => {
            ui.clearDesignerPasses?.();
          }
        });
      });
    }

    if (elements.designerPreviewPlay) {
      elements.designerPreviewPlay.addEventListener("click", () => {
        if (designerState.previewRunner) {
          ui.stopDesignerPreview?.();
          return;
        }
        ui.startDesignerPreview?.();
      });
    }

    if (elements.mobileJoystick) {
      elements.mobileJoystick.addEventListener("pointerdown", ui.handleMobileJoystickStart);
    }

    if (elements.mobileShootBtn) {
      elements.mobileShootBtn.addEventListener("click", () => {
        ui.triggerGameShot?.();
      });
    }

    if (elements.mobilePlayBtn) {
      elements.mobilePlayBtn.addEventListener("click", () => {
        ui.toggleGamePlayMenu?.();
      });
    }

    if (elements.designerMidPreviewPlay) {
      elements.designerMidPreviewPlay.addEventListener("click", () => {
        ui.startDesignerPreview?.();
      });
    }

    if (elements.designerPreviewPause) {
      elements.designerPreviewPause.addEventListener("click", () => {
        ui.toggleDesignerPreviewPause?.();
      });
    }

    if (elements.designerMidPreviewPause) {
      elements.designerMidPreviewPause.addEventListener("click", () => {
        ui.toggleDesignerPreviewPause?.();
      });
    }

    if (elements.designerPreviewStop) {
      elements.designerPreviewStop.addEventListener("click", () => {
        ui.stopDesignerPreview?.();
      });
    }

    if (elements.designerMidPreviewStop) {
      elements.designerMidPreviewStop.addEventListener("click", () => {
        ui.stopDesignerPreview?.();
      });
    }

    if (elements.designerPlayName) {
      elements.designerPlayName.addEventListener("input", () => {
        ui.syncDesignerInputs?.();
        ui.renderDesignerPlaybook?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerPlayTags) {
      elements.designerPlayTags.addEventListener("input", () => {
        ui.syncDesignerInputs?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerPlayNotes) {
      elements.designerPlayNotes.addEventListener("input", () => {
        ui.syncDesignerInputs?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerAddStep) {
      elements.designerAddStep.addEventListener("click", () => {
        if (!designerState.play) {
          return;
        }
        if (designerState.previewRunner) {
          return;
        }
        const step = stepEditor?.addStep
          ? stepEditor.addStep(designerState.play, designerState.selectedStepId)
          : null;
        if (step) {
          ui.setCurrentStep?.(step.id);
          ui.setDesignerStatus?.("Step added.");
          ui.queueDesignerSave?.();
        }
      });
    }

    if (elements.designerDeleteStep) {
      elements.designerDeleteStep.addEventListener("click", () => {
        if (!designerState.play) {
          return;
        }
        if (designerState.previewRunner) {
          return;
        }
        if (designerState.play.steps.length <= 1) {
          return;
        }
        const removedId = designerState.selectedStepId;
        const nextId = stepEditor?.deleteStep
          ? stepEditor.deleteStep(designerState.play, designerState.selectedStepId)
          : designerState.selectedStepId;
        if (removedId) {
          ui.removeDesignerAnnotationsForStep?.(removedId);
        }
        ui.setCurrentStep?.(nextId);
        ui.setDesignerStatus?.("Step removed.");
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerStepUp) {
      elements.designerStepUp.addEventListener("click", () => {
        if (!designerState.play) {
          return;
        }
        if (designerState.previewRunner) {
          return;
        }
        const nextId = stepEditor?.moveStep
          ? stepEditor.moveStep(designerState.play, designerState.selectedStepId, -1)
          : designerState.selectedStepId;
        ui.setCurrentStep?.(nextId);
        ui.setDesignerStatus?.("Step moved.");
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerStepDown) {
      elements.designerStepDown.addEventListener("click", () => {
        if (!designerState.play) {
          return;
        }
        if (designerState.previewRunner) {
          return;
        }
        const nextId = stepEditor?.moveStep
          ? stepEditor.moveStep(designerState.play, designerState.selectedStepId, 1)
          : designerState.selectedStepId;
        ui.setCurrentStep?.(nextId);
        ui.setDesignerStatus?.("Step moved.");
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerStepName) {
      elements.designerStepName.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        if (!step) {
          return;
        }
        step.name = elements.designerStepName.value.trim() || `Step ${step.index}`;
        ui.renderDesignerStepList?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerStepDuration) {
      elements.designerStepDuration.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        if (!step) {
          return;
        }
        const nextValue = Number(elements.designerStepDuration.value);
        step.durationSec = calc.clamp(Number.isFinite(nextValue) ? nextValue : 2, 0.2, 20);
        if (Array.isArray(step.actions)) {
          step.actions.forEach((action) => {
            if (action?.type === "PASS") {
              action.passAtSec = calc.clamp(
                Number(action.passAtSec ?? 0.5),
                0,
                step.durationSec
              );
            }
          });
        }
        ui.renderDesignerContext?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerStepParallel) {
      elements.designerStepParallel.addEventListener("change", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        if (!step) {
          return;
        }
        step.allowParallel = Boolean(elements.designerStepParallel.checked);
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerGhostToggle) {
      elements.designerGhostToggle.addEventListener("change", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        if (!step) {
          return;
        }
        step.ghostPreviewMode = elements.designerGhostToggle.checked ? "PREV_ONLY" : "OFF";
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerScreenToggle) {
      elements.designerScreenToggle.addEventListener("change", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "player") {
          return;
        }
        if (stepEditor?.toggleScreenTag) {
          stepEditor.toggleScreenTag(step, selection.id, elements.designerScreenToggle.checked);
        }
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerTagToggle) {
      elements.designerTagToggle.addEventListener("change", () => {
        if (designerState.previewRunner) {
          return;
        }
        const selection = designerState.selectedObject;
        if (selection?.type !== "player" || !designerState.play) {
          return;
        }
        const player = designerState.play.players.find((item) => item.id === selection.id);
        if (!player) {
          return;
        }
        player.labelEnabled = Boolean(elements.designerTagToggle.checked);
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerTagInput) {
      elements.designerTagInput.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const selection = designerState.selectedObject;
        if (selection?.type !== "player" || !designerState.play) {
          return;
        }
        const player = designerState.play.players.find((item) => item.id === selection.id);
        if (!player) {
          return;
        }
        const nextValue = elements.designerTagInput.value.trim();
        player.label = nextValue;
        if (nextValue) {
          if (typeof player.labelEnabled !== "boolean") {
            player.labelEnabled = true;
          }
        } else {
          player.labelEnabled = false;
        }
        if (elements.designerTagToggle) {
          elements.designerTagToggle.checked = Boolean(player.labelEnabled);
        }
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerDeleteRoute) {
      elements.designerDeleteRoute.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "route") {
          return;
        }
        if (stepEditor?.removeAction) {
          stepEditor.removeAction(step, selection.id);
        }
        if (stepEditor?.applyStepToView) {
          stepEditor.applyStepToView(designerState.play, ui.getCurrentStepIndex?.());
        }
        ui.setDesignerSelection?.(null);
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerMidDeleteRoute) {
      elements.designerMidDeleteRoute.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "route") {
          return;
        }
        if (stepEditor?.removeAction) {
          stepEditor.removeAction(step, selection.id);
        }
        if (stepEditor?.applyStepToView) {
          stepEditor.applyStepToView(designerState.play, ui.getCurrentStepIndex?.());
        }
        ui.setDesignerSelection?.(null);
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerDeletePass) {
      elements.designerDeletePass.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "pass") {
          return;
        }
        if (stepEditor?.removeAction) {
          stepEditor.removeAction(step, selection.id);
        }
        if (stepEditor?.applyStepToView) {
          stepEditor.applyStepToView(designerState.play, ui.getCurrentStepIndex?.());
        }
        ui.setDesignerSelection?.(null);
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerMidDeletePass) {
      elements.designerMidDeletePass.addEventListener("click", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "pass") {
          return;
        }
        if (stepEditor?.removeAction) {
          stepEditor.removeAction(step, selection.id);
        }
        if (stepEditor?.applyStepToView) {
          stepEditor.applyStepToView(designerState.play, ui.getCurrentStepIndex?.());
        }
        ui.setDesignerSelection?.(null);
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerPassTime) {
      elements.designerPassTime.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "pass") {
          return;
        }
        const nextValue = Number(elements.designerPassTime.value);
        const duration = Number(step.durationSec ?? 2);
        const clamped = calc.clamp(Number.isFinite(nextValue) ? nextValue : 0.5, 0, duration);
        if (stepEditor?.updatePassAction) {
          stepEditor.updatePassAction(step, selection.id, clamped);
        }
        if (elements.designerPassSlider) {
          elements.designerPassSlider.value = String(clamped);
        }
        if (elements.designerMidPassSlider) {
          elements.designerMidPassSlider.value = String(clamped);
        }
        if (elements.designerMidPassTime) {
          elements.designerMidPassTime.value = clamped.toFixed(1);
        }
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerMidPassTime) {
      elements.designerMidPassTime.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "pass") {
          return;
        }
        const nextValue = Number(elements.designerMidPassTime.value);
        const duration = Number(step.durationSec ?? 2);
        const clamped = calc.clamp(Number.isFinite(nextValue) ? nextValue : 0.5, 0, duration);
        if (stepEditor?.updatePassAction) {
          stepEditor.updatePassAction(step, selection.id, clamped);
        }
        if (elements.designerPassSlider) {
          elements.designerPassSlider.value = String(clamped);
        }
        if (elements.designerPassTime) {
          elements.designerPassTime.value = clamped.toFixed(1);
        }
        if (elements.designerMidPassSlider) {
          elements.designerMidPassSlider.value = String(clamped);
        }
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerPassSlider) {
      elements.designerPassSlider.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "pass") {
          return;
        }
        const nextValue = Number(elements.designerPassSlider.value);
        const duration = Number(step.durationSec ?? 2);
        const clamped = calc.clamp(Number.isFinite(nextValue) ? nextValue : 0.5, 0, duration);
        if (stepEditor?.updatePassAction) {
          stepEditor.updatePassAction(step, selection.id, clamped);
        }
        if (elements.designerPassTime) {
          elements.designerPassTime.value = clamped.toFixed(1);
        }
        if (elements.designerMidPassTime) {
          elements.designerMidPassTime.value = clamped.toFixed(1);
        }
        if (elements.designerMidPassSlider) {
          elements.designerMidPassSlider.value = String(clamped);
        }
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerMidPassSlider) {
      elements.designerMidPassSlider.addEventListener("input", () => {
        if (designerState.previewRunner) {
          return;
        }
        const step = ui.getCurrentStep?.();
        const selection = designerState.selectedObject;
        if (!step || selection?.type !== "pass") {
          return;
        }
        const nextValue = Number(elements.designerMidPassSlider.value);
        const duration = Number(step.durationSec ?? 2);
        const clamped = calc.clamp(Number.isFinite(nextValue) ? nextValue : 0.5, 0, duration);
        if (stepEditor?.updatePassAction) {
          stepEditor.updatePassAction(step, selection.id, clamped);
        }
        if (elements.designerPassTime) {
          elements.designerPassTime.value = clamped.toFixed(1);
        }
        if (elements.designerPassSlider) {
          elements.designerPassSlider.value = String(clamped);
        }
        if (elements.designerMidPassTime) {
          elements.designerMidPassTime.value = clamped.toFixed(1);
        }
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerBallHolder) {
      elements.designerBallHolder.addEventListener("change", () => {
        if (!designerState.play) {
          return;
        }
        if (designerState.previewRunner) {
          return;
        }
        const selected = elements.designerBallHolder.value;
        if (selected) {
          const attached = designerState.play.players.find((player) => player.id === selected);
          if (attached) {
            ui.setDesignerBallState?.({ x: attached.x, y: attached.y, holderPid: selected });
          }
        } else {
          const ballPoint = ui.getDesignerBallPosition?.();
          if (ballPoint) {
            ui.setDesignerBallState?.({ x: ballPoint.x, y: ballPoint.y, holderPid: null });
          }
        }
        if (stepEditor?.updateSnapshotFromView) {
          stepEditor.updateSnapshotFromView(designerState.play, ui.getCurrentStepIndex?.());
        }
        ui.renderDesignerPlayerList?.();
        ui.renderDesignerCourt?.();
        ui.queueDesignerSave?.();
      });
    }

    if (elements.designerNewPlay) {
      elements.designerNewPlay.addEventListener("click", () => {
        ui.createNewDesignerPlay?.(elements.designerCourtType?.value);
      });
    }

    if (elements.designerCourtType) {
      elements.designerCourtType.addEventListener("change", () => {
        ui.updateDesignerCourtType?.(elements.designerCourtType.value);
      });
    }

    if (elements.designerSavePlay) {
      elements.designerSavePlay.addEventListener("click", () => {
        ui.saveDesignerPlay?.();
      });
    }

    if (elements.designerDeletePlay) {
      elements.designerDeletePlay.addEventListener("click", () => {
        const playName = designerState.play?.name ? `"${designerState.play.name}"` : "this play";
        openConfirmModal({
          title: "Delete Play",
          message: `Delete ${playName}? This cannot be undone.`,
          confirmLabel: "Delete Play",
          onConfirm: () => {
            ui.deleteSelectedDesignerPlay?.();
          }
        });
      });
    }

    if (elements.designerDownloadPlay) {
      elements.designerDownloadPlay.addEventListener("click", () => {
        ui.downloadCurrentDesignerPlay?.();
      });
    }

    if (elements.designerUploadPlay) {
      elements.designerUploadPlay.addEventListener("click", () => {
        ui.openDesignerUploadPicker?.();
      });
    }

    if (elements.designerUploadInput) {
      elements.designerUploadInput.addEventListener("change", () => {
        const [file] = elements.designerUploadInput.files || [];
        if (!file) {
          return;
        }
        ui.importDesignerPlayFile?.(file);
        elements.designerUploadInput.value = "";
      });
    }

    if (elements.designerLoadPlay) {
      elements.designerLoadPlay.addEventListener("click", () => {
        ui.loadSelectedDesignerPlay?.();
      });
    }

    if (elements.designerAnnotationTypeButtons.length) {
      elements.designerAnnotationTypeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          ui.setDesignerTool?.("annotation");
          ui.setDesignerAnnotationType?.(button.dataset.annotationType);
        });
      });
    }

    if (elements.designerAnnotationColorButtons.length) {
      elements.designerAnnotationColorButtons.forEach((button) => {
        button.addEventListener("click", () => {
          ui.setDesignerAnnotationColor?.(button.dataset.annotationColor);
        });
      });
    }

    if (elements.designerDeleteAnnotation) {
      elements.designerDeleteAnnotation.addEventListener("click", () => {
        ui.deleteSelectedAnnotation?.();
      });
    }

    if (elements.designerClearAnnotations) {
      elements.designerClearAnnotations.addEventListener("click", () => {
        ui.clearDesignerAnnotations?.();
      });
    }

    if (elements.tabButtons.length) {
      elements.tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const target = button.dataset.tabButton;
          if (target === "game" && !state.gameModeUnlocked) {
            openModal(elements.gameModeModal);
            return;
          }
          ui.setActiveTab?.(target);
        });
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeModal) {
        closeModal(activeModal);
      }
    });

    if (elements.gameModeButtons.length) {
      elements.gameModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          ui.setGameControlMode?.(button.dataset.gameMode);
        });
      });
    }

    if (elements.gameGhostToggle) {
      elements.gameGhostToggle.addEventListener("change", () => {
        ui.setGhostPathsEnabled?.(elements.gameGhostToggle.checked);
      });
    }

    if (elements.gamePlayRun) {
      elements.gamePlayRun.addEventListener("click", () => {
        ui.runGamePlay?.();
      });
    }

    if (elements.gamePlayCancel) {
      elements.gamePlayCancel.addEventListener("click", () => {
        ui.toggleGamePlayMenu?.(false);
      });
    }

    if (elements.gameStepAuto) {
      elements.gameStepAuto.addEventListener("change", () => {
        const runnerState = gameState.play.runner;
        if (!runnerState?.runner) {
          return;
        }
        runnerState.runner.setMode(elements.gameStepAuto.checked ? "AUTO" : "MANUAL");
        ui.renderGameStepHud?.();
      });
    }

    if (elements.gameStepPlayPause) {
      elements.gameStepPlayPause.addEventListener("click", () => {
        const runnerState = gameState.play.runner;
        if (!runnerState?.runner) {
          return;
        }
        runnerState.runner.togglePause();
        ui.renderGameStepHud?.();
      });
    }

    if (elements.gameStepPrev) {
      elements.gameStepPrev.addEventListener("click", () => {
        const runnerState = gameState.play.runner;
        if (!runnerState?.runner) {
          return;
        }
        runnerState.runner.prevStep();
        ui.renderGameStepHud?.();
      });
    }

    if (elements.gameStepNext) {
      elements.gameStepNext.addEventListener("click", () => {
        const runnerState = gameState.play.runner;
        if (!runnerState?.runner) {
          return;
        }
        runnerState.runner.nextStep();
        ui.renderGameStepHud?.();
      });
    }

    if (elements.gameStepStop) {
      elements.gameStepStop.addEventListener("click", () => {
        ui.stopGameStepRunner?.();
      });
    }

    window.addEventListener("keydown", ui.handleGameKeyDown);
    window.addEventListener("keyup", ui.handleGameKeyUp);
  }

  Object.assign(ui, {
    bindEvents,
    chooseDesignerImportConflict
  });

  return ui;
})();
