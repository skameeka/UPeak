"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var schema = require("../lib/planner-schema");

var NOW = "2026-07-14T10:00:00.000Z";

test("buildDayId: user_id + date, разделитель ::", function () {
  assert.equal(schema.buildDayId("UP-000007", "2026-07-14"), "UP-000007::2026-07-14");
});

test("buildRecommendationId: day_id + scope", function () {
  var dayId = schema.buildDayId("UP-000007", "2026-07-14");
  assert.equal(schema.buildRecommendationId(dayId, "evening"), dayId + "::evening");
});

test("buildPlanRunRows: сохраняет оставленные, перенесённые и рекомендованные задачи", function () {
  var dayId = schema.buildDayId("UP-000007", "2026-07-14");
  var snapshot = schema.buildPlanRunRows(dayId, "UP-000007", {
    planRunId: "plan-1",
    readiness: 72,
    movedToScheduled: 1,
    movedTaskIds: ["t2"],
    tasks: [
      { id: "t1", title: "Отчёт", slotKey: "morningFocus", order: 0, difficulty: 4, urgency: 5, duration: 60 },
      { id: "r1", title: "Прогулка", recommendationId: "morning:walk", slotKey: "eveningLight", order: 1, done: true }
    ],
    scheduled: [{ id: "t2", title: "Исследование", difficulty: 3, urgency: 2, duration: 90 }]
  }, NOW);

  assert.equal(snapshot.run.plan_run_id, "plan-1");
  assert.equal(snapshot.run.input_task_count, 3);
  assert.equal(snapshot.run.kept_task_count, 2);
  assert.equal(snapshot.run.moved_to_scheduled_count, 1);
  assert.equal(snapshot.run.recommendation_task_count, 1);
  assert.equal(snapshot.items.length, 3);
  assert.equal(snapshot.items.find(function (item) { return item.task_id === "t2"; }).decision, "postponed");
  assert.equal(snapshot.items.find(function (item) { return item.task_id === "r1"; }).source, "embed_suggestion");
  assert.equal(snapshot.items.find(function (item) { return item.task_id === "r1"; }).completed_at_generation, "TRUE");
});

test("buildPlanRunRows: старый payload определяет перенесённые задачи по хвосту scheduled", function () {
  var dayId = schema.buildDayId("UP-000007", "2026-07-14");
  var snapshot = schema.buildPlanRunRows(dayId, "UP-000007", {
    movedToScheduled: 1,
    tasks: [{ id: "t1", title: "Оставлена" }],
    scheduled: [
      { id: "old", title: "Была запланирована раньше" },
      { id: "moved", title: "Перенесена сейчас" }
    ]
  }, NOW);

  assert.equal(snapshot.items.length, 2);
  assert.equal(snapshot.items[1].task_id, "moved");
  assert.equal(snapshot.items[1].decision, "postponed");
});

test("buildFeedbackRow: собирает строку финального отзыва", function () {
  var row = schema.buildFeedbackRow("UP-000007", {
    productUsefulness: 5,
    stateUnderstandingHelp: "yes",
    planningHelp: "partially",
    continueUsing: "yes",
    mostUseful: "Распределение по состоянию",
    improvements: "Хочу мобильную версию",
    missingIfRemoved: "Вечерний итог"
  }, NOW);

  assert.deepEqual(row, {
    user_id: "UP-000007",
    timestamp: NOW,
    product_usefulness: 5,
    state_understanding_help: "yes",
    planning_help: "partially",
    continue_using: "yes",
    most_useful: "Распределение по состоянию",
    improvements: "Хочу мобильную версию",
    missing_if_removed: "Вечерний итог"
  });
});

test("buildFeedbackRow: пустой payload и обрезка длинного текста", function () {
  var empty = schema.buildFeedbackRow("UP-1", null, NOW);
  assert.equal(empty.product_usefulness, "");
  assert.equal(empty.most_useful, "");

  var long = schema.buildFeedbackRow("UP-1", { improvements: "x".repeat(2000) }, NOW);
  assert.equal(long.improvements.length, 1000);
});

