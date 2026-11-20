'use strict';
// ============================================================
//  Luchador: movimiento, estados y ataques
// ============================================================
//  Motor compartido. Los ataques y el aspecto de cada luchador
//  están en js/characters/<luchador>.js
// ============================================================

// nivel de cada ataque para los combos: solo se encadena hacia uno de nivel igual o mayor
//  1 golpes rápidos · 2 con dirección, carrera y aéreos · 3 fuertes · 4 especiales
function moveTier(n) {
  if (!n) return 0;
  if (n.startsWith('jab')) return 1;
  if (/smash$/.test(n)) return 3;
  if (/spc/.test(n)) return 4;
  if (/throw|grab/.test(n)) return 5;
  return 2;
}
const JAB_NEXT = { jab: 'jab2', jab2: 'jab3' };

class Fighter {
  constructor(slot, cfg, stocks) {
    this.slot = slot; this.cfg = cfg;
    this.ch = CHARACTERS[cfg.char] || CHARACTERS[CHAR_ORDER[0]];
    this.S = Object.assign({}, BASE_STATS, this.ch.stats);
    this.pal = PLAYER_PALS[cfg.pal];
    this.team = cfg.team;
    this.cpu = cfg.device === 'cpu';
    this.level = cfg.level || 'normal';
    this.device = cfg.device;
    this.label = this.cpu ? 'CPU' : 'J' + (cfg.num || slot + 1);
    this.stocks = stocks; this.out = false;
    this.kos = 0; this.falls = 0; this.dealt = 0;
    this.dmg = 0;
    this.inp = blankInput(); this.prev = blankInput();
    this.buf = { jump: 0, atk: 0, spc: 0, shd: 0, grab: 0, str: 0 };
    this.flickX = 99; this.flickY = 99;
    this.animT = 0;
    this.baseS = Object.assign({}, this.S); this.item = null; this.buffs = {}; this.frozen = 0;   // objetos
    this.comboN = 0; this.comboT = 0; this.comboBy = null; this.bestCombo = 0; this.remateT = 0;      // combos
    const sp = STAGE.spawns[slot];
    this.spawn(sp[0], sp[2] ?? STAGE.main.y, sp[1]);
  }

  spawn(x, y, dir) {
    this.x = x; this.y = y; this.vx = this.vy = this.lvx = this.lvy = 0;
    this.dir = dir; this.grounded = true; this.plat = surfaceBelow(x, y) || STAGE.main;
    this.setSt('ground');
    this.jumps = this.S.jumps; this.upUsed = this.sideUsed = this.dodgeUsed = false; this.ff = false;
    this.hitlag = 0; this.invuln = 0; this.shieldHP = 50; this.ledgeCD = 0; this.dropT = 0; this.projCD = 0;
    this.move = null; this.charge = 0; this.flash = 0; this.stun = 0; this.lag = 0;
    this.lastHitBy = null; this.lastHitT = -9999; this.trail = 0;
    this.scarf = null;
  }

  setSt(s) { this.st = s; this.t = 0; }
  stunned(g) { return this.st === 'hitstun' || (this.st === 'landing' && this.stunEndF >= g.frame); }   // aún encajando un combo
  alive() { return !this.out && this.st !== 'dead'; }
  hurtbox() { return { x: this.x - this.S.hw, y: this.y - this.S.hh, w: this.S.hw * 2, h: this.S.hh }; }

  // --------- entrada ---------
  takeInput(inp) {
    this.prev = this.inp; this.inp = inp;
    const I = inp, P = this.prev;
    for (const k of ['jump', 'atk', 'spc', 'shd', 'grab', 'str']) {
      if (I[k] && !P[k]) this.buf[k] = (k === 'shd' || k === 'grab') ? 6 : 10;   // los ataques se recuerdan un poco más (combos más fáciles)
      else if (this.buf[k] > 0 && this.hitlag <= 0) this.buf[k]--;   // durante el impacto se guarda
    }
    // "flick" = mover la palanca rápido (para ataques fuertes y caída rápida)
    if (Math.abs(I.mx) > 0.8 && Math.abs(P.mx) < 0.4) this.flickX = 0; else this.flickX++;
    if (Math.abs(I.my) > 0.8 && Math.abs(P.my) < 0.4) this.flickY = 0; else this.flickY++;
    // palanca derecha = ataque fuerte directo
    this.cstick = null;
    const cmag = Math.max(Math.abs(I.cx), Math.abs(I.cy));
    // se "arma" al volver al centro y se dispara al pasar del 70 %, aunque la palanca se mueva despacio
    if (cmag < 0.4) this.cArmed = true;
    if (cmag > 0.7 && this.cArmed !== false) { this.cArmed = false; this.cBufT = 10; this.cBufDir = Math.abs(I.cx) >= Math.abs(I.cy) ? { x: sgn(I.cx), y: 0 } : { x: 0, y: sgn(I.cy) }; }
    else if (this.cBufT > 0 && this.hitlag <= 0) this.cBufT--;          // se recuerda unos fotogramas, como los botones
    this.cstick = this.cBufT > 0 ? this.cBufDir : null;
    this.cHeld = cmag > 0.5;
  }
  use(k) { if (this.buf[k] > 0) { this.buf[k] = 0; return true; } return false; }
  strongDir() {
    const I = this.inp;
    if (Math.abs(I.my) > 0.5 && Math.abs(I.my) >= Math.abs(I.mx)) return { x: 0, y: sgn(I.my) };
    return { x: Math.abs(I.mx) > 0.5 ? sgn(I.mx) : this.dir, y: 0 };
  }

