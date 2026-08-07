"use strict";

// Чистая логика реляционной модели (Users → Days → Morning_Checkin /
// Evening_Checkin / Tasks / Recommendations) для планировщика.
//
// Этот файл тестируется через Node (test/planner-schema.test.js). Apps Script
// не поддерживает require(), поэтому та же логика транскрибирована вручную в
// docs/CodeAPP.gs — при изменении любой функции здесь нужно поправить и там
// (см. комментарий в начале docs/CodeAPP.gs).

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
  Feedback: [
    "user_id",
    "timestamp",
    "product_usefulness",
    "state_understanding_help",
    "planning_help",
    "continue_using",
    "most_useful",
    "improvements",
    "missing_if_removed"
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

function feedbackText(value) {
  return String(value == null ? "" : value).slice(0, 1000);
}

function buildFeedbackRow(userId, payload, timestamp) {
  payload = payload || {};
  return {
    user_id: String(userId || ""),
    timestamp: String(timestamp || ""),
    product_usefulness: payload.productUsefulness == null ? "" : Number(payload.productUsefulness),
    state_understanding_help: feedbackText(payload.stateUnderstandingHelp),
    planning_help: feedbackText(payload.planningHelp),
    continue_using: feedbackText(payload.continueUsing),
    most_useful: feedbackText(payload.mostUseful),
    improvements: feedbackText(payload.improvements),
    missing_if_removed: feedbackText(payload.missingIfRemoved)
  };
}

function toBoolCell(value) {
  if (value === true) return "TRUE";
  if (value === false) return "FALSE";
  if (value === "true") return "TRUE";
  if (value === "false") return "FALSE";
  return "";
}

// Убирает ключи со значением undefined, чтобы Object.assign при мёрдже не
// затирал существующее значение "пустотой" из payload, где поле не пришло.
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

// Универсальный upsert: existing (объект строки или null) + patch (частичные
// поля) → новый объект строки. created_at сохраняется из existing, если он
// был; updated_at всегда обновляется на nowIso.
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

// --- Патчи из payload конкретных событий ---

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

// plan_generated шлёт снимок всего дня целиком — используем его, чтобы
// подчистить несостыковки (например, если промежуточные события потерялись).
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

// --- Конвертация объект строки <-> массив ячеек для Google Sheets ---

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

module.exports = {
  SHEET_COLUMNS: SHEET_COLUMNS,
  TASK_STATUS_BY_EVENT: TASK_STATUS_BY_EVENT,
  buildDayId: buildDayId,
  buildRecommendationId: buildRecommendationId,
  buildPlanRunId: buildPlanRunId,
  isRecommendationPlanTask: isRecommendationPlanTask,
  buildPlanRunRows: buildPlanRunRows,
  buildFeedbackRow: buildFeedbackRow,
  toBoolCell: toBoolCell,
  compactPatch: compactPatch,
  statusForEvent: statusForEvent,
  upsertMerge: upsertMerge,
  mergeUserRow: mergeUserRow,
  mergeDaysRow: mergeDaysRow,
  mergeMorningCheckinRow: mergeMorningCheckinRow,
  mergeEveningCheckinRow: mergeEveningCheckinRow,
  mergeTaskRow: mergeTaskRow,
  mergeRecommendationRow: mergeRecommendationRow,
  buildMorningCheckinPatch: buildMorningCheckinPatch,
  buildEveningCheckinPatch: buildEveningCheckinPatch,
  taskIdFromPayload: taskIdFromPayload,
  buildTaskPatch: buildTaskPatch,
  buildTaskPatchesFromPlanGenerated: buildTaskPatchesFromPlanGenerated,
  buildEmbedTaskPatch: buildEmbedTaskPatch,
  recommendationCardId: recommendationCardId,
  buildRecommendationPatch: buildRecommendationPatch,
  objectToRowArray: objectToRowArray,
  rowArrayToObject: rowArrayToObject
};
