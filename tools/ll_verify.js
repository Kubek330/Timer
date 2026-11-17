// Sprawdza algorytmy OLL/PLL na modelu naklejek: F2L nienaruszone, właściwy wzór przypadku, brak duplikatów
global.window = {};
require(require('path').join(__dirname, '..', 'js', 'scramble.js'));
const S = window.Scramble;
// uruchomienie: node tools/ll_verify.js
global.document = { querySelector: () => null };
window.Cube3D = {};
require(require('path').join(__dirname, '..', 'js', 'trainer.js'));
const pack = (k) => window.Trainer.SETS[k].cases.map((c) => [c.group, c.name, c.alg]);
const OLL = pack('oll');
const PLL = pack('pll');
const inv = (m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'");
const run = (st, seq) => seq.forEach((m) => { const p = S.parseMove(m); if (!p) throw new Error('parse ' + m); S.applyParsed(st, 3, p); });
const key = (p) => p.x + ',' + p.y + ',' + p.z;
function check(name, list, kind) {
  const sigs = new Map(); let bad = 0;
  list.forEach(([g, nm, alg]) => {
    const mv = alg.split(' ');
    const setup = mv.slice().reverse().map(inv);
    const st = S.solvedCube(3);
    const home = new Map(st.map((p) => [p, key(p)]));
    run(st, setup);
    // centra na miejscu (brak obrotu całości), F2L (warstwy y<2) nietknięte
    const f2lOk = st.every((p) => p.home[1] === 2 || key(p) === home.get(p));
    const ll = st.filter((p) => p.home[1] === 2);
    // U-kolor (0) na górze?
    const top = st.filter((p) => p.y === 3);
    const allUp = top.every((p) => p.c === 0);
    const edgesUp = top.filter((p) => p.c === 0 && (p.x === 0) !== (p.z === 0)).length;
    const cornersUp = top.filter((p) => p.c === 0 && p.x !== 0 && p.z !== 0).length;
    // po algorytmie ułożona
    const st2 = S.solvedCube(3); run(st2, setup); run(st2, mv);
    const solved = st2.every((p) => key(p) === home.get(p) || false) || st2.every((p, i) => key(p) === key(S.solvedCube(3)[i]));
    // sygnatura przypadku do porównań: wzór naklejek ostatniej warstwy z dokładnością do AUF przed i po
    let sig = null;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const t = S.solvedCube(3);
      run(t, Array(a).fill('U')); run(t, setup); run(t, Array(b).fill('U'));
      // OLL: tylko gdzie są żółte naklejki (kolor 0); PLL: pełne kolory
      const s = t.filter((p) => p.y >= 1).map((p) => key(p) + ':' + (kind === 'oll' ? (p.c === 0 ? 'Y' : '-') : p.c)).sort().join('|');
      if (sig === null || s < sig) sig = s;
    }
    let msg = '';
    if (!f2lOk) msg += ' F2L-zepsute';
    if (!solved) msg += ' nie-układa';
    if (kind === 'pll' && !allUp) msg += ' nie-zorientowane';
    if (kind === 'oll' && g === 'co' && edgesUp !== 4) msg += ' krawędzie-nie-góra';
    if (kind === 'oll' && g === 'eo' && edgesUp === 4) msg += ' brak-przypadku';
    if (kind === 'pll' && allUp && st.every((p) => key(p) === home.get(p))) msg += ' brak-przypadku';
    if (sigs.has(sig)) msg += ' duplikat:' + sigs.get(sig);
    sigs.set(sig, nm);
    if (msg) bad++;
    console.log((msg ? 'BŁĄD ' : 'ok   ') + nm.padEnd(16) + alg.padEnd(58) + `krawędzie↑${edgesUp} narożniki↑${cornersUp}` + msg);
  });
  console.log(name, list.length, 'błędów:', bad, '\n');
}
check('OLL', OLL, 'oll');
check('PLL', PLL, 'pll');
