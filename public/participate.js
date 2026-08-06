(function () {
  "use strict";

  var form = document.getElementById("participateForm");
  if (!form) return;

  var nameInput = document.getElementById("nameInput");
  var phoneInput = document.getElementById("phoneInput");
  var telegramInput = document.getElementById("telegramInput");
  var emailInput = document.getElementById("emailInput");
  var telegramField = document.getElementById("telegramField");
  var emailField = document.getElementById("emailField");
  var submitButton = document.getElementById("submitButton");
  var statusBanner = document.getElementById("statusBanner");

  var nameError = document.getElementById("nameError");
  var phoneError = document.getElementById("phoneError");
  var telegramError = document.getElementById("telegramError");
  var emailError = document.getElementById("emailError");

  var SURVEY_QUESTIONS = [
    { key: "q1", name: "surveyQ1", groupId: "surveyQ1Group", errorId: "surveyQ1Error", textKey: "participate.survey.q1.text" },
    { key: "q2", name: "surveyQ2", groupId: "surveyQ2Group", errorId: "surveyQ2Error", textKey: "participate.survey.q2.text" },
    { key: "q3", name: "surveyQ3", groupId: "surveyQ3Group", errorId: "surveyQ3Error", textKey: "participate.survey.q3.text" }
  ];

  // Per-page-load session/correlation ID. We deliberately do not persist it across
  // reloads to keep behavior sandbox-friendly and avoid expanding storage usage.
  function generateSessionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      if (window.crypto && window.crypto.getRandomValues) {
        var buf = new Uint8Array(16);
        window.crypto.getRandomValues(buf);
        buf[6] = (buf[6] & 0x0f) | 0x40;
        buf[8] = (buf[8] & 0x3f) | 0x80;
        var hex = [];
        for (var i = 0; i < buf.length; i++) {
          var h = buf[i].toString(16);
          if (h.length < 2) h = "0" + h;
          hex.push(h);
        }
        return hex[0] + hex[1] + hex[2] + hex[3] + "-" + hex[4] + hex[5] + "-" +
          hex[6] + hex[7] + "-" + hex[8] + hex[9] + "-" +
          hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15];
      }
    } catch (e) {}
    return "sid-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  var SESSION_ID = generateSessionId();

  function getLang() {
    if (window.UpeakI18n && typeof window.UpeakI18n.getLang === "function") {
      return window.UpeakI18n.getLang();
    }
    return document.documentElement.getAttribute("lang") || "ru";
  }

  function t(key, fallback) {
    if (window.UpeakI18n && typeof window.UpeakI18n.t === "function") {
      var v = window.UpeakI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function setFieldError(input, errorEl, key, fallback) {
    if (!input || !errorEl) return;
    if (key) {
      errorEl.setAttribute("data-i18n", key);
      errorEl.textContent = t(key, fallback || "");
      errorEl.classList.add("is-visible");
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
    } else {
      errorEl.classList.remove("is-visible");
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    }
  }

  function getSurveyValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function selfControlTraitFromSurveyQ3(answer) {
    switch (answer) {
      case "often": return 1;
      case "sometimes": return 2;
      case "rarely": return 4;
      case "almost_never": return 5;
      default: return 3;
    }
  }

  function persistSelfControlTrait() {
    try {
      var trait = selfControlTraitFromSurveyQ3(getSurveyValue("surveyQ3"));
      localStorage.setItem("upeak_self_control_trait", String(trait));
    } catch (_e) {}
  }

  function setSurveyError(question, key, fallback) {
    var group = document.getElementById(question.groupId);
    var errorEl = document.getElementById(question.errorId);
    if (!group || !errorEl) return;
    if (key) {
      errorEl.setAttribute("data-i18n", key);
      errorEl.textContent = t(key, fallback || "");
      errorEl.classList.add("is-visible");
      group.classList.add("is-invalid");
      group.setAttribute("aria-invalid", "true");
    } else {
      errorEl.classList.remove("is-visible");
      group.classList.remove("is-invalid");
      group.removeAttribute("aria-invalid");
    }
  }

  function clearFieldErrors() {
    setFieldError(nameInput, nameError, null);
    setFieldError(phoneInput, phoneError, null);
    setFieldError(telegramInput, telegramError, null);
    setFieldError(emailInput, emailError, null);
    SURVEY_QUESTIONS.forEach(function (q) { setSurveyError(q, null); });
  }

  function showBanner(kind, key, fallback) {
    if (!statusBanner) return;
    statusBanner.classList.remove("is-success", "is-error", "is-info");
    statusBanner.classList.add("is-visible");
    statusBanner.classList.add("is-" + kind);
    statusBanner.setAttribute("data-i18n", key);
    statusBanner.textContent = t(key, fallback);
    if (kind === "success" && typeof statusBanner.scrollIntoView === "function") {
      statusBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function hideBanner() {
    if (!statusBanner) return;
    statusBanner.classList.remove("is-visible", "is-success", "is-error", "is-info");
    statusBanner.removeAttribute("data-i18n");
    statusBanner.textContent = "";
  }

  function normalizePhone(value) {
    return String(value || "").trim();
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function normalizeTelegram(value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (v.charAt(0) === "@") v = v.slice(1);
    return v ? "@" + v : "";
  }

  function normalizeEmail(value) {
    return String(value || "").trim();
  }

  var TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;
  // Pragmatic email regex: local@domain.tld with allowed local chars.
  var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

  function applyLangVisibility() {
    var lang = getLang();
    var isEn = lang === "en";
    if (telegramField) telegramField.style.display = isEn ? "none" : "";
    if (emailField) emailField.style.display = isEn ? "" : "none";
    if (telegramInput) {
      if (isEn) telegramInput.removeAttribute("required");
      else telegramInput.setAttribute("required", "required");
    }
    if (emailInput) {
      if (isEn) emailInput.setAttribute("required", "required");
      else emailInput.removeAttribute("required");
    }
    // Clear errors on the hidden field so they don't linger on next language switch.
    if (isEn) {
      setFieldError(telegramInput, telegramError, null);
    } else {
      setFieldError(emailInput, emailError, null);
    }
  }

  function validate() {
    clearFieldErrors();
    var ok = true;
    var lang = getLang();

    // Survey first — the user must answer all three.
    SURVEY_QUESTIONS.forEach(function (q) {
      if (!getSurveyValue(q.name)) {
        setSurveyError(q, "participate.survey.error.required", "Пожалуйста, выберите вариант ответа");
        ok = false;
      }
    });

    var name = (nameInput.value || "").trim();
    if (!name) {
      setFieldError(nameInput, nameError, "participate.error.name", "Пожалуйста, укажите имя");
      ok = false;
    }

    var phoneRaw = normalizePhone(phoneInput.value);
    var digits = phoneDigits(phoneRaw);
    if (!phoneRaw || digits.length < 7) {
      setFieldError(phoneInput, phoneError, "participate.error.phone", "Укажите корректный телефон (минимум 7 цифр)");
      ok = false;
    }

    if (lang === "en") {
      var emailRaw = normalizeEmail(emailInput && emailInput.value);
      if (!emailRaw) {
        setFieldError(emailInput, emailError, "participate.error.emailRequired", "Please enter your email");
        ok = false;
      } else if (!EMAIL_RE.test(emailRaw) || emailRaw.length > 120) {
        setFieldError(emailInput, emailError, "participate.error.email", "Please enter a valid email address");
        ok = false;
      }
    } else {
      var tgRaw = (telegramInput && telegramInput.value || "").trim();
      if (!tgRaw) {
        setFieldError(telegramInput, telegramError, "participate.error.telegramRequired", "Укажите Telegram (@username)");
        ok = false;
      } else {
        var tgBare = tgRaw.charAt(0) === "@" ? tgRaw.slice(1) : tgRaw;
        if (!TELEGRAM_USERNAME_RE.test(tgBare)) {
          setFieldError(telegramInput, telegramError, "participate.error.telegram", "Имя пользователя Telegram содержит недопустимые символы");
          ok = false;
        }
      }
    }

    return ok;
  }

  // Регистрация всегда идёт через серверный прокси /api/register. Прокси
  // добавляет токен и общается с Apps Script, а нам возвращает JSON
  // (включая присвоенный participantId), который можно прочитать на любом домене.
  var REGISTER_ENDPOINT = "/api/register";

  function buildSurveyPayload() {
    // Send stable English answer codes plus localized labels (current language)
    // so the sheet can render readable answers even without a separate lookup.
    var lang = getLang();
    var survey = {};
    SURVEY_QUESTIONS.forEach(function (q) {
      var value = getSurveyValue(q.name);
      var optionEl = value ? form.querySelector('input[name="' + q.name + '"][value="' + value + '"]') : null;
      var label = "";
      if (optionEl) {
        var textSpan = optionEl.parentNode && optionEl.parentNode.querySelector("[data-i18n]");
        if (textSpan) {
          var labelKey = textSpan.getAttribute("data-i18n");
          label = t(labelKey, textSpan.textContent || "");
        }
      }
      survey[q.key] = {
        question: t(q.textKey, ""),
        answer: value,
        answerLabel: label,
        language: lang
      };
    });
    return survey;
  }

  function buildPayload() {
    var lang = getLang();
    var telegramVal = "";
    var emailVal = "";
    var contactType = "";
    var contactValue = "";

    if (lang === "en") {
      emailVal = normalizeEmail(emailInput && emailInput.value);
      if (emailVal) {
        contactType = "email";
        contactValue = emailVal;
      }
    } else {
      telegramVal = normalizeTelegram(telegramInput && telegramInput.value);
      if (telegramVal) {
        contactType = "telegram";
        contactValue = telegramVal;
      }
    }

    return {
      sessionId: SESSION_ID,
      name: (nameInput.value || "").trim(),
      phone: normalizePhone(phoneInput.value),
      telegram: telegramVal,
      email: emailVal,
      contactType: contactType,
      contactValue: contactValue,
      language: lang,
      sourcePage: window.location.href,
      userAgent: navigator.userAgent || "",
      submittedAt: new Date().toISOString(),
      survey: buildSurveyPayload()
    };
  }

  function postForm(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  function setSubmitting(isSubmitting) {
    if (!submitButton) return;
    submitButton.disabled = !!isSubmitting;
    submitButton.setAttribute("aria-busy", isSubmitting ? "true" : "false");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner();

    if (!validate()) {
      showBanner("error", "participate.status.invalid", "Проверьте правильность заполнения полей.");
      return;
    }

    var payload = buildPayload();
    setSubmitting(true);
    showBanner("info", "participate.status.sending", "Отправляем заявку…");

    postForm(REGISTER_ENDPOINT, payload)
      .then(function (response) {
        return response.text().then(function (text) {
          var parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (parseError) {
            console.warn("Registration response was not valid JSON", parseError);
          }
          return { ok: response.ok, parsed: parsed, status: response.status };
        });
      })
      .then(function (result) {
        var upstream = result.parsed && result.parsed.upstream;
        var upstreamOk = !upstream || upstream.ok !== false;
        if (result.ok && (!result.parsed || result.parsed.ok !== false) && upstreamOk) {
          persistSelfControlTrait();
          showBanner("success", "participate.status.success", "Спасибо! Мы получили вашу заявку.");
          var pid = result.parsed && (result.parsed.participantId ||
            (result.parsed.upstream && result.parsed.upstream.participantId));

          if (pid && statusBanner) {
            statusBanner.innerHTML = "";

            var baseLine = document.createElement("div");
            baseLine.textContent = t("participate.status.success", "Спасибо! Мы получили вашу заявку.");

            var idLine = document.createElement("div");
            idLine.style.marginTop = "8px";
            idLine.style.fontWeight = "600";
            idLine.textContent = t("participate.id.assigned", "Ваш ID участника:") + " " + pid;

            var hintLine = document.createElement("div");
            hintLine.style.marginTop = "2px";
            hintLine.style.fontWeight = "400";
            hintLine.style.fontSize = "13px";
            hintLine.textContent = t("participate.id.hint", "Сохраните этот ID — он понадобится в прототипе-планировщике.");

            statusBanner.appendChild(baseLine);
            statusBanner.appendChild(idLine);
            statusBanner.appendChild(hintLine);
            if (typeof statusBanner.scrollIntoView === "function") {
              statusBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }

          form.reset();
          document.querySelectorAll(".survey-option.is-selected").forEach(function (el) {
            el.classList.remove("is-selected");
          });
        } else {
          var serverMsg = (upstream && upstream.error) ? String(upstream.error)
            : (result.parsed && result.parsed.error ? String(result.parsed.error) : "");
          showBanner("error", "participate.status.error", "Не удалось отправить заявку. Попробуйте ещё раз.");
          if (serverMsg && statusBanner) {
            statusBanner.textContent = statusBanner.textContent + " (" + serverMsg + ")";
          }
        }
      })
      .catch(function (error) {
        console.error("Registration request failed", error);
        showBanner("error", "participate.status.network", "Ошибка сети. Проверьте соединение и повторите попытку.");
      })
      .then(function () {
        setSubmitting(false);
      });
  });

  [nameInput, phoneInput, telegramInput, emailInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", function () {
      if (input.classList.contains("is-invalid")) {
        var errId = input.id === "nameInput" ? nameError
          : input.id === "phoneInput" ? phoneError
          : input.id === "telegramInput" ? telegramError
          : emailError;
        setFieldError(input, errId, null);
      }
    });
  });

  // Radio change: clear group error and toggle visual selected state.
  SURVEY_QUESTIONS.forEach(function (q) {
    var radios = form.querySelectorAll('input[name="' + q.name + '"]');
    radios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        setSurveyError(q, null);
        radios.forEach(function (r) {
          var label = r.closest && r.closest(".survey-option");
          if (label) {
            if (r.checked) label.classList.add("is-selected");
            else label.classList.remove("is-selected");
          }
        });
      });
    });
  });

  applyLangVisibility();

  if (window.UpeakI18n && typeof window.UpeakI18n.onChange === "function") {
    window.UpeakI18n.onChange(function () {
      applyLangVisibility();
      if (statusBanner && statusBanner.hasAttribute("data-i18n")) {
        statusBanner.textContent = t(statusBanner.getAttribute("data-i18n"), statusBanner.textContent);
      }
    });
  }
})();
