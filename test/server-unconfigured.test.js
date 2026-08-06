"use strict";

// Отдельный процесс: server.js читает переменные окружения один раз при
// загрузке, поэтому поведение «прокси не настроен» проверяем изолированно.

var test = require("node:test");
var assert = require("node:assert/strict");

delete process.env.PLANNER_APPS_SCRIPT_URL;
delete process.env.APPS_SCRIPT_URL;
delete process.env.REGISTRATION_APPS_SCRIPT_URL;

var app = require("../server");

var server;
var baseUrl;

test.before(function () {
  return new Promise(function (resolve) {
    server = app.listen(0, "127.0.0.1", function () {
      baseUrl = "http://127.0.0.1:" + server.address().port;
      resolve();
    });
  });
});

test.after(function () {
  return new Promise(function (resolve) {
    server.close(resolve);
  });
});

function request(path, init) {
  return fetch(baseUrl + path, init).then(function (res) {
    return res.json().then(function (body) {
      return { status: res.status, body: body };
    });
  });
}

test("GET /api/health сообщает, что прокси не настроен", async function () {
  var res = await request("/api/health");
  assert.equal(res.body.plannerConfigured, false);
  assert.equal(res.body.registrationConfigured, false);
});

test("POST /api/events без PLANNER_APPS_SCRIPT_URL → 503", async function () {
  var res = await request("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: "morning_checkin" })
  });
  assert.equal(res.status, 503);
  assert.equal(res.body.error, "PLANNER_APPS_SCRIPT_URL is not configured");
});

test("POST /api/register без REGISTRATION_APPS_SCRIPT_URL → 503", async function () {
  var res = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Анна" })
  });
  assert.equal(res.status, 503);
  assert.equal(res.body.error, "REGISTRATION_APPS_SCRIPT_URL is not configured");
});

test("GET /api/participant/lookup без REGISTRATION_APPS_SCRIPT_URL → 503", async function () {
  var res = await request("/api/participant/lookup?id=UP-000001");
  assert.equal(res.status, 503);
  assert.equal(res.body.error, "REGISTRATION_APPS_SCRIPT_URL is not configured");
});
