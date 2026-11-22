'use strict';
// ============================================================
//  RUNA — hechicera del bastón (zona y distancia)
//  Flota, golpea lejos con el bastón, se teletransporta y deja
//  trampas rúnicas. Débil de cerca y algo ligera.
// ============================================================
(() => {
  const ROBE_TRIM = '#ffd34a';
  const WOOD = { l: '#c99a6b', m: '#8c5a3c', d: '#5a3626' };
  const SKIN = '#e9cdb6';
  const UP = -Math.PI / 2;

  function hat(c, hx, hy, pal, k = 1, hurt = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    // cara en sombra con ojos brillantes
    R(-3, -2, 7, 5, '#1b1636');
    if (hurt) { R(0, 0, 2, 1, '#ffffff'); R(3, 0, 1, 1, '#ffffff'); }
    else { R(0, -1, 1, 2, pal.glow); R(3, -1, 1, 2, pal.glow); R(0, -1, 1, 1, '#ffffff'); }
    // sombrero puntiagudo, doblado hacia atrás
    R(-5, -3, 11, 2, pal.dark);   // ala
    R(-5, -3, 11, 1, pal.main);
    R(-3, -6, 7, 3, pal.dark);
    R(-3, -6, 2, 3, pal.main);
    R(-2, -8, 5, 2, pal.dark);
    R(-2, -8, 1, 2, pal.main);
    R(-2, -10, 3, 2, pal.dark);
    R(-4, -11, 3, 1, pal.dark);   // punta caída
    R(-5, -11, 1, 1, pal.light);
    R(-3, -5, 7, 1, ROBE_TRIM);   // cinta
  }

  // pose del bastón: ángulo (0 = horizontal hacia delante, -PI/2 = arriba)
  function staffPose(from, to, wind, fhTo, fhWind, extra) {
    return (p, f, k) => {
      if (k >= 0) {
        p.staff = lerp(from, to, k);
        if (fhTo) p.fh = L2(p.fh, fhTo, k);
      } else {
        p.staff = lerp(from, wind ?? from, -k);
        if (fhWind) p.fh = L2(p.fh, fhWind, -k);
      }
      p.glow = Math.max(0, k);
      if (extra) extra(p, f, k);
    };
  }
  const tip = (f, len = 14) => {
    const a = f._staffA ?? UP;
    return [f.x + f.dir * ((f._handX ?? 7) + Math.cos(a) * len), f.y + (f._handY ?? -13) + Math.sin(a) * len];
  };
  const sparkle = (f, g) => { const [x, y] = tip(f); g.burst(x, y, 2, 'spark', f.pal.light); };
  const blinkFx = (f, g) => { g.burst(f.x, f.y - 12, 8, 'star', f.pal.light); g.burst(f.x, f.y - 12, 6, 'spark', f.pal.glow); };

  defineCharacter({
    id: 'runa',
    name: 'Runa',
    role: 'Distancia',
    desc: 'Hechicera rúnica. Bastón largo, flota, se teletransporta y deja trampas. Mejor lejos que cerca.',
    stats: {
      walk: 2.0, gAcc: 0.4, fric: 0.4, airSpd: 1.9, aAcc: 0.18,
      jumpV: 6.0, hopV: 4.2, djumpV: 5.8, grav: 0.22, maxFall: 3.3, fastFall: 5.6,
      weight: 86, hw: 6, hh: 27,
    },
    bust: { k: 2, y: -37, h: 18, dx: 1 },
    selectH: 50,              // alto en la pantalla de selección (para encajarlo en su panel)
    runRate: 0.26,
    rest: { hip: [0, -10], neck: [0, -18], head: [1, -23], fh: [7, -13], bh: [-3, -12], ff: [2, 0], bf: [-2, 0], staff: -1.3 },
    poses: {
      // Selección: hace girar el bastón y lo alza; el cristal brilla
      // Pantalla VS: gira el bastón, lo alza cargándolo y apunta al rival
      taunt(p, f, T) {
        const t = T < 150 ? T : 100 + (T - 100) % 50, b = Math.round(Math.sin(T * 0.06));
        p.hip[1] += b; p.neck[1] += b; p.head[1] += b; p.bh[1] += b;
        if (t < 40) { p.fh = [7, -17 + b]; p.staff = -1.3 + t * 0.32; p.glow = 0; }
        else if (t < 84) { p.fh = [3, -28 + b]; p.staff = -1.57; p.glow = 1; p.bh = [-6, -20 + b]; p.head[1] -= 1; }
        else { p.fh = [11, -17 + b]; p.staff = -0.28; p.glow = 1; p.bh = [-5, -15 + b]; p.neck[0] += 1; p.head[0] += 1; }
        return true;
      },
      select(p, f, T) {
        const t = T % 130, b = Math.round(Math.sin(T * 0.06));
        p.hip[1] += b; p.neck[1] += b; p.head[1] += b; p.bh[1] += b;
        if (t < 64) { p.fh = [7, -17 + b]; p.staff = -1.3 + t * 0.2; p.glow = 0; }
        else if (t < 108) { p.fh = [3, -27 + b]; p.staff = -1.57; p.glow = 1; p.head[1] -= 1; }
        else { p.fh = [7, -13 + b]; p.staff = -1.3; p.glow = 0; }
        return true;
      },
      // Victoria: levita más alto, alza el bastón que brilla y lo hace girar
      win(p, f, T) {
        const b = Math.round(Math.sin(T * 0.07) * 2) + 4;
        for (const k of ['hip', 'neck', 'head', 'fh', 'bh', 'ff', 'bf']) p[k][1] -= b;
        p.ff = [2, 2 - b]; p.bf = [-2, 3 - b];
        if (T % 100 < 30) { p.staff = T * 0.6; p.fh = [4, -18 - b]; }
        else { p.staff = -1.57; p.fh = [3, -30 - b]; }
        p.glow = 1; p.bh = [-6, -20 - b]; p.head[1] -= 1;
        return true;
      },
      // Derrota: de rodillas, el bastón apagado y caído
      lose(p, f, T) {
        crouchPose(p, 6); p.staff = 0.95; p.glow = 0; p.fh = [7, -7]; p.bh = [2, -6];
        p.head[0] += 2; p.head[1] += 3; p.bf = [-6, 0];
        return true;
      },
      idle(p, f, T) {
        const b = Math.round(Math.sin(T * 0.06));   // flota suavemente
        p.hip[1] += b; p.neck[1] += b; p.head[1] += b; p.fh[1] += b; p.bh[1] += b;
        p.staff = -1.3 + Math.sin(T * 0.04) * 0.05;
      },
      run(p, f, ph) {
        const s = Math.sin(ph);
        p.ff = [Math.round(3 * s), 0]; p.bf = [Math.round(-3 * s), 0];
        p.neck[0] += 2; p.head[0] += 2; p.fh = [8, -14]; p.staff = -0.9;
        return true;
      },
      air(p, f, vy) { p.ff = [2, -2]; p.bf = [-2, -1]; p.fh = [8, -16]; p.bh = [-6, -17]; p.staff = vy < 0 ? -1.5 : -1.1; return true; },
      crouch(p) { p.staff = -0.4; },
    },

    moves: {
      jab:    { s: 4, a: 3, e: 10, hit: [{ box: [8, -17, 19, 7], d: 4, b: 2.2, g: 1.4, ang: 35 }], pose: staffPose(-1.3, 0, -1.3, [10, -14], [2, -14]) },
      ftilt:  { s: 7, a: 4, e: 16, hit: [{ box: [6, -30, 25, 26], d: 9, b: 2.8, g: 4.8, ang: 40 }], pose: staffPose(-2.4, 0.6, -2.6, [9, -15], [-2, -18]) },
      utilt:  { s: 5, a: 7, e: 14, hit: [{ box: [-17, -48, 34, 18], d: 7, b: 3.0, g: 4.0, ang: 90 }], pose: staffPose(-0.1, -3.0, 0.2, [3, -26], null) },
      dtilt:  { s: 5, a: 3, e: 12, hit: [{ box: [6, -7, 27, 7], d: 6, b: 2.4, g: 3.0, ang: 25 }], pose: staffPose(-1.3, 0.15, -1.3, [8, -6], null, p => crouchPose(p, 4)) },
      dash:   { s: 6, a: 8, e: 16, hit: [{ box: [8, -20, 23, 9], d: 8, b: 3.0, g: 4.0, ang: 40 }], pose: staffPose(-1.0, 0, -1.0, [12, -15], [0, -15]),
                onFrame(f, t) { if (t < 12) f.vx = f.dir * 3.0; } },
      fsmash: { s: 16, a: 5, e: 24, smash: true, hit: [{ box: [18, -30, 23, 23], d: 16, b: 3.6, g: 9.8, ang: 40 }],
                pose: staffPose(-1.6, 0, -1.6, [12, -16], [-2, -20]),
                onFrame(f, t, g) { if (t >= 16 && t < 21) { g.spark(f.x + f.dir * 30, f.y - 18, 10, f.pal.light); } } },
      usmash: { s: 13, a: 8, e: 22, smash: true, hit: [{ box: [-9, -74, 18, 54], d: 15, b: 3.6, g: 9.4, ang: 90 }],
                pose: staffPose(-1.6, -1.57, -0.6, [3, -30], [6, -10]),
                onFrame(f, t, g) { if (t >= 13 && t < 21) g.burst(f.x + (Math.random() * 10 - 5), f.y - 30 - Math.random() * 40, 2, 'spark', f.pal.glow); } },
      dsmash: { s: 10, a: 6, e: 22, smash: true, hit: [{ box: [-34, -9, 68, 9], d: 12, b: 3.2, g: 8.2, ang: 30, away: true }],
                pose: staffPose(-1.3, 1.5, -1.6, [5, -10], [5, -20], p => crouchPose(p, 2)),
                onFrame(f, t, g) { if (t === 10) { g.burst(f.x + 24, f.y - 2, 5, 'star', f.pal.light); g.burst(f.x - 24, f.y - 2, 5, 'star', f.pal.light); } } },
      nair:   { s: 5, a: 14, e: 10, air: true, land: 6, hit: [{ box: [-16, -32, 32, 32], d: 6, b: 2.4, g: 3.0, ang: 45, away: true }],
                pose(p, f, k, t) { p.staff = t * 0.7; p.fh = [4, -15]; p.glow = k > 0 ? 1 : 0; } },
      fair:   { s: 8, a: 4, e: 14, air: true, land: 9, hit: [{ box: [4, -33, 23, 26], d: 9, b: 2.8, g: 5.0, ang: 45 }], pose: staffPose(-2.3, 0.7, -2.5, [9, -16], null) },
      bair:   { s: 7, a: 4, e: 14, air: true, land: 9, hit: [{ box: [-28, -26, 21, 17], d: 10, b: 3.0, g: 6.0, ang: 140 }], pose: staffPose(-1.3, -3.0, -1.0, [-4, -16], null) },
      uair:   { s: 5, a: 6, e: 12, air: true, land: 7, hit: [{ box: [-13, -50, 26, 22], d: 8, b: 2.8, g: 4.6, ang: 88 }], pose: staffPose(-0.2, -2.9, 0, [3, -24], null) },
      dair:   { s: 10, a: 4, e: 18, air: true, land: 12, hit: [{ box: [-8, -2, 16, 15], d: 10, b: 2.4, g: 5.0, ang: -75 }], pose: staffPose(-1.3, 1.57, -1.6, [3, -10], [3, -20]) },
      // Especial: orbe que avanza ondulando
      nspc:   { s: 14, a: 1, e: 18, air: true, land: 4, special: true, hit: [], cd: 50, pose: staffPose(-1.6, -0.2, -1.8, [10, -16], null),
                onFrame(f, t, g) {
                  if (!f.grounded) f.vy = Math.min(f.vy, 0.6);
                  if (t < 14 && t % 3 === 0) sparkle(f, g);
                  if (t === 14) g.spawnProjectile(f, { kind: 'orb', x: 16, y: -20, vx: 2.8, wave: 0.6, life: 110, r: 5, h: { d: 9, b: 2.6, g: 3.2, ang: 40 } });
                } },
      // Especial lateral: parpadeo (teletransporte corto hacia delante)
      sspc:   { s: 6, a: 1, e: 14, air: true, land: 6, special: true, hit: [], keepVel: true, pose: staffPose(-1.3, -1.3, -1.3, null, null),
                onStart(f, g) { f.sideUsed = true; blinkFx(f, g); },
                onFrame(f, t, g) {
                  f.vx *= 0.5; f.vy = Math.min(f.vy, 0) * 0.5;
                  f.hidden = t < 6;
                  if (t === 6) { f.x += f.dir * 50; f.invuln = Math.max(f.invuln, 8); blinkFx(f, g); }
                },
                noGrav: (f, t) => t < 10 },
      // Especial arriba: ascenso rúnico (teletransporte en la dirección de la palanca)
      uspc:   { s: 8, a: 1, e: 12, air: true, land: 12, special: true, hit: [], keepVel: true, after: 'helpless', recovery: true,
                pose: staffPose(-1.57, -1.57, -1.57, [3, -24], null),
                onStart(f, g) { f.upUsed = true; f.grounded = false; f.plat = null; blinkFx(f, g); },
                onFrame(f, t, g) {
                  f.vx = 0; f.vy = 0;
                  f.hidden = t < 8;
                  if (t === 8) {
                    let dx = f.inp.mx, dy = f.inp.my;
                    if (Math.hypot(dx, dy) < 0.3) { dx = 0; dy = -1; }
                    const n = Math.hypot(dx, dy);
                    f.x += dx / n * 62; f.y += dy / n * 62;
                    if (dx) f.dir = sgn(dx);
                    f.invuln = Math.max(f.invuln, 10); blinkFx(f, g);
                  }
                },
                noGrav: () => true },
      // Especial abajo: runa trampa (una a la vez; explota al tocarla un rival)
      dspc:   { s: 10, a: 1, e: 14, air: true, land: 6, special: true, hit: [], pose: staffPose(-1.3, 1.2, -1.6, [8, -8], null),
                onFrame(f, t, g) {
                  if (!f.grounded) f.vy = Math.min(f.vy, 0.8);
                  if (t === 10) g.spawnProjectile(f, { kind: 'mine', x: 16, y: -6, vx: 0, life: 300, r: 6, max: 1, h: { d: 12, b: 3.2, g: 6.0, ang: 70, away: true } });
                } },

      // ===== ATAQUES RUBÍ (ver ruby.js) =====
      // Comeback de Rubí — RUNA SÚBITA: clava el bastón y un círculo rúnico estalla A DISTANCIA FIJA delante
      // de ella (avisa un instante antes). Si el rival no está justo ahí, falla.
      rubyCb: { s: 12, a: 6, e: 22, special: true, rubyName: 'RUNA SÚBITA', aiRange: [32, 54],
                hit: [{ box: [30, -48, 26, 48], d: 24, b: 4.6, g: 9.4, ang: 82 }],
                pose: staffPose(-1.3, 1.25, -1.9, [8, -8], [4, -24], p => crouchPose(p, 2)),
                onFrame(f, t, g) {
                  f.vx *= 0.5;
                  const x = f.x + f.dir * 43;
                  if (t < 12 && t % 2 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: x + (Math.random() * 24 - 12), y: f.y - 1, vx: 0, vy: -0.5, t: 0, life: 10, size: 1, col: t % 4 ? f.pal.light : '#ff8aa0' });
                  if (t === 12) {
                    g.shake = Math.max(g.shake, 6); Sfx.brk();
                    duoRadial(g, x, f.y - 8, 16, [f.pal.light, '#ffffff', '#ff8aa0'], 2.4);
                    for (let i = 0; i < 10; i++) g.fx.push({ kind: 'part', ptype: 'star', x: x + (Math.random() * 16 - 8), y: f.y - Math.random() * 40, vx: 0, vy: -1.4 - Math.random(), t: 0, life: 22, size: 1, col: i % 2 ? '#ffffff' : f.pal.light });
                  }
                },
                draw(c, f, t, g) {                                       // el círculo que avisa y la columna de luz
                  const x = Math.round(f.x + f.dir * 43), y = Math.round(f.y), col = f.pal.light;
                  if (t < 12) {
                    const r = 4 + t, a = 0.5 + t * 0.04;
                    glow(c, x, y - 1, r, col, 0.2, 2);
                    groundEllipse(c, x, y, r, col, a); groundEllipse(c, x, y, r * 0.6, '#ff8aa0', a);
                    for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2 + t * 0.2; drawGlyph(c, x + Math.cos(an) * r, y + Math.sin(an) * r * 0.3, i, '#ffffff', a); }
                  } else if (t < 26) {
                    const k = (t - 12) / 14, w = Math.max(2, Math.round(13 * (1 - k))), h = 56;
                    rect(c, x - w, y - h, w * 2, h, col, 0.55 * (1 - k)); rect(c, x - (w >> 1), y - h, w, h, '#ffffff', 0.8 * (1 - k));
                    groundEllipse(c, x, y, 14 + k * 10, col, 1 - k);
                  }
                } },
      // Ultimate Ruby — GRIMORIO PROHIBIDO: lanza un sello rúnico; si acierta, empieza la técnica (ultimates.js)
      rubyUlt: { s: 10, a: 5, e: 24, special: true, rubyName: 'GRIMORIO PROHIBIDO', aiRange: [16, 54],
                 hit: [{ box: [12, -30, 40, 26], ult: true, d: 0, b: 0, g: 0, ang: 45 }],
                 pose: staffPose(-1.6, -0.15, -1.9, [11, -16], null),
                 onFrame(f, t, g) { if (t < 10 && t % 2 === 0) sparkle(f, g); if (t === 10) Sfx.freeze(); },
                 draw(c, f, t, g) {                                      // el sello que sale disparado
                   if (t < 10 || t >= 16) return;
                   const x = Math.round(f.x + f.dir * (16 + (t - 10) * 7)), y = Math.round(f.y - 17);
                   glow(c, x, y, 7, f.pal.light, 0.4, 3);
                   withAlpha(c, 0.9, () => ring(c, x, y, 5, '#ffffff'));
                   drawGlyph(c, x, y, t, '#ff8aa0');
                 } },
    },

    draw(c, f, p, A, frame) {
      const pal = f.pal;
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const sh = [neck[0], neck[1] + 1];
      // bastón: guarda la posición de la mano y el ángulo para efectos
      const ang = p.staff ?? -1.3;
      f._staffA = ang; f._handX = p.fh[0]; f._handY = p.fh[1];
      const sx1 = fh[0] + Math.cos(ang) * 14, sy1 = fh[1] + Math.sin(ang) * 14;
      const sx0 = fh[0] - Math.cos(ang) * 9, sy0 = fh[1] - Math.sin(ang) * 9;
      // brazo trasero
      pline(c, sh[0] - 1, sh[1], bh[0], bh[1], 3, pal.dark);
      rect(c, bh[0] - 1, bh[1], 2, 2, SKIN);
      // túnica: trapecio que se ensancha hacia los pies y ondea al moverse
      const sway = clamp(Math.round(-f.vx * 1.2 * f.dir), -3, 3);
      const top = neck[1] + 1, bottom = OY - 1;
      for (let y = top; y <= bottom; y++) {
        const t = (y - top) / (bottom - top);
        const cx = Math.round(lerp(neck[0], hip[0], Math.min(1, t * 1.6)) + sway * t * t);
        const half = Math.round(lerp(3, 7, t));
        rect(c, cx - half, y, half * 2 + 1, 1, pal.main);
        px(c, cx - half, y, pal.light);
        px(c, cx + half, y, pal.dark);
        if (t > 0.35 && (y & 3) === 0) px(c, cx + 2, y, pal.dark);   // pliegue
      }
      const hemC = Math.round(hip[0] + sway);
      rect(c, hemC - 7, bottom, 15, 1, ROBE_TRIM);
      rect(c, hip[0] - 3, hip[1] - 1, 7, 1, ROBE_TRIM);                    // cinturón
      // pies asomando
      rect(c, ff[0] - 1, ff[1] - 1, 3, 1, '#2a2240');
      rect(c, bf[0] - 2, bf[1] - 1, 3, 1, '#1b1636');
      hat(c, hd[0], hd[1], pal, 1, f.st === 'hitstun');
      // bastón y cristal
      pline(c, sx0, sy0, sx1, sy1, 2, WOOD.m);
      pline(c, sx0, sy0, sx1, sy1, 1, WOOD.l);
      const glow = p.glow || 0;
      disc(c, sx1, sy1, glow > 0.5 ? 3 : 2, pal.dark);
      px(c, Math.round(sx1), Math.round(sy1), glow > 0.5 || (frame >> 4) % 2 ? '#ffffff' : pal.light);
      px(c, Math.round(sx1) - 1, Math.round(sy1) - 1, pal.glow);
      if (glow > 0.5) ring(c, sx1, sy1, 4 + ((frame >> 1) % 2), pal.light);
      // manga delantera y mano
      pline(c, sh[0] + 1, sh[1], fh[0], fh[1], 3, pal.main);
      px(c, sh[0] + 1, sh[1], pal.light);
      rect(c, fh[0] - 1, fh[1] - 1, 3, 3, SKIN);
    },
    portrait(c, x, y, pal, k) { hat(c, x, y + 2 * k, pal, k); },
  });

  // ------------------------------------------------------------
  //  Escena de selección: TORRE DE LA HECHICERA (con libro de hechizos)
  // ------------------------------------------------------------
  const towerLayout = (W, H, gy) => {
    const fy = gy - 4;
    return { fy, wx: Math.round(W / 2), wy: Math.round(fy * 0.3), R: Math.max(10, Math.min(17, Math.round(W * 0.13))),
      lsx: 4, lsy: Math.round(fy * 0.56), lsw: Math.round(W * 0.27), rsx: Math.round(W * 0.71), rsy: Math.round(fy * 0.68), rsw: Math.round(W * 0.27) };
  };
  CHARACTERS.runa.scene = {
    base(c, W, H, gy) {
      const L = towerLayout(W, H, gy), fy = L.fy;
      for (let y = 0; y < fy; y++) for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, bx = (x + off) % 16, by = y % 8;
        let col;
        if (by === 7 || bx === 15) col = '#16112a';
        else if (by === 0) col = '#4a4070';
        else col = sceneDither(['#241e3c', '#2e2750', '#3a3262'], 0.75 - y / (fy * 1.6) + ((row * 7 + Math.floor((x + off) / 16) * 3) % 5) * 0.06, x, y);
        px(c, x, y, col);
      }
      const { wx, wy, R } = L;
      for (let y = -R - 3; y <= R + 3; y++) for (let x = -R - 3; x <= R + 3; x++) {
        const d = Math.hypot(x, y);
        if (d <= R) px(c, wx + x, wy + y, sceneDither(['#0b1030', '#13204a', '#1d3062'], (y + R) / (2 * R), wx + x, wy + y));
        else if (d <= R + 3) px(c, wx + x, wy + y, d < R + 1.5 ? '#6a5e98' : '#3a3262');
      }
      for (const [sx, sy] of [[-10, -10], [6, -12], [12, 6], [-8, 10], [0, -4]]) px(c, wx + Math.round(sx * R / 17), wy + Math.round(sy * R / 17), '#ffffff');
      const mr = Math.max(3, Math.round(R * 0.3));
      disc(c, wx + Math.round(R * 0.4), wy - Math.round(R * 0.25), mr, '#f3f8ff'); disc(c, wx + Math.round(R * 0.4) + 2, wy - Math.round(R * 0.25) - 1, mr - 1, '#13204a');
      rect(c, wx - R, wy, R * 2 + 1, 1, '#3a3262'); rect(c, wx, wy - R, 1, R * 2 + 1, '#3a3262');
      const shelf = (x0, y0, w) => { rect(c, x0, y0, w, 3, '#6b4024'); rect(c, x0, y0, w, 1, '#a06a3c'); rect(c, x0 + 2, y0 + 3, 2, 4, '#4a2c18'); rect(c, x0 + w - 4, y0 + 3, 2, 4, '#4a2c18'); };
      shelf(L.lsx, L.lsy, L.lsw); shelf(L.rsx, L.rsy, L.rsw);
      const potion = (x, y, col, tall) => {
        const h = tall ? 9 : 6;
        rect(c, x - 1, y - h - 1, 7, h + 1, '#120d24'); rect(c, x, y - h, 5, h, col); px(c, x + 1, y - h + 1, '#ffffff');
        rect(c, x + 1, y - h - 3, 3, 3, '#c9c1e8'); rect(c, x + 1, y - h - 4, 3, 1, '#8a5a3c');
      };
      potion(L.lsx + 4, L.lsy, '#3df2b0', true); potion(L.lsx + 12, L.lsy, '#ff5f9a', false); if (L.lsw > 30) potion(L.lsx + L.lsw - 10, L.lsy, '#c48cff', true);
      [['#7a2a5c', 10], ['#2f5a9a', 12], ['#3a7a4a', 9], ['#9a6a2a', 11]].forEach(([col, h], i) => {
        const bx = L.rsx + 4 + i * 4; if (bx > L.rsx + L.rsw - 10) return;
        rect(c, bx, L.rsy - h, 4, h, col); rect(c, bx, L.rsy - h + 2, 4, 1, '#ffd34a');
      });
      potion(L.rsx + L.rsw - 9, L.rsy, '#6ff5ff', false);
      for (const hx of [Math.round(W * 0.07), Math.round(W * 0.13), Math.round(W * 0.92)]) { pline(c, hx, 0, hx, 12, 1, '#3a7a4a'); for (let k = 3; k < 13; k += 3) { px(c, hx - 1, k, '#6ad85c'); px(c, hx + 1, k + 1, '#4fbf55'); } }
      for (let y = fy; y < H; y++) for (let x = 0; x < W; x++) px(c, x, y, (x % 20 === 0 || y === fy) ? '#24160e' : sceneDither(['#5a3420', '#4a2c18', '#3a2214', '#24160e'], (y - fy) / (H - fy), x, y));
    },
    anim(c, W, H, gy, T) {
      const L = towerLayout(W, H, gy);
      for (const [vx, vy] of [[L.lsx + L.lsw - 4, L.lsy], [L.rsx + 1, L.rsy]]) {
        rect(c, vx, vy - 6, 3, 6, '#f1e6c8'); px(c, vx, vy - 6, '#ffffff');
        const fl = (T >> 2) % 3;
        px(c, vx + 1, vy - 7, '#ffd27a'); px(c, vx + 1, vy - 8 - (fl === 0 ? 1 : 0), '#ff8a3a'); if (fl !== 2) px(c, vx + (fl ? 0 : 2), vy - 8, '#ffd27a');
        for (let a = 0; a < 10; a++) if ((a + (T >> 2)) % 2) px(c, vx + 1 + Math.round(Math.cos(a * 0.63) * 6), vy - 8 + Math.round(Math.sin(a * 0.63) * 5), '#6a4a3a');
      }
      for (let i = 0; i < Math.round(W / 11); i++) {
        const x = (i * 37 + 11) % W, y = L.fy - ((T * (0.3 + (i % 4) * 0.1) + i * 29) % L.fy);
        const col = i % 3 === 0 ? '#c48cff' : i % 3 === 1 ? '#6ff5ff' : '#ffd34a';
        px(c, Math.round(x + Math.sin(T * 0.05 + i) * 2), Math.round(y), col);
      }
    },
    platform(c, cx, gy, T, W) {
      const w = Math.min(66, W - 8), x0 = Math.round(cx - w / 2), mid = Math.round(cx);
      rect(c, x0 - 2, gy + 3, w + 4, 6, '#120d24');
      rect(c, x0 - 1, gy + 4, w + 2, 4, '#6b2f4a'); rect(c, x0 - 1, gy + 4, w + 2, 1, '#9a4a6a');
      for (const gx of [x0 - 1, x0 + w - 3]) rect(c, gx, gy + 4, 4, 4, '#ffd34a');
      for (let x = x0; x < x0 + w; x++) {
        const d = Math.abs(x - mid) / (w / 2), top = gy + (x === mid ? 2 : 0) + (d < 0.08 ? 1 : 0) - Math.round(d * 1.5) + 1;
        px(c, x, top - 1, '#120d24');
        for (let y = top; y < gy + 4; y++) px(c, x, y, d < 0.12 ? '#cbb88f' : y === top ? '#fff8e6' : '#f1e6c8');
      }
      for (let line = 0; line < 2; line++) for (let x = x0 + 5; x < x0 + w - 5; x++) if (Math.abs(x - mid) > 4 && ((x * 7 + line * 3) % 5) < 3) px(c, x, gy + 1 + line, '#a8977a');
      ring(c, mid + 16, gy + 1, 3, (T >> 3) % 4 < 2 ? '#c48cff' : '#e8d0ff');
      rect(c, mid - 1, gy + 4, 2, 9, '#c7362f'); px(c, mid - 1, gy + 13, '#7a1730');
    },
    front(c, W, H, gy, T) {
      for (let i = 0; i < 4; i++) { const a = T * 0.04 + i * 1.57; px(c, Math.round(W / 2 + Math.cos(a) * 24), Math.round(gy - 32 + Math.sin(a) * 10), '#e8d0ff'); }
    },
  };
})();
