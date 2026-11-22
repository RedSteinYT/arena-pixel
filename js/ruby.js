'use strict';
// ============================================================
//  ATAQUES RUBÍ (cada luchador tiene dos; se activan con ATAQUE + ESPECIAL a la vez, solo en tierra)
//   · Comeback de Rubí: con tu daño en 100 % o más tu corazón arde. Es un golpe (puede fallar),
//     rápido y sin pausa, pero pega muchísimo. Una vez por vida.
//   · Ultimate Ruby: se carga concentrándote (ESCUDO + ESPECIAL, quieto en el suelo, ~3 s).
//     Empieza con un golpe; si acierta, explota un corazón de rubí, todo se congela y empieza su
//     técnica. Si falla, se pierde la carga (no la vida). Una vez por vida, tiene prioridad sobre el
//     Comeback y lo apaga hasta tu siguiente vida.
//   Ninguno es KO directo: el % sigue decidiendo.
// ============================================================

const RUBY_CB_DMG = 100;          // daño a partir del cual arde el corazón
const RUBY_CHARGE = 180;          // fotogramas de concentración (3 s)
const RUBY_PRE = 26;              // fotogramas del corazón de rubí que explota antes de cada Ultimate
const RUBY_COL = { l: '#ff8aa0', m: '#e8284a', d: '#8a0f2a', glow: '#ff3a5a' };

