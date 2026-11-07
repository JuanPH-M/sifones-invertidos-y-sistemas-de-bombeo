"""Recalcula el caso base con formulas escritas aparte, sin usar el motor de la aplicacion.
Compara contra los resultados de la aplicacion. Uso: python tests/verificacion_independiente.py
Esto NO reemplaza la memoria manual que exige la guia AA-PF-01 (numeral 6.1)."""
import json, math, subprocess, sys

G = 9.81
ap = subprocess.run(['node', '-e', r"""
const E=require('./src/engine.js');
const s=E.calculate('sifon',E.defaults('sifon')).ctx, b=E.calculate('bomba',E.defaults('bomba')).ctx;
console.log(JSON.stringify({
 D:s.bs.map(x=>x.D),
 casos:s.casos.map(o=>({Q:o.Q,k:o.k,V:o.barrels.map(x=>x.V),he:o.barrels.map(x=>x.he),hc:o.barrels.map(x=>x.hc),hf:o.barrels.map(x=>x.hf),hs:o.barrels.map(x=>x.hs),H:o.hL,NAs:o.NAs,NAe:o.NAe,margen:o.margen})),
 L:s.g.L,
 Qop:b.op.Qt,Hop:b.op.H,eta:b.pot.eta,Pe:b.pot.Pe,NPSHa:b.npsh.a,NPSHr:b.npsh.r,Vs:b.vel.s,Vi:b.vel.i,a:b.ar.a,jouk:b.ar.jouk,mich:b.ar.mich,Vol:b.pozo.Vol,tRet:b.pozo.tRet,fitA:b.fit.A,fitB:b.fit.B,fitC:b.fit.C
}))"""], capture_output=True, text=True, check=True)
A = json.loads(ap.stdout)
rows, malos = [], 0
def cmp(nombre, manual, app):
    global malos
    d = abs(manual - app) / abs(manual) * 100 if manual else abs(app) * 100
    if d > 1: malos += 1
    rows.append((nombre, manual, app, d))

def colebrook(Re, D, ks):
    f = 0.02
    for _ in range(100):
        f = (-2 * math.log10(ks / (3.7 * D) + 2.51 / (Re * math.sqrt(f)))) ** -2
    return f

# ---------- Sifon: T=20 C, nu=1.005e-3/998.2, PVC ks=0.0015 mm ----------
nu = 1.005e-3 / 998.2
dzB, dzS = 98.6 - 94.5, 98.3 - 94.5
L = math.hypot(20, dzB) + 40 + math.hypot(30, dzS)
thB, thS = math.degrees(math.atan(dzB / 20)), math.degrees(math.atan(dzS / 30))
sumA = 2 * thB + 2 * thS
cmp('Sifon: L (m)', L, A['L'])
A3 = math.pi * 0.6 ** 2 / 4

def perdidas(Q, Dmm):
    D = Dmm / 1000
    a = math.pi * D ** 2 / 4
    V = Q / a
    g2 = V ** 2 / (2 * G)
    f = colebrook(V * D / nu, D, 0.0015e-3)
    return V, 1.1 * g2, 0.1316 * (sumA / 90) * g2, f * (L / D) * g2, (A3 / a - 1) * g2

def yNormal(Q, D, n, S):
    lo, hi = 1e-6, 0.938 * D
    for _ in range(100):
        y = (lo + hi) / 2
        th = 2 * math.acos(1 - 2 * y / D)
        a = D * D / 8 * (th - math.sin(th))
        P = D * th / 2
        if (1 / n) * a * (a / P) ** (2 / 3) * S ** 0.5 < Q: lo = y
        else: hi = y
    return y, Q / a

Dm = A['D']
tope = [0.040, 0.080, 0.140]
for i, (nom, Q) in enumerate([('Qmin', 0.040), ('Qmed', 0.120), ('Qmax', 0.260)]):
    Hmax = 0
    for j in range(i + 1):
        V, he, hc, hf, hs = perdidas(tope[j], Dm[j])
        c = A['casos'][i]
        cmp(f'Sifon {nom} conducto {j+1}: V', V, c['V'][j])
        cmp(f'Sifon {nom} conducto {j+1}: he', he, c['he'][j])
        cmp(f'Sifon {nom} conducto {j+1}: hc', hc, c['hc'][j])
        cmp(f'Sifon {nom} conducto {j+1}: hf', hf, c['hf'][j])
        cmp(f'Sifon {nom} conducto {j+1}: hs', hs, c['hs'][j])
        Hmax = max(Hmax, he + hc + hf + hs)
    cmp(f'Sifon {nom}: H gobernante', Hmax, c['H'])
    ys, Vs = yNormal(Q, 0.6, 0.013, 0.003)
    ye, Ve = yNormal(Q, 0.6, 0.013, 0.003)
    NAs = 98.6 + ys
    Es = NAs + Vs ** 2 / (2 * G)
    hw = 0.10 if i > 0 else 0
    Ee = 100.2 + ye + Ve ** 2 / (2 * G)
    cmp(f'Sifon {nom}: NA salida', NAs, c['NAs'])
    cmp(f'Sifon {nom}: NA entrada', Es + Hmax + hw - Ve ** 2 / (2 * G), c['NAe'])
    cmp(f'Sifon {nom}: margen de energia', Ee - (Es + Hmax + hw), c['margen'])

