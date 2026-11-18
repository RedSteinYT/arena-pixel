'use strict';
// ============================================================
//  Pantalla "Controles": teclado con las teclas en su sitio real
//  y mandos (Xbox / PlayStation / Nintendo) dibujados en SVG
//  con flechas que señalan cada botón.
// ============================================================
const Controls = (() => {
  const FN = {
    move:  { name: 'MOVER',          col: '#3d7ef2' },
    jump:  { name: 'SALTAR',         col: '#3ec96b' },
    atk:   { name: 'ATACAR',         col: '#e8443f' },
    spc:   { name: 'ESPECIAL',       col: '#f4c03a' },
    shd:   { name: 'ESCUDO',         col: '#a46bf2' },
    grab:  { name: 'AGARRAR',        col: '#ff7ad9' },
    smash: { name: 'ATAQUE FUERTE',  col: '#f08a2e' },
    pause: { name: 'PAUSA',          col: '#a49cc8' },
  };
  const FONT = `font-family="'Press Start 2P', monospace"`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // ------------------------------------------------------------
  //  TECLADO
  // ------------------------------------------------------------
  // [código físico, etiqueta, ancho en teclas]
  const ROWS = [
    [['Backquote', 'º'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', "'"], ['Equal', '¡'], ['Backspace', '⌫', 2]],
    [['Tab', 'TAB', 1.5], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '`'], ['BracketRight', '+'], ['Backslash', 'Ç', 1.5]],
    [['CapsLock', 'BLOQ', 1.75], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', 'Ñ'], ['Quote', '´'], ['Enter', 'ENTER', 2.25]],
    [['ShiftLeft', 'SHIFT', 2.25], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '-'], ['ShiftRight', 'SHIFT', 2.75]],
    [['ControlLeft', 'CTRL', 1.5], ['MetaLeft', 'WIN', 1.25], ['AltLeft', 'ALT', 1.25], ['Space', 'ESPACIO', 6.25], ['AltRight', 'ALTGR', 1.25], ['ContextMenu', '☰', 1.25], ['ControlRight', 'CTRL', 2.25]],
  ];
  // flechas (T invertida) y teclado numérico: [código, etiqueta, x, y, ancho, alto]
  const EXTRA = [
    ['ArrowUp', '▲', 16.5, 3], ['ArrowLeft', '◀', 15.5, 4], ['ArrowDown', '▼', 16.5, 4], ['ArrowRight', '▶', 17.5, 4],
    ['NumLock', 'BLQ', 19, 0], ['NumpadDivide', '/', 20, 0], ['NumpadMultiply', '*', 21, 0], ['NumpadSubtract', '-', 22, 0],
    ['Numpad7', '7', 19, 1], ['Numpad8', '8', 20, 1], ['Numpad9', '9', 21, 1], ['NumpadAdd', '+', 22, 1, 1, 2],
    ['Numpad4', '4', 19, 2], ['Numpad5', '5', 20, 2], ['Numpad6', '6', 21, 2],
    ['Numpad1', '1', 19, 3], ['Numpad2', '2', 20, 3], ['Numpad3', '3', 21, 3], ['NumpadEnter', '⏎', 22, 3, 1, 2],
    ['Numpad0', '0', 19, 4, 2], ['NumpadDecimal', '.', 21, 4],
  ];

  function keyFunctions() {
    const map = {};
    for (const [dev, num] of [['kb1', 1], ['kb2', 2]]) {
      const km = Input.keymaps[dev];
      for (const k of ['left', 'right', 'up', 'down']) for (const c of km[k]) map[c] = { fn: 'move', p: num };
      for (const k of ['jump', 'atk', 'spc', 'shd', 'grab']) km[k].forEach((c, i) => { map[c] = { fn: k, p: num, alt: i > 0 }; });
    }
    for (const [dev, num] of [['kb1', 1], ['kb2', 2]]) Input.keymaps[dev].str.forEach((c, i) => { map[c] = { fn: 'smash', p: num, alt: i > 0 }; });
    map.Escape = { fn: 'pause', p: 0 };
    return map;
  }

  function keyboardSVG() {
    const U = 40, G = 4, used = keyFunctions();
    const keys = [];
    ROWS.forEach((row, y) => { let x = 0; for (const [code, label, w = 1] of row) { keys.push({ code, label, x, y: y + 1, w, h: 1 }); x += w; } });
    for (const [code, label, x, y, w = 1, h = 1] of EXTRA) keys.push({ code, label, x, y: y + 1, w, h });
    keys.push({ code: 'Escape', label: 'ESC', x: 0, y: 0, w: 1, h: 1 });
    const out = [];
    for (const k of keys) {
      const X = k.x * U + G / 2, Y = k.y * U + G / 2, Wd = k.w * U - G, Ht = k.h * U - G;
      const u = used[k.code];
      if (u) {
        const col = FN[u.fn].col;
        out.push(`<rect x="${X}" y="${Y + 3}" width="${Wd}" height="${Ht}" rx="5" fill="#0b0a24"/>`);
        out.push(`<rect x="${X}" y="${Y}" width="${Wd}" height="${Ht}" rx="5" fill="${col}" stroke="#f1eeff" stroke-width="${u.alt ? 1 : 2}"/>`);
        out.push(`<rect x="${X + 3}" y="${Y + 3}" width="${Wd - 6}" height="${Ht * 0.45}" rx="3" fill="#ffffff" opacity="0.16"/>`);
        out.push(`<text x="${X + Wd / 2}" y="${Y + Ht / 2 + 5}" text-anchor="middle" font-size="${k.label.length > 3 ? 8 : 12}" fill="#120d24" ${FONT}>${esc(k.label)}</text>`);
        if (u.p) {
          out.push(`<rect x="${X + Wd - 15}" y="${Y - 7}" width="18" height="14" rx="3" fill="${u.p === 1 ? '#e8443f' : '#3d7ef2'}" stroke="#120d24" stroke-width="2"/>`);
          out.push(`<text x="${X + Wd - 6}" y="${Y + 4}" text-anchor="middle" font-size="8" fill="#fff" ${FONT}>${u.p}</text>`);
        }
      } else {
        out.push(`<rect x="${X}" y="${Y}" width="${Wd}" height="${Ht}" rx="5" fill="#1b1738" stroke="#2a2456" stroke-width="2"/>`);
        out.push(`<text x="${X + Wd / 2}" y="${Y + Ht / 2 + 4}" text-anchor="middle" font-size="${k.label.length > 3 ? 6 : 9}" fill="#4d4880" ${FONT}>${esc(k.label)}</text>`);
      }
    }
    // etiquetas de grupo
    const tag = (x, y, txt, col) => out.push(`<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="${col}" ${FONT}>${txt}</text>`);
    tag(2 * U, 6 * U + 24, 'JUGADOR 1', '#ff9a76');
    tag(16.5 * U, 6 * U + 24, 'JUGADOR 2', '#86c8ff');
    tag(21 * U, 6 * U + 24, 'JUGADOR 2', '#86c8ff');
    return `<svg viewBox="-6 -12 ${23 * U + 12} ${6 * U + 44}" class="kbsvg" role="img" aria-label="Teclado">${out.join('')}</svg>`;
  }

  function keyboardLegend() {
    const km = Input.keymaps, nm = c => {
      const all = ROWS.flat().concat(EXTRA);
      const k = all.find(r => r[0] === c);
      const lab = k ? k[1] : c;
      return c.startsWith('Numpad') ? 'NUM ' + lab : c === 'ShiftRight' ? 'SHIFT DER.' : c === 'ShiftLeft' ? 'SHIFT IZQ.' : c === 'ControlRight' ? 'CTRL DER.' : lab;
    };
    const col = (dev, title, color) => {
      const m = km[dev];
      const rows = [
        ['move', [m.up, m.left, m.down, m.right].map(a => nm(a[0])).join(' ')],
        ['jump', m.jump.map(nm).join(' / ')], ['atk', m.atk.map(nm).join(' / ')],
        ['spc', m.spc.map(nm).join(' / ')], ['shd', m.shd.map(nm).join(' / ')], ['grab', m.grab.map(nm).join(' / ')], ['smash', m.str.map(nm).join(' / ')],
      ];
      return `<div class="lg" style="grid-template-columns: repeat(3, auto)"><div class="lgt" style="color:${color}">${title}</div>${rows.map(([f, k]) =>
        `<div class="lgr"><span class="chip" style="background:${FN[f].col}"></span><b>${FN[f].name}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
    };
    return `<div class="legend">${col('kb1', 'JUGADOR 1 · TECLADO 1', '#ff9a76')}${col('kb2', 'JUGADOR 2 · TECLADO 2', '#86c8ff')}</div>`;
  }

  // ------------------------------------------------------------
  //  MANDOS
  // ------------------------------------------------------------
  const BODY = {
    xbox: 'M232 112 C252 100 280 104 296 110 L344 110 C360 104 388 100 408 112 C440 130 470 190 486 262 C494 300 470 318 446 304 C430 294 418 270 404 252 C392 240 380 236 366 236 L274 236 C260 236 248 240 236 252 C222 270 210 294 194 304 C170 318 146 300 154 262 C170 190 200 130 232 112 Z',
    ps: 'M222 112 L418 112 C444 112 460 124 468 148 C480 186 494 238 500 274 C504 304 480 318 458 304 C440 292 428 264 412 248 L228 248 C212 264 200 292 182 304 C160 318 136 304 140 274 C146 238 160 186 172 148 C180 124 196 112 222 112 Z',
    nin: 'M230 114 C250 104 282 106 298 112 L342 112 C358 106 390 104 410 114 C442 132 468 196 482 262 C490 300 466 316 444 302 C428 292 416 270 402 254 C390 242 378 238 364 238 L276 238 C262 238 250 242 238 254 C224 270 212 292 196 302 C174 316 150 300 158 262 C172 196 198 132 230 114 Z',
  };
  const LAYOUT = {
    xbox: { ls: [254, 162], dp: [290, 214], rs: [366, 214], face: [408, 162], sel: [298, 148], start: [342, 148],
            faceL: { t: ['Y', '#f4c03a'], r: ['B', '#e8443f'], b: ['A', '#3ec96b'], l: ['X', '#3d7ef2'] }, selL: '⧉', startL: '≡',
            bumpers: ['LB', 'RB'], triggers: ['LT', 'RT'], body: '#2c2a44', trim: '#3b3860' },
    ps:   { ls: [284, 216], dp: [236, 162], rs: [356, 216], face: [404, 162], sel: [262, 128], start: [378, 128],
            faceL: { t: ['△', '#40c9a6'], r: ['○', '#e8443f'], b: ['✕', '#6aa8ff'], l: ['□', '#e88bd0'] }, selL: '▤', startL: '≡',
            bumpers: ['L1', 'R1'], triggers: ['L2', 'R2'], body: '#252a40', trim: '#363d5c', touch: true },
    nin:  { ls: [254, 162], dp: [290, 214], rs: [366, 214], face: [408, 162], sel: [298, 144], start: [342, 144],
            faceL: { t: ['X', '#e8e2ff'], r: ['A', '#e8e2ff'], b: ['B', '#e8e2ff'], l: ['Y', '#e8e2ff'] }, selL: '−', startL: '+',
            bumpers: ['L', 'R'], triggers: ['ZL', 'ZR'], body: '#1f1d2e', trim: '#34314a', home: true },
  };
  const FACE_OFF = { t: [0, -21], r: [21, 0], b: [0, 21], l: [-21, 0] };
  // posición física de cada función: Xbox/PS atacan con el de abajo; Nintendo con el de la derecha (A)
  const FACE_FN = { xbox: { b: 'atk', r: 'spc', l: 'jump', t: 'jump' }, ps: { b: 'atk', r: 'spc', l: 'jump', t: 'jump' }, nin: { r: 'atk', b: 'spc', l: 'jump', t: 'jump' } };

  function padSVG(kind) {
    const L = LAYOUT[kind], o = [];
    const face = s => [L.face[0] + FACE_OFF[s][0], L.face[1] + FACE_OFF[s][1]];
    // gatillos y botones superiores
    o.push(`<rect x="200" y="78" width="66" height="22" rx="8" fill="${L.trim}" stroke="#120d24" stroke-width="3"/>`);
    o.push(`<rect x="374" y="78" width="66" height="22" rx="8" fill="${L.trim}" stroke="#120d24" stroke-width="3"/>`);
    o.push(`<rect x="196" y="96" width="82" height="14" rx="6" fill="#4a4678" stroke="#120d24" stroke-width="3"/>`);
    o.push(`<rect x="362" y="96" width="82" height="14" rx="6" fill="#4a4678" stroke="#120d24" stroke-width="3"/>`);
    const small = (x, y, t, fs = 8) => o.push(`<text x="${x}" y="${y}" text-anchor="middle" font-size="${fs}" fill="#cfc8f0" ${FONT}>${t}</text>`);
    small(233, 93, L.triggers[0]); small(407, 93, L.triggers[1]); small(237, 107, L.bumpers[0], 7); small(403, 107, L.bumpers[1], 7);
    // cuerpo
    o.push(`<path d="${BODY[kind]}" fill="#120d24" transform="translate(0 6)"/>`);
    o.push(`<path d="${BODY[kind]}" fill="${L.body}" stroke="#120d24" stroke-width="4"/>`);
    o.push(`<path d="${BODY[kind]}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2" transform="translate(2 2) scale(0.994)"/>`);
    if (L.touch) o.push(`<rect x="290" y="118" width="60" height="44" rx="6" fill="${L.trim}" stroke="#120d24" stroke-width="3"/>`);
    if (L.home) { o.push(`<circle cx="338" cy="172" r="6" fill="${L.trim}" stroke="#120d24" stroke-width="2"/>`); o.push(`<rect x="296" y="166" width="11" height="11" rx="2" fill="${L.trim}" stroke="#120d24" stroke-width="2"/>`); }
    if (kind === 'xbox') o.push(`<circle cx="320" cy="124" r="11" fill="#3ec96b" stroke="#120d24" stroke-width="3"/>`);
    if (kind === 'ps') o.push(`<circle cx="320" cy="200" r="6" fill="${L.trim}" stroke="#120d24" stroke-width="2"/>`);
    // palancas
    const stick = ([x, y]) => {
      o.push(`<circle cx="${x}" cy="${y}" r="21" fill="#17152a" stroke="#120d24" stroke-width="3"/>`);
      o.push(`<circle cx="${x}" cy="${y}" r="15" fill="#4a4678" stroke="#120d24" stroke-width="3"/>`);
      o.push(`<circle cx="${x - 3}" cy="${y - 3}" r="6" fill="#ffffff" opacity="0.12"/>`);
    };
    stick(L.ls); stick(L.rs);
    // cruceta
    const [dx, dy] = L.dp;
    o.push(`<path d="M${dx - 7} ${dy - 21} h14 v14 h14 v14 h-14 v14 h-14 v-14 h-14 v-14 h14 z" fill="#4a4678" stroke="#120d24" stroke-width="3"/>`);
    // botones frontales
    for (const s of ['t', 'r', 'b', 'l']) {
      const [x, y] = face(s), [lab, col] = L.faceL[s];
      o.push(`<circle cx="${x}" cy="${y + 2}" r="11" fill="#120d24"/>`);
      o.push(`<circle cx="${x}" cy="${y}" r="11" fill="#17152a" stroke="#120d24" stroke-width="2"/>`);
      o.push(`<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="12" fill="${col}" ${FONT}>${lab}</text>`);
    }
    // select / start
    for (const [p, t] of [[L.sel, L.selL], [L.start, L.startL]]) {
      o.push(`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${L.trim}" stroke="#120d24" stroke-width="2"/>`);
      o.push(`<text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" font-size="8" fill="#cfc8f0" ${FONT}>${t}</text>`);
    }

    // ---- flechas hacia cada función ----
    const FF = FACE_FN[kind], faceOf = fn => ['t', 'r', 'b', 'l'].filter(s => FF[s] === fn);
    const lab = fn => faceOf(fn).map(s => L.faceL[s][0]).join(' / ');
    const callouts = [
      { fn: 'shd', side: 'L', y: 52, pts: [[202, 89, 0]], key: L.triggers[0] },
      { fn: 'grab', side: 'L', y: 96, pts: [[198, 103, 0]], key: L.bumpers[0] },
      { fn: 'move', side: 'L', y: 162, pts: [[...L.ls, 15], [...L.dp, 0]], key: 'PALANCA IZQ. · CRUCETA' },
      { fn: 'pause', side: 'L', y: 250, pts: [[...L.start, 7]], key: kind === 'xbox' ? 'MENÚ' : kind === 'ps' ? 'OPTIONS' : '+' },
      { fn: 'shd', side: 'R', y: 44, pts: [[438, 89, 0]], key: L.triggers[1] },
      { fn: 'grab', side: 'R', y: 84, pts: [[442, 103, 0]], key: L.bumpers[1] },
      { fn: 'jump', side: 'R', y: 128, pts: faceOf('jump').map(f => [...face(f), 11]), key: lab('jump') },
      { fn: 'atk', side: 'R', y: 174, pts: faceOf('atk').map(f => [...face(f), 11]), key: lab('atk') },
      { fn: 'spc', side: 'R', y: 222, pts: faceOf('spc').map(f => [...face(f), 11]), key: lab('spc') },
      { fn: 'smash', side: 'R', y: 280, pts: [[...L.rs, 15]], key: 'PALANCA DER.' },
    ];
    for (const c of callouts) {
      const col = FN[c.fn].col, left = c.side === 'L';
      const lx = left ? 150 : 490;
      for (const [bx, by, br] of c.pts) {
        // el punto va al borde del botón para no tapar su letra
        const px = bx + (left ? -br : br) * 0.75, py = by - br * 0.65;
        const ex = left ? 175 : 465;
        o.push(`<polyline points="${lx},${c.y} ${ex},${c.y} ${px},${py}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`);
        o.push(`<circle cx="${px}" cy="${py}" r="4" fill="${col}" stroke="#120d24" stroke-width="2"/>`);
      }
      const tx = left ? 146 : 494, anchor = left ? 'end' : 'start';
      o.push(`<text x="${tx}" y="${c.y - 3}" text-anchor="${anchor}" font-size="10" fill="${col}" ${FONT}>${FN[c.fn].name}</text>`);
      o.push(`<text x="${tx}" y="${c.y + 13}" text-anchor="${anchor}" font-size="8" fill="#cfc8f0" ${FONT}>${esc(c.key)}</text>`);
    }
    return `<svg viewBox="-60 30 760 300" class="padsvg" role="img" aria-label="Mando">${o.join('')}</svg>`;
  }

  const PAD_NOTES = {
    xbox: 'A: aceptar · B: volver en los menús',
    ps: '✕: aceptar · ○: volver en los menús',
    nin: 'A: aceptar · B: volver en los menús',
  };

  return {
    FN,
    render(tab) {
      if (tab === 'kb') return {
        html: keyboardSVG() + keyboardLegend(),
        notes: 'Ataque fuerte: dirección + su tecla (mantenla para cargar) · Agarrar: su tecla y luego una dirección para lanzar · Volver: Esc o atrás',
      };
      return {
        html: padSVG(tab),
        notes: `Ataque fuerte: palanca derecha (para cargarlo: inclina rápido la izquierda + mantén atacar) · Agarrar y luego dirección para lanzar · ${PAD_NOTES[tab]}`,
      };
    },
  };
})();
