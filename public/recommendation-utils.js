(function (root) {
  "use strict";

  // Общие для утренних и вечерних рекомендаций утилиты: доказательная база
  // карточек и отбор встраиваемых плашек (embeddables).

  var RESULT_DISCLAIMER = "Ориентировочная оценка, не гарантия — зависит от контекста и задач.";

  var EVIDENCE_LEVEL_LABELS = {
    High: "Высокая",
    Medium: "Средняя",
    Low: "Низкая"
  };

  function formatSourceLabel(src) {
    if (!src) return null;
    return src.title +
      (src.authors ? " — " + src.authors : "") +
      (src.year ? " (" + src.year + ")" : "");
  }

  function buildProofFromEvidence(entry) {
    if (!entry || !entry.evidence) return null;
    var ev = entry.evidence;
    if (!ev.basis && !ev.level && !(Array.isArray(ev.sources) && ev.sources.length)) return null;
    var sources = Array.isArray(ev.sources) ? ev.sources.slice() : [];
    var primary = sources.length ? sources[0] : null;
    return {
      text: ev.basis || "",
      evidence_level: EVIDENCE_LEVEL_LABELS[ev.level] || ev.level || null,
      limitations: [RESULT_DISCLAIMER],
      sources: sources,
      source: formatSourceLabel(primary),
      url: primary && primary.url ? primary.url : null
    };
  }

  function hasProof(proof) {
    return !!(proof && (proof.text || (proof.sources && proof.sources.length)));
  }

  function matchesEmbedWhen(when, ctx) {
    if (!when || typeof when !== "object") return true;
    if (Array.isArray(when.any)) {
      return when.any.some(function (key) {
        return !!ctx[key];
      });
    }
    return Object.keys(when).every(function (key) {
      return !when[key] || !!ctx[key];
    });
  }

  // Плашка с "unless" не показывается, если хотя бы один из перечисленных
  // сигналов активен — даже если её собственное "when" тоже совпало.
  // Пример: не предлагаем "первый шаг", если карточка уже про усталость.
  function matchesEmbedUnless(unless, ctx) {
    if (!Array.isArray(unless) || !unless.length) return true;
    return !unless.some(function (key) {
      return !!ctx[key];
    });
  }

  function embedStatus(offerId, ctx, scope) {
    if (ctx.decisions[offerId] === "added") return "added";
    if (ctx.existingIds.indexOf(scope + ":" + offerId) !== -1) return "added";
    if (ctx.decisions[offerId] === "later") return "later";
    return "pending";
  }

  function findEmbeddableById(embeddables, embedId) {
    if (!Array.isArray(embeddables)) return null;
    for (var i = 0; i < embeddables.length; i++) {
      if (embeddables[i].id === embedId) return embeddables[i];
    }
    return null;
  }

  // options: { scope, max, exclude(offer, ctx) } — scope задаёт префикс
  // существующих id ("morning" / "evening"), exclude — дополнительный фильтр.
  function pickEmbeddables(embeddables, ctx, options) {
    if (!Array.isArray(embeddables) || !embeddables.length) return [];
    var opts = options || {};
    var exclude = typeof opts.exclude === "function" ? opts.exclude : null;

    return embeddables
      .filter(function (offer) {
        if (!offer || !offer.id) return false;
        var status = embedStatus(offer.id, ctx, opts.scope);
        if (status === "later" || status === "added") return false;
        if (exclude && exclude(offer, ctx)) return false;
        if (!matchesEmbedUnless(offer.unless, ctx)) return false;
        return matchesEmbedWhen(offer.when, ctx);
      })
      .sort(function (a, b) {
        return (a.priority || 99) - (b.priority || 99);
      })
      .slice(0, opts.max)
      .map(function (offer) {
        return {
          id: offer.id,
          prompt: offer.prompt || "",
          detail: offer.detail || "",
          status: embedStatus(offer.id, ctx, opts.scope),
          task: offer.task ? Object.assign({}, offer.task) : null
        };
      });
  }

  var api = {
    RESULT_DISCLAIMER: RESULT_DISCLAIMER,
    EVIDENCE_LEVEL_LABELS: EVIDENCE_LEVEL_LABELS,
    formatSourceLabel: formatSourceLabel,
    buildProofFromEvidence: buildProofFromEvidence,
    hasProof: hasProof,
    matchesEmbedWhen: matchesEmbedWhen,
    matchesEmbedUnless: matchesEmbedUnless,
    embedStatus: embedStatus,
    findEmbeddableById: findEmbeddableById,
    pickEmbeddables: pickEmbeddables
  };

  root.UpeakRecommendationUtils = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
