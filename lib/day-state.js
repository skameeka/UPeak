"use strict";

// Единственный источник правды — public/day-state.js (тот же файл грузится
// в браузере), здесь он только реэкспортируется для Node (тесты, скрипты).
module.exports = require("../public/day-state.js");
