"use strict";

// Общий CSV-вывод для скриптов генерации отчётов в output/.

function escapeCsv(value) {
  const s = String(value == null ? "" : value);
  if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// rows — массив объектов, header — список колонок в порядке вывода.
function toCsv(header, rows) {
  const lines = [header.join(",")];
  rows.forEach(function (row) {
    lines.push(header.map(function (col) { return escapeCsv(row[col]); }).join(","));
  });
  return lines.join("\n");
}

module.exports = { escapeCsv: escapeCsv, toCsv: toCsv };
