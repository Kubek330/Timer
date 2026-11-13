/* CubeClock – kostka 3D pokazująca scramble krok po kroku */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const FACE_NAME = { U: 'górną', D: 'dolną', R: 'prawą', L: 'lewą', F: 'przednią', B: 'tylną' };
  const LAYERS = { 2: 'dwie', 3: 'trzy', 4: 'cztery', 5: 'pięć', 6: 'sześć', 7: 'siedem' };
  // kąt CSS odpowiadający jednemu obrotowi CW wokół dodatniej osi modelu (oś Y w CSS jest odwrócona)
  const CSS_ROT = { x: ['rotateX', 90], y: ['rotateY', -90], z: ['rotateZ', 90] };

  let n = 3;
  let moves = [];
  let step = 0;        // ile ruchów już wykonano
  let state = [];
  let els = [];        // element DOM każdej naklejki
  let busy = false;
  let playing = false;
  let view = { rx: -28, ry: -38 };
  let size = 220;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function describe(mv) {
    const m = Scramble.parseMove(mv);
    if (!m) return '';
    const who = m.width === 1
      ? `${FACE_NAME[m.face]} ścianę`
      : `${LAYERS[m.width] || m.width} zewnętrzne warstwy od strony ${{ U: 'górnej', D: 'dolnej', R: 'prawej', L: 'lewej', F: 'przedniej', B: 'tylnej' }[m.face]}`;
    const how = m.suffix === '2' ? 'o pół obrotu (2 razy)'
      : m.suffix === "'" ? 'przeciwnie do ruchu wskazówek zegara'
        : 'zgodnie z ruchem wskazówek zegara';
    return `Obróć ${who} ${how}`;
  }

  // ustawienie naklejki: obrót animacji + przesunięcie na miejsce + skierowanie na zewnątrz
  function stickerTransform(p, anim) {
    const h = size / (2 * n); // połowa naklejki = jednostka modelu
    let face;
    if (Math.abs(p.x) === n) face = p.x > 0 ? 'rotateY(90deg)' : 'rotateY(-90deg)';
    else if (Math.abs(p.y) === n) face = p.y > 0 ? 'rotateX(90deg)' : 'rotateX(-90deg)';
    else face = p.z > 0 ? '' : 'rotateY(180deg)';
    return `${anim || ''} translate3d(${p.x * h}px, ${-p.y * h}px, ${p.z * h}px) ${face}`;
  }

  function build() {
    const cube = $('#c3dCube');
    cube.innerHTML = '';
    els = state.map(() => {
      const d = document.createElement('div');
      d.className = 'st';
      d.appendChild(document.createElement('i'));
      cube.appendChild(d);
      return d;
    });
    layout();
  }

  function layout() {
    const box = $('#c3dStage');
    size = Math.min(box.clientWidth, box.clientHeight) * 0.52 || 200;
    const s = size / n;
    $('#c3dCube').style.setProperty('--s', s + 'px');
    render();
  }

  function render() {
    state.forEach((p, i) => {
      els[i].style.transform = stickerTransform(p);
      els[i].firstChild.style.background = Scramble.COLORS[p.c];
    });
    $('#c3dCube').style.transform = `rotateX(${view.rx}deg) rotateY(${view.ry}deg)`;
  }

  function reset(to) {
    state = Scramble.solvedCube(n);
    for (let i = 0; i < to; i++) {
      const m = Scramble.parseMove(moves[i]);
      if (m) Scramble.applyParsed(state, n, m);
    }
    step = to;
  }

  function updateInfo() {
    const list = $('#c3dMoves');
    list.innerHTML = moves.map((m, i) => `<button class="mv${i < step ? ' done' : ''}${i === step ? ' next' : ''}" data-i="${i}">${m}</button>`).join('');
    const nextBtn = list.querySelector('.next');
    if (nextBtn) nextBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (step >= moves.length) {
      $('#c3dStep').textContent = `Gotowe! Wszystkie ${moves.length} ruchów wykonane.`;
      if (moves.length && window.Cube3D.onFinish) window.Cube3D.onFinish();
      $('#c3dDesc').textContent = 'Kostka jest pomieszana. Możesz zaczynać układanie.';
    } else {
      $('#c3dStep').innerHTML = `Ruch ${step + 1} z ${moves.length}: <b>${moves[step]}</b>`;
      $('#c3dDesc').textContent = describe(moves[step]);
    }
    $('#c3dPrev').disabled = step === 0;
    $('#c3dNext').disabled = step >= moves.length;
    $('#c3dPlay').textContent = playing ? 'Pauza' : (step >= moves.length ? 'Od nowa' : 'Odtwórz');
  }

  function animate(mv, dur) {
    return new Promise((resolve) => {
      const m = Scramble.parseMove(mv);
      if (!m) { resolve(); return; }
      const idx = [];
      state.forEach((p, i) => { if (Scramble.inLayer(p, m, n)) idx.push(i); });
      const k = m.turns === 3 ? -1 : m.turns;
      const [fn, base] = CSS_ROT[m.axis];
      const total = base * k;
      const finish = () => {
        Scramble.applyParsed(state, n, m);
        step++;
        render();
        resolve();
      };
      if (reduced.matches || dur <= 0) { finish(); return; }
      const t0 = performance.now();
      const ms = dur * (Math.abs(k) === 2 ? 1.4 : 1);
      const frame = (now) => {
        let t = Math.min(1, (now - t0) / ms);
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // płynny start i koniec
        const a = `${fn}(${total * t}deg)`;
        idx.forEach((i) => { els[i].style.transform = stickerTransform(state[i], a); });
        if (t < 1) requestAnimationFrame(frame); else finish();
      };
      requestAnimationFrame(frame);
    });
  }

  async function next() {
    if (busy || step >= moves.length) return;
    busy = true;
    await animate(moves[step], speed());
    busy = false;
    updateInfo();
  }

  function prev() {
    if (busy || step === 0) return;
    reset(step - 1);
    render();
    updateInfo();
  }

  function goTo(i) {
    if (busy) return;
    playing = false;
    reset(i);
    render();
    updateInfo();
  }

  const speed = () => Number($('#c3dSpeed').value);

  async function play() {
    if (playing) { playing = false; updateInfo(); return; }
    if (step >= moves.length) { reset(0); render(); }
    playing = true;
    updateInfo();
    while (playing && step < moves.length) {
      await next();
      await new Promise((r) => setTimeout(r, speed() * 0.35));
    }
    playing = false;
    updateInfo();
  }

  function open(puzzle, scramble) {
    n = Scramble.cubeSize(puzzle);
    if (!n) return false;
    moves = scramble.split(/\s+/).filter(Boolean);
    playing = false;
    busy = false;
    view = { rx: -28, ry: -38 };
    $('#modal3d').hidden = false;
    reset(0);
    build();
    updateInfo();
    return true;
  }

  function close() {
    playing = false;
    $('#modal3d').hidden = true;
  }

  // obracanie widoku palcem lub myszą
  function initDrag() {
    const stage = $('#c3dStage');
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, rx: view.rx, ry: view.ry };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      view.ry = drag.ry + (e.clientX - drag.x) * 0.5;
      view.rx = Math.max(-85, Math.min(85, drag.rx - (e.clientY - drag.y) * 0.5));
      $('#c3dCube').style.transform = `rotateX(${view.rx}deg) rotateY(${view.ry}deg)`;
    });
    const end = () => { drag = null; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  function init() {
    if (!$('#modal3d')) return;
    initDrag();
    $('#c3dNext').addEventListener('click', next);
    $('#c3dPrev').addEventListener('click', prev);
    $('#c3dPlay').addEventListener('click', play);
    $('#c3dReset').addEventListener('click', () => goTo(0));
    $('#c3dView').addEventListener('click', () => { view = { rx: -28, ry: -38 }; render(); });
    $('#c3dMoves').addEventListener('click', (e) => {
      const b = e.target.closest('.mv');
      if (b) goTo(Number(b.dataset.i));
    });
    $('#modal3d').addEventListener('click', (e) => {
      if (e.target.id === 'modal3d' || e.target.closest('[data-close3d]')) close();
    });
    window.addEventListener('resize', () => { if (!$('#modal3d').hidden) layout(); });
  }

  /**
   * Samodzielny widok kostki 3D (np. dla trenera F2L): ustawianie stanu, animacja ruchów,
   * obracanie palcem i opcjonalne szarzenie naklejek (mask(p) === true -> szara).
   */
  class View {
    constructor(stage, opts) {
      this.stage = stage;
      this.n = (opts && opts.n) || 3;
      this.mask = (opts && opts.mask) || null;
      // przemapowanie kolorów (np. biały na dole dla F2L): colorMap[indeks w modelu] = indeks koloru
      this.colorMap = (opts && opts.colorMap) || [0, 1, 2, 3, 4, 5];
      this.view = { rx: -28, ry: -38 };
      this.state = [];
      this.els = [];
      this.size = 200;
      this.cube = document.createElement('div');
      this.cube.className = 'c3d-cube';
      stage.appendChild(this.cube);
      let drag = null;
      stage.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, rx: this.view.rx, ry: this.view.ry };
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.view.ry = drag.ry + (e.clientX - drag.x) * 0.5;
        this.view.rx = Math.max(-85, Math.min(85, drag.rx - (e.clientY - drag.y) * 0.5));
        this.cube.style.transform = `rotateX(${this.view.rx}deg) rotateY(${this.view.ry}deg)`;
      });
      const end = () => { drag = null; };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
    }

    // stan = ułożona kostka + ruchy
    set(moveList) {
      this.state = Scramble.solvedCube(this.n);
      moveList.forEach((mv) => { const m = Scramble.parseMove(mv); if (m) Scramble.applyParsed(this.state, this.n, m); });
      if (this.els.length !== this.state.length) {
        this.cube.innerHTML = '';
        this.els = this.state.map(() => {
          const d = document.createElement('div');
          d.className = 'st';
          d.appendChild(document.createElement('i'));
          this.cube.appendChild(d);
          return d;
        });
      }
      this.layout();
    }

    resetView() { this.view = { rx: -28, ry: -38 }; this.render(); }

    layout() {
      this.size = Math.min(this.stage.clientWidth, this.stage.clientHeight) * 0.52 || 200;
      this.cube.style.setProperty('--s', this.size / this.n + 'px');
      this.render();
    }

    transform(p, anim) {
      const n = this.n;
      const h = this.size / (2 * n);
      let face;
      if (Math.abs(p.x) === n) face = p.x > 0 ? 'rotateY(90deg)' : 'rotateY(-90deg)';
      else if (Math.abs(p.y) === n) face = p.y > 0 ? 'rotateX(90deg)' : 'rotateX(-90deg)';
      else face = p.z > 0 ? '' : 'rotateY(180deg)';
      return `${anim || ''} translate3d(${p.x * h}px, ${-p.y * h}px, ${p.z * h}px) ${face}`;
    }

    render() {
      this.state.forEach((p, i) => {
        this.els[i].style.transform = this.transform(p);
        this.els[i].firstChild.style.background = this.mask && this.mask(p) ? '#3d3d44' : Scramble.COLORS[this.colorMap[p.c]];
      });
      this.cube.style.transform = `rotateX(${this.view.rx}deg) rotateY(${this.view.ry}deg)`;
    }

    animate(mv, dur) {
      return new Promise((resolve) => {
        const m = Scramble.parseMove(mv);
        if (!m) { resolve(); return; }
        const idx = [];
        this.state.forEach((p, i) => { if (Scramble.inLayer(p, m, this.n)) idx.push(i); });
        const k = m.turns === 3 ? -1 : m.turns;
        const [fn, base] = CSS_ROT[m.axis];
        const total = base * k;
        const finish = () => { Scramble.applyParsed(this.state, this.n, m); this.render(); resolve(); };
        if (reduced.matches || dur <= 0) { finish(); return; }
        const t0 = performance.now();
        const ms = dur * (Math.abs(k) === 2 ? 1.4 : 1);
        const frame = (now) => {
          let t = Math.min(1, (now - t0) / ms);
          t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const a = `${fn}(${total * t}deg)`;
          idx.forEach((i) => { this.els[i].style.transform = this.transform(this.state[i], a); });
          if (t < 1) requestAnimationFrame(frame); else finish();
        };
        requestAnimationFrame(frame);
      });
    }
  }

  window.Cube3D = {
    View,
    describe,
    init,
    open,
    close,
    isOpen: () => !!$('#modal3d') && !$('#modal3d').hidden,
    key: (e) => {
      if (e.key === 'ArrowRight') { next(); return true; }
      if (e.key === 'ArrowLeft') { prev(); return true; }
      if (e.key === ' ' || e.code === 'Space') { play(); return true; }
      if (e.key === 'Escape') { close(); return true; }
      return false;
    },
  };
})();
