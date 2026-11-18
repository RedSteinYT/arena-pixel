'use strict';
// ============================================================
//  Ilustraciones animadas de los modos de batalla
//  Cada tarjeta es una escena de combate dibujada en vivo con los
//  propios luchadores del juego, en mitad de sus ataques.
// ============================================================
const ModeArt = (() => {
  const CW = 128, CH = 64, GY = 56;      // tamaño interno de cada ilustración (se escala en pantalla)
  const tmp = mkCanvas(SPR, SPR), tc = tmp.getContext('2d');
  const cache = {};

  // fondo: dos colores enfrentados en diagonal, líneas de velocidad y viñeta
  const bgCache = {};
  function backdrop(c, colA, colB, T, split = true) {
    const key = colA.join() + (colB ? colB.join() : '') + split;
    if (!bgCache[key]) {                                  // el degradado se pinta una vez
      const cv = mkCanvas(CW, CH), x2 = cv.getContext('2d');
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const diag = x + (y - CH / 2) * 0.6 - CW / 2;
        const base = split ? (diag < 0 ? colA : colB) : colA;
        const v = 0.55 + 0.45 * (1 - Math.abs(diag) / (CW * 0.7)) - (y / CH) * 0.25;
        x2.fillStyle = sceneDither(base, v, x, y); x2.fillRect(x, y, 1, 1);
      }
      bgCache[key] = cv;
    }
    c.drawImage(bgCache[key], 0, 0);
    // líneas de velocidad hacia el centro del choque
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + T * 0.004, r0 = 22 + ((T * 1.5 + i * 37) % 60), len = 10 + (i % 4) * 6;
      const x0 = CW / 2 + Math.cos(a) * r0, y0 = CH / 2 + Math.sin(a) * r0 * 0.6;
      withAlpha(c, 0.35, () => pline(c, x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len * 0.6, 1, '#ffffff'));
    }
    // suelo
    rect(c, 0, GY, CW, CH - GY, '#0b0a24', 0.55);
    rect(c, 0, GY, CW, 1, '#ffffff', 0.35);
  }
  function burstAt(c, x, y, T, col, big = 1) {
    const k = (T % 24) / 24;
    glow(c, x, y, 14 * big, col, 0.45 * (1 - k * 0.5), 4);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.3, L = (i % 2 ? 6 : 10) * big * (0.7 + 0.3 * Math.sin(T * 0.3));
      pline(c, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 1, i % 2 ? col : '#ffffff');
    }
    disc(c, x, y, Math.round(2 * big), '#ffffff');
  }
  // dibuja un luchador en mitad de un ataque (el ataque se repite en bucle)
  function fighter(c, g, i, x, y, dir, move, T, speed = 2, extra) {
    const f = g.fighters[i];
    f.x = OX; f.y = OY; f.dir = 1; f.flash = 0; f.invuln = 0; f.hitlag = 0;
    if (move) {
      const m = f.ch.moves[move];
      if (f.moveName !== move || f.st !== 'attack') f.startMove(move, g);
      const total = m.s + m.a + m.e;
      f.t = Math.floor(T / speed) % total; f.st = 'attack'; f.move = m;
      f.charge = m.chargeSpc ? 40 : 0;            // sin destello de carga en las ilustraciones
    }
    if (extra) extra(f);
    f.animT = T;
    tc.clearRect(0, 0, SPR, SPR);
    renderFighter(tc, f, T);
    if (f.ch.overlay) f.ch.overlay(tc, f, T);
    const dx = Math.round(x - OX * 1), dy = Math.round(y - OY);
    if (dir > 0) c.drawImage(tmp, dx, dy);
    else { c.save(); c.translate(Math.round(x + OX), dy); c.scale(-1, 1); c.drawImage(tmp, 0, 0); c.restore(); }
  }
  function game(key, chars) {
    if (cache[key]) return cache[key];
    const g = new Game({ teams: false, stocks: 3, stage: 'cielo', players: chars.map(([ch, pal], i) => ({ device: 'cpu', pal, team: i, char: ch })) });
    g.phase = 'play';
    return (cache[key] = g);
  }

  const SCENES = {
    // 1 VS 1: Maniquí (rojo) contra RedStein: puño contra espada en llamas
    '1v1'(c, T) {
      backdrop(c, ['#2a0a14', '#7a1a2a', '#e8443f'], ['#0a1430', '#1e3a8a', '#3d7ef2'], T);
      const g = game('1v1', [['maniqui', 0], ['redstein', 1]]);
      fighter(c, g, 0, 46, GY, 1, 'fsmash', T, 3);
      fighter(c, g, 1, 84, GY, -1, 'ftilt', T + 9, 3);
      burstAt(c, 64, GY - 16, T, '#ffd34a', 1.1);
    },
    // 2 VS 2: equipo rojo (Brisa + Bloque) contra equipo azul (Runa + Coloso)
    '2v2'(c, T) {
      backdrop(c, ['#2a0a14', '#8a1a2a', '#f05a3a'], ['#0a1430', '#20408a', '#4a9aff'], T);
      const g = game('2v2', [['bloque', 4], ['brisa', 0], ['runa', 1], ['coloso', 5]]);
      fighter(c, g, 3, 108, GY + 4, -1, 'fsmash', T, 3);
      fighter(c, g, 0, 30, GY, 1, 'fsmash', T + 6, 3);
      fighter(c, g, 1, 50, GY - 20, 1, 'fair', T, 3);
      fighter(c, g, 2, 82, GY, -1, 'nspc', T, 3);
      burstAt(c, 64, GY - 22, T, '#ffffff', 0.9);
    },
    // TRIPLE AMENAZA: tres luchadores chocando a la vez
    '3ffa'(c, T) {
      backdrop(c, ['#1e0a30', '#5a2a8a', '#f0a12e'], null, T, false);
      const g = game('3ffa', [['brisa', 0], ['runa', 1], ['maniqui', 2]]);
      fighter(c, g, 0, 36, GY, 1, 'ftilt', T, 3);
      fighter(c, g, 1, 92, GY, -1, 'fsmash', T + 5, 3);
      fighter(c, g, 2, 64, GY - 18, 1, 'uair', T, 3);
      burstAt(c, 50, GY - 14, T, '#ffd34a', 0.7); burstAt(c, 78, GY - 14, T + 12, '#c48cff', 0.7);
    },
    // TODOS CONTRA TODOS: caos total con el gigante en medio
    '4ffa'(c, T) {
      backdrop(c, ['#06202a', '#17645e', '#3fd5b0'], null, T, false);
      const g = game('4ffa', [['coloso', 3], ['redstein', 0], ['brisa', 2], ['runa', 1]]);
      fighter(c, g, 0, 64, GY + 6, 1, 'dsmash', T, 3);
      fighter(c, g, 1, 24, GY, 1, 'dash', T, 3);
      fighter(c, g, 2, 104, GY - 26, -1, null, T, 3, f => { f.st = 'hitstun'; f.grounded = false; });
      fighter(c, g, 3, 108, GY, -1, 'usmash', T + 4, 3);
      burstAt(c, 92, GY - 30, T, '#ffffff', 0.8);
    },
  };

  return {
    CW, CH,
    draw(id, canvas, T) {
      const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, CW, CH);
      const m = Sfx.muted; Sfx.muted = true;           // los menús no deben sonar a golpes
      SCENES[id](c, T);
      Sfx.muted = m;
    },
  };
})();
