'use strict';
// ============================================================
//  CPU: genera "botones" igual que un jugador humano
//  Tres niveles: easy (fácil), normal (medio), hard (difícil)
// ============================================================
const AI_LEVELS = {
  //          reacción(frames)  escudo  esquiva  se recupera  agarre  fuerte  %para fuerte  proyectil  se queda quieta  persigue saltando  machaca  castiga
  easy:   { wait: [14, 26], shield: 0.06, dodge: 0.1, recover: 0.55, grab: 0.04, smash: 0.15, smashDmg: 110, proj: 0.03, idle: 0.25, chase: 0.3, mash: 0.08, punish: 0 },
  normal: { wait: [3, 9],   shield: 0.3,  dodge: 0.3, recover: 0.92, grab: 0.1,  smash: 0.4,  smashDmg: 80,  proj: 0.08, idle: 0.03, chase: 0.6, mash: 0.25, punish: 0.3 },
  hard:   { wait: [1, 4],   shield: 0.55, dodge: 0.45, recover: 1,   grab: 0.18, smash: 0.55, smashDmg: 65,  proj: 0.12, idle: 0,    chase: 0.85, mash: 0.5, punish: 0.85 },
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
    if (f.t > 8 + Math.random() * 10) {
      const r = Math.random();
      if (r < 0.3) I.my = -1; else if (r < 0.5) I.my = 1; else if (r < 0.75) I.mx = f.dir; else I.mx = -f.dir;
    }
    return I;
  }
  if (f.st === 'respawn') { if (f.t > 40 + Math.random() * 40) I.my = 1; return I; }

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
  const reach = f.S.hw + tgt.S.hw + 12 * z, vreach = 10 + f.S.hh * 0.5;

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
