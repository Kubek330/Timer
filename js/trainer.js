/* CubeClock – trenery algorytmów: F2L (41), 2-look OLL (10) i PLL (21) na kostce 3D */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* ---------- zestawy przypadków ---------- */
  // F2L: algorytmy wyszukane komputerowo (tools/f2l_search.py), sprawdzone na symulatorze (tools/f2l_verify.js)
  const F2L_CASES = [
    ['up', "R U R' F' U' F"], ['up', "F' U2 F U F' U' F"], ['up', "F' U2 F U' F' U F"], ['up', "F2 U2 F U F' U F2"],
    ['up', "R U' R' U2 R U R'"], ['up', "R U2 R' U R U' R'"], ['up', "R U2 R' U' R U R'"], ['up', "R2 U2 R' U' R U' R2"],
    ['side', "F' U' F"], ['side', "F' U2 F"], ['side', "R U R'"], ['side', "R U' R'"],
    ['side', "F' U F U' F' U' F"], ['side', "F' U F U2 R U R'"], ['side', "F' U' F U F' U2 F"], ['side', "F' U2 F U F' U2 F"],
    ['side', "F' U2 F U' R U R'"], ['side', "R U R' U' R U2 R'"], ['side', "R U R' U2 F' U' F"], ['side', "R U' R' U R U R'"],
    ['side', "R U' R' U' R U R'"], ['side', "R U' R' U2 F' U' F"], ['side', "R U2 R' U F' U' F"], ['side', "R U2 R' U' R U2 R'"],
    ['eslot', "F' U F R U2 R'"], ['eslot', "F' U' F U' R U R'"], ['eslot', "R U R' U' F' U F"], ['eslot', "R U R' U2 R U R'"],
    ['eslot', "R U' R' U' R U2 R'"], ['eslot', "F R' F' R U' R U R'"],
    ['cslot', "R U' R' F' U' F"], ['cslot', "R U2 R' F' U2 F"], ['cslot', "F' U2 F U2 R U R'"], ['cslot', "R U R' U' R U R'"],
    ['cslot', "R U' R' U R U' R'"], ['cslot', "R U2 R' U2 F' U' F"],
    ['both', "R F U R U' R' F' U' R'"], ['both', "R U F R U R' U' F' R'"], ['both', "R U2 R U R' U R U2 R2"],
    ['both', "R2 U2 R' U' R U' R' U2 R'"], ['both', "F' U F U' R U2 R' U' R U2 R'"],
  ].map(([group, alg], i) => ({ id: i + 1, name: `Przypadek ${i + 1}`, short: `#${i + 1}`, group, alg }));

  // 2-look OLL i PLL: standardowe algorytmy, sprawdzone na symulatorze (tools/ll_verify.js)
  const OLL_CASES = [
    ['eo', 'Kreska', "F R U R' U' F'"],
    ['eo', 'Litera L', "f R U R' U' f'"],
    ['eo', 'Kropka', "F R U R' U' F' f R U R' U' f'"],
    ['co', 'Sune', "R U R' U R U2 R'"],
    ['co', 'Antisune', "R U2 R' U' R U' R'"],
    ['co', 'H', "R U R' U R U' R' U R U2 R'"],
    ['co', 'Pi', "R U2 R2 U' R2 U' R2 U2 R"],
    ['co', 'U (reflektory)', "R2 D R' U2 R D' R' U2 R'"],
    ['co', 'T', "r U R' U' r' F R F'"],
    ['co', 'L (muszka)', "F' r U R' U' r' F R"],
  ].map(([group, name, alg], i) => ({ id: i + 1, name, short: name.split(' ')[0], group, alg }));

  const PLL_CASES = [
    ['edges', 'Ua', "R U' R U R U R U' R' U' R2"],
    ['edges', 'Ub', "R2 U R U R' U' R' U' R' U R'"],
    ['edges', 'H', "M2 U M2 U2 M2 U M2"],
    ['edges', 'Z', "M' U M2 U M2 U M' U2 M2"],
    ['corners', 'Aa', "x R' U R' D2 R U' R' D2 R2 x'"],
    ['corners', 'Ab', "x R2 D2 R U R' D2 R U' R x'"],
    ['corners', 'E', "x' R U' R' D R U R' D' R U R' D R U' R' D' x"],
    ['adj', 'T', "R U R' U' R' F R2 U' R' U' R U R' F'"],
    ['adj', 'F', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"],
    ['adj', 'Ja', "R' U L' U2 R U' R' U2 R L"],
    ['adj', 'Jb', "R U R' F' R U R' U' R' F R2 U' R'"],
    ['adj', 'Ra', "R U' R' U' R U R D R' U' R D' R' U2 R'"],
    ['adj', 'Rb', "R2 F R U R U' R' F' R U2 R' U2 R"],
    ['diag', 'V', "R' U R' d' R' F' R2 U' R' U R' F R F y'"],
    ['diag', 'Y', "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
    ['diag', 'Na', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"],
    ['diag', 'Nb', "R' U R U' R' F' U' F R U R' F R' F' R U' R"],
    ['g', 'Ga', "R2 U R' U R' U' R U' R2 U' D R' U R D'"],
    ['g', 'Gb', "R' U' R U D' R2 U R' U R U' R U' R2 D"],
    ['g', 'Gc', "R2 U' R U' R U R' U R2 U D' R U' R' D"],
    ['g', 'Gd', "R U R' U' D R2 U' R U' R' U R' U R2 D'"],
  ].map(([group, name, alg], i) => ({ id: i + 1, name: `${name}-perm`, short: name, group, alg }));

  const isCorner = (h) => h[0] !== 0 && h[2] !== 0;
  const SETS = {
    f2l: {
      title: 'F2L',
      desc: '41 przypadków wstawiania pary do slotu',
      note: 'Slot z prawej z przodu. Szare naklejki to ostatnia warstwa, która tu nie ma znaczenia.',
      groups: { up: 'Biały do góry', side: 'Biały na boku', eslot: 'Krawędź w slocie', cslot: 'Narożnik w slocie', both: 'Oba w slocie' },
      cases: F2L_CASES,
      mask: (p) => p.home[1] === 2,
      view: { rx: -28, ry: -38 },
      auf: false,
    },
    oll: {
      title: '2-look OLL',
      desc: '10 algorytmów: krzyż na górze, potem narożniki',
      note: 'Patrz na żółte naklejki. W kroku 1 liczą się tylko krawędzie, w kroku 2 narożniki.',
      groups: { eo: 'Krok 1: żółty krzyż', co: 'Krok 2: żółte narożniki' },
      cases: OLL_CASES,
      // pokazujemy tylko żółty; w kroku 1 także żółte narożniki są szare
      mask: (p, c) => p.home[1] === 2 && (p.c !== 0 || (c.group === 'eo' && isCorner(p.home))),
      view: { rx: -52, ry: -30 },
      auf: true,
    },
    pll: {
      title: 'PLL',
      desc: '21 permutacji ostatniej warstwy',
      note: 'Żółta góra jest już gotowa. Rozpoznawaj po bokach ostatniej warstwy, np. po „reflektorach” (dwie takie same naklejki obok siebie).',
      groups: { edges: 'Tylko krawędzie', corners: 'Tylko narożniki', adj: 'Narożniki obok siebie', diag: 'Narożniki na ukos', g: 'G-perm' },
      cases: PLL_CASES,
      mask: null,
      view: { rx: -24, ry: -38 },
      auf: true,
    },
  };
  const ORDER = ['f2l', 'oll', 'pll'];

  const inv = (m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'");
  const setupOf = (c) => c.alg.split(' ').reverse().map(inv);
  const U_OF = ['', 'U', 'U2', "U'"];

  /* ---------- stan ---------- */
  let app = null;   // { data, save, fmt, toast, onTrained }
  let view = null;
  let setKey = 'f2l';
  let cur = null;   // { c, auf }
  const history = [];
  let timer = { state: 'idle', t0: 0, raf: 0 };
  let busy = false;

  const set = () => SETS[setKey];

  function store(key) {
    const d = app.data;
    d.trainers = d.trainers || {};
    // przeniesienie danych z pierwszej wersji trenera F2L
    if (d.f2l && !d.trainers.f2l) { d.trainers.f2l = d.f2l; delete d.f2l; }
    const k = key || setKey;
    const s = d.trainers[k] = d.trainers[k] || {};
    s.sel = Array.isArray(s.sel) ? s.sel : SETS[k].cases.map((c) => c.id);
    s.stats = s.stats || {};
    return s;
  }

  function caseStats(id, key) {
    const t = store(key).stats[id] || [];
    if (!t.length) return null;
    const last = t.slice(-5);
    return { n: t.length, best: Math.min(...t), avg: last.reduce((a, b) => a + b, 0) / last.length };
  }

  // przypadki bez prób i wolniejsze losowane częściej; bez powtórki tego samego
  function pick() {
    const cases = set().cases;
    const sel = store().sel.filter((id) => cases[id - 1]);
    const pool = sel.length ? sel : cases.map((c) => c.id);
    const avgs = pool.map((id) => (caseStats(id) || {}).avg).filter(Boolean);
    const mean = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 1;
    const weights = pool.map((id) => {
      if (cur && id === cur.c.id && pool.length > 1) return 0;
      const s = caseStats(id);
      return s ? Math.max(0.4, s.avg / mean) ** 2 : 2.5;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let chosen = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { chosen = pool[i]; break; } }
    return { c: cases[chosen - 1], auf: set().auf ? Math.floor(Math.random() * 4) : 0 };
  }

  // ruchy ustawiające: (losowy obrót góry) + odwrotność algorytmu
  const setupMoves = (it) => (it.auf ? [U_OF[it.auf]] : []).concat(setupOf(it.c));
  const finishMove = (it) => (it.auf ? U_OF[(4 - it.auf) % 4] : '');

  function show(it, fromHistory) {
    if (cur && !fromHistory) history.push(cur);
    if (history.length > 50) history.shift();
    cur = it;
    stopTimer(false);
    setTime(0);
    const s = set();
    $('#f2lCase').textContent = `${s.title}: ${it.c.name}`;
    $('#f2lGroup').textContent = s.groups[it.c.group];
    $('#f2lNote').textContent = s.note;
    $('#f2lSetup').textContent = setupMoves(it).join(' ');
    step = { list: algMoves(it), idx: 0 };
    renderMoves();
    $('#f2lAlgRow').hidden = true;
    $('#f2lReveal').hidden = false;
    $('#f2lPrev').disabled = history.length === 0;
    view.mask = s.mask ? (p) => s.mask(p, it.c) : null;
    view.set(setupMoves(it));
    renderCaseStats();
    $('#f2lHint').textContent = touch() ? 'Ustaw przypadek na kostce, potem stuknij czas, żeby zacząć.' : 'Ustaw przypadek na kostce, potem spacja: start / stop.';
  }

  const touch = () => window.matchMedia('(pointer: coarse)').matches;

  function prev() {
    if (busy || !history.length) return;
    show(history.pop(), true);
  }

  function renderCaseStats() {
    const st = caseStats(cur.c.id);
    $('#f2lCaseStats').innerHTML = st
      ? `<span>Próby <b>${st.n}</b></span><span>Najlepszy <b>${app.fmt(st.best)}</b></span><span>Średnia z 5 <b>${app.fmt(st.avg)}</b></span>`
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
    const s = store();
    const list = s.stats[cur.c.id] = s.stats[cur.c.id] || [];
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

  // tempo animacji (ms na ruch), zapamiętane między uruchomieniami
  const speed = () => Number((app.data.trainers && app.data.trainers.speed) || 800);

  async function playMoves(list, from, onStep) {
    if (busy) return;
    busy = true;
    view.set(from);
    for (let i = 0; i < list.length; i++) {
      if (onStep) onStep(i);
      // eslint-disable-next-line no-await-in-loop
      await view.animate(list[i], speed());
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, speed() * 0.45));
    }
    busy = false;
  }

  /* ---------- algorytm ruch po ruchu ---------- */
  let step = { list: [], idx: 0 };
  const algMoves = (it) => it.c.alg.split(' ').concat(finishMove(it) ? [finishMove(it)] : []);

  function renderMoves(active) {
    const fin = finishMove(cur);
    $('#f2lAlg').innerHTML = step.list.map((m, i) => {
      const cls = ['mv', i < step.idx ? 'done' : '', i === active ? 'now' : '', fin && i === step.list.length - 1 ? 'auf' : ''].join(' ');
      return `<span class="${cls}">${m}</span>`;
    }).join('');
    const shown = active !== undefined ? active : step.idx - 1;
    $('#f2lMoveDesc').textContent = shown >= 0 && step.list[shown]
      ? `${shown + 1}/${step.list.length}: ${Cube3D.describe(step.list[shown])}${fin && shown === step.list.length - 1 ? ' (na koniec obróć górę)' : ''}`
      : 'Naciśnij „Krok”, żeby przejść algorytm ruch po ruchu.';
    $('#f2lStepBack').disabled = step.idx === 0;
    $('#f2lStep').disabled = step.idx >= step.list.length;
  }

  async function stepForward() {
    if (busy || step.idx >= step.list.length) return;
    busy = true;
    const i = step.idx;
    renderMoves(i);
    await view.animate(step.list[i], speed());
    step.idx++;
    busy = false;
    renderMoves();
  }

  function stepBack() {
    if (busy || step.idx === 0) return;
    step.idx--;
    view.set(setupMoves(cur).concat(step.list.slice(0, step.idx)));
    renderMoves();
  }

  async function playAlg() {
    const it = cur;
    step.idx = 0;
    await playMoves(step.list, setupMoves(it), (i) => { step.idx = i; renderMoves(i); });
    if (cur !== it) return;
    step.idx = step.list.length;
    renderMoves();
  }

  async function playSetup() { await playMoves(setupMoves(cur), []); }

  /* ---------- wybór przypadków ---------- */
  function renderPicker() {
    const s = set();
    const st = store();
    const sel = new Set(st.sel);
    const avgs = s.cases.map((c) => (caseStats(c.id) || {}).avg).filter(Boolean);
    const mean = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    let html = '';
    Object.entries(s.groups).forEach(([g, name]) => {
      const list = s.cases.filter((c) => c.group === g);
      const all = list.every((c) => sel.has(c.id));
      html += `<div class="f2l-group"><label class="f2l-ghead"><input type="checkbox" data-group="${g}" ${all ? 'checked' : ''}> ${name} <small>${list.length}</small></label><div class="f2l-chips">`;
      list.forEach((c) => {
        const cs = caseStats(c.id);
        const speed = !cs ? 'new' : (mean && cs.avg > mean * 1.15 ? 'slow' : (mean && cs.avg < mean * 0.85 ? 'fast' : 'mid'));
        html += `<button class="f2l-chip ${sel.has(c.id) ? 'on' : ''} sp-${speed}" data-id="${c.id}" title="${c.name}: ${c.alg}"><b>${c.short}</b><span>${cs ? app.fmt(cs.avg) : '–'}</span></button>`;
      });
      html += '</div></div>';
    });
    $('#f2lPicker').innerHTML = html;
    const trained = s.cases.filter((c) => caseStats(c.id)).length;
    $('#f2lProgress').textContent = `Przećwiczone: ${trained} / ${s.cases.length} · wybrane: ${st.sel.length}`;
  }

  function onPicker(e) {
    const s = set();
    const st = store();
    const chip = e.target.closest('.f2l-chip');
    const grp = e.target.closest('input[data-group]');
    if (chip) {
      const id = Number(chip.dataset.id);
      st.sel = st.sel.includes(id) ? st.sel.filter((x) => x !== id) : st.sel.concat(id);
    } else if (grp) {
      const ids = s.cases.filter((c) => c.group === grp.dataset.group).map((c) => c.id);
      st.sel = grp.checked ? Array.from(new Set(st.sel.concat(ids))) : st.sel.filter((x) => !ids.includes(x));
    } else return;
    app.save();
    renderPicker();
  }

  /* ---------- podsumowania (zakładka Trening, statystyki) ---------- */
  function summary(key) {
    const s = SETS[key];
    const rows = s.cases.map((c) => ({ c, st: caseStats(c.id, key) }));
    const done = rows.filter((r) => r.st);
    const tries = done.reduce((a, r) => a + r.st.n, 0);
    const avg = done.length ? done.reduce((a, r) => a + r.st.avg, 0) / done.length : null;
    const slow = done.slice().sort((a, b) => b.st.avg - a.st.avg).slice(0, 3);
    return { s, total: s.cases.length, trained: done.length, tries, avg, slow };
  }

  // karty trenerów w panelu bocznym
  function renderList(el) {
    el.innerHTML = ORDER.map((k) => {
      const m = summary(k);
      const pct = (100 * m.trained / m.total).toFixed(1);
      return `<button class="tr-card" data-set="${k}">
        <span class="tr-ico">${Icons.icon(k === 'f2l' ? 'pair' : k, '', 'tr-svg')}</span>
        <span class="tr-txt"><b>${m.s.title}</b><small>${m.s.desc}</small>
          <span class="ach-bar"><i style="width:${pct}%"></i></span>
          <small>${m.trained} / ${m.total} przećwiczonych${m.avg ? ` · średnia ${app.fmt(m.avg)}` : ''}</small>
        </span></button>`;
    }).join('');
  }

  // tabela w statystykach
  function renderStats(el) {
    el.innerHTML = ORDER.map((k) => {
      const m = summary(k);
      const slow = m.slow.length
        ? m.slow.map((r) => `<li><span>${r.c.name}</span><b>${app.fmt(r.st.avg)}</b></li>`).join('')
        : '<li class="muted">Jeszcze bez prób</li>';
      return `<section class="tr-stat">
        <h3 class="ins-h">${m.s.title}</h3>
        <div class="ins-kpis">
          <div><span>Przećwiczone</span><b>${m.trained} / ${m.total}</b></div>
          <div><span>Prób</span><b>${m.tries}</b></div>
          <div><span>Średni czas</span><b>${m.avg ? app.fmt(m.avg) : '–'}</b></div>
          <div><span>Do poprawy</span><b>${m.slow.length ? m.slow[0].c.short : '–'}</b></div>
        </div>
        <p class="muted small">Najwolniejsze przypadki (średnia z 5):</p>
        <ul class="tr-slow">${slow}</ul>
        <button class="btn ghost tr-open" data-set="${k}">Trenuj ${m.s.title}</button>
      </section>`;
    }).join('');
  }

  /* ---------- otwieranie ---------- */
  function switchSet(key) {
    setKey = key;
    history.length = 0;
    cur = null;
    document.querySelectorAll('#trSets button').forEach((b) => b.classList.toggle('on', b.dataset.set === key));
    const s = set();
    view.view = { ...s.view };
    renderPicker();
    show(pick());
  }

  function open(key) {
    $('#modalF2L').hidden = false;
    // kostka trzymana białym na dole i zielonym z przodu: góra żółta, prawa pomarańczowa, lewa czerwona
    if (!view) view = new Cube3D.View($('#f2lStage'), { colorMap: [3, 4, 2, 0, 1, 5] });
    switchSet(key || setKey);
  }

  function close() {
    stopTimer(false);
    busy = false;
    $('#modalF2L').hidden = true;
    if (app.onClose) app.onClose();
  }

  function init(ctx) {
    app = ctx;
    store('f2l'); // przeniesienie starych danych
    $('#trSets').innerHTML = ORDER.map((k) => `<button data-set="${k}">${SETS[k].title}</button>`).join('');
    $('#trSets').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !busy) switchSet(b.dataset.set); });
    $('#f2lNext').addEventListener('click', (e) => { e.currentTarget.blur(); if (!busy) show(pick()); });
    $('#f2lPrev').addEventListener('click', (e) => { e.currentTarget.blur(); prev(); });
    $('#f2lReveal').addEventListener('click', reveal);
    $('#f2lPlay').addEventListener('click', playAlg);
    $('#f2lStep').addEventListener('click', stepForward);
    $('#f2lStepBack').addEventListener('click', stepBack);
    $('#trSpeed').value = String(speed());
    $('#trSpeed').addEventListener('change', (e) => {
      app.data.trainers = app.data.trainers || {};
      app.data.trainers.speed = Number(e.target.value);
      app.save();
      e.target.blur();
    });
    $('#f2lSetupPlay').addEventListener('click', playSetup);
    $('#f2lTimer').addEventListener('click', toggleTimer);
    $('#f2lPicker').addEventListener('click', onPicker);
    $('#f2lAll').addEventListener('click', () => { store().sel = set().cases.map((c) => c.id); app.save(); renderPicker(); });
    $('#f2lSlow').addEventListener('click', () => {
      const withAvg = set().cases.map((c) => [c.id, (caseStats(c.id) || {}).avg]);
      const known = withAvg.filter(([, a]) => a).sort((a, b) => b[1] - a[1]);
      const slow = known.slice(0, Math.max(3, Math.ceil(known.length / 3))).map(([id]) => id);
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

  window.Trainer = {
    init,
    open,
    close,
    renderList,
    renderStats,
    SETS,
    trained: (data, key) => Object.keys((data.trainers && data.trainers[key] && data.trainers[key].stats) || (key === 'f2l' && data.f2l && data.f2l.stats) || {}).length,
    isOpen: () => !!$('#modalF2L') && !$('#modalF2L').hidden,
    key: (e) => {
      if (e.code === 'Space') { if (!e.repeat) toggleTimer(); return true; }
      if (e.key === 'Enter' || e.key === 'ArrowRight') { if (!busy && timer.state !== 'running') show(pick()); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') { if (timer.state !== 'running') prev(); return true; }
      if (e.key === 'Escape') { close(); return true; }
      return false;
    },
  };
})();
