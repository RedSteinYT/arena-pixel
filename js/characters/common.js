'use strict';
// ============================================================
//  Base común de los luchadores
// ------------------------------------------------------------
//  Todos los luchadores comparten los mismos CONTROLES y los
//  mismos HUECOS de ataque (jab, ftilt, ... uspc, dspc, agarre).
//  Cada luchador vive en su propio archivo (js/characters/*.js)
//  y define:
//    stats    -> velocidad, saltos, peso, tamaño...
//    moves    -> cómo ejecuta cada hueco (tiempos, golpes, poses)
//    poses    -> su forma de estar quieto, correr, saltar...
//    draw     -> su cuerpo en pixel art
//    portrait -> su cara para el HUD y el menú
//
//  Opciones de cada golpe (hit):
//    box: [x, y, ancho, alto] desde los pies, mirando a la derecha
//    d daño · b empuje base · g crecimiento con el % · ang ángulo
//    away: empuja alejándose del atacante
//    on: [desde, hasta] frames propios (para ataques de varios golpes)
//    rehit: N -> vuelve a golpear cada N frames dentro de su ventana
//    grab: true -> en vez de golpear, agarra
//  Opciones del movimiento:
//    s / a / e: frames de arranque, activos y recuperación
//    cancel: si acierta, se puede cancelar con salto u otro ataque
//    smash: se carga manteniendo el botón · air: ataque aéreo
//    throw: { d, b, g, ang } -> lanzamiento (tras un agarre)
// ============================================================

const CHARACTERS = {};
const CHAR_ORDER = [];

// Huecos de ataque: igual para todos (así los controles no cambian)
const MOVE_SLOTS = ['jab', 'ftilt', 'utilt', 'dtilt', 'dash', 'fsmash', 'usmash', 'dsmash',
  'nair', 'fair', 'bair', 'uair', 'dair', 'nspc', 'sspc', 'uspc', 'dspc',
  'grab', 'fthrow', 'bthrow', 'uthrow', 'dthrow'];

const BASE_STATS = {
  walk: 2.3, gAcc: 0.5, fric: 0.45,
  airSpd: 2.0, aAcc: 0.2, airFric: 0.03,
  jumpV: 6.4, hopV: 4.4, djumpV: 6.0, jumps: 1,
  grav: 0.3, maxFall: 4.4, fastFall: 6.4,
  weight: 100,            // 100 = normal; más alto = cuesta más sacarlo
  hw: 6, hh: 24,          // media anchura y altura de la caja de daño
};

// Agarre y lanzamientos por defecto (cada luchador puede cambiarlos).
// Las medidas se adaptan al tamaño del luchador.
function defaultGrabMoves(st) {
  const z = st.hh / 24, hw = st.hw;
  const hold = [hw + 7 * z, -st.hh * 0.45];
  return {
    grab:   { s: 6, a: 3, e: 22, hit: [{ box: [hw - 3, -st.hh * 0.85, 12 + 6 * z, st.hh * 0.6], grab: true }], hold,
              pose: { fh: [hw + 9 * z, -st.hh * 0.55], bh: [hw + 7 * z, -st.hh * 0.5], lean: 2 } },
    fthrow: { s: 8, a: 1, e: 14, hit: [], throw: { d: 8, b: 3.0, g: 4.6, ang: 40 },
              path: t => [hold[0] + Math.min(t, 8) * 0.8 * z, hold[1]], pose: { fh: [hw + 12 * z, -st.hh * 0.6], lean: 3 } },
    bthrow: { s: 10, a: 1, e: 16, hit: [], throw: { d: 9, b: 3.0, g: 5.0, ang: 135 },
              path: t => { const a = Math.min(t / 10, 1) * Math.PI; return [Math.cos(a) * hold[0], hold[1] - Math.sin(a) * 10 * z]; },
              pose: { fh: [-hw - 6 * z, -st.hh * 0.7] } },
    uthrow: { s: 9, a: 1, e: 14, hit: [], throw: { d: 7, b: 3.2, g: 4.0, ang: 88 },
              path: t => [hold[0] * (1 - Math.min(t / 9, 1) * 0.8), hold[1] - Math.min(t / 9, 1) * st.hh * 0.6], pose: { fh: [2, -st.hh * 1.3], upper: true } },
    dthrow: { s: 8, a: 1, e: 16, hit: [], throw: { d: 6, b: 2.4, g: 3.2, ang: 75 },
              path: t => [hold[0], hold[1] + Math.min(t / 8, 1) * st.hh * 0.4], pose: { fh: [hw + 6 * z, -2], crouch: true } },
  };
}

