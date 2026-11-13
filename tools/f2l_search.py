"""Wyszukiwanie algorytmów F2L (slot FR) metodą meet-in-the-middle na modelu kostek (cubie).

Śledzimy tylko 12 istotnych elementów: krzyż (DR, DF, DL, DB), trzy pozostałe sloty
(narożniki DLF, DBL, DRB + krawędzie FL, BL, BR) i parę FR (narożnik DFR, krawędź FR).
Ruch działa na pozycję każdego elementu niezależnie, więc rzut stanu na te elementy jest poprawny.
"""
import itertools, json, sys

URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB = range(8)
UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR = range(12)

# tablice ruchów Kociemby: pozycja i dostaje element z pozycji cp[i]
MOVES = {
    'U': ([UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB], [0] * 8,
          [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR], [0] * 12),
    'R': ([DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR], [2, 0, 0, 1, 1, 0, 0, 2],
          [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR], [0] * 12),
    'F': ([UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB], [1, 2, 0, 0, 2, 1, 0, 0],
          [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR], [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]),
    'D': ([URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR], [0] * 8,
          [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR], [0] * 12),
    'L': ([URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB], [0, 1, 2, 0, 0, 2, 1, 0],
          [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR], [0] * 12),
    'B': ([URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL], [0, 0, 1, 2, 0, 0, 2, 1],
          [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB], [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]),
}

CORNERS = [DFR, DLF, DBL, DRB]          # pierwszy to narożnik pary
EDGES = [FR, DR, DF, DL, DB, FL, BL, BR]  # pierwszy to krawędź pary

def corner_step(face):
    cp, co, _, _ = MOVES[face]
    t = {}
    for q in range(8):
        p = cp[q]  # element z pozycji p trafia na q
        for o in range(3):
            t[(p, o)] = (q, (o + co[q]) % 3)
    return t

def edge_step(face):
    _, _, ep, eo = MOVES[face]
    t = {}
    for q in range(12):
        p = ep[q]
        for o in range(2):
            t[(p, o)] = (q, (o + eo[q]) % 2)
    return t

# tablice dla obrotów o 90, 180, 270
def compose(t, n):
    def f(x):
        for _ in range(n):
            x = t[x]
        return x
    return {k: f(k) for k in t}

CT, ET = {}, {}
for face in MOVES:
    c1, e1 = corner_step(face), edge_step(face)
    for n, suf in ((1, ''), (2, '2'), (3, "'")):
        CT[face + suf] = compose(c1, n)
        ET[face + suf] = compose(e1, n)

def apply(state, mv):
    cs, es = state
    c, e = CT[mv], ET[mv]
    return (tuple(c[x] for x in cs), tuple(e[x] for x in es))

def inv(mv):
    return mv[0] + ("'" if len(mv) == 1 else ('' if mv[1] == "'" else '2'))

SOLVED = (tuple((p, 0) for p in CORNERS), tuple((p, 0) for p in EDGES))

def neighbours(faces):
    return [f + s for f in faces for s in ('', '2', "'")]

def expand(start, moves, depth):
    """BFS do zadanej głębokości; zwraca {stan: najkrótsze sekwencje (lista)}"""
    seen = {start: [()]}
    frontier = {start: [()]}
    for _ in range(depth):
        nxt = {}
        for st, seqs in frontier.items():
            for mv in moves:
                for seq in seqs:
                    if seq and seq[-1][0] == mv[0]:
                        continue
                    ns = apply(st, mv)
                    if ns in seen and len(seen[ns][0]) < len(seq) + 1:
                        continue
                    lst = nxt.setdefault(ns, [])
                    if len(lst) < 6:
                        lst.append(seq + (mv,))
        for st, seqs in nxt.items():
            if st not in seen:
                seen[st] = seqs
        frontier = {s: v for s, v in nxt.items() if len(seen[s][0]) == len(v[0])}
    return seen

def case_state(cpos, cori, epos, eori):
    cs = list(SOLVED[0]); es = list(SOLVED[1])
    cs[0] = (cpos, cori); es[0] = (epos, eori)
    return (tuple(cs), tuple(es))

def all_cases():
    """41 przypadków z dokładnością do obrotu U (AUF)."""
    seen, out = set(), []
    for cpos, cori, epos, eori in itertools.product([URF, UFL, ULB, UBR, DFR], range(3), [UR, UF, UL, UB, FR], range(2)):
        st = case_state(cpos, cori, epos, eori)
        if st == SOLVED:
            continue
        variants = [st]
        for _ in range(3):
            variants.append(apply(variants[-1], 'U'))
        key = min(variants)
        if key in seen:
            continue
        seen.add(key)
        out.append(variants)
    return out

def score(seq):
    # wygoda w palcach: R/U najlepsze, F' U' F jako krótkie wstawienie OK; R2/F2 i zmiany R<->F kosztują
    faces = [m[0] for m in seq]
    cost = len(seq)
    cost += 0.9 * sum(1 for m in seq if m in ('R2', 'F2'))
    cost += 0.45 * faces.count('F')
    cost += 3 * sum(1 for f in faces if f not in 'RUF')
    cost += 0.4 * sum(1 for a, b in zip(faces, faces[1:]) if {a, b} == {'R', 'F'})
    cost += 0.3 * (seq[0] in ("R'", "F"))
    return (round(cost, 2), len(seq))

def solve(variants, moves, half):
    back = BACK[tuple(moves)]
    best = None
    for k, st in enumerate(variants):
        fwd = expand(st, moves, half)
        for s, fseqs in fwd.items():
            if s not in back:
                continue
            for fs in fseqs:
                for bs in back[s]:
                    seq = fs + tuple(inv(m) for m in reversed(bs))
                    # sklejenie: ten sam ruch na styku -> pomijamy (nie najkrótsze)
                    if fs and bs and fs[-1][0] == bs[-1][0]:
                        continue
                    cand = (score(seq), k, seq)
                    if best is None or cand < best:
                        best = cand
    return best

BACK = {}
if __name__ == '__main__':
    cases = all_cases()
    print('cases', len(cases), file=sys.stderr)
    sets = [list('RU'), list('RUF'), list('RUFL'), list('RUFLDB')]
    results = []
    for i, variants in enumerate(cases):
        found = None
        for faces in sets:
            mv = neighbours(faces)
            if tuple(mv) not in BACK:
                BACK[tuple(mv)] = expand(SOLVED, mv, 6 if len(faces) <= 3 else 5)
            r = solve(variants, mv, 6 if len(faces) <= 3 else 5)
            if r and (found is None or r[0] < found[0]):
                found = r
            if found and len(faces) >= 3:
                break
        if not found:
            print('NO SOLUTION', i, file=sys.stderr)
            continue
        sc, k, seq = found
        st = variants[k]
        (cpos, cori) = st[0][0]
        (epos, eori) = st[1][0]
        results.append({'alg': ' '.join(seq), 'corner': [cpos, cori], 'edge': [epos, eori]})
        print(i, len(seq), sc, ' '.join(seq), file=sys.stderr)
    json.dump(results, open(sys.argv[1], 'w'), indent=1)
