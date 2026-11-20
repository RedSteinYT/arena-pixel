'use strict';
// ============================================================
//  Aplicación: pantalla, bucle principal, portada, pausa,
//  resultados y controles. (La selección está en select.js)
// ============================================================
const $ = id => document.getElementById(id);
const disp = $('screen'), dctx = disp.getContext('2d');
const buf = mkCanvas(W, H), bctx = buf.getContext('2d');
const ambient = document.getElementById('ambient'), actx = ambient.getContext('2d');
actx.imageSmoothingEnabled = true; actx.imageSmoothingQuality = 'high';
let S = 1;

// El juego ocupa todo lo que permite la proporción 16:9 (no solo saltos enteros ×2, ×3…).
// El lienzo se pinta a escala entera (S, píxeles nítidos) igual o mayor que la pantalla y el
// navegador solo lo reduce un poco; si encaja exacto, se ve con píxeles perfectos.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const view = Math.min(innerWidth / W, innerHeight / H);       // tamaño en pantalla (px CSS)
  S = Math.max(1, Math.ceil(view * dpr - 0.02));
  disp.width = W * S; disp.height = H * S;
  const cw = Math.floor(W * view), ch = Math.floor(H * view);
  disp.style.width = cw + 'px'; disp.style.height = ch + 'px';
  disp.style.imageRendering = Math.abs(view * dpr - S) < 0.02 ? 'pixelated' : 'auto';
  const wr = document.getElementById('wrap'); wr.style.width = cw + 'px'; wr.style.height = ch + 'px';
  dctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
resize();

// texto nítido con la fuente pixel, alineado a la rejilla interna
const TXT = {
  text(str, x, y, size, col, align = 'left') {
    dctx.setTransform(S, 0, 0, S, 0, 0);
    dctx.font = `${size}px "Press Start 2P", monospace`;
    dctx.textBaseline = 'top'; dctx.textAlign = align;
    const o = size >= 24 ? 3 : size >= 16 ? 2 : 1;
    dctx.fillStyle = OUTLINE; dctx.fillText(str, Math.round(x) + o, Math.round(y) + o);
    dctx.fillStyle = col; dctx.fillText(str, Math.round(x), Math.round(y));
    dctx.setTransform(1, 0, 0, 1, 0, 0);
  },
};

// ---------- estado de la app ----------
let screen = 'title';
let game = null, demo = null, paused = false, lastCfg = null;
let uiLock = 0;              // frames en los que se ignoran botones tras cambiar de pantalla
let lastPadKind = null;      // último tipo de mando usado (para la pestaña de controles)
const SCREENS = ['title', 'online', 'tutScr', 'modeScr', 'optScr', 'stageScr', 'charScr', 'controls', 'pause', 'results'];
const POINTER_SCREENS = ['modeScr', 'optScr', 'stageScr', 'charScr'];

function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('on', s === id);
  if (typeof Sonido !== 'undefined') Sonido.showDock(!!id && id !== 'pause');   // volumen flotante: solo en los menús
  uiLock = 15;
  Nav.clear();
}
function go(scr) { screen = scr; show(scr === 'game' ? null : scr); }

// partida de demostración (CPUs) detrás de los menús
function newDemo() {
  demo = new Game({ teams: false, stocks: 99, players: [0, 1, 2, 3].map(i => ({ device: 'cpu', pal: i, team: 0, char: CHAR_ORDER[i % CHAR_ORDER.length] })) });
  demo.phase = 'play';
  demo.renderHudArt = () => {};
}

