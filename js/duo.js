'use strict';
// ============================================================
//  ATAQUES EN DUPLA (solo en EQUIPOS)
//  Un compañero sujeta a un rival y el otro también lo agarra:
//   · si la pareja es compatible, el rival tiene bastante daño y no acaba de recibir otra:
//     ¡¡¡DUPLA!!! — todo se detiene, la cámara se acerca y la pareja hace su técnica
//   · si no: ¡DUPLA! simple — un golpe hacia arriba entre los dos
//  La técnica nunca es un KO directo: lanza fuerte, pero el daño decide.
// ============================================================

const DUO_MIN_DMG = 60;          // daño mínimo del rival para la técnica especial
const DUO_REST = 1200;           // respiro de la víctima: 20 s sin poder recibir otra técnica

// utilidades de la animación
const dLerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const dEase = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
// pone a un luchador en una postura de un movimiento: ph 'wind' (preparación, k 0..1), 'act' (golpe) o 'rec' (recuperación)
function duoPose(f, name, ph, k = 1) {
  const m = f.ch.moves[name]; if (!m) { f.st = 'ground'; f.move = null; return; }
  f.st = 'attack'; f.move = m; f.moveName = name;
  f.t = ph === 'wind' ? Math.floor(Math.max(0, Math.min(1, k)) * Math.max(0, m.s - 1)) : ph === 'act' ? m.s : m.s + m.a + Math.floor(Math.max(0, Math.min(1, k)) * Math.max(0, m.e - 1));
}
function duoStand(f, st = 'ground') { f.st = st; f.move = null; f.moveName = null; }
function duoPlace(f, x, y, dir) { f.x = x; f.y = y; if (dir) f.dir = dir; f.vx = f.vy = f.lvx = f.lvy = 0; }
// mano delantera del luchador en el mundo (según la última postura dibujada)
function duoHand(f) { const p = f._pose; return p ? { x: f.x + f.dir * p.fh[0], y: f.y + p.fh[1] } : { x: f.x + f.dir * 8, y: f.y - f.S.hh * 0.6 }; }
// chispas en todas direcciones
function duoRadial(g, x, y, n, cols, sp = 2.2, ptype = 'spark', life = 26) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + Math.random() * 0.3, s = sp * (0.5 + Math.random() * 0.8);
    g.fx.push({ kind: 'part', ptype, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: life + Math.random() * 10, size: 1 + (i % 3 === 0 ? 1 : 0), col: cols[i % cols.length] });
  }
}
// glifo rúnico de 3×3 (pixel art)
const RUNE_GLYPHS = [[1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0, 0, 1, 1], [1, 0, 0, 1, 1, 1, 0, 0, 1], [0, 1, 1, 0, 1, 0, 1, 1, 0]];
function drawGlyph(c, x, y, i, col, a) {
  const G = RUNE_GLYPHS[((i % RUNE_GLYPHS.length) + RUNE_GLYPHS.length) % RUNE_GLYPHS.length];
  for (let k = 0; k < 9; k++) if (G[k]) px(c, Math.round(x) - 1 + (k % 3), Math.round(y) - 1 + ((k / 3) | 0), col, a);
}
// elipse en el suelo (círculo visto en perspectiva)
function groundEllipse(c, cx, cy, r, col, a, squash = 0.3) {
  const n = Math.max(16, Math.ceil(r * 5));
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; px(c, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r * squash), col, a); }
}

