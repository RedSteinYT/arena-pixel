'use strict';
// ============================================================
//  FORTALEZA REDSTEIN — la arena del canal
//  Castillo negro y rojo sobre un mar de lava, con estandartes
//  de cuadros y el emblema "R".
//  Peculiaridad: GÉISERES DE FUEGO. Cada pocos segundos una rejilla
//  del suelo empieza a brillar y humear (aviso) y luego lanza una
//  columna de fuego que empuja hacia arriba y quema.
// ============================================================
(() => {
  const G = {
    main: { x1: 120, x2: 360, y: 182, bottom: 224 },
    plats: [
      { x1: 136, x2: 196, y: 134 },
      { x1: 284, x2: 344, y: 134 },
      { x1: 212, x2: 268, y: 90 },
    ],
  };
  const VENTS = [164, 240, 316];
  const LAVA_Y = 232;
  const SKY = ['#08030a', '#100510', '#1a0812', '#280c16', '#3a1018', '#52161c', '#6e1e1e', '#902a1e', '#b8401c', '#e0601a'];
  const STONE = ['#120c12', '#1e161e', '#2c222c', '#3c303c', '#504252', '#6a5a6a'];
  const PLAID = (x, y) => { x %= 5; y %= 5; const r = y < 2, c = x < 2; return r && c ? '#160810' : r || c ? '#a3161c' : '#e8302a'; };
  const put = (d, w, x, y, rgb) => { const k = (y * w + x) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255; };
  const dither = (pal, v, x, y) => {
    const f = clamp(v, 0, 0.999) * (pal.length - 1), i = Math.floor(f), fr = f - i;
    return pal[Math.min(pal.length - 1, fr > (BAYER[y & 3][x & 3] + 0.5) / 16 ? i + 1 : i)];
  };
  // estandarte de cuadros con la "R"
  function banner(c, x, y, w, h) {
    rect(c, x - 1, y - 1, w + 2, h + 4, '#060306');
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(c, x + xx, y + yy, PLAID(xx, yy));
    for (let xx = 0; xx < w; xx += 2) px(c, x + xx, y + h, PLAID(xx, h));               // borde en picos
    rect(c, x - 2, y - 2, w + 4, 2, '#5a3418'); px(c, x - 2, y - 2, '#ffd34a'); px(c, x + w + 1, y - 2, '#ffd34a');
    const cx = x + (w >> 1) - 3, cy = y + 4;
    rect(c, cx, cy, 7, 8, '#f4f4f8');
    const R = [0b111, 0b101, 0b110, 0b101, 0b101];
    R.forEach((row, ry) => { for (let b = 0; b < 3; b++) if (row & (4 >> b)) rect(c, cx + 1 + b * 2 - (b ? 1 : 0), cy + 1 + ry, b === 1 ? 1 : 2, 1, '#111018'); });
  }

  function makeSky() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data, sky = SKY.map(hexRgb);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const glow = Math.max(0, 1 - Math.hypot(xx - 392, (y - 170) * 1.4) / 200) * 0.18;     // resplandor del volcán
      put(d, W, xx, y, dither(sky, y / (H * 0.86) + glow, xx, y));
    }
    x.putImageData(img, 0, 0);
    const r = rng(13);
    for (let i = 0; i < 70; i++) { const sx = r() * W | 0, sy = r() * r() * 90 | 0; px(x, sx, sy, r() < 0.5 ? '#ffb0a0' : '#ffffff'); }
    // volcán al fondo
    for (let xx = 300; xx < W; xx++) {
      const h = Math.max(0, 70 - Math.abs(xx - 392) * 0.9) + Math.sin(xx * 0.3) * 1.5;
      const top = Math.round(206 - h);
      for (let y = top; y < H; y++) px(x, xx, y, y < top + 2 ? '#6e1e1e' : xx < 392 ? '#2a0c12' : '#1e080e');
      if (Math.abs(xx - 392) < 14 && h > 56) for (let y = top; y < top + 4; y++) px(x, xx, y, (xx + y) % 2 ? '#ff8a20' : '#ffd040');   // cráter
    }
    for (let k = 0; k < 40; k++) { const yy = 140 + k * 2, xx = 392 + Math.round(Math.sin(k * 0.6) * (k * 0.25)); px(x, xx, yy, k % 3 ? '#e0601a' : '#ff9a30'); }      // río de lava
    // castillo lejano
    const tower = (tx, tw, th, base) => {
      const top = base - th;
      rect(x, tx, top, tw, th + 40, '#16080e');
      for (let k = 0; k < tw; k += 4) rect(x, tx + k, top - 3, 2, 3, '#16080e');             // almenas
      rect(x, tx, top, 1, th, '#3a1018');
      for (let wy = top + 6; wy < base - 4; wy += 9) for (let wx = tx + 3; wx < tx + tw - 3; wx += 6) { rect(x, wx, wy, 2, 3, '#ff8a20'); px(x, wx, wy, '#ffd040'); }
    };
    rect(x, 30, 176, 230, 60, '#16080e');
    for (let k = 30; k < 260; k += 6) rect(x, k, 172, 3, 4, '#16080e');
    tower(40, 22, 58, 176); tower(110, 28, 82, 176); tower(200, 22, 60, 176);
    // estandartes colgando de las torres
    banner(x, 114, 108, 20, 28); banner(x, 44, 132, 14, 20); banner(x, 204, 130, 14, 20);
    return c;
  }

  function makeFortress() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const M = G.main;
    // muralla de piedra con ladrillos
    for (let y = M.y + 4; y < M.bottom + 2; y++) for (let xx = M.x1; xx < M.x2; xx++) {
      const row = Math.floor((y - M.y) / 6), off = row % 2 ? 6 : 0, bx = (xx - M.x1 + off) % 12, by = (y - M.y) % 6;
      let col;
      if (by === 5 || bx === 11) col = STONE[0];
      else if (by === 0) col = STONE[4];
      else col = dither(STONE, 0.72 - (y - M.y) / 90 - ((xx - M.x1) / (M.x2 - M.x1)) * 0.12 + (((row * 5 + Math.floor((xx - M.x1 + off) / 12) * 3) % 4) * 0.05), xx, y);
      px(x, xx, y, col);
    }
    // arcos y pilares que bajan hasta la lava
    for (const px0 of [M.x1 + 14, M.x1 + 76, M.x2 - 92, M.x2 - 30]) {
      for (let y = M.bottom; y < LAVA_Y + 6; y++) for (let xx = px0; xx < px0 + 16; xx++) px(x, xx, y, xx === px0 ? STONE[3] : xx > px0 + 12 ? STONE[0] : dither(STONE, 0.5 - (y - M.bottom) / 60, xx, y));
    }
    for (let a = 0; a < 3; a++) {                      // huecos en arco bajo la muralla
      const ax = M.x1 + 30 + a * 62 + (a > 1 ? 16 : 0);
      for (let k = -14; k <= 14; k++) { const hh = Math.round(Math.sqrt(196 - k * k) * 0.6); rect(x, ax + 16 + k, M.bottom - hh, 1, hh, '#0a0408'); }
    }
    // pasarela superior: losas con borde dorado
    for (let xx = M.x1; xx < M.x2; xx++) {
      px(x, xx, M.y, '#8a7a8a'); px(x, xx, M.y + 1, '#5a4a5a'); px(x, xx, M.y + 2, '#3c303c');
      px(x, xx, M.y + 3, (xx % 2) ? '#c8902a' : '#a87020');
      if ((xx - M.x1) % 16 === 0) { px(x, xx, M.y, '#4a3a4a'); px(x, xx, M.y + 1, '#2c222c'); }
    }
    // almenas en los extremos (solo decoración)
    for (const ex of [M.x1, M.x2 - 8]) { rect(x, ex, M.y - 6, 8, 6, STONE[3]); rect(x, ex, M.y - 6, 8, 1, STONE[5]); rect(x, ex + 7, M.y - 5, 1, 5, STONE[1]); }
    // rejillas de los géiseres
    for (const v of VENTS) { rect(x, v - 7, M.y, 14, 3, '#0a0408'); for (let k = -6; k < 7; k += 3) rect(x, v + k, M.y, 1, 3, '#4a3a4a'); }
    // estandartes bajo la muralla
    banner(x, M.x1 + 44, M.y + 8, 14, 22); banner(x, M.x2 - 58, M.y + 8, 14, 22);
    // soportes de antorchas
    for (const tx of [M.x1 + 6, M.x2 - 7, 200, 280]) { rect(x, tx, M.y + 10, 2, 6, '#3a2418'); rect(x, tx - 1, M.y + 9, 4, 2, '#5a3418'); }
    // soportes: los balcones laterales se apoyan en la muralla; el superior cuelga con cadenas
    for (const p of G.plats.slice(0, 2)) {
      for (const sx of [p.x1 + 3, p.x2 - 5]) {
        rect(x, sx, p.y + 4, 2, M.y - p.y - 4, '#4a2a14'); rect(x, sx, p.y + 4, 1, M.y - p.y - 4, '#8a5428');
        rect(x, sx - 1, M.y - 3, 4, 3, '#3a2418');
      }
      pline(x, p.x1 + 4, p.y + 16, p.x1 + 14, p.y + 5, 1, '#6b4024'); pline(x, p.x2 - 6, p.y + 16, p.x2 - 16, p.y + 5, 1, '#6b4024');
    }
    { const p = G.plats[2];
      for (const cx of [p.x1 + 3, p.x2 - 4]) for (let y = 0; y < p.y; y++) px(x, cx, y, (y >> 1) % 2 ? '#8a7a8a' : '#3c303c'); }
    // balcones de madera con tela de cuadros
    for (const p of G.plats) {
      for (let xx = p.x1; xx < p.x2; xx++) { px(x, xx, p.y, '#c88a48'); rect(x, xx, p.y + 1, 1, 2, '#8a5428'); px(x, xx, p.y + 3, '#4a2a14'); if ((xx - p.x1) % 8 === 0) rect(x, xx, p.y + 1, 1, 3, '#4a2a14'); }
      const w = p.x2 - p.x1;
      for (let yy = 0; yy < 8; yy++) for (let xx = 4; xx < w - 4; xx++) { const drop = Math.round(Math.sin((xx - 4) / (w - 8) * Math.PI) * 4); if (yy < 4 + drop) px(x, p.x1 + xx, p.y + 4 + yy, PLAID(xx, yy)); }
      rect(x, p.x1 + 1, p.y + 4, 2, 10, '#3a2418'); rect(x, p.x2 - 3, p.y + 4, 2, 10, '#3a2418');
    }
    return outlined(c, '#060306');
  }

  // lava animada: 16 fotogramas que enlazan sin cortes (fases múltiplos de 2π)
  function makeLava() {
    const N = 16, LH = H - LAVA_Y, frames = [];
    const pal = ['#5a1014', '#a8241a', '#e04818', '#ff8a20', '#ffd040'].map(hexRgb), dark = hexRgb('#6e1a16');
    for (let k = 0; k < N; k++) {
      const cv = mkCanvas(W, LH), x = cv.getContext('2d'), img = x.createImageData(W, LH), d = img.data;
      const ph = k / N * Math.PI * 2;
      for (let y = 0; y < LH; y++) {
        const dd = y / LH;
        for (let xx = 0; xx < W; xx++) {
          const wave = Math.sin(xx * 0.08 + ph + y * 0.4) + Math.sin(xx * 0.21 - ph * 2);
          const v = 0.95 - dd * 0.75 + wave * 0.12;
          const col = v > 0.9 ? pal[4] : v > 0.7 ? pal[3] : v > 0.48 ? pal[2] : v > 0.3 ? pal[1] : pal[0];
          put(d, W, xx, y, (((xx + y) & 1) === 0 || v > 0.7) ? col : dark);
        }
      }
      x.putImageData(img, 0, 0);
      frames.push(cv);
    }
    return frames;
  }

  // estado de los géiseres
  const hazard = { landedHit: false, t: 0, dealt: 0, hitlag: 0, kos: 0, dir: 1, pal: { light: '#ffb040', main: '#ff6a20' } };

  defineStage({
    id: 'fortaleza',
    name: 'Fortaleza RedStein',
    desc: 'El castillo del canal sobre un mar de lava. Las rejillas del suelo avisan con humo antes de lanzar géiseres de fuego.',
    rule: 'Géiseres de fuego',
    main: G.main,
    plats: G.plats,
    spawns: [[150, 1], [330, -1], [200, 1], [280, -1]],
    respawn: { x: 240, y: 48 },

    build() { return { sky: makeSky(), stage: makeFortress(), lava: makeLava() }; },
    init(st) {
      st.gey = { state: 'idle', t: 0, vent: 1, wait: 300, hit: new Set() };
      const r = rng(21);
      st.embers = [];
      for (let i = 0; i < 40; i++) st.embers.push({ x: r() * W, y: r() * H, v: 0.2 + r() * 0.5, ph: r() * 6 });
    },
    update(st, g) {
      const Gy = st.gey; Gy.t++;
      const M = st.main, vx = VENTS[Gy.vent];
      if (Gy.state === 'idle' && Gy.t > Gy.wait) { Gy.state = 'warn'; Gy.t = 0; Gy.vent = Math.random() * VENTS.length | 0; }
      else if (Gy.state === 'warn') {
        if (Gy.t % 6 === 0 && g.burst) g.burst(VENTS[Gy.vent], M.y - 1, 1, 'smoke');
        if (Gy.t > 80 && g.shake !== undefined) g.shake = Math.max(g.shake, 1);
        if (Gy.t >= 90) { Gy.state = 'erupt'; Gy.t = 0; Gy.hit = new Set(); if (g.fighters) Sfx.hit(12); }
      } else if (Gy.state === 'erupt') {
        if (g.burst) for (let i = 0; i < 4; i++) g.burst(vx + (Math.random() * 12 - 6), M.y - Math.random() * 78, 1, 'fire');
        // la columna de fuego golpea a quien esté dentro
        if (g.fighters) for (const f of g.fighters) {
          if (!f.alive() || f.st === 'respawn' || f.invuln > 0 || Gy.hit.has(f)) continue;
          if (Math.abs(f.x - vx) < 8 + f.S.hw && f.y > M.y - 80 && f.y - f.S.hh < M.y) {
            Gy.hit.add(f); hazard.hitSet = new Set();
            g.applyHit(hazard, f, { d: 9, b: 3.6, g: 4.6, ang: 88, burn: 90 }, sgn(f.x - vx) || 1, 1, f.x, f.y - f.S.hh / 2);
          }
        }
        if (Gy.t >= 45) { Gy.state = 'idle'; Gy.t = 0; Gy.wait = 300 + (Math.random() * 180 | 0); }
      }
      for (const e of st.embers) { e.y -= e.v; e.x += Math.sin(e.ph + st.t * 0.03) * 0.3; if (e.y < -2) { e.y = H; e.x = Math.random() * W; } }
    },
    renderBack(c, st, g) {
      c.drawImage(st.def.art.sky, 0, 0);
      const t = st.t;
      glow(c, 392, 150, 60, '#ff6a20', 0.16 + 0.06 * Math.sin(t * 0.03), 5);      // resplandor del volcán
      // humo y chispas del volcán
      for (let i = 0; i < 8; i++) { const y = 132 - ((t * 0.3 + i * 12) % 70), xx = 392 + Math.sin(t * 0.02 + i) * (8 + (132 - y) * 0.2); disc(c, xx, y, 3 + ((132 - y) / 20 | 0), i % 2 ? '#2a1018' : '#3a141c'); }
      for (let i = 0; i < 5; i++) { const k = (t * 1.3 + i * 30) % 60; px(c, Math.round(392 + Math.cos(i * 1.7) * k * 0.6), Math.round(136 - k + k * k * 0.012), '#ffb040'); }
      // mar de lava (16 fotogramas pintados al cargar, en bucle)
      const L = st.def.art.lava;
      c.drawImage(L[(t >> 2) % L.length], 0, LAVA_Y);
      for (let i = 0; i < 6; i++) {                       // burbujas que revientan
        const k = (t + i * 47) % 90, bx = (i * 83 + 31) % W;
        if (k < 20) { const r = k < 12 ? 1 + (k >> 2) : 0; if (r) ring(c, bx, LAVA_Y + 6 + (i % 3) * 8, r, '#ffd040'); else px(c, bx, LAVA_Y + 4, '#fff3b0'); }
      }
      rect(c, 0, LAVA_Y, W, 1, '#ffd040');
      for (let k = 1; k < 18; k++) rect(c, 0, LAVA_Y - k, W, 1, '#ff6a20', 0.22 * Math.pow(1 - k / 18, 2) * (0.85 + 0.15 * Math.sin(t * 0.05 + k)));   // calor de la lava
    },
    renderMid(c, st, g) {
      const M = st.main, Gy = st.gey, frame = g.frame || st.t;
      // antorchas
      for (const tx of [M.x1 + 6, M.x2 - 7, 200, 280]) {
        const fl = (frame >> 2) % 3;
        glow(c, tx + 1, M.y + 6, 9 + (fl === 1 ? 1 : 0), '#ff9a30', 0.28, 3);
        px(c, tx, M.y + 7, '#ffd040'); px(c, tx + 1, M.y + 7, '#ff8a20'); px(c, tx + (fl ? 0 : 1), M.y + 6 - (fl === 2 ? 1 : 0), '#fff3b0');
        px(c, tx + 1, M.y + 5 - fl % 2, '#ff7a20');
      }
      // aviso: la rejilla brilla
      const vx = VENTS[Gy.vent];
      if (Gy.state === 'warn') glow(c, vx, M.y, 6 + Gy.t / 10, '#ff6a20', 0.12 + Gy.t / 300, 3);
      if (Gy.state === 'warn' && (Gy.t >> 3) % 2) { rect(c, vx - 6, M.y, 13, 2, Gy.t > 60 ? '#ffd040' : '#ff7a20'); for (let k = 0; k < 4; k++) px(c, vx - 5 + k * 4, M.y - 1, '#ffb040'); }
      // erupción: columna de fuego
      if (Gy.state === 'erupt') {
        const h = Math.min(80, Gy.t * 10) - Math.max(0, Gy.t - 35) * 7;
        for (let y = 0; y < h; y += 8) glow(c, vx, M.y - y, 16, '#ff7a20', 0.14, 3);
        for (let y = 0; y < h; y++) {
          const wob = Math.round(Math.sin(y * 0.35 + frame * 0.5) * 2), w = 6 + Math.round(Math.sin(y * 0.2 + frame * 0.3) * 1.5);
          const yy = M.y - y;
          rect(c, vx - w - 1 + wob, yy, w * 2 + 2, 1, '#a8241a');
          rect(c, vx - w + wob, yy, w * 2, 1, '#ff7a20');
          rect(c, vx - Math.round(w * 0.5) + wob, yy, w, 1, y % 3 ? '#ffd040' : '#fff3b0');
        }
      }
    },
    renderFront(c, st) {
      for (const e of st.embers) { px(c, Math.round(e.x), Math.round(e.y), e.ph > 3 ? '#ffb040' : '#ff6a20', 0.5 + 0.5 * Math.sin(e.ph * 3 + st.t * 0.1)); }
    },
  });
})();