// ============================================================
//  Navegación con mando por foco (portada, pausa, resultados)
// ============================================================
const Nav = {
  el: null, padMode: false,
  container() { const id = screen === 'game' ? (paused ? 'pause' : null) : screen; return id ? $(id) : null; },
  items() {
    const c = this.container(); if (!c) return [];
    const dock = document.querySelector('#volDock.on');
    const els = [...c.querySelectorAll('button, input[type=range]'), ...(dock && !paused ? dock.querySelectorAll('button, input[type=range]') : [])];
    // en la pausa, el silencio se hace con A sobre el deslizador (así no hay que vaciarlo para llegar al botón)
    return els.filter(b => !b.disabled && b.offsetParent !== null && !b.closest('#pauseAudio .paRow > button'));
  },
  set(b) {
    if (this.el) this.el.classList.remove('focus');
    this.el = b;
    if (b && this.padMode) { b.classList.add('focus'); b.scrollIntoView({ block: 'nearest' }); }
  },
  clear() { if (this.el) this.el.classList.remove('focus'); this.el = null; },
  ensure() {
    const it = this.items();
    if (!this.el || !it.includes(this.el)) this.set(it.find(b => b.classList.contains('go')) || it[0] || null);
    else if (this.padMode) this.el.classList.add('focus');
  },
  move(dx, dy) {
    this.ensure(); if (!this.el) return;
    if (dx && this.el.type === 'range') {                 // deslizador: ← → cambia el valor
      this.el.value = +this.el.value + dx; this.el.dispatchEvent(new Event('input')); return;
    }
    const own = this.el.type === 'range' && this.el.closest('.volItem');
    if (own && dy > 0) { this.set(own.querySelector('button')); Sfx.blip(); return; }   // bajar desde el deslizador: a su propio botón
    const r0 = this.el.getBoundingClientRect(), c0 = [r0.left + r0.width / 2, r0.top + r0.height / 2];
    // primero los botones "alineados" (que se solapan en el otro eje: misma fila al ir a los lados,
    // misma columna al subir/bajar); entre ellos, el más cercano. Así no se salta botones.
    // A los lados solo se va a uno de la misma fila; arriba/abajo, si no hay alineado, al más cercano.
    const span = (r, horiz) => horiz ? [r.top, r.bottom] : [r.left, r.right];
    const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
    let best = null, bestScore = 1e9;
    for (const b of this.items()) {
      if (b === this.el) continue;
      const r = b.getBoundingClientRect(), c = [r.left + r.width / 2, r.top + r.height / 2];
      const ddx = c[0] - c0[0], ddy = c[1] - c0[1];
      const main = dx ? ddx * dx : ddy * dy, side = dx ? Math.abs(ddy) : Math.abs(ddx);
      if (main <= 2) continue;
      const s0 = span(r0, !!dx), s1 = span(r, !!dx);
      const aligned = overlap(s0, s1) > Math.min(s0[1] - s0[0], s1[1] - s1[0]) * 0.3;
      if (dx && !aligned) continue;
      // distancia de borde a borde: un botón ancho debajo no cuenta como "más lejos" que uno estrecho
      const gap = dx ? (dx > 0 ? r.left - r0.right : r0.left - r.right) : (dy > 0 ? r.top - r0.bottom : r0.top - r.bottom);
      const score = (aligned ? 0 : 1e5) + Math.max(0, gap) * 10 + side;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    if (best) { this.set(best); Sfx.blip(); }
  },
  press() { this.ensure(); if (!this.el) return; if (this.el.type === 'range') this.el.dispatchEvent(new Event('padpress')); else this.el.click(); },   // A sobre un deslizador: silenciar
};
addEventListener('mousemove', () => { if (Nav.padMode) { Nav.padMode = false; if (Nav.el) Nav.el.classList.remove('focus'); } });

const dirState = {};
function padDir(dev) {
  const r = Input.read(dev); if (!r) return null;
  const v = Math.abs(r.mx) > 0.6 ? [sgn(r.mx), 0] : Math.abs(r.my) > 0.6 ? [0, sgn(r.my)] : null;
  const st = dirState[dev] || (dirState[dev] = { v: null, t: 0 });
  const same = v && st.v && v[0] === st.v[0] && v[1] === st.v[1];
  if (!v) { st.v = null; st.t = 0; return null; }
  if (!same) { st.v = v; st.t = 0; return v; }
  st.t++;
  if (st.t > 18 && st.t % 6 === 0) return v;
  return null;
}
const isPad = dev => dev.startsWith('gp');

function startFight(cfg, opts = {}) {
  if (Net.isClient && !opts.remote) return;          // en línea, la pelea la empieza el anfitrión
  lastCfg = cfg;
  Sfx.unlock();
  paused = false; resultsShown = false;
  if (Net.isHost) Net.sendStart(cfg);
  if (opts.late) { game = new Game(cfg); go('game'); return; }   // entró con la pelea ya empezada
  if (cfg.practice || cfg.tutorial) {                 // sin pantalla VS ni cuenta atrás
    if (cfg.practice) Practice.begin();
    game = new Game(cfg); game.phase = 'play'; game.phaseT = 60; go('game'); return;
  }
  // pantalla VS: unos segundos de cara a cara antes de pelear
  const vsGame = new Game(cfg);
  screen = 'vs'; show(null); acc = 0;
  VS.begin(vsGame, cfg, () => { game = new Game(cfg); go('game'); });
}

// ============================================================
//  Controles
// ============================================================
let ctrlTab = 'kb', ctrlReturn = 'title';
function setCtrlTab(tab) {
  ctrlTab = tab;
  document.querySelectorAll('#ctrlTabs button').forEach(b => b.classList.toggle('sel', b.dataset.tab === tab));
  const r = Controls.render(tab);
  $('ctrlView').innerHTML = r.html;
  $('ctrlNotes').textContent = r.notes;
}
function openControls() {
  ctrlReturn = screen === 'game' ? 'pause' : screen;
  if (POINTER_SCREENS.includes(screen)) Pointer.detach();
  setCtrlTab(lastPadKind || 'kb');
  screen = 'controls'; show('controls');
}
function closeControls() {
  Sfx.blip();
  if (ctrlReturn === 'pause') { screen = 'game'; paused = true; show('pause'); return; }
  screen = ctrlReturn; show(ctrlReturn);
  if (POINTER_SCREENS.includes(ctrlReturn)) Select.reattach();
}
const TAB_ORDER = ['kb', 'xbox', 'ps', 'nin'];
const kbPrevMx = {};
function kbTabEdge(kb) {
  const r = Input.read(kb), v = r ? sgn(r.mx) : 0, p = kbPrevMx[kb] || 0;
  kbPrevMx[kb] = v;
  return v && v !== p ? v : 0;
}
addEventListener('contextmenu', e => { if (screen === 'controls') { e.preventDefault(); closeControls(); } });
document.querySelectorAll('#ctrlTabs button').forEach(b => b.onclick = () => { Sfx.blip(); setCtrlTab(b.dataset.tab); });

// ---------- botones ----------
$('bPlay').onclick = () => { Sfx.unlock(); Sfx.blip(); if (Net.isHost) Net.showLobby(); else Select.openMode(); };
// enlaces del creador: se abren en otra pestaña (el juego sigue aquí)
for (const b of document.querySelectorAll('#creator .crBtn')) b.onclick = () => { Sfx.blip(); window.open(b.dataset.url, '_blank', 'noopener'); };
$('bOnline').onclick = () => { Sfx.unlock(); Sfx.blip(); Net.open(); };
const notOnline = () => { if (Net.online) { toast('Sal de la sala en línea para practicar'); return false; } return true; };
$('bPrac').onclick = () => { Sfx.unlock(); Sfx.blip(); if (notOnline()) Select.openPractice(); };
$('bTut').onclick = () => { Sfx.unlock(); Sfx.blip(); if (notOnline()) Tutorial.openMenu(); };
$('bTutBack').onclick = () => { Sfx.blip(); go('title'); };
$('bCtrlTitle').onclick = () => { Sfx.blip(); openControls(); };
$('bCtrlPause').onclick = () => { Sfx.blip(); openControls(); };
$('bCtrlBack').onclick = () => closeControls();
$('bResume').onclick = () => setPause(false);
$('bQuit').onclick = () => {
  const c = game && game.cfg; game = null; paused = false;
  if (c && c.tutorial) Tutorial.quit();
  else if (c && c.practice) Select.openPractice(true);
  else Select.openChars(true);
};
$('bRematch').onclick = () => { if (!Net.isClient) startFight(lastCfg); };
$('bLobby').onclick = () => { if (Net.isClient) return; game = null; Select.openChars(true); };
// volver a la portada (en línea, el anfitrión vuelve a su sala: los amigos siguen conectados)
$('bHome').onclick = () => {
  if (Net.isClient) return;
  Sfx.blip(); game = null; paused = false; resultsShown = false;
  Pointer.detach(); Select.state.screen = null;
  if (Net.isHost) Net.showLobby(); else go('title');
};

function setPause(v) {
  if (!game || game.phase === 'end' || Net.isClient) return;   // en línea pausa el anfitrión
  paused = v; screen = 'game'; show(v ? 'pause' : null); Sfx.blip();
  if (v) pauseExtra();
}
// opciones propias de la práctica y del tutorial en la pausa
function pauseExtra() {
  const el = $('pauseExtra'); el.innerHTML = '';
  const add = (txt, fn) => { const b = document.createElement('button'); b.textContent = txt; b.onclick = () => { Sfx.blip(); fn(b); }; el.appendChild(b); return b; };
  const c = game && game.cfg;
  if (c && c.practice) {
    add('DUMMY: ' + Practice.behaviour, b => { b.textContent = 'DUMMY: ' + Practice.cycle(); });
    add('OBJETOS: ' + (game.itemsOn ? 'SÍ' : 'NO'), b => { game.itemsOn = !game.itemsOn; b.textContent = 'OBJETOS: ' + (game.itemsOn ? 'SÍ' : 'NO'); if (!game.itemsOn) game.items = []; else game.itemT = 30; });
    add('REINICIAR DAÑO (R)', () => { Practice.reset(game); setPause(false); });
  } else if (c && c.tutorial) {
    add('REINTENTAR TAREA', () => { Tutorial.retry(game); setPause(false); });
    add('SALTAR TAREA', () => { Tutorial.skip(game); setPause(false); });
  }
}
// en tutorial: el jugador usa cualquier teclado o mando
function anyInput() {
  const I = blankInput();
  for (const d of Input.devices()) {
    const r = Input.read(d); if (!r) continue;
    for (const k of ['mx', 'my', 'cx', 'cy']) if (Math.abs(r[k]) > Math.abs(I[k])) I[k] = r[k];
    for (const k of ['jump', 'atk', 'spc', 'shd', 'grab', 'str', 'start']) if (r[k]) I[k] = true;
  }
  return I;
}
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (screen === 'controls') closeControls();
    else if (screen === 'game' && game && game.phase !== 'end') setPause(!paused);
  }
  if (e.code === 'Enter' && uiLock <= 0 && screen === 'title') $('bPlay').click();
});

