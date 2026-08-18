"use strict";

// Собирает статичный справочник "card_id → человекочитаемое название" из
// JSON-матриц (утро + вечер, карточки + плашки), чтобы не парсить JSON руками
// при анализе Google Sheets.
//
// Результат:
//   output/recommendations-catalog.csv        — для просмотра/импорта
//   output/recommendations-catalog-seed.txt    — JS-массив для вставки в
//                                                 docs/CodeAPP.gs (сид листа
//                                                 Recommendations_Catalog)
//
// Запуск: npm run recommendations-catalog

const fs = require("fs");
const path = require("path");
const csv = require("../lib/csv");

const OUT_DIR = path.join(__dirname, "..", "output");
const OUT_CSV = path.join(OUT_DIR, "recommendations-catalog.csv");
const OUT_SEED = path.join(OUT_DIR, "recommendations-catalog-seed.txt");

// card_id остаётся техническим (для связи с событиями), title — для людей в Sheets.
const MORNING_CARD_TITLES = {
  emergency_recovery: "Восстановление",
  plateau: "Плато",
  growth: "Рост",
  single_issue: "Одна проблема",
  high: "Высокий ресурс"
};

const METRIC_TITLES = {
  sleep_hours: "сон (длительность)",
  sleep_quality: "качество сна",
  energy: "энергия",
  stress: "стресс"
};

const AXIS_TITLES = {
  sleep: "сон",
  stress: "стресс",
  energy: "энергия"
};

const PROFILE_TITLES = {
  sleep_tune: "подтянуть сон"
};

function morningCardTitle(decisionKey) {
  return MORNING_CARD_TITLES[decisionKey] || decisionKey;
}

function variantTitle(baseTitle, suffix, suffixMap) {
  var label = suffixMap[suffix] || suffix;
  return baseTitle + " — " + label;
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relPath), "utf8"));
}

function pushRow(rows, cardId, scope, kind, title) {
  rows.push({ card_id: cardId, scope: scope, kind: kind, title: title });
}

function collectMorningCardRows(dayMatrix, rows) {
  const decisions = (dayMatrix && dayMatrix.decisions) || {};

  Object.keys(decisions).forEach(function (key) {
    const base = decisions[key];
    const title = morningCardTitle(key);
    pushRow(rows, key, "morning", "card", title);

    if (key === "single_issue" && base.by_issue) {
      Object.keys(base.by_issue).forEach(function (issue) {
        pushRow(rows, key + ":" + issue, "morning", "card", variantTitle(title, issue, METRIC_TITLES));
      });
    }

    if (key === "growth" && base.by_axis) {
      Object.keys(base.by_axis).forEach(function (axis) {
        const axisBlock = base.by_axis[axis];
        if (axis === "sleep" && axisBlock.by_metric) {
          Object.keys(axisBlock.by_metric).forEach(function (metric) {
            pushRow(rows, key + ":" + metric, "morning", "card", variantTitle(title, metric, METRIC_TITLES));
          });
        } else {
          pushRow(rows, key + ":" + axis, "morning", "card", variantTitle(title, axis, AXIS_TITLES));
        }
      });
    }

    if (key === "high" && base.by_profile) {
      Object.keys(base.by_profile).forEach(function (profile) {
        pushRow(rows, key + ":" + profile, "morning", "card", variantTitle(title, profile, PROFILE_TITLES));
      });
    }
  });
}

function collectEveningCardRows(eveningMatrix, rows) {
  const decisions = (eveningMatrix && eveningMatrix.decisions) || {};
  Object.keys(decisions).forEach(function (key) {
    const base = decisions[key];
    pushRow(rows, key, "evening", "card", base.state || key);
  });
}

function collectEmbedRows(matrix, scope, rows) {
  const embeddables = (matrix && matrix.embeddables) || [];
  embeddables.forEach(function (embed) {
    if (!embed || !embed.id) return;
    pushRow(rows, embed.id, scope, "embed", embed.prompt || embed.id);
  });
}

function toCsv(rows) {
  return csv.toCsv(["card_id", "scope", "kind", "title"], rows);
}

// JS-литерал массива массивов [card_id, scope, kind, title] — вставляется в
// docs/CodeAPP.gs как значение RECOMMENDATIONS_CATALOG_SEED.
function toSeedLiteral(rows) {
  const lines = rows.map(function (row) {
    return "  [" +
      JSON.stringify(row.card_id) + ", " +
      JSON.stringify(row.scope) + ", " +
      JSON.stringify(row.kind) + ", " +
      JSON.stringify(row.title) +
      "]";
  });
  return "var RECOMMENDATIONS_CATALOG_SEED = [\n" + lines.join(",\n") + "\n];\n";
}

function main() {
  const dayMatrix = readJson("public/day-decision-matrix.json");
  const dayRecommendationMatrix = readJson("public/day-recommendation-matrix.json");
  const eveningMatrix = readJson("public/evening-decision-matrix.json");

  const rows = [];
  collectMorningCardRows(dayMatrix, rows);
  collectEmbedRows(dayRecommendationMatrix, "morning", rows);
  collectEveningCardRows(eveningMatrix, rows);
  collectEmbedRows(eveningMatrix, "evening", rows);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_CSV, toCsv(rows), "utf8");
  fs.writeFileSync(OUT_SEED, toSeedLiteral(rows), "utf8");

  console.log("Recommendations catalog: " + rows.length + " rows");
  console.log("CSV: " + OUT_CSV);
  console.log("Seed for Apps Script: " + OUT_SEED);
}

main();