  // --------- ataques ---------
  startMove(name, g, mv) {
    // combo: al cancelar un golpe solo se encadena hacia uno distinto y de nivel igual o mayor.
    // Eso solo cuenta en el mismo instante de la cancelación; más tarde el golpe SIEMPRE sale
    // (solo se pierde la cadena), para que ningún botón se "coma" sin avisar.
    const now = g && g.frame, atCancel = this.cancelF === now;
    if (this.chainT > 0 && name === this.noRepeat) {
      if (atCancel) { this.setSt(this.grounded ? 'ground' : 'air'); return; }
      this.chain = 0; this.chainT = 0; this.noRepeat = null;
    }
    if (this.comboTier) {
      const ok = moveTier(name) >= this.comboTier;
      this.comboTier = 0;
      if (!ok) {
        this.chain = 0;
        if (atCancel) { this.setSt(this.grounded ? 'ground' : 'air'); return; }
      }
    }
    this.move = mv || this.ch.moves[name]; this.moveName = name;
    this.setSt('attack'); this.hitSet = new Set(); this.charge = 0; this.hidden = false; this.landedHit = false; this.grabFail = false;
    if (mv && mv.item && this.item) this.item.uses -= mv.cost ?? 1;          // las armas se gastan
    // al encadenar en el suelo, un pasito hacia delante para que el siguiente golpe llegue
    if (this.grounded && (this.chain > 0 || name === 'jab2' || name === 'jab3') && !this.move.special) this.vx = this.dir * Math.max(Math.abs(this.vx), 1.5);
    // COMBO ASISTIDO: si el rival sigue aturdido por tus golpes, el siguiente ataque te acerca a él
    // y los fuertes salen más rápido, para que el combo no dependa de reflejos sobrehumanos
    this.lunge = 0; this.lungeTo = null;
    const vic = g && g.fighters && g.fighters.find(o => o !== this && o.comboBy === this && o.comboN <= 5 && o.stunned(g) && Math.abs(o.x - this.x) < 64 && Math.abs(o.y - this.y) < 64);
    if (vic && !this.move.special && !this.move.throw && name !== 'grab') {
      const dx = vic.x - this.x;
      if (Math.abs(dx) > 2 && !this.move.air) this.dir = sgn(dx);
      this.lunge = 34; this.lungeTo = vic;                 // cuántos píxeles puede avanzar como mucho
      if (this.move.smash) this.t = Math.min(8, Math.floor(this.move.s * 0.5));   // como mucho 8 fotogramas más rápido
    }
    if (this.move.onStart) this.move.onStart(this, g);
    if (this.moveName === name && !this.move.special && this.move.sfx !== false) { if (this.move.sfx) Sfx[this.move.sfx](); else Sfx.swing(); }
  }
  // con un objeto en la mano, el ataque normal es el del objeto
  itemAttack(g, kind) {
    if (!this.item) return false;
    const def = ITEMS[this.item.id];
    if (def.kind === 'throw') { ItemSys.throwItem(this, g, Math.abs(this.inp.my) > 0.5 && Math.abs(this.inp.my) >= Math.abs(this.inp.mx) ? 0 : (sgn(this.inp.mx) || this.dir)); return true; }
    const m = ItemSys.weaponMove(this, kind);
    if (!m) return false;
    this.startMove(m.key, g, m);
    return true;
  }
  dirOf(mx, my) {
    if (Math.abs(my) > 0.5 && Math.abs(my) >= Math.abs(mx)) return my < 0 ? 'up' : 'down';
    if (Math.abs(mx) > 0.5) return 'side';
    return 'neutral';
  }
  groundAttack(g, forced) {
    const I = this.inp;
    let d, smash = false;
    if (forced) { d = forced.y < 0 ? 'up' : forced.y > 0 ? 'down' : 'side'; smash = true; if (forced.x) this.dir = forced.x; }
    else {
      d = this.dirOf(I.mx, I.my);
      const inCombo = this.chainT > 0;                    // en mitad de un combo, dirección + ataque = ataque con dirección
      // con teclado (tiene su tecla de fuerte) dirección + ataque es siempre el ataque con dirección
      const kb = this.noFlick || (this.device && this.device.startsWith('kb'));
      if (d === 'side' && this.flickX <= 4 && !inCombo && !kb) smash = true;
      if ((d === 'up' || d === 'down') && this.flickY <= 4 && !inCombo && !kb) smash = true;
      if (d === 'side') this.dir = sgn(I.mx);
    }
    if (this.itemAttack(g, smash ? 'smash' : d === 'up' ? 'up' : d === 'down' ? 'down' : 'side')) return;
    if (smash) return this.startMove(d === 'up' ? 'usmash' : d === 'down' ? 'dsmash' : 'fsmash', g);
    if (d === 'side' && Math.abs(this.vx) > 1.8 && this.runT > 8) return this.startMove('dash', g);
    this.startMove(d === 'up' ? 'utilt' : d === 'down' ? 'dtilt' : d === 'side' ? 'ftilt' : 'jab', g);
  }
  airAttack(g, forced) {
    const I = this.inp;
    let d, x;
    if (forced) { d = forced.y < 0 ? 'up' : forced.y > 0 ? 'down' : 'side'; x = forced.x; }
    else { d = this.dirOf(I.mx, I.my); x = sgn(I.mx); }
    if (d === 'side' && x) this.dir = this.item ? x : this.dir;
    if (this.itemAttack(g, 'air')) return;
    if (d === 'up') return this.startMove('uair', g);
    if (d === 'down') return this.startMove('dair', g);
    if (d === 'side') return this.startMove(x === this.dir ? 'fair' : 'bair', g);
    this.startMove('nair', g);
  }
  special(g) {
    const I = this.inp, d = this.dirOf(I.mx, I.my);
    if (d === 'side') this.dir = sgn(I.mx);
    if (d === 'up') { if (!this.upUsed) this.startMove('uspc', g); return; }
    if (d === 'down') { this.startMove('dspc', g); return; }
    if (d === 'side') { if (!this.sideUsed || this.grounded) this.startMove('sspc', g); return; }
    if (this.projCD <= 0) { this.projCD = this.ch.moves.nspc.cd ?? 40; this.startMove('nspc', g); }
  }
  activeHits() {
    if (this.st !== 'attack' || !this.move || this.hitlag > 0) return [];
    const m = this.move, t = this.t;
    if (m.airOnly && this.grounded) return [];
    const mult = 1 + 0.5 * this.charge / 60, out = [];
    // cada golpe puede tener su propia ventana (on: [desde, hasta]) y repetirse (rehit: cada N frames)
    m.hit.forEach((h, i) => {
      const on = h.on || [m.s, m.s + m.a - 1];
      if (t < on[0] || t > on[1]) return;
      let [bx, by, bw, bh] = h.box;
      if (m.item) { const z = this.ch.z || 1, zx = 1 + (z - 1) * 0.55; bx *= zx; by *= z; bw *= zx; bh *= z; }   // armas a la escala del luchador
      const key = i + ':' + (h.rehit ? Math.floor((t - on[0]) / h.rehit) : 0);
      out.push({ x: this.dir > 0 ? this.x + bx : this.x - bx - bw, y: this.y + by, w: bw, h: bh, h0: h, mult, key });
    });
    return out;
  }

