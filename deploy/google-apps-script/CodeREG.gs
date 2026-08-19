
var SPREADSHEET_ID = "";
var SHEET_NAME = "Participants";
// Опционально: тот же токен, что в .env → REGISTRATION_APPS_SCRIPT_TOKEN
var SHARED_TOKEN = "";

var Q1_TEXT_RU = "Следите ли вы за своим состоянием или здоровьем?";
var Q2_TEXT_RU = "Используете ли вы что-то для отслеживания: сна, тренировок, нагрузки, продуктивности, самочувствия?";
var Q3_TEXT_RU = "Насколько вам знакомы такие проблемы: перегруз, усталость к концу дня, сложности с планированием, переоценка своих сил?";
var Q4_TEXT_RU = "Когда ты замечаешь, что нагрузка начинает влиять на твоё состояние?";
var Q5_TEXT_RU = "Что ты обычно делаешь, когда замечаешь, что текущая нагрузка влияет на твоё состояние?";

var HEADERS = [
  "Participant ID",
  "Timestamp",
  "Session ID",
  "Name",
  "Phone",
  "Telegram",
  "Email",
  "Contact Type",
  "Contact Value",
  "Language",
  "Source Page",
  "User Agent",
  "Submitted At (client)",
  "Q1: " + Q1_TEXT_RU,
  "Q1 Answer",
  "Q1 Answer (label)",
  "Q2: " + Q2_TEXT_RU,
  "Q2 Answer",
  "Q2 Answer (label)",
  "Q3: " + Q3_TEXT_RU,
  "Q3 Answer",
  "Q3 Answer (label)",
  "Q4: " + Q4_TEXT_RU,
  "Q4 Answer",
  "Q4 Answer (label)",
  "Q5: " + Q5_TEXT_RU,
  "Q5 Answer",
  "Q5 Answer (label)",
  "Status"
];

var Q1_VALID = { "yes_regularly": true, "sometimes": true, "no": true };
var Q2_VALID = { "yes": true, "no": true };
var Q3_VALID = { "often": true, "sometimes": true, "rarely": true, "almost_never": true };
var Q4_VALID = {
  "before_interference": true,
  "slight_interference": true,
  "strong_interference": true,
  "after_consequences": true,
  "do_not_notice": true,
  "unsure": true
};
var Q5_VALID = {
  "nothing": true,
  "postpone_tasks": true,
  "reduce_volume": true,
  "take_break": true,
  "finish_as_planned": true,
  "other": true,
  "no_such_situation": true
};

function _getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.length > 0) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active spreadsheet. Set SPREADSHEET_ID or bind the script to a sheet.");
  }
  return ss;
}

function _getSheet_() {
  var ss = _getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  _ensureHeaders_(sheet);
  return sheet;
}

function _ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS.length);
    return;
  }

  var firstHeader = String(sheet.getRange(1, 1).getValue() || "").trim();
  // Старый лист начинался с Timestamp — добавляем колонку Participant ID слева.
  if (firstHeader === "Timestamp") {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue("Participant ID");
    sheet.getRange(1, 1).setFontWeight("bold");
    _backfillMissingIds_(sheet);
  }

  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
}

function _jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _sanitize_(value, maxLen) {
  if (value === null || value === undefined) return "";
  var s = String(value).trim();
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

function _normalizeTelegram_(value) {
  var v = _sanitize_(value, 64);
  if (!v) return "";
  if (v.charAt(0) === "@") v = v.substring(1);
  if (!v) return "";
  return "@" + v;
}

var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function _normalizeEmail_(value) {
  var v = _sanitize_(value, 120);
  if (!v) return "";
  if (!EMAIL_RE.test(v)) return "";
  return v;
}

function _parsePayload_(e) {
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (err) {
      // не JSON — пробуем как form-encoded
    }
  }
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }
  return {};
}

function _readSurveyEntry_(survey, key) {
  if (!survey || typeof survey !== "object") return { question: "", answer: "", label: "" };
  var entry = survey[key];
  if (!entry || typeof entry !== "object") return { question: "", answer: "", label: "" };
  return {
    question: _sanitize_(entry.question, 500),
    answer: _sanitize_(entry.answer, 64),
    label: _sanitize_(entry.answerLabel, 200)
  };
}

function _formatParticipantId_(n) {
  var s = String(Math.max(1, Math.floor(n)));
  while (s.length < 6) s = "0" + s;
  return "UP-" + s;
}

function _parseParticipantSeq_(value) {
  var m = String(value || "").trim().toUpperCase().match(/^UP-(\d+)$/);
  if (!m) return 0;
  return Number(m[1]) || 0;
}

function _nextParticipantId_(sheet) {
  var lastRow = sheet.getLastRow();
  var maxSeq = 0;
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var seq = _parseParticipantSeq_(values[i][0]);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return _formatParticipantId_(maxSeq + 1);
}

function _backfillMissingIds_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var range = sheet.getRange(2, 1, lastRow, 1);
  var values = range.getValues();
  var nextSeq = 1;
  for (var i = 0; i < values.length; i++) {
    var seq = _parseParticipantSeq_(values[i][0]);
    if (seq > 0) {
      if (seq >= nextSeq) nextSeq = seq + 1;
    }
  }
  var changed = false;
  for (var j = 0; j < values.length; j++) {
    if (!_parseParticipantSeq_(values[j][0])) {
      values[j][0] = _formatParticipantId_(nextSeq);
      nextSeq += 1;
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

function _findParticipantRow_(sheet, participantId) {
  var id = String(participantId || "").trim().toUpperCase();
  if (!id) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim().toUpperCase() === id) {
      return {
        row: i + 2,
        values: values[i]
      };
    }
  }
  return null;
}

