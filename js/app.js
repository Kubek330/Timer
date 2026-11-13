/* CubeClock – logika aplikacji */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const KEY = 'cubeclock.v1';
  const MOBILE = window.matchMedia('(max-width: 760px)');

  /* ================= Dane ================= */
  const DEFAULT_SETTINGS = {
    inspection: false,
    celebrate: true,
    timerFont: 'round',
    streakAnim: true,
    lastCall: true,
    reminder: false,
    reminderTime: '18:00',
    inspSound: true,
    hold: 300,
    runMode: '0.1', // dokładność czasu w trakcie ułożenia: 0.01 | 0.1 | 1 | none
    focus: true,
    draw: true,
    theme: 'dark',
    panelCollapsed: false,
    sheetClosed: true,
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const newSession = (name, puzzle) => ({ id: uid(), name, puzzle: puzzle || '333', solves: [] });

  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.sessions) || !d.sessions.length) {
      const s = newSession('Sesja 1', '333');
      d = { sessions: [s], current: s.id, settings: {} };
    }
    const raw = d.settings || {};
    if (raw.runMode === undefined && raw.showRunning === false) raw.runMode = 'none';
    delete raw.showRunning;
    d.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    if (!d.sessions.find((s) => s.id === d.current)) d.current = d.sessions[0].id;
    return d;
  }
  const data = load();
  const S = data.settings;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* brak miejsca / tryb prywatny */ }
  }
  const session = () => data.sessions.find((s) => s.id === data.current);

  /* ================= Pomocnicze ================= */
  const { fmt, fmtSolve } = window.Stats;
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Skopiowano'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Skopiowano'); } catch (e2) { toast('Nie udało się skopiować'); }
      ta.remove();
    }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // własne okno zamiast prompt()/confirm(); input === null -> tylko potwierdzenie
  function ask({ title, msg = '', input = null, ok = 'OK', danger = false }) {
    return new Promise((resolve) => {
      const m = $('#modalAsk');
      const inp = $('#askInput');
      $('#askTitle').textContent = title;
      $('#askMsg').textContent = msg;
      $('#askOk').textContent = ok;
      $('#askOk').classList.toggle('danger-fill', danger);
      inp.hidden = input === null;
      inp.value = input || '';
      $$('.modal').forEach((x) => { x.hidden = true; });
      m.hidden = false;
      setTimeout(() => { if (input !== null) { inp.focus(); inp.select(); } else $('#askOk').focus(); }, 30);
      const done = (v) => {
        m.hidden = true;
        $('#askForm').onsubmit = null;
        $('#askCancel').onclick = null;
        m.onclick = null;
        resolve(v);
      };
      $('#askForm').onsubmit = (e) => { e.preventDefault(); done(input === null ? true : (inp.value.trim() || null)); };
      $('#askCancel').onclick = () => done(input === null ? false : null);
      m.onclick = (e) => { if (e.target === m) done(input === null ? false : null); };
    });
  }

  /* ================= Scramble ================= */
  let scramble = '';
  function newScramble() {
    scramble = Scramble.generate(session().puzzle);
    renderScramble();
  }
  function renderScramble() {
    const el = $('#scrambleText');
    el.textContent = scramble;
    el.classList.remove('s-md', 's-sm', 's-xs');
    const L = scramble.length;
    if (L > 160) el.classList.add('s-xs');
    else if (L > 100) el.classList.add('s-sm');
    else if (L > 50) el.classList.add('s-md');
    const draw = $('#cubeDraw');
    const card = draw.closest('.scramble-card');
    card.hidden = !S.draw;
    const has3d = Scramble.cubeSize(session().puzzle) > 0;
    $('#btn3d').hidden = !has3d;
    $('#btn3dCard').hidden = !has3d;
    if (S.draw) {
      const svg = Scramble.draw(session().puzzle, scramble);
      draw.innerHTML = svg || 'Podgląd jest dostępny dla kostek 2x2–7x7.';
    }
  }

  /* ================= Timer ================= */
  const disp = $('#timeDisplay');
  const hint = $('#timerHint');
  let tState = 'idle'; // idle | arm-insp | inspecting | holding | ready | running
  let holdFromInsp = false;
  let holdTimer = null;
  let startT = 0;
  let inspStart = 0;
  let raf = 0;
  let pendingPen = 0;
  let ignoreRelease = false;
  let beeped = {};
  let lastSolveId = null;

  function setDigits(text, word) {
    disp.innerHTML = word ? `<span class="word">${esc(text)}</span>` : `<span class="digits">${esc(text)}</span>`;
  }
  function setColor(cls) {
    disp.classList.remove('hold', 'ready', 'insp', 'insp-late');
    if (cls) disp.classList.add(cls);
  }
  function setHint() {
    const touch = MOBILE.matches || 'ontouchstart' in window;
    const act = touch ? 'Przytrzymaj ekran' : 'Przytrzymaj spację';
    const map = {
      idle: S.inspection ? (touch ? 'Dotknij, aby zacząć inspekcję' : 'Spacja – start inspekcji') : act,
      inspecting: act + ', aby zacząć',
      holding: 'Trzymaj…',
      ready: 'Puść!',
      running: '',
      'arm-insp': '',
    };
    hint.textContent = map[tState] || '';
  }
  function setState(s) {
    tState = s;
    const solving = s === 'inspecting' || s === 'running' || ((s === 'holding' || s === 'ready') && holdFromInsp);
    document.body.classList.toggle('solving', solving);
    setHint();
  }

  function beep(freq) {
    if (!S.inspSound) return;
    try {
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.25);
    } catch (e) { /* brak dźwięku */ }
  }

  function startInspection() {
    inspStart = performance.now();
    pendingPen = 0;
    beeped = {};
    setState('inspecting');
    $('#lastActions').hidden = true;
    const tick = () => {
      if (!['inspecting', 'holding', 'ready'].includes(tState)) return;
      const e = (performance.now() - inspStart) / 1000;
      if (e >= 8 && !beeped[8]) { beeped[8] = 1; beep(660); }
      if (e >= 12 && !beeped[12]) { beeped[12] = 1; beep(880); }
      if (e >= 17) {
        // przekroczona inspekcja – DNF
        pendingPen = 'DNF';
        addSolve(0, 'DNF');
        toast('Inspekcja przekroczona – DNF');
        return;
      }
      pendingPen = e >= 15 ? 2 : 0;
      if (tState === 'inspecting') {
        if (e >= 15) { setDigits('+2', true); setColor('insp-late'); }
        else { setDigits(String(15 - Math.floor(e))); setColor(e >= 8 ? 'insp' : null); }
      }
      raf = requestAnimationFrame(tick);
    };
    holdFromInsp = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function startHold() {
    const fromInsp = tState === 'inspecting';
    holdFromInsp = fromInsp;
    setState('holding');
    setColor('hold');
    clearTimeout(holdTimer);
    const ready = () => { if (tState === 'holding') { setState('ready'); setColor('ready'); } };
    if (S.hold <= 0) ready(); else holdTimer = setTimeout(ready, S.hold);
  }

  // czas wyświetlany w trakcie ułożenia (ucięty do wybranej dokładności)
  let lastRunTxt = '';
  function fmtRun(ms) {
    const full = fmt(ms);
    if (S.runMode === '0.1') return full.slice(0, -1);
    if (S.runMode === '1') return full.slice(0, -3);
    return full;
  }

  function startRun() {
    cancelAnimationFrame(raf);
    startT = performance.now();
    holdFromInsp = false;
    setState('running');
    setColor(null);
    $('#lastActions').hidden = true;
    const tick = () => {
      if (tState !== 'running') return;
      if (S.runMode !== 'none') {
        const txt = fmtRun(performance.now() - startT);
        if (txt !== lastRunTxt) { lastRunTxt = txt; setDigits(txt); }
      }
      raf = requestAnimationFrame(tick);
    };
    lastRunTxt = '';
    if (S.runMode === 'none') setDigits('ułóż', true);
    raf = requestAnimationFrame(tick);
  }

  function stopRun() {
    const t = Math.round(performance.now() - startT);
    cancelAnimationFrame(raf);
    addSolve(t, pendingPen);
  }

  function addSolve(time, pen) {
    cancelAnimationFrame(raf);
    clearTimeout(holdTimer);
    const s = session();
    const before = Progress.compute(data);
    const firstToday = !before.perDay[Progress.dayKey(Date.now())];
    const solve = { id: uid(), time, penalty: pen || 0, scramble, date: Date.now(), puzzle: s.puzzle };
    if (S.inspection) solve.insp = true;
    s.solves.push(solve);
    lastSolveId = solve.id;
    pendingPen = 0;
    holdFromInsp = false;
    setState('idle');
    setColor(null);
    showLast();
    const recs = Progress.detectRecords(data, s);
    const fresh = Progress.check(data);
    save();
    newScramble();
    renderStats();
    const after = Progress.compute(data);
    Streak.updateChip(after);
    const extras = () => {
      if (S.celebrate) Progress.celebrate(recs, fmt);
      Progress.announce(fresh);
    };
    if (firstToday && S.streakAnim) {
      // passa: jeśli wczoraj nie było ułożenia, poprzednia passa przepadła
      const lost = after.streak === 1 ? Progress.lastStreak(before.perDay, Progress.dayKey(Date.now())) : 0;
      Streak.show({
        streak: after.streak,
        from: Math.max(0, after.streak - 1),
        perDay: after.perDay,
        best: after.maxStreak,
        prevBest: before.maxStreak,
        lost,
      }).then(extras);
    } else extras();
    syncNative();
  }

  function showLast() {
    const s = session();
    const solve = s.solves.find((x) => x.id === lastSolveId);
    const box = $('#lastActions');
    if (!solve) { box.hidden = true; return; }
    if (solve.penalty === 'DNF') setDigits('DNF', true);
    else setDigits(fmt(Stats.value(solve)) + (solve.penalty === 2 ? '+' : ''));
    box.hidden = false;
    box.querySelectorAll('button').forEach((b) => {
      const p = b.dataset.pen;
      b.classList.toggle('on', String(solve.penalty) === p);
    });
  }

  function cancelAll() {
    cancelAnimationFrame(raf);
    clearTimeout(holdTimer);
    holdFromInsp = false;
    pendingPen = 0;
    setState('idle');
    setColor(null);
    setDigits('0.00');
    $('#lastActions').hidden = true;
  }

  // wejście: naciśnięcie / puszczenie
  function press() {
    if (tState === 'running') { stopRun(); ignoreRelease = true; return; }
    if (tState === 'idle') {
      if (S.inspection) { setState('arm-insp'); return; }
      startHold();
    } else if (tState === 'inspecting') {
      startHold();
    }
  }
  function release() {
    if (ignoreRelease) { ignoreRelease = false; return; }
    if (tState === 'arm-insp') { startInspection(); return; }
    if (tState === 'holding') {
      clearTimeout(holdTimer);
      if (holdFromInsp) { setState('inspecting'); setColor(null); }
      else { setState('idle'); setColor(null); }
      return;
    }
    if (tState === 'ready') startRun();
  }

  const modalOpen = () => $$('.modal').some((m) => !m.hidden);

  document.addEventListener('keydown', (e) => {
    if (Streak.isOpen()) {
      if (['Space', 'Enter', 'Escape', 'NumpadEnter'].includes(e.code) || e.key === 'Escape') { e.preventDefault(); if (!e.repeat) { Streak.close(); ignoreRelease = e.code === 'Space'; } }
      return;
    }
    if (Cube3D.isOpen()) { if (Cube3D.key(e)) e.preventDefault(); return; }
    if (modalOpen()) { if (e.key === 'Escape') closeModals(); return; }
    if (e.target.closest('input, select, textarea')) return;
    if (tState === 'running') {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      if (!e.repeat) { stopRun(); ignoreRelease = e.code === 'Space'; }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) press();
    } else if (e.key === 'Escape') {
      cancelAll();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && !modalOpen()) { e.preventDefault(); release(); }
  });

  // dotyk
  const zone = $('#timerZone');
  zone.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    press();
  }, { passive: false });
  zone.addEventListener('touchend', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    release();
  }, { passive: false });
  zone.addEventListener('touchcancel', () => {
    if (tState !== 'holding' && tState !== 'ready') return;
    clearTimeout(holdTimer);
    setState(holdFromInsp ? 'inspecting' : 'idle');
    setColor(null);
  });
  // zatrzymanie dotykiem w dowolnym miejscu ekranu
  document.addEventListener('touchstart', (e) => {
    if (tState === 'running' && !zone.contains(e.target)) { e.preventDefault(); stopRun(); ignoreRelease = true; }
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (ignoreRelease && !zone.contains(e.target)) ignoreRelease = false;
  });

  $('#lastActions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    setPenalty(lastSolveId, b.dataset.pen);
  });

  function setPenalty(id, pen) {
    const s = session();
    const i = s.solves.findIndex((x) => x.id === id);
    if (i < 0) return;
    if (pen === 'del') {
      s.solves.splice(i, 1);
      if (id === lastSolveId) { lastSolveId = null; setDigits('0.00'); $('#lastActions').hidden = true; }
      toast('Usunięto czas');
    } else {
      s.solves[i].penalty = pen === 'DNF' ? 'DNF' : Number(pen);
      if (id === lastSolveId) showLast();
    }
    Progress.announce(Progress.check(data));
    save();
    renderStats();
    Streak.updateChip(Progress.compute(data));
    syncNative();
  }

  /* ================= Statystyki i lista ================= */
  function renderStats() {
    const s = session();
    const sv = s.solves;
    const st = window.Stats;
    const vals = {
      stCount: String(sv.length),
      stBest: fmt(st.bestSingle(sv)),
      stMean: fmt(st.sessionMean(sv)),
      stAo5: fmt(st.current(sv, 5)),
      stAo12: fmt(st.current(sv, 12)),
      stBestAo5: fmt(st.best(sv, 5)),
      stBestAo12: fmt(st.best(sv, 12)),
    };
    for (const k in vals) $('#' + k).textContent = vals[k];
    $('#peekCount').textContent = sv.length;
    $('#peekAo5').textContent = vals.stAo5;
    $('#peekAo12').textContent = vals.stAo12;
    $('#sessionName').textContent = s.name;

    // lista czasów (najnowsze na górze)
    const best = st.bestSingle(sv);
    const list = $('#timesList');
    const LIMIT = 500;
    let html = '';
    for (let i = sv.length - 1; i >= Math.max(0, sv.length - LIMIT); i--) {
      const x = sv[i];
      const isBest = best !== null && best !== Infinity && st.value(x) === best;
      html += `<li data-id="${x.id}"><span class="idx">${i + 1}</span><span class="t${isBest ? ' best' : ''}">${esc(fmtSolve(x))}</span><span>${fmt(st.avgAt(sv, i, 5))}</span><span>${fmt(st.avgAt(sv, i, 12))}</span></li>`;
    }
    list.innerHTML = html;
    $('#timesEmpty').hidden = sv.length > 0;
    if (!$('#modalStats').hidden && ins.tab === 'session') renderStatsModal();
  }

  $('#timesList').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) openSolve(li.dataset.id);
  });

  /* ================= Okna ================= */
  function openModal(id) { closeModals(); $(id).hidden = false; }
  function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; });
  });

  // --- ułożenie ---
  let openSolveId = null;
  function openSolve(id) {
    const s = session();
    const i = s.solves.findIndex((x) => x.id === id);
    if (i < 0) return;
    const x = s.solves[i];
    openSolveId = id;
    $('#solveTitle').textContent = 'Ułożenie #' + (i + 1);
    $('#solveTime').innerHTML = x.penalty === 'DNF' ? '<span class="word">DNF</span>' : esc(fmt(Stats.value(x)) + (x.penalty === 2 ? '+' : ''));
    $('#solveDate').textContent = new Date(x.date).toLocaleString('pl-PL') + ' · ' + (Scramble.PUZZLES[x.puzzle] || {}).name + (x.penalty ? ' · czysty czas ' + fmt(x.time) : '');
    $('#solveScramble').textContent = x.scramble;
    $$('#solvePen button').forEach((b) => b.classList.toggle('on', b.dataset.pen === String(x.penalty)));
    openModal('#modalSolve');
  }
  $('#solvePen').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setPenalty(openSolveId, b.dataset.pen);
    openSolve(openSolveId);
  });
  $('#solveDelete').addEventListener('click', () => {
    setPenalty(openSolveId, 'del');
    closeModals();
  });
  $('#solveCopy').addEventListener('click', () => {
    const x = session().solves.find((y) => y.id === openSolveId);
    if (x) copy(fmtSolve(x) + '   ' + x.scramble.replace(/\n/g, ' '));
  });

  // --- statystyki ---
  function renderStatsModal() {
    const s = session();
    const sv = s.solves;
    const st = window.Stats;
    $('#statsSession').textContent = s.name;
    const rows = [
      ['pojedynczy', sv.length ? fmt(st.value(sv[sv.length - 1])) : '–', fmt(st.bestSingle(sv))],
      ['mo3', fmt(st.current(sv, 3)), fmt(st.best(sv, 3))],
    ];
    [5, 12, 50, 100, 1000].forEach((n) => rows.push(['ao' + n, fmt(st.current(sv, n)), fmt(st.best(sv, n))]));
    $('#statsTable').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
    const dnf = sv.filter((x) => x.penalty === 'DNF').length;
    $('#statsSummary').textContent = `Ułożeń: ${sv.length} · DNF: ${dnf} · średnia: ${fmt(st.sessionMean(sv))} · najgorszy: ${fmt(st.worstSingle(sv))}`;
    drawChart(sv);
  }

  function drawChart(sv) {
    const cv = $('#chart');
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const col = (v) => css.getPropertyValue(v).trim();
    const st = window.Stats;
    const N = sv.length;
    if (N < 2) {
      ctx.fillStyle = col('--muted');
      ctx.font = "500 14px 'Rubik Variable', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('Ułóż co najmniej 2 razy, aby zobaczyć wykres', W / 2, H / 2);
      return;
    }
    const times = sv.map(st.value);
    const ao5 = sv.map((_, i) => st.avgAt(sv, i, 5));
    const ao12 = sv.map((_, i) => st.avgAt(sv, i, 12));
    const finite = times.filter((v) => v !== Infinity);
    if (!finite.length) return;
    let lo = Math.min(...finite);
    let hi = Math.max(...finite);
    if (hi === lo) { hi += 1000; lo = Math.max(0, lo - 1000); }
    const pad = { l: 46, r: 12, t: 12, b: 22 };
    const x = (i) => pad.l + (W - pad.l - pad.r) * (i / (N - 1));
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
    // siatka
    ctx.strokeStyle = col('--border');
    ctx.fillStyle = col('--muted');
    ctx.font = "500 11px 'Rubik Variable', system-ui, sans-serif";
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * (k / 4);
      const yy = y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillText(fmt(v), pad.l - 6, yy + 4);
    }
    const line = (arr, color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round';
      ctx.beginPath();
      let on = false;
      arr.forEach((v, i) => {
        if (v === null || v === Infinity) { on = false; return; }
        if (!on) { ctx.moveTo(x(i), y(v)); on = true; } else ctx.lineTo(x(i), y(v));
      });
      ctx.stroke();
    };
    line(times, col('--chart-1'), 1.2);
    line(ao5, col('--chart-2'), 2);
    line(ao12, col('--chart-3'), 2);
  }

  // zakładki statystyk: "Sesja" to bieżąca sesja, reszta to statystyki ze wszystkich sesji
  const ins = { tab: 'session', puzzle: null, range: 'all' };
  $('#insPuzzle').innerHTML = Object.entries(Scramble.PUZZLES).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
  function renderStatsView() {
    $$('#statsTabs button').forEach((b) => b.classList.toggle('on', b.dataset.st === ins.tab));
    const isSession = ins.tab === 'session';
    $('#paneSession').hidden = !isSession;
    $('#insightPane').hidden = isSession;
    $('#insFilters').hidden = !['history', 'dist', 'records'].includes(ins.tab);
    $('#insRange').hidden = ins.tab === 'records';
    $$('#insRange button').forEach((b) => b.classList.toggle('on', b.dataset.r === ins.range));
    $('#insPuzzle').value = ins.puzzle;
    if (isSession) renderStatsModal();
    else Insights.render($('#insightPane'), data, ins, fmt);
  }
  $('#statsTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ins.tab = b.dataset.st;
    renderStatsView();
  });
  $('#insRange').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ins.range = b.dataset.r;
    renderStatsView();
  });
  $('#insPuzzle').addEventListener('change', (e) => { ins.puzzle = e.target.value; renderStatsView(); });
  $('#btnStats').addEventListener('click', () => {
    ins.puzzle = session().puzzle;
    openModal('#modalStats');
    renderStatsView();
  });
  window.addEventListener('resize', () => { if (!$('#modalStats').hidden) renderStatsView(); });

  // osiągnięcia
  $('#btnAch').addEventListener('click', () => {
    Progress.renderAchievements(data, $('#achBody'));
    openModal('#modalAch');
  });
  Cube3D.onFinish = () => {
    data.flags = data.flags || {};
    if (data.flags.guide) return;
    data.flags.guide = true;
    Progress.announce(Progress.check(data));
    save();
  };

  // --- sesje ---
  function renderSessions() {
    $('#sessionList').innerHTML = data.sessions.map((s) => `
      <li data-id="${s.id}" class="${s.id === data.current ? 'on' : ''}">
        <span class="name">${esc(s.name)}</span>
        <span class="meta">${esc((Scramble.PUZZLES[s.puzzle] || {}).name || '')} · ${s.solves.length}</span>
        <button class="icon-btn" data-act="rename" title="Zmień nazwę" aria-label="Zmień nazwę"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" stroke-linejoin="round"/></svg></button>
        <button class="icon-btn" data-act="delete" title="Usuń" aria-label="Usuń"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" stroke-linejoin="round"/></svg></button>
      </li>`).join('');
  }
  $('#sessionList').addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const s = data.sessions.find((x) => x.id === li.dataset.id);
    const act = e.target.closest('button') && e.target.closest('button').dataset.act;
    if (act === 'rename') {
      const n = await ask({ title: 'Zmień nazwę sesji', input: s.name, ok: 'Zapisz' });
      if (n) { s.name = n.slice(0, 40); save(); renderStats(); }
      openSessions();
      return;
    }
    if (act === 'delete') {
      if (data.sessions.length === 1) { toast('Musi zostać co najmniej jedna sesja'); return; }
      const yes = await ask({ title: 'Usunąć sesję?', msg: `Sesja „${s.name}” i jej czasy (${s.solves.length}) zostaną usunięte na zawsze.`, ok: 'Usuń', danger: true });
      if (!yes) { openSessions(); return; }
      data.sessions = data.sessions.filter((x) => x.id !== s.id);
      if (data.current === s.id) switchSession(data.sessions[0].id);
      save(); openSessions();
      toast('Usunięto sesję');
      return;
    }
    switchSession(s.id);
    closeModals();
  });
  function switchSession(id) {
    data.current = id;
    lastSolveId = null;
    cancelAll();
    save();
    syncPuzzle();
    newScramble();
    renderStats();
    renderSessions();
  }
  $('#btnNewSession').addEventListener('click', async () => {
    const n = await ask({ title: 'Nowa sesja', input: 'Sesja ' + (data.sessions.length + 1), ok: 'Utwórz' });
    if (!n) { openSessions(); return; }
    const s = newSession(n.slice(0, 40), session().puzzle);
    data.sessions.push(s);
    switchSession(s.id);
    closeModals();
    toast('Utworzono sesję');
  });
  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'CubeClock', version: 1, sessions: data.sessions }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cubeclock-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.sessions)) throw new Error('format');
        let added = 0;
        d.sessions.forEach((s) => {
          if (!s || !Array.isArray(s.solves)) return;
          data.sessions.push({
            id: uid(),
            name: String(s.name || 'Import').slice(0, 40),
            puzzle: Scramble.PUZZLES[s.puzzle] ? s.puzzle : '333',
            solves: s.solves.filter((x) => x && typeof x.time === 'number').map((x) => ({
              id: uid(), time: x.time, penalty: x.penalty === 'DNF' ? 'DNF' : (x.penalty === 2 ? 2 : 0),
              scramble: String(x.scramble || ''), date: Number(x.date) || Date.now(), puzzle: x.puzzle || s.puzzle || '333',
            })),
          });
          added++;
        });
        save(); renderSessions();
        toast(`Zaimportowano sesje: ${added}`);
      } catch (err) { toast('Nieprawidłowy plik'); }
      e.target.value = '';
    };
    r.readAsText(f);
  });
  const openSessions = () => { renderSessions(); openModal('#modalSessions'); };
  $('#btnMenu').addEventListener('click', openSessions);
  $('#sessionName').addEventListener('click', openSessions);

  // --- ustawienia ---
  const THEMES = [
    ['dark', 'Ciemny'], ['light', 'Jasny'], ['navy', 'Granat'],
    ['forest', 'Las'], ['violet', 'Fiolet'], ['sunset', 'Zachód'],
  ];
  function applyTheme() {
    document.documentElement.dataset.ccTheme = S.theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-2').trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && bg) meta.content = bg;
  }
  function renderThemes() {
    const grid = $('#themeGrid');
    grid.innerHTML = THEMES.map(([id, name]) => `<button class="theme-chip${S.theme === id ? ' on' : ''}" data-theme-id="${id}" data-cc-theme="${id}" style="background:var(--surface);color:var(--text)"><span class="sw"><i style="background:var(--bg)"></i><i style="background:var(--digits)"></i><i style="background:var(--accent)"></i><i style="background:var(--ready)"></i></span>${name}</button>`).join('');
  }
  $('#themeGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-id]');
    if (!b) return;
    S.theme = b.dataset.themeId;
    applyTheme(); renderThemes(); save();
  });
  $('#btnTheme').addEventListener('click', () => {
    S.theme = S.theme === 'light' ? 'dark' : 'light';
    applyTheme(); save();
  });

  const bindCheck = (sel, key, after) => {
    const el = $(sel);
    el.checked = !!S[key];
    el.addEventListener('change', () => { S[key] = el.checked; save(); if (after) after(); });
  };
  bindCheck('#setInspection', 'inspection', () => { cancelAll(); });
  bindCheck('#setInspSound', 'inspSound');
  $('#setRunMode').value = S.runMode;
  $('#setRunMode').addEventListener('change', (e) => { S.runMode = e.target.value; save(); e.target.blur(); });
  bindCheck('#setFocus', 'focus', () => document.body.classList.toggle('focus', S.focus));
  bindCheck('#setDraw', 'draw', renderScramble);
  bindCheck('#setCelebrate', 'celebrate');
  bindCheck('#setStreakAnim', 'streakAnim');
  const applyTimerFont = () => document.body.classList.toggle('tf-round', S.timerFont === 'round');
  $('#setTimerFont').value = S.timerFont;
  $('#setTimerFont').addEventListener('change', (e) => { S.timerFont = e.target.value; save(); applyTimerFont(); e.target.blur(); });
  applyTimerFont();
  $('#setHold').value = String(S.hold);
  $('#setHold').addEventListener('change', (e) => { S.hold = Number(e.target.value); save(); });
  $('#btnSettings').addEventListener('click', () => { renderThemes(); openModal('#modalSettings'); });

  /* ================= Pasek, kostki, przyciski ================= */
  const sel = $('#puzzleSelect');
  sel.innerHTML = Object.entries(Scramble.PUZZLES).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
  function syncPuzzle() { sel.value = session().puzzle; }
  sel.addEventListener('change', () => {
    session().puzzle = sel.value;
    save();
    newScramble();
    renderSessions();
    sel.blur();
  });
  $('#btnNewScramble').addEventListener('click', (e) => { newScramble(); e.currentTarget.blur(); });
  const open3d = (e) => { if (e) e.currentTarget.blur(); Cube3D.open(session().puzzle, scramble); };
  Cube3D.init();
  $('#btn3d').addEventListener('click', open3d);
  $('#btn3dCard').addEventListener('click', open3d);
  $('#btnCopy').addEventListener('click', () => copy(scramble.replace(/\n/g, ' ')));
  $('#btnFullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  });

  // zakładki
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $$('.tab-page').forEach((p) => p.classList.toggle('active', p.dataset.page === t.dataset.tab));
    t.blur();
  }));

  // zwijanie panelu (komputer)
  function applyPanel() {
    document.body.classList.toggle('panel-collapsed', !!S.panelCollapsed);
    document.body.classList.toggle('sheet-closed', !!S.sheetClosed);
  }
  $('#btnCollapse').addEventListener('click', () => { S.panelCollapsed = true; applyPanel(); save(); });
  $('#btnExpand').addEventListener('click', () => { S.panelCollapsed = false; applyPanel(); save(); });

  // dolny panel (telefon): stuknięcie lub przeciągnięcie uchwytu
  (function sheet() {
    const panel = $('#panel');
    const grab = [$('#sheetHandle'), $('#sheetPeek')];
    let startY = 0, base = 0, dy = 0, moved = false, active = false, t0 = 0;
    const closedOffset = () => panel.offsetHeight - 66;
    const onDown = (e) => {
      if (!MOBILE.matches) return;
      active = true; moved = false; dy = 0; t0 = Date.now();
      startY = e.clientY;
      base = S.sheetClosed ? closedOffset() : 0;
      panel.classList.add('dragging');
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!active) return;
      dy = e.clientY - startY;
      if (Math.abs(dy) > 5) moved = true;
      if (!moved) return;
      if (S.sheetClosed) document.body.classList.remove('sheet-closed');
      const off = Math.min(closedOffset(), Math.max(0, base + dy));
      panel.style.transform = `translateY(${off}px)`;
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      panel.classList.remove('dragging');
      panel.style.transform = '';
      if (!moved) S.sheetClosed = !S.sheetClosed;
      else {
        const v = dy / Math.max(1, Date.now() - t0);
        const off = base + dy;
        S.sheetClosed = v > 0.4 ? true : v < -0.4 ? false : off > closedOffset() / 2;
      }
      applyPanel(); save();
    };
    grab.forEach((g) => {
      g.addEventListener('pointerdown', onDown);
      g.addEventListener('pointermove', onMove);
      g.addEventListener('pointerup', onUp);
      g.addEventListener('pointercancel', onUp);
    });
  })();

  /* ================= Aplikacja na Androida ================= */
  // w aplikacji ukrywamy elementy działające tylko w przeglądarce (pobieranie plików)
  if (/CubeClockApp/.test(navigator.userAgent)) document.body.classList.add('in-app');
  // wywoływane przez przycisk "wstecz" w aplikacji; true = obsłużone na stronie
  window.ccBack = () => {
    if (Streak.isOpen()) { Streak.close(); return true; }
    if (Cube3D.isOpen()) { Cube3D.close(); return true; }
    if (modalOpen()) { closeModals(); return true; }
    if (tState !== 'idle') { cancelAll(); return true; }
    if (MOBILE.matches && !S.sheetClosed) { S.sheetClosed = true; applyPanel(); save(); return true; }
    return false;
  };

  /* ================= Przypomnienia (aplikacja na Androida) ================= */
  const native = window.CCNative || null;
  // przekazuje aplikacji dzień ostatniego ułożenia i serię, żeby przypomnienie nie przychodziło po treningu
  function syncNative() {
    if (!native) return;
    try {
      const c = Progress.compute(data);
      const last = c.all.length ? Progress.dayKey(c.all[c.all.length - 1].date) : '';
      native.setStatus(last, c.streak);
    } catch (e) { /* stara wersja aplikacji */ }
  }
  function applyReminder() {
    if (!native) return;
    const [h, m] = (S.reminderTime || '18:00').split(':').map(Number);
    try { native.setReminder(!!S.reminder, h, m); } catch (e) { /* stara wersja aplikacji */ }
    try { native.setLastCall(!!S.lastCall); } catch (e) { /* stara wersja aplikacji */ }
  }
  (function reminderUI() {
    const box = $('#setReminder');
    const time = $('#setReminderTime');
    const last = $('#setLastCall');
    last.checked = !!S.lastCall && !!native;
    box.checked = !!S.reminder && !!native;
    time.value = S.reminderTime;
    if (!native) {
      box.disabled = true;
      time.disabled = true;
      last.disabled = true;
      $('#reminderNote').textContent = 'Przypomnienia działają w aplikacji CubeClock na Androida.';
      return;
    }
    $('#reminderNote').textContent = 'Przychodzi tylko w dni, w które jeszcze nie układałeś, i pilnuje Twojej passy.';
    last.addEventListener('change', () => { S.lastCall = last.checked; save(); applyReminder(); });
    window.ccNotifResult = (granted) => {
      if (!granted) {
        S.reminder = false;
        box.checked = false;
        toast('Bez zgody na powiadomienia przypomnienie nie zadziała');
      }
      save();
      applyReminder();
    };
    box.addEventListener('change', () => {
      S.reminder = box.checked;
      save();
      if (S.reminder) {
        try { native.requestNotifications(); } catch (e) { window.ccNotifResult(true); }
      } else applyReminder();
    });
    time.addEventListener('change', () => {
      if (!time.value) return;
      S.reminderTime = time.value;
      save();
      applyReminder();
      toast('Przypomnienie o ' + time.value);
    });
  })();

  /* ================= Start ================= */
  applyTheme();
  applyPanel();
  document.body.classList.toggle('focus', !!S.focus);
  syncPuzzle();
  newScramble();
  Progress.check(data); // osiągnięcia za wcześniejsze ułożenia, bez ogłaszania
  save();
  renderStats();
  syncNative();
  applyReminder();
  Streak.init();
  Streak.updateChip(Progress.compute(data));
  // licznik passy: podgląd tygodnia
  $('#streakChip').addEventListener('click', (e) => {
    e.currentTarget.blur();
    const c = Progress.compute(data);
    Streak.show({ streak: c.streak, from: c.streak, perDay: c.perDay, best: c.maxStreak, view: true });
  });
  // o północy licznik powinien zgasnąć, jeśli dziś jeszcze nic nie ułożono
  setInterval(() => Streak.updateChip(Progress.compute(data)), 60000);
  setState('idle');
  setDigits('0.00');
  MOBILE.addEventListener && MOBILE.addEventListener('change', setHint);
})();
