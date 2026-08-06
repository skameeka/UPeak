/**
 * Upeak — Planner prototype Apps Script.
 *
 * Этот скрипт обслуживает ДРУГУЮ Google-таблицу, в которую стекаются события
 * прототипа-планировщика (страница /planner.html). Регистрационная форма
 * (страница /participate.html) пишет в другую таблицу со своим скриптом —
 * не путайте их.
 *
 * Куда уходит каждое поле — описано в HEADERS ниже. Каждая строка — это одно
 * событие пользователя: чек-ин, создание/изменение/перенос/удаление задачи,
 * распределение по состоянию, возврат из «Запланированных», закрытие дня.
 *
 * СХЕМА ДАННЫХ (v2): помимо плоского лога PlannerEvents (ниже, не трогаем —
 * это архив/подстраховка), каждое событие ДОПОЛНИТЕЛЬНО раскладывается в
 * 6 связанных листов: Users → Days → Morning_Checkin / Evening_Checkin /
 * Tasks / Recommendations (+ статичный справочник Recommendations_Catalog).
 * Подробности и ручной runbook — см. docs/planner-data-model.md.
 *
 * Чистая логика ниже (секция "PlannerSchema") — 1:1 транскрипция
 * lib/planner-schema.js (протестирован через `npm test`, см.
 * test/planner-schema.test.js). Apps Script не поддерживает require(), поэтому
 * при изменении логики нужно поправить ОБА файла синхронно.
 */

// Если скрипт привязан к таблице (Extensions → Apps Script), можно оставить пустым.
// Иначе вставьте ID таблицы между кавычками.
var SPREADSHEET_ID = "";
var SHEET_NAME = "PlannerEvents";

// Общий секрет между Railway-прокси и скриптом: без правильного токена отвечаем 403.
// Обязательный секрет: должен совпадать с PLANNER_APPS_SCRIPT_TOKEN в .env.
// Если оставить пустым, запись событий отклоняется (fail-closed).
var SHARED_TOKEN = "";

var HEADERS = [
  "Timestamp (server)",     // когда строка попала в таблицу
  "Received At (proxy)",    // когда прокси UPeak принял событие
  "Client Timestamp",       // время с устройства пользователя (ISO)
  "Date",                   // дата задачи/события у пользователя (YYYY-MM-DD)
  "Session ID",             // стабильный идентификатор браузерной сессии пользователя
  "User Name",              // имя, если пользователь его ввёл; иначе "anonymous"
  "Source Page",            // путь страницы (например /planner.html)
  "Language",               // язык интерфейса (ru/en)
  "Event Type",             // morning_checkin / task_created / task_edited / task_toggled
                            //  / task_reordered / task_deleted / scheduled_added
                            //  / scheduled_restored / scheduled_deleted
                            //  / routine_activated / plan_generated / evening_checkout
                            //  / card_feedback / morning_embed_added / evening_embed_added
                            //  / morning_recommendation_shown / evening_recommendation_shown
  "Readiness",              // расчётная готовность 0..100
  "Tasks Count",            // всего задач в основном блоке (сегодня)
  "Done Count",             // выполненные сегодня
  "Scheduled Count",        // сколько задач лежит в «Запланированных»
  "Task ID",                // id задачи, если событие про конкретную задачу
  "Task Title",             // название задачи
  "Difficulty",             // 1..5
  "Urgency",                // 1..5
  "Duration (min)",         // оценка длительности в минутах
  "Routine",                // TRUE/FALSE — рутина по умолчанию в начало дня
  "Slot Key",               // recommended slot (morningFocus, dayOps, ...)
  "Order",                  // позиция в основном списке после ручной сортировки
  "Scheduled For",          // дата возврата для «Запланированных» (YYYY-MM-DD)
  "Plan-Fact",              // строка "выполнено/всего сегодня" (например "2/2")
  "Feedback Scope",         // morning/evening — для card_feedback
  "Recommendation ID",      // decision_key/card_id карточки (например single_issue:stress,
                            //  completion_high) или embedId для *_embed_added
  "Helpful",                // TRUE/FALSE — ответ на "Помогла рекомендация?" (card_feedback)
  "User Agent",             // браузер
  "IP (proxy)",             // IP, как видит его прокси
  "Raw Payload"             // JSON с исходным payload события
];

function _getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.length > 0) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active spreadsheet. Set SPREADSHEET_ID or bind the script to a sheet.");
  }
  return ss;
}

function _getSheet_() {
  var ss = _getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS.length);
  } else {
    _upgradePlannerEventsSchema_(sheet);
  }
  return sheet;
}

// Обновляет старый PlannerEvents (26 колонок) до текущей схемы (29 колонок)
// без удаления истории. В старой версии после Plan-Fact сразу шли User Agent,
// IP и Raw Payload; теперь перед ними добавлены три поля рекомендаций.
function _upgradePlannerEventsSchema_(sheet) {
  var lastColumn = sheet.getLastColumn();
  var headers = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    : [];
  var hasCurrentFeedbackColumns =
    String(headers[23] || "").trim() === "Feedback Scope" &&
    String(headers[24] || "").trim() === "Recommendation ID" &&
    String(headers[25] || "").trim() === "Helpful";
  var isLegacySchema =
    String(headers[0] || "").trim() === "Timestamp (server)" &&
    String(headers[8] || "").trim() === "Event Type" &&
    String(headers[23] || "").trim() === "User Agent" &&
    String(headers[24] || "").trim() === "IP (proxy)" &&
    String(headers[25] || "").trim() === "Raw Payload";

  if (isLegacySchema) {
    sheet.insertColumnsBefore(24, 3);
    hasCurrentFeedbackColumns = true;
  }

  if (!hasCurrentFeedbackColumns && lastColumn > 0) {
    throw new Error(
      "Неизвестная схема PlannerEvents. Создайте копию таблицы и проверьте заголовки перед обновлением."
    );
  }

  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  _fixPlannerEventsNumberFormats_(sheet);
}