# ---------- Bombeo ----------
pts = [(0, 36, 0, 2.0), (30, 35, 45, 2.3), (60, 33, 65, 2.8), (90, 29.5, 76, 3.5), (120, 25, 78, 4.6), (150, 19, 70, 6.2)]
# Regresion por ecuaciones normales
S = [sum(p[0] ** k for p in pts) for k in range(5)]
Y = [sum(p[1] * p[0] ** k for p in pts) for k in range(3)]
M = [[S[4], S[3], S[2], Y[2]], [S[3], S[2], S[1], Y[1]], [S[2], S[1], S[0], Y[0]]]
for i in range(3):
    for r in range(i + 1, 3):
        m = M[r][i] / M[i][i]
        M[r] = [a - m * b for a, b in zip(M[r], M[i])]
c0 = M[2][3] / M[2][2]
b0 = (M[1][3] - M[1][2] * c0) / M[1][1]
a0 = (M[0][3] - M[0][1] * b0 - M[0][2] * c0) / M[0][0]
cmp('Bomba: coeficiente C', c0, A['fitC'])
gam = 998.2 * G
def Hsis(Qls):
    Q = Qls / 1000
    Ds, Di = 0.35, 0.25
    Vs, Vi = Q / (math.pi * Ds ** 2 / 4), Q / (math.pi * Di ** 2 / 4)
    fs, fi = colebrook(Vs * Ds / nu, Ds, 0.0015e-3), colebrook(Vi * Di / nu, Di, 0.0015e-3)
    hs = (fs * 8 / Ds + 3.0) * Vs ** 2 / (2 * G)
    return 18.0 + hs + (fi * 450 / Di + 8.0 + 1.0) * Vi ** 2 / (2 * G), hs, Vs, Vi
lo, hi = 10.0, 200.0
for _ in range(100):
    m = (lo + hi) / 2
    if a0 * m * m + b0 * m + c0 - Hsis(m)[0] > 0: lo = m
    else: hi = m
Qop = (lo + hi) / 2
Hop = a0 * Qop ** 2 + b0 * Qop + c0
cmp('Bomba: Q operacion (L/s)', Qop, A['Qop'])
cmp('Bomba: H operacion (m)', Hop, A['Hop'])
eta = 76 + (Qop - 90) / 30 * (78 - 76)
cmp('Bomba: eficiencia (%)', eta, A['eta'])
Pe = gam * Qop / 1000 * Hop / (eta / 100) / 1000
cmp('Bomba: potencia al eje (kW)', Pe, A['Pe'])
_, hs, Vs, Vi = Hsis(Qop)
cmp('Bomba: V succion', Vs, A['Vs'])
cmp('Bomba: V impulsion', Vi, A['Vi'])
Patm = 101325 * (1 - 2.25577e-5 * 10) ** 5.25588
NPSHa = Patm / gam + (10.0 - 9.0) - hs - 2340 / gam
cmp('Bomba: NPSH disponible', NPSHa, A['NPSHa'])
cmp('Bomba: NPSH requerido', 3.5 + (Qop - 90) / 30 * (4.6 - 3.5), A['NPSHr'])
a = math.sqrt(2.2e9 / 998.2) / math.sqrt(1 + 2.2 * 0.25 * (1 - 0.4 ** 2) / (2.75 * 0.012))
cmp('Ariete: celeridad a (m/s)', a, A['a'])
cmp('Ariete: Joukowsky (m)', a * Vi / G, A['jouk'])
cmp('Ariete: Michaud (m)', 2 * 450 * Vi / (G * 30), A['mich'])
cmp('Pozo: volumen (m3)', 8 * 4 * 1.2, A['Vol'])
cmp('Pozo: retencion (min)', 8 * 4 * 1.2 / 0.105 / 60, A['tRet'])

print(f"{'Variable':44}{'Manual':>12}{'App':>12}{'Dif %':>9}")
for n, m, a_, d in rows:
    print(f"{n:44}{m:12.4f}{a_:12.4f}{d:9.3f}")
print(f"\n{len(rows)} variables comparadas; {malos} con diferencia mayor a 1 %; diferencia maxima {max(r[3] for r in rows):.4f} %")
sys.exit(1 if malos else 0)
