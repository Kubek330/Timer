/* CubeClock – generatory scramble'i oraz podgląd kostki NxN */
(function () {
  'use strict';

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];

  const PUZZLES = {
    '222':   { name: '2x2', gen: () => nxn(2, 11) },
    '333':   { name: '3x3', gen: () => nxn(3, 20) },
    '333oh': { name: '3x3 OH', gen: () => nxn(3, 20) },
    '444':   { name: '4x4', gen: () => nxn(4, 40) },
    '555':   { name: '5x5', gen: () => nxn(5, 60) },
    '666':   { name: '6x6', gen: () => nxn(6, 80) },
    '777':   { name: '7x7', gen: () => nxn(7, 100) },
    'pyram': { name: 'Pyraminx', gen: pyraminx },
    'skewb': { name: 'Skewb', gen: skewb },
    'minx':  { name: 'Megaminx', gen: megaminx },
    'sq1':   { name: 'Square-1', gen: square1 },
    'clock': { name: 'Clock', gen: clock },
  };

  const CUBE_SIZE = { '222': 2, '333': 3, '333oh': 3, '444': 4, '555': 5, '666': 6, '777': 7 };

  /* ---------- NxN ---------- */
  const AXIS = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };

  function nxn(n, len) {
    const faces = n === 2 ? ['R', 'U', 'F'] : ['U', 'D', 'L', 'R', 'F', 'B'];
    const maxW = Math.max(1, Math.floor(n / 2));
    const moves = [];
    let axis = -1;
    let used = []; // ruchy w bieżącej serii na tej samej osi
    while (moves.length < len) {
      const f = pick(faces);
      const w = 1 + rand(maxW);
      const key = f + w;
      if (AXIS[f] === axis && used.includes(key)) continue;
      if (AXIS[f] !== axis) { axis = AXIS[f]; used = []; }
      used.push(key);
      const name = w === 1 ? f : (w === 2 ? f + 'w' : w + f + 'w');
      moves.push(name + pick(['', "'", '2']));
    }
    return moves.join(' ');
  }

  /* ---------- Pyraminx ---------- */
  function pyraminx() {
    const out = [];
    let last = '';
    while (out.length < 11) {
      const f = pick(['U', 'L', 'R', 'B']);
      if (f === last) continue;
      last = f;
      out.push(f + pick(['', "'"]));
    }
    ['u', 'l', 'r', 'b'].forEach((t) => {
      const r = rand(3);
      if (r === 1) out.push(t);
      if (r === 2) out.push(t + "'");
    });
    return out.join(' ');
  }

  /* ---------- Skewb ---------- */
  function skewb() {
    const out = [];
    let last = '';
    while (out.length < 9) {
      const f = pick(['R', 'U', 'L', 'B']);
      if (f === last) continue;
      last = f;
      out.push(f + pick(['', "'"]));
    }
    return out.join(' ');
  }

  /* ---------- Megaminx (notacja WCA / Pochmann) ---------- */
  function megaminx() {
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const line = [];
      for (let j = 0; j < 10; j++) line.push((j % 2 ? 'D' : 'R') + pick(['++', '--']));
      line.push(pick(['U', "U'"]));
      lines.push(line.join(' '));
    }
    return lines.join('\n');
  }

  /* ---------- Square-1 ---------- */
  function square1() {
    // każda warstwa to 12 komórek po 30°; narożnik zajmuje 2 komórki, krawędź 1
    const layer = () => {
      const c = [];
      let id = 0;
      for (let k = 0; k < 4; k++) { c.push(id, id); id++; c.push(id); id++; }
      return c;
    };
    let top = layer();
    let bot = layer().map((x) => x + 100);
    const rot = (a, r) => a.map((_, i) => a[(i - r + 120) % 12]);
    const sliceable = (a) => a[11] !== a[0] && a[5] !== a[6];
    const out = [];
    const total = 12;
    let tries = 0;
    while (out.length < total && tries < 10000) {
      tries++;
      const u = rand(12) - 5; // -5..6
      const d = rand(12) - 5;
      if (u === 0 && d === 0 && out.length > 0) continue;
      const t = rot(top, u);
      const b = rot(bot, d);
      if (!sliceable(t) || !sliceable(b)) continue;
      // slice: zamiana prawych połówek
      const tr = t.slice(6).reverse();
      const br = b.slice(6).reverse();
      top = t.slice(0, 6).concat(br);
      bot = b.slice(0, 6).concat(tr);
      out.push('(' + u + ',' + d + ')');
    }
    return out.join(' / ') + ' /';
  }

  /* ---------- Clock ---------- */
  function clock() {
    const v = () => {
      const x = rand(12) - 5;
      return x >= 0 ? x + '+' : (-x) + '-';
    };
    const a = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].map((p) => p + v());
    const b = ['U', 'R', 'D', 'L', 'ALL'].map((p) => p + v());
    return a.join(' ') + ' y2 ' + b.join(' ');
  }

  /* ---------- Symulacja kostki NxN do podglądu ---------- */
  // Współrzędne: x w prawo, y w górę, z do patrzącego (F). Naklejki leżą na ±n.
  const FACE_DEF = {
    U: { axis: 'y', sign: 1, color: 0 },
    R: { axis: 'x', sign: 1, color: 1 },
    F: { axis: 'z', sign: 1, color: 2 },
    D: { axis: 'y', sign: -1, color: 3 },
    L: { axis: 'x', sign: -1, color: 4 },
    B: { axis: 'z', sign: -1, color: 5 },
  };
  // kolory: U biały, R czerwony, F zielony, D żółty, L pomarańczowy, B niebieski
  const COLORS = ['#ffffff', '#e8323c', '#2fb34a', '#ffd400', '#ff8a1f', '#2766e0'];

  function solvedCube(n) {
    const st = [];
    const coords = [];
    for (let i = 0; i < n; i++) coords.push(-(n - 1) + 2 * i);
    for (const f in FACE_DEF) {
      const d = FACE_DEF[f];
      for (const a of coords) for (const b of coords) {
        const p = { x: 0, y: 0, z: 0, c: d.color };
        const others = ['x', 'y', 'z'].filter((k) => k !== d.axis);
        p[d.axis] = d.sign * n;
        p[others[0]] = a;
        p[others[1]] = b;
        // element (kostka), do którego należy naklejka w stanie ułożonym
        p.home = ['x', 'y', 'z'].map((k) => (Math.abs(p[k]) === n ? Math.sign(p[k]) * (n - 1) : p[k]));
        st.push(p);
      }
    }
    return st;
  }

  // obrót o -90° (zgodnie z ruchem wskazówek zegara patrząc od dodatniej strony osi)
  function rotCW(p, axis) {
    const { x, y, z } = p;
    if (axis === 'x') { p.y = z; p.z = -y; }
    else if (axis === 'y') { p.x = -z; p.z = x; }
    else { p.x = y; p.y = -x; }
  }

  // rozkłada ruch (np. "3Rw'") na: oś, stronę, szerokość i liczbę obrotów CW wokół dodatniej osi
  function parseMove(mv) {
    const m = /^(\d*)([URFDLB])(w?)(['2]?)$/.exec(mv);
    if (!m) return null;
    const face = FACE_DEF[m[2]];
    const width = m[3] ? (m[1] ? parseInt(m[1], 10) : 2) : 1;
    // obrót CW ściany o znaku -1 to obrót CCW wokół dodatniej osi
    let turns = m[4] === '2' ? 2 : (m[4] === "'" ? 3 : 1);
    if (face.sign < 0) turns = (4 - turns) % 4;
    return { face: m[2], axis: face.axis, sign: face.sign, width, turns, suffix: m[4] };
  }

  const inLayer = (p, mv, n) => p[mv.axis] * mv.sign > n - 2 * mv.width;

  function applyParsed(st, n, mv) {
    for (const p of st) {
      if (inLayer(p, mv, n)) for (let t = 0; t < mv.turns; t++) rotCW(p, mv.axis);
    }
  }

  function applyMove(st, n, mv) {
    const m = parseMove(mv);
    if (m) applyParsed(st, n, m);
  }

  // pozycja naklejki w siatce danej ściany (kolumna, wiersz)
  function cell(f, p, n) {
    const h = n - 1;
    switch (f) {
      case 'U': return [(p.x + h) / 2, (p.z + h) / 2];
      case 'F': return [(p.x + h) / 2, (h - p.y) / 2];
      case 'R': return [(h - p.z) / 2, (h - p.y) / 2];
      case 'B': return [(h - p.x) / 2, (h - p.y) / 2];
      case 'L': return [(p.z + h) / 2, (h - p.y) / 2];
      case 'D': return [(p.x + h) / 2, (h - p.z) / 2];
    }
  }

  const NET = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };

  function cubeSVG(n, scramble) {
    const st = solvedCube(n);
    scramble.split(/\s+/).filter(Boolean).forEach((mv) => applyMove(st, n, mv));
    const S = 12; // rozmiar ściany w jednostkach
    const gap = 0.6;
    const cs = S / n;
    const W = 4 * S + 3 * gap;
    const H = 3 * S + 2 * gap;
    let rects = '';
    for (const p of st) {
      let f = null;
      for (const k in FACE_DEF) {
        const d = FACE_DEF[k];
        if (p[d.axis] === d.sign * n) { f = k; break; }
      }
      const [c, r] = cell(f, p, n);
      const [nx, ny] = NET[f];
      const x = nx * (S + gap) + c * cs;
      const y = ny * (S + gap) + r * cs;
      rects += `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${cs.toFixed(3)}" height="${cs.toFixed(3)}" fill="${COLORS[p.c]}"/>`;
    }
    const sw = Math.max(0.08, 0.35 / Math.sqrt(n));
    return `<svg viewBox="-0.3 -0.3 ${W + 0.6} ${H + 0.6}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Podgląd kostki po scramble"><g stroke="#111" stroke-width="${sw}" stroke-linejoin="round">${rects}</g></svg>`;
  }

  window.Scramble = {
    PUZZLES,
    generate: (puzzle) => (PUZZLES[puzzle] || PUZZLES['333']).gen(),
    draw: (puzzle, scramble) => {
      const n = CUBE_SIZE[puzzle];
      return n ? cubeSVG(n, scramble) : null;
    },
    // do podglądu 3D
    cubeSize: (puzzle) => CUBE_SIZE[puzzle] || 0,
    solvedCube,
    parseMove,
    applyParsed,
    inLayer,
    COLORS,
  };
})();
