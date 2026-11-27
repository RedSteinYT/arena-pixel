'use strict';
// ============================================================
//  TEMPLO DEL EQUILIBRIO — arena de la balanza
//  Peculiaridad: los dos platos de la balanza cuelgan del mismo
//  brazo. El plato con más PESO encima baja y el otro sube.
//  El peso de cada luchador está en sus stats (weight):
//  Coloso 230 · Bloque 140 · Maniquí 100 · Runa 86 · Brisa 78
// ============================================================
(() => {
  const PIVOT = { x: 240, y: 72 }, ARM = 96, BASE_Y = 150, MAX_D = 40;
  const G = {
    main: { x1: 204, x2: 276, y: 176, bottom: H + 160 },           // pedestal: la zona firme
    plats: [
      { x1: 104, x2: 184, y: BASE_Y, pan: -1 },                    // plato izquierdo
      { x1: 296, x2: 376, y: BASE_Y, pan: 1 },                     // plato derecho
      { x1: 222, x2: 258, y: 54 },                                 // corona sobre el eje
    ],
  };

  const SKY = ['#1e1036', '#2a1444', '#3a1a50', '#512058', '#6c275c', '#8b305d', '#ad3d5c', '#cc4f59', '#e46a57', '#f28c58', '#f9ae60', '#fdd07a'];
  const MARBLE = { hi: '#fff8ee', l: '#efe3d6', m: '#d9c9ba', d: '#b3a194', dd: '#857467', vein: '#c9b4a6' };
  const GOLD = { hi: '#fff3b8', l: '#ffd96a', m: '#e6ac3c', d: '#b07a2a', dd: '#7a4c1e' };
  const put = (d, w, x, y, rgb) => { const k = (y * w + x) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255; };
  const dither = (pal, v, x, y) => {
    const f = clamp(v, 0, 0.999) * (pal.length - 1), i = Math.floor(f), fr = f - i;
    return pal[Math.min(pal.length - 1, fr > (BAYER[y & 3][x & 3] + 0.5) / 16 ? i + 1 : i)];
  };

  // ---------------- cielo del atardecer, sol y mesetas ----------------
  function makeSky() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data, sky = SKY.map(hexRgb);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const glow = Math.max(0, 1 - Math.hypot(xx - 240, (y - 186) * 1.6) / 260) * 0.12;   // resplandor alrededor del sol
      put(d, W, xx, y, dither(sky, y / (H * 0.84) + glow, xx, y));
    }
    x.putImageData(img, 0, 0);
    const r = rng(23);
    for (let i = 0; i < 60; i++) { const sx = r() * W | 0, sy = r() * r() * 70 | 0; px(x, sx, sy, r() < 0.5 ? '#ffd6f0' : '#ffffff'); }
    // sol con franjas
    const SX = 240, SY = 184, SR = 52;
    const sunCols = ['#ff5f6d', '#ff7b62', '#ff9a5e', '#ffbd62', '#ffdb7c', '#fff1b4'];
    for (let y = -SR; y <= SR; y++) {
      const t = (y + SR) / (SR * 2);
      // huecos horizontales cada vez más anchos hacia abajo
      if (t > 0.5) { const band = (y + SR) % 9, gap = Math.floor((t - 0.5) * 9); if (band < gap) continue; }
      const hw = Math.floor(Math.sqrt(SR * SR - y * y));
      for (let xx = -hw; xx <= hw; xx++) px(x, SX + xx, SY + y, dither(sunCols, 1 - t * 1.05, SX + xx, SY + y));
    }
    // mesetas lejanas con luz de contorno
    const mesas = [[0, 70, 176], [52, 120, 190], [150, 60, 184], [300, 90, 186], [370, 120, 172], [430, 60, 190]];
    for (const [mx, mw, top] of mesas) {
      for (let xx = mx; xx < mx + mw; xx++) {
        const e = Math.min(xx - mx, mx + mw - xx), slope = e < 10 ? (10 - e) * 1.4 : 0;
        const ty = Math.round(top + slope + Math.sin(xx * 0.4) * 0.8);
        for (let y = ty; y < H; y++) px(x, xx, y, y > ty + 30 ? '#3a1645' : '#4a1d50');
        px(x, xx, ty, '#f28c58'); px(x, xx, ty + 1, '#ad3d5c');
        const facingSun = (xx < 240 && e === mx + mw - xx && e < 10) || (xx > 240 && e === xx - mx && e < 10);
        if (facingSun) for (let k = 0; k < 6; k++) px(x, xx, ty + 2 + k, k < 3 ? '#cc4f59' : '#6c275c');
      }
    }
    // columnas en ruinas sobre las mesetas
    for (const [cx0, top, hh, broken] of [[78, 190, 22, false], [92, 190, 14, true], [170, 184, 18, false], [330, 186, 20, true], [404, 172, 26, false], [418, 172, 18, false]]) {
      rect(x, cx0 - 2, top - hh, 5, hh, '#3a1645');
      rect(x, cx0 - 3, top - hh - 2, 7, 2, '#3a1645');
      if (broken) rect(x, cx0 + 1, top - hh - 3, 3, 1, '#3a1645');
      px(x, cx0 + (cx0 < 240 ? 2 : -2), top - hh, '#cc4f59');
      for (let k = 0; k < hh; k += 2) px(x, cx0 + (cx0 < 240 ? 2 : -2), top - hh + k, '#8b305d');
    }
    // aves a lo lejos
    for (const [bx, by] of [[120, 60], [128, 56], [134, 63], [352, 44], [360, 48]]) { px(x, bx - 1, by, '#2a1444'); px(x, bx, by + 1, '#2a1444'); px(x, bx + 1, by, '#2a1444'); }
    return c;
  }

  // ---------------- pedestal de mármol, poste y eje (estático) ----------------
  function makeTemple() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const M = G.main;
    // fuste del pedestal con estrías
    const sx1 = 214, sx2 = 266;
    for (let xx = sx1; xx < sx2; xx++) for (let y = M.y + 10; y < H; y++) {
      const u = (xx - sx1) / (sx2 - sx1), k = (xx - sx1) % 7;
      let v = 0.85 - u * 0.55 - ((y - M.y) / (H - M.y)) * 0.25;
      if (k === 0) v -= 0.25; else if (k === 1) v += 0.15;        // estrías
      px(x, xx, y, dither([MARBLE.dd, MARBLE.d, MARBLE.m, MARBLE.l, MARBLE.hi], v, xx, y));
    }
    // vetas y grietas del mármol
    const r = rng(61);
    for (let i = 0; i < 8; i++) {
      let vx = sx1 + 4 + r() * 44, vy = M.y + 16 + r() * 50;
      for (let k = 0; k < 10; k++) { px(x, Math.round(vx), Math.round(vy), MARBLE.vein); vx += r() - 0.5; vy += 1; }
    }
    // collarín dorado
    rect(x, sx1 - 1, M.y + 10, sx2 - sx1 + 2, 3, GOLD.m); rect(x, sx1 - 1, M.y + 10, sx2 - sx1 + 2, 1, GOLD.hi); rect(x, sx1 - 1, M.y + 12, sx2 - sx1 + 2, 1, GOLD.d);
    // capitel: losa superior (el suelo) con volutas en las esquinas
    for (let xx = M.x1; xx < M.x2; xx++) {
      px(x, xx, M.y, MARBLE.hi); px(x, xx, M.y + 1, MARBLE.l);
      rect(x, xx, M.y + 2, 1, 2, MARBLE.m);
      px(x, xx, M.y + 4, GOLD.l); px(x, xx, M.y + 5, GOLD.d);
      rect(x, xx, M.y + 6, 1, 3, xx < 240 ? MARBLE.m : MARBLE.d);
      px(x, xx, M.y + 9, MARBLE.dd);
    }
    for (let xx = M.x1 + 10; xx < M.x2 - 10; xx += 8) { px(x, xx, M.y + 7, MARBLE.dd); px(x, xx + 1, M.y + 7, MARBLE.hi); }  // dentículos
    const volute = (vx, dir) => {
      ring(x, vx, M.y + 8, 4, MARBLE.d); disc(x, vx, M.y + 8, 2, MARBLE.l); px(x, vx, M.y + 8, GOLD.m);
      px(x, vx + dir * 2, M.y + 6, MARBLE.hi);
    };
    volute(M.x1 + 3, 1); volute(M.x2 - 4, -1);
    // poste de bronce desde el suelo hasta el eje
    for (let y = PIVOT.y + 6; y < M.y; y++) {
      px(x, 238, y, GOLD.l); px(x, 239, y, GOLD.m); px(x, 240, y, GOLD.m); px(x, 241, y, GOLD.d);
      if ((y - PIVOT.y) % 18 === 12) { rect(x, 236, y, 8, 2, GOLD.m); rect(x, 236, y, 8, 1, GOLD.hi); }
    }
    rect(x, 232, M.y - 3, 16, 3, GOLD.d); rect(x, 233, M.y - 4, 14, 1, GOLD.l);             // base del poste
    // corona (plataforma superior)
    const P = G.plats[2];
    for (let xx = P.x1; xx < P.x2; xx++) { px(x, xx, P.y, GOLD.hi); rect(x, xx, P.y + 1, 1, 2, GOLD.m); px(x, xx, P.y + 3, GOLD.d); }
    for (let k = 0; k < 5; k++) { const ww = 12 - k * 2; rect(x, 240 - ww, P.y + 4 + k, ww * 2, 1, k % 2 ? GOLD.d : GOLD.m); }
    for (const sx of [P.x1, P.x2 - 3]) { rect(x, sx, P.y - 4, 3, 4, GOLD.m); px(x, sx + 1, P.y - 5, GOLD.hi); }          // pináculos
    rect(x, 239, P.y + 9, 2, PIVOT.y - P.y - 9, GOLD.d);
    return outlined(c, '#1a0c24');
  }

  // ---------------- parte móvil: brazo, cadenas y platos ----------------
  function chain(c, x0, y0, x1, y1) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, xx = Math.round(lerp(x0, x1, t)), yy = Math.round(lerp(y0, y1, t));
      px(c, xx, yy, i % 2 ? GOLD.l : GOLD.dd);
    }
  }
  function pan(c, p, frame, heavy) {
    const w = p.x2 - p.x1, x0 = p.x1, y = Math.round(p.y);
    // cuenco: filas que se estrechan hacia abajo
    const rows = [[0, GOLD.hi], [0, GOLD.l], [2, GOLD.m], [4, GOLD.m], [7, GOLD.d], [11, GOLD.d], [16, GOLD.dd]];
    rows.forEach(([inset, col], k) => {
      rect(c, x0 + inset - 1, y + k, w - inset * 2 + 2, 1, '#1a0c24');                  // contorno
    });
    rect(c, x0 + 15, y + rows.length, w - 30, 1, '#1a0c24');
    rows.forEach(([inset, col], k) => {
      const xa = x0 + inset, wa = w - inset * 2;
      rect(c, xa, y + k, wa, 1, col);
      if (k >= 2) { rect(c, xa, y + k, 3, 1, GOLD.l); rect(c, xa + wa - 3, y + k, 3, 1, GOLD.dd); }
    });
    for (let xx = x0 + 8; xx < x0 + w - 8; xx += 6) px(c, xx, y + 3, GOLD.dd);           // grabado
    // gema colgante (brilla cuando ese plato carga más peso)
    const gx = x0 + (w >> 1), gy = y + rows.length + 2;
    pline(c, gx, y + rows.length, gx, gy, 1, GOLD.d);
    disc(c, gx, gy + 2, 2, '#1a0c24'); disc(c, gx, gy + 2, 1, heavy ? '#ff5f6d' : '#7a2a5c');
    if (heavy && (frame >> 3) % 2) px(c, gx - 1, gy + 1, '#ffffff');
  }

  defineStage({
    id: 'balanza',
    name: 'Templo del Equilibrio',
    desc: 'Una balanza gigante: el plato con más peso encima baja y el otro sube. Coloso hunde su lado; Brisa apenas lo mueve.',
    rule: 'Platos que se mueven con el peso',
    main: G.main,
    plats: G.plats,
    spawns: [[144, 1, BASE_Y], [336, -1, BASE_Y], [224, 1], [256, -1]],
    respawn: { x: 240, y: 30 },

    build() {
      return {
        sky: makeSky(),
        cloudsBack: makeClouds(41, 214, ['#6c275c', '#a1426a', '#d76a78', '#ffb29a'], 80, 16),
        cloudsFront: makeClouds(47, 252, ['#7a2f62', '#b8546f', '#e8848a', '#ffc6a8'], 60, 8),
        stage: makeTemple(),
      };
    },
    init(st) {
      st.bal = { d: 0, v: 0, wl: 0, wr: 0, max: MAX_D, force: null, pivot: PIVOT, arm: ARM };   // force: la mueve un evento
      st.L = st.plats[0]; st.R = st.plats[1];
      const r = rng(9);
      st.motes = [];
      for (let i = 0; i < 40; i++) st.motes.push({ x: r() * W, y: r() * H, v: 0.1 + r() * 0.25, ph: r() * 6 });
    },
    update(st, g) {
      const B = st.bal;
      // peso sobre cada plato (solo cuenta quien está de pie encima)
      let wl = 0, wr = 0;
      if (g.fighters) for (const f of g.fighters) {
        if (!f.alive() || !f.grounded) continue;
        if (f.plat === st.L) wl += f.S.weight; else if (f.plat === st.R) wr += f.S.weight;
      }
      B.wl = wl; B.wr = wr;
      const diff = wl - wr;
      const F = B.force;                                              // ¡BALANZA ENLOQUECIDA!: manda el evento, no el peso
      const target = F != null ? F : diff === 0 ? 0 : sgn(diff) * Math.min(MAX_D - 2, 10 + Math.abs(diff) * 0.12);
      // muelle amortiguado: se mueve con inercia, como una balanza pesada (enloquecida: mucho más rápida)
      B.v += (target - B.d) * (F != null ? 0.06 : 0.015);
      B.v *= 0.88;
      B.d += B.v;
      if (Math.abs(B.d) > MAX_D) { B.d = sgn(B.d) * MAX_D; if (Math.abs(B.v) > 0.5 && g.shake !== undefined) { g.shake = Math.max(g.shake, 2); Sfx.land(); } B.v = 0; }
      st.L.y = BASE_Y + B.d; st.R.y = BASE_Y - B.d;
      for (const m of st.motes) {
        m.y -= m.v; m.x += Math.sin(m.ph + st.t * 0.02) * 0.2;
        if (m.y < -2) { m.y = H + 2; m.x = Math.random() * W; }
      }
    },
    renderBack(c, st, g) {
      const A = st.def.art;
      c.drawImage(A.sky, 0, 0);
      glow(c, 240, 184, 90, '#ffb070', 0.14 + 0.03 * Math.sin(st.t * 0.02), 5);
      const cx = Math.round(g.cloudX * 0.8) % (W * 2);
      c.drawImage(A.cloudsBack, -cx, 0); c.drawImage(A.cloudsBack, W * 2 - cx, 0);
    },
    renderMid(c, st, g) {
      const d = st.bal.d, frame = g.frame || 0;
      const lx = PIVOT.x - ARM, ly = PIVOT.y + d, rx = PIVOT.x + ARM, ry = PIVOT.y - d;
      // cadenas (tres por plato, se abren hacia el borde)
      for (const [ex, ey, p] of [[lx, ly, st.L], [rx, ry, st.R]]) {
        for (const tx of [p.x1 + 5, (p.x1 + p.x2) / 2, p.x2 - 5]) chain(c, ex, ey + 3, tx, p.y - 1);
      }
      // brazo de bronce
      pline(c, lx, ly + 1, rx, ry + 1, 6, '#1a0c24');
      pline(c, lx, ly, rx, ry, 4, GOLD.d);
      pline(c, lx, ly - 1, rx, ry - 1, 2, GOLD.m);
      pline(c, lx + 4, ly - 2 + (d > 0 ? 0 : 0), rx - 4, ry - 2, 1, GOLD.hi);
      for (const [ex, ey] of [[lx, ly], [rx, ry]]) {
        disc(c, ex, ey, 5, '#1a0c24'); disc(c, ex, ey, 4, GOLD.m); disc(c, ex - 1, ey - 1, 2, GOLD.hi); px(c, ex, ey, GOLD.dd);
      }
      // eje: disco solar con gema
      disc(c, PIVOT.x, PIVOT.y, 8, '#1a0c24');
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; px(c, Math.round(PIVOT.x + Math.cos(a) * 9), Math.round(PIVOT.y + Math.sin(a) * 9), GOLD.l); }
      disc(c, PIVOT.x, PIVOT.y, 7, GOLD.d); disc(c, PIVOT.x, PIVOT.y, 6, GOLD.m); disc(c, PIVOT.x - 1, PIVOT.y - 1, 3, GOLD.l);
      disc(c, PIVOT.x, PIVOT.y, 2, '#ff5f6d'); px(c, PIVOT.x - 1, PIVOT.y - 1, '#ffffff');
      // platos
      pan(c, st.L, frame, st.bal.wl > st.bal.wr);
      pan(c, st.R, frame, st.bal.wr > st.bal.wl);
    },
    renderFront(c, st, g) {
      for (const m of st.motes) {
        const on = (Math.floor(m.ph * 10 + st.t * 0.05) % 3) !== 0;
        if (on) px(c, Math.round(m.x), Math.round(m.y), m.ph > 3 ? '#fff1b4' : '#ffd27a');
      }
      const A = st.def.art, fcx = Math.round(g.cloudX * 2) % (W * 2);
      c.drawImage(A.cloudsFront, -fcx, 0); c.drawImage(A.cloudsFront, W * 2 - fcx, 0);
    },
  });
})();
