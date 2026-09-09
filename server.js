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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

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
  "evening_recommendation_shown",
  "final_feedback",
  "call_invite_response"
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

// Telegram Bot API functions
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ Telegram bot token not configured");
    return { ok: false, error: "Telegram bot token not configured" };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  try {
    console.log(`Sending message to ${chatId}. Token exists: ${TELEGRAM_BOT_TOKEN ? "yes" : "no"}`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`Telegram API response:`, data);
    return { ok: data.ok, data };
  } catch (error) {
    console.error("sendTelegramMessage error:", error);
    return { ok: false, error: error.message };
  }
}

function buildDailyCheckInKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "✅ Нормально", callback_data: "checkin_normal" },
        { text: "⚠️ Напряжённо", callback_data: "checkin_tense" },
        { text: "🔴 Перегружен", callback_data: "checkin_overloaded" }
      ]
    ]
  };
}

function buildRegisterKeyboard(participantId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Подтвердить", callback_data: `confirm_participant_${participantId}` },
        { text: "❌ Отмена", callback_data: "cancel_register" }
      ]
    ]
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "upeak-proxy",
    plannerConfigured: Boolean(PLANNER_APPS_SCRIPT_URL),
    registrationConfigured: Boolean(REGISTRATION_APPS_SCRIPT_URL),
    telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN)
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
    if (!upstream.ok || (upstream.parsed && upstream.parsed.ok === false)) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script upstream error",
        status: upstream.status,
        body: upstream.text.slice(0, 500),
        upstream: upstream.parsed
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
    if (!upstream.ok || (upstream.parsed && upstream.parsed.ok === false)) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script upstream error",
        status: upstream.status,
        body: upstream.text.slice(0, 500),
        upstream: upstream.parsed
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

