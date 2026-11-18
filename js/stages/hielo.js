'use strict';
// ============================================================
//  GLACIAR BOREAL — arena de hielo
//  Peculiaridad: el suelo es hielo pulido. Se frena y se acelera
//  mucho peor, así que los luchadores patinan.
// ============================================================
(() => {
  const ICE_RULES = { fric: 0.12, acc: 0.35 };     // frenado y aceleración sobre hielo
  const G = {
    main: Object.assign({ x1: 120, x2: 360, y: 182, bottom: 222 }, ICE_RULES),
    plats: [
      Object.assign({ x1: 140, x2: 204, y: 134 }, ICE_RULES),
      Object.assign({ x1: 276, x2: 340, y: 134 }, ICE_RULES),
      Object.assign({ x1: 208, x2: 272, y: 88 }, ICE_RULES),
    ],
  };

  const SKY = ['#04061a', '#060a22', '#09102d', '#0d1838', '#122244', '#182d52', '#1f3960', '#27466d', '#30547a', '#3b6286'];
  const ICE = ['#0b1b44', '#122d62', '#1b4482', '#275ea3', '#3a7cc2', '#5a9fde', '#86c4f0', '#b6e2fa', '#e6f8ff'];
  const SNOW = { hi: '#ffffff', a: '#eef7ff', b: '#cfe2f5', c: '#9fbade' };

  const put = (d, w, x, y, rgb) => { const k = (y * w + x) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255; };
  const dither = (pal, v, x, y) => {
    const f = clamp(v, 0, 0.999) * (pal.length - 1), i = Math.floor(f), fr = f - i;
    return pal[Math.min(pal.length - 1, fr > (BAYER[y & 3][x & 3] + 0.5) / 16 ? i + 1 : i)];
  };

  // ---------------- cielo, estrellas y luna ----------------
  function makeSky() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data, sky = SKY.map(hexRgb);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) put(d, W, xx, y, dither(sky, y / (H * 0.8), xx, y));
    x.putImageData(img, 0, 0);
    const r = rng(77);
    for (let i = 0; i < 190; i++) {
      const sx = r() * W | 0, sy = r() * r() * 170 | 0, big = r() < 0.07;
      px(x, sx, sy, r() < 0.3 ? '#bfe6ff' : r() < 0.6 ? '#e8f2ff' : '#ffffff');
      if (big) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px(x, sx + a, sy + b, '#4a6fa8');
    }
    // halo de la luna (transparencia en anillos)
    const mx = 92, my = 46, R = 15;
    glow(x, mx, my, 34, '#8fb4e8', 0.32, 6);
    // luna con sombra y cráteres
    const moon = ['#8fa6c9', '#b8cbe6', '#dbe7f6', '#f3f8ff'];
    for (let y = -R; y <= R; y++) for (let xx = -R; xx <= R; xx++) {
      if (xx * xx + y * y > R * R) continue;
      const nx = xx / R, ny = y / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const v = clamp(-nx * 0.55 - ny * 0.35 + nz * 0.7, 0, 1);
      px(x, mx + xx, my + y, dither(moon, v, mx + xx, my + y));
    }
    for (const [cx, cy, cr] of [[-5, -4, 3], [4, 3, 2], [-2, 7, 2], [6, -6, 1], [-8, 3, 1]]) {
      disc(x, mx + cx, my + cy, cr, '#b8cbe6'); px(x, mx + cx - 1, my + cy - 1, '#8fa6c9');
    }
    return c;
  }

  // ---------------- aurora boreal (capa animada) ----------------
  function makeAurora() {
    const AH = 150, c = mkCanvas(W, AH), x = c.getContext('2d');
    const curtain = (seed, base, amp, len, cols, strength, x0, x1) => {
      const r = rng(seed), p1 = r() * 9, p2 = r() * 9, p3 = r() * 9;
      for (let xx = x0; xx < x1; xx++) {
        const y0 = base + Math.sin(xx * 0.018 + p1) * amp + Math.sin(xx * 0.047 + p2) * amp * 0.5;
        const h = len + Math.sin(xx * 0.031 + p3) * len * 0.35;
        const fold = 0.55 + 0.45 * Math.sin(xx * 0.33 + Math.sin(xx * 0.05 + p1) * 3);       // pliegues verticales
        const edge = clamp(Math.min(xx - x0, x1 - xx) / 40, 0, 1);
        for (let y = Math.floor(y0); y < y0 + h; y++) {
          if (y < 0 || y >= AH) continue;
          const t = Math.max(0, (y - y0) / h);                    // 0 arriba · 1 borde inferior brillante
          const I = fold * Math.pow(t, 1.5) * strength * edge;
          if (I < 0.04) continue;
          const col = t > 0.9 ? cols[3] : t > 0.7 ? cols[2] : t > 0.4 ? cols[1] : cols[0];
          px(x, xx, y, col, Math.min(1, Math.round(I * 1.15 * 8) / 8));   // opacidad en 8 escalones (sigue siendo pixel art)
        }
      }
    };
    curtain(5, 26, 10, 60, ['#3b2f8c', '#6a4fd0', '#a77cf0', '#d9b8ff'], 0.7, 230, W);       // cortina violeta lejana
    curtain(11, 14, 13, 70, ['#145c63', '#1f9c8c', '#3df2b0', '#c8ffee'], 1.0, 0, 340);       // cortina verde principal
    return c;
  }

  // ---------------- montañas nevadas y mar helado ----------------
  function makeLand() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const range = (seed, base, n, hmin, hmax, body, lit, shade, snowL, snowS) => {
      const r = rng(seed), peaks = [];
      for (let i = 0; i < n; i++) peaks.push([r() * (W + 80) - 40, 30 + r() * 50, hmin + r() * (hmax - hmin)]);
      const hAt = xx => { let h = 0; for (const [pcx, pw, ph] of peaks) h = Math.max(h, ph * (1 - Math.abs(xx - pcx) / pw)); return h + Math.sin(xx * 0.3) * 0.8; };
      for (let xx = 0; xx < W; xx++) {
        const h = hAt(xx), top = Math.round(base - h), slope = hAt(xx + 1) - hAt(xx - 1);
        const litSide = slope > 0;                       // la luna está a la izquierda
        const snowLine = top + 3 + Math.round((Math.sin(xx * 0.9) + Math.sin(xx * 0.37)) * 1.5 + h * 0.18);
        for (let y = top; y < H; y++) {
          let col = litSide ? lit : shade;
          if (y > top + 2 && ((y + xx) & 1) && Math.abs(slope) < 0.6) col = body;
          if (h > hmin * 0.6 && y <= snowLine) col = litSide ? snowL : snowS;
          if (y > top + 24) col = body;
          px(x, xx, y, col);
        }
      }
    };
    range(3, 210, 9, 30, 70, '#1a2a58', '#2a3f75', '#16244d', '#dcebff', '#8ea9d4');
    range(9, 220, 7, 18, 40, '#121e45', '#1f3263', '#0f1a3c', '#c2d8f3', '#6f8cbc');
    // mar helado
    for (let y = 214; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const t = (y - 214) / (H - 214);
      let col = dither(['#2a4a80', '#1f3a6c', '#16305e', '#102650'], t, xx, y);
      // reflejo de la luna (columna vertical tramada)
      const dm = Math.abs(xx - 92 + Math.sin(y * 0.8) * 2);
      if (dm < 6 - t * 3 && (y % 3) && BAYER[y & 3][xx & 3] < 9) col = dm < 2 ? '#dbe7f6' : '#8fa6c9';
      // reflejo de la aurora
      if (xx < 330 && (y % 4 === 1) && BAYER[(y >> 2) & 3][xx & 3] < 3 && Math.sin(xx * 0.33) > 0.2) col = '#1f9c8c';
      px(x, xx, y, col);
    }
    rect(x, 0, 214, W, 1, '#4a6fa8');
    // témpanos flotantes
    const r = rng(19);
    for (let i = 0; i < 7; i++) {
      const fx = r() * W | 0, fy = 222 + r() * 40 | 0, fw = 8 + r() * 18 | 0;
      rect(x, fx, fy, fw, 2, '#5a83bf'); rect(x, fx + 1, fy, fw - 2, 1, '#9fc0e8'); rect(x, fx + 1, fy + 2, fw - 2, 1, '#0d2149');
    }
    return c;
  }

  // ---------------- la isla de hielo ----------------
  function makeGlacier() {
    const c = mkCanvas(W, H), x = c.getContext('2d');
    const M = G.main, r = rng(31), w = M.x2 - M.x1, cx = (M.x1 + M.x2) / 2;
    // forma: se estrecha hacia abajo y acaba en puntas de cristal
    const spikes = [];
    for (let i = 0; i < 14; i++) spikes.push([M.x1 + 8 + r() * (w - 16), 5 + r() * 9, 4 + r() * 5]);
    const bottom = xx => {
      const u = (xx + 0.5 - cx) / (w / 2), taper = Math.pow(Math.max(0, 1 - u * u), 0.7);
      let b = M.y + 9 + taper * 40 + Math.sin(xx * 0.17) * 2 * taper;
      for (const [sx, sh, sw] of spikes) b += Math.max(0, sh * taper * (1 - Math.abs(xx - sx) / sw));
      return Math.round(b);
    };
    // facetas: cada píxel pertenece a la "semilla" más cercana
    const seeds = [];
    for (let i = 0; i < 46; i++) seeds.push([M.x1 + r() * w, M.y + 3 + r() * 50, r()]);
    const owner = (xx, yy) => {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < seeds.length; i++) { const dx = xx - seeds[i][0], dy = (yy - seeds[i][1]) * 1.3, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bi = i; } }
      return bi;
    };
    const img = x.getImageData(0, 0, W, H), d = img.data, pal = ICE.map(hexRgb);
    for (let xx = M.x1; xx < M.x2; xx++) {
      const by = bottom(xx);
      for (let yy = M.y + 4; yy < by; yy++) {
        const o = owner(xx, yy), depth = (yy - M.y) / (by - M.y + 1);
        const light = 1 - depth * 0.85 - ((xx - M.x1) / w) * 0.2;
        let v = light * 0.7 + seeds[o][2] * 0.3;
        const edgeUp = owner(xx, yy - 1) !== o, edgeLeft = owner(xx - 1, yy) !== o, edgeDown = owner(xx, yy + 1) !== o;
        if (edgeUp || edgeLeft) v += 0.22;           // arista iluminada
        else if (edgeDown) v -= 0.12;
        put(d, W, xx, yy, dither(pal, v, xx, yy));
      }
    }
    x.putImageData(img, 0, 0);
    // burbujas y destellos dentro del hielo
    for (let i = 0; i < 26; i++) {
      const bx = M.x1 + 6 + r() * (w - 12) | 0, byy = M.y + 8 + r() * 30 | 0;
      if (byy >= bottom(bx) - 3) continue;
      if (r() < 0.5) px(x, bx, byy, '#e6f8ff'); else { px(x, bx, byy, '#b6e2fa'); px(x, bx + 1, byy - 1, '#ffffff'); }
    }
    // rocas atrapadas en el hielo
    // sombras borrosas de piedras atrapadas (tramadas, para que se vean "dentro" del hielo)
    for (const [rx, ry, rr] of [[cx - 52, M.y + 20, 3], [cx + 38, M.y + 26, 2], [cx - 6, M.y + 33, 3]]) {
      for (let yy = -rr; yy <= rr; yy++) for (let xx2 = -rr - 1; xx2 <= rr + 1; xx2++) {
        if (xx2 * xx2 / ((rr + 1) * (rr + 1)) + yy * yy / (rr * rr) > 1) continue;
        if ((xx2 + yy + rx) & 1) px(x, rx + xx2, ry + yy, '#122d62');
      }
      px(x, rx - 1, ry - rr, '#5a9fde');
    }
    // superficie de hielo pulido con destellos diagonales
    for (let xx = M.x1; xx < M.x2; xx++) {
      px(x, xx, M.y, xx % 2 ? '#ffffff' : '#e6f8ff');
      px(x, xx, M.y + 1, '#b6e2fa'); px(x, xx, M.y + 2, '#86c4f0'); px(x, xx, M.y + 3, '#5a9fde');
    }
    for (let gx = M.x1 + 14; gx < M.x2 - 8; gx += 22 + (r() * 10 | 0)) {
      for (let k = 0; k < 3; k++) { px(x, gx + k, M.y + 3 - k, '#ffffff'); px(x, gx + k + 1, M.y + 3 - k, '#e6f8ff'); }
    }
    // ventisqueros de nieve en los extremos y nieve que cae por los lados
    for (const side of [-1, 1]) {
      for (let k = 0; k < 30; k++) {
        const xx = side < 0 ? M.x1 + k : M.x2 - 1 - k;
        const hh = Math.round(Math.max(0, 3 - k / 9) + (k < 26 && Math.sin(k * 0.8) > 0.4 ? 1 : 0));
        for (let j = 1; j <= hh; j++) px(x, xx, M.y - j, j === hh ? SNOW.hi : SNOW.a);
        if (k < 18) { px(x, xx, M.y, SNOW.a); px(x, xx, M.y + 1, k < 10 ? SNOW.b : '#b6e2fa'); }
      }
      for (let j = 0; j < 9; j++) {
        const xx = side < 0 ? M.x1 + (j % 3) : M.x2 - 1 - (j % 3);
        px(x, xx, M.y + 2 + j, j % 4 === 3 ? SNOW.c : SNOW.b);
      }
    }
    // carámbanos colgando de la base
    const icicle = (ix, iy, len) => {
      for (let k = 0; k < len; k++) {
        const ww = Math.max(1, Math.round((1 - k / len) * 2));
        rect(x, ix - ww + 1, iy + k, ww, 1, '#86c4f0');
        rect(x, ix + 1, iy + k, ww, 1, '#e6f8ff');
      }
      px(x, ix, iy + len, '#ffffff');
    };
    for (const [sx, sh] of spikes) { const ix = Math.round(sx); icicle(ix, bottom(ix) - 1, 4 + (sh | 0)); }
    for (let i = 0; i < 12; i++) { const ix = M.x1 + 4 + r() * (w - 8) | 0; icicle(ix, bottom(ix) - 1, 2 + r() * 5 | 0); }
    // plataformas de hielo flotantes
    for (const p of G.plats) {
      for (let xx = p.x1; xx < p.x2; xx++) {
        px(x, xx, p.y, xx % 2 ? '#ffffff' : '#e6f8ff');
        rect(x, xx, p.y + 1, 1, 2, '#b6e2fa'); rect(x, xx, p.y + 3, 1, 2, '#5a9fde'); px(x, xx, p.y + 5, '#275ea3');
        if ((xx - p.x1) % 13 === 5) { px(x, xx, p.y + 2, '#ffffff'); px(x, xx + 1, p.y + 3, '#b6e2fa'); }   // facetas
      }
      for (let k = 0; k < 6; k++) { px(x, p.x1 + k, p.y - 1, SNOW.a); px(x, p.x2 - 1 - k, p.y - 1, SNOW.a); }
      px(x, p.x1 + 1, p.y - 2, SNOW.hi); px(x, p.x2 - 2, p.y - 2, SNOW.hi);
      for (let i = 0; i < 7; i++) icicle(p.x1 + 4 + Math.round(i * (p.x2 - p.x1 - 8) / 6), p.y + 5, 2 + ((i * 7 + 3) % 5));
    }
    return outlined(c, '#060a22');
  }

  defineStage({
    id: 'hielo',
    name: 'Glaciar Boreal',
    desc: 'Isla de hielo bajo la aurora. El suelo es hielo pulido: se patina al frenar y al arrancar.',
    rule: 'Suelo resbaloso',
    main: G.main,
    plats: G.plats,
    spawns: [[156, 1], [324, -1], [204, 1], [276, -1]],
    respawn: { x: 240, y: 46 },

    build() { return { sky: makeSky(), aurora: makeAurora(), land: makeLand(), stage: makeGlacier() }; },
    init(st) {
      const r = rng(5);
      st.flakes = [];
      for (let i = 0; i < 110; i++) st.flakes.push({ x: r() * W, y: r() * H, s: r() < 0.25 ? 2 : 1, v: 0.25 + r() * 0.6, ph: r() * 6 });
    },
    update(st, g) {
      const wind = Math.sin(st.t * 0.004) * 0.35 + 0.15;
      for (const f of st.flakes) {
        f.y += f.v * (f.s === 2 ? 1.4 : 1); f.x += wind * (f.s === 2 ? 1.5 : 1) + Math.sin(f.ph + st.t * 0.03) * 0.15;
        if (f.y > H) { f.y = -2; f.x = Math.random() * W; }
        if (f.x > W + 2) f.x = -2; if (f.x < -2) f.x = W + 2;
      }
      // chispas de hielo al patinar
      if (g.fighters) for (const f of g.fighters) {
        if (!f.grounded || !f.alive() || !f.plat || f.plat.fric == null) continue;
        const sliding = Math.abs(f.vx) > 1.1 && (Math.abs(f.inp.mx) < 0.3 || sgn(f.inp.mx) !== sgn(f.vx));
        if (sliding && st.t % 3 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: f.x - sgn(f.vx) * 3, y: f.y - 1, vx: -f.vx * 0.2, vy: -0.4, t: 0, life: 12, size: 1, col: '#e6f8ff' });
      }
    },
    renderBack(c, st) {
      const A = st.def.art;
      c.drawImage(A.sky, 0, 0);
      // la aurora "hace la ola": cada columna ondula y su opacidad sube y baja con un desfase,
      // así la luz recorre el cielo de lado a lado
      const t = st.t;
      for (let xx = 0; xx < W; xx += 2) {
        const dy = Math.round(Math.sin(t * 0.012 + xx * 0.021) * 3 + Math.sin(t * 0.007 + xx * 0.05) * 1.5);
        const wave = 0.5 + 0.5 * Math.sin(xx * 0.028 - t * 0.045);           // la ola principal
        const slow = 0.5 + 0.5 * Math.sin(xx * 0.009 + t * 0.013);           // respiración lenta
        const a = clamp(0.18 + 0.62 * wave * (0.55 + 0.45 * slow) + 0.2 * slow, 0, 1);
        c.globalAlpha = a;
        c.drawImage(A.aurora, xx, 0, 2, 150, xx, 4 + dy, 2, 150);
      }
      c.globalAlpha = 1;
      // reflejo suave de la aurora sobre el cielo
      glow(c, 150, 70, 90, '#3df2b0', 0.05 + 0.04 * Math.sin(t * 0.02), 4);
      c.drawImage(A.land, 0, 0);
    },
    renderFront(c, st) {
      for (const f of st.flakes) {
        const x = Math.round(f.x), y = Math.round(f.y);
        if (f.s === 2) { rect(c, x, y, 2, 2, '#eef7ff', 0.9); px(c, x, y, '#ffffff'); }
        else px(c, x, y, f.ph > 3 ? '#cfe2f5' : '#ffffff', 0.45 + (f.ph % 1) * 0.4);
      }
    },
  });
})();