function _checkToken_(token) {
  if (!SHARED_TOKEN) return true;
  return _sanitize_(token, 200) === SHARED_TOKEN;
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = _sanitize_(params.action, 32).toLowerCase();

    if (action === "lookup") {
      if (!_checkToken_(params.proxyToken)) {
        return _jsonOutput_({ ok: false, error: "unauthorized", exists: false });
      }
      var id = _sanitize_(params.id, 40).toUpperCase();
      if (!id) {
        return _jsonOutput_({ ok: false, error: "id_required", exists: false });
      }
      var sheet = _getSheet_();
      var found = _findParticipantRow_(sheet, id);
      if (!found) {
        return _jsonOutput_({ ok: true, exists: false, id: id });
      }
      return _jsonOutput_({
        ok: true,
        exists: true,
        id: id,
        participant: {
          participantId: id,
          name: found.values[3] || "",
          language: found.values[9] || "",
          status: found.values[22] || ""
        }
      });
    }

    return _jsonOutput_({
      ok: true,
      service: "upeak-participants",
      version: 5,
      sheet: SHEET_NAME,
      columns: HEADERS.length
    });
  } catch (err) {
    return _jsonOutput_({
      ok: false,
      error: "internal_error",
      message: String(err && err.message ? err.message : err)
    });
  }
}

function doPost(e) {
  try {
    var data = _parsePayload_(e) || {};

    if (!_checkToken_(data.proxyToken)) {
      return _jsonOutput_({ ok: false, error: "unauthorized" });
    }

    var sessionId = _sanitize_(data.sessionId, 64);
    var name = _sanitize_(data.name, 120);
    var phone = _sanitize_(data.phone, 32);
    var telegram = _normalizeTelegram_(data.telegram);
    var email = _normalizeEmail_(data.email);
    var language = _sanitize_(data.language, 8) || "ru";
    var sourcePage = _sanitize_(data.sourcePage, 500);
    var userAgent = _sanitize_(data.userAgent, 500);
    var submittedAt = _sanitize_(data.submittedAt, 64);

    if (!name) {
      return _jsonOutput_({ ok: false, error: "name_required" });
    }
    var phoneDigits = phone.replace(/\D+/g, "");
    if (phoneDigits.length < 7) {
      return _jsonOutput_({ ok: false, error: "phone_invalid" });
    }
    if (language === "en") {
      if (!email) {
        return _jsonOutput_({ ok: false, error: "email_required" });
      }
    } else if (!telegram) {
      return _jsonOutput_({ ok: false, error: "telegram_required" });
    }

    var survey = data.survey;
    var q1 = _readSurveyEntry_(survey, "q1");
    var q2 = _readSurveyEntry_(survey, "q2");
    var q3 = _readSurveyEntry_(survey, "q3");
    var q4 = _readSurveyEntry_(survey, "q4");
    var q5 = _readSurveyEntry_(survey, "q5");

    if (!q1.answer || !Q1_VALID[q1.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q1_required" });
    }
    if (!q2.answer || !Q2_VALID[q2.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q2_required" });
    }
    if (!q3.answer || !Q3_VALID[q3.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q3_required" });
    }
    if (!q4.answer || !Q4_VALID[q4.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q4_required" });
    }
    if (!q5.answer || !Q5_VALID[q5.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q5_required" });
    }

    var contactType = _sanitize_(data.contactType, 16);
    var contactValue = _sanitize_(data.contactValue, 200);
    if (!contactType) {
      if (language === "en" && email) {
        contactType = "email";
        contactValue = email;
      } else if (telegram) {
        contactType = "telegram";
        contactValue = telegram;
      }
    } else if (!contactValue) {
      contactValue = contactType === "email" ? email : telegram;
    }

    var sheet = _getSheet_();
    var participantId = _nextParticipantId_(sheet);
    var row = [
      participantId,
      new Date(),
      sessionId,
      name,
      phone,
      telegram,
      email,
      contactType,
      contactValue,
      language,
      sourcePage,
      userAgent,
      submittedAt,
      q1.question || Q1_TEXT_RU,
      q1.answer,
      q1.label,
      q2.question || Q2_TEXT_RU,
      q2.answer,
      q2.label,
      q3.question || Q3_TEXT_RU,
      q3.answer,
      q3.label,
      q4.question || Q4_TEXT_RU,
      q4.answer,
      q4.label,
      q5.question || Q5_TEXT_RU,
      q5.answer,
      q5.label,
      "new"
    ];
    sheet.appendRow(row);

    return _jsonOutput_({ ok: true, participantId: participantId });
  } catch (err) {
    return _jsonOutput_({
      ok: false,
      error: "internal_error",
      message: String(err && err.message ? err.message : err)
    });
  }
}

function setup() {
  var sheet = _getSheet_();
  _backfillMissingIds_(sheet);
  Logger.log("Sheet ready: " + sheet.getName() + " with " + sheet.getLastRow() + " rows.");
}
