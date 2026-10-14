"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { scanJs, scanHtml } = require("./visible-words.js");

const words = hits => hits.map(hit => hit.text);

test("scanJs: flags visible words in string and template literals, with the line", () => {
  const hits = scanJs('const a = 1;\nconst b = "This charter has been completed.";\nconst c = `CHARTER DAY ${n}`;\nf(\'Client\');');
  assert.deepEqual(hits.map(hit => hit.line), [2, 3, 4]);
  assert.deepEqual(words(hits), ["This charter has been completed.", "CHARTER DAY", "Client"]);
});

test("scanJs: ignores comments, identifiers, object keys, classes, URLs, file names and single lower-case tokens", () => {
  const source = [
    "// the charter is here, APA too",
    "/* Agent Proposal Client */",
    "const charterName = charter.client_agent;",
    'const o = { charter: 1, "charter": 2, "proposal-x": 3 };',
    'el("div", { class: "charter-stack" });',
    'fetch("/api/charter"); fetch("/api/charter/watches");',
    'const url = "https://example.com/charter";',
    'read("charter.json"); read("charter-pack.js?v=1");',
    'params.get("charter");',
    "const q = `charter=${id}&preview=1`;",
    "const re = /\"Charter\"/g;"
  ].join("\n");
  assert.deepEqual(scanJs(source), []);
});

test("scanJs: a template literal with nested ${} still reads its text parts", () => {
  const hits = scanJs("const t = `${a ? `x ${b}` : ''} for this charter ${c}`;");
  assert.deepEqual(words(hits), ["for this charter"]);
});

test("scanJs: whole words only", () => {
  assert.deepEqual(scanJs('const a = "Agenda and Chartered and Clientele and Apathy";'), []);
  assert.deepEqual(words(scanJs('const a = "Pay the Agent (APA)";')), ["Pay the Agent (APA)"]);
});

test("scanHtml: flags visible text and attributes, not tags, data-*, classes, comments or scripts", () => {
  const html = [
    "<!-- Charter comment -->",
    '<button class="tab-btn" data-tab="charter" data-w="unit">Charter</button>',
    '<h2 class="card-heading" id="charterHeading">Active Charter</h2>',
    '<img alt="Client photo" src="/images/charter.png">',
    '<input placeholder="Agent name" value="">',
    '<script>const x = "Charter";</script>',
    "<style>.charter-stack { content: 'APA'; }</style>",
    '<div class="topbar-charter" id="charterName"></div>'
  ].join("\n");
  assert.deepEqual(words(scanHtml(html)), ["Charter", "Active Charter", "Client photo", "Agent name"]);
  assert.deepEqual(scanHtml(html).map(hit => hit.line), [2, 3, 4, 5]);
});
