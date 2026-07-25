/**
 * Pure scoring and naming helpers for Specimen.
 * Works in the browser (window.SpecimenCore) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SpecimenCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MIN_HANDLE_LEN = 3;
  var MAX_HANDLE_LEN = 30;
  var MAX_HANDLE_VARIANTS = 4;
  /** search.list (100) + channels.list for rival stats (1) */
  var FULL_SCAN_FIXED_UNITS = 101;

  function norm(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function nfmt(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
    return String(n);
  }

  function isNameValid(name) {
    return norm(name).length >= MIN_HANDLE_LEN;
  }

  function syllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    var m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }

  function memorability(name) {
    var reasons = [],
      score = 50;
    var trimmed = String(name).trim();
    var words = trimmed.split(/\s+/).filter(Boolean);
    var letters = trimmed.replace(/[^a-zA-Z]/g, "");
    var len = trimmed.length;
    var syl = words.reduce(function (a, w) {
      return a + syllables(w);
    }, 0);

    if (len >= 6 && len <= 14) {
      score += 16;
      reasons.push(["plus", "Short enough to sit in a search bar and a logo — " + len + " characters"]);
    } else if (len <= 18) {
      score += 6;
      reasons.push(["flat", len + " characters. Workable, but it will wrap on mobile"]);
    } else {
      score -= 16;
      reasons.push(["minus", "At " + len + " characters this is too long to recall or type from memory"]);
    }

    if (words.length === 2) {
      score += 14;
      reasons.push(["plus", "Two words — the most repeatable shape for a channel name"]);
    } else if (words.length === 1) {
      score += 9;
      reasons.push(["plus", "Single word. Strong if it's ownable, risky if it's a common noun"]);
    } else if (words.length === 3) {
      score -= 6;
      reasons.push(["minus", "Three words. People will shorten it — decide now which two survive"]);
    } else {
      score -= 16;
      reasons.push(["minus", words.length + " words is more than anyone will say out loud"]);
    }

    if (syl <= 4) {
      score += 12;
      reasons.push(["plus", syl + " syllables. Says fast, sticks fast"]);
    } else if (syl <= 6) {
      score += 2;
      reasons.push(["flat", syl + " syllables"]);
    } else {
      score -= 12;
      reasons.push(["minus", syl + " syllables is a mouthful on camera"]);
    }

    if (/[0-9]/.test(trimmed)) {
      score -= 14;
      reasons.push(["minus", "Digits force people to guess between the numeral and the word"]);
    }
    if (/[_\-–—]/.test(trimmed)) {
      score -= 10;
      reasons.push(["minus", "Punctuation gets dropped when the name is said aloud"]);
    }
    if (/(ph|gh|kn|wr|ps|ough|ei|ie)/i.test(trimmed)) {
      score -= 7;
      reasons.push(["minus", "Contains a spelling people commonly get wrong on the first try"]);
    }
    if (/(.)\1\1/.test(trimmed.toLowerCase())) {
      score -= 8;
      reasons.push(["minus", "Three identical letters in a row invites typos"]);
    }

    var initials = words.map(function (w) {
      return w[0] ? w[0].toLowerCase() : "";
    });
    if (words.length >= 2 && initials[0] && initials[0] === initials[1]) {
      score += 10;
      reasons.push(["plus", 'Alliteration on "' + initials[0] + '" — the cheapest memory hook there is']);
    }
    var vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    var ratio = letters.length ? vowels / letters.length : 0;
    if (ratio < 0.22) {
      score -= 9;
      reasons.push(["minus", "Very consonant-heavy, which makes it hard to say and hard to hear"]);
    } else if (ratio > 0.62) {
      score -= 5;
      reasons.push(["flat", "Vowel-heavy — check it doesn't sound vague when spoken"]);
    } else {
      score += 6;
      reasons.push(["plus", "Balanced sound. Reads cleanly when spoken aloud"]);
    }

    if (/^[a-z]+$/.test(trimmed) || /^[A-Z\s]+$/.test(trimmed)) {
      reasons.push(["flat", "Consider how you'll case this everywhere — pick one form and never vary it"]);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    return { score: score, reasons: reasons, len: len, words: words.length, syl: syl };
  }

  function handleVariants(name) {
    var base = norm(name);
    if (base.length < MIN_HANDLE_LEN) return [];
    var out = [base];
    var w = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (w.length > 1) out.push(norm(w.join("")) + "hq");
    out.push("the" + base);
    out.push(base + "bio");
    return out
      .filter(function (h, i, a) {
        return h && h.length >= MIN_HANDLE_LEN && h.length <= MAX_HANDLE_LEN && a.indexOf(h) === i;
      })
      .slice(0, MAX_HANDLE_VARIANTS);
  }

  /**
   * Estimated YouTube Data API quota units for one audition.
   * channels.list = 1 each; search.list = 100; rival stats channels.list = 1.
   */
  function estimateUnits(name, mode) {
    var n = handleVariants(name).length;
    if (mode === "full") return n + FULL_SCAN_FIXED_UNITS;
    return n;
  }

  function uniqueness(name, rivals, handles, didSearch) {
    var reasons = [],
      score = 100;
    var target = norm(name);

    var takenHandles = handles.filter(function (h) {
      return h.taken === true;
    });
    var freeHandles = handles.filter(function (h) {
      return h.taken === false;
    });

    if (takenHandles.length) {
      var pen = Math.min(24, takenHandles.length * 9);
      score -= pen;
      reasons.push([
        "minus",
        takenHandles.length +
          " of " +
          handles.length +
          " handle variants already taken (@" +
          takenHandles
            .map(function (h) {
              return h.handle;
            })
            .join(", @") +
          ")",
      ]);
    }
    if (freeHandles.length) {
      reasons.push([
        "plus",
        "@" +
          freeHandles[0].handle +
          " is free" +
          (freeHandles.length > 1
            ? " — and " +
              (freeHandles.length - 1) +
              " other variant" +
              (freeHandles.length > 2 ? "s" : "")
            : ""),
      ]);
    }

    if (!didSearch) {
      reasons.push(["flat", "Handle check only. Run a full scan to see who else answers to this name"]);
      return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        reasons: reasons,
        exact: [],
        near: [],
        searched: false,
      };
    }

    rivals = rivals || [];
    var exact = rivals.filter(function (r) {
      return norm(r.title) === target;
    });
    var near = rivals.filter(function (r) {
      var n = norm(r.title);
      return n !== target && (n.indexOf(target) !== -1 || target.indexOf(n) !== -1) && n.length > 2;
    });

    if (exact.length) {
      score -= Math.min(45, 22 + exact.length * 8);
      reasons.push([
        "minus",
        exact.length + " channel" + (exact.length > 1 ? "s use" : " uses") + " this exact name",
      ]);
      var biggest = exact[0];
      if (biggest.subs !== null && biggest.subs >= 100000) {
        score -= 22;
        reasons.push([
          "minus",
          "The largest exact match has " + nfmt(biggest.subs) + " subscribers — you will not outrank it",
        ]);
      } else if (biggest.subs !== null && biggest.subs >= 5000) {
        score -= 9;
        reasons.push([
          "minus",
          "The largest exact match has " + nfmt(biggest.subs) + " subscribers. Established, but beatable",
        ]);
      }
    } else {
      reasons.push(["plus", "No channel uses this exact name"]);
    }

    if (near.length) {
      score -= Math.min(18, near.length * 4);
      reasons.push([
        "minus",
        near.length +
          " channel" +
          (near.length > 1 ? "s have" : " has") +
          " a name that contains or sits inside yours",
      ]);
    }

    var big = rivals.filter(function (r) {
      return r.subs !== null && r.subs >= 500000;
    }).length;
    if (big >= 3) {
      score -= 8;
      reasons.push([
        "flat",
        "This search term is dominated by large channels — expect to be outranked early on",
      ]);
    }

    if (rivals.length <= 5) {
      score += 6;
      reasons.push(["plus", "The search term returns very few channels. Quiet territory"]);
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      reasons: reasons,
      exact: exact,
      near: near,
      searched: true,
    };
  }

  function combinedScore(u, m, didSearch) {
    return didSearch ? Math.round(u * 0.62 + m * 0.38) : Math.round(u * 0.35 + m * 0.65);
  }

  function verdictLabel(combined) {
    if (combined >= 72) return "CLEAR";
    if (combined >= 52) return "TIGHT";
    return "CROWDED";
  }

  return {
    MIN_HANDLE_LEN: MIN_HANDLE_LEN,
    MAX_HANDLE_LEN: MAX_HANDLE_LEN,
    MAX_HANDLE_VARIANTS: MAX_HANDLE_VARIANTS,
    FULL_SCAN_FIXED_UNITS: FULL_SCAN_FIXED_UNITS,
    norm: norm,
    esc: esc,
    nfmt: nfmt,
    isNameValid: isNameValid,
    syllables: syllables,
    memorability: memorability,
    handleVariants: handleVariants,
    estimateUnits: estimateUnits,
    uniqueness: uniqueness,
    combinedScore: combinedScore,
    verdictLabel: verdictLabel,
  };
});