  // --------- actualización por frame ---------
  update(g) {
    if (this.flash > 0) this.flash--;
    if (this.hitlag > 0) { this.hitlag--; return; }
    this.animT++;
    if (this.invuln > 0) this.invuln--;
    if (this.ledgeCD > 0) this.ledgeCD--;
    if (this.dropT > 0) this.dropT--;
    if (this.projCD > 0) this.projCD--;
    if (this.burn > 0 && this.alive() && this.st !== 'respawn') {
      this.burn--;
      if (this.burn % 30 === 0) this.dmg = Math.min(999, this.dmg + 1);
      if (this.burn % 3 === 0) g.burst(this.x + (Math.random() * 2 - 1) * this.S.hw, this.y - Math.random() * this.S.hh, 1, 'fire');
    }
    if (this.chainT > 0 && --this.chainT <= 0) { this.chain = 0; this.noRepeat = null; this.comboTier = 0; }
    if (this.comboT > 0) this.comboT--;
    if (this.remateT > 0) this.remateT--;
    if (this.floatT > 0 && --this.floatT > 0 && this.st !== 'hitstun') this.floatT = 0;
    if (this.st !== 'shield' && this.shieldHP < 50) this.shieldHP = Math.min(50, this.shieldHP + 0.1);

    const I = this.inp;
    switch (this.st) {
      case 'ground': this.stGround(g); break;
      case 'jumpsquat':
        this.vx *= 0.9;
        if (this.t >= 3) {
          this.vy = -(I.jump ? this.S.jumpV : this.S.hopV); this.grounded = false; this.plat = null;
          this.setSt('air'); g.burst(this.x, this.y, 3, 'dust'); Sfx.jump();
        }
        break;
      case 'air': case 'helpless': this.stAir(g); break;
      case 'attack': this.stAttack(g); break;
      case 'landing':
        this.friction();
        if (this.t >= this.lag) this.setSt('ground');
        break;
      case 'shield': this.stShield(g); break;
      case 'dodge': this.stDodge(g); break;
      case 'hitstun':
        if (this.t >= this.stun) { this.setSt(this.grounded ? 'ground' : 'air'); this.stunEndF = g.frame; }
        break;
      case 'shieldbreak':
        this.friction();
        if (this.t % 20 === 0) g.burst(this.x, this.y - 30, 1, 'star', this.pal.light);
        if (this.t >= 150) this.setSt('ground');
        break;
      case 'win': case 'lose': this.friction(); break;          // animación de victoria / derrota
      case 'portal': case 'gone': this.t++; return;              // apareciendo por el portal / fuera de escena
      case 'ledge': this.stLedge(g); return;
      case 'hold': this.stHold(g); break;
      case 'grabbed': this.stGrabbed(g); return;
      case 'dead':
        if (this.t >= 70) this.respawn();
        this.t++; return;
      case 'respawn':
        this.t++;
        if (this.t > 20 && (Math.abs(I.mx) > 0.3 || I.my > 0.5 || this.buf.jump || this.buf.atk || this.buf.spc) || this.t > 180) {
          this.setSt('air'); this.invuln = 100; this.jumps = this.S.jumps;
        }
        return;
    }
    this.physics(g);
    this.updateScarf();
    this.t++;
  }

