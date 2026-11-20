'use strict';
// ============================================================
//  Arte pixel: todo se dibuja a resolución interna (480x270)
//  con primitivas de píxel (sin antialiasing) y se escala x N.
// ============================================================

const OUTLINE = '#120d24';
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const METAL = { l: '#f1f2fb', m: '#bcc0da', d: '#8084aa', dd: '#4f5180' };

function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  return c;
}

// ---------- primitivas ----------
function withAlpha(c, a, fn) { if (a === undefined || a >= 1) return fn(); if (a <= 0) return; const p = c.globalAlpha; c.globalAlpha = p * a; fn(); c.globalAlpha = p; }
function px(c, x, y, col, a) { withAlpha(c, a, () => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); }); }
function rect(c, x, y, w, h, col, a) { withAlpha(c, a, () => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }); }
function pline(c, x0, y0, x1, y1, w, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  c.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, o = (w - 1) >> 1;
  for (let i = 0; i < 200; i++) {
    c.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(c, cx, cy, r, col, a) {
  withAlpha(c, a, () => {
    c.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -r; y <= r; y++) {
      const hw = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
      c.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
  });
}
// brillo pixelado: anillos escalonados de transparencia (más opaco en el centro)
function glow(c, cx, cy, r, col, a = 0.4, steps = 4) {
  r = Math.round(r);
  for (let i = steps; i >= 1; i--) disc(c, cx, cy, Math.max(1, Math.round(r * i / steps)), col, a / steps);
}
// sombra ovalada en el suelo
function shadow(c, cx, cy, w, a = 0.35) {
  cx = Math.round(cx); cy = Math.round(cy);
  const h = Math.max(1, Math.round(w * 0.18));
  withAlpha(c, a, () => {
    c.fillStyle = '#05030c';
    for (let y = -h; y <= h; y++) { const hw = Math.round(w * Math.sqrt(Math.max(0, 1 - (y * y) / (h * h + 0.5)))); c.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  });
}
function ring(c, cx, cy, r, col) {
  c.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  const steps = Math.max(12, Math.ceil(r * 7));
  for (let i = 0; i < steps; i++) {
    const a = i / steps * Math.PI * 2;
    c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}
// contorno de 1 píxel alrededor de lo opaco
function outlined(src, col = OUTLINE) {
  const o = mkCanvas(src.width, src.height), x = o.getContext('2d');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(src, dx, dy);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, o.width, o.height);
  x.globalCompositeOperation = 'source-over'; x.drawImage(src, 0, 0);
  return o;
}

// ============================================================
//  Fondo (se genera una vez)
// ============================================================
const SKY = ['#0b0a24', '#121340', '#1b1d5a', '#272a75', '#383889', '#4e4596', '#6c519f', '#8f5d9f', '#b56b98', '#d97e8f', '#f29d86'];

function makeBackground() {
  const c = mkCanvas(W, H), x = c.getContext('2d');
  const img = x.createImageData(W, H), d = img.data;
  const sky = SKY.map(hexRgb), n = sky.length;
  for (let y = 0; y < H; y++) {
    const f = clamp(y / (H * 0.8), 0, 1) * (n - 1), i = Math.floor(f), fr = f - i;
    for (let xx = 0; xx < W; xx++) {
      const thr = (BAYER[y & 3][xx & 3] + 0.5) / 16;
      const col = sky[Math.min(n - 1, fr > thr ? i + 1 : i)];
      const k = (y * W + xx) * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const r = rng(7);
  // estrellas
  for (let i = 0; i < 170; i++) {
    const sx = r() * W | 0, sy = r() * r() * 150 | 0;
    const big = r() < 0.08;
    const col = r() < 0.3 ? '#b9b4ff' : r() < 0.5 ? '#ffe6c8' : '#ffffff';
    px(x, sx, sy, col);
    if (big) { px(x, sx - 1, sy, '#6d68c8'); px(x, sx + 1, sy, '#6d68c8'); px(x, sx, sy - 1, '#6d68c8'); px(x, sx, sy + 1, '#6d68c8'); }
  }
  drawPlanet(x, 384, 58, 28);
  // montañas lejanas (dos capas)
  ridge(x, 196, 34, ['#3a2f7a', '#4b3b8c', '#2b2566'], 11);
  ridge(x, 214, 22, ['#2a2366', '#382d78', '#1f1a50'], 23);
  return c;
}

function drawPlanet(x, cx, cy, R) {
  const cols = ['#2a1f5c', '#4b2f7d', '#7a3f8e', '#b45a8f', '#e98a8a', '#ffc39a'].map(hexRgb);
  const img = x.getImageData(cx - R * 2 - 2, cy - R - 2, R * 4 + 4, R * 2 + 4), d = img.data, w = img.width;
  const ox = R * 2 + 2, oy = R + 2;
  const lx = -0.62, ly = -0.48, lz = 0.62;
  const ringA = R * 1.95, ringB = R * 0.42, tilt = -0.28;
  const setPx = (xx, yy, c) => { const k = (yy * w + xx) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; };
  const inRing = (dx, dy) => {
    const rx = dx * Math.cos(tilt) - dy * Math.sin(tilt), ry = dx * Math.sin(tilt) + dy * Math.cos(tilt);
    const e = (rx * rx) / (ringA * ringA) + (ry * ry) / (ringB * ringB);
    return { on: e < 1 && e > 0.62, band: e, front: ry > 0 };
  };
  const ringCol = (e, xx, yy) => {
    const c = e > 0.86 ? '#f6d6a8' : e > 0.74 ? '#c08a8a' : '#e8b89a';
    const rgb = hexRgb(c);
    return (BAYER[yy & 3][xx & 3] > 11) ? hexRgb('#8e5f86') : rgb;
  };
  for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < w; xx++) {
    const dx = xx - ox, dy = yy - oy;
    const rr = inRing(dx, dy);
    if (rr.on && !rr.front) setPx(xx, yy, ringCol(rr.band, xx, yy));
    const dd = dx * dx + dy * dy;
    if (dd <= R * R) {
      const nx = dx / R, ny = dy / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = clamp(nx * lx + ny * ly + nz * lz, 0, 1);
      v = v * 0.85 + 0.12 * Math.sin(dy * 0.55 + Math.sin(dx * 0.15) * 1.5) + 0.05;
      const f = clamp(v, 0, 0.999) * (cols.length - 1), i = Math.floor(f), fr = f - i;
      const thr = (BAYER[yy & 3][xx & 3] + 0.5) / 16;
      setPx(xx, yy, cols[Math.min(cols.length - 1, fr > thr ? i + 1 : i)]);
    }
    if (rr.on && rr.front) setPx(xx, yy, ringCol(rr.band, xx, yy));
  }
  x.putImageData(img, cx - R * 2 - 2, cy - R - 2);
}

function ridge(x, base, amp, cols, seed) {
  const r = rng(seed), ph = [r() * 9, r() * 9, r() * 9];
  let prev = 0;
  for (let xx = 0; xx < W; xx++) {
    const h = amp * (0.55 * Math.sin(xx * 0.013 + ph[0]) + 0.3 * Math.sin(xx * 0.037 + ph[1]) + 0.15 * Math.sin(xx * 0.09 + ph[2]));
    const top = Math.round(base - Math.abs(h) - amp * 0.3);
    rect(x, xx, top, 1, H - top, cols[0]);
    const slope = top - prev; prev = top;
    // lado iluminado (pendiente que mira a la izquierda/planeta)
    if (slope > 0) for (let k = 1; k < 5; k++) if (BAYER[(top + k) & 3][xx & 3] < 10 - k * 2) px(x, xx, top + k, cols[2]);
    if (slope < 0) for (let k = 1; k < 4; k++) if (BAYER[(top + k) & 3][xx & 3] < 12 - k * 3) px(x, xx, top + k, cols[1]);
    px(x, xx, top, cols[1]);
  }
}

// ---------- mar de nubes (capa que se desplaza) ----------
function makeClouds(seed, baseY, cols, count, heightVar) {
  // cols: [sombra, base, luz, brillo]
  const CW = W * 2, c = mkCanvas(CW, H), x = c.getContext('2d');
  const r = rng(seed), puffs = [];
  for (let i = 0; i < count; i++) puffs.push([r() * CW, baseY + r() * heightVar, 7 + r() * 13 | 0]);
  puffs.sort((a, b) => a[1] - b[1]);
  const each = fn => { for (const p of puffs) for (const off of [-CW, 0, CW]) fn(p[0] + off, p[1], p[2]); };
  // nubes achatadas (más anchas que altas), con base plana
  const disc = (c, cx, cy, r, col) => {
    c.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
    const rx = Math.round(r * 1.35), ry = Math.max(1, Math.round(r * 0.8));
    for (let y = -ry; y <= Math.min(ry, 3); y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))));
      c.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
    if (ry > 3) c.fillRect(cx - rx + 1, cy + 3, rx * 2 - 1, ry - 2);
  };
  // silueta en sombra, luego cuerpo y luz desplazados hacia arriba-izquierda (luz del planeta)
  each((px0, py, pr) => disc(x, px0, py + 3, pr, cols[0]));
  rect(x, 0, baseY + heightVar + 4, CW, H, cols[0]);
  each((px0, py, pr) => disc(x, px0 - 1, py, pr - 1, cols[1]));
  rect(x, 0, baseY + heightVar + 10, CW, H, cols[1]);
  each((px0, py, pr) => disc(x, px0 - 2, py - 2, Math.max(1, pr - 4), cols[2]));
  each((px0, py, pr) => { if (pr > 11) disc(x, px0 - 5, py - 5, Math.max(1, pr - 10), cols[3]); });
  // borde tramado entre sombra y cuerpo para suavizar sin perder el píxel
  const img = x.getImageData(0, 0, CW, H), d = img.data, sh = hexRgb(cols[0]), bs = hexRgb(cols[1]);
  for (let yy = 1; yy < H; yy++) for (let xx = 0; xx < CW; xx++) {
    const k = (yy * CW + xx) * 4, up = k - CW * 4;
    if (d[k + 3] && d[k] === sh[0] && d[k + 1] === sh[1] && d[up] === bs[0] && d[up + 1] === bs[1] && ((xx + yy) & 1)) {
      d[k] = bs[0]; d[k + 1] = bs[1]; d[k + 2] = bs[2];
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

// ============================================================
//  Escenario (se genera una vez)
// ============================================================
const ROCK = ['#1d1a36', '#2b2850', '#3d3a68', '#535082', '#6f6ca0', '#8f8dc0'];
const GRASS = { hi: '#c6f57f', a: '#6ad85c', b: '#36a352', c: '#1f7148', d: '#16503d' };

function makeStage(G) {   // G: geometría de la arena (main, plats)
  const c = mkCanvas(W, H), x = c.getContext('2d');
  const M = G.main, r = rng(42);
  const cx = (M.x1 + M.x2) / 2, half = (M.x2 - M.x1) / 2;
  const bottoms = [];
  for (let xx = M.x1; xx < M.x2; xx++) {
    const u = (xx + 0.5 - cx) / half;
    const taper = Math.pow(Math.max(0, 1 - u * u), 0.65);
    const n = Math.sin(xx * 0.21) * 2.2 + Math.sin(xx * 0.53 + 1) * 1.4 + Math.sin(xx * 0.07) * 3;
    bottoms.push(Math.round(M.y + 12 + taper * 46 + n * taper + (Math.abs(u) < 0.08 ? (0.08 - Math.abs(u)) * 120 : 0)));
  }
  // cuerpo de roca con estratos y sombreado tramado
  for (let xx = M.x1; xx < M.x2; xx++) {
    const by = bottoms[xx - M.x1];
    for (let yy = M.y + 3; yy < by; yy++) {
      const depth = (yy - M.y) / (by - M.y);
      const strata = Math.floor((yy - M.y + Math.sin(xx * 0.09) * 3 + Math.sin(xx * 0.31) * 1.2) / 6);
      let v = 4.2 - depth * 3.4 - (strata % 2) * 0.55;
      const edgeL = (xx - M.x1) / 22, edgeR = (M.x2 - xx) / 22;
      if (edgeL < 1) v += (1 - edgeL) * 0.8;   // borde izquierdo iluminado
      if (edgeR < 1) v -= (1 - edgeR) * 0.9;   // borde derecho en sombra
      const f = clamp(v, 0, ROCK.length - 1.001), i = Math.floor(f), fr = f - i;
      const thr = (BAYER[yy & 3][xx & 3] + 0.5) / 16;
      px(x, xx, yy, ROCK[fr > thr ? i + 1 : i]);
    }
    // línea de estrato oscura
  }
  // grietas y piedras
  for (let i = 0; i < 26; i++) {
    let gx = M.x1 + 6 + r() * (M.x2 - M.x1 - 12) | 0, gy = M.y + 10 + r() * 30 | 0;
    if (gy >= bottoms[gx - M.x1] - 3) continue;
    const len = 2 + r() * 5 | 0;
    for (let k = 0; k < len; k++) { px(x, gx, gy, ROCK[0]); px(x, gx + 1, gy, ROCK[1]); gx += r() < 0.5 ? 1 : 0; gy++; }
  }
  for (let i = 0; i < 14; i++) {
    const gx = M.x1 + 8 + r() * (M.x2 - M.x1 - 16) | 0, gy = M.y + 8 + r() * 24 | 0;
    if (gy >= bottoms[gx - M.x1] - 4) continue;
    rect(x, gx, gy, 3, 2, ROCK[4]); px(x, gx, gy, ROCK[5]); rect(x, gx, gy + 2, 3, 1, ROCK[1]);
  }
  // cristales
  const crystal = (cx0, cy0, h, flip) => {
    for (let k = 0; k < h; k++) {
      const w = Math.max(1, Math.round((1 - k / h) * 3));
      const yy = flip ? cy0 + k : cy0 - k;
      rect(x, cx0 - w + 1, yy, w, 1, '#2fb7d9');
      rect(x, cx0 + 1, yy, w, 1, '#8ff5ff');
      if (k % 3 === 1) px(x, cx0 + 1, yy, '#e6ffff');
    }
  };
  crystal(Math.round(cx) - 1, bottoms[Math.round(cx) - M.x1] - 1, 12, true);
  crystal(Math.round(cx) - 16, bottoms[Math.round(cx) - 16 - M.x1] - 2, 7, true);
  crystal(Math.round(cx) + 14, bottoms[Math.round(cx) + 14 - M.x1] - 2, 8, true);
  crystal(M.x1 + 40, bottoms[40] - 1, 5, true);
  crystal(M.x2 - 36, bottoms[M.x2 - M.x1 - 36] - 1, 6, true);
  // césped
  for (let xx = M.x1; xx < M.x2; xx++) {
    rect(x, xx, M.y, 1, 1, GRASS.hi);
    rect(x, xx, M.y + 1, 1, 2, GRASS.a);
    rect(x, xx, M.y + 3, 1, 1, GRASS.b);
    const drip = (Math.sin(xx * 0.7) + Math.sin(xx * 0.23) * 1.3) > 1.1 ? 2 + (r() * 3 | 0) : (r() < 0.5 ? 1 : 0);
    rect(x, xx, M.y + 4, 1, drip, GRASS.c);
    if (drip > 1) px(x, xx, M.y + 4 + drip, GRASS.d);
    if (BAYER[0][xx & 3] < 6) px(x, xx, M.y + 2, GRASS.b);
    // briznas
    if (r() < 0.35) { px(x, xx, M.y - 1, GRASS.a); if (r() < 0.4) px(x, xx, M.y - 2, GRASS.hi); }
  }
  // flores
  for (let i = 0; i < 9; i++) {
    const fx = M.x1 + 10 + r() * (M.x2 - M.x1 - 20) | 0;
    const col = ['#ffd1f0', '#ffe27a', '#bfe9ff'][i % 3];
    px(x, fx, M.y - 2, col); px(x, fx, M.y - 1, GRASS.b);
  }
  // enredaderas colgando de los bordes
  for (const [vx, len] of [[M.x1 + 2, 18], [M.x1 + 7, 10], [M.x1 + 13, 6], [M.x2 - 4, 16], [M.x2 - 10, 9], [M.x2 - 17, 5]]) {
    for (let k = 0; k < len; k++) {
      const sx = vx + Math.round(Math.sin(k * 0.6) * 0.8);
      px(x, sx, M.y + 3 + k, k % 4 === 2 ? GRASS.a : GRASS.c);
      if (k % 4 === 1) px(x, sx + 1, M.y + 3 + k, GRASS.b);
    }
  }
  // plataformas flotantes
  for (const p of G.plats) drawSlab(x, p);
  return outlined(c);
}

function drawSlab(x, p) {
  const w = p.x2 - p.x1;
  for (let xx = p.x1; xx < p.x2; xx++) {
    px(x, xx, p.y, '#c6c3ee');
    rect(x, xx, p.y + 1, 1, 2, '#8f8dc0');
    rect(x, xx, p.y + 3, 1, 2, '#6f6ca0');
    px(x, xx, p.y + 5, '#3d3a68');
    if ((xx - p.x1) % 10 === 0) rect(x, xx, p.y + 1, 1, 4, '#535082');
  }
  // musgo en la parte superior
  for (let xx = p.x1; xx < p.x2; xx++) {
    if (Math.sin(xx * 0.45) + Math.sin(xx * 0.17) > 0.6) { px(x, xx, p.y, GRASS.a); px(x, xx, p.y - 1, xx % 3 ? GRASS.hi : GRASS.a); }
  }
  // runas brillantes y soporte
  const mid = Math.round((p.x1 + p.x2) / 2);
  for (const off of [-16, 0, 16]) { px(x, mid + off, p.y + 3, '#8ff5ff'); px(x, mid + off - 1, p.y + 3, '#2fb7d9'); }
  for (let k = 0; k < 6; k++) {
    const ww = Math.max(1, 8 - k * 1.5 | 0);
    rect(x, mid - ww, p.y + 6 + k, ww * 2, 1, k % 2 ? '#3d3a68' : '#535082');
  }
  px(x, mid, p.y + 12, '#8ff5ff');
  px(x, p.x1, p.y, '#8f8dc0'); px(x, p.x2 - 1, p.y, '#8f8dc0');
}

// ============================================================
//  Efectos
// ============================================================
function drawShield(c, f, frame) {
  const frac = clamp(f.shieldHP / 50, 0.15, 1);
  const z = f.S.hh / 24, r = Math.round((4 + frac * 11) * z), cx = Math.round(f.x), cy = Math.round(f.y - f.S.hh / 2);
  const pulse = 0.04 * Math.sin(frame * 0.2);
  disc(c, cx, cy, r, f.pal.main, 0.22 + pulse);
  disc(c, cx - Math.round(r * 0.15), cy - Math.round(r * 0.15), Math.round(r * 0.75), f.pal.light, 0.14);
  withAlpha(c, 0.9, () => ring(c, cx, cy, r, f.pal.glow));
  withAlpha(c, 0.45, () => ring(c, cx, cy, r - 1, f.pal.light));
  disc(c, cx - Math.round(r * 0.45), cy - Math.round(r * 0.45), Math.max(1, Math.round(r * 0.15)), '#ffffff', 0.85);
}

function drawSwoosh(c, box, dir, col, strong) {
  // arco de golpe dentro de la caja de golpe
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rx = box.w / 2, ry = box.h / 2;
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    const a = (-0.9 + 1.8 * i / (steps - 1)) * (Math.PI / 2);
    const x = cx + Math.cos(a) * rx * dir * 0.9, y = cy + Math.sin(a) * ry * 0.9;
    rect(c, Math.round(x), Math.round(y), strong ? 2 : 1, strong ? 2 : 1, i % 3 === 0 ? '#ffffff' : col);
  }
}

function drawSpark(c, e) {
  const k = e.t / e.life, L = Math.round(e.size * (1 - k * 0.6)), x = Math.round(e.x), y = Math.round(e.y);
  const col = k < 0.35 ? '#ffffff' : e.col;
  glow(c, x, y, e.size * (0.9 + k), e.col, 0.45 * (1 - k));
  const pa = c.globalAlpha; c.globalAlpha = pa * (1 - k * k);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + e.rot, len = i % 2 ? L * 0.55 : L;
    const r0 = k * L * 0.6;
    pline(c, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * len, y + Math.sin(a) * len, 1, col);
  }
  if (k < 0.3) disc(c, x, y, Math.max(1, Math.round(e.size * 0.3)), '#ffffff');
  else ring(c, x, y, Math.round(e.size * k * 1.2), e.col);
  c.globalAlpha = pa;
}

function drawKO(c, e) {
  const k = e.t / e.life, x = e.x, y = e.y;
  const len = 160 * (1 - k * 0.5), w = Math.max(1, Math.round(14 * (1 - k)));
  const ex = x + Math.cos(e.ang) * len, ey = y + Math.sin(e.ang) * len;
  glow(c, x, y, 60 * (1 - k * 0.5), e.col, 0.5 * (1 - k), 5);
  withAlpha(c, 1 - k * 0.7, () => {
    pline(c, x, y, ex, ey, w + 4, e.col);
    pline(c, x, y, ex, ey, Math.max(1, w), '#ffffff');
  });
  if (k < 0.5) disc(c, x, y, Math.round(26 * (1 - k * 2)) + 2, k < 0.15 ? '#ffffff' : e.col, 1 - k * 1.6);
}

function drawParticle(c, p) {
  const k = p.t / p.life;
  if (p.kind === 'dust') {
    const r = Math.max(0, Math.round(p.size * (1 - k * 0.5)));
    disc(c, p.x, p.y, r, k < 0.5 ? '#e8e2ff' : '#a49cc8', 0.85 * (1 - k));
  } else if (p.kind === 'smoke') {
    const r = Math.max(1, Math.round(p.size * (1 + k * 0.6)));
    disc(c, p.x, p.y, r, k < 0.3 ? '#ffffff' : '#c9c1e8', 0.6 * (1 - k));
  } else if (p.kind === 'fire') {
    const k2 = p.t / p.life, col = k2 < 0.2 ? '#fff3b0' : k2 < 0.45 ? '#ffd040' : k2 < 0.7 ? '#ff7a20' : k2 < 0.88 ? '#c02818' : '#3a1418';
    const sz = k2 < 0.5 ? p.size : 1;
    if (k2 < 0.6) disc(c, p.x, p.y, 2, '#ff8a20', 0.18 * (1 - k2));
    rect(c, Math.round(p.x), Math.round(p.y), sz, sz, col, k2 < 0.6 ? 1 : 1 - (k2 - 0.6) * 2.2);
  } else if (p.kind === 'star') {
    const x = Math.round(p.x), y = Math.round(p.y);
    px(c, x, y, '#ffffff'); px(c, x - 1, y, p.col); px(c, x + 1, y, p.col); px(c, x, y - 1, p.col); px(c, x, y + 1, p.col);
  } else {
    rect(c, Math.round(p.x), Math.round(p.y), p.size, p.size, k < 0.4 ? '#ffffff' : p.col, k < 0.6 ? 1 : 1 - (k - 0.6) * 2.3);
  }
}

function drawProjectile(c, pr, frame) {
  const x = Math.round(pr.x), y = Math.round(pr.y), pal = pr.pal;
  switch (pr.kind) {
    case 'laser': {                                       // rayo del bláster
      const d = sgn(pr.vx) || 1;
      withAlpha(c, 0.35, () => rect(c, d > 0 ? x - 12 : x - 2, y - 2, 14, 5, '#3df2b0'));
      pline(c, x - d * 11, y, x + d * 2, y, 2, '#3df2b0');
      pline(c, x - d * 9, y, x + d * 2, y, 1, '#eafff8');
      px(c, x + d * 3, y, '#ffffff');
      break;
    }
    case 'rock': {
      disc(c, x, y, 5, OUTLINE); disc(c, x, y, 4, '#6d6a9e'); disc(c, x - 1, y - 1, 2, '#8f8dc0');
      px(c, x + 1, y + 1, '#3d3a68'); px(c, x + 2, y, '#3d3a68'); px(c, x - 2, y - 2, '#c6c3ee');
      break;
    }
    case 'blade': {
      const d = sgn(pr.vx) || 1;
      for (let i = 0; i < 4; i++) px(c, x - d * (i + 3), y + (i % 2), pal.light);
      pline(c, x - d * 2, y - 3, x + d * 2, y, 1, '#ffffff');
      pline(c, x - d * 2, y + 3, x + d * 2, y, 1, pal.glow);
      pline(c, x - d * 3, y - 2, x - d * 3, y + 2, 1, pal.light);
      break;
    }
    case 'arrow': {
      const a = Math.atan2(pr.vy || 0, pr.vx || 0.001), ca = Math.cos(a), sa = Math.sin(a);
      const tx = x - ca * 9, ty = y - sa * 9;
      pline(c, tx, ty, x, y, 1, '#c89a60');
      pline(c, x - ca * 2, y - sa * 2, x + ca, y + sa, 2, '#d8e4ec');                     // punta
      px(c, Math.round(tx - sa), Math.round(ty + ca), '#e83030'); px(c, Math.round(tx + sa), Math.round(ty - ca), '#e83030');
      px(c, Math.round(tx), Math.round(ty), '#ffffff');
      if (pr.fire) { const f = (frame >> 1) % 2; px(c, Math.round(x + ca * 2), Math.round(y + sa * 2 - 1), f ? '#ffd040' : '#fff3b0'); px(c, Math.round(x), Math.round(y - 2), '#ff7a20'); px(c, Math.round(x - ca * 2), Math.round(y - sa * 2 - 2 - f), '#ff7a20'); }
      break;
    }
    case 'mine': {
      const pulse = (frame >> 3) % 2;
      ring(c, x, y, 5 + pulse, pal.main);
      disc(c, x, y, 3, OUTLINE); disc(c, x, y, 2, pulse ? '#ffffff' : pal.light);
      for (let i = 0; i < 4; i++) { const a = frame * 0.05 + i * Math.PI / 2; px(c, x + Math.round(Math.cos(a) * 8), y + Math.round(Math.sin(a) * 8), pal.glow); }
      break;
    }
    case 'orb': {
      for (let i = 3; i >= 1; i--) disc(c, x - pr.vx * i * 1.8, y - (pr.vy || 0) * i, Math.max(1, 4 - i), pal.main);
      disc(c, x, y, 5, OUTLINE); disc(c, x, y, 4, pal.dark); disc(c, x, y, 3, pal.main);
      disc(c, x - 1, y - 1, 1, (frame >> 2) % 2 ? '#ffffff' : pal.glow);
      ring(c, x, y, 6 + ((frame >> 2) % 2), pal.light);
      break;
    }
    default: {
      for (let i = 3; i >= 1; i--) disc(c, x - pr.vx * i * 1.6, y, Math.max(1, 3 - i), pal.main);
      disc(c, x, y, 4, pal.dark); disc(c, x, y, 3, pal.main);
      disc(c, x - 1, y - 1, 1, (frame >> 2) % 2 ? '#ffffff' : pal.glow);
    }
  }
}

// portal del que reaparece el ganador al final (si cayó justo después de ganar)
//  0-26 se abre · 26-72 el luchador se materializa de abajo arriba · 72-84 se cierra
function drawPortal(c, f, frame) {
  const t = f.t, x = Math.round(f.x), base = Math.round(f.y), hh = f.S.hh + 10, cy = base - hh / 2;
  const open = t < 26 ? t / 26 : t > 72 ? Math.max(0, 1 - (t - 72) / 12) : 1;
  const rh = Math.round(hh / 2 * open), rw = Math.round((f.S.hw + 9) * (0.4 + 0.6 * open));
  if (rh > 1) {
    // anillo ovalado que gira: puntos de colores del jugador alrededor
    withAlpha(c, 0.55 * open, () => { c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(x, cy, rw + 2, rh + 2, 0, 0, Math.PI * 2); c.fill(); });   // fondo oscuro: se ve en cualquier escenario
    withAlpha(c, 0.45 * open, () => { c.fillStyle = f.pal.main; c.beginPath(); c.ellipse(x, cy, Math.max(1, rw - 1), Math.max(1, rh - 1), 0, 0, Math.PI * 2); c.fill(); });
    withAlpha(c, 0.5 * open, () => { c.fillStyle = f.pal.light; c.beginPath(); c.ellipse(x, cy, Math.max(1, rw - 5), Math.max(1, rh - 5), 0, 0, Math.PI * 2); c.fill(); });
    for (let i = 0; i < 56; i++) {                             // anillo que gira
      const a = i / 56 * Math.PI * 2 + frame * 0.12;
      const col = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? f.pal.light : f.pal.glow;
      rect(c, x + Math.cos(a) * rw - 1, cy + Math.sin(a) * rh - 1, 2, 2, col);
      px(c, x + Math.cos(-a * 1.3) * (rw - 4), cy + Math.sin(-a * 1.3) * (rh - 4), '#ffffff', 0.7);
    }
    for (let i = 0; i < 6; i++) {                              // chispas que suben
      const yy = base - ((frame * 1.5 + i * 13) % hh);
      px(c, x - rw + 3 + ((i * 7 + frame) % (rw * 2 - 4)), yy, '#ffffff', 0.8);
    }
  }
  if (t >= 26) {                                               // materialización de abajo arriba, en blanco al principio
    const k = Math.min(1, (t - 26) / 46), top = base - Math.round((hh + 4) * k);
    c.save(); c.beginPath(); c.rect(x - 60, top, 120, base - top + 3); c.clip();
    const fl = f.flash; f.flash = t < 66 && (t >> 1) % 2 ? 1 : 0;
    renderFighter(c, f, frame);
    f.flash = fl; c.restore();
    if (k < 1) rect(c, x - rw + 2, top, rw * 2 - 4, 1, '#ffffff', 0.9);   // línea de "escaneo"
  }
}

function drawRespawnPad(c, f, frame) {
  const x = Math.round(f.x), y = Math.round(f.y);
  rect(c, x - 13, y, 26, 2, f.pal.light);
  rect(c, x - 10, y + 2, 20, 1, f.pal.main);
  rect(c, x - 6, y + 3, 12, 1, f.pal.dark);
  for (let i = 0; i < 4; i++) {
    const yy = y + 5 + ((frame / 2 + i * 4) % 16);
    px(c, x - 8 + i * 5, yy, f.pal.glow);
  }
}

// mini fuente 3x5 para etiquetas sobre los luchadores
const MINI = {
  'J': [1, 1, 1, 1, 6], 'C': [7, 4, 4, 4, 7], 'P': [7, 5, 7, 4, 4], 'U': [5, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 3, 1, 7], '4': [5, 5, 7, 1, 1],
};
function miniText(c, str, x, y, col) {
  let cx = x;
  for (const ch of str) {
    const g = MINI[ch];
    if (g) g.forEach((row, ry) => { for (let b = 0; b < 3; b++) if (row & (4 >> b)) px(c, cx + b, y + ry, col); });
    cx += 4;
  }
}
function drawTag(c, f, label) {
  const w = label.length * 4 - 1, x = Math.round(f.x - w / 2), y = Math.round(f.y - f.S.hh - (f.ch.tagGap ?? 14));
  rect(c, x - 2, y - 2, w + 4, 9, OUTLINE);
  rect(c, x - 1, y - 1, w + 2, 7, f.pal.dark);
  miniText(c, label, x, y, '#ffffff');
  px(c, Math.round(f.x) - 1, y + 7, OUTLINE); px(c, Math.round(f.x), y + 7, OUTLINE); px(c, Math.round(f.x) + 1, y + 7, OUTLINE);
  px(c, Math.round(f.x), y + 8, OUTLINE); px(c, Math.round(f.x), y + 7, f.pal.dark);
}

function drawOffscreen(c, f, label) {
  const x = clamp(Math.round(f.x), 12, W - 13), y = clamp(Math.round(f.y - 12), 12, 225);
  disc(c, x, y, 10, OUTLINE);
  disc(c, x, y, 9, f.pal.dark);
  disc(c, x, y, 8, '#1b1636');
  f.ch.portrait(c, x, y + 1, f.pal, 1);
  // flecha hacia el luchador
  const a = Math.atan2(f.y - 12 - y, f.x - x);
  if (Math.abs(f.x - x) + Math.abs(f.y - 12 - y) > 2) {
    const ax = x + Math.cos(a) * 12, ay = y + Math.sin(a) * 12;
    disc(c, ax, ay, 2, f.pal.light);
  }
}