// Старые числовые колонки могли быть отформатированы как даты, из-за чего
// значения 0/1/2/… отображались как 30.12.1899/31.12.1899/01.01.1900.
function _fixPlannerEventsNumberFormats_(sheet) {
  var dataRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 10, dataRows, 4).setNumberFormat("0.##"); // readiness + counts
  sheet.getRange(2, 16, dataRows, 3).setNumberFormat("0.##"); // difficulty/urgency/duration
  sheet.getRange(2, 21, dataRows, 1).setNumberFormat("0.##"); // order
}

function _jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _sanitize_(value, maxLen) {
  if (value === null || value === undefined) return "";
  var s = String(value).trim();
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

// Значения вида "=IMPORTXML(...)" пишем как текст, иначе Sheets/Excel
// исполнит их как формулу (formula injection).
function _cell_(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function _safeJson_(value) {
  try {
    return JSON.stringify(value).slice(0, 5000);
  } catch (_e) {
    return "";
  }
}

function _parsePayload_(e) {
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (_err) {}
  }
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }
  return {};
}

var ALLOWED_EVENTS = {
  morning_checkin: true,
  task_created: true,
  task_edited: true,
  task_deleted: true,
  task_toggled: true,
  task_reordered: true,
  scheduled_added: true,
  scheduled_restored: true,
  scheduled_deleted: true,
  plan_generated: true,
  routine_activated: true,
  evening_checkout: true,
  card_feedback: true,
  morning_embed_added: true,
  evening_embed_added: true,
  morning_recommendation_shown: true,
  evening_recommendation_shown: true
};

function doGet(_e) {
  return _jsonOutput_({
    ok: true,
    service: "upeak-planner-events",
    version: 3,
    sheet: SHEET_NAME
  });
}

function doPost(e) {
  try {
    var data = _parsePayload_(e) || {};

    if (!SHARED_TOKEN || _sanitize_(data.proxyToken, 200) !== SHARED_TOKEN) {
      return _jsonOutput_({ ok: false, error: "forbidden" });
    }

    var eventType = _sanitize_(data.eventType, 64);
    if (!eventType || !ALLOWED_EVENTS[eventType]) {
      return _jsonOutput_({ ok: false, error: "invalid_event_type" });
    }

    var clientTs = _sanitize_(data.timestamp, 64);
    var date = _sanitize_(data.date, 32);
    if (!clientTs || !date) {
      return _jsonOutput_({ ok: false, error: "timestamp_and_date_required" });
    }

    var payload = (data.payload && typeof data.payload === "object") ? data.payload : {};

    var taskId = _sanitize_(payload.id || payload.taskId, 64);
    var taskTitle = _sanitize_(payload.title, 200);
    var difficulty = Number(payload.difficulty);
    var urgency = Number(payload.urgency);
    var duration = Number(payload.duration);
    var routine = payload.routine === true ? "TRUE" : (payload.routine === false ? "FALSE" : "");
    var slotKey = _sanitize_(payload.slotKey, 64);
    var order = (payload.order == null || payload.order === "") ? "" : Number(payload.order);
    var scheduledFor = _sanitize_(payload.scheduledFor, 32);

    // card_feedback: { scope, decision_key/card_id, helpful, completion_rate, date }
    // morning_embed_added / evening_embed_added: { embedId, id, title, ... }
    var feedbackScope = _sanitize_(payload.scope, 16);
    var recommendationId = _sanitize_(payload.decision_key || payload.card_id || payload.embedId, 120);
    var helpfulValue = (payload.helpful === true) ? "TRUE" : (payload.helpful === false ? "FALSE" : "");

    var tasksCount = Number(data.tasksCount);
    var doneCount = Number(data.doneCount);
    var scheduledCount = Number(data.scheduledCount);
    var planFact = (isFinite(doneCount) && isFinite(tasksCount))
      ? (doneCount + "/" + tasksCount)
      : "";

    var userName = _sanitize_(data.userName, 120) || "anonymous";

    var sheet = _getSheet_();
    var row = [
      new Date(),
      _sanitize_(data.receivedAt, 64),
      clientTs,
      date,
      _sanitize_(data.sessionId, 64),
      userName,
      _sanitize_(data.sourcePage, 200),
      _sanitize_(data.language, 8),
      eventType,
      data.readiness == null ? "" : Number(data.readiness),
      isFinite(tasksCount) ? tasksCount : "",
      isFinite(doneCount) ? doneCount : "",
      isFinite(scheduledCount) ? scheduledCount : "",
      taskId,
      taskTitle,
      isFinite(difficulty) ? difficulty : "",
      isFinite(urgency) ? urgency : "",
      isFinite(duration) ? duration : "",
      routine,
      slotKey,
      isFinite(order) ? order : "",
      scheduledFor,
      planFact,
      feedbackScope,
      recommendationId,
      helpfulValue,
      _sanitize_(data.userAgent, 500),
      _sanitize_(data.ip, 64),
      _safeJson_(payload)
    ];
    sheet.appendRow(row.map(_cell_));

    // Дополнительная запись в нормализованную схему (Users/Days/...). Это
    // расширение поверх легаси-лога: если оно упадёт — легаси-строка уже
    // сохранена, и мы всё равно отвечаем ok:true.
    try {
      var participantId = _sanitize_(data.participantId, 40) || userName;
      _recordNormalized_({
        eventType: eventType,
        date: date,
        participantId: participantId,
        userName: userName,
        timestamp: clientTs,
        readiness: data.readiness
      }, payload, null);
    } catch (normErr) {
      Logger.log("normalized write failed: " + (normErr && normErr.message ? normErr.message : normErr));
    }

    return _jsonOutput_({ ok: true });
  } catch (err) {
    Logger.log("doPost failed: " + String(err && err.message ? err.message : err));
    return _jsonOutput_({ ok: false, error: "internal_error" });
  }
}

