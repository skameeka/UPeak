"use strict";

// Проверяет, что чистая логика, транскрибированная в docs/CodeAPP.gs, не
// «расходится» с lib/planner-schema.js (единственным протестированным
// источником правды). Apps Script не поддерживает require(), поэтому логика
// скопирована вручную — этот тест страхует от дрейфа между файлами.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var schema = require("../lib/planner-schema");

var GS_PATH = path.join(__dirname, "..", "docs", "CodeAPP.gs");
var START_MARKER = "var SHEET_COLUMNS = {";
var END_MARKER = "/* ============================================================================\n * Sheets glue";

// Экспортируемые имена — те же ключи, что в module.exports lib/planner-schema.js.
var EXPORT_NAMES = [
  "SHEET_COLUMNS",
  "TASK_STATUS_BY_EVENT",
  "RECOMMENDATIONS_CATALOG_SEED",
  "buildDayId",
  "buildRecommendationId",
  "buildPlanRunId",
  "isRecommendationPlanTask",
  "buildPlanRunRows",
  "buildFeedbackRow",
  "toBoolCell",
  "compactPatch",
  "statusForEvent",
  "upsertMerge",
  "mergeUserRow",
  "mergeDaysRow",
  "mergeMorningCheckinRow",
  "mergeEveningCheckinRow",
  "mergeTaskRow",
  "mergeRecommendationRow",
  "buildMorningCheckinPatch",
  "buildEveningCheckinPatch",
  "taskIdFromPayload",
  "buildTaskPatch",
  "buildTaskPatchesFromPlanGenerated",
  "buildEmbedTaskPatch",
  "recommendationCardId",
  "buildRecommendationPatch",
  "objectToRowArray",
  "rowArrayToObject"
];

// Используем Function(...) (как scripts/generate-state-matrix.js), а не
// vm.createContext — последний создаёт отдельный realm, и структурно
// идентичные объекты/массивы из разных realms не проходят assert.deepEqual
// (Object.prototype отличается). Function(...) выполняется в текущем realm.
function loadGsPureLogic() {
  var source = fs.readFileSync(GS_PATH, "utf8");
  var startIdx = source.indexOf(START_MARKER);
  var endIdx = source.indexOf(END_MARKER);
  assert.ok(startIdx !== -1, "не нашли начало блока чистой логики в docs/CodeAPP.gs");
  assert.ok(endIdx !== -1 && endIdx > startIdx, "не нашли конец блока чистой логики в docs/CodeAPP.gs");

  var code = source.slice(startIdx, endIdx);
  var returnObj = "{ " + EXPORT_NAMES.map(function (name) { return name + ": " + name; }).join(", ") + " }";
  return new Function(code + "\nreturn " + returnObj + ";")();
}

var gs = loadGsPureLogic();
var NOW = "2026-07-14T10:00:00.000Z";

test("docs/CodeAPP.gs: SHEET_COLUMNS совпадает с lib/planner-schema.js", function () {
  assert.deepEqual(gs.SHEET_COLUMNS, schema.SHEET_COLUMNS);
});

test("docs/CodeAPP.gs: TASK_STATUS_BY_EVENT совпадает", function () {
  assert.deepEqual(gs.TASK_STATUS_BY_EVENT, schema.TASK_STATUS_BY_EVENT);
});

test("docs/CodeAPP.gs: RECOMMENDATIONS_CATALOG_SEED непустой и той же формы", function () {
  assert.ok(Array.isArray(gs.RECOMMENDATIONS_CATALOG_SEED));
  assert.ok(gs.RECOMMENDATIONS_CATALOG_SEED.length > 0);
  gs.RECOMMENDATIONS_CATALOG_SEED.forEach(function (row) {
    assert.equal(row.length, schema.SHEET_COLUMNS.Recommendations_Catalog.length);
  });
});

test("docs/CodeAPP.gs: buildDayId / buildRecommendationId идентичны", function () {
  assert.equal(gs.buildDayId("UP-1", "2026-07-14"), schema.buildDayId("UP-1", "2026-07-14"));
  var dayId = schema.buildDayId("UP-1", "2026-07-14");
  assert.equal(gs.buildRecommendationId(dayId, "evening"), schema.buildRecommendationId(dayId, "evening"));
});

test("docs/CodeAPP.gs: buildPlanRunRows идентичен", function () {
  var dayId = schema.buildDayId("UP-1", "2026-07-14");
  var payload = {
    planRunId: "plan-1",
    readiness: 72,
    movedToScheduled: 1,
    movedTaskIds: ["t2"],
    tasks: [
      { id: "t1", title: "Основная", slotKey: "morningFocus", order: 0, difficulty: 4, urgency: 5, duration: 60 },
      { id: "r1", title: "Прогулка", recommendationId: "morning:walk", slotKey: "eveningLight", order: 1 }
    ],
    scheduled: [{ id: "t2", title: "Перенесённая", difficulty: 3, urgency: 2, duration: 90 }]
  };
  assert.deepEqual(
    gs.buildPlanRunRows(dayId, "UP-1", payload, NOW),
    schema.buildPlanRunRows(dayId, "UP-1", payload, NOW)
  );
});

test("docs/CodeAPP.gs: buildFeedbackRow идентичен", function () {
  var payload = {
    productUsefulness: 4,
    stateUnderstandingHelp: "yes",
    planningHelp: "partially",
    continueUsing: "no",
    mostUseful: "Рекомендации по нагрузке",
    improvements: "Больше гибкости",
    missingIfRemoved: "Утренний чек-ин"
  };
  assert.deepEqual(
    gs.buildFeedbackRow("UP-1", payload, NOW),
    schema.buildFeedbackRow("UP-1", payload, NOW)
  );
  assert.deepEqual(gs.buildFeedbackRow("UP-1", null, NOW), schema.buildFeedbackRow("UP-1", null, NOW));
});

