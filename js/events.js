'use strict';
// ============================================================
//  EVENTOS DE ARENA (opcionales: OPCIONES DE COMBATE → EVENTOS)
//  Cada arena tiene los suyos. Cada 45–60 s sale uno al azar:
//   1) AVISO (3 s): cartel gigante + advertencia visual, para que dé tiempo a reaccionar
//   2) EVENTO (unos segundos): con sus sonidos y su cambio de música
//   3) FIN: todo vuelve a la normalidad
//  No salen en Práctica, Tutorial ni Muerte súbita. Se congelan durante las cinemáticas.
// ============================================================
const EVENT_FIRST = 30 * 60;                 // el primero, a los 30 s de pelea
const EVENT_GAP = [45 * 60, 60 * 60];        // luego, cada 45–60 s
const EVENT_WARN = 180;                      // 3 s de aviso
// "atacante" de los eventos (como los géiseres): no es nadie
const evHazard = { landedHit: false, landedAt: 0, t: 0, dealt: 0, hitlag: 0, kos: 0, dir: 1, move: null, moveName: null, hitSet: new Set(), pal: { light: '#ffb040', main: '#ff6a20' } };
const evHit = (g, d, h, dir) => { evHazard.hitSet = new Set(); g.applyHit(evHazard, d, h, dir, 1, d.x, d.y - d.S.hh / 2); };
const alive = f => f.alive() && f.st !== 'respawn' && f.st !== 'gone' && f.st !== 'portal';


// ---------- arte de la tormenta: nubarrones colgantes en pixel art (se generan una vez) ----------
//  Siluetas de bultos achatados; el borde de abajo lo ilumina el relámpago (luz de abajo),
//  el interior se oscurece hacia arriba, con tramado entre tonos y jirones sueltos debajo.
const STORM_ART = {};
function stormClouds(key, seed, count, y0, yv, cols) {
  if (STORM_ART[key]) return STORM_ART[key];
  const CW = W * 2, HH = y0 + yv + 34, cv = mkCanvas(CW, HH), x = cv.getContext('2d'), r = rng(seed), puffs = [];
  for (let i = 0; i < count; i++) puffs.push([r() * CW, y0 + r() * yv, 7 + r() * 11 | 0]);
  for (let i = 0; i < count; i++) puffs.push([r() * CW, y0 + yv * 0.55 + r() * yv * 0.6, 3 + r() * 5 | 0]);   // bultitos de abajo (borde irregular)
  puffs.sort((a, b) => a[1] - b[1]);
  const each = fn => { for (const p of puffs) for (const off of [-CW, 0, CW]) fn(p[0] + off, p[1], p[2]); };
  const ell = (cx, cy, rr, col) => {
    if (rr < 1) return;
    x.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
    const rx = Math.round(rr * 1.55), ry = Math.max(1, Math.round(rr * 0.8));
    for (let y = -ry; y <= ry; y++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5)))); x.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  };
  // [0] borde iluminado, [1] cuerpo, [2] sombra, [3] núcleo, [4] brillo del borde
  x.fillStyle = cols[3]; x.fillRect(0, 0, CW, y0 - 6);
  x.fillStyle = cols[2]; x.fillRect(0, y0 - 6, CW, 6);
  each((a, b, s) => ell(a, b + 2, s, cols[0]));                  // silueta = borde de abajo con luz
  each((a, b, s) => ell(a + 1, b, s - 1, cols[1]));              // cuerpo
  each((a, b, s) => ell(a + 2, b - 3, s - 4, cols[2]));          // sombra hacia dentro
  each((a, b, s) => ell(a + 3, b - 6, s - 8, cols[3]));          // núcleo oscuro
  // jirones sueltos debajo (scud)
  for (let i = 0; i < count; i++) {
    const sx = r() * CW | 0, sy = y0 + yv + 6 + r() * 16 | 0, sw = 10 + r() * 26 | 0;
    x.fillStyle = cols[1];
    for (let j = 0; j < sw; j++) { if (j > 2 && j < sw - 3 || !(j & 1)) x.fillRect(sx + j, sy, 1, 1); if (j > 4 && j < sw - 6 && (j & 1)) x.fillRect(sx + j + 2, sy + 1, 1, 1); }   // jirón con puntas tramadas
    x.fillStyle = cols[0]; x.fillRect(sx + 3, sy, Math.max(2, sw >> 3), 1);
  }
  // tramado: una fila a cuadros entre tonos distintos (suaviza sin perder el píxel)
  const img = x.getImageData(0, 0, CW, HH), d = img.data, src = new Uint8ClampedArray(d);
  for (let yy = 1; yy < HH; yy++) for (let xx = 0; xx < CW; xx++) {
    if ((xx + yy) & 1) continue;
    const k = (yy * CW + xx) * 4, up = k - CW * 4;
    if (src[k + 3] && src[up + 3] && (src[k] !== src[up] || src[k + 1] !== src[up + 1])) { d[k] = src[up]; d[k + 1] = src[up + 1]; d[k + 2] = src[up + 2]; }
  }
  x.putImageData(img, 0, 0);
  each((a, b, s) => { if (s > 10) { x.fillStyle = cols[4]; const rx = Math.round(s * 1.55), by = Math.round(b + 2 + s * 0.8); for (let xx = Math.round(a - rx * 0.5), e = xx + Math.round(rx * 0.45); xx < e; xx++) { if (xx < 0 || xx >= CW || by + 1 >= HH) continue; if (d[((by + 1) * CW + xx) * 4 + 3] === 0 && d[(by * CW + xx) * 4 + 3]) x.fillRect(xx, by, 1, 1); } } });   // brillo en la panza (solo en el borde de abajo de verdad)
  return (STORM_ART[key] = cv);
}

// ---------- arte del Glaciar: escarcha de la pantalla, cortinas de nieve y bloques de hielo ----------
const ICE_EV = ['#0b1b44', '#1b4482', '#3a7cc2', '#86c4f0', '#b6e2fa', '#e6f8ff'];
// escarcha en los bordes de la pantalla: cristales ramificados que crecen desde el marco
function frostFrame() {
  if (STORM_ART.frost) return STORM_ART.frost;
  const cv = mkCanvas(W, H), x = cv.getContext('2d'), r = rng(404);
  // velo helado tramado pegado al borde
  const img = x.createImageData(W, H), d = img.data, cols = ['#86c4f0', '#b6e2fa', '#e6f8ff'].map(hexRgb);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const e = Math.min(xx, y, W - 1 - xx, H - 1 - y) + Math.sin(xx * 0.21 + y * 0.13) * 2 + Math.sin(xx * 0.05 - y * 0.31) * 2;
    const v = 1 - e / 14; if (v <= 0) continue;
    if (v * 16 <= BAYER[y & 3][xx & 3] + 0.5) continue;
    const c = cols[Math.min(2, v * 3 | 0)], k = (y * W + xx) * 4;
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 150 + 90 * Math.min(1, v) | 0;
  }
  x.putImageData(img, 0, 0);
  // helechos de escarcha: caminos que se ramifican hacia dentro
  const fern = (sx, sy, ang, len, depth) => {
    let px0 = sx, py0 = sy;
    for (let i = 0; i < len; i++) {
      px0 += Math.cos(ang); py0 += Math.sin(ang); ang += (r() - 0.5) * 0.35;
      x.fillStyle = i < len * 0.3 ? '#ffffff' : i < len * 0.7 ? '#e6f8ff' : '#b6e2fa';
      x.fillRect(Math.round(px0), Math.round(py0), 1, 1);
      if (depth > 0 && i > 2 && i % 4 === 0) fern(px0, py0, ang + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.4), len * 0.45 | 0, depth - 1);
    }
  };
  for (let i = 0; i < 26; i++) fern(r() * W, 0, Math.PI / 2 + (r() - 0.5), 10 + r() * 16 | 0, 2);
  for (let i = 0; i < 26; i++) fern(r() * W, H - 1, -Math.PI / 2 + (r() - 0.5), 10 + r() * 16 | 0, 2);
  for (let i = 0; i < 16; i++) fern(0, r() * H, (r() - 0.5), 10 + r() * 18 | 0, 2);
  for (let i = 0; i < 16; i++) fern(W - 1, r() * H, Math.PI + (r() - 0.5), 10 + r() * 18 | 0, 2);
  return (STORM_ART.frost = cv);
}
// cortina de nieve arrastrada por el viento (bandas horizontales tramadas, se repite en horizontal)
function snowVeil(key, seed, dens) {
  if (STORM_ART[key]) return STORM_ART[key];
  const CW = W * 2, cv = mkCanvas(CW, H), x = cv.getContext('2d'), r = rng(seed);
  const img = x.createImageData(CW, H), d = img.data, cols = ['#9fbade', '#cfe2f5', '#ffffff'].map(hexRgb);
  const ph = [r() * 6, r() * 6, r() * 6];
  for (let y = 0; y < H; y++) {
    const band = 0.5 + 0.5 * Math.sin(y * 0.09 + ph[0]) * Math.sin(y * 0.031 + ph[1]);
    for (let xx = 0; xx < CW; xx++) {
      const a = Math.PI * 2 * xx / CW;                                          // periódico en x (sin costura)
      const streak = 0.5 + 0.5 * Math.sin(a * 7 + y * 0.6 + ph[2]) * Math.sin(a * 3 - y * 0.17);
      const v = band * streak * dens; if (v * 16 <= BAYER[y & 3][xx & 3] + 2) continue;
      const c = cols[Math.min(2, v * 2.4 | 0)], k = (y * CW + xx) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 110 + 120 * Math.min(1, v) | 0;
    }
  }
  x.putImageData(img, 0, 0);
  return (STORM_ART[key] = cv);
}
// bloque de hielo que cae (punta hacia abajo), facetado con luz de arriba-izquierda
function iceChunk(size) {
  const key = 'ice' + size; if (STORM_ART[key]) return STORM_ART[key];
  const w = 6 + size * 3, h = 12 + size * 5, cv = mkCanvas(w + 2, h + 2), x = cv.getContext('2d');
  const shape = []; for (let y = 0; y < h; y++) { const k = y < h * 0.35 ? 1 : 1 - (y - h * 0.35) / (h * 0.65); shape.push(Math.max(0, Math.round(w / 2 * (0.55 + 0.45 * k) * (y < 2 ? 0.8 : 1) * (k < 1 ? k + 0.1 : 1)))); }
  for (let y = 0; y < h; y++) {                                                  // contorno
    const hw = shape[y]; if (hw <= 0) { x.fillStyle = ICE_EV[0]; x.fillRect(1 + (w >> 1), y + 1, 1, 1); continue; }
    x.fillStyle = ICE_EV[0]; x.fillRect(1 + (w >> 1) - hw - 1, y + 1, hw * 2 + 2, 1);
  }
  x.fillRect(1 + (w >> 1) - shape[0], 0, shape[0] * 2, 1);
  for (let y = 0; y < h; y++) {                                                  // caras: izquierda clara, derecha oscura, arista brillante
    const hw = shape[y]; if (hw <= 0) continue;
    for (let i = -hw; i < hw; i++) {
      const u = (i + hw) / (hw * 2), face = u < 0.35 ? 4 : u < 0.55 ? 3 : u < 0.8 ? 2 : 1;
      const dith = (u > 0.3 && u < 0.4 && ((i + y) & 1)) ? -1 : 0;
      x.fillStyle = ICE_EV[Math.max(1, face + dith)];
      x.fillRect(1 + (w >> 1) + i, y + 1, 1, 1);
    }
    if (y % 3 === 0 && hw > 1) { x.fillStyle = ICE_EV[5]; x.fillRect(1 + (w >> 1) - hw + 1, y + 1, 1, 1); }
  }
  x.fillStyle = '#ffffff'; x.fillRect(1 + (w >> 1) - 2, 2, 2, 1); x.fillRect(1 + (w >> 1) - 2, 3, 1, 2);   // brillo
  return (STORM_ART[key] = cv);
}