let resultsShown = false;
// resultados: una tarjeta por luchador con su sprite haciendo la animación de victoria o de derrota
let resSprites = [];
function showResults() {
  resultsShown = true;
  const r = game.result(), winners = game.endSeq ? game.endSeq.winners : r.order.slice(0, 1);
  $('resTitle').textContent = r.teams ? `¡GANA EL ${r.winner.toUpperCase()}!` : `¡GANA ${r.winner}!`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  resSprites = [];
  $('resCards').innerHTML = r.order.map((f, i) => {
    const win = winners.includes(f), place = win ? 1 : r.teams ? 2 : i + 1;     // por equipos: el equipo que pierde es 2º
    const who = f.cpu ? 'CPU ' + f.pal.name.toUpperCase() : (f.cfg && f.cfg.name) || f.label;
    return `<div class="rc${win ? ' win' : ' out'}" style="--pc:${f.pal.main};--pd:${f.pal.dark};--pl:${f.pal.light}">
      <div class="rcTop"><b class="rcPlace">${place}º</b><span class="rcWho">${esc(who)}</span></div>
      <div class="rcStage"><canvas width="192" height="240"></canvas></div>
      <div class="rcName">${esc(f.ch.name.toUpperCase())}<small>${f.cpu ? LEVEL_NAMES[f.level] : '&nbsp;'}</small></div>
      <div class="rcStats"><div><span>KOs</span><b>${f.kos}</b></div><div><span>Caídas</span><b>${f.falls}</b></div>
        <div><span>Daño</span><b>${f.dealt}%</b></div><div><span>Combo</span><b>${f.bestCombo || 0}</b></div></div>
    </div>`;
  }).join('');
  // copias de los luchadores para dibujarlas dentro de cada tarjeta
  const cvs = $('resCards').querySelectorAll('canvas');
  r.order.forEach((f, i) => {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(f)), f, {
      x: OX, y: OY, dir: 1, st: winners.includes(f) ? 'win' : 'lose', animT: 0, flash: 0, invuln: 0, hidden: false,
      move: null, item: null, scarf: null, holding: null, heldBy: null, vx: 0, vy: 0, grounded: true });
    copy.inp = blankInput(); copy.buffs = {};
    for (let k = 0; k < 10; k++) copy.updateScarf();
    resSprites.push({ f: copy, cv: cvs[i] });
  });
  $('results').classList.toggle('remote', Net.isClient);
  go('results');
}
const resTmp = mkCanvas(SPR, SPR), resTmpC = resTmp.getContext('2d');
function drawResSprites() {
  for (const s of resSprites) {
    const f = s.f, c = s.cv.getContext('2d'), Wc = s.cv.width, Hc = s.cv.height;
    f.animT++; f.updateScarf();
    resTmpC.clearRect(0, 0, SPR, SPR);
    renderFighter(resTmpC, f, uiFrame);
    // escala entera que cabe en la tarjeta (el gigante se dibuja más pequeño)
    // misma escala para todos (así el gigante se ve gigante); solo baja si no cabe
    const h = f.S.hh + 16;
    let fit = 4; while (fit > 1 && h * fit > Hc - 14) fit--;
    c.clearRect(0, 0, Wc, Hc); c.imageSmoothingEnabled = false;
    const sw = Math.max(44, f.S.hw * fit * 3);
    c.fillStyle = 'rgba(12,10,36,.55)'; c.fillRect(Wc / 2 - sw / 2, Hc - 18, sw, 6);         // sombra / plataforma
    c.fillStyle = f.pal.dark; c.fillRect(Wc / 2 - sw / 2 - 12, Hc - 12, sw + 24, 4);
    c.save(); c.translate(Math.round(Wc / 2), Hc - 16); c.scale(fit, fit); c.drawImage(resTmp, -OX, -OY); c.restore();
  }
}