function setup() {
  var sheet = _getSheet_();
  _getUsersSheet_();
  _getDaysSheet_();
  _getMorningCheckinSheet_();
  _getEveningCheckinSheet_();
  _getTasksSheet_();
  _getRecommendationsSheet_();
  _getPlanRunsSheet_();
  _getPlanItemsSheet_();
  _ensureCatalogSeeded_();
  Logger.log("Planner database ready: " + sheet.getName() + " with " + sheet.getLastRow() + " rows.");
}

/* ============================================================================
 * PlannerSchema — чистая логика реляционной модели.
 * 1:1 транскрипция lib/planner-schema.js. НЕ содержит вызовов SpreadsheetApp —
 * при изменении сверяйтесь с тестами test/planner-schema.test.js.
 * ========================================================================= */

var SHEET_COLUMNS = {
  Users: ["user_id", "first_seen_at", "last_seen_at", "sessions_count"],
  Days: [
    "day_id",
    "user_id",
    "date",
    "morning_checkin_id",
    "evening_checkin_id",
    "morning_recommendation_id",
    "evening_recommendation_id",
    "completion_percent",
    "created_at",
    "updated_at"
  ],
  Morning_Checkin: [
    "morning_checkin_id",
    "day_id",
    "sleep_hours",
    "sleep_quality",
    "energy",
    "stress",
    "readiness",
    "day_state",
    "day_sub_state",
    "primary_issue",
    "note",
    "created_at"
  ],
  Evening_Checkin: [
    "evening_checkin_id",
    "day_id",
    "fatigue",
    "plan_overload",
    "procrastination",
    "start_difficulty",
    "detachment",
    "completed_tasks",
    "total_tasks",
    "note",
    "created_at"
  ],
  Tasks: [
    "task_id",
    "day_id",
    "task_name",
    "difficulty",
    "urgency",
    "planned_minutes",
    "routine",
    "slot_key",
    "order",
    "status",
    "completed",
    "completion_time",
    "scheduled_for",
    "source",
    "embed_id",
    "created_at",
    "updated_at"
  ],
  Recommendations: [
    "recommendation_id",
    "day_id",
    "scope",
    "card_id",
    "recommendation_text",
    "matrix_version",
    "helpful",
    "feedback_at",
    "created_at"
  ],
  Plan_Runs: [
    "plan_run_id",
    "day_id",
    "user_id",
    "generated_at",
    "readiness",
    "input_task_count",
    "kept_task_count",
    "moved_to_scheduled_count",
    "recommendation_task_count",
    "scheduled_snapshot_count"
  ],
  Plan_Items: [
    "plan_item_id",
    "plan_run_id",
    "day_id",
    "task_id",
    "task_name",
    "source",
    "decision",
    "slot_key",
    "order",
    "difficulty",
    "urgency",
    "planned_minutes",
    "completed_at_generation",
    "completed",
    "completion_time",
    "created_at"
  ],
  Recommendations_Catalog: ["card_id", "scope", "kind", "title"]
};

// TASK_STATUS_BY_EVENT: null означает "не менять текущий статус задачи".
var TASK_STATUS_BY_EVENT = {
  task_created: "active",
  task_edited: null,
  task_toggled: null,
  task_deleted: "deleted",
  task_reordered: null,
  scheduled_added: "scheduled",
  scheduled_restored: "active",
  scheduled_deleted: "deleted"
};

function buildDayId(userId, date) {
  return String(userId || "") + "::" + String(date || "");
}

function buildRecommendationId(dayId, scope) {
  return String(dayId || "") + "::" + String(scope || "");
}

function buildPlanRunId(dayId, generatedAt, explicitId) {
  if (explicitId) return String(explicitId);
  return String(dayId || "") + "::plan::" + String(generatedAt || "");
}

function isRecommendationPlanTask(task) {
  return !!(task && (task.recommendationId || task.source === "embed_suggestion"));
}

