"use strict";

// Матрица решений — основной путь (см. day-recommendations.test.js). Здесь
// проверяем запасной путь composeCard: он работает, когда решения по состоянию
// нет (старый кэш матрицы, урезанный конфиг) и карточку собирают из матрицы
// рекомендаций и STATE_OVERRIDES.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var dayState = require("../lib/day-state");

var PUBLIC_DIR = path.join(__dirname, "..", "public");
var MODULE_PATH = path.join(PUBLIC_DIR, "day-recommendations.js");
var RECOMMENDATION_MATRIX = JSON.parse(
  fs.readFileSync(path.join(PUBLIC_DIR, "day-recommendation-matrix.json"), "utf8")
);

// Свежий экземпляр модуля на каждый тест: матрицы хранятся в замыкании, и
// общий require-кэш протащил бы состояние между проверками.
function loadModule(recommendationMatrix) {
  delete require.cache[require.resolve(MODULE_PATH)];
  require(MODULE_PATH);
  var dr = globalThis.UpeakDayRecommendations;
  if (recommendationMatrix !== undefined) dr.setRecommendationMatrix(recommendationMatrix);
  return dr;
}

function stateFromMetrics(sleep_hours, sleep_quality, energy, stress) {
  return dayState.computeDayStateFromMetrics({
    sleep_hours: sleep_hours,
    sleep_quality: sleep_quality,
    energy: energy,
    stress: stress
  });
}

test("resourceBandFromValue делит шкалу на min/medium/max", function () {
  var dr = loadModule();
  assert.equal(dr.resourceBandFromValue(1), "min");
  assert.equal(dr.resourceBandFromValue(2), "min");
  assert.equal(dr.resourceBandFromValue(3), "medium");
  assert.equal(dr.resourceBandFromValue(5), "max");
  // Нечисловое значение не должно уводить карточку в крайность.
  assert.equal(dr.resourceBandFromValue("нет"), "medium");
  assert.equal(dr.resourceBandFromValue(undefined), "medium");
});

test("matrixBandKey инвертирует шкалу для стресса", function () {
  var dr = loadModule();
  assert.equal(dr.matrixBandKey("sleep", "min"), "low");
  assert.equal(dr.matrixBandKey("sleep", "max"), "high");
  assert.equal(dr.matrixBandKey("energy", "medium"), "medium");
  // Мало ресурса по стрессу = высокий стресс.
  assert.equal(dr.matrixBandKey("stress", "min"), "high");
  assert.equal(dr.matrixBandKey("stress", "max"), "low");
  assert.equal(dr.matrixBandKey("stress", "medium"), "medium");
});

test("axisWorstValue берёт минимум по метрикам оси", function () {
  var dr = loadModule();
  var ds = stateFromMetrics(5, 2, 4, 3);
  assert.equal(dr.axisWorstValue(ds, "sleep"), 2);
  assert.equal(dr.axisWorstValue(ds, "energy"), 4);
  assert.equal(dr.axisWorstValue(ds, "stress"), 3);
  assert.equal(dr.axisWorstValue(ds, "unknown"), null);
  assert.equal(dr.axisWorstValue(null, "sleep"), null);
});

test("visibleBlocksFor откатывается к набору normal для неизвестного ключа", function () {
  var dr = loadModule();
  assert.deepEqual(dr.visibleBlocksFor("unknown_state"), ["today", "plan"]);
  assert.ok(dr.visibleBlocksFor("emergency_recovery").indexOf("consequence") !== -1);
  // Возвращается копия: правки вызывающего не портят общий конфиг.
  dr.visibleBlocksFor("normal").push("hacked");
  assert.deepEqual(dr.visibleBlocksFor("normal"), ["today", "plan"]);
});

test("flattenActions склеивает reduce и leverage без дублей", function () {
  var dr = loadModule();
  var actions = dr.flattenActions({
    reduce: ["Сократи список", "Сократи список", "Отложи несрочное"],
    leverage: ["Возьми сложное первым"]
  });
  assert.deepEqual(actions, ["Сократи список", "Отложи несрочное", "Возьми сложное первым"]);
  assert.deepEqual(dr.flattenActions(null), []);
  assert.equal(dr.flattenActions({ reduce: ["a", "b", "c", "d"] }, 2).length, 2);
});

