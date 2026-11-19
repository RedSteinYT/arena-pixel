'use strict';
// ============================================================
//  ARMAS: mientras las llevas, tu ataque normal es el del arma
//  (adelante, arriba, abajo, fuerte y en el aire).
// ============================================================
(() => {
  // pose de un arma que barre un arco: ángulo a0 -> a1 y la mano de h0 a h1
  //  (a la escala del luchador)
  function arc(a0, a1, h0, h1, rest = -0.9) {
    return (p, f, k, t) => {
      const m = f.move, z = f.ch.z || 1, end = m.s + m.a;
      let a, u;
      if (t < m.s) { u = t / Math.max(1, m.s); a = lerp(rest, a0, u); p.fh = [lerp(p.fh[0], h0[0] * z, u), lerp(p.fh[1], h0[1] * z, u)]; }
      else if (t < end) { u = (t - m.s + 1) / m.a; a = lerp(a0, a1, u); p.fh = [lerp(h0[0], h1[0], u) * z, lerp(h0[1], h1[1], u) * z]; }
      else { u = (t - end) / Math.max(1, m.e); a = lerp(a1, rest, u * u); p.fh = [lerp(h1[0] * z, p.fh[0], u), lerp(h1[1] * z, p.fh[1], u)]; }
      p.itemA = a;
      if (t >= m.s && t < end) { p.neck[0] += z; p.head[0] += z; }
    };
  }
  const spin = (speed, h) => (p, f, k, t) => { const z = f.ch.z || 1; p.itemA = -0.9 + t * speed; p.fh = [Math.cos(t * speed) * h * z, (-14 + Math.sin(t * speed) * h * 0.6) * z]; };

  // ---------------------------------------------------------- ESPADA LÁSER
  defineItem({
    id: 'sable', name: 'Espada láser', kind: 'weapon', weight: 1.2, uses: 26, rest: -1.0,
    icon(c) {
      rect(c, 7, 10, 2, 5, '#9aa3b8'); rect(c, 7, 12, 2, 1, '#4a5068'); rect(c, 6, 10, 4, 1, '#cfd6e8');
      rect(c, 7, 1, 2, 9, '#5ff2ff'); rect(c, 7, 1, 1, 9, '#e8ffff');
    },
    held(c, x, y, ang, dir, t, f, k) {
      const L = 4 + 14 * k, hum = (t >> 1) % 2;
      along(c, x, y, ang, dir, -3 * k, 3 * k, 2 * k, '#9aa3b8');
      along(c, x, y, ang, dir, 1 * k, 2 * k, 3 * k, '#4a5068');
      along(c, x, y, ang, dir, 4 * k, L, 5 * k, '#5ff2ff', 0.25 + hum * 0.08);   // halo de la hoja
      along(c, x, y, ang, dir, 4 * k, L, 2 * k + 1, '#5ff2ff');
      along(c, x, y, ang, dir, 4 * k, L - 1, k, '#eaffff');
    },
    moves: {
      side:  { s: 3, a: 4, e: 9, sfx: 'saber', pose: arc(-2.3, 0.7, [6, -18], [10, -11], -1.0),
               hit: [{ box: [3, -26, 28, 24], d: 7, b: 2.4, g: 2.6, ang: 40 }] },
      up:    { s: 4, a: 5, e: 10, sfx: 'saber', pose: arc(0.5, -2.7, [8, -12], [2, -22], -1.0),
               hit: [{ box: [-12, -48, 30, 26], d: 8, b: 2.6, g: 2.6, ang: 88 }] },
      down:  { s: 3, a: 4, e: 10, sfx: 'saber', pose: arc(-0.7, 0.4, [6, -10], [10, -7], -1.0),
               hit: [{ box: [-2, -9, 32, 10], d: 6, b: 2.2, g: 2.3, ang: 20 }] },
      smash: { s: 12, a: 4, e: 20, smash: true, sfx: 'saber', pose: arc(-0.15, -0.05, [1, -13], [13, -13], -1.0),
               hit: [{ box: [8, -18, 40, 10], d: 15, b: 4.2, g: 5.6, ang: 35 }] },
      air:   { s: 3, a: 12, e: 8, air: true, sfx: 'saber', pose: spin(0.7, 5),
               hit: [{ box: [-18, -32, 36, 32], d: 3, b: 1.4, g: 0.4, ang: 70, rehit: 4, on: [3, 14] }] },
    },
  });

  // ---------------------------------------------------------- MAZO DE PIEDRA
  const quake = (f, t, g) => {
    const m = f.move;
    if (t !== m.s || !f.grounded) return;
    const z = f.ch.z || 1;
    g.burst(f.x + f.dir * 18 * z, f.y, 10, 'dust'); g.burst(f.x + f.dir * 18 * z, f.y - 2, 4, 'spark', '#7ad8ff');
    g.shake = Math.max(g.shake, 4); Sfx.smashStone();
  };
  defineItem({
    id: 'mazo', name: 'Mazo de piedra', kind: 'weapon', weight: 0.9, uses: 8, heavy: true, rest: -1.25,
    icon(c) {
      rect(c, 7, 6, 2, 9, '#7a4a24'); rect(c, 7, 6, 1, 9, '#a8703c');
      rect(c, 3, 1, 10, 6, '#8a8aa0'); rect(c, 3, 1, 10, 1, '#b8b8cc'); rect(c, 3, 6, 10, 1, '#5a5a70');
      px(c, 7, 3, '#7ad8ff'); px(c, 8, 4, '#7ad8ff');
    },
    held(c, x, y, ang, dir, t, f, k) {
      along(c, x, y, ang, dir, -2 * k, 12 * k, 2 * k, '#7a4a24');
      along(c, x, y, ang, dir, 12 * k, 17 * k, 8 * k, '#5a5a70');
      along(c, x, y, ang, dir, 12 * k, 17 * k, 6 * k, '#8a8aa0');
      const [rx, ry] = alongPt(x, y, ang, dir, 14.5 * k);
      px(c, Math.round(rx), Math.round(ry), '#7ad8ff');
      if (k > 1) px(c, Math.round(rx) + 1, Math.round(ry), '#7ad8ff');
    },
    moves: {
      side:  { s: 16, a: 4, e: 22, sfx: 'whoosh', pose: arc(-2.7, 0.9, [0, -24], [12, -6], -1.25), onFrame: quake,
               hit: [{ box: [4, -36, 28, 38], d: 19, b: 5, g: 5.2, ang: 55 }] },
      smash: { s: 18, a: 4, e: 24, smash: true, sfx: 'whoosh', pose: arc(-2.8, 1.0, [-2, -26], [12, -5], -1.25), onFrame: quake,
               hit: [{ box: [4, -38, 30, 40], d: 24, b: 6, g: 6.2, ang: 52 }] },
      up:    { s: 12, a: 5, e: 20, sfx: 'whoosh', pose: arc(0.9, -2.3, [10, -8], [2, -26], -1.25),
               hit: [{ box: [-10, -52, 30, 32], d: 16, b: 4.6, g: 5, ang: 88 }] },
      air:   { s: 8, a: 6, e: 16, air: true, sfx: 'whoosh', pose: arc(-2.4, 1.3, [2, -22], [8, -4], -1.25),
               hit: [{ box: [-2, -16, 28, 28], d: 14, b: 3.2, g: 3.8, ang: -65 }] },
    },
  });

  // ---------------------------------------------------------- BATE JONRÓN
  const crack = (f, t, g) => {
    if (t === 0) f._crack = false;
    if (f.landedHit && !f._crack) { f._crack = true; Sfx.crack(); g.shake = Math.max(g.shake, 6); }
  };
  defineItem({
    id: 'bate', name: 'Bate jonrón', kind: 'weapon', weight: 1, uses: 10, rest: -1.1,
    icon(c) {
      for (let i = 0; i < 13; i++) { const x = 4 + i * 0.6, w = i < 5 ? 1 : 2; rect(c, Math.round(x), 14 - i, w, 1, i < 4 ? '#8a5a30' : '#e0b880'); }
      px(c, 3, 14, '#5a3418'); px(c, 11, 2, '#fff0d0');
    },
    held(c, x, y, ang, dir, t, f, k) {
      along(c, x, y, ang, dir, -2 * k, 5 * k, 2 * k, '#8a5a30');
      along(c, x, y, ang, dir, 4 * k, 14 * k, 3 * k, '#e0b880');
      along(c, x, y, ang, dir, 4 * k, 14 * k, k, '#fff0d0');
      along(c, x, y, ang, dir, 13 * k, 15 * k, 3 * k, '#b08050');
    },
    moves: {
      side:  { s: 5, a: 3, e: 12, sfx: 'whoosh', pose: arc(-2.0, 0.5, [2, -16], [10, -12], -1.1),
               hit: [{ box: [4, -24, 22, 18], d: 9, b: 3, g: 3.2, ang: 42 }] },
      smash: { s: 14, a: 3, e: 28, smash: true, sfx: 'whoosh', pose: arc(-2.6, 0.4, [-3, -16], [11, -12], -1.1), onFrame: crack,
               hit: [{ box: [6, -24, 26, 18], d: 22, b: 6.5, g: 7.5, ang: 40 }] },
      up:    { s: 5, a: 4, e: 12, sfx: 'whoosh', pose: arc(0.6, -2.5, [9, -10], [2, -22], -1.1),
               hit: [{ box: [-8, -42, 24, 24], d: 8, b: 2.8, g: 3, ang: 85 }] },
      down:  { s: 5, a: 3, e: 12, sfx: 'whoosh', pose: arc(-0.4, 0.9, [7, -10], [10, -5], -1.1),
               hit: [{ box: [0, -9, 26, 10], d: 7, b: 2.6, g: 2.8, ang: 28 }] },
      air:   { s: 4, a: 4, e: 10, air: true, sfx: 'whoosh', pose: arc(-2.0, 0.8, [2, -18], [10, -10], -1.1),
               hit: [{ box: [-4, -28, 28, 22], d: 8, b: 2.8, g: 3, ang: 45 }] },
    },
  });

  // ---------------------------------------------------------- BLÁSTER
  const fire = (f, t, g) => {
    if (t !== f.move.s) return;
    const z = f.ch.z || 1, [hx, hy] = ItemSys.handPos(f);
    g.spawnProjectile(f, { kind: 'laser', silent: true, x: Math.abs(hx - f.x) + 8, y: hy - f.y - 1, vx: 7.5, life: 55, r: 3, h: { d: 5, b: 1.6, g: 1.3, ang: 15 } });
    g.burst(hx + f.dir * 9, hy - 1, 2, 'spark', '#3df2b0');
    Sfx.laser();
  };
  const aim = (p, f, k, t) => { const z = f.ch.z || 1, m = f.move; p.itemA = 0; p.fh = [(t > m.s && t < m.s + 4 ? 8 : 10) * z, -14 * z]; p.bh = [6 * z, -13 * z]; };
  defineItem({
    id: 'blaster', name: 'Bláster', kind: 'weapon', weight: 1, uses: 12, rest: 0.35,
    icon(c) {
      rect(c, 3, 6, 9, 4, '#5a6078'); rect(c, 3, 6, 9, 1, '#8a90a8'); rect(c, 12, 7, 2, 2, '#3df2b0');
      rect(c, 4, 10, 3, 4, '#3a3f55'); px(c, 8, 10, '#3a3f55'); px(c, 6, 7, '#3df2b0');
    },
    held(c, x, y, ang, dir, t, f, k) {
      along(c, x, y, ang, dir, -1 * k, 7 * k, 4 * k, '#5a6078');
      along(c, x, y, ang, dir, 0, 6 * k, k, '#8a90a8');
      along(c, x, y, ang, dir, 7 * k, 9 * k, 2 * k, '#3df2b0');
      const n = f.item ? f.item.uses : 0;                 // carga restante: lucecitas
      for (let i = 0; i < Math.min(4, Math.ceil(n / 3)); i++) { const [lx, ly] = alongPt(x, y, ang, dir, (1 + i * 1.5) * k); px(c, Math.round(lx), Math.round(ly - 2 * k), '#3df2b0'); }
    },
    moves: {
      side: { s: 3, a: 1, e: 10, sfx: false, pose: aim, onFrame: fire, hit: [] },
      air:  { s: 3, a: 1, e: 10, air: true, sfx: false, pose: aim, onFrame: fire, hit: [] },
    },
  });

  // ---------------------------------------------------------- BUMERÁN
  //  El ataque lo lanza: va, vuelve, y si lo atrapas sigue siendo tuyo.
  const shape = (c, x, y, a, k, col, dark) => {
    for (const s of [1, -1]) {
      const ex = x + Math.cos(a + s * 0.9) * 6 * k, ey = y + Math.sin(a + s * 0.9) * 6 * k;
      pline(c, x, y, ex, ey, 2 * k, dark); pline(c, x, y, ex, ey, k, col);
    }
  };
  defineItem({
    id: 'bumeran', name: 'Bumerán', kind: 'weapon', weight: 0.9, uses: 99, rest: -0.5,
    icon(c) { shape(c, 8, 9, -Math.PI / 2, 1, '#ffb040', '#a8461f'); px(c, 8, 9, '#fff0c0'); },
    held(c, x, y, ang, dir, t, f, k) { shape(c, x, y - 2 * k, -Math.PI / 2 - dir * 0.4, k, '#ffb040', '#a8461f'); },
    moves: {
      side: { s: 5, a: 1, e: 12, sfx: 'whoosh', pose: arc(-2.0, 0.2, [0, -18], [10, -14], -0.5), hit: [],
              onFrame: (f, t, g) => { if (t === f.move.s) launch(f, g); } },
    },
    draw(c, it, g) {
      if (it.st !== 'boomer') return;
      const a = it.t * 0.7, k = it.k || 1;
      withAlpha(c, 0.35, () => shape(c, Math.round(it.x - it.vx), Math.round(it.y - it.vy), a - 0.7, k, '#ffb040', '#ffb040'));
      shape(c, Math.round(it.x), Math.round(it.y), a, k, '#ffb040', '#a8461f');
      return true;
    },
    update(it, g) {
      if (it.st !== 'boomer') return;
      const o = it.owner, back = it.t > 26;
      if (!back) { it.vx = it.dir * 6.2 * (1 - it.t / 30) + it.dir * 0.4; it.vy = Math.sin(it.t * 0.12) * 0.6; }
      else {
        const tx = o && o.alive() ? o.x : it.x, ty = o && o.alive() ? o.y - o.S.hh * 0.55 : it.y + 30;
        const dx = tx - it.x, dy = ty - it.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(6.5, 2 + it.t * 0.08);
        it.vx = dx / d * sp; it.vy = dy / d * sp;
        if (o && o.alive() && d < 10) {                       // ¡atrapado!
          if (!o.item) { o.item = { id: 'bumeran', uses: it.uses, t: 0 }; ItemSys.refreshStats(o); Sfx.pickup(); it.dead = true; return false; }
        }
      }
      it.x += it.vx; it.y += it.vy;
      if (it.t % 12 === 0) Sfx.whoosh();
      // golpea a cada rival una vez a la ida y otra a la vuelta
      const r = 6 * (it.k || 1), box = { x: it.x - r, y: it.y - r, w: r * 2, h: r * 2 };
      for (const d of g.fighters) {
        if (d === o || !d.alive() || d.st === 'respawn' || d.invuln > 0 || (o && g.allies(o, d))) continue;
        const key = d.slot + (back ? 'b' : 'a');
        if (it.hit.includes(key) || !boxHit(box, d.hurtbox())) continue;
        it.hit.push(key);
        g.applyHit(o || d, d, { d: 6, b: 2.2, g: 2.6, ang: back ? 135 : 45 }, sgn(it.vx) || 1, 1, it.x, it.y);
        if (o) o.hitlag = 0;
      }
      if (it.t > 150) { it.st = 'fall'; it.owner = null; it.vx *= 0.3; }
      return false;
    },
  });
  function launch(f, g) {
    const held = f.item; if (!held) return;
    const [hx, hy] = ItemSys.handPos(f);
    const it = ItemSys.spawn(g, 'bumeran', hx, hy, { st: 'boomer', owner: f, dir: f.dir, uses: held.uses, hit: [], k: ItemSys.kOf(f) });
    it.t = 0;
    f.item = null; ItemSys.refreshStats(f);
    if (it.uses <= 0) it.uses = 1;
  }
})();
