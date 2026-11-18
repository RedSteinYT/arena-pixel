'use strict';
// ============================================================
//  MANIQUÍ — robot de entrenamiento (todoterreno)
//  Equilibrado en todo: buena referencia para comparar al resto.
// ============================================================
(() => {
  const METAL = { l: '#f1f2fb', m: '#bcc0da', d: '#8084aa', dd: '#4f5180' };

  function head(c, hx, hy, pal, k = 1, blink = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    R(-4, -4, 9, 8, pal.main);
    R(-3, -5, 7, 1, pal.main);
    R(-3, -5, 5, 1, pal.light);
    R(-4, -4, 2, 3, pal.light);
    R(-4, 3, 9, 1, pal.dark);
    R(4, -3, 1, 6, pal.dark);
    R(0, -2, 5, 3, '#1b1636');
    R(1, -2, 3, 1, '#2d2a5a');
    if (!blink) { R(2, -1, 2, 1, pal.glow); R(4, -1, 1, 1, '#ffffff'); }
    R(-1, -7, 1, 2, METAL.d);
    R(-1, -8, 1, 1, pal.light);
  }

  defineCharacter({
    id: 'maniqui',
    name: 'Maniquí',
    role: 'Todoterreno',
    desc: 'Robot de entrenamiento. Equilibrado: ni muy rápido ni muy pesado.',
    stats: { weight: 100, hw: 6, hh: 24 },
    bust: { k: 2, y: -30, h: 18, dx: 1 },
    selectH: 36,              // alto en la pantalla de selección (para encajarlo en su panel)
    rest: { hip: [0, -9], neck: [0, -17], head: [1, -22], fh: [6, -12], bh: [-2, -13], ff: [3, 0], bf: [-3, 0] },
    poses: {
      // Selección: calibra los puños (1-2) y levanta el brazo con orgullo
      // Pantalla VS: guardia, ráfaga de puños al aire y "ven aquí" con la mano
      taunt(p, f, T) {
        const t = T < 150 ? T : 120 + (T - 120) % 60;
        const b = (T >> 3) % 2;
        crouchPose(p, 1 + b); p.fh = [7, -15 + b]; p.bh = [4, -16 + b];
        if (t >= 18 && t < 58) {                                       // ráfaga
          const k = ((t - 18) / 5 | 0) % 2;
          if (k) { p.fh = [14, -16]; p.bh = [3, -15]; } else { p.bh = [13, -17]; p.fh = [5, -14]; }
          p.neck[0] += 1; p.head[0] += 2;
        } else if (t >= 70 && t < 130) {                               // "ven aquí"
          p.fh = (t >> 3) % 2 ? [11, -15] : [8, -19]; p.bh = [-3, -12];
          p.head[0] -= 1; p.neck[0] -= 1;
        }
        return true;
      },
      select(p, f, T) {
        const t = T % 150;
        if (t < 50 || t >= 120) { const b = Math.sin(T * 0.08) > 0.3 ? 1 : 0; p.neck[1] += b; p.head[1] += b; p.fh[1] += b; p.bh[1] += b; }
        else if (t < 62) { p.fh = [13, -14]; p.neck[0] += 1; p.head[0] += 1; }
        else if (t < 74) { p.bh = [12, -15]; p.fh = [4, -12]; p.neck[0] += 1; p.head[0] += 2; }
        else { p.fh = [3, -31]; p.bh = [-3, -12]; p.head[1] -= 1; f.animT += (t === 75 ? 0 : 0); }
        return true;
      },
      idle(p, f, T) {
        const b = Math.sin(T * 0.08) > 0.3 ? 1 : 0;
        p.neck[1] += b; p.head[1] += b; p.fh[1] += b; p.bh[1] += b;
      },
    },

    moves: {
      jab:    { s: 3, a: 3, e: 9,  hit: [{ box: [4, -17, 14, 7], d: 3, b: 2.2, g: 1.0, ang: 40 }], pose: { fh: [13, -14] } },
      ftilt:  { s: 6, a: 3, e: 15, hit: [{ box: [5, -18, 19, 9], d: 8, b: 2.8, g: 4.5, ang: 35 }], pose: { fh: [17, -14], lean: 2 } },
      utilt:  { s: 4, a: 6, e: 13, hit: [{ box: [-10, -40, 22, 18], d: 6, b: 3.2, g: 3.8, ang: 88 }], pose: { fh: [2, -32], upper: true } },
      dtilt:  { s: 4, a: 3, e: 10, hit: [{ box: [4, -7, 19, 7], d: 5, b: 2.4, g: 2.6, ang: 25 }], pose: { ff: [16, -2], crouch: true } },
      dash:   { s: 5, a: 8, e: 16, hit: [{ box: [3, -20, 17, 16], d: 9, b: 3.2, g: 4.2, ang: 50 }], pose: { ff: [13, -9], fh: [10, -18], lean: 3 },
                onFrame(f, t) { if (t < 13) f.vx = f.dir * 3.2; } },
      fsmash: { s: 13, a: 3, e: 24, smash: true, hit: [{ box: [6, -21, 23, 13], d: 15, b: 3.6, g: 10, ang: 38 }], pose: { fh: [20, -15], wind: [-8, -15], lean: 4 } },
      usmash: { s: 10, a: 6, e: 22, smash: true, hit: [{ box: [-11, -46, 22, 24], d: 14, b: 3.6, g: 9.5, ang: 88 }], pose: { fh: [1, -38], both: true, upper: true } },
      dsmash: { s: 8, a: 4, e: 22, smash: true, hit: [{ box: [-28, -8, 56, 9], d: 12, b: 3.2, g: 8.5, ang: 28, away: true }], pose: { ff: [16, -2], bf: [-16, -2], crouch: true } },
      nair:   { s: 4, a: 10, e: 10, air: true, land: 6, hit: [{ box: [-13, -27, 26, 27], d: 7, b: 2.6, g: 3.4, ang: 45, away: true }], pose: { spin: true } },
      fair:   { s: 7, a: 4, e: 14, air: true, land: 9, hit: [{ box: [4, -25, 19, 17], d: 10, b: 3.0, g: 5.6, ang: 40 }], pose: { fh: [15, -18], lean: 2 } },
      bair:   { s: 6, a: 4, e: 14, air: true, land: 9, hit: [{ box: [-25, -21, 19, 13], d: 11, b: 3.2, g: 6.4, ang: 140 }], pose: { ff: [-15, -11] } },
      uair:   { s: 4, a: 5, e: 12, air: true, land: 6, hit: [{ box: [-10, -44, 20, 20], d: 8, b: 3.0, g: 4.6, ang: 85 }], pose: { ff: [3, -32], fh: [4, -30] } },
      dair:   { s: 9, a: 4, e: 18, air: true, land: 12, hit: [{ box: [-8, -6, 16, 14], d: 11, b: 2.5, g: 5.0, ang: -80 }], pose: { ff: [1, 5], bf: [-2, 3] } },
      // Especial: disparo de energía
      nspc:   { s: 12, a: 1, e: 18, air: true, land: 4, special: true, hit: [], pose: { fh: [15, -15], lean: 2 },
                onFrame(f, t, g) { if (!f.grounded) f.vy = Math.min(f.vy, 1.2); if (t === 12) g.spawnProjectile(f); } },
      // Especial lateral: embestida
      sspc:   { s: 8, a: 12, e: 14, air: true, land: 10, special: true, keepVel: true,
                hit: [{ box: [2, -21, 17, 15], d: 10, b: 3.2, g: 5.0, ang: 35 }], pose: { fh: [16, -14], lean: 3 },
                onStart(f) { f.sideUsed = true; },
                onFrame(f, t) {
                  if (t < 8) { f.vx *= 0.75; f.vy *= 0.5; }
                  else if (t < 20) { f.vx = f.dir * 5.6; f.vy = 0; if (t % 2 === 0) f.trail = 1; }
                  else f.vx *= 0.85;
                },
                noGrav: (f, t) => t < 20 },
      // Especial arriba: gancho ascendente
      uspc:   { s: 3, a: 14, e: 12, air: true, land: 12, special: true, keepVel: true, after: 'helpless', recovery: true,
                hit: [{ box: [-8, -36, 16, 30], d: 9, b: 3.4, g: 4.2, ang: 82 }], pose: { fh: [3, -32], upper: true },
                onStart(f) { f.upUsed = true; f.grounded = false; },
                onFrame(f, t) {
                  if (t === 3) { f.vy = -8.4; f.vx = f.inp.mx * 1.6; f.trail = 1; }
                  if (t > 3 && t < 17) { f.vx = clamp(f.vx + f.inp.mx * 0.08, -2, 2); if (t % 2) f.trail = 1; }
                } },
      // Especial abajo: caída en picado
      dspc:   { s: 6, a: 60, e: 4, air: true, land: 0, special: true, keepVel: true, landTo: 'dspcLand', airOnly: true,
                hit: [{ box: [-8, -8, 16, 14], d: 10, b: 2.6, g: 4.6, ang: -70 }], pose: { ff: [2, 4], bf: [-2, 4], fh: [5, -20], bh: [-5, -20] },
                onStart(f, g) { if (f.grounded) f.startMove('dspcLand', g); },
                onFrame(f, t) {
                  if (t < 6) { f.vy = Math.min(f.vy, -1.5) * 0.9; f.vx *= 0.8; }
                  else { f.vy = 7.6; f.vx *= 0.9; if (t % 2) f.trail = 1; }
                },
                noGrav: () => true },
      dspcLand: { s: 2, a: 5, e: 18, special: true, hit: [{ box: [-30, -10, 60, 10], d: 9, b: 3.0, g: 4.8, ang: 60, away: true }],
                  pose: { crouch: true, fh: [9, -6], bh: [-9, -6] },
                  onStart(f, g) { g.shake = Math.max(g.shake, 3); g.burst(f.x, f.y, 10, 'dust'); } },
    },

    draw(c, f, p, A) {
      const pal = f.pal;
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const sh = [neck[0], neck[1] + 1];
      drawChain(c, f, [neck[0] - 1, neck[1]], 2, [pal.main, pal.dark]);
      pline(c, sh[0] - 1, sh[1], bh[0], bh[1], 2, METAL.dd);
      rect(c, bh[0] - 1, bh[1] - 1, 3, 3, pal.dark);
      pline(c, hip[0] - 1, hip[1], bf[0], bf[1] - 1, 3, METAL.d);
      rect(c, bf[0] - 2, bf[1] - 1, 4, 2, pal.dark);
      pline(c, hip[0], hip[1], neck[0], neck[1] + 1, 6, METAL.m);
      pline(c, hip[0] - 2, hip[1], neck[0] - 2, neck[1] + 1, 1, METAL.l);
      pline(c, hip[0] + 2, hip[1], neck[0] + 2, neck[1] + 1, 1, METAL.d);
      const mx = Math.round((hip[0] + neck[0]) / 2);
      rect(c, mx - 1, neck[1] + 2, 4, 3, pal.main); px(c, mx - 1, neck[1] + 2, pal.light);
      rect(c, hip[0] - 3, hip[1] - 1, 6, 2, pal.dark); px(c, hip[0], hip[1] - 1, pal.light);
      pline(c, hip[0] + 1, hip[1], ff[0], ff[1] - 1, 3, METAL.m);
      rect(c, ff[0] - 2, ff[1] - 1, 5, 2, pal.main); rect(c, ff[0] - 2, ff[1] - 1, 3, 1, pal.light);
      head(c, hd[0], hd[1], pal, 1, (f.animT % 190) > 184 || f.st === 'hitstun');
      pline(c, sh[0] + 1, sh[1], fh[0], fh[1], 2, METAL.m);
      rect(c, fh[0] - 1, fh[1] - 1, 4, 4, pal.main);
      rect(c, fh[0] - 1, fh[1] - 1, 2, 1, pal.light);
      rect(c, fh[0] - 1, fh[1] + 2, 4, 1, pal.dark);
    },
    portrait(c, x, y, pal, k) { head(c, x, y, pal, k); },
  });

  // ------------------------------------------------------------
  //  Escena de selección: LABORATORIO DE PRUEBAS
  // ------------------------------------------------------------
  const labLayout = (W, H, gy) => { const fy = gy - 6; return { fy, mx: Math.round(W * 0.07), my: Math.round(fy * 0.16), sx: Math.round(W * 0.74), bagX: W - 16, alarmX: Math.round(W * 0.5) }; };
  CHARACTERS.maniqui.scene = {
    base(c, W, H, gy) {
      const L = labLayout(W, H, gy), fy = L.fy;
      sceneGrad(c, 0, 0, W, fy, ['#0f1226', '#151a35', '#1c2245', '#232b56', '#2b3566']);
      const seam = Math.round(fy * 0.38);
      for (let x = 0; x < W; x += 28) { rect(c, x, 0, 1, fy, '#0b0d1f'); rect(c, x + 1, 0, 1, fy, '#3a4580'); }
      rect(c, 0, seam, W, 1, '#0b0d1f'); rect(c, 0, seam + 1, W, 1, '#3a4580');
      for (let x = 4; x < W; x += 28) for (const y of [4, seam - 4, seam + 5, fy - 10]) { px(c, x, y, '#6a76b8'); px(c, x, y + 1, '#0b0d1f'); px(c, x + 19, y, '#6a76b8'); px(c, x + 19, y + 1, '#0b0d1f'); }
      // monitor
      const { mx, my } = L;
      rect(c, mx - 1, my - 1, 40, 28, '#0b0d1f'); rect(c, mx, my, 38, 26, '#4f5180'); rect(c, mx, my, 38, 1, '#8084aa');
      rect(c, mx + 2, my + 2, 34, 21, '#06201d');
      for (let x = mx + 2; x < mx + 36; x += 4) rect(c, x, my + 2, 1, 21, '#0b302a');
      for (let y = my + 2; y < my + 23; y += 4) rect(c, mx + 2, y, 34, 1, '#0b302a');
      rect(c, mx + 16, my + 26, 6, 4, '#2c3058'); rect(c, mx + 12, my + 30, 14, 2, '#4f5180');
      // cartel de peligro
      for (let k = 0; k < 9; k++) rect(c, L.sx - k, my + 4 + k * 2, k * 2 + 1, 2, k > 6 ? '#b07a1e' : '#f4c03a');
      rect(c, L.sx, my + 8, 1, 7, '#120d24'); px(c, L.sx, my + 17, '#120d24');
      // saco de entrenamiento
      const bagY = Math.round(fy * 0.42);
      pline(c, L.bagX, 0, L.bagX, bagY, 1, '#6a76b8');
      rect(c, L.bagX - 6, bagY, 13, 30, '#120d24'); rect(c, L.bagX - 5, bagY + 1, 11, 28, '#a0643a');
      rect(c, L.bagX - 5, bagY + 1, 3, 28, '#c88a52'); rect(c, L.bagX + 3, bagY + 1, 3, 28, '#6b3a22');
      rect(c, L.bagX - 5, bagY + 6, 11, 2, '#e8e2ff'); rect(c, L.bagX - 5, bagY + 22, 11, 2, '#e8e2ff');
      // banda de peligro y suelo de rejilla
      for (let y = fy - 6; y < fy; y++) for (let x = 0; x < W; x++) px(c, x, y, ((x + y) >> 2) % 2 ? '#f4c03a' : '#1b1b28');
      rect(c, 0, fy, W, 1, '#0b0d1f');
      sceneGrad(c, 0, fy + 1, W, H - fy - 1, ['#2a3160', '#1c2245', '#12162e', '#0b0d1f']);
      for (let y = fy + 3; y < H; y += 5) rect(c, 0, y, W, 1, '#0f1226');
      for (let x = 3; x < W; x += 7) rect(c, x, fy + 1, 1, H - fy - 1, '#151a35');
    },
    anim(c, W, H, gy, T) {
      const L = labLayout(W, H, gy);
      for (let x = 0; x < 34; x++) {
        const y = L.my + 12 + Math.round(Math.sin((x + T * 0.7) * 0.42) * 6 * (0.6 + 0.4 * Math.sin(T * 0.03)));
        px(c, L.mx + 2 + x, y, '#3df2b0'); if (x % 3 === 0) px(c, L.mx + 2 + x, y + 1, '#1f9c8c');
      }
      rect(c, L.mx + 2, L.my + 2 + ((T >> 1) % 21), 34, 1, '#14463e');
      const on = (T >> 4) % 2;
      disc(c, L.alarmX, 8, 4, '#120d24'); disc(c, L.alarmX, 8, 3, on ? '#ff5f5f' : '#5a1a2a');
      if (on) { px(c, L.alarmX - 1, 7, '#ffd1c8'); for (let a = 0; a < 12; a++) px(c, L.alarmX + Math.round(Math.cos(a / 2) * 6), 8 + Math.round(Math.sin(a / 2) * 6), '#ff9a76'); }
    },
    platform(c, cx, gy, T, W) {
      const w = Math.min(66, W - 8), x0 = Math.round(cx - w / 2);
      rect(c, x0 - 1, gy - 1, w + 2, 11, '#120d24');
      rect(c, x0, gy, w, 2, '#eef0fa'); rect(c, x0, gy + 2, w, 4, '#a6aacb'); rect(c, x0, gy + 6, w, 3, '#5d6088');
      for (let x = x0; x < x0 + w; x++) if (((x - x0) >> 2) % 2) rect(c, x, gy + 3, 1, 2, '#f4c03a');
      for (let x = x0 + 6; x < x0 + w - 6; x++) if (((x + (T >> 1)) % 4) < 3) px(c, x, gy, T % 60 < 30 ? '#9ff7ff' : '#5ad6f0');
      rect(c, x0 + 4, gy + 9, w - 8, 2, '#2c3058');
    },
  };
})();
