'use strict';
// ============================================================
//  Pantalla VS: unos segundos antes de cada pelea.
//  Franjas inclinadas con el color de cada jugador, los luchadores
//  entran encarándose, cada uno con su animación de amenaza, y el
//  "VS" cae con un golpe de espada.
// ============================================================
const VS = (() => {
  const SL = 44;                         // inclinación de las franjas (px de desplazamiento arriba)
  const ARRIVE = 26, SLAM = 32, EXIT = 196, END = 212;
  const TOP = 24, BOT = 222;             // bandas de cine arriba y abajo
  const VS_Y = 66;                       // altura del "VS": por encima de las caras
  const tmp = mkCanvas(SPR, SPR), tc = tmp.getContext('2d');
  const sil = mkCanvas(SPR, SPR), sc = sil.getContext('2d');
  let g = null, T = 0, cols = [], parts = [], shake = 0, vsSpr = null, info = null, onDone = null;

  // ---------- el "VS": pixel art construido a partir de la fuente ----------
  function makeVS() {
    if (document.fonts && !document.fonts.check('16px "Press Start 2P"')) return null;
    const w = 40, h = 20, m = mkCanvas(w, h), mc = m.getContext('2d');
    mc.font = '16px "Press Start 2P"'; mc.textBaseline = 'top'; mc.fillStyle = '#fff'; mc.fillText('VS', 3, 2);
    const d = mc.getImageData(0, 0, w, h).data, on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 120;
    const out = mkCanvas(w, h), oc = out.getContext('2d');
    const RAMP = ['#fff6c8', '#ffe27a', '#ffc23a', '#ff9a2e', '#f0642a', '#c8341f'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (on(x, y)) {
        let k = 0; for (let yy = y - 1; yy >= 0 && on(x, yy); yy--) k++;
        const col = !on(x, y - 1) ? '#ffffff' : RAMP[clamp(Math.floor(k / 2.4), 0, RAMP.length - 1)];
        px(oc, x, y, col);
      } else {
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && on(x + dx, y + dy)) { near = true; break; }
        if (near) px(oc, x, y, OUTLINE);
      }
    }
    return out;
  }

  // ---------- franjas de fondo (una por columna, se pintan una vez) ----------
  function slab(i, n, pal) {
    const cw = W / n, cv = mkCanvas(W, H), c = cv.getContext('2d');
    const img = c.createImageData(W, H), D = img.data;
    const dark = hexRgb(pal.dark), main = hexRgb(pal.main), light = hexRgb(pal.light), deep = hexRgb('#0b0a24');
    const cx = (i + 0.5) * cw;
    for (let y = 0; y < H; y++) {
      const sh = SL * (1 - y / H);                         // arriba se desplaza a la derecha
      const x0 = i === 0 ? -SL : i * cw + sh, x1 = i === n - 1 ? W + SL : (i + 1) * cw + sh;
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
        const u = Math.abs(x - (cx + sh)) / (cw * 0.62);   // 0 en el centro de la franja
        const vy = Math.abs(y - 150) / 150;
        let v = clamp(1 - u * 0.75 - vy * 0.35, 0, 1);
        const stripe = ((x - y * 0.9 + 1000) % 14) < 2 ? 0.08 : 0;   // rayas finas inclinadas
        v = clamp(v + stripe, 0, 1);
        const th = (BAYER[y & 3][x & 3] + 0.5) / 16;
        const q = v * 3;                                    // 4 tonos con tramado
        const lo = Math.floor(q), fr = q - lo;
        const pick = clamp(fr > th ? lo + 1 : lo, 0, 3);
        const rgb = [deep, dark, main, light][pick];
        const o = (y * W + x) * 4; D[o] = rgb[0]; D[o + 1] = rgb[1]; D[o + 2] = rgb[2]; D[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    // borde brillante de la franja
    if (i < n - 1) for (let y = 0; y < H; y++) { const x = (i + 1) * cw + SL * (1 - y / H); rect(c, x - 1, y, 3, 1, '#ffffff', 0.85); }
    return cv;
  }

  function begin(game, cfg, done) {
    g = game; T = 0; parts = []; shake = 0; onDone = done;
    const F = g.fighters, n = F.length;
    // columnas: por equipos (2 franjas) o una por luchador
    let groups;
    if (g.teams) {
      groups = [0, 1].map(tm => F.filter(f => f.team === tm)).filter(a => a.length);
    } else groups = F.map(f => [f]);
    const nc = groups.length;
    const big = nc === 2 && groups.every(a => a.length === 1);
    cols = groups.map((mem, i) => {
      const pal = g.teams ? PLAYER_PALS[TEAM_PALS[mem[0].team][0]] : mem[0].pal;
      const cw = W / nc, cx = (i + 0.5) * cw + SL * (1 - (BOT - 40) / H);
      const dir = nc === 1 ? 1 : (cx < W / 2 ? 1 : -1);
      return {
        pal, bg: slab(i, nc, pal), from: i % 2 ? 1 : -1,
        mem: mem.map((f, j) => {
          const hh = f.S.hh, k = big ? Math.min(4, Math.floor(172 / hh)) : Math.min(3, Math.floor(118 / hh));
          const off = mem.length > 1 ? (j === 0 ? 1 : -1) * cw * 0.2 * dir : 0;
          return { f, k, x: cx + off - (big ? dir * 14 : 0), dir, back: j > 0 };
        }),
      };
    });
    for (const c of cols) for (const m of c.mem) { const f = m.f; f.st = 'taunt'; f.dir = 1; f.flash = 0; f.invuln = 0; f.hitlag = 0; f.charge = 0; }
    info = {
      mode: g.teams ? '2 VS 2' : n === 2 ? '1 VS 1' : n === 3 ? 'TRIPLE AMENAZA' : 'TODOS CONTRA TODOS',
      stage: (g.stage.def.name || '').toUpperCase() + '  ·  ' + cfg.stocks + (cfg.stocks === 1 ? ' VIDA' : ' VIDAS'),
      big,
    };
    vsSpr = makeVS();
  }

  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  function burst(x, y, n, col, spd = 2.5, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: 20 + Math.random() * 20, col, g: 0.08 });
    }
  }

  function step(skip) {
    T++;
    if (T === SLAM - 12) Sfx.vsSwing();
    if (T === SLAM) {
      shake = 7;
      burst(W / 2, VS_Y, 26, '#ffd34a', 4); burst(W / 2, VS_Y, 14, '#ffffff', 3);
    }
    if (skip && T > SLAM + 14 && T < EXIT) T = EXIT;
    if (shake > 0) shake = Math.max(0, shake - 0.5);
    // efectos de cada luchador durante su amenaza
    for (const c of cols) for (const m of c.mem) {
      const t = T - ARRIVE, f = m.f, id = f.ch.id, k = m.k, x = m.x, gy = BOT - 18;
      if (t < 0) continue;
      if (id === 'bloque' && t === 70) { shake = Math.max(shake, 3); burst(x + m.dir * 6 * k, gy, 14, '#c9b89a', 2, 1); }
      if (id === 'coloso' && t === 108) { shake = Math.max(shake, 5); burst(x + m.dir * 8 * k, gy, 20, '#d8e4f0', 2.5, 1); }
      if (id === 'coloso' && t >= 56 && t < 96 && t % 8 === 0) parts.push({ ring: 1, x: x + m.dir * 10 * k, y: gy - 46 * k, r: 4, life: 18, col: '#ffffff' });
      if (id === 'redstein' && t > 40 && T % 3 === 0) parts.push({ x: x + m.dir * (8 + Math.random() * 14) * k, y: gy - (14 + Math.random() * 6) * k, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.6, life: 22, col: Math.random() < 0.5 ? '#ffb040' : '#ff5a20', g: -0.01 });
      if (id === 'runa' && t > 40 && T % 4 === 0) parts.push({ x: x + (Math.random() - 0.5) * 30 * k / 2, y: gy - Math.random() * 30 * k, vx: 0, vy: -0.4, life: 30, col: Math.random() < 0.5 ? '#c48cff' : '#f0d8ff', g: 0 });
      if (id === 'brisa' && t > 20 && T % 5 === 0) parts.push({ streak: 1, x: x - m.dir * 30, y: gy - Math.random() * 26 * k, vx: m.dir * 3, vy: 0, life: 16, col: '#e8fff8', g: 0 });
    }
    for (const p of parts) { p.x += p.vx || 0; p.y += p.vy || 0; if (p.g) p.vy += p.g; p.life--; if (p.ring) p.r += 3; }
    parts = parts.filter(p => p.life > 0);
    if (T >= END) { const d = onDone; onDone = null; if (d) d(); }
  }

  function drawFighter(c, m, ox, alpha, white) {
    const f = m.f;
    f.x = OX; f.y = OY; f.animT = Math.max(0, T - ARRIVE);
    tc.clearRect(0, 0, SPR, SPR);
    renderFighter(tc, f, f.animT);
    if (f.ch.overlay) f.ch.overlay(tc, f, f.animT);
    let src = tmp;
    if (white > 0) {                                    // destello blanco al llegar
      sc.clearRect(0, 0, SPR, SPR); sc.globalCompositeOperation = 'source-over'; sc.drawImage(tmp, 0, 0);
      sc.globalCompositeOperation = 'source-atop'; sc.globalAlpha = white; sc.fillStyle = '#ffffff'; sc.fillRect(0, 0, SPR, SPR);
      sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over'; src = sil;
    }
    const k = m.k, gy = BOT - 18, x = Math.round(m.x + ox);
    c.save(); c.globalAlpha = alpha;
    if (m.dir > 0) c.drawImage(src, 0, 0, SPR, SPR, x - OX * k, gy - OY * k, SPR * k, SPR * k);
    else { c.translate(x + OX * k, gy - OY * k); c.scale(-1, 1); c.drawImage(src, 0, 0, SPR, SPR, 0, 0, SPR * k, SPR * k); }
    c.restore();
  }

  function render(c) {
    c.imageSmoothingEnabled = false;
    rect(c, 0, 0, W, H, OUTLINE);
    const nc = cols.length;
    // franjas: entran desde arriba/abajo alternando
    cols.forEach((col, i) => {
      const e = ease((T - i * 3) / 16), dy = Math.round((1 - e) * H * col.from);
      c.drawImage(col.bg, 0, dy);
    });
    // líneas de velocidad sobre las franjas
    for (let i = 0; i < 26; i++) {
      const y = (i * 37 + T * 5) % H, x = (i * 89) % W, len = 18 + (i % 4) * 10;
      withAlpha(c, 0.16, () => pline(c, x, y, x + len * 0.5, y - len, 1, '#ffffff'));
    }
    // luchadores
    const gy = BOT - 18;
    for (const col of cols) {
      const list = [...col.mem].sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0));
      for (const m of list) {
        const e = ease((T - 6 - (m.back ? 4 : 0)) / (ARRIVE - 6));
        const ox = (1 - e) * -m.dir * 180;
        const k = m.k;
        if (e > 0.6) { glow(c, m.x + ox, gy - 2, 18 * k / 2 + m.f.S.hw * k * 0.6, col.pal.light, 0.22, 4); shadow(c, m.x + ox, gy, (m.f.S.hw * 2 + 10) * k / 2 * 1.4, 0.45); }
        const white = T >= ARRIVE - 2 && T < ARRIVE + 8 ? 1 - (T - ARRIVE + 2) / 10 : 0;
        drawFighter(c, m, ox, m.back ? 0.92 : 1, white);
      }
    }
    // partículas
    for (const p of parts) {
      const a = clamp(p.life / 20, 0, 1);
      if (p.ring) withAlpha(c, a * 0.6, () => ring(c, Math.round(p.x), Math.round(p.y), Math.round(p.r), p.col));
      else if (p.streak) withAlpha(c, a * 0.7, () => rect(c, p.x, p.y, 10, 1, p.col));
      else rect(c, p.x, p.y, 2, 2, p.col, a);
    }
    // bandas de cine
    const bandIn = ease(T / 14);
    rect(c, 0, 0, W, Math.round(TOP * bandIn), OUTLINE, 0.92);
    rect(c, 0, H - Math.round((H - BOT) * bandIn), W, H - BOT, OUTLINE, 0.92);
    rect(c, 0, Math.round(TOP * bandIn), W, 1, '#ffffff', 0.25);
    rect(c, 0, H - Math.round((H - BOT) * bandIn) - 1, W, 1, '#ffffff', 0.25);
    // cintas con el nombre
    const cw = W / nc;
    cols.forEach((col, i) => {
      const nm = col.mem.map(m => m.f.ch.name).join(' + ');
      const e = ease((T - 16 - i * 3) / 14), bx = (i + 0.5) * cw, w = Math.min(cw - 16, info.big ? 200 : Math.max(104, nm.length * 8 + 28));
      const y = BOT + 5 + Math.round((1 - e) * 50), h = info.big ? 26 : 18;
      chamfer(c, bx - w / 2 + 4, y + 3, w, h, '#000000', 0.5);
      chamfer(c, bx - w / 2, y, w, h, col.pal.dark);
      chamfer(c, bx - w / 2 + 2, y + 2, w - 4, 3, col.pal.light, 0.5);
      rect(c, bx - w / 2 + 8, y + h - 3, w - 16, 1, col.pal.main);
    });
    // el VS
    const cx = W / 2, cy = VS_Y;
    if (T >= SLAM - 8 && vsSpr) {
      const k = T < SLAM ? 3 + (SLAM - T) : 3 + (T < SLAM + 4 ? (SLAM + 4 - T) * 0.25 : 0);
      const pulse = T > SLAM + 4 ? Math.round(Math.sin(T * 0.12)) : 0;
      const w = Math.round(vsSpr.width * k), h = Math.round(vsSpr.height * k);
      if (T >= SLAM) {
        glow(c, cx, cy, 70, '#ffb040', 0.2 + 0.05 * Math.sin(T * 0.2), 5);
        // rayos alrededor
        for (let i = 0; i < 10; i++) {
          if ((T + i * 7) % 11 > 5) continue;
          const a = i / 10 * Math.PI * 2 + T * 0.02, r0 = 40, r1 = 60 + (i % 3) * 12;
          withAlpha(c, 0.55, () => pline(c, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7, 1, i % 2 ? '#ffffff' : '#ffd34a'));
        }
      }
      withAlpha(c, T < SLAM ? clamp((T - SLAM + 8) / 6, 0, 1) : 1, () => c.drawImage(vsSpr, Math.round(cx - w / 2), Math.round(cy - h / 2 + pulse), w, h));
    }
    // onda y destello del golpe
    if (T >= SLAM && T < SLAM + 14) {
      const t = T - SLAM;
      withAlpha(c, 1 - t / 14, () => ring(c, cx, cy, 10 + t * 12, '#ffffff'));
      withAlpha(c, 0.8 * (1 - t / 14), () => ring(c, cx, cy, 6 + t * 9, '#ffd34a'));
      if (t < 6) rect(c, 0, 0, W, H, '#ffffff', 0.55 * (1 - t / 6));
    }
    // salida: barrido diagonal
    if (T >= EXIT) {
      const e = ease((T - EXIT) / (END - EXIT - 2));
      for (let y = 0; y < H; y++) { const x = -SL + (W + SL * 2) * e - (H - y) * 0.16; rect(c, 0, y, Math.max(0, x), 1, OUTLINE); }
    }
  }
  function chamfer(c, x, y, w, h, col, a) {
    x = Math.round(x); y = Math.round(y);
    for (let r = 0; r < h; r++) { const cut = r < 4 ? 4 - r : r >= h - 4 ? r - (h - 5) : 0; rect(c, x + cut, y + r, w - cut * 2, 1, col, a); }
  }

  function renderText(t) {
    if (!g || !info) return;
    const a = T >= EXIT ? 0 : 1; if (!a) return;
    const top = ease(T / 14);
    if (top > 0.8) {
      t.text(info.mode, 12, 8, 8, '#ffd34a');
      t.text(info.stage, W - 12, 8, 8, '#ffffff', 'right');
    }
    const nc = cols.length, cw = W / nc;
    cols.forEach((col, i) => {
      const e = ease((T - 16 - i * 3) / 14); if (e < 0.98) return;
      const bx = (i + 0.5) * cw, y = BOT + 5;
      const names = col.mem.map(m => m.f.ch.name.toUpperCase());
      const who = col.mem.map(m => m.f.cpu ? 'CPU ' + (LEVEL_NAMES[m.f.level] || '') : m.f.label).join(' + ');
      if (info.big) {
        t.text(names[0], bx, y + 5, 16, '#ffffff', 'center');
        t.text(who, bx, y + 32, 8, col.pal.light, 'center');
      } else {
        const nm = names.join(' + ');
        t.text(nm, bx, y + 5, 8, '#ffffff', 'center');
        t.text(who, bx, y + 24, 8, col.pal.light, 'center');
      }
    });
  }

  return {
    begin, step, render, renderText,
    get shake() { return shake; },
    get active() { return !!onDone; },
  };
})();
