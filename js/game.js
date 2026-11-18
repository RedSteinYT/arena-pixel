'use strict';
// ============================================================
//  Partida: reglas, golpes, KOs, cámara y dibujo
// ============================================================


function fullName(f) { return (f.cpu ? 'CPU ' + f.pal.name.toUpperCase() : f.label) + ' · ' + f.ch.name.toUpperCase(); }

class Game {
  constructor(cfg) {
    // cfg: { players: [{device, pal, team, num}], teams: bool, stocks }
    this.cfg = cfg;
    this.stage = buildStage(cfg.stage);
    STAGE = this.stage;
    this.teams = cfg.teams;
    this.fighters = cfg.players.map((p, i) => new Fighter(i, p, cfg.stocks));
    this.projectiles = [];
    this.fx = [];
    this.frame = 0;
    this.phase = 'count';        // count -> play -> end
    this.phaseT = 0;
    this.shake = 0;
    this.slow = 0;
    this.placing = [];           // orden de eliminación
    this.cloudX = 0;
  }

  allies(a, b) { return this.teams && a.team === b.team; }
  sideOf(f) { return this.teams ? 'T' + f.team : 'P' + f.slot; }

  // ---------- un paso de simulación (1/60 s) ----------
  step(inputs) {
    STAGE = this.stage;
    this.frame++; this.phaseT++;
    this.cloudX += 0.12;
    stepStage(this.stage, this);
    if (this.slow > 0) { this.slow--; if (this.slow % 3 !== 0) { this.stepFx(); return; } }

    const canAct = this.phase === 'play' || this.phase === 'end';
    for (const f of this.fighters) {
      if (f.out) continue;
      let inp = blankInput();
      if (canAct && this.phase !== 'end') inp = f.cpu ? aiInput(f, this) : (inputs[f.device] || blankInput());
      f.takeInput(inp);
      f.update(this);
    }
    this.hitDetection();
    this.stepProjectiles();
    this.checkBlast();
    this.stepFx();
    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.3) this.shake = 0;