function defineCharacter(def) {
  const st = Object.assign({}, BASE_STATS, def.stats);
  def.moves = Object.assign(defaultGrabMoves(st), def.moves);
  const M = def.moves;
  // cadena 1-2-3 del ataque normal: el 2.º golpe con la otra mano, el 3.º remata (usa la animación del ataque lateral)
  if (!M.jab2) {
    const P = M.jab.pose;
    M.jab2 = Object.assign({}, M.jab, {
      s: Math.max(2, M.jab.s - 1),
      hit: M.jab.hit.map(h => Object.assign({}, h, { d: h.d + 1, b: h.b * 0.9, g: h.g * 0.5, ang: 30 })),
      pose: typeof P === 'function' || !P || !P.fh ? P : Object.assign({}, P, { fh: P.bh, bh: P.fh, wind: undefined }),
    });
  }
  // ataque hacia arriba: que alcance la cabeza de un rival que está de pie a tu lado
  // (antes solo tocaba al que estaba en el aire) y que siempre lo levante lo bastante para seguir en el aire
  if (M.utilt && !M.utilt._fixed) {
    M.utilt = Object.assign({}, M.utilt, { popup: true, _fixed: true,
      hit: M.utilt.hit.map(h => !h.box || h.box[1] + h.box[3] >= -14 ? h : Object.assign({}, h, { box: [h.box[0], h.box[1], h.box[2], -14 - h.box[1]] })) });
  }
  if (!M.jab3) M.jab3 = Object.assign({}, M.ftilt, {
    s: Math.max(3, M.ftilt.s - 2), finisher: true,
    hit: M.ftilt.hit.map(h => Object.assign({}, h, { d: Math.max(3, Math.round(h.d * 0.8)), b: h.b + 0.6, g: h.g * 0.85, ang: 40 })),
  });
  def.z = st.hh / 24;      // escala respecto a un luchador normal
  CHARACTERS[def.id] = def;
  if (!def.hidden) CHAR_ORDER.push(def.id);      // los ocultos (el Dummy) no salen en la selección
}

// ---------- utilidades de pose ----------
const SPR = 200, OX = 100, OY = 150;   // lienzo del sprite y origen (pies); grande para el gigante
const sprBuf = mkCanvas(SPR, SPR), sprCtx = sprBuf.getContext('2d');
const olBuf = mkCanvas(SPR, SPR), olCtx = olBuf.getContext('2d');
const L2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function crouchPose(p, k) {
  p.hip[1] += k; p.neck[1] += k; p.head[1] += k; p.fh[1] += k * 0.7; p.bh[1] += k * 0.7;
  p.ff[0] += Math.max(1, k / 3); p.bf[0] -= Math.max(1, k / 3);
}

// Luchadores que llevan algo en la mano por defecto (ch.handProp, p. ej. la espada de RedStein):
// con un objeto en la mano se ve solo el objeto; en sus propios ataques (especiales), solo lo suyo.
function ownPropVisible(f) { return !f.item || (f.st === 'attack' && f.move && !f.move.item); }