function buildPlanRunRows(dayId, userId, payload, generatedAt) {
  payload = payload || {};
  var kept = Array.isArray(payload.tasks) ? payload.tasks : [];
  var scheduled = Array.isArray(payload.scheduled) ? payload.scheduled : [];
  var movedIds = Array.isArray(payload.movedTaskIds)
    ? payload.movedTaskIds.map(String)
    : [];

  // Совместимость со старым клиентом: distributeTasks добавляет только что
  // перенесённые задачи в конец scheduled, а payload содержит их количество.
  if (!movedIds.length) {
    var movedCount = Math.max(0, Number(payload.movedToScheduled) || 0);
    if (movedCount > 0) {
      movedIds = scheduled.slice(-movedCount).map(function (task) {
        return task && task.id ? String(task.id) : "";
      }).filter(Boolean);
    }
  }

  var scheduledById = {};
  scheduled.forEach(function (task) {
    if (task && task.id) scheduledById[String(task.id)] = task;
  });

  var planRunId = buildPlanRunId(dayId, generatedAt, payload.planRunId);
  var items = [];

  function addItem(task, decision) {
    if (!task || !task.id) return;
    var taskId = String(task.id);
    var isRecommendation = isRecommendationPlanTask(task);
    items.push({
      plan_item_id: planRunId + "::" + taskId,
      plan_run_id: planRunId,
      day_id: dayId,
      task_id: taskId,
      task_name: task.title || "",
      source: isRecommendation ? "embed_suggestion" : "manual",
      decision: decision,
      slot_key: task.slotKey || "",
      order: task.order == null ? "" : task.order,
      difficulty: task.difficulty == null ? "" : task.difficulty,
      urgency: task.urgency == null ? "" : task.urgency,
      planned_minutes: task.duration == null ? "" : task.duration,
      completed_at_generation: toBoolCell(!!task.done),
      completed: toBoolCell(!!task.done),
      completion_time: "",
      created_at: generatedAt
    });
  }

  kept.forEach(function (task) { addItem(task, "kept"); });
  movedIds.forEach(function (taskId) {
    addItem(scheduledById[taskId] || { id: taskId }, "postponed");
  });

  return {
    run: {
      plan_run_id: planRunId,
      day_id: dayId,
      user_id: userId,
      generated_at: generatedAt,
      readiness: payload.readiness == null ? "" : payload.readiness,
      input_task_count: kept.length + movedIds.length,
      kept_task_count: kept.length,
      moved_to_scheduled_count: movedIds.length,
      recommendation_task_count: kept.filter(isRecommendationPlanTask).length,
      scheduled_snapshot_count: scheduled.length
    },
    items: items
  };
}

function toBoolCell(value) {
  if (value === true) return "TRUE";
  if (value === false) return "FALSE";
  if (value === "true") return "TRUE";
  if (value === "false") return "FALSE";
  return "";
}

function compactPatch(patch) {
  var out = {};
  Object.keys(patch || {}).forEach(function (key) {
    if (patch[key] !== undefined) out[key] = patch[key];
  });
  return out;
}

function statusForEvent(eventType) {
  if (!Object.prototype.hasOwnProperty.call(TASK_STATUS_BY_EVENT, eventType)) return null;
  return TASK_STATUS_BY_EVENT[eventType];
}

function upsertMerge(existing, defaults, patch, nowIso) {
  var base = existing ? Object.assign({}, defaults, existing) : Object.assign({}, defaults);
  var merged = Object.assign({}, base, compactPatch(patch));
  if (!merged.created_at) merged.created_at = nowIso;
  if (Object.prototype.hasOwnProperty.call(defaults, "updated_at")) merged.updated_at = nowIso;
  return merged;
}

function mergeUserRow(existing, userId, nowIso) {
  var sessionsCount = (existing && Number(existing.sessions_count)) || 0;
  return {
    user_id: userId,
    first_seen_at: (existing && existing.first_seen_at) || nowIso,
    last_seen_at: nowIso,
    sessions_count: sessionsCount + 1
  };
}

function mergeDaysRow(existing, dayId, patch, nowIso) {
  var defaults = {
    day_id: dayId,
    user_id: "",
    date: "",
    morning_checkin_id: "",
    evening_checkin_id: "",
    morning_recommendation_id: "",
    evening_recommendation_id: "",
    completion_percent: "",
    created_at: "",
    updated_at: ""
  };
  var merged = upsertMerge(existing, defaults, patch, nowIso);
  merged.day_id = dayId;
  return merged;
}

function mergeMorningCheckinRow(existing, dayId, patch, nowIso) {
  var defaults = {
    morning_checkin_id: dayId,
    day_id: dayId,
    sleep_hours: "",
    sleep_quality: "",
    energy: "",
    stress: "",
    readiness: "",
    day_state: "",
    day_sub_state: "",
    primary_issue: "",
    note: "",
    created_at: ""
  };
  var merged = upsertMerge(existing, defaults, patch, nowIso);
  merged.morning_checkin_id = dayId;
  merged.day_id = dayId;
  return merged;
}

function mergeEveningCheckinRow(existing, dayId, patch, nowIso) {
  var defaults = {
    evening_checkin_id: dayId,
    day_id: dayId,
    fatigue: "",
    plan_overload: "",
    procrastination: "",
    start_difficulty: "",
    detachment: "",
    completed_tasks: "",
    total_tasks: "",
    note: "",
    created_at: ""
  };
  var merged = upsertMerge(existing, defaults, patch, nowIso);
  merged.evening_checkin_id = dayId;
  merged.day_id = dayId;
  return merged;
}

function mergeTaskRow(existing, taskId, dayId, patch, nowIso) {
  var defaults = {
    task_id: taskId,
    day_id: dayId,
    task_name: "",
    difficulty: "",
    urgency: "",
    planned_minutes: "",
    routine: "",
    slot_key: "",
    order: "",
    status: "active",
    completed: "FALSE",
    completion_time: "",
    scheduled_for: "",
    source: "manual",
    embed_id: "",
    created_at: "",
    updated_at: ""
  };
  var merged = upsertMerge(existing, defaults, patch, nowIso);
  merged.task_id = taskId;
  merged.day_id = dayId;
  return merged;
}

