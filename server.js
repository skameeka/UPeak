const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const PLANNER_APPS_SCRIPT_URL =
  process.env.PLANNER_APPS_SCRIPT_URL || process.env.APPS_SCRIPT_URL || "";
const REGISTRATION_APPS_SCRIPT_URL =
  process.env.REGISTRATION_APPS_SCRIPT_URL || "";

const PLANNER_APPS_SCRIPT_TOKEN =
  process.env.PLANNER_APPS_SCRIPT_TOKEN || process.env.APPS_SCRIPT_SHARED_TOKEN || "";
const REGISTRATION_APPS_SCRIPT_TOKEN =
  process.env.REGISTRATION_APPS_SCRIPT_TOKEN || "";

const ALLOWED_EVENT_TYPES = new Set([
  "morning_checkin",
  "task_created",
  "task_edited",
  "task_deleted",
  "task_toggled",
  "task_reordered",
  "scheduled_added",
  "scheduled_restored",
  "scheduled_deleted",
  "plan_generated",
  "routine_activated",
  "evening_checkout",
  "card_feedback",
  "morning_embed_added",
  "evening_embed_added",
  "morning_recommendation_shown",
  "evening_recommendation_shown"
]);

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

function sanitizeString(value, max = 5000) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function sanitizeEvent(input) {
  return {
    source: sanitizeString(input.source || "pulseburn-planner", 100),
    eventType: sanitizeString(input.eventType, 100),
    timestamp: sanitizeString(input.timestamp, 100),
    date: sanitizeString(input.date, 50),
    sessionId: sanitizeString(input.sessionId, 64),
    participantId: sanitizeString(input.participantId, 40),
    userName: sanitizeString(input.userName || "anonymous", 120),
    language: sanitizeString(input.language, 8),
    sourcePage: sanitizeString(input.sourcePage, 200),
    readiness: Number.isFinite(Number(input.readiness)) ? Number(input.readiness) : null,
    tasksCount: Number.isFinite(Number(input.tasksCount)) ? Number(input.tasksCount) : null,
    doneCount: Number.isFinite(Number(input.doneCount)) ? Number(input.doneCount) : null,
    scheduledCount: Number.isFinite(Number(input.scheduledCount)) ? Number(input.scheduledCount) : null,
    payload: typeof input.payload === "object" && input.payload !== null ? input.payload : {}
  };
}

// Общая обвязка маршрутов: единый лог и 500 на любую необработанную ошибку.
function route(label, handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(label + " failed", error);
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  };
}

function upstreamPayload(req, body, token) {
  return Object.assign({}, body, {
    proxyToken: token,
    receivedAt: new Date().toISOString(),
    ip: req.ip || "",
    userAgent: sanitizeString(req.get("user-agent"), 500)
  });
}

function sendUpstreamError(res, status, body) {
  const payload = { ok: false, error: "Apps Script upstream error", status: status };
  if (body != null) payload.body = String(body).slice(0, 500);
  return res.status(502).json(payload);
}

async function callAppsScript(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_e) {
    parsed = { raw: text };
  }

  return { ok: response.ok, status: response.status, parsed, text };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "upeak-proxy",
    plannerConfigured: Boolean(PLANNER_APPS_SCRIPT_URL),
    registrationConfigured: Boolean(REGISTRATION_APPS_SCRIPT_URL)
  });
});

app.post("/api/register", route("POST /api/register", async (req, res) => {
  if (!REGISTRATION_APPS_SCRIPT_URL) {
    return res.status(503).json({ ok: false, error: "REGISTRATION_APPS_SCRIPT_URL is not configured" });
  }

  const body = upstreamPayload(req, req.body || {}, REGISTRATION_APPS_SCRIPT_TOKEN);

  const upstream = await callAppsScript(REGISTRATION_APPS_SCRIPT_URL, body);
  if (!upstream.ok) {
    return sendUpstreamError(res, upstream.status, upstream.text);
  }

  return res.status(200).json({
    ok: true,
    upstream: upstream.parsed,
    participantId: upstream.parsed && upstream.parsed.participantId ? upstream.parsed.participantId : ""
  });
}));

app.get("/api/participant/lookup", route("GET /api/participant/lookup", async (req, res) => {
  const id = sanitizeString(req.query.id, 40);
  if (!id) {
    return res.status(400).json({ ok: false, error: "id is required" });
  }

  if (!REGISTRATION_APPS_SCRIPT_URL) {
    return res.status(503).json({ ok: false, error: "REGISTRATION_APPS_SCRIPT_URL is not configured" });
  }

  const url =
    REGISTRATION_APPS_SCRIPT_URL +
    (REGISTRATION_APPS_SCRIPT_URL.indexOf("?") >= 0 ? "&" : "?") +
    "action=lookup&id=" +
    encodeURIComponent(id) +
    (REGISTRATION_APPS_SCRIPT_TOKEN
      ? "&proxyToken=" + encodeURIComponent(REGISTRATION_APPS_SCRIPT_TOKEN)
      : "");

  const response = await fetch(url, { method: "GET", redirect: "follow" });
  const text = await response.text();

  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch (_e) {}

  if (!response.ok) {
    return sendUpstreamError(res, response.status, null);
  }

  return res.status(200).json({
    ok: true,
    exists: !!parsed.exists,
    id,
    participant: parsed.participant || null
  });
}));

app.post("/api/events", route("POST /api/events", async (req, res) => {
  if (!PLANNER_APPS_SCRIPT_URL) {
    return res.status(503).json({ ok: false, error: "PLANNER_APPS_SCRIPT_URL is not configured" });
  }

  const event = sanitizeEvent(req.body || {});

  if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) {
    return res.status(400).json({ ok: false, error: "Invalid eventType" });
  }

  if (!event.timestamp || !event.date) {
    return res.status(400).json({ ok: false, error: "timestamp and date are required" });
  }

  if (!event.participantId) {
    return res.status(400).json({ ok: false, error: "participantId is required" });
  }

  const body = upstreamPayload(req, event, PLANNER_APPS_SCRIPT_TOKEN);

  const upstream = await callAppsScript(PLANNER_APPS_SCRIPT_URL, body);
  if (!upstream.ok) {
    return sendUpstreamError(res, upstream.status, upstream.text);
  }

  return res.status(200).json({ ok: true, upstream: upstream.parsed });
}));

const PAGE_ROUTES = {
  "/": "index.html",
  "/planner": "planner.html",
  "/participate": "participate.html"
};

Object.keys(PAGE_ROUTES).forEach((routePath) => {
  app.get(routePath, (_req, res) => {
    res.sendFile(path.join(__dirname, "public", PAGE_ROUTES[routePath]));
  });
});

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});