'use strict';
// ============================================================
//  REDSTEIN — el luchador del canal
//  Basado en la skin de RedStein: capucha de cuadros rojos y negros,
//  audífonos rojos, ojos rojo y azul, camiseta con su logo.
//  Estilo: espadachín de fuego con arco.
//   · Espada de cristal que se enciende al atacar.
//   · Muchos golpes QUEMAN: el rival sigue sumando daño unos segundos.
//   · Arco (especial): mantenlo para cargar; cargado, la flecha arde.
//   · Lluvia de flechas de fuego y ascenso de fénix.
// ============================================================
(() => {
  // Paleta propia del juego (inspirada en la skin, no copiada)
  const HOOD = { hi: '#ff6a56', l: '#f0403a', m: '#d0262c', d: '#8e1420', dd: '#4a0a14', st: '#2a0810' };
  const SKIN = { l: '#ffd2a8', m: '#f0aa7c', d: '#c07a54' };
  const HAIR = { l: '#5a3622', m: '#33200f', d: '#1c1008' };
  const PANTS = { l: '#3a3650', m: '#1e1c2c', d: '#100e18' };
  const BLADE = { l: '#d8fff8', m: '#46e6d4', d: '#16a09a', dd: '#0a5a5c' };
  const UP = -Math.PI / 2;

  // logo "R" de la camiseta (3x5)
  function logo(c, x, y) {
    rect(c, x, y, 5, 7, '#f6f4fa');
    [0b111, 0b101, 0b110, 0b101, 0b101].forEach((row, ry) => { for (let b = 0; b < 3; b++) if (row & (4 >> b)) px(c, x + 1 + b, y + 1 + ry, '#120d24'); });
  }

  // Cabeza: capucha redondeada con rayas de cuadros, flequillo en puntas,
  // ojos rojo y azul que brillan y audífonos rojos. Mira hacia la derecha.
  function headArt(c, hx, hy, k = 1, hurt = false, blink = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    // silueta de la capucha (filas: desde, hasta)
    const rows = [[-3, 2], [-5, 3], [-6, 4], [-6, 4], [-6, 4], [-6, 4], [-6, 4], [-6, 3], [-5, 3], [-4, 2]];
    rows.forEach(([x0, x1], i) => {
      const y = i - 6;
      for (let x = x0; x <= x1; x++) {
        let col = HOOD.m;
        if (x <= x0 + 1 || y === -6) col = HOOD.l;
        if (x === x1 || y >= 2) col = HOOD.d;
        if (x === -2 || y === -3) col = HOOD.st;             // rayas de cuadros
        R(x, y, 1, 1, col);
      }
    });
    R(-3, -6, 3, 1, HOOD.hi);
    // cara (se ve por la abertura de la capucha)
    R(-1, -3, 6, 6, SKIN.m); R(-1, -3, 6, 1, SKIN.l); R(4, -2, 1, 5, SKIN.d); R(-1, 2, 5, 1, SKIN.d);
    // flequillo en puntas
    R(-2, -4, 7, 2, HAIR.m); R(-2, -4, 6, 1, HAIR.l);
    R(0, -2, 1, 1, HAIR.m); R(2, -2, 1, 2, HAIR.m); R(4, -2, 1, 1, HAIR.m); R(-1, -2, 1, 2, HAIR.d);
    // ojos: rojo (atrás) y azul (delante)
    if (hurt || blink) { R(1, 0, 1, 1, '#120d24'); R(3, 0, 2, 1, '#120d24'); }
    else {
      R(1, -1, 1, 2, '#ff3a3a'); R(1, -1, 1, 1, '#ffd0d0');
      R(3, -1, 2, 2, '#ffffff'); R(4, -1, 1, 2, '#3a62ff'); R(4, -1, 1, 1, '#c8d8ff');
    }
    R(2, 2, 2, 1, '#a0583c');                               // boca
    // audífonos: copa roja en el lado de la capucha y diadema
    R(-6, -2, 3, 4, '#2a0810'); R(-6, -1, 2, 2, '#ff3a3a'); R(-6, -1, 1, 1, '#ffb0b0');
    R(-5, -7, 6, 1, '#9a9aaa'); R(-5, -7, 2, 1, '#d8d8e4');
  }

  // pose de la espada: ángulo de la hoja (0 = hacia delante, -PI/2 = arriba)
  function swordPose(from, to, wind, fhTo, fhWind, fire = 1, extra) {
    return (p, f, k, t) => {
      if (k >= 0) { p.sword = lerp(from, to, k); if (fhTo) p.fh = L2(p.fh, fhTo, k); p.fire = k > 0.2 ? fire : 0; }
      else { p.sword = lerp(from, wind ?? from, -k); if (fhWind) p.fh = L2(p.fh, fhWind, -k); p.fire = 0; }
      if (extra) extra(p, f, k, t);
    };
  }
  const tipOf = f => {
    const a = f._swA ?? -0.9, hx = f._hx ?? 6, hy = f._hy ?? -11;
    return [f.x + f.dir * (hx + Math.cos(a) * 13), f.y + hy + Math.sin(a) * 13];
  };
  const flameAtTip = (f, g, n = 3) => { const [x, y] = tipOf(f); g.burst(x, y, n, 'fire'); };
  const flameAlong = (f, g) => { const [x, y] = tipOf(f); for (let i = 0; i < 3; i++) g.burst(lerp(f.x + f.dir * 6, x, Math.random()), lerp(f.y - 12, y, Math.random()), 1, 'fire'); };

  defineCharacter({
    id: 'redstein',
    name: 'RedStein',
    role: 'Espada y fuego',
    desc: 'El luchador del canal. Espada de cristal en llamas, arco que se carga y golpes que queman.',
    stats: { walk: 2.4, airSpd: 2.05, jumpV: 6.5, djumpV: 6.1, weight: 95, hw: 6, hh: 25 },
    bust: { k: 2, y: -31, h: 18, dx: 0 },
    selectH: 40,
    rest: { hip: [0, -9], neck: [1, -17], head: [2, -22], fh: [6, -11], bh: [-2, -12], ff: [4, 0], bf: [-4, 0], sword: 2.55 },
    chain: 4,
    poses: {
      // Selección: guardia, giro de espada en llamas, la clava en el fuego y saluda
      // Pantalla VS: floritura de espada en llamas y apunta la hoja al rival
      taunt(p, f, T) {
        const t = T < 150 ? T : 96 + (T - 96) % 54;
        const breathe = Math.sin(T * 0.08) > 0.3 ? 1 : 0;
        if (t < 26) { crouchPose(p, 1 + breathe); p.sword = 2.55; p.fh = [6, -11]; p.bh = [3, -13]; }
        else if (t < 62) { p.sword = 2.55 + (t - 26) * 0.52; p.fire = 1; p.fh = [6, -16]; p.neck[0] += 1; }   // floritura
        else if (t < 70) { crouchPose(p, 2); p.sword = -1.2; p.fire = 1; p.fh = [5, -18]; }
        else {                                                           // en guardia, la punta hacia el rival
          crouchPose(p, 2 + breathe); p.sword = -0.18 + Math.sin(T * 0.07) * 0.04; p.fire = 1;
          p.fh = [10, -15]; p.bh = [-5, -13 + ((t >> 4) % 2)]; p.neck[0] += 1; p.head[0] += 1;
        }
        return true;
      },
      select(p, f, T) {
        const t = T % 180;
        const breathe = Math.sin(T * 0.08) > 0.3 ? 1 : 0;
        if (t < 40) { crouchPose(p, 1 + breathe); p.sword = 2.55; }
        else if (t < 76) { p.sword = 2.55 + (t - 40) * 0.42; p.fire = 1; p.fh = [6, -15]; p.neck[0] += 1; }      // floritura
        else if (t < 110) { crouchPose(p, 3); p.sword = 1.25; p.fire = 1; p.fh = [9, -7]; p.bh = [-6, -11]; }   // la clava ante sí
        else if (t < 150) { p.sword = 2.55; p.bh = [-3 + Math.round(Math.sin(t * 0.45) * 2), -29]; p.head[1] -= 1; } // saluda
        else { crouchPose(p, 1 + breathe); p.sword = 2.55; }
        return true;
      },
      // Victoria: gira la espada en llamas, la clava y la alza al cielo ardiendo
      win(p, f, T) {
        if (T < 24) { crouchPose(p, 2); p.sword = 2.55 + T * 0.55; p.fire = 1; p.fh = [6, -16]; }
        else if (T < 40) { crouchPose(p, 4); p.sword = 1.35; p.fire = 1; p.fh = [9, -6]; p.bh = [-4, -11]; }   // la clava
        else {
          const pump = ((T - 40) % 70) < 10 ? -2 : 0, b = Math.sin(T * 0.1) > 0 ? 1 : 0;
          p.sword = -1.57 + Math.sin(T * 0.08) * 0.05; p.fire = 1;
          p.fh = [3, -30 + pump]; p.bh = [-5, -13 + b]; p.head[1] -= 1; p.neck[0] -= 1;
        }
        return true;
      },
      // Derrota: de rodillas, apoyado en la espada clavada, cabeza gacha
      lose(p, f, T) {
        const b = Math.sin(T * 0.12) > 0.6 ? 1 : 0;
        crouchPose(p, 6 + b); p.sword = 1.45; p.fh = [8, -6]; p.bh = [3, -5];
        p.bf = [-6, 0]; p.ff = [5, -1]; p.head[0] += 2; p.head[1] += 3;
        return true;
      },
      idle(p, f, T) {                                     // guardia de espadachín, la hoja hacia atrás
        const b = Math.sin(T * 0.08) > 0.3 ? 1 : 0;
        crouchPose(p, 1 + b);
        p.fh = [6, -11 + b]; p.bh = [3, -13 + b];
        p.sword = 2.55 + Math.sin(T * 0.05) * 0.06;
      },
      run(p, f, ph) {
        const s = Math.sin(ph), c = Math.cos(ph);
        p.ff = [Math.round(6 * s), -Math.max(0, Math.round(3 * c))];
        p.bf = [Math.round(-6 * s), -Math.max(0, Math.round(-3 * c))];
        p.neck[0] += 3; p.head[0] += 4; p.head[1] += 1;
        p.fh = [3, -10]; p.bh = [Math.round(3 * s), -12];
        p.sword = 2.85;                                   // la espada arrastra detrás
        return true;
      },
      air(p, f, vy) {
        if (vy < 0) { p.ff = [4, -6]; p.bf = [-3, -3]; p.fh = [7, -17]; p.bh = [-5, -14]; p.sword = -1.1; }
        else { p.ff = [5, -2]; p.bf = [-4, -1]; p.fh = [7, -13]; p.bh = [-6, -15]; p.sword = 2.3; }
        return true;
      },
    },

    moves: {
      // Doble tajo rápido
      jab:    { s: 3, a: 8, e: 8,
                hit: [{ box: [5, -19, 16, 10], d: 2, b: 1.2, g: 0, ang: 60, on: [3, 4] }, { box: [5, -20, 18, 11], d: 3, b: 2.4, g: 2.0, ang: 40, on: [8, 9] }],
                pose: (p, f, k, t) => { p.sword = t < 7 ? lerp(-1.4, 0.4, clamp((t - 2) / 3, 0, 1)) : lerp(0.4, -1.2, clamp((t - 7) / 3, 0, 1)); p.fh = [9, -13]; p.fire = 0; } },
      // Tajo en llamas
      ftilt:  { s: 6, a: 4, e: 14, hit: [{ box: [6, -26, 22, 22], d: 9, b: 2.8, g: 5.0, ang: 38, burn: 60 }], pose: swordPose(-2.3, 0.8, -2.6, [10, -13], [0, -20]),
                onFrame(f, t, g) { if (t >= 6 && t < 10) flameAlong(f, g); } },
      utilt:  { s: 4, a: 6, e: 12, hit: [{ box: [-14, -46, 28, 22], d: 7, b: 3.0, g: 4.0, ang: 88 }], pose: swordPose(0.3, -3.1, 0.5, [3, -26], null) },
      dtilt:  { s: 4, a: 3, e: 10, hit: [{ box: [6, -8, 22, 7], d: 5, b: 2.2, g: 2.6, ang: 25 }], pose: swordPose(0, 0.15, -0.3, [9, -6], null, 0, p => crouchPose(p, 4)) },
      dash:   { s: 5, a: 10, e: 16, hit: [{ box: [4, -24, 21, 20], d: 9, b: 3.0, g: 4.0, ang: 45, burn: 60 }], pose: swordPose(-0.4, 0.1, -1.2, [11, -14], null, 1, p => { p.neck[0] += 2; p.head[0] += 3; }),
                onFrame(f, t, g) { if (t < 14) f.vx = f.dir * 3.4; if (t >= 5 && t < 15 && t % 2) flameAlong(f, g); } },
      // Mazazo de fuego: la hoja cae y explota en llamas
      fsmash: { s: 14, a: 4, e: 26, smash: true, hit: [{ box: [8, -36, 30, 36], d: 17, b: 3.8, g: 10, ang: 40, burn: 120 }],
                pose: swordPose(-2.7, 0.9, -2.9, [12, -12], [-2, -24], 1, (p, f, k) => { if (k > 0) { p.neck[0] += 2; p.head[0] += 2; } }),
                onFrame(f, t, g) { if (t === 14) { flameAtTip(f, g, 14); g.shake = Math.max(g.shake, 4); } if (t < 14 && f.charge > 0 && t % 3 === 0) flameAtTip(f, g, 1); } },
      // Pilar de fuego hacia arriba
      usmash: { s: 11, a: 8, e: 22, smash: true, hit: [{ box: [-10, -60, 20, 44], d: 15, b: 3.6, g: 9.5, ang: 90, burn: 90 }],
                pose: swordPose(-0.2, -1.57, 0.4, [3, -26], [6, -8]),
                onFrame(f, t, g) { if (t >= 11 && t < 19) for (let i = 0; i < 3; i++) g.burst(f.x + (Math.random() * 12 - 6), f.y - 26 - Math.random() * 34, 1, 'fire'); } },
      // Giro con anillo de fuego
      dsmash: { s: 9, a: 6, e: 22, smash: true, hit: [{ box: [-30, -10, 60, 10], d: 13, b: 3.2, g: 8.5, ang: 30, away: true, burn: 90 }],
                pose: (p, f, k, t) => { crouchPose(p, 3); p.sword = k > 0 ? t * 0.8 : 0.1; p.fire = k > 0 ? 1 : 0; p.fh = [8, -8]; },
                onFrame(f, t, g) { if (t >= 9 && t < 15) { g.burst(f.x + 24, f.y - 2, 2, 'fire'); g.burst(f.x - 24, f.y - 2, 2, 'fire'); } } },
      nair:   { s: 4, a: 10, e: 10, air: true, land: 6, hit: [{ box: [-15, -29, 30, 29], d: 7, b: 2.6, g: 3.4, ang: 45, away: true }],
                pose: (p, f, k, t) => { p.sword = k > 0 ? t * 0.9 : -0.9; p.fire = k > 0 ? 1 : 0; p.fh = [5, -14]; } },
      fair:   { s: 6, a: 4, e: 14, air: true, land: 9, hit: [{ box: [4, -30, 22, 24], d: 10, b: 3.0, g: 5.4, ang: 40, burn: 60 }], pose: swordPose(-2.3, 0.9, -2.5, [10, -14], null) },
      bair:   { s: 6, a: 4, e: 14, air: true, land: 9, hit: [{ box: [-26, -26, 20, 16], d: 11, b: 3.2, g: 6.4, ang: 140 }], pose: swordPose(-1.6, -3.0, -1.2, [-5, -15], null, 0) },
      uair:   { s: 4, a: 5, e: 12, air: true, land: 6, hit: [{ box: [-12, -48, 24, 22], d: 8, b: 3.0, g: 4.6, ang: 88 }], pose: swordPose(0.3, -3.0, 0.4, [3, -24], null) },
      // Estocada hacia abajo (hunde al rival)
      dair:   { s: 10, a: 6, e: 16, air: true, land: 12, hit: [{ box: [-5, -6, 10, 18], d: 12, b: 2.6, g: 5.0, ang: -80, burn: 60 }],
                pose: swordPose(1.0, 1.57, -1.6, [2, -8], [3, -22]),
                onFrame(f, t, g) { if (t >= 10 && t < 16) { f.vy = Math.max(f.vy, 2); flameAtTip(f, g, 1); } } },

      // Especial: ARCO — mantén para cargar; cargado al máximo, la flecha arde
      nspc:   { s: 14, a: 1, e: 16, air: true, land: 4, special: true, hit: [], cd: 28, chargeSpc: true, maxCharge: 50,
                pose: (p, f, k, t) => { p.bow = 1; p.draw = t < 14 ? Math.min(1, (t + f.charge) / 30) : 0; p.fh = [9, -15]; p.bh = [2, -15]; p.sword = -2.5; p.fire = 0; },
                onFrame(f, t, g) {
                  if (!f.grounded) f.vy = Math.min(f.vy, 0.8);
                  if (t === 13 && f.charge > 25) flameAtTip(f, g, 1);
                  if (t === 14) {
                    const c = f.charge, hot = c > 25;
                    g.spawnProjectile(f, { kind: 'arrow', x: 12, y: -15, vx: 5 + c * 0.09, vy: -0.4, grav: 0.05, life: 90, r: 3, fire: hot,
                      h: { d: 4 + (c / 8 | 0), b: 2.0 + c * 0.02, g: 2.6, ang: 30, burn: hot ? 90 : 0 } });
                  }
                } },
      // Especial lateral: corte de llama (embestida en llamas)
      sspc:   { s: 6, a: 12, e: 14, air: true, land: 10, special: true, keepVel: true,
                hit: [{ box: [0, -24, 22, 22], d: 10, b: 3.2, g: 4.8, ang: 35, burn: 90 }], pose: swordPose(-1.2, 0.2, -1.6, [11, -14], null, 1, p => { p.neck[0] += 3; p.head[0] += 3; }),
                onStart(f) { f.sideUsed = true; },
                onFrame(f, t, g) {
                  if (t < 6) { f.vx *= 0.6; f.vy *= 0.4; }
                  else if (t < 18) { f.vx = f.dir * 6; f.vy = 0; g.burst(f.x - f.dir * 4, f.y - 8 - Math.random() * 12, 2, 'fire'); }
                  else f.vx *= 0.8;
                },
                noGrav: (f, t) => t < 18 },
      // Especial arriba: ascenso de fénix (golpes continuos de fuego)
      uspc:   { s: 4, a: 17, e: 12, air: true, land: 12, special: true, keepVel: true, after: 'helpless', recovery: true,
                hit: [{ box: [-10, -32, 20, 34], d: 2, b: 1.0, g: 0, ang: 90, on: [4, 18], rehit: 4 }, { box: [-12, -36, 24, 36], d: 5, b: 3.0, g: 4.4, ang: 85, on: [19, 20], burn: 60 }],
                pose: (p, f, k, t) => { p.sword = UP; p.fire = 1; p.fh = [3, -27]; p.bh = [-5, -18]; p.ff = [3, -3]; p.bf = [-3, -1]; },
                onStart(f) { f.upUsed = true; f.grounded = false; },
                onFrame(f, t, g) {
                  if (t === 4) { f.vy = -8.8; f.vx = f.inp.mx * 1.8; }
                  if (t > 4 && t < 21) { f.vx = clamp(f.vx + f.inp.mx * 0.1, -2.4, 2.4); g.burst(f.x + (Math.random() * 10 - 5), f.y - Math.random() * 24, 2, 'fire'); }
                } },
      // Especial abajo: lluvia de flechas de fuego (caen del cielo delante de él)
      dspc:   { s: 12, a: 1, e: 18, air: true, land: 6, special: true, hit: [],
                pose: (p, f, k, t) => { p.bow = 1; p.bowUp = 1; p.draw = t < 12 ? t / 12 : 0; p.fh = [5, -24]; p.bh = [3, -20]; p.sword = -2.5; p.fire = 0; },
                onFrame(f, t, g) {
                  if (!f.grounded) f.vy = Math.min(f.vy, 0.8);
                  if (t === 12 && !(f.rainUntil > g.frame)) {
                    f.rainUntil = g.frame + 150;
                    g.spawnProjectile(f, { kind: 'arrow', x: 6, y: -26, vx: 0.3, vy: -7, life: 22, r: 2, fire: true, h: { d: 2, b: 1.5, g: 0.5, ang: 80 } });
                    [34, 52, 70].forEach((dx, i) => g.spawnProjectile(f, { kind: 'arrow', x: dx, y: -150, vx: 0.4, vy: 5, grav: 0.12, life: 70, r: 4, fire: true,
                      delay: 32 + i * 7, h: { d: 6, b: 2.6, g: 3.2, ang: 75, burn: 60 } }));
                  }
                } },
    },

    draw(c, f, p, A, frame) {
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const sh = [neck[0], neck[1] + 1];
      f._swA = p.sword ?? 2.55; f._hx = p.fh[0]; f._hy = p.fh[1]; f._fire = p.fire && !p.bow;
      // cordones de la capucha que ondean
      drawChain(c, f, [neck[0] + 2, neck[1] + 1], 1, ['#d8d8e4', '#9a9aaa']);
      if (p.bow) { pline(c, neck[0] - 4, neck[1] - 2, hip[0] + 4, hip[1] + 2, 2, BLADE.d); px(c, neck[0] - 4, neck[1] - 2, BLADE.l); }
      // brazo y pierna traseros
      pline(c, sh[0] - 1, sh[1], bh[0], bh[1], 3, HOOD.d);
      rect(c, bh[0] - 1, bh[1] - 1, 3, 1, '#7a7a88'); rect(c, bh[0] - 1, bh[1], 2, 2, SKIN.d);
      pline(c, hip[0] - 1, hip[1], bf[0], bf[1] - 1, 3, PANTS.d);
      rect(c, bf[0] - 2, bf[1] - 1, 4, 2, '#0c0a12'); px(c, bf[0] - 1, bf[1] - 1, '#c8c8d4');
      // torso: sudadera ajustada que se abre sobre la camiseta
      for (let y = neck[1]; y <= hip[1] + 2; y++) {
        const t = (y - neck[1]) / Math.max(1, hip[1] + 2 - neck[1]);
        const cx = Math.round(lerp(neck[0], hip[0], t)), half = t < 0.85 ? 3 : 4;
        for (let x = cx - half; x <= cx + half; x++) {
          let col = x <= cx - half + 1 ? HOOD.l : x >= cx + half ? HOOD.d : HOOD.m;
          if ((y - neck[1]) === 4 || x === cx - 2) col = HOOD.st;       // raya de cuadros
          px(c, x, y, col);
        }
      }
      const tx = Math.round(lerp(neck[0], hip[0], 0.3));
      rect(c, tx - 1, neck[1] + 1, 4, hip[1] - neck[1], '#f6f4fa');
      logo(c, tx - 1, neck[1] + 2);
      rect(c, tx + 3, neck[1] + 1, 1, hip[1] - neck[1] + 1, '#6a0e18');          // borde de la cremallera
      // pierna delantera
      pline(c, hip[0] + 1, hip[1], ff[0], ff[1] - 1, 3, PANTS.m);
      pline(c, hip[0], hip[1], ff[0] - 1, ff[1] - 1, 1, PANTS.l);
      rect(c, ff[0] - 2, ff[1] - 1, 5, 2, '#f2f2f8'); rect(c, ff[0] - 2, ff[1], 5, 1, '#0c0a12'); px(c, ff[0] + 1, ff[1] - 1, '#ff3a3a');
      // cabeza
      headArt(c, hd[0], hd[1], 1, f.st === 'hitstun' || f.st === 'grabbed', (f.animT % 200) > 194);
      // brazo delantero
      pline(c, sh[0] + 1, sh[1], fh[0], fh[1], 3, HOOD.m);
      pline(c, sh[0] + 1, sh[1] - 1, fh[0], fh[1] - 1, 1, HOOD.l);
      rect(c, fh[0] - 1, fh[1] - 1, 3, 1, '#9a9aaa');
      if (p.bow) {
        const up = p.bowUp ? 1 : 0, draw = Math.round((p.draw || 0) * 4);
        const bx = fh[0] + 1, by = fh[1], ax = up ? 0 : 1, ay = up ? -1 : 0, nx = -ay, ny = ax;
        for (let k = -8; k <= 8; k++) {
          const bend = Math.round((1 - (k * k) / 64) * 3);
          px(c, Math.round(bx + nx * k + ax * bend), Math.round(by + ny * k + ay * bend), Math.abs(k) > 6 ? '#ffd34a' : k % 3 ? '#8a3a22' : '#c86a3a');
        }
        const sx = bx - ax * draw, sy = by - ay * draw;
        pline(c, bx + nx * 8, by + ny * 8, sx, sy, 1, '#f0e8d8'); pline(c, bx - nx * 8, by - ny * 8, sx, sy, 1, '#f0e8d8');
        if (p.draw > 0) {
          pline(c, sx, sy, bx + ax * 7, by + ay * 7, 1, '#c89a60'); px(c, Math.round(bx + ax * 8), Math.round(by + ay * 8), '#e8f0f4');
          if (f.charge > 25) { const fl = (frame >> 1) % 2; px(c, Math.round(bx + ax * 9), Math.round(by + ay * 9 - 1), fl ? '#ffd040' : '#fff3b0'); px(c, Math.round(bx + ax * 8), Math.round(by + ay * 8 - 2), '#ff7a20'); }
        }
        rect(c, fh[0] - 1, fh[1], 3, 2, SKIN.m);
      } else {
        // espada de cristal, más larga y afilada
        const a = p.sword ?? 2.55, ca = Math.cos(a), sa = Math.sin(a);
        const gx = fh[0] + ca * 2, gy = fh[1] + sa * 2, L = 16;
        const tx2 = fh[0] + ca * L, ty2 = fh[1] + sa * L;
        pline(c, fh[0] - ca * 3, fh[1] - sa * 3, gx, gy, 2, '#4a2414');
        px(c, Math.round(fh[0] - ca * 4), Math.round(fh[1] - sa * 4), '#ffd34a');
        pline(c, gx - sa * 3, gy + ca * 3, gx + sa * 3, gy - ca * 3, 1, '#c8902a');
        px(c, Math.round(gx - sa * 3), Math.round(gy + ca * 3), '#ffe08a'); px(c, Math.round(gx + sa * 3), Math.round(gy - ca * 3), '#ffe08a');
        pline(c, gx, gy, tx2 - ca * 2, ty2 - sa * 2, 3, BLADE.dd);
        pline(c, gx, gy, tx2, ty2, 2, BLADE.m);
        pline(c, gx - sa * 0.7, gy + ca * 0.7 - 0.4, tx2 - ca * 3 - sa * 0.7, ty2 - sa * 3 + ca * 0.7 - 0.4, 1, BLADE.l);
        px(c, Math.round(tx2), Math.round(ty2), '#ffffff');
        rect(c, fh[0] - 1, fh[1], 3, 2, SKIN.m);
        if (p.fire) for (let i = 3; i <= L; i += 2) {
          const fx = fh[0] + ca * i, fy = fh[1] + sa * i, fl = ((frame >> 1) + i) % 3;
          px(c, Math.round(fx), Math.round(fy - 1 - fl), fl === 0 ? '#fff3b0' : '#ffd040');
          if (i % 4 === 1) px(c, Math.round(fx + 1), Math.round(fy - 2 - fl), '#ff7a20');
        }
      }
    },
    // capa de efectos con transparencia (fuera del sprite para no ensuciar el contorno)
    overlay(c, f, frame) {
      const a = f._swA ?? 2.55, hx = f._hx ?? 6, hy = f._hy ?? -11;
      const at = i => [f.x + f.dir * (hx + Math.cos(a) * i), f.y + hy + Math.sin(a) * i];
      if (f._fire) {
        const flick = 0.75 + 0.25 * Math.sin(frame * 0.6);
        for (const i of [5, 10, 15]) { const [x, y] = at(i); glow(c, x, y - 1, 7, '#ff7a20', 0.3 * flick, 3); }
      } else if (f.st !== 'dead') {
        const [x, y] = at(12); glow(c, x, y, 4, '#46e6d4', 0.15 + 0.05 * Math.sin(frame * 0.1), 2);      // brillo del cristal
      }
      if (f.burn > 0) glow(c, f.x, f.y - f.S.hh / 2, 14, '#ff6a20', 0.12, 3);
    },
    portrait(c, x, y, pal, k) { headArt(c, x, y + k, k); },
  });

  // ------------------------------------------------------------
  //  Escena de selección: HABITACIÓN GAMER ROJA (sobre una plataforma de fuego)
  // ------------------------------------------------------------
  const room = (W, H, gy) => {
    const fy = gy - 2;
    return { fy, deskY: fy - 16, dx0: Math.round(W * 0.04), dx1: Math.round(W * 0.42), shelfX: Math.round(W * 0.66), shelfY: Math.round(fy * 0.42), chairX: Math.round(W * 0.84) };
  };
  CHARACTERS.redstein.scene = {
    base(c, W, H, gy) {
      const L = room(W, H, gy), fy = L.fy;
      // pared roja con paneles
      sceneGrad(c, 0, 0, W, fy, ['#1a0508', '#2a080e', '#3a0c14', '#46101a', '#3a0c14']);
      for (let x = 0; x < W; x += 16) { rect(c, x, 8, 1, fy - 8, '#14040a'); rect(c, x + 1, 8, 1, fy - 8, '#561620', 0.6); }
      // tira LED en el techo (el brillo se anima)
      rect(c, 0, 4, W, 2, '#ff3a50'); rect(c, 0, 6, W, 1, '#6a0e18');
      // pósteres colgados con chinchetas
      const poster = (x, y, w, h, draw) => { rect(c, x - 1, y - 1, w + 2, h + 2, '#0a0306'); draw(x, y, w, h); px(c, x + 1, y, '#d8d8e4'); px(c, x + w - 2, y, '#d8d8e4'); };
      poster(Math.round(W * 0.06), Math.round(fy * 0.16), 16, 20, (x, y, w, h) => {
        sceneGrad(c, x, y, w, h, ['#ff6a40', '#c02030', '#3a0a18']);
        rect(c, x + 4, y + 4, 8, 10, '#f6f4fa');
        [0b1110, 0b1001, 0b1110, 0b1010, 0b1001].forEach((row, ry) => { for (let b = 0; b < 4; b++) if (row & (8 >> b)) rect(c, x + 5 + b * 1.5 | 0, y + 5 + ry * 2, 2, 2, '#120d24'); });
      });
      poster(Math.round(W * 0.28), Math.round(fy * 0.12), 14, 18, (x, y, w, h) => {
        sceneGrad(c, x, y, w, h, ['#1a2a6a', '#3a1a5a', '#120a24']);
        pline(c, x + 3, y + h - 3, x + w - 3, y + 3, 1, '#46e6d4'); pline(c, x + 3, y + 3, x + w - 3, y + h - 3, 1, '#ffd34a');   // espadas cruzadas
        px(c, x + w / 2 | 0, y + h / 2 | 0, '#ffffff');
      });
      // estante con escuadras (apoyado en la pared) y objetos
      const sw = Math.max(20, Math.round(W * 0.22)), sx = Math.min(L.shelfX, W - sw - 2), sy = L.shelfY;
      rect(c, sx, sy, sw, 2, '#7a4428'); rect(c, sx, sy, sw, 1, '#b06a3e'); rect(c, sx, sy + 2, sw, 1, '#3a1e12');
      for (const bx of [sx + 2, sx + sw - 4]) { pline(c, bx, sy + 2, bx, sy + 7, 1, '#5a5a66'); pline(c, bx, sy + 7, bx + 2, sy + 2, 1, '#5a5a66'); }
      rect(c, sx + 2, sy - 4, 7, 4, '#2a2a36'); px(c, sx + 3, sy - 3, '#ff3a3a'); px(c, sx + 7, sy - 3, '#46e6d4');          // mando
      rect(c, sx + 12, sy - 8, 4, 8, '#ffd34a'); rect(c, sx + 11, sy - 9, 6, 2, '#ffe08a'); rect(c, sx + 13, sy - 1, 2, 1, '#b07a2a');  // trofeo
      if (sw > 24) { rect(c, sx + sw - 7, sy - 7, 4, 7, '#d0262c'); rect(c, sx + sw - 7, sy - 9, 4, 3, '#f0aa7c'); px(c, sx + sw - 5, sy - 8, '#3a62ff'); }    // figura
      // escritorio con monitores y teclado (todo apoyado)
      const dx0 = L.dx0, dx1 = L.dx1, dy = L.deskY;
      rect(c, dx0, dy, dx1 - dx0, 3, '#2a2a36'); rect(c, dx0, dy, dx1 - dx0, 1, '#4a4a5a');
      rect(c, dx0 + 2, dy + 3, 2, fy - dy - 3, '#1a1a24'); rect(c, dx1 - 4, dy + 3, 2, fy - dy - 3, '#1a1a24');
      const mw = Math.max(14, Math.round((dx1 - dx0) * 0.42)), mh = Math.round(mw * 0.62);
      for (let i = 0; i < 2; i++) {
        const mx = dx0 + 3 + i * (mw + 3), my = dy - mh - 4;
        rect(c, mx - 1, my - 1, mw + 2, mh + 2, '#08060c'); rect(c, mx, my, mw, mh, '#1a1a26');
        rect(c, mx + mw / 2 - 1 | 0, my + mh, 2, 4, '#2a2a36'); rect(c, mx + mw / 2 - 4 | 0, dy - 1, 8, 1, '#3a3a46');
      }
      rect(c, dx0 + 4, dy - 2, Math.round((dx1 - dx0) * 0.5), 2, '#14141c');      // teclado
      // silla gamer apoyada en el suelo
      const cx = Math.min(L.chairX, W - 8);
      rect(c, cx - 6, fy - 30, 12, 18, '#120a10'); rect(c, cx - 5, fy - 29, 10, 16, '#c0202c'); rect(c, cx - 2, fy - 29, 4, 16, '#1a0a10');
      rect(c, cx - 7, fy - 12, 14, 3, '#1a1a24'); rect(c, cx - 1, fy - 9, 2, 6, '#3a3a46'); rect(c, cx - 6, fy - 3, 12, 2, '#2a2a36');
      px(c, cx - 6, fy - 1, '#5a5a66'); px(c, cx + 5, fy - 1, '#5a5a66');
      // suelo de moqueta con alfombra roja bajo la plataforma
      for (let y = fy; y < H; y++) for (let x = 0; x < W; x++) px(c, x, y, sceneDither(['#2a0c14', '#1e080e', '#14060a', '#0c0306'], (y - fy) / Math.max(1, H - fy), x, y));
      rect(c, 0, fy, W, 1, '#4a1420');
      for (let y = fy + 2; y < H; y++) { const hw = Math.round(W * 0.34 * Math.sqrt(Math.max(0, 1 - ((y - fy - 8) / 10) ** 2))); if (hw > 0) rect(c, Math.round(W / 2) - hw, y, hw * 2, 1, (y % 3) ? '#6a1420' : '#8a1a28'); }
    },
    anim(c, W, H, gy, T) {
      const L = room(W, H, gy), dy = L.deskY;
      // brillo de la tira LED (respira)
      for (let k = 1; k < 10; k++) rect(c, 0, 6 + k, W, 1, '#ff3a50', 0.12 * (1 - k / 10) * (0.7 + 0.3 * Math.sin(T * 0.05)));
      // monitores: juego en una pantalla, chat/directo en la otra
      const mw = Math.max(14, Math.round((L.dx1 - L.dx0) * 0.42)), mh = Math.round(mw * 0.62);
      for (let i = 0; i < 2; i++) {
        const mx = L.dx0 + 3 + i * (mw + 3), my = dy - mh - 4;
        if (i === 0) {
          sceneGrad(c, mx + 1, my + 1, mw - 2, mh - 2, ['#ff9a50', '#d03a40', '#3a0a24']);
          const hx = mx + 2 + ((T >> 2) % (mw - 6)); rect(c, hx, my + mh - 5, 2, 3, '#46e6d4');                       // personajito del juego
          glow(c, mx + mw / 2, my + mh / 2, mw * 0.7, '#ff6a40', 0.12, 3);
        } else {
          rect(c, mx + 1, my + 1, mw - 2, mh - 2, '#0e0a18');
          for (let l = 0; l < 4; l++) rect(c, mx + 2, my + 2 + l * 2, Math.round((mw - 5) * (0.4 + ((l * 7 + (T >> 4)) % 5) / 8)), 1, l % 2 ? '#8a8aa0' : '#c8c8d8');
          rect(c, mx + 2, my + mh - 4, 9, 3, (T >> 4) % 2 ? '#e8203a' : '#7a1020');                                 // ● EN VIVO
          glow(c, mx + mw / 2, my + mh / 2, mw * 0.6, '#5a6aff', 0.08, 3);
        }
      }
      // teclado RGB que cambia de color
      const kw = Math.round((L.dx1 - L.dx0) * 0.5);
      for (let k = 0; k < kw; k += 2) px(c, L.dx0 + 4 + k, dy - 2, ['#ff3a50', '#ffd34a', '#46e6d4', '#6a5aff'][((k >> 2) + (T >> 3)) % 4]);
    },
    platform(c, cx, gy, T, W) {
      // PLATAFORMA DE FUEGO: base de roca ardiente rodeada de llamas
      const w = Math.min(60, W - 8), x0 = Math.round(cx - w / 2);
      glow(c, cx, gy + 2, w * 0.75, '#ff6a20', 0.32, 4);
      for (let k = 0; k < 7; k++) {
        const inset = Math.round(Math.pow(k / 6, 1.5) * 8), xa = x0 + inset, wa = w - inset * 2;
        rect(c, xa - 1, gy + k, wa + 2, 1, '#120408');
        for (let x = xa; x < xa + wa; x++) px(c, x, gy + k, ((x * 7 + k * 3 + (T >> 3)) % 11 < 2) ? '#ffb040' : sceneDither(['#2a0a0e', '#4a1414', '#7a2018', '#c04018'], 0.85 - k / 7, x, gy + k));
      }
      for (let x = x0; x < x0 + w; x++) px(c, x, gy, '#ff9a30');
      // lenguas de fuego que suben por el borde (con transparencia en las puntas)
      for (let i = 0; i < w; i += 3) {
        const x = x0 + i, h = 3 + Math.round((Math.sin(i * 1.7 + T * 0.35) * 0.5 + 0.5) * 6 + (i % 7 === 0 ? 3 : 0));
        for (let y = 0; y < h; y++) {
          const t = y / h, col = t < 0.35 ? '#ffd040' : t < 0.7 ? '#ff7a20' : '#c02818';
          px(c, x + Math.round(Math.sin(y * 0.8 + T * 0.4 + i) * 0.6), gy - 1 - y, col, 1 - t * 0.75);
        }
      }
    },
    front(c, W, H, gy, T) {
      // chispas que saltan de la plataforma de fuego (salen de ella, no flotan sueltas)
      for (let i = 0; i < 8; i++) {
        const life = (T * 0.8 + i * 13) % 40, x = W / 2 + Math.sin(i * 2.3) * 26 + Math.sin(T * 0.05 + i) * life * 0.15;
        px(c, Math.round(x), Math.round(gy - 4 - life * 0.9), life < 20 ? '#ffd040' : '#ff7a20', 1 - life / 40);
      }
    },
  };
})();
