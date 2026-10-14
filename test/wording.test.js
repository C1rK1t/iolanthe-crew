"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { BUILT_IN, createWording, lowerWords } = require("../wording.js");

// The trip column of every key this site uses (the "Keys this plan needs" table of the plan).
const TRIP = {
  unit: ["Trip", "Trips"],
  active_unit: ["Active Trip", "Active Trips"],
  watches_none: ["No watch schedule set for this trip.", "No watch schedule set for this trip."]
};

const placeholders = text => (text.match(/\{[a-z_]+\}/g) || []).sort().join(",");

test("BUILT_IN holds today's charter text, exactly", () => {
  assert.deepEqual(Object.keys(BUILT_IN).sort(), Object.keys(TRIP).sort());
  assert.deepEqual(BUILT_IN.unit, ["Charter", "Charters"]);
  assert.deepEqual(BUILT_IN.active_unit, ["Active Charter", "Active Charters"]);
  assert.equal(BUILT_IN.watches_none[0], "No watch schedule set for this charter.");
  assert.ok(Object.isFrozen(BUILT_IN));
});

test("every key: both forms present, placeholders match across the four strings, trip text has no charter word", () => {
  for (const key of Object.keys(BUILT_IN)) {
    const four = [...BUILT_IN[key], ...TRIP[key]];
    assert.equal(four.length, 4, key);
    for (const text of four) assert.ok(text.trim() !== "", key);
    assert.equal(new Set(four.map(placeholders)).size, 1, `${key}: placeholders differ`);
    for (const text of TRIP[key]) assert.doesNotMatch(text, /\b(charters?|apa|clients?|agents?|proposals?)\b/i, key);
  }
});

test("w: no wording loaded -> the charter words", () => {
  const { w } = createWording(BUILT_IN);
  assert.equal(w("unit"), "Charter");
  assert.equal(w("unit", { plural: true }), "Charters");
  assert.equal(w("unit", { plural: true, lower: true }), "charters");
  assert.equal(w("active_unit", { lower: true }), "active charter");
});

test("w: loaded trip wording is used, plural and vars apply", () => {
  const { w, setWording } = createWording(BUILT_IN);
  setWording(TRIP);
  assert.equal(w("unit"), "Trip");
  assert.equal(w("unit", { plural: true }), "Trips");
  assert.equal(w("active_unit"), "Active Trip");
  assert.equal(w("watches_none"), "No watch schedule set for this trip.");
});

test("w: a missing key or a broken entry falls back to the charter word, never blank or raw", () => {
  const { w, setWording } = createWording(BUILT_IN);
  setWording({ unit: ["Trip", "Trips"], active_unit: ["", "Active Trips"], watches_none: "nope" });
  assert.equal(w("unit"), "Trip");
  assert.equal(w("active_unit"), "Active Charter");
  assert.equal(w("watches_none"), "No watch schedule set for this charter.");
});

test("w: placeholders are filled from vars and left visible when no var is given", () => {
  const { w } = createWording({ greet: ["Hello {name}", "Hello all {name}"] });
  assert.equal(w("greet", { vars: { name: "Ann" } }), "Hello Ann");
  assert.equal(w("greet", { plural: true, vars: { name: "Ann" } }), "Hello all Ann");
  assert.equal(w("greet"), "Hello {name}");
  assert.equal(w("greet", { lower: true, vars: { name: "ABC" } }), "hello ABC");
});

test("w: var values go in literally (no $-patterns, no second expansion)", () => {
  const { w } = createWording({ greet: ["Hello {name}", "Hello all {name}"] });
  assert.equal(w("greet", { vars: { name: "$& {name}" } }), "Hello $& {name}");
});

test("w: an unknown key is a bug and throws", () => {
  const { w } = createWording(BUILT_IN);
  assert.throws(() => w("no_such_key"), /Unknown wording key/);
});

test("setWording: a non-object keeps the words already loaded; reset clears them", () => {
  const { w, setWording, reset } = createWording(BUILT_IN);
  setWording(TRIP);
  setWording(undefined);
  setWording(null);
  setWording(["x"]);
  assert.equal(w("unit"), "Trip");
  reset();
  assert.equal(w("unit"), "Charter");
});

test("lowerWords: first letter of each word, all-capital words stay", () => {
  assert.equal(lowerWords("Active Charter"), "active charter");
  assert.equal(lowerWords("APA received"), "APA received");
  assert.equal(lowerWords("Trip Documents"), "trip documents");
  assert.equal(lowerWords("TRIP DAY {n}"), "TRIP DAY {n}");
});

function fakeNode(attrs) {
  const map = new Map(Object.entries(attrs));
  return {
    textContent: "pre-filled",
    getAttribute: name => (map.has(name) ? map.get(name) : null),
    hasAttribute: name => map.has(name),
    setAttribute: (name, value) => map.set(name, value),
    attr: name => map.get(name)
  };
}

test("applyStatic: text, plural, lower and attribute targets", () => {
  const { setWording, applyStatic } = createWording(BUILT_IN);
  const text = fakeNode({ "data-w": "unit" });
  const lowerPlural = fakeNode({ "data-w": "unit", "data-w-plural": "", "data-w-lower": "" });
  const title = fakeNode({ "data-w": "unit", "data-w-attr": "title" });
  const scope = { querySelectorAll: () => [text, lowerPlural, title] };
  setWording(TRIP);
  applyStatic(scope);
  assert.equal(text.textContent, "Trip");
  assert.equal(lowerPlural.textContent, "trips");
  assert.equal(title.attr("title"), "Trip");
  assert.equal(title.textContent, "pre-filled");
  applyStatic(null);
});
