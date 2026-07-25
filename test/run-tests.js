#!/usr/bin/env node
"use strict";

var C = require("../specimen-core.js");
var passed = 0;
var failed = 0;
var failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error("  FAIL:", msg);
  }
}

function assertEq(actual, expected, msg) {
  var ok = actual === expected;
  if (!ok) {
    failed++;
    failures.push(msg + " (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
    console.error("  FAIL:", msg, "| expected", expected, "got", actual);
  } else {
    passed++;
  }
}

function assertInRange(n, lo, hi, msg) {
  assert(n >= lo && n <= hi, msg + " (" + n + " not in [" + lo + "," + hi + "])");
}

console.log("\n=== Specimen core tests ===\n");

/* ---------- norm / validation ---------- */
console.log("norm / isNameValid");
assertEq(C.norm("Dry Run!"), "dryrun", "norm strips non-alnum and lowercases");
assertEq(C.norm("  Hello-World  "), "helloworld", "norm handles spaces and hyphens");
assert(C.isNameValid("abc"), "abc is valid");
assert(C.isNameValid("Ab C"), "Ab C normalizes to abc — valid");
assert(!C.isNameValid("ab"), "ab is too short");
assert(!C.isNameValid("..."), "punctuation-only is invalid");
assert(!C.isNameValid("  !@#  "), "symbols-only is invalid");
assert(!C.isNameValid(""), "empty is invalid");

/* ---------- esc / nfmt ---------- */
console.log("esc / nfmt");
assertEq(C.esc('<script>"x"&\'y'), "&lt;script&gt;&quot;x&quot;&amp;&#39;y", "esc escapes HTML specials");
assertEq(C.nfmt(999), "999", "nfmt under 1k");
assertEq(C.nfmt(1500), "1.5K", "nfmt thousands");
assertEq(C.nfmt(12000), "12K", "nfmt 10k+ no decimal");
assertEq(C.nfmt(2.5e6), "2.5M", "nfmt millions");
assertEq(C.nfmt(15e6), "15M", "nfmt 10M+ no decimal");
assertEq(C.nfmt(null), "0", "nfmt null → 0");

/* ---------- handle variants ---------- */
console.log("handleVariants / estimateUnits");
var single = C.handleVariants("DryRun");
assertEq(single.length, 3, "single word → 3 variants");
assert(single.indexOf("dryrun") !== -1, "includes base");
assert(single.indexOf("thedryrun") !== -1, "includes the+base");
assert(single.indexOf("dryrunbio") !== -1, "includes base+bio");
assert(single.indexOf("dryrunhq") === -1, "single word has no hq suffix");

var multi = C.handleVariants("Dry Run");
assertEq(multi.length, 4, "multi word → 4 variants");
assert(multi.indexOf("dryrunhq") !== -1, "multi word includes joined+hq");
assertEq(C.estimateUnits("DryRun", "quick"), 3, "quick single-word cost = 3");
assertEq(C.estimateUnits("Dry Run", "quick"), 4, "quick multi-word cost = 4");
assertEq(C.estimateUnits("DryRun", "full"), 3 + C.FULL_SCAN_FIXED_UNITS, "full single = 3+101");
assertEq(C.estimateUnits("Dry Run", "full"), 4 + C.FULL_SCAN_FIXED_UNITS, "full multi = 4+101");
assertEq(C.estimateUnits("DryRun", "full"), 104, "full single = 104 units");
assertEq(C.estimateUnits("Dry Run", "full"), 105, "full multi = 105 units");

var short = C.handleVariants("ab");
assertEq(short.length, 0, "too-short base yields no valid variants (base filtered)");

/* ---------- syllables / memorability ---------- */
console.log("syllables / memorability");
assert(C.syllables("cat") >= 1, "cat has ≥1 syllable");
assert(C.syllables("beautiful") >= 2, "beautiful has multiple syllables");

var strong = C.memorability("Dry Run");
assertInRange(strong.score, 0, 100, "score clamped");
assertEq(strong.words, 2, "two words");
assert(strong.score >= 70, "Dry Run should score high memorability (≥70), got " + strong.score);
assert(strong.reasons.some(function (r) { return r[0] === "plus"; }), "has plus reasons");

var weak = C.memorability("The Extremely Long Channel Name With Digits 1234 And_Underscores");
assert(weak.score < strong.score, "long digit-heavy name scores lower than Dry Run");
assert(weak.reasons.some(function (r) { return r[0] === "minus"; }), "weak name has minus reasons");

var allit = C.memorability("Pixel Parade");
assert(
  allit.reasons.some(function (r) { return /Alliteration/i.test(r[1]); }),
  "alliteration detected on Pixel Parade"
);

var triple = C.memorability("Flllight");
assert(
  triple.reasons.some(function (r) { return /Three identical/i.test(r[1]); }),
  "triple letter penalty"
);

/* ---------- uniqueness ---------- */
console.log("uniqueness");
var freeHandles = [
  { handle: "dryrun", taken: false },
  { handle: "thedryrun", taken: false },
  { handle: "dryrunbio", taken: false },
];
var uQuick = C.uniqueness("Dry Run", [], freeHandles, false);
assertEq(uQuick.searched, false, "handles-only marks searched false");
assert(uQuick.score >= 90, "all free handles → high uniqueness, got " + uQuick.score);
assert(
  uQuick.reasons.some(function (r) { return /full scan/i.test(r[1]); }),
  "quick mode notes full scan needed"
);

var takenHandles = [
  { handle: "dryrun", taken: true, title: "Dry Run" },
  { handle: "thedryrun", taken: true, title: "The Dry Run" },
  { handle: "dryrunbio", taken: false },
];
var uTaken = C.uniqueness("Dry Run", [], takenHandles, false);
assert(uTaken.score < uQuick.score, "taken handles lower uniqueness");

var rivalsExact = [
  { title: "Dry Run", subs: 250000, handle: "@dryrun", id: "1" },
  { title: "Dry Run Clips", subs: 1000, handle: "@drc", id: "2" },
];
var uFull = C.uniqueness("Dry Run", rivalsExact, freeHandles, true);
assertEq(uFull.searched, true, "full mode searched true");
assert(uFull.exact.length === 1, "one exact title match");
assert(uFull.score < uQuick.score, "exact large rival tanks uniqueness");
assert(
  uFull.reasons.some(function (r) { return /exact name/i.test(r[1]); }),
  "mentions exact name collision"
);
assert(
  uFull.reasons.some(function (r) { return /outrank/i.test(r[1]); }),
  "large exact match outrank note"
);

var quiet = C.uniqueness(
  "XylophoneZebraQuill",
  [{ title: "Unrelated Channel", subs: 50, handle: "@u", id: "9" }],
  freeHandles,
  true
);
assert(quiet.score >= 90, "quiet territory stays high, got " + quiet.score);

/* ---------- combined score / verdict ---------- */
console.log("combinedScore / verdictLabel");
assertEq(C.combinedScore(100, 100, true), 100, "perfect full");
assertEq(C.combinedScore(100, 100, false), 100, "perfect quick");
var midFull = C.combinedScore(80, 60, true);
assertEq(midFull, Math.round(80 * 0.62 + 60 * 0.38), "full weights 62/38");
var midQuick = C.combinedScore(80, 60, false);
assertEq(midQuick, Math.round(80 * 0.35 + 60 * 0.65), "quick weights 35/65");
assertEq(C.verdictLabel(80), "CLEAR", "≥72 CLEAR");
assertEq(C.verdictLabel(72), "CLEAR", "72 boundary CLEAR");
assertEq(C.verdictLabel(71), "TIGHT", "71 TIGHT");
assertEq(C.verdictLabel(52), "TIGHT", "52 boundary TIGHT");
assertEq(C.verdictLabel(51), "CROWDED", "51 CROWDED");

/* ---------- eval: shortlist ranking order ---------- */
console.log("eval: shortlist ranking (memorability-only proxy)");
var shortlist = ["Dry Run", "Read Depth", "In Silico", "The Extremely Verbose Channel Title 99"];
var ranked = shortlist
  .map(function (name) {
    var m = C.memorability(name);
    // pretend uniqueness is uniform (handles-only free)
    var u = C.uniqueness(name, [], freeHandles, false);
    return { name: name, total: C.combinedScore(u.score, m.score, false), m: m.score, u: u.score };
  })
  .sort(function (a, b) {
    return b.total - a.total;
  });

console.log(
  "  rank:",
  ranked
    .map(function (r, i) {
      return i + 1 + ". " + r.name + " (" + r.total + ")";
    })
    .join(" | ")
);
assert(
  ranked[ranked.length - 1].name.indexOf("Extremely") !== -1,
  "verbose digit name ranks last among shortlist"
);
assert(
  ranked[0].total > ranked[ranked.length - 1].total,
  "top ranks above bottom"
);

/* ---------- HTML wiring smoke (static) ---------- */
console.log("HTML static checks");
var fs = require("fs");
var path = require("path");
var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert(html.indexOf('src="specimen-core.js"') !== -1, "index loads specimen-core.js");
assert(html.indexOf('aria-live="polite"') !== -1, "status has aria-live");
assert(html.indexOf("Content-Security-Policy") !== -1, "CSP meta present");
assert(html.indexOf("cancelBatch") !== -1, "batch cancel control present");
assert(html.indexOf("id=\"costQuick\"") !== -1, "dynamic quick cost element");
assert(html.indexOf("id=\"costFull\"") !== -1, "dynamic full cost element");
assert(html.indexOf("isNameValid") !== -1, "client uses isNameValid");
assert(html.indexOf("3 units") === -1, "hardcoded '3 units' removed from UI");
assert(html.indexOf("104 units") === -1, "hardcoded '104 units' removed from UI");

/* ---------- summary ---------- */
console.log("\n=== Results: " + passed + " passed, " + failed + " failed ===\n");
if (failed) {
  console.error("Failures:");
  failures.forEach(function (f) {
    console.error(" -", f);
  });
  process.exit(1);
}
console.log("All tests passed.\n");
process.exit(0);
