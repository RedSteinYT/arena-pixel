'use strict';
// ============================================================
//  ARENA DE ENTRENAMIENTO — para PRÁCTICA y TUTORIAL
//  Todo blanco y vacío: una rejilla de plano, figuras en malla de
//  alambre y texturas que "no terminan de cargar". Una pasada de render
//  recorre la escena y algunas casillas aparecen y se borran.
// ============================================================
(() => {
  const G = {
    main: { x1: 112, x2: 368, y: 184, bottom: 224 },
    plats: [
      { x1: 140, x2: 204, y: 140 },
      { x1: 276, x2: 340, y: 140 },
      { x1: 208, x2: 272, y: 98 },
    ],
  };
  const C = { bg: '#f6f7fb', minor: '#e6e9f2', major: '#cfd5e6', wire: '#97a5c8', wireD: '#6b7aa3', ink: '#46527a', accent: '#43c6f0', fill: '#eceff7', shade: '#dde2ee' };

  // ---------- fondo: rejilla de plano + figuras de alambre lejanas ----------
  function makeBg() {
    const cv = mkCanvas(W, H), c = cv.getContext('2d');
    rect(c, 0, 0, W, H, C.bg);
    for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 2) px(c, x, y, C.minor);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 2) px(c, x, y, C.minor);
    for (let x = 0; x < W; x += 40) rect(c, x, 0, 1, H, C.major);
    for (let y = 0; y < H; y += 40) rect(c, 0, y, W, 1, C.major);
    // suelo en perspectiva que se pierde en el horizonte
    const hz = 150, vx = W / 2;
    rect(c, 0, hz, W, 1, C.wire);
    for (let i = -14; i <= 14; i++) pline(c, vx + i * 6, hz, vx + i * 70, H, 1, C.major);
    for (let k = 1; k < 9; k++) { const y = Math.round(hz + Math.pow(k / 9, 2) * (H - hz)); rect(c, 0, y, W, 1, C.major); }
    // montañas y cubos "sin textura": solo los vértices y las aristas
    const tri = (pts, col) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; pline(c, a[0], a[1], b[0], b[1], 1, col); } };
    const ridge = [[0, 150], [40, 104], [78, 128], [120, 82], [168, 126], [200, 108], [236, 150]];
    for (let i = 0; i < ridge.length - 1; i++) tri([ridge[i], ridge[i + 1], [ridge[i][0] + 18, 150]], C.wire);
    const ridge2 = [[250, 150], [292, 96], [330, 122], [372, 72], [420, 118], [452, 100], [480, 150]];
    for (let i = 0; i < ridge2.length - 1; i++) tri([ridge2[i], ridge2[i + 1], [ridge2[i][0] + 20, 150]], C.wire);
    for (const p of [...ridge, ...ridge2]) { rect(c, p[0] - 1, p[1] - 1, 3, 3, C.accent); }
    const cube = (x, y, s) => {
      const d = s * 0.45;
      tri([[x, y], [x + s, y], [x + s, y + s], [x, y + s]], C.wireD);
      tri([[x + d, y - d], [x + s + d, y - d], [x + s + d, y + s - d], [x + d, y + s - d]], C.wire);
      for (const [a, b] of [[[x, y], [x + d, y - d]], [[x + s, y], [x + s + d, y - d]], [[x + s, y + s], [x + s + d, y + s - d]], [[x, y + s], [x + d, y + s - d]]]) pline(c, a[0], a[1], b[0], b[1], 1, C.wire);
    };
    cube(30, 40, 22); cube(410, 30, 26); cube(380, 120, 14); cube(70, 128, 12);
    // etiquetas de depuración pintadas en el "plano"
    c.font = '8px "Press Start 2P", monospace'; c.fillStyle = C.wire;
    c.fillText('TEX_FALTA', 18, 236); c.fillText('LOD 0', 420, 236); c.fillText('X:240 Y:184', 196, 14);
    return cv;
  }

  // ---------- la plataforma: malla de triángulos, medio "renderizada" ----------
  function makeStageArt() {
    const cv = mkCanvas(W, H), c = cv.getContext('2d');
    const M = G.main, r = rng(42);
    // bloque principal (cara superior y lateral) con malla
    rect(c, M.x1, M.y, M.x2 - M.x1, 6, '#ffffff');
    rect(c, M.x1, M.y + 6, M.x2 - M.x1, M.bottom - M.y - 6, C.fill);
    // fondo en punta, como un trozo de geometría
    const cx = (M.x1 + M.x2) / 2;
    for (let y = M.bottom; y < M.bottom + 26; y++) {
      const t = (y - M.bottom) / 26, w = (M.x2 - M.x1) * (1 - t) * 0.5;
      rect(c, Math.round(cx - w), y, Math.round(w * 2), 1, t < 0.5 ? C.fill : C.shade);
    }
    // aristas de la malla
    const pts = [];
    for (let x = M.x1; x <= M.x2; x += 32) pts.push([x, M.y + 6], [x + 16, M.bottom]);
    for (let x = M.x1; x < M.x2; x += 32) {
      pline(c, x, M.y + 6, x + 16, M.bottom, 1, C.wire);
      pline(c, x + 16, M.bottom, x + 32, M.y + 6, 1, C.wire);
      pline(c, x, M.y + 6, x + 32, M.y + 6, 1, C.wire);
    }
    pline(c, M.x1, M.bottom, M.x2, M.bottom, 1, C.wire);
    pline(c, M.x1, M.bottom, cx, M.bottom + 26, 1, C.wireD); pline(c, M.x2, M.bottom, cx, M.bottom + 26, 1, C.wireD);
    for (let x = M.x1 + 16; x < M.x2; x += 32) pline(c, x, M.bottom, cx, M.bottom + 26, 1, C.wire);
    for (const p of pts) rect(c, p[0] - 1, p[1] - 1, 3, 3, C.accent);
    // borde superior y marcas de distancia cada 16 px (útiles para medir alcances)
    rect(c, M.x1, M.y, M.x2 - M.x1, 1, C.ink);
    rect(c, M.x1, M.y, 1, M.bottom - M.y, C.ink); rect(c, M.x2 - 1, M.y, 1, M.bottom - M.y, C.ink);
    for (let x = M.x1; x <= M.x2; x += 16) { const big = (x - M.x1) % 64 === 0; rect(c, x, M.y + 1, 1, big ? 4 : 2, big ? C.ink : C.wireD); }
    rect(c, Math.round(cx), M.y + 1, 1, 5, C.accent);
    // plataformas finas: contorno de alambre y trama a rayas
    for (const p of G.plats) {
      rect(c, p.x1, p.y, p.x2 - p.x1, 4, '#ffffff');
      rect(c, p.x1, p.y, p.x2 - p.x1, 1, C.ink);
      for (let x = p.x1; x < p.x2; x += 2) px(c, x, p.y + 3, C.wire);
      rect(c, p.x1, p.y, 1, 4, C.ink); rect(c, p.x2 - 1, p.y, 1, 4, C.ink);
      for (let x = p.x1 + 4; x < p.x2 - 2; x += 6) pline(c, x, p.y + 1, x + 3, p.y + 3, 1, C.major);
      rect(c, p.x1 - 1, p.y - 1, 3, 3, C.accent); rect(c, p.x2 - 2, p.y - 1, 3, 3, C.accent);
    }
    return cv;
  }

  defineStage({
    id: 'entrenamiento',
    name: 'Arena de entrenamiento',
    desc: 'Una arena que todavía no ha terminado de cargar. Perfecta para practicar.',
    hidden: true,
    main: G.main,
    plats: G.plats,
    spawns: [[176, 1], [304, -1], [150, 1], [330, -1]],
    respawn: { x: 240, y: 50 },
    build() { return { bg: makeBg(), stage: makeStageArt() }; },
    init(st) {
      const r = rng(7);
      st.tiles = [];                                   // casillas que "cargan" y se borran
      for (let i = 0; i < 10; i++) st.tiles.push({ x: (r() * 12 | 0) * 40, y: (r() * 6 | 0) * 40, t: (r() * 300) | 0, n: 0 });
    },
    update(st) {
      for (const tl of st.tiles) {
        if (--tl.t <= 0) { tl.n = (tl.n + 1) % 3; tl.t = 90 + (Math.random() * 240 | 0); if (tl.n === 0) { tl.x = (Math.random() * 12 | 0) * 40; tl.y = (Math.random() * 6 | 0) * 40; } }
      }
    },
    renderBack(c, st) {
      const A = st.def.art, t = st.t;
      c.drawImage(A.bg, 0, 0);
      // casillas a medio cargar: tablero de "textura que falta", o solo su borde
      for (const tl of st.tiles) {
        if (tl.n === 1) { for (let y = 0; y < 40; y += 4) for (let x = 0; x < 40; x += 4) if (((x + y) >> 2) % 2) rect(c, tl.x + x, tl.y + y, 4, 4, C.shade); }
        else if (tl.n === 2) { rect(c, tl.x, tl.y, 40, 1, C.accent); rect(c, tl.x, tl.y + 39, 40, 1, C.accent); rect(c, tl.x, tl.y, 1, 40, C.accent); rect(c, tl.x + 39, tl.y, 1, 40, C.accent);
          withAlpha(c, 0.08, () => rect(c, tl.x, tl.y, 40, 40, C.accent)); }
      }
      // pasada de render: una franja que recorre la pantalla de izquierda a derecha
      const sx = (t * 1.6) % (W + 120) - 60;
      for (let k = 0; k < 24; k++) withAlpha(c, 0.10 * (1 - k / 24), () => rect(c, Math.round(sx - k * 2), 0, 2, H, C.accent));
      rect(c, Math.round(sx), 0, 1, H, C.accent);
      // indicador de "cargando"
      const dots = (t >> 4) % 4;
      for (let i = 0; i < 3; i++) rect(c, W - 22 + i * 5, 8, 3, 3, i < dots ? C.accent : C.major);
    },
    renderFront(c, st) {
      // fallos de render: líneas que parpadean muy de vez en cuando
      if ((st.t % 233) < 3) { const y = (st.t * 37) % H; rect(c, 0, y, W, 1, C.accent); rect(c, 0, y + 2, W, 1, C.major); }
    },
  });
})();