function mergeRecommendationRow(existing, recommendationId, dayId, scope, patch, nowIso) {
  var defaults = {
    recommendation_id: recommendationId,
    day_id: dayId,
    scope: scope,
    card_id: "",
    recommendation_text: "",
    matrix_version: "",
    helpful: "",
    feedback_at: "",
    created_at: ""
  };
  var merged = upsertMerge(existing, defaults, patch, nowIso);
  merged.recommendation_id = recommendationId;
  merged.day_id = dayId;
  merged.scope = scope;
  return merged;
}

function buildMorningCheckinPatch(payload) {
  payload = payload || {};
  var dayState = payload.dayState || {};
  return compactPatch({
    sleep_hours: payload.sleepHours,
    sleep_quality: payload.sleepQuality,
    energy: payload.energy,
    stress: payload.stress,
    readiness: payload.readiness,
    day_state: dayState.state,
    day_sub_state: dayState.sub_state || "",
    primary_issue: dayState.primary_issue || "",
    note: payload.note || ""
  });
}

function buildEveningCheckinPatch(payload) {
  payload = payload || {};
  return compactPatch({
    fatigue: payload.fatigue,
    plan_overload: payload.planOverload,
    start_difficulty: payload.taskStart,
    detachment: payload.detachment,
    completed_tasks: payload.completed,
    total_tasks: payload.total,
    note: payload.note || ""
  });
}

function taskIdFromPayload(payload) {
  payload = payload || {};
  return payload.id || payload.taskId || "";
}

function buildTaskPatch(eventType, payload, nowIso) {
  payload = payload || {};
  var status = statusForEvent(eventType);
  var patch = {
    task_name: payload.title,
    difficulty: payload.difficulty,
    urgency: payload.urgency,
    planned_minutes: payload.duration,
    routine: payload.routine === undefined ? undefined : toBoolCell(!!payload.routine),
    slot_key: payload.slotKey,
    order: payload.order,
    scheduled_for: payload.scheduledFor
  };
  if (status !== null) patch.status = status;
  if (eventType === "task_toggled") {
    patch.completed = toBoolCell(!!payload.done);
    patch.completion_time = payload.done ? nowIso : "";
  }
  return compactPatch(patch);
}

function buildTaskPatchesFromPlanGenerated(payload) {
  payload = payload || {};
  var out = [];
  (payload.tasks || []).forEach(function (task) {
    if (!task || !task.id) return;
    out.push({
      taskId: task.id,
      status: "active",
      patch: compactPatch({
        task_name: task.title,
        difficulty: task.difficulty,
        urgency: task.urgency,
        planned_minutes: task.duration,
        routine: toBoolCell(!!task.routine),
        slot_key: task.slotKey,
        order: task.order,
        status: "active",
        completed: toBoolCell(!!task.done)
      })
    });
  });
  (payload.scheduled || []).forEach(function (task) {
    if (!task || !task.id) return;
    out.push({
      taskId: task.id,
      status: "scheduled",
      patch: compactPatch({
        task_name: task.title,
        difficulty: task.difficulty,
        urgency: task.urgency,
        planned_minutes: task.duration,
        routine: toBoolCell(!!task.routine),
        scheduled_for: task.scheduledFor,
        status: "scheduled"
      })
    });
  });
  return out;
}

function buildEmbedTaskPatch(payload, nowIso) {
  payload = payload || {};
  var patch = buildTaskPatch("task_created", payload, nowIso);
  patch.source = "embed_suggestion";
  patch.embed_id = payload.embedId || "";
  return patch;
}

function recommendationCardId(payload) {
  payload = payload || {};
  return payload.card_id || payload.decision_key || "";
}

function buildRecommendationPatch(eventType, payload, nowIso) {
  payload = payload || {};
  if (eventType === "card_feedback") {
    return compactPatch({
      card_id: recommendationCardId(payload) || undefined,
      helpful: toBoolCell(payload.helpful),
      feedback_at: nowIso
    });
  }
  if (eventType === "morning_recommendation_shown" || eventType === "evening_recommendation_shown") {
    return compactPatch({
      card_id: recommendationCardId(payload),
      recommendation_text: payload.text || payload.narrative || "",
      matrix_version: payload.matrix_version || ""
    });
  }
  if (eventType === "evening_checkout") {
    return compactPatch({
      card_id: recommendationCardId(payload) || undefined
    });
  }
  return {};
}

function objectToRowArray(columns, obj) {
  obj = obj || {};
  return columns.map(function (key) {
    var value = obj[key];
    return value === undefined || value === null ? "" : value;
  });
}

function rowArrayToObject(columns, rowArray) {
  var obj = {};
  columns.forEach(function (key, i) {
    obj[key] = rowArray && rowArray.length > i ? rowArray[i] : "";
  });
  return obj;
}

