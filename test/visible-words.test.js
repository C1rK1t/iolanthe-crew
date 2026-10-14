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

test("scanJs: a word joined to another by a slash or a hyphen is still a word", () => {
  assert.deepEqual(words(scanJs('say("Client/Agent");')), ["Client/Agent"]);
  assert.deepEqual(words(scanJs('say("Charter/APA fees");')), ["Charter/APA fees"]);
  assert.deepEqual(words(scanJs('say("Charter-specific");')), ["Charter-specific"]);
  assert.deepEqual(words(scanJs('say("Charter-linked items");')), ["Charter-linked items"]);
  assert.deepEqual(scanJs('say("See /api/charter and charter.json and charter-pack.js?v=1");'), []);
});

test("scanJs: visible data-label / data-title in markup count; other data-*, classes and ids do not", () => {
  assert.deepEqual(words(scanJs('const h = `<span data-label="Charter" title="APA">x</span>`;')), ["<span data-label=\"Charter\" title=\"APA\">x</span>"]);
  assert.deepEqual(scanJs('const h = `<div data-panel="charter" class="charter" id=charterBox data-x = \'apa\'>Fees</div>`;'), []);
});

test("scanHtml: single-quoted, unquoted and spaced attribute values are read", () => {
  const html = "<img alt='Charter photo'><img alt=Client><b aria-label = \"Agent\">x</b><input placeholder = 'Proposal'>";
  assert.deepEqual(words(scanHtml(html)), ["Charter photo", "Client", "Agent", "Proposal"]);
});

test("scanHtml: data-label and data-title are visible, other data-* values are not", () => {
  const html = '<a data-label="Charter">x</a><a data-title=\'APA\'>y</a><a data-tab = "charter" data-panel=apa>z</a>';
  assert.deepEqual(words(scanHtml(html)), ["Charter", "APA"]);
});

test("scanHtml: a slash or hyphen in visible text does not hide a word", () => {
  assert.deepEqual(words(scanHtml("<p>Client/Agent</p><p>Charter-specific</p>")), ["Client/Agent", "Charter-specific"]);
});
