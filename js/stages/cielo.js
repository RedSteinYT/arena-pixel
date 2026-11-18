'use strict';
// ============================================================
//  ISLA CELESTE — la arena original
//  Isla flotante sobre un mar de nubes, con un planeta anillado.
//  Sin reglas especiales: la arena "de referencia".
// ============================================================
(() => {
  const G = {
    main: { x1: 112, x2: 368, y: 184, bottom: 224 },
    plats: [
      { x1: 146, x2: 210, y: 138 },
      { x1: 270, x2: 334, y: 138 },
      { x1: 208, x2: 272, y: 94 },
    ],
  };

  defineStage({
    id: 'cielo',
    name: 'Isla Celeste',
    desc: 'Isla flotante sobre un mar de nubes. Sin trucos: la arena clásica.',
    main: G.main,
    plats: G.plats,
    spawns: [[150, 1], [330, -1], [196, 1], [284, -1]],
    respawn: { x: 240, y: 50 },

    build() {
      return {
        bg: makeBackground(),
        cloudsBack: makeClouds(3, 204, ['#4a3c8a', '#6f5cb0', '#9a83d0', '#c7b0ea'], 80, 18),
        cloudsFront: makeClouds(9, 250, ['#5d4c9e', '#8a74c4', '#b8a0e2', '#e6d4fa'], 60, 8),
        stage: makeStage(G),
      };
    },
    renderBack(c, st, g) {
      const A = st.def.art;
      c.drawImage(A.bg, 0, 0);
      const cx = Math.round(g.cloudX) % (W * 2);
      c.drawImage(A.cloudsBack, -cx, 0); c.drawImage(A.cloudsBack, W * 2 - cx, 0);
    },
    renderFront(c, st, g) {
      const A = st.def.art;
      const fcx = Math.round(g.cloudX * 2.2) % (W * 2);
      c.drawImage(A.cloudsFront, -fcx, 0); c.drawImage(A.cloudsFront, W * 2 - fcx, 0);
    },
  });
})();