// Справочник card_id → название, сгенерирован из JSON-матриц:
// npm run recommendations-catalog (см. scripts/generate-recommendations-catalog.js).
// Сидируется один раз при создании листа Recommendations_Catalog.
var RECOMMENDATIONS_CATALOG_SEED = [
  ["emergency_recovery", "morning", "card", "Восстановление"],
  ["plateau", "morning", "card", "Плато"],
  ["growth", "morning", "card", "Рост"],
  ["growth:sleep_hours", "morning", "card", "Рост — сон (длительность)"],
  ["growth:sleep_quality", "morning", "card", "Рост — качество сна"],
  ["growth:stress", "morning", "card", "Рост — стресс"],
  ["growth:energy", "morning", "card", "Рост — энергия"],
  ["single_issue", "morning", "card", "Одна проблема"],
  ["single_issue:stress", "morning", "card", "Одна проблема — стресс"],
  ["single_issue:sleep_hours", "morning", "card", "Одна проблема — сон (длительность)"],
  ["single_issue:sleep_quality", "morning", "card", "Одна проблема — качество сна"],
  ["single_issue:energy", "morning", "card", "Одна проблема — энергия"],
  ["high", "morning", "card", "Высокий ресурс"],
  ["high:sleep_tune", "morning", "card", "Высокий ресурс — подтянуть сон"],
  ["evening_wind_down", "morning", "embed", "Лечь на 30–40 мин раньше"],
  ["evening_tune_walk", "morning", "embed", "15 минут прогулки перед сном"],
  ["evening_tune_sleep", "morning", "embed", "Лечь на 15 минут раньше"],
  ["phone_away", "morning", "embed", "Отложить телефон · 15–20 мин без экрана"],
  ["walk_reset", "morning", "embed", "20 минут прогулки без телефона"],
  ["breathing_pause", "morning", "embed", "10–15 минут снижения напряжения"],
  ["tiny_first_step", "morning", "embed", "Завтра первым — шаг на 5–10 минут"],
  ["fatigue_high", "evening", "card", "Усталость к вечеру"],
  ["detachment_low", "evening", "card", "Работа не отпускает"],
  ["start_hard", "evening", "card", "Трудно было начать"],
  ["completion_high", "evening", "card", "Хороший день"],
  ["completion_low", "evening", "card", "План не сошёлся"],
  ["completion_mid", "evening", "card", "Обычный день"],
  ["evening_early_sleep", "evening", "embed", "Лечь спать раньше"],
  ["evening_phone_away", "evening", "embed", "15 минут без телефона"],
  ["evening_tiny_start", "evening", "embed", "Определи первый шаг"]
];

/* ============================================================================
 * Sheets glue — чтение/запись листов нормализованной схемы.
 * ========================================================================= */

function _getNormalizedSheet_(name, columns) {
  var ss = _getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, columns.length);
  }
  return sheet;
}

function _getUsersSheet_() { return _getNormalizedSheet_("Users", SHEET_COLUMNS.Users); }
function _getDaysSheet_() { return _getNormalizedSheet_("Days", SHEET_COLUMNS.Days); }
function _getMorningCheckinSheet_() { return _getNormalizedSheet_("Morning_Checkin", SHEET_COLUMNS.Morning_Checkin); }
function _getEveningCheckinSheet_() {
  var sheet = _getNormalizedSheet_("Evening_Checkin", SHEET_COLUMNS.Evening_Checkin);
  // Сохраняем старые тестовые значения procrastination и добавляем новый
  // показатель отдельной колонкой, чтобы не переименовать исторические данные.
  if (String(sheet.getRange(1, 4).getValue() || "").trim() === "procrastination") {
    sheet.insertColumnBefore(4);
    sheet.getRange(1, 4).setValue("plan_overload");
    sheet.getRange(1, 1, 1, SHEET_COLUMNS.Evening_Checkin.length).setFontWeight("bold");
  }
  return sheet;
}
function _getTasksSheet_() { return _getNormalizedSheet_("Tasks", SHEET_COLUMNS.Tasks); }
function _getRecommendationsSheet_() { return _getNormalizedSheet_("Recommendations", SHEET_COLUMNS.Recommendations); }
function _getPlanRunsSheet_() { return _getNormalizedSheet_("Plan_Runs", SHEET_COLUMNS.Plan_Runs); }
function _getPlanItemsSheet_() { return _getNormalizedSheet_("Plan_Items", SHEET_COLUMNS.Plan_Items); }

function _getCatalogSheet_() {
  var sheet = _getNormalizedSheet_("Recommendations_Catalog", SHEET_COLUMNS.Recommendations_Catalog);
  if (sheet.getLastRow() < 2 && RECOMMENDATIONS_CATALOG_SEED.length) {
    sheet.getRange(2, 1, RECOMMENDATIONS_CATALOG_SEED.length, SHEET_COLUMNS.Recommendations_Catalog.length)
      .setValues(RECOMMENDATIONS_CATALOG_SEED);
  }
  return sheet;
}

function _findRowIndexByKey_(sheet, columns, keyColumn, keyValue) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var keyColIndex = columns.indexOf(keyColumn);
  if (keyColIndex === -1) return -1;
  var values = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(keyValue)) return i + 2;
  }
  return -1;
}

function _readRowObject_(sheet, columns, rowIndex) {
  var values = sheet.getRange(rowIndex, 1, 1, columns.length).getValues()[0];
  return rowArrayToObject(columns, values);
}

// Читает существующую строку по ключу (если есть), прогоняет через mergeFn,
// затем перезаписывает строку или добавляет новую. mergeFn(existingOrNull) → objRow.
function _upsertRow_(sheet, columns, keyColumn, keyValue, mergeFn) {
  var rowIndex = _findRowIndexByKey_(sheet, columns, keyColumn, keyValue);
  var existing = rowIndex === -1 ? null : _readRowObject_(sheet, columns, rowIndex);
  var merged = mergeFn(existing);
  var rowArray = objectToRowArray(columns, merged).map(_cell_);
  if (rowIndex === -1) {
    sheet.appendRow(rowArray);
  } else {
    sheet.getRange(rowIndex, 1, 1, columns.length).setValues([rowArray]);
  }
  return merged;
}