// ---------- mandos en portada, pausa, resultados y controles ----------
function padUI() {
  for (const dev of Input.devices()) {
    if (!isPad(dev)) continue;
    const r = Input.read(dev);
    const active = r.raw.some(Boolean) || Math.abs(r.mx) > 0.6 || Math.abs(r.my) > 0.6;
    if (active) lastPadKind = Input.kind(dev);
    if (uiLock > 0) { padDir(dev); continue; }
    if (POINTER_SCREENS.includes(screen) || screen === 'vs') continue;   // ahí manda el puntero / la pantalla VS
    const dir = padDir(dev);
    const ok = Input.pressed(dev, 'atk'), back = Input.pressed(dev, 'spc'), start = Input.pressed(dev, 'start');

    if (screen === 'game') {
      if (start && game && game.phase !== 'end') { setPause(!paused); return; }
      if (!paused) continue;
      if (back) { setPause(false); return; }
    }
    if (screen === 'controls') {
      const i = TAB_ORDER.indexOf(ctrlTab);
      if ((dir && dir[0]) || Input.rawPressed(dev, 4) || Input.rawPressed(dev, 5)) {
        const d = dir && dir[0] ? dir[0] : Input.rawPressed(dev, 4) ? -1 : 1;
        Sfx.blip(); setCtrlTab(TAB_ORDER[(i + d + TAB_ORDER.length) % TAB_ORDER.length]);
      }
      if (back || ok || start) { closeControls(); return; }
      continue;
    }
    if (screen === 'results' && start) { startFight(lastCfg); return; }
    if (screen === 'results' && back) { $('bLobby').click(); return; }
    if (screen === 'title' && start) { $('bPlay').click(); return; }
    if (screen === 'tutScr' && back) { $('bTutBack').click(); return; }
    // EN LÍNEA: B volver · X borrar · Y borrar todo (por posición: izquierda / arriba)
    if (screen === 'online') {
      if (back && Net.padKey('back')) return;
      if (Input.rawPressed(dev, 2) && Net.padKey('del')) return;
      if (Input.rawPressed(dev, 3) && Net.padKey('clr')) return;
    }
    // la primera pulsación solo marca el botón principal (no salta de él a otro, p. ej. a los de volumen)
    const had = Nav.padMode && Nav.el && Nav.el.classList.contains('focus') && Nav.items().includes(Nav.el);
    if (dir || ok) { Nav.padMode = true; Nav.ensure(); }
    if (dir && had) Nav.move(dir[0], dir[1]);
    if (ok) { Nav.press(); return; }
  }
}

