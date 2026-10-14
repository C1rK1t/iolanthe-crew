"use strict";

// wording.js is a new shipped file: the page must load it before crew.js, and the service worker must precache it.
// Every wording key used in code or in data-w must exist in the built-in charter copy, and every built-in key is used.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { BUILT_IN } = require("../wording.js");

const ROOT = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(ROOT, name), "utf8");

test("index.html loads wording.js before crew.js", () => {
  const scripts = [...read("index.html").matchAll(/<script src="(\/crew\/[^"]+)"/g)].map(m => m[1]);
  const wordingAt = scripts.indexOf("/crew/wording.js");
  assert.ok(wordingAt >= 0, "wording.js script tag");
  assert.ok(wordingAt < scripts.indexOf("/crew/crew.js"), "before crew.js");
});

test("sw.js precaches wording.js and every local /crew/ file index.html loads", () => {
  const sw = read("sw.js");
  const loaded = [...read("index.html").matchAll(/(?:src|href)="(\/crew\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(loaded.includes("/crew/wording.js"));
  for (const url of loaded) assert.ok(sw.includes(`'${url}'`), `sw.js STATIC lists ${url}`);
});

test("every wording key used (w('key') in crew.js, data-w in index.html) is built in, and every built-in key is used", () => {
  const used = new Set();
  for (const m of read("crew.js").matchAll(/\bw\(\s*["']([a-z0-9_]+)["']/g)) used.add(m[1]);
  for (const m of read("index.html").matchAll(/\sdata-w="([a-z0-9_]+)"/g)) used.add(m[1]);
  for (const key of used) assert.ok(Object.hasOwn(BUILT_IN, key), `unknown wording key ${key}`);
  for (const key of Object.keys(BUILT_IN)) assert.ok(used.has(key), `built-in key ${key} is never used`);
});

test("crew.js hands the loaded wording to the helper and fills the static text", () => {
  const js = read("crew.js");
  assert.match(js, /const \{ w, setWording, applyStatic \} = window\.IolantheWording;/);
  assert.match(js, /setWording\(d\.wording\);\s*applyStatic\(document\);/);
});

test("the empty-watches note carries data-w and is built with w(), so it is right whether the watches or the wording arrive first", () => {
  const note = '<p class="watch-empty" data-w="watches_none">${w(\'watches_none\')}</p>';   // as written in the template literal
  assert.ok(read("crew.js").includes(note), "crew.js builds the note");
});