const RubySys = (() => {
  // ¿esta pelea / este luchador usa los ataques rubí?
  const on = (f, g) => !!(g && g.cfg && g.cfg.ruby !== false && (!g.cfg.tutorial || g.cfg.tutorial === 'rubi') && !g.sd && f.ch.moves.rubyCb && f.ch.moves.rubyUlt);
  const cbReady = f => f.dmg >= RUBY_CB_DMG && !f.cbUsed && !f.cbOff;
  function resetLife(f) { f.cbUsed = false; f.cbOff = false; f.ultReady = false; f.ultUsed = false; f.chargeT = 0; f.rubyTxtT = 0; }
  function canCharge(f, g) { return on(f, g) && f.grounded && !f.ultReady && !f.ultUsed && g.phase === 'play' && !f.item; }

  // en el suelo (antes que cualquier otro botón): concentrarse o lanzar el ataque rubí
  function ground(f, g) {
    if (!on(f, g) || g.phase !== 'play') return false;
    const I = f.inp;
    if (I.shd && I.spc && canCharge(f, g)) { f.buf.spc = 0; f.buf.shd = 0; f.chargeT = 0; f.setSt('rubyCharge'); return true; }
    const ult = f.ultReady, cb = cbReady(f);
    if (!ult && !cb) return false;
    const a = f.buf.atk > 0, s = f.buf.spc > 0;
    if (a && s) { f.buf.atk = f.buf.spc = 0; start(f, g, ult ? 'rubyUlt' : 'rubyCb'); return true; }
    // pulsó uno de los dos hace nada: espera un par de fotogramas por si llega el otro
    if ((a && f.buf.atk >= 9) || (s && f.buf.spc >= 9)) { f.friction(); return true; }
    return false;
  }
  function start(f, g, name) {
    if (name === 'rubyUlt') { f.ultReady = false; f.ultUsed = true; f.cbOff = true; }   // tras el Ultimate, sin Comeback hasta la próxima vida
    else f.cbUsed = true;
    f.move = null; f.chain = 0; f.chainT = 0; f.comboTier = 0; f.noRepeat = null;
    if (f.item) { f.inp = blankInput(); ItemSys.throwItem(f, g); }        // el ataque rubí es suyo: suelta lo que lleve en la mano
    f.startMove(name, g);
    const m = f.ch.moves[name];
    if (name === 'rubyCb') { f.rubyTxt = m.rubyName; f.rubyTxtT = 70; Sfx.remate(); }
    else Sfx.freeze();
    g.burst(f.x, f.y - f.S.hh * 0.6, 8, 'star', RUBY_COL.l);
  }
  // concentración: mantener ESCUDO + ESPECIAL quieto en el suelo
  function stCharge(f, g) {
    const I = f.inp;
    f.friction();
    if (!I.shd || !I.spc || !f.grounded || !on(f, g) || f.ultReady || f.ultUsed) { f.chargeT = 0; f.setSt('ground'); return; }
    f.chargeT++;
    const cx = f.x, cy = f.y - f.S.hh * 0.55;
    if (f.chargeT % 3 === 0) {                                             // chispas de rubí que se juntan en él
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 10;
      g.fx.push({ kind: 'part', ptype: 'spark', x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * 2.2, vy: -Math.sin(a) * 2.2, t: 0, life: 12, size: 1, col: f.chargeT % 6 ? RUBY_COL.l : '#ffffff' });
    }
    if (f.chargeT % 30 === 0) Sfx.blip();
    if (f.chargeT >= RUBY_CHARGE) {
      f.ultReady = true; f.chargeT = 0; f.setSt('ground');
      f.rubyTxt = '¡ULTIMATE LISTO!'; f.rubyTxtT = 60;
      Sfx.remate(); g.shake = Math.max(g.shake, 4);
      duoRadial(g, cx, cy, 20, [RUBY_COL.l, RUBY_COL.m, '#ffffff'], 2.2);
    }
  }
  // cada fotograma de la pelea: brasas del corazón en llamas, brillo del Ultimate listo, textos
  function step(g) {
    for (const f of g.fighters) {
      if (f.rubyTxtT > 0) f.rubyTxtT--;
      if (!f.alive() || f.st === 'respawn' || !on(f, g)) continue;
      if (f.ultReady && g.frame % 4 === 0) g.fx.push({ kind: 'part', ptype: 'star', x: f.x + (Math.random() * 2 - 1) * (f.S.hw + 4), y: f.y - Math.random() * f.S.hh, vx: 0, vy: -0.5, t: 0, life: 18, size: 1, col: RUBY_COL.l });
      else if (cbReady(f) && g.frame % 5 === 0) g.burst(f.x + (Math.random() * 2 - 1) * f.S.hw, f.y - f.S.hh * (0.3 + Math.random() * 0.6), 1, 'fire');
    }
  }

  // ---------- dibujo ----------
  function drawAura(c, f, g) {
    if (!f.alive() || f.st === 'respawn' || f.st === 'gone' || f.st === 'portal') return;
    const cx = f.x, cy = f.y - f.S.hh * 0.55, T = g.frame;
    if (f.st === 'rubyCharge') {
      const k = f.chargeT / RUBY_CHARGE;
      glow(c, cx, cy, f.S.hh * 0.55 + 6 + k * 6, RUBY_COL.glow, 0.15 + 0.3 * k, 3);
      withAlpha(c, 0.8, () => ring(c, cx, cy, Math.round(34 - 22 * k), RUBY_COL.l));
      // barra de carga sobre la cabeza
      const w = 22, x0 = Math.round(cx - w / 2), y0 = Math.round(f.y - f.S.hh - 12);
      rect(c, x0 - 1, y0 - 1, w + 2, 4, OUTLINE); rect(c, x0, y0, w, 2, '#3a1020'); rect(c, x0, y0, Math.round(w * k), 2, (T >> 2) % 2 ? RUBY_COL.l : RUBY_COL.m);
    } else if (f.ultReady && on(f, g)) {
      glow(c, cx, cy, f.S.hh * 0.6 + 7 + Math.sin(T * 0.2) * 2, RUBY_COL.glow, 0.22, 3);
    } else if (cbReady(f) && on(f, g)) {
      glow(c, cx, cy, f.S.hh * 0.55 + 5 + Math.sin(T * 0.3) * 1.5, '#ff7a20', 0.14, 3);
    }
  }
  // en el marcador: el corazón de esta vida arde (Comeback) o brilla de rubí (Ultimate listo)
  function drawHud(c, f, g, hx, hy) {
    if (f.out || !on(f, g)) return;
    const T = g.frame;
    if (f.ultReady || f.st === 'rubyCharge') {
      const k = f.ultReady ? 1 : f.chargeT / RUBY_CHARGE;
      glow(c, hx + 3, hy + 3, 6 + (f.ultReady ? Math.sin(T * 0.25) * 1.5 : 0), RUBY_COL.glow, 0.25 + 0.35 * k, 3);
      if (f.ultReady) { px(c, hx - 2 + ((T >> 3) % 11), hy - 2, '#ffffff'); px(c, hx + 8 - ((T >> 3) % 11), hy + 7, '#ffd0da'); }
    }
    if (cbReady(f) && !f.ultReady) {                                         // el corazón de esta vida, en llamas
      glow(c, hx + 3, hy + 3, 6, '#ff7a20', 0.25 + 0.1 * Math.sin(T * 0.4), 2);
      for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) {
        if (RUBY[r][k] === '.') continue;
        let col = r < 2 ? '#ffd040' : r < 4 ? '#ff7a20' : '#e8283a';
        if (((T >> 2) + k + r * 2) % 6 === 0) col = '#fff3b0';               // chisporroteo
        px(c, hx + k, hy + r, col);
      }
      for (const k of [1, 2, 4, 5]) if (((T >> 2) + k) % 3) px(c, hx + k, hy - 1, (T >> 3) % 2 === k % 2 ? '#ffd040' : '#ff7a20');   // lenguas de fuego
    }
  }
  // nombre del ataque sobre el luchador
  function drawText(t, f) {
    if (!(f.rubyTxtT > 0) || !f.alive()) return;
    const half = f.rubyTxt.length * 8 + 4, x = clamp(f.x, half, W - half), y = clamp(f.y - f.S.hh - 58, 14, H - 80);   // por encima del contador de golpes
    t.text(f.rubyTxt, x, y, f.rubyTxtT > 62 ? 16 : 16, (f.rubyTxtT >> 2) % 2 ? RUBY_COL.l : '#ffd34a', 'center');
  }

  // ---------- la CPU ----------
  function ai(f, g, I, tgt, dx, dy, L) {
    if (!on(f, g)) return false;
    const A = f.ai, adx = Math.abs(dx), ady = Math.abs(dy);
    const near = g.fighters.some(o => o !== f && o.alive() && o.st !== 'respawn' && !g.allies(f, o) && Math.abs(o.x - f.x) < 75 && Math.abs(o.y - f.y) < 60);
    // concentrándose: seguir mientras nadie se acerque
    if (f.st === 'rubyCharge') { if (!near) { I.shd = true; I.spc = true; } return true; }
    if (!f.grounded || f.st !== 'ground') return false;
    // lanzar el ataque rubí si el rival está delante y a tiro
    const m = f.ch.moves[f.ultReady ? 'rubyUlt' : 'rubyCb'], rng = m && m.aiRange || [0, f.ultReady ? 30 + f.S.hw : 64 + f.S.hw];   // a qué distancia acierta
    if ((f.ultReady || cbReady(f)) && adx >= rng[0] && adx < rng[1] && ady < 18 && Math.random() < 0.25 + L.punish * 0.5) {
      if (sgn(dx) !== f.dir) { I.mx = sgn(dx); return true; }                // primero, mirarle
      I.atk = !f.prev.atk; I.spc = !f.prev.spc; return true;
    }
    // concentrarse para el Ultimate cuando todos están lejos (a veces)
    if (canCharge(f, g) && !near && adx > 160) {
      if (A.wantCharge === undefined || g.frame > (A.chargeCheck || 0)) { A.chargeCheck = g.frame + 90; A.wantCharge = Math.random() < 0.35 + L.punish * 0.3; }
      if (A.wantCharge) { I.shd = true; I.spc = true; return true; }
    }
    return false;
  }

  return { on, cbReady, resetLife, canCharge, ground, stCharge, step, drawAura, drawHud, drawText, ai };
})();

