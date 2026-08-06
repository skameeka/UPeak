"use strict";

const fs = require("fs");
const path = require("path");
const dayState = require("../lib/day-state");
const csv = require("../lib/csv");

require("../public/day-recommendations.js");

const OUT_DIR = path.join(__dirname, "..", "output");
const OUT_CSV = path.join(OUT_DIR, "state-matrix-625.csv");
const OUT_SUMMARY = path.join(OUT_DIR, "state-matrix-summary.txt");

function stateKey(row) {
  return row.sub_state ? row.state + " + " + row.sub_state : row.state;
}

function main() {
  var rec = globalThis.UpeakDayRecommendations;
  var rows = [];
  var counts = {};

  for (var sleep_hours = 1; sleep_hours <= 5; sleep_hours++) {
    for (var sleep_quality = 1; sleep_quality <= 5; sleep_quality++) {
      for (var energy = 1; energy <= 5; energy++) {
        for (var stress = 1; stress <= 5; stress++) {
          var ds = dayState.computeDayStateFromMetrics({
            sleep_hours: sleep_hours,
            sleep_quality: sleep_quality,
            energy: energy,
            stress: stress
          });
          var map = rec.resolveContentMapping(ds);
          var key = stateKey(ds);
          counts[key] = (counts[key] || 0) + 1;

          rows.push({
            sleep_hours: sleep_hours,
            sleep_quality: sleep_quality,
            energy: energy,
            stress: stress,
            state: ds.state,
            sub_state: ds.sub_state || "",
            primary_issue: ds.primary_issue || "",
            secondary_issue: ds.secondary_issue || "",
            mean: ds.mean,
            spread: ds.spread,
            focus_axis: map.focus_axis,
            resource_band: map.resource_band,
            template_key: map.template_key
          });
        }
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  var header = [
    "sleep_hours",
    "sleep_quality",
    "energy",
    "stress",
    "state",
    "sub_state",
    "primary_issue",
    "secondary_issue",
    "mean",
    "spread",
    "focus_axis",
    "resource_band",
    "template_key"
  ];

  fs.writeFileSync(OUT_CSV, csv.toCsv(header, rows), "utf8");

  var total = rows.length;
  var summary = ["State distribution (" + total + " combinations, metrics 1-5 each)", ""];
  Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .forEach(function (key) {
      var n = counts[key];
      var pct = ((n / total) * 100).toFixed(1);
      summary.push(key + ": " + n + " (" + pct + "%)");
    });

  summary.push("");
  summary.push("CSV: " + OUT_CSV);
  fs.writeFileSync(OUT_SUMMARY, summary.join("\n"), "utf8");

  console.log(summary.join("\n"));
}

main();