// ------------------------------------------------------------
//  Las técnicas. Clave: los dos personajes en orden alfabético.
//  setup(g, D): reparte papeles y posiciones · step(g, D, t): mueve a todos (solo el anfitrión)
//  draw(c, g, D, capa): efectos propios ('back' detrás de los luchadores, 'front' delante)
//  launch(D): cómo sale despedido el rival al terminar
// ------------------------------------------------------------
const DUO_ANIMS = {
  // ======================= RedStein + Runa =======================
  'redstein+runa': {
    name: 'ESPADA RÚNICA', len: 142,
    setup(g, D) {
      D.red = D.a.ch.id === 'redstein' ? D.a : D.b; D.runa = D.red === D.a ? D.b : D.a;
      D.side = D.red.x >= D.v.x ? 1 : -1;                    // RedStein a este lado del rival y Runa detrás de él
      D.rx0 = D.cx + D.side * 38; D.rx1 = D.cx - D.side * 56;  // RedStein cruza al rival de un tajo
      D.focus = { x: D.cx, y: D.gy - 30, z: 2.1 };
    },
    step(g, D, t) {
      const { red, runa, v, cx, gy, side } = D;
      // el rival flota, atrapado por la magia
      duoPlace(v, cx, gy - 6 - Math.min(10, t * 0.25) - (t >= 124 ? (t - 124) * 1.6 : 0), -side);
      duoStand(v, 'hitstun');
      // Runa: invoca, dibuja el círculo y al final lo hace estallar
      duoPlace(runa, cx + side * 74, gy, -side);
      if (t < 22) duoPose(runa, 'nspc', 'wind', t / 22);
      else if (t < 66) duoPose(runa, 'nspc', 'act');
      else if (t < 112) duoPose(runa, 'dspc', 'act');
      else duoPose(runa, 'uspc', 'act');
      // RedStein: recibe las runas, carga la espada y cruza
      if (t < 76) {
        duoPlace(red, D.rx0, gy, -side);
        if (t < 44) duoStand(red); else duoPose(red, 'fsmash', 'wind', (t - 44) / 32);
      } else if (t < 84) {
        duoPlace(red, dLerp(D.rx0, D.rx1, (t - 76) / 7), gy, -side); duoPose(red, 'fsmash', 'act');
      } else {
        duoPlace(red, D.rx1, gy, -side);
        if (t < 108) duoPose(red, 'fsmash', 'rec', (t - 84) / 24); else duoStand(red);
      }
      // efectos
      if (t === 1) Sfx.remate();
      if (t >= 12 && t < 64 && t % 6 === 0) Sfx.blip();
      if (t >= 44 && t < 76 && t % 2 === 0) {                                // la espada arde roja y azul
        const h = duoHand(red);
        g.fx.push({ kind: 'part', ptype: t % 4 ? 'fire' : 'star', x: h.x + (Math.random() * 6 - 3), y: h.y - Math.random() * 6, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.6, t: 0, life: 18, size: 1 + (t % 3 === 0 ? 1 : 0), col: t % 4 ? '#ff5a2a' : '#6fd0ff' });
      }
      if (t === 76) Sfx.swing();
      if (t === 80) {                                                          // el tajo
        v.flash = 5; g.spark(cx, v.y - v.S.hh * 0.5, 18, '#ffffff'); g.shake = 7; D.flash = 3; Sfx.hit(13);
        duoRadial(g, cx, v.y - v.S.hh * 0.5, 14, ['#ffffff', '#6fd0ff', '#ff5a2a'], 1.8);
      }
      if (t === 112) Sfx.freeze();
      if (t === 124) {                                                         // ¡el círculo estalla!
        D.flash = 9; g.shake = 13; Sfx.hit(20); Sfx.brk(); v.flash = 6;
        duoRadial(g, cx, gy - 4, 40, ['#6fd0ff', '#ff5a2a', '#ffffff', '#ffd34a'], 2.8);
        duoRadial(g, cx, gy - 10, 16, ['#6fd0ff', '#c48cff'], 1.2, 'star', 34);
      }
    },
    draw(c, g, D, layer) {
      const { red, runa, v, cx, gy, side } = D, t = D.t;
      if (layer === 'back') {
        // círculo rúnico bajo el rival
        if (t >= 56) {
          const k = dEase((t - 56) / 30), r = 6 + 24 * k, burst = t >= 124 ? Math.max(0, 1 - (t - 124) / 14) : 1;
          const pulse = t >= 108 && t < 124 ? 0.5 + 0.5 * Math.sin(t * 0.9) : 0;
          if (burst > 0) {
            glow(c, cx, gy - 1, r * 0.9, '#6fd0ff', (0.18 + pulse * 0.25) * burst, 3);
            groundEllipse(c, cx, gy, r, '#bfefff', 0.9 * burst);
            groundEllipse(c, cx, gy, r * 0.72, '#6fd0ff', 0.75 * burst);
            for (let i = 0; i < 8; i++) {
              const a = i / 8 * Math.PI * 2 + t * 0.03;
              drawGlyph(c, cx + Math.cos(a) * r * 0.86, gy + Math.sin(a) * r * 0.86 * 0.3, i, i % 2 ? '#ffffff' : '#9fe0ff', burst);
            }
          }
          if (t >= 124 && t < 140) {                                     // columna de luz al estallar
            const h = (t - 124) * 9, w = Math.max(2, Math.round(r * (1 - (t - 124) / 16)));
            rect(c, cx - w, gy - h, w * 2, h, '#bfefff', 0.55 * (1 - (t - 124) / 16));
            rect(c, cx - (w >> 1), gy - h, w, h, '#ffffff', 0.7 * (1 - (t - 124) / 16));
          }
        }
        return;
      }
      // corriente de runas: del bastón de Runa a la espada de RedStein
      if (t >= 10 && t < 70) {
        const s = { x: runa.x + runa.dir * 10, y: gy - runa.S.hh - 4 }, e = duoHand(red);
        for (let i = 0; i < 7; i++) {
          const k = ((t - 10) * 0.035 + i / 7) % 1, x = dLerp(s.x, e.x, k), y = dLerp(s.y, e.y, k) - Math.sin(k * Math.PI) * 26;
          const fade = Math.min(1, (70 - t) / 10, (t - 10) / 8);
          drawGlyph(c, x, y, i + (t >> 3), i % 2 ? '#ffffff' : '#7fe0ff', fade);
        }
      }
      // brillo de la espada cargada
      if (t >= 44 && t < 108) {
        const h = duoHand(red), col = (t >> 2) % 2 ? '#ff5a2a' : '#6fd0ff';
        glow(c, h.x, h.y - 4, 7 + Math.sin(t * 0.5) * 2, col, 0.45, 3);
      }
      // estela del tajo
      if (t >= 76 && t < 104) {
        const x0 = D.rx0, x1 = t < 84 ? dLerp(D.rx0, D.rx1, (t - 76) / 7) : D.rx1, a = t < 84 ? 1 : Math.max(0, 1 - (t - 84) / 20), y = gy - 14;
        withAlpha(c, a, () => { pline(c, x0, y, x1, y, 5, '#ff5a2a'); pline(c, x0, y - 1, x1, y - 1, 3, '#6fd0ff'); pline(c, x0, y - 1, x1, y - 1, 1, '#ffffff'); });
      }
    },
    launch(D) { return { lead: D.red, ang: 58, dir: -D.side }; },
  },

  // ======================= Bloque + Coloso =======================
  'bloque+coloso': {
    name: 'TERREMOTO', len: 130,
    setup(g, D) {
      D.col = D.a.ch.id === 'coloso' ? D.a : D.b; D.blo = D.col === D.a ? D.b : D.a;
      D.side = D.blo.x >= D.col.x ? 1 : -1;
      D.colX = D.cx - D.side * 40; D.bloX = D.cx + D.side * 70;   // Coloso es enorme: Bloque, bien a la vista
      D.pX = D.cx + D.side * 30;                                  // el pilar sale entre los dos, delante de Bloque
      D.focus = { x: D.cx, y: D.gy - 52, z: 1.75 };
    },
    pillarH(t) { return t < 50 ? 0 : t < 70 ? 46 * dEase((t - 50) / 20) : 46; },
    step(g, D, t) {
      const { col, blo, v, gy, side, pX } = D;
      duoPlace(col, D.colX, gy, side); duoPlace(blo, D.bloX, gy, -side);
      const over = { x: col.x, y: gy - col.S.hh - 4 };                 // encima de la cabeza del gigante
      const front = { x: col.x + side * (col.S.hw + 6), y: gy - col.S.hh * 0.35 };
      duoStand(v, 'hitstun');
      // Coloso levanta al rival sobre su cabeza…
      if (t < 30) { duoPose(col, 'usmash', 'wind', t / 30); const k = dEase(t / 26); duoPlace(v, dLerp(front.x, over.x, k), dLerp(front.y, over.y, k), -side); }
      else if (t < 74) { duoPose(col, 'usmash', 'act'); duoPlace(v, over.x, over.y + Math.sin(t * 0.3), -side); }
      // …y lo estrella contra el pilar
      else if (t < 96) { duoPose(col, 'fsmash', 'wind', (t - 74) / 22); duoPlace(v, over.x - side * (t - 74) * 0.3, over.y - (t - 74) * 0.25, -side); }
      else if (t < 104) {
        duoPose(col, 'fsmash', 'act');
        const k = (t - 96) / 8, sx = over.x - side * 6.6, sy = over.y - 5.5, ex = pX, ey = gy - 46;
        duoPlace(v, dLerp(sx, ex, k), dLerp(sy, ey, k) - Math.sin(k * Math.PI) * 18, -side);
      } else {
        duoPose(col, 'fsmash', 'rec', (t - 104) / 26);
        duoPlace(v, pX, gy - 46 - (t - 104) * 1.3, -side);
      }
      // Bloque golpea el suelo y levanta el pilar
      if (t < 30) duoStand(blo);
      else if (t < 50) duoPose(blo, 'dsmash', 'wind', (t - 30) / 20);
      else if (t < 70) duoPose(blo, 'dsmash', 'act');
      else duoPose(blo, 'dsmash', 'rec', (t - 70) / 30);
      // efectos
      if (t === 1) Sfx.remate();
      if (t === 50) { g.shake = 8; Sfx.hit(12); g.burst(blo.x - side * 14, gy, 10, 'dust'); }
      if (t > 50 && t < 70 && t % 3 === 0) { g.burst(pX, gy, 3, 'dust'); g.shake = Math.max(g.shake, 3); }
      if (t === 104) {                                                         // ¡el pilar revienta!
        D.flash = 9; g.shake = 15; Sfx.brk(); Sfx.hit(21); v.flash = 6;
        duoRadial(g, pX, gy - 40, 22, ['#d8c8a8', '#8a7663', '#ffffff', '#ffd34a'], 2.6);
        g.burst(pX - 20, gy, 12, 'dust'); g.burst(pX + 20, gy, 12, 'dust');
      }
    },
    draw(c, g, D, layer) {
      const { gy, pX } = D, t = D.t;
      if (layer === 'back') {
        const h = Math.round(this.pillarH(t));
        if (h > 0 && t < 104) {                                               // pilar de roca
          const w = 16, x0 = Math.round(pX - w / 2), y0 = gy - h;
          rect(c, x0 - 1, y0 - 1, w + 2, h + 1, OUTLINE);
          rect(c, x0, y0, w, h, '#6b5a4a'); rect(c, x0, y0, 3, h, '#8a7663'); rect(c, x0 + w - 3, y0, 3, h, '#4a3d31');
          rect(c, x0 - 2, y0, w + 4, 4, '#8a7663'); rect(c, x0 - 2, y0, w + 4, 1, '#b3a089');
          for (let yy = y0 + 8; yy < gy - 2; yy += 7) { rect(c, x0 + 4, yy, 5, 1, '#4a3d31'); rect(c, x0 + 8, yy + 3, 4, 1, '#4a3d31'); }
        }
        return;
      }
      if (t >= 104 && t < 136) {
        const k = (t - 104) / 32;
        // trozos del pilar volando
        for (let i = 0; i < 12; i++) {
          const a = -Math.PI / 2 + (i / 11 - 0.5) * 2.6, s = 2 + (i % 4) * 0.7, tt = t - 104;
          const x = pX + Math.cos(a) * s * tt, y = gy - 30 - (i % 3) * 8 + Math.sin(a) * s * tt + 0.12 * tt * tt;
          const sz = 2 + (i % 3);
          rect(c, Math.round(x) - 1, Math.round(y) - 1, sz + 2, sz + 2, OUTLINE, 1 - k);
          rect(c, Math.round(x), Math.round(y), sz, sz, i % 2 ? '#8a7663' : '#6b5a4a', 1 - k);
        }
        // onda sísmica por todo el suelo
        const d = (t - 104) * 9;
        for (const sgnx of [-1, 1]) {
          const x = pX + sgnx * d;
          for (let j = -10; j <= 10; j++) {
            const hh = Math.round(5 * Math.cos(j / 10 * Math.PI / 2));
            rect(c, Math.round(x + j), gy - hh, 1, hh, '#ffe9b0', 0.75 * (1 - k));
          }
        }
        rect(c, 0, gy, W * 2, 2, '#ffe9b0', 0.35 * (1 - k));
      }
    },
    launch(D) { return { lead: D.col, ang: 80, dir: D.side }; },
  },

  // ======================= Brisa + Runa =======================
  'brisa+runa': {
    name: 'BURBUJA ARCANA', len: 138,
    setup(g, D) {
      D.bri = D.a.ch.id === 'brisa' ? D.a : D.b; D.runa = D.bri === D.a ? D.b : D.a;
      D.side = D.bri.x >= D.runa.x ? 1 : -1;
      D.r = Math.round(D.v.S.hh * 0.62 + 8);
      D.focus = { x: D.cx, y: D.gy - 50, z: 1.85 };
    },
    // dónde está la burbuja (centro)
    bubble(D, t) {
      const { cx, gy, side, v } = D, base = gy - 42 - v.S.hh * 0.5;
      if (t < 40) return { x: cx, y: dLerp(gy - v.S.hh * 0.5, base, dEase(t / 40)) };
      if (t < 100) return { x: cx, y: base + Math.sin(t * 0.12) * 2 };
      const k = t - 100; return { x: cx - side * k * 2.4, y: base - k * 2.1 };
    },
    step(g, D, t) {
      const { bri, runa, v, cx, gy, side } = D;
      const b = this.bubble(D, t);
      if (t < 128) { duoPlace(v, b.x, b.y + v.S.hh * 0.5, -side); duoStand(v, 'hitstun'); }
      else { duoPlace(v, b.x, b.y + v.S.hh * 0.5, -side); duoStand(v, 'hitstun'); }
      D.focus = t < 100 ? { x: cx, y: gy - 50, z: 1.85 } : { x: dLerp(cx, b.x, 0.6), y: dLerp(gy - 50, b.y, 0.6), z: 1.7 };
      // Runa encierra al rival en la burbuja
      duoPlace(runa, cx - side * 38, gy, side);
      if (t < 20) duoPose(runa, 'nspc', 'wind', t / 20); else if (t < 64) duoPose(runa, 'nspc', 'act'); else duoPose(runa, 'nspc', 'rec', (t - 64) / 20);
      // Brisa toma carrerilla y sube con su triple salto
      const far = cx + side * 74;
      if (t < 38) { duoPlace(bri, cx + side * 40, gy, -side); duoStand(bri); }
      else if (t < 50) { duoPlace(bri, dLerp(cx + side * 40, far, (t - 38) / 12), gy, side); duoStand(bri); bri.vx = side * 2; }
      else if (t < 58) { duoPlace(bri, far, gy, -side); duoStand(bri, 'jumpsquat'); }
      else if (t < 96) {
        const u = (t - 58) / 38;
        duoPlace(bri, dLerp(far, cx + side * 24, u), gy - (b.y < gy ? (gy - b.y - 4) * u : 0) - 9 * Math.abs(Math.sin(u * Math.PI * 3)), -side);
        duoStand(bri, 'air'); bri.vy = -1;
      } else if (t < 100) { duoPose(bri, 'fair', 'wind', (t - 96) / 4); }
      else if (t < 112) duoPose(bri, 'fair', 'act');
      else { duoStand(bri, 'air'); bri.vy = 1; bri.y = Math.min(gy, bri.y + (t - 112) * 0.25); }
      // efectos
      if (t === 1) { Sfx.remate(); }
      if (t === 6) Sfx.freeze();
      if (t === 58 || t === 71 || t === 84) { Sfx.jump(); duoRadial(g, bri.x, bri.y, 8, ['#ffffff', '#bff2ff'], 1.4, 'spark', 14); }
      if (t === 100) {                                                         // ¡patada!
        g.shake = 9; D.flash = 4; Sfx.hit(16); v.flash = 4;
        g.spark(b.x + side * D.r * 0.7, b.y, 18, '#ffffff');
        duoRadial(g, b.x + side * D.r * 0.7, b.y, 12, ['#ffffff', '#9fe8ff'], 2);
      }
      if (t === 128) {                                                         // la burbuja revienta en estrellas
        D.flash = 8; g.shake = 10; Sfx.brk(); Sfx.hit(18); v.flash = 5;
        duoRadial(g, b.x, b.y, 46, ['#ff5a5a', '#ffd34a', '#5ee08a', '#5aa0ff', '#c48cff', '#ffffff'], 2.6, 'star', 40);
      }
    },
    draw(c, g, D, layer) {
      const t = D.t; if (layer !== 'front' || t >= 128) return;
      const b = this.bubble(D, t), r = Math.round(D.r * dEase(t / 18));
      if (r < 2) return;
      // burbuja de runas
      withAlpha(c, 0.16, () => disc(c, Math.round(b.x), Math.round(b.y), r, '#c48cff'));
      withAlpha(c, 0.9, () => ring(c, Math.round(b.x), Math.round(b.y), r, '#e6d0ff'));
      withAlpha(c, 0.5, () => ring(c, Math.round(b.x), Math.round(b.y), r - 2, '#9f7aff'));
      px(c, Math.round(b.x - r * 0.45), Math.round(b.y - r * 0.55), '#ffffff'); px(c, Math.round(b.x - r * 0.45) + 1, Math.round(b.y - r * 0.55), '#ffffff', 0.6);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + t * 0.05;
        drawGlyph(c, b.x + Math.cos(a) * (r + 4), b.y + Math.sin(a) * (r + 4), i, i % 2 ? '#ffffff' : '#c48cff');
      }
      // hilo de magia desde el bastón mientras la crea
      if (t < 64) {
        const s = { x: D.runa.x + D.side * 10, y: D.gy - D.runa.S.hh - 4 };
        for (let i = 0; i < 6; i++) { const k = (i / 6 + t * 0.04) % 1; px(c, Math.round(dLerp(s.x, b.x, k)), Math.round(dLerp(s.y, b.y, k) - Math.sin(k * Math.PI) * 8), '#e6d0ff'); }
      }
      // estela de viento tras la patada
      if (t >= 100) for (let i = 1; i < 5; i++) { const p = this.bubble(D, t - i * 2); withAlpha(c, 0.5 - i * 0.1, () => ring(c, Math.round(p.x), Math.round(p.y), Math.max(2, r - i * 2), '#bff2ff')); }
    },
    launch(D) { return { lead: D.bri, ang: 66, dir: -D.side }; },
  },
};

