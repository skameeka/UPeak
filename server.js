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

app.post("/api/register", async (req, res) => {
  try {
    if (!REGISTRATION_APPS_SCRIPT_URL) {
      return res.status(503).json({ ok: false, error: "REGISTRATION_APPS_SCRIPT_URL is not configured" });
    }

    const body = Object.assign({}, req.body || {}, {
      proxyToken: REGISTRATION_APPS_SCRIPT_TOKEN,
      receivedAt: new Date().toISOString(),
      ip: req.ip || "",
      userAgent: sanitizeString(req.get("user-agent"), 500)
    });

    const upstream = await callAppsScript(REGISTRATION_APPS_SCRIPT_URL, body);
    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script upstream error",
        status: upstream.status,
        body: upstream.text.slice(0, 500)
      });
    }

    return res.status(200).json({
      ok: true,
      upstream: upstream.parsed,
      participantId: upstream.parsed && upstream.parsed.participantId ? upstream.parsed.participantId : ""
    });
  } catch (error) {
    console.error("POST /api/register failed", error);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.get("/api/participant/lookup", async (req, res) => {
  try {
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
      return res.status(502).json({ ok: false, error: "Apps Script upstream error", status: response.status });
    }

    return res.status(200).json({
      ok: true,
      exists: !!parsed.exists,
      id,
      participant: parsed.participant || null
    });
  } catch (error) {
    console.error("GET /api/participant/lookup failed", error);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.post("/api/events", async (req, res) => {
  try {
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

    const body = Object.assign({}, event, {
      proxyToken: PLANNER_APPS_SCRIPT_TOKEN,
      receivedAt: new Date().toISOString(),
      ip: req.ip || "",
      userAgent: sanitizeString(req.get("user-agent"), 500)
    });

    const upstream = await callAppsScript(PLANNER_APPS_SCRIPT_URL, body);
    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script upstream error",
        status: upstream.status,
        body: upstream.text.slice(0, 500)
      });
    }

    return res.status(200).json({ ok: true, upstream: upstream.parsed });
  } catch (error) {
    console.error("POST /api/events failed", error);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/planner", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "planner.html"));
});

app.get("/participate", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "participate.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("Server started on port", PORT);
  });
}

module.exports = app;