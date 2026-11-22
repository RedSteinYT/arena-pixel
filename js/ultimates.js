'use strict';
// ============================================================
//  ULTIMATE RUBY de cada luchador (cinemáticas)
//  Usan el motor de las ¡¡¡DUPLA!!! (duo.js). Antes de cada una, ruby.js hace explotar el
//  corazón de rubí: aquí el tiempo "t" empieza justo después (t = D.t - D.pre).
//  setup(g, D) · step(g, D, t) · draw(c, g, D, capa) · launch(D) → { lead, dir, h: golpe final }
// ============================================================

// ======================= RedStein: LLUVIA CARMESÍ =======================
//  Lanza al rival al cielo de un tajo, tensa el arco hacia arriba y llueven flechas de rubí en
//  llamas; remata con una flecha gigante.
DUO_ANIMS['ult:redstein'] = {
  name: 'LLUVIA CARMESÍ', len: 152,
  setup(g, D) {
    const a = D.a, v = D.v, P = a.plat || STAGE.main;
    D.side = sgn(v.x - a.x) || a.dir;
    D.rx = a.x; D.vx = clamp(a.x + D.side * 46, P.x1 + 16, P.x2 - 16);
    if (Math.abs(D.vx - D.rx) < 34) D.rx = clamp(D.vx - D.side * 46, P.x1 + 10, P.x2 - 10);   // junto al borde: él se aparta
    D.vy0 = v.y; D.vtop = D.gy - 72; D.vx0 = v.x;
    D.focus = { x: (D.rx + D.vx) / 2, y: D.gy - 62, z: 1.55 };
  },
  // la flecha i de la lluvia: cuándo sale, por dónde cae y cuándo impacta
  arrow(D, i) {
    const t0 = 68 + Math.floor(i * 1.5), miss = i % 4 === 3;
    const x = Math.round(D.vx + (miss ? (i % 2 ? 1 : -1) * (20 + (i * 7) % 22) : ((i * 37) % 27) - 13));
    const yTop = D.gy - 154, yEnd = miss ? D.gy : D.vtop - D.v.S.hh * 0.5 + ((i * 13) % 11) - 5;
    return { t0, x, yTop, yEnd, ti: t0 + Math.ceil((yEnd - yTop) / 10), miss };
  },
  N: 30,
  giantY(D, t) {                                                     // la flecha gigante (cae desde arriba)
    const top = D.gy - 154, end = D.vtop - D.v.S.hh * 0.5;
    return t < 126 ? null : dLerp(top, end, (t - 126) / 10);
  },
  step(g, D, t) {
    const red = D.a, v = D.v, gy = D.gy, side = D.side;
    // el rival sube y queda suspendido en el cielo
    const vy = t < 24 ? dLerp(D.vy0, D.vtop, dEase(t / 24)) : t < 136 ? D.vtop + Math.sin(t * 0.15) * 2 : D.vtop - (t - 136) * 0.6;
    duoPlace(v, t < 24 ? dLerp(D.vx0, D.vx, dEase(t / 24)) : D.vx, vy, -side); duoStand(v, 'hitstun');
    // RedStein: termina el tajo, tensa el arco hacia el cielo, dispara; vuelve a tensar para la flecha gigante
    duoPlace(red, D.rx, gy, side);
    if (t < 16) duoPose(red, 'rubyUlt', 'rec', t / 16);
    else if (t < 56) duoPose(red, 'dspc', 'wind', Math.min(1, (t - 16) / 14));
    else if (t < 62) duoPose(red, 'dspc', 'act');
    else if (t < 92) duoStand(red);
    else if (t < 120) duoPose(red, 'dspc', 'wind', Math.min(1, (t - 92) / 12));
    else if (t < 126) duoPose(red, 'dspc', 'act');
    else duoStand(red);
    // efectos
    const h = duoHand(red), tip = { x: h.x, y: h.y - 9 };
    if ((t >= 30 && t < 56) || (t >= 98 && t < 120)) if (t % 2 === 0) {     // el rubí se concentra en la flecha
      const a = Math.random() * Math.PI * 2, r = t >= 98 ? 22 : 14;
      g.fx.push({ kind: 'part', ptype: 'spark', x: tip.x + Math.cos(a) * r, y: tip.y + Math.sin(a) * r, vx: -Math.cos(a) * r / 7, vy: -Math.sin(a) * r / 7, t: 0, life: 7, size: 1, col: t % 4 ? RUBY_COL.l : '#ffffff' });
    }
    if (t === 30 || t === 98) Sfx.freeze();
    if (t === 56) Sfx.swing();
    if (t === 64) { Sfx.brk(); duoRadial(g, D.vx, gy - 142, 18, [RUBY_COL.l, RUBY_COL.m, '#ffd34a'], 1.8, 'spark', 18); }   // la flecha estalla en el cielo
    for (let i = 0; i < this.N; i++) {                                         // impactos de la lluvia
      const A = this.arrow(D, i); if (t !== A.ti) continue;
      if (A.miss) { g.burst(A.x, gy, 3, 'fire'); g.spark(A.x, gy - 2, 6, RUBY_COL.l); }
      else { v.flash = 2; g.spark(A.x, A.yEnd, 9, RUBY_COL.glow); g.burst(A.x, A.yEnd, 2, 'fire'); g.shake = Math.max(g.shake, 3); if (i % 2 === 0) Sfx.hit(7); }
    }
    if (t === 120) Sfx.swing();
    if (t === 136) {                                                          // ¡la flecha gigante!
      D.flash = 10; g.shake = 16; Sfx.hit(22); Sfx.brk(); v.flash = 6;
      const y = D.vtop - v.S.hh * 0.5;
      duoRadial(g, D.vx, y, 42, [RUBY_COL.l, RUBY_COL.m, '#ffd34a', '#ff7a20', '#ffffff'], 3.2);
      g.burst(D.vx, y, 12, 'fire');
    }
  },
  draw(c, g, D, layer) {
    const t = D.t - D.pre, red = D.a, gy = D.gy;
    if (layer === 'back') {
      if (t >= 60 && t < 146) rect(c, -W, -H, W * 3, H * 3, RUBY_COL.glow, 0.07 * Math.min(1, (t - 60) / 8, (146 - t) / 10));   // el cielo se tiñe de rubí
      return;
    }
    const h = duoHand(red), tip = { x: Math.round(h.x), y: Math.round(h.y - 9) };
    // la flecha de rubí cargándose en el arco
    if ((t >= 24 && t < 56) || (t >= 96 && t < 120)) {
      const big = t >= 96, k = big ? (t - 96) / 24 : (t - 24) / 32;
      glow(c, tip.x, tip.y, (big ? 7 : 4) + k * (big ? 8 : 5), RUBY_COL.glow, 0.3 + 0.3 * k, 3);
      pline(c, tip.x, tip.y + 8, tip.x, tip.y - (big ? 4 : 1), big ? 2 : 1, '#ffd0da'); rect(c, tip.x - 1, tip.y - (big ? 7 : 3), 3, big ? 3 : 2, RUBY_COL.m); px(c, tip.x, tip.y - (big ? 8 : 4), '#ffffff');
    }
    // la flecha que sube
    if (t >= 56 && t < 64) {
      const y = tip.y - (t - 56) * 16;
      pline(c, tip.x, y + 10, tip.x, y, 2, '#ffd0da'); rect(c, tip.x - 1, y - 3, 3, 3, RUBY_COL.m); px(c, tip.x, y - 4, '#ffffff');
      for (let i = 0; i < 4; i++) px(c, tip.x + ((i + t) % 3) - 1, y + 12 + i * 3, i % 2 ? '#ff7a20' : '#ffd040');
    }
    // la lluvia de flechas de rubí en llamas
    for (let i = 0; i < this.N; i++) {
      const A = this.arrow(D, i); if (t < A.t0 || t >= A.ti) continue;
      const y = Math.round(A.yTop + (t - A.t0) * 10), x = A.x, fl = (t + i) % 3;
      glow(c, x, y - 4, 5, RUBY_COL.glow, 0.25, 2);
      rect(c, x - 1, y - 15, 2, 12, '#ffd0da'); rect(c, x - 1, y - 15, 1, 12, '#ffffff');      // astil
      rect(c, x - 2, y - 4, 4, 2, RUBY_COL.m); rect(c, x - 1, y - 2, 2, 2, RUBY_COL.l); px(c, x, y, '#ffffff');   // punta de rubí
      rect(c, x - 2, y - 17, 4, 2, RUBY_COL.d);                                                // plumas
      px(c, x, y - 19 - fl, '#ffd040'); px(c, x + (fl ? 1 : -1), y - 21 - fl, '#ff7a20'); px(c, x - 1, y - 23, '#ff7a20', 0.6);
    }
    // la flecha gigante: sube y vuelve cayendo sobre el rival
    if (t >= 120 && t < 126) {
      const y = tip.y - (t - 120) * 22;
      pline(c, tip.x, y + 18, tip.x, y, 3, '#ffd0da'); glow(c, tip.x, y, 8, RUBY_COL.glow, 0.4, 3);
    }
    const gyA = this.giantY(D, t);
    if (gyA != null && t < 136) {
      const x = Math.round(D.vx), y = Math.round(gyA);
      glow(c, x, y - 8, 14, RUBY_COL.glow, 0.45, 3);
      pline(c, x, y - 30, x, y - 6, 3, '#ffd0da'); pline(c, x - 1, y - 30, x - 1, y - 6, 1, '#ffffff');
      for (let r = 0; r < 7; r++) rect(c, x - r, y - 7 + r, r * 2 + 1, 1, r < 2 ? '#ffffff' : RUBY_COL.m);   // punta de rubí
      rect(c, x - 4, y - 32, 9, 2, RUBY_COL.d);                                // plumas
      for (let i = 0; i < 6; i++) px(c, x + ((t + i) % 5) - 2, y - 34 - i * 3, i % 2 ? '#ff7a20' : '#ffd040');
    }
    if (t >= 136 && t < 152) {                                                 // onda del impacto
      const k = (t - 136) / 16, y = Math.round(D.vtop - D.v.S.hh * 0.5);
      withAlpha(c, 1 - k, () => { ring(c, Math.round(D.vx), y, 6 + (t - 136) * 5, RUBY_COL.l); ring(c, Math.round(D.vx), y, 3 + (t - 136) * 3, '#ffffff'); });
    }
  },
  launch(D) { return { lead: D.a, dir: D.side, h: { d: 36, b: 7.2, g: 2.4, ang: 72 } }; },
};

// ======================= Brisa: OJO DEL HURACÁN =======================
//  Atrapa al rival en un huracán, gira a su alrededor a toda velocidad golpeándolo desde todos los
//  lados (dejando imágenes de sí misma), sube a lo más alto y cae en picada atravesándolo.
DUO_ANIMS['ult:brisa'] = {
  name: 'OJO DEL HURACÁN', len: 150,
  setup(g, D) {
    const a = D.a, v = D.v, P = a.plat || STAGE.main;
    D.side = sgn(v.x - a.x) || a.dir;
    D.hx = clamp(v.x, P.x1 + 40, P.x2 - 40);
    D.cy = D.gy - 46;                                                // centro del huracán (donde flota el rival)
    D.vx0 = v.x; D.vy0 = v.y;
    D.focus = { x: D.hx, y: D.gy - 52, z: 1.7 };
  },
  // dónde está Brisa y qué postura tiene en cada momento (lo usan también sus imágenes fantasma)
  pos(D, t) {
    const { hx, cy, gy, side } = D, a0 = Math.PI * (side > 0 ? 1 : 0);
    if (t < 8) return { x: dLerp(D.a.x, hx - side * 40, t / 8), y: gy, dir: side, st: 'ground' };
    if (t < 20) return { x: hx - side * 40, y: gy, dir: side, st: 'jumpsquat' };
    if (t < 92) {                                                    // órbita: una vuelta cada ~18 fotogramas
      const ang = a0 + (t - 20) * 0.35, r = 30, x = hx + Math.cos(ang) * r, y = cy + Math.sin(ang) * 10 + 12;
      const dir = Math.cos(ang) > 0 ? -1 : 1;                        // siempre mirando al rival
      return { x, y: t < 26 ? dLerp(gy, y, (t - 20) / 6) : y, dir, mv: ((t >> 2) % 2) ? 'fair' : 'nair', ph: 'act' };
    }
    if (t < 110) {                                                   // sube en espiral a lo más alto
      const k = (t - 92) / 18, ang = a0 + 72 * 0.35 + (t - 92) * 0.45, r = 30 * (1 - k);
      return { x: hx + Math.cos(ang) * r, y: dLerp(cy + 12, cy - 72, dEase(k)), dir: side, mv: 'uair', ph: 'act' };
    }
    if (t < 118) return { x: hx, y: cy - 72 - Math.sin((t - 110) / 8 * Math.PI) * 3, dir: side, mv: 'dair', ph: 'wind', k: (t - 110) / 8 };
    if (t < 126) { const k = (t - 118) / 8; return { x: hx, y: dLerp(cy - 72, cy + 14, k * k), dir: side, mv: 'dair', ph: 'act' }; }
    if (t < 134) { const k = (t - 126) / 8; return { x: hx + side * k * 10, y: dLerp(cy + 14, gy, k), dir: side, mv: 'dair', ph: 'act' }; }
    return { x: hx + side * 10, y: gy, dir: side, st: 'landing' };
  },
  apply(f, P) {
    duoPlace(f, P.x, P.y, P.dir);
    if (P.mv) { duoPose(f, P.mv, P.ph, P.k ?? 1); if (P.ph === 'act') { const m = f.ch.moves[P.mv]; f.t = m.s + (f.animT % Math.max(1, m.a)); } }
    else duoStand(f, P.st);
  },
  step(g, D, t) {
    const bri = D.a, v = D.v, { hx, cy, gy, side } = D;
    // el rival, atrapado en el centro del huracán (y luego atravesado por la picada)
    let vy = t < 20 ? dLerp(D.vy0, cy + v.S.hh * 0.5, dEase(t / 20)) : cy + v.S.hh * 0.5 + Math.sin(t * 0.25) * 2;
    if (t >= 126) vy = cy + v.S.hh * 0.5 + (t - 126) * 0.8;
    duoPlace(v, t < 20 ? dLerp(D.vx0, hx, dEase(t / 20)) : hx + (t >= 20 && t < 92 ? Math.sin(t * 0.7) * 2 : 0), vy, -side);
    duoStand(v, 'hitstun'); if (t >= 20 && t < 110) v.dir = (t >> 3) % 2 ? 1 : -1;   // da vueltas en el viento
    this.apply(bri, this.pos(D, t));
    bri.vy = t >= 92 && t < 110 ? -2 : 1;
    if (t >= 92 && t < 110) D.focus = { x: hx, y: dLerp(gy - 52, cy - 50, (t - 92) / 18), z: 1.7 };
    if (t >= 118) D.focus = { x: hx, y: dLerp(cy - 50, gy - 52, Math.min(1, (t - 118) / 10)), z: 1.7 };
    // efectos
    if (t === 2) Sfx.freeze();
    if (t === 20) { Sfx.jump(); g.burst(hx - side * 40, gy, 8, 'dust'); }
    if (t >= 24 && t < 92 && t % 6 === 0) {                                  // golpes desde todos los lados
      const P = this.pos(D, t), hx2 = (P.x + v.x) / 2, hy2 = (P.y - 10 + v.y - v.S.hh * 0.5) / 2;
      v.flash = 2; g.spark(hx2, hy2, 8, t % 12 ? '#ffffff' : RUBY_COL.l); g.shake = Math.max(g.shake, 2); if (t % 12 === 0) Sfx.hit(6); else Sfx.swing();
    }
    if (t >= 10 && t < 118 && t % 2 === 0) {                                  // polvo y hojas girando en el huracán
      const k = Math.random(), a = Math.random() * Math.PI * 2, r = 14 + k * 34;
      g.fx.push({ kind: 'part', ptype: k > 0.85 ? 'star' : 'spark', x: hx + Math.cos(a) * r, y: gy - k * 100, vx: -Math.sin(a) * 2, vy: -0.6, t: 0, life: 14, size: 1, col: k > 0.85 ? '#bff2ff' : k > 0.5 ? '#ffffff' : '#9fd8c8' });
    }
    if (t === 110) Sfx.freeze();
    if (t === 118) Sfx.swing();
    if (t === 126) {                                                          // ¡la picada lo atraviesa!
      D.flash = 10; g.shake = 16; Sfx.hit(22); Sfx.brk(); v.flash = 6;
      const y = v.y - v.S.hh * 0.5;
      duoRadial(g, hx, y, 40, ['#ffffff', '#bff2ff', RUBY_COL.l, RUBY_COL.m], 3.2);
    }
    if (t === 134) { g.burst(hx + side * 10, gy, 14, 'dust'); g.shake = Math.max(g.shake, 6); Sfx.land(); }
  },
  draw(c, g, D, layer) {
    const t = D.t - D.pre, { hx, cy, gy } = D;
    // el huracán: anillos girando (mitad de atrás detrás de los luchadores, la de delante encima)
    if (t >= 6 && t < 130) {
      const grow = dEase((t - 6) / 16), fade = t >= 118 ? Math.max(0, 1 - (t - 118) / 12) : 1, Ht = 112 * grow;
      for (let i = 0; i < 16; i++) {
        const k = i / 15, y = gy - k * Ht, r = 16 + k * 34 + Math.sin(t * 0.1 + i) * 2, ph = t * 0.32 + i * 0.6, n = Math.ceil(r * 2.4);
        if (layer === 'back') rect(c, Math.round(hx - r), Math.round(y), Math.round(r * 2), 2, '#dff6ff', 0.06 * fade);
        for (let j = 0; j < n; j++) {
          if (j % 5 >= 3) continue;
          const a = j / n * Math.PI * 2 + ph, s = Math.sin(a);
          if ((layer === 'front') !== (s > 0)) continue;
          rect(c, Math.round(hx + Math.cos(a) * r), Math.round(y + s * r * 0.2), 2, 1, j % 2 ? '#ffffff' : '#bff2ff', (layer === 'front' ? 0.75 : 0.45) * fade);
        }
      }
    }
    if (layer === 'back') {
      // imágenes fantasma de Brisa (velocidad)
      if (t >= 22 && t < 126) {
        const sv = { x: D.a.x, y: D.a.y, dir: D.a.dir, st: D.a.st, move: D.a.move, moveName: D.a.moveName, t: D.a.t, vx: D.a.vx, vy: D.a.vy, lvx: D.a.lvx, lvy: D.a.lvy };
        for (const [lag, al] of [[6, 0.18], [4, 0.28], [2, 0.4]]) {
          this.apply(D.a, this.pos(D, t - lag));
          c.globalAlpha = al; renderFighter(c, D.a, g.frame); c.globalAlpha = 1;
        }
        Object.assign(D.a, sv);
      }
      return;
    }
    // estela de la picada
    if (t >= 118 && t < 132) {
      const y0 = cy - 72, y1 = Math.min(D.a.y, cy + 14);
      withAlpha(c, Math.max(0, 1 - (t - 124) / 8), () => { rect(c, Math.round(hx) - 3, Math.round(y0), 6, Math.round(y1 - y0), '#bff2ff'); rect(c, Math.round(hx) - 1, Math.round(y0), 2, Math.round(y1 - y0), '#ffffff'); });
    }
    if (t >= 126 && t < 142) {                                                 // onda del impacto
      const k = (t - 126) / 16, y = Math.round(cy);
      withAlpha(c, 1 - k, () => { ring(c, Math.round(hx), y, 6 + (t - 126) * 5, '#ffffff'); ring(c, Math.round(hx), y, 3 + (t - 126) * 3, RUBY_COL.l); });
    }
  },
  launch(D) { return { lead: D.a, dir: D.side, h: { d: 36, b: 7.2, g: 2.4, ang: 58 } }; },
};

// ======================= Runa: GRIMORIO PROHIBIDO =======================
//  Sella al rival, abre un grimorio antiguo, dibuja un círculo rúnico gigante en el cielo y de él baja
//  despacio un meteoro de runas que estalla en una columna de luz.
DUO_ANIMS['ult:runa'] = {
  name: 'GRIMORIO PROHIBIDO', len: 156,
  setup(g, D) {
    const a = D.a, v = D.v, P = a.plat || STAGE.main;
    D.side = sgn(v.x - a.x) || a.dir;
    D.vx = clamp(a.x + D.side * 58, P.x1 + 18, P.x2 - 18);
    D.rx = Math.abs(D.vx - a.x) < 40 ? clamp(D.vx - D.side * 58, P.x1 + 10, P.x2 - 10) : a.x;
    D.vx0 = v.x; D.vy0 = v.y; D.sky = D.gy - 128;
    D.focus = { x: (D.rx + D.vx) / 2, y: D.gy - 72, z: 1.5 };
  },
  meteorY(D, t) { return t < 60 ? null : dLerp(D.sky, D.gy - D.v.S.hh * 0.5, Math.pow((t - 60) / 50, 2.2)); },
  step(g, D, t) {
    const runa = D.a, v = D.v, gy = D.gy, side = D.side;
    // el rival, sellado en el sitio (flota un poco, quieto)
    duoPlace(v, t < 12 ? dLerp(D.vx0, D.vx, dEase(t / 12)) : D.vx, t < 12 ? dLerp(D.vy0, gy - 4, dEase(t / 12)) : gy - 4 + (t >= 110 ? -(t - 110) * 0.5 : 0), -side);
    duoStand(v, 'hitstun');
    // Runa: invoca el grimorio, alza el bastón hacia el círculo y lo hace caer
    duoPlace(runa, D.rx, gy, side);
    if (t < 14) duoPose(runa, 'rubyUlt', 'rec', t / 14);
    else if (t < 104) duoPose(runa, 'uspc', 'act');
    else if (t < 112) duoPose(runa, 'dspc', 'act');
    else duoStand(runa);
    // efectos
    if (t === 14) Sfx.join();
    if (t >= 20 && t < 60 && t % 8 === 0) Sfx.blip();
    if (t === 60) { Sfx.freeze(); g.shake = Math.max(g.shake, 3); }
    const my = this.meteorY(D, t);
    if (my != null && t < 110 && t % 2 === 0) {                                  // estela de runas del meteoro
      g.fx.push({ kind: 'part', ptype: t % 4 ? 'star' : 'spark', x: D.vx + (Math.random() * 14 - 7), y: my - 8 - Math.random() * 6, vx: (Math.random() - 0.5) * 0.6, vy: -0.8, t: 0, life: 16, size: 1, col: t % 4 ? runa.pal.light : RUBY_COL.l });
    }
    if (t === 110) {                                                             // ¡impacto!
      D.flash = 10; g.shake = 16; Sfx.hit(22); Sfx.brk(); v.flash = 6;
      duoRadial(g, D.vx, gy - v.S.hh * 0.5, 40, [runa.pal.light, '#ffffff', RUBY_COL.l, RUBY_COL.m], 3.2);
      g.burst(D.vx - 14, gy, 10, 'dust'); g.burst(D.vx + 14, gy, 10, 'dust');
    }
  },
  draw(c, g, D, layer) {
    const t = D.t - D.pre, runa = D.a, v = D.v, gy = D.gy, col = runa.pal.light, vx = Math.round(D.vx), sky = Math.round(D.sky);
    if (layer === 'back') {
      // el cielo se oscurece y el círculo rúnico gigante se va dibujando
      if (t >= 16 && t < 150) rect(c, -W, -H, W * 3, H * 3, '#1a0f3a', 0.22 * Math.min(1, (t - 16) / 12, (150 - t) / 12));
      if (t >= 20 && t < 140) {
        const k = Math.min(1, (t - 20) / 40), fade = Math.min(1, (140 - t) / 14), R = 52, sq = 0.32;
        const n = Math.ceil(R * 7 * k);
        for (let i = 0; i < n; i++) {                                            // anillo exterior trazándose
          const a = i / (R * 7) * Math.PI * 2 + t * 0.01;
          px(c, Math.round(vx + Math.cos(a) * R), Math.round(sky + Math.sin(a) * R * sq), '#ffffff', 0.9 * fade);
          px(c, Math.round(vx + Math.cos(a) * (R - 6)), Math.round(sky + Math.sin(a) * (R - 6) * sq), col, 0.8 * fade);
        }
        if (k > 0.5) {                                                           // estrella de seis puntas
          const kk = Math.min(1, (k - 0.5) * 2);
          withAlpha(c, 0.8 * fade * kk, () => {
            for (let i = 0; i < 6; i++) {
              const a1 = i / 6 * Math.PI * 2 + t * 0.01, a2 = a1 + Math.PI * 2 / 3;
              pline(c, vx + Math.cos(a1) * (R - 6), sky + Math.sin(a1) * (R - 6) * sq, vx + Math.cos(a2) * (R - 6), sky + Math.sin(a2) * (R - 6) * sq, 1, '#ff8aa0');
            }
          });
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 - t * 0.02; drawGlyph(c, vx + Math.cos(a) * (R + 6), sky + Math.sin(a) * (R + 6) * sq, i, i % 2 ? '#ffffff' : col, fade * kk); }
        }
        glow(c, vx, sky, 26 * k, col, 0.18 * fade, 3);
      }
      return;
    }
    // el sello alrededor del rival: dos anillos de runas girando
    if (t >= 4 && t < 110) {
      const cy = Math.round(v.y - v.S.hh * 0.5), a = Math.min(1, (t - 4) / 8);
      for (const [r, sp, n] of [[v.S.hw + 10, 0.08, 8], [v.S.hw + 16, -0.05, 10]]) {
        withAlpha(c, 0.5 * a, () => ring(c, Math.round(v.x), cy, r, col));
        for (let i = 0; i < n; i++) { const an = i / n * Math.PI * 2 + t * sp; drawGlyph(c, v.x + Math.cos(an) * r, cy + Math.sin(an) * r, i, '#ffffff', a); }
      }
    }
    // el grimorio flotando delante de Runa
    if (t >= 6 && t < 118) {
      const bx = Math.round(runa.x + runa.dir * 15), by = Math.round(gy - 30 + Math.sin(t * 0.12) * 2), open = t >= 16, a = Math.min(1, (t - 6) / 6, (118 - t) / 8);
      withAlpha(c, a, () => {
        if (open) {
          glow(c, bx, by - 2, 10, col, 0.35, 3);
          rect(c, bx - 9, by - 4, 18, 9, OUTLINE); rect(c, bx - 8, by - 3, 7, 7, '#efe3c6'); rect(c, bx + 1, by - 3, 7, 7, '#efe3c6');
          rect(c, bx - 1, by - 4, 2, 9, '#5a2a7a');
          for (let i = 0; i < 3; i++) { rect(c, bx - 7, by - 2 + i * 2, 5, 1, '#8a6ab8'); rect(c, bx + 2, by - 2 + i * 2, 5, 1, '#8a6ab8'); }
          if ((t >> 2) % 2) drawGlyph(c, bx - 4, by - 8 - ((t >> 1) % 6), t, '#ffffff');
        } else {
          rect(c, bx - 5, by - 6, 10, 12, OUTLINE); rect(c, bx - 4, by - 5, 8, 10, '#5a2a7a'); rect(c, bx - 4, by - 5, 8, 1, ROBE_GOLD); drawGlyph(c, bx, by, 2, ROBE_GOLD);
        }
      });
    }
    // el meteoro de runas
    const my = this.meteorY(D, t);
    if (my != null && t < 110) {
      const k = (t - 60) / 50, r = Math.round(5 + k * 8), y = Math.round(my);
      glow(c, vx, y, r * 2.2, col, 0.4, 3);
      disc(c, vx, y, r + 1, OUTLINE); disc(c, vx, y, r, '#c48cff'); disc(c, vx - 1, y - 1, Math.max(1, r - 3), '#ffffff', 0.7);
      for (let i = 0; i < 5; i++) { const an = i / 5 * Math.PI * 2 + t * 0.25; drawGlyph(c, vx + Math.cos(an) * (r + 5), y + Math.sin(an) * (r + 5), i, i % 2 ? '#ffffff' : RUBY_COL.l); }
      withAlpha(c, 0.35, () => pline(c, vx, sky, vx, y - r, 2, col));               // rastro desde el círculo
    }
    // la columna de luz
    if (t >= 110 && t < 140) {
      const k = (t - 110) / 30, w = Math.max(2, Math.round(20 * (1 - k)));
      rect(c, vx - w, sky, w * 2, gy - sky, col, 0.6 * (1 - k)); rect(c, vx - (w >> 1), sky, w, gy - sky, '#ffffff', 0.85 * (1 - k));
      withAlpha(c, 1 - k, () => { ring(c, vx, gy - 12, 6 + (t - 110) * 5, '#ffffff'); });
    }
  },
  launch(D) { return { lead: D.a, dir: D.side, h: { d: 36, b: 7.2, g: 2.4, ang: 84 } }; },
};
const ROBE_GOLD = '#ffd34a';

// ======================= Bloque: MONTAÑA VIVIENTE =======================
//  Absorbe rocas del escenario hasta convertirse en una montaña gigante (la cámara se aleja), el rival
//  diminuto levanta la vista y el puño gigante cae sobre él. Luego la montaña se desmorona.
DUO_ANIMS['ult:bloque'] = {
  name: 'MONTAÑA VIVIENTE', len: 168, BIG: 4,
  setup(g, D) {
    const a = D.a, v = D.v, P = a.plat || STAGE.main, reach = 25 * this.BIG - 4;   // dónde cae el puño gigante
    D.side = sgn(v.x - a.x) || a.dir;
    D.bx = a.x; D.vx = D.bx + D.side * reach;
    if (D.vx < P.x1 + 10 || D.vx > P.x2 - 10) { D.vx = clamp(D.vx, P.x1 + 10, P.x2 - 10); D.bx = D.vx - D.side * reach; }
    D.vx0 = v.x; D.vy0 = v.y;
    D.rocks = Array.from({ length: 16 }, (_, i) => ({ a: i / 16 * Math.PI * 2 + (i % 3) * 0.4, r: 90 + (i * 37) % 70, t0: (i * 5) % 30, s: 4 + (i % 3) * 2 }));
    D.focus = { x: (D.bx + D.vx) / 2, y: D.gy - 40, z: 1.8 };
  },
  scale(t) { return t < 24 ? 1 : t < 58 ? dLerp(1, this.BIG, dEase((t - 24) / 34)) : t < 132 ? this.BIG : t < 156 ? dLerp(this.BIG, 1, dEase((t - 132) / 24)) : 1; },
  // postura del gigante en cada momento
  pose(t) {
    if (t < 58) return ['stand'];
    if (t < 70) return ['stand'];
    if (t < 92) return ['fsmash', 'wind', (t - 70) / 22];
    if (t < 124) return ['fsmash', 'act'];
    return ['fsmash', 'rec', (t - 124) / 30];
  },
  step(g, D, t) {
    const blo = D.a, v = D.v, gy = D.gy, side = D.side, k = this.scale(t);
    // el rival, diminuto, mira hacia arriba… y el puño cae
    duoPlace(v, t < 14 ? dLerp(D.vx0, D.vx, dEase(t / 14)) : D.vx, t < 14 ? dLerp(D.vy0, gy, dEase(t / 14)) : gy, -side);
    if (t >= 92 && t < 128) duoStand(v, 'landing'); else if (t >= 128) duoStand(v, 'hitstun'); else duoStand(v, 'ground');
    // Bloque (mientras es gigante, el luchador normal no se dibuja: lo dibuja la técnica)
    duoPlace(blo, D.bx, gy, side);
    const P = this.pose(t);
    if (P[0] === 'stand') duoStand(blo); else duoPose(blo, P[0], P[1], P[2]);
    blo._giant = k > 1.02 ? k : 0;
    // cámara: se aleja para que quepa la montaña
    const zk = Math.min(1, Math.max(0, (t - 24) / 34)) * (t < 140 ? 1 : Math.max(0, 1 - (t - 140) / 16));
    D.focus = { x: dLerp((D.bx + D.vx) / 2, W / 2, zk), y: dLerp(gy - 40, H / 2, zk), z: dLerp(1.8, 1, zk) };
    // efectos
    if (t === 4) Sfx.freeze();
    if (t >= 24 && t < 58 && t % 6 === 0) { g.shake = Math.max(g.shake, 3); Sfx.hit(5); g.burst(D.bx + (Math.random() * 2 - 1) * 9 * k, gy, 3, 'dust'); }
    if (t === 58) { Sfx.remate(); g.shake = 8; }
    if (t === 92) {                                                        // ¡PUM!
      D.flash = 10; g.shake = 18; Sfx.hit(24); Sfx.brk(); v.flash = 6;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.burst(D.vx + s * (10 + i * 22), gy, 8, 'dust');
      duoRadial(g, D.vx, gy - 10, 30, ['#b9b6e0', '#8f8dc0', '#ffffff', RUBY_COL.l], 3);
    }
    if (t >= 132 && t < 156 && t % 2 === 0) {                              // la montaña se desmorona
      const h = 30 * k;
      g.fx.push({ kind: 'part', ptype: 'dust', x: D.bx + (Math.random() * 2 - 1) * 9 * k, y: gy - Math.random() * h, vx: (Math.random() - 0.5) * 2, vy: 0.8, t: 0, life: 20, size: 2 + (Math.random() * 2 | 0) });
    }
  },
  draw(c, g, D, layer) {
    const t = D.t - D.pre, blo = D.a, gy = D.gy, k = this.scale(t);
    if (layer === 'back') {
      // rocas del escenario volando hacia él
      if (t < 56) for (const R of D.rocks) {
        const u = (t - R.t0) / 22; if (u < 0 || u > 1) continue;
        const e = u * u, x = Math.round(D.bx + Math.cos(R.a) * R.r * (1 - e)), y = Math.round(gy - 20 + Math.sin(R.a) * R.r * 0.6 * (1 - e) - Math.sin(u * Math.PI) * 14);
        rect(c, x - 1, y - 1, R.s + 2, R.s + 2, OUTLINE); blo.ch.boulder(c, x, y, R.s, R.s, R.t0);
      }
      // sombra del puño sobre el rival
      if (t >= 70 && t < 92) { const s = (t - 70) / 22; shadow(c, D.vx, gy, 6 + s * 22, 0.25 + s * 0.4); }
      // el gigante (por detrás del rival diminuto)
      if (blo._giant) {
        glow(c, D.bx, gy - 15 * k, 16 * k, RUBY_COL.glow, t < 60 ? 0.2 : 0.1, 3);
        c.save(); c.translate(D.bx, gy); c.scale(k, k); c.translate(-D.bx, -gy);
        renderFighter(c, blo, g.frame);
        c.restore();
      }
      return;
    }
    // grietas de rubí brillando mientras crece
    if (blo._giant && t < 70) {
      const a = 0.5 + 0.5 * Math.sin(t * 0.5), h = 30 * k, w = 9 * k;
      withAlpha(c, a, () => { pline(c, D.bx - w * 0.4, gy - h * 0.8, D.bx - w * 0.1, gy - h * 0.45, 2, RUBY_COL.l); pline(c, D.bx + w * 0.3, gy - h * 0.6, D.bx, gy - h * 0.2, 2, RUBY_COL.l); });
    }
    if (t >= 92 && t < 112) {                                              // onda del impacto
      const q = (t - 92) / 20;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) rect(c, Math.round(D.vx + s * (16 + q * 90 + i * 8)) - 2, gy - 2 - i, 5, 1, '#ffe9b0', 0.8 * (1 - q));
    }
  },
  launch(D) { return { lead: D.a, dir: D.side, h: { d: 36, b: 7.2, g: 2.4, ang: 80 } }; },
};

// ======================= Maniquí: PROTOCOLO FINAL =======================
//  Interfaz de laboratorio: OBJETIVO FIJADO. Abre el panel del pecho y manda la señal; un satélite se
//  alinea en el cielo y dispara un láser orbital que acaba en una explosión enorme.
DUO_ANIMS['ult:maniqui'] = {
  name: 'PROTOCOLO FINAL', len: 156,
  setup(g, D) {
    const a = D.a, v = D.v, P = a.plat || STAGE.main;
    D.side = sgn(v.x - a.x) || a.dir;
    D.vx = clamp(a.x + D.side * 70, P.x1 + 16, P.x2 - 16);
    D.mx = Math.abs(D.vx - a.x) < 46 ? clamp(D.vx - D.side * 70, P.x1 + 10, P.x2 - 10) : a.x;
    D.vx0 = v.x; D.vy0 = v.y; D.sky = D.gy - 122;
    D.focus = { x: (D.mx + D.vx) / 2, y: D.gy - 64, z: 1.5 };
  },
  satX(D, t) { return t < 40 ? null : t < 70 ? dLerp(D.vx - D.side * 160, D.vx, dEase((t - 40) / 30)) : D.vx; },
  step(g, D, t) {
    const man = D.a, v = D.v, gy = D.gy, side = D.side;
    duoPlace(v, t < 12 ? dLerp(D.vx0, D.vx, dEase(t / 12)) : D.vx, t < 12 ? dLerp(D.vy0, gy, dEase(t / 12)) : gy, -side);
    duoStand(v, 'hitstun');
    duoPlace(man, D.mx, gy, side);
    if (t < 14) duoPose(man, 'rubyUlt', 'rec', t / 14);
    else if (t < 30) duoStand(man);
    else if (t < 96) duoPose(man, 'usmash', 'act');                          // abre el pecho y manda la señal hacia arriba
    else duoStand(man);
    // efectos
    if (t >= 6 && t < 30 && t % 5 === 0) Sfx.blip();
    if (t === 30) Sfx.join();                                                  // OBJETIVO FIJADO
    if (t >= 34 && t < 70 && t % 8 === 0) Sfx.blip();
    if (t === 80) Sfx.freeze();
    if (t >= 96 && t < 126) {                                                  // el láser orbital
      g.shake = Math.max(g.shake, 5); if (t % 3 === 0) v.flash = 2;
      if (t % 6 === 0) Sfx.hit(8);
      g.fx.push({ kind: 'part', ptype: 'spark', x: D.vx + (Math.random() * 2 - 1) * 14, y: gy - 2, vx: (Math.random() * 2 - 1) * 2.4, vy: -1.6 - Math.random() * 1.4, t: 0, life: 16, size: 1 + (t % 2), col: t % 3 ? '#9fe8ff' : '#ffffff' });
      g.burst(D.vx + (Math.random() * 2 - 1) * 12, gy, 1, 'smoke');
    }
    if (t === 126) {                                                          // ¡explosión!
      D.flash = 12; g.shake = 18; Sfx.hit(24); Sfx.brk(); v.flash = 6;
      duoRadial(g, D.vx, gy - v.S.hh * 0.5, 44, ['#9fe8ff', '#ffffff', '#ffd34a', '#ff7a20', RUBY_COL.l], 3.4);
      g.burst(D.vx, gy - 10, 14, 'fire'); g.burst(D.vx - 16, gy, 10, 'dust'); g.burst(D.vx + 16, gy, 10, 'dust');
    }
  },
  draw(c, g, D, layer) {
    const t = D.t - D.pre, man = D.a, v = D.v, gy = D.gy, vx = Math.round(D.vx), sky = Math.round(D.sky);
    if (layer === 'back') {
      if (t >= 80 && t < 140) rect(c, -W, -H, W * 3, H * 3, '#0a1830', 0.28 * Math.min(1, (t - 80) / 10, (140 - t) / 10));   // todo se oscurece
      return;
    }
    // interfaz de laboratorio sobre el rival
    if (t < 64) {
      const a = Math.min(1, t / 4, (64 - t) / 8), top = gy - v.S.hh - 3, k = Math.min(1, t / 24), locked = t >= 30;
      const col = locked ? '#5ee08a' : '#ff5a6a', pad = Math.round(dLerp(40, 6, k));
      const x0 = vx - v.S.hw - pad, x1 = vx + v.S.hw + pad, y0 = top - pad, y1 = gy + pad;
      withAlpha(c, a, () => {
        for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
          rect(c, sx > 0 ? x : x - 6, y - (sy > 0 ? 0 : 1), 7, 2, col); rect(c, x - (sx > 0 ? 0 : 1), sy > 0 ? y : y - 6, 2, 7, col);
        }
        if (!locked) for (let yy = top; yy < gy; yy += 3) rect(c, vx - v.S.hw - 3, yy, v.S.hw * 2 + 6, 1, '#ff3a4a', 0.25);
        else { ring(c, vx, Math.round(gy - v.S.hh * 0.5), v.S.hh * 0.6 + ((t >> 2) % 2), col); pline(c, vx - 12, gy - v.S.hh * 0.5, vx + 12, gy - v.S.hh * 0.5, 1, col); pline(c, vx, top - 4, vx, gy + 3, 1, col); }
        for (let i = 0; i < 4; i++) rect(c, x1 + 4, y0 + 2 + i * 4, 6 + ((t + i * 3) % 9), 2, col, 0.7);   // datos
      });
    }
    // el pecho abierto y la señal hacia el cielo
    if (t >= 30 && t < 100) {
      const cx = Math.round(man.x + man.dir * 1), cy = Math.round(gy - man.S.hh * 0.6), a = Math.min(1, (t - 30) / 6);
      withAlpha(c, a, () => { rect(c, cx - 3, cy - 3, 6, 6, OUTLINE); rect(c, cx - 2, cy - 2, 4, 4, '#9fe8ff'); px(c, cx - 1, cy - 1, '#ffffff'); });
      glow(c, cx, cy, 6 + (t % 4), '#9fe8ff', 0.4 * a, 3);
      for (let i = 0; i < 5; i++) { const y = cy - 8 - ((t * 4 + i * 26) % 130); if (y > sky) { const r = 3 + ((cy - y) / 26 | 0); withAlpha(c, 0.6, () => pline(c, cx - r, y, cx + r, y, 1, '#9fe8ff')); } }   // ondas de la señal
    }
    // el satélite
    const sx = this.satX(D, t);
    if (sx != null && t < 140) {
      const x = Math.round(sx), y = sky + Math.round(Math.sin(t * 0.08) * 2), open = Math.min(1, Math.max(0, (t - 60) / 12));
      const pw = Math.round(4 + 10 * open);
      c.save(); c.translate(x, y); c.scale(1.6, 1.6); c.translate(-x, -y);             // un poco más grande: que se vea bien
      rect(c, x - 5, y - 4, 10, 8, OUTLINE); rect(c, x - 4, y - 3, 8, 6, '#bcc0da'); rect(c, x - 4, y - 3, 8, 1, '#f1f2fb'); rect(c, x - 2, y - 1, 4, 2, man.pal.main);
      for (const s of [-1, 1]) {                                                 // paneles solares
        const px0 = s > 0 ? x + 6 : x - 6 - pw;
        rect(c, px0 - 1, y - 3, pw + 2, 6, OUTLINE); rect(c, px0, y - 2, pw, 4, '#2d4a9a');
        for (let i = 2; i < pw; i += 3) rect(c, px0 + i, y - 2, 1, 4, '#5a7ae0');
      }
      rect(c, x - 2, y + 4, 4, 2, '#8084aa'); rect(c, x - 3, y + 6, 6, 1, '#4f5180');   // antena hacia abajo
      if (t >= 70 && t < 126) glow(c, x, y + 7, 4 + ((t - 70) / 56) * 6, '#9fe8ff', 0.5, 3);
      c.restore();
    }
    // láser de puntería (rojo, parpadea)
    if (t >= 80 && t < 96 && (t >> 1) % 2) withAlpha(c, 0.8, () => pline(c, vx, sky + 12, vx, gy, 1, '#ff3a4a'));
    // ¡el láser orbital!
    if (t >= 96 && t < 132) {
      const k = (t - 96) / 30, w = t < 126 ? Math.round(10 + Math.sin(t * 0.9) * 2 + Math.min(1, k * 3) * 6) : Math.round(16 * (1 - (t - 126) / 6));
      if (w > 0) {
        rect(c, vx - w - 4, sky + 12, (w + 4) * 2, gy - sky - 12, '#9fe8ff', 0.25);
        rect(c, vx - w, sky + 12, w * 2, gy - sky - 12, '#9fe8ff', 0.7);
        rect(c, vx - (w >> 1), sky + 12, w, gy - sky - 12, '#ffffff', 0.95);
        groundEllipse(c, vx, gy, w + 8, '#ffffff', 0.9); groundEllipse(c, vx, gy, w + 14, '#9fe8ff', 0.6);
      }
    }
    if (t >= 126 && t < 146) {                                                   // onda de la explosión
      const q = (t - 126) / 20;
      withAlpha(c, 1 - q, () => { ring(c, vx, Math.round(gy - 14), 8 + (t - 126) * 6, '#ffffff'); ring(c, vx, Math.round(gy - 14), 4 + (t - 126) * 4, '#ffd34a'); });
    }
  },
  // "OBJETIVO FIJADO" sobre el rival (texto de pantalla)
  text(tx, g, D, t) {
    if (t < 30 || t >= 64) return;
    const p = g.toScreen(D.vx, D.gy - D.v.S.hh - 14);
    tx.text('OBJETIVO FIJADO', clamp(p.x, 70, W - 70), Math.round(p.y) - 8, 8, (t >> 2) % 2 ? '#5ee08a' : '#ffffff', 'center');
  },
  launch(D) { return { lead: D.a, dir: D.side, h: { d: 36, b: 7.2, g: 2.4, ang: 74 } }; },
};
