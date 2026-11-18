'use strict';
// ============================================================
//  Base común de las arenas
// ------------------------------------------------------------
//  Cada arena vive en su propio archivo (js/stages/*.js) y define:
//    main      -> bloque sólido principal { x1, x2, y, bottom }
//    plats     -> plataformas finas (se atraviesan desde abajo)
//    spawns    -> [x, dirección, y?] para cada jugador
//    respawn   -> { x, y } donde reaparece quien cae
//    blast     -> zona de KO (opcional)
//    grav      -> multiplicador de gravedad (opcional, 1 = normal)
//    Cada superficie puede tener:
//      fric -> multiplicador de frenado (hielo < 1)
//      acc  -> multiplicador de aceleración al caminar
//
//    build()                 -> pinta el arte una vez: { stage, ... }
//    init(st)                -> estado inicial propio
//    update(st, g)           -> cada frame (plataformas que se mueven...)
//    renderBack(c, st, g)    -> fondo (detrás de todo)
//    renderMid(c, st, g)     -> partes que se mueven, detrás de los luchadores
//    renderFront(c, st, g)   -> delante de los luchadores (nieve, nubes...)
// ============================================================

const STAGES = {};
const STAGE_ORDER = [];
const DEFAULT_BLAST = { l: -64, r: W + 64, t: -56, b: H + 56 };

function defineStage(def) {
  def.renderBack = def.renderBack || ((c, st) => c.drawImage(st.def.art.bg, 0, 0));
  STAGES[def.id] = def;
  STAGE_ORDER.push(def.id);
}

// Crea una copia "viva" de la arena para una partida
function buildStage(id) {
  const def = STAGES[id] || STAGES[STAGE_ORDER[0]];
  if (!def.art) def.art = def.build();       // el arte se pinta una sola vez
  const st = {
    def, id: def.id,
    main: Object.assign({ solid: true }, def.main),
    plats: def.plats.map((p, i) => Object.assign({ id: i, prevY: p.y }, p)),
    blast: def.blast || DEFAULT_BLAST,
    spawns: def.spawns, respawn: def.respawn,
    grav: def.grav || 1,
    t: 0,
  };
  if (def.init) def.init(st);
  return st;
}

function stepStage(st, g) {
  st.t++;
  for (const p of st.plats) p.prevY = p.y;
  if (st.def.update) st.def.update(st, g);
}

// Superficie justo debajo de un punto (o null si debajo solo hay vacío)
function surfaceBelow(x, y) {
  let best = null;
  for (const p of [STAGE.main, ...STAGE.plats]) {
    if (x >= p.x1 - 1 && x <= p.x2 + 1 && p.y >= y - 1 && (!best || p.y < best.y)) best = p;
  }
  return best;
}

// Ayuda para miniaturas del menú
function stageThumb(id, canvas) {
  const st = buildStage(id), c = canvas.getContext('2d');
  const tmp = mkCanvas(W, H), t = tmp.getContext('2d');
  const fake = { frame: 120, cloudX: 40, fighters: [] };
  const prev = STAGE; STAGE = st;
  st.def.renderBack(t, st, fake);
  t.drawImage(st.def.art.stage, 0, 0);
  if (st.def.renderMid) st.def.renderMid(t, st, fake);
  if (st.def.renderFront) st.def.renderFront(t, st, fake);
  STAGE = prev;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.drawImage(tmp, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
}
