global.window = {};
require(require('path').join(__dirname, '..', 'js', 'scramble.js'));
const S = window.Scramble;
// uruchomienie: node tools/f2l_verify.js
window.Cube3D = {};
global.document = { querySelector: () => null };
require(require('path').join(__dirname, '..', 'js', 'f2l.js'));
const CASES = window.F2L.CASES.map((c) => [c.group, c.alg]);
const inv = (m) => m.endsWith("'") ? m[0] : m.endsWith('2') ? m : m + "'";
const apply = (st, seq) => seq.forEach((mv) => S.applyParsed(st, 3, S.parseMove(mv)));
const key = (p) => p.x + ',' + p.y + ',' + p.z;
let bad = 0; const sigs = new Set();
CASES.forEach(([g, alg], i) => {
  const moves = alg.split(' ');
  const setup = moves.slice().reverse().map(inv);
  const st = S.solvedCube(3);
  const home = st.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  apply(st, setup);
  // F2L poza parą FR musi zostać nietknięte: wszystkie naklejki elementów z warstw D i środkowej (bez FR)
  const isFR = (h) => h[0] === 2 && h[2] === 2 && h[1] <= 0; // narożnik DFR (y=-2) i krawędź FR (y=0)
  let ok = true, pairSolved = true;
  st.forEach((p, j) => {
    const h = p.home;
    if (h[1] === 2) return; // ostatnia warstwa – dowolnie
    const atHome = key(p) === key(home[j]);
    if (isFR(h)) { if (!atHome) pairSolved = false; }
    else if (!atHome) ok = false;
  });
  // sygnatura przypadku: gdzie są naklejki pary (z dokładnością do AUF – sprawdzamy 4 obroty U)
  const sig = [];
  for (let k = 0; k < 4; k++) {
    sig.push(st.filter((p) => isFR(p.home)).map((p) => key(p) + '/' + p.c).sort().join('|'));
    S.applyParsed(st, 3, S.parseMove('U'));
  }
  const canon = sig.sort()[0];
  const dup = sigs.has(canon); sigs.add(canon);
  // po wykonaniu algorytmu kostka ma być ułożona
  const st2 = S.solvedCube(3); apply(st2, setup); apply(st2, moves);
  const solved = st2.every((p, j) => key(p) === key(home[j]));
  if (!ok || pairSolved || dup || !solved) { bad++; console.log('BAD', i + 1, alg, { ok, pairSolved, dup, solved }); }
});
console.log('cases', CASES.length, 'distinct', sigs.size, 'bad', bad);
