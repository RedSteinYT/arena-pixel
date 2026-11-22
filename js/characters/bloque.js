'use strict';
// ============================================================
//  BLOQUE — gólem de roca (pesado)
//  Lento, salta poco y se recupera mal, pero pega muy fuerte
//  y cuesta mucho sacarlo del escenario.
// ============================================================
(() => {
  const STONE = { hi: '#b9b6e0', l: '#8f8dc0', m: '#6d6a9e', d: '#4d4a7c', dd: '#2f2c58' };
  const MOSS = { l: '#a6ec6a', m: '#4fbf55', d: '#2a8048' };

  function boulder(c, x0, y0, w, h, seed) {
    // bloque de roca con luz arriba-izquierda y tramado
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cornerCut = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
      if (cornerCut) continue;
      const v = 2.6 - (x / w) * 1.3 - (y / h) * 1.2 + (BAYER[(y + seed) & 3][(x + seed) & 3] / 16 - 0.5) * 0.9;
      const col = v > 2.1 ? STONE.l : v > 1.4 ? STONE.m : v > 0.8 ? STONE.d : STONE.dd;
      px(c, x0 + x, y0 + y, col);
    }
    for (let x = 1; x < w - 1; x++) px(c, x0 + x, y0, STONE.hi);
  }

  function face(c, hx, hy, pal, k = 1, hurt = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    R(-4, -4, 9, 8, STONE.m);
    R(-3, -5, 7, 1, STONE.l);
    R(-4, -4, 2, 6, STONE.l);
    R(3, -3, 2, 7, STONE.d);
    R(-4, 3, 9, 1, STONE.dd);
    R(-2, -3, 6, 2, STONE.dd);                  // ceja de piedra
    if (hurt) { R(-1, -1, 2, 1, '#ffffff'); R(2, -1, 2, 1, '#ffffff'); }
    else { R(-1, -1, 2, 2, pal.glow); R(2, -1, 2, 2, pal.glow); R(-1, -1, 1, 1, '#ffffff'); }
    R(0, 2, 3, 1, STONE.dd);                    // boca
    R(-3, -5, 3, 1, MOSS.m); R(-2, -6, 1, 1, MOSS.l);   // musgo
  }

  function fist(c, x, y, pal, big) {
    const s = big ? 7 : 6, o = s >> 1;
    rect(c, x - o, y - o, s, s, STONE.m);
    rect(c, x - o, y - o, s, 1, STONE.l);
    rect(c, x - o, y - o, 1, s - 1, STONE.l);
    rect(c, x - o + s - 1, y - o + 1, 1, s - 1, STONE.d);
    rect(c, x - o, y + o, s, 1, STONE.dd);
    rect(c, x - o + 1, y - o + 2, s - 2, 1, pal.main);   // brazalete de color
  }

  const quake = (f, g, n) => { g.shake = Math.max(g.shake, n); g.burst(f.x + f.dir * 10, f.y, 6, 'dust'); g.burst(f.x - f.dir * 10, f.y, 6, 'dust'); };

  defineCharacter({
    id: 'bloque',
    name: 'Bloque',
    role: 'Pesado',
    desc: 'Gólem de roca. Lento y torpe en el aire, pero cada golpe pesa una tonelada.',
    stats: {
      walk: 1.7, gAcc: 0.35, fric: 0.5, airSpd: 1.55, aAcc: 0.15,
      jumpV: 5.9, hopV: 4.0, djumpV: 5.3, grav: 0.34, maxFall: 5.0, fastFall: 7.0,
      weight: 140, hw: 9, hh: 30,
    },
    bust: { k: 2, y: -34, h: 18, dx: 2 },
    selectH: 40,              // alto en la pantalla de selección (para encajarlo en su panel)
    runRate: 0.22,
    rest: { hip: [0, -11], neck: [0, -24], head: [3, -27], fh: [9, -14], bh: [-6, -15], ff: [5, 0], bf: [-5, 0] },
    poses: {
      // Selección: entrechoca los puños de piedra como un martillo
      // Pantalla VS: puño contra la palma, levanta los dos puños y golpea el suelo
      taunt(p, f, T) {
        const t = T < 150 ? T : 100 + (T - 100) % 50;
        p.bh = [8, -18];
        if (t < 52) {                                                   // puño contra palma
          const k = (t % 13) / 13;
          p.fh = k < 0.6 ? [15, -23] : [10, -18];
          if (k >= 0.6) crouchPose(p, 1);
        } else if (t < 70) { p.fh = [6, -40]; p.bh = [-1, -40]; p.head[1] -= 1; }   // los alza
        else if (t < 84) { crouchPose(p, 6); p.fh = [13, -2]; p.bh = [-3, -2]; p.slam = 1; }   // ¡golpe!
        else {                                                           // guardia pesada
          const b = Math.sin(T * 0.08) > 0 ? 1 : 0;
          crouchPose(p, 2 + b); p.fh = [12, -17]; p.bh = [6, -18];
        }
        return true;
      },
      select(p, f, T) {
        const t = T % 44;
        if (t < 26) { const a = t / 26; p.fh = [Math.round(lerp(10, 16, a)), Math.round(lerp(-14, -22, a))]; p.bh = [Math.round(lerp(-6, -10, a)), Math.round(lerp(-15, -23, a))]; }
        else if (t < 32) { p.fh = [8, -17]; p.bh = [6, -17]; crouchPose(p, 2); }
        else { p.fh = [9, -16]; p.bh = [4, -16]; crouchPose(p, 1); }
        return true;
      },
      // Victoria: alterna los puños en alto y golpea el suelo
      win(p, f, T) {
        const t = T % 100;
        if (t < 70) { const k = (t >> 4) % 2; p.fh = k ? [6, -42] : [12, -20]; p.bh = k ? [2, -18] : [-1, -42]; p.head[1] -= 1; }
        else if (t < 80) { p.fh = [6, -40]; p.bh = [-1, -40]; }
        else { crouchPose(p, 6); p.fh = [13, -2]; p.bh = [-3, -2]; p.slam = 1; }
        return true;
      },
      // Derrota: se desmorona, los brazos colgando
      lose(p, f, T) {
        const s = T % 70 < 6 ? ((T >> 1) % 2 ? 1 : -1) : 0;        // se le caen piedrecitas
        crouchPose(p, 7); p.fh = [8 + s, -2]; p.bh = [-4, -2]; p.head[0] += 3; p.head[1] += 3;
        return true;
      },
      idle(p, f, T) {
        const b = Math.sin(T * 0.05) > 0 ? 1 : 0;   // respiración lenta y pesada
        p.neck[1] += b; p.head[1] += b; p.fh[1] += b; p.bh[1] += b;
      },
      run(p, f, ph) {
        const s = Math.sin(ph);
        p.ff = [Math.round(6 * s), -Math.max(0, Math.round(2 * Math.cos(ph)))];
        p.bf = [Math.round(-6 * s), -Math.max(0, Math.round(-2 * Math.cos(ph)))];
        p.fh = [9 + Math.round(-3 * s), -14]; p.bh = [-6 + Math.round(3 * s), -15];
        const stomp = Math.abs(s) > 0.9 ? 1 : 0; p.neck[1] += stomp; p.head[1] += stomp;
        p.neck[0] += 2; p.head[0] += 2;
        return true;
      },
      air(p, f) { p.ff = [5, -3]; p.bf = [-5, -2]; p.fh = [11, -22]; p.bh = [-9, -20]; return true; },
    },

    moves: {
      jab:    { s: 6, a: 3, e: 12, hit: [{ box: [6, -23, 16, 11], d: 6, b: 2.8, g: 2.2, ang: 40 }], pose: { fh: [18, -18] } },
      ftilt:  { s: 9, a: 4, e: 18, hit: [{ box: [6, -25, 23, 13], d: 12, b: 3.2, g: 5.5, ang: 35 }], pose: { fh: [23, -17], wind: [-6, -21], lean: 3 } },
      utilt:  { s: 7, a: 6, e: 16, hit: [{ box: [-13, -52, 26, 24], d: 11, b: 3.6, g: 4.6, ang: 86 }], pose: { fh: [3, -44], both: true, upper: true } },
      dtilt:  { s: 7, a: 4, e: 14, hit: [{ box: [4, -9, 25, 9], d: 9, b: 2.8, g: 3.8, ang: 30 }], pose: { fh: [19, -3], crouch: true },
                onFrame(f, t, g) { if (t === 7) g.burst(f.x + f.dir * 20, f.y, 3, 'dust'); } },
      dash:   { s: 7, a: 10, e: 20, hit: [{ box: [2, -29, 20, 25], d: 13, b: 3.6, g: 5.0, ang: 40 }], pose: { fh: [12, -22], bh: [8, -18], lean: 4 },
                onFrame(f, t) { if (t < 17) f.vx = f.dir * 3.0; } },
      fsmash: { s: 18, a: 4, e: 30, smash: true, hit: [{ box: [8, -32, 28, 32], d: 22, b: 4.2, g: 11, ang: 45 }],
                pose: { fh: [25, -6], wind: [-4, -40], both: true, lean: 4 },
                onFrame(f, t, g) { if (t === 18) quake(f, g, 5); } },
      usmash: { s: 14, a: 6, e: 26, smash: true, hit: [{ box: [-14, -58, 28, 30], d: 19, b: 4.0, g: 10.5, ang: 88 }],
                pose: { fh: [2, -48], wind: [4, -6], both: true, upper: true } },
      dsmash: { s: 12, a: 5, e: 28, smash: true, hit: [{ box: [-36, -11, 72, 11], d: 17, b: 3.6, g: 9.0, ang: 30, away: true }],
                pose: { fh: [15, -1], bh: [-14, -1], wind: [6, -40], crouch: true },
                onFrame(f, t, g) { if (t === 12) quake(f, g, 6); } },
      nair:   { s: 6, a: 8, e: 14, air: true, land: 8, hit: [{ box: [-17, -34, 34, 34], d: 10, b: 3.0, g: 4.0, ang: 50, away: true }], pose: { spin: true, spinR: 12, spinRate: 0.6 } },
      fair:   { s: 10, a: 4, e: 18, air: true, land: 12, hit: [{ box: [6, -28, 21, 24], d: 14, b: 3.2, g: 6.0, ang: 30 }], pose: { fh: [17, -6], wind: [-2, -36], both: true } },
      bair:   { s: 8, a: 4, e: 18, air: true, land: 12, hit: [{ box: [-28, -27, 21, 15], d: 15, b: 3.4, g: 7.0, ang: 145 }], pose: { bh: [-19, -21], lean: -2 } },
      uair:   { s: 7, a: 5, e: 16, air: true, land: 8, hit: [{ box: [-13, -52, 26, 22], d: 12, b: 3.2, g: 5.5, ang: 86 }], pose: { fh: [2, -44], both: true, upper: true } },
      dair:   { s: 12, a: 5, e: 22, air: true, land: 16, hit: [{ box: [-11, -7, 22, 15], d: 15, b: 2.6, g: 5.8, ang: -85 }], pose: { ff: [3, 6], bf: [-3, 6], fh: [10, -26], bh: [-10, -26] } },
      // Especial: lanza una roca en arco
      nspc:   { s: 16, a: 1, e: 20, air: true, land: 6, special: true, hit: [], cd: 55, pose: { fh: [16, -30], wind: [-6, -36] },
                onFrame(f, t, g) {
                  if (!f.grounded) f.vy = Math.min(f.vy, 1);
                  if (t === 16) g.spawnProjectile(f, { kind: 'rock', x: 12, y: -32, vx: 3.2, vy: -3.6, grav: 0.2, life: 120, r: 5, h: { d: 11, b: 3.0, g: 5.0, ang: 45 } });
                } },
      // Especial lateral: embestida de roca (más lenta y más fuerte)
      sspc:   { s: 10, a: 16, e: 18, air: true, land: 12, special: true, keepVel: true,
                hit: [{ box: [2, -29, 21, 27], d: 14, b: 3.6, g: 6.0, ang: 38 }], pose: { fh: [14, -20], bh: [10, -16], lean: 4 },
                onStart(f) { f.sideUsed = true; },
                onFrame(f, t, g) {
                  if (t < 10) { f.vx *= 0.7; f.vy *= 0.5; }
                  else if (t < 26) { f.vx = f.dir * 4.4; f.vy = 0; if (t % 3 === 0) g.burst(f.x - f.dir * 8, f.y - 4, 1, 'dust'); }
                  else f.vx *= 0.8;
                },
                noGrav: (f, t) => t < 26 },
      // Especial arriba: salto de montaña (recuperación corta)
      uspc:   { s: 5, a: 12, e: 16, air: true, land: 16, special: true, keepVel: true, after: 'helpless', recovery: true,
                hit: [{ box: [-11, -42, 22, 34], d: 11, b: 3.6, g: 5.0, ang: 80 }], pose: { fh: [3, -44], both: true, upper: true },
                onStart(f) { f.upUsed = true; f.grounded = false; },
                onFrame(f, t) {
                  if (t === 5) { f.vy = -7.2; f.vx = f.inp.mx * 1.2; }
                  if (t > 5 && t < 17) f.vx = clamp(f.vx + f.inp.mx * 0.06, -1.6, 1.6);
                } },
      // Especial abajo: terremoto (en el aire cae en picado y lo provoca al aterrizar)
      dspc:   { s: 8, a: 60, e: 4, air: true, land: 0, special: true, keepVel: true, landTo: 'dspcLand', airOnly: true,
                hit: [{ box: [-11, -10, 22, 16], d: 13, b: 2.6, g: 5.0, ang: -75 }], pose: { ff: [3, 4], bf: [-3, 4], fh: [11, -34], bh: [-11, -34] },
                onStart(f, g) { if (f.grounded) f.startMove('dspcLand', g); },
                onFrame(f, t) {
                  if (t < 8) { f.vy = Math.min(f.vy, -1) * 0.9; f.vx *= 0.8; }
                  else { f.vy = 8.4; f.vx *= 0.85; }
                },
                noGrav: () => true },
      dspcLand: { s: 12, a: 6, e: 24, special: true, hit: [{ box: [-46, -11, 92, 11], d: 14, b: 3.4, g: 6.5, ang: 70, away: true }],
                  pose: { fh: [12, -1], bh: [-12, -1], wind: [4, -40], crouch: true },
                  onFrame(f, t, g) { if (t === 12) { quake(f, g, 8); g.burst(f.x + 30, f.y, 6, 'dust'); g.burst(f.x - 30, f.y, 6, 'dust'); } } },

      // ===== ATAQUES RUBÍ (ver ruby.js) =====
      // Comeback de Rubí — AVALANCHA: golpe tremendo al suelo y las rocas se levantan en fila hacia los dos
      // lados, una tras otra. Solo alcanza a quien esté en el suelo cerca (saltando a tiempo se esquiva).
      rubyCb: { s: 14, a: 14, e: 24, special: true, rubyName: 'AVALANCHA', aiRange: [0, 72],
                hit: [0, 1, 2].flatMap(i => [[10 + i * 24, 14 + i * 4], [-34 - i * 24, 14 + i * 4]].map(([x, on]) =>
                  ({ box: [x, -24, 24, 24], d: 23, b: 4.6, g: 9.0, ang: 76, away: true, on: [on, on + 3], group: 'av' }))),
                pose: { fh: [15, -1], bh: [-14, -1], wind: [6, -42], crouch: true },
                onFrame(f, t, g) {
                  f.vx = 0;
                  if (t < 14 && t % 3 === 0) g.burst(f.x + (Math.random() * 16 - 8), f.y - 34 - Math.random() * 8, 1, 'star', '#ff8aa0');
                  for (let i = 0; i < 3; i++) if (t === 14 + i * 4) {
                    const d = 22 + i * 24;
                    g.shake = Math.max(g.shake, 7 - i); Sfx.hit(12 - i * 2);
                    for (const s of [-1, 1]) { g.burst(f.x + s * d, f.y, 6, 'dust'); g.fx.push({ kind: 'part', ptype: 'spark', x: f.x + s * d, y: f.y - 6, vx: s * 0.6, vy: -1.6, t: 0, life: 14, size: 2, col: '#b9b6e0' }); }
                  }
                },
                draw(c, f, t, g) {                                         // los picos de roca que salen del suelo
                  for (let i = 0; i < 3; i++) {
                    const t0 = 14 + i * 4, k = t - t0; if (k < 0 || k > 22) continue;
                    const hmax = 26 - i * 3, h = Math.round(k < 4 ? hmax * k / 4 : k < 14 ? hmax : hmax * (1 - (k - 14) / 8));
                    if (h <= 0) continue;
                    for (const s of [-1, 1]) {
                      const x = Math.round(f.x + s * (22 + i * 24)), w = 10 - i;
                      rect(c, x - (w >> 1) - 1, f.y - h - 1, w + 2, h + 1, OUTLINE);
                      boulder(c, x - (w >> 1), f.y - h, w, h, i * 3 + (s > 0 ? 1 : 0));
                      rect(c, x - 1, f.y - h - 3, 3, 3, STONE.l); px(c, x, f.y - h - 4, STONE.hi);   // punta
                    }
                  }
                } },
      // Ultimate Ruby — MONTAÑA VIVIENTE: embestida de hombro corta (frena en el borde); si acierta,
      // empieza la técnica (ultimates.js)
      rubyUlt: { s: 8, a: 10, e: 22, special: true, keepVel: true, rubyName: 'MONTAÑA VIVIENTE', aiRange: [0, 46],
                 hit: [{ box: [2, -29, 21, 27], ult: true, d: 0, b: 0, g: 0, ang: 40 }], pose: { fh: [14, -20], bh: [10, -16], lean: 4 },
                 onFrame(f, t, g) {
                   if (t < 8) { f.vx = 0; return; }
                   if (t < 18) {
                     let v = f.dir * 5;
                     if (f.grounded && f.plat) { const lim = f.dir > 0 ? f.plat.x2 - 4 : f.plat.x1 + 4; v = f.dir > 0 ? Math.min(v, Math.max(0, lim - f.x)) : Math.max(v, Math.min(0, lim - f.x)); }
                     f.vx = v; if (t % 3 === 0) g.burst(f.x - f.dir * 8, f.y - 4, 1, 'dust');
                   } else f.vx *= 0.7;
                 } },
    },
    // para la Montaña Viviente (ultimates.js): el gólem gigante se dibuja con su propio arte
    STONE, boulder,

    draw(c, f, p, A, frame) {
      const pal = f.pal;
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const sh = [neck[0], neck[1] + 3];
      // brazo y pierna traseros
      pline(c, sh[0] - 4, sh[1], bh[0], bh[1], 4, STONE.dd);
      fist(c, bh[0], bh[1], { main: pal.dark }, false);
      pline(c, hip[0] - 3, hip[1], bf[0], bf[1] - 2, 5, STONE.d);
      rect(c, bf[0] - 4, bf[1] - 2, 7, 3, STONE.dd);
      // torso: gran roca
      const tx = Math.round((hip[0] + neck[0]) / 2) - 9, ty = neck[1] - 1;
      boulder(c, tx, ty, 18, hip[1] - ty + 3, 1);
      // grietas
      px(c, tx + 12, ty + 3, STONE.dd); px(c, tx + 13, ty + 4, STONE.dd); px(c, tx + 13, ty + 5, STONE.dd);
      px(c, tx + 3, ty + 9, STONE.dd); px(c, tx + 4, ty + 10, STONE.dd);
      // núcleo brillante del color del jugador
      const pulse = (frame >> 4) % 2;
      rect(c, tx + 6, ty + 5, 6, 5, pal.dark);
      rect(c, tx + 7, ty + 6, 4, 3, pulse ? pal.light : pal.main);
      px(c, tx + 7, ty + 6, '#ffffff');
      // musgo en los hombros
      for (let i = 0; i < 18; i++) if ((i * 7 + 3) % 5 < 2) { px(c, tx + i, ty - 1, MOSS.m); if (i % 3 === 0) px(c, tx + i, ty - 2, MOSS.l); }
      px(c, tx + 1, ty, MOSS.d); px(c, tx + 15, ty, MOSS.d);
      // pierna delantera
      pline(c, hip[0] + 3, hip[1], ff[0], ff[1] - 2, 5, STONE.m);
      rect(c, ff[0] - 3, ff[1] - 2, 8, 3, STONE.d); rect(c, ff[0] - 3, ff[1] - 2, 8, 1, STONE.l);
      // cabeza hundida entre los hombros
      face(c, hd[0], hd[1], pal, 1, f.st === 'hitstun');
      // brazo delantero
      pline(c, sh[0] + 4, sh[1], fh[0], fh[1], 4, STONE.m);
      pline(c, sh[0] + 4, sh[1] - 1, fh[0], fh[1] - 1, 1, STONE.l);
      fist(c, fh[0], fh[1], pal, true);
    },
    portrait(c, x, y, pal, k) { face(c, x, y, pal, k); },
  });

  // ------------------------------------------------------------
  //  Escena de selección: CUEVA DE CRISTAL
  // ------------------------------------------------------------
  const CAVE = ['#0b0918', '#14112a', '#1d1a3c', '#2b2850', '#3d3a68', '#535082'];
  const CYAN = ['#2fb7d9', '#8ff5ff', '#e6ffff'], VIOLET = ['#7a4fd0', '#c48cff', '#f0e0ff'];
  function crystalAt(c, x, y, h, cols, lean = 0) {
    for (let k = 0; k < h; k++) {
      const w = Math.max(1, Math.round((1 - k / h) * 3)), xx = x + Math.round(lean * k);
      rect(c, xx - w + 1, y - k, w, 1, cols[0]); rect(c, xx + 1, y - k, w, 1, cols[1]);
      if (k % 3 === 1) px(c, xx + 1, y - k, cols[2]);
    }
  }
  const caveCrystals = (W, fy) => [
    [Math.round(W * 0.1), Math.round(fy * 0.62), 12, CYAN, 0.3], [Math.round(W * 0.16), Math.round(fy * 0.72), 7, VIOLET, 0.2],
    [Math.round(W * 0.06), Math.round(fy * 0.8), 9, CYAN, -0.1], [Math.round(W * 0.9), Math.round(fy * 0.55), 13, CYAN, -0.3],
    [Math.round(W * 0.85), Math.round(fy * 0.68), 7, VIOLET, -0.2]];
  CHARACTERS.bloque.scene = {
    base(c, W, H, gy) {
      const fy = gy - 4;
      sceneGrad(c, 0, 0, W, H, ['#06050d', '#0e0b1e', '#17132e', '#1f1a3d']);
      for (let y = 0; y < fy; y++) {
        const t = y / fy;
        const l = Math.round(W * 0.13 + Math.sin(y * 0.09) * 4 + Math.max(0, t - 0.55) * W * 0.25);
        const r = Math.round(W * 0.87 - Math.sin(y * 0.07 + 1) * 5 - Math.max(0, t - 0.6) * W * 0.22);
        for (let x = 0; x < W; x++) if (x < l || x > r) {
          const edge = x < l ? (l - x) / (W * 0.15) : (x - r) / (W * 0.15);
          px(c, x, y, sceneDither(CAVE, 0.75 - edge * 0.5 + (x < l ? 0.1 : -0.05), x, y));
        }
        px(c, l, y, '#535082'); px(c, r, y, '#2b2850');
      }
      for (const f of [0.25, 0.33, 0.43, 0.56, 0.66, 0.76]) {
        const x = Math.round(W * f), h = 8 + Math.round(((f * 97) % 1) * 12);
        for (let k = 0; k < h; k++) { const w = Math.max(1, Math.round((1 - k / h) * 3)); rect(c, x - w, k, w * 2, 1, k > h - 3 ? '#535082' : '#2b2850'); px(c, x - w, k, '#3d3a68'); }
      }
      for (const [x, y, h, cols, lean] of caveCrystals(W, fy)) crystalAt(c, x, y, h, cols, lean);
      sceneGrad(c, 0, fy, W, H - fy, ['#2b2850', '#1d1a3c', '#14112a', '#0b0918']);
      const r = rng(4);
      for (let i = 0; i < W / 8; i++) { const x = r() * W | 0, y = fy + 2 + r() * (H - fy - 4) | 0, s = 1 + r() * 2 | 0; disc(c, x, y, s, '#3d3a68'); px(c, x - 1, y - s, '#535082'); }
    },
    anim(c, W, H, gy, T) {
      const fy = gy - 4, g = 0.5 + 0.5 * Math.sin(T * 0.06);
      for (const [x, y, h, cols] of caveCrystals(W, fy)) {
        if (h < 9) continue;
        for (let a = 0; a < 20; a++) {
          const ang = a / 20 * Math.PI * 2, d = h * 0.8 + (a % 3);
          if ((a + (T >> 3)) % 3 === 0 && g > 0.3) px(c, Math.round(x + 1 + Math.cos(ang) * d), Math.round(y - h / 2 + Math.sin(ang) * d), cols[0]);
        }
      }
      for (let i = 0; i < W / 10; i++) {
        const x = Math.round(W * 0.18 + (i * 23) % (W * 0.64)), y = (T * (0.3 + (i % 3) * 0.15) + i * 31) % fy;
        px(c, x, Math.round(y), i % 2 ? '#6f6ca0' : '#8f8dc0');
      }
    },
    platform(c, cx, gy, T, W) {
      const w = Math.min(74, W - 8), x0 = Math.round(cx - w / 2);
      for (let k = 0; k < 12; k++) {
        const inset = Math.round(Math.pow(k / 11, 1.6) * 10), xa = x0 + inset, wa = w - inset * 2;
        rect(c, xa - 1, gy + k, wa + 2, 1, '#120d24');
        for (let x = xa; x < xa + wa; x++) px(c, x, gy + k, sceneDither(['#2b2850', '#3d3a68', '#535082', '#6f6ca0', '#8f8dc0'], 0.95 - k / 12 - (x - x0) / w * 0.3, x, gy + k));
      }
      rect(c, x0 - 1, gy - 1, w + 2, 1, '#120d24');
      for (let x = x0; x < x0 + w; x++) { px(c, x, gy, '#4fbf55'); if ((x * 7) % 5 < 2) px(c, x, gy - 1, '#a6ec6a'); if ((x * 3) % 7 === 0) px(c, x, gy + 1, '#2a8048'); }
      for (const [x, y] of [[x0 + 18, gy + 4], [x0 + 46, gy + 6]]) { px(c, x, y, '#1d1a36'); px(c, x + 1, y + 1, '#1d1a36'); px(c, x + 1, y + 2, '#1d1a36'); }
    },
  };
})();