test("toBoolCell: true/false/строки/undefined", function () {
  assert.equal(schema.toBoolCell(true), "TRUE");
  assert.equal(schema.toBoolCell(false), "FALSE");
  assert.equal(schema.toBoolCell("true"), "TRUE");
  assert.equal(schema.toBoolCell("false"), "FALSE");
  assert.equal(schema.toBoolCell(undefined), "");
  assert.equal(schema.toBoolCell(null), "");
});

test("compactPatch: убирает только undefined, оставляет пустые строки и false", function () {
  var out = schema.compactPatch({ a: 1, b: undefined, c: "", d: false, e: null });
  assert.deepEqual(out, { a: 1, c: "", d: false, e: null });
});

test("statusForEvent: маппинг событий задач на статус", function () {
  assert.equal(schema.statusForEvent("task_created"), "active");
  assert.equal(schema.statusForEvent("task_deleted"), "deleted");
  assert.equal(schema.statusForEvent("scheduled_added"), "scheduled");
  assert.equal(schema.statusForEvent("scheduled_restored"), "active");
  assert.equal(schema.statusForEvent("scheduled_deleted"), "deleted");
  assert.equal(schema.statusForEvent("task_edited"), null);
  assert.equal(schema.statusForEvent("task_toggled"), null);
  assert.equal(schema.statusForEvent("task_reordered"), null);
  assert.equal(schema.statusForEvent("unknown_event"), null);
});

test("upsertMerge: новая строка — created_at = now, старая — created_at сохраняется", function () {
  var fresh = schema.upsertMerge(null, { a: "", created_at: "", updated_at: "" }, { a: 1 }, NOW);
  assert.equal(fresh.created_at, NOW);
  assert.equal(fresh.updated_at, NOW);
  assert.equal(fresh.a, 1);

  var later = "2026-07-15T10:00:00.000Z";
  var existing = { a: 1, created_at: NOW, updated_at: NOW };
  var updated = schema.upsertMerge(existing, { a: "", created_at: "", updated_at: "" }, { a: 2 }, later);
  assert.equal(updated.created_at, NOW);
  assert.equal(updated.updated_at, later);
  assert.equal(updated.a, 2);
});

test("upsertMerge: patch с undefined не затирает существующее значение", function () {
  var existing = { a: 5, created_at: NOW, updated_at: NOW };
  var merged = schema.upsertMerge(existing, { a: "", created_at: "", updated_at: "" }, { a: undefined }, NOW);
  assert.equal(merged.a, 5);
});

test("mergeUserRow: первое появление и повторное увеличивают sessions_count", function () {
  var first = schema.mergeUserRow(null, "UP-000007", NOW);
  assert.equal(first.first_seen_at, NOW);
  assert.equal(first.last_seen_at, NOW);
  assert.equal(first.sessions_count, 1);

  var later = "2026-07-15T09:00:00.000Z";
  var second = schema.mergeUserRow(first, "UP-000007", later);
  assert.equal(second.first_seen_at, NOW);
  assert.equal(second.last_seen_at, later);
  assert.equal(second.sessions_count, 2);
});

test("mergeDaysRow: создаёт день и дополняет по частям (утро, потом вечер)", function () {
  var dayId = schema.buildDayId("UP-000007", "2026-07-14");
  var afterMorning = schema.mergeDaysRow(null, dayId, {
    user_id: "UP-000007",
    date: "2026-07-14",
    morning_checkin_id: dayId
  }, NOW);
  assert.equal(afterMorning.day_id, dayId);
  assert.equal(afterMorning.morning_checkin_id, dayId);
  assert.equal(afterMorning.evening_checkin_id, "");

  var later = "2026-07-14T20:00:00.000Z";
  var afterEvening = schema.mergeDaysRow(afterMorning, dayId, {
    evening_checkin_id: dayId,
    completion_percent: 80
  }, later);
  assert.equal(afterEvening.morning_checkin_id, dayId, "утренние поля не должны потеряться");
  assert.equal(afterEvening.evening_checkin_id, dayId);
  assert.equal(afterEvening.completion_percent, 80);
  assert.equal(afterEvening.created_at, NOW);
  assert.equal(afterEvening.updated_at, later);
});