// ---------- arte del Templo: runas doradas y espíritus guardianes ----------
const RUNES = [                                                                    // glifos de 5x5 (bits por fila)
  [0b00100, 0b01110, 0b10101, 0b00100, 0b00100], [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  [0b11111, 0b10001, 0b10101, 0b10001, 0b11111], [0b00100, 0b01010, 0b10001, 0b01010, 0b00100],
  [0b10101, 0b10101, 0b11111, 0b00100, 0b00100], [0b01110, 0b10000, 0b01100, 0b00010, 0b11100],
];
function drawRune(c, x, y, i, col, hi) {
  const g = RUNES[i % RUNES.length];
  for (let r = 0; r < 5; r++) for (let b = 0; b < 5; b++) if (g[r] >> (4 - b) & 1) px(c, x + b - 2, y + r - 2, r === 0 || b === 0 ? hi : col);
}
const SPIRIT = { dd: '#0e2a3a', d: '#1a5a66', m: '#2f9a96', l: '#6fe0cc', hi: '#c8fff2' };
const TGOLD = { dd: '#7a4c1e', d: '#b07a2a', m: '#e6ac3c', l: '#ffd96a', hi: '#fff3b8' };
// espíritu guardián: capucha de luz turquesa, máscara de oro con ojos encendidos y cola de humo que ondula
function drawSpirit(c, x, y, T, alpha, dir, angry) {
  withAlpha(c, alpha, () => {
    x = Math.round(x); y = Math.round(y);
    glow(c, x, y, 22, SPIRIT.l, 0.22, 3);
    // cola: segmentos que se estrechan y ondulan
    for (let i = 0; i < 14; i++) {
      const k = i / 14, wv = Math.sin(T * 0.18 - i * 0.55) * (2 + i * 0.35);
      const tx = Math.round(x - dir * i * 1.1 + wv * 0.4), ty = Math.round(y + 7 + i * 1.3), w = Math.max(1, Math.round(6 * (1 - k)));
      rect(c, tx - w, ty, w * 2, 2, k < 0.3 ? SPIRIT.m : k < 0.65 ? SPIRIT.d : SPIRIT.dd, 1 - k * 0.7);
      if (i < 9 && i % 2 === 0) px(c, tx - w, ty, SPIRIT.l);
    }
    // capucha (óvalo con 4 tonos, luz de arriba)
    for (let yy = -10; yy <= 8; yy++) {
      const hw = Math.round(8 * Math.sqrt(Math.max(0, 1 - (yy * yy) / 100)));
      if (hw <= 0) continue;
      rect(c, x - hw, y + yy, hw * 2 + 1, 1, yy < -6 ? SPIRIT.l : yy < -1 ? SPIRIT.m : yy < 5 ? SPIRIT.d : SPIRIT.dd);
      px(c, x - hw, y + yy, yy < 2 ? SPIRIT.hi : SPIRIT.dd); px(c, x + hw, y + yy, SPIRIT.dd);   // borde con luz a la izquierda
      if (yy < 0 && hw > 2) px(c, x - hw + 1, y + yy, SPIRIT.l);
    }
    rect(c, x - 3, y - 10, 5, 1, SPIRIT.hi);
    // máscara de oro
    for (let yy = -5; yy <= 4; yy++) {
      const hw = yy < 2 ? 5 : 5 - (yy - 1);
      rect(c, x - hw, y + yy, hw * 2 + 1, 1, yy < -3 ? TGOLD.l : yy < 1 ? TGOLD.m : TGOLD.d);
      px(c, x + hw, y + yy, TGOLD.dd); if (yy > 0) px(c, x - hw, y + yy, TGOLD.dd);     // contorno de la máscara
    }
    px(c, x - 4, y + 1, '#ff9a8a'); px(c, x + 4, y + 1, '#ff9a8a');                     // mejillas pintadas
    px(c, x - 4, y - 5, TGOLD.hi); px(c, x - 3, y - 5, TGOLD.hi);
    rect(c, x - 1, y - 4, 2, 6, TGOLD.d); px(c, x, y - 4, TGOLD.l);                  // nariz / arista
    rect(c, x - 2, y + 3, 5, 1, TGOLD.dd);                                             // boca
    const eye = angry ? '#ff5f6d' : '#ffffff', eg = angry ? '#ff9a8a' : SPIRIT.hi;
    rect(c, x - 4, y - 2, 3, 2, '#1a0c24'); rect(c, x + 2, y - 2, 3, 2, '#1a0c24');
    px(c, x - 3 + (dir > 0 ? 1 : 0), y - 2, eye); px(c, x + 3 + (dir > 0 ? 1 : 0), y - 2, eye);
    if ((T >> 3) % 4) { px(c, x - 3, y - 3, eg); px(c, x + 3, y - 3, eg); }
    // diadema con gema
    rect(c, x - 5, y - 7, 11, 1, TGOLD.d); px(c, x, y - 8, '#ff5f6d'); px(c, x, y - 9, TGOLD.l);
  });
}

const STAGE_EVENTS = {
  fortaleza: [
    // ---------------- ¡EL PISO ES LAVA! ----------------
    //  El suelo principal (no las plataformas) arde 15 s: tocarlo quema y te hace saltar.
    {
      id: 'lava', name: '¡EL PISO ES LAVA!', sub: '¡Súbete a las plataformas!', dur: 900, col: '#ff6a20', icon: '🔥',
      warn(g, E) {
        const M = STAGE.main;
        if (E.t % 4 === 0) g.burst(M.x1 + Math.random() * (M.x2 - M.x1), M.y - 1, 1, E.t > 90 ? 'fire' : 'smoke');
        if (E.t > 120) g.shake = Math.max(g.shake, 1.5);
      },
      step(g, E) {
        const M = STAGE.main;
        if (E.t % 2 === 0) g.burst(M.x1 + Math.random() * (M.x2 - M.x1), M.y - 1, 1, 'fire');
        if (E.t % 50 === 0) Sfx.lavaHiss();
        for (const f of g.fighters) {
          if (!alive(f) || f.invuln > 0 || !f.grounded || f.plat !== STAGE.main) continue;
          if ((f.lavaCD || 0) > g.frame) continue;
          f.lavaCD = g.frame + 30;                                               // un respiro corto para escapar
          evHit(g, f, { d: 13, b: 5.4, g: 0.85, ang: 90, burn: 100 }, f.dir || 1);   // ¡duele! caer es un castigo
          g.shake = Math.max(g.shake, 5);
          Sfx.lavaBurn();
          for (let i = 0; i < 14; i++) g.burst(f.x + (Math.random() * 14 - 7), f.y - 2 - Math.random() * 6, 1, 'fire');
        }
      },
      drawBack(c, g, E) {
        const M = STAGE.main, T = g.frame, w = M.x2 - M.x1;
        if (E.phase === 'warn') {                                               // el suelo se pone al rojo
          const k = E.t / EVENT_WARN, a = (0.25 + 0.5 * k) * (0.6 + 0.4 * Math.sin(T * (0.15 + k * 0.4)));
          rect(c, M.x1, M.y - 1, w, 3, '#ff3a1a', a);
          for (let x = M.x1 + 4; x < M.x2; x += 13) if (((x * 7 + (T >> 3)) % 5) < 2 + k * 3) rect(c, x, M.y + 1, 4, 1, '#ffb040', a);   // grietas que brillan
          glow(c, (M.x1 + M.x2) / 2, M.y, w * 0.5, '#ff4a1a', 0.08 + 0.1 * k, 3);
          return;
        }
        const fade = E.phase === 'end' ? Math.max(0, 1 - E.t / 50) : Math.min(1, E.t / 12);
        if (fade <= 0) return;
        glow(c, (M.x1 + M.x2) / 2, M.y - 4, w * 0.55, '#ff5a1a', 0.16 * fade, 3);
        for (let x = M.x1; x < M.x2; x += 2) {                                 // lenguas de fuego por todo el suelo
          const h = Math.round((5 + 4 * Math.sin(x * 0.31 + T * 0.45) + 3 * Math.sin(x * 0.13 - T * 0.27)) * fade);
          if (h <= 0) continue;
          rect(c, x, M.y - h, 2, h, '#c8281e');
          rect(c, x, M.y - Math.round(h * 0.7), 2, Math.round(h * 0.7), '#ff7a20');
          if (h > 5) rect(c, x, M.y - Math.round(h * 0.35), 2, Math.round(h * 0.35), x % 4 ? '#ffd040' : '#fff3b0');
        }
        rect(c, M.x1, M.y, w, 2, '#ffd040', 0.8 * fade);
      },
    },
    // ---------------- ¡PAPA CALIENTE! ----------------
    //  Un luchador al azar lleva una bomba con 7 s. Si golpea a un rival, se la pasa. Al llegar a 0, ¡BUM!
    {
      id: 'papa', name: '¡PAPA CALIENTE!', sub: '¡Golpea a un rival para pasársela!', dur: 420, col: '#ff3a3a', icon: '💣',
      start(g, E) { E.holder = this.pick(g, null); E.passT = 0; if (E.holder) Sfx.pass(); },
      pick(g, not) { const c = g.fighters.filter(f => alive(f) && f !== not); return c.length ? c[Math.random() * c.length | 0] : null; },
      step(g, E) {
        if (!E.holder || !alive(E.holder) || E.holder.out) { E.holder = this.pick(g, E.holder); if (!E.holder) { E.abort = true; E.t = this.dur; return; } }   // cayó: la bomba busca a otro
        const left = this.dur - E.t;
        if (left > 180 ? E.t % 60 === 0 : left % 20 === 0) Sfx.tick(left <= 180);     // tic-tac (más rápido al final)
        if (E.t % 3 === 0) { const h = E.holder; g.fx.push({ kind: 'part', ptype: 'spark', x: h.x + (Math.random() * 4 - 2), y: h.y - h.S.hh - 14, vx: (Math.random() - 0.5) * 1.2, vy: -0.8, t: 0, life: 10, size: 1, col: E.t % 6 ? '#ffd040' : '#ffffff' }); }
      },
      stop(g, E) {
        const h = E.holder; if (E.abort || !h || !alive(h)) return;
        // ¡BUM!
        evHit(g, h, { d: 28, b: 6.4, g: 2.3, ang: 78 }, Math.random() < 0.5 ? -1 : 1);
        g.shake = Math.max(g.shake, 14); Sfx.boom(); Sfx.bigImpact();
        duoRadial(g, h.x, h.y - h.S.hh / 2, 40, ['#ff3a3a', '#ffd040', '#ff7a20', '#ffffff'], 3.2);
        for (let i = 0; i < 10; i++) g.burst(h.x + (Math.random() * 20 - 10), h.y - Math.random() * h.S.hh, 1, 'fire');
        g.burst(h.x, h.y - h.S.hh / 2, 8, 'smoke');
        E.boomX = h.x; E.boomY = h.y - h.S.hh / 2;
      },
      // al golpear, la bomba pasa al rival golpeado
      onHit(g, E, a, d) {
        if (E.phase !== 'on' || E.holder !== a || d === a || g.allies(a, d) || g.frame < (E.passT || 0)) return;
        E.holder = d; E.passT = g.frame + 24; Sfx.pass();
        g.spark(d.x, d.y - d.S.hh - 8, 12, '#ff3a3a');
      },
      drawFront(c, g, E) {
        if (E.phase === 'end' && E.boomX != null && E.t < 24) {                // onda de la explosión
          const k = E.t / 24; withAlpha(c, 1 - k, () => { ring(c, Math.round(E.boomX), Math.round(E.boomY), 8 + E.t * 4, '#ffd040'); ring(c, Math.round(E.boomX), Math.round(E.boomY), 4 + E.t * 3, '#ff3a3a'); });
        }
        const h = E.holder; if (E.phase !== 'on' || !h || !alive(h)) return;
        // la bomba sobre la cabeza
        const x = Math.round(h.x), y = Math.round(h.y - h.S.hh - 12), left = this.dur - E.t, urgent = left <= 180;
        glow(c, x, y, 9 + (urgent && (E.t >> 2) % 2 ? 3 : 0), '#ff3a3a', 0.35, 3);
        disc(c, x, y, 5, OUTLINE); disc(c, x, y, 4, '#2a2030'); px(c, x - 2, y - 2, '#6a6080'); px(c, x - 1, y - 3, '#8a80a0');
        rect(c, x - 1, y - 6, 3, 2, '#8a80a0'); pline(c, x + 1, y - 6, x + 3, y - 9, 1, '#c8a070');
        px(c, x + 3 + ((E.t >> 1) % 2), y - 10, (E.t >> 1) % 2 ? '#ffd040' : '#ffffff');
      },
    },
  ],
  // ======================= ISLA CELESTE =======================
  cielo: [
    // ---------------- ¡GRAVEDAD LUNAR! ----------------
    //  15 s con poca gravedad (60 %): saltos enormes, caídas lentas... y los golpes te mandan más lejos.
    {
      id: 'luna', name: '¡GRAVEDAD LUNAR!', sub: '¡Saltos enormes... y vuelos más largos!', dur: 900, col: '#9ad8ff', icon: '🌙',
      warn(g, E) {
        if (E.t % 6 === 0) this.mote(g);
        if (E.t > 120 && E.t % 3 === 0) this.mote(g);
      },
      mote(g) {                                                                  // polvo de estrellas que sube despacio
        g.fx.push({ kind: 'part', ptype: 'spark', x: 40 + Math.random() * (W - 80), y: H - 20 - Math.random() * 60, vx: (Math.random() - 0.5) * 0.2, vy: -0.25 - Math.random() * 0.35, t: 0, life: 90 + Math.random() * 60 | 0, size: 1, col: Math.random() < 0.5 ? '#cfefff' : '#ffffff' });
      },
      start(g, E) { E.g0 = g.frame; },
      step(g, E) {
        if (E.t % 4 === 0) this.mote(g);
        for (const f of g.fighters) {                                           // estela suave al flotar
          if (alive(f) && !f.grounded && E.t % 5 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: f.x + (Math.random() * 6 - 3), y: f.y - 4, vx: 0, vy: 0.15, t: 0, life: 22, size: 1, col: '#9ad8ff' });
        }
        if (E.t % 240 === 120) Sfx.lunarChime();
      },
      stop(g, E) { E.relax = true; },
      drawBack(c, g, E) {
        const T = g.frame;
        let k;
        if (E.phase === 'warn') k = E.t / EVENT_WARN * 0.6;
        else if (E.phase === 'on') k = 0.6 + 0.4 * Math.min(1, E.t / 30);
        else k = Math.max(0, 1 - E.t / 50);
        if (k <= 0) return;
        rect(c, 0, 0, W, H, '#0a1240', 0.22 * k);                                // cielo de noche
        for (let i = 0; i < 46; i++) {                                           // estrellas que titilan
          const sx = (i * 97 + 31) % W, sy = (i * 53 + 7) % 120, tw = Math.sin(T * 0.08 + i * 1.7);
          if (tw > 0.2) px(c, sx, sy, tw > 0.8 ? '#ffffff' : '#bfe6ff');
        }
        glow(c, 78, 44, 46, '#cfefff', 0.12 * k, 3);                            // luna grande (aparece con el resto)
        withAlpha(c, k, () => {
          disc(c, 78, 44, 18, '#dfe8f4'); disc(c, 82, 40, 14, '#eef3fa');
          disc(c, 72, 48, 3, '#c4cfdc'); disc(c, 84, 52, 2, '#c4cfdc'); disc(c, 79, 36, 2, '#cdd7e3');
        });
      },
    },
    // ---------------- ¡TORMENTA ELÉCTRICA! ----------------
    //  12 s de rayos. Cada rayo se AVISA: una marca en el suelo y una columna que chisporrotea (1 s);
    //  luego cae y quema a quien siga debajo.
    {
      id: 'storm', name: '¡TORMENTA ELÉCTRICA!', sub: '¡Esquiva las marcas antes de que caiga el rayo!', dur: 720, col: '#ffe24a', icon: '⚡',
      WARN: 60,
      warn(g, E) { if (E.t > 60 && E.t % 50 === 0) { E.far = 6; Sfx.thunderFar(); } if (E.far > 0) E.far--; },
      start(g, E) { E.strikes = []; E.next = 30; E.far = 0; },
      ground(x, y) {                                                              // la superficie bajo (x, y)
        let best = H + 30;
        for (const s of [STAGE.main, ...STAGE.plats]) if (x >= s.x1 && x <= s.x2 && s.y >= y - 4 && s.y < best) best = s.y;
        return best;
      },
      step(g, E) {
        if (E.far > 0) E.far--;
        if (--E.next <= 0 && E.t < this.dur - this.WARN - 10) {
          const c = g.fighters.filter(f => alive(f) && !f.out);
          const n = E.t > 400 && c.length > 1 ? 2 : 1;                          // al final, de dos en dos
          for (let i = 0; i < n && c.length; i++) {
            const f = c.splice(Math.random() * c.length | 0, 1)[0];
            const x = clamp(f.x + (Math.random() * 20 - 10) + (f.vx || 0) * 12, 20, W - 20);
            E.strikes.push({ x: Math.round(x), y: this.ground(x, f.y), t: 0, hit: [] });
          }
          Sfx.zapWarn();
          E.next = E.t > 400 ? 52 : 68;
        }
        for (const s of E.strikes) {
          s.t++;
          if (s.t === this.WARN) {                                               // ¡CAE!
            g.shake = Math.max(g.shake, 7); E.flash = 5; Sfx.thunder();
            for (const f of g.fighters) {
              if (!alive(f) || f.invuln > 0 || Math.abs(f.x - s.x) > 12 || f.y > s.y + 4) continue;
              evHit(g, f, { d: 14, b: 5.4, g: 1.0, ang: 72 }, sgn(f.x - s.x) || (Math.random() < 0.5 ? -1 : 1));
              s.hit.push(g.fighters.indexOf(f));
            }
            for (let i = 0; i < 8; i++) g.fx.push({ kind: 'part', ptype: 'spark', x: s.x, y: Math.min(s.y, H) - 1, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, t: 0, life: 16, size: 1, col: i % 2 ? '#ffe24a' : '#ffffff' });
            g.burst(s.x, Math.min(s.y, H) - 2, 3, 'smoke');
          }
        }
        E.strikes = E.strikes.filter(s => s.t < this.WARN + 40);
        if (E.flash > 0) E.flash--;
      },
      zapped(g, E, f) {                                                           // ¿le acaba de caer un rayo?
        if (!E.strikes) return false;
        const i = g.fighters.indexOf(f);
        return E.strikes.some(s => s.t >= this.WARN && s.t < this.WARN + 34 && s.hit.includes(i));
      },
      danger(f, E) {                                                              // marca cercana sin caer aún (para la CPU)
        if (!E.strikes) return null;
        for (const s of E.strikes) if (s.t < this.WARN && Math.abs(f.x - s.x) < 26 && f.y <= s.y + 4) return s;
        return null;
      },
      drawBack(c, g, E) {
        let k;
        if (E.phase === 'warn') k = E.t / EVENT_WARN * 0.7;
        else if (E.phase === 'on') k = 0.7 + 0.3 * Math.min(1, E.t / 20);
        else k = Math.max(0, 1 - E.t / 50);
        if (k <= 0) return;
        rect(c, 0, 0, W, H, '#0c0820', 0.5 * k);                                // cielo de tormenta
        const T = g.frame, CW = W * 2;
        // dos capas de nubarrones (lejos: más azuladas y lentas; cerca: oscuras y rápidas) que bajan durante el aviso
        const back = stormClouds('b', 11, 44, 26, 20, ['#5d5296', '#3a3070', '#2a2256', '#1e1842', '#8a80c8']);
        const front = stormClouds('f', 29, 36, 12, 18, ['#4a3f80', '#2a2150', '#1c1638', '#120d26', '#7a6eb8']);
        const backL = stormClouds('bl', 11, 44, 26, 20, ['#c8c0ff', '#8a7ed8', '#6a5eb8', '#4e4494', '#ffffff']);
        const frontL = stormClouds('fl', 29, 36, 12, 18, ['#b0a6f4', '#7466c4', '#54489e', '#3c3278', '#ffffff']);
        const drop = Math.round(-80 * (1 - Math.min(1, k * 1.25)));
        const flash = Math.max(E.flash ? E.flash / 5 : 0, E.far ? E.far / 6 * 0.7 : 0);
        const bx = Math.round(T * 0.25) % CW, fx2 = Math.round(T * 0.6) % CW;
        for (const [img, lit, ox, oy] of [[back, backL, bx, drop + 6], [front, frontL, fx2, drop]]) {
          c.drawImage(img, -ox, oy); c.drawImage(img, CW - ox, oy);
          if (flash > 0) withAlpha(c, flash, () => { c.drawImage(lit, -ox, oy); c.drawImage(lit, CW - ox, oy); });   // el relámpago ilumina las nubes
        }
        // relámpagos dentro de las nubes (destellos que parpadean)
        const ph = (T * 7) % 113;
        if (ph < 6 && E.phase !== 'end') {
          const cx = (T * 37) % W, cy = 22 + drop + (T % 3) * 6;
          glow(c, cx, cy, 26, '#c8c0ff', 0.25 * (ph % 2 ? 1 : 0.5), 3);
          if (ph % 2) { pline(c, cx, cy - 6, cx + 5, cy, 1, '#fff6d0'); pline(c, cx + 5, cy, cx + 1, cy + 6, 1, '#fff6d0'); }
        }
      },
      drawFront(c, g, E) {
        const T = g.frame;
        // lluvia
        let k = E.phase === 'on' ? 1 : E.phase === 'warn' ? E.t / EVENT_WARN : Math.max(0, 1 - E.t / 50);
        if (k > 0) withAlpha(c, k, () => {
          for (let i = 0; i < 70; i++) {                                         // lejos: gotas cortas y tenues
            const x = (i * 71 + T * 2) % (W + 40) - 20, y = (i * 37 + T * 6) % (H + 20) - 10;
            rect(c, Math.round(x), Math.round(y), 1, 3, '#6f78b8', 0.45);
          }
          for (let i = 0; i < 55; i++) {                                         // cerca: trazos largos con punta brillante
            const x = (i * 97 + T * 4) % (W + 40) - 20, y = (i * 53 + T * 11) % (H + 30) - 15;
            pline(c, Math.round(x), Math.round(y), Math.round(x - 3), Math.round(y + 8), 1, '#8e9ad8');
            px(c, Math.round(x - 3), Math.round(y + 8), '#d8e0ff');
          }
          for (const s of [STAGE.main, ...STAGE.plats]) {                       // salpicaduras en el suelo
            const w = s.x2 - s.x1;
            for (let i = 0; i < w / 16; i++) {
              const ph = (T + i * 13 + s.x1) % 18; if (ph > 5) continue;
              const sx = s.x1 + ((i * 37 + (T / 18 | 0) * 11 + s.x1) % w);
              if (ph < 2) px(c, sx, s.y - 1, '#d8e0ff');
              else { px(c, sx - ph + 1, s.y - 2, '#a8b4f0'); px(c, sx + ph - 1, s.y - 2, '#a8b4f0'); }
            }
          }
        });
        if (!E.strikes) return;
        for (const s of E.strikes) {
          const gy = Math.min(s.y, H);
          if (s.t < this.WARN) {                                                 // AVISO: marca + columna que chisporrotea
            const q = s.t / this.WARN, blink = (s.t >> (q > 0.6 ? 1 : 2)) % 2;
            withAlpha(c, 0.25 + 0.35 * q, () => rect(c, s.x - 11, 0, 23, gy, '#ffe24a', 0.12 + 0.1 * blink));
            rect(c, s.x - 12, gy - 1, 25, 2, blink ? '#ffffff' : '#ffe24a');
            rect(c, s.x - 8 + Math.round(4 * q), gy - 3, 17 - Math.round(8 * q), 1, '#ffe24a');
            if (blink) for (let y = 4; y < gy; y += 9) px(c, s.x + ((y * 13 + T) % 7) - 3, y, '#fff6b0');
          } else {                                                               // EL RAYO
            const a = s.t - this.WARN; if (a > 10) continue;
            const w = a < 3 ? 1 : 0.7 - a * 0.06;
            glow(c, s.x, gy - 10, 30, '#ffe24a', 0.4 * w, 3);
            withAlpha(c, Math.max(0, w), () => {
              let x = s.x, y = 0;
              while (y < gy) {
                const ny = Math.min(gy, y + 10 + ((s.x * 7 + y * 3) % 8)), nx = s.x + (((y * 31 + s.x) % 11) - 5);
                pline(c, x, y, nx, ny, 4, '#ffe24a'); pline(c, x, y, nx, ny, 2, '#ffffff');
                x = nx; y = ny;
              }
              ring(c, s.x, gy - 2, 6 + a * 3, '#fff6b0');
            });
          }
        }
      },
      drawScreen(c, g, E) { if (E.flash > 0) rect(c, 0, 0, W, H, '#e8e4ff', 0.045 * E.flash); },
    },
  ],
  // ======================= GLACIAR BOREAL =======================
  hielo: [
    // ---------------- ¡VENTISCA! ----------------
    //  12 s de viento helado en UNA dirección (anunciada): empuja a todos, más en el aire. Cuidado con el borde.
    {
      id: 'ventisca', name: '¡VENTISCA!', col: '#bfe8ff', icon: '🌬', dur: 720,
      subOf(E) { return E.dir > 0 ? '¡El viento te empuja a la DERECHA!' : '¡El viento te empuja a la IZQUIERDA!'; },
      warn(g, E) {
        if (E.dir == null) E.dir = Math.random() < 0.5 ? -1 : 1;
        if (E.t % 40 === 20) Sfx.gust(0.5);
      },
      gust(E) { return 0.65 + 0.35 * Math.sin(E.t * 0.045) * Math.sin(E.t * 0.017 + 1); },
      step(g, E) {
        const k = Math.min(1, E.t / 40) * this.gust(E);
        for (const f of g.fighters) {
          if (!alive(f) || f.st === 'ledge' || f.st === 'grabbed' || f.heldBy) continue;
          f.x += E.dir * k * (f.grounded ? 0.78 : 1.4);
        }
        for (const p of g.projectiles) p.x += E.dir * k * 0.6;
        if (E.t % 90 === 30) Sfx.gust(1);
      },
      // empuje hacia el borde: la CPU se resiste caminando contra el viento
      ai(f, g, E, I) {
        if (E.phase !== 'on' || !alive(f) || f.st === 'hitstun') return;
        const M = STAGE.main, edge = E.dir > 0 ? M.x2 - f.x : f.x - M.x1;
        if (f.x < M.x1 || f.x > M.x2) { I.mx = sgn((M.x1 + M.x2) / 2 - f.x); return; }   // fuera: hacia el centro
        if (edge < 56) { I.mx = -E.dir; if (I.my > 0.5) I.my = 0; }
      },
      drawBack(c, g, E) {
        const k = E.phase === 'warn' ? E.t / EVENT_WARN * 0.6 : E.phase === 'on' ? 0.6 + 0.4 * Math.min(1, E.t / 30) : Math.max(0, 1 - E.t / 50);
        if (k <= 0) return;
        rect(c, 0, 0, W, H, '#cfe2f5', 0.16 * k);                                 // blanquea el aire
        const CW = W * 2, far = snowVeil('vf', 61, 0.75), sp = E.dir * (E.phase === 'on' ? 1 : 0.4);
        E.sx1 = (E.sx1 || 0) + sp * 2.2 * (0.6 + 0.4 * this.gust(E));
        const o = ((Math.round(-E.sx1) % CW) + CW) % CW;
        withAlpha(c, 0.85 * k, () => { c.drawImage(far, -o, 0); c.drawImage(far, CW - o, 0); });
      },
      drawFront(c, g, E) {
        const k = E.phase === 'warn' ? E.t / EVENT_WARN : E.phase === 'on' ? 1 : Math.max(0, 1 - E.t / 50);
        if (k <= 0) return;
        const T = g.frame, CW = W * 2, near = snowVeil('vn', 83, 0.55), sp = E.dir * (E.phase === 'on' ? 1 : 0.4);
        E.sx2 = (E.sx2 || 0) + sp * 4.5 * (0.6 + 0.4 * this.gust(E));
        const o = ((Math.round(-E.sx2) % CW) + CW) % CW;
        withAlpha(c, 0.6 * k, () => { c.drawImage(near, -o, 0); c.drawImage(near, CW - o, 0); });
        withAlpha(c, k, () => {                                                    // copos arrastrados (dos profundidades)
          for (let i = 0; i < 120; i++) {
            const depth = i % 3 === 0, v = depth ? 7 : 4;
            const x = (((i * 61 + T * v * E.dir) % (W + 30)) + W + 30) % (W + 30) - 15;
            const y = (i * 43 + Math.sin(T * 0.05 + i) * 6 + T * (depth ? 1.2 : 0.6)) % H;
            const len = depth ? 6 : 3;
            rect(c, Math.round(E.dir > 0 ? x - len : x), Math.round(y), len, 1, depth ? '#ffffff' : '#cfe2f5', depth ? 0.9 : 0.55);
            if (depth) px(c, Math.round(x), Math.round(y), '#ffffff');
          }
        });
        for (const f of g.fighters) {                                              // nieve que se levanta a los pies
          if (E.phase === 'on' && alive(f) && f.grounded && (T + f.pal.main.length) % 6 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: f.x - E.dir * 4, y: f.y - 2, vx: E.dir * 1.6, vy: -0.4, t: 0, life: 18, size: 1, col: '#eef7ff' });
        }
      },
      drawScreen(c, g, E) {
        const k = E.phase === 'warn' ? E.t / EVENT_WARN : E.phase === 'on' ? 1 : Math.max(0, 1 - E.t / 50);
        if (k > 0) withAlpha(c, 0.85 * k, () => c.drawImage(frostFrame(), 0, 0));   // la pantalla se escarcha
        if (E.phase === 'warn' && E.t > 10) {                                      // flechas del viento bajo el cartel
          for (let i = 0; i < 9; i++) {
            const x = Math.round(((i * 36 + E.t * 2 * E.dir) % (W + 36) + W + 36) % (W + 36) - 18), y = 114;
            const a = 0.5 + 0.5 * Math.sin(i + E.t * 0.2);
            withAlpha(c, a, () => { pline(c, x - 4 * E.dir, y - 5, x, y, 2, '#e6f8ff'); pline(c, x - 4 * E.dir, y + 5, x, y, 2, '#e6f8ff'); });
          }
        }
      },
    },
    // ---------------- ¡LLUVIA DE HIELO! ----------------
    //  10 s de bloques de hielo cayendo. Cada uno se AVISA: su sombra crece en el suelo (y brilla arriba);
    //  al caer pega 10 % y congela un momento a quien siga debajo.
    {
      id: 'granizo', name: '¡LLUVIA DE HIELO!', sub: '¡Fíjate en las sombras y apártate!', dur: 600, col: '#86c4f0', icon: '🧊',
      WARN: 56, FALL: 16,
      warn(g, E) { if (E.t % 30 === 0) Sfx.iceTinkle(); },
      start(g, E) { E.chunks = []; E.next = 20; },
      ground(x, y) {
        let best = H + 30;
        for (const s of [STAGE.main, ...STAGE.plats]) if (x >= s.x1 && x <= s.x2 && s.y >= y - 4 && s.y < best) best = s.y;
        return best;
      },
      step(g, E) {
        if (--E.next <= 0 && E.t < this.dur - this.WARN - 6) {
          const c = g.fighters.filter(f => alive(f) && !f.out), M = STAGE.main;
          let x, y;
          if (c.length && Math.random() < 0.6) { const f = c[Math.random() * c.length | 0]; x = f.x + (Math.random() * 30 - 15); y = f.y; }
          else { x = M.x1 + 10 + Math.random() * (M.x2 - M.x1 - 20); y = -50; }
          x = Math.round(clamp(x, 16, W - 16));
          E.chunks.push({ x, y: this.ground(x, y), t: 0, size: Math.random() * 3 | 0, hit: [] });
          E.next = E.t > 300 ? 14 : 22;
        }
        for (const s of E.chunks) {
          s.t++;
          if (s.t === this.WARN - this.FALL) Sfx.iceWhistle();
          if (s.t === this.WARN) {                                                 // ¡CHOCA!
            const gy = Math.min(s.y, H);
            g.shake = Math.max(g.shake, 3 + s.size); Sfx.iceShatter(s.size);
            for (const f of g.fighters) {
              if (!alive(f) || f.invuln > 0 || Math.abs(f.x - s.x) > 9 + s.size * 2 || f.y > s.y + 4 || f.y < gy - 60) continue;
              evHit(g, f, { d: 9 + s.size, b: 4.4, g: 0.85, ang: 80 }, sgn(f.x - s.x) || 1);
              if (f.st === 'hitstun') { f.frozen = Math.max(f.frozen || 0, 34); f.stun = Math.max(f.stun || 0, 34); f.lvx *= 0.4; f.lvy *= 0.4; }
              s.hit.push(g.fighters.indexOf(f));
            }
            for (let i = 0; i < 10 + s.size * 4; i++) g.fx.push({ kind: 'part', ptype: 'spark', x: s.x + (Math.random() * 6 - 3), y: gy - 2, vx: (Math.random() - 0.5) * 4.5, vy: -0.6 - Math.random() * 2.6, t: 0, life: 18 + Math.random() * 10 | 0, size: Math.random() < 0.3 ? 2 : 1, col: ICE_EV[3 + (i % 3)] });
            g.burst(s.x, gy - 2, 2, 'smoke');
          }
        }
        E.chunks = E.chunks.filter(s => s.t < this.WARN + 30);
      },
      danger(f, E) {
        if (!E.chunks) return null;
        for (const s of E.chunks) if (s.t < this.WARN && Math.abs(f.x - s.x) < 22 && f.y <= s.y + 4) return s;
        return null;
      },
      drawBack(c, g, E) {
        const k = E.phase === 'warn' ? E.t / EVENT_WARN : E.phase === 'on' ? 1 : Math.max(0, 1 - E.t / 50);
        if (k > 0) rect(c, 0, 0, W, H, '#0b1b44', 0.22 * k);                      // cielo encapotado
        if (!E.chunks) return;
        for (const s of E.chunks) {                                                // sombras que crecen en el suelo
          if (s.t >= this.WARN || s.y > H) continue;
          const q = s.t / this.WARN, rx = Math.round(4 + (8 + s.size * 3) * q), blink = q > 0.65 && (s.t >> 1) % 2;
          // sombra ovalada en 3 tonos sobre la superficie (crece mientras el hielo se acerca)
          for (let yy = -2; yy <= 1; yy++) {
            const hw = Math.round(rx * [0.55, 0.85, 1, 0.7][yy + 2]);
            rect(c, s.x - hw, s.y - 1 + yy, hw * 2 + 1, 1, '#061030', 0.5 + 0.4 * q);
            if (hw > 3) rect(c, s.x - hw + 2, s.y - 1 + yy, Math.round(hw * 0.7), 1, '#0b1b44', 0.6);   // núcleo un poco más claro a la izquierda (luz de la luna)
          }
          // marco de escarcha que parpadea en los extremos y en el centro
          const mc = blink ? '#ffffff' : '#86c4f0';
          px(c, s.x - rx - 1, s.y - 1, mc); px(c, s.x + rx + 1, s.y - 1, mc); px(c, s.x - rx - 2, s.y - 1, '#3a7cc2'); px(c, s.x + rx + 2, s.y - 1, '#3a7cc2');
          if (q > 0.35) { px(c, s.x, s.y - 4, mc); px(c, s.x - 1, s.y - 3, '#3a7cc2'); px(c, s.x + 1, s.y - 3, '#3a7cc2'); }
        }
      },
      drawFront(c, g, E) {
        const T = g.frame;
        if (!E.chunks) return;
        for (const s of E.chunks) {
          const gy = Math.min(s.y, H);
          if (s.t < this.WARN - this.FALL) {                                       // destello arriba: de ahí caerá
            const q = s.t / (this.WARN - this.FALL), on = (s.t >> 2) % 2;
            if (on) { px(c, s.x, 3, '#ffffff'); px(c, s.x - 1, 3, '#b6e2fa'); px(c, s.x + 1, 3, '#b6e2fa'); px(c, s.x, 2, '#b6e2fa'); px(c, s.x, 4, '#b6e2fa'); }
            if (q > 0.5 && (s.t + s.x) % 5 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: s.x + (Math.random() * 4 - 2), y: 6, vx: 0, vy: 1.5, t: 0, life: 24, size: 1, col: '#e6f8ff' });
          } else if (s.t < this.WARN) {                                            // cayendo (acelera)
            const q = (s.t - (this.WARN - this.FALL)) / this.FALL, img = iceChunk(s.size);
            const y = Math.round(-img.height + (gy + 2) * q * q);
            for (let i = 1; i <= 3; i++) rect(c, s.x - 1, y - i * 7, 2, 5, '#e6f8ff', 0.25 / i);   // estela
            c.drawImage(img, Math.round(s.x - img.width / 2), y - img.height + 4);
          } else {                                                                 // anillo de escarcha al estallar
            const a = s.t - this.WARN; if (a > 14) continue;
            withAlpha(c, 1 - a / 14, () => { ring(c, s.x, gy - 1, 4 + a * 2, '#e6f8ff'); });
          }
        }
      },
    },
  ],
  // ======================= TEMPLO DEL EQUILIBRIO =======================
  balanza: [
    // ---------------- ¡BALANZA ENLOQUECIDA! ----------------
    //  12 s en los que la balanza no obedece al peso: se columpia sola, cada vez más rápido,
    //  y el plato que sube de golpe CATAPULTA a quien esté encima.
    {
      id: 'loca', name: '¡BALANZA ENLOQUECIDA!', sub: '¡Los platos se vuelven catapultas!', dur: 720, col: '#ffd96a', icon: '⚖',
      warn(g, E) {
        const B = g.stage.bal; if (!B) return;
        if (E.t > 60) B.v += Math.sin(E.t * 0.9) * 0.25;                       // tiembla
        if (E.t % 45 === 0) Sfx.creak(0.5);
      },
      start(g, E) { E.side = Math.random() < 0.5 ? -1 : 1; E.flip = 40; E.top = false; },
      step(g, E) {
        const B = g.stage.bal; if (!B) return;
        if (--E.flip <= 0) {                                                       // cambia de lado (cada vez más seguido)
          E.side = -E.side;
          E.flip = E.t > 480 ? 46 : E.t > 240 ? 62 : 80;
          if (Math.random() < 0.2) E.flip = 34;
          Sfx.creak(1);
        }
        B.force = E.side * (B.max - 2);
        // ¿llegó un plato arriba de golpe? catapulta a quien esté encima
        const atTop = Math.abs(B.d) >= B.max - 4;
        if (atTop && !E.top) {                                                   // (acaba de llegar arriba)
          const up = B.d > 0 ? g.stage.R : g.stage.L;                            // d>0: baja el izquierdo, sube el derecho
          let any = false;
          for (const f of g.fighters) {
            if (!alive(f) || !f.grounded || f.plat !== up) continue;
            f.grounded = false; f.plat = null; f.y -= 2; f.vy = -7.2; f.dropT = 10; f.setSt('air');
            f.jumps = Math.max(f.jumps, 1); any = true;
            for (let i = 0; i < 6; i++) g.fx.push({ kind: 'part', ptype: 'spark', x: f.x + (Math.random() * 10 - 5), y: f.y, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(), t: 0, life: 14, size: 1, col: TGOLD.l });
          }
          if (any) { Sfx.catapult(); g.shake = Math.max(g.shake, 4); }
          E.launch = { pan: up === g.stage.R ? 1 : -1, t: 0 };
        }
        E.top = atTop;
        if (E.launch) E.launch.t++;
      },
      stop(g) { if (g.stage.bal) g.stage.bal.force = null; },
      drawBack(c, g, E) {
        const B = g.stage.bal; if (!B) return;
        const T = g.frame, P = B.pivot, k = E.phase === 'warn' ? E.t / EVENT_WARN : E.phase === 'on' ? 1 : Math.max(0, 1 - E.t / 40);
        if (k <= 0) return;
        const lx = P.x - B.arm, ly = P.y + B.d, rx = P.x + B.arm, ry = P.y - B.d;
        glow(c, P.x, P.y, 40 + 6 * Math.sin(T * 0.2), '#ff5fb0', 0.18 * k, 3);
        // anillo de runas que gira alrededor del eje (y otro más pequeño al revés)
        withAlpha(c, k, () => {
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2 + T * 0.03, xx = Math.round(P.x + Math.cos(a) * 30), yy = Math.round(P.y + Math.sin(a) * 30);
            drawRune(c, xx, yy, i, (T >> 2) % 10 === i ? TGOLD.hi : TGOLD.m, TGOLD.l);
          }
          for (let i = 0; i < 16; i++) { const a = -i / 16 * Math.PI * 2 - T * 0.05; px(c, Math.round(P.x + Math.cos(a) * 15), Math.round(P.y + Math.sin(a) * 15), i % 2 ? '#ff9ad0' : TGOLD.l); }
        });
        // el brazo brilla con energía rosa
        withAlpha(c, 0.55 * k * (0.7 + 0.3 * Math.sin(T * 0.4)), () => { pline(c, lx, ly - 3, rx, ry - 3, 1, '#ff9ad0'); pline(c, lx, ly + 3, rx, ry + 3, 1, '#ff5fb0'); });
        // la gema del eje late
        if ((T >> 2) % 2) { disc(c, P.x, P.y, 3, '#ff5f6d'); px(c, P.x - 1, P.y - 1, '#ffffff'); }
        // chispas de energía por el brazo y las cadenas
        if (E.phase !== 'end') for (let i = 0; i < 3; i++) {
          const s = ((T * 0.07 + i / 3) % 1), xx = lerp(lx, rx, s), yy = lerp(ly, ry, s);
          px(c, Math.round(xx), Math.round(yy) - 1, '#ffffff'); px(c, Math.round(xx) - 1, Math.round(yy) - 1, '#ff9ad0');
        }
        for (const [p, ex, ey] of [[g.stage.L, lx, ly], [g.stage.R, rx, ry]]) {   // aura en el borde de cada plato
          withAlpha(c, 0.5 * k * (0.6 + 0.4 * Math.sin(T * 0.3)), () => { rect(c, p.x1 - 1, Math.round(p.y) - 2, p.x2 - p.x1 + 2, 1, '#ff9ad0'); });
          if ((T + ex) % 9 < 3) px(c, Math.round(lerp(ex, (p.x1 + p.x2) / 2, ((T % 20) / 20))), Math.round(lerp(ey, p.y, ((T % 20) / 20))), '#fff3b8');
        }
        // destello del plato que catapulta
        if (E.launch && E.launch.t < 14) {
          const p = E.launch.pan > 0 ? g.stage.R : g.stage.L, q = E.launch.t / 14;
          withAlpha(c, 1 - q, () => { for (let i = 0; i < 5; i++) { const xx = Math.round(lerp(p.x1 + 6, p.x2 - 6, i / 4)); pline(c, xx, Math.round(p.y) - 3, xx, Math.round(p.y) - 3 - Math.round(14 * (1 - q)), 1, TGOLD.hi); } });
        }
      },
    },
    // ---------------- ¡ESPÍRITUS GUARDIANES! ----------------
    //  12 s: dos espíritus del templo persiguen a quien va ganando. Antes de cazar se MATERIALIZAN (1 s, con
    //  un círculo de runas); son algo más lentos que tú. Si te alcanzan te POSEEN: te alzan inmóvil mientras
    //  las runas se cierran a tu alrededor... y estallan (15 % y un buen vuelo). Luego vuelven a formarse.
    {
      id: 'espiritus', name: '¡ESPÍRITUS GUARDIANES!', sub: '¡Persiguen al que va ganando! ¡Que no te atrapen!', dur: 720, col: '#6fe0cc', icon: '👻',
      FORM: 60, HOLD: 50,
      warn(g, E) { if (E.t % 50 === 25) Sfx.spiritWhisper(); },
      leaders(g) {
        const c = g.fighters.filter(f => alive(f) && !f.out);
        return c.sort((a, b) => (b.stocks - a.stocks) || (a.dmg - b.dmg));
      },
      spawnAt(g, s) {
        const T = this.leaders(g)[s.rank] || this.leaders(g)[0];
        const side = T && T.x < W / 2 ? 1 : -1;
        s.x = T ? clamp(T.x + side * (70 + Math.random() * 40), 30, W - 30) : W / 2; s.y = T ? clamp(T.y - 50 - Math.random() * 30, 30, 140) : 80;
        s.form = this.FORM; Sfx.spiritAppear();
      },
      start(g, E) {
        E.spirits = [0, 1].map(rank => ({ rank, x: 0, y: 0, form: 0, cd: 0, vx: 0, vy: 0, dir: 1 }));
        for (const s of E.spirits) this.spawnAt(g, s);
      },
      step(g, E) {
        const L = this.leaders(g);
        for (const s of E.spirits) {
          if (s.cd > 0) { if (--s.cd === 0) this.spawnAt(g, s); continue; }
          if (s.grab) { this.possess(g, E, s); continue; }
          if (s.form > 0) { s.form--; continue; }                                  // materializándose: aún no hace daño
          const T = L[s.rank] || L[0]; if (!T) continue;
          const tx = T.x, ty = T.y - T.S.hh / 2, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
          const sp = 1.3 + (E.t > 480 ? 0.3 : 0);                                 // algo más lento que caminar (2.3)
          s.vx += (dx / d * sp - s.vx) * 0.08; s.vy += (dy / d * sp - s.vy) * 0.08;
          s.x += s.vx; s.y += s.vy + Math.sin(g.frame * 0.08 + s.rank * 3) * 0.3; s.dir = sgn(s.vx) || s.dir;
          if (g.frame % 4 === s.rank * 2) g.fx.push({ kind: 'part', ptype: 'spark', x: s.x + (Math.random() * 12 - 6), y: s.y + 4 + Math.random() * 8, vx: -s.vx * 0.3, vy: -0.3, t: 0, life: 22, size: 1, col: Math.random() < 0.5 ? SPIRIT.l : SPIRIT.hi });   // estela de luz
          if (g.frame % 70 === s.rank * 35) Sfx.spiritWhisper();
          for (const f of g.fighters) {                                            // ¡te alcanzó!
            if (!alive(f) || f.invuln > 0 || f.st === 'grabbed' || E.spirits.some(o => o.grab && o.grab.f === f)) continue;
            if (Math.abs(f.x - s.x) < 9 + f.S.hw && Math.abs(f.y - f.S.hh / 2 - s.y) < 8 + f.S.hh / 2) {
              s.grab = { f, t: 0, dir: sgn(f.x - s.x) || s.dir };               // ¡TE ATRAPÓ!
              if (f.holding) f.releaseHeld(1);
              f.vx = f.vy = f.lvx = f.lvy = 0; f.hitlag = this.HOLD + 2;
              g.shake = Math.max(g.shake, 4); Sfx.spiritGrab();
              break;
            }
          }
        }
        for (const s of E.spirits) if (s.burst) s.burst.t++;
      },
      // posesión: el espíritu envuelve a la víctima, la alza y... ¡estalla!
      possess(g, E, s) {
        const G = s.grab, f = G.f; G.t++;
        if (!alive(f)) { s.grab = null; s.cd = 60; return; }
        f.hitlag = Math.max(f.hitlag, 2); f.vx = f.vy = f.lvx = f.lvy = 0;
        if (G.t < 40) f.y -= 0.35;                                                 // la alza poco a poco
        s.x += (f.x - s.x) * 0.3; s.y += (f.y - f.S.hh / 2 - s.y) * 0.3;
        if (G.t % 3 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: f.x + (Math.random() * 20 - 10), y: f.y - Math.random() * f.S.hh, vx: 0, vy: -0.8, t: 0, life: 18, size: 1, col: Math.random() < 0.5 ? SPIRIT.l : TGOLD.l });
        if (G.t === 30) Sfx.spiritRise();
        if (G.t < this.HOLD) return;
        // ¡ESTALLA!
        f.hitlag = 0;
        evHit(g, f, { d: 15, b: 6.2, g: 1.65, ang: 72 }, G.dir);
        f.hitlag = Math.max(f.hitlag, 10);
        g.shake = Math.max(g.shake, 12); Sfx.spiritBurst(); Sfx.bigImpact();
        duoRadial(g, f.x, f.y - f.S.hh / 2, 36, [SPIRIT.l, SPIRIT.hi, TGOLD.l, '#ffffff'], 3);
        for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; g.fx.push({ kind: 'part', ptype: 'spark', x: f.x, y: f.y - f.S.hh / 2, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, t: 0, life: 24, size: i % 4 ? 1 : 2, col: i % 3 ? SPIRIT.l : TGOLD.l }); }
        s.burst = { x: f.x, y: f.y - f.S.hh / 2, t: 0, big: true };
        s.grab = null; s.cd = 100;
      },
      possessed(g, f) { const E = g.ev; return !!(E && E.spirits && E.spirits.some(s => s.grab && s.grab.f === f)); },
      danger(f, E) {
        if (!E.spirits) return null;
        for (const s of E.spirits) if (!s.cd && !s.grab && Math.abs(f.x - s.x) < 46 && Math.abs(f.y - 10 - s.y) < 46) return s;
        return null;
      },
      drawBack(c, g, E) {
        const k = E.phase === 'warn' ? E.t / EVENT_WARN : E.phase === 'on' ? 1 : Math.max(0, 1 - E.t / 50);
        if (k > 0) rect(c, 0, 0, W, H, '#1e1036', 0.28 * k);                      // el atardecer se apaga: hora de los espíritus
        if (k > 0) for (let i = 0; i < 18; i++) {                                  // luciérnagas turquesa
          const x = (i * 83 + Math.sin(g.frame * 0.02 + i) * 20 + g.frame * 0.2) % W, y = 40 + (i * 37 + Math.sin(g.frame * 0.03 + i * 2) * 10) % 150;
          if ((g.frame + i * 7) % 40 < 30) px(c, Math.round(x), Math.round(y), i % 2 ? SPIRIT.l : SPIRIT.hi, k);
        }
      },
      drawFront(c, g, E) {
        if (!E.spirits) return;
        const T = g.frame;
        for (const s of E.spirits) {
          if (s.burst && s.burst.t < 22) withAlpha(c, 1 - s.burst.t / 22, () => {
            const bx = Math.round(s.burst.x), by = Math.round(s.burst.y);
            ring(c, bx, by, 6 + s.burst.t * 4, SPIRIT.hi); ring(c, bx, by, 3 + s.burst.t * 3, TGOLD.l);
            if (s.burst.t < 6) glow(c, bx, by, 40, SPIRIT.hi, 0.5, 3);
          });
          if (s.cd > 0) continue;
          if (s.grab) {                                                           // POSESIÓN: runas que se cierran + el espíritu envuelve
            const G = s.grab, f = G.f, q = Math.min(1, G.t / this.HOLD), cx = Math.round(f.x), cy = Math.round(f.y - f.S.hh / 2);
            glow(c, cx, cy, 26 + 8 * q, SPIRIT.l, 0.25 + 0.25 * q, 3);
            for (let i = 0; i < 8; i++) {
              const a = i / 8 * Math.PI * 2 + T * (0.08 + q * 0.25), r = 34 - 20 * q;
              drawRune(c, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), i, q > 0.7 && (T >> 1) % 2 ? TGOLD.hi : TGOLD.m, TGOLD.hi);
            }
            for (let i = 0; i < 3; i++) {                                         // cintas de luz que la envuelven
              const a = T * 0.2 + i * 2.1;
              pline(c, Math.round(cx + Math.cos(a) * 12), Math.round(cy + Math.sin(a) * 14), Math.round(cx + Math.cos(a + 0.9) * 12), Math.round(cy + Math.sin(a + 0.9) * 14), 1, SPIRIT.hi);
            }
            drawSpirit(c, cx - G.dir * 4, cy - f.S.hh / 2 - 4, T, 0.9, G.dir, true);
            continue;
          }
          if (s.form > 0) {                                                        // AVISO: círculo de runas y el espíritu aparece
            const q = 1 - s.form / this.FORM;
            withAlpha(c, 0.4 + 0.6 * q, () => {
              for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + T * 0.06; drawRune(c, Math.round(s.x + Math.cos(a) * 18 * (1.4 - q * 0.4)), Math.round(s.y + Math.sin(a) * 18 * (1.4 - q * 0.4)), i, SPIRIT.m, SPIRIT.hi); }
            });
            if ((T >> 1) % 2 || q > 0.6) drawSpirit(c, s.x, s.y, T, q * 0.8, s.dir, false);
            continue;
          }
          drawSpirit(c, s.x, s.y + Math.sin(T * 0.1 + s.rank) * 1.5, T, E.phase === 'end' ? Math.max(0, 1 - E.t / 30) : 1, s.dir, true);
        }
      },
    },
  ],
};

