'use strict';
// ============================================================
//  OBJETOS: aparecen en la arena, se recogen y cambian la pelea
//  · Botón de AGARRE cerca de un objeto = recogerlo.
//  · Con un objeto en la mano, AGARRE = lanzarlo hacia donde apuntes
//    (sin dirección lo deja en el suelo).
//  · Armas: mientras las llevas, el ATAQUE normal es el del arma.
//  · Lanzables: el ataque los lanza.  · Poderes: se activan al tocarlos.
//  Cada objeto está en js/items/<tipo>.js y se registra con defineItem().
// ============================================================
const ITEMS = {}, ITEM_ORDER = [];
//  def: { id, name, kind: 'weapon'|'throw'|'power', weight, uses, heavy,
//         icon(c) (lienzo 16x16, pies en (8,15)), held(c, x, y, ang, dir, t, f, k),
//         rest (ángulo en reposo), moves: { side, up, down, smash, air }  (como los ataques),
//         throwHit, onThrowHit(it, d, g), onLand(it, g), update(it, g), apply(f, g) (poderes) }
function defineItem(def) {
  ITEMS[def.id] = def; ITEM_ORDER.push(def.id);
  def.weight = def.weight ?? 1;
  for (const k in def.moves || {}) { const m = def.moves[k]; m.item = def.id; m.hit = m.hit || []; m.key = 'I:' + def.id + '.' + k; }
}

// ---------- ayudas de dibujo para armas en la mano (líneas de píxeles según el ángulo) ----------
function along(c, x, y, ang, dir, from, to, w, col, a) {
  const ca = Math.cos(ang) * dir, sa = Math.sin(ang);
  withAlpha(c, a, () => pline(c, x + ca * from, y + sa * from, x + ca * to, y + sa * to, w, col));
}
function alongPt(x, y, ang, dir, d) { return [x + Math.cos(ang) * dir * d, y + Math.sin(ang) * d]; }

const BUFF_TIME = { star: 480, speed: 600, wings: 600, power: 600, bubble: 900 };
const BUFF_NAMES = { star: 'INVENCIBLE', speed: 'VELOCIDAD', wings: 'ALAS', power: 'FUEGO', bubble: 'BURBUJA' };