test("docs/CodeAPP.gs: toBoolCell / compactPatch / statusForEvent идентичны", function () {
  [true, false, "true", "false", undefined, null].forEach(function (v) {
    assert.equal(gs.toBoolCell(v), schema.toBoolCell(v));
  });
  var patch = { a: 1, b: undefined, c: "" };
  assert.deepEqual(gs.compactPatch(patch), schema.compactPatch(patch));
  ["task_created", "task_edited", "task_toggled", "task_deleted", "scheduled_added", "scheduled_restored", "scheduled_deleted", "unknown"].forEach(
    function (eventType) {
      assert.equal(gs.statusForEvent(eventType), schema.statusForEvent(eventType));
    }
  );
});

test("docs/CodeAPP.gs: mergeDaysRow / mergeTaskRow / mergeRecommendationRow ведут себя одинаково", function () {
  var dayId = schema.buildDayId("UP-1", "2026-07-14");

  var gsDay = gs.mergeDaysRow(null, dayId, { user_id: "UP-1", date: "2026-07-14" }, NOW);
  var schemaDay = schema.mergeDaysRow(null, dayId, { user_id: "UP-1", date: "2026-07-14" }, NOW);
  assert.deepEqual(gsDay, schemaDay);

  var gsTask = gs.mergeTaskRow(null, "t1", dayId, { task_name: "A", status: "active" }, NOW);
  var schemaTask = schema.mergeTaskRow(null, "t1", dayId, { task_name: "A", status: "active" }, NOW);
  assert.deepEqual(gsTask, schemaTask);

  var recId = schema.buildRecommendationId(dayId, "evening");
  var gsRec = gs.mergeRecommendationRow(null, recId, dayId, "evening", { card_id: "completion_high" }, NOW);
  var schemaRec = schema.mergeRecommendationRow(null, recId, dayId, "evening", { card_id: "completion_high" }, NOW);
  assert.deepEqual(gsRec, schemaRec);
});

test("docs/CodeAPP.gs: buildMorningCheckinPatch / buildEveningCheckinPatch совпадают", function () {
  var morningPayload = {
    sleepHours: 7,
    sleepQuality: 4,
    energy: 2,
    stress: 2,
    dayState: { state: "high_performance", sub_state: null, primary_issue: null }
  };
  assert.deepEqual(gs.buildMorningCheckinPatch(morningPayload), schema.buildMorningCheckinPatch(morningPayload));

  var eveningPayload = { fatigue: 4, taskStart: 2, planOverload: 5, detachment: 4, completed: 7, total: 10 };
  assert.deepEqual(gs.buildEveningCheckinPatch(eveningPayload), schema.buildEveningCheckinPatch(eveningPayload));
});

test("docs/CodeAPP.gs: buildTaskPatch / buildTaskPatchesFromPlanGenerated / buildEmbedTaskPatch совпадают", function () {
  var payload = { id: "t1", title: "A", difficulty: 3, urgency: 4, duration: 30, routine: false, slotKey: "dayOps", order: 1 };
  assert.deepEqual(gs.buildTaskPatch("task_created", payload, NOW), schema.buildTaskPatch("task_created", payload, NOW));
  assert.deepEqual(gs.buildTaskPatch("task_toggled", { id: "t1", done: true }, NOW), schema.buildTaskPatch("task_toggled", { id: "t1", done: true }, NOW));

  var planPayload = {
    tasks: [{ id: "t1", title: "A", done: false }],
    scheduled: [{ id: "t2", title: "B", scheduledFor: "2026-07-15" }]
  };
  assert.deepEqual(gs.buildTaskPatchesFromPlanGenerated(planPayload), schema.buildTaskPatchesFromPlanGenerated(planPayload));

  var embedPayload = { embedId: "evening_early_sleep", title: "Раньше ко сну", duration: 20, difficulty: 5, urgency: 5, slotKey: "eveningLight" };
  assert.deepEqual(gs.buildEmbedTaskPatch(embedPayload, NOW), schema.buildEmbedTaskPatch(embedPayload, NOW));
});

test("docs/CodeAPP.gs: buildRecommendationPatch совпадает для всех типов событий", function () {
  ["card_feedback", "morning_recommendation_shown", "evening_recommendation_shown", "evening_checkout"].forEach(
    function (eventType) {
      var payload = {
        card_id: "completion_high",
        decision_key: "completion_high",
        helpful: true,
        text: "текст карточки",
        matrix_version: "2.1-mvp"
      };
      assert.deepEqual(gs.buildRecommendationPatch(eventType, payload, NOW), schema.buildRecommendationPatch(eventType, payload, NOW));
    }
  );
});

test("docs/CodeAPP.gs: objectToRowArray / rowArrayToObject совпадают", function () {
  var columns = schema.SHEET_COLUMNS.Days;
  var obj = { day_id: "UP-1::2026-07-14", user_id: "UP-1", date: "2026-07-14", completion_percent: 80 };
  assert.deepEqual(gs.objectToRowArray(columns, obj), schema.objectToRowArray(columns, obj));

  var row = schema.objectToRowArray(columns, obj);
  assert.deepEqual(gs.rowArrayToObject(columns, row), schema.rowArrayToObject(columns, row));
});
