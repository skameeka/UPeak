"use strict";

// Тесты HTTP-прокси (server.js): санитизация событий, валидация и проброс
// ответов Apps Script. Upstream-вызовы мокаются подменой global.fetch.

var test = require("node:test");
var assert = require("node:assert/strict");

process.env.PLANNER_APPS_SCRIPT_URL = "https://apps-script.test/planner";
process.env.PLANNER_APPS_SCRIPT_TOKEN = "planner-token";
process.env.REGISTRATION_APPS_SCRIPT_URL = "https://apps-script.test/registration";
process.env.REGISTRATION_APPS_SCRIPT_TOKEN = "registration-token";

var realFetch = globalThis.fetch;
var app = require("../server");

var upstreamCalls = [];
var upstreamResponse = { status: 200, body: '{"ok":true}' };

globalThis.fetch = function (url, options) {
  upstreamCalls.push({ url: String(url), options: options || {} });
  return Promise.resolve({
    ok: upstreamResponse.status >= 200 && upstreamResponse.status < 300,
    status: upstreamResponse.status,
    text: function () {
      return Promise.resolve(upstreamResponse.body);
    }
  });
};

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
    globalThis.fetch = realFetch;
    server.close(resolve);
  });
});

test.beforeEach(function () {
  upstreamCalls = [];
  upstreamResponse = { status: 200, body: '{"ok":true}' };
});

function request(path, options) {
  options = options || {};
  var init = { method: options.method || "GET", headers: options.headers || {} };
  if (options.json !== undefined) {
    init.headers = Object.assign({ "Content-Type": "application/json" }, init.headers);
    init.body = JSON.stringify(options.json);
  }
  return realFetch(baseUrl + path, init).then(function (res) {
    return res.text().then(function (text) {
      var parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {}
      return { status: res.status, body: parsed, text: text };
    });
  });
}

function validEvent(overrides) {
  return Object.assign(
    {
      eventType: "morning_checkin",
      timestamp: "2026-01-01T08:00:00.000Z",
      date: "2026-01-01",
      participantId: "UP-000001"
    },
    overrides || {}
  );
}

test("GET /api/health отдаёт статус конфигурации прокси", async function () {
  var res = await request("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    ok: true,
    service: "upeak-proxy",
    plannerConfigured: true,
    registrationConfigured: true
  });
});

