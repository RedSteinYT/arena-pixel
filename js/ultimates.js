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
