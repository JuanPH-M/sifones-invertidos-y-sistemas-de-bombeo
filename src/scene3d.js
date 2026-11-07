/* Modelado 3D paramétrico con Three.js incluido en el archivo. */
(function (root) {
  'use strict';

  function hasWebGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  var COL = {
    pipe: 0x31424a, pipeOff: 0x8d979b, water: 0x3f9bd1, concrete: 0xb5bab7, soil: 0xcbbf9f, river: 0x4fa8da,
    particle: 0xffffff, accent: 0x0f5e7c, reserve: 0x9aa3a6, ground: 0xa9b89a
  };

  function label(text, size, color) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), fs = 44;
    g.font = '600 ' + fs + 'px "Segoe UI",Arial,sans-serif';
    var lines = String(text).split('\n');
    var w = Math.max.apply(null, lines.map(function (l) { return g.measureText(l).width; })) + 36;
    var h = lines.length * (fs + 10) + 22;
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.strokeStyle = 'rgba(16,38,47,.55)';
    g.lineWidth = 3;
    if (g.roundRect) { g.beginPath(); g.roundRect(2, 2, c.width - 4, c.height - 4, 12); g.fill(); g.stroke(); }
    else { g.fillRect(2, 2, c.width - 4, c.height - 4); g.strokeRect(2, 2, c.width - 4, c.height - 4); }
    g.font = '600 ' + fs + 'px "Segoe UI",Arial,sans-serif';
    g.fillStyle = color || '#10262f';
    g.textBaseline = 'top';
    lines.forEach(function (l, i) { g.fillText(l, 18, 12 + i * (fs + 10)); });
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    sp.renderOrder = 10;
    var s = (size || 1) * (lines.length > 1 ? 2.3 : 1.35);
    sp.scale.set(s * c.width / c.height, s, 1);
    return sp;
  }

  function cyl(a, b, r, mat) {
    var d = new THREE.Vector3().subVectors(b, a), L = d.length();
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 20, 1, false), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return m;
  }
  function boxMesh(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }
  function tubePath(group, pts, r, matPipe) {
    for (var i = 1; i < pts.length; i++) group.add(cyl(pts[i - 1], pts[i], r, matPipe));
    pts.forEach(function (p) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), matPipe);
      s.position.copy(p);
      group.add(s);
    });
  }
  function polyLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L; }
  function pointAt(pts, s) {
    for (var i = 1; i < pts.length; i++) {
      var d = pts[i].distanceTo(pts[i - 1]);
      if (s <= d) return pts[i - 1].clone().lerp(pts[i], s / d);
      s -= d;
    }
    return pts[pts.length - 1].clone();
  }

  function Viewer(host) {
    this.host = host;
    this.ok = hasWebGL() && typeof THREE !== 'undefined';
    this.anim = []; this.particles = []; this.fill = [];
    this.t = { az: -0.5, el: 0.36, r: 60, tgt: new THREE.Vector3(0, 0, 0) };
    this.running = false;
  }
  Viewer.prototype.init = function (opts) {
    if (this.renderer || !this.ok) return;
    opts = opts || {};
    var self = this;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.snapshot });
    } catch (e) { this.ok = false; return; }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 5000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a7a, 1.5));
    var dl = new THREE.DirectionalLight(0xffffff, 1.6);
    dl.position.set(40, 90, 50);
    this.scene.add(dl);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    if (opts.snapshot) return;
    var cv = this.renderer.domElement;
    cv.setAttribute('aria-label', 'Modelo 3D: arrastre para girar, rueda para acercar');
    this.host.appendChild(cv);
    var down = null, pts = new Map(), lastDist = 0;
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); down = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey }; lastDist = 0; });
    cv.addEventListener('pointermove', function (e) {
      if (!down || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e);
      if (pts.size === 2) {
        var a = Array.from(pts.values()), dist = Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY);
        if (lastDist) self.t.r = Math.max(self.minR, Math.min(self.maxR, self.t.r * lastDist / dist));
        lastDist = dist; return;
      }
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.x = e.clientX; down.y = e.clientY;
      if (down.btn === 2 || down.shift) {
        var s = self.t.r * 0.0016, c = Math.cos(self.t.az), si = Math.sin(self.t.az);
        self.t.tgt.x += (-dx * c - dy * si * 0.5) * s; self.t.tgt.z += (dx * si - dy * c * 0.5) * s;
      } else {
        self.t.az -= dx * 0.006;
        self.t.el = Math.max(-0.1, Math.min(1.45, self.t.el + dy * 0.005));
      }
    });
    var up = function (e) { pts.delete(e.pointerId); if (!pts.size) down = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); self.t.r = Math.max(self.minR, Math.min(self.maxR, self.t.r * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    new ResizeObserver(function () { self.resize(); }).observe(this.host);
    this.resize();
  };
  Viewer.prototype.resize = function () {
    if (!this.renderer) return;
    var w = this.host.clientWidth, h = this.host.clientHeight;
    if (w < 2 || h < 2) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  Viewer.prototype.clear = function () {
    var r = this.root;
    while (r.children.length) r.remove(r.children[0]);
    r.traverse(function () {});
    this.scene.traverse(function () {});
    this.particles = []; this.anim = [];
  };
  Viewer.prototype.frameTo = function (cx, cy, cz, r, keep) {
    if (!keep) { this.t.r = r; this.t.tgt.set(cx, cy, cz); this.t.az = -0.5; this.t.el = 0.36; }
    this.home = { r: r, x: cx, y: cy, z: cz };
    this.minR = r * 0.2; this.maxR = r * 3;
  };
  Viewer.prototype.resetView = function () {
    if (!this.home) return;
    this.t.r = this.home.r; this.t.tgt.set(this.home.x, this.home.y, this.home.z); this.t.az = -0.5; this.t.el = 0.36;
  };
  Viewer.prototype.addFlow = function (pts, count, speed, size) {
    var L = polyLen(pts);
    var mat = new THREE.MeshBasicMaterial({ color: COL.particle });
    var mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 6), mat, count);
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    this.particles.push({ mesh: mesh, pts: pts, L: L, count: count, speed: speed, ph: Math.random() });
  };
  Viewer.prototype.tick = function (dt) {
    var m = new THREE.Matrix4();
    this.particles.forEach(function (p) {
      p.ph = (p.ph + dt * p.speed / p.L) % 1;
      for (var i = 0; i < p.count; i++) {
        var s = ((p.ph + i / p.count) % 1) * p.L;
        var q = pointAt(p.pts, s);
        m.makeTranslation(q.x, q.y, q.z);
        p.mesh.setMatrixAt(i, m);
      }
      p.mesh.instanceMatrix.needsUpdate = true;
    });
    this.anim.forEach(function (fn) { fn(dt); });
    var t = this.t, c = this.camera;
    c.position.set(
      t.tgt.x + t.r * Math.cos(t.el) * Math.sin(t.az),
      t.tgt.y + t.r * Math.sin(t.el),
      t.tgt.z + t.r * Math.cos(t.el) * Math.cos(t.az)
    );
    c.lookAt(t.tgt);
    this.renderer.render(this.scene, c);
  };
  Viewer.prototype.start = function () {
    if (this.running || !this.renderer) return;
    this.running = true;
    var self = this, last = performance.now();
    var loop = function (now) {
      if (!self.running) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (self.host.clientWidth > 2) self.tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  Viewer.prototype.stop = function () { this.running = false; };

  /* Nivel de agua que se llena con animación */
  function waterBox(view, w, d, zFloor, zLevel, x, z, mat, memo, key) {
    var h = Math.max(zLevel - zFloor, 0.02);
    var m = boxMesh(w, 1, d, mat, x, 0, z);
    var cur = memo[key] !== undefined ? memo[key] : h;
    var set = function (val) { m.scale.y = val; m.position.y = zFloor + val / 2; };
    set(cur);
    view.anim.push(function (dt) {
      cur += (h - cur) * Math.min(1, dt * 2.2);
      memo[key] = cur;
      set(cur);
    });
    view.root.add(m);
    return m;
  }

  /* ---------- Modelo del sifón ---------- */
  Viewer.prototype.buildSifon = function (res, idx, keep) {
    if (!this.ok) return;
    this.init();
    this.clear();
    this.memo = this.memo || {};
    var c = res.ctx, v = res.v, o = c.casos[idx];
    var total = v.Ld + v.Lc + v.La;
    var kx = 32 / total;             // la horizontal se comprime para ver el conjunto
    var kz = 1.2;                    // la vertical se exagera ligeramente
    var kd = 1.5;                    // diámetros un poco mayores para que se distingan
    var X = function (x) { return (x - total / 2) * kx; };
    var Y = function (z) { return (z - v.Zf) * kz; };
    var N = c.bs.length;
    var sep = Math.max.apply(null, c.bs.map(function (b) { return b.D; })) / 1000 * kd * 2.0 + 0.5;
    var depth = N * sep + 3.6;
    var zOf = function (i) { return (i - (N - 1) / 2) * sep; };

    var matOn = new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.55, roughness: 0.25 });
    var matOff = new THREE.MeshStandardMaterial({ color: COL.pipeOff, transparent: true, opacity: 0.6, roughness: 0.6 });
    var matCon = new THREE.MeshStandardMaterial({ color: COL.concrete, transparent: true, opacity: 0.32, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
    var matWater = new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.55, roughness: 0.2 });
    var matRiver = new THREE.MeshStandardMaterial({ color: COL.river, transparent: true, opacity: 0.55, roughness: 0.15, depthWrite: false });
    var matSoil = new THREE.MeshStandardMaterial({ color: COL.soil, transparent: true, opacity: 0.28, roughness: 1, side: THREE.DoubleSide, depthWrite: false });

    var zTop = Math.max(v.Ze + 1.0, v.Znivel + 0.4);
    var xA = X(0), xB = X(v.Ld), xC = X(v.Ld + v.Lc), xD = X(total), ext = 7;
    var cw = 3.2;

    // Terreno: perfil extruido con el obstáculo
    var sh = new THREE.Shape();
    var yFondo = Y(v.Zf - 1.2);
    sh.moveTo(xA - ext - cw, yFondo);
    sh.lineTo(xD + ext + cw, yFondo);
    sh.lineTo(xD + ext + cw, Y(zTop));
    sh.lineTo(xC + 1.2, Y(zTop));
    sh.lineTo(xC - 0.6, Y(v.Zobs));
    sh.lineTo(xB + 0.6, Y(v.Zobs));
    sh.lineTo(xB - 1.2, Y(zTop));
    sh.lineTo(xA - ext - cw, Y(zTop));
    sh.closePath();
    var soil = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: false }), matSoil);
    soil.position.z = -depth / 2;
    this.root.add(soil);
    // Obstáculo con agua
    if (v.Znivel > v.Zobs) {
      var bw = (xC - xB) - 0.4;
      var rm = boxMesh(bw, Math.max((v.Znivel - v.Zobs) * kz, 0.05), depth, matRiver, (xB + xC) / 2, Y((v.Znivel + v.Zobs) / 2), 0);
      this.root.add(rm);
    }

    // Conductos
    var self = this;
    c.bs.forEach(function (b, i) {
      var z = zOf(i), r = b.D / 1000 / 2 * kd;
      var pts = [
        new THREE.Vector3(xA, Y(v.Zci), z),
        new THREE.Vector3(xB, Y(v.Zf), z),
        new THREE.Vector3(xC, Y(v.Zf), z),
        new THREE.Vector3(xD, Y(v.Zcs), z)
      ];
      var act = i < o.k;
      var g = new THREE.Group();
      tubePath(g, pts, r, act ? matOn : matOff);
      self.root.add(g);
      if (act) {
        var V = o.barrels[i].V;
        self.addFlow(pts, 18, V * 2.4, Math.max(r * 0.33, 0.07));
      }
      var lb = label('Ø' + Math.round(b.D) + ' mm\n' + (act ? 'V = ' + root.Charts.fnum(o.barrels[i].V) + ' m/s' : 'fuera de servicio'), 1.05);
      lb.position.set((xB + xC) / 2, Y(v.Zf) - 0.2 - (N - i) * 0.05, z + 0.01);
      lb.position.y = Y(v.Zf) - 1.7;
      lb.position.x = (xB + xC) / 2 + (i - (N - 1) / 2) * 9;
      self.root.add(lb);
    });

    // Cámaras
    var camara = function (xc, zPiso, zAgua, nombre, key) {
      var pisoY = Y(zPiso) - 0.7;
      var altura = Y(zTop + 0.3) - pisoY;
      var m = boxMesh(cw, altura, depth - 0.6, matCon, xc, pisoY + altura / 2, 0);
      self.root.add(m);
      var e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x4c5659 }));
      e.position.copy(m.position);
      self.root.add(e);
      waterBox(self, cw - 0.12, depth - 0.72, pisoY, Y(zAgua), xc, 0, matWater, self.memo, key);
      var lb = label(nombre + '\nNA ' + root.Charts.fnum(zAgua, 2) + ' m', 1.05);
      lb.position.set(xc, Y(zTop) + 2.6, 0);
      self.root.add(lb);
    };
    camara(xA - cw / 2, Math.min(v.Zci, v.Ze), o.NAe, 'Cámara de entrada', 'e');
    camara(xD + cw / 2, Math.min(v.Zcs, v.Zs), o.NAs, 'Cámara de salida', 's');

    // Colectores
    var rE = v.De / 1000 / 2 * kd, rS = v.Ds / 1000 / 2 * kd;
    var pE = [new THREE.Vector3(xA - cw - ext, Y(v.Ze + v.De / 2000), 0), new THREE.Vector3(xA - cw, Y(v.Ze + v.De / 2000), 0)];
    var pS = [new THREE.Vector3(xD + cw, Y(v.Zs + v.Ds / 2000), 0), new THREE.Vector3(xD + cw + ext, Y(v.Zs + v.Ds / 2000), 0)];
    var matCol = new THREE.MeshStandardMaterial({ color: COL.pipe, transparent: true, opacity: 0.35, roughness: 0.5, depthWrite: false });
    this.root.add(cyl(pE[0], pE[1], rE, matCol));
    this.root.add(cyl(pS[0], pS[1], rS, matCol));
    this.addFlow(pE, 10, c.ent[idx].V * 2.4, 0.13);
    this.addFlow(pS, 10, c.sal[idx].V * 2.4, 0.13);

    var lQ = label(o.key + ' = ' + root.Charts.fnum(o.Q * 1000, 1) + ' L/s · H = ' + root.Charts.fnum(o.hL, 3) + ' m', 1.2, '#0f5e7c');
    lQ.position.set(0, Y(zTop) + 5.0, 0);
    this.root.add(lQ);
    this.frameTo(0, Y((v.Zf + zTop) / 2), 0, 38 + N * 1.5, keep);
    this.resize();
    this.tick(0);
  };

  /* ---------- Modelo de la estación de bombeo ---------- */
  Viewer.prototype.buildBomba = function (res, keep) {
    if (!this.ok) return;
    this.init();
    this.clear();
    this.memo = this.memo || {};
    var c = res.ctx, v = res.v, self = this;
    var zRef = v.Zfondo;
    var ks = 17 / Math.max(v.Zdis - v.Zfondo, 6);
    ks = Math.min(ks, 2.6);
    var Y = function (z) { return (z - zRef) * ks; };
    var kd = 1.9;
    var LB = Math.max(v.LB, 3) * 1.25, BB = Math.max(v.BB, 3) * 1.5;
    var xW = -14;
    var N = Math.max(v.nInst, 1);
    var sepZ = Math.min(BB / Math.max(N, 1), 2.6);
    var zOf = function (i) { return (i - (N - 1) / 2) * sepZ; };
    var gTop = v.Znmax + Math.max(0.8, (v.Zdis - v.Znmin) * 0.05);

    var matCon = new THREE.MeshStandardMaterial({ color: COL.concrete, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    var matWater = new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.55, roughness: 0.2 });
    var matOn = new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.55 });
    var matOff = new THREE.MeshStandardMaterial({ color: COL.pipeOff, transparent: true, opacity: 0.55 });
    var matPump = new THREE.MeshStandardMaterial({ color: COL.accent, roughness: 0.45, metalness: 0.3 });
    var matRes = new THREE.MeshStandardMaterial({ color: COL.reserve, roughness: 0.6 });
    var matImp = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    var matGround = new THREE.MeshStandardMaterial({ color: COL.ground, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });

    // Terreno
    var plane = new THREE.Mesh(new THREE.BoxGeometry(62, 0.25, 20), matGround);
    plane.position.set(9, Y(gTop), 0);
    this.root.add(plane);

    // Pozo húmedo
    var hP = Math.max(Y(gTop), 3);
    var pozo = boxMesh(LB, hP, BB, matCon, xW, hP / 2, 0);
    this.root.add(pozo);
    var ed = new THREE.LineSegments(new THREE.EdgesGeometry(pozo.geometry), new THREE.LineBasicMaterial({ color: 0x4c5659 }));
    ed.position.copy(pozo.position);
    this.root.add(ed);
    waterBox(this, LB - 0.2, BB - 0.2, 0, Y(v.Znmin), xW, 0, matWater, this.memo, 'pozo');
    var lPozo = label('Pozo húmedo\nNA mín ' + root.Charts.fnum(v.Znmin) + ' · máx ' + root.Charts.fnum(v.Znmax) + ' m', 1.45);
    lPozo.position.set(xW - 3, Y(gTop) + 3.2, 0);
    this.root.add(lPozo);
    var marca = new THREE.Mesh(new THREE.BoxGeometry(LB, 0.03, BB), new THREE.MeshBasicMaterial({ color: 0x0f5e7c, transparent: true, opacity: 0.25 }));
    marca.position.set(xW, Y(v.Znmax), 0);
    this.root.add(marca);

    // Impulsión común
    var xB = xW + LB / 2 + 6;
    var yEje = Y(v.Zeje);
    var xM = xB + 4, xT = 26;
    var rI = v.Dim / 1000 / 2 * kd, rS = v.Dsu / 1000 / 2 * kd;
    var yT = Y(v.Zdis);
    var ptsI = [new THREE.Vector3(xM, yEje, 0), new THREE.Vector3(xM + 2, Math.min(yEje + 3, yT - 1), 0), new THREE.Vector3(xT - 2.2, yT - 0.7, 0)];
    var g = new THREE.Group();
    tubePath(g, ptsI, rI, matOn);
    this.root.add(g);
    this.addFlow(ptsI, 26, c.vel.i * 3, Math.max(rI * 0.35, 0.08));

    // Bombas
    for (var i = 0; i < N; i++) {
      (function (i) {
        var z = zOf(i), act = i < v.nAct;
        var ptsS = [new THREE.Vector3(xW + LB * 0.3, Y(v.Zboca), z), new THREE.Vector3(xW + LB * 0.3, yEje, z), new THREE.Vector3(xB - 1, yEje, z)];
        var gs = new THREE.Group();
        tubePath(gs, ptsS, rS, act ? matOn : matOff);
        self.root.add(gs);
        var dx = new THREE.Vector3(xB + 1, yEje, z), ms = new THREE.Vector3(xM, yEje, 0);
        self.root.add(cyl(dx, ms, rI, act ? matOn : matOff));
        var body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 18), act ? matPump : matRes);
        body.position.set(xB, yEje, z);
        body.scale.set(1, 1, 0.6);
        self.root.add(body);
        var motor = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2, 20), act ? matPump : matRes);
        motor.position.set(xB, yEje + 2.2, z);
        self.root.add(motor);
        if (act) {
          var imp = new THREE.Group();
          for (var k = 0; k < 4; k++) {
            var bl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.1, 0.1), matImp);
            bl.rotation.z = k * Math.PI / 4;
            imp.add(bl);
          }
          imp.position.set(xB, yEje, z + 0.95);
          self.root.add(imp);
          var w = (c.op.Qp / 40 + 2);
          self.anim.push(function (dt) { imp.rotation.z -= dt * w * 2; });
          self.addFlow(ptsS, 12, c.vel.s * 3, Math.max(rS * 0.3, 0.08));
        }
        var lb = label(act ? 'Bomba en operación\n' + root.Charts.fnum(c.op.Qp, 1) + ' L/s · ' + root.Charts.fnum(c.op.H) + ' m' : 'Bomba de reserva', 1.3);
        lb.position.set(xB + 1, yEje + 5.5 + i * 3.1, z);
        self.root.add(lb);
      })(i);
    }

    // Tanque de descarga
    var tqW = 5.5, tqH = 3.2;
    var tq = boxMesh(tqW, tqH, 6, matCon, xT + tqW / 2 - 2.2, yT - tqH / 2 + 0.6, 0);
    this.root.add(tq);
    var e2 = new THREE.LineSegments(new THREE.EdgesGeometry(tq.geometry), new THREE.LineBasicMaterial({ color: 0x4c5659 }));
    e2.position.copy(tq.position);
    this.root.add(e2);
    waterBox(this, tqW - 0.15, 5.85, yT - tqH + 0.6, yT, xT + tqW / 2 - 2.2, 0, matWater, this.memo, 'tq');
    var lT = label('Descarga ' + root.Charts.fnum(v.Zdis) + ' m', 1.8);
    lT.position.set(xT + tqW / 2 - 2.2, yT + 2.2, 0);
    this.root.add(lT);
    var lI = label('Impulsión Ø' + Math.round(v.Dim) + ' mm · Vi = ' + root.Charts.fnum(c.vel.i) + ' m/s', 1.8);
    lI.position.set((xM + xT) / 2 + 8, (yEje + yT) / 2 - 3.2, 0);
    this.root.add(lI);
    var lO = label('Q = ' + root.Charts.fnum(c.op.Qt, 1) + ' L/s · TDH = ' + root.Charts.fnum(c.op.H) + ' m · ΔH = ' + root.Charts.fnum(c.ar.dH) + ' m', 2.1, '#0f5e7c');
    lO.position.set(6, Math.max(yT, yEje + 7) + 7.5, 0);
    this.root.add(lO);

    this.frameTo(4, yT / 2 + 1.5, 0, 56, keep);
    this.resize();
    this.tick(0);
  };

  /* Toma una imagen para el reporte PDF */
  function snapshot(kind, res, idx, w, h) {
    if (!hasWebGL() || typeof THREE === 'undefined') return null;
    var hostFake = { clientWidth: w, clientHeight: h, appendChild: function () {} };
    var view = new Viewer(hostFake);
    view.init({ snapshot: true });
    if (!view.ok) return null;
    view.renderer.setPixelRatio(1);
    view.renderer.setClearColor(0xeef2f3, 1);
    view.renderer.setSize(w, h, false);
    view.camera.aspect = w / h;
    view.camera.updateProjectionMatrix();
    if (kind === 'sifon') view.buildSifon(res, idx); else view.buildBomba(res);
    view.resize = function () {};
    view.tick(0.016);
    var url = view.renderer.domElement.toDataURL('image/jpeg', 0.9);
    view.renderer.dispose();
    if (view.renderer.forceContextLoss) view.renderer.forceContextLoss();
    return url;
  }

  root.Scene3D = { Viewer: Viewer, hasWebGL: hasWebGL, snapshot: snapshot };
})(typeof self !== 'undefined' ? self : this);