test("buildMorningCheckinPatch: маппит payload формы в патч", function () {
  var patch = schema.buildMorningCheckinPatch({
    sleepHours: 7,
    sleepQuality: 4,
    energy: 2,
    stress: 2,
    dayState: { state: "high_performance", sub_state: null, primary_issue: null }
  });
  assert.deepEqual(patch, {
    sleep_hours: 7,
    sleep_quality: 4,
    energy: 2,
    stress: 2,
    day_state: "high_performance",
    day_sub_state: "",
    primary_issue: "",
    note: ""
  });
});

test("buildEveningCheckinPatch: маппит taskStart -> start_difficulty", function () {
  var patch = schema.buildEveningCheckinPatch({
    fatigue: 4,
    taskStart: 2,
    planOverload: 5,
    detachment: 4,
    completed: 7,
    total: 10
  });
  assert.equal(patch.start_difficulty, 2);
  assert.equal(patch.fatigue, 4);
  assert.equal(patch.plan_overload, 5);
  assert.equal(patch.procrastination, undefined);
  assert.equal(patch.completed_tasks, 7);
  assert.equal(patch.total_tasks, 10);
});

test("taskIdFromPayload: id или taskId", function () {
  assert.equal(schema.taskIdFromPayload({ id: "t1" }), "t1");
  assert.equal(schema.taskIdFromPayload({ taskId: "t2" }), "t2");
  assert.equal(schema.taskIdFromPayload({}), "");
});

test("buildTaskPatch: task_created задаёт status=active", function () {
  var patch = schema.buildTaskPatch("task_created", {
    id: "t1",
    title: "Написать отчёт",
    difficulty: 3,
    urgency: 4,
    duration: 30,
    routine: false,
    slotKey: "dayOps",
    order: 1
  }, NOW);
  assert.equal(patch.status, "active");
  assert.equal(patch.task_name, "Написать отчёт");
  assert.equal(patch.routine, "FALSE");
});

test("buildTaskPatch: task_toggled ставит completed и completion_time", function () {
  var done = schema.buildTaskPatch("task_toggled", { id: "t1", done: true }, NOW);
  assert.equal(done.completed, "TRUE");
  assert.equal(done.completion_time, NOW);
  assert.equal(done.status, undefined);

  var undone = schema.buildTaskPatch("task_toggled", { id: "t1", done: false }, NOW);
  assert.equal(undone.completed, "FALSE");
  assert.equal(undone.completion_time, "");
});

test("buildTaskPatch: task_deleted и scheduled_* меняют статус, не трогая остальное", function () {
  assert.equal(schema.buildTaskPatch("task_deleted", { id: "t1" }, NOW).status, "deleted");
  assert.equal(schema.buildTaskPatch("scheduled_added", { id: "t1" }, NOW).status, "scheduled");
  assert.equal(schema.buildTaskPatch("scheduled_restored", { id: "t1" }, NOW).status, "active");
  assert.equal(schema.buildTaskPatch("scheduled_deleted", { id: "t1" }, NOW).status, "deleted");
});

test("buildTaskPatch: task_edited/task_reordered не меняют статус", function () {
  assert.equal(schema.buildTaskPatch("task_edited", { id: "t1", title: "Новое" }, NOW).status, undefined);
  assert.equal(schema.buildTaskPatch("task_reordered", { id: "t1", order: 3 }, NOW).order, 3);
});

test("buildTaskPatchesFromPlanGenerated: активные и запланированные задачи", function () {
  var patches = schema.buildTaskPatchesFromPlanGenerated({
    tasks: [{ id: "t1", title: "A", done: false }],
    scheduled: [{ id: "t2", title: "B", scheduledFor: "2026-07-15" }]
  });
  assert.equal(patches.length, 2);
  assert.equal(patches[0].taskId, "t1");
  assert.equal(patches[0].status, "active");
  assert.equal(patches[1].taskId, "t2");
  assert.equal(patches[1].status, "scheduled");
  assert.equal(patches[1].patch.scheduled_for, "2026-07-15");
});