test("GET / отдаёт статику лендинга", async function () {
  var res = await request("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /<html/i);
});

test("GET /planner и /participate отдают свои страницы", async function () {
  var planner = await request("/planner");
  var participate = await request("/participate");
  assert.equal(planner.status, 200);
  assert.equal(participate.status, 200);
  assert.notEqual(planner.text, participate.text);
});

test("POST /api/events отклоняет неизвестный eventType", async function () {
  var res = await request("/api/events", {
    method: "POST",
    json: validEvent({ eventType: "not_a_real_event" })
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Invalid eventType");
  assert.equal(upstreamCalls.length, 0);
});

test("POST /api/events требует timestamp и date", async function () {
  var noTimestamp = await request("/api/events", {
    method: "POST",
    json: validEvent({ timestamp: "" })
  });
  var noDate = await request("/api/events", { method: "POST", json: validEvent({ date: "" }) });

  assert.equal(noTimestamp.status, 400);
  assert.equal(noTimestamp.body.error, "timestamp and date are required");
  assert.equal(noDate.status, 400);
  assert.equal(upstreamCalls.length, 0);
});

test("POST /api/events требует participantId", async function () {
  var res = await request("/api/events", {
    method: "POST",
    json: validEvent({ participantId: "   " })
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "participantId is required");
});

test("POST /api/events санитизирует событие и добавляет служебные поля", async function () {
  var res = await request("/api/events", {
    method: "POST",
    headers: { "user-agent": "upeak-test-agent" },
    json: validEvent({
      userName: "  Анна  ",
      readiness: "4",
      tasksCount: "3",
      doneCount: "не число",
      payload: "not-an-object",
      sessionId: "s".repeat(200)
    })
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, upstream: { ok: true } });

  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, "https://apps-script.test/planner");
  var sent = JSON.parse(upstreamCalls[0].options.body);
  assert.equal(sent.source, "pulseburn-planner");
  assert.equal(sent.userName, "Анна");
  assert.equal(sent.readiness, 4);
  assert.equal(sent.tasksCount, 3);
  assert.equal(sent.doneCount, null);
  assert.deepEqual(sent.payload, {});
  assert.equal(sent.sessionId.length, 64);
  assert.equal(sent.proxyToken, "planner-token");
  assert.equal(sent.userAgent, "upeak-test-agent");
  assert.ok(sent.receivedAt);
});

test("POST /api/events превращает ошибку upstream в 502 с обрезанным телом", async function () {
  upstreamResponse = { status: 500, body: "x".repeat(900) };
  var res = await request("/api/events", { method: "POST", json: validEvent() });

  assert.equal(res.status, 502);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.status, 500);
  assert.equal(res.body.body.length, 500);
});

test("POST /api/events отдаёт сырой текст upstream, если это не JSON", async function () {
  upstreamResponse = { status: 200, body: "plain text answer" };
  var res = await request("/api/events", { method: "POST", json: validEvent() });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.upstream, { raw: "plain text answer" });
});

test("POST /api/register прокидывает participantId из ответа Apps Script", async function () {
  upstreamResponse = { status: 200, body: '{"ok":true,"participantId":"UP-000042"}' };
  var res = await request("/api/register", {
    method: "POST",
    json: { name: "Анна", email: "anna@example.com" }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.participantId, "UP-000042");

  var sent = JSON.parse(upstreamCalls[0].options.body);
  assert.equal(sent.name, "Анна");
  assert.equal(sent.proxyToken, "registration-token");
});

test("POST /api/register без participantId в ответе отдаёт пустую строку", async function () {
  upstreamResponse = { status: 200, body: '{"ok":true}' };
  var res = await request("/api/register", { method: "POST", json: { name: "Анна" } });

  assert.equal(res.status, 200);
  assert.equal(res.body.participantId, "");
});

test("POST /api/register превращает ошибку upstream в 502", async function () {
  upstreamResponse = { status: 403, body: "forbidden" };
  var res = await request("/api/register", { method: "POST", json: { name: "Анна" } });

  assert.equal(res.status, 502);
  assert.equal(res.body.status, 403);
});

test("GET /api/participant/lookup требует id", async function () {
  var res = await request("/api/participant/lookup");
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "id is required");
  assert.equal(upstreamCalls.length, 0);
});

test("GET /api/participant/lookup собирает URL с action, id и токеном", async function () {
  upstreamResponse = {
    status: 200,
    body: '{"exists":true,"participant":{"name":"Анна"}}'
  };
  var res = await request("/api/participant/lookup?id=UP-000001");

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    ok: true,
    exists: true,
    id: "UP-000001",
    participant: { name: "Анна" }
  });

  assert.equal(
    upstreamCalls[0].url,
    "https://apps-script.test/registration?action=lookup&id=UP-000001&proxyToken=registration-token"
  );
});

test("GET /api/participant/lookup отдаёт exists=false на неразбираемый ответ", async function () {
  upstreamResponse = { status: 200, body: "<html>redirect page</html>" };
  var res = await request("/api/participant/lookup?id=UP-000001");

  assert.equal(res.status, 200);
  assert.equal(res.body.exists, false);
  assert.equal(res.body.participant, null);
});

test("GET /api/participant/lookup превращает ошибку upstream в 502", async function () {
  upstreamResponse = { status: 500, body: "boom" };
  var res = await request("/api/participant/lookup?id=UP-000001");

  assert.equal(res.status, 502);
  assert.equal(res.body.status, 500);
});

test("POST /api/events возвращает 500, если upstream-вызов упал", async function () {
  var savedFetch = globalThis.fetch;
  globalThis.fetch = function () {
    return Promise.reject(new Error("network down"));
  };

  var res = await request("/api/events", { method: "POST", json: validEvent() });
  globalThis.fetch = savedFetch;

  assert.equal(res.status, 500);
  assert.equal(res.body.error, "Internal server error");
});