  friction() { if (this.grounded) { const f = this.S.fric * (this.plat && this.plat.fric != null ? this.plat.fric : 1); this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - sgn(this.vx) * f; } }

  stGround(g) {
    const I = this.inp;
    if (this.cstick) { const c = this.cstick; this.cBufT = 0; this.cstick = null; this.groundAttack(g, c); return; }
    if (this.use('str')) { this.groundAttack(g, this.strongDir()); return; }
    if (this.use('jump')) { this.setSt('jumpsquat'); return; }
    if (this.use('grab')) { if (!ItemSys.grabButton(this, g)) this.startMove('grab', g); return; }   // agarre · recoger · lanzar objeto
    if (I.shd) {
      if (Math.abs(I.mx) > 0.6 && this.flickX <= 3) { this.dodge(sgn(I.mx), 0, g); return; }
      if (I.my > 0.6 && this.flickY <= 3) { this.dodge(0, 0, g); return; }
      this.buf.shd = 0; this.setSt('shield'); return;
    }
    if (this.use('spc')) { this.special(g); return; }
    if (this.use('atk')) { this.groundAttack(g); return; }
    // dejarse caer de plataformas finas
    if (I.my > 0.8 && this.flickY <= 3 && this.plat && !this.plat.solid) {
      this.grounded = false; this.plat = null; this.dropT = 12; this.y += 1; this.setSt('air'); return;
    }
    if (Math.abs(I.mx) > 0.25 && I.my < 0.6) {
      const target = I.mx * this.S.walk;
      const acc = this.S.gAcc * (this.plat && this.plat.acc != null ? this.plat.acc : 1);
      this.vx += clamp(target - this.vx, -acc, acc);
      if (sgn(I.mx) !== this.dir && Math.abs(I.mx) > 0.4) this.dir = sgn(I.mx);
      this.runT = (this.runT || 0) + 1;
      if (this.runT % 14 === 1 && Math.abs(this.vx) > 1.5) g.burst(this.x - this.dir * 4, this.y, 1, 'dust');
    } else { this.friction(); this.runT = 0; }
  }

  stAir(g) {
    const I = this.inp, helpless = this.st === 'helpless';
    const spd = helpless ? this.S.airSpd * 0.6 : this.S.airSpd;
    if (Math.abs(I.mx) > 0.2) this.vx += clamp(I.mx * spd - this.vx, -this.S.aAcc, this.S.aAcc);
    else this.vx *= (1 - this.S.airFric);
    if (this.vy > 0 && I.my > 0.7 && this.flickY <= 3) this.ff = true;
    if (helpless) return;
    if (this.cstick) { const c = this.cstick; this.cBufT = 0; this.cstick = null; this.airAttack(g, c); return; }
    if (this.use('str')) { const d = this.strongDir(); this.airAttack(g, d.y ? d : (Math.abs(this.inp.mx) > 0.5 ? d : null)); return; }
    if (this.use('jump') && this.jumps > 0) {
      this.jumps--; this.vy = -this.S.djumpV; this.ff = false;
      if (Math.abs(I.mx) > 0.3) { this.vx = I.mx * this.S.airSpd; this.dir = sgn(I.mx); }
      g.burst(this.x, this.y, 4, 'dust'); Sfx.djump(); return;
    }
    if (this.use('grab')) { ItemSys.grabButton(this, g); return; }    // en el aire: atrapar o lanzar objetos
    if (this.use('shd') && !this.dodgeUsed) { this.dodge(I.mx, I.my, g, true); return; }
    if (this.use('spc')) { this.special(g); return; }
    if (this.use('atk')) { this.airAttack(g); return; }
  }

