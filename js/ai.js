'use strict';
// ============================================================
//  CPU: genera "botones" igual que un jugador humano
//  Tres niveles: easy (fácil), normal (medio), hard (difícil)
// ============================================================
const AI_LEVELS = {
  //          reacción(frames)  escudo  esquiva  se recupera  agarre  fuerte  %para fuerte  proyectil  se queda quieta  persigue saltando  machaca  castiga
  easy:   { combo: 0.03, wait: [14, 26], shield: 0.06, dodge: 0.1, recover: 0.55, grab: 0.04, smash: 0.15, smashDmg: 110, proj: 0.03, idle: 0.25, chase: 0.3, mash: 0.08, punish: 0 },
  normal: { combo: 0.12, wait: [3, 9],   shield: 0.3,  dodge: 0.3, recover: 0.92, grab: 0.1,  smash: 0.4,  smashDmg: 80,  proj: 0.08, idle: 0.03, chase: 0.6, mash: 0.25, punish: 0.3 },
  hard:   { combo: 0.32, wait: [1, 4],   shield: 0.55, dodge: 0.45, recover: 1,   grab: 0.18, smash: 0.55, smashDmg: 65,  proj: 0.12, idle: 0,    chase: 0.85, mash: 0.5, punish: 0.85 },
};
const LEVEL_NAMES = { easy: 'FÁCIL', normal: 'MEDIO', hard: 'DIFÍCIL' };

