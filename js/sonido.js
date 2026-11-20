'use strict';
// ============================================================
//  VOLUMEN: música y efectos por separado.
//  · En los menús: dos botones (🔊 efectos · ♪ música). Al pasar el
//    ratón se despliega su deslizador; un clic silencia o reactiva.
//  · En la pausa: los dos deslizadores a la vista, con su botón de silencio
//    (también con el mando: ← → cambia el volumen).
//  Se guarda en este navegador.
// ============================================================
const Sonido = (() => {
  const KEY = 'arenaPixel.sonido';
  const st = { sfx: 8, music: 7, sfxMute: false, musicMute: false };     // volúmenes de 0 a 10
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const level = k => st[k + 'Mute'] ? 0 : st[k] / 10;
  function apply() { Sfx.setLevel(level('sfx')); Music.setLevel(level('music')); }

  // iconos en pixel art (el silenciado lleva una X roja)
  const SPEAKER = '<path fill="currentColor" d="M1 4h2v4H1zM3 4h1V3h1V2h1V1h1v10H6v-1H5V9H4V8H3z"/>';
  const WAVES = '<path fill="currentColor" d="M9 4h1v4H9zM11 2h1v1h1v6h-1v1h-1V8h1V4h-1z"/>';
  const NOTE = '<path fill="currentColor" d="M5 1h6v8h-1v1H8V9H7V8h1V7h2V3H6v7H5v1H3v-1H2V9h1V8h2z"/>';
  const CROSS = '<path fill="#ff4a5a" d="M9 4h1v1h1v1h1V5h1V4h1v1h-1v1h-1v1h1v1h1v1h-1V8h-1V7h-1v1H9V7h1V6H9V5z" transform="translate(-1 1)"/>';
  const icon = (k, muted) => `<svg viewBox="0 0 14 12" shape-rendering="crispEdges">${k === 'sfx' ? SPEAKER + (muted ? CROSS : WAVES) : NOTE + (muted ? CROSS : '')}</svg>`;
  const NAMES = { sfx: 'Efectos', music: 'Música' };      // (la fuente pixel dibuja mal la Ú mayúscula)

  const views = [];                    // todos los controles dibujados (menús y pausa) para refrescarlos juntos
  function refresh() {
    for (const v of views) {
      const m = st[v.k + 'Mute'];
      v.btn.innerHTML = icon(v.k, m);
      v.btn.classList.toggle('muted', m);
      v.btn.title = (m ? 'Activar ' : 'Silenciar ') + NAMES[v.k].toLowerCase();
      v.range.value = st[v.k];
      v.range.style.setProperty('--p', (st[v.k] * 10) + '%');
      if (v.num) v.num.textContent = m ? '—' : st[v.k];
    }
  }
  function toggle(k) { st[k + 'Mute'] = !st[k + 'Mute']; if (!st[k + 'Mute'] && st[k] === 0) st[k] = 5; apply(); save(); refresh(); if (k === 'sfx') Sfx.blip(); }
  function set(k, v) { st[k] = clamp(Math.round(v), 0, 10); st[k + 'Mute'] = st[k] === 0; apply(); save(); refresh(); }
  function control(k, withNum) {
    const btn = document.createElement('button'); btn.className = 'sndBtn'; btn.setAttribute('aria-label', NAMES[k]);
    btn.dataset.act = 'vol:' + k;
    btn.onclick = e => { e.stopPropagation(); toggle(k); };
    const range = document.createElement('input');
    Object.assign(range, { type: 'range', min: 0, max: 10, step: 1, className: 'sndRange' });
    range.setAttribute('aria-label', 'Volumen de ' + NAMES[k].toLowerCase());
    range.dataset.act = 'volr:' + k;
    range.oninput = () => { set(k, +range.value); if (k === 'sfx' && uiTick % 2 === 0) Sfx.blip(); };
    range.addEventListener('padpress', () => toggle(k));          // con el mando: A sobre el deslizador silencia / reactiva
    const v = { k, btn, range, num: null };
    if (withNum) { v.num = document.createElement('b'); v.num.className = 'sndNum'; }
    views.push(v);
    return v;
  }
  let uiTick = 0;

  // ---------- menús: botones flotantes con deslizador desplegable ----------
  function buildDock() {
    const dock = document.createElement('div'); dock.id = 'volDock';
    for (const k of ['sfx', 'music']) {
      const v = control(k, false), item = document.createElement('div'), pop = document.createElement('div');
      item.className = 'volItem'; pop.className = 'volPop'; pop.dataset.act = 'volp:' + k;   // el puntero no lo cierra al pasar por el recuadro
      pop.innerHTML = `<small>${NAMES[k]}</small>`; pop.appendChild(v.range);
      v.range.addEventListener('input', () => uiTick++);
      item.append(pop, v.btn); dock.appendChild(item);
    }
    document.getElementById('wrap').appendChild(dock);
  }
  // ---------- pausa: los deslizadores a la vista ----------
  function buildPause() {
    const box = document.getElementById('pauseAudio');
    for (const k of ['sfx', 'music']) {
      const v = control(k, true), row = document.createElement('div');
      row.className = 'paRow';
      const lab = document.createElement('span'); lab.textContent = NAMES[k];
      row.append(v.btn, lab, v.range, v.num);
      box.appendChild(row);
    }
    const hint = document.createElement('div'); hint.className = 'paHint';
    hint.textContent = 'Mando: ◀ ▶ volumen · A silencia';
    box.appendChild(hint);
  }
  // el dock solo se ve en los menús (no en la pelea, la pantalla VS ni la pausa)
  function showDock(on) { const d = document.getElementById('volDock'); if (d) d.classList.toggle('on', on); }

  buildDock(); buildPause(); refresh(); apply();
  showDock(screen !== 'game' && screen !== 'vs');              // la portada ya está en pantalla al cargar
  // el puntero de las pantallas de selección eligió algo del volumen
  function pointerAct(el, act, x) {
    const [kind, k] = act.split(':');
    if (kind === 'vol') toggle(k);
    else if (kind === 'volr') { const r = el.getBoundingClientRect(); set(k, (x - r.left) / r.width * 10); if (k === 'sfx') Sfx.blip(); }
  }
  return { apply, showDock, toggle, set, pointerAct, get state() { return st; } };
})();