test("resolveContentMapping выбирает фокусную метрику и её ось", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var single = stateFromMetrics(5, 5, 2, 5);
  var map = dr.resolveContentMapping(single);
  assert.equal(map.state, "single_issue");
  assert.equal(map.focus_metric, "energy");
  assert.equal(map.focus_axis, "energy");
  assert.equal(map.resource_band, "min");

  // Норма без пограничного под-состояния фокусируется на энергии по умолчанию.
  var normal = stateFromMetrics(4, 4, 3, 4);
  assert.equal(dr.resolveContentMapping(normal).focus_metric, dr.DEFAULT_FOCUS_METRIC);
});

test("buildTodaySummary перечисляет только заметные оси", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var ds = stateFromMetrics(5, 5, 2, 5);
  var summary = dr.buildTodaySummary(ds, dr.resolveContentMapping(ds), []);
  assert.match(summary, /^[А-ЯЁ]/);
  assert.match(summary, /\.$/);
  assert.match(summary, /остальное в норме/);
});

test("pickGrowthAxis берёт первую ось с запасом роста", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  assert.equal(dr.pickGrowthAxis(stateFromMetrics(4, 4, 5, 5)), "sleep");
  assert.equal(dr.pickGrowthAxis(stateFromMetrics(5, 5, 5, 4)), "stress");
  assert.equal(dr.pickGrowthAxis(stateFromMetrics(5, 5, 4, 5)), "energy");
  // Всё на максимуме — расти некуда.
  assert.equal(dr.pickGrowthAxis(stateFromMetrics(5, 5, 5, 5)), null);
  assert.equal(dr.pickGrowthAxis(null), null);
});

test("applyRecommendationMode различает recovery, growth, high и steady", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);

  function modeFor(sh, sq, en, st) {
    var ds = stateFromMetrics(sh, sq, en, st);
    return dr.applyRecommendationMode(ds, dr.resolveContentMapping(ds)).mode;
  }

  assert.equal(modeFor(1, 1, 1, 1), "recovery");
  assert.equal(modeFor(5, 5, 5, 5), "high");
  assert.equal(modeFor(4, 4, 5, 5), "growth");
  assert.equal(modeFor(5, 5, 2, 5), "recovery");
});

test("карточка для emergency_recovery собирается из STATE_OVERRIDES", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var ds = stateFromMetrics(1, 1, 1, 1);
  var cards = dr.getRecommendations(ds);

  assert.equal(cards.length, 1);
  var card = cards[0];
  assert.equal(card.tone, "recovery");
  assert.equal(card.mode, "recovery");
  assert.equal(card.diagnosis, dr.STATE_OVERRIDES.emergency_recovery.today);
  assert.equal(card.impact, dr.STATE_OVERRIDES.emergency_recovery.meaning);
  assert.ok(card.actions.length > 0 && card.actions.length <= 3);
  assert.ok(card.visible_blocks.indexOf("consequence") !== -1);
  assert.ok(card.show_why);
  assert.ok(card.why.url);
  assert.equal(card.state_label, dr.STATE_LABELS.emergency_recovery);
  // Запасной путь не проставляет decision_key — карточка не из матрицы решений.
  assert.equal(card.decision_key, undefined);
});

test("карточка для плато показывает только today и plan", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var card = dr.getRecommendations(stateFromMetrics(3, 3, 3, 3))[0];

  assert.deepEqual(card.visible_blocks, ["today", "plan"]);
  assert.ok(card.actions.length > 0);
  assert.ok(card.result.length > 0);
  assert.equal(card.result_condition.length > 0, true);
});

test("карточка в режиме роста говорит о потенциале, а не о потерях", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var card = dr.getRecommendations(stateFromMetrics(4, 4, 5, 5))[0];

  assert.equal(card.mode, "growth");
  assert.equal(card.tone, "growth");
  assert.equal(card.focus_axis, "sleep");
  assert.match(card.result, /может поднять концентрацию/);
});