const EventSys = {
  list(g) { return g && g.cfg && g.cfg.events !== false && !g.cfg.practice && !g.cfg.tutorial ? STAGE_EVENTS[g.stage.id] : null; },
  def(id) { for (const k in STAGE_EVENTS) for (const d of STAGE_EVENTS[k]) if (d.id === id) return d; return null; },
  // cada fotograma de la pelea (solo el anfitrión simula)
  step(g) {
    const L = this.list(g);
    if (!L || g.phase !== 'play' || g.sd) { if (g.ev) this.clear(g); return; }
    if (!g.ev) {
      if (g.evNext == null) g.evNext = EVENT_FIRST;
      if (--g.evNext > 0) return;
      const pool = L.length > 1 && g.evLast ? L.filter(d => d.id !== g.evLast || Math.random() < 0.3) : L;   // mejor no repetir
      const D = pool[Math.random() * pool.length | 0];
      g.ev = { id: D.id, phase: 'warn', t: 0 }; g.evLast = D.id;
      Sfx.alarm();
      return;
    }
    const E = g.ev, D = this.def(E.id); E.t++;
    if (E.phase === 'warn') {
      if (D.warn) D.warn(g, E);
      if (E.t >= EVENT_WARN) { E.phase = 'on'; E.t = 0; Sfx.eventGo(); if (D.start) D.start(g, E); }
    } else if (E.phase === 'on') {
      if (D.step) D.step(g, E);
      if (E.t >= D.dur) { E.phase = 'end'; E.t = 0; if (D.stop) D.stop(g, E); if (!E.abort) Sfx.eventEnd(); }
    } else if (E.t >= 60) { g.ev = null; g.evNext = EVENT_GAP[0] + (Math.random() * (EVENT_GAP[1] - EVENT_GAP[0]) | 0); }
    g.evGrav = this.grav(g);
  },
  // ¡GRAVEDAD LUNAR!: multiplica la gravedad (baja y sube suave en medio segundo)
  grav(g) {
    const E = g.ev; if (!E || E.id !== 'luna') return 1;
    if (E.phase === 'on') return 1 - 0.4 * Math.min(1, E.t / 30);
    if (E.phase === 'end') return 0.6 + 0.4 * Math.min(1, E.t / 30);
    return 1;
  },
  // ¿le acaba de caer un rayo? (parpadea en amarillo)
  possessed(g, f) { const E = g.ev; return !!(E && E.id === 'espiritus' && this.def('espiritus').possessed(g, f)); },
  zapped(g, f) { const E = g.ev; if (!E || E.id !== 'storm') return false; return this.def('storm').zapped(g, E, f); },
  clear(g) { g.ev = null; g.evGrav = 1; if (g.stage && g.stage.bal) g.stage.bal.force = null; },
  onHit(g, a, d) { const E = g.ev; if (!E) return; const D = this.def(E.id); if (D && D.onHit) D.onHit(g, E, a, d); },
  holder(g) { return g.ev && g.ev.id === 'papa' && g.ev.phase === 'on' ? g.ev.holder : null; },
  // ¿qué evento suena ahora? (para la música)
  playing(g) { return g && g.ev && g.ev.phase === 'on' ? g.ev.id : null; },
  // dibujo
  drawBack(c, g) { const E = g.ev; if (!E) return; const D = this.def(E.id); if (D && D.drawBack) D.drawBack(c, g, E); },
  drawFront(c, g) { const E = g.ev; if (!E) return; const D = this.def(E.id); if (D && D.drawFront) D.drawFront(c, g, E); },
  // franja del aviso (en pantalla)
  drawScreen(c, g) {
    const E = g.ev; if (!E) return;
    if (this.def(E.id).drawScreen) this.def(E.id).drawScreen(c, g, E);
    if (E.phase !== 'warn') return;
    const D = this.def(E.id), k = Math.min(1, E.t / 10, (EVENT_WARN - E.t) / 10), h = Math.round(46 * k), y = 58;
    rect(c, 0, y, W, h, '#0c0a24', 0.6);
    for (let x = -20; x < W + 20; x += 16) { const o = (E.t * 2) % 16; rect(c, x + o, y, 8, 2, D.col, 0.9 * k); rect(c, x - o, y + h - 2, 8, 2, D.col, 0.9 * k); }   // franjas de peligro en movimiento
  },
  text(t, g) {
    const E = g.ev; if (!E) return;
    const D = this.def(E.id);
    if (E.phase === 'warn') {
      const pop = E.t < 8 ? 1 + (8 - E.t) * 0.12 : 1, blink = (E.t >> 3) % 2;
      t.text(D.name, W / 2, 64, Math.round((D.name.length > 20 ? 19 : 24) * pop), blink ? D.col : '#ffffff', 'center');   // (los nombres largos, algo más pequeños para que quepan)
      if (E.t > 10) t.text(D.subOf ? D.subOf(E) : D.sub, W / 2, 92, 8, '#ffd34a', 'center');
      t.text('en ' + Math.ceil((EVENT_WARN - E.t) / 60) + '…', W / 2, 102, 8, '#ffffff', 'center');
    } else if (E.phase === 'on') {
      const left = Math.ceil((D.dur - E.t) / 60);
      t.text(`${D.name}  ${left}`, W / 2, 28, 8, (E.t >> 4) % 2 ? D.col : '#ffffff', 'center');
      const h = this.holder(g);
      if (h && alive(h)) {                                                      // la cuenta atrás sobre la bomba
        const urgent = left <= 3, x = clamp(h.x, 20, W - 20), y = clamp(h.y - h.S.hh - 40, 14, H - 60);
        t.text(String(left), x, y, urgent ? 24 : 16, urgent && (E.t >> 2) % 2 ? '#ffffff' : '#ff3a3a', 'center');
      }
    }
  },
  // la CPU, DESPUÉS de decidir qué hacer: durante la lava (y al final del aviso) no pisa el suelo.
  //  En el suelo -> corre y salta a la plataforma más cercana; en el aire -> se guía hacia una
  //  plataforma (sin caída rápida); sobre una plataforma -> no se deja caer ni camina fuera del borde.
  aiPost(f, g, I) {
    const E = g.ev;
    const DE = E && this.def(E.id);
    if (DE && DE.ai) DE.ai(f, g, E, I);                                     // (¡VENTISCA!: contra el viento cerca del borde)
    if (DE && DE.danger && E.phase === 'on' && alive(f) && f.st !== 'hitstun' && f.st !== 'grabbed' && !f.holding) {
      const s = DE.danger(f, E);                                           // ¡una marca de rayo / una sombra de hielo cerca! a un lado
      if (s) { const away = sgn(f.x - s.x) || (f.x < W / 2 ? 1 : -1); I.mx = away; I.shd = false; if (f.grounded && Math.abs(f.x - s.x) < 8 && Math.random() < 0.15) I.jump = !f.prev.jump; }
      return I;
    }
    if (!E || E.id !== 'lava' || E.phase === 'end' || (E.phase === 'warn' && E.t < EVENT_WARN - 110)) return I;
    if (!alive(f) || f.st === 'hitstun' || f.st === 'helpless' || f.st === 'ledge' || f.st === 'grabbed' || f.holding) return I;
    const M = STAGE.main;
    if (f.x < M.x1 - 4 || f.x > M.x2 + 4) return I;                         // fuera del escenario: que se recupere a su modo
    let best = null, bd = 1e9;
    for (const p of STAGE.plats) {
      const d = Math.abs((p.x1 + p.x2) / 2 - f.x) + (p.y > f.y + 4 ? 0 : 30);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return I;
    const tx = (best.x1 + best.x2) / 2, half = (best.x2 - best.x1) / 2, ddx = tx - f.x;
    if (f.grounded && f.plat && f.plat !== M) {                              // a salvo en una plataforma
      if (I.my > 0.5) I.my = 0;
      const P = f.plat;
      if ((I.mx < 0 && f.x - P.x1 < 10) || (I.mx > 0 && P.x2 - f.x < 10)) I.mx = 0;
      return I;
    }
    if (f.grounded) {                                                        // en el suelo que arde: ¡fuera!
      I.mx = Math.abs(ddx) > 6 ? sgn(ddx) : 0; I.my = 0; I.shd = false; I.grab = false;
      if (Math.abs(ddx) < half + 34) I.jump = !f.prev.jump;
      return I;
    }
    if (Math.abs(ddx) > half - 6) I.mx = sgn(ddx);                           // en el aire: hacia la plataforma
    if (I.my > 0.5) I.my = 0;
    if (f.vy > 0 && f.y > best.y - 2 && f.jumps > 0) I.jump = !f.prev.jump;  // por debajo y cayendo: salta otra vez
    return I;
  },
  // la CPU: huir de quien lleva la bomba
  ai(f, g, I) {
    const E = g.ev; if (!E) return false;
    if (E.id === 'papa' && E.phase === 'on' && E.holder && E.holder !== f) {
      const h = E.holder, dx = f.x - h.x;
      if (Math.abs(dx) < 70 && Math.abs(f.y - h.y) < 60 && (f.st === 'ground' || f.st === 'air')) { I.mx = sgn(dx) || 1; if (f.grounded && Math.random() < 0.08) I.jump = !f.prev.jump; return true; }
    }
    return false;
  },
};
