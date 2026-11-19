'use strict';
// ============================================================
//  DUMMY — muñeco de pruebas de choque
//  Solo aparece en PRÁCTICA y TUTORIAL. Amarillo con articulaciones
//  negras, la cara lisa y las dianas de pruebas en la cabeza y el pecho.
// ============================================================
(() => {
  const Y = { l: '#ffe680', m: '#f4c832', d: '#c89418', dd: '#8a6410' };
  const K = { m: '#24222e', l: '#4a4858' };

  // diana de pruebas: círculo partido en cuartos negro / amarillo
  function target(c, cx, cy, r = 2) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + 1) continue;
      px(c, cx + x, cy + y, (x >= 0) === (y >= 0) ? K.m : Y.l);
    }
  }
  function head(c, hx, hy, k = 1, hurt = false) {
    const R = (x, y, w, h, col) => rect(c, hx + x * k, hy + y * k, w * k, h * k, col);
    R(-4, -4, 9, 9, Y.m); R(-3, -5, 7, 1, Y.m); R(-3, 5, 7, 1, Y.d);
    R(-3, -5, 4, 1, Y.l); R(-4, -4, 2, 4, Y.l);
    R(4, -3, 1, 7, Y.d); R(-4, 4, 9, 1, Y.d);
    // la diana a un lado de la cabeza
    if (k === 1) target(c, hx - 1, hy, 2);
    else { for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) R(-1 + x, y, 1, 1, (x >= 0) === (y >= 0) ? K.m : Y.l); }
    // "ojos": dos marcas pintadas (se tuercen al recibir)
    if (hurt) { R(2, -2, 1, 1, K.m); R(3, -1, 1, 1, K.m); R(2, 0, 1, 1, K.m); }
    else { R(2, -2, 2, 1, K.l); R(2, 1, 2, 1, K.l); }
  }

  const base = CHARACTERS.maniqui;
  const moves = {};
  for (const k in base.moves) moves[k] = Object.assign({}, base.moves[k]);

  defineCharacter({
    id: 'dummy',
    name: 'Dummy',
    role: 'Muñeco de pruebas',
    desc: 'El muñeco de pruebas de choque. Aguanta todo lo que le eches.',
    hidden: true,                          // no sale en la selección normal
    stats: { weight: 100, hw: 6, hh: 24, walk: 2.0 },
    bust: { k: 2, y: -30, h: 18, dx: 1 },
    selectH: 36,
    rest: { hip: [0, -9], neck: [0, -17], head: [1, -22], fh: [5, -11], bh: [-3, -12], ff: [3, 0], bf: [-3, 0] },
    poses: {
      idle(p, f, T) {                      // se balancea un poco, como un muñeco sin fuerza
        const s = Math.round(Math.sin(T * 0.05));
        p.head[0] += s; p.fh[1] += 1; p.bh[1] += 1;
      },
      select(p, f, T) { const s = Math.round(Math.sin(T * 0.05)); p.head[0] += s; return true; },
      taunt(p, f, T) { const t = T % 60; if (t < 30) { p.fh = [8, -24 + (t >> 3) % 2]; } return true; },   // saluda
    },
    moves,
    draw(c, f, p, A) {
      const hip = A(p.hip), neck = A(p.neck), hd = A(p.head);
      const fh = A(p.fh), bh = A(p.bh), ff = A(p.ff), bf = A(p.bf);
      const sh = [neck[0], neck[1] + 1];
      const mid = (a, b) => [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
      // brazo y pierna de atrás
      pline(c, sh[0] - 1, sh[1], bh[0], bh[1], 2, Y.d);
      const eb = mid(sh, bh); rect(c, eb[0] - 1, eb[1] - 1, 2, 2, K.m);
      rect(c, bh[0] - 1, bh[1] - 1, 3, 3, K.m);
      pline(c, hip[0] - 1, hip[1], bf[0], bf[1] - 1, 3, Y.d);
      const kb = mid(hip, bf); rect(c, kb[0] - 1, kb[1] - 1, 3, 2, K.m);
      rect(c, bf[0] - 2, bf[1] - 1, 4, 2, K.m);
      // torso con franjas negras y diana en el pecho
      pline(c, hip[0], hip[1], neck[0], neck[1] + 1, 6, Y.m);
      pline(c, hip[0] - 2, hip[1], neck[0] - 2, neck[1] + 1, 1, Y.l);
      pline(c, hip[0] + 2, hip[1], neck[0] + 2, neck[1] + 1, 1, Y.d);
      const tm = mid(hip, neck);
      rect(c, tm[0] - 3, tm[1] + 2, 6, 1, K.m);
      target(c, tm[0] + 1, tm[1] - 2, 1);
      rect(c, hip[0] - 3, hip[1] - 1, 6, 2, K.m);
      rect(c, neck[0] - 1, neck[1] - 1, 3, 2, K.m);             // cuello negro
      // pierna de delante
      pline(c, hip[0] + 1, hip[1], ff[0], ff[1] - 1, 3, Y.m);
      const kf = mid(hip, ff); rect(c, kf[0] - 1, kf[1] - 1, 3, 2, K.m);
      rect(c, ff[0] - 2, ff[1] - 1, 5, 2, K.m); px(c, ff[0] + 2, ff[1] - 1, K.l);
      head(c, hd[0], hd[1], 1, f.st === 'hitstun' || f.st === 'grabbed');
      // brazo de delante
      pline(c, sh[0] + 1, sh[1], fh[0], fh[1], 2, Y.m);
      const ef = mid(sh, fh); rect(c, ef[0] - 1, ef[1] - 1, 2, 2, K.m);
      rect(c, fh[0] - 1, fh[1] - 1, 4, 4, K.m); rect(c, fh[0] - 1, fh[1] - 1, 2, 1, K.l);
    },
    portrait(c, x, y, pal, k) { head(c, x, y, k); },
  });
})();