function aiInput(f, g) {
  const I = blankInput();
  const L = AI_LEVELS[f.level] || AI_LEVELS.normal;
  const A = f.ai || (f.ai = { wait: 0, hold: null, shieldT: 0, canRecover: true });
  const M = STAGE.main, cx = (M.x1 + M.x2) / 2;
  if (f.st === 'dead') return I;
  if (f.grounded || f.st === 'ledge') A.canRecover = Math.random() < L.recover;   // ¿esta vez sabrá volver?
  // agarrado: machacar botones para soltarse
  if (f.st === 'grabbed') { if (Math.random() < L.mash) I[['atk', 'spc', 'jump'][Math.random() * 3 | 0]] = !f.prev.atk; return I; }
  // sosteniendo a alguien: elegir lanzamiento
  if (f.st === 'hold') {
    // EQUIPOS: si un compañero está cerca, esperar un poco a que venga a por la DUPLA
    const mateNear = g.teams && g.fighters.some(o => o !== f && g.allies(f, o) && !o.out && o.alive() && o.st !== 'respawn' && Math.abs(o.x - f.x) < 150 && Math.abs(o.y - f.y) < 50);
    if (f.t > (mateNear ? 85 : 8 + Math.random() * 10)) {
      const r = Math.random();
      if (r < 0.3) I.my = -1; else if (r < 0.5) I.my = 1; else if (r < 0.75) I.mx = f.dir; else I.mx = -f.dir;
    }
    return I;
  }
  if (f.st === 'respawn') { if (f.t > 40 + Math.random() * 40) I.my = 1; return I; }
  // EQUIPOS: si un compañero sujeta a un rival, ir a agarrarlo también (¡DUPLA!)
  if (g.teams && f.grounded && (f.st === 'ground' || f.st === 'landing')) {
    const mate = g.fighters.find(o => o !== f && g.allies(f, o) && o.st === 'hold' && o.holding && !g.allies(f, o.holding));
    if (mate && Math.abs(mate.holding.y - f.y) < 50) {
      const v = mate.holding, dx = v.x - f.x, reach = f.S.hw + v.S.hw + 4;
      if (Math.abs(dx) > reach) I.mx = sgn(dx);
      else if (sgn(dx) !== f.dir && Math.abs(dx) > 2) I.mx = sgn(dx);
      else I.grab = !f.prev.grab;
      return I;
    }
  }

  // ---- en el borde: subir ----
  if (f.st === 'ledge') {
    if (f.t > 10 + Math.random() * (L.wait[1] + 10)) { if (Math.random() < 0.5) I.mx = -f.ledgeSide; else I.jump = true; }
    return I;
  }

  // ---- fuera del escenario: volver ----
  const offX = f.x < M.x1 - 2 || f.x > M.x2 + 2;
  if (!f.grounded && (offX || f.y > M.y + 4) && !surfaceBelow(f.x, f.y)) {
    I.mx = sgn(cx - f.x);
    if (f.st === 'helpless' || f.st === 'hitstun') return I;
    if (!A.canRecover && f.jumps === 0) return I;        // la CPU fácil a veces no sabe volver
    const below = f.y > M.y - 10;
    if (f.jumps > 0 && f.vy > 0.5 && below) { if (!f.prev.jump) I.jump = true; return I; }
    if (f.jumps === 0 && !f.upUsed && f.vy > 0 && f.y > M.y - 4 && Math.abs(f.x - cx) < 190) {
      if (!f.prev.spc) { I.spc = true; I.my = -1; I.mx = 0; }
      return I;
    }
    if (!f.sideUsed && f.jumps === 0 && f.upUsed === false && Math.abs(f.x - cx) > (L.punish > 0.5 ? 150 : 190) && f.y < M.y + 10) {
      if (!f.prev.spc) { I.spc = true; I.mx = sgn(cx - f.x); }
    }
    return I;
  }

  // ---- elegir objetivo ----
  let tgt = null, best = 1e9;
  for (const o of g.fighters) {
    if (o === f || !o.alive() || o.st === 'respawn' || g.allies(f, o)) continue;
    const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 1.3;
    if (d < best) { best = d; tgt = o; }
  }
  if (!tgt) return I;
  let dx = tgt.x - f.x; const dy = tgt.y - f.y;
  if (Math.abs(dx) < 0.5) dx = f.dir * 0.5;          // encima del rival: usar hacia donde mira
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const z = f.ch.z || 1;
  const armed = f.item && ITEMS[f.item.id].kind === 'weapon';
  const reach = f.S.hw + tgt.S.hw + 12 * z + (armed ? 14 * z : 0), vreach = 10 + f.S.hh * 0.5 + (armed ? 8 : 0);
  if (RubySys.ai(f, g, I, tgt, dx, dy, L)) return I;                 // ataques rubí y concentración

  // combos: si su golpe ha acertado, sigue la cadena (cuanto más difícil, más a menudo)
  if (f.st === 'attack' && f.landedHit && (f.chain || 0) < 4 && Math.random() < L.combo) {
    const press = k => { I[k] = !f.prev[k]; };
    if (JAB_NEXT[f.moveName] && Math.random() < 0.7) { press('atk'); return I; }
    const tier = moveTier(f.moveName), r = Math.random();
    if (tier <= 1) { press('atk'); if (dy < -14) I.my = -1; else I.mx = sgn(dx) || f.dir; return I; }
    if (tier === 2) {
      if (f.grounded && dy < -16 && r < 0.4) { press('jump'); return I; }
      if (r < 0.45) { I.cx = sgn(dx) || f.dir; if (dy < -18) { I.cx = 0; I.cy = -1; } return I; }
      press('spc'); I.mx = Math.abs(dx) > 10 ? sgn(dx) : 0; if (dy < -24) { I.mx = 0; I.my = -1; } return I;
    }
    if (tier === 3) { press('spc'); I.mx = sgn(dx) || f.dir; return I; }
  }
  // mantener un escudo un rato
  if (A.shieldT > 0) { A.shieldT--; I.shd = true; return I; }
  // castigar: si el rival está recuperándose de un ataque cerca, reaccionar ya
  const tgtOpen = (tgt.st === 'landing') || (tgt.st === 'attack' && tgt.move && tgt.t > tgt.move.s + tgt.move.a);
  const punishNow = tgtOpen && adx < reach + 8 && ady < vreach && Math.random() < L.punish;
  // reacción: la CPU no decide en cada frame
  if (A.wait > 0 && !punishNow) {
    A.wait--;
    if (A.hold) { I.mx = A.hold.mx; I.my = A.hold.my; }
    return I;
  }
  A.wait = L.wait[0] + (Math.random() * (L.wait[1] - L.wait[0] + 1) | 0);
  A.hold = null;

  const busy = f.st === 'attack' || f.st === 'landing' || f.st === 'hitstun' || f.st === 'jumpsquat';
  if (busy) return I;
  if (Math.random() < L.idle) return I;                  // la fácil a veces se queda pensando

  // ---- objetos ----
  if (f.item) {
    const def = ITEMS[f.item.id], face = sgn(dx) !== f.dir;
    if (def.kind === 'throw' && adx > 26 && adx < 150 && ady < 34 && Math.random() < 0.35) { I.grab = true; I.mx = sgn(dx); return I; }
    if (f.item.id === 'blaster' && f.grounded && ady < 16 && adx > reach && adx < 230) { if (face) { I.mx = sgn(dx); return I; } I.atk = !f.prev.atk; return I; }
    if (f.item.id === 'bumeran' && f.grounded && ady < 22 && adx > reach && adx < 140 && Math.random() < 0.3) { if (face) { I.mx = sgn(dx); return I; } I.atk = true; return I; }
  } else if (g.items && g.items.length && f.grounded) {
    let it = null, bd = 1e9;
    for (const o of g.items) {
      if (o.st !== 'ground' || Math.abs(o.y - f.y) > 18) continue;
      const d = Math.abs(o.x - f.x); if (d < bd) { bd = d; it = o; }
    }
    if (it && bd < 150 && (adx > 46 || bd < 20) && Math.random() < L.chase + 0.15) {
      const power = ITEMS[it.id].kind === 'power';
      if (!power && bd < f.S.hw + 8) { I.grab = true; return I; }
      I.mx = sgn(it.x - f.x); A.hold = { mx: I.mx, my: 0 }; return I;
    }
  }

  // defenderse si el rival ataca de cerca
  if (tgt.st === 'attack' && adx < reach + 6 && ady < vreach + 4 && f.grounded && Math.random() < L.shield) {
    if (Math.random() > L.dodge) { A.shieldT = 14; I.shd = true; }
    else { I.shd = true; I.mx = -sgn(dx); }
    return I;
  }

  // atacar si está cerca
  if (adx < reach && ady < vreach) {
    if (sgn(dx) !== f.dir && f.grounded) { I.mx = sgn(dx); return I; }   // girarse primero
    const r = Math.random();
    if (f.grounded) {
      const canGrab = !tgt.S.giant || f.S.giant;            // a un gigante no se le agarra
      if (canGrab && ((tgt.st === 'shield' && r < 0.6 + L.grab) || r < L.grab)) { I.grab = true; }   // agarre
      else if (tgt.dmg > L.smashDmg && r < L.smash) { I.cx = sgn(dx); }               // ataque fuerte
      else if (dy < -14) { I.atk = true; I.my = -1; }
      else if (r < 0.35) { I.atk = true; }
      else if (r < 0.75) { I.atk = true; I.mx = sgn(dx); }
      else if (r < 0.88) { I.atk = true; I.my = 1; }
      else { I.spc = true; I.mx = sgn(dx); }
    } else {
      if (dy < -10) { I.atk = true; I.my = -1; }
      else if (dy > 12) { I.atk = true; I.my = 1; }
      else if (r < 0.5) { I.atk = true; I.mx = sgn(dx); }
      else I.atk = true;
    }
    return I;
  }

  // a media distancia: proyectil de vez en cuando
  if (f.grounded && adx > reach + 30 && adx < 160 && ady < 20 && f.projCD <= 0 && Math.random() < L.proj) {
    if (sgn(dx) !== f.dir) { I.mx = sgn(dx); return I; }
    I.spc = true; return I;
  }

  // acercarse
  let mx = sgn(dx);
  let gapJump = false;
  if (f.grounded && f.plat && mx) {
    const p = f.plat, nextX = f.x + mx * 14;
    if (nextX < p.x1 + 4 || nextX > p.x2 - 4) {
      // al borde: ¿hay suelo debajo o una plataforma cerca para saltar?
      const below = surfaceBelow(nextX, f.y + 1);
      let ahead = null;
      for (let k = 20; k <= 70 && !ahead; k += 10) ahead = surfaceBelow(f.x + mx * k, f.y - 60);
      if (below && below !== p) { /* caer a la de abajo está bien */ }
      else if (ahead && ahead !== p) gapJump = true;
      else mx = 0;                                       // no tirarse al vacío
    }
  }
  A.hold = { mx, my: 0 };
  I.mx = mx;
  if (gapJump && !f.prev.jump) { I.jump = true; return I; }
  if (f.grounded && dy < -28 && adx < 60 && Math.random() < L.chase) I.jump = true;
  else if (!f.grounded && dy < -20 && f.jumps > 0 && f.vy > 0 && Math.random() < L.chase * 0.5) I.jump = true;
  if (f.grounded && dy > 20 && f.plat && !f.plat.solid && adx < 50) { A.hold = { mx: 0, my: 1 }; I.my = 1; I.mx = 0; }
  // la difícil cae rápido para alcanzar al rival
  if (!f.grounded && f.vy > 0 && dy > 30 && L.punish > 0.5 && !f.prev.my) I.my = 1;
  return I;
}