// Pose genérica según el estado; cada luchador la retoca con sus "poses".
// z escala las medidas para luchadores grandes o pequeños.
function poseFor(f) {
  const ch = f.ch, P = ch.poses || {}, z = ch.z || 1;
  const p = JSON.parse(JSON.stringify(ch.rest));
  p.extra = 0;
  const T = f.animT, st = f.st;
  const Z = (x, y) => [Math.round(x * z), Math.round(y * z)];
  const call = (k, ...a) => P[k] && P[k](p, f, ...a);
  if (st === 'select') {                         // animación de la pantalla de selección
    if (!call('select', T)) call('idle', T);
  } else if (st === 'taunt') {                   // pantalla VS: cada uno amenaza a su manera
    if (!call('taunt', T) && !call('select', T)) call('idle', T);
  } else if (st === 'win') {                     // victoria: cada luchador la suya (si no, brazos en alto)
    if (!call('win', T)) {
      const k = (T >> 4) % 2;
      p.fh = [5 * z, (-30 - 2 * k) * z]; p.bh = [-4 * z, (-28 + 2 * k) * z]; p.head[1] -= z;
    }
  } else if (st === 'lose') {                    // derrota: cabizbajo
    if (!call('lose', T)) {
      crouchPose(p, 3 * z); p.head[0] += 2 * z; p.head[1] += 2 * z;
      p.fh = [3 * z, p.hip[1] + 2 * z]; p.bh = [-2 * z, p.hip[1] + 3 * z];
    }
  } else if (st === 'ground' || st === 'respawn') {
    if (Math.abs(f.vx) > 0.4 && st === 'ground') {
      const ph = T * (ch.runRate || 0.32);
      if (!call('run', ph)) {
        const s = Math.sin(ph), c = Math.cos(ph);
        p.ff = Z(5 * s, -Math.max(0, 3 * c));
        p.bf = Z(-5 * s, -Math.max(0, -3 * c));
        p.fh = [Math.round(-4 * s * z) + 2, p.fh[1]]; p.bh = [Math.round(4 * s * z) - 2, p.bh[1]];
        p.neck[0] += z; p.head[0] += 2 * z;
      }
    } else if (f.inp && f.inp.my > 0.6 && st === 'ground') {
      crouchPose(p, 4 * z); call('crouch');
    } else call('idle', T);
  } else if (st === 'jumpsquat' || st === 'landing') {
    crouchPose(p, 3 * z); call('crouch');
  } else if (st === 'air' || st === 'helpless') {
    if (!call('air', f.vy)) {
      if (f.vy < 0) { p.ff = Z(4, -5); p.bf = Z(-2, -2); p.fh = [6 * z, p.neck[1] - z]; p.bh = [-5 * z, p.neck[1] + 2 * z]; }
      else { p.ff = Z(4, -1); p.bf = Z(-4, -2); p.fh = [7 * z, p.neck[1] + 2 * z]; p.bh = [-6 * z, p.neck[1] + 3 * z]; }
    }
    if (st === 'helpless') { p.fh = [3 * z, p.hip[1] + 3 * z]; p.bh = [-3 * z, p.hip[1] + 3 * z]; p.head[1] += z; }
  } else if (st === 'shield') {
    crouchPose(p, 2 * z); p.fh = [7 * z, p.neck[1] + 3 * z]; p.bh = [5 * z, p.neck[1] + 5 * z]; call('shield');
  } else if (st === 'dodge') {
    crouchPose(p, 4 * z); p.fh = [3 * z, p.hip[1] - z]; p.bh = [-3 * z, p.hip[1] - z];
  } else if (st === 'hitstun' || st === 'shieldbreak' || st === 'grabbed') {
    const w = Math.sin(T * 0.6);
    p.head[0] -= 3 * z; p.neck[0] -= z;
    p.fh = [(4 + w * 3) * z, p.head[1] + z]; p.bh = [-7 * z, p.head[1] + (4 - w * 3) * z];
    p.ff = Z(5, -3); p.bf = Z(-4, 1);
    call('hurt', w);
  } else if (st === 'ledge') {
    const top = -ch.stats.hh + 3;
    p.fh = [5 * z, top]; p.bh = [4 * z, top - 1]; p.ff = Z(1, 2); p.bf = Z(-1, 3);
    call('ledge');
  } else if (st === 'rubyCharge') {             // concentración: firme, puños juntos ante el pecho
    crouchPose(p, 2 * z); p.fh = [4 * z, p.neck[1] + 4 * z]; p.bh = [3 * z, p.neck[1] + 5 * z]; p.head[1] += z;
    call('focus', T);
  } else if (st === 'hold') {
    const G = f.ch.moves.grab.hold || [8, -11];
    p.fh = [G[0] - 2 * z, G[1]]; p.bh = [G[0] - 4 * z, G[1] + 2 * z];
    call('hold');
  } else if (st === 'attack') {
    poseAttack(f, p);
  }
  return p;
}