/* ============================================================================
 * Диспетчер: событие → обновления в Users/Days/Morning_Checkin/Evening_Checkin
 * /Tasks/Recommendations. Используется и живой записью (doPost), и разовой
 * миграцией (migrateLegacyEvents) — поэтому логика гарантированно одна и та же.
 * ========================================================================= */

function _touchUser_(userId, nowIso) {
  _upsertRow_(_getUsersSheet_(), SHEET_COLUMNS.Users, "user_id", userId, function (existing) {
    return mergeUserRow(existing, userId, nowIso);
  });
}

function _ensureDay_(dayId, userId, date, nowIso) {
  _upsertRow_(_getDaysSheet_(), SHEET_COLUMNS.Days, "day_id", dayId, function (existing) {
    return mergeDaysRow(existing, dayId, { user_id: userId, date: date }, nowIso);
  });
}

function _applyMorningCheckin_(dayId, payload, nowIso) {
  var patch = buildMorningCheckinPatch(payload);
  _upsertRow_(_getMorningCheckinSheet_(), SHEET_COLUMNS.Morning_Checkin, "day_id", dayId, function (existing) {
    return mergeMorningCheckinRow(existing, dayId, patch, nowIso);
  });
  _upsertRow_(_getDaysSheet_(), SHEET_COLUMNS.Days, "day_id", dayId, function (existing) {
    return mergeDaysRow(existing, dayId, { morning_checkin_id: dayId }, nowIso);
  });
}

function _applyEveningCheckout_(dayId, payload, nowIso) {
  var checkinPatch = buildEveningCheckinPatch(payload);
  _upsertRow_(_getEveningCheckinSheet_(), SHEET_COLUMNS.Evening_Checkin, "day_id", dayId, function (existing) {
    return mergeEveningCheckinRow(existing, dayId, checkinPatch, nowIso);
  });

  var daysPatch = {
    evening_checkin_id: dayId,
    completion_percent: payload && payload.completionRate != null ? payload.completionRate : undefined
  };

  var cardId = recommendationCardId(payload);
  if (cardId) {
    var recId = buildRecommendationId(dayId, "evening");
    _upsertRow_(_getRecommendationsSheet_(), SHEET_COLUMNS.Recommendations, "recommendation_id", recId, function (existing) {
      return mergeRecommendationRow(existing, recId, dayId, "evening", buildRecommendationPatch("evening_checkout", payload, nowIso), nowIso);
    });
    daysPatch.evening_recommendation_id = recId;
  }

  _upsertRow_(_getDaysSheet_(), SHEET_COLUMNS.Days, "day_id", dayId, function (existing) {
    return mergeDaysRow(existing, dayId, daysPatch, nowIso);
  });
}

function _applyTaskEvent_(eventType, dayId, payload, nowIso) {
  var taskId = taskIdFromPayload(payload);
  if (!taskId) return;
  var patch = buildTaskPatch(eventType, payload, nowIso);
  _upsertRow_(_getTasksSheet_(), SHEET_COLUMNS.Tasks, "task_id", taskId, function (existing) {
    return mergeTaskRow(existing, taskId, dayId, patch, nowIso);
  });
  if (eventType === "task_toggled") {
    _updatePlanItemsCompletion_(taskId, !!(payload && payload.done), nowIso);
  }
}

function _updatePlanItemsCompletion_(taskId, done, nowIso) {
  var sheet = _getPlanItemsSheet_();
  var columns = SHEET_COLUMNS.Plan_Items;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var taskIdColumn = columns.indexOf("task_id") + 1;
  var completedColumn = columns.indexOf("completed") + 1;
  var completionTimeColumn = columns.indexOf("completion_time") + 1;
  var taskIds = sheet.getRange(2, taskIdColumn, lastRow - 1, 1).getValues();

  for (var i = 0; i < taskIds.length; i++) {
    if (String(taskIds[i][0]) !== String(taskId)) continue;
    var row = i + 2;
    sheet.getRange(row, completedColumn).setValue(toBoolCell(done));
    sheet.getRange(row, completionTimeColumn).setValue(done ? nowIso : "");
  }
}

function _applyPlanGenerated_(dayId, userId, payload, nowIso) {
  var patches = buildTaskPatchesFromPlanGenerated(payload);
  patches.forEach(function (item) {
    _upsertRow_(_getTasksSheet_(), SHEET_COLUMNS.Tasks, "task_id", item.taskId, function (existing) {
      return mergeTaskRow(existing, item.taskId, dayId, item.patch, nowIso);
    });
  });

  var snapshot = buildPlanRunRows(dayId, userId, payload, nowIso);
  _upsertRow_(
    _getPlanRunsSheet_(),
    SHEET_COLUMNS.Plan_Runs,
    "plan_run_id",
    snapshot.run.plan_run_id,
    function () { return snapshot.run; }
  );

  snapshot.items.forEach(function (item) {
    _upsertRow_(
      _getPlanItemsSheet_(),
      SHEET_COLUMNS.Plan_Items,
      "plan_item_id",
      item.plan_item_id,
      function () { return item; }
    );
  });
}

function _applyEmbedAdded_(dayId, payload, nowIso) {
  var taskId = taskIdFromPayload(payload);
  if (!taskId) return;
  var patch = buildEmbedTaskPatch(payload, nowIso);
  _upsertRow_(_getTasksSheet_(), SHEET_COLUMNS.Tasks, "task_id", taskId, function (existing) {
    return mergeTaskRow(existing, taskId, dayId, patch, nowIso);
  });
}

