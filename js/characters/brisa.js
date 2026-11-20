'use strict';
// ============================================================
//  BRISA — exploradora del viento (rápida, combos)
//  Su estilo: muchos golpes pequeños seguidos y ENCADENAR.
//   · Casi todos sus ataques golpean varias veces.
//   · Si un ataque acierta, puede cancelarlo con un salto u otro
//     ataque (cancel) para seguir el combo.
//   · Su especial lateral la hace atravesar al rival.
//  A cambio pega flojo por golpe y sale volando con facilidad.
// ============================================================
(() => {
  const CLOTH = { l: '#5a5aa0', m: '#3b3b74', d: '#26264f', dd: '#17173a' };
  const SKIN = '#f2c9a8';

  function hood(c, hx, hy, pal, k = 1, hurt = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    R(-3, -4, 7, 7, pal.main);
    R(-2, -5, 5, 1, pal.main);
    R(-2, -5, 3, 1, pal.light);
    R(-3, -4, 1, 4, pal.light);
    R(-4, -2, 1, 5, pal.dark);
    R(-3, 3, 7, 1, pal.dark);
    R(0, -2, 4, 4, SKIN);
    R(0, 0, 4, 2, CLOTH.d);
    R(1, 0, 3, 1, CLOTH.m);
    if (hurt) R(2, -2, 2, 1, '#1b1636');
    else { R(2, -2, 1, 2, '#1b1636'); R(3, -2, 1, 1, '#ffffff'); }
  }

  // golpecitos que enlazan (mantienen al rival cerca) + golpe final
  const link = (box, on, extra = {}) => Object.assign({ box, d: 1, b: 1.0, g: 0, ang: 75, on, rehit: 3 }, extra);
  const fin  = (box, on, d, b, g, ang, extra = {}) => Object.assign({ box, d, b, g, ang, on }, extra);
  const kick = (ff, extra = {}) => Object.assign({ ff }, extra);

  // alterna las piernas muy rápido (ráfagas de patadas)
  const flurry = (hi, lo, rate = 2) => (p, f, k, t) => {
    if (k <= 0) { crouchPose(p, 1); return; }
    const a = Math.floor(t / rate) % 2;
    p.ff = a ? hi : lo; p.bf = a ? [-3, -1] : [0, -2];
    p.fh = [-3, -12]; p.bh = [4, -13];
    p.neck[0] -= 1; p.head[0] -= 1;
  };
  // giro completo del cuerpo (patadas giratorias)
  const spinKicks = (r = 10, rate = 0.9) => (p, f, k, t) => {
    if (k <= 0) { crouchPose(p, 2); p.fh = [-4, -12]; return; }
    const a = t * rate;
    p.ff = [Math.round(Math.cos(a) * r), Math.round(-9 + Math.sin(a) * 6)];
    p.bf = [Math.round(-Math.cos(a) * 4), Math.round(-3 - Math.sin(a) * 2)];
    p.fh = [Math.round(-Math.cos(a) * 6), -14]; p.bh = [Math.round(Math.cos(a) * 4), -13];
  };

  defineCharacter({
    id: 'brisa',
    name: 'Brisa',
    role: 'Combos',
    desc: 'Exploradora del viento. Ataques de varios golpes que se encadenan: si acierta, cancela con salto u otro ataque. Triple salto. Ligera.',
    stats: {
      walk: 3.1, gAcc: 0.6, fric: 0.4, airSpd: 2.5, aAcc: 0.26,
      jumpV: 6.5, hopV: 4.4, djumpV: 6.0, jumps: 2, grav: 0.28, maxFall: 4.0, fastFall: 6.2,
      weight: 78, hw: 5, hh: 21,
    },
    bust: { k: 2, y: -27, h: 18, dx: 1 },
    selectH: 36,              // alto en la pantalla de selección (para encajarlo en su panel)
    runRate: 0.42,
    chain: 10,
    rest: { hip: [0, -8], neck: [0, -15], head: [1, -19], fh: [5, -11], bh: [-3, -11], ff: [4, 0], bf: [-4, 0] },
    poses: {
      // Selección: guardia saltarina, patada alta mantenida y gesto de viento con la mano
      // Pantalla VS: rebota, patada alta giratoria y niega con el dedo
      taunt(p, f, T) {
        const t = T < 150 ? T : 100 + (T - 100) % 50;
        const bounce = (T >> 3) % 2;
        crouchPose(p, 1 + bounce); p.fh = [7, -11 + bounce]; p.bh = [2, -12 + bounce];
        if (t >= 24 && t < 30) { crouchPose(p, 2); p.fh = [4, -10]; }
        else if (t >= 30 && t < 56) {                                   // patada alta
          p.ff = [14, -19]; p.bf = [-2, 0]; p.fh = [-4, -13]; p.bh = [-6, -11];
          p.neck[0] -= 2; p.head[0] -= 2; p.hip[1] -= 1;
        } else if (t >= 66 && t < 120) {                                // "ni lo sueñes"
          p.fh = [9 + ((t >> 2) % 2 ? 1 : -1), -18]; p.bh = [-3, -9];
          p.head[0] += (t >> 3) % 2; p.head[1] -= 0;
        }
        return true;
      },
      select(p, f, T) {
        const t = T % 140;
        const bounce = (T >> 3) % 2;                       // rebote en las rodillas, sin despegar
        crouchPose(p, 1 + bounce);
        p.fh = [7, -11 + bounce]; p.bh = [2, -12 + bounce];
        if (t >= 56 && t < 64) { crouchPose(p, 2); p.fh = [4, -10]; }                         // prepara
        else if (t >= 64 && t < 84) {                                                          // patada alta
          p.ff = [13, -18]; p.bf = [-2, 0]; p.fh = [-4, -13]; p.bh = [-6, -11];
          p.neck[0] -= 2; p.head[0] -= 2; p.hip[1] -= 1;
        } else if (t >= 100 && t < 130) {                                                      // gesto de viento
          p.fh = [10, -16 + Math.round(Math.sin(t * 0.3))]; p.bh = [-4, -10];
          p.head[0] += 1;
        }
        return true;
      },
      // Victoria: saltitos con un giro, patada alta y gesto de viento
      win(p, f, T) {
        const t = T % 120, lift = (d) => { for (const k of ['hip', 'neck', 'head', 'fh', 'bh', 'ff', 'bf']) p[k][1] -= d; };
        if (t < 48) {                                              // tres saltitos
          const h = Math.round(Math.abs(Math.sin(t * Math.PI / 16)) * 7);
          lift(h); p.fh = [6, -24 - h]; p.bh = [-5, -20 - h]; p.ff = [3, -2 - h]; p.bf = [-3, -3 - h];
        } else if (t < 78) {                                       // patada alta
          p.ff = [14, -19]; p.bf = [-2, 0]; p.fh = [-4, -13]; p.bh = [-6, -11]; p.neck[0] -= 2; p.head[0] -= 2;
        } else {                                                   // saluda al viento
          const w = (t >> 3) % 2;
          p.fh = [8 + w, -20]; p.bh = [-3, -10]; p.head[0] += 1;
        }
        return true;
      },
      // Derrota: sentada en el suelo, agotada, con las manos en las rodillas
      lose(p, f, T) {
        const pant = (T >> 4) % 2;
        crouchPose(p, 5); p.ff = [7, -1]; p.bf = [-2, 0]; p.fh = [6, -6 + pant]; p.bh = [3, -6 + pant];
        p.head[0] += 2; p.head[1] += 2 + pant; p.neck[1] += pant;
        if (T % 90 > 70) p.head[0] -= (T >> 2) % 2 ? 1 : -1;         // niega con la cabeza
        return true;
      },
      idle(p, f, T) {
        const b = (T >> 3) % 2;
        p.hip[1] += 1 + b; p.neck[1] += 1 + b; p.head[1] += 1 + b; p.fh = [6, -11 + b]; p.bh = [2, -12 + b];
      },
      run(p, f, ph) {
        const s = Math.sin(ph), c = Math.cos(ph);
        p.ff = [Math.round(6 * s), -Math.max(0, Math.round(4 * c))];
        p.bf = [Math.round(-6 * s), -Math.max(0, Math.round(-4 * c))];
        p.fh = [-3, -10]; p.bh = [-5, -9];
        p.neck[0] += 3; p.head[0] += 4; p.head[1] += 1;
        return true;
      },
      air(p, f, vy) {
        if (vy < 0 && f.jumps < f.S.jumps && f.animT % 40 < 20) {
          const a = f.animT * 0.5;
          p.ff = [Math.round(Math.cos(a) * 5), Math.round(-9 + Math.sin(a) * 5)];
          p.bf = [Math.round(-Math.cos(a) * 4), Math.round(-9 - Math.sin(a) * 4)];
          p.fh = [4, -12]; p.bh = [-3, -12];
          return true;
        }
        return false;
      },
    },

    moves: {
      // Ráfaga de patadas: 4 golpecitos + empujón
      jab:    { s: 2, a: 14, e: 8,
                hit: [link([3, -14, 15, 9], [2, 12]), fin([3, -16, 17, 10], [14, 15], 3, 2.4, 2.0, 40)],
                pose: flurry([12, -9], [11, -13]) },
      // Doble patada: baja y alta
      ftilt:  { s: 4, a: 9, e: 12, cancel: true,
                hit: [fin([4, -11, 16, 8], [4, 6], 3, 1.4, 0.3, 55), fin([4, -21, 18, 10], [10, 12], 5, 2.6, 3.4, 40)],
                pose(p, f, k, t) {
                  if (k <= 0) { crouchPose(p, 1); return; }
                  if (t < 9) { p.ff = [14, -6]; p.fh = [-3, -12]; }
                  else { p.bf = [15, -16]; p.ff = [-2, 0]; p.fh = [-5, -11]; p.neck[0] -= 2; p.head[0] -= 2; }
                } },
      // Molinillo: dos patadas hacia arriba (la segunda lanza)
      utilt:  { s: 3, a: 8, e: 10, cancel: true,
                hit: [fin([-9, -36, 18, 18], [3, 5], 3, 1.2, 0, 95), fin([-9, -38, 18, 20], [8, 10], 4, 2.8, 3.0, 92)],
                pose(p, f, k, t) { if (k <= 0) return; p.ff = t < 7 ? [3, -26] : [-2, -28]; p.bf = [-2, 0]; p.fh = [4, -8]; p.bh = [-4, -8]; } },
      // Barrido que levanta al rival (para empezar combos)
      dtilt:  { s: 3, a: 3, e: 8, cancel: true, hit: [{ box: [3, -5, 19, 6], d: 4, b: 2.0, g: 1.4, ang: 80 }], pose: kick([16, -1], { crouch: true }) },
      // Barrida en carrera: deja al rival en el aire
      dash:   { s: 4, a: 10, e: 14, cancel: true, hit: [{ box: [2, -9, 19, 9], d: 5, b: 2.4, g: 1.6, ang: 78 }], pose: kick([15, -2], { crouch: true, fh: [-4, -8] }),
                onFrame(f, t) { if (t < 14) f.vx = f.dir * 4.0; } },
      // Tornado de tres patadas avanzando
      fsmash: { s: 9, a: 11, e: 20, smash: true,
                hit: [fin([4, -18, 18, 12], [9, 10], 4, 1.2, 0.2, 45), fin([4, -18, 18, 12], [13, 14], 4, 1.2, 0.2, 45),
                      fin([5, -20, 22, 13], [17, 19], 8, 3.2, 8.4, 38)],
                pose: spinKicks(12, 0.8),
                onFrame(f, t) { if (t >= 9 && t < 20) f.vx = f.dir * 1.8; } },
      // Pino giratorio: muchos golpes + lanzamiento hacia arriba
      usmash: { s: 9, a: 11, e: 20, smash: true,
                hit: [link([-14, -38, 28, 22], [9, 17], { ang: 90 }), fin([-14, -42, 28, 24], [18, 19], 6, 3.4, 8.4, 88)],
                pose(p, f, k, t) {
                  if (k <= 0) { crouchPose(p, Math.round(-k * 4)); return; }
                  const a = t * 0.9;
                  p.fh = [3, -1]; p.bh = [-3, -1]; p.head = [1, -6]; p.neck = [0, -9]; p.hip = [0, -16];
                  p.ff = [Math.round(Math.cos(a) * 9), -24 + Math.round(Math.sin(a) * 3)];
                  p.bf = [Math.round(-Math.cos(a) * 9), -24 - Math.round(Math.sin(a) * 3)];
                } },
      // Abanico: barre delante y luego detrás
      dsmash: { s: 7, a: 6, e: 18, smash: true,
                hit: [fin([2, -7, 27, 8], [7, 8], 8, 3.0, 7.2, 28), fin([-29, -7, 27, 8], [11, 12], 8, 3.0, 7.2, 152)],
                pose(p, f, k, t) {
                  crouchPose(p, 3);
                  if (k <= 0) return;
                  if (t < 11) { p.ff = [17, -1]; p.bf = [-4, 0]; } else { p.bf = [-17, -1]; p.ff = [4, 0]; }
                  p.fh = [3, -6]; p.bh = [-3, -6];
                } },
      // Peonza aérea: golpes continuos + final
      nair:   { s: 3, a: 12, e: 8, air: true, land: 5, cancel: true,
                hit: [link([-12, -23, 24, 23], [3, 12]), fin([-13, -24, 26, 24], [13, 14], 4, 2.4, 3.0, 40, { away: true })],
                pose: spinKicks(10, 1.0) },
      // Patada doble hacia delante
      fair:   { s: 5, a: 6, e: 12, air: true, land: 8, cancel: true,
                hit: [fin([4, -16, 18, 12], [5, 6], 3, 1.2, 0, 60), fin([4, -16, 19, 13], [9, 10], 6, 2.8, 4.8, 40)],
                pose(p, f, k, t) { if (k <= 0) return; p.ff = t < 8 ? [15, -9] : [14, -5]; p.bf = t < 8 ? [-2, -3] : [12, -7]; p.fh = [-4, -14]; } },
      // Coz hacia atrás: su golpe más fuerte (sin cancelación)
      bair:   { s: 5, a: 3, e: 12, air: true, land: 8, hit: [{ box: [-23, -17, 17, 11], d: 11, b: 3.2, g: 6.8, ang: 150 }], pose: { bf: [-16, -10], fh: [6, -14], lean: 2 } },
      // Bicicleta hacia arriba
      uair:   { s: 3, a: 11, e: 10, air: true, land: 6, cancel: true,
                hit: [link([-9, -38, 18, 19], [3, 11], { ang: 90 }), fin([-9, -40, 18, 20], [12, 13], 4, 2.8, 4.0, 88)],
                pose(p, f, k, t) { const a = t * 1.1; p.ff = [Math.round(Math.cos(a) * 4), -24 + Math.round(Math.sin(a) * 3)]; p.bf = [Math.round(-Math.cos(a) * 4), -20]; p.fh = [5, -6]; p.bh = [-4, -6]; } },
      // Taladro hacia abajo: golpecitos y rebote
      dair:   { s: 6, a: 11, e: 12, air: true, land: 10, cancel: true,
                hit: [link([-6, -4, 12, 13], [6, 14], { ang: -85, b: 0.8 }), fin([-7, -5, 14, 14], [15, 16], 4, 2.4, 3.0, 60)],
                pose(p, f, k, t) { if (k <= 0) return; const w = (t >> 1) % 2; p.ff = [w ? 2 : 1, 6]; p.bf = [w ? -1 : 0, 5]; p.fh = [6, -16]; p.bh = [-6, -16]; } },
      // Especial: cuchilla de viento (rápida, débil, recarga pronto)
      nspc:   { s: 7, a: 1, e: 12, air: true, land: 3, special: true, hit: [], cd: 22, pose: kick([13, -12], { fh: [-4, -10] }),
                onFrame(f, t, g) { if (t === 7) g.spawnProjectile(f, { kind: 'blade', x: 10, y: -12, vx: 6.5, life: 40, r: 4, h: { d: 4, b: 1.6, g: 1.6, ang: 30 } }); } },
      // Especial lateral: paso del viento — atraviesa al rival y lo lanza por detrás
      sspc:   { s: 5, a: 12, e: 14, air: true, land: 8, special: true, keepVel: true,
                hit: [{ box: [-6, -20, 20, 20], d: 7, b: 2.8, g: 3.8, ang: 125, noFx: true }],
                pose(p, f, k) { crouchPose(p, 2); p.neck[0] += 4; p.head[0] += 5; p.fh = [-6, -10]; p.bh = [-8, -9]; p.ff = [3, -2]; p.bf = [-6, -1]; },
                onStart(f) { f.sideUsed = true; },
                onFrame(f, t, g) {
                  if (t < 5) { f.vx *= 0.5; f.vy *= 0.3; }
                  else if (t < 17) { f.vx = f.dir * 7.4; f.vy = 0; f.invuln = Math.max(f.invuln, 2); f.trail = 1; f.hidden = t % 2 === 0; }
                  else { f.vx *= 0.75; f.hidden = false; }
                },
                noGrav: (f, t) => t < 17 },
      // Especial arriba: torbellino con golpes continuos
      uspc:   { s: 3, a: 18, e: 10, air: true, land: 10, special: true, keepVel: true, after: 'helpless', recovery: true,
                hit: [link([-10, -28, 20, 30], [3, 18], { rehit: 4, ang: 90 }), fin([-11, -32, 22, 32], [19, 20], 5, 3.0, 4.0, 85)],
                pose(p, f, k, t) { const a = t * 1.2; p.fh = [Math.round(Math.cos(a) * 8), -14]; p.bh = [Math.round(-Math.cos(a) * 8), -14]; p.ff = [2, -2]; p.bf = [-2, 0]; },
                onStart(f) { f.upUsed = true; f.grounded = false; },
                onFrame(f, t) {
                  if (t === 3) { f.vy = -9.4; f.vx = f.inp.mx * 2; }
                  if (t > 3 && t < 21) { f.vx = clamp(f.vx + f.inp.mx * 0.12, -2.6, 2.6); f.trail = 1; }
                } },
      // Especial abajo: picada en diagonal (desde el suelo da un saltito primero)
      dspc:   { s: 5, a: 40, e: 6, air: true, land: 0, special: true, keepVel: true, landTo: 'dspcLand', airOnly: true, cancel: true,
                hit: [{ box: [2, -7, 14, 13], d: 7, b: 2.4, g: 3.0, ang: 70 }], pose: kick([10, 3], { bf: [-4, -6], fh: [-5, -14], lean: 2 }),
                onStart(f) { if (f.grounded) { f.vy = -4.6; f.grounded = false; f.plat = null; } },
                onFrame(f, t) {
                  if (t < 5) { f.vy = Math.min(f.vy + 0.3, 1); f.vx *= 0.7; }
                  else if (!f.landedHit) { f.vx = f.dir * 4.6; f.vy = 5.4; f.trail = 1; }
                  else { f.vy = -3; f.vx = -f.dir * 1.5; f.t = Math.max(f.t, 44); }   // rebota al acertar
                },
                noGrav: (f, t) => t >= 5 && !f.landedHit },
      dspcLand: { s: 1, a: 2, e: 10, special: true, hit: [{ box: [0, -8, 14, 8], d: 4, b: 2.2, g: 2.0, ang: 60 }],
                  pose: { crouch: true, ff: [6, 0] },
                  onStart(f, g) { f.vx = -f.dir * 1.5; g.burst(f.x, f.y, 4, 'dust'); } },
      // Agarre rápido y lanzamiento a patadas
      fthrow: { s: 7, a: 1, e: 10, hit: [], throw: { d: 6, b: 3.0, g: 4.0, ang: 45 }, path: () => [12, -10], pose: kick([14, -10], { fh: [-4, -12] }) },
    },

    draw(c, f, p, A) {
      const pal = f.pal;
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const sh = [neck[0], neck[1] + 1];
      drawChain(c, f, [neck[0] - 1, neck[1]], 2, [pal.main, pal.main, pal.light, pal.dark]);
      pline(c, sh[0] - 1, sh[1], bh[0], bh[1], 2, CLOTH.dd);
      rect(c, bh[0] - 1, bh[1] - 1, 2, 2, SKIN);
      pline(c, hip[0] - 1, hip[1], bf[0], bf[1] - 1, 2, CLOTH.d);
      rect(c, bf[0] - 1, bf[1] - 2, 3, 2, pal.dark);
      pline(c, hip[0], hip[1], neck[0], neck[1] + 1, 4, CLOTH.m);
      pline(c, hip[0] - 1, hip[1], neck[0] - 1, neck[1] + 1, 1, CLOTH.l);
      rect(c, hip[0] - 2, hip[1] - 1, 5, 2, pal.main);
      px(c, hip[0] - 3, hip[1], pal.main); px(c, hip[0] - 4, hip[1] + 1, pal.dark);
      pline(c, hip[0] + 1, hip[1], ff[0], ff[1] - 1, 2, CLOTH.m);
      const mx = Math.round((hip[0] + ff[0]) / 2), my = Math.round((hip[1] + ff[1]) / 2);
      px(c, mx, my, '#e8e2ff');
      rect(c, ff[0] - 1, ff[1] - 2, 4, 2, pal.main); px(c, ff[0] - 1, ff[1] - 2, pal.light);
      // estela de viento en las patadas activas
      if (f.st === 'attack' && f.move && f.t >= f.move.s && f.t < f.move.s + f.move.a && !f.move.special) {
        px(c, ff[0] + 2, ff[1] - 3, '#ffffff'); px(c, ff[0] + 3, ff[1] - 1, pal.glow);
      }
      hood(c, hd[0], hd[1], pal, 1, f.st === 'hitstun');
      pline(c, sh[0] + 1, sh[1], fh[0], fh[1], 2, CLOTH.m);
      rect(c, fh[0] - 1, fh[1] - 1, 3, 3, SKIN);
      px(c, fh[0] - 1, fh[1] + 1, pal.main);
    },
    portrait(c, x, y, pal, k) { hood(c, x, y, pal, k); },
  });

  // ------------------------------------------------------------
  //  Escena de selección: CUMBRE DEL VIENTO (amanecer)
  // ------------------------------------------------------------
  const FLAGS = ['#e8443f', '#f4c03a', '#3ec96b', '#3d7ef2', '#f1eeff'];
  const ropeY = (x, W) => 12 + Math.round(Math.sin(x / W * Math.PI) * 8);
  CHARACTERS.brisa.scene = {
    base(c, W, H, gy) {
      const fy = gy - 4;
      sceneGrad(c, 0, 0, W, fy, ['#2d2a66', '#4a3d88', '#7a52a4', '#b8689f', '#ec8a8e', '#ffb08a', '#ffd39a']);
      const sx = Math.round(W * 0.72), sy = Math.round(fy * 0.62);
      for (let y = -11; y <= 11; y++) { const hw = Math.floor(Math.sqrt(121 - y * y)); for (let x = -hw; x <= hw; x++) px(c, sx + x, sy + y, y < -4 ? '#fff6d6' : y < 3 ? '#ffe9a8' : '#ffcf80'); }
      const ridge = (base, amp, f, ph, col, top) => {
        for (let x = 0; x < W; x++) {
          const h = Math.round(base - Math.abs(Math.sin(x * f + ph)) * amp - Math.sin(x * f * 2.7) * amp * 0.25);
          rect(c, x, h, 1, H - h, col); px(c, x, h, top);
        }
      };
      ridge(Math.round(fy * 0.78), fy * 0.18, 0.05, 1, '#7a4f8f', '#c48ab0');
      ridge(Math.round(fy * 0.9), fy * 0.14, 0.07, 3, '#4b3570', '#8a5aa8');
      ridge(Math.round(fy * 1.0), fy * 0.1, 0.09, 5, '#2d2350', '#5a4384');
      sceneGrad(c, 0, fy + 6, W, H - fy - 6, ['#2d2350', '#1e1838', '#141028']);
      for (let x = 0; x < W; x++) px(c, x, ropeY(x, W), '#3a2a5a');
    },
    anim(c, W, H, gy, T) {
      const fy = gy - 4;
      for (let i = 0; i < 3; i++) {
        const x = Math.round(((T * (0.25 + i * 0.1) + i * 60) % (W + 50)) - 40), y = Math.round(fy * 0.3) + i * 11;
        rect(c, x, y, 26 - i * 4, 2, '#ffe1c8'); rect(c, x + 6, y - 1, 12, 1, '#fff3e4'); rect(c, x + 3, y + 2, 20 - i * 4, 1, '#e7a3a6');
      }
      for (let i = 0; i < Math.round(W / 18); i++) {
        const len = 8 + (i * 5) % 12, x = Math.round(((T * (2.2 + i * 0.3) + i * 47) % (W + len * 2)) - len);
        const y = 22 + (i * 13) % Math.max(20, fy - 30);
        rect(c, x, y, len, 1, i % 2 ? '#ffffff' : '#ffe9f0'); px(c, x + len, y - 1, '#ffffff');
      }
      for (let fx = 6; fx < W - 6; fx += 15) {
        const fy0 = ropeY(fx, W), wave = Math.round(Math.sin(T * 0.25 + fx) * 2), col = FLAGS[Math.round(fx / 15) % FLAGS.length];
        for (let k = 0; k < 6; k++) rect(c, fx + k + Math.round(wave * k / 6), fy0 + 1, 1, Math.max(1, 6 - k), col);
        px(c, fx, fy0 + 1, '#120d24');
      }
    },
    platform(c, cx, gy, T, W, H) {
      const w = Math.min(44, W - 8), x0 = Math.round(cx - w / 2);
      rect(c, x0 + 6, gy + 4, w - 12, H - gy, '#120d24');
      for (let x = x0 + 7; x < x0 + w - 7; x++) for (let y = gy + 4; y < H; y++)
        px(c, x, y, ((x - x0) % 6 === 0) ? '#4a2c18' : sceneDither(['#5e3a20', '#7a4c2a', '#9a6438'], 1 - (x - x0) / w, x, y));
      rect(c, x0 + 7, gy + 12, w - 14, 3, '#e8d5a8'); rect(c, x0 + 7, gy + 14, w - 14, 1, '#b8a070');
      rect(c, x0 - 1, gy - 1, w + 2, 7, '#120d24');
      for (let x = x0; x < x0 + w; x++) for (let y = gy; y < gy + 5; y++) {
        const dx = (x - cx) / (w / 2), ring = Math.floor(Math.abs(dx) * 4 + (y - gy) * 0.3);
        px(c, x, y, y === gy + 4 ? '#7a4c2a' : ring % 2 ? '#d9a46a' : '#b8804a');
      }
      for (let i = 0; i < 6; i++) { const gx = x0 + 3 + i * 7, lean = Math.round(Math.sin(T * 0.2 + i) * 1.5) + 1; pline(c, gx, gy, gx + lean, gy - 3, 1, i % 2 ? '#6ad85c' : '#36a352'); }
    },
  };
})();
