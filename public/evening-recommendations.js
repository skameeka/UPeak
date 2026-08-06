(function (root) {
  "use strict";

  var utils = root.UpeakRecommendationUtils ||
    (typeof require === "function" ? require("./recommendation-utils.js") : null);

  var PLAN_LABEL = "Завтра";
  var EVENING_TITLE = "Итог дня";
  var MAX_EMBED_OFFERS = 1;

  // Диапазоны % выполнения плана: low [0–49], mid [50–69], high [70–100].
  var COMPLETION_RANGES = {
    low: { min: 0, max: 49 },
    mid: { min: 50, max: 69 },
    high: { min: 70, max: 100 }
  };

  var EVENING_MORNING_EMBED = {
    evening_early_sleep: "evening_wind_down"
  };

  var SLEEP_EMBED_TITLES = ["подготовка ко сну", "раньше ко сну"];

  var DECISION_MATRIX = null;

  var RESULT_CONDITION = "Если следовать рекомендациям выше:";
  var RESULT_DISCLAIMER = utils.RESULT_DISCLAIMER;

  function setEveningMatrix() {
    // Legacy evening-recommendation-matrix.json — не используется в MVP-маршрутизации.
  }

  function setDecisionMatrix(data) {
    DECISION_MATRIX = data && data.decisions ? data : null;
    if (DECISION_MATRIX && DECISION_MATRIX.meta) {
      if (DECISION_MATRIX.meta.plan_label) PLAN_LABEL = DECISION_MATRIX.meta.plan_label;
      if (DECISION_MATRIX.meta.result_condition) RESULT_CONDITION = DECISION_MATRIX.meta.result_condition;
      if (DECISION_MATRIX.meta.evening_title) {
        EVENING_TITLE = DECISION_MATRIX.meta.evening_title;
        if (root.UpeakEveningRecommendations) {
          root.UpeakEveningRecommendations.EVENING_TITLE = EVENING_TITLE;
        }
      }
    }
  }

  function morningBand(score) {
    var s = Number(score);
    if (!Number.isFinite(s)) return "medium";
    if (s < 40) return "low";
    if (s < 70) return "medium";
    return "high";
  }

  function completionBand(completed, total) {
    if (!(Number(total) > 0)) return null;
    var rate = Math.round((completed / total) * 100);
    if (rate >= COMPLETION_RANGES.high.min) return "high";
    if (rate >= COMPLETION_RANGES.mid.min) return "medium";
    return "low";
  }

  function completionRate(completed, total) {
    return Number(total) > 0 ? Math.round((completed / total) * 100) : null;
  }

  function isFatigueHigh(evening) {
    return evening && Number(evening.fatigue) >= 4;
  }

  function isDetachmentLow(evening) {
    return evening && Number(evening.detachment) <= 2;
  }

  function isStartHard(evening) {
    return evening && Number(evening.taskStart) >= 4;
  }

  // Одна карточка = одна причина → одно решение. Приоритет сверху вниз,
  // побеждает первый сработавший сигнал; остальное — молчит в этой карточке.
  function resolveDecisionKey(evening, cBand) {
    if (isFatigueHigh(evening)) return "fatigue_high";
    if (isDetachmentLow(evening)) return "detachment_low";
    if (isStartHard(evening)) return "start_hard";
    if (cBand === "high") return "completion_high";
    if (cBand === "low") return "completion_low";
    return "completion_mid";
  }

  function fillNarrative(template, completionPct) {
    var pct = Math.round(Number(completionPct) || 0);
    return String(template || "").replace(/\{pct\}/g, String(pct));
  }

  // Утреннее состояние упоминается только там, где контраст с итогом дня
  // меняет смысл (morning_variants в матрице). Иначе — молчим про утро,
  // чтобы не ломать «одна причина → одно решение».
  function getDecisionEntry(decisionKey, completionPct, morningBandKey) {
    if (!DECISION_MATRIX || !DECISION_MATRIX.decisions) return null;
    var base = DECISION_MATRIX.decisions[decisionKey];
    if (!base) return null;

    var narrativeTemplate = base.narrative;
    if (base.morning_variants && morningBandKey && base.morning_variants[morningBandKey]) {
      narrativeTemplate = base.morning_variants[morningBandKey];
    }

    var actions = Array.isArray(base.today_action) ? base.today_action.slice() : [];

    return {
      state: base.state || "Итог дня",
      narrative_text: fillNarrative(narrativeTemplate, completionPct),
      today_action: actions,
      evidence: base.evidence ? Object.assign({}, base.evidence) : null
    };
  }

  function cardToneFromDecisionKey(decisionKey) {
    if (decisionKey === "completion_high") return "high";
    if (
      decisionKey === "completion_low" ||
      decisionKey === "fatigue_high" ||
      decisionKey === "detachment_low" ||
      decisionKey === "start_hard"
    ) {
      return "recovery";
    }
    return "steady";
  }

  function composeCardFromDecision(entry, completionPct, decisionKey) {
    if (!entry || !entry.narrative_text) return null;

    var proof = utils.buildProofFromEvidence(entry);
    var hasProof = utils.hasProof(proof);
    var actions = Array.isArray(entry.today_action) ? entry.today_action.slice() : [];

    return {
      tone: cardToneFromDecisionKey(decisionKey),
      narrative: entry.narrative_text,
      // state здесь — заголовок-бейдж, полный текст диагноза лежит в narrative.
      state: entry.state || "Итог дня",
      state_title: entry.state || "Итог дня",
      decision: "",
      actions: actions,
      action_labels: null,
      avoid: [],
      benefit: "",
      result: "",
      result_condition: RESULT_CONDITION,
      result_disclaimer: RESULT_DISCLAIMER,
      proof: proof,
      show_proof: hasProof,
      why: proof,
      show_why: hasProof,
      plan_label: PLAN_LABEL,
      completionRate: completionPct,
      decision_key: decisionKey || "",
      card_id: decisionKey || "",
      title: entry.state || "Итог дня",
      summary: entry.narrative_text,
      text: entry.narrative_text
    };
  }

  function normalizeTaskTitle(title) {
    return String(title || "").trim().toLowerCase();
  }

  function isEveningEmbedDuplicated(offer, ctx) {
    if (!offer) return true;

    var title = offer.task && offer.task.title ? normalizeTaskTitle(offer.task.title) : "";
    var existingTitles = ctx.existingTitles || [];

    if (title && existingTitles.indexOf(title) !== -1) return true;

    if (offer.id === "evening_early_sleep") {
      for (var s = 0; s < SLEEP_EMBED_TITLES.length; s++) {
        if (existingTitles.indexOf(SLEEP_EMBED_TITLES[s]) !== -1) return true;
      }
    }

    var morningId = EVENING_MORNING_EMBED[offer.id];
    if (!morningId) return false;

    var morningRecId = "morning:" + morningId;
    if ((ctx.existingIds || []).indexOf(morningRecId) !== -1) return true;

    var morningDecisions = ctx.morningDecisions || {};
    if (morningDecisions[morningId] === "added") return true;

    return false;
  }

  function buildEmbedContext(evening, cBand, options) {
    options = options || {};
    return {
      fatigue_high: isFatigueHigh(evening),
      detachment_low: isDetachmentLow(evening),
      start_hard: isStartHard(evening),
      low_completion: cBand === "low",
      decisions: options.decisions || {},
      existingIds: Array.isArray(options.existingIds) ? options.existingIds : [],
      existingTitles: Array.isArray(options.existingTitles) ? options.existingTitles : [],
      morningDecisions: options.morningDecisions || {}
    };
  }

  function getEveningEmbeddable(embedId) {
    return utils.findEmbeddableById(DECISION_MATRIX && DECISION_MATRIX.embeddables, embedId);
  }

  function pickEveningEmbeddables(evening, cBand, options) {
    if (!evening) return [];
    var embeddables = DECISION_MATRIX && DECISION_MATRIX.embeddables;
    return utils.pickEmbeddables(embeddables, buildEmbedContext(evening, cBand, options), {
      scope: "evening",
      max: MAX_EMBED_OFFERS,
      exclude: isEveningEmbedDuplicated
    });
  }

  function getRecommendations(input) {
    input = input || {};
    var completed = Number(input.completedTasks) || 0;
    var total = Number(input.totalTasks) || 0;
    var evening = input.evening || {};

    // Пустой план (0 задач) — не о чём судить, карточку не показываем,
    // если день не выделился явным сигналом усталости/старта/отключения.
    var cBand = completionBand(completed, total);
    if (cBand === null && !isFatigueHigh(evening) && !isDetachmentLow(evening) && !isStartHard(evening)) {
      return [];
    }

    var completionPct = completionRate(completed, total);
    var decisionKey = resolveDecisionKey(evening, cBand);
    var morningBandKey = morningBand(input.morningScore);
    var entry = getDecisionEntry(decisionKey, completionPct, morningBandKey);
    var card = composeCardFromDecision(entry, completionPct, decisionKey);

    if (!card) return [];

    card.embedOffers = pickEveningEmbeddables(evening, cBand, input.embedOptions || {});
    return [card];
  }

  root.UpeakEveningRecommendations = {
    PLAN_LABEL: PLAN_LABEL,
    EVENING_TITLE: EVENING_TITLE,
    setEveningMatrix: setEveningMatrix,
    setDecisionMatrix: setDecisionMatrix,
    morningBand: morningBand,
    completionBand: completionBand,
    resolveDecisionKey: resolveDecisionKey,
    getRecommendations: getRecommendations,
    pickEveningEmbeddables: pickEveningEmbeddables,
    getEveningEmbeddable: getEveningEmbeddable
  };
})(typeof window !== "undefined" ? window : globalThis);
