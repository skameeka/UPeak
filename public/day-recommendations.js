(function (root) {
  "use strict";

  var utils = root.UpeakRecommendationUtils ||
    (typeof require === "function" ? require("./recommendation-utils.js") : null);

  var PLAN_LABEL = "Рекомендуем";

  var SECTION_LABELS = {
    diagnosis: "Диагноз",
    impact: "Что это значит",
    plan: PLAN_LABEL,
    benefit: "Почему это важно",
    specifics: "Попробуй сегодня",
    today: "Что сегодня",
    meaning: "Что это значит",
    consequence: "Если не скорректировать",
    reduce: "Уменьшить",
    leverage: "Использовать",
    why: "Почему",
    evidence: "Основано на"
  };

  var METRIC_LABELS = {
    sleep_hours: "сон (длительность)",
    sleep_quality: "качество сна",
    energy: "энергия",
    stress: "стресс"
  };

  var STATE_LABELS = {
    emergency_recovery: "Экстренное восстановление",
    recovery: "Восстановление",
    plateau: "Плато",
    normal: "Норма",
    normal_borderline: "Норма · пограничное",
    high_performance: "Высокая производительность",
    single_issue: "Одна проблема",
    mixed: "Смешанное состояние",
    mixed_severe: "Смешанное · тяжёлое"
  };

  var VISIBLE_BLOCKS = {
    emergency_recovery: ["today", "meaning", "consequence", "plan", "why", "evidence"],
    mixed_severe: ["today", "meaning", "consequence", "plan", "why", "evidence"],
    recovery: ["today", "meaning", "plan", "why", "evidence"],
    mixed: ["today", "meaning", "plan", "why", "evidence"],
    single_issue: ["today", "meaning", "plan", "why", "evidence"],
    normal: ["today", "plan"],
    normal_borderline: ["today", "plan"],
    plateau: ["today", "plan"],
    high_performance: ["today", "plan"]
  };

  var RECOMMENDATION_MATRIX = null;
  var DECISION_MATRIX = null;

  var MAX_EMBED_OFFERS = 2;

  var STATE_OVERRIDES = {
    emergency_recovery: {
      today: "Сон, энергия и стресс сегодня очень низкие — ресурс на исходе.",
      meaning: "Концентрация, терпение и качество решений сегодня, скорее всего, заметно ниже обычного.",
      consequence: "Если не снизить нагрузку, к вечеру выше риск ошибок, раздражительности и срыва планов.",
      plan: {
        reduce: [
          "Оставь в списке только 1 важную задачу",
          "Отложи всё несрочное",
          "Ляг спать раньше обычного"
        ],
        leverage: []
      },
      why: "Когда несколько ресурсов истощены, падают самоконтроль и качество решений — восстановление важнее продуктивности.",
      benefit: "Так ты сохранишь ресурс и повысишь вероятность сильного рабочего дня завтра вместо накопления усталости.",
      specifics: [
        "оставить в плане только 1 важную задачу",
        "перенести одну тяжёлую задачу на завтра",
        "лечь спать на 30–40 минут раньше"
      ],
      evidence_level: "Высокая",
      sources: [
        {
          title: "The Role of Sleep and the Effects of Sleep Loss on Cognitive, Affective, and Behavioral Processes",
          year: null,
          url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12168795/"
        }
      ],
      limitations: ["Это общая рекомендация, а не медицинская оценка."]
    },
    mixed_severe: {
      today: "Одна зона в критическом минимуме и тянет остальное вниз.",
      meaning: "Фокус и точность сегодня будут хуже обычного — особенно на сложных задачах.",
      consequence: "Если не упростить план, накопишь ошибки и усталость быстрее, чем обычно.",
      plan: {
        reduce: [
          "Сократи список до 1–2 задач",
          "Не пытайся закрыть всё",
          "Добавь короткую паузу между блоками"
        ],
        leverage: []
      },
      why: "Когда один ресурс сильно просел, короткий список снижает нагрузку на внимание.",
      benefit: "Так ты не потратишь остаток ресурса на борьбу с перегрузом — и завтра будет проще вернуться в ритм.",
      specifics: [
        "сократить список до 1–2 задач",
        "сделать короткую паузу между блоками",
        "не брать новые дела «на вечер»"
      ],
      evidence_level: "Высокая",
      sources: [
        {
          title: "Decision-making under stress: A psychological and neurobiological integrative model",
          year: null,
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11061251/"
        }
      ],
      limitations: ["Реакция зависит от типа задач и контекста."]
    }
  };

  var METRIC_TO_AXIS = {
    sleep_hours: "sleep",
    sleep_quality: "sleep",
    energy: "energy",
    stress: "stress"
  };

  var METRIC_PRIORITY = ["sleep_hours", "sleep_quality", "energy", "stress"];
  var AXIS_PRIORITY = ["sleep", "energy", "stress"];
  var GROWTH_AXIS_ORDER = ["sleep", "stress", "energy"];
  var PLATEAU_AND_ABOVE = ["plateau", "normal", "normal_borderline", "high_performance"];
  var DEFAULT_FOCUS_METRIC = "energy";

  function setRecommendationMatrix(data) {
    RECOMMENDATION_MATRIX = data && typeof data === "object" ? data : null;
    if (RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.meta && RECOMMENDATION_MATRIX.meta.plan_label) {
      PLAN_LABEL = RECOMMENDATION_MATRIX.meta.plan_label;
      SECTION_LABELS.plan = PLAN_LABEL;
    }
  }

  function setDecisionMatrix(data) {
    DECISION_MATRIX = data && data.decisions ? data : null;
  }

  function highDecisionMetricValues(metrics) {
    if (!metrics) return [];
    return [
      Number(metrics.sleep_hours),
      Number(metrics.sleep_quality),
      Number(metrics.energy),
      Number(metrics.stress)
    ];
  }

  // High: ≥2 метрик на 5, остальные не ниже 4 (сон 4+4 при энергии/стрессе 5 — ок).
  function qualifiesForHighDecision(metrics) {
    var values = highDecisionMetricValues(metrics);
    if (values.length !== 4) return false;
    if (values.some(function (v) { return !Number.isFinite(v) || v < 4; })) return false;
    var fives = values.filter(function (v) { return v >= 5; }).length;
    return fives >= 2;
  }

  function resolveDecisionKey(dayState) {
    if (!dayState) return null;
    if (dayState.sub_state === "mixed_severe") return "emergency_recovery";
    if (dayState.state === "emergency_recovery" || dayState.state === "recovery") return "emergency_recovery";
    if (dayState.state === "mixed") return "emergency_recovery";
    if (dayState.state === "plateau" || dayState.state === "normal") return "plateau";
    if (dayState.state === "single_issue") return "single_issue";
    if (dayState.state === "high_performance") {
      if (qualifiesForHighDecision(dayState.metrics)) return "high";
      return "growth";
    }
    return "plateau";
  }

  function shallowCopyDecision(entry) {
    var copy = Object.assign({}, entry);
    if (Array.isArray(entry.today_action)) copy.today_action = entry.today_action.slice();
    if (Array.isArray(entry.avoid)) copy.avoid = entry.avoid.slice();
    if (entry.evidence) {
      copy.evidence = Object.assign({}, entry.evidence);
      if (Array.isArray(entry.evidence.sources)) {
        copy.evidence.sources = entry.evidence.sources.slice();
      }
    }
    return copy;
  }

  function pickGrowthSleepMetric(dayState) {
    if (!dayState || !dayState.metrics) return "sleep_hours";
    var hours = Number(dayState.metrics.sleep_hours);
    var quality = Number(dayState.metrics.sleep_quality);
    if (!Number.isFinite(hours) || !Number.isFinite(quality)) return "sleep_hours";
    if (hours >= 4 && quality < 5) return "sleep_quality";
    if (hours < quality) return "sleep_hours";
    if (quality < hours) return "sleep_quality";
    return hours <= 3 ? "sleep_hours" : "sleep_quality";
  }

  function qualifiesSleepTune(dayState, decisionKey) {
    var sleepWorst = axisWorstValue(dayState, "sleep");
    if (sleepWorst === null || sleepWorst < 4 || sleepWorst >= 5) return false;
    if (decisionKey === "high") return true;
    return decisionKey === "growth" && pickGrowthAxis(dayState) === "sleep";
  }

  function personalizeGrowthEntry(base, dayState) {
    var entry = shallowCopyDecision(base);
    var axis = pickGrowthAxis(dayState);
    if (axis && base.by_axis && base.by_axis[axis]) {
      var axisBlock = base.by_axis[axis];
      if (axis === "sleep" && axisBlock.by_metric) {
        var metricKey = pickGrowthSleepMetric(dayState);
        var metricBlock = axisBlock.by_metric[metricKey];
        if (metricBlock) axisBlock = Object.assign({}, axisBlock, metricBlock);
        if (qualifiesSleepTune(dayState, "growth")) {
          axisBlock = Object.assign({}, axisBlock, {
            state_text: "Сон чуть короче идеала — вечером добери, днём начни со сложного блока."
          });
          delete axisBlock.focus_action;
        }
      }
      if (axisBlock.state_text) entry.state_text = axisBlock.state_text;
      if (axisBlock.focus_action) {
        var metrics = dayState.metrics || {};
        var workFirst = Number(metrics.energy) >= 4 && Number(metrics.stress) >= 4;
        if (workFirst) {
          entry.today_action = uniqueList((base.today_action || []).concat([axisBlock.focus_action]), 2);
        } else {
          entry.today_action = uniqueList([axisBlock.focus_action].concat(base.today_action || []), 2);
        }
      }
    }
    return entry;
  }

  function personalizeSingleIssueEntry(base, dayState) {
    var entry = shallowCopyDecision(base);
    var issue = dayState.primary_issue;
    if (issue && base.by_issue && base.by_issue[issue]) {
      var issueBlock = base.by_issue[issue];
      entry = Object.assign({}, entry, issueBlock);
      if (!issueBlock.today_action) entry.today_action = base.today_action.slice();
      if (!issueBlock.avoid) entry.avoid = base.avoid.slice();
    }
    return entry;
  }

  function highSleepNeedsTune(metrics) {
    if (!metrics) return false;
    return Number(metrics.sleep_hours) < 5 || Number(metrics.sleep_quality) < 5;
  }

  function personalizeHighEntry(base, dayState) {
    var entry = shallowCopyDecision(base);
    var metrics = dayState && dayState.metrics;
    if (!highSleepNeedsTune(metrics)) return entry;

    var profile = base.by_profile && base.by_profile.sleep_tune;
    if (profile) {
      if (profile.state_text) entry.state_text = profile.state_text;
      if (profile.expected_gain) entry.expected_gain = profile.expected_gain;
      if (profile.why) entry.why = profile.why;
      if (profile.decision) entry.decision = profile.decision;
    } else {
      entry.state_text = "Сильный день — энергия и стресс в порядке, сон чуть ниже идеала.";
      entry.expected_gain =
        "Сегодня: +10–20% на сложных задачах. Завтра: +5–10% к ресурсу, если вечером доберёшь сон.";
    }
    return entry;
  }

  function getDecisionEntry(dayState, decisionKey) {
    if (!DECISION_MATRIX || !DECISION_MATRIX.decisions) return null;
    decisionKey = decisionKey || resolveDecisionKey(dayState);
    var base = DECISION_MATRIX.decisions[decisionKey];
    if (!base) return null;
    if (decisionKey === "growth") return personalizeGrowthEntry(base, dayState);
    if (decisionKey === "single_issue") return personalizeSingleIssueEntry(base, dayState);
    if (decisionKey === "high") return personalizeHighEntry(base, dayState);
    return shallowCopyDecision(base);
  }

  // Уточнённый идентификатор карточки для аналитики/фидбэка: decision_key
  // сам по себе не различает варианты внутри single_issue/growth/high —
  // card_id добавляет ось/метрику, чтобы в таблице было видно, какой именно
  // текст видел человек.
  function buildCardId(dayState, decisionKey) {
    if (decisionKey === "single_issue") {
      var issue = dayState && dayState.primary_issue;
      return issue ? decisionKey + ":" + issue : decisionKey;
    }
    if (decisionKey === "growth") {
      var axis = pickGrowthAxis(dayState);
      if (!axis) return decisionKey;
      if (axis === "sleep") return decisionKey + ":" + pickGrowthSleepMetric(dayState);
      return decisionKey + ":" + axis;
    }
    if (decisionKey === "high" && highSleepNeedsTune(dayState && dayState.metrics)) {
      return decisionKey + ":sleep_tune";
    }
    return decisionKey;
  }

  function cardToneFromDecisionKey(key) {
    if (key === "high" || key === "growth") return "growth";
    if (key === "emergency_recovery") return "recovery";
    return "steady";
  }

  function composeCardFromDecision(dayState, map, entry, decisionKey) {
    var actions = uniqueList(entry.today_action || [], 2);
    if (!actions.length) return null;

    var avoid = uniqueList(entry.avoid || [], 2);
    var stateText = entry.state_text || entry.state || "";
    var proof = utils.buildProofFromEvidence(entry);
    var hasProof = utils.hasProof(proof);

    return {
      tone: cardToneFromDecisionKey(decisionKey),
      state: stateText,
      state_title: entry.state || "",
      decision: entry.decision || "",
      actions: actions,
      avoid: avoid,
      move_to_max: entry.move_to_max || null,
      benefit: entry.why || "",
      result: entry.expected_gain || "",
      result_condition: RESULT_CONDITION,
      result_disclaimer: RESULT_DISCLAIMER,
      proof: proof,
      show_proof: hasProof,
      why: proof,
      show_why: hasProof,
      plan_label: "Сегодня",
      diagnosis: stateText,
      summary: stateText,
      today: stateText,
      text: stateText,
      state_label: entry.state || getStateLabel(dayState),
      focus_axis: map.focus_axis,
      mode: decisionKey,
      decision_key: decisionKey,
      card_id: buildCardId(dayState, decisionKey)
    };
  }

  function metricToAxis(name) {
    return METRIC_TO_AXIS[name] || "energy";
  }

  function getMetricValue(dayState, metricName) {
    if (!dayState || !dayState.metrics || !metricName) return null;
    return Number(dayState.metrics[metricName]);
  }

  function axisWorstValue(dayState, axis) {
    if (!dayState || !dayState.metrics || !axis) return null;
    var metrics = dayState.metrics;
    var worst = null;
    METRIC_PRIORITY.forEach(function (name) {
      if (metricToAxis(name) !== axis) return;
      var value = Number(metrics[name]);
      if (!Number.isFinite(value)) return;
      if (worst === null || value < worst) worst = value;
    });
    return worst;
  }

  function resourceBandFromValue(value) {
    var v = Number(value);
    if (!Number.isFinite(v)) return "medium";
    if (v <= 2) return "min";
    if (v <= 3) return "medium";
    return "max";
  }

  function matrixBandKey(axis, resourceBand) {
    if (axis === "stress") {
      if (resourceBand === "min") return "high";
      if (resourceBand === "max") return "low";
      return "medium";
    }
    if (resourceBand === "min") return "low";
    if (resourceBand === "max") return "high";
    return "medium";
  }

  function getMatrixEntry(axis, resourceBand) {
    if (!RECOMMENDATION_MATRIX || !axis) return null;
    var axisBlock = RECOMMENDATION_MATRIX[axis];
    if (!axisBlock) return null;
    return axisBlock[matrixBandKey(axis, resourceBand)] || null;
  }

  function getSnippets() {
    if (RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.meta && RECOMMENDATION_MATRIX.meta.snippets) {
      return RECOMMENDATION_MATRIX.meta.snippets;
    }
    return {
      sleep: { low: "сон короткий", medium: "сон средний", high: "сон хороший" },
      energy: { low: "мало энергии", medium: "энергии хватает", high: "много энергии" },
      stress: { low: "стресс низкий", medium: "стресс умеренный", high: "стресс высокий" }
    };
  }

  function axisSnippet(axis, resourceBand) {
    var snippets = getSnippets();
    var axisSnippets = snippets[axis] || {};
    var key = matrixBandKey(axis, resourceBand);
    return axisSnippets[key] || null;
  }

  function primarySource(sources) {
    if (!Array.isArray(sources) || !sources.length) return null;
    return sources[0];
  }

  function buildWhy(entry) {
    if (!entry || !entry.why) return null;
    var src = primarySource(entry.sources);
    return {
      text: entry.why,
      evidence_level: entry.evidence_level || null,
      limitations: Array.isArray(entry.limitations) ? entry.limitations.slice() : null,
      sources: Array.isArray(entry.sources) ? entry.sources.slice() : null,
      source: utils.formatSourceLabel(src),
      url: src && src.url ? src.url : null
    };
  }

  function whyEntryEvidenceLevel(entry) {
    return entry && entry.evidence_level ? entry.evidence_level : null;
  }

  function pickLowestMetric(metrics) {
    if (!metrics) return "energy";
    var min = 5;
    METRIC_PRIORITY.forEach(function (name) {
      var v = Number(metrics[name]);
      if (Number.isFinite(v) && v < min) min = v;
    });
    var tied = METRIC_PRIORITY.filter(function (name) {
      return Number(metrics[name]) === min;
    });
    return tied[0] || "energy";
  }

  function resolveTemplateKey(dayState) {
    if (!dayState) return null;
    if (dayState.sub_state === "mixed_severe") return "mixed_severe";
    if (dayState.sub_state === "borderline") return "normal_borderline";
    return dayState.state;
  }

  function resolveFocusMetric(dayState) {
    if (dayState.primary_issue) return dayState.primary_issue;
    if (dayState.target_metric) return dayState.target_metric;
    if (dayState.state === "high_performance") return DEFAULT_FOCUS_METRIC;
    if (dayState.state === "normal" && dayState.sub_state !== "borderline") {
      return DEFAULT_FOCUS_METRIC;
    }
    return pickLowestMetric(dayState.metrics);
  }

  function resolveContentMapping(dayState) {
    var focusMetric = resolveFocusMetric(dayState);
    var focusAxis = metricToAxis(focusMetric);
    var focusValue = axisWorstValue(dayState, focusAxis);
    if (focusValue === null) focusValue = getMetricValue(dayState, focusMetric);
    return {
      state: dayState.state,
      sub_state: dayState.sub_state,
      template_key: resolveTemplateKey(dayState),
      focus_metric: focusMetric,
      focus_axis: focusAxis,
      focus_value: focusValue,
      resource_band: resourceBandFromValue(focusValue),
      primary_issue: dayState.primary_issue || null,
      secondary_issue: dayState.secondary_issue || null,
      target_metric: dayState.target_metric || null
    };
  }

  function visibleBlocksFor(templateKey) {
    return (VISIBLE_BLOCKS[templateKey] || VISIBLE_BLOCKS.normal).slice();
  }

  function isAxisNotable(dayState, axis, map, leverageAxes) {
    var band = resourceBandFromValue(axisWorstValue(dayState, axis));
    leverageAxes = leverageAxes || [];
    if (band === "min") return true;
    if (leverageAxes.indexOf(axis) !== -1) return true;
    if (map.state === "plateau" && band === "medium") return true;
    if (map.state === "high_performance" && band === "max") return true;
    return false;
  }

  function buildTodaySummary(dayState, map, leverageAxes) {
    var parts = [];
    var notableCount = 0;

    AXIS_PRIORITY.forEach(function (axis) {
      if (!isAxisNotable(dayState, axis, map, leverageAxes)) return;
      var band = resourceBandFromValue(axisWorstValue(dayState, axis));
      var snippet = axisSnippet(axis, band);
      if (snippet) {
        parts.push(snippet);
        notableCount += 1;
      }
    });

    if (!parts.length) {
      return "Сон, энергия и стресс сегодня на среднем уровне.";
    }

    var summary = parts.join(", ");
    if (notableCount < AXIS_PRIORITY.length && map.state !== "plateau") {
      summary += " — остальное в норме";
    }
    return summary.charAt(0).toUpperCase() + summary.slice(1) + ".";
  }

  function collectLeverageAxes(dayState, map) {
    if (map.resource_band === "max") return [];
    if (map.focus_axis === "stress" && map.resource_band === "min") return [];

    var axes = [];
    AXIS_PRIORITY.forEach(function (axis) {
      if (axis === map.focus_axis) return;
      if (axis === "stress") return;
      var band = resourceBandFromValue(axisWorstValue(dayState, axis));
      if (band === "max") axes.push(axis);
    });
    return axes;
  }

  function uniqueList(items, limit) {
    var seen = {};
    var out = [];
    items.forEach(function (item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out.slice(0, limit || 4);
  }

  function composePlan(dayState, map, primaryEntry) {
    var reduce = [];
    var leverage = [];

    if (primaryEntry && primaryEntry.plan) {
      if (Array.isArray(primaryEntry.plan.reduce)) reduce = primaryEntry.plan.reduce.slice();
      if (Array.isArray(primaryEntry.plan.leverage)) leverage = primaryEntry.plan.leverage.slice();
    }

    collectLeverageAxes(dayState, map).forEach(function (axis) {
      var entry = getMatrixEntry(axis, "max");
      if (!entry || !entry.plan || !Array.isArray(entry.plan.leverage)) return;
      leverage = leverage.concat(entry.plan.leverage);
    });

    return {
      label: PLAN_LABEL,
      reduce: uniqueList(reduce, 4),
      leverage: uniqueList(leverage, 3)
    };
  }

  function flattenActions(plan, max) {
    if (!plan) return [];
    var items = [];
    if (Array.isArray(plan.reduce)) items = items.concat(plan.reduce);
    if (Array.isArray(plan.leverage)) items = items.concat(plan.leverage);
    return uniqueList(items, max || 3);
  }

  function isPlateauOrAbove(state) {
    return PLATEAU_AND_ABOVE.indexOf(state) !== -1;
  }

  function growthAxisOrder() {
    if (RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.meta &&
        Array.isArray(RECOMMENDATION_MATRIX.meta.growth_axis_order)) {
      return RECOMMENDATION_MATRIX.meta.growth_axis_order.slice();
    }
    return GROWTH_AXIS_ORDER.slice();
  }

  function pickGrowthAxis(dayState) {
    if (!dayState || !dayState.metrics) return null;
    var order = growthAxisOrder();
    for (var i = 0; i < order.length; i++) {
      var axis = order[i];
      var value = axisWorstValue(dayState, axis);
      if (value !== null && value < 5) return axis;
    }
    return null;
  }

  function shouldUseGrowthMode(dayState, map) {
    if (!isPlateauOrAbove(map.state)) return false;
    if (["emergency_recovery", "recovery", "mixed", "mixed_severe", "single_issue"].indexOf(map.state) !== -1) {
      return false;
    }
    return pickGrowthAxis(dayState) !== null;
  }

  function applyRecommendationMode(dayState, map) {
    var next = Object.assign({}, map);
    if (shouldUseGrowthMode(dayState, map)) {
      var growthAxis = pickGrowthAxis(dayState);
      var growthValue = axisWorstValue(dayState, growthAxis);
      next.focus_axis = growthAxis;
      next.focus_value = growthValue;
      next.resource_band = resourceBandFromValue(growthValue);
      next.mode = "growth";
      return next;
    }
    if (map.resource_band === "min" ||
        ["emergency_recovery", "recovery", "mixed", "mixed_severe"].indexOf(map.state) !== -1) {
      next.mode = "recovery";
      return next;
    }
    if (map.state === "high_performance" && pickGrowthAxis(dayState) === null) {
      next.mode = "high";
      return next;
    }
    next.mode = "steady";
    return next;
  }

  function getGrowthEntry(axis) {
    if (!RECOMMENDATION_MATRIX || !RECOMMENDATION_MATRIX.growth || !axis) return null;
    return RECOMMENDATION_MATRIX.growth[axis] || null;
  }

  function getContentEntry(map, override) {
    if (override) return override;
    if (map.mode === "growth") {
      var growthEntry = getGrowthEntry(map.focus_axis);
      if (growthEntry) return growthEntry;
    }
    return getMatrixEntry(map.focus_axis, map.resource_band);
  }

  function growthAxisLabel(axis) {
    var labels = {
      sleep: "сон",
      stress: "управление стрессом",
      energy: "энергию"
    };
    return labels[axis] || "одну зону";
  }

  function buildDiagnosis(dayState, map, entry, leverageAxes) {
    if (entry && entry.today) return String(entry.today).trim();
    if (map.mode === "growth") {
      return "Сегодня ресурс ровный — можно точечно усилить " + growthAxisLabel(map.focus_axis) + ".";
    }
    var summary = buildTodaySummary(dayState, map, leverageAxes);
    if (summary && map.mode !== "high") return summary;
    if (map.mode === "recovery" || map.resource_band === "min") {
      return "Сегодня уровень восстановления ниже твоей нормы.";
    }
    if (map.mode === "high") {
      return "Сегодня высокий ресурс и хорошая готовность к сложной работе.";
    }
    return summary || "Сегодня ресурс на среднем уровне — важно не перегрузить день.";
  }

  function getPercentRange(entry, map) {
    if (entry && Array.isArray(entry.percent_range) && entry.percent_range.length >= 2) {
      return entry.percent_range.slice();
    }
    var matrixEntry = getMatrixEntry(map.focus_axis, map.resource_band);
    if (matrixEntry && Array.isArray(matrixEntry.percent_range)) {
      return matrixEntry.percent_range.slice();
    }
    if (map.mode === "growth") {
      var highEntry = getMatrixEntry(map.focus_axis, "max");
      if (highEntry && Array.isArray(highEntry.percent_range)) return highEntry.percent_range.slice();
      return [5, 15];
    }
    return null;
  }

  function buildResult(entry, map) {
    var range = getPercentRange(entry, map);
    if (!range) return "";
    var lo = Number(range[0]);
    var hi = Number(range[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "";
    var absLo = Math.min(Math.abs(lo), Math.abs(hi));
    var absHi = Math.max(Math.abs(lo), Math.abs(hi));

    if (map.mode === "growth") {
      return "По данным исследований, улучшение " + growthAxisLabel(map.focus_axis) +
        " может поднять концентрацию и качество решений примерно на " + absLo + "–" + absHi + "%.";
    }
    if (lo <= 0 && hi <= 0) {
      return "В таком состоянии концентрация и продуктивность могут быть ниже обычного примерно на " +
        absLo + "–" + absHi + "%. Восстановление может вернуть этот запас.";
    }
    if (lo >= 0 && hi >= 0) {
      return "При таком восстановлении исследования связывают потенциал концентрации и качества решений с диапазоном примерно +" +
        lo + "–" + hi + "%.";
    }
    return "Потенциальный эффект от корректировки дня — в диапазоне примерно " + lo + "–" + hi + "%.";
  }

  var RESULT_CONDITION = "Ориентир по эффекту (сегодня — если не указано «завтра»):";
  var RESULT_DISCLAIMER = utils.RESULT_DISCLAIMER;

  function buildImpact(entry, map) {
    if (!entry) return "";
    if (entry.meaning) return String(entry.meaning).trim();
    if (map.mode === "recovery" && entry.consequence) return String(entry.consequence).trim();
    return "";
  }

  function buildBenefit(entry, map) {
    if (entry && entry.benefit) return String(entry.benefit).trim();
    if (map.mode === "recovery") {
      return "Так ты сохранишь ресурс и повысишь вероятность сильного рабочего дня завтра вместо накопления усталости.";
    }
    if (map.mode === "growth") {
      return "Точечное улучшение одной зоны — инвестиция в устойчивую продуктивность: чем больше восстановление, тем эффективнее ты работаешь.";
    }
    if (entry && entry.why) {
      return "Так ты с большей вероятностью выполнишь важные задачи без ощущения перегрузки.";
    }
    return "Так ты с большей вероятностью выполнишь важные задачи без ощущения перегрузки.";
  }

  function buildSpecifics(entry, actions) {
    if (entry && Array.isArray(entry.specifics) && entry.specifics.length) {
      return uniqueList(entry.specifics, 3);
    }
    return uniqueList(actions, 3);
  }

  function cardTone(map) {
    if (map.mode === "high" || map.mode === "growth") return "growth";
    if (map.mode === "recovery") return "recovery";
    return "steady";
  }

  function shortHint(card, visible) {
    if (visible.indexOf("consequence") !== -1 && card.consequence) return card.consequence;
    if (visible.indexOf("meaning") !== -1 && card.meaning) {
      var m = String(card.meaning).trim();
      var dot = m.indexOf(".");
      return dot > 0 ? m.slice(0, dot + 1) : m;
    }
    return "";
  }

  function composeCard(dayState, map, override) {
    var activeMap = applyRecommendationMode(dayState, map);
    var visible = visibleBlocksFor(activeMap.template_key);
    var primaryEntry = getContentEntry(activeMap, override || null);
    if (!primaryEntry && !override) return null;

    var leverageAxes = collectLeverageAxes(dayState, activeMap);
    var plan = composePlan(dayState, activeMap, primaryEntry);
    var actions = flattenActions(plan, 3);
    if (!actions.length) return null;

    var contentEntry = primaryEntry || override;
    var diagnosis = buildDiagnosis(dayState, activeMap, contentEntry, leverageAxes);
    var impact = buildImpact(primaryEntry, activeMap);
    var benefit = buildBenefit(contentEntry, activeMap);
    var result = buildResult(contentEntry, activeMap);
    var specifics = buildSpecifics(contentEntry, actions);
    var tone = cardTone(activeMap);

    var proof = buildWhy(contentEntry);
    var hasProof = utils.hasProof(proof);

    return {
      visible_blocks: visible,
      tone: tone,
      state: diagnosis,
      diagnosis: diagnosis,
      impact: impact,
      actions: actions,
      benefit: benefit,
      result: result,
      result_condition: RESULT_CONDITION,
      result_disclaimer: RESULT_DISCLAIMER,
      proof: proof,
      show_proof: hasProof,
      why_text: proof && proof.text ? proof.text : "",
      specifics: specifics,
      plan_label: PLAN_LABEL,
      today: diagnosis,
      summary: diagnosis,
      hint: impact,
      show_why: hasProof,
      why: proof,
      evidence_level: whyEntryEvidenceLevel(contentEntry),
      state_label: getStateLabel(dayState),
      focus_axis: activeMap.focus_axis,
      mode: activeMap.mode,
      text: diagnosis
    };
  }

  function buildEmbedContext(dayState, options) {
    options = options || {};
    var sleepWorst = axisWorstValue(dayState, "sleep");
    var sleepHours = getMetricValue(dayState, "sleep_hours");
    var stressValue = getMetricValue(dayState, "stress");
    var energyValue = getMetricValue(dayState, "energy");
    var energyWorst = axisWorstValue(dayState, "energy");
    var decisionKey = resolveDecisionKey(dayState);

    return {
      sleep_low: sleepWorst !== null && sleepWorst <= 2,
      // Есть запас по длительности сна (< ~7.5 ч). При уже максимальных часах
      // «лечь раньше» не предлагаем — только качество (прогулка и т.п.).
      sleep_hours_room: sleepHours !== null && sleepHours < 5,
      stress_high: stressValue !== null && stressValue <= 2,
      energy_low: energyWorst !== null && energyWorst <= 2,
      recovery_day: decisionKey === "emergency_recovery" || dayState.state === "recovery",
      plateau_day: decisionKey === "plateau",
      growth_day: decisionKey === "growth",
      high_day: decisionKey === "high",
      sleep_tune: qualifiesSleepTune(dayState, decisionKey),
      single_issue: dayState.state === "single_issue",
      stress_issue: dayState.state === "single_issue" && dayState.primary_issue === "stress",
      decisions: options.decisions || {},
      existingIds: Array.isArray(options.existingIds) ? options.existingIds : []
    };
  }

  function getMorningEmbeddable(embedId) {
    return utils.findEmbeddableById(RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.embeddables, embedId);
  }

  function pickMorningEmbeddables(dayState, options) {
    if (!dayState) return [];
    var embeddables = RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.embeddables;
    return utils.pickEmbeddables(embeddables, buildEmbedContext(dayState, options), {
      scope: "morning",
      max: MAX_EMBED_OFFERS
    });
  }

  function getRecommendations(dayState, options) {
    if (!dayState || !dayState.state) return [];

    var map = resolveContentMapping(dayState);
    var decisionKey = resolveDecisionKey(dayState);
    var decisionEntry = getDecisionEntry(dayState, decisionKey);
    var card = null;

    if (decisionEntry) {
      card = composeCardFromDecision(dayState, map, decisionEntry, decisionKey);
    }
    if (!card) {
      var override = STATE_OVERRIDES[map.template_key];
      card = composeCard(dayState, map, override || null);
    }

    if (!card || !card.actions.length) return [];

    card.embedOffers = pickMorningEmbeddables(dayState, options);
    return [card];
  }

  function getStateLabel(dayState) {
    if (!dayState) return "";
    var key = resolveTemplateKey(dayState);
    return STATE_LABELS[key] || STATE_LABELS[dayState.state] || dayState.state;
  }

  root.UpeakDayRecommendations = {
    PLAN_LABEL: PLAN_LABEL,
    SECTION_LABELS: SECTION_LABELS,
    VISIBLE_BLOCKS: VISIBLE_BLOCKS,
    METRIC_LABELS: METRIC_LABELS,
    STATE_LABELS: STATE_LABELS,
    STATE_OVERRIDES: STATE_OVERRIDES,
    METRIC_TO_AXIS: METRIC_TO_AXIS,
    DEFAULT_FOCUS_METRIC: DEFAULT_FOCUS_METRIC,
    setRecommendationMatrix: setRecommendationMatrix,
    setDecisionMatrix: setDecisionMatrix,
    resolveDecisionKey: resolveDecisionKey,
    qualifiesForHighDecision: qualifiesForHighDecision,
    flattenActions: flattenActions,
    resourceBandFromValue: resourceBandFromValue,
    matrixBandKey: matrixBandKey,
    axisWorstValue: axisWorstValue,
    resolveContentMapping: resolveContentMapping,
    buildTodaySummary: buildTodaySummary,
    visibleBlocksFor: visibleBlocksFor,
    getRecommendations: getRecommendations,
    pickMorningEmbeddables: pickMorningEmbeddables,
    getMorningEmbeddable: getMorningEmbeddable,
    pickGrowthAxis: pickGrowthAxis,
    applyRecommendationMode: applyRecommendationMode,
    getStateLabel: getStateLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
