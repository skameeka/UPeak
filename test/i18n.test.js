"use strict";

// public/i18n.js — браузерный модуль без сборки, поэтому грузим его в vm с
// минимальным поддельным DOM: проверяем словари, переключение языка,
// сохранение выбора и разметку data-i18n* на реальных страницах.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var PUBLIC_DIR = path.join(__dirname, "..", "public");
var SOURCE = fs.readFileSync(path.join(PUBLIC_DIR, "i18n.js"), "utf8");

function createElement(tag, attributes) {
  var attrs = Object.assign({}, attributes || {});
  var classes = [];
  var handlers = {};
  return {
    tagName: tag,
    textContent: "",
    attrs: attrs,
    handlers: handlers,
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute: function (name, value) {
      attrs[name] = value;
    },
    hasAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    },
    addEventListener: function (type, handler) {
      handlers[type] = handler;
    },
    click: function () {
      if (handlers.click) handlers.click();
    },
    classList: {
      add: function (name) {
        if (classes.indexOf(name) === -1) classes.push(name);
      },
      remove: function (name) {
        var i = classes.indexOf(name);
        if (i !== -1) classes.splice(i, 1);
      },
      contains: function (name) {
        return classes.indexOf(name) !== -1;
      }
    }
  };
}

// Поддерживает только селекторы вида `tag[attr]` / `[attr]` / `[attr="value"]`,
// которых достаточно для i18n.js.
function matches(element, selector) {
  var tagMatch = selector.match(/^([a-zA-Z]+)/);
  if (tagMatch && element.tagName !== tagMatch[1]) return false;

  var conditions = selector.match(/\[[^\]]+\]/g) || [];
  return conditions.every(function (condition) {
    var inner = condition.slice(1, -1);
    var eq = inner.indexOf("=");
    if (eq === -1) return element.hasAttribute(inner);
    var name = inner.slice(0, eq);
    var value = inner.slice(eq + 1).replace(/^["']|["']$/g, "");
    return element.getAttribute(name) === value;
  });
}

function createDom(elements, options) {
  options = options || {};
  var store = Object.assign({}, options.storage || {});
  var documentElement = createElement("html");

  var document = {
    readyState: options.readyState || "complete",
    title: "",
    documentElement: documentElement,
    querySelectorAll: function (selector) {
      return elements.filter(function (el) {
        return matches(el, selector);
      });
    },
    querySelector: function (selector) {
      return (
        elements.find(function (el) {
          return matches(el, selector);
        }) || null
      );
    },
    addEventListener: function (type, handler) {
      document.handlers = document.handlers || {};
      document.handlers[type] = handler;
    }
  };

  var sandbox = {
    document: document,
    navigator: { language: options.language || "ru-RU" },
    localStorage: {
      getItem: function (key) {
        if (options.storageThrows) throw new Error("storage disabled");
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem: function (key, value) {
        if (options.storageThrows) throw new Error("storage disabled");
        store[key] = value;
      }
    },
    window: {},
    store: store
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { sandbox: sandbox, i18n: sandbox.window.UpeakI18n, document: document, store: store };
}

function dictKeys(lang) {
  var start = SOURCE.indexOf("    " + lang + ": {");
  assert.notEqual(start, -1, "не найден словарь " + lang);
  var end = SOURCE.indexOf("\n    },", start);
  var block = SOURCE.slice(start, end === -1 ? SOURCE.length : end);
  var keys = [];
  var re = /^\s*"([^"]+)":/gm;
  var match;
  while ((match = re.exec(block)) !== null) keys.push(match[1]);
  return keys;
}

function htmlKeys() {
  var keys = [];
  ["index.html", "participate.html", "planner.html"].forEach(function (file) {
    var html = fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8");
    var re = /data-i18n(?:-[a-z-]+)?="([^"]+)"/g;
    var match;
    while ((match = re.exec(html)) !== null) keys.push(match[1]);
  });
  return keys;
}

test("словари ru и en содержат одинаковый набор ключей", function () {
  var ru = dictKeys("ru");
  var en = dictKeys("en");
  assert.ok(ru.length > 100, "словарь ru подозрительно мал: " + ru.length);

  var missingInEn = ru.filter(function (key) {
    return en.indexOf(key) === -1;
  });
  var missingInRu = en.filter(function (key) {
    return ru.indexOf(key) === -1;
  });
  assert.deepEqual(missingInEn, [], "нет перевода en");
  assert.deepEqual(missingInRu, [], "нет перевода ru");
});

test("в словарях нет дублирующихся ключей", function () {
  ["ru", "en"].forEach(function (lang) {
    var keys = dictKeys(lang);
    var duplicates = keys.filter(function (key, index) {
      return keys.indexOf(key) !== index;
    });
    assert.deepEqual(duplicates, [], "дубли в словаре " + lang);
  });
});

test("все ключи data-i18n* со страниц есть в словарях", function () {
  var ru = dictKeys("ru");
  var unknown = htmlKeys().filter(function (key) {
    return ru.indexOf(key) === -1;
  });
  assert.deepEqual(Array.from(new Set(unknown)), []);
});