    if (this.phase === 'count') {
      if (this.phaseT % 60 === 1 && this.phaseT < 180) Sfx.count(false);
      if (this.phaseT >= 180) { this.phase = 'play'; this.phaseT = 0; Sfx.count(true); }
    }
    if (this.phase === 'play') {
      const sides = new Set(this.fighters.filter(f => !f.out).map(f => this.sideOf(f)));
      if (sides.size <= 1) { this.phase = 'end'; this.phaseT = 0; this.slow = 45; }
    }
  }

  // ---------- golpes ----------
  hitDetection() {
    for (const a of this.fighters) {
      if (!a.alive()) continue;
      for (const hb of a.activeHits()) {
        for (const d of this.fighters) {
          if (d === a || !d.alive() || d.st === 'respawn' || d.st === 'grabbed' || d.invuln > 0 || this.allies(a, d)) continue;
          const key = d.slot + '|' + hb.key;
          if (a.hitSet.has(key)) continue;
          if (!boxHit(hb, d.hurtbox())) continue;
          if (hb.h0.grab) {
            if (a.holding || d.st === 'ledge' || d.heldBy || a.st !== 'attack') continue;
            if (d.S.giant && !a.S.giant) {               // demasiado grande para levantarlo
              a.hitSet.add(key);
              if (!a.grabFail) {
                a.grabFail = true;
                this.spark((Math.max(hb.x, d.x - d.S.hw) + Math.min(hb.x + hb.w, d.x + d.S.hw)) / 2, d.y - d.S.hh * 0.55, 5, '#9fb4c8');
                a.lvx = -a.dir * 2.2; Sfx.shield();
              }
              continue;
            }
            this.grab(a, d); continue;
          }
          a.hitSet.add(key);
          let dirSign = a.dir;
          if (hb.h0.away) dirSign = sgn(d.x - a.x) || a.dir;
          const cx = (Math.max(hb.x, d.x - d.S.hw) + Math.min(hb.x + hb.w, d.x + d.S.hw)) / 2;
          const cy = (Math.max(hb.y, d.y - d.S.hh) + Math.min(hb.y + hb.h, d.y)) / 2;
          this.applyHit(a, d, hb.h0, dirSign, hb.mult, cx, cy);
        }
      }
    }
  }

  grab(a, d) {
    a.holding = d; d.heldBy = a; a.move = null; a.setSt('hold');
    if (d.holding) d.releaseHeld();
    d.move = null; d.setSt('grabbed'); d.mash = 0;
    d.vx = d.vy = d.lvx = d.lvy = 0; d.grounded = false; d.plat = null; d.ff = false;
    a.placeHeld();
    this.spark(d.x, d.y - d.S.hh * 0.5, 7, '#ffffff');
    Sfx.grab();
  }
  throwHit(a, v, h) {
    a.holding = null; v.heldBy = null;
    v.setSt('air'); v.invuln = 0;
    this.applyHit(a, v, h, a.dir, 1, v.x, v.y - v.S.hh * 0.5);
  }

  applyHit(a, d, h, dirSign, mult, hx, hy) {
    const dmg = Math.round(h.d * mult);
    a.landedHit = true; a.landedAt = a.t;
    if (d.holding) d.releaseHeld(1.5);
    if (d.st === 'shield') {
      d.shieldHP -= dmg * 1.4;
      d.vx = dirSign * Math.min(3, 0.6 + dmg * 0.2);
      a.hitlag = d.hitlag = 3 + (dmg / 4 | 0);
      this.spark(hx, hy, 6 + dmg / 2, d.pal.light);
      Sfx.shield();
      if (d.shieldHP <= 0) d.breakShield(this);
      return;
    }
    d.dmg = Math.min(999, d.dmg + dmg);
    if (h.burn) d.burn = Math.max(d.burn || 0, h.burn);        // quemadura
    a.dealt += dmg;
    let kb = (h.b + h.g * (d.dmg / 100)) * (1 + (mult - 1) * 0.6);
    kb *= 200 / (100 + d.S.weight);           // peso: los pesados vuelan menos
    kb = Math.min(kb, 22);
    const ang = h.ang * Math.PI / 180;
    let lx = Math.cos(ang) * kb * dirSign, ly = -Math.sin(ang) * kb;
    if (d.grounded && ly > 0) { ly = -ly * 0.6; }                 // golpe hacia abajo en el suelo: rebota
    if (d.grounded && kb < 4 && Math.abs(h.ang) < 50) ly = 0;     // golpes flojos: se queda en el suelo
    d.lvx = lx; d.lvy = ly; d.vx = 0; d.vy = 0; d.ff = false;
    if (ly < -0.5) { d.grounded = false; d.plat = null; }
    if (d.st === 'ledge') { d.grounded = false; }
    d.move = null; d.hidden = false;
    d.setSt('hitstun');
    d.stun = Math.round(kb * 3.6);
    d.flash = 4;
    d.upUsed = false; d.sideUsed = false; d.dodgeUsed = false;
    d.lastHitBy = a; d.lastHitT = this.frame;
    const lag = Math.min(14, 3 + Math.floor(dmg / 2.5) + (kb > 10 ? 3 : 0));
    a.hitlag = lag; d.hitlag = lag;
    this.spark(hx, hy, 5 + dmg * 0.8 + kb * 0.4, kb > 9 ? '#ffd34a' : a.pal.light);
    if (kb > 8) { this.shake = Math.max(this.shake, Math.min(10, kb * 0.5)); }
    Sfx.hit(kb);
  }

  // ---------- proyectiles ----------
  // spec: { x, y (desde los pies), vx, vy, grav, life, r, kind, h: golpe, max: máximo en pantalla }
  spawnProjectile(f, spec) {
    spec = spec || {};
    if (spec.max) {
      const mine = this.projectiles.filter(p => p.owner === f && p.kind === spec.kind);
      if (mine.length >= spec.max) mine[0].life = 0;
    }
    this.projectiles.push({
      x: f.x + f.dir * (spec.x ?? 12), y: f.y + (spec.y ?? -15),
      vx: f.dir * (spec.vx ?? 4.4), vy: spec.vy || 0, grav: spec.grav || 0, wave: spec.wave || 0, t: 0,
      life: spec.life || 70, r: spec.r || 4, kind: spec.kind || 'ball', owner: f, pal: f.pal,
      delay: spec.delay || 0, fire: !!spec.fire,
      h: spec.h || { d: 6, b: 2.0, g: 2.2, ang: 35 },
    });
    Sfx.shoot();
  }
  stepProjectiles() {
    const M = STAGE.main;
    for (const p of this.projectiles) {
      if (p.delay > 0) { p.delay--; continue; }                // espera antes de aparecer
      if (p.fire && this.frame % 2 === 0) this.burst(p.x, p.y, 1, 'fire');
      p.t++; p.vy += p.grav; p.x += p.vx; p.y += p.vy + (p.wave ? Math.cos(p.t * 0.15) * p.wave : 0); p.life--;
      for (const pl of STAGE.plats) if (p.grav && p.vy > 0 && p.x > pl.x1 && p.x < pl.x2 && Math.abs(p.y - pl.y) < 3) p.life = 0;
      if (p.grav && p.y >= M.y && p.x > M.x1 && p.x < M.x2) p.life = 0;
      if (this.frame % 3 === 0 && p.kind !== 'mine') this.fx.push({ kind: 'part', ptype: 'spark', x: p.x, y: p.y + (Math.random() * 4 - 2), vx: -p.vx * 0.1, vy: 0, t: 0, life: 10, size: 1, col: p.pal.light });
      if (p.x > M.x1 && p.x < M.x2 && p.y > M.y && p.y < M.bottom) p.life = 0;
      const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
      for (const d of this.fighters) {
        if (p.life <= 0) break;
        if (d === p.owner || !d.alive() || d.st === 'respawn' || d.invuln > 0 || this.allies(p.owner, d)) continue;
        if (boxHit(box, d.hurtbox())) {
          this.applyHit(p.owner, d, p.h, p.h.away ? (sgn(d.x - p.x) || 1) : (sgn(p.vx) || p.owner.dir), 1, p.x, p.y);
          p.owner.hitlag = 0;
          p.life = 0;
        }
      }
      if (p.life <= 0) this.spark(p.x, p.y, p.kind === 'mine' ? 14 : 6, p.pal.light);
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  }

  // ---------- fuera de la zona = KO ----------
  checkBlast() {
    const B = STAGE.blast;
    for (const f of this.fighters) {
      if (!f.alive() || f.st === 'respawn') continue;
      const top = f.y < B.t && f.st === 'hitstun';
      if (f.x < B.l || f.x > B.r || f.y > B.b || top) this.ko(f);
    }
  }
  ko(f) {
    const ex = clamp(f.x, 4, W - 4), ey = clamp(f.y - 12, 4, H - 4);
    const ang = Math.atan2(H / 2 - ey, W / 2 - ex);
    this.fx.push({ kind: 'ko', x: ex, y: ey, ang, t: 0, life: 50, col: f.pal.main });
    this.burst(ex, ey, 18, 'spark', f.pal.light);
    this.shake = 12;
    Sfx.ko();
    if (f.holding) f.releaseHeld();
    if (f.heldBy) { f.heldBy.holding = null; f.heldBy = null; }
    f.falls++;
    if (f.lastHitBy && this.frame - f.lastHitT < 480 && f.lastHitBy !== f) f.lastHitBy.kos++;
    f.stocks--;
    if (f.stocks <= 0) {
      f.out = true; f.st = 'dead'; this.placing.push(f);
    } else {
      f.setSt('dead'); f.x = -999; f.y = -999; f.vx = f.vy = f.lvx = f.lvy = 0;
    }
  }

  // ---------- efectos ----------
  spark(x, y, size, col) { this.fx.push({ kind: 'spark', x, y, size, col, t: 0, life: 12, rot: Math.random() }); }
  burst(x, y, n, type, col) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 1.5;
      if (type === 'dust') this.fx.push({ kind: 'part', ptype: 'dust', x: x + (Math.random() * 8 - 4), y: y - 1, vx: Math.cos(a) * s, vy: -Math.random() * 0.6, t: 0, life: 16 + Math.random() * 10, size: 1 + (Math.random() * 3 | 0) });
      else if (type === 'smoke') this.fx.push({ kind: 'part', ptype: 'smoke', x, y, vx: 0, vy: 0, t: 0, life: 22, size: 3 });
      else if (type === 'fire') this.fx.push({ kind: 'part', ptype: 'fire', x: x + (Math.random() * 4 - 2), y, vx: (Math.random() - 0.5) * 0.6, vy: -0.4 - Math.random() * 0.8, t: 0, life: 14 + Math.random() * 12, size: Math.random() < 0.4 ? 2 : 1 });
      else if (type === 'star') this.fx.push({ kind: 'part', ptype: 'star', x, y, vx: Math.cos(a) * 0.3, vy: -0.4, t: 0, life: 24, size: 1, col: col || '#fff' });
      else this.fx.push({ kind: 'part', ptype: 'spark', x, y, vx: Math.cos(a) * s * 2, vy: Math.sin(a) * s * 2, t: 0, life: 14 + Math.random() * 10, size: 1 + (Math.random() < 0.3 ? 1 : 0), col: col || '#fff' });
    }
  }
  stepFx() {
    for (const e of this.fx) {
      e.t++;
      if (e.kind === 'part') { e.x += e.vx; e.y += e.vy; e.vx *= 0.92; e.vy *= 0.92; if (e.ptype === 'spark') e.vy += 0.05; }
    }
    this.fx = this.fx.filter(e => e.t < e.life);
  }

  // ---------- dibujo a resolución interna ----------
  render(c) {
    STAGE = this.stage;
    const st = this.stage, def = st.def;
    def.renderBack(c, st, this);
    c.drawImage(def.art.stage, 0, 0);
    if (def.renderMid) def.renderMid(c, st, this);

    for (const f of this.fighters) if (f.st === 'respawn') drawRespawnPad(c, f, this.frame);
    // luchadores (el que está atacando, delante)
    const order = this.fighters.filter(f => f.alive()).sort((a, b) => (a.st === 'attack') - (b.st === 'attack'));
    for (const f of order) {
      if (f.st === 'respawn' || f.st === 'grabbed') continue;
      const surf = surfaceBelow(f.x, f.y);
      if (surf) { const d = surf.y - f.y; if (d < 140) shadow(c, f.x, surf.y, (f.S.hw + 3) * (1 - d / 220), 0.38 * (1 - d / 140)); }
    }
    for (const f of order) {
      renderFighter(c, f, this.frame);
      if (f.ch.overlay) f.ch.overlay(c, f, this.frame);
      if (f.st === 'shield') drawShield(c, f, this.frame);
      for (const hb of f.activeHits()) if (!hb.h0.grab && !hb.h0.noFx) drawSwoosh(c, hb, f.dir, f.pal.light, f.move.smash);
    }
    for (const p of this.projectiles) if (!(p.delay > 0)) drawProjectile(c, p, this.frame);
    for (const e of this.fx) {
      if (e.kind === 'spark') drawSpark(c, e);
      else if (e.kind === 'part') drawParticle(c, { ...e, kind: e.ptype });
    }
    if (def.renderFront) def.renderFront(c, st, this);
    for (const e of this.fx) if (e.kind === 'ko') drawKO(c, e);
    // etiquetas e indicadores fuera de pantalla
    for (const f of this.fighters) {
      if (!f.alive()) continue;
      const off = f.x < 0 || f.x > W || f.y < 8 || f.y - 12 > 228;
      if (off && f.st !== 'respawn') drawOffscreen(c, f, f.label);
      else drawTag(c, f, f.label);
    }
    this.renderHudArt(c);
  }

  hudLayout() {
    const n = this.fighters.length, w = 108, gap = 6;
    const total = n * w + (n - 1) * gap, x0 = Math.round((W - total) / 2);
    return this.fighters.map((f, i) => ({ f, x: x0 + i * (w + gap), y: 236, w, h: 30 }));
  }
  renderHudArt(c) {
    // tarjetas del marcador: esquinas recortadas, franja diagonal del jugador y cristal
    const cut = 5;
    const shape = (x, y, w, h, col, a) => {          // polígono recortado fila a fila (pixel art)
      for (let yy = 0; yy < h; yy++) {
        const l = yy < cut ? cut - yy : 0, r = yy >= h - cut ? cut - (h - 1 - yy) : 0;
        rect(c, x + l, y + yy, w - l - r, 1, col, a);
      }
    };
    for (const { f, x, y, w, h } of this.hudLayout()) {
      const pal = f.out ? { main: '#555070', light: '#6c6890', dark: '#3a3555', glow: '#888' } : f.pal;
      const hurt = f.flash > 0;
      shape(x - 1, y - 1, w + 2, h + 2, OUTLINE, 0.9);
      shape(x, y, w, h, '#0c0a24', 0.78);
      // franja diagonal con el color del jugador (detrás del retrato)
      for (let yy = 0; yy < h; yy++) rect(c, x + Math.max(0, cut - yy), y + yy, 30 - Math.round(yy * 0.35), 1, pal.main, f.out ? 0.25 : 0.55);
      for (let yy = 0; yy < h; yy++) rect(c, x + 30 - Math.round(yy * 0.35), y + yy, 2, 1, pal.light, 0.7);
      rect(c, x + cut, y, w - cut, 1, pal.light, 0.8);                      // brillo superior
      if (hurt) shape(x, y, w, h, '#ffffff', 0.25);
      // retrato
      f.ch.portrait(c, x + 14, y + 16, pal, 2);
      if (this.teams) rect(c, x + w - 9, y + 3, 4, 4, f.team === 0 ? '#e8443f' : '#3d7ef2');
      // vidas: pequeños rombos
      const shown = Math.min(f.stocks, 5);
      for (let i = 0; i < shown; i++) {
        const sx = x + 36 + i * 7, sy = y + 25;
        rect(c, sx - 1, sy - 2, 3, 5, OUTLINE); rect(c, sx - 2, sy - 1, 5, 3, OUTLINE);
        px(c, sx, sy - 1, pal.glow); rect(c, sx - 1, sy, 3, 1, pal.light); px(c, sx, sy + 1, pal.main);
      }
    }
  }

  // ---------- texto (pantalla a resolución real) ----------
  renderText(t) {
    for (const { f, x, y } of this.hudLayout()) {
      t.text(f.label, x + 36, y + 4, 8, f.out ? '#6c6890' : '#ffffff');
      if (f.out) { t.text('FUERA', x + 28, y + 13, 8, '#6c6890'); continue; }
      const d = Math.floor(f.dmg);
      const col = d < 50 ? '#ffffff' : d < 90 ? '#ffe27a' : d < 130 ? '#ff9a4a' : d < 180 ? '#ff4a3a' : '#d01a3a';
      const shakeX = f.flash > 0 ? (Math.random() * 2 - 1) : 0;
      t.text(d + '%', x + 104 + shakeX, y + 10, 16, col, 'right');
      if (f.stocks > 5) t.text('x' + f.stocks, x + 66, y + 22, 8, '#c9c1e8');
    }
    if (this.phase === 'count') {
      const n = 3 - Math.floor(this.phaseT / 60);
      if (n >= 1) t.text(String(n), W / 2, 88, 48, '#ffd34a', 'center');
    } else if (this.phase === 'play' && this.phaseT < 50) {
      t.text('¡YA!', W / 2, 88, 48, '#ffd34a', 'center');
    } else if (this.phase === 'end') {
      t.text('¡FIN!', W / 2, 88, 48, '#ffffff', 'center');
    }
  }

  result() {
    // posiciones: los que siguen vivos primero
    const alive = this.fighters.filter(f => !f.out);
    const order = [...alive, ...this.placing.slice().reverse()];
    let winner;
    if (this.teams) {
      const t = alive.length ? alive[0].team : 0;
      winner = TEAM_NAMES[t];
    } else winner = alive.length ? fullName(alive[0]) : '—';
    return { order, winner, teams: this.teams, winTeam: alive.length ? alive[0].team : null };
  }
}