function _applyRecommendationEvent_(eventType, dayId, scope, payload, nowIso) {
  var recId = buildRecommendationId(dayId, scope);
  var patch = buildRecommendationPatch(eventType, payload, nowIso);
  _upsertRow_(_getRecommendationsSheet_(), SHEET_COLUMNS.Recommendations, "recommendation_id", recId, function (existing) {
    return mergeRecommendationRow(existing, recId, dayId, scope, patch, nowIso);
  });

  var daysPatchKey = scope === "morning" ? "morning_recommendation_id" : "evening_recommendation_id";
  var daysPatch = {};
  daysPatch[daysPatchKey] = recId;
  _upsertRow_(_getDaysSheet_(), SHEET_COLUMNS.Days, "day_id", dayId, function (existing) {
    return mergeDaysRow(existing, dayId, daysPatch, nowIso);
  });
}

function _applyCardFeedback_(dayId, payload, nowIso) {
  var scope = _sanitize_(payload && payload.scope, 16);
  if (scope !== "morning" && scope !== "evening") return;
  _applyRecommendationEvent_("card_feedback", dayId, scope, payload, nowIso);
}

// Обеспечивает наличие листа Recommendations_Catalog (и его сидирование) при
// первом запуске без необходимости отдельного ручного шага.
function _ensureCatalogSeeded_() {
  _getCatalogSheet_();
}

function _recordNormalized_(data, payload, nowIsoOverride) {
  var eventType = data.eventType;
  var userId = _sanitize_(data.participantId || data.userName, 40);
  var date = _sanitize_(data.date, 32);
  if (!userId || !date || userId === "anonymous") return;

  var nowIso = nowIsoOverride || _sanitize_(data.timestamp, 64) || new Date().toISOString();

  _ensureCatalogSeeded_();
  _touchUser_(userId, nowIso);
  var dayId = buildDayId(userId, date);
  _ensureDay_(dayId, userId, date, nowIso);

  switch (eventType) {
    case "morning_checkin":
      _applyMorningCheckin_(dayId, Object.assign({}, payload, { readiness: data.readiness }), nowIso);
      break;
    case "evening_checkout":
      _applyEveningCheckout_(dayId, payload, nowIso);
      break;
    case "task_created":
    case "task_edited":
    case "task_toggled":
    case "task_deleted":
    case "task_reordered":
    case "scheduled_added":
    case "scheduled_restored":
    case "scheduled_deleted":
      _applyTaskEvent_(eventType, dayId, payload, nowIso);
      break;
    case "plan_generated":
      _applyPlanGenerated_(dayId, userId, payload, nowIso);
      break;
    case "morning_embed_added":
    case "evening_embed_added":
      _applyEmbedAdded_(dayId, payload, nowIso);
      break;
    case "card_feedback":
      _applyCardFeedback_(dayId, payload, nowIso);
      break;
    case "morning_recommendation_shown":
      _applyRecommendationEvent_(eventType, dayId, "morning", payload, nowIso);
      break;
    case "evening_recommendation_shown":
      _applyRecommendationEvent_(eventType, dayId, "evening", payload, nowIso);
      break;
    default:
      // routine_activated и прочее — фиксируются только в PlannerEvents, как раньше.
      break;
  }
}

/* ============================================================================
 * Разовая миграция истории из PlannerEvents в нормализованную схему.
 *
 * Запускать ВРУЧНУЮ из редактора Apps Script (выбрать функцию
 * migrateLegacyEvents → Run) ОДИН РАЗ после деплоя этой версии скрипта.
 * Безопасно запускать повторно — вся логика идёт через upsert по
 * детерминированным ключам (day_id/task_id/recommendation_id), повторный
 * запуск просто переприменит те же значения.
 * ========================================================================= */

function _cellToIso_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }
  var s = String(value).trim();
  if (!s) return "";
  var d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function migrateLegacyEvents() {
  var sheet = _getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("PlannerEvents: нет строк для миграции.");
    return;
  }

  var COL = {
    serverTimestamp: 0,
    clientTimestamp: 2,
    date: 3,
    userName: 5,
    eventType: 8,
    readiness: 9,
    rawPayload: 28
  };

  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var migrated = 0;
  var skipped = 0;

  rows.forEach(function (row) {
    var eventType = String(row[COL.eventType] || "").trim();
    var date = String(row[COL.date] || "").trim();
    var userName = String(row[COL.userName] || "").trim();

    if (!eventType || !ALLOWED_EVENTS[eventType] || !date || !userName || userName === "anonymous") {
      skipped++;
      return;
    }

    var payload = {};
    try {
      var raw = row[COL.rawPayload];
      payload = raw ? JSON.parse(raw) : {};
    } catch (_e) {
      payload = {};
    }

    var nowIso = _cellToIso_(row[COL.clientTimestamp]) || _cellToIso_(row[COL.serverTimestamp]) || new Date().toISOString();
    var readiness = row[COL.readiness];

    try {
      _recordNormalized_({
        eventType: eventType,
        date: date,
        participantId: userName,
        userName: userName,
        timestamp: nowIso,
        readiness: readiness
      }, payload, nowIso);
      migrated++;
    } catch (err) {
      Logger.log("migrateLegacyEvents: ошибка на строке (" + eventType + ", " + date + ", " + userName + "): " + err);
    }
  });

  Logger.log(
    "migrateLegacyEvents: перенесено " + migrated + ", пропущено " + skipped +
    " из " + rows.length + " строк PlannerEvents."
  );
}
