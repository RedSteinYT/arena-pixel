'use strict';
// ============================================================
//  Partida: reglas, golpes, KOs, cámara y dibujo
// ============================================================


function fullName(f) { return (f.cpu ? 'CPU ' + f.pal.name.toUpperCase() : f.cfg && f.cfg.name ? f.cfg.name : f.label) + ' · ' + f.ch.name.toUpperCase(); }

// corazón de rubí de 7×6 para las vidas. lit: si aún la tienes · ph: fase del destello (0-9 = brillando)
const RUBY = ['.11.11.', '1222221', '1222223', '.12223.', '..133..', '...3...'];
function drawRuby(c, x, y, lit, ph) {
  const cols = lit ? { 1: '#ff5a7a', 2: '#d81e46', 3: '#8a0f2a' } : { 1: '#4a4468', 2: '#3a3555', 3: '#2c2844' };
  for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) if (RUBY[r][k] !== '.')            // contorno
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dy, kk = k + dx; if (rr < 0 || rr > 5 || kk < 0 || kk > 6 || RUBY[rr][kk] === '.') px(c, x + kk, y + rr, OUTLINE); }
  for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) { const ch = RUBY[r][k]; if (ch !== '.') px(c, x + k, y + r, cols[ch]); }
  if (!lit) return;
  px(c, x + 1, y + 1, '#ffd0da');                          // punto de luz fijo
  if (ph < 10) for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++)   // destello diagonal que cruza la gema
    if (RUBY[r][k] !== '.' && (k + r === ph - 1 || k + r === ph - 2)) px(c, x + k, y + r, '#ffffff', k + r === ph - 1 ? 0.9 : 0.5);
}

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
    // temporizador (frames; 0 = sin límite), muerte súbita, secuencia final y cámara
    this.timeLeft = cfg.time ? cfg.time * 3600 : 0;
    this.sd = false;
    this.endSeq = null;
    this.cam = { x: W / 2, y: H / 2, z: 1 };
    this.cloudX = 0;
    // objetos
    this.items = []; this.itemsOn = cfg.items !== false; this.itemT = 240 + (Math.random() * 180 | 0);
  }

  allies(a, b) { return this.teams && a.team === b.team; }
  sideOf(f) { return this.teams ? 'T' + f.team : 'P' + f.slot; }

  // ---------- un paso de simulación (1/60 s) ----------
  step(inputs) {
    STAGE = this.stage;
    this.frame++; this.phaseT++;
    this.cloudX += 0.12;
    stepStage(this.stage, this);
    this.stepCam();
    if (this.finalSlow && this.slow <= 0 && this.phase === 'play') this.finalSlow = false;   // se salvó: falsa alarma
    if (this.slow > 0) { this.slow--; if (this.slow % 3 !== 0) { this.stepFx(); return; } }

    for (const f of this.fighters) {
      if (f.out) continue;
      let inp = blankInput();
      if (this.phase === 'play') inp = f.cpu ? aiInput(f, this) : (inputs[f.device] || blankInput());
      f.takeInput(inp);
      f.update(this);
    }
    this.hitDetection();
    this.stepProjectiles();
    ItemSys.step(this);
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
      if (sides.size <= 1) this.beginEnd('ko');
      else if (this.timeLeft > 0 && !this.sd) {
        this.timeLeft--;
        if (this.timeLeft > 0 && this.timeLeft <= 300 && this.timeLeft % 60 === 0) Sfx.count(false);   // últimos 5 segundos
        if (this.timeLeft === 0) this.timeUp();
      }
    } else if (this.phase === 'sdintro') {
      for (const f of this.fighters) if (!f.out) f.dmg = 300;
      if (this.phaseT >= 150) { this.phase = 'play'; this.phaseT = 0; Sfx.count(true); }
    } else if (this.phase === 'end') this.stepEnd();
  }

  // ============================================================
  //  FIN DE LA PELEA
  // ============================================================
  // se acabó el tiempo: gana quien tenga más vidas; si hay empate, MUERTE SÚBITA
  timeUp() {
    const score = {};
    for (const f of this.fighters) if (!f.out) score[this.sideOf(f)] = (score[this.sideOf(f)] || 0) + f.stocks;
    const best = Math.max(...Object.values(score));
    const top = Object.keys(score).filter(k => score[k] === best);
    Sfx.ko();
    if (top.length === 1) return this.beginEnd('time', this.fighters.filter(f => this.sideOf(f) === top[0]));
    this.startSuddenDeath(top);
  }
  startSuddenDeath(top) {
    const M = STAGE.main, inSD = this.fighters.filter(f => !f.out && top.includes(this.sideOf(f)));
    for (const f of this.fighters) if (!f.out && !inSD.includes(f)) { f.out = true; f.st = 'dead'; this.placing.push(f); }
    this.projectiles = []; this.items = [];
    inSD.forEach((f, i) => {                                // separados a lo largo del escenario, mirando al centro
      const x = Math.round(M.x1 + (i + 1) * (M.x2 - M.x1) / (inSD.length + 1));
      if (f.holding) f.releaseHeld();
      if (f.heldBy) { f.heldBy.holding = null; f.heldBy = null; }
      f.item = null; f.buffs = {}; ItemSys.refreshStats(f);
      f.spawn(x, M.y, x < W / 2 ? 1 : -1);
      f.stocks = 1; f.dmg = 300; f.burn = 0; f.comboN = 0; f.comboT = 0; f.remateT = 0;
      this.burst(x, M.y - 14, 10, 'star', f.pal.light);
    });
    this.sd = true; this.phase = 'sdintro'; this.phaseT = 0; this.shake = 8;
    Sfx.remate();
  }
  // ¿perder esta vida acabaría la pelea?
  lastStock(d) {
    if (d.stocks !== 1) return false;
    if (this.fighters.some(f => f !== d && !f.out && this.sideOf(f) === this.sideOf(d))) return false;
    return new Set(this.fighters.filter(f => f !== d && !f.out).map(f => this.sideOf(f))).size <= 1;
  }
  // ¿ese lanzamiento lo saca por un lateral o por arriba antes de recuperarse? (vuelo sin obstáculos)
  predictKO(d, lvx, lvy, stun) {
    const B = STAGE.blast, g = d.S.grav * 0.9 * (STAGE.grav || 1);
    let x = d.x, y = d.y, vy = 0;
    for (let i = 0; i < stun; i++) {
      vy = Math.min(vy + g, d.S.maxFall); lvx *= PH.decay; lvy *= PH.decay;
      x += lvx; y += vy + lvy;
      if (x < B.l || x > B.r || y < B.t) return i + 1;              // fotogramas hasta salir
    }
    return 0;                                                    // solo si el vuelo lo saca seguro (sin falsas alarmas)
  }
  // empieza la secuencia final. reason: 'ko' (sin vidas) o 'time' (tiempo agotado)
  beginEnd(reason, winners) {
    if (!winners) {
      const left = this.fighters.filter(f => !f.out);
      if (left.length) winners = this.fighters.filter(f => this.sideOf(f) === this.sideOf(left[0]));
      else {                                                // cayeron los últimos a la vez: gana el que cayó el último
        const lastOut = this.placing[this.placing.length - 1];
        winners = this.fighters.filter(f => this.sideOf(f) === this.sideOf(lastOut));
      }
    }
    const losers = reason === 'time' ? this.fighters.filter(f => !f.out && !winners.includes(f)) : [];
    this.phase = 'end'; this.phaseT = 0;
    this.endSeq = { reason, winners, losers, step: 'settle', t: 0, done: false, focus: null, portal: [] };
    if (reason === 'ko' && !this.finalSlow) { this.slow = 66; this.shake = Math.max(this.shake, 6); }   // si no se vio venir, cámara lenta ahora
    for (const f of [...winners, ...losers]) f.invuln = 9999;
  }
  // ¿se le ve de pie en el escenario?
  standing(f) { return !f.out && f.grounded && ['ground', 'landing', 'attack', 'shield', 'win', 'lose'].includes(f.st) && f.x > 8 && f.x < W - 8; }
  stepEnd() {
    const E = this.endSeq; if (!E) return;
    E.t++;
    const M = STAGE.main, group = [...E.winners, ...E.losers];
    if (E.step === 'settle') {
      // esperar a que todos aterricen (o un máximo de tiempo)
      const ready = group.every(f => this.standing(f) || f.st === 'gone' || f.out || f.st === 'dead' || f.st === 'respawn');
      if (!(ready && E.t > 20) && E.t < 110) return;
      for (const f of E.losers) if (this.standing(f)) { f.move = null; f.setSt('lose'); f.animT = 0; f.vx = 0; }
      const lost = E.winners.filter(f => !this.standing(f));
      if (lost.length) {                                    // un ganador ya no está: vuelve por un portal
        const anchor = E.winners.find(f => this.standing(f));
        const P = anchor && anchor.plat ? anchor.plat : M;
        lost.forEach((f, i) => {
          let x;
          if (anchor) {                                     // al lado de su compañero, alternando lados
            const side = i % 2 ? -1 : 1, step = Math.ceil((i + 1) / 2);
            x = anchor.x + side * anchor.dir * step * (anchor.S.hw + f.S.hw + 12);
            if (x < P.x1 + f.S.hw + 2 || x > P.x2 - f.S.hw - 2) x = anchor.x - side * anchor.dir * step * (anchor.S.hw + f.S.hw + 12);
            x = clamp(x, P.x1 + f.S.hw + 2, P.x2 - f.S.hw - 2);
          } else x = (M.x1 + M.x2) / 2 + (i - (lost.length - 1) / 2) * 34;   // nadie en pie: en el centro
          x = Math.round(x);
          f.out = false; f.spawn(x, P.y, anchor ? sgn(anchor.x - x) || 1 : (x < W / 2 ? 1 : -1)); f.setSt('portal'); f.invuln = 9999;
        });
        E.step = 'portal'; E.t = 0; E.portal = lost;
        E.focus = this.focusOn(anchor ? [anchor, ...lost] : lost) || { x: (M.x1 + M.x2) / 2, y: M.y - 34, z: 2 };
        Sfx.powerup();
        return;
      }
      this.startPoses();
    } else if (E.step === 'portal') {
      if (E.t >= 84) {
        for (const f of E.portal) { f.setSt('ground'); this.burst(f.x, f.y - 14, 14, 'star', f.pal.light); }
        Sfx.remate(); this.startPoses();
      }
    } else if (E.step === 'pose') {
      // efectos de las poses (estrellitas, polvo del golpe al suelo, temblor del rugido, llamas)
      for (const f of E.winners) if (f.st === 'win') {
        const p = f._pose || {};
        if (E.t % 26 === 0) this.burst(f.x, f.y - f.S.hh - 6, 3, 'star', f.pal.light);
        if (p.slam && !f._slam) { this.burst(f.x + f.dir * 12, f.y, 8, 'dust'); this.shake = Math.max(this.shake, 4); Sfx.hit(5); }
        f._slam = !!p.slam;
        if (p.roar && E.t % 6 === 0) this.shake = Math.max(this.shake, 2);
        if (p.fire && E.t % 3 === 0 && p.fh) this.burst(f.x + f.dir * p.fh[0], f.y + p.fh[1] - 14, 1, 'fire');
      }
      for (const f of E.losers) if (f.st === 'lose' && f.ch.id === 'maniqui' && f.animT % 50 < 5) this.burst(f.x - f.dir * 2, f.y - f.S.hh, 1, 'spark', '#ffe066');
      if (E.t >= 210) E.done = true;
    }
  }
  startPoses() {
    const E = this.endSeq;
    for (const f of E.winners) if (this.standing(f)) { f.move = null; f.setSt('win'); f.animT = 0; f.vx = 0; this.burst(f.x, f.y - f.S.hh, 10, 'star', '#ffd34a'); }
    // cámara: zoom a los protagonistas si están cerca; si están muy separados, sin zoom
    const who = (E.reason === 'time' ? [...E.winners, ...E.losers] : E.winners).filter(f => f.st === 'win' || f.st === 'lose');
    if (!E.focus && who.length) E.focus = this.focusOn(who);
    E.step = 'pose'; E.t = 0;
    Sfx.vsSwing();
  }
  // encuadre para un grupo: zoom si están cerca; si están muy separados, sin zoom (null)
  focusOn(list) {
    let x1 = 1e9, x2 = -1e9, y1 = 1e9, y2 = -1e9;
    for (const f of list) { x1 = Math.min(x1, f.x - f.S.hw); x2 = Math.max(x2, f.x + f.S.hw); y1 = Math.min(y1, f.y - f.S.hh); y2 = Math.max(y2, f.y); }
    const z = Math.min(2.2, W / (x2 - x1 + 120), H / (y2 - y1 + 90));
    return z >= 1.35 ? { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, z } : null;
  }
  // cámara suave hacia el objetivo (sin salirse del escenario)
  stepCam() {
    const E = this.endSeq;
    let T = E && E.focus && E.step !== 'settle' ? E.focus : { x: W / 2, y: H / 2, z: 1 };
    // con los resultados en pantalla, el ganador sube a la parte de arriba para que el cuadro no lo tape
    if (E && E.done && T.z > 1) T = { x: T.x, y: T.y + H * 0.18 / T.z, z: T.z };
    const c = this.cam, k = 0.07;
    c.z += (T.z - c.z) * k; c.x += (T.x - c.x) * k; c.y += (T.y - c.y) * k;
    if (Math.abs(c.z - T.z) < 0.002) c.z = T.z;
    const hw = W / 2 / c.z, hh = H / 2 / c.z;
    c.x = clamp(c.x, hw, W - hw); c.y = clamp(c.y, hh, H - hh);
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
    if (ItemSys.absorbs(d, this, hx, hy)) { a.landedHit = true; a.landedAt = a.t; a.hitlag = 3; return; }   // burbuja / invencible
    if (a.buffs && a.buffs.power > 0) { mult *= 1.35; h = Object.assign({}, h, { burn: Math.max(h.burn || 0, 70) }); }   // aura de fuego
    // combo: golpes seguidos mientras el rival no se ha recuperado
    // (con un pequeño margen: si acaba de recuperarse, el golpe aún cuenta para el combo)
    const inCombo = a !== d && d.comboBy === a && d.st !== 'shield' &&
      (d.st === 'hitstun' || d.st === 'grabbed' || (d.stunEndF != null && this.frame - d.stunEndF <= 10));
    d.comboN = inCombo ? d.comboN + 1 : 1; d.comboBy = a; d.comboT = 110;
    if (a !== d && d.comboN > a.bestCombo) a.bestCombo = d.comboN;
    if (d.comboN > 1) mult *= Math.max(0.65, 1 - 0.06 * (d.comboN - 1));          // cada golpe del combo pega algo menos
    // ¡REMATE!: cerrar un combo de 3+ golpes con un fuerte o un especial (o de 4+ con el golpe final de la cadena)
    const remate = a.move && ((d.comboN >= 3 && (a.move.smash || a.move.special || moveTier(a.moveName) >= 3)) || (d.comboN >= 4 && a.move.finisher));
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
    d.comboDmg = (d.comboN > 1 ? (d.comboDmg || 0) : 0) + dmg;            // daño del combo (para la práctica)
    if (h.burn) d.burn = Math.max(d.burn || 0, h.burn);        // quemadura
    a.dealt += dmg;
    let kb = (h.b + h.g * (d.dmg / 100)) * (1 + (mult - 1) * 0.6);
    kb *= 200 / (100 + d.S.weight);           // peso: los pesados vuelan menos
    if (remate) kb *= 1.25;                    // ¡REMATE!: el final de un buen combo lanza más
    const long = d.comboN > 5;                 // tras 5 golpes ya no hay ayudas: el rival se escapa (sin combos infinitos)
    const link = !long && (a.moveName === 'jab' || a.moveName === 'jab2');   // golpes de enlace: empujan poco para que entre el siguiente
    if (link) kb = Math.min(kb, 0.8);
    kb = Math.min(kb, 22);
    const ang = h.ang * Math.PI / 180;
    let lx = Math.cos(ang) * kb * dirSign, ly = -Math.sin(ang) * kb;
    if (d.grounded && ly > 0) { ly = -ly * 0.6; }                 // golpe hacia abajo en el suelo: rebota
    if (d.grounded && kb < 4 && Math.abs(h.ang) < 50) ly = 0;     // golpes flojos: se queda en el suelo
    // en mitad de un combo, los golpes normales empujan menos (el rival no se escapa por el propio golpe)
    if (d.comboN >= 2 && !long && !remate && a.move && !a.move.smash && !a.move.special && !a.move.finisher && d.grounded) lx *= 0.5;
    if (long && Math.abs(lx) < 2.6) lx = (dirSign || 1) * 2.6;    // combo muy largo: el rival sale despedido y se escapa
    if (a.move && a.move.popup && !long) {           // el ataque hacia arriba siempre levanta (también a 0 %) y el rival flota un poco: da tiempo a saltar y seguir
      if (ly > -5.4) ly = -5.4;
      d.floatT = 44;
    }
    // MUERTE SÚBITA: cualquier roce lanza fuera de la arena, sin importar el peso ni la dirección del golpe
    if (this.sd) {
      const sx = dirSign || (d.x < a.x ? -1 : 1), a2 = Math.max(32, Math.min(60, Math.abs(h.ang) || 40)) * Math.PI / 180;
      lx = sx * Math.cos(a2) * 11; ly = -Math.sin(a2) * 11; kb = 22;
      d.sdLaunch = true;                                   // el impulso no se frena en el aire (ver física)
    }
    d.lvx = lx; d.lvy = ly; d.vx = 0; d.vy = 0; d.ff = false;
    const flight = this.phase === 'play' && !this.finalSlow && this.lastStock(d) ? (this.sd ? Math.ceil(Math.max(30, lx > 0 ? STAGE.blast.r - d.x : d.x - STAGE.blast.l) / Math.max(1, Math.abs(lx))) : this.predictKO(d, lx, ly, Math.round(kb * 3.6))) : 0;
    if (flight) { this.finalSlow = true; this.slow = Math.min(240, (flight + 8 + this.fighters.length) * 3 + 30); this.shake = Math.max(this.shake, 8); }   // ¡golpe final!: cámara lenta todo el vuelo
    if (ly < -0.5) { d.grounded = false; d.plat = null; }
    if (d.st === 'ledge') { d.grounded = false; }
    d.move = null; d.hidden = false;
    d.setSt('hitstun');
    d.stun = Math.round(kb * 3.6);
    // aturdimiento mínimo para que los combos encadenen (los golpes normales, no los fuertes ni los especiales)
    if (!long && a.move && a.st === 'attack' && !a.move.smash && !a.move.special) d.stun = Math.max(d.stun, link ? 22 : 20);
    if (d.floatT > 0 && a.move && a.move.popup) d.stun = Math.max(d.stun, 40);   // mientras flota sigue aturdido
    if (this.sd) d.stun = 999;                         // muerte súbita: no se recupera hasta salir de la pantalla
    d.flash = 4;
    d.upUsed = false; d.sideUsed = false; d.dodgeUsed = false;
    d.lastHitBy = a; d.lastHitT = this.frame;
    const lag = Math.min(14, 3 + Math.floor(dmg / 2.5) + (kb > 10 ? 3 : 0));
    a.hitlag = lag; d.hitlag = lag;
    this.spark(hx, hy, 5 + dmg * 0.8 + kb * 0.4, kb > 9 ? '#ffd34a' : a.pal.light);
    if (kb > 8) { this.shake = Math.max(this.shake, Math.min(10, kb * 0.5)); }
    Sfx.hit(kb);
    if (remate) {
      d.remateT = 70; this.slow = Math.max(this.slow, 24); this.shake = Math.max(this.shake, 8);
      this.spark(hx, hy, 24, '#ffd34a'); this.burst(hx, hy, 10, 'star', '#ffd34a');
      Sfx.remate();
    } else if (d.comboN >= 3) Sfx.combo(d.comboN);
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
    if (!spec.silent) Sfx.shoot();
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
    if (this.phase === 'end') {                           // en la secuencia final nadie pierde vidas
      this.burst(clamp(f.x, 4, W - 4), clamp(f.y, 4, H - 4), 10, 'spark', f.pal.light);
      f.st = 'gone'; f.vx = f.vy = f.lvx = f.lvy = 0; f.x = -999; f.y = -999;
      return;
    }
    const ex = clamp(f.x, 4, W - 4), ey = clamp(f.y - 12, 4, H - 4);
    const ang = Math.atan2(H / 2 - ey, W / 2 - ex);
    this.fx.push({ kind: 'ko', x: ex, y: ey, ang, t: 0, life: 50, col: f.pal.main });
    this.burst(ex, ey, 18, 'spark', f.pal.light);
    this.shake = 12;
    Sfx.ko();
    if (f.holding) f.releaseHeld();
    if (f.heldBy) { f.heldBy.holding = null; f.heldBy = null; }
    ItemSys.onKO(f);                                       // se pierden el objeto y los poderes
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
    const st = this.stage, def = st.def, cam = this.cam, zoomed = cam.z > 1.01;
    c.save();
    if (zoomed) { c.translate(W / 2, H / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y); }
    def.renderBack(c, st, this);
    c.drawImage(def.art.stage, 0, 0);
    if (def.renderMid) def.renderMid(c, st, this);

    for (const f of this.fighters) if (f.st === 'respawn') drawRespawnPad(c, f, this.frame);
    ItemSys.drawGround(c, this);
    // luchadores (el que está atacando, delante)
    const order = this.fighters.filter(f => f.alive()).sort((a, b) => (a.st === 'attack') - (b.st === 'attack'));
    for (const f of order) {
      if (f.st === 'respawn' || f.st === 'grabbed' || f.st === 'gone' || f.st === 'portal') continue;
      const surf = surfaceBelow(f.x, f.y);
      if (surf) { const d = surf.y - f.y; if (d < 140) shadow(c, f.x, surf.y, (f.S.hw + 3) * (1 - d / 220), 0.38 * (1 - d / 140)); }
    }
    for (const f of order) {
      if (f.st === 'gone') continue;
      if (f.st === 'portal') { drawPortal(c, f, this.frame); continue; }
      renderFighter(c, f, this.frame);
      if (f.ch.overlay) f.ch.overlay(c, f, this.frame);
      ItemSys.drawHeld(c, f, this);
      ItemSys.drawBuffs(c, f, this);
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
      if (!f.alive() || f.st === 'gone' || f.st === 'portal' || f.st === 'win' || f.st === 'lose') continue;   // en las poses, sin etiqueta
      const off = f.x < 0 || f.x > W || f.y < 8 || f.y - 12 > 228;
      if (off && f.st !== 'respawn') drawOffscreen(c, f, f.label);
      else drawTag(c, f, f.label);
    }
    c.restore();
    if (cam.z < 1.02) this.renderHudArt(c);       // con zoom, el marcador se esconde (que se luzcan)
  }

  hudLayout() {
    const n = this.fighters.length, w = 108, gap = 6;
    const total = n * w + (n - 1) * gap, x0 = Math.round((W - total) / 2);
    return this.fighters.map((f, i) => ({ f, x: x0 + i * (w + gap), y: 228, w, h: 38 }));
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
    if (this.phase === 'sdintro') {                  // banda oscura para que se lea MUERTE SÚBITA
      const k = Math.min(1, this.phaseT / 10);
      rect(c, 0, 30, W, Math.round(112 * k), '#0c0a24', 0.55);
      rect(c, 0, 30, W, 1, '#ff4a3a', 0.8 * k); rect(c, 0, 30 + Math.round(112 * k), W, 1, '#ff4a3a', 0.8 * k);
    }
    if (this.cfg.time && !this.sd) {                // temporizador arriba en el centro
      rect(c, W / 2 - 38, 2, 76, 22, OUTLINE, 0.9); rect(c, W / 2 - 37, 3, 74, 20, '#0c0a24', 0.8);
      rect(c, W / 2 - 37, 3, 74, 1, this.timeLeft <= 600 ? '#ff4a3a' : '#43c6f0', 0.9);
    }
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
      f.ch.portrait(c, x + 14, y + 20, pal, 2);
      if (this.teams) rect(c, x + w - 9, y + 3, 4, 4, f.team === 0 ? '#e8443f' : '#3d7ef2');
      // vidas: corazones de rubí (los perdidos quedan apagados), con un destello de gema de vez en cuando
      if (!this.cfg.practice && !this.cfg.tutorial) {
        const total = this.sd ? 1 : Math.min(5, Math.max(this.cfg.stocks || 0, f.stocks)), left = Math.min(f.stocks, 5);
        for (let i = 0; i < total; i++) drawRuby(c, x + 37 + i * 10, y + 29, i < left, (this.frame + i * 7) % 170);
      }
      if (!f.out) ItemSys.drawHud(c, f, x + 2, y - 18);    // objeto en la mano y poderes activos
    }
  }

  // ---------- texto (pantalla a resolución real) ----------
  renderText(t) {
    if (this.cam.z >= 1.02) return this.renderEndText(t);       // con zoom, solo los textos de la secuencia final
    if (this.cfg.time && !this.sd) {
      const s = Math.ceil(this.timeLeft / 60), last = s <= 10;
      const str = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      t.text(str, W / 2 + (last && this.timeLeft % 60 > 50 ? 1 : 0), 5, 16, last ? '#ff4a3a' : '#ffffff', 'center');
    }
    for (const { f, x, y } of this.hudLayout()) {
      t.text(f.label, x + 37, y + 3, 8, f.out ? '#6c6890' : '#ffffff');
      if (f.out) { t.text('FUERA', x + 40, y + 16, 8, '#6c6890'); continue; }
      const d = Math.floor(f.dmg);
      const col = d < 50 ? '#ffffff' : d < 90 ? '#ffe27a' : d < 130 ? '#ff9a4a' : d < 180 ? '#ff4a3a' : '#d01a3a';
      const shakeX = f.flash > 0 ? (Math.random() * 2 - 1) : 0;
      t.text(d + '%', x + 104 + shakeX, y + 11, 16, col, 'right');          // debajo del nombre: 3 cifras no lo tapan
      if (f.stocks > 5 && !this.cfg.practice && !this.cfg.tutorial) t.text('x' + f.stocks, x + 88, y + 29, 8, '#ff8aa0');
    }
    if (this.phase === 'end') return this.renderEndText(t);
    // contador de combo sobre el rival y ¡REMATE!
    for (const f of this.fighters) {
      if (!f.alive() || f.st === 'respawn' || !f.comboBy) continue;
      const y = clamp(f.y - f.S.hh - 26, 26, H - 60);
      const cx = (str, size) => { const half = str.length * size / 2 + 4; return clamp(f.x, half, W - half); };   // que el texto no se salga de la pantalla
      if (f.remateT > 0) {
        const pop = f.remateT > 62 ? 24 : 16;
        t.text('¡REMATE!', cx('¡REMATE!', pop), y - (pop > 16 ? 30 : 22), pop, '#ffd34a', 'center');
      }
      if (f.comboN >= 2 && f.comboT > 0 && ((f.comboT > 20) || (f.comboT >> 2) % 2)) {
        const big = f.comboN >= 5, col = f.comboBy.pal ? f.comboBy.pal.light : '#ffffff';
        const str = f.comboN + (big ? ' GOLPES!' : ' GOLPES');
        t.text(str, cx(str, big ? 16 : 8), y, big ? 16 : 8, col, 'center');
      }
    }
    if (this.phase === 'count') {
      const n = 3 - Math.floor(this.phaseT / 60);
      if (n >= 1) t.text(String(n), W / 2, 88, 48, '#ffd34a', 'center');
    } else if (this.phase === 'play' && this.phaseT < 50) {
      t.text('¡YA!', W / 2, 88, 48, '#ffd34a', 'center');
    } else if (this.phase === 'sdintro') {
      const p = this.phaseT, pop = p < 8 ? 1 + (8 - p) * 0.12 : 1, blink = (p >> 3) % 2;
      t.text('¡MUERTE', W / 2, 34, Math.round(40 * pop), blink ? '#ff4a3a' : '#ffd34a', 'center');
      t.text('SÚBITA!', W / 2, 34 + Math.round(44 * pop), Math.round(40 * pop), blink ? '#ffd34a' : '#ff4a3a', 'center');
      if (p > 30) t.text('Todos al máximo de daño: el primer golpe decide', W / 2, 128, 8, '#ffffff', 'center');
    }
  }
  // textos de la secuencia final
  renderEndText(t) {
    const E = this.endSeq; if (!E || E.done) return;            // con los resultados en pantalla, sin textos detrás
    if (E.step === 'settle' || (E.step === 'portal' && E.t < 20)) {
      const txt = E.reason === 'time' ? '¡TIEMPO!' : '¡FIN!';
      t.text(txt, W / 2, 88, 48, E.reason === 'time' ? '#ffd34a' : '#ffffff', 'center');
    } else if (E.step === 'pose') {
      const name = this.result().winner, txt = this.teams ? '¡GANA EL ' + name.toUpperCase() + '!' : '¡GANA ' + name + '!';
      const size = txt.length * 16 > W - 20 ? 8 : 16, k = Math.min(1, E.t / 12);
      t.text(txt, W / 2, Math.round(-20 + 34 * k), size, '#ffd34a', 'center');
    }
  }

  result() {
    // posiciones: primero los ganadores, luego los que siguen en pie (por vidas) y después por orden de eliminación
    const W0 = this.endSeq ? this.endSeq.winners : [];
    const alive = this.fighters.filter(f => !f.out && !W0.includes(f)).sort((a, b) => b.stocks - a.stocks);
    const order = [...new Set([...W0, ...alive, ...this.placing.slice().reverse()])];
    const top = order[0];
    let winner;
    if (this.teams) winner = TEAM_NAMES[top ? top.team : 0];
    else winner = top ? fullName(top) : '—';
    return { order, winner, teams: this.teams, winTeam: top ? top.team : null };
  }
}