const ItemSys = (() => {
  const iconCache = {};
  function icon(id) {
    if (iconCache[id]) return iconCache[id];
    const cv = mkCanvas(16, 16), c = cv.getContext('2d');
    ITEMS[id].icon(c);
    // contorno de 1 px, como los luchadores
    const out = mkCanvas(18, 18), o = out.getContext('2d');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.drawImage(cv, 1 + dx, 1 + dy);
    o.globalCompositeOperation = 'source-in'; o.fillStyle = OUTLINE; o.fillRect(0, 0, 18, 18);
    o.globalCompositeOperation = 'source-over'; o.drawImage(cv, 1, 1);
    return (iconCache[id] = out);
  }
  const zOf = f => f.ch.z || 1;
  const kOf = f => (zOf(f) > 1.6 ? 2 : 1);             // los gigantes llevan los objetos al doble
  // ---------- aparición ----------
  function pickType(g) {
    const ids = ITEM_ORDER.filter(id => !g.cfg.itemList || g.cfg.itemList.includes(id));
    let tot = 0; for (const id of ids) tot += ITEMS[id].weight;
    let r = Math.random() * tot;
    for (const id of ids) { r -= ITEMS[id].weight; if (r <= 0) return id; }
    return ids[0];
  }
  function spawn(g, id, x, y, extra) {
    const def = ITEMS[id];
    const it = Object.assign({ id, x, y, vx: 0, vy: 0, st: 'fall', t: 0, life: 1200, uses: def.uses ?? 1, owner: null, plat: null }, extra || {});
    g.items.push(it);
    return it;
  }
  function spawnRandom(g) {
    const surfs = [STAGE.main, ...STAGE.plats];
    for (let tries = 0; tries < 8; tries++) {
      const s = surfs[Math.random() * surfs.length | 0];
      const x = s.x1 + 12 + Math.random() * Math.max(1, s.x2 - s.x1 - 24);
      if (g.items.some(o => Math.abs(o.x - x) < 24 && Math.abs(o.y - s.y) < 30)) continue;
      const it = spawn(g, pickType(g), x, s.y - 70);
      it.appear = 30;
      for (let i = 0; i < 10; i++) g.fx.push({ kind: 'part', ptype: 'star', x: x + (Math.random() * 20 - 10), y: it.y - Math.random() * 14, vx: (Math.random() - 0.5) * 0.6, vy: -0.3, t: 0, life: 26, size: 1, col: '#fff6b0' });
      Sfx.appear();
      return it;
    }
  }

  // ---------- recoger / lanzar ----------
  function near(f, g) {
    let best = null, bd = 1e9;
    for (const it of g.items) {
      if (it.st !== 'ground' && it.st !== 'fall') continue;
      if (ITEMS[it.id].kind === 'power') continue;
      const dx = Math.abs(it.x - f.x), dy = it.y - f.y;
      if (dx < f.S.hw + 12 && dy > -f.S.hh - 6 && dy < 10 && dx < bd) { bd = dx; best = it; }
    }
    return best;
  }
  function pick(f, it, g) {
    g.items.splice(g.items.indexOf(it), 1);
    f.item = { id: it.id, uses: it.uses, t: 0 };
    refreshStats(f);
    g.burst(it.x, it.y - 4, 4, 'star', '#ffffff');
    Sfx.pickup();
  }
  // ¿qué hace el botón de agarre? (true = lo ha usado para un objeto)
  function grabButton(f, g) {
    if (f.item) { throwItem(f, g); return true; }
    const it = near(f, g);
    if (it) { pick(f, it, g); return true; }
    return false;
  }
  function handPos(f) {
    const p = f._pose, z = zOf(f);
    const hx = p ? p.fh[0] : 7 * z, hy = p ? p.fh[1] : -13 * z;
    return [f.x + f.dir * hx, f.y + hy];
  }
  function throwItem(f, g, forceDir) {
    const held = f.item; if (!held) return;
    const def = ITEMS[held.id], I = f.inp;
    let dx = 0, dy = 0;
    if (forceDir) { dx = forceDir; }
    else if (I.my < -0.5 && Math.abs(I.my) >= Math.abs(I.mx)) dy = -1;
    else if (I.my > 0.5 && Math.abs(I.my) >= Math.abs(I.mx)) dy = 1;
    else if (Math.abs(I.mx) > 0.4) dx = sgn(I.mx);
    const [hx, hy] = handPos(f);
    const it = spawn(g, held.id, hx, hy, { uses: held.uses, owner: f, life: 1200 });
    f.item = null; refreshStats(f);
    if (!dx && !dy) {                                     // sin dirección: dejarlo con cuidado delante
      it.vx = f.dir * 0.45; it.vy = -1.5; it.st = 'fall'; it.owner = null; Sfx.pickup(); return;
    }
    if (dx) f.dir = dx;
    const pow = def.heavy ? 0.7 : 1;
    if (dy < 0) { it.vx = f.vx * 0.3; it.vy = -8 * pow; }
    else if (dy > 0) { it.vx = 0; it.vy = f.grounded ? -2 : 7; }
    else { it.vx = dx * 7 * pow; it.vy = -1.6; }
    it.st = 'thrown'; it.t = 0; it.spin = dx || f.dir;
    if (def.onThrow) def.onThrow(it, f, g);
    f.setSt(f.grounded ? 'landing' : f.st === 'helpless' ? 'helpless' : 'air'); f.lag = 8;
    g.burst(hx, hy, 3, 'dust');
    Sfx.toss();
  }

  // ---------- mejoras (poderes) ----------
  function refreshStats(f) {
    if (!f.baseS) f.baseS = Object.assign({}, f.S);
    const S = Object.assign({}, f.baseS), B = f.buffs || {};
    if (B.speed > 0) { S.walk *= 1.6; S.airSpd *= 1.35; S.gAcc *= 1.6; S.aAcc *= 1.4; }
    if (B.wings > 0) { S.jumps += 3; S.grav *= 0.82; S.maxFall *= 0.8; S.djumpV *= 1.08; }
    if (f.item && ITEMS[f.item.id].heavy) { S.walk *= 0.72; S.airSpd *= 0.8; S.jumpV *= 0.86; S.djumpV *= 0.86; }
    f.S = S;
  }
  function giveBuff(f, k, g) {
    f.buffs = f.buffs || {};
    const had = f.buffs[k] > 0;
    f.buffs[k] = BUFF_TIME[k];
    if (k === 'bubble') f.buffs.bubbleHits = 3;
    if (k === 'wings' && !had) f.jumps += 3;
    refreshStats(f);
  }
  function stepFighter(f, g) {
    const B = f.buffs;
    if (B) {
      let changed = false;
      for (const k in BUFF_TIME) if (B[k] > 0 && --B[k] <= 0) { changed = true; if (k === 'bubble') B.bubbleHits = 0; }
      if (changed) refreshStats(f);
      if (B.power > 0 && g.frame % 3 === 0) g.burst(f.x + (Math.random() * 2 - 1) * f.S.hw, f.y - Math.random() * f.S.hh, 1, 'fire');
      if (B.speed > 0 && Math.abs(f.vx) > 2 && g.frame % 2 === 0) g.fx.push({ kind: 'part', ptype: 'spark', x: f.x - f.dir * 4, y: f.y - Math.random() * f.S.hh, vx: -f.vx * 0.2, vy: 0, t: 0, life: 10, size: 1, col: '#ffe066' });
    }
    if (f.frozen > 0) f.frozen--;
    if (f.item) {
      f.item.t++;
      const def = ITEMS[f.item.id];
      if (def.whileHeld) def.whileHeld(f, g);
      if (f.item.uses <= 0 && f.st !== 'attack') {          // se ha gastado: se rompe
        const [hx, hy] = handPos(f);
        g.burst(hx, hy, 8, 'spark', '#cfd8ff'); f.item = null; refreshStats(f); Sfx.brk();
      }
    }
  }
  // al recibir un golpe: la burbuja lo para
  function absorbs(d, g, hx, hy) {
    const B = d.buffs; if (!B) return false;
    if (B.star > 0) { g.spark(hx, hy, 6, '#ffffff'); return true; }
    if (B.bubble > 0 && B.bubbleHits > 0) {
      B.bubbleHits--; if (B.bubbleHits <= 0) { B.bubble = 0; g.burst(d.x, d.y - d.S.hh / 2, 12, 'spark', '#9fe8ff'); Sfx.brk(); }
      else { g.spark(hx, hy, 8, '#9fe8ff'); Sfx.shield(); }
      return true;
    }
    return false;
  }
  function onKO(f) { f.item = null; f.buffs = {}; f.frozen = 0; refreshStats(f); }

  // ---------- un paso de simulación ----------
  function step(g) {
    if (g.itemsOn && g.phase === 'play') {
      if (--g.itemT <= 0) {
        g.itemT = 420 + (Math.random() * 360 | 0);         // cada 7-13 s
        if (g.items.filter(o => o.st !== 'thrown').length < 3) spawnRandom(g);
      }
    }
    const M = STAGE.main, B = STAGE.blast;
    for (const it of g.items) {
      const def = ITEMS[it.id];
      it.t++;
      if (it.appear > 0) it.appear--;
      if (def.update && def.update(it, g) === false) continue;
      if (it.st === 'fall' || it.st === 'thrown') {
        const oy = it.y;
        it.vy = Math.min(it.vy + (it.st === 'thrown' ? 0.32 : 0.25), 6);
        it.x += it.vx; it.y += it.vy;
        if (it.st === 'fall') it.vx *= 0.96;
        // tocar el suelo o una plataforma
        if (it.vy >= 0) {
          const s = surfaceBelow(it.x, oy);
          if (s && it.y >= s.y && oy <= s.y + 1) {
            it.y = s.y; it.plat = s;
            if (it.st === 'thrown' && def.onLand && def.onLand(it, g) === false) continue;
            if (it.st === 'thrown' && Math.abs(it.vx) > 2) { it.vy = -2; it.vx *= 0.5; }    // rebota una vez
            else { it.st = 'ground'; it.vx = 0; it.vy = 0; it.owner = null; it.t = 0; g.burst(it.x, it.y, 2, 'dust'); }
          }
        }
        // chocar contra el lateral del escenario
        if (it.y > M.y + 2 && it.y < M.bottom && it.x > M.x1 && it.x < M.x2) { it.vx = -it.vx * 0.4; it.x = it.x < (M.x1 + M.x2) / 2 ? M.x1 - 1 : M.x2 + 1; }
        if (it.st === 'thrown') hitWithThrown(it, def, g);
      } else if (it.st === 'ground') {
        if (it.plat) {                                    // pegado a su plataforma (aunque se mueva)
          it.y = it.plat.y;
          if (it.x < it.plat.x1 - 1 || it.x > it.plat.x2 + 1) { it.st = 'fall'; it.plat = null; }
        }
        it.life--;
      }
      if (it.life <= 0 || it.y > B.b || it.x < B.l || it.x > B.r) it.dead = true;
    }
    // poderes: se activan al tocarlos
    for (const it of g.items) {
      if (it.dead || ITEMS[it.id].kind !== 'power' || it.st === 'thrown' || it.appear > 10) continue;
      for (const f of g.fighters) {
        if (!f.alive() || f.st === 'respawn' || f.st === 'grabbed') continue;
        if (Math.abs(f.x - it.x) < f.S.hw + 7 && it.y > f.y - f.S.hh - 8 && it.y < f.y + 8) {
          ITEMS[it.id].apply(f, g); it.dead = true;
          for (let i = 0; i < 12; i++) g.fx.push({ kind: 'part', ptype: 'star', x: f.x + (Math.random() * 16 - 8), y: f.y - Math.random() * f.S.hh, vx: (Math.random() - 0.5), vy: -0.6 - Math.random(), t: 0, life: 24, size: 1, col: ITEMS[it.id].color || '#fff' });
          break;
        }
      }
    }
    g.items = g.items.filter(o => !o.dead);
    for (const f of g.fighters) if (f.alive()) stepFighter(f, g);
  }
  // un objeto lanzado golpea a quien toca
  function hitWithThrown(it, def, g) {
    if (it.t < 2 && it.owner) return;
    const r = (def.size || 6), box = { x: it.x - r, y: it.y - r * 2, w: r * 2, h: r * 2 };
    for (const d of g.fighters) {
      if (d === it.owner && it.t < 30) continue;
      if (!d.alive() || d.st === 'respawn' || d.invuln > 0 || (it.owner && g.allies(it.owner, d) && d !== it.owner)) continue;
      if (!boxHit(box, d.hurtbox())) continue;
      if (def.onThrowHit && def.onThrowHit(it, d, g) === false) return;
      const h = def.throwHit || { d: 8, b: 3, g: 3.2, ang: 40 };
      g.applyHit(it.owner || d, d, h, sgn(it.vx) || 1, 1, it.x, it.y - r);
      if (it.owner) it.owner.hitlag = 0;
      it.vx = -it.vx * 0.3; it.vy = -2.5; it.st = 'fall'; it.owner = null;
      if (def.breakOnHit) it.dead = true;
      return;
    }
  }

  // ---------- dibujo ----------
  function drawGround(c, g) {
    for (const it of g.items) {
      const def = ITEMS[it.id];
      if (it.life < 180 && (it.t >> 2) % 2) continue;        // parpadea antes de desaparecer
      if (def.draw && def.draw(c, it, g) !== undefined) continue;
      const ic = icon(it.id), power = def.kind === 'power';
      const bob = power ? Math.round(Math.sin((g.frame + it.x) * 0.08) * 2) - 3 : 0;
      if (it.st === 'ground') shadow(c, it.x, it.y, 6, 0.3);
      if (power) glow(c, it.x, it.y - 9 + bob, 12, def.color || '#ffffff', 0.25 + 0.08 * Math.sin(g.frame * 0.15), 3);
      if (it.st === 'thrown' && !def.noSpin) {
        c.save(); c.translate(Math.round(it.x), Math.round(it.y - 8)); c.rotate(Math.round(it.t * 0.5 * it.spin / (Math.PI / 4)) * (Math.PI / 4));
        c.drawImage(ic, -9, -9); c.restore();
      } else c.drawImage(ic, Math.round(it.x - 9), Math.round(it.y - 17 + bob));
      if (it.appear > 0) withAlpha(c, it.appear / 30, () => ring(c, Math.round(it.x), Math.round(it.y - 8), Math.round(14 - it.appear * 0.3), '#fff6b0'));
    }
  }
  // objeto en la mano (tras dibujar al luchador)
  function drawHeld(c, f, g) {
    if (!f.item || !f.alive() || f.st === 'respawn') return;
    if (f.ch.handProp && f.st === 'attack' && f.move && !f.move.item) return;   // durante su propio golpe se ve lo suyo, no el objeto
    const def = ITEMS[f.item.id], [hx, hy] = handPos(f);
    const p = f._pose, ang = p && p.itemA != null ? p.itemA : (def.rest ?? -0.9);
    if (f.hidden) return;
    if (def.held) def.held(c, Math.round(hx), Math.round(hy), ang, f.dir, g.frame, f, kOf(f));
    else { const ic = icon(f.item.id); c.drawImage(ic, Math.round(hx - 9), Math.round(hy - 12)); }
  }
  // auras de los poderes
  function drawBuffs(c, f, g) {
    const B = f.buffs; if (!B || !f.alive() || f.st === 'respawn') return;
    const cx = f.x, cy = f.y - f.S.hh / 2, T = g.frame;
    if (B.star > 0) {
      const cols = ['#ff5a5a', '#ffd34a', '#5ee08a', '#5aa0ff', '#c48cff'];
      glow(c, cx, cy, f.S.hh * 0.8 + 6, cols[(T >> 2) % cols.length], 0.3, 3);
      if (T % 2 === 0) g.fx.push({ kind: 'part', ptype: 'star', x: cx + (Math.random() * 2 - 1) * f.S.hw * 1.5, y: cy + (Math.random() * 2 - 1) * f.S.hh * 0.6, vx: 0, vy: -0.3, t: 0, life: 14, size: 1, col: cols[T % cols.length] });
    }
    if (B.bubble > 0 && B.bubbleHits > 0) {
      const r = Math.round(f.S.hh * 0.62 + 6 + Math.sin(T * 0.1));
      withAlpha(c, 0.18, () => disc(c, Math.round(cx), Math.round(cy), r, '#9fe8ff'));
      withAlpha(c, 0.7, () => ring(c, Math.round(cx), Math.round(cy), r, '#dff8ff'));
      px(c, Math.round(cx - r * 0.45), Math.round(cy - r * 0.55), '#ffffff');
      for (let i = 0; i < B.bubbleHits; i++) px(c, Math.round(cx - 2 + i * 2), Math.round(cy - r - 3), '#9fe8ff');
    }
    if (B.wings > 0) {
      const flap = Math.round(Math.sin(T * (f.grounded ? 0.1 : 0.4)) * 3), bx = cx - f.dir * (f.S.hw - 1), by = f.y - f.S.hh * 0.72;
      for (const s of [1, 0.6]) {
        pline(c, bx, by, bx - f.dir * 10 * s, by - 6 - flap, 2, '#ffffff');
        pline(c, bx, by + 2, bx - f.dir * 9 * s, by + 1 - flap, 2, '#dfe8ff');
        pline(c, bx, by + 4, bx - f.dir * 7 * s, by + 5 - flap, 1, '#b8c8f0');
      }
    }
    if (B.power > 0) glow(c, cx, cy, f.S.hh * 0.7 + 4, '#ff6a20', 0.18 + 0.06 * Math.sin(T * 0.3), 3);
    if (f.frozen > 0) {
      const w = f.S.hw * 2 + 6, h = f.S.hh + 6, x0 = Math.round(f.x - w / 2), y0 = Math.round(f.y - h + 2);
      rect(c, x0, y0, w, h, '#bfe8ff', 0.45); rect(c, x0, y0, w, 1, '#ffffff', 0.9); rect(c, x0, y0, 1, h, '#ffffff', 0.6);
      pline(c, x0 + 3, y0 + 4, x0 + 7, y0 + 10, 1, '#ffffff');
    }
  }
  // indicador en el marcador: objeto en la mano y poderes activos
  function drawHud(c, f, x, y) {
    let ox = x;
    if (f.item) { c.drawImage(icon(f.item.id), ox, y); ox += 17; }
    const B = f.buffs || {};
    for (const k of ['star', 'speed', 'wings', 'power', 'bubble']) {
      if (!(B[k] > 0)) continue;
      const id = { star: 'cristal', speed: 'botas', wings: 'alas', power: 'aura', bubble: 'burbuja' }[k];
      if (B[k] < 120 && (B[k] >> 3) % 2) { ox += 12; continue; }
      if (ITEMS[id]) { c.save(); c.globalAlpha = 0.95; c.drawImage(icon(id), 0, 0, 18, 18, ox, y + 4, 12, 12); c.restore(); }
      ox += 12;
    }
  }

  // ---------- movimientos del arma para el ataque actual ----------
  function weaponMove(f, kind) {
    if (!f.item) return null;
    const def = ITEMS[f.item.id];
    if (def.kind !== 'weapon' || !def.moves) return null;
    const M = def.moves;
    return M[kind] || (kind === 'smash' ? M.side : null) || (kind === 'air' ? M.side : null) || M.side;
  }

  return { spawn, spawnRandom, near, pick, grabButton, throwItem, step, drawGround, drawHeld, drawBuffs, drawHud, weaponMove,
    refreshStats, giveBuff, absorbs, onKO, icon, kOf, zOf, handPos };
})();
