(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = mod;
  } else {
    root.IolantheWording = mod;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Spec T (Trip mode): the crew site's wording helper. The server sends `wording` ({ key: [singular, plural] }, the
  // vessel's mode already resolved) in the /api/charter payload, the one fetchCharter reads. A missing map or key falls
  // back to BUILT_IN, the charter column of every key this site uses, so charter mode looks exactly as before and
  // nothing shows a raw key or a blank. The same semantics are copied into iolanthe-guest/wording.js (separate repos,
  // separate copies).

  const BUILT_IN = Object.freeze({
    unit: Object.freeze(["Charter", "Charters"]),
    active_unit: Object.freeze(["Active Charter", "Active Charters"]),
    watches_none: Object.freeze(["No watch schedule set for this charter.", "No watch schedule set for this charter."])
  });

  const STATIC_ATTRS = ["alt", "title", "aria-label", "placeholder"];

  // Lower-cases the first letter of each word except all-capital words ("APA", "TRIP" stay).
  function lowerWords(text) {
    return text.replace(/\S+/g, word => (/[A-Z]/.test(word) && word === word.toUpperCase()
      ? word
      : word.charAt(0).toLowerCase() + word.slice(1)));
  }

  function isForm(value) {
    return typeof value === "string" && value.trim() !== "";
  }

  function createWording(builtIn) {
    let loaded = null;
    const warned = new Set();

    function entryFor(key) {
      const fromServer = loaded && Object.prototype.hasOwnProperty.call(loaded, key) ? loaded[key] : null;
      if (Array.isArray(fromServer) && fromServer.length >= 2 && isForm(fromServer[0]) && isForm(fromServer[1])) {
        return fromServer;
      }
      if (Object.prototype.hasOwnProperty.call(builtIn, key)) {
        return builtIn[key];
      }
      return null;
    }

    // Never throws: a key in neither the loaded words nor builtIn is a programming mistake (the keys test catches it),
    // but one wrong key must not blank a page, so it warns once per key and returns the key text.
    // w("unit_day", { vars: { n: 3 } }) -> "TRIP DAY 3"; w("unit", { plural: true, lower: true }) -> "trips".
    function w(key, opts) {
      const options = opts || {};
      const entry = entryFor(key);
      if (entry === null) {
        if (!warned.has(key)) {
          warned.add(key);
          console.warn(`wording.js: no word "${key}"`);
        }
        return String(key);
      }
      let text = entry[options.plural ? 1 : 0];
      if (options.lower) {
        text = lowerWords(text);
      }
      const vars = options.vars || {};
      return text.replace(/\{([a-z_]+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
      ));
    }

    // A non-object (an older server sent no `wording`, or a fallback bundle) keeps the last words that were loaded.
    function setWording(map) {
      if (map && typeof map === "object" && !Array.isArray(map)) {
        loaded = map;
      }
    }

    function reset() {
      loaded = null;
    }

    // data-w="<key>" [data-w-plural] [data-w-lower] [data-w-attr="alt|title|aria-label|placeholder"]
    function applyStatic(scope) {
      if (!scope || typeof scope.querySelectorAll !== "function") {
        return;
      }
      scope.querySelectorAll("[data-w]").forEach(node => {
        const text = w(node.getAttribute("data-w"), {
          plural: node.hasAttribute("data-w-plural"),
          lower: node.hasAttribute("data-w-lower")
        });
        const attr = node.getAttribute("data-w-attr");
        if (attr && STATIC_ATTRS.includes(attr)) {
          node.setAttribute(attr, text);
        } else {
          node.textContent = text;
        }
      });
    }

    return { w, setWording, reset, applyStatic };
  }

  return Object.assign({ BUILT_IN, createWording, lowerWords }, createWording(BUILT_IN));
});