// Telegram Webhook endpoint
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const update = req.body || {};
    console.log("Telegram update received:", JSON.stringify(update).slice(0, 200));

    // Respond immediately to Telegram
    res.status(200).json({ ok: true });

    // Handle message with /start command
    if (update.message && update.message.text === "/start") {
      const userId = update.message.from.id;
      const chatId = update.message.chat.id;
      const userName = update.message.from.first_name || "User";
      const username = update.message.from.username || "";

      let welcomeText =
        `Привет, ${userName}! 👋\n\n` +
        `Я помогу тебе отслеживать твоё состояние и определять риск перегруза.`;

      if (REGISTRATION_APPS_SCRIPT_URL) {
        try {
          const lookupUrl =
            REGISTRATION_APPS_SCRIPT_URL +
            (REGISTRATION_APPS_SCRIPT_URL.indexOf("?") >= 0 ? "&" : "?") +
            "action=lookup_telegram&telegramUserId=" +
            encodeURIComponent(String(userId)) +
            "&telegramUsername=" +
            encodeURIComponent(username) +
            "&telegramChatId=" +
            encodeURIComponent(String(chatId)) +
            (REGISTRATION_APPS_SCRIPT_TOKEN
              ? "&proxyToken=" + encodeURIComponent(REGISTRATION_APPS_SCRIPT_TOKEN)
              : "");

          const response = await fetch(lookupUrl, { method: "GET", redirect: "follow" });
          const data = await response.json();

          if (data.exists && data.participant) {
            welcomeText =
              `Привет, ${userName}! 👋\n\n` +
              `Ты уже привязан к участнику ${data.participant.participantId}.\n\n` +
              `Я буду отправлять тебе ежедневные вопросы и помогать следить за состоянием.`;
          } else {
            const createBody = {
              action: "create_from_telegram",
              telegramUserId: String(userId),
              telegramChatId: String(chatId),
              telegramUsername: username,
              telegramName: sanitizeString(userName, 100),
              proxyToken: REGISTRATION_APPS_SCRIPT_TOKEN
            };

            const createResponse = await callAppsScript(REGISTRATION_APPS_SCRIPT_URL, createBody);

            if (createResponse.ok && createResponse.parsed && createResponse.parsed.ok) {
              const createdParticipantId = createResponse.parsed.participantId || "";
              welcomeText =
                `Привет, ${userName}! 👋\n\n` +
                `Ты успешно зарегистрирован в Telegram-боте.\n\n` +
                `Твой идентификатор: ${createdParticipantId}\n\n` +
                `Я буду отправлять тебе ежедневные вопросы и помогать следить за состоянием.`;
            } else {
              welcomeText =
                `Привет, ${userName}! 👋\n\n` +
                `Я тебя распознал по Telegram, но запись в системе пока не создана.\n\n` +
                `Попробуй ещё раз через несколько секунд.`;
            }
          }
        } catch (error) {
          console.error("Telegram linked-user lookup error:", error);
          welcomeText =
            `Привет, ${userName}! 👋\n\n` +
            `Временная ошибка. Попробуй ещё раз через минуту.`;
        }
      }

      console.log(`Sending welcome message to chat ${chatId}`);
      const result = await sendTelegramMessage(chatId, welcomeText);
      console.log(`Welcome message result:`, result);
      return;
    }

    // Handle participant ID registration
    if (update.message && update.message.text) {
      const userId = update.message.from.id;
      const chatId = update.message.chat.id;
      const incomingText = sanitizeString(update.message.text, 40);
      const participantId = incomingText.toUpperCase();

      // Verify participant exists
      if (!REGISTRATION_APPS_SCRIPT_URL) {
        await sendTelegramMessage(chatId, "❌ Ошибка конфигурации. Попробуй позже.");
        return;
      }

      if (!/^UP-\d{6,}$/.test(participantId)) {
        await sendTelegramMessage(
          chatId,
          "❌ Формат ID неверный. Введи его в формате: UP-000001"
        );
        return;
      }

      const lookupUrl =
        REGISTRATION_APPS_SCRIPT_URL +
        (REGISTRATION_APPS_SCRIPT_URL.indexOf("?") >= 0 ? "&" : "?") +
        "action=lookup&id=" +
        encodeURIComponent(participantId) +
        (REGISTRATION_APPS_SCRIPT_TOKEN
          ? "&proxyToken=" + encodeURIComponent(REGISTRATION_APPS_SCRIPT_TOKEN)
          : "");

      try {
        const response = await fetch(lookupUrl, { method: "GET", redirect: "follow" });
        const data = await response.json();

        if (data.exists && data.participant) {
          // Save Telegram connection
          const registerBody = {
            action: "link_telegram",
            participantId: participantId,
            telegramUserId: userId,
            telegramChatId: chatId,
            telegramName: sanitizeString(update.message.from.first_name || "User", 100),
            telegramUsername: sanitizeString(update.message.from.username || "", 100),
            proxyToken: REGISTRATION_APPS_SCRIPT_TOKEN
          };

          const registerResponse = await callAppsScript(REGISTRATION_APPS_SCRIPT_URL, registerBody);

          if (registerResponse.ok && registerResponse.parsed.ok) {
            const confirmText =
              `✅ Отлично! Ты подключен как ${data.participant.name || "участник"}.\n\n` +
              `Теперь я буду отправлять тебе ежедневный вопрос о твоём состоянии.\n\n` +
              `Ответ поможет определить, находишься ли ты на грани перегруза.`;

            await sendTelegramMessage(chatId, confirmText);
            return;
          }
        }

        await sendTelegramMessage(chatId, "❌ ID не найден. Проверь его и попробуй снова.");
      } catch (error) {
        console.error("Telegram lookup error:", error);
        await sendTelegramMessage(chatId, "❌ Ошибка проверки. Попробуй позже.");
      }
      return;
    }

    // Handle inline button presses (callback_query)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const userId = update.callback_query.from.id;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;

      if (callbackData.startsWith("checkin_")) {
        const state = callbackData.replace("checkin_", "");
        const validStates = ["normal", "tense", "overloaded"];

        if (!validStates.includes(state)) {
          return;
        }

        // Save checkin to Google Sheets via Apps Script
        const checkinBody = {
          action: "save_daily_checkin",
          telegramUserId: userId,
          state: state,
          timestamp: new Date().toISOString(),
          proxyToken: REGISTRATION_APPS_SCRIPT_TOKEN
        };

        const checkinResponse = await callAppsScript(REGISTRATION_APPS_SCRIPT_URL, checkinBody);

        // Edit message to show response
        const stateLabel = { normal: "✅ Нормально", tense: "⚠️ Напряжённо", overloaded: "🔴 Перегружен" }[state];
        const responseText =
          `${stateLabel}\n\n` +
          `Спасибо за ответ! 📊\n\n` +
          `Проверь сайт плани для рекомендаций, как уменьшить нагрузку.`;

        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: responseText,
              parse_mode: "HTML"
            })
          });
        } catch (error) {
          console.error("Edit message error:", error);
        }

        return;
      }
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Send daily checkin question to Telegram
app.post("/api/telegram/send-daily-question", async (req, res) => {
  try {
    const { telegramChatId, participantId } = req.body || {};

    if (!telegramChatId) {
      return res.status(400).json({ ok: false, error: "telegramChatId is required" });
    }

    const questionText =
      `Как ты себя чувствуешь? 👋\n\n` +
      `Это поможет определить, находишься ли ты на грани перегруза.`;

    const result = await sendTelegramMessage(
      telegramChatId,
      questionText,
      buildDailyCheckInKeyboard()
    );

    return res.status(200).json({ ok: result.ok, result });
  } catch (error) {
    console.error("POST /api/telegram/send-daily-question failed", error);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});