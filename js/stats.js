/* CubeClock – statystyki (średnie WCA, rekordy) */
(function () {
  'use strict';

  // czas z uwzględnieniem kary; DNF = Infinity
  function value(s) {
    if (s.penalty === 'DNF') return Infinity;
    return s.time + (s.penalty === 2 ? 2000 : 0);
  }

  // średnia WCA z N czasów: odrzucamy ~5% najlepszych i najgorszych
  function average(solves) {
    const n = solves.length;
    if (n === 0) return null;
    const trim = n >= 5 ? Math.ceil(n * 0.05) : 0;
    const vals = solves.map(value).sort((a, b) => a - b);
    const mid = vals.slice(trim, n - trim);
    if (mid.some((v) => v === Infinity)) return Infinity;
    return mid.reduce((a, b) => a + b, 0) / mid.length;
  }

  // średnia arytmetyczna (mo3)
  function mean(solves) {
    if (!solves.length) return null;
    const vals = solves.map(value);
    if (vals.some((v) => v === Infinity)) return Infinity;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // aoN kończąca się na indeksie i (włącznie)
  function avgAt(solves, i, n) {
    if (i + 1 < n) return null;
    const win = solves.slice(i + 1 - n, i + 1);
    return n === 3 ? mean(win) : average(win);
  }

  function current(solves, n) {
    return avgAt(solves, solves.length - 1, n);
  }

  function best(solves, n) {
    let b = null;
    for (let i = n - 1; i < solves.length; i++) {
      const v = avgAt(solves, i, n);
      if (v !== null && (b === null || v < b)) b = v;
    }
    return b;
  }

  function bestSingle(solves) {
    let b = null;
    for (const s of solves) {
      const v = value(s);
      if (b === null || v < b) b = v;
    }
    return b;
  }

  function worstSingle(solves) {
    let w = null;
    for (const s of solves) {
      const v = value(s);
      if (v !== Infinity && (w === null || v > w)) w = v;
    }
    return w;
  }

  function sessionMean(solves) {
    const ok = solves.map(value).filter((v) => v !== Infinity);
    if (!ok.length) return null;
    return ok.reduce((a, b) => a + b, 0) / ok.length;
  }

  // formatowanie: 12.34, 1:02.50, DNF, –
  function fmt(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return '–';
    if (ms === Infinity) return 'DNF';
    const cs = Math.floor(ms / 10);
    const m = Math.floor(cs / 6000);
    const s = Math.floor((cs % 6000) / 100);
    const c = cs % 100;
    const cc = String(c).padStart(2, '0');
    if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${cc}`;
    return `${s}.${cc}`;
  }

  function fmtSolve(s) {
    if (s.penalty === 'DNF') return 'DNF(' + fmt(s.time) + ')';
    if (s.penalty === 2) return fmt(s.time + 2000) + '+';
    return fmt(s.time);
  }

  window.Stats = { value, average, mean, avgAt, current, best, bestSingle, worstSingle, sessionMean, fmt, fmtSolve };
})();