  stAttack(g) {
    const m = this.move;
    // combo asistido: avanzar hacia el rival durante el arranque del golpe
    const v = this.lungeTo;
    if (this.lunge > 0 && v && this.t < m.s + m.a && v.stunned(g) && !this.landedHit) {
      const need = Math.abs(v.x - this.x) - (this.S.hw + v.S.hw + 3);
      const st = Math.min(this.lunge, 4, Math.max(0, need)); this.lunge -= st;
      let nx = this.x + sgn(v.x - this.x) * st;
      if (this.grounded && this.plat) nx = clamp(nx, this.plat.x1 + 2, this.plat.x2 - 2);
      this.x = nx;
      // en el aire también se ajusta la altura, para que el golpe aéreo encuentre al rival
      if (!this.grounded) {
        const dy = (v.y - v.S.hh * 0.5) - (this.y - this.S.hh * 0.5);
        const sy = Math.min(this.lunge, 4, Math.max(0, Math.abs(dy) - 3)); this.lunge -= sy;
        this.y += sgn(dy) * sy; if (sy > 0 && Math.sign(this.vy) !== sgn(dy)) this.vy *= 0.5;
      }
    }
    // lanzamiento: el agarrado sigue la mano hasta que sale disparado
    if (m.throw && this.holding) {
      this.placeHeld(m.path ? m.path(this.t, this) : null);
      if (this.t === m.s) g.throwHit(this, this.holding, m.throw);
    }
    // cadena 1-2-3: volver a atacar (sin dirección) sigue la cadena, acierte o no
    const nx = JAB_NEXT[this.moveName];
    const jabOpen = this.t >= m.s + m.a - 1 || (this.landedHit && this.t > this.landedAt + 1);
    if (nx && this.grounded && !this.item && this.buf.atk && jabOpen && this.dirOf(this.inp.mx, this.inp.my) === 'neutral') {
      this.buf.atk = 0; const keepChain = this.chain; this.startMove(nx, g); this.chain = keepChain; return;
    }
    // COMBOS: si el golpe acertó, se cancela la recuperación con un ataque de nivel igual o mayor (o con un salto)
    const free = m.cancel, canChain = free || (!m.special && !m.throw && this.moveName !== 'grab');
    const wants = this.buf.jump || this.buf.atk || this.buf.spc || this.buf.str || this.cstick;
    if (canChain && this.landedHit && (this.chain || 0) < (free ? 3 : 4) && this.t > this.landedAt + 1 && wants) {
      if (!(this.buf.jump && !this.buf.atk && !this.buf.spc && !this.buf.str && !this.grounded && this.jumps <= 0)) {
        this.chain = (this.chain || 0) + 1; this.chainT = 40; this.noRepeat = this.moveName;
        // saltar para seguir en el aire vale desde cualquier golpe (también desde un fuerte)
        this.comboTier = free || this.buf.jump ? 0 : moveTier(this.moveName); this.cancelF = g.frame;
        this.move = null; this.setSt(this.grounded ? 'ground' : 'air');
        g.burst(this.x, this.y - this.S.hh * 0.6, 2, 'star', this.pal.light);
        if (this.grounded) this.stGround(g); else this.stAir(g);     // el siguiente golpe sale ya, con la dirección de ahora
        return;
      }
    }
    const chargeHeld = m.smash ? (this.inp.atk || this.inp.str || this.cHeld) : m.chargeSpc ? this.inp.spc : false;   // con mando: mantener la palanca derecha
    if (chargeHeld && this.t === m.s - 2 && this.charge < (m.maxCharge || 60)) {
      this.charge++; this.t--;
      if (this.charge % 6 === 0) g.burst(this.x + (Math.random() * 20 - 10), this.y - 10 - Math.random() * 16, 1, 'star', '#fff08c');
    }
    if (m.onFrame) m.onFrame(this, this.t, g);
    if (!m.keepVel) {
      if (this.grounded) this.friction();
      else if (Math.abs(this.inp.mx) > 0.2) this.vx += clamp(this.inp.mx * this.S.airSpd - this.vx, -this.S.aAcc * 0.8, this.S.aAcc * 0.8);
    }
    if (this.t >= m.s + m.a + m.e - 1) {
      this.move = null;
      if (m.after === 'helpless' && !this.grounded) this.setSt('helpless');
      else this.setSt(this.grounded ? 'ground' : 'air');
    }
  }

