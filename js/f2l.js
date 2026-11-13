/* CubeClock – trener F2L: 41 przypadków wstawiania pary do slotu z prawej z przodu (FR) */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // Algorytmy wyszukane komputerowo (najkrótsze wygodne w ruchach R, U, F) i sprawdzone na symulatorze:
  // każdy zostawia krzyż i trzy pozostałe sloty w spokoju i wstawia parę FR.
  const CASES = [
    ['up', "R U R' F' U' F"],
    ['up', "F' U2 F U F' U' F"],
    ['up', "F' U2 F U' F' U F"],
    ['up', "F2 U2 F U F' U F2"],
    ['up', "R U' R' U2 R U R'"],
    ['up', "R U2 R' U R U' R'"],
    ['up', "R U2 R' U' R U R'"],
    ['up', "R2 U2 R' U' R U' R2"],
    ['side', "F' U' F"],
    ['side', "F' U2 F"],
    ['side', "R U R'"],
    ['side', "R U' R'"],
    ['side', "F' U F U' F' U' F"],
    ['side', "F' U F U2 R U R'"],
    ['side', "F' U' F U F' U2 F"],
    ['side', "F' U2 F U F' U2 F"],
    ['side', "F' U2 F U' R U R'"],
    ['side', "R U R' U' R U2 R'"],
    ['side', "R U R' U2 F' U' F"],
    ['side', "R U' R' U R U R'"],
    ['side', "R U' R' U' R U R'"],
    ['side', "R U' R' U2 F' U' F"],
    ['side', "R U2 R' U F' U' F"],
    ['side', "R U2 R' U' R U2 R'"],
    ['eslot', "F' U F R U2 R'"],
    ['eslot', "F' U' F U' R U R'"],
    ['eslot', "R U R' U' F' U F"],
    ['eslot', "R U R' U2 R U R'"],
    ['eslot', "R U' R' U' R U2 R'"],
    ['eslot', "F R' F' R U' R U R'"],
    ['cslot', "R U' R' F' U' F"],
    ['cslot', "R U2 R' F' U2 F"],
    ['cslot', "F' U2 F U2 R U R'"],
    ['cslot', "R U R' U' R U R'"],
    ['cslot', "R U' R' U R U' R'"],
    ['cslot', "R U2 R' U2 F' U' F"],
    ['both', "R F U R U' R' F' U' R'"],
    ['both', "R U F R U R' U' F' R'"],
    ['both', "R U2 R U R' U R U2 R2"],
    ['both', "R2 U2 R' U' R U' R' U2 R'"],
    ['both', "F' U F U' R U2 R' U' R U2 R'"],
  ].map(([group, alg], i) => ({ id: i + 1, group, alg }));

  const GROUPS = {
    up: 'Biały do góry',
    side: 'Biały na boku',
    eslot: 'Krawędź w slocie',
    cslot: 'Narożnik w slocie',
    both: 'Oba w slocie',
  };

  const inv = (m) => (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : m + "'");
  const setupOf = (c) => c.alg.split(' ').reverse().map(inv);

  let app = null;     // { data, save, fmt, toast, onTrained }
  let view = null;
  let cur = null;
  let timer = { state: 'idle', t0: 0, raf: 0 };
  let busy = false;

  const store = () => {
    const d = app.data;
    d.f2l = d.f2l || {};
    d.f2l.sel = Array.isArray(d.f2l.sel) ? d.f2l.sel : CASES.map((c) => c.id);
    d.f2l.stats = d.f2l.stats || {};
    return d.f2l;
  };

  function caseStats(id) {
    const t = store().stats[id] || [];
    if (!t.length) return null;
    const last = t.slice(-5);
    return { n: t.length, best: Math.min(...t), avg: last.reduce((a, b) => a + b, 0) / last.length };
  }

  // losowanie: przypadki bez prób i wolniejsze częściej, bez powtórki tego samego
  function pick() {
    const sel = store().sel.filter((id) => CASES[id - 1]);
    const pool = sel.length ? sel : CASES.map((c) => c.id);
    const avgs = pool.map((id) => (caseStats(id) || {}).avg).filter(Boolean);
    const mean = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 1;
    const weights = pool.map((id) => {
      if (cur && id === cur.id && pool.length > 1) return 0;
      const s = caseStats(id);
      return s ? Math.max(0.4, s.avg / mean) ** 2 : 2.5;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return CASES[pool[i] - 1]; }
    return CASES[pool[pool.length - 1] - 1];
  }

  function show(c) {
    cur = c;
    stopTimer(false);
    setTime(0);
    $('#f2lCase').textContent = `Przypadek ${c.id}`;
    $('#f2lGroup').textContent = GROUPS[c.group];
    $('#f2lSetup').textContent = setupOf(c).join(' ');
    $('#f2lAlg').textContent = c.alg;
    $('#f2lAlgRow').hidden = true;
    $('#f2lReveal').hidden = false;
    view.set(setupOf(c));
    renderCaseStats();
    $('#f2lHint').textContent = touch() ? 'Ustaw przypadek na kostce, potem stuknij czas, żeby zacząć.' : 'Ustaw przypadek na kostce, potem spacja: start / stop.';
  }

  const touch = () => window.matchMedia('(pointer: coarse)').matches;

  function renderCaseStats() {
    const s = caseStats(cur.id);
    $('#f2lCaseStats').innerHTML = s
      ? `<span>Próby <b>${s.n}</b></span><span>Najlepszy <b>${app.fmt(s.best)}</b></span><span>Średnia z 5 <b>${app.fmt(s.avg)}</b></span>`
      : '<span>Nowy przypadek, jeszcze bez prób</span>';
  }

  /* ---------- czas ---------- */
  function setTime(ms) { $('#f2lTimer').textContent = app.fmt(ms); }

  function toggleTimer() {
    if (busy) return;
    if (timer.state === 'running') { stopTimer(true); return; }
    timer.state = 'running';
    timer.t0 = performance.now();
    $('#f2lTimer').classList.add('running');
    const tick = () => {
      if (timer.state !== 'running') return;
      setTime(performance.now() - timer.t0);
      timer.raf = requestAnimationFrame(tick);
    };
    timer.raf = requestAnimationFrame(tick);
  }

  function stopTimer(record) {
    cancelAnimationFrame(timer.raf);
    const was = timer.state === 'running';
    timer.state = 'idle';
    $('#f2lTimer').classList.remove('running');
    if (!record || !was) return;
    const ms = Math.round(performance.now() - timer.t0);
    setTime(ms);
    const st = store();
    const list = st.stats[cur.id] = st.stats[cur.id] || [];
    list.push(ms);
    if (list.length > 50) list.splice(0, list.length - 50);
    app.save();
    reveal();
    renderCaseStats();
    renderPicker();
    if (app.onTrained) app.onTrained();
  }

  /* ---------- algorytm i animacje ---------- */
  function reveal() {
    $('#f2lAlgRow').hidden = false;
    $('#f2lReveal').hidden = true;
  }

  async function playMoves(list, from) {
    if (busy) return;
    busy = true;
    view.set(from);
    for (const mv of list) {
      // eslint-disable-next-line no-await-in-loop
      await view.animate(mv, 380);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 90));
    }
    busy = false;
  }

  // pokaz algorytmu: z przypadku do ułożonego slotu, a potem powrót do przypadku
  async function playAlg() {
    await playMoves(cur.alg.split(' '), setupOf(cur));
    setTimeout(() => { if (!busy && cur) view.set(setupOf(cur)); }, 1200);
  }

  // pokaz ustawienia: od ułożonej kostki do przypadku
  async function playSetup() {
    await playMoves(setupOf(cur), []);
  }

  /* ---------- wybór przypadków ---------- */
  function renderPicker() {
    const st = store();
    const sel = new Set(st.sel);
    const avgs = CASES.map((c) => (caseStats(c.id) || {}).avg).filter(Boolean);
    const mean = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    let html = '';
    Object.entries(GROUPS).forEach(([g, name]) => {
      const list = CASES.filter((c) => c.group === g);
      const all = list.every((c) => sel.has(c.id));
      html += `<div class="f2l-group"><label class="f2l-ghead"><input type="checkbox" data-group="${g}" ${all ? 'checked' : ''}> ${name} <small>${list.length}</small></label><div class="f2l-chips">`;
      list.forEach((c) => {
        const s = caseStats(c.id);
        const speed = !s ? 'new' : (mean && s.avg > mean * 1.15 ? 'slow' : (mean && s.avg < mean * 0.85 ? 'fast' : 'mid'));
        html += `<button class="f2l-chip ${sel.has(c.id) ? 'on' : ''} sp-${speed}" data-id="${c.id}" title="${c.alg}"><b>${c.id}</b><span>${s ? app.fmt(s.avg) : '–'}</span></button>`;
      });
      html += '</div></div>';
    });
    $('#f2lPicker').innerHTML = html;
    const trained = CASES.filter((c) => caseStats(c.id)).length;
    $('#f2lProgress').textContent = `Przećwiczone: ${trained} / ${CASES.length} · wybrane: ${st.sel.length}`;
  }

  function onPicker(e) {
    const st = store();
    const chip = e.target.closest('.f2l-chip');
    const grp = e.target.closest('input[data-group]');
    if (chip) {
      const id = Number(chip.dataset.id);
      st.sel = st.sel.includes(id) ? st.sel.filter((x) => x !== id) : st.sel.concat(id);
    } else if (grp) {
      const ids = CASES.filter((c) => c.group === grp.dataset.group).map((c) => c.id);
      st.sel = grp.checked ? Array.from(new Set(st.sel.concat(ids))) : st.sel.filter((x) => !ids.includes(x));
    } else return;
    app.save();
    renderPicker();
  }

  /* ---------- otwieranie ---------- */
  function open() {
    $('#modalF2L').hidden = false;
    // kostka trzymana białym na dole i zielonym z przodu: góra żółta, prawa pomarańczowa, lewa czerwona
    if (!view) view = new Cube3D.View($('#f2lStage'), { mask: (p) => p.home[1] === 2, colorMap: [3, 4, 2, 0, 1, 5] });
    renderPicker();
    show(pick());
  }

  function close() {
    stopTimer(false);
    busy = false;
    $('#modalF2L').hidden = true;
  }

  function init(ctx) {
    app = ctx;
    $('#f2lNext').addEventListener('click', (e) => { e.currentTarget.blur(); if (!busy) show(pick()); });
    $('#f2lReveal').addEventListener('click', reveal);
    $('#f2lPlay').addEventListener('click', playAlg);
    $('#f2lSetupPlay').addEventListener('click', playSetup);
    $('#f2lTimer').addEventListener('click', toggleTimer);
    $('#f2lPicker').addEventListener('click', onPicker);
    $('#f2lAll').addEventListener('click', () => { store().sel = CASES.map((c) => c.id); app.save(); renderPicker(); });
    $('#f2lSlow').addEventListener('click', () => {
      // tylko najwolniejsze i nieprzećwiczone
      const withAvg = CASES.map((c) => [c.id, (caseStats(c.id) || {}).avg]);
      const known = withAvg.filter(([, a]) => a).sort((a, b) => b[1] - a[1]);
      const slow = known.slice(0, Math.max(5, Math.ceil(known.length / 3))).map(([id]) => id);
      const fresh = withAvg.filter(([, a]) => !a).map(([id]) => id);
      store().sel = slow.concat(fresh);
      app.save();
      renderPicker();
      app.toast('Wybrano najwolniejsze i nowe przypadki');
    });
    $('#modalF2L').addEventListener('click', (e) => {
      if (e.target.id === 'modalF2L' || e.target.closest('[data-close-f2l]')) close();
    });
    window.addEventListener('resize', () => { if (view && !$('#modalF2L').hidden) view.layout(); });
  }

  window.F2L = {
    init,
    open,
    close,
    count: CASES.length,
    trained: (data) => Object.keys((data.f2l && data.f2l.stats) || {}).length,
    isOpen: () => !!$('#modalF2L') && !$('#modalF2L').hidden,
    key: (e) => {
      if (e.code === 'Space') { if (!e.repeat) toggleTimer(); return true; }
      if (e.key === 'Enter' || e.key === 'ArrowRight') { if (!busy && timer.state !== 'running') show(pick()); return true; }
      if (e.key === 'Escape') { close(); return true; }
      return false;
    },
    CASES,
  };
})();