// ============================================================
//  Bucle principal
// ============================================================
let last = performance.now(), acc = 0, uiFrame = 0;
const STEP = 1000 / FPS;
function frame(now) {
  requestAnimationFrame(frame);          // primero: aunque algo falle, el juego nunca se congela
  try { frameBody(now); }
  catch (e) { console.error('Error en un frame (el juego sigue):', e); }
  // marco ambiente: una miniatura del juego que el navegador estira y difumina detrás
  if (uiFrame % 3 === 0) actx.drawImage(buf, 0, 0, ambient.width, ambient.height);
}
function frameBody(now) {
  Input.update();
  const dt = Math.max(0, Math.min(100, now - last)); last = now;   // nunca negativo (relojes que retroceden)
  uiFrame++;
  // aviso de sonido: un botón del mando también intenta activarlo (y el aviso se quita en cuanto el audio suena, venga de donde venga)
  if (!document.body.classList.contains('sound-on')) {
    if (Input.devices().some(d => d.startsWith('gp') && (Input.read(d).raw || []).some(Boolean))) soundOn();
    else if (uiFrame % 20 === 0 && Sfx.ctxState() === 'running') document.body.classList.add('sound-on');
  }
  if (uiLock > 0) uiLock--;
  padUI();
  Net.tick();
  if (POINTER_SCREENS.includes(screen)) Select.tick(uiFrame, uiLock > 0);
  // controles: el teclado también puede cambiar de pestaña y volver
  if (screen === 'controls' && uiLock <= 0) {
    for (const kb of ['kb1', 'kb2']) {
      if (Input.pressed(kb, 'spc')) { closeControls(); break; }
      const d = kbTabEdge(kb);
      if (d) { const i = TAB_ORDER.indexOf(ctrlTab); Sfx.blip(); setCtrlTab(TAB_ORDER[(i + d + TAB_ORDER.length) % TAB_ORDER.length]); }
    }
  }
  if (screen === 'title' && uiLock <= 0) {
    if (Input.pressed('kb1', 'atk') || Input.pressed('kb2', 'atk')) $('bPlay').click();
  }

  // música: el tema de la arena en la pelea, el de los menús en el resto (y silencio en la VS)
  const inFight = game && (screen === 'game' || (screen === 'controls' && ctrlReturn === 'pause'));
  Music.want(screen === 'vs' ? null : inFight ? game.stage.id : 'menu', inFight && (paused || screen === 'controls'));

  if (screen === 'vs') {
    acc += dt;
    let skip = false;
    if (!Net.isClient) for (const dev of Input.devices()) if (Input.pressed(dev, 'atk') || Input.pressed(dev, 'start') || Input.pressed(dev, 'jump')) skip = true;
    while (acc >= STEP && screen === 'vs') { VS.step(skip); skip = false; acc -= STEP; }
    if (screen === 'vs') {
      VS.render(bctx);
      const sh = VS.shake, ox = sh ? Math.round((Math.random() * 2 - 1) * sh) * S : 0, oy = sh ? Math.round((Math.random() * 2 - 1) * sh) * S : 0;
      dctx.fillStyle = OUTLINE; dctx.fillRect(0, 0, disp.width, disp.height);
      dctx.drawImage(buf, ox, oy, W * S, H * S);
      VS.renderText(TXT);
      return;
    }
  }

  const active = (screen === 'game' || screen === 'results' || (screen === 'controls' && ctrlReturn === 'pause')) && game ? game : demo;
  const frozen = active === game && (paused || screen !== 'game' && screen !== 'results');
  if (active && !frozen && Net.isClient && active === game) {
    // invitado: no simula, muestra lo que manda el anfitrión y le envía sus botones
    acc += dt;
    while (acc >= STEP) { Net.clientFrame(game); acc -= STEP; }
  } else if (active && !frozen) {
    acc += dt;
    Sfx.muted = active === demo;
    const inputs = {};
    for (const dev of Input.devices()) inputs[dev] = Input.read(dev);
    const host = Net.isHost && active === game;
    if (host) Object.assign(inputs, Net.inputs());
    const mode = active === game && game ? game.cfg : null;
    if (mode && (mode.practice || mode.tutorial)) { inputs.any = anyInput(); inputs.dummy = mode.practice ? Practice.input(game) : blankInput(); }
    let stepped = false;
    Net.record(host);
    while (acc >= STEP) {
      active.step(inputs); acc -= STEP; stepped = true;
      if (mode && mode.practice) Practice.tick(game);
      if (mode && mode.tutorial) { Tutorial.tick(game); if (!game) break; }
    }
    Net.record(false);
    if (host && stepped) Net.hostSend(game);
    Sfx.muted = false;
    if (active === demo) for (const f of demo.fighters) if (f.out) { f.out = false; f.stocks = 99; f.respawn(); }
  } else acc = 0;
  if (screen === 'game' && game && game.phase === 'end' && ((game.endSeq && game.endSeq.done) || game.phaseT > 900) && !resultsShown) showResults();

  // dibujo
  const act = (screen === 'game' || screen === 'results' || (screen === 'controls' && ctrlReturn === 'pause')) && game ? game : active;
  if (act) act.render(bctx);
  if (screen === 'results') drawResSprites();
  if (act === game && game && game.cfg.tutorial) Tutorial.renderWorld(bctx, game);
  const shake = active && !frozen ? active.shake : 0;
  const ox = shake ? Math.round((Math.random() * 2 - 1) * shake) * S : 0, oy = shake ? Math.round((Math.random() * 2 - 1) * shake) * S : 0;
  dctx.fillStyle = OUTLINE; dctx.fillRect(0, 0, disp.width, disp.height);
  dctx.drawImage(buf, ox, oy, W * S, H * S);
  if (act === game && game) {
    game.renderText(TXT);
    if (game.cfg.practice) Practice.renderText(TXT, game);
    if (game.cfg.tutorial) Tutorial.renderText(TXT, game);
  }
  if (active === game && Net.isClient && Net.hostPaused && screen === 'game') {
    dctx.fillStyle = 'rgba(18,13,36,.55)'; dctx.fillRect(0, 0, disp.width, disp.height);
    TXT.text('PAUSA', W / 2, H / 2 - 16, 16, '#ffd34a', 'center');
    TXT.text('el anfitrión ha pausado la pelea', W / 2, H / 2 + 8, 8, '#ffffff', 'center');
  }
}

