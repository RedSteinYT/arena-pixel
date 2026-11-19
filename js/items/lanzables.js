'use strict';
// ============================================================
//  LANZABLES: el ataque (o el agarre con dirección) los lanza
// ============================================================
(() => {
  // ---------------------------------------------------------- BOMBA
  //  Explota al chocar. ¡Y si la sostienes demasiado, en tu mano!
  function explode(g, x, y, owner) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
      g.fx.push({ kind: 'part', ptype: i % 3 ? 'fire' : 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, t: 0, life: 16 + Math.random() * 16, size: 1 + (Math.random() < 0.4 ? 1 : 0), col: '#ffd34a' });
    }
    g.burst(x, y, 6, 'smoke');
    g.spark(x, y, 26, '#ffd34a'); g.spark(x, y, 16, '#ffffff');
    g.shake = Math.max(g.shake, 9); Sfx.boom();
    for (const d of g.fighters) {
      if (!d.alive() || d.st === 'respawn' || d.invuln > 0) continue;
      const cx = d.x, cy = d.y - d.S.hh / 2;
      if (Math.hypot(cx - x, (cy - y) * 1.2) > 30 + d.S.hw) continue;
      g.applyHit(owner || d, d, { d: 16, b: 4.4, g: 5.2, ang: 62 }, sgn(cx - x) || 1, 1, cx, cy);
      if (owner) owner.hitlag = 0;
    }
  }
  defineItem({
    id: 'bomba', name: 'Bomba', kind: 'throw', weight: 1.1, size: 5,
    icon(c) {
      disc(c, 8, 10, 5, '#2a2440'); disc(c, 7, 9, 2, '#5a5078'); px(c, 6, 8, '#9a90c0');
      rect(c, 8, 3, 2, 3, '#8a7a60'); px(c, 10, 2, '#ffd34a'); px(c, 11, 1, '#ff6a20');
    },
    held(c, x, y, ang, dir, t, f, k) {
      const ic = ItemSys.icon('bomba'), late = f.item && f.item.t > 420;
      c.drawImage(ic, 0, 0, 18, 18, Math.round(x - 9 * k), Math.round(y - 13 * k), 18 * k, 18 * k);
      if (late && (t >> 2) % 2) withAlpha(c, 0.55, () => disc(c, x, y - 4 * k, 5 * k, '#ff3020'));
      if (t % 3 === 0) px(c, x + 2 * k, y - 12 * k, '#ffd34a');
    },
    whileHeld(f, g) {                                    // la mecha se consume
      if (f.item.t > 600) { const [hx, hy] = ItemSys.handPos(f); f.item = null; ItemSys.refreshStats(f); explode(g, hx, hy, null); }
    },
    onLand(it, g) { if (it.owner || it.t > 2) { explode(g, it.x, it.y - 4, it.owner); it.dead = true; return false; } },
    onThrowHit(it, d, g) { explode(g, it.x, it.y - 4, it.owner); it.dead = true; return false; },
    update(it, g) { if (it.st === 'thrown' && it.t > 90) { explode(g, it.x, it.y - 4, it.owner); it.dead = true; return false; } },
  });

  // ---------------------------------------------------------- BLOQUE DE HIELO
  //  Lanzado se desliza por el suelo y congela a quien toque.
  function freeze(g, it, d) {
    g.applyHit(it.owner || d, d, { d: 7, b: 1.6, g: 1.2, ang: 30 }, sgn(it.vx) || 1, 1, d.x, d.y - d.S.hh / 2);
    if (d.st === 'hitstun') { d.stun = Math.max(d.stun, 70); d.frozen = 70; d.lvx *= 0.35; d.lvy *= 0.35; }
    if (it.owner) it.owner.hitlag = 0;
    shatter(g, it);
    Sfx.freeze();
  }
  function shatter(g, it) {
    it.dead = true;
    for (let i = 0; i < 14; i++) g.fx.push({ kind: 'part', ptype: 'spark', x: it.x + (Math.random() * 10 - 5), y: it.y - 5, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, t: 0, life: 18, size: 1 + (i % 2), col: i % 3 ? '#bfe8ff' : '#ffffff' });
    Sfx.brk();
  }
  defineItem({
    id: 'hielo', name: 'Bloque de hielo', kind: 'throw', weight: 0.9, size: 7, noSpin: true,
    icon(c) {
      rect(c, 2, 5, 12, 10, '#7ab8e8'); rect(c, 2, 5, 12, 1, '#e6f8ff'); rect(c, 2, 5, 1, 10, '#bfe8ff');
      rect(c, 3, 6, 4, 3, '#bfe8ff'); px(c, 11, 12, '#4a88c8'); rect(c, 2, 14, 12, 1, '#4a88c8');
      pline(c, 8, 8, 11, 11, 1, '#e6f8ff');
    },
    held(c, x, y, ang, dir, t, f, k) { const ic = ItemSys.icon('hielo'); c.drawImage(ic, 0, 0, 18, 18, Math.round(x - 9 * k), Math.round(y - 15 * k), 18 * k, 18 * k); },
    onThrowHit(it, d, g) { freeze(g, it, d); return false; },
    onLand(it, g) {                                       // al caer lanzado: a deslizarse
      if (!it.owner) return;
      it.st = 'slide'; it.vx = (sgn(it.vx) || it.spin || 1) * 5.2; it.vy = 0; it.t = 0;
      return false;
    },
    update(it, g) {
      if (it.st !== 'slide') return;
      it.x += it.vx; it.vx *= 0.992;
      if (it.plat) {
        it.y = it.plat.y;
        if (it.x < it.plat.x1 - 1 || it.x > it.plat.x2 + 1) { it.st = 'fall'; it.plat = null; it.owner = null; return; }
      }
      if (it.t % 3 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: it.x - sgn(it.vx) * 6, y: it.y - 1, vx: -it.vx * 0.15, vy: -0.4, t: 0, life: 10, size: 1, col: '#e6f8ff' });
      const box = { x: it.x - 7, y: it.y - 12, w: 14, h: 12 };
      for (const d of g.fighters) {
        if (d === it.owner && it.t < 40) continue;
        if (!d.alive() || d.st === 'respawn' || d.invuln > 0 || (it.owner && d !== it.owner && g.allies(it.owner, d))) continue;
        if (boxHit(box, d.hurtbox())) { freeze(g, it, d); return false; }
      }
      if (Math.abs(it.vx) < 1 || it.t > 160) { shatter(g, it); return false; }
      return false;
    },
  });

  // ---------------------------------------------------------- CAJA SORPRESA
  //  Pesa, golpea fuerte y al romperse puede soltar otro objeto.
  function breakCrate(g, it) {
    it.dead = true;
    for (let i = 0; i < 12; i++) g.fx.push({ kind: 'part', ptype: 'dust', x: it.x + (Math.random() * 12 - 6), y: it.y - 6, vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 2, t: 0, life: 22, size: 2 });
    g.burst(it.x, it.y - 6, 6, 'spark', '#e0b070');
    Sfx.brk();
    if (Math.random() < 0.55) {
      const pool = ITEM_ORDER.filter(id => id !== 'caja');
      const n = ItemSys.spawn(g, pool[Math.random() * pool.length | 0], it.x, it.y - 10, { vy: -4, appear: 20 });
      n.vx = (Math.random() - 0.5) * 2;
    }
  }
  defineItem({
    id: 'caja', name: 'Caja sorpresa', kind: 'throw', weight: 0.8, size: 8, heavy: true, noSpin: true,
    throwHit: { d: 14, b: 4, g: 4.4, ang: 45 },
    icon(c) {
      rect(c, 1, 3, 14, 12, '#a8703c'); rect(c, 1, 3, 14, 1, '#d8a060'); rect(c, 1, 14, 14, 1, '#5a3418');
      rect(c, 1, 3, 1, 12, '#d8a060'); rect(c, 14, 3, 1, 12, '#5a3418');
      pline(c, 2, 4, 13, 13, 1, '#7a4a24'); pline(c, 13, 4, 2, 13, 1, '#7a4a24');
      rect(c, 6, 7, 4, 4, '#ffd34a'); px(c, 7, 8, '#fff6b0');
    },
    held(c, x, y, ang, dir, t, f, k) { const ic = ItemSys.icon('caja'); c.drawImage(ic, 0, 0, 18, 18, Math.round(x - 9 * k), Math.round(y - 17 * k), 18 * k, 18 * k); },
    onThrowHit(it, d, g) {
      g.applyHit(it.owner || d, d, this.throwHit, sgn(it.vx) || 1, 1, it.x, it.y - 8);
      if (it.owner) it.owner.hitlag = 0;
      breakCrate(g, it); return false;
    },
    onLand(it, g) { if (it.owner) { breakCrate(g, it); return false; } },
  });
})();
