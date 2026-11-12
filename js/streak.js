/* CubeClock – passa (dni z rzędu): animacja po pierwszym ułożeniu dnia i licznik na pasku */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dni = (n) => (n === 1 ? 'dzień' : 'dni');

  // płomień z trzech warstw; klasy pozwalają animować każdą osobno
  const FLAME = `
    <svg class="flame-svg" viewBox="0 0 120 150" aria-hidden="true">
      <path class="fl-outer" d="M60 146c-30 0-50-20-50-48 0-27 18-42 28-60 3 14 10 22 19 26-2-24 7-44 25-58 2 22 13 34 23 47 7 10 11 22 11 35 0 33-23 58-56 58z"/>
      <path class="fl-mid" d="M60 146c-19 0-32-13-32-31 0-17 11-27 18-38 3 9 8 14 14 16-1-15 5-28 16-36 2 14 9 22 14 30 4 7 6 14 6 22 0 21-15 37-36 37z"/>
      <path class="fl-core" d="M60 146c-10 0-17-7-17-17 0-9 6-15 10-21 2 6 5 8 8 9 0-8 3-14 9-19 1 8 5 12 7 16 2 4 3 8 3 12 0 11-8 20-20 20z"/>
    </svg>`;

  let resolveClose = null;

  function weekRow(perDay, today, animateToday) {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = Progress.addDays(today, -dow);
    return DAYS.map((label, i) => {
      const k = Progress.addDays(monday, i);
      const done = !!perDay[k];
      const isToday = k === today;
      const cls = ['sw-day', done ? 'done' : '', isToday ? 'today' : '', isToday && animateToday ? 'pop' : '', k > today ? 'future' : ''].join(' ');
      return `<div class="${cls}"><i><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg></i><span>${label}</span></div>`;
    }).join('');
  }

  function message(streak, best, prevBest, lost) {
    if (streak === 1) {
      return lost > 1 ? `Zaczynasz od nowa. Poprzednia passa: ${lost} dni. Wróć jutro i buduj dalej!` : 'Pierwszy dzień passy. Wróć jutro, żeby ją przedłużyć!';
    }
    const milestones = {
      3: 'Trzy dni z rzędu. Dobry początek!',
      7: 'Cały tydzień bez przerwy!',
      14: 'Dwa tygodnie z kostką. Robi się poważnie.',
      30: 'Miesiąc codziennego układania!',
      50: 'Pięćdziesiąt dni. Prawdziwy speedcuber.',
      100: 'Sto dni z rzędu. Legenda!',
      365: 'Cały rok bez przerwy. Niesamowite!',
    };
    if (milestones[streak]) return milestones[streak];
    if (streak > prevBest && prevBest > 1) return `Nowy rekord passy! Poprzednio najdłużej: ${prevBest} dni.`;
    const pool = ['Tak trzymać!', 'Kostka czeka na Ciebie także jutro.', 'Każdy dzień to krok do lepszego czasu.', 'Płomień rośnie. Nie pozwól mu zgasnąć!', 'Jutro też ułóż chociaż raz.'];
    return pool[streak % pool.length];
  }

  // iskry unoszące się nad płomieniem
  function sparks(cv) {
    if (reduced.matches) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const parts = [];
    const t0 = performance.now();
    const frame = (now) => {
      if (!cv.isConnected || $('#streakOv').hidden) return;
      const t = now - t0;
      if (t < 2200 && parts.length < 60 && Math.random() < 0.6) {
        parts.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.35, y: H * 0.75, vx: (Math.random() - 0.5) * 1.2, vy: -1.5 - Math.random() * 2.5, life: 1, s: 1.5 + Math.random() * 2.5 });
      }
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy *= 0.985; p.life -= 0.012;
        if (p.life <= 0) return;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.life > 0.6 ? '#ffd04d' : '#ff8a3d';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
      });
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      if (t < 4500 || parts.length) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /**
   * Pokazuje ekran passy.
   * opts: { streak, from, perDay, prevBest, lost, view }  view = tylko podgląd, bez animacji wzrostu
   */
  function show(opts) {
    const ov = $('#streakOv');
    const today = Progress.dayKey(Date.now());
    const doneToday = !!opts.perDay[today];
    const grow = !opts.view && opts.from !== opts.streak;
    ov.querySelector('.so-flame').classList.toggle('cold', !doneToday);
    ov.querySelector('.so-num').innerHTML = grow
      ? `<span class="old">${opts.from}</span><span class="new">${opts.streak}</span>`
      : `<span class="still">${opts.streak}</span>`;
    ov.querySelector('.so-label').textContent = `${dni(opts.streak)} z rzędu`;
    ov.querySelector('.so-msg').textContent = opts.view
      ? (doneToday ? 'Dzisiaj już układałeś. Wróć jutro, żeby przedłużyć passę.' : opts.streak > 0 ? 'Ułóż dziś chociaż raz, żeby nie stracić passy!' : 'Ułóż dziś kostkę i zacznij passę.')
      : message(opts.streak, opts.best, opts.prevBest, opts.lost);
    ov.querySelector('.so-week').innerHTML = weekRow(opts.perDay, today, !opts.view);
    ov.querySelector('.so-best').textContent = `Najdłuższa passa: ${Math.max(opts.best || 0, opts.streak)} ${dni(Math.max(opts.best || 0, opts.streak))}`;
    ov.classList.toggle('view', !!opts.view);
    ov.classList.remove('play');
    ov.hidden = false;
    void ov.offsetWidth;
    ov.classList.add('play');
    if (!opts.view) {
      sparks(ov.querySelector('.so-sparks'));
      if (navigator.vibrate) { try { navigator.vibrate([20, 80, 40]); } catch (e) { /* brak wibracji */ } }
    }
    // na komputerze przycisk dostaje fokus (Enter/spacja zamyka); na telefonie bez ramki fokusu
    if (!window.matchMedia('(pointer: coarse)').matches) setTimeout(() => ov.querySelector('.so-btn').focus(), 50);
    return new Promise((res) => { resolveClose = res; });
  }

  function close() {
    const ov = $('#streakOv');
    if (ov.hidden) return;
    ov.classList.add('closing');
    setTimeout(() => {
      ov.hidden = true;
      ov.classList.remove('closing', 'play');
      if (resolveClose) { const r = resolveClose; resolveClose = null; r(); }
    }, 220);
  }

  // licznik na pasku: pomarańczowy, gdy dziś już było ułożenie
  function updateChip(c) {
    const chip = $('#streakChip');
    if (!chip) return;
    const today = Progress.dayKey(Date.now());
    const done = !!c.perDay[today];
    chip.classList.toggle('lit', done);
    chip.querySelector('b').textContent = c.streak;
    chip.title = done ? `Passa: ${c.streak} ${dni(c.streak)}` : (c.streak ? `Ułóż dziś, żeby nie stracić passy (${c.streak} ${dni(c.streak)})` : 'Ułóż dziś i zacznij passę');
  }

  function init() {
    const ov = $('#streakOv');
    ov.querySelector('.so-flame').insertAdjacentHTML('afterbegin', FLAME);
    ov.querySelector('.so-btn').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  }

  window.Streak = {
    init,
    show,
    close,
    updateChip,
    flame: (cls) => FLAME.replace('class="flame-svg"', `class="flame-svg ${cls || ''}"`),
    isOpen: () => !!$('#streakOv') && !$('#streakOv').hidden,
  };
})();