  stShield(g) {
    const I = this.inp;
    this.friction();
    this.shieldHP -= 0.14;
    if (this.shieldHP <= 0) { this.breakShield(g); return; }
    if (this.use('jump')) { this.setSt('jumpsquat'); return; }
    if (this.use('grab')) { if (!ItemSys.grabButton(this, g)) this.startMove('grab', g); return; }
    if (Math.abs(I.mx) > 0.6 && this.flickX <= 3) { this.dodge(sgn(I.mx), 0, g); return; }
    if (I.my > 0.6 && this.flickY <= 3) { this.dodge(0, 0, g); return; }
    if (!I.shd) this.setSt('ground');
  }

  dodge(dx, dy, g, air) {
    this.setSt('dodge');
    this.dodgeKind = air ? 'air' : dx ? 'roll' : 'spot';
    this.dodgeDir = dx;
    if (air) {
      this.dodgeUsed = true;
      const len = Math.hypot(dx, dy);
      if (len > 0.3) { this.vx = dx / len * 4.2; this.vy = dy / len * 4.2; } else { this.vx *= 0.3; this.vy = 0; }
    }
    if (this.dodgeKind === 'roll') this.dir = -dx;
  }
  stDodge(g) {
    const k = this.dodgeKind, t = this.t;
    if (t === 2) this.invuln = Math.max(this.invuln, 14);
    if (k === 'roll') { this.vx = t < 16 ? this.dodgeDir * 3 : this.vx * 0.6; }
    else if (k === 'spot') { this.vx = 0; }
    else { this.vx *= 0.88; this.vy *= 0.88; }
    const total = k === 'air' ? 26 : k === 'roll' ? 22 : 20;
    if (t >= total) this.setSt(this.grounded ? 'ground' : 'air');
  }

  breakShield(g) {
    this.setSt('shieldbreak'); this.shieldHP = 30; this.grounded = false; this.plat = null; this.vy = -5;
    g.burst(this.x, this.y - 12, 12, 'spark', this.pal.light); Sfx.brk(); g.shake = Math.max(g.shake, 5);
  }

  // --------- agarres ---------
  placeHeld(pos) {
    const v = this.holding; if (!v) return;
    const G = pos || this.ch.moves.grab.hold || [this.S.hw + 7, -this.S.hh * 0.45];
    v.x = this.x + this.dir * G[0]; v.y = this.y + G[1] + v.S.hh * 0.5; v.dir = -this.dir;
  }
  releaseHeld(push = 2.5) {
    const v = this.holding; if (!v) return;
    this.holding = null; v.heldBy = null;
    if (v.st === 'grabbed') { v.setSt('air'); v.lvx = this.dir * push; v.lvy = -2; v.invuln = 12; v.grounded = false; }
  }
  stHold(g) {
    const v = this.holding;
    if (!v || v.heldBy !== this) { this.holding = null; this.setSt(this.grounded ? 'ground' : 'air'); return; }
    this.friction(); this.placeHeld();
    if (this.t < 6) return;
    const I = this.inp; let th = null;
    if (I.my < -0.6) th = 'uthrow';
    else if (I.my > 0.6) th = 'dthrow';
    else if (Math.abs(I.mx) > 0.6) th = sgn(I.mx) === this.dir ? 'fthrow' : 'bthrow';
    else if (this.use('atk') || this.t >= 80) th = 'fthrow';
    if (th) { const keep = this.holding; this.startMove(th, g); this.holding = keep; }
  }
  stGrabbed(g) {
    const h = this.heldBy;
    this.t++; this.animT++;
    if (!h || h.holding !== this) { this.heldBy = null; this.setSt('air'); return; }
    // machacar botones ayuda a soltarse
    if (['atk', 'spc', 'jump', 'shd'].some(k => this.buf[k] === 6) || (Math.abs(this.inp.mx) > 0.6 && Math.abs(this.prev.mx) < 0.4)) this.mash = (this.mash || 0) + 1;
    const limit = 70 + this.dmg * 0.4 - (this.mash || 0) * 5;
    if (h.st === 'hold' && this.t > limit) { h.releaseHeld(2.5); h.lag = 14; h.setSt('landing'); g.burst(this.x, this.y - 10, 4, 'dust'); }
  }

