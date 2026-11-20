'use strict';
// ============================================================
//  Punteros de los menús de selección (al estilo Smash)
//  · Cada dispositivo tiene su propio puntero de color.
//  · Ratón: mueve el puntero del Teclado 1 · clic = elegir · clic derecho = atrás
//  · Teclado 1: WASD + J (elegir) / K (atrás) · Teclado 2: flechas + Num1 / Num2
//  · Mando: palanca o cruceta + A (elegir) / B (atrás)
//  Los elementos con data-act="..." se pueden elegir.
// ============================================================
const Pointer = (() => {
  const curs = {};
  let host = null;          // { act(dev, el, act), back(dev), info(dev) -> {label, color, badge}, root }
  let mouseDown = false;

  const wrapRect = () => document.getElementById('wrap').getBoundingClientRect();
  function ensure(dev) {
    if (curs[dev]) return curs[dev];
    const r = wrapRect(), n = Object.keys(curs).length;
    const el = document.createElement('div');
    el.className = 'cur';
    el.innerHTML = '<i></i><span></span>';
    document.getElementById('cursors').appendChild(el);
    return (curs[dev] = { dev, x: r.left + r.width * (0.35 + n * 0.1), y: r.top + r.height * 0.55, el, hov: null, idle: 0 });
  }
  function hoverAt(c) {
    const root = host && host.root(); if (!root) return null;
    const hit = document.elementFromPoint(c.x, c.y);
    const el = hit && hit.closest('[data-act]');
    return el && (root.contains(el) || el.closest('#volDock.on')) && !el.classList.contains('disabled') ? el : null;
  }
  function setHover(c, el) {
    if (c.hov === el) return;
    if (c.hov) c.hov.classList.remove('hov');
    c.hov = el;
    if (el) { el.classList.add('hov'); el.style.setProperty('--hc', c.color || '#ffd34a'); if (host && host.hover) host.hover(c.dev, el); }
  }
  function confirm(c) {
    const el = hoverAt(c); setHover(c, el);
    const a = el ? el.dataset.act : null;
    if (a && a.startsWith('vol')) { if (!c.mouse) Sonido.pointerAct(el, a, c.x); return; }   // volumen (con ratón lo hace el propio control)
    host && host.act(c.dev, el, a);
  }

  // ratón = puntero del Teclado 1
  addEventListener('mousemove', e => {
    if (!host) return;
    const c = ensure('kb1'); c.x = e.clientX; c.y = e.clientY; c.idle = 0; c.mouse = true;
  });
  addEventListener('mousedown', e => {
    if (!host) return;
    if (e.target.closest && e.target.closest('#volDock')) return;     // el volumen funciona con el ratón normal (arrastrar, clic)
    const c = ensure('kb1'); c.x = e.clientX; c.y = e.clientY;
    if (e.button === 0) confirm(c);
    if (e.button === 2) host.back('kb1');
    e.preventDefault();
  });
  addEventListener('contextmenu', e => { if (host) e.preventDefault(); });

  // punteros de otros jugadores en línea (solo se dibujan, no eligen nada)
  const ghosts = {};
  function setGhosts(list) {
    const r = wrapRect(), seen = new Set();
    for (const g of list || []) {
      seen.add(g.id);
      let el = ghosts[g.id];
      if (!el) { el = document.createElement('div'); el.className = 'cur ghost'; el.innerHTML = '<i></i><span></span>'; document.getElementById('cursors').appendChild(el); ghosts[g.id] = el; }
      el.style.display = host ? '' : 'none';
      el.style.transform = `translate(${Math.round(g.x * r.width)}px, ${Math.round(g.y * r.height)}px)`;
      el.style.setProperty('--c', g.color);
      const lab = el.querySelector('span'); if (lab.textContent !== g.label) lab.textContent = g.label;
    }
    for (const id in ghosts) if (!seen.has(id)) { ghosts[id].remove(); delete ghosts[id]; }
  }

  return {
    get cursors() { return curs; },
    setGhosts,
    // mis punteros, en proporción a la pantalla del juego (para mandarlos por la red)
    mine() {
      if (!host) return [];
      const r = wrapRect(), out = [];
      for (const dev in curs) {
        const c = curs[dev]; if (c.el.style.display === 'none') continue;
        const info = host.info(dev);
        out.push({ x: Math.round((c.x - r.left) / r.width * 1000) / 1000, y: Math.round((c.y - r.top) / r.height * 1000) / 1000, label: info.label, color: info.color });
      }
      return out;
    },
    attach(h) { host = h; document.body.classList.add('pointer-ui'); for (const d in curs) curs[d].el.style.display = ''; },
    detach() {
      host = null; document.body.classList.remove('pointer-ui');
      setGhosts([]);
      for (const d in curs) { setHover(curs[d], null); curs[d].el.style.display = 'none'; }
    },
    hovered(dev) { return curs[dev] && curs[dev].hov; },
    // por frame
    update(locked) {
      if (!host) return;
      const r = wrapRect(), speed = Math.max(4, r.width / 150);
      for (const dev of Input.devices()) {
        const s = Input.read(dev); if (!s) continue;
        const pad = dev.startsWith('gp');
        const moving = Math.abs(s.mx) > 0.2 || Math.abs(s.my) > 0.2;
        const ok = Input.pressed(dev, 'atk'), back = Input.pressed(dev, 'spc');
        if (!curs[dev] && !moving && !ok && !back) continue;   // aparece al usarlo
        const c = ensure(dev);
        if (moving) {
          const k = pad ? Math.hypot(s.mx, s.my) : 1;
          const n = Math.hypot(s.mx, s.my) || 1;
          c.x += s.mx / n * speed * k * (pad ? 1.15 : 0.95);
          c.y += s.my / n * speed * k * (pad ? 1.15 : 0.95);
          c.mouse = false;
        }
        c.x = clamp(c.x, r.left + 4, r.right - 4); c.y = clamp(c.y, r.top + 4, r.bottom - 4);
        if (!locked) {
          if (ok) confirm(c);
          else if (back) host.back(dev);
          if (!host) return;          // esa acción cambió de pantalla (p. ej. abrió los controles)
        }
      }
      for (const dev in curs) {
        if (!host) return;
        const c = curs[dev];
        if (dev !== 'kb1' && !Input.connected(dev)) { setHover(c, null); c.el.remove(); delete curs[dev]; continue; }
        const info = host.info(dev);
        c.color = info.color;
        setHover(c, hoverAt(c));
        c.el.style.transform = `translate(${Math.round(c.x - r.left)}px, ${Math.round(c.y - r.top)}px)`;
        c.el.style.setProperty('--c', info.color);
        const lab = c.el.querySelector('span');
        const txt = info.label + (info.badge ? ' · ' + info.badge : '');
        if (lab.textContent !== txt) lab.textContent = txt;
      }
    },
  };
})();
