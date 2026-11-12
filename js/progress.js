/* CubeClock – osiągnięcia, serie dni i rekordy */
(function () {
  'use strict';

  const St = () => window.Stats;
  const pad2 = (n) => String(n).padStart(2, '0');
  // klucz dnia w czasie lokalnym, np. 2026-11-12
  const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n, 12).getTime()); };

  /* ---------- zbiorcze dane o wszystkich ułożeniach ---------- */
  function compute(data) {
    const all = [];
    data.sessions.forEach((s) => s.solves.forEach((x) => all.push(x)));
    all.sort((a, b) => a.date - b.date);
    const perDay = {};
    all.forEach((x) => { const k = dayKey(x.date); perDay[k] = (perDay[k] || 0) + 1; });
    const puzzles = new Set(all.map((x) => x.puzzle));

    // najlepszy pojedynczy i najlepsze średnie dla 3x3 (średnie liczone w obrębie sesji)
    const best = (puzzle, n) => {
      let b = null;
      data.sessions.forEach((s) => {
        const sv = s.solves.filter((x) => x.puzzle === puzzle);
        const v = n === 1 ? St().bestSingle(sv) : St().best(sv, n);
        if (v !== null && v !== Infinity && (b === null || v < b)) b = v;
      });
      return b;
    };

    // najdłuższa seria ułożeń bez DNF i bez +2 w jednej sesji
    let cleanRun = 0;
    data.sessions.forEach((s) => {
      let run = 0;
      s.solves.forEach((x) => { run = x.penalty ? 0 : run + 1; cleanRun = Math.max(cleanRun, run); });
    });

    const hours = all.map((x) => new Date(x.date).getHours());
    return {
      all,
      total: all.length,
      perDay,
      maxPerDay: Math.max(0, ...Object.values(perDay)),
      puzzles,
      dnf: all.filter((x) => x.penalty === 'DNF').length,
      inspected: all.filter((x) => x.insp).length,
      night: hours.some((h) => h < 4),
      morning: hours.some((h) => h >= 4 && h < 6),
      single333: best('333', 1),
      ao5_333: best('333', 5),
      ao12_333: best('333', 12),
      single222: best('222', 1),
      cleanRun,
      streak: streak(perDay),
      maxStreak: maxStreak(perDay),
      flags: data.flags || {},
    };
  }

  // bieżąca seria: dni z rzędu z co najmniej jednym ułożeniem (dzisiaj może jeszcze nie być ułożenia)
  function streak(perDay) {
    let k = dayKey(Date.now());
    if (!perDay[k]) k = addDays(k, -1);
    let n = 0;
    while (perDay[k]) { n++; k = addDays(k, -1); }
    return n;
  }
  function maxStreak(perDay) {
    const days = Object.keys(perDay).sort();
    let best = 0, run = 0, prev = null;
    days.forEach((k) => { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return best;
  }

  /* ---------- lista osiągnięć ---------- */
  const sub = (v, s) => v !== null && v < s * 1000;
  const cnt = (cur, target) => [Math.min(cur, target), target];
  const ACH = [
    // ułożenia
    { id: 'first', ic: ['cube', ''], cat: 'count', name: 'Pierwsze ułożenie', desc: 'Ułóż kostkę pierwszy raz.', test: (c) => cnt(c.total, 1) },
    { id: 's10', ic: ['count', '10'], cat: 'count', name: 'Rozgrzewka', desc: 'Ułóż kostkę 10 razy.', test: (c) => cnt(c.total, 10) },
    { id: 's50', ic: ['count', '50'], cat: 'count', name: 'Wkręcony', desc: 'Ułóż kostkę 50 razy.', test: (c) => cnt(c.total, 50) },
    { id: 's100', ic: ['count', '100'], cat: 'count', name: 'Setka', desc: 'Ułóż kostkę 100 razy.', test: (c) => cnt(c.total, 100) },
    { id: 's500', ic: ['count', '500'], cat: 'count', name: 'Pracuś', desc: 'Ułóż kostkę 500 razy.', test: (c) => cnt(c.total, 500) },
    { id: 's1000', ic: ['count', '1K'], cat: 'count', name: 'Tysiącznik', desc: 'Ułóż kostkę 1000 razy.', test: (c) => cnt(c.total, 1000) },
    { id: 'day50', ic: ['run', ''], cat: 'count', name: 'Maraton', desc: 'Ułóż kostkę 50 razy jednego dnia.', test: (c) => cnt(c.maxPerDay, 50) },
    // czasy 3x3
    { id: 'sub60', ic: ['watch', '60'], cat: 'speed', name: 'Poniżej minuty', desc: 'Ułóż 3x3 w mniej niż 60 s.', test: (c) => sub(c.single333, 60) },
    { id: 'sub45', ic: ['watch', '45'], cat: 'speed', name: 'Sub-45', desc: 'Ułóż 3x3 w mniej niż 45 s.', test: (c) => sub(c.single333, 45) },
    { id: 'sub30', ic: ['watch', '30'], cat: 'speed', name: 'Sub-30', desc: 'Ułóż 3x3 w mniej niż 30 s.', test: (c) => sub(c.single333, 30) },
    { id: 'sub20', ic: ['watch', '20'], cat: 'speed', name: 'Sub-20', desc: 'Ułóż 3x3 w mniej niż 20 s.', test: (c) => sub(c.single333, 20) },
    { id: 'sub15', ic: ['watch', '15'], cat: 'speed', name: 'Sub-15', desc: 'Ułóż 3x3 w mniej niż 15 s.', test: (c) => sub(c.single333, 15) },
    { id: 'sub10', ic: ['watch', '10'], cat: 'speed', name: 'Sub-10', desc: 'Ułóż 3x3 w mniej niż 10 s.', test: (c) => sub(c.single333, 10) },
    { id: 'ao5s30', ic: ['avg', '30'], cat: 'speed', name: 'Stabilna trzydziestka', desc: 'Średnia ao5 na 3x3 poniżej 30 s.', test: (c) => sub(c.ao5_333, 30) },
    { id: 'ao5s20', ic: ['avg', '20'], cat: 'speed', name: 'Stabilna dwudziestka', desc: 'Średnia ao5 na 3x3 poniżej 20 s.', test: (c) => sub(c.ao5_333, 20) },
    { id: 'ao12s30', ic: ['target', ''], cat: 'speed', name: 'Równa forma', desc: 'Średnia ao12 na 3x3 poniżej 30 s.', test: (c) => sub(c.ao12_333, 30) },
    { id: 'sub5_222', ic: ['cube2', ''], cat: 'speed', name: 'Mały, ale szybki', desc: 'Ułóż 2x2 w mniej niż 5 s.', test: (c) => sub(c.single222, 5) },
    { id: 'clean12', ic: ['sparkle', ''], cat: 'speed', name: 'Czysta dwunastka', desc: '12 ułożeń z rzędu bez +2 i DNF.', test: (c) => cnt(c.cleanRun, 12) },
    // serie dni
    { id: 'streak3', ic: ['flame', '3'], cat: 'streak', name: 'Seria 3 dni', desc: 'Układaj 3 dni z rzędu.', test: (c) => cnt(c.maxStreak, 3) },
    { id: 'streak7', ic: ['flame', '7'], cat: 'streak', name: 'Tydzień z kostką', desc: 'Układaj 7 dni z rzędu.', test: (c) => cnt(c.maxStreak, 7) },
    { id: 'streak30', ic: ['cal', '30'], cat: 'streak', name: 'Miesiąc bez przerwy', desc: 'Układaj 30 dni z rzędu.', test: (c) => cnt(c.maxStreak, 30) },
    // kostki
    { id: 'big', ic: ['cube7', ''], cat: 'puzzle', name: 'Wielka kostka', desc: 'Ułóż 7x7.', test: (c) => c.puzzles.has('777') },
    { id: 'minx', ic: ['pentagon', ''], cat: 'puzzle', name: 'Dwunastościan', desc: 'Ułóż Megaminxa.', test: (c) => c.puzzles.has('minx') },
    { id: 'nxn', ic: ['stack', ''], cat: 'puzzle', name: 'Cała rodzina', desc: 'Ułóż każdą kostkę od 2x2 do 7x7.', test: (c) => cnt(['222', '333', '444', '555', '666', '777'].filter((p) => c.puzzles.has(p)).length, 6) },
    { id: 'collector', ic: ['shapes', ''], cat: 'puzzle', name: 'Kolekcjoner', desc: 'Ułóż 5 różnych łamigłówek.', test: (c) => cnt(c.puzzles.size, 5) },
    // inne
    { id: 'insp10', ic: ['eye', ''], cat: 'other', name: 'Jak na zawodach', desc: '10 ułożeń z inspekcją 15 s.', test: (c) => cnt(c.inspected, 10) },
    { id: 'guide', ic: ['compass', ''], cat: 'other', name: 'Mistrz mieszania', desc: 'Przejdź cały scramble w podglądzie 3D.', test: (c) => !!c.flags.guide },
    { id: 'night', ic: ['moon', ''], cat: 'other', name: 'Nocny marek', desc: 'Ułóż kostkę między północą a 4:00.', test: (c) => c.night },
    { id: 'morning', ic: ['sunrise', ''], cat: 'other', name: 'Ranny ptaszek', desc: 'Ułóż kostkę między 4:00 a 6:00.', test: (c) => c.morning },
    { id: 'dnf', ic: ['dnf', ''], cat: 'other', name: 'Bywa i tak', desc: 'Zdobądź pierwszy DNF.', test: (c) => cnt(c.dnf, 1) },
  ];

  const done = (r) => (Array.isArray(r) ? r[0] >= r[1] : !!r);

  // odznaka: sześciokąt w kolorze kategorii z ikoną w środku
  function badge(a, on) {
    return `<span class="badge cat-${a.cat}${on ? ' lit' : ''}"><svg class="badge-bg" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2.5 35.2 11.25v17.5L20 37.5 4.8 28.75v-17.5z"/></svg>${Icons.icon(a.ic[0], a.ic[1], 'badge-ic')}</span>`;
  }

  // sprawdza osiągnięcia; zwraca nowo odblokowane
  function check(data, ctx) {
    data.achievements = data.achievements || {};
    const c = ctx || compute(data);
    const fresh = [];
    ACH.forEach((a) => {
      if (data.achievements[a.id]) return;
      if (done(a.test(c))) { data.achievements[a.id] = Date.now(); fresh.push(a); }
    });
    return fresh;
  }

  function renderAchievements(data, el) {
    const c = compute(data);
    const got = data.achievements || {};
    const n = ACH.filter((a) => got[a.id]).length;
    const items = ACH.map((a) => {
      const r = a.test(c);
      const has = !!got[a.id];
      const prog = !has && Array.isArray(r) && r[1] > 1
        ? `<span class="ach-bar"><i style="width:${(100 * r[0] / r[1]).toFixed(1)}%"></i></span><span class="ach-num">${r[0]} / ${r[1]}</span>`
        : '';
      const when = has ? `<span class="ach-date">${new Date(got[a.id]).toLocaleDateString('pl-PL')}</span>` : '';
      return `<li class="ach${has ? ' on' : ''}">${badge(a)}<span class="ach-txt"><b>${a.name}</b><small>${a.desc}</small>${prog}</span>${when}</li>`;
    }).join('');
    el.innerHTML = `
      <div class="ach-head">
        <div><b>${n}</b> / ${ACH.length} odblokowanych</div>
        <div class="ach-streak">${Icons.icon('flame', '', 'ic-inline flame')} Seria: <b>${c.streak}</b> ${c.streak === 1 ? 'dzień' : 'dni'} · najdłuższa: ${c.maxStreak}</div>
        <span class="ach-bar big"><i style="width:${(100 * n / ACH.length).toFixed(1)}%"></i></span>
      </div>
      <ul class="ach-list">${items}</ul>`;
  }

  /* ---------- rekordy ---------- */
  // porównuje ostatnie ułożenie z wcześniejszymi rekordami (pojedynczy: wszystkie sesje danej kostki; średnie: bieżąca sesja)
  function detectRecords(data, sessionObj) {
    const st = St();
    const sv = sessionObj.solves;
    const last = sv[sv.length - 1];
    if (!last) return [];
    const out = [];
    const before = [];
    data.sessions.forEach((s) => s.solves.forEach((x) => { if (x !== last && x.puzzle === last.puzzle) before.push(x); }));
    const v = st.value(last);
    const prevBest = st.bestSingle(before);
    if (v !== Infinity && prevBest !== null && prevBest !== Infinity && v < prevBest) out.push({ label: 'pojedynczy', value: v, prev: prevBest });

    const same = sv.filter((x) => x.puzzle === last.puzzle);
    [5, 12].forEach((n) => {
      if (same.length < n + 1) return;
      const cur = st.current(same, n);
      const prev = st.best(same.slice(0, -1), n);
      if (cur !== null && cur !== Infinity && prev !== null && prev !== Infinity && cur < prev) out.push({ label: 'ao' + n, value: cur, prev });
    });
    return out;
  }

  /* ---------- efekty: konfetti, baner rekordu, baner osiągnięcia ---------- */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let confettiRaf = 0;
  function confetti() {
    if (reduced.matches) return;
    let cv = document.getElementById('confetti');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv); }
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const colors = ['#ffffff', '#e8323c', '#2fb34a', '#ffd400', '#ff8a1f', '#2766e0'];
    const parts = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 15 - 5,
      s: 5 + Math.random() * 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    cancelAnimationFrame(confettiRaf);
    const t0 = performance.now();
    const frame = (now) => {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2600);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      });
      if (t < 2600) confettiRaf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    confettiRaf = requestAnimationFrame(frame);
  }

  // banery pokazywane po kolei (rekord, potem osiągnięcia)
  const queue = [];
  let showing = false;
  function banner(html, cls, ms) {
    queue.push({ html, cls, ms: ms || 3200 });
    if (!showing) nextBanner();
  }
  function nextBanner() {
    const item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;
    let b = document.getElementById('ccBanner');
    if (!b) { b = document.createElement('div'); b.id = 'ccBanner'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.className = 'cc-banner ' + (item.cls || '');
    b.innerHTML = item.html;
    b.hidden = false;
    void b.offsetWidth;
    b.classList.add('show');
    setTimeout(() => {
      b.classList.remove('show');
      setTimeout(() => { b.hidden = true; nextBanner(); }, 300);
    }, item.ms);
  }

  function celebrate(records, fmt) {
    if (!records.length) return;
    const rows = records.map((r) => `<div class="rec-row"><span>${r.label}</span><b>${fmt(r.value)}</b><em>−${fmt(r.prev - r.value)}</em></div>`).join('');
    banner(`<div class="rec-title">${Icons.icon('trophy', '', 'ic-inline')} Nowy rekord!</div>${rows}`, 'record', 3600);
    confetti();
    if (navigator.vibrate) { try { navigator.vibrate([30, 60, 30]); } catch (e) { /* brak wibracji */ } }
  }

  function announce(list) {
    if (!list.length) return;
    const a = list[0];
    const more = list.length > 1 ? `<small>i jeszcze ${list.length - 1}</small>` : '';
    banner(`${badge(a, true)}<span><small>Osiągnięcie odblokowane</small><b>${a.name}</b>${more}</span>`, 'ach-pop', 3000);
  }

  window.Progress = { dayKey, addDays, compute, check, renderAchievements, detectRecords, celebrate, announce, count: () => ACH.length };
})();