test("buildEmbedTaskPatch: помечает задачу как embed_suggestion и переносит поля таска", function () {
  var patch = schema.buildEmbedTaskPatch({
    embedId: "evening_early_sleep",
    title: "Раньше ко сну",
    duration: 20,
    difficulty: 5,
    urgency: 5,
    slotKey: "eveningLight"
  }, NOW);
  assert.equal(patch.source, "embed_suggestion");
  assert.equal(patch.embed_id, "evening_early_sleep");
  assert.equal(patch.status, "active");
  assert.equal(patch.task_name, "Раньше ко сну");
  assert.equal(patch.planned_minutes, 20);
  assert.equal(patch.slot_key, "eveningLight");
});

test("recommendationCardId: card_id приоритетнее decision_key", function () {
  assert.equal(schema.recommendationCardId({ card_id: "a", decision_key: "b" }), "a");
  assert.equal(schema.recommendationCardId({ decision_key: "b" }), "b");
  assert.equal(schema.recommendationCardId({}), "");
});

test("buildRecommendationPatch: card_feedback пишет helpful и feedback_at", function () {
  var patch = schema.buildRecommendationPatch("card_feedback", {
    card_id: "completion_high",
    helpful: true
  }, NOW);
  assert.equal(patch.card_id, "completion_high");
  assert.equal(patch.helpful, "TRUE");
  assert.equal(patch.feedback_at, NOW);
});

test("buildRecommendationPatch: *_recommendation_shown пишет текст и версию матрицы", function () {
  var patch = schema.buildRecommendationPatch("evening_recommendation_shown", {
    card_id: "fatigue_high",
    text: "Сегодня ты выполнил 70% плана...",
    matrix_version: "2.1-mvp"
  }, NOW);
  assert.equal(patch.card_id, "fatigue_high");
  assert.match(patch.recommendation_text, /70%/);
  assert.equal(patch.matrix_version, "2.1-mvp");
});

test("buildRecommendationPatch: evening_checkout только фиксирует card_id", function () {
  var patch = schema.buildRecommendationPatch("evening_checkout", { decision_key: "completion_low" }, NOW);
  assert.deepEqual(patch, { card_id: "completion_low" });
});

test("mergeTaskRow / mergeRecommendationRow: сохраняют created_at между обновлениями", function () {
  var dayId = schema.buildDayId("UP-1", "2026-07-14");
  var t1 = schema.mergeTaskRow(null, "task-a", dayId, { task_name: "A", status: "active" }, NOW);
  var t2 = schema.mergeTaskRow(t1, "task-a", dayId, { completed: "TRUE" }, "2026-07-14T12:00:00.000Z");
  assert.equal(t2.created_at, NOW);
  assert.equal(t2.task_name, "A");
  assert.equal(t2.completed, "TRUE");

  var recId = schema.buildRecommendationId(dayId, "evening");
  var r1 = schema.mergeRecommendationRow(null, recId, dayId, "evening", { card_id: "completion_high" }, NOW);
  var r2 = schema.mergeRecommendationRow(r1, recId, dayId, "evening", { helpful: "TRUE" }, "2026-07-14T21:00:00.000Z");
  assert.equal(r2.created_at, NOW);
  assert.equal(r2.card_id, "completion_high");
  assert.equal(r2.helpful, "TRUE");
});

test("objectToRowArray / rowArrayToObject: round-trip по колонкам Days", function () {
  var columns = schema.SHEET_COLUMNS.Days;
  var obj = {
    day_id: "UP-1::2026-07-14",
    user_id: "UP-1",
    date: "2026-07-14",
    completion_percent: 80
  };
  var row = schema.objectToRowArray(columns, obj);
  assert.equal(row.length, columns.length);
  assert.equal(row[columns.indexOf("completion_percent")], 80);
  assert.equal(row[columns.indexOf("evening_checkin_id")], "");

  var back = schema.rowArrayToObject(columns, row);
  assert.equal(back.day_id, obj.day_id);
  assert.equal(back.completion_percent, 80);
  assert.equal(back.evening_checkin_id, "");
});

test("SHEET_COLUMNS: все таблицы схемы объявлены", function () {
  ["Users", "Days", "Morning_Checkin", "Evening_Checkin", "Tasks", "Recommendations", "Recommendations_Catalog"].forEach(
    function (name) {
      assert.ok(Array.isArray(schema.SHEET_COLUMNS[name]) && schema.SHEET_COLUMNS[name].length > 0, name);
    }
  );
});
