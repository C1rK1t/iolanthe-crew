"use strict";

// The spec T guard scan (T-D6): finds visible commercial words typed in code instead of read from the wording map.
// Not a JavaScript parser: it walks the source once, skipping comments and regex literals, and tests only the text of
// string and template literals.

// A whole word, wherever it sits: "Client/Agent" and "Charter-specific" are words too (same approach as the admin's
// test/wording-scan.js). Names that merely contain one (charter.json, /api/charter, class="charter-x") are blanked
// first by visiblePart().
const WORD = /\b(charters?|apa|clients?|agents?|proposals?)\b/i;

// A lowercase one-word literal (optionally ending in ":") is a key or id; a list of lowercase hyphenated words is a
// class list, never a sentence.
const KEY_LITERAL = /^[a-z][a-z0-9_]*:?$/;
const CLASS_LIST = /^(?!.*\b(?:the|an?|to|of|and|for|in|it|this|that|with)\b)[a-z][a-z0-9_:-]*(?:\s+[a-z][a-z0-9_:-]*)*$/;
// Attributes nobody reads on screen (ids, classes, data-* except data-label / data-title, URLs, form plumbing), in
// any quoting, with spaces around "=".
const HIDDEN_ATTRIBUTE = /\s(?:(?:class|id|data-(?!label\b|title\b)[\w-]+|href|src|for|name|type|role|style|rel|target|method|action|autocomplete|inputmode|pattern|min|max|step|aria-controls|aria-labelledby|aria-describedby)\s*=\s*("[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s>"']*)|value="[a-z][a-z0-9_-]*")/gi;
// In a literal only these are names: data-* attributes, a lowercase token in quotes, a .class / #id, file names
// (charter.json, charter_id), a path that starts a word (/api/charter) and query parameters (?x=, x=).
const NAME = /(?:\bdata-[\w-]+|(?<=["'])[a-z][a-z0-9_-]*(?=["'])|(?<=[.#])[A-Za-z][A-Za-z0-9_-]*|[A-Za-z0-9$-]+(?:[_.#][A-Za-z0-9$-]+)+|(?<![A-Za-z0-9$])\/[A-Za-z0-9$_./?=&-]*|[?&][A-Za-z0-9_-]+=|(?<![\w\s])[a-z][a-z0-9_-]*=)/g;
const blank = text => " ".repeat(text.length);

// What a person could read of a literal's text: hidden attributes and names blanked.
function visiblePart(text) {
  if (KEY_LITERAL.test(text) || CLASS_LIST.test(text)) return "";
  return text.replace(HIDDEN_ATTRIBUTE, blank).replace(NAME, blank);
}
const REGEX_PREV = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

// A string that is not shown to a person: a URL or path, a file name, or one lower-case token (a key or id).
function isInternalLiteral(text) {
  if (/^[a-z][a-z0-9_-]*$/.test(text)) return true;
  if (/^(\/|https?:|\.\/|\.\.\/)/.test(text)) return true;
  if (/\.(json|js|css|html|png|svg|pdf)(\?|$)/.test(text)) return true;
  return false;
}

// Returns [{ line, text }] for every string/template literal whose visible text has a guarded word.
function scanJs(source) {
  const hits = [];
  const n = source.length;
  let i = 0;
  let prev = "";                       // the last significant (non-space) code character
  const stack = [];                    // template ${ } nesting: each entry is the brace depth to resume the template at
  let braceDepth = 0;

  function readString(quote) {
    const start = i;
    i += 1;
    let text = "";
    while (i < n && source[i] !== quote && source[i] !== "\n") {
      if (source[i] === "\\") { text += source.slice(i, i + 2); i += 2; continue; }
      text += source[i]; i += 1;
    }
    i += 1;
    return { text, start };
  }

  function readTemplateText() {          // from just after ` or after the } that ends a ${ }
    const start = i;
    let text = "";
    while (i < n) {
      if (source[i] === "\\") { text += source.slice(i, i + 2); i += 2; continue; }
      if (source[i] === "`") { i += 1; return { text, start, ended: true }; }
      if (source[i] === "$" && source[i + 1] === "{") { i += 2; return { text, start, ended: false }; }
      text += source[i]; i += 1;
    }
    return { text, start, ended: true };
  }

  function isKey(afterIndex) {            // "text": …  inside an object literal
    let j = afterIndex;
    while (j < n && /[ \t]/.test(source[j])) j += 1;
    return source[j] === ":" && (prev === "{" || prev === ",");
  }

  function check(text, start, isTemplate) {
    if (!isTemplate && isInternalLiteral(text)) return;
    if (WORD.test(visiblePart(text))) hits.push({ line: lineOf(source, start), text: text.trim().slice(0, 120) });
  }

  function continueTemplate() {
    const piece = readTemplateText();
    check(piece.text, piece.start, true);
    if (piece.ended) { prev = "`"; } else { stack.push(braceDepth); braceDepth = 0; prev = "{"; }
  }

  while (i < n) {
    const c = source[i];
    if (c === "/" && source[i + 1] === "/") { while (i < n && source[i] !== "\n") i += 1; continue; }
    if (c === "/" && source[i + 1] === "*") { const e = source.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      const s = readString(c);
      if (!isKey(i)) check(s.text, s.start, false);
      prev = c;
      continue;
    }
    if (c === "`") { i += 1; continueTemplate(); continue; }
    if (c === "/" && REGEX_PREV.has(prev)) {
      i += 1;
      let inClass = false;
      while (i < n && source[i] !== "\n") {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === "[") inClass = true;
        else if (source[i] === "]") inClass = false;
        else if (source[i] === "/" && !inClass) break;
        i += 1;
      }
      i += 1;
      while (i < n && /[a-z]/.test(source[i])) i += 1;
      prev = "/";
      continue;
    }
    if (c === "{") braceDepth += 1;
    if (c === "}") {
      if (braceDepth === 0 && stack.length) { braceDepth = stack.pop(); i += 1; continueTemplate(); continue; }
      braceDepth -= 1;
    }
    if (!/\s/.test(c)) prev = c;
    i += 1;
  }
  return hits;
}

const VISIBLE_ATTRS = ["alt", "title", "aria-label", "placeholder", "value", "data-label", "data-title"];

// Returns [{ line, text }] for visible words in HTML: element text and the visible attributes.
function scanHtml(source) {
  const hits = [];
  const blanked = source
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "))
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, m => m.replace(/[^\n]/g, " "));
  const tag = /<[^>]*>/g;
  let last = 0;
  let m;
  const test = (text, index) => {
    if (WORD.test(text)) hits.push({ line: lineOf(source, index), text: text.trim().slice(0, 120) });
  };
  while ((m = tag.exec(blanked))) {
    test(blanked.slice(last, m.index), last);
    const attr = /\s([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;
    let a;
    while ((a = attr.exec(m[0]))) {
      if (VISIBLE_ATTRS.includes(a[1].toLowerCase())) test(a[2] ?? a[3] ?? a[4], m.index + a.index);
    }
    last = m.index + m[0].length;
  }
  test(blanked.slice(last), last);
  return hits;
}

module.exports = { scanJs, scanHtml, WORD, isInternalLiteral };