// ------------------------------------------------------------
//  Motor del Ultimate (usa el mismo motor de cinemáticas que las ¡¡¡DUPLA!!!)
// ------------------------------------------------------------
Object.assign(Game.prototype, {
  startUlt(a, v) {
    const key = 'ult:' + a.ch.id, A = DUO_ANIMS[key]; if (!A) return;
    if (v.holding) v.releaseHeld();
    if (v.heldBy) { v.heldBy.holding = null; v.heldBy = null; }
    for (const f of [a, v]) if (f.item) { f.inp = blankInput(); ItemSys.throwItem(f, this); }
    const P = a.plat || STAGE.main, wide = P.x2 - P.x1 > 150;
    const D = { kind: key, a, b: a, v, t: 0, pre: RUBY_PRE, len: A.len + RUBY_PRE, gy: a.y, plat: a.plat, flash: 0, big: true, ult: true,
      cx: wide ? clamp(a.x + a.dir * 30, P.x1 + 60, P.x2 - 60) : (P.x1 + P.x2) / 2 };
    D.preFocus = { x: (a.x + v.x) / 2, y: a.y - a.S.hh - 10, z: 2.3 };
    D.focus = D.preFocus;
    for (const f of [a, v]) { f.hitlag = 0; f.flash = 0; f.invuln = 0; f.hidden = false; f.burn = 0; f.frozen = 0; f.lag = 0; f.vx = f.vy = f.lvx = f.lvy = 0; }
    v.move = null; v.setSt('hitstun'); v.flash = 4;
    A.setup(this, D);
    D.focusMain = D.focus; D.focus = D.preFocus;
    this.duo = D; this.shake = 4;
  },
  // los primeros fotogramas de cualquier Ultimate: el corazón de rubí que late, se agrieta y explota
  stepUltPre(D) {
    const t = D.t, a = D.a;
    if (t === 1) Sfx.freeze();
    if (t === 8 || t === 13) Sfx.blip();
    if (t === 18) {
      const hx = a.x, hy = a.y - a.S.hh - 26;
      D.flash = 9; this.shake = 10; Sfx.brk(); Sfx.hit(16);
      duoRadial(this, hx, hy, 34, [RUBY_COL.l, RUBY_COL.m, RUBY_COL.d, '#ffffff'], 3, 'spark', 30);
      duoRadial(this, hx, hy, 12, ['#ffd0da', '#ffffff'], 1.2, 'star', 36);
    }
    if (t === RUBY_PRE) D.focus = D.focusMain;
  },
  renderUltPre(c, D) {
    const t = D.t, a = D.a; if (t > RUBY_PRE + 10) return;
    const hx = Math.round(a.x), hy = Math.round(a.y - a.S.hh - 26);
    if (t < 18) {
      const beat = t < 12 ? 1 + 0.25 * Math.max(0, Math.sin(t * 1.1)) : 1.2, s = Math.max(1, Math.round(Math.min(4, 1 + t * 0.35) * beat));
      const sh = t >= 12 ? ((t & 1) ? 1 : -1) : 0, w = 7 * s, h = 6 * s, x0 = hx - (w >> 1) + sh, y0 = hy - (h >> 1);
      glow(c, hx, hy, w * 0.9, RUBY_COL.glow, 0.35, 3);
      const cols = { 1: RUBY_COL.l, 2: RUBY_COL.m, 3: RUBY_COL.d };
      for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) if (RUBY[r][k] !== '.') rect(c, x0 + k * s - 1, y0 + r * s - 1, s + 2, s + 2, OUTLINE);
      for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) { const ch = RUBY[r][k]; if (ch !== '.') rect(c, x0 + k * s, y0 + r * s, s, s, t >= 15 && (t & 1) ? '#ffffff' : cols[ch]); }
      rect(c, x0 + s, y0 + s, s, s, '#ffd0da');                               // brillo de la gema
      if (t >= 12) {                                                           // grietas
        withAlpha(c, 0.9, () => { pline(c, hx - 2, y0 + 2, hx + 3, hy, 1, '#ffffff'); pline(c, hx + 3, hy, hx - 1, y0 + h - 4, 1, '#ffffff'); pline(c, hx, hy - 2, hx - 8, hy + 1, 1, '#ffffff'); });
      }
    } else {
      const k = (t - 18) / 18;                                                 // onda expansiva
      withAlpha(c, Math.max(0, 1 - k), () => { ring(c, hx, hy, 6 + (t - 18) * 7, RUBY_COL.l); ring(c, hx, hy, 3 + (t - 18) * 5, '#ffffff'); });
    }
  },
});