// ------------------------------------------------------------
//  El motor (métodos de la partida)
// ------------------------------------------------------------
Object.assign(Game.prototype, {
  // ¿el agarre de b sobre v (ya sujeto) cuenta como dupla?
  canDuo(b, v) {
    const a = v.heldBy;
    return this.teams && !this.duo && this.phase === 'play' && a && a !== b && a.st === 'hold' && a.holding === v &&
      this.allies(a, b) && !this.allies(b, v) && !b.holding && b.st === 'attack' && !(v.S.giant && !b.S.giant);
  },
  startDuo(a, b, v) {
    const key = [a.ch.id, b.ch.id].sort().join('+'), A = DUO_ANIMS[key];
    a.holding = null; v.heldBy = null; v.mash = 0;
    const big = A && v.dmg >= DUO_MIN_DMG && !(v.duoRest > this.frame) && !this.sd;
    if (!big) return this.simpleDuo(a, b, v);
    const P = a.plat || STAGE.main, wide = P.x2 - P.x1 > 150;
    const D = { kind: key, a, b, v, t: 0, len: A.len, gy: a.y, plat: a.plat, flash: 6, big: true,
      cx: wide ? clamp(v.x, P.x1 + 70, P.x2 - 70) : (P.x1 + P.x2) / 2 };
    for (const f of [a, b, v]) if (f.item) { f.inp = blankInput(); ItemSys.throwItem(f, this); }   // las manos, libres
    A.setup(this, D);
    for (const f of [a, b, v]) { f.hitlag = 0; f.flash = 0; f.invuln = 0; f.hidden = false; f.burn = 0; f.frozen = 0; f.lag = 0; }
    v.duoRest = this.frame + DUO_REST;
    this.duo = D;
    this.shake = 5;
  },
  // ¡DUPLA! simple: los dos golpean hacia arriba a la vez
  simpleDuo(a, b, v) {
    for (const f of [a, b]) {
      f.move = null; f.setSt(f.grounded ? 'ground' : 'air'); f.chain = 0; f.chainT = 0; f.comboTier = 0;
      f.dir = sgn(v.x - f.x) || f.dir; f.startMove('utilt', this);
    }
    v.duoSafeT = this.frame + 26; v.duoA = a; v.duoB = b;                // sus golpes hacia arriba ya no cuentan
    v.setSt('air'); v.grounded = false; v.plat = null;
    this.applyHit(b, v, { d: 9, b: 5.2, g: 1.3, ang: 90 }, b.dir, 1, v.x, v.y - v.S.hh * 0.6);
    v.duoTxtT = 60;
    this.spark(v.x, v.y - v.S.hh * 0.6, 14, '#ffd34a');
  },
  stepDuo() {
    const D = this.duo, A = DUO_ANIMS[D.kind];
    D.t++;
    for (const f of [D.a, D.b, D.v]) { f.animT++; if (f.flash > 0) f.flash--; }
    A.step(this, D, D.t);
    for (const f of [D.a, D.b, D.v]) f.updateScarf();             // la bufanda sigue al luchador (si no, se estira hasta donde estaba)
    if (D.flash > 0) D.flash--;
    if (D.t >= D.len) this.endDuo();
  },
  endDuo() {
    const D = this.duo, A = DUO_ANIMS[D.kind]; this.duo = null;
    for (const f of [D.a, D.b]) {
      f.move = null; f.moveName = null; f.hitSet = new Set(); f.holding = null; f.heldBy = null; f.vx = f.vy = f.lvx = f.lvy = 0;
      if (Math.abs(f.y - D.gy) < 1) { f.y = D.gy; f.grounded = true; f.plat = D.plat; f.setSt('ground'); }
      else { f.grounded = false; f.plat = null; f.setSt('air'); }
    }
    const v = D.v, L = A.launch(D);
    v.heldBy = null; v.grounded = false; v.plat = null; v.setSt('air');
    L.lead.move = null; L.lead.moveName = null;
    this.applyHit(L.lead, v, { d: 16, b: 6.5, g: 2.1, ang: L.ang }, L.dir, 1, v.x, v.y - v.S.hh * 0.5);
  },

  // dibujo: efectos propios de la técnica
  renderDuo(c, layer) { const D = this.duo; if (D && D.big) DUO_ANIMS[D.kind].draw(c, this, D, layer); },
  // bandas de cine y destellos (en pantalla, sin zoom)
  renderDuoScreen(c) {
    const D = this.duo; if (!D || !D.big) return;
    const k = Math.min(1, D.t / 10, (D.len - D.t) / 10), h = Math.round(24 * k);
    rect(c, 0, 0, W, h, '#05030c'); rect(c, 0, H - h, W, h, '#05030c');
    if (D.flash > 0) rect(c, 0, 0, W, H, '#ffffff', Math.min(0.85, D.flash / 9));
  },
  renderDuoText(t) {
    const D = this.duo; if (!D || !D.big) return;
    const A = DUO_ANIMS[D.kind], k = D.t;
    if (k < 70) {
      const pop = k < 6 ? 1 + (6 - k) * 0.15 : 1, col = (k >> 2) % 2 ? '#ffd34a' : '#ffffff';
      t.text('¡¡¡DUPLA!!!', W / 2, Math.round(4 + Math.min(1, k / 6) * 6), Math.round(24 * pop), col, 'center');
      if (k > 10) t.text(A.name, W / 2, H - 20, 16, D.a.pal.light, 'center');
    }
  },
});
