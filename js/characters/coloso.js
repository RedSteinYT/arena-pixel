'use strict';
// ============================================================
//  COLOSO — gigante de la montaña (tamaño gigante)
//  Mide unas 2,3 veces lo que un luchador normal.
//  Se mueve lentísimo, pero cada ataque ocupa medio escenario:
//   · salta y aplasta (especial normal)
//   · lanza hacia arriba y espera abajo para volver a agarrar
//   · agarre gigante de largo alcance (especial lateral)
//   · golpes exagerados con cajas de golpe enormes
//  Es muy difícil de sacar, pero también muy fácil de golpear.
// ============================================================
(() => {
  const SKIN = { l: '#e8b994', m: '#c88f6c', d: '#94604a', dd: '#6a4034' };
  const FUR = { l: '#9a765c', m: '#6f5040', d: '#4a3428' };
  const BRONZE = { l: '#ffe08a', m: '#d9a441', d: '#9a6a2a' };
  const BEARD = { l: '#f4eee0', m: '#d2c7b2', d: '#9e927e' };

  function headArt(c, hx, hy, pal, k = 1, hurt = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    // cara
    R(-6, -6, 13, 10, SKIN.m);
    R(-6, -6, 3, 8, SKIN.l);
    R(5, -5, 2, 9, SKIN.d);
    // ojos bajo la ceja
    R(-3, -3, 10, 2, SKIN.dd);
    if (hurt) { R(-1, -2, 2, 1, '#ffffff'); R(3, -2, 2, 1, '#ffffff'); }
    else { R(-1, -2, 2, 2, '#1b1636'); R(3, -2, 2, 2, '#1b1636'); R(0, -2, 1, 1, '#ffffff'); R(4, -2, 1, 1, '#ffffff'); }
    R(2, 0, 3, 2, SKIN.d);                       // nariz
    // barba enorme
    R(-6, 1, 14, 6, BEARD.m);
    R(-5, 7, 12, 3, BEARD.m);
    R(-3, 10, 8, 2, BEARD.d);
    R(-6, 1, 3, 6, BEARD.l);
    R(0, 2, 6, 1, BEARD.d);                      // boca
    R(-1, 5, 1, 4, BEARD.d); R(3, 6, 1, 4, BEARD.d);
    // casco de bronce con cuernos
    R(-7, -11, 15, 5, BRONZE.m);
    R(-6, -12, 13, 1, BRONZE.m);
    R(-6, -12, 6, 1, BRONZE.l);
    R(-7, -11, 2, 4, BRONZE.l);
    R(-7, -7, 15, 1, BRONZE.d);
    R(-7, -8, 15, 1, pal.main);                  // banda del color del jugador
    R(0, -11, 2, 3, BRONZE.l);                   // remache
    // cuernos
    R(-9, -12, 2, 3, BEARD.l); R(-10, -15, 2, 3, BEARD.m); R(-10, -17, 1, 2, BEARD.d);
    R(8, -12, 2, 3, BEARD.m); R(9, -15, 2, 3, BEARD.m); R(10, -17, 1, 2, BEARD.d);
  }

  function hand(c, x, y, col, big = 7) {
    rect(c, x - big, y - big + 1, big * 2, big * 2 - 2, col.m);
    rect(c, x - big + 1, y - big, big * 2 - 2, big * 2, col.m);
    rect(c, x - big + 1, y - big, big * 2 - 3, 2, col.l);
    rect(c, x - big, y - big + 1, 2, big * 2 - 4, col.l);
    rect(c, x + big - 2, y - big + 2, 2, big * 2 - 3, col.d);
    rect(c, x - big + 2, y + big - 2, big * 2 - 3, 2, col.d);
    for (let i = -big + 3; i < big - 1; i += 4) px(c, x + i, y - 1, col.d);   // nudillos
  }

  // Brazo con codo: el brazo nunca se estira más de su largo real (el alcance
  // gigante de los golpes se ve con el barrido, no con brazos de goma)
  function arm(c, sh, target, maxLen, w, cols) {
    let dx = target[0] - sh[0], dy = target[1] - sh[1];
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(d, maxLen);
    const hx = sh[0] + dx / d * reach, hy = sh[1] + dy / d * reach;
    const half = reach / 2, seg = (maxLen + 4) / 2;
    const bend = Math.sqrt(Math.max(0, seg * seg - half * half));
    const ex = (sh[0] + hx) / 2 - dy / d * bend, ey = (sh[1] + hy) / 2 + dx / d * bend;
    pline(c, sh[0], sh[1], ex, ey, w, cols.m);
    pline(c, ex, ey, hx, hy, w - 1, cols.m);
    pline(c, sh[0] - 1, sh[1] - 3, ex - 1, ey - 3, 2, cols.l);
    pline(c, ex, ey - 3, hx, hy - 3, 2, cols.l);
    disc(c, ex, ey, Math.floor(w / 2), cols.m);
    return [Math.round(hx), Math.round(hy), Math.round(ex), Math.round(ey)];
  }

  const quake = (f, g, n, spread = 40) => {
    g.shake = Math.max(g.shake, n);
    g.burst(f.x + f.dir * spread, f.y, 8, 'dust'); g.burst(f.x - f.dir * spread, f.y, 8, 'dust');
    Sfx.hit(12);
  };

  defineCharacter({
    id: 'coloso',
    name: 'Coloso',
    role: 'Gigante',
    desc: 'Gigante de la montaña. Lentísimo, pero sus golpes ocupan medio escenario. Salta y aplasta, lanza hacia arriba y agarra desde lejos.',
    stats: {
      walk: 1.15, gAcc: 0.22, fric: 0.5, airSpd: 1.2, aAcc: 0.1, airFric: 0.02,
      jumpV: 6.8, hopV: 4.8, djumpV: 5.8, jumps: 1, grav: 0.36, maxFall: 5.6, fastFall: 7.8,
      weight: 230, hw: 15, hh: 56,
      giant: true,            // los gigantes no se pueden agarrar (salvo otro gigante)
    },
    bust: { k: 1, y: -70, h: 36, dx: 5 },
    selectH: 78,              // alto en la pantalla de selección (para encajarlo en su panel)
    runRate: 0.14,
    tagGap: 10,
    rest: { hip: [0, -24], neck: [2, -46], head: [9, -48], fh: [22, -22], bh: [-14, -26], ff: [10, 0], bf: [-10, 0] },
    poses: {
      // Selección: se acaricia la barba, saca músculo y da un pisotón
      // Pantalla VS: se golpea el pecho, ruge con los brazos abiertos y da un pisotón
      taunt(p, f, T) {
        const t = T < 150 ? T : 120 + (T - 120) % 40;
        if (t < 56) {                                                   // golpes en el pecho
          const k = (t / 9 | 0) % 2;
          if (k) { p.fh = [13, -40]; p.bh = [-18, -30]; } else { p.bh = [9, -41]; p.fh = [24, -28]; }
        } else if (t < 96) { p.fh = [31, -55]; p.bh = [-25, -53]; p.head[1] -= 2; p.neck[1] -= 1; p.roar = 1; }   // rugido
        else if (t < 108) { p.ff = [16, -18]; p.fh = [24, -36]; p.bh = [-20, -36]; }
        else if (t < 118) { p.ff = [16, 0]; crouchPose(p, 5); p.fh = [26, -18]; p.bh = [-20, -20]; p.slam = 1; }   // pisotón
        else {                                                           // se inclina, amenazante
          const b = Math.sin(T * 0.05) > 0 ? 1 : 0;
          p.neck[0] += 3; p.head[0] += 4; p.neck[1] += b; p.head[1] += b;
          p.fh = [26, -20 + b]; p.bh = [-8, -24 + b];
        }
        return true;
      },
      select(p, f, T) {
        const t = T % 170;
        if (t < 64) { p.fh = [14 + Math.round(Math.sin(t * 0.3) * 2), -40 + Math.round(Math.abs(Math.sin(t * 0.15)) * 4)]; }
        else if (t < 112) { p.fh = [26, -62]; p.bh = [-22, -62]; crouchPose(p, 2); p.head[1] -= 1; }
        else if (t < 132) { p.ff = [16, -18]; p.fh = [24, -36]; p.bh = [-20, -36]; }
        else if (t < 140) { p.ff = [16, 0]; crouchPose(p, 5); p.fh = [26, -18]; p.bh = [-20, -20]; }
        else { const b = Math.sin(T * 0.035) > 0 ? 1 : 0; p.neck[1] += b; p.head[1] += b; }
        return true;
      },
      // Victoria: ruge con los brazos abiertos y se golpea el pecho
      win(p, f, T) {
        const t = T % 150;
        if (t < 60) { p.fh = [31, -58]; p.bh = [-25, -56]; p.head[1] -= 3; p.neck[1] -= 1; p.roar = 1; }
        else if (t < 120) { const k = (t / 9 | 0) % 2; if (k) { p.fh = [13, -40]; p.bh = [-18, -30]; } else { p.bh = [9, -41]; p.fh = [24, -28]; } }
        else { p.fh = [26, -62]; p.bh = [-22, -62]; crouchPose(p, 2); }
        return true;
      },
      // Derrota: se sienta pesadamente, cabizbajo
      lose(p, f, T) {
        const b = Math.sin(T * 0.04) > 0 ? 1 : 0;
        crouchPose(p, 12); p.ff = [14, -2]; p.bf = [-12, 0]; p.fh = [20, -12 + b]; p.bh = [-10, -12 + b];
        p.head[0] += 3; p.head[1] += 5 + b;
        return true;
      },
      idle(p, f, T) {
        const b = Math.sin(T * 0.035) > 0 ? 1 : 0;   // respiración muy lenta
        p.neck[1] += b; p.head[1] += b; p.fh[1] += b * 2; p.bh[1] += b * 2;
      },
      run(p, f, ph) {
        const s = Math.sin(ph);
        p.ff = [Math.round(12 * s), -Math.max(0, Math.round(6 * Math.cos(ph)))];
        p.bf = [Math.round(-12 * s), -Math.max(0, Math.round(-6 * Math.cos(ph)))];
        p.fh = [20 - Math.round(6 * s), -22]; p.bh = [-14 + Math.round(6 * s), -26];
        const stomp = Math.abs(s) > 0.95 ? 2 : 0; p.neck[1] += stomp; p.head[1] += stomp;
        p.neck[0] += 3; p.head[0] += 3;
        return true;
      },
      air(p, f, vy) {
        p.ff = [10, vy < 0 ? -10 : -3]; p.bf = [-10, vy < 0 ? -6 : -2];
        p.fh = [26, vy < 0 ? -56 : -40]; p.bh = [-20, vy < 0 ? -54 : -40];
        return true;
      },
    },

    moves: {
      // Revés gigante
      jab:    { s: 8, a: 4, e: 16, hit: [{ box: [12, -54, 34, 32], d: 8, b: 3.0, g: 2.8, ang: 45 }], pose: { fh: [42, -40], wind: [4, -30] } },
      // Puñetazo de barrido: cubre todo el frente
      ftilt:  { s: 12, a: 5, e: 22, hit: [{ box: [8, -62, 54, 50], d: 14, b: 3.6, g: 5.6, ang: 40 }], pose: { fh: [48, -30], wind: [-10, -64], lean: 4 } },
      // Manotazo hacia arriba: lanza al rival para esperarlo abajo
      utilt:  { s: 9, a: 8, e: 20, hit: [{ box: [-30, -104, 60, 48], d: 12, b: 4.6, g: 4.2, ang: 90 }], pose: { fh: [6, -96], both: true, upper: true } },
      // Palmada al suelo: levanta al rival
      dtilt:  { s: 10, a: 5, e: 18, hit: [{ box: [10, -16, 52, 16], d: 10, b: 3.2, g: 3.4, ang: 78 }], pose: { fh: [44, -5], crouch: true },
                onFrame(f, t, g) { if (t === 10) { g.burst(f.x + f.dir * 40, f.y, 6, 'dust'); g.shake = Math.max(g.shake, 2); } } },
      // Panzazo en carrera
      dash:   { s: 10, a: 14, e: 26, hit: [{ box: [0, -56, 44, 56], d: 15, b: 3.8, g: 5.0, ang: 45 }], pose: { fh: [32, -36], bh: [26, -32], lean: 8 },
                onFrame(f, t) { if (t < 22) f.vx = f.dir * 2.6; } },
      // Mazazo con los dos puños: ocupa casi medio escenario
      fsmash: { s: 24, a: 5, e: 34, smash: true, hit: [{ box: [12, -84, 64, 84], d: 26, b: 4.6, g: 11.5, ang: 40 }],
                pose: { fh: [58, -8], wind: [-6, -100], both: true, lean: 6 },
                onFrame(f, t, g) { if (t === 24) quake(f, g, 8, 60); } },
      // Palmada al cielo
      usmash: { s: 18, a: 8, e: 30, smash: true, hit: [{ box: [-42, -124, 84, 60], d: 22, b: 4.4, g: 11, ang: 90 }],
                pose: { fh: [4, -114], wind: [22, -10], both: true, upper: true },
                onFrame(f, t, g) { if (t === 18) { g.spark(f.x + f.dir * 4, f.y - 112, 18, '#ffffff'); g.shake = Math.max(g.shake, 5); } } },
      // Pisotón: onda expansiva a los dos lados
      dsmash: { s: 16, a: 6, e: 32, smash: true, hit: [{ box: [-78, -18, 156, 18], d: 18, b: 3.8, g: 9, ang: 75, away: true }],
                pose(p, f, k) {
                  if (k < 0) { p.ff = [16, Math.round(-26 * -k)]; p.fh = [24, -40]; p.bh = [-20, -40]; }
                  else { p.ff = [16, 0]; crouchPose(p, 4); p.fh = [26, -18]; p.bh = [-18, -18]; }
                },
                onFrame(f, t, g) { if (t === 16) { quake(f, g, 10, 70); g.burst(f.x + 40, f.y, 6, 'dust'); g.burst(f.x - 40, f.y, 6, 'dust'); } } },
      // Giro de barriga en el aire
      nair:   { s: 8, a: 10, e: 18, air: true, land: 14, hit: [{ box: [-38, -68, 76, 68], d: 12, b: 3.2, g: 4.2, ang: 50, away: true }],
                pose: { spin: true, spinR: 26, spinRate: 0.45 } },
      // Martillo aéreo: hunde al rival (meteoro)
      fair:   { s: 14, a: 5, e: 22, air: true, land: 18, hit: [{ box: [10, -66, 46, 62], d: 16, b: 2.8, g: 5.6, ang: -50 }],
                pose: { fh: [42, -10], wind: [4, -94], both: true } },
      bair:   { s: 10, a: 5, e: 22, air: true, land: 16, hit: [{ box: [-62, -62, 46, 42], d: 16, b: 3.6, g: 7.0, ang: 145 }], pose: { bh: [-46, -42] } },
      uair:   { s: 9, a: 6, e: 20, air: true, land: 14, hit: [{ box: [-36, -112, 72, 46], d: 13, b: 3.4, g: 5.0, ang: 90 }], pose: { fh: [4, -104], both: true, upper: true } },
      // Culazo: cae a plomo
      dair:   { s: 16, a: 8, e: 26, air: true, land: 24, hit: [{ box: [-28, -14, 56, 30], d: 17, b: 2.8, g: 6.0, ang: -80 }],
                pose: { ff: [10, 6], bf: [-10, 6], fh: [30, -60], bh: [-26, -60] } },

      // Especial: salto aplastante (desde el suelo salta muy alto y cae aplastando)
      nspc:   { s: 8, a: 90, e: 6, air: true, land: 0, special: true, keepVel: true, landTo: 'nspcLand',
                hit: [{ box: [-30, -24, 60, 34], d: 16, b: 3.0, g: 5.0, ang: -70, on: [22, 97] }],
                pose(p, f, k, t) {
                  if (t < 8) { crouchPose(p, 8); p.fh = [16, -12]; p.bh = [-14, -12]; return; }
                  if (f.vy < 0) { p.ff = [8, -14]; p.bf = [-8, -12]; p.fh = [24, -80]; p.bh = [-20, -78]; }
                  else { p.ff = [10, 4]; p.bf = [-10, 4]; p.fh = [30, -64]; p.bh = [-26, -64]; }
                },
                onStart(f) { f.wasGrounded = f.grounded; },
                onFrame(f, t, g) {
                  if (t < 8) { f.vx *= 0.8; if (!f.grounded) f.vy = Math.min(f.vy, 0.5); }
                  if (t === 8) { f.vy = f.wasGrounded ? -8.8 : -3; f.vx = f.dir * 2.4 + f.inp.mx * 0.8; f.grounded = false; f.plat = null; if (f.wasGrounded) quake(f, g, 3, 20); }
                  if (t > 8) f.vx = clamp(f.vx + f.inp.mx * 0.05, -3, 3);
                } },
      nspcLand: { s: 1, a: 6, e: 28, special: true, hit: [{ box: [-64, -18, 128, 18], d: 12, b: 3.6, g: 6.0, ang: 80, away: true }],
                  pose: { crouch: true, fh: [30, -8], bh: [-26, -8] },
                  onStart(f, g) { quake(f, g, 10, 50); } },
      // Especial lateral: mano gigante (agarre de muy largo alcance)
      sspc:   { s: 14, a: 6, e: 30, special: true, hit: [{ box: [10, -70, 60, 66], grab: true }],
                pose: { fh: [62, -36], wind: [-6, -40], lean: 6 } },
      // Especial arriba: salto colosal
      uspc:   { s: 8, a: 16, e: 22, air: true, land: 20, special: true, keepVel: true, after: 'helpless', recovery: true,
                hit: [{ box: [-32, -112, 64, 60], d: 12, b: 3.6, g: 5.0, ang: 88 }], pose: { fh: [6, -104], both: true, upper: true },
                onStart(f) { f.upUsed = true; },
                onFrame(f, t, g) {
                  if (t < 8 && f.grounded) f.vx *= 0.7;
                  if (t === 8) { f.vy = -9.6; f.vx = f.inp.mx * 1.4; f.grounded = false; f.plat = null; g.burst(f.x, f.y, 8, 'dust'); }
                  if (t > 8 && t < 24) f.vx = clamp(f.vx + f.inp.mx * 0.05, -1.6, 1.6);
                } },
      // Especial abajo: rugido (empuja a todos lejos, casi sin daño)
      dspc:   { s: 14, a: 6, e: 30, air: true, land: 10, special: true,
                hit: [{ box: [-92, -104, 184, 114], d: 3, b: 5.0, g: 1.2, ang: 30, away: true, noFx: true }],
                pose(p, f, k) { p.head[0] += 3; p.head[1] -= k > 0 ? 3 : 0; p.fh = [30, -60]; p.bh = [-26, -60]; if (k > 0) crouchPose(p, 3); },
                onFrame(f, t, g) {
                  if (!f.grounded) f.vy = Math.min(f.vy, 1);
                  if (t >= 14 && t < 20) {
                    g.shake = Math.max(g.shake, 4);
                    g.fx.push({ kind: 'spark', x: f.x + f.dir * 14, y: f.y - 48, size: 14 + (t - 14) * 10, col: f.pal.light, t: 0, life: 10, rot: t });
                  }
                  if (t === 14) Sfx.ko();
                } },

      // Agarre gigante: lo sostiene en alto con una mano
      grab:   { s: 8, a: 4, e: 26, hit: [{ box: [12, -64, 42, 60], grab: true }], hold: [34, -50],
                pose: { fh: [46, -38], bh: [40, -32], lean: 5 } },
      // Lanzamientos exagerados
      fthrow: { s: 12, a: 1, e: 18, hit: [], throw: { d: 12, b: 4.0, g: 6.0, ang: 40 },
                path: t => { const k = Math.min(t / 12, 1); return [34 + k * 18, -50 - Math.sin(k * Math.PI) * 14]; },
                pose: { fh: [54, -58], lean: 4 } },
      bthrow: { s: 16, a: 1, e: 20, hit: [], throw: { d: 14, b: 4.0, g: 6.6, ang: 140 },
                path: t => { const a = Math.min(t / 16, 1) * Math.PI * 1.4; return [Math.cos(a) * 36, -50 - Math.sin(a) * 22]; },
                pose: { fh: [-40, -62] } },
      // Al cielo: lo lanza muy alto pero vuelve a caer cerca... para agarrarlo otra vez
      uthrow: { s: 12, a: 1, e: 16, hit: [], throw: { d: 9, b: 5.0, g: 3.6, ang: 90 },
                path: t => { const k = Math.min(t / 12, 1); return [34 * (1 - k * 0.8), -50 - k * 56]; },
                pose: { fh: [6, -112], upper: true } },
      // Aplastar contra el suelo: rebota delante de él
      dthrow: { s: 12, a: 1, e: 20, hit: [], throw: { d: 10, b: 3.0, g: 2.6, ang: 82 },
                path: t => { const k = Math.min(t / 12, 1); return [34, -50 + k * 46]; },
                pose: { fh: [40, -4], crouch: true },
                onFrame(f, t, g) { if (t === 12) quake(f, g, 6, 30); } },

      // ===== ATAQUES RUBÍ (ver ruby.js) =====
      // Comeback de Rubí — PISOTÓN SÍSMICO: levanta el pie y pisa con todo; una onda sísmica recorre el suelo
      // hacia los dos lados. Ocupa medio escenario, pero solo alcanza a quien esté en el suelo.
      rubyCb: { s: 16, a: 16, e: 28, special: true, rubyName: 'PISOTÓN SÍSMICO', aiRange: [0, 110],
                hit: [0, 1, 2, 3, 4, 5, 6, 7].flatMap(k => [1, -1].map(s => ({
                  box: [s > 0 ? 14 + k * 12 : -30 - k * 12, -14, 16, 14], d: 24, b: 4.6, g: 9.2, ang: 72, away: true, on: [16 + k * 2, 17 + k * 2], group: 'sis' }))),
                pose(p, f, k, t) {
                  p.fh = [30, -44]; p.bh = [-26, -46];
                  if (k < 0) { p.ff = [12, Math.round(-34 * Math.min(1, -k * 1.3))]; p.hip[1] -= 2; p.neck[0] -= 2; p.head[0] -= 2; }   // pie en alto
                  else { crouchPose(p, 6); p.ff = [16, 0]; }
                },
                onFrame(f, t, g) {
                  f.vx *= 0.5;
                  if (t === 16) { quake(f, g, 12, 46); Sfx.hit(18); Sfx.brk(); }
                  if (t > 16 && t < 32 && t % 2 === 0) { const d = 20 + (t - 16) * 6; g.burst(f.x + d, f.y, 2, 'dust'); g.burst(f.x - d, f.y, 2, 'dust'); g.shake = Math.max(g.shake, 4); }
                },
                draw(c, f, t, g) {                                         // grietas y onda sísmica por el suelo
                  if (t < 16 || t >= 40) return;
                  const d = Math.min(116, 20 + (t - 16) * 6), a = t < 32 ? 1 : 1 - (t - 32) / 8, y = Math.round(f.y);
                  for (const s of [-1, 1]) {
                    let x = f.x + s * 10, yy = y;
                    withAlpha(c, a, () => {
                      for (let i = 0; x * s < (f.x + s * d) * s; i++) { const nx = x + s * 6, ny = y + ((i * 7) % 3) - 1; pline(c, x, yy, nx, ny, 1, '#2a1a10'); x = nx; yy = ny; }
                      const fx = Math.round(f.x + s * d);
                      if (t < 32) for (let j = -6; j <= 6; j++) { const h = Math.round(7 * Math.cos(j / 6 * Math.PI / 2)); rect(c, fx + j, y - h, 1, h, j % 2 ? '#c8a878' : '#8a6a48'); }
                    });
                  }
                } },
      // Ultimate Ruby — FURIA DE LA MONTAÑA: manotazo enorme; si acierta, empieza la técnica (ultimates.js)
      rubyUlt: { s: 12, a: 6, e: 28, special: true, rubyName: 'FURIA DE LA MONTAÑA', aiRange: [10, 72],
                 hit: [{ box: [10, -80, 56, 78], ult: true, d: 0, b: 0, g: 0, ang: 40 }],
                 pose: { fh: [60, -30], wind: [-10, -64], lean: 6 },
                 onFrame(f, t, g) { f.vx *= 0.5; if (t === 12) Sfx.swing(); } },
      // posturas para su Ultimate (no se usan en la pelea normal)
      ulDig:   { s: 1, a: 1, e: 1, hit: [], pose: { crouch: true, fh: [30, -4], bh: [22, -6], lean: 4 } },
      ulLift:  { s: 1, a: 1, e: 1, hit: [], pose: { fh: [4, -112], both: true, upper: true } },
      ulBack:  { s: 1, a: 1, e: 1, hit: [], pose: { fh: [-16, -106], both: true, upper: true } },
      ulThrow: { s: 1, a: 1, e: 1, hit: [], pose: { fh: [58, -62], both: true, lean: 6 } },
    },

    draw(c, f, p, A, frame) {
      const pal = f.pal;
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const shB = [neck[0] - 9, neck[1] + 5], shF = [neck[0] + 9, neck[1] + 5];
      // brazo trasero
      const bk = arm(c, shB, bh, 30, 9, { m: SKIN.dd, l: SKIN.d });
      hand(c, bk[0], bk[1], { l: SKIN.d, m: SKIN.d, d: SKIN.dd }, 6);
      // pierna trasera
      pline(c, hip[0] - 6, hip[1], bf[0], bf[1] - 4, 10, FUR.d);
      rect(c, bf[0] - 8, bf[1] - 5, 15, 6, FUR.d); rect(c, bf[0] - 8, bf[1] - 5, 15, 1, FUR.m);
      // torso: barril
      const top = neck[1] + 1, bot = hip[1] + 4;
      for (let y = top; y <= bot; y++) {
        const t = (y - top) / (bot - top);
        const cx = Math.round(lerp(neck[0], hip[0], t));
        const half = Math.round(13 + Math.sin(t * Math.PI) * 3 - t * 2);
        const tunic = t > 0.42;
        const base = tunic ? pal.main : SKIN.m, lite = tunic ? pal.light : SKIN.l, dark = tunic ? pal.dark : SKIN.d;
        rect(c, cx - half, y, half * 2 + 1, 1, base);
        rect(c, cx - half, y, 3, 1, lite);
        rect(c, cx + half - 3, y, 4, 1, dark);
        if (!tunic && (y % 5 === 0)) px(c, cx + 3, y, SKIN.d);          // vello / músculo
        if (tunic && ((y + cx) % 6 === 0)) px(c, cx - 2, y, dark);     // pliegues
      }
      // cinturón de bronce con hebilla
      const by = Math.round(lerp(top, bot, 0.62));
      const bcx = Math.round(lerp(neck[0], hip[0], 0.62));
      rect(c, bcx - 15, by, 31, 4, BRONZE.d); rect(c, bcx - 15, by, 31, 1, BRONZE.m);
      rect(c, bcx - 3, by - 1, 7, 6, BRONZE.m); rect(c, bcx - 2, by, 5, 4, BRONZE.l); px(c, bcx, by + 2, BRONZE.d);
      // manto de piel sobre los hombros (borde irregular)
      for (let x = -17; x <= 17; x++) {
        const h = 6 + ((x * 7 + 11) % 4 + 4) % 4;
        const xx = neck[0] + x;
        rect(c, xx, top - 2, 1, h, FUR.m);
        px(c, xx, top - 2, FUR.l);
        px(c, xx, top - 2 + h - 1, FUR.d);
      }
      // pierna delantera
      pline(c, hip[0] + 6, hip[1], ff[0], ff[1] - 4, 10, FUR.m);
      pline(c, hip[0] + 3, hip[1], ff[0] - 3, ff[1] - 4, 2, FUR.l);
      rect(c, ff[0] - 8, ff[1] - 5, 16, 6, FUR.d); rect(c, ff[0] - 8, ff[1] - 5, 16, 2, FUR.m);
      rect(c, ff[0] - 8, ff[1] - 7, 16, 2, BRONZE.d);   // tira de la bota
      // cabeza
      headArt(c, hd[0], hd[1], pal, 1, f.st === 'hitstun' || f.st === 'grabbed');
      // brazo delantero con brazal de bronce
      const fr = arm(c, shF, fh, 34, 10, SKIN);
      const wx = Math.round(lerp(fr[2], fr[0], 0.6)), wy = Math.round(lerp(fr[3], fr[1], 0.6));
      disc(c, wx, wy, 6, BRONZE.d); disc(c, wx, wy, 5, BRONZE.m); px(c, wx - 2, wy - 2, BRONZE.l); px(c, wx - 1, wy - 3, BRONZE.l);
      hand(c, fr[0], fr[1], SKIN, 8);
    },
    portrait(c, x, y, pal, k) {
      // la cabeza del gigante no cabe en el retrato: se recorta al marco
      c.save(); c.beginPath(); c.rect(x - 10, y - 11, 20, 20); c.clip();
      headArt(c, x - 1, y + 2, pal, 1);
      c.restore();
    },
  });

  // ------------------------------------------------------------
  //  Escena de selección: CUMBRE DEL GIGANTE (nieve y monolitos)
  // ------------------------------------------------------------
  const monoliths = (W, fy) => [[Math.round(W * 0.12), Math.round(fy * 0.34)], [Math.round(W * 0.88), Math.round(fy * 0.4)]];
  CHARACTERS.coloso.scene = {
    base(c, W, H, gy) {
      const fy = gy - 4;
      sceneGrad(c, 0, 0, W, fy, ['#10132b', '#1a1e40', '#272c55', '#3a3d6a', '#585878', '#7a7090']);
      const r = rng(8);
      for (let i = 0; i < W / 3; i++) px(c, r() * W | 0, r() * r() * fy * 0.5 | 0, r() < 0.5 ? '#ffffff' : '#bcd0f0');
      const peaks = (base, list, body, snow, shade) => {
        for (let x = 0; x < W; x++) {
          let h = 0; for (const [pc, pw, ph] of list) h = Math.max(h, ph * (1 - Math.abs(x - pc * W) / (pw * W)));
          const top = Math.round(base - h);
          for (let y = top; y < H; y++) px(c, x, y, y < top + 4 + h * 0.15 ? (x % 2 && y > top + 1 ? shade : snow) : body);
        }
      };
      peaks(Math.round(fy * 0.82), [[0.14, 0.22, fy * 0.36], [0.52, 0.3, fy * 0.48], [0.9, 0.24, fy * 0.3]], '#2a2f58', '#dce8fa', '#a8bcde');
      peaks(Math.round(fy * 0.96), [[0, 0.2, fy * 0.16], [0.36, 0.22, fy * 0.2], [0.74, 0.24, fy * 0.24], [1, 0.15, fy * 0.14]], '#1c2048', '#c2d4f0', '#8ea4cc');
      for (const [mx, mh] of monoliths(W, fy)) {
        rect(c, mx - 6, fy - mh, 12, mh, '#120d24'); rect(c, mx - 5, fy - mh + 1, 10, mh - 1, '#3d3a68');
        rect(c, mx - 5, fy - mh + 1, 3, mh - 1, '#535082'); rect(c, mx + 3, fy - mh + 1, 2, mh - 1, '#2b2850');
        rect(c, mx - 5, fy - mh + 1, 10, 2, '#dce8fa');
      }
      sceneGrad(c, 0, fy, W, H - fy, ['#e8f1ff', '#c2d4f0', '#8ea4cc', '#6a80aa']);
      for (let x = 0; x < W; x += 9) px(c, x, fy + 1, '#ffffff');
    },
    anim(c, W, H, gy, T) {
      const fy = gy - 4, g = (T >> 4) % 2;
      for (const [mx, mh] of monoliths(W, fy)) for (let k = 0; k < 3; k++) {
        const y = fy - mh + 6 + k * Math.round(mh / 4);
        px(c, mx, y, g ? '#6ff5ff' : '#2fb7d9'); px(c, mx - 1, y + 1, g ? '#6ff5ff' : '#2fb7d9'); px(c, mx + 1, y + 2, '#2fb7d9');
      }
      const ex = Math.round(((T * 0.35) % (W + 40)) - 20), ey = Math.round(fy * 0.2) + Math.round(Math.sin(T * 0.03) * 4), fl = (T >> 4) % 2;
      for (const dx of [-2, -1, 1, 2]) px(c, ex + dx, ey - fl, '#120d24');
      px(c, ex, ey, '#120d24'); px(c, ex - 3, ey + 1 - fl * 2, '#120d24'); px(c, ex + 3, ey + 1 - fl * 2, '#120d24');
    },
    front(c, W, H, gy, T) {
      for (let i = 0; i < W / 5; i++) {
        const x = (i * 41 + T * (0.2 + (i % 3) * 0.12)) % W, y = (i * 23 + T * (0.35 + (i % 4) * 0.1)) % H;
        if (i % 4 === 0) rect(c, Math.round(x), Math.round(y), 2, 2, '#eef7ff'); else px(c, Math.round(x), Math.round(y), '#ffffff');
      }
    },
    platform(c, cx, gy, T, W) {
      const w = Math.min(96, W - 6), x0 = Math.round(cx - w / 2);
      rect(c, x0 - 1, gy - 1, w + 2, 13, '#120d24');
      for (let x = x0; x < x0 + w; x++) for (let y = gy; y < gy + 11; y++) px(c, x, y, sceneDither(['#2b2850', '#3d3a68', '#535082', '#6d6a9e', '#8f8dc0'], 1 - (y - gy) / 12 - (x - x0) / w * 0.35, x, y));
      for (let x = x0; x < x0 + w; x++) { px(c, x, gy, '#ffffff'); if ((x * 5) % 7 < 4) px(c, x, gy + 1, '#dce8fa'); if ((x * 3) % 11 === 0) px(c, x, gy + 2, '#c2d4f0'); }
      const g = (T >> 4) % 2 ? '#6ff5ff' : '#2fb7d9';
      for (let rx = x0 + 10; rx < x0 + w - 6; rx += 18) { px(c, rx, gy + 5, g); px(c, rx + 1, gy + 6, g); px(c, rx - 1, gy + 7, g); px(c, rx + 1, gy + 8, g); }
      for (let k = 0; k < w / 14; k++) { const ix = x0 + 6 + k * 14, len = 2 + (k * 3) % 4; for (let j = 0; j < len; j++) px(c, ix, gy + 11 + j, j === len - 1 ? '#ffffff' : '#a8d8f8'); }
    },
  };
})();