// Las poses de ataque se definen en cada movimiento:
//  pose: { fh, bh, ff, bf: destino de manos/pies · wind: preparación · lean · crouch · spin · both · upper }
//  o pose(p, f, k, t) como función propia (k: -1 preparación, 1 golpe, 0 reposo)
function poseAttack(f, p) {
  const m = f.move, t = f.t, P = m.pose || {}, z = f.ch.z || 1;
  let k;
  const end = m.s + m.a;
  if (t < m.s) k = -(t / Math.max(1, m.s));
  else if (t < end) k = 1;
  else k = 1 - (t - end) / Math.max(1, m.e);
  p.k = k;
  if (m.air) { p.ff = [4 * z, -4 * z]; p.bf = [-3 * z, -2 * z]; }
  if (typeof m.pose === 'function') { m.pose(p, f, k, t); return; }
  if (P.crouch) crouchPose(p, 3 * z);
  const apply = (key, target, wind) => {
    if (!target) return;
    if (k >= 0) p[key] = L2(p[key], target, k);
    else if (wind) p[key] = L2(p[key], wind, -k);
    else p[key] = L2(p[key], [p[key][0] - 3 * z, p[key][1]], -k);
  };
  apply('fh', P.fh, P.wind); apply('bh', P.bh, P.bwind); apply('ff', P.ff); apply('bf', P.bf);
  if (P.both && P.fh) apply('bh', [P.fh[0] - 3 * z, P.fh[1] + z]);
  if (P.lean) { const l = Math.round(P.lean * z * Math.max(0, k)); p.neck[0] += l; p.head[0] += l; }
  if (P.spin) {
    const a = t * (P.spinRate || 0.9), r = (P.spinR || 9) * (P.spinR ? 1 : z), cy = p.hip[1] - 4 * z;
    p.fh = [Math.round(Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
    p.bh = [Math.round(-Math.cos(a) * r), Math.round(cy - Math.sin(a) * r)];
    if (!P.keepLegs) { p.ff = [6 * z, -4 * z]; p.bf = [-6 * z, -4 * z]; }
  }
  if (P.upper && k > 0) { p.neck[0] += z; p.head[1] -= z; }
  if (P.extra !== undefined) p.extra = P.extra * Math.max(0, k);
}

// ---------- dibujo ----------
function renderFighter(c, f, frame) {
  const p = poseFor(f);
  f._pose = p;                                   // la mano sostiene el objeto
  let tint = null;
  if (f.flash > 0) tint = 'rgba(255,255,255,0.85)';
  else if (f._bomb && (frame >> (f._bomb > 1 ? 1 : 3)) % 2) tint = 'rgba(255,40,40,0.55)';   // lleva la bomba
  else if (f.st === 'helpless') tint = 'rgba(20,10,50,0.35)';
  else if (f.st === 'attack' && f.move && f.move.smash && f.charge > 0 && (frame >> 2) % 2) tint = 'rgba(255,240,150,0.45)';

  const s = sprCtx;
  s.clearRect(0, 0, SPR, SPR);
  const A = v => [OX + Math.round(v[0]), OY + Math.round(v[1])];
  f.ch.draw(s, f, p, A, frame);
  if (tint) {
    s.globalCompositeOperation = 'source-atop'; s.fillStyle = tint; s.fillRect(0, 0, SPR, SPR);
    s.globalCompositeOperation = 'source-over';
  }
  olCtx.clearRect(0, 0, SPR, SPR);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) olCtx.drawImage(sprBuf, dx, dy);
  olCtx.globalCompositeOperation = 'source-in'; olCtx.fillStyle = OUTLINE; olCtx.fillRect(0, 0, SPR, SPR);
  olCtx.globalCompositeOperation = 'source-over'; olCtx.drawImage(sprBuf, 0, 0);

  if (f.invuln > 0 && f.st !== 'respawn' && f.st !== 'win' && f.st !== 'lose' && (frame >> 2) % 2) c.globalAlpha = 0.45;
  if (f.st === 'dodge') c.globalAlpha = 0.55;
  if (f.hidden) c.globalAlpha = 0.15;
  const dx = Math.round(f.x), dy = Math.round(f.y);
  if (f.dir > 0) c.drawImage(olBuf, dx - OX, dy - OY);
  else { c.save(); c.translate(dx + OX, dy - OY); c.scale(-1, 1); c.drawImage(olBuf, 0, 0); c.restore(); }
  c.globalAlpha = 1;
}

// Retrato de busto (para la cuadrícula de selección).
//  bust: { k: escala, y: arriba del recorte (desde los pies), h: alto, dx: desplazamiento }
const bustCache = {};
function makeBust(charId, palIdx) {
  const key = charId + ':' + palIdx;
  if (bustCache[key]) return bustCache[key];
  const ch = CHARACTERS[charId], B = ch.bust || { k: 2, y: -30, h: 18, dx: 0 };
  const tmp = mkCanvas(SPR, SPR), tc = tmp.getContext('2d');
  const f = { ch, S: Object.assign({}, BASE_STATS, ch.stats), pal: PLAYER_PALS[palIdx], st: 'ground', animT: 30, vx: 0, vy: 0,
    inp: { my: 0 }, dir: 1, x: OX, y: OY, flash: 0, invuln: 0, scarf: null, jumps: 1 };
  renderFighter(tc, f, 0);
  const h = B.h, w = Math.round(h * 4 / 3);
  const out = mkCanvas(w * B.k, h * B.k), oc = out.getContext('2d');
  oc.imageSmoothingEnabled = false;
  oc.drawImage(tmp, OX - w / 2 + (B.dx || 0), OY + B.y, w, h, 0, 0, w * B.k, h * B.k);
  return (bustCache[key] = out);
}

// ------------------------------------------------------------
//  Escena de la pantalla de selección (fondo + plataforma propios)
//  Cada luchador puede definir en su archivo:
//    scene: { base(c, W, H), anim(c, W, H, T), platform(c, cx, gy, T), front(c, W, H, T), scale }
//  base se pinta una vez; anim/platform/front cada frame.
// ------------------------------------------------------------
const SCENE_W = 140, SCENE_H = 120, SCENE_GY = 102;
const sceneCache = {};
function sceneDither(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1), i = Math.floor(f), fr = f - i;
  return pal[Math.min(pal.length - 1, fr > (BAYER[y & 3][x & 3] + 0.5) / 16 ? i + 1 : i)];
}
// degradado vertical tramado (pixel art)
function sceneGrad(c, x0, y0, w, h, pal) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { c.fillStyle = sceneDither(pal, y / h, x0 + x, y0 + y); c.fillRect(x0 + x, y0 + y, 1, 1); }
}
// W, H: tamaño del panel en píxeles de escena · gy: altura de la plataforma
function drawSelectScene(c, charId, frame, W, H, gy, drawFighterFn) {
  const sc = CHARACTERS[charId].scene, key = `${charId}:${W}x${H}:${gy}`;
  if (!sceneCache[key]) {
    const cv = mkCanvas(W, H), x = cv.getContext('2d');
    if (sc && sc.base) sc.base(x, W, H, gy); else sceneGrad(x, 0, 0, W, H, ['#120f2c', '#241f4a', '#3a3470']);
    sceneCache[key] = cv;
  }
  c.drawImage(sceneCache[key], 0, 0);
  if (sc && sc.anim) sc.anim(c, W, H, gy, frame);
  if (sc && sc.platform) sc.platform(c, Math.round(W / 2), gy, frame, W, H);
  else { rect(c, W / 2 - 30, gy, 60, 3, '#c9c1e8'); rect(c, W / 2 - 28, gy + 3, 56, 3, '#6c6890'); }
  drawFighterFn();
  if (sc && sc.front) sc.front(c, W, H, gy, frame);
}

// Bufanda / capa / cinta: cadena de puntos que sigue al luchador
function drawChain(c, f, from, width, cols) {
  if (!f.scarf) return;
  let prev = from;
  f.scarf.forEach((q, i) => {
    const sx = OX + Math.round((q[0] - f.x) * f.dir), sy = OY + Math.round(q[1] - f.y);
    pline(c, prev[0], prev[1], sx, sy, i < 3 ? width : Math.max(1, width - 1), cols[i % cols.length]);
    prev = [sx, sy];
  });
}

// Comprueba que un luchador tiene todos los huecos (ayuda al crear nuevos)
function validateCharacters() {
  for (const id in CHARACTERS) {
    const missing = MOVE_SLOTS.filter(s => !CHARACTERS[id].moves[s]);
    if (missing.length) console.warn(`Al luchador "${id}" le faltan movimientos:`, missing.join(', '));
  }
}