test("t() возвращает перевод текущего языка и падает в ru как fallback", function () {
  var dom = createDom([]);
  assert.equal(dom.i18n.getLang(), "ru");
  assert.equal(dom.i18n.t("nav.research"), "Исследование");

  dom.i18n.setLang("en");
  assert.equal(dom.i18n.getLang(), "en");
  assert.equal(dom.i18n.t("nav.research"), "Research");

  // Неизвестный ключ отдаётся как есть — на странице сразу видно пропуск.
  assert.equal(dom.i18n.t("nope.missing.key"), "nope.missing.key");
});

test("setLang игнорирует неподдерживаемый язык", function () {
  var dom = createDom([]);
  dom.i18n.setLang("de");
  assert.equal(dom.i18n.getLang(), "ru");
});

test("начальный язык берётся из localStorage", function () {
  var dom = createDom([], { storage: { upeak_lang: "en" }, language: "ru-RU" });
  assert.equal(dom.i18n.getLang(), "en");
});

test("без сохранённого языка определяем его по navigator.language", function () {
  assert.equal(createDom([], { language: "en-US" }).i18n.getLang(), "en");
  assert.equal(createDom([], { language: "ru-RU" }).i18n.getLang(), "ru");
  // Незнакомая локаль → язык по умолчанию.
  assert.equal(createDom([], { language: "fr-FR" }).i18n.getLang(), "ru");
});

test("недоступный localStorage не ломает инициализацию и переключение", function () {
  var dom = createDom([], { storageThrows: true });
  assert.equal(dom.i18n.getLang(), "ru");
  dom.i18n.setLang("en");
  assert.equal(dom.i18n.getLang(), "en");
});

test("выбранный язык сохраняется в localStorage", function () {
  var dom = createDom([]);
  dom.i18n.setLang("en");
  assert.equal(dom.store.upeak_lang, "en");
});

test("applyDom переводит текст, placeholder, aria-label, alt и title", function () {
  var text = createElement("span", { "data-i18n": "nav.research" });
  var placeholder = createElement("input", { "data-i18n-placeholder": "participate.placeholder.name" });
  var aria = createElement("div", { "data-i18n-aria-label": "nav.lang.aria" });
  var alt = createElement("img", { "data-i18n-alt": "hero.logo.alt" });
  var title = createElement("button", { "data-i18n-title": "nav.research" });
  var pageTitle = createElement("title", { "data-i18n": "meta.landing.title" });
  var meta = createElement("meta", {
    name: "description",
    "data-i18n": "meta.landing.description"
  });

  var dom = createDom([text, placeholder, aria, alt, title, pageTitle, meta]);

  assert.equal(text.textContent, "Исследование");
  assert.equal(placeholder.getAttribute("placeholder"), "Например, Анна");
  assert.equal(aria.getAttribute("aria-label"), "Язык интерфейса");
  assert.equal(alt.getAttribute("alt"), "Логотип Upeak");
  assert.equal(title.getAttribute("title"), "Исследование");
  assert.equal(dom.document.title, dom.i18n.t("meta.landing.title"));
  assert.equal(meta.getAttribute("content"), dom.i18n.t("meta.landing.description"));
  assert.equal(dom.document.documentElement.getAttribute("lang"), "ru");

  dom.i18n.setLang("en");
  assert.equal(text.textContent, "Research");
  assert.equal(dom.document.documentElement.getAttribute("lang"), "en");
});

test("кнопки data-lang-toggle переключают язык и получают состояние", function () {
  var ruBtn = createElement("button", { "data-lang-toggle": "ru" });
  var enBtn = createElement("button", { "data-lang-toggle": "en" });
  var dom = createDom([ruBtn, enBtn]);

  assert.equal(ruBtn.getAttribute("aria-pressed"), "true");
  assert.ok(ruBtn.classList.contains("is-active"));
  assert.equal(enBtn.getAttribute("aria-pressed"), "false");

  enBtn.click();

  assert.equal(dom.i18n.getLang(), "en");
  assert.equal(enBtn.getAttribute("aria-pressed"), "true");
  assert.ok(enBtn.classList.contains("is-active"));
  assert.ok(!ruBtn.classList.contains("is-active"));
});

test("инициализация откладывается до DOMContentLoaded, если документ грузится", function () {
  var button = createElement("button", { "data-lang-toggle": "en" });
  var dom = createDom([button], { readyState: "loading" });

  assert.equal(button.getAttribute("aria-pressed"), null);
  dom.document.handlers.DOMContentLoaded();
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("onChange уведомляет подписчиков и переживает их исключения", function () {
  var dom = createDom([]);
  var seen = [];

  dom.i18n.onChange(function () {
    throw new Error("подписчик упал");
  });
  dom.i18n.onChange(function (lang) {
    seen.push(lang);
  });
  dom.i18n.onChange("не функция");

  dom.i18n.setLang("en");
  assert.deepEqual(seen, ["en"]);
});