test("карточка на максимуме ресурса остаётся в режиме high", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var card = dr.getRecommendations(stateFromMetrics(5, 5, 5, 5))[0];

  assert.equal(card.mode, "high");
  assert.equal(card.tone, "growth");
  assert.ok(card.actions.length > 0);
});

test("getRecommendations возвращает пустой список без состояния дня", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  assert.deepEqual(dr.getRecommendations(null), []);
  assert.deepEqual(dr.getRecommendations({}), []);
});

test("без матриц карточка собирается только для состояний с оверрайдом", function () {
  var dr = loadModule();
  var emergency = dr.getRecommendations(stateFromMetrics(1, 1, 1, 1));
  assert.equal(emergency.length, 1);
  assert.equal(emergency[0].diagnosis, dr.STATE_OVERRIDES.emergency_recovery.today);
  // Для плато контента нет — лучше не показывать карточку, чем показать пустую.
  assert.deepEqual(dr.getRecommendations(stateFromMetrics(3, 3, 3, 3)), []);
});

test("setRecommendationMatrix игнорирует мусор и сбрасывается на null", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  assert.equal(dr.getRecommendations(stateFromMetrics(3, 3, 3, 3)).length, 1);

  dr.setRecommendationMatrix("не объект");
  assert.deepEqual(dr.getRecommendations(stateFromMetrics(3, 3, 3, 3)), []);
});

test("pickMorningEmbeddables прячет отложенные и уже добавленные офферы", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var ds = stateFromMetrics(1, 1, 1, 1);

  var offers = dr.pickMorningEmbeddables(ds, {});
  assert.ok(offers.length > 0 && offers.length <= 2);
  offers.forEach(function (offer) {
    assert.equal(offer.status, "pending");
    assert.ok(offer.id);
  });

  var firstId = offers[0].id;
  var afterLater = dr.pickMorningEmbeddables(ds, { decisions: {} });
  assert.equal(afterLater[0].id, firstId);

  var hiddenByDecision = dr.pickMorningEmbeddables(ds, { decisions: { [firstId]: "later" } });
  assert.equal(
    hiddenByDecision.some(function (offer) {
      return offer.id === firstId;
    }),
    false
  );

  var hiddenByExisting = dr.pickMorningEmbeddables(ds, { existingIds: ["morning:" + firstId] });
  assert.equal(
    hiddenByExisting.some(function (offer) {
      return offer.id === firstId;
    }),
    false
  );
});

test("getMorningEmbeddable находит оффер по id", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  var ds = stateFromMetrics(1, 1, 1, 1);
  var id = dr.pickMorningEmbeddables(ds, {})[0].id;

  assert.equal(dr.getMorningEmbeddable(id).id, id);
  assert.equal(dr.getMorningEmbeddable("нет такого"), null);
  assert.equal(loadModule().getMorningEmbeddable(id), null);
});

test("getStateLabel учитывает под-состояния", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  assert.equal(dr.getStateLabel(null), "");
  assert.equal(
    dr.getStateLabel({ state: "normal", sub_state: "borderline" }),
    dr.STATE_LABELS.normal_borderline
  );
  assert.equal(
    dr.getStateLabel({ state: "mixed", sub_state: "mixed_severe" }),
    dr.STATE_LABELS.mixed_severe
  );
  assert.equal(dr.getStateLabel({ state: "неизвестно" }), "неизвестно");
});

test("qualifiesForHighDecision требует две пятёрки и никаких провалов", function () {
  var dr = loadModule(RECOMMENDATION_MATRIX);
  assert.equal(
    dr.qualifiesForHighDecision({ sleep_hours: 5, sleep_quality: 5, energy: 4, stress: 4 }),
    true
  );
  assert.equal(
    dr.qualifiesForHighDecision({ sleep_hours: 5, sleep_quality: 4, energy: 4, stress: 4 }),
    false
  );
  assert.equal(
    dr.qualifiesForHighDecision({ sleep_hours: 5, sleep_quality: 5, energy: 5, stress: 3 }),
    false
  );
  assert.equal(dr.qualifiesForHighDecision(null), false);
});
