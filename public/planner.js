(function () {
  var KEY = "pulseburn_planner_v3";
  var LEGACY_KEY = "pulseburn_planner_v2";
  var API_URL = "/api/events";
  var PARTICIPANT_LOOKUP_URL = "/api/participant/lookup";
  var today = new Date().toISOString().slice(0, 10);

  function hasMorningCheckinToday() {
    return !!(
      state.morning &&
      state.morning.date === today &&
      state.readiness != null &&
      state.dayState &&
      state.dayState.state
    );
  }

  function resetMorningDerivedState() {
    state.readiness = null;
    state.dayState = null;
    state.morningRecommendations = [];
    state.morningEmbedDecisions = {};
    state.morningEmbedDate = "";
    state.morningCardFeedback = null;
  }

  function sanitizeMorningSession() {
    if (!state.morning || state.morning.date !== today) {
      resetMorningDerivedState();
    }
  }

  var FALLBACK_I18N = {
    ru: {
      "planner.tasks.add": "Добавить задачу",
      "planner.tasks.saveEdit": "Сохранить изменения",
      "planner.tasks.cancelEdit": "Отменить редактирование",
      "planner.tasks.empty": "Пока нет задач на день",
      "planner.tasks.edit": "Редактировать задачу",
      "planner.tasks.delete": "Удалить задачу",
      "planner.tasks.postpone": "Перенести задачу на завтра",
      "planner.tasks.menu": "Меню задачи",
      "planner.tasks.routineChip": "Рутина",
      "planner.tasks.dragHandle": "Перетащите, чтобы изменить порядок",
      "planner.tasks.subtaskPh": "Подзадача…",
      "planner.tasks.subtaskDelete": "Удалить подзадачу",
      "planner.tasks.subtasks": "Подзадачи",
      "planner.tasks.subtaskAdd": "Добавить подзадачу",
      "planner.tasks.subtasksToggle": "Показать подзадачи",
      "planner.scheduled.empty": "Список запланированного пуст",
      "planner.scheduled.restore": "Вернуть задачу на сегодня",
      "planner.scheduled.delete": "Удалить задачу",
      "planner.sync.syncing": "Синхронизация…",
      "planner.sync.success": "Данные сохранены",
      "planner.sync.error": "Ошибка синхронизации",
      "planner.evening.dayClosed": "День закрыт",
      "planner.evening.dayOpen": "День не закрыт",
      "planner.evening.reviewTitle": "Итог дня",
      "planner.evening.reviewPlanMeta": "· по плану {pct}%",
      "planner.evening.scaleInvalid": "Укажите значение от 1 до 5 во всех полях вечернего чек-ина.",
      "planner.morning.recommendationsTitle": "Рекомендации на сегодня",
      "planner.alerts.titleRequired": "Введите название задачи",
      "planner.id.required": "Сохраните «Мой ID», чтобы данные попадали в основную таблицу.",
      "planner.id.empty": "Введите ID участника.",
      "planner.id.checking": "Проверяем ID…",
      "planner.id.saved": "ID сохранён. Данные синхронизируются под этим ID.",
      "planner.id.notFound": "Такой ID не найден в списке зарегистрированных участников.",
      "planner.id.error": "Не удалось проверить ID. Попробуйте позже.",
      "planner.id.locked": "ID зафиксирован. Нажмите «Изменить ID», чтобы поменять.",
      "planner.slot.morningRoutine": "Утренняя рутина",
      "planner.slot.morningFocus": "Утренний фокус",
      "planner.slot.dayOps": "Дневная операционка",
      "planner.slot.eveningLight": "Лёгкие задачи на вечер",
      "planner.slot.none": "Без рекомендаций",
      "planner.slot.postpone": "Перенести на завтра",
      "planner.slot.simplify": "Упростить или перенести",
      "planner.morning.embedAdd": "Добавить в план",
      "planner.morning.embedLater": "Позже",
      "planner.morning.embedAdded": "Добавлено в план",
      "planner.cardFeedback.prompt": "Помогла рекомендация?",
      "planner.cardFeedback.yes": "Да, полезно",
      "planner.cardFeedback.no": "Не очень",
      "planner.cardFeedback.thanks": "Спасибо, учтём"
    },
    en: {
      "planner.tasks.add": "Add task",
      "planner.tasks.saveEdit": "Save changes",
      "planner.tasks.cancelEdit": "Cancel editing",
      "planner.tasks.empty": "No tasks for today yet",
      "planner.tasks.edit": "Edit task",
      "planner.tasks.delete": "Delete task",
      "planner.tasks.postpone": "Move task to tomorrow",
      "planner.tasks.menu": "Task menu",
      "planner.tasks.routineChip": "Routine",
      "planner.tasks.dragHandle": "Drag to reorder",
      "planner.tasks.subtaskPh": "Subtask…",
      "planner.tasks.subtaskDelete": "Remove subtask",
      "planner.tasks.subtasks": "Subtasks",
      "planner.tasks.subtaskAdd": "Add subtask",
      "planner.tasks.subtasksToggle": "Toggle subtasks",
      "planner.scheduled.empty": "Nothing scheduled yet",
      "planner.scheduled.restore": "Bring task to today",
      "planner.scheduled.delete": "Delete task",
      "planner.sync.syncing": "Syncing…",
      "planner.sync.success": "Saved",
      "planner.sync.error": "Sync error",
      "planner.evening.dayClosed": "Day closed",
      "planner.evening.dayOpen": "Day not closed",
      "planner.evening.reviewTitle": "Day summary",
      "planner.evening.reviewPlanMeta": "· plan {pct}%",
      "planner.evening.scaleInvalid": "Enter a value from 1 to 5 in all evening check-in fields.",
      "planner.morning.recommendationsTitle": "Recommendations for today",
      "planner.alerts.titleRequired": "Please enter a task title",
      "planner.id.required": "Save \"My ID\" so your data reaches the main data sheet.",
      "planner.id.empty": "Enter a participant ID.",
      "planner.id.checking": "Checking ID…",
      "planner.id.saved": "ID saved. Data syncs under this ID.",
      "planner.id.notFound": "This ID was not found among registered participants.",
      "planner.id.error": "Could not verify the ID. Try again later.",
      "planner.id.locked": "ID is locked. Click \"Change ID\" to edit it.",
      "planner.slot.morningRoutine": "Morning routine",
      "planner.slot.morningFocus": "Morning focus",
      "planner.slot.dayOps": "Day operations",
      "planner.slot.eveningLight": "Light tasks for evening",
      "planner.slot.none": "No recommendation",
      "planner.slot.postpone": "Postpone to tomorrow",
      "planner.slot.simplify": "Simplify or postpone",
      "planner.morning.embedAdd": "Add to plan",
      "planner.morning.embedLater": "Later",
      "planner.morning.embedAdded": "Added to plan",
      "planner.cardFeedback.prompt": "Was this helpful?",
      "planner.cardFeedback.yes": "Yes, helpful",
      "planner.cardFeedback.no": "Not really",
      "planner.cardFeedback.thanks": "Thanks for the feedback"
    }
  };

  var state = loadState();
  sanitizeMorningSession();

  var el = {
    readinessValue: byId("readinessValue"),
    factValue: byId("factValue"),
    taskTableBody: byId("taskTableBody"),
    scheduledTableBody: byId("scheduledTableBody"),
    dayStatus: byId("dayStatus"),
    taskSubmitBtn: byId("taskSubmitBtn"),
    cancelEditBtn: byId("cancelEditBtn"),
    syncStatus: byId("syncStatus"),
    participantIdForm: byId("participantIdForm"),
    participantIdInput: byId("participantIdInput"),
    participantIdSaveBtn: byId("participantIdSaveBtn"),
    participantIdChangeBtn: byId("participantIdChangeBtn"),
    participantIdStatus: byId("participantIdStatus"),
    morningRecommendations: byId("morningRecommendations"),
    eveningReview: byId("eveningReview")
  };

  var editingTaskId = null;
  var openMenuTaskId = null;
  var openSubtaskPanelIds = {};
  var subtaskAddInputTaskId = null;
  var skipNextSubtaskAddBlur = false;
  var lastSyncStatus = "idle";
  var participantIdLocked = false;
  var morningMatrixVersion = "";
  var eveningMatrixVersion = "";

  function getLang() {
    if (window.UpeakI18n && typeof window.UpeakI18n.getLang === "function") {
      return window.UpeakI18n.getLang();
    }
    return "ru";
  }

  function t(key) {
    if (window.UpeakI18n && typeof window.UpeakI18n.t === "function") {
      var translated = window.UpeakI18n.t(key);
      if (translated && translated !== key) return translated;
    }
    var lang = getLang();
    var dict = FALLBACK_I18N[lang] || FALLBACK_I18N.ru;
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  }

  var SLOT_KEYS = {
    morningRoutine: "planner.slot.morningRoutine",
    morningFocus: "planner.slot.morningFocus",
    dayOps: "planner.slot.dayOps",
    eveningLight: "planner.slot.eveningLight",
    none: "planner.slot.none",
    postpone: "planner.slot.postpone",
    simplify: "planner.slot.simplify"
  };

  function bootPlanner() {
    migrateSlots();
    promoteScheduledForToday();
    renderTasks();
    renderScheduled();
    updateFact();
    updateReadiness();
    updateDayStatus();
    updateSyncStatus("idle");
    setupParticipantId();
    restoreEveningForm();
    if (state.dayState && window.UpeakDayRecommendations) {
      state.morningRecommendations = buildMorningRecommendations();
    }
    if (state.evening && state.evening.date === today) {
      refreshEveningReview();
    }
    refreshInterventionBlocks();
    document.addEventListener("click", closeAllRowMenus);
  }

  function closeAllRowMenus(clearPending) {
    document.querySelectorAll(".row-menu").forEach(function (menu) {
      menu.classList.add("hidden");
    });
    document.querySelectorAll("[data-menu-toggle]").forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".card.menu-open").forEach(function (card) {
      card.classList.remove("menu-open");
    });
    if (clearPending !== false) openMenuTaskId = null;
  }

  function openRowMenuForTask(taskId) {
    if (!taskId || !el.taskTableBody) return;
    var row = el.taskTableBody.querySelector('tr.task-row[data-task-id="' + taskId + '"]');
    if (!row) return;

    var menu = row.querySelector(".row-menu");
    var button = row.querySelector("[data-menu-toggle]");
    if (!menu || !button) return;

    closeAllRowMenus(false);
    menu.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
    var card = row.closest(".card");
    if (card) card.classList.add("menu-open");
    openMenuTaskId = taskId;
  }

  function refreshTasksKeepSubtaskPanel(taskId) {
    if (taskId) openSubtaskPanelIds[taskId] = true;
    renderTasks();
  }

  function toggleSubtaskPanel(taskId) {
    if (!taskId) return;
    if (openSubtaskPanelIds[taskId]) {
      delete openSubtaskPanelIds[taskId];
      if (subtaskAddInputTaskId === taskId) subtaskAddInputTaskId = null;
    } else {
      openSubtaskPanelIds[taskId] = true;
    }
    renderTasks();
  }

  function showSubtaskAddInput(taskId) {
    if (!taskId) return;
    openSubtaskPanelIds[taskId] = true;
    subtaskAddInputTaskId = taskId;
    renderTasks();
  }

  function clearSubtaskPanelIfEmpty(taskId) {
    var task = findTaskById(taskId);
    if (!task || normalizeSubtasks(task.subtasks).length) return;
    delete openSubtaskPanelIds[taskId];
    if (subtaskAddInputTaskId === taskId) subtaskAddInputTaskId = null;
  }

  function focusSubtaskAddInput() {
    if (!subtaskAddInputTaskId || !el.taskTableBody) return;
    var input = el.taskTableBody.querySelector(
      '.notion-subtask-add-input[data-task-id="' + subtaskAddInputTaskId + '"]'
    );
    if (input) input.focus();
  }

  function bindSubtaskPanelToggles() {
    el.taskTableBody.querySelectorAll("[data-subtasks-toggle]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleSubtaskPanel(button.getAttribute("data-task-id"));
      });
    });
  }

  function renderNotionTaskCell(task, titleHtml, routineNoteHtml) {
    var subtasks = normalizeSubtasks(task.subtasks);
    var isOpen = !!openSubtaskPanelIds[task.id];
    var hasSubtasks = subtasks.length > 0;
    var showSubtaskUi = hasSubtasks || isOpen;
    var doneCount = subtasks.filter(function (subtask) { return subtask.done; }).length;
    var parts = [
      '<div class="task-cell notion-task' + (showSubtaskUi ? " notion-task--subtasks" : "") + '">'
    ];

    parts.push('<div class="notion-task-head">');
    if (showSubtaskUi) {
      parts.push(
        '<button type="button" class="notion-chevron' + (isOpen ? " is-open" : "") + (hasSubtasks ? " has-children" : "") + '" data-subtasks-toggle data-task-id="' + escapeAttr(task.id) + '" aria-expanded="' + (isOpen ? "true" : "false") + '" aria-label="' + escapeAttr(t("planner.tasks.subtasksToggle")) + '">',
          '<svg class="notion-chevron-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">',
            '<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>',
          "</svg>",
        "</button>"
      );
    }
    parts.push('<div class="notion-task-main">');
    parts.push('<span class="task-title' + (task.done ? " task-done" : "") + '">' + titleHtml + "</span>");
    if (hasSubtasks && !isOpen) {
      parts.push('<span class="notion-sub-count">' + escapeHtml(doneCount + "/" + subtasks.length) + "</span>");
    }
    if (routineNoteHtml) parts.push(routineNoteHtml);
    parts.push("</div></div>");

    if (isOpen) {
      parts.push('<div class="notion-subtasks">');
      subtasks.forEach(function (subtask) {
        parts.push(
          '<div class="notion-subtask-row">',
            '<input type="checkbox" class="subtask-toggle notion-subtask-check" data-task-id="' + escapeAttr(task.id) + '" data-subtask-id="' + escapeAttr(subtask.id) + '"' + (subtask.done ? " checked" : "") + ">",
            '<input type="text" class="subtask-title notion-subtask-input' + (subtask.done ? " subtask-done" : "") + '" data-task-id="' + escapeAttr(task.id) + '" data-subtask-id="' + escapeAttr(subtask.id) + '" value="' + escapeAttr(subtask.title) + '" maxlength="120" spellcheck="false">',
            '<button type="button" class="subtask-delete notion-subtask-delete" data-task-id="' + escapeAttr(task.id) + '" data-subtask-id="' + escapeAttr(subtask.id) + '" title="' + escapeAttr(t("planner.tasks.subtaskDelete")) + '" aria-label="' + escapeAttr(t("planner.tasks.subtaskDelete")) + '">×</button>',
          "</div>"
        );
      });

      if (subtaskAddInputTaskId === task.id) {
        parts.push(
          '<div class="notion-subtask-row notion-subtask-row-new">',
            '<span class="notion-subtask-check-spacer" aria-hidden="true"></span>',
            '<input type="text" class="notion-subtask-add-input" data-task-id="' + escapeAttr(task.id) + '" placeholder="' + escapeAttr(t("planner.tasks.subtaskPh")) + '" maxlength="120" autocomplete="off" spellcheck="false">',
          "</div>"
        );
      }

      parts.push("</div>");
    }

    parts.push("</div>");
    return parts.join("");
  }

  function bindRowMenus(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-menu-toggle]").forEach(function (button) {
      if (button.dataset.menuBound === "1") return;
      button.dataset.menuBound = "1";

      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var menu = button.parentElement && button.parentElement.querySelector(".row-menu");
        var isOpen = menu && !menu.classList.contains("hidden");
        var row = button.closest("tr[data-task-id]");
        var taskId = row ? row.getAttribute("data-task-id") : null;
        closeAllRowMenus();
        if (!isOpen && menu) {
          openMenuTaskId = taskId;
          menu.classList.remove("hidden");
          button.setAttribute("aria-expanded", "true");
          var card = button.closest(".card");
          if (card) card.classList.add("menu-open");
        }
      });
    });

    scope.querySelectorAll(".row-menu").forEach(function (menu) {
      menu.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    });
  }

  function renderRowMenuButton(menuLabel, menuItemsHtml) {
    return [
      '<button type="button" class="menu-btn" data-menu-toggle="1" aria-label="' + escapeAttr(menuLabel) + '" aria-expanded="false">',
        "···",
      "</button>",
      '<div class="row-menu hidden">',
        menuItemsHtml,
      "</div>"
    ].join("");
  }

  function renderScheduledActionsCell(task) {
    var menuItems = [
      '<button type="button" class="menu-item" data-scheduled-action="restore" data-scheduled-id="' + escapeAttr(task.id || "") + '">',
        escapeHtml(t("planner.scheduled.restore")),
      "</button>",
      '<button type="button" class="menu-item menu-item-danger" data-scheduled-action="delete" data-scheduled-id="' + escapeAttr(task.id || "") + '">',
        escapeHtml(t("planner.scheduled.delete")),
      "</button>"
    ].join("");

    return [
      '<td class="actions-cell">',
        renderRowMenuButton(t("planner.tasks.menu"), menuItems),
      "</td>"
    ].join("");
  }

  function loadRecommendationMatrix(done) {
    var morningReady = false;
    var eveningReady = false;

    function finish() {
      if (!morningReady || !eveningReady) return;
      done();
    }

    fetch("./day-recommendation-matrix.json")
      .then(function (res) {
        if (!res.ok) throw new Error("matrix fetch failed");
        return res.json();
      })
      .then(function (data) {
        if (window.UpeakDayRecommendations && typeof window.UpeakDayRecommendations.setRecommendationMatrix === "function") {
          window.UpeakDayRecommendations.setRecommendationMatrix(data);
        }
        return fetch("./day-decision-matrix.json");
      })
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && window.UpeakDayRecommendations &&
            typeof window.UpeakDayRecommendations.setDecisionMatrix === "function") {
          window.UpeakDayRecommendations.setDecisionMatrix(data);
        }
        if (data && data.meta && data.meta.version) {
          morningMatrixVersion = String(data.meta.version);
        }
      })
      .catch(function (error) {
        console.error("Failed to load morning recommendation matrices", error);
      })
      .then(function () {
        morningReady = true;
        finish();
      });

    fetch("./evening-recommendation-matrix.json")
      .then(function (res) {
        if (!res.ok) throw new Error("evening matrix fetch failed");
        return res.json();
      })
      .then(function (data) {
        if (window.UpeakEveningRecommendations && typeof window.UpeakEveningRecommendations.setEveningMatrix === "function") {
          window.UpeakEveningRecommendations.setEveningMatrix(data);
        }
        return fetch("./evening-decision-matrix.json");
      })
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && window.UpeakEveningRecommendations &&
            typeof window.UpeakEveningRecommendations.setDecisionMatrix === "function") {
          window.UpeakEveningRecommendations.setDecisionMatrix(data);
        }
        if (data && data.meta && data.meta.version) {
          eveningMatrixVersion = String(data.meta.version);
        }
      })
      .catch(function (error) {
        console.error("Failed to load evening recommendation matrices", error);
      })
      .then(function () {
        eveningReady = true;
        finish();
      });
  }

  loadRecommendationMatrix(bootPlanner);

  if (window.UpeakI18n && typeof window.UpeakI18n.onChange === "function") {
    window.UpeakI18n.onChange(function () {
      renderTasks();
      renderScheduled();
      updateFact();
      updateReadiness();
      updateDayStatus();
      updateSyncStatus(lastSyncStatus);
      refreshParticipantIdStatus();
      el.taskSubmitBtn.textContent = editingTaskId ? t("planner.tasks.saveEdit") : t("planner.tasks.add");
      refreshInterventionBlocks();
    });
  }

  byId("morningForm").addEventListener("submit", function (event) {
    event.preventDefault();

    state.morning = {
      date: today,
      sleepHours: getSleepHours(),
      sleepQuality: getNum("sleepQuality"),
      energy: getNum("energy"),
      stress: getNum("stress"),
      note: byId("morningNote").value.trim()
    };

    state.readiness = calcReadiness(state.morning);
    state.dayState = window.UpeakDayState.computeDayStateFromMorning(state.morning);
    state.morningEmbedDecisions = {};
    state.morningEmbedDate = today;
    state.morningRecommendations = buildMorningRecommendations();
    activateDailyRoutine();
    promoteScheduledForToday();
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();
    updateReadiness();
    renderMorningRecommendations();

    if (!requireVerifiedParticipantId()) return;
    fireSync("morning_checkin", Object.assign({}, state.morning, {
      dayState: state.dayState
    }));
  });

  byId("taskForm").addEventListener("submit", function (event) {
    event.preventDefault();

    var parsedTitle = parseTaskTitle(byId("taskTitle").value);
    var formTask = {
      title: parsedTitle.title,
      routine: byId("taskRoutine").checked,
      difficulty: getNum("taskDifficulty"),
      urgency: getNum("taskUrgency"),
      duration: getNum("taskDuration")
    };

    if (!formTask.title) {
      alert(t("planner.alerts.titleRequired"));
      return;
    }

    if (editingTaskId) {
      state.tasks = state.tasks.map(function (task) {
        if (task.id !== editingTaskId) return task;
        var nextSlotKey = formTask.routine
          ? SLOT_KEYS.morningRoutine
          : (task.slotKey === SLOT_KEYS.morningRoutine ? SLOT_KEYS.none : task.slotKey);

        return Object.assign({}, task, formTask, {
          slotKey: nextSlotKey
        });
      });

      if (requireVerifiedParticipantId()) {
        fireSync("task_edited", Object.assign({ id: editingTaskId }, formTask));
      }

      resetTaskFormMode(event.target);
    } else {
      var task = Object.assign({
        id: makeId(),
        done: false,
        order: nextOrder(),
        slotKey: formTask.routine ? SLOT_KEYS.morningRoutine : SLOT_KEYS.none,
        subtasks: []
      }, formTask);

      state.tasks.push(task);
      event.target.reset();

      if (requireVerifiedParticipantId()) {
        fireSync("task_created", task);
      }
    }

    saveState();
    renderTasks();
    updateFact();
  });

  el.cancelEditBtn.addEventListener("click", function () {
    resetTaskFormMode(byId("taskForm"));
  });

  byId("planBtn").addEventListener("click", function () {
    var beforeTaskIds = state.tasks.map(function (task) { return task.id; });
    var moved = distributeTasks();
    var keptTaskIds = {};
    state.tasks.forEach(function (task) { keptTaskIds[task.id] = true; });
    var movedTaskIds = beforeTaskIds.filter(function (taskId) {
      return !keptTaskIds[taskId] && state.scheduled.some(function (task) {
        return task && task.id === taskId;
      });
    });
    var planRunId = "plan_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();

    if (!requireVerifiedParticipantId()) return;

    fireSync("plan_generated", {
      planRunId: planRunId,
      readiness: state.readiness,
      movedToScheduled: moved,
      movedTaskIds: movedTaskIds,
      tasks: state.tasks,
      scheduled: state.scheduled
    });

    if (moved > 0) {
      fireSync("scheduled_added", {
        count: moved,
        scheduledFor: tomorrowISO()
      });
    }
  });

  byId("eveningForm").addEventListener("submit", function (event) {
    event.preventDefault();

    var fatigue = getScale1to5("fatigue");
    var taskStart = getScale1to5("eveningTaskStart");
    var planOverload = getScale1to5("eveningPlanOverload");
    var detachment = getScale1to5("eveningDetachment");
    if (!Number.isFinite(fatigue) || !Number.isFinite(taskStart) ||
        !Number.isFinite(planOverload) || !Number.isFinite(detachment)) {
      alert(t("planner.evening.scaleInvalid"));
      return;
    }

    state.evening = {
      date: today,
      fatigue: fatigue,
      taskStart: taskStart,
      planOverload: planOverload,
      detachment: detachment,
      note: byId("eveningNote").value.trim(),
      completed: state.tasks.filter(function (task) { return task.done; }).length,
      total: state.tasks.length
    };

    state.eveningReview = buildEveningReview();
    state.dayClosedAt = new Date().toISOString();

    var checkoutPayload = buildEveningSyncPayload();
    var canSync = requireVerifiedParticipantId(false);

    // После закрытия дня оставляем только задачи на завтра (scheduled),
    // остальное локальное состояние дня сбрасываем.
    resetAfterDayClose();
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();
    updateReadiness();
    updateDayStatus();
    refreshInterventionBlocks();
    renderEveningReview();

    if (canSync) {
      fireSync("evening_checkout", checkoutPayload);
    }
  });

  function clearDayFormFields() {
    [
      "sleepHours",
      "sleepQuality",
      "energy",
      "stress",
      "morningNote",
      "fatigue",
      "eveningTaskStart",
      "eveningPlanOverload",
      "eveningDetachment",
      "eveningNote"
    ].forEach(function (id) {
      var node = byId(id);
      if (node) node.value = "";
    });
  }

  // После «Закрыть день»: задачи дня сбрасываем, оставляем только «на завтра».
  // Вечерний чек-ин и eveningReview сохраняем — иначе карточка итога не покажется.
  function resetAfterDayClose() {
    state.tasks = [];
    state.morning = null;
    state.manualOrder = false;
    resetMorningDerivedState();
    state.scheduled = (Array.isArray(state.scheduled) ? state.scheduled : []).filter(function (item) {
      return item && item.scheduledFor && item.scheduledFor > today;
    });
    clearDayFormFields();
  }

  // Распределение по состоянию: учитываем срочность (приоритет), важность, сложность и
  // длительность. Рутина всегда остаётся в дне (утренний слот) и сначала резервирует
  // часть дневного бюджета. То, что не помещается в остаток бюджета (или слишком
  // сложное/длинное и при этом не срочное), уходит в «Запланированные».
  // Задачи из рекомендаций (плашек) в расчёт не входят: слот не меняем, не убираем.
  //
  // Вес = сложность + ceil(мин/45) × (сложность/3).
  // Длительность масштабируется сложностью: лёгкая 90-мин ≈ 1.7, тяжёлая 90-мин ≈ 8.3.
  function getTaskLoad(task) {
    var difficulty = Number(task.difficulty) || 0;
    var durationUnits = Math.ceil((Number(task.duration) || 0) / 45);
    return difficulty + durationUnits * (difficulty / 3);
  }

  function getRoutineBudgetLoad(task, readiness) {
    var load = getTaskLoad(task);
    // На низком состоянии рутина «легче» для плана — её как раз рекомендуют в первую очередь.
    if (readiness < 40) return Math.max(1, load * 0.7);
    if (readiness < 70) return Math.max(1, load * 0.85);
    return load;
  }

  function distributeTasks() {
    var readiness = state.readiness || 50;
    var budget = getDailyBudget(readiness, state.dayState);
    var slotKeys = [SLOT_KEYS.morningFocus, SLOT_KEYS.dayOps, SLOT_KEYS.eveningLight];

    var recommendations = [];
    var routines = [];
    var regular = [];
    state.tasks.forEach(function (task) {
      if (isRecommendationTask(task)) {
        recommendations.push(task);
        return;
      }
      if (isRoutineTask(task)) routines.push(task);
      else regular.push(task);
    });

    // Рекомендации — «автоматом» в плане: слот по смыслу плашки, вне бюджета, не в scheduled.
    recommendations.forEach(function (task) {
      if (!task.slotKey || task.slotKey === SLOT_KEYS.none) {
        task.slotKey = SLOT_KEYS.eveningLight;
      }
    });

    var remaining = budget;
    var movedToScheduled = 0;
    var carry = [];
    var kept = [];

    routines.sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });

    routines.forEach(function (task) {
      task.slotKey = SLOT_KEYS.morningRoutine;
      remaining -= getRoutineBudgetLoad(task, readiness);
      kept.push(task);
    });

    var sorted = regular.slice().sort(comparePriority);

    sorted.forEach(function (task) {
      var load = getTaskLoad(task);
      var isUrgent = Number(task.urgency) >= 4;
      var tooHeavy = (readiness < 45 && Number(task.difficulty) >= 4) || Number(task.duration) >= 180;
      var noBudget = remaining < load;

      if (!isUrgent && (noBudget || tooHeavy)) {
        carry.push(task);
        return;
      }

      if (readiness < 45 && Number(task.difficulty) >= 4 && !isUrgent) {
        task.slotKey = SLOT_KEYS.simplify;
      } else if (load >= 6) {
        task.slotKey = slotKeys[0];
      } else if (load >= 4) {
        task.slotKey = slotKeys[1];
      } else {
        task.slotKey = slotKeys[2];
      }

      remaining -= load;
      kept.push(task);
    });

    state.manualOrder = false;
    kept = kept.concat(recommendations);
    kept.sort(compareTasksForDisplay);

    kept.forEach(function (task, idx) {
      task.order = idx;
    });

    var tomorrow = tomorrowISO();

    carry.forEach(function (task) {
      if (isRoutineTask(task) || isRecommendationTask(task)) return;
      state.scheduled.push({
        id: task.id,
        title: task.title,
        difficulty: task.difficulty,
        urgency: task.urgency,
        duration: task.duration,
        routine: !!task.routine,
        subtasks: normalizeSubtasks(task.subtasks),
        scheduledFor: tomorrow,
        addedAt: new Date().toISOString()
      });
      movedToScheduled += 1;
    });

    state.tasks = kept;
    return movedToScheduled;
  }

  function activateDailyRoutine() {
    if (state.lastRoutineResetDate === today) return;

    var routineCount = 0;

    state.tasks = state.tasks.map(function (task) {
      if (!isRoutineTask(task)) return task;
      routineCount += 1;
      return Object.assign({}, task, {
        done: false,
        slotKey: SLOT_KEYS.morningRoutine
      });
    });

    state.lastRoutineResetDate = today;

    if (routineCount > 0 && requireVerifiedParticipantId(false)) {
      fireSync("routine_activated", { count: routineCount });
    }
  }

  function promoteScheduledForToday() {
    if (!Array.isArray(state.scheduled) || !state.scheduled.length) return;

    var stillScheduled = [];
    var restored = [];

    state.scheduled.forEach(function (item) {
      if (item && item.scheduledFor && item.scheduledFor <= today) {
        restored.push(item);
      } else {
        stillScheduled.push(item);
      }
    });

    if (!restored.length) return;

    restored.forEach(function (item) {
      state.tasks.push({
        id: item.id || makeId(),
        title: item.title,
        difficulty: Number(item.difficulty) || 3,
        urgency: Number(item.urgency) || 3,
        duration: Number(item.duration) || 30,
        routine: !!item.routine,
        subtasks: normalizeSubtasks(item.subtasks),
        done: false,
        order: nextOrder(),
        slotKey: item.routine ? SLOT_KEYS.morningRoutine : SLOT_KEYS.none
      });
    });

    state.scheduled = stillScheduled;
    saveState();

    if (requireVerifiedParticipantId(false)) {
      fireSync("scheduled_restored", { count: restored.length, date: today });
    }
  }

  function isMorningRecommendationTask(task) {
    return !!(task && task.recommendationId && String(task.recommendationId).indexOf("morning:") === 0);
  }

  function isEveningRecommendationTask(task) {
    return !!(task && task.recommendationId && String(task.recommendationId).indexOf("evening:") === 0);
  }

  function isRecommendationTask(task) {
    return isMorningRecommendationTask(task) || isEveningRecommendationTask(task);
  }

  // Утренние по смыслу — выше списка; вечерние (лёгкие) — ниже.
  function isTopRecommendationTask(task) {
    if (!isRecommendationTask(task)) return false;
    var slot = task.slotKey || SLOT_KEYS.none;
    return slot === SLOT_KEYS.morningFocus ||
      slot === SLOT_KEYS.morningRoutine ||
      slot === SLOT_KEYS.dayOps;
  }

  function isBottomRecommendationTask(task) {
    if (!isRecommendationTask(task)) return false;
    return !isTopRecommendationTask(task);
  }

  function isPinnedRecommendationTask(task) {
    return isRecommendationTask(task);
  }

  function compareRecommendationTasks(a, b) {
    var orderMap = {};
    orderMap[SLOT_KEYS.morningRoutine] = 0;
    orderMap[SLOT_KEYS.morningFocus] = 1;
    orderMap[SLOT_KEYS.dayOps] = 2;
    orderMap[SLOT_KEYS.eveningLight] = 3;
    orderMap[SLOT_KEYS.none] = 4;
    var slotDiff = (orderMap[a.slotKey] || 99) - (orderMap[b.slotKey] || 99);
    if (slotDiff !== 0) return slotDiff;
    return Number(a.order || 0) - Number(b.order || 0);
  }

  function resolveRecommendationSlotKey(taskDef) {
    var raw = taskDef && taskDef.slotKey ? String(taskDef.slotKey) : "eveningLight";
    if (raw === SLOT_KEYS.morningFocus || raw === "morningFocus") return SLOT_KEYS.morningFocus;
    if (raw === SLOT_KEYS.morningRoutine || raw === "morningRoutine") return SLOT_KEYS.morningRoutine;
    if (raw === SLOT_KEYS.dayOps || raw === "dayOps") return SLOT_KEYS.dayOps;
    if (raw === SLOT_KEYS.eveningLight || raw === "eveningLight") return SLOT_KEYS.eveningLight;
    return SLOT_KEYS.eveningLight;
  }

  function renderTaskActionsCell(task) {
    var menuItems = [
      '<button type="button" class="menu-item" data-action="edit" data-task-id="' + escapeAttr(task.id) + '">',
        escapeHtml(t("planner.tasks.edit")),
      "</button>",
      '<button type="button" class="menu-item" data-action="postpone" data-task-id="' + escapeAttr(task.id) + '">',
        escapeHtml(t("planner.tasks.postpone")),
      "</button>",
      '<button type="button" class="menu-item" data-action="subtask-add" data-task-id="' + escapeAttr(task.id) + '">',
        escapeHtml(t("planner.tasks.subtaskAdd")),
      "</button>",
      '<button type="button" class="menu-item menu-item-danger" data-action="delete" data-task-id="' + escapeAttr(task.id) + '">',
        escapeHtml(t("planner.tasks.delete")),
      "</button>"
    ].join("");

    return [
      '<td class="actions-cell">',
        renderRowMenuButton(t("planner.tasks.menu"), menuItems),
      "</td>"
    ].join("");
  }

  function renderTaskRow(task, index, isRecommendation) {
    var slotLabel = t(task.slotKey || SLOT_KEYS.none);
    var title = escapeHtml(task.title || "");
    var slot = escapeHtml(slotLabel || "");
    var routineNote = isRoutineTask(task)
      ? '<span class="task-meta-note">' + escapeHtml(t("planner.tasks.routineChip")) + "</span>"
      : "";
    var rowClass = "task-row" + (isRecommendation ? " task-row-recommendation" : "");

    return [
      '<tr class="' + rowClass + '" data-task-id="' + escapeAttr(task.id) + '">',
        '<td class="order-cell">',
          '<span class="drag-handle" title="' + escapeAttr(t("planner.tasks.dragHandle")) + '">⋮⋮</span>',
          '<span class="order-index">' + index + "</span>",
        "</td>",
        '<td><input type="checkbox" class="task-toggle" data-task-id="' + escapeAttr(task.id) + '"' + (task.done ? " checked" : "") + "></td>",
        "<td>",
          renderNotionTaskCell(task, title, routineNote),
        "</td>",
        "<td>" + Number(task.difficulty || 0) + "</td>",
        "<td>" + Number(task.urgency || 0) + "</td>",
        "<td>" + Number(task.duration || 0) + "</td>",
        '<td><span class="slot-text">' + slot + "</span></td>",
        renderTaskActionsCell(task),
      "</tr>"
    ].join("");
  }

  function renderTasks() {
    if (!state.tasks.length) {
      el.taskTableBody.innerHTML =
        '<tr><td colspan="8" class="muted">' + escapeHtml(t("planner.tasks.empty")) + "</td></tr>";
      return;
    }

    var sortedTasks = state.tasks.slice().sort(compareTasksForDisplay);
    var topRecTasks = sortedTasks.filter(isTopRecommendationTask).sort(compareRecommendationTasks);
    var bottomRecTasks = sortedTasks.filter(isBottomRecommendationTask).sort(compareRecommendationTasks);
    var mainTasks = sortedTasks.filter(function (task) {
      return !isRecommendationTask(task);
    });
    var htmlParts = [];
    var rowIndex = 0;

    topRecTasks.forEach(function (task) {
      rowIndex += 1;
      htmlParts.push(renderTaskRow(task, rowIndex, true));
    });

    if (topRecTasks.length && (mainTasks.length || bottomRecTasks.length)) {
      htmlParts.push('<tr class="task-group-spacer" aria-hidden="true"><td colspan="8"></td></tr>');
    }

    mainTasks.forEach(function (task) {
      rowIndex += 1;
      htmlParts.push(renderTaskRow(task, rowIndex, false));
    });

    if (bottomRecTasks.length && (mainTasks.length || topRecTasks.length)) {
      htmlParts.push('<tr class="task-group-spacer" aria-hidden="true"><td colspan="8"></td></tr>');
    }

    bottomRecTasks.forEach(function (task) {
      rowIndex += 1;
      htmlParts.push(renderTaskRow(task, rowIndex, true));
    });

    el.taskTableBody.innerHTML = htmlParts.join("");

    bindTaskRowActions();
    bindSubtaskActions();
    bindSubtaskPanelToggles();
    bindRowMenus(el.taskTableBody);
    bindTaskDragAndDrop();
    if (openMenuTaskId) openRowMenuForTask(openMenuTaskId);
    focusSubtaskAddInput();
  }

  function renderScheduled() {
    if (!state.scheduled.length) {
      el.scheduledTableBody.innerHTML =
        '<tr><td colspan="6" class="muted">' + escapeHtml(t("planner.scheduled.empty")) + "</td></tr>";
      return;
    }

    el.scheduledTableBody.innerHTML = state.scheduled.map(function (task) {
      return [
        '<tr data-scheduled-id="' + escapeAttr(task.id || "") + '">',
          "<td>" + escapeHtml(task.title || "") + "</td>",
          "<td>" + Number(task.difficulty || 0) + "</td>",
          "<td>" + Number(task.urgency || 0) + "</td>",
          "<td>" + Number(task.duration || 0) + "</td>",
          "<td>" + escapeHtml(task.scheduledFor || "") + "</td>",
          renderScheduledActionsCell(task),
        "</tr>"
      ].join("");
    }).join("");

    bindScheduledActions();
    bindRowMenus(el.scheduledTableBody);
  }

  function bindTaskRowActions() {
    el.taskTableBody.querySelectorAll(".menu-item[data-action]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        closeAllRowMenus();
        var action = button.getAttribute("data-action");
        var id = button.getAttribute("data-task-id");
        if (!id) return;

        if (action === "edit") {
          startTaskEdit(id);
          return;
        }
        if (action === "delete") {
          deleteTask(id);
          return;
        }
        if (action === "postpone") {
          postponeTask(id);
          return;
        }
        if (action === "subtask-add") {
          showSubtaskAddInput(id);
        }
      });
    });

    el.taskTableBody.querySelectorAll(".task-toggle").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        toggleTask(checkbox.getAttribute("data-task-id"));
      });
    });
  }

  function commitSubtaskAddInput(input) {
    if (!input) return false;
    var taskId = input.getAttribute("data-task-id");
    var value = String(input.value || "").trim();
    if (!value || !taskId || !findTaskById(taskId)) return false;

    skipNextSubtaskAddBlur = true;
    input.value = "";
    addSubtask(taskId, value);
    return true;
  }

  function bindSubtaskActions() {
    el.taskTableBody.querySelectorAll(".subtask-toggle").forEach(function (checkbox) {
      checkbox.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      checkbox.addEventListener("change", function (event) {
        event.stopPropagation();
        var taskId = checkbox.getAttribute("data-task-id");
        toggleSubtask(taskId, checkbox.getAttribute("data-subtask-id"));
      });
    });

    el.taskTableBody.querySelectorAll(".notion-subtask-add-input").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      input.addEventListener("keydown", function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          commitSubtaskAddInput(input);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          var escapeTaskId = input.getAttribute("data-task-id");
          skipNextSubtaskAddBlur = true;
          subtaskAddInputTaskId = null;
          clearSubtaskPanelIfEmpty(escapeTaskId);
          renderTasks();
        }
      });
      input.addEventListener("blur", function () {
        if (skipNextSubtaskAddBlur) {
          skipNextSubtaskAddBlur = false;
          return;
        }

        var taskId = input.getAttribute("data-task-id");
        var value = String(input.value || "").trim();
        if (value) {
          commitSubtaskAddInput(input);
          return;
        }
        if (subtaskAddInputTaskId === taskId) {
          subtaskAddInputTaskId = null;
        }
        clearSubtaskPanelIfEmpty(taskId);
        renderTasks();
      });
    });

    el.taskTableBody.querySelectorAll(".subtask-title").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      input.addEventListener("blur", function () {
        renameSubtask(
          input.getAttribute("data-task-id"),
          input.getAttribute("data-subtask-id"),
          input.value
        );
      });
      input.addEventListener("keydown", function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
    });

    el.taskTableBody.querySelectorAll(".subtask-delete").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        removeSubtask(
          button.getAttribute("data-task-id"),
          button.getAttribute("data-subtask-id")
        );
      });
    });
  }

  function findTaskById(id) {
    return state.tasks.find(function (task) { return task.id === id; }) || null;
  }

  function syncTaskEdited(task) {
    if (!task || !requireVerifiedParticipantId(false)) return;
    fireSync("task_edited", {
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      urgency: task.urgency,
      duration: task.duration,
      routine: !!task.routine,
      subtasks: normalizeSubtasks(task.subtasks)
    });
  }

  function updateTaskSubtasks(taskId, updater) {
    var updatedTask = null;

    state.tasks = state.tasks.map(function (task) {
      if (task.id !== taskId) return task;
      updatedTask = Object.assign({}, task, {
        subtasks: updater(normalizeSubtasks(task.subtasks))
      });
      return updatedTask;
    });

    saveState();
    if (updatedTask) syncTaskEdited(updatedTask);
    return updatedTask;
  }

  function addSubtask(taskId, rawTitle) {
    var title = cleanSubtaskTitle(rawTitle);
    if (!title || !findTaskById(taskId)) return;

    updateTaskSubtasks(taskId, function (subtasks) {
      return subtasks.concat([{
        id: makeSubtaskId(),
        title: title,
        done: false
      }]);
    });
    subtaskAddInputTaskId = taskId;
    refreshTasksKeepSubtaskPanel(taskId);
  }

  function toggleSubtask(taskId, subtaskId) {
    updateTaskSubtasks(taskId, function (subtasks) {
      return subtasks.map(function (subtask) {
        if (subtask.id !== subtaskId) return subtask;
        return Object.assign({}, subtask, { done: !subtask.done });
      });
    });
    refreshTasksKeepSubtaskPanel(taskId);
  }

  function renameSubtask(taskId, subtaskId, rawTitle) {
    var title = cleanSubtaskTitle(rawTitle);
    var task = findTaskById(taskId);
    if (!task) return;

    var current = normalizeSubtasks(task.subtasks).find(function (subtask) {
      return subtask.id === subtaskId;
    });
    if (!current) return;

    if (!title) {
      removeSubtask(taskId, subtaskId);
      return;
    }
    if (current.title === title) return;

    updateTaskSubtasks(taskId, function (subtasks) {
      return subtasks.map(function (subtask) {
        if (subtask.id !== subtaskId) return subtask;
        return Object.assign({}, subtask, { title: title });
      });
    });
    refreshTasksKeepSubtaskPanel(taskId);
  }

  function removeSubtask(taskId, subtaskId) {
    updateTaskSubtasks(taskId, function (subtasks) {
      return subtasks.filter(function (subtask) { return subtask.id !== subtaskId; });
    });
    refreshTasksKeepSubtaskPanel(taskId);
  }

  function bindScheduledActions() {
    el.scheduledTableBody.querySelectorAll(".menu-item[data-scheduled-action]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        closeAllRowMenus();
        var action = button.getAttribute("data-scheduled-action");
        var id = button.getAttribute("data-scheduled-id");
        if (!id) return;

        if (action === "restore") {
          restoreScheduledTask(id);
          return;
        }
        if (action === "delete") {
          deleteScheduledTask(id);
        }
      });
    });
  }

  function startTaskEdit(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    editingTaskId = id;
    byId("taskTitle").value = task.title || "";
    byId("taskDifficulty").value = Number(task.difficulty) || 1;
    byId("taskUrgency").value = Number(task.urgency) || 1;
    byId("taskDuration").value = Number(task.duration) || 30;
    byId("taskRoutine").checked = !!task.routine;

    el.taskSubmitBtn.textContent = t("planner.tasks.saveEdit");
    el.cancelEditBtn.classList.remove("hidden");
  }

  function resetTaskFormMode(form) {
    editingTaskId = null;
    if (form && typeof form.reset === "function") form.reset();
    el.taskSubmitBtn.textContent = t("planner.tasks.add");
    el.cancelEditBtn.classList.add("hidden");
  }

  function deleteTask(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    state.tasks = state.tasks.filter(function (item) { return item.id !== id; });
    delete openSubtaskPanelIds[id];
    if (subtaskAddInputTaskId === id) subtaskAddInputTaskId = null;
    saveState();
    renderTasks();
    updateFact();

    if (requireVerifiedParticipantId(false)) {
      fireSync("task_deleted", task || { id: id });
    }
  }

  function postponeTask(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    state.tasks = state.tasks.filter(function (item) { return item.id !== id; });
    state.scheduled.push({
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      urgency: task.urgency,
      duration: task.duration,
      routine: !!task.routine,
      subtasks: normalizeSubtasks(task.subtasks),
      scheduledFor: tomorrowISO(),
      addedAt: new Date().toISOString()
    });

    saveState();
    renderTasks();
    renderScheduled();
    updateFact();

    if (requireVerifiedParticipantId(false)) {
      fireSync("scheduled_added", {
        id: task.id,
        title: task.title,
        difficulty: task.difficulty,
        urgency: task.urgency,
        duration: task.duration,
        routine: !!task.routine,
        scheduledFor: tomorrowISO()
      });
    }
  }

  function restoreScheduledTask(id) {
    var item = state.scheduled.find(function (task) { return task.id === id; });
    if (!item) return;

    state.scheduled = state.scheduled.filter(function (task) { return task.id !== id; });
    state.tasks.push({
      id: item.id || makeId(),
      title: item.title,
      difficulty: Number(item.difficulty) || 3,
      urgency: Number(item.urgency) || 3,
      duration: Number(item.duration) || 30,
      routine: !!item.routine,
      subtasks: normalizeSubtasks(item.subtasks),
      done: false,
      order: nextOrder(),
      slotKey: item.routine ? SLOT_KEYS.morningRoutine : SLOT_KEYS.none
    });

    saveState();
    renderTasks();
    renderScheduled();
    updateFact();

    if (requireVerifiedParticipantId(false)) {
      fireSync("scheduled_restored", {
        id: item.id,
        title: item.title,
        scheduledFor: item.scheduledFor
      });
    }
  }

  function deleteScheduledTask(id) {
    var item = state.scheduled.find(function (task) { return task.id === id; });
    state.scheduled = state.scheduled.filter(function (task) { return task.id !== id; });
    saveState();
    renderScheduled();

    if (requireVerifiedParticipantId(false)) {
      fireSync("scheduled_deleted", item || { id: id });
    }
  }

  function toggleTask(id) {
    var payload = null;

    state.tasks = state.tasks.map(function (task) {
      if (task.id !== id) return task;
      var updated = Object.assign({}, task, { done: !task.done });
      payload = updated;
      return updated;
    });

    saveState();
    renderTasks();
    updateFact();

    if (payload && requireVerifiedParticipantId(false)) {
      fireSync("task_toggled", payload);
    }
  }

  function bindTaskDragAndDrop() {
    var rows = Array.prototype.slice.call(el.taskTableBody.querySelectorAll("tr.task-row"));
    var draggedId = null;

    rows.forEach(function (row) {
      row.draggable = true;

      row.addEventListener("dragstart", function (event) {
        if (event.target && event.target.closest && (
          event.target.closest(".notion-task") ||
          event.target.closest(".actions-cell")
        )) {
          event.preventDefault();
          return;
        }
        draggedId = row.getAttribute("data-task-id");
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", function () {
        row.classList.remove("dragging");
        rows.forEach(function (r) {
          r.classList.remove("drop-before");
          r.classList.remove("drop-after");
        });
      });

      row.addEventListener("dragover", function (event) {
        event.preventDefault();
        var rect = row.getBoundingClientRect();
        var midpoint = rect.top + rect.height / 2;
        row.classList.toggle("drop-before", event.clientY < midpoint);
        row.classList.toggle("drop-after", event.clientY >= midpoint);
      });

      row.addEventListener("dragleave", function () {
        row.classList.remove("drop-before");
        row.classList.remove("drop-after");
      });

      row.addEventListener("drop", function (event) {
        event.preventDefault();

        var targetId = row.getAttribute("data-task-id");
        var before = row.classList.contains("drop-before");

        rows.forEach(function (r) {
          r.classList.remove("drop-before");
          r.classList.remove("drop-after");
        });

        if (!draggedId || !targetId || draggedId === targetId) return;
        reorderTasks(draggedId, targetId, before);
      });
    });
  }

  function reorderTasks(draggedId, targetId, before) {
    var list = state.tasks.slice();
    var fromIndex = list.findIndex(function (task) { return task.id === draggedId; });
    var targetIndex = list.findIndex(function (task) { return task.id === targetId; });

    if (fromIndex < 0 || targetIndex < 0) return;

    var moved = list.splice(fromIndex, 1)[0];
    var insertIndex = targetIndex;

    if (!before && fromIndex < targetIndex) {
      insertIndex = targetIndex;
    } else if (!before && fromIndex > targetIndex) {
      insertIndex = targetIndex + 1;
    } else if (before && fromIndex < targetIndex) {
      insertIndex = targetIndex - 1;
    }

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > list.length) insertIndex = list.length;

    list.splice(insertIndex, 0, moved);

    list.forEach(function (task, index) {
      task.order = index;
    });

    state.tasks = list;
    state.manualOrder = true;
    saveState();
    renderTasks();

    if (requireVerifiedParticipantId(false)) {
      fireSync("task_reordered", {
        id: draggedId,
        order: insertIndex
      });
    }
  }

  function calcReadiness(m) {
    var sleepScore = Math.min(100, (m.sleepHours / 8) * 100);
    var quality = (m.sleepQuality / 5) * 100;
    // Поле energy: шкала усталости/мало энергии (1 — мало, 5 — сильно).
    var fatigueLevel = Number(m.energy);
    if (!Number.isFinite(fatigueLevel)) fatigueLevel = 3;
    var vitality = ((6 - fatigueLevel) / 5) * 100;
    var stressPenalty = ((m.stress - 1) / 4) * 40;

    // Старые чек-ины с полем wellbeing сохраняем совместимыми.
    if (m.wellbeing != null && Number.isFinite(Number(m.wellbeing))) {
      var wellbeing = (Number(m.wellbeing) / 5) * 100;
      return Math.max(
        0,
        Math.round(0.30 * sleepScore + 0.25 * quality + 0.20 * vitality + 0.25 * wellbeing - stressPenalty)
      );
    }

    return Math.max(
      0,
      Math.round(0.35 * sleepScore + 0.30 * quality + 0.35 * vitality - stressPenalty)
    );
  }

  function getReadinessLevel(readiness) {
    if (readiness < 40) return "low";
    if (readiness < 70) return "medium";
    return "high";
  }

  var SELF_CONTROL_STORAGE_KEY = "upeak_self_control_trait";

  function getSelfControlTrait() {
    var fromState = Number(state.selfControlTrait);
    if (Number.isFinite(fromState) && fromState >= 1 && fromState <= 5) {
      return fromState;
    }
    try {
      var stored = Number(localStorage.getItem(SELF_CONTROL_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= 1 && stored <= 5) return stored;
    } catch (_e) {}
    return 3;
  }

  function getDailyBudget(readiness, dayState) {
    var level = getReadinessLevelFromDayState(dayState) || getReadinessLevel(readiness);
    var budget = level === "low" ? 7 : level === "medium" ? 11 : 16;
    var selfControlTrait = getSelfControlTrait();
    if (selfControlTrait < 3 && readiness < 40) {
      budget = Math.round(budget * 0.85);
    }
    return budget;
  }

  function getReadinessLevelFromDayState(dayState) {
    if (!dayState || !dayState.state) return null;
    if (dayState.state === "emergency_recovery" || dayState.sub_state === "mixed_severe") {
      return "low";
    }
    if (dayState.state === "high_performance") return "high";
    return "medium";
  }

  function getDayStateLabel(dayState) {
    if (window.UpeakDayRecommendations && typeof window.UpeakDayRecommendations.getStateLabel === "function") {
      return window.UpeakDayRecommendations.getStateLabel(dayState);
    }
    return dayState && dayState.state ? dayState.state : "";
  }

  function updateReadiness() {
    if (!el.readinessValue) return;
    if (state.readiness == null) {
      el.readinessValue.textContent = "—";
      return;
    }
    var label = getDayStateLabel(state.dayState);
    el.readinessValue.textContent = label
      ? state.readiness + " · " + label
      : String(state.readiness);
  }

  function buildEveningReview() {
    if (!state.evening || !window.UpeakEveningRecommendations) return null;
    var recs = window.UpeakEveningRecommendations.getRecommendations({
      morningScore: state.readiness == null ? 0 : state.readiness,
      completedTasks: state.evening.completed,
      totalTasks: state.evening.total,
      evening: state.evening,
      embedOptions: getEveningEmbedContext()
    });
    return recs.length ? recs[0] : null;
  }

  function buildEveningSyncPayload() {
    var review = state.eveningReview || buildEveningReview();
    var er = window.UpeakEveningRecommendations;
    var morningScore = state.readiness == null ? 0 : state.readiness;
    var completed = state.evening ? Number(state.evening.completed) || 0 : 0;
    var total = state.evening ? Number(state.evening.total) || 0 : 0;
    var completionRate = review && review.completionRate != null
      ? review.completionRate
      : (total > 0 ? Math.round((completed / total) * 100) : 0);

    return Object.assign({}, state.evening, {
      readiness: morningScore,
      dayState: state.dayState || null,
      completionRate: completionRate,
      decision_key: review && review.decision_key ? review.decision_key : "",
      morning_band: er ? er.morningBand(morningScore) : "",
      completion_band: er ? er.completionBand(completed, total) : "",
      closedAt: state.dayClosedAt || ""
    });
  }

  function restoreEveningForm() {
    if (!state.evening || state.evening.date !== today) return;
    var e = state.evening;
    if (byId("fatigue") && e.fatigue != null) byId("fatigue").value = String(e.fatigue);
    if (byId("eveningTaskStart") && e.taskStart != null) byId("eveningTaskStart").value = String(e.taskStart);
    if (byId("eveningPlanOverload") && e.planOverload != null) {
      byId("eveningPlanOverload").value = String(e.planOverload);
    }
    if (byId("eveningDetachment") && e.detachment != null) {
      byId("eveningDetachment").value = String(e.detachment);
    }
    if (byId("eveningNote") && e.note) byId("eveningNote").value = e.note;
  }

  function getEveningReviewTitle() {
    if (window.UpeakEveningRecommendations && window.UpeakEveningRecommendations.EVENING_TITLE) {
      return window.UpeakEveningRecommendations.EVENING_TITLE;
    }
    return t("planner.evening.reviewTitle");
  }

  function formatReviewPlanMeta(pct) {
    return t("planner.evening.reviewPlanMeta").replace("{pct}", String(pct));
  }

  function refreshEveningReview() {
    if (state.evening && state.evening.date === today) {
      state.eveningReview = buildEveningReview();
    }
  }

  function renderWhyHtml(why) {
    if (!why) return "";
    if (typeof why === "string") {
      return '<p class="intervention-why-text">' + escapeHtml(why) + "</p>";
    }
    var html = '<div class="intervention-why-inner">';
    if (why.text) {
      html += '<p class="intervention-why-text">' + escapeHtml(why.text) + "</p>";
    }
    if (why.evidence_level) {
      html += '<p class="intervention-why-meta">Доказательность: ' + escapeHtml(why.evidence_level) + "</p>";
    }
    if (Array.isArray(why.sources) && why.sources.length) {
      why.sources.forEach(function (src) {
        if (!src || !src.title) return;
        var label = src.title +
          (src.authors ? " — " + src.authors : "") +
          (src.year ? " (" + src.year + ")" : "");
        html += '<p class="intervention-why-source">';
        if (src.url) {
          html += '<a href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(label) + "</a>";
        } else {
          html += escapeHtml(label);
        }
        html += "</p>";
      });
    } else if (why.source) {
      html += '<p class="intervention-why-source">';
      if (why.url) {
        html += '<a href="' + escapeHtml(why.url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(why.source) + "</a>";
      } else {
        html += escapeHtml(why.source);
      }
      html += "</p>";
    }
    if (Array.isArray(why.limitations) && why.limitations.length) {
      html += '<ul class="intervention-why-list">';
      why.limitations.forEach(function (item) {
        html += "<li>" + escapeHtml(item) + "</li>";
      });
      html += "</ul>";
    }
    html += "</div>";
    return html;
  }

  function normalizeTaskTitleForEmbed(title) {
    return String(title || "").trim().toLowerCase();
  }

  function getEveningEmbedContext() {
    var decisions = {};
    if (state.evening && state.evening.date === today && state.eveningEmbedDecisions) {
      decisions = state.eveningEmbedDecisions;
    }
    var morningDecisions = {};
    if (hasMorningCheckinToday() && state.morningEmbedDecisions) {
      morningDecisions = state.morningEmbedDecisions;
    }
    var existingIds = [];
    var existingTitles = [];
    if (Array.isArray(state.tasks)) {
      state.tasks.forEach(function (task) {
        if (!task) return;
        if (task.recommendationId) existingIds.push(task.recommendationId);
        if (task.title) {
          var normalized = normalizeTaskTitleForEmbed(task.title);
          if (normalized && existingTitles.indexOf(normalized) === -1) {
            existingTitles.push(normalized);
          }
        }
      });
    }
    return {
      decisions: decisions,
      existingIds: existingIds,
      existingTitles: existingTitles,
      morningDecisions: morningDecisions
    };
  }

  function ensureEveningEmbedState() {
    if (!state.eveningEmbedDecisions || typeof state.eveningEmbedDecisions !== "object") {
      state.eveningEmbedDecisions = {};
    }
    if (!state.eveningEmbedDate) state.eveningEmbedDate = today;
  }

  function findEveningEmbedOffer(embedId) {
    if (!window.UpeakEveningRecommendations ||
        typeof window.UpeakEveningRecommendations.getEveningEmbeddable !== "function") {
      return null;
    }
    var def = window.UpeakEveningRecommendations.getEveningEmbeddable(embedId);
    if (!def) return null;
    return {
      id: def.id,
      prompt: def.prompt || "",
      detail: def.detail || "",
      task: def.task ? Object.assign({}, def.task) : null
    };
  }

  function addEveningEmbedToPlan(embedId) {
    var offer = findEveningEmbedOffer(embedId);
    if (!offer || !offer.task) return;

    ensureEveningEmbedState();
    var recId = "evening:" + embedId;
    if (state.eveningEmbedDecisions[embedId] === "added" ||
        state.eveningEmbedDecisions[embedId] === "later") {
      return;
    }
    if (state.tasks.some(function (task) { return task.recommendationId === recId; })) {
      state.eveningEmbedDecisions[embedId] = "added";
      state.eveningEmbedDate = today;
      saveState();
      refreshEveningReview();
      renderEveningReview();
      return;
    }

    var taskDef = offer.task;
    var slotKey = resolveRecommendationSlotKey(taskDef);
    var newTask = {
      id: makeId(),
      title: taskDef.title,
      duration: Number(taskDef.duration) || 15,
      difficulty: Number(taskDef.difficulty) || 5,
      urgency: Number(taskDef.urgency) || 5,
      routine: false,
      done: false,
      order: nextOrder(),
      slotKey: slotKey,
      recommendationId: recId,
      subtasks: []
    };
    // Не вызываем distributeTasks: рекомендация просто появляется в плане,
    // распределение по состоянию её не трогает.
    state.tasks.push(newTask);

    state.eveningEmbedDecisions[embedId] = "added";
    state.eveningEmbedDate = today;
    saveState();
    renderTasks();
    refreshEveningReview();
    renderEveningReview();
    updateFact();

    if (requireVerifiedParticipantId(false)) {
      fireSync("evening_embed_added", {
        embedId: embedId,
        id: newTask.id,
        title: newTask.title,
        duration: newTask.duration,
        difficulty: newTask.difficulty,
        urgency: newTask.urgency,
        slotKey: newTask.slotKey
      });
    }
  }

  function deferEveningEmbed(embedId) {
    ensureEveningEmbedState();
    state.eveningEmbedDecisions[embedId] = "later";
    state.eveningEmbedDate = today;
    saveState();
    refreshEveningReview();
    renderEveningReview();
  }

  function getCardFeedback(scope) {
    var key = scope === "evening" ? "eveningCardFeedback" : "morningCardFeedback";
    var fb = state[key];
    if (!fb || fb.date !== today) return null;
    return fb;
  }

  function setCardFeedback(scope, helpful, rec) {
    var key = scope === "evening" ? "eveningCardFeedback" : "morningCardFeedback";
    var cardId = rec && (rec.card_id || rec.decision_key || rec.mode)
      ? (rec.card_id || rec.decision_key || rec.mode)
      : null;
    state[key] = {
      date: today,
      helpful: !!helpful,
      decision_key: cardId,
      completion_rate: rec && rec.completionRate != null ? rec.completionRate : null
    };
    saveState();
    if (scope === "evening") renderEveningReview();
    else renderMorningRecommendations();
    if (requireVerifiedParticipantId(false)) {
      fireSync("card_feedback", Object.assign({ scope: scope }, state[key]));
    }
  }

  // Один раз в день (по первому рендеру карточки) шлём "показана рекомендация",
  // чтобы в Recommendations была строка даже если человек не нажал "Да/Нет".
  function maybeSyncRecommendationShown(scope, rec) {
    if (!rec) return;
    var key = scope === "evening" ? "eveningRecommendationShownDate" : "morningRecommendationShownDate";
    if (state[key] === today) return;
    state[key] = today;
    saveState();

    var cardId = rec.card_id || rec.decision_key || rec.mode || "";
    if (!cardId || !requireVerifiedParticipantId(false)) return;

    fireSync(scope === "evening" ? "evening_recommendation_shown" : "morning_recommendation_shown", {
      card_id: cardId,
      decision_key: rec.decision_key || cardId,
      text: rec.text || rec.narrative || rec.summary || "",
      matrix_version: scope === "evening" ? eveningMatrixVersion : morningMatrixVersion
    });
  }

  function renderCardFeedback(scope, rec) {
    var fb = getCardFeedback(scope);
    var html = '<div class="intervention-feedback" data-feedback-scope="' + escapeAttr(scope) + '">';
    html += '<span class="intervention-feedback-label">' + escapeHtml(t("planner.cardFeedback.prompt")) + "</span>";
    if (fb) {
      html += '<span class="intervention-feedback-thanks">' + escapeHtml(t("planner.cardFeedback.thanks")) + "</span>";
    } else {
      html += '<div class="intervention-feedback-actions">';
      html += '<button type="button" class="btn secondary intervention-feedback-btn" data-card-feedback="yes" data-feedback-scope="' +
        escapeAttr(scope) + '">' + escapeHtml(t("planner.cardFeedback.yes")) + "</button>";
      html += '<button type="button" class="btn secondary intervention-feedback-btn" data-card-feedback="no" data-feedback-scope="' +
        escapeAttr(scope) + '">' + escapeHtml(t("planner.cardFeedback.no")) + "</button>";
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function bindCardFeedback(container, rec, scope) {
    container.querySelectorAll("[data-card-feedback]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var feedbackScope = btn.getAttribute("data-feedback-scope") || scope;
        var value = btn.getAttribute("data-card-feedback");
        if (!feedbackScope || !value) return;
        setCardFeedback(feedbackScope, value === "yes", rec);
      });
    });
  }

  function getMorningEmbedContext() {
    var decisions = {};
    if (hasMorningCheckinToday() && state.morningEmbedDecisions) {
      decisions = state.morningEmbedDecisions;
    }
    var existingIds = [];
    if (Array.isArray(state.tasks)) {
      state.tasks.forEach(function (task) {
        if (task && task.recommendationId) existingIds.push(task.recommendationId);
      });
    }
    return { decisions: decisions, existingIds: existingIds };
  }

  function buildMorningRecommendations() {
    if (!state.dayState || !window.UpeakDayRecommendations) return [];
    return window.UpeakDayRecommendations.getRecommendations(state.dayState, getMorningEmbedContext());
  }

  function findMorningEmbedOffer(embedId) {
    if (!window.UpeakDayRecommendations || typeof window.UpeakDayRecommendations.getMorningEmbeddable !== "function") {
      return null;
    }
    var def = window.UpeakDayRecommendations.getMorningEmbeddable(embedId);
    if (!def || !def.task) return null;
    return {
      id: def.id,
      task: Object.assign({}, def.task)
    };
  }

  function ensureMorningEmbedState() {
    if (!state.morningEmbedDecisions || typeof state.morningEmbedDecisions !== "object") {
      state.morningEmbedDecisions = {};
    }
    if (!state.morningEmbedDate) state.morningEmbedDate = today;
  }

  function addMorningEmbedToPlan(embedId) {
    var offer = findMorningEmbedOffer(embedId);
    if (!offer || !offer.task) return;

    ensureMorningEmbedState();
    var recId = "morning:" + embedId;
    if (state.morningEmbedDecisions[embedId] === "added" ||
        state.morningEmbedDecisions[embedId] === "later") {
      return;
    }
    if (state.tasks.some(function (task) { return task.recommendationId === recId; })) {
      state.morningEmbedDecisions[embedId] = "added";
      state.morningEmbedDate = today;
      saveState();
      state.morningRecommendations = buildMorningRecommendations();
      renderMorningRecommendations();
      return;
    }

    var taskDef = offer.task;
    var slotKey = resolveRecommendationSlotKey(taskDef);
    var newTask = {
      id: makeId(),
      title: taskDef.title,
      duration: Number(taskDef.duration) || 15,
      difficulty: Number(taskDef.difficulty) || 5,
      urgency: Number(taskDef.urgency) || 5,
      routine: false,
      done: false,
      order: nextOrder(),
      slotKey: slotKey,
      recommendationId: recId,
      subtasks: []
    };
    // Не вызываем distributeTasks: рекомендация просто появляется в плане,
    // распределение по состоянию её не трогает.
    state.tasks.push(newTask);

    state.morningEmbedDecisions[embedId] = "added";
    state.morningEmbedDate = today;
    saveState();
    renderTasks();
    state.morningRecommendations = buildMorningRecommendations();
    renderMorningRecommendations();
    updateFact();

    var tasksSection = el.taskTableBody && el.taskTableBody.closest("section");
    if (tasksSection) {
      tasksSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (requireVerifiedParticipantId(false)) {
      fireSync("morning_embed_added", {
        embedId: embedId,
        id: newTask.id,
        title: newTask.title,
        duration: newTask.duration,
        difficulty: newTask.difficulty,
        urgency: newTask.urgency,
        slotKey: newTask.slotKey
      });
    }
  }

  function deferMorningEmbed(embedId) {
    ensureMorningEmbedState();
    state.morningEmbedDecisions[embedId] = "later";
    state.morningEmbedDate = today;
    saveState();
    state.morningRecommendations = buildMorningRecommendations();
    renderMorningRecommendations();
  }

  function renderEmbedOffer(offer, scope) {
    if (!offer || offer.status !== "pending") return "";

    var addAttr = scope === "evening" ? "data-evening-embed-add" : "data-morning-embed-add";
    var laterAttr = scope === "evening" ? "data-evening-embed-later" : "data-morning-embed-later";

    var html = '<div class="intervention-embed" data-embed-id="' + escapeAttr(offer.id) + '">';
    html += '<p class="intervention-embed-text">' + escapeHtml(offer.prompt) + "</p>";
    if (offer.detail) {
      html += '<p class="intervention-meta">' + escapeHtml(offer.detail) + "</p>";
    }
    html += '<div class="intervention-embed-actions">';
    html += '<button type="button" class="btn intervention-embed-btn" ' + addAttr + '="' +
      escapeAttr(offer.id) + '">' + escapeHtml(t("planner.morning.embedAdd")) + "</button>";
    html += '<button type="button" class="btn secondary intervention-embed-btn" ' + laterAttr + '="' +
      escapeAttr(offer.id) + '">' + escapeHtml(t("planner.morning.embedLater")) + "</button>";
    html += "</div>";
    html += "</div>";
    return html;
  }

  function bindEmbedActions(container, scope) {
    if (scope === "evening") {
      container.querySelectorAll("[data-evening-embed-add]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var embedId = btn.getAttribute("data-evening-embed-add");
          if (embedId) addEveningEmbedToPlan(embedId);
        });
      });
      container.querySelectorAll("[data-evening-embed-later]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var embedId = btn.getAttribute("data-evening-embed-later");
          if (embedId) deferEveningEmbed(embedId);
        });
      });
      return;
    }
    container.querySelectorAll("[data-morning-embed-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var embedId = btn.getAttribute("data-morning-embed-add");
        if (embedId) addMorningEmbedToPlan(embedId);
      });
    });
    container.querySelectorAll("[data-morning-embed-later]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var embedId = btn.getAttribute("data-morning-embed-later");
        if (embedId) deferMorningEmbed(embedId);
      });
    });
  }

  function renderRecommendationCard(rec, idx, whyPrefix, feedbackScope, options) {
    whyPrefix = whyPrefix || "morningWhy";
    options = options || {};
    var html = '<article class="intervention-card">';
    var tone = rec.tone || "steady";
    var emoji = tone === "growth" || tone === "high" ? "🟢" : tone === "recovery" ? "🔴" : "🟡";
    // Вечер: narrative = диагноз/итог, state_title = бейдж. Утро: state = диагноз.
    var stateText = rec.narrative
      ? rec.narrative
      : (rec.state || rec.diagnosis || rec.summary || rec.today || rec.text || "");
    var planLabel = rec.plan_label || "Сегодня";
    var proof = rec.proof || rec.why;
    var showProof = rec.show_proof || rec.show_why;
    var isEveningCard = !!rec.narrative || feedbackScope === "evening";

    if (rec.state_title) {
      html += '<p class="intervention-state-badge">' + escapeHtml(rec.state_title) + "</p>";
    }
    html += '<p class="intervention-diagnosis">' + emoji + " " + escapeHtml(stateText) + "</p>";

    if (rec.decision) {
      html += '<p class="intervention-decision">' + escapeHtml(rec.decision) + "</p>";
    }

    if (Array.isArray(rec.actions) && rec.actions.length) {
      if (Array.isArray(rec.action_labels) && rec.action_labels.length === rec.actions.length) {
        rec.actions.forEach(function (item, actionIdx) {
          html += '<p class="intervention-rec"><strong>' +
            escapeHtml(rec.action_labels[actionIdx]) + "</strong></p>";
          html += '<ul class="intervention-list"><li>' + escapeHtml(item) + "</li></ul>";
        });
      } else {
        html += '<p class="intervention-rec"><strong>' + escapeHtml(planLabel) + "</strong></p>";
        html += '<ul class="intervention-list">';
        rec.actions.forEach(function (item) {
          html += "<li>" + escapeHtml(item) + "</li>";
        });
        html += "</ul>";
      }
    }

    // Вечер: плашка сразу после «Завтра» — это и есть действие «добавить в план».
    if (isEveningCard && options.embedHtml) {
      html += options.embedHtml;
    }

    if (!isEveningCard) {
      if (Array.isArray(rec.avoid) && rec.avoid.length) {
        html += '<p class="intervention-avoid-label"><strong>Избегай</strong></p>';
        html += '<ul class="intervention-avoid-list">';
        rec.avoid.forEach(function (item) {
          html += "<li>" + escapeHtml(item) + "</li>";
        });
        html += "</ul>";
      }

      if (rec.move_to_max) {
        html += '<p class="intervention-move-label"><strong>Как выйти на максимум</strong></p>';
        html += '<p class="intervention-move">' + escapeHtml(rec.move_to_max) + "</p>";
      }

      if (rec.benefit) {
        html += '<p class="intervention-benefit-label"><strong>Почему это важно</strong></p>';
        html += '<p class="intervention-benefit">' + escapeHtml(rec.benefit) + "</p>";
      }

      if (rec.result) {
        html += '<p class="intervention-result-label"><strong>Потенциальный эффект</strong></p>';
        if (rec.result_condition) {
          html += '<p class="intervention-result-condition">' + escapeHtml(rec.result_condition) + "</p>";
        }
        html += '<p class="intervention-result">' + escapeHtml(rec.result) + "</p>";
        if (rec.result_disclaimer) {
          html += '<p class="intervention-result-disclaimer">' + escapeHtml(rec.result_disclaimer) + "</p>";
        }
      }

      // Утро: плашка после текста рекомендации, перед «Почему?» / фидбэком.
      if (options.embedHtml) {
        html += options.embedHtml;
      }
    }

    if (showProof && proof && (proof.text || (proof.sources && proof.sources.length))) {
      html += '<button type="button" class="intervention-why-btn" data-why-target="' + whyPrefix + idx +
        '" aria-expanded="false">Почему?</button>';
      html += '<div class="intervention-why hidden" id="' + whyPrefix + idx + '">' +
        renderWhyHtml(proof) + "</div>";
    }

    if (feedbackScope) {
      html += renderCardFeedback(feedbackScope, rec);
    }

    html += "</article>";
    return html;
  }

  function refreshInterventionBlocks() {
    if (hasMorningCheckinToday()) {
      if (state.dayState && window.UpeakDayRecommendations) {
        state.morningRecommendations = buildMorningRecommendations();
      }
      renderMorningRecommendations();
    } else {
      renderMorningRecommendations();
    }

    if (state.evening && state.evening.date === today) {
      refreshEveningReview();
      renderEveningReview();
    } else {
      renderEveningReview();
    }
  }

  function renderMorningRecommendations() {
    var container = el.morningRecommendations;
    if (!container) return;

    if (hasMorningCheckinToday() && state.dayState && window.UpeakDayRecommendations) {
      state.morningRecommendations = buildMorningRecommendations();
    }

    var recs = state.morningRecommendations;
    var show = hasMorningCheckinToday() &&
      Array.isArray(recs) && recs.length > 0;

    if (!show) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    var stateLine = state.dayState
      ? ' <span class="intervention-meta">' + escapeHtml(getDayStateLabel(state.dayState)) + "</span>"
      : "";
    // Плашки «в план» — внутри первой карточки, сразу после блока «Сегодня».
    var embedHtml = "";
    if (recs[0] && Array.isArray(recs[0].embedOffers) && recs[0].embedOffers.length) {
      embedHtml = recs[0].embedOffers.map(function (offer) {
        return renderEmbedOffer(offer, "morning");
      }).join("");
    }

    container.innerHTML =
      '<h3 class="intervention-title">' + escapeHtml(t("planner.morning.recommendationsTitle")) + stateLine + "</h3>" +
      recs.map(function (rec, idx) {
        return renderRecommendationCard(rec, idx, "morningWhy", "morning", {
          embedHtml: idx === 0 ? embedHtml : ""
        });
      }).join("");

    bindWhyToggles(container);
    bindEmbedActions(container, "morning");
    if (recs[0]) {
      bindCardFeedback(container, recs[0], "morning");
      maybeSyncRecommendationShown("morning", recs[0]);
    }
  }

  function renderEveningReview() {
    var container = el.eveningReview;
    if (!container) return;

    var review = state.eveningReview;
    var show = review && state.evening && state.evening.date === today;

    if (!show) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    var header = '<h3 class="intervention-title">' + escapeHtml(getEveningReviewTitle());
    if (review.completionRate != null) {
      header += ' <span class="intervention-meta">' +
        escapeHtml(formatReviewPlanMeta(review.completionRate)) + "</span>";
    }
    header += "</h3>";

    // Плашки «в план» — внутри карточки, сразу после блока «Завтра», а не внизу.
    var embedHtml = "";
    if (review.embedOffers && review.embedOffers.length) {
      embedHtml = review.embedOffers.map(function (offer) {
        return renderEmbedOffer(offer, "evening");
      }).join("");
    }

    container.innerHTML = header +
      renderRecommendationCard(review, 0, "eveningWhy", "evening", { embedHtml: embedHtml });
    bindWhyToggles(container);
    bindEmbedActions(container, "evening");
    bindCardFeedback(container, review, "evening");
    maybeSyncRecommendationShown("evening", review);
  }

  function bindWhyToggles(container) {
    container.querySelectorAll(".intervention-why-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-why-target");
        var whyEl = targetId ? document.getElementById(targetId) : null;
        if (!whyEl) return;
        whyEl.classList.toggle("hidden");
        btn.setAttribute("aria-expanded", whyEl.classList.contains("hidden") ? "false" : "true");
      });
    });
  }

  // План-факт считается только по задачам на сегодня. Запланированные на завтра
  // в знаменатель не попадают, поэтому 3 исходных задачи → 1 перенесена = 2/2.
  function updateFact() {
    var done = state.tasks.filter(function (task) { return task.done; }).length;
    var total = state.tasks.length;
    if (el.factValue) {
      el.factValue.textContent = done + "/" + total;
    }
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;
    var closedToday = !!(state.dayClosedAt && state.evening && state.evening.date === today);
    el.dayStatus.textContent = closedToday ? t("planner.evening.dayClosed") : t("planner.evening.dayOpen");
  }

  function updateSyncStatus(status) {
    lastSyncStatus = status;
    if (!el.syncStatus) return;

    el.syncStatus.className = "status sync-status";

    if (status === "syncing") {
      el.syncStatus.textContent = t("planner.sync.syncing");
      return;
    }
    if (status === "success") {
      el.syncStatus.textContent = t("planner.sync.success");
      el.syncStatus.classList.add("ok");
      return;
    }
    if (status === "error") {
      el.syncStatus.textContent = t("planner.sync.error");
      el.syncStatus.classList.add("err");
      return;
    }

    el.syncStatus.textContent = "";
  }

  function setupParticipantId() {
    if (!el.participantIdForm || !el.participantIdInput) return;

    state.participantId = sanitizeParticipantId(state.participantId || "");
    participantIdLocked = !!state.participantId;
    el.participantIdInput.value = state.participantId || "";

    applyParticipantIdLockState();
    refreshParticipantIdStatus();

    el.participantIdForm.addEventListener("submit", function (event) {
      event.preventDefault();
      verifyAndSaveParticipantId();
    });

    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.addEventListener("click", function () {
        participantIdLocked = false;
        applyParticipantIdLockState();
        setParticipantIdStatus("info", t("planner.id.locked"));
        el.participantIdInput.focus();
        el.participantIdInput.select();
      });
    }
  }

  function applyParticipantIdLockState() {
    if (!el.participantIdInput) return;
    el.participantIdInput.readOnly = participantIdLocked;

    if (el.participantIdSaveBtn) {
      el.participantIdSaveBtn.classList.toggle("hidden", participantIdLocked);
    }
    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.classList.toggle("hidden", !participantIdLocked);
    }
  }

  function refreshParticipantIdStatus() {
    if (!el.participantIdStatus) return;
    if (!state.participantId) {
      setParticipantIdStatus("", t("planner.id.required"));
      return;
    }
    if (participantIdLocked) {
      setParticipantIdStatus("ok", t("planner.id.saved"));
      return;
    }
    setParticipantIdStatus("info", t("planner.id.locked"));
  }

  function setParticipantIdStatus(kind, message) {
    if (!el.participantIdStatus) return;
    el.participantIdStatus.className = "participant-id-status";
    if (kind === "ok") el.participantIdStatus.classList.add("is-ok");
    if (kind === "err") el.participantIdStatus.classList.add("is-err");
    if (kind === "info") el.participantIdStatus.classList.add("is-info");
    el.participantIdStatus.textContent = message || "";
  }

  function sanitizeParticipantId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function verifyAndSaveParticipantId() {
    var participantId = sanitizeParticipantId(el.participantIdInput.value);
    if (!participantId) {
      setParticipantIdStatus("err", t("planner.id.empty"));
      return;
    }

    setParticipantIdStatus("info", t("planner.id.checking"));

    fetch(PARTICIPANT_LOOKUP_URL + "?id=" + encodeURIComponent(participantId), {
      method: "GET",
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("lookup_failed_" + response.status);
        return response.json();
      })
      .then(function (result) {
        if (result && result.ok && result.exists) {
          state.participantId = participantId;
          saveState();
          participantIdLocked = true;
          applyParticipantIdLockState();
          setParticipantIdStatus("ok", t("planner.id.saved"));
          updateSyncStatus("idle");
        } else {
          participantIdLocked = false;
          applyParticipantIdLockState();
          setParticipantIdStatus("err", t("planner.id.notFound"));
        }
      })
      .catch(function (error) {
        console.error("Participant ID lookup failed", error);
        participantIdLocked = false;
        applyParticipantIdLockState();
        setParticipantIdStatus("err", t("planner.id.error"));
      });
  }

  function requireVerifiedParticipantId(showAlert) {
    if (participantIdLocked && state && state.participantId) return true;
    if (showAlert !== false) {
      alert(t("planner.id.required"));
    }
    if (el.participantIdInput) el.participantIdInput.focus();
    updateSyncStatus("error");
    return false;
  }

  // Fire-and-forget wrapper for analytics events: keeps the caller decoupled
  // from the network result while still surfacing failures to the console
  // instead of leaving an unhandled promise rejection.
  function fireSync(eventType, payload) {
    return sync(eventType, payload).catch(function (error) {
      if (error && error.skipped) return;
      console.error("planner sync failed for event", eventType, error);
    });
  }

  function sync(eventType, payload) {
    if (!requireVerifiedParticipantId(false)) return Promise.resolve({ skipped: true });

    updateSyncStatus("syncing");

    var body = {
      source: "pulseburn-planner",
      eventType: eventType,
      timestamp: new Date().toISOString(),
      date: today,
      sessionId: state.sessionId,
      participantId: state.participantId || "",
      userId: state.participantId || "",
      userName: state.participantId || "",
      language: getLang(),
      sourcePage: location.pathname,
      readiness: state.readiness == null ? "" : state.readiness,
      tasksCount: state.tasks.length,
      doneCount: state.tasks.filter(function (task) { return task.done; }).length,
      scheduledCount: state.scheduled.length,
      payload: payload || {}
    };

    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (response) {
        if (!response.ok) throw new Error("sync_failed");
        return response.json();
      })
      .then(function (result) {
        if (!result || result.ok === false) throw new Error("sync_failed");
        updateSyncStatus("success");
        return result;
      })
      .catch(function (error) {
        updateSyncStatus("error");
        return Promise.reject(error);
      });
  }

  function compareTasksForDisplay(a, b) {
    if (state.manualOrder) {
      return Number(a.order || 0) - Number(b.order || 0);
    }

    // Рекомендации: утренние/дневные сверху, вечерние снизу; обычные задачи — посередине.
    var aTop = isTopRecommendationTask(a);
    var bTop = isTopRecommendationTask(b);
    if (aTop !== bTop) return aTop ? -1 : 1;
    if (aTop && bTop) return compareRecommendationTasks(a, b);

    var aBottom = isBottomRecommendationTask(a);
    var bBottom = isBottomRecommendationTask(b);
    if (aBottom !== bBottom) return aBottom ? 1 : -1;
    if (aBottom && bBottom) return compareRecommendationTasks(a, b);

    var orderMap = {};
    orderMap[SLOT_KEYS.morningRoutine] = 0;
    orderMap[SLOT_KEYS.morningFocus] = 1;
    orderMap[SLOT_KEYS.dayOps] = 2;
    orderMap[SLOT_KEYS.eveningLight] = 3;
    orderMap[SLOT_KEYS.simplify] = 4;
    orderMap[SLOT_KEYS.postpone] = 5;
    orderMap[SLOT_KEYS.none] = 6;

    var slotDiff = (orderMap[a.slotKey] || 99) - (orderMap[b.slotKey] || 99);
    if (slotDiff !== 0) return slotDiff;

    var doneDiff = Number(!!a.done) - Number(!!b.done);
    if (doneDiff !== 0) return doneDiff;

    return Number(a.order || 0) - Number(b.order || 0);
  }

  function tomorrowISO() {
    var date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function cleanSubtaskTitle(title) {
    return String(title || "").trim().slice(0, 120);
  }

  function normalizeSubtasks(subtasks) {
    if (!Array.isArray(subtasks)) return [];
    return subtasks.map(function (subtask) {
      if (!subtask || typeof subtask !== "object") return null;
      var title = cleanSubtaskTitle(subtask.title);
      if (!title) return null;
      return {
        id: subtask.id || makeSubtaskId(),
        title: title,
        done: !!subtask.done
      };
    }).filter(Boolean);
  }

  function makeSubtaskId() {
    return "sub_" + Math.random().toString(36).slice(2, 10);
  }

  function parseTaskTitle(rawTitle) {
    return { title: cleanTaskTitle(rawTitle), routine: false };
  }

  function cleanTaskTitle(title) {
    return String(title || "").trim().slice(0, 140);
  }

  function isRoutineTask(task) {
    return Boolean(
      task && (task.routine || task.slotKey === SLOT_KEYS.morningRoutine)
    );
  }

  // Priority comparator used during distribution and display.
  // Срочность важнее остального, потом важность (urgency×2.5 + difficulty×1.5 + duration_hours×0.5),
  // потом сложность, потом длительность.
  function comparePriority(a, b) {
    if (isRoutineTask(a) !== isRoutineTask(b)) return isRoutineTask(a) ? -1 : 1;
    var au = Number(a.urgency) || 0, bu = Number(b.urgency) || 0;
    if (au !== bu) return bu - au;
    var ai = importanceScore(a), bi = importanceScore(b);
    if (ai !== bi) return bi - ai;
    var ad = Number(a.difficulty) || 0, bd = Number(b.difficulty) || 0;
    if (ad !== bd) return bd - ad;
    var adur = Number(a.duration) || 0, bdur = Number(b.duration) || 0;
    if (adur !== bdur) return adur - bdur;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  }

  function importanceScore(task) {
    var urgency = Number(task.urgency) || 0;
    var difficulty = Number(task.difficulty) || 0;
    var durationHours = (Number(task.duration) || 0) / 60;
    return (urgency * 2.5) + (difficulty * 1.5) + (durationHours * 0.5);
  }

  function nextOrder() {
    if (!state.tasks.length) return 0;
    return Math.max.apply(null, state.tasks.map(function (task) {
      return Number(task.order || 0);
    })) + 1;
  }

  function makeId() {
    return "task_" + Math.random().toString(36).slice(2, 10);
  }

  function getNum(id) {
    var node = byId(id);
    return Number(node && node.value ? node.value : 0);
  }

  function getScale1to5(id) {
    var node = byId(id);
    if (!node) return NaN;
    var raw = String(node.value || "").trim().replace(",", ".");
    var value = Number(raw);
    if (!Number.isFinite(value)) return NaN;
    var rounded = Math.round(value);
    if (rounded < 1 || rounded > 5) return NaN;
    node.value = String(rounded);
    return rounded;
  }

  function getSleepHours() {
    var node = byId("sleepHours");
    if (!node) return 0;
    var raw = String(node.value || "").trim().replace(",", ".");
    var value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    var clamped = Math.max(0, Math.min(14, value));
    // Нормализуем к шагу в 30 минут.
    var snapped = Math.round(clamped * 2) / 2;
    node.value = snapped % 1 === 0 ? String(snapped) : snapped.toFixed(1);
    return snapped;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function loadState() {
    var empty = {
      sessionId: "sess_" + Math.random().toString(36).slice(2, 10),
      participantId: "",
      morning: null,
      evening: null,
      readiness: null,
      tasks: [],
      scheduled: [],
      dayClosedAt: "",
      manualOrder: false,
      lastRoutineResetDate: "",
      morningEmbedDecisions: {},
      morningEmbedDate: "",
      eveningEmbedDecisions: {},
      eveningEmbedDate: "",
      morningCardFeedback: null,
      eveningCardFeedback: null,
      morningRecommendationShownDate: "",
      eveningRecommendationShownDate: ""
    };

    try {
      var saved = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (!saved) return empty;
      return Object.assign({}, empty, JSON.parse(saved));
    } catch (_e) {
      return empty;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_e) {}
  }

  function migrateSlots() {
    if (!Array.isArray(state.tasks)) state.tasks = [];
    state.tasks = state.tasks.map(function (task) {
      if (!task || typeof task !== "object") return task;

      var slotKey = task.slotKey || task.slot || SLOT_KEYS.none;

      if (slotKey === "morningRoutine") slotKey = SLOT_KEYS.morningRoutine;
      if (slotKey === "morningFocus") slotKey = SLOT_KEYS.morningFocus;
      if (slotKey === "dayOps") slotKey = SLOT_KEYS.dayOps;
      if (slotKey === "eveningLight") slotKey = SLOT_KEYS.eveningLight;
      if (slotKey === "none") slotKey = SLOT_KEYS.none;
      if (slotKey === "postpone") slotKey = SLOT_KEYS.postpone;
      if (slotKey === "simplify") slotKey = SLOT_KEYS.simplify;

      return Object.assign({}, task, {
        slotKey: slotKey,
        subtasks: normalizeSubtasks(task.subtasks)
      });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();