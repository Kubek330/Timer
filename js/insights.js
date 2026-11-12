/* CubeClock – zaawansowane statystyki: historia, rozkład, rekordy, aktywność, porównanie sesji */
(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = () => getComputedStyle(document.documentElement);
  const col = (v) => css().getPropertyValue(v).trim();
  const dateStr = (ts) => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
  const DAY = 86400000;

  function solvesOf(data, puzzle, range) {
    const out = [];
    data.sessions.forEach((s) => s.solves.forEach((x) => { if (x.puzzle === puzzle) out.push(x); }));
    out.sort((a, b) => a.date - b.date);
    if (range && range !== 'all') {
      const from = Date.now() - Number(range) * DAY;
      return out.filter((x) => x.date >= from);
    }
    return out;
  }

  // przygotowanie płótna w rozdzielczości ekranu
  function canvas(el, h) {
    const cv = document.createElement('canvas');
    cv.className = 'ins-chart';
    cv.style.height = h + 'px';
    el.appendChild(cv);
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600;
    cv.width = W * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, W, H: h };
  }

  function empty(el, msg) {
    el.insertAdjacentHTML('beforeend', `<p class="empty">${msg}</p>`);
  }

  /* ---------- Historia: średnia i najlepszy czas z każdego dnia ---------- */
  function history(el, sv, fmt) {
    const St = window.Stats;
    const days = new Map();
    sv.forEach((x) => {
      const k = Progress.dayKey(x.date);
      if (!days.has(k)) days.set(k, []);
      days.get(k).push(x);
    });
    const rows = [...days.entries()].map(([k, list]) => {
      const ok = list.map(St.value).filter((v) => v !== Infinity);
      return { k, n: list.length, mean: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null, best: ok.length ? Math.min(...ok) : null };
    }).filter((r) => r.mean !== null);

    const ok = sv.map(St.value).filter((v) => v !== Infinity);
    el.insertAdjacentHTML('beforeend', `
      <div class="ins-kpis">
        <div><span>Ułożeń</span><b>${sv.length}</b></div>
        <div><span>Średnia</span><b>${ok.length ? fmt(ok.reduce((a, b) => a + b, 0) / ok.length) : '–'}</b></div>
        <div><span>Najlepszy</span><b>${ok.length ? fmt(Math.min(...ok)) : '–'}</b></div>
        <div><span>Dni treningu</span><b>${days.size}</b></div>
      </div>`);
    if (rows.length < 2) { empty(el, 'Wykres pojawi się po ułożeniach z co najmniej 2 różnych dni.'); return; }

    const { ctx, W, H } = canvas(el, 230);
    const vals = rows.flatMap((r) => [r.mean, r.best]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { hi += 1000; lo = Math.max(0, lo - 1000); }
    const padL = 48, padR = 12, padT = 12, padB = 26;
    const x = (i) => padL + (W - padL - padR) * (i / (rows.length - 1));
    const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    ctx.font = "600 11px 'Nunito Variable', system-ui, sans-serif";
    ctx.lineWidth = 1;
    ctx.strokeStyle = col('--border');
    ctx.fillStyle = col('--muted');
    ctx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * (k / 4);
      ctx.beginPath(); ctx.moveTo(padL, y(v)); ctx.lineTo(W - padR, y(v)); ctx.stroke();
      ctx.fillText(fmt(v), padL - 6, y(v) + 4);
    }
    // etykiety dat: pierwsza, środkowa, ostatnia
    ctx.textAlign = 'center';
    [0, Math.floor((rows.length - 1) / 2), rows.length - 1].forEach((i) => {
      const [yy, mm, dd] = rows[i].k.split('-');
      ctx.fillText(`${dd}.${mm}`, Math.min(W - padR - 14, Math.max(padL + 14, x(i))), H - 8);
    });
    const line = (key, color, w, dots) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round';
      ctx.beginPath();
      rows.forEach((r, i) => (i ? ctx.lineTo(x(i), y(r[key])) : ctx.moveTo(x(i), y(r[key]))));
      ctx.stroke();
      if (dots) rows.forEach((r, i) => { ctx.beginPath(); ctx.arc(x(i), y(r[key]), 2.6, 0, 7); ctx.fill(); });
    };
    line('best', col('--chart-3'), 1.4, false);
    line('mean', col('--chart-2'), 2.2, rows.length <= 40);
    el.insertAdjacentHTML('beforeend', '<div class="legend"><span class="lg l-ao5">średnia dnia</span><span class="lg l-ao12">najlepszy dnia</span></div>');
  }

  /* ---------- Rozkład czasów (histogram) ---------- */
  function distribution(el, sv, fmt) {
    const St = window.Stats;
    const ok = sv.map(St.value).filter((v) => v !== Infinity).sort((a, b) => a - b);
    if (ok.length < 3) { empty(el, 'Ułóż co najmniej 3 razy, aby zobaczyć rozkład czasów.'); return; }
    // obcinamy 2% skrajnych wyników, żeby pojedyncze wpadki nie spłaszczyły wykresu
    const cut = Math.floor(ok.length * 0.02);
    const core = ok.slice(cut, ok.length - cut || undefined);
    const lo0 = core[0], hi0 = core[core.length - 1];
    const steps = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
    const step = steps.find((s) => (hi0 - lo0) / s <= 16) || 60000;
    const lo = Math.floor(lo0 / step) * step;
    const nb = Math.max(1, Math.floor((hi0 - lo) / step) + 1);
    const bins = new Array(nb).fill(0);
    core.forEach((v) => { bins[Math.min(nb - 1, Math.floor((v - lo) / step))]++; });
    const max = Math.max(...bins);
    const label = (ms) => (step >= 1000 && ms % 1000 === 0 ? fmt(ms).replace(/\.00$/, '') : fmt(ms));

    const { ctx, W, H } = canvas(el, 230);
    const padL = 30, padR = 10, padT = 14, padB = 30;
    const bw = (W - padL - padR) / nb;
    ctx.font = "600 11px 'Nunito Variable', system-ui, sans-serif";
    ctx.fillStyle = col('--muted');
    ctx.strokeStyle = col('--border');
    ctx.textAlign = 'right';
    [0, 0.5, 1].forEach((f) => {
      const v = Math.round(max * f);
      const yy = padT + (H - padT - padB) * (1 - v / max);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      ctx.fillText(String(v), padL - 6, yy + 4);
    });
    const peak = bins.indexOf(max);
    bins.forEach((b, i) => {
      const h = (H - padT - padB) * (b / max);
      ctx.fillStyle = i === peak ? col('--chart-2') : col('--chart-1');
      ctx.fillRect(padL + i * bw + 1.5, H - padB - h, Math.max(1, bw - 3), h);
    });
    ctx.fillStyle = col('--muted');
    ctx.textAlign = 'center';
    const every = Math.ceil(nb / 6);
    for (let i = 0; i <= nb; i += every) ctx.fillText(label(lo + i * step), padL + i * bw, H - 10);
    el.insertAdjacentHTML('beforeend', `<p class="muted small center">Najczęściej układasz w przedziale <b>${label(lo + peak * step)}–${label(lo + (peak + 1) * step)}</b> (${max} ${max === 1 ? 'ułożenie' : 'ułożeń'}).</p>`);
  }

  /* ---------- Rekordy z datami ---------- */
  function records(el, data, puzzle, fmt) {
    const St = window.Stats;
    const sv = solvesOf(data, puzzle);
    if (!sv.length) { empty(el, 'Brak ułożeń dla tej kostki.'); return; }
    // kolejne pobicia rekordu pojedynczego
    const prog = [];
    let best = null;
    sv.forEach((x) => {
      const v = St.value(x);
      if (v !== Infinity && (best === null || v < best)) { prog.push({ date: x.date, v, gain: best === null ? null : best - v }); best = v; }
    });
    // najlepsze średnie w obrębie sesji, z datą ostatniego ułożenia średniej
    const avgBest = (n) => {
      let b = null;
      data.sessions.forEach((s) => {
        const list = s.solves.filter((x) => x.puzzle === puzzle);
        for (let i = n - 1; i < list.length; i++) {
          const v = St.avgAt(list, i, n);
          if (v !== null && v !== Infinity && (!b || v < b.v)) b = { v, date: list[i].date, session: s.name };
        }
      });
      return b;
    };
    const avgs = [5, 12, 50, 100].map((n) => [n, avgBest(n)]).filter(([, b]) => b);
    el.insertAdjacentHTML('beforeend', `
      <h3 class="ins-h">Najlepsze wyniki</h3>
      <table class="stats-table">
        <thead><tr><th></th><th>czas</th><th>kiedy</th></tr></thead>
        <tbody>
          <tr><td>pojedynczy</td><td>${fmt(best)}</td><td>${dateStr(prog[prog.length - 1].date)}</td></tr>
          ${avgs.map(([n, b]) => `<tr><td>ao${n}</td><td>${fmt(b.v)}</td><td>${dateStr(b.date)}</td></tr>`).join('')}
        </tbody>
      </table>
      <h3 class="ins-h">Jak poprawiał się rekord (pojedynczy)</h3>
      <table class="stats-table">
        <thead><tr><th>data</th><th>czas</th><th>poprawa</th></tr></thead>
        <tbody>${prog.slice().reverse().map((p) => `<tr><td>${dateStr(p.date)}</td><td>${fmt(p.v)}</td><td class="gain">${p.gain === null ? 'pierwszy' : '−' + fmt(p.gain)}</td></tr>`).join('')}</tbody>
      </table>`);
  }

  /* ---------- Aktywność: kalendarz z ostatnich 20 tygodni ---------- */
  function activity(el, data) {
    const c = Progress.compute(data);
    const weeks = 20;
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // poniedziałek = 0
    const start = Progress.addDays(Progress.dayKey(today.getTime()), -(weeks - 1) * 7 - dow);
    const max = Math.max(1, ...Object.values(c.perDay));
    let cells = '';
    let monthSolves = 0;
    const monthKey = Progress.dayKey(today.getTime()).slice(0, 7);
    Object.entries(c.perDay).forEach(([k, n]) => { if (k.startsWith(monthKey)) monthSolves += n; });
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const k = Progress.addDays(start, w * 7 + d);
        const n = c.perDay[k] || 0;
        const future = k > Progress.dayKey(today.getTime());
        const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
        cells += `<i class="hm l${lvl}${future ? ' fut' : ''}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${k}: ${n}"></i>`;
      }
    }
    el.insertAdjacentHTML('beforeend', `
      <div class="ins-kpis">
        <div><span>Passa</span><b>${Icons.icon('flame', '', 'ic-inline flame')} ${c.streak}</b></div>
        <div><span>Najdłuższa passa</span><b>${c.maxStreak}</b></div>
        <div><span>Dni z kostką</span><b>${Object.keys(c.perDay).length}</b></div>
        <div><span>W tym miesiącu</span><b>${monthSolves}</b></div>
      </div>
      <div class="hm-wrap"><div class="hm-days"><span>pn</span><span></span><span>śr</span><span></span><span>pt</span><span></span><span>nd</span></div><div class="hm-grid">${cells}</div></div>
      <div class="hm-legend">mniej <i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i> więcej</div>`);
  }

  /* ---------- Porównanie sesji ---------- */
  function sessions(el, data, fmt) {
    const St = window.Stats;
    const rows = data.sessions.map((s) => {
      const sv = s.solves;
      return `<tr><td>${esc(s.name)}<small>${esc((Scramble.PUZZLES[s.puzzle] || {}).name || '')}</small></td><td>${sv.length}</td><td>${fmt(St.bestSingle(sv))}</td><td>${fmt(St.sessionMean(sv))}</td><td>${fmt(St.best(sv, 5))}</td><td>${fmt(St.best(sv, 12))}</td></tr>`;
    }).join('');
    el.insertAdjacentHTML('beforeend', `
      <div class="table-scroll"><table class="stats-table sess-table">
        <thead><tr><th>sesja</th><th>ułożeń</th><th>najlepszy</th><th>średnia</th><th>ao5</th><th>ao12</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="muted small">Najlepsze ao5 i ao12 w każdej sesji.</p>`);
  }

  function render(el, data, opts, fmt) {
    el.innerHTML = '';
    const sv = solvesOf(data, opts.puzzle, opts.range);
    if (opts.tab === 'history') history(el, sv, fmt);
    else if (opts.tab === 'dist') distribution(el, sv, fmt);
    else if (opts.tab === 'records') records(el, data, opts.puzzle, fmt);
    else if (opts.tab === 'activity') activity(el, data);
    else if (opts.tab === 'sessions') sessions(el, data, fmt);
  }

  window.Insights = { render };
})();