  // --------- borde del escenario ---------
  tryLedge(g) {
    if (this.ledgeCD > 0 || this.vy < 0 || this.grounded) return false;
    const M = STAGE.main;
    for (const side of [-1, 1]) {
      const lx = side < 0 ? M.x1 : M.x2;
      const reach = this.S.hw + 10;
      const outside = side < 0 ? (this.x < lx + 2 && this.x > lx - reach) : (this.x > lx - 2 && this.x < lx + reach);
      if (!outside || this.y < M.y + 4 || this.y > M.y + this.S.hh + 6) continue;
      if (g.fighters.some(o => o !== this && o.st === 'ledge' && o.ledgeSide === side)) continue;
      this.setSt('ledge'); this.ledgeSide = side;
      this.dir = -side; this.x = lx + side * (this.S.hw - 1); this.y = M.y + this.S.hh - 5;
      this.vx = this.vy = this.lvx = this.lvy = 0; this.ff = false;
      this.jumps = this.S.jumps; this.upUsed = this.sideUsed = this.dodgeUsed = false;
      this.invuln = Math.max(this.invuln, 40); this.move = null;
      Sfx.land();
      return true;
    }
    return false;
  }
  stLedge(g) {
    const I = this.inp, side = this.ledgeSide, M = STAGE.main;
    this.t++; this.animT++;
    if (this.t < 8) { this.use('jump'); return; }
    const toward = I.mx * -side > 0.5, away = I.mx * side > 0.5;
    if (this.use('jump') || I.my < -0.6) {
      this.setSt('air'); this.vy = -this.S.jumpV; this.y -= 4; this.ledgeCD = 20; Sfx.jump(); return;
    }
    if (toward || this.use('atk') || this.use('spc')) {
      this.x = (side < 0 ? M.x1 : M.x2) - side * (this.S.hw + 4); this.y = M.y; this.grounded = true; this.plat = M;
      this.lag = 8; this.setSt('landing'); this.invuln = Math.max(this.invuln, 10); return;
    }
    if (away || I.my > 0.6 || this.t > 300) {
      this.setSt('air'); this.ledgeCD = 30; this.x += side * 2; return;
    }
  }

  // --------- física y colisión ---------
  physics(g) {
    const M = STAGE.main;
    const noGrav = this.st === 'attack' && this.move && this.move.noGrav && this.move.noGrav(this, this.t);
    const freeze = this.st === 'dodge' && this.dodgeKind === 'air' && this.t < 18;
    if (!this.grounded && !noGrav && !freeze) {
      const grav = (this.st === 'hitstun' ? this.S.grav * (this.floatT > 0 ? 0.45 : 0.9) : this.S.grav) * (STAGE.grav || 1);   // tras un ataque hacia arriba flota un poco
      this.vy += grav;
      const cap = this.ff ? this.S.fastFall : this.S.maxFall;
      if (this.vy > cap) this.vy = this.ff ? cap : Math.max(cap, this.vy - 0.6);
      if (this.ff && this.vy >= 0) this.vy = this.S.fastFall;
    }
    // empuje de los golpes (se va frenando)
    this.lvx *= PH.decay; this.lvy *= PH.decay;
    if (Math.abs(this.lvx) < 0.05) this.lvx = 0;
    if (Math.abs(this.lvy) < 0.05) this.lvy = 0;
    if (this.st === 'hitstun' && (Math.hypot(this.lvx, this.lvy) > 5) && this.t % 2 === 0) g.burst(this.x, this.y - 12, 1, 'smoke');
    if (this.trail) { g.burst(this.x - this.dir * 4, this.y - 12, 1, 'spark', this.pal.light); this.trail = 0; }

    const ox = this.x, oy = this.y;
    let nx = this.x + this.vx + this.lvx, ny = this.y + (this.grounded ? 0 : this.vy + this.lvy);

    if (this.grounded) {
      // si se sale de la plataforma, cae
      const p = this.plat;
      if (!p || nx < p.x1 - 1 || nx > p.x2 + 1) {
        this.grounded = false; this.plat = null;
        if (this.st === 'ground') this.setSt('air');
      } else ny = p.y;
      // empuje vertical hacia arriba despega del suelo
      if (this.lvy < -1.5 || this.vy < -0.5) { this.grounded = false; this.plat = null; ny = this.y + this.vy + this.lvy; }
    }

    if (!this.grounded) {
      const fallingVy = this.vy + this.lvy;
      // aterrizar sobre el escenario principal
      // (misma tolerancia que al salirse del borde: si no, quien se para justo en la esquina
      //  se cae y vuelve a aterrizar cada frame, atrapado en "aterrizaje" sin poder moverse)
      if (fallingVy >= 0 && oy <= M.y && ny >= M.y && nx >= M.x1 - 1 && nx <= M.x2 + 1) {
        ny = M.y; this.land(M, g);
      } else if (fallingVy >= 0 && this.dropT <= 0 && !(this.st === 'hitstun' && this.inp.my > 0.7)) {
        for (const p of STAGE.plats) {
          if (oy <= (p.prevY ?? p.y) + 0.5 && ny >= p.y && nx >= p.x1 - 1 && nx <= p.x2 + 1 &&!(this.inp.my > 0.8 && this.st !== 'hitstun' && this.st !== 'attack')) {
            ny = p.y; this.land(p, g); break;
          }
        }
      }
      // paredes y techo del escenario principal (bloque sólido)
      if (!this.grounded && ny > M.y + 1 && ny - this.S.hh < M.bottom && nx + this.S.hw > M.x1 && nx - this.S.hw < M.x2) {
        // sacarlo por el lado en el que menos se ha metido (en el centro siempre es hacia arriba)
        const penTop = ny - M.y, penL = nx + this.S.hw - M.x1, penR = M.x2 - (nx - this.S.hw), penBot = M.bottom - (ny - this.S.hh);
        const minPen = Math.min(penTop, penL, penR, penBot);
        const offTop = nx < M.x1 - 1 || nx > M.x2 + 1;
        if (offTop && penTop < this.S.hh) {
          // con el centro ya fuera del borde: resbalar fuera de la esquina en vez de volver a
          // subirlo arriba (eso lo dejaba cayendo y aterrizando en bucle, "apagado")
          const side = nx < (M.x1 + M.x2) / 2 ? -1 : 1;
          nx += side * Math.min(side < 0 ? penL : penR, 2);
        } else if (minPen === penTop || (oy <= M.y + 2 && penTop < this.S.hh)) {
          ny = M.y; this.land(M, g);
        } else if (minPen === penBot) { ny = M.bottom + this.S.hh; this.vy = Math.max(0, this.vy); this.lvy = Math.abs(this.lvy) * 0.4; }
        else {
          nx = penL < penR ? M.x1 - this.S.hw : M.x2 + this.S.hw;
          if (this.st === 'hitstun' && Math.abs(this.lvx) > 3) { this.lvx = -this.lvx * 0.5; g.burst(nx, ny - 12, 4, 'dust'); }
          else { this.vx = 0; this.lvx = 0; }
        }
      }
    }
    this.x = nx; this.y = ny;
    if (!this.grounded && (this.st === 'air' || this.st === 'helpless' || (this.st === 'attack' && this.move && this.move.recovery && this.t > 10))) this.tryLedge(g);
  }

