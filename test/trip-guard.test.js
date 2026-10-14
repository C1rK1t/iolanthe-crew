"use strict";

// Spec T guard (T-D6): visible commercial words (charter, APA, client, agent, proposal) are read from the wording map,
// never typed into the site's own files. The allow-list holds files not converted yet; it only shrinks.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { scanJs, scanHtml } = require("./visible-words.js");

const ROOT = path.join(__dirname, "..");
const WORDING_MODULE = "wording.js";
const ALLOW_LIST = [];

const sources = fs.readdirSync(ROOT)
  .filter(name => /\.(js|html)$/.test(name) && name !== WORDING_MODULE)
  .sort();

const scan = name => {
  const text = fs.readFileSync(path.join(ROOT, name), "utf8");
  return name.endsWith(".html") ? scanHtml(text) : scanJs(text);
};

test("the guard looks at the site's own files", () => {
  for (const name of ["crew.js", "index.html", "sw.js"]) {
    assert.ok(sources.includes(name), name);
  }
  assert.ok(!sources.includes(WORDING_MODULE));
});

for (const name of sources) {
  test(`${name}: no visible commercial word typed in code`, () => {
    const hits = scan(name);
    if (ALLOW_LIST.includes(name)) {
      assert.ok(hits.length > 0, `${name} is clean now: remove it from ALLOW_LIST`);
      return;
    }
    assert.deepEqual(hits, [], `${name} types a visible word; read it from the wording map (w("key"))`);
  });
}

test("ALLOW_LIST names real files", () => {
  for (const name of ALLOW_LIST) assert.ok(sources.includes(name), name);
});
