'use strict';
// ============================================================
//  Entrada: dos esquemas de teclado + cualquier mando (Gamepad API)
// ============================================================
const Input = (() => {
  const down = new Set();
  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Period', 'Tab']);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    down.add(e.code);
    if (PREVENT.has(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  const KEYMAPS = {
    kb1: {
      name: 'Teclado 1',
      left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      jump: ['Space'], atk: ['KeyJ', 'KeyF'], spc: ['KeyK', 'KeyG'], shd: ['KeyL', 'ShiftLeft'], grab: ['Semicolon', 'KeyH'], str: ['KeyU'],
    },
    kb2: {
      name: 'Teclado 2',
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      jump: ['Numpad0', 'ShiftRight'], atk: ['Numpad1', 'Period'], spc: ['Numpad2', 'Slash'], shd: ['Numpad3', 'ControlRight'], grab: ['Numpad4', 'Comma'], str: ['Numpad5', 'KeyM'],
    },
  };
  const any = codes => codes.some(c => down.has(c));

  function readKb(m) {
    return {
      mx: (any(m.right) ? 1 : 0) - (any(m.left) ? 1 : 0),
      my: (any(m.down) ? 1 : 0) - (any(m.up) ? 1 : 0),
      cx: 0, cy: 0,
      jump: any(m.jump), atk: any(m.atk), spc: any(m.spc), shd: any(m.shd), grab: any(m.grab), str: any(m.str), start: false,
    };
  }

  function padKind(id) {
    id = (id || '').toLowerCase();
    if (/xbox|xinput|045e/.test(id)) return 'xbox';     // primero: algunos Xbox también dicen "Wireless Controller"
    if (/054c|playstation|dualsense|dualshock|wireless controller/.test(id)) return 'ps';
    if (/057e|nintendo|pro controller|joy-con|switch/.test(id)) return 'nin';
    return 'xbox';
  }
  const KIND_NAME = { xbox: 'Mando Xbox', ps: 'Mando PlayStation', nin: 'Mando Nintendo' };
  // Botones por posición (mapeo "standard"): 0 abajo, 1 derecha, 2 izquierda, 3 arriba
  //  Xbox / PlayStation: abajo = atacar, derecha = especial, izq/arriba = saltar
  //  Nintendo: A (derecha) = atacar, B (abajo) = especial, X/Y = saltar  (como están acostumbrados)
  const PAD_BTNS = { xbox: { atk: 0, spc: 1 }, ps: { atk: 0, spc: 1 }, nin: { atk: 1, spc: 0 } };
  const dz = v => Math.abs(v) < 0.25 ? 0 : v;

  let pads = [];
  function readPad(i) {
    const p = pads[i];
    if (!p || !p.connected) return null;
    const b = k => !!(p.buttons[k] && p.buttons[k].pressed);
    const ax = k => p.axes[k] || 0;
    const map = PAD_BTNS[padKind(p.id)];
    let mx = dz(ax(0)), my = dz(ax(1));
    if (b(14)) mx = -1; if (b(15)) mx = 1; if (b(12)) my = -1; if (b(13)) my = 1;
    return {
      mx, my, cx: dz(ax(2)), cy: dz(ax(3)),
      jump: b(2) || b(3), atk: b(map.atk), spc: b(map.spc),
      shd: b(6) || b(7), grab: b(4) || b(5), start: b(9),   // gatillos = escudo · botones superiores = agarre
      raw: p.buttons.map(x => !!(x && x.pressed)),
    };
  }

  let cur = {}, prev = {};
  function update() {
    pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    prev = cur; cur = {};
    cur.kb1 = readKb(KEYMAPS.kb1);
    cur.kb2 = readKb(KEYMAPS.kb2);
    pads.forEach((p, i) => { if (p && p.connected) cur['gp' + i] = readPad(i); });
  }
  return {
    keymaps: KEYMAPS,
    // botón físico por índice (0 abajo, 1 derecha, 2 izquierda, 3 arriba, 8 select, 9 start...)
    rawPressed: (dev, i) => !!(cur[dev] && cur[dev].raw && cur[dev].raw[i] && !(prev[dev] && prev[dev].raw && prev[dev].raw[i])),
    update,
    devices: () => Object.keys(cur),
    read: dev => cur[dev] || null,
    pressed: (dev, btn) => !!(cur[dev] && cur[dev][btn] && !(prev[dev] && prev[dev][btn])),
    key: code => down.has(code),
    name(dev) {
      if (KEYMAPS[dev]) return KEYMAPS[dev].name;
      if (dev === 'me') return 'Tú';
      if (dev.startsWith('net:')) return 'En línea';
      const i = +dev.slice(2), p = pads[i];
      return p ? `${KIND_NAME[padKind(p.id)]} ${i + 1}` : 'Mando desconectado';
    },
    kind(dev) {
      if (KEYMAPS[dev]) return 'kb';
      const p = pads[+dev.slice(2)];
      return p ? padKind(p.id) : 'xbox';
    },
    connected: dev => !!cur[dev],
  };
})();