// sonido: el navegador no deja sonar ninguna web hasta que el usuario la toca.
// Cualquier tecla, clic o toque lo activa (los mandos no cuentan para el navegador).
function soundOn() {
  const ac = Sfx.unlock();
  if (!ac) return;
  const done = () => { if (ac.state === 'running') document.body.classList.add('sound-on'); };   // el aviso se quita solo si de verdad suena
  if (ac.state === 'suspended') ac.resume().then(done, () => {});
  done();
}
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, soundOn, { capture: true, passive: true });
if (navigator.userActivation && navigator.userActivation.hasBeenActive) document.body.classList.add('sound-on');
// ?captura en la dirección: sin los avisos de sonido y de mando (para hacer capturas limpias)
if (/[?&]captura/.test(location.search)) document.body.classList.add('sound-on', 'pad-on');

// aviso cuando el navegador detecta (o pierde) un mando
let toastT = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600);
}
addEventListener('gamepadconnected', e => {
  document.body.classList.add('pad-on');
  toast('🎮 Mando ' + (e.gamepad.index + 1) + ' conectado: ' + (e.gamepad.id.split('(')[0].trim().slice(0, 28) || 'mando'));
});
addEventListener('gamepaddisconnected', e => toast('🎮 Mando ' + (e.gamepad.index + 1) + ' desconectado'));

// tu nombre para el modo en línea (recuadro arriba a la derecha de la portada)
{
  const inp = $('nick'); inp.value = Net.nick;
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') inp.blur(); });
  inp.addEventListener('keyup', e => e.stopPropagation());
  inp.addEventListener('input', () => Net.setNick(inp.value));          // se guarda mientras escribes
  inp.addEventListener('blur', () => { inp.value = Net.setNick(inp.value); });
}

validateCharacters();
newDemo();
// enlace de invitación: ?sala=CODIGO entra directamente en esa sala
{ const sala = new URLSearchParams(location.search).get('sala'); if (sala) { Net.open(); Net.joinCode(sala); } }
requestAnimationFrame(frame);
document.fonts && document.fonts.load('16px "Press Start 2P"');
