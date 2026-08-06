"use strict";

// public/day-state.js — браузерная копия lib/day-state.js. Apps Script и
// фронтенд не умеют require(), поэтому файл продублирован вручную: тест
// страхует от дрейфа между копией и источником правды.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var lib = require("../lib/day-state");
var pub = require("../public/day-state.js");

var SCALE = [1, 2, 3, 4, 5];

test("экспортирует тот же набор ключей, что и lib/day-state.js", function () {
  assert.deepEqual(Object.keys(pub).sort(), Object.keys(lib).sort());
});

test("пороговые константы совпадают с lib/day-state.js", function () {
  Object.keys(lib).forEach(function (key) {
    if (typeof lib[key] === "function") return;
    assert.deepEqual(pub[key], lib[key], "константа " + key + " разошлась");
  });
});

test("в браузере публикуется как window.UpeakDayState", function () {
  var source = fs.readFileSync(path.join(__dirname, "..", "public", "day-state.js"), "utf8");
  var sandbox = { window: {}, module: undefined };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  assert.equal(typeof sandbox.window.UpeakDayState.computeDayStateFromMorning, "function");
  var metrics = { sleep_hours: 3, sleep_quality: 3, energy: 3, stress: 3 };
  // Значения приходят из другого realm, поэтому сравниваем сериализацию.
  assert.equal(
    JSON.stringify(sandbox.window.UpeakDayState.computeDayStateFromMetrics(metrics)),
    JSON.stringify(lib.computeDayStateFromMetrics(metrics))
  );
});

test("evaluateDayState совпадает с lib на всех 625 комбинациях метрик", function () {
  var checked = 0;
  SCALE.forEach(function (sleep_hours) {
    SCALE.forEach(function (sleep_quality) {
      SCALE.forEach(function (energy) {
        SCALE.forEach(function (stress) {
          var metrics = {
            sleep_hours: sleep_hours,
            sleep_quality: sleep_quality,
            energy: energy,
            stress: stress
          };
          assert.deepEqual(
            pub.computeDayStateFromMetrics(metrics),
            lib.computeDayStateFromMetrics(metrics),
            "расхождение на " + JSON.stringify(metrics)
          );
          checked += 1;
        });
      });
    });
  });
  assert.equal(checked, 625);
});

test("sleepHoursToScale совпадает с lib на границах диапазонов", function () {
  var hours = [
    -1, 0, 0.5, 4, 5.74, 5.75, 6, 6.24, 6.25, 6.5, 6.74, 6.75, 7, 7.24, 7.25, 8, 12,
    NaN, null, undefined, "7", "не число"
  ];
  hours.forEach(function (value) {
    assert.equal(
      pub.sleepHoursToScale(value),
      lib.sleepHoursToScale(value),
      "sleepHoursToScale(" + String(value) + ")"
    );
  });
});

test("sleepHoursToScale переводит часы сна в шкалу 1–5", function () {
  assert.equal(pub.sleepHoursToScale(5), 1);
  assert.equal(pub.sleepHoursToScale(6), 2);
  assert.equal(pub.sleepHoursToScale(6.5), 3);
  assert.equal(pub.sleepHoursToScale(7), 4);
  assert.equal(pub.sleepHoursToScale(8), 5);
  // Некорректный ввод не роняет расчёт — падаем в нейтральное «плато».
  assert.equal(pub.sleepHoursToScale(0), pub.PLATEAU_VALUE);
  assert.equal(pub.sleepHoursToScale("нет данных"), pub.PLATEAU_VALUE);
});

test("metricsFromRawInput инвертирует усталость и стресс так же, как lib", function () {
  var raw = { sleep_hours: 4, sleep_quality: 3, fatigue_raw: 1, stress_raw: 5 };
  assert.deepEqual(pub.metricsFromRawInput(raw), lib.metricsFromRawInput(raw));
  assert.deepEqual(pub.metricsFromRawInput(raw), {
    sleep_hours: 4,
    sleep_quality: 3,
    energy: 5,
    stress: 1
  });
  // Пустой ввод даёт нейтральное состояние без исключений.
  assert.deepEqual(pub.metricsFromRawInput(), lib.metricsFromRawInput());
});

test("computeDayStateFromMorning совпадает с lib на утренних чек-инах", function () {
  var checkins = [
    { sleepHours: 8, sleepQuality: 5, energy: 1, stress: 1 },
    { sleepHours: 7, sleepQuality: 4, energy: 2, stress: 1 },
    { sleepHours: 6.5, sleepQuality: 3, energy: 3, stress: 3 },
    { sleepHours: 5, sleepQuality: 2, energy: 5, stress: 5 },
    { sleepHours: 5, sleepQuality: 5, energy: 1, stress: 5 },
    {}
  ];
  checkins.forEach(function (morning) {
    assert.deepEqual(
      pub.computeDayStateFromMorning(morning),
      lib.computeDayStateFromMorning(morning),
      JSON.stringify(morning)
    );
  });
});

test("computeDayStateFromMetrics клампит значения вне шкалы 1–5", function () {
  var clamped = pub.computeDayStateFromMetrics({
    sleep_hours: 0,
    sleep_quality: 99,
    energy: -3,
    stress: "4"
  });
  assert.deepEqual(clamped.metrics, {
    sleep_hours: 1,
    sleep_quality: 5,
    energy: 1,
    stress: 4
  });
});