  land(p, g) {
    const speed = this.vy + this.lvy;
    // rebote si cae con mucha fuerza durante un golpe
    if (this.st === 'hitstun' && this.lvy > 3.5) {
      this.lvy = -this.lvy * 0.45; this.vy = 0; g.burst(this.x, p.y, 5, 'dust'); Sfx.land(); return;
    }
    this.grounded = true; this.plat = p; this.vy = 0; this.lvy = 0; this.ff = false;
    this.jumps = this.S.jumps; this.upUsed = false; this.sideUsed = false; this.dodgeUsed = false;
    if (speed > 2) { g.burst(this.x, p.y, 3, 'dust'); Sfx.land(); }
    switch (this.st) {
      case 'air': this.lag = 3; this.setSt('landing'); break;
      case 'helpless': this.lag = 10; this.setSt('landing'); break;
      case 'hitstun': this.lag = 14; this.setSt('landing'); this.lvx *= 0.5; this.stunEndF = g.frame + 14; break;   // el aterrizaje aún cuenta para el combo
      case 'dodge': if (this.dodgeKind === 'air') { this.lag = 8; this.setSt('landing'); } break;
      case 'attack': {
        const m = this.move;
        if (m.landTo) { this.startMove(m.landTo, g); }
        else if (m.air) { this.move = null; this.lag = m.land || 4; this.setSt('landing'); }
        break;
      }
    }
  }

  respawn() {
    const R = STAGE.respawn;
    this.x = R.x; this.y = R.y; this.vx = this.vy = this.lvx = this.lvy = 0;
    this.dmg = 0; this.burn = 0; this.grounded = false; this.plat = null; this.dir = 1;
    this.setSt('respawn'); this.invuln = 120; this.scarf = null;
    this.jumps = this.S.jumps; this.upUsed = this.sideUsed = this.dodgeUsed = false; this.shieldHP = 50;
  }

  updateScarf() {
    const ax = this.x - this.dir * 1, ay = this.y - Math.round(this.S.hh * 0.66);
    if (!this.scarf) { this.scarf = []; for (let i = 0; i < (this.ch.chain || 6); i++) this.scarf.push([ax - this.dir * (i + 1) * 2, ay + i * 0.5]); }
    let px0 = ax, py0 = ay;
    const wind = Math.sin(this.animT * 0.15) * 0.4;
    for (let i = 0; i < this.scarf.length; i++) {
      const q = this.scarf[i];
      q[1] += 0.25 + wind * 0.3;           // gravedad + ondeo
      q[0] -= this.dir * 0.15;
      const dx = q[0] - px0, dy = q[1] - py0, d = Math.hypot(dx, dy) || 1, seg = 2;
      q[0] = px0 + dx / d * seg; q[1] = py0 + dy / d * seg;
      px0 = q[0]; py0 = q[1];
    }
  }
}
