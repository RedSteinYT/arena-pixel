'use strict';
// ============================================================
//  Pantallas de selección (con punteros)
//   1. Modo de batalla   2. Arena   3. Luchadores
// ============================================================
const Select = (() => {
  const MODES = {
    '1v1':  { cap: 2, teams: false, name: '1 VS 1',             sub: 'Duelo clásico' },
    '2v2':  { cap: 4, teams: true,  name: 'EQUIPOS',            sub: 'Equipo rojo contra azul' },
    '3ffa': { cap: 3, teams: false, name: 'TRIPLE AMENAZA',     sub: 'Tres luchadores, todos contra todos' },
    '4ffa': { cap: 4, teams: false, name: 'TODOS CONTRA TODOS', sub: 'Cuatro luchadores, caos total' },
    practice: { cap: 1, teams: false, name: 'PRÁCTICA', sub: 'Tú contra el Dummy' },
  };
  const MODE_ORDER = ['1v1', '2v2', '3ffa', '4ffa'];
  const PCOL = ['#ff6b5e', '#5aa0ff', '#ffd34a', '#5ee08a'];           // color de cada jugador (J1..J4)
  const S = {
    mode: '1v1', stocks: 3, time: 5, stage: 'cielo', screen: null, items: true,
    slots: [null, null, null, null],      // { type:'human'|'cpu', dev, char, locked, level, team }
    cur: {},                              // por dispositivo: { slot, carry }
    prevGame: null, prevStage: null, prevRandom: 0,
    onlineSetup: false,                   // eligiendo modo y opciones para crear (o editar) la sala en línea
    arenaVote: false,                     // en línea: false = elige el anfitrión · true = votación
    vote: null,                           // anfitrión: votación en curso { votes: {clave: arena}, phase, t, tied, pick, winner }
  };
  const $ = id => document.getElementById(id);
  const cs = dev => S.cur[dev] || (S.cur[dev] = { slot: -1, carry: -1 });
  const mode = () => MODES[S.mode];
  const humanNum = i => { let n = 0; for (let k = 0; k <= i; k++) if (S.slots[k] && S.slots[k].type === 'human') n++; return n; };
  const devColor = dev => { const c = S.cur[dev]; if (c && c.slot >= 0) return PCOL[c.slot]; return '#e8e2ff'; };

  // ---------------- info para los punteros ----------------
  function info(dev) {
    if (S.remote) { const i = S.slots.findIndex(x => x && x.mine); return { label: Net.nick, color: i >= 0 ? PCOL[i] : '#e8e2ff', badge: '' }; }
    if (Net.isHost && S.screen === 'stage') return { label: Net.nick, color: PCOL[0], badge: '' };   // en línea: los demás ven tu nombre
    const c = cs(dev);
    const label = c.slot >= 0 ? 'J' + humanNum(c.slot) : (dev === 'kb1' ? 'T1' : dev === 'kb2' ? 'T2' : 'M' + (+dev.slice(2) + 1));
    return { label, color: devColor(dev), badge: c.carry >= 0 ? 'CPU' : '' };
  }

  // ============================================================
  //  1. MODO
  // ============================================================
  const modeCanvases = {};
  function buildMode() {
    const el = $('mCards'); el.innerHTML = '';
    const ICON = { '1v1': '⚔', '2v2': '⚑', '3ffa': '✦', '4ffa': '✸' };
    for (const id of MODE_ORDER) {
      const m = MODES[id], d = document.createElement('div');
      d.className = 'mcard m-' + id; d.dataset.act = 'mode:' + id;
      d.innerHTML = `<canvas class="mart" width="${ModeArt.CW}" height="${ModeArt.CH}"></canvas>
        <div class="mshine"></div>
        <div class="mlabel"><span class="micon">${ICON[id]}</span><div><b>${m.name}</b><small>${m.sub}</small></div></div>
        <div class="mplayers">${'<i></i>'.repeat(m.cap)}</div>`;
      el.appendChild(d);
      modeCanvases[id] = d.querySelector('canvas');
    }
  }
  // duración de la pelea: opciones fijas (0 = sin límite)
  const TIMES = [2, 3, 5, 8, 0];
  const timeLabel = () => S.time ? S.time + ' MIN' : 'SIN LÍMITE';
  function showOpts() {
    $('oLives').textContent = S.stocks;
    $('oTime').textContent = timeLabel();
    $('oItems').textContent = S.items ? 'SÍ' : 'NO';
    const room = S.onlineSetup || Net.isHost;
    $('optArena').style.display = room ? '' : 'none';
    $('oArena').textContent = S.arenaVote ? 'VOTACIÓN' : 'ANFITRIÓN';
    $('oNext').textContent = !S.onlineSetup ? 'ELEGIR ARENA ▶' : Net.isHost ? 'GUARDAR ▶' : 'CREAR SALA ▶';
  }
  const timeTag = () => S.time ? ' · ' + S.time + ' MIN' : '';
  function tickModeArt(frame) {
    for (const id of MODE_ORDER) if (modeCanvases[id]) ModeArt.draw(id, modeCanvases[id], frame);
  }

  // ============================================================
  //  2. ARENA
  // ============================================================
  function buildStageGrid() {
    const el = $('sGrid'); el.innerHTML = '';
    for (const id of STAGE_ORDER.concat(['random'])) {
      const d = document.createElement('div');
      d.className = 'stile'; d.dataset.act = 'stage:' + id;
      if (id === 'random') d.innerHTML = '<div class="qmark">?</div><b>ALEATORIA</b>';
      else {
        d.innerHTML = `<canvas width="160" height="90"></canvas><b>${STAGES[id].name.toUpperCase()}</b>`;
        stageThumb(id, d.querySelector('canvas'));
      }
      el.appendChild(d);
    }
    setPreview(S.stage);
  }
  function setPreview(id) {
    if (id === 'random') {
      if (S.prevStage === 'random') return;
      S.prevStage = 'random'; S.prevGame = null; document.querySelector('#stageScr .live').style.display = 'none';
      $('sName').textContent = 'ARENA ALEATORIA'; $('sRule').textContent = '★ SORPRESA';
      $('sDesc').textContent = 'Nadie sabrá dónde se pelea hasta que empiece el combate.';
      return;
    }
    const shown = id;
    if (S.prevStage === shown && S.prevGame) return;
    S.prevStage = shown;
    document.querySelector('#stageScr .live').style.display = '';
    const chars = CHAR_ORDER.slice().sort(() => Math.random() - 0.5);
    S.prevGame = new Game({ teams: false, stocks: 99, stage: shown,
      players: [0, 1].map(i => ({ device: 'cpu', pal: i, team: i, char: chars[i], level: 'hard' })) });
    S.prevGame.phase = 'play'; S.prevGame.renderHudArt = () => {};
    const def = STAGES[shown];
    $('sName').textContent = id === 'random' ? 'ARENA ALEATORIA' : def.name.toUpperCase();
    $('sRule').textContent = id === 'random' ? '★ SORPRESA' : def.rule ? '★ ' + def.rule.toUpperCase() : '★ SIN REGLAS ESPECIALES';
    $('sDesc').textContent = id === 'random' ? 'Se elegirá una arena al azar al empezar.' : def.desc;
  }
  function tickPreview(frame) {
    const g = S.prevGame;
    if (!g) { if (S.prevStage === 'random') drawMysteryStage($('sPrev').getContext('2d'), frame); return; }
    Sfx.muted = true;
    g.step({});
    Sfx.muted = false;
    for (const f of g.fighters) if (f.out) { f.out = false; f.stocks = 99; f.respawn(); }
    const c = $('sPrev').getContext('2d'); c.imageSmoothingEnabled = false;
    g.render(c);
  }

  // pantalla "sin señal" con un gran ? para la arena aleatoria
  function drawMysteryStage(c, frame) {
    c.imageSmoothingEnabled = false;
    const img = c.createImageData(W, H), d = img.data;
    let seed = frame * 9301;
    for (let i = 0; i < W * H; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const y = (i / W) | 0, band = ((y + frame * 2) % 90) < 6 ? 30 : 0;
      const v = ((seed >> 16) & 63) + band;
      d[i * 4] = 20 + v * 0.6; d[i * 4 + 1] = 14 + v * 0.35; d[i * 4 + 2] = 46 + v; d[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    const bob = Math.round(Math.sin(frame * 0.06) * 4);
    c.font = '96px "Press Start 2P"'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#120d24'; c.fillText('?', W / 2 + 6, H / 2 + bob + 6);
    c.fillStyle = (frame >> 4) % 2 ? '#ffd34a' : '#fff08c'; c.fillText('?', W / 2, H / 2 + bob);
    c.font = '12px "Press Start 2P"'; c.fillStyle = '#e8e2ff'; c.fillText('ARENA SORPRESA', W / 2, H - 30);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }

  // ============================================================
  //  3. LUCHADORES
  // ============================================================
  function buildCharGrid() {
    const el = $('cGrid'); el.innerHTML = '';
    for (const id of CHAR_ORDER.concat(['random'])) {
      const d = document.createElement('div');
      d.className = 'ctile'; d.dataset.act = 'char:' + id;
      if (id === 'random') d.innerHTML = '<div class="qmark">?</div><b>AZAR</b>';
      else {
        const ch = CHARACTERS[id], b = makeBust(id, 1);
        d.innerHTML = `<canvas width="${b.width}" height="${b.height}"></canvas><b>${ch.name.toUpperCase()}</b>`;
        d.querySelector('canvas').getContext('2d').drawImage(b, 0, 0);
      }
      el.appendChild(d);
    }
  }
  const panelCanvases = [];
  function slotTeam(i) { const s = S.slots[i]; return s && s.team != null ? s.team : (i < 2 ? 0 : 1); }
  function palOf(i) {
    if (!mode().teams) return i;
    return TEAM_PALS[slotTeam(i)][0];          // por equipos, todos los compañeros con el mismo color
  }
  function carriedBy(i) { for (const d in S.cur) if (S.cur[d].carry === i) return d; return null; }
  function hoverChar(dev) {
    const el = Pointer.hovered(dev), a = el && el.dataset.act;
    return a && a.startsWith('char:') ? a.slice(5) : null;
  }
  // qué luchador está señalando quien elige el panel i (local, o el que nos cuenta la red)
  function hoverOf(i) {
    const s = S.slots[i]; if (!s || s.locked || s.picked) return null;       // ya eligió: el panel no sigue al puntero
    if (S.remote && s.mine) { for (const d in Pointer.cursors) { const h = hoverChar(d); if (h) return h; } return null; }
    const who = s.type === 'human' ? s.dev : carriedBy(i);
    return (who && !who.startsWith('net:') && hoverChar(who)) || s.hover || null;
  }
  function renderPanels() {
    const el = $('cPanels'), m = mode();
    el.innerHTML = '';
    el.style.setProperty('--n', m.cap); el.dataset.n = m.cap;
    for (let i = 0; i < m.cap; i++) {
      const s = S.slots[i], d = document.createElement('div');
      const col = PCOL[i];
      d.className = 'cpanel' + (s ? ' ' + s.type : ' empty') + (s && s.locked ? ' locked' : '') + (s && s.mine ? ' mine' : '') + (m.teams ? ' team' + slotTeam(i) : '');
      d.style.setProperty('--pc', m.teams ? (slotTeam(i) ? '#3d7ef2' : '#e8443f') : col);
      d.dataset.act = 'panel:' + i;
      let head = '', stage = '', info = '';
      if (!s) {
        head = `<span class="ptag">—</span>`;
        stage = `<div class="pjoin"><div>PULSA <b>ATACAR</b><br>PARA UNIRTE</div></div>`;
        info = `<div class="prow"><span class="pbtn big" data-act="addcpu:${i}">+ AÑADIR CPU</span></div>`;
      } else {
        const ch = s.char === 'random' ? MYSTERY : CHARACTERS[s.char];
        const who = s.type === 'cpu' ? 'CPU' : 'J' + humanNum(i);
        const dev = s.type === 'cpu' ? LEVEL_NAMES[s.level] : (s.name || Net.nameOf(s.dev) || Input.name(s.dev));
        const carrier = carriedBy(i);
        head = `<span class="ptag">${who}</span><span class="pdev">${dev}</span>`
          + (carrier && !s.locked ? `<span class="pcarry" title="La está editando ${info_(carrier).label}">✎ ${info_(carrier).label}</span>` : '');
        // botones arriba, dentro del espacio del luchador (no apretados en la cabecera)
        const tools = (s.type === 'cpu' ? `<span class="plvl" data-act="relevel:${i}">⚙ DIFICULTAD</span>` : '')
          + `<span class="pquit" data-act="remove:${i}">✕ QUITAR</span>`;
        stage = `<canvas class="pfig"></canvas><div class="ptools">${S.remote ? '' : tools}</div>`;
        info = `<div class="pname">${ch.name.toUpperCase()}<small>${ch.role}</small></div>`;
        if (s.type === 'cpu') {
          // elegido el luchador: la dificultad en columna, y al pulsar una queda bloqueada
          if (s.picked && !s.locked && !S.remote) stage += `<div class="plevels"><b>DIFICULTAD</b>${['easy', 'normal', 'hard'].map(l =>
            `<span class="pbtn lv${s.level === l ? ' on' : ''}" data-act="level:${i}:${l}">${LEVEL_NAMES[l]}</span>`).join('')}</div>`;
          info += s.locked ? `<div class="pstate">✓ LISTO <small>clic en el panel para cambiar de luchador</small></div>`
            : s.picked ? `<div class="pstate wait">ELIGE LA DIFICULTAD…</div>` : `<div class="pstate wait">ELIGE SU LUCHADOR…</div>`;
        } else {
          info += s.locked ? `<div class="pstate">✓ LISTO <small>atrás para cambiar</small></div>` : `<div class="pstate wait">ELIGIENDO…</div>`;
        }
        if (m.teams) info += `<div class="prow teamrow"><span class="pbtn" data-act="team:${i}">⇄ CAMBIAR DE EQUIPO</span></div>`;
      }
      d.innerHTML = `<div class="phead">${head}</div><div class="pstage">${stage}<div class="pinfo">${info}</div></div>`;
      el.appendChild(d);
      panelCanvases[i] = d.querySelector('.pfig');
    }
    renderStamps();
    const r = ready();
    $('readyBar').classList.toggle('on', r.ok);
    $('readyBar').textContent = S.remote ? '¡TODOS LISTOS! · ESPERANDO A QUE EL ANFITRIÓN EMPIECE' : '¡LISTOS PARA PELEAR! · PULSA START / ENTER O HAZ CLIC AQUÍ';
    $('cMsg').textContent = r.ok ? '' : r.msg;
    $('charScr').classList.toggle('remote', !!S.remote);
  }
  const info_ = dev => info(dev);
  // sello en cada retrato elegido: J1, J2… o CPU, del color de su panel
  function renderStamps() {
    for (const t of document.querySelectorAll('#cGrid .cstamps')) t.remove();
    const m = mode();
    for (let i = 0; i < m.cap; i++) {
      const s = S.slots[i]; if (!s || !(s.locked || s.picked)) continue;
      const tile = document.querySelector(`#cGrid .ctile[data-act="char:${s.char}"]`); if (!tile) continue;
      let box = tile.querySelector('.cstamps'); if (!box) { box = document.createElement('div'); box.className = 'cstamps'; tile.appendChild(box); }
      const st = document.createElement('span'); st.className = 'cstamp';
      st.style.setProperty('--sc', m.teams ? (slotTeam(i) ? '#3d7ef2' : '#e8443f') : PCOL[i]);
      st.textContent = s.type === 'cpu' ? 'CPU' : 'J' + humanNum(i);
      box.appendChild(st);
    }
  }

  // ---------------- escena del panel ----------------
  // El panel entero es la escena. El tamaño de píxel (s) se elige para que un luchador
  // normal ocupe ~60% del alto libre sobre la placa; fondo y luchador usan el mismo píxel.
  const pf = {};
  const MYSTERY = { name: '???', role: 'Al azar' };
  const NORMAL_H = 46;                                     // alto de un luchador normal en su animación
  const fighterTmp = mkCanvas(SPR, SPR), fighterTc = fighterTmp.getContext('2d');
  function layoutPanel(cv, charId) {
    const st = cv.parentNode, b = st.getBoundingClientRect();
    const plateH = S.plateH || st.querySelector('.pinfo').getBoundingClientRect().height;   // placa más alta de todos los paneles
    const avail = Math.max(20, b.height - plateH);
    // alto real del luchador en su animación de selección (cada uno lo declara en su archivo)
    const selH = Math.max(NORMAL_H * 0.8, (CHARACTERS[charId] && CHARACTERS[charId].selectH) || NORMAL_H);
    let byHeight = Math.floor(avail * 0.78 / selH);
    const byWidth = Math.floor(b.width / 56);   // el escenario necesita algo de ancho
    // un gigante nunca debe verse más pequeño que un luchador normal por culpa del redondeo
    // (al marcar LISTO la placa crece y su escala entera caía de golpe): puede usar casi todo el alto
    if (selH > NORMAL_H) {
      const sN = Math.min(Math.floor(avail * 0.78 / NORMAL_H), byWidth);
      while ((byHeight + 1) * selH <= avail * 0.97 && byHeight * selH < sN * NORMAL_H * 1.3) byHeight++;
    }
    const s = Math.max(1, Math.min(byHeight, byWidth));
    const Wd = Math.ceil(b.width / s), Hd = Math.ceil(b.height / s);
    const gy = Hd - Math.ceil(plateH / s) - 3;
    const key = `${Wd}x${Hd}:${gy}:${s}`;
    if (cv.dataset.key !== key) {
      cv.dataset.key = key; cv.width = Wd; cv.height = Hd;
      cv.style.width = Wd * s + 'px'; cv.style.height = Hd * s + 'px';
    }
    cv.L = { W: Wd, H: Hd, gy };
  }
  // silueta misteriosa para AZAR
  function drawMystery(c, frame, Wd, Hd, gy) {
    sceneGrad(c, 0, 0, Wd, Hd, ['#0b0820', '#1b1238', '#2a1a52', '#3a2470', '#1b1238']);
    c.font = '8px "Press Start 2P"';
    for (let i = 0; i < Wd / 7; i++) {
      const x = (i * 37 + frame * 0.3 * (1 + i % 3)) % (Wd + 10) - 5, y = (i * 53) % Math.max(10, gy - 10) + Math.sin(frame * 0.03 + i) * 3;
      c.fillStyle = i % 2 ? '#4a3290' : '#3a2878'; c.fillText('?', Math.round(x), Math.round(y) + 10);
    }
    for (let i = 0; i < Wd / 4; i++) px(c, (i * 71 + frame * 13) % Wd, (i * 29 + frame * 7) % Hd, '#6c4fd0');
    rect(c, Wd / 2 - 30, gy, 60, 3, '#6c4fd0'); rect(c, Wd / 2 - 28, gy + 3, 56, 3, '#3a2878');
    const f = mysteryF; f.animT = frame;
    fighterTc.clearRect(0, 0, SPR, SPR); f.x = OX; f.y = OY;
    renderFighter(fighterTc, f, frame);
    fighterTc.globalCompositeOperation = 'source-atop'; fighterTc.fillStyle = '#120a2a'; fighterTc.fillRect(0, 0, SPR, SPR);
    fighterTc.globalCompositeOperation = 'source-over';
    c.drawImage(fighterTmp, Math.round(Wd / 2 - OX), gy - OY);
    const bob = Math.round(Math.sin(frame * 0.08) * 2);
    c.font = '16px "Press Start 2P"'; c.textAlign = 'center';
    c.fillStyle = '#120d24'; c.fillText('?', Wd / 2 + 1, gy - 46 + bob + 1);
    c.fillStyle = (frame >> 4) % 2 ? '#ffd34a' : '#fff08c'; c.fillText('?', Wd / 2, gy - 46 + bob);
    c.textAlign = 'left';
  }
  let mysteryF = null;
  function drawPanels(frame) {
    if (!mysteryF) { const ch = CHARACTERS.maniqui; mysteryF = { ch, S: Object.assign({}, BASE_STATS, ch.stats), pal: PLAYER_PALS[1], st: 'select', animT: 0, vx: 0, vy: 0, inp: { my: 0 }, dir: 1, x: 0, y: 0, flash: 0, invuln: 0, scarf: null, jumps: 1 }; }
    if (frame % 15 === 0 || !S.plateH) {
      S.plateH = Math.max(0, ...[...document.querySelectorAll('#cPanels .pinfo')].map(e => e.getBoundingClientRect().height));
    }
    for (let i = 0; i < mode().cap; i++) {
      const cv = panelCanvases[i], s = S.slots[i];
      if (!cv || !s) continue;
      // lo que se muestra: lo que señala el puntero de quien elige (humano o quien edita la CPU)
      let charId = s.char;
      if (!s.locked && !s.picked) charId = hoverOf(i) || s.char;
      const ch = charId === 'random' ? MYSTERY : CHARACTERS[charId], pal = palOf(i), key = i + ':' + charId + ':' + pal;
      const nm = cv.parentNode.querySelector('.pname');
      if (nm && nm.dataset.char !== charId) { nm.dataset.char = charId; nm.innerHTML = `${ch.name.toUpperCase()}<small>${ch.role}</small>`; }
      if (frame % 15 === 0 || !cv.L || cv.L.char !== charId || cv.L.plate !== S.plateH) { layoutPanel(cv, charId); cv.L.char = charId; cv.L.plate = S.plateH; }
      const { W: Wd, H: Hd, gy } = cv.L;
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      if (charId === 'random') { drawMystery(c, frame, Wd, Hd, gy); continue; }
      if (!pf[key]) pf[key] = { ch, S: Object.assign({}, BASE_STATS, ch.stats), pal: PLAYER_PALS[pal], st: 'select', animT: 0, vx: 0, vy: 0,
        inp: { my: 0 }, dir: 1, x: 0, y: 0, flash: 0, invuln: 0, scarf: null, jumps: 1 };
      const f = pf[key]; f.animT = frame;
      drawSelectScene(c, charId, frame, Wd, Hd, gy, () => {
        fighterTc.clearRect(0, 0, SPR, SPR); f.x = OX; f.y = OY;
        renderFighter(fighterTc, f, frame);
        c.drawImage(fighterTmp, Math.round(Wd / 2 - OX), gy - OY);
      });
    }
  }
  function ready() {
    const m = mode();
    for (let i = 0; i < m.cap; i++) {
      if (!S.slots[i]) return { ok: false, msg: 'Faltan luchadores: únete o añade una CPU' };
      if (!S.slots[i].locked) return { ok: false, msg: 'Todos deben bloquear su elección' };
    }
    if (m.teams) {
      const t = [0, 0]; for (let i = 0; i < m.cap; i++) t[slotTeam(i)]++;
      if (!t[0] || !t[1]) return { ok: false, msg: 'Cada equipo necesita al menos un luchador' };
    }
    return { ok: true };
  }
  function freeSlot() { for (let i = 0; i < mode().cap; i++) if (!S.slots[i]) return i; return -1; }
  function join(dev, charId) {
    const c = cs(dev); if (c.slot >= 0) return c.slot;
    const i = freeSlot(); if (i < 0) { Sfx.blip(); return -1; }
    S.slots[i] = { type: 'human', dev, char: charId || CHAR_ORDER[i % CHAR_ORDER.length], locked: !!charId, team: mode().teams ? (i < 2 ? 0 : 1) : null };
    c.slot = i; Sfx.join();
    return i;
  }
  function removeSlot(i) {
    const s = S.slots[i]; if (!s) return;
    for (const d in S.cur) { if (S.cur[d].carry === i) S.cur[d].carry = -1; if (S.cur[d].slot === i) S.cur[d].slot = -1; }
    S.slots[i] = null; Sfx.blip();
  }
  const randomChar = () => CHAR_ORDER[Math.random() * CHAR_ORDER.length | 0];

  // ============================================================
  //  Acciones (puntero elige algo)
  // ============================================================
  function act(dev, el, a) {
    const c = cs(dev);
    if (S.screen === 'mode') {
      if (!a) return;
      if (a === 'back') return backScreen();
      if (a === 'controls') return openControls();
      if (a.startsWith('mode:')) {
        S.mode = a.slice(5); Sfx.join(); openOpts();
      }
      return;
    }
    if (S.screen === 'opts') {
      if (!a) return;
      if (a === 'back') return backScreen();
      if (a === 'controls') return openControls();
      if (a === 'next') {
        Sfx.join();
        if (S.onlineSetup) {                              // sala en línea: crearla (o guardar los cambios) y volver a la sala
          S.onlineSetup = false; Pointer.detach(); S.screen = null;
          if (Net.isHost) { Net.roomChanged(); Net.showLobby(); } else Net.create();
          return;
        }
        openStage(); return;
      }
      if (a.startsWith('opt:')) {
        const [, key, d] = a.split(':'), dir = +d;
        if (key === 'lives') S.stocks = (S.stocks - 1 + dir + 9) % 9 + 1;                       // 1..9, da la vuelta
        if (key === 'time') S.time = TIMES[(TIMES.indexOf(S.time) + dir + TIMES.length) % TIMES.length];
        if (key === 'items') S.items = !S.items;
        if (key === 'arena') S.arenaVote = !S.arenaVote;
        showOpts(); Sfx.blip();
        const v = el && el.closest('.optRow') && el.closest('.optRow').querySelector('.ov b');      // pequeño "pop" del valor
        if (v) { v.classList.remove('pop'); void v.offsetWidth; v.classList.add('pop'); }
      }
      return;
    }
    if (S.screen === 'stage' && S.remote) {                     // invitado en la pantalla de arenas
      if (!a) return;
      if (a === 'back') { Net.leave(); return; }
      if (a === 'controls') return openControls();
      const rv = S.remoteVote;
      if (a.startsWith('stage:') && rv && rv.vote && rv.v && (rv.v.phase === 'open' || rv.v.phase === 'count')) {
        S.myVote = a.slice(6); Net.sendVote(S.myVote); Sfx.join();
        renderVote(Object.assign({}, rv, { v: Object.assign({}, rv.v, { votes: Object.assign({}, rv.v.votes, { [S.remote]: S.myVote }) }) }));
      }
      return;
    }
    if (S.screen === 'stage') {
      if (!a) return;
      if (a === 'back') return backScreen();
      if (a === 'controls') return openControls();
      if (a.startsWith('stage:') && S.vote) {                     // anfitrión en una votación: su voto
        if (S.vote.phase === 'open' || S.vote.phase === 'count') castVote('host', a.slice(6));
        return;
      }
      if (a.startsWith('stage:')) {
        const id = a.slice(6);
        S.stage = id === 'random' ? 'random' : id;
        Sfx.join(); openChars();
      }
      return;
    }
    if (S.screen === 'chars' && S.remote) {
      if (a === 'back') { Net.leave(); return; }               // VOLVER = salir de la sala
      if (a === 'controls') return openControls();
      const i = mySlot(), s = S.slots[i]; if (!s || !a) return;
      if (a.startsWith('char:')) {
        const id = a.slice(5);
        if (s.locked && s.char === id) { s.locked = false; Sfx.blip(); } else { s.char = id; s.locked = true; Sfx.join(); }   // el mismo otra vez: quitar el sello
      }
      else if (a === 'team:' + i && mode().teams) { s.team = 1 - slotTeam(i); Sfx.blip(); }
      else return;
      pushMine(); renderPanels(); return;
    }
    if (S.screen === 'chars') {
      if (a === 'back') return backScreen();
      if (a === 'controls') return openControls();
      if (a === 'fight') { if (ready().ok) start(); else Sfx.blip(); return; }
      if (!a) { if (c.slot < 0) { join(dev); renderPanels(); } return; }      // atacar en vacío = unirse
      const [kind, p1, p2] = a.split(':'), i = +p1;
      if (kind === 'char') {
        const id = p1;                                   // 'random' se resuelve al empezar la pelea
        if (c.carry >= 0 && S.slots[c.carry] && S.slots[c.carry].type === 'cpu') {
          const s = S.slots[c.carry];
          if (s.picked && s.char === id) { s.picked = false; Sfx.blip(); }                  // el mismo otra vez: quitar el sello
          else { s.char = id; s.picked = true; s.locked = false; Sfx.join(); }              // ahora, la dificultad
        } else if (c.slot >= 0) {
          const s = S.slots[c.slot];
          if (s.locked && s.char === id) { s.locked = false; Sfx.blip(); }                  // el mismo otra vez: quitar el sello
          else { s.char = id; s.locked = true; Sfx.join(); }
        }
        else join(dev, id);
      } else if (kind === 'addcpu') {
        if (!S.slots[i]) { S.slots[i] = { type: 'cpu', char: randomChar(), level: 'normal', locked: false, picked: false, team: mode().teams ? (i < 2 ? 0 : 1) : null }; c.carry = i; Sfx.join(); }
      } else if (kind === 'panel') {
        const s = S.slots[i];
        if (!s) { if (c.slot < 0) { join(dev); } }
        else if (s.type === 'cpu' && !(s.picked && !s.locked)) { s.locked = false; s.picked = false; c.carry = i; Sfx.blip(); }   // cambiar su luchador
      } else if (kind === 'level') {
        const s = S.slots[i];
        if (s && s.type === 'cpu') {                                   // elegir dificultad = bloquear al instante
          s.level = p2; s.locked = true; s.picked = false;
          for (const d in S.cur) if (S.cur[d].carry === i) S.cur[d].carry = -1;
          Sfx.join();
        }
      } else if (kind === 'relevel') {
        const s = S.slots[i];
        if (s && s.type === 'cpu') { s.locked = false; s.picked = true; c.carry = i; Sfx.blip(); }   // cambiar solo la dificultad
      } else if (kind === 'lock') {
        const s = S.slots[i]; if (s) { s.locked = true; if (c.carry === i) c.carry = -1; for (const d in S.cur) if (S.cur[d].carry === i) S.cur[d].carry = -1; Sfx.join(); }
      } else if (kind === 'remove') removeSlot(i);
      else if (kind === 'team') { const s = S.slots[i]; if (s) { s.team = 1 - slotTeam(i); Sfx.blip(); } }
      renderPanels();
    }
  }
  // botón ◀ VOLVER: siempre a la pantalla anterior
  function backScreen() {
    Sfx.blip();
    if (S.screen === 'chars' && S.mode === 'practice') { Pointer.detach(); S.screen = null; go('title'); return; }
    if (S.screen === 'chars') openStage();
    else if (S.screen === 'stage' && Net.isHost) { S.vote = null; Pointer.detach(); S.screen = null; Net.showLobby(); }
    else if (S.screen === 'stage') openOpts();
    else if (S.screen === 'opts') openMode();
    else if (S.screen === 'mode') { Pointer.detach(); S.screen = null; if (S.onlineSetup) { S.onlineSetup = false; Net.open(); } else if (Net.isHost) Net.showLobby(); else go('title'); }
  }
  // botón "atrás": deshace paso a paso
  function back(dev) {
    const c = cs(dev);
    if (S.screen === 'chars' && S.remote) {
      const s = S.slots[mySlot()];
      if (s && s.locked) { s.locked = false; Sfx.blip(); pushMine(); renderPanels(); }
      return;
    }
    if (S.screen === 'chars') {
      if (c.carry >= 0) { c.carry = -1; Sfx.blip(); renderPanels(); return; }
      if (c.slot >= 0) {
        const s = S.slots[c.slot];
        if (s && s.locked) { s.locked = false; Sfx.blip(); } else removeSlot(c.slot);
        renderPanels(); return;
      }
      Sfx.blip(); if (S.mode === 'practice') { Pointer.detach(); S.screen = null; go('title'); } else openStage(); return;
    }
    if (S.screen === 'stage') { Sfx.blip(); if (Net.isHost) { S.vote = null; Pointer.detach(); S.screen = null; Net.showLobby(); } else openOpts(); return; }
    if (S.screen === 'opts') { Sfx.blip(); openMode(); return; }
    if (S.screen === 'mode') { Sfx.blip(); Pointer.detach(); S.screen = null; if (S.onlineSetup) { S.onlineSetup = false; Net.open(); } else if (Net.isHost) Net.showLobby(); else go('title'); }
  }

  // ============================================================
  //  Navegación entre pantallas
  // ============================================================
  function attach(scr) {
    S.screen = scr;
    Pointer.attach({
      root: () => $(scr === 'mode' ? 'modeScr' : scr === 'opts' ? 'optScr' : scr === 'stage' ? 'stageScr' : 'charScr'),
      act, back, info,
      hover(dev, el) { const a = el.dataset.act; if (scr === 'stage' && a.startsWith('stage:')) { S.hoverStage = a.slice(6); setPreview(S.hoverStage); } },
    });
  }
  function openMode() { if (S.mode === 'practice') { S.mode = S.prevMode || '1v1'; S.stage = S.prevStage || 'cielo'; } go('modeScr'); buildMode(); attach('mode'); }
  function openOpts() { go('optScr'); $('oModeTag').textContent = mode().name; showOpts(); attach('opts'); }
  function openStage() {
    S.vote = Net.isHost && S.arenaVote ? { votes: {}, phase: 'open', t: 0, tied: [], pick: null, winner: null } : null;
    openStageScreen();
    renderVote(stageState());
  }
  function openStageScreen() { go('stageScr'); $('sModeTag').textContent = mode().name + ' · ' + S.stocks + ' VIDAS' + timeTag() + (S.items ? ' · OBJETOS' : ''); buildStageGrid(); attach('stage'); }
  // keep = true solo al volver de una partida (se conservan las elecciones para la revancha)
  function openChars(keep = false) {
    S.remote = null;
    if (!keep) { S.slots = [null, null, null, null]; S.cur = {}; }      // entrada normal: empieza vacía
    if (Net.isHost) for (const d of Net.peerDevs()) if (!S.slots.some(x => x && x.dev === d)) join(d);
    for (let i = mode().cap; i < 4; i++) if (S.slots[i]) removeSlot(i);
    go('charScr');
    const st = S.stage === 'random' ? 'ARENA ALEATORIA' : STAGES[S.stage].name.toUpperCase();
    $('cModeTag').textContent = S.mode === 'practice' ? 'PRÁCTICA · CONTRA EL DUMMY · ARENA DE ENTRENAMIENTO' : `${mode().name} · ${S.stocks} VIDAS${timeTag()} · ${st}`;
    buildCharGrid(); renderPanels(); attach('chars');
  }
  // PRÁCTICA: eliges tu luchador y peleas contra el Dummy en la arena de entrenamiento
  function openPractice(keep = false) {
    if (S.mode !== 'practice') { S.prevMode = S.mode; S.prevStage = S.stage; }
    S.mode = 'practice'; S.stage = 'entrenamiento';
    openChars(keep);
  }
  function cfg() {
    if (S.mode === 'practice') {
      const s = S.slots[0];
      return { practice: true, teams: false, stocks: 99, stage: 'entrenamiento', items: !!S.practiceItems, mode: 'practice',
        players: [{ device: s.dev, pal: 0, team: 0, char: s.char === 'random' ? randomChar() : s.char, num: 1 },
                  { device: 'dummy', pal: 2, team: 1, char: 'dummy', num: 0 }] };
    }
    const m = mode(), used = [0, 0], players = [];
    let num = 0;
    for (let i = 0; i < m.cap; i++) {
      const s = S.slots[i];
      players.push({ device: s.type === 'cpu' ? 'cpu' : s.dev, pal: palOf(i), team: m.teams ? slotTeam(i) : i, char: s.char === 'random' ? randomChar() : s.char,
        level: s.level || 'normal', num: s.type === 'cpu' ? 0 : ++num, name: slotName(s) || undefined });
    }
    const stage = S.stage === 'random' ? STAGE_ORDER[Math.random() * STAGE_ORDER.length | 0] : S.stage;
    return { teams: m.teams, stocks: S.stocks, time: S.time || 0, players, mode: S.mode, stage, items: S.items };
  }
  function start() { Pointer.detach(); S.screen = null; startFight(cfg()); }

  // ============================================================
  //  En línea
  // ============================================================
  const mySlot = () => S.slots.findIndex(x => x && x.mine);
  // nombre que se ve en línea: el del amigo, o el tuyo si eres el único jugador de tu ordenador
  function slotName(s) {
    if (!s || s.type === 'cpu' || !Net.online) return null;
    if (s.dev.startsWith('net:')) return Net.nameOf(s.dev);
    const local = S.slots.filter(x => x && x.type === 'human' && !x.dev.startsWith('net:')).length;
    return local === 1 ? Net.nick : null;
  }
  function pushMine() {
    const s = S.slots[mySlot()]; if (!s) return;
    S.pend = 20;                                          // durante un momento manda lo local, no el eco
    Net.sendSlot({ char: s.char, locked: s.locked, team: s.team, hover: hoverOf(mySlot()) });
  }
  // anfitrión: lo que ven los invitados
  function netState() {
    const cap = mode().cap;
    return { mode: S.mode, stocks: S.stocks, time: S.time, stage: S.stage,
      slots: S.slots.slice(0, cap).map((s, i) => s && { type: s.type, owner: s.type === 'cpu' ? null : (s.dev.startsWith('net:') ? s.dev : 'host'),
        char: s.char, locked: !!s.locked, picked: !!s.picked, level: s.level || null, team: s.team, hover: hoverOf(i), name: slotName(s) }) };
  }
  function netJoin(dev) { if (S.screen !== 'chars' || S.slots.some(x => x && x.dev === dev)) return; join(dev); renderPanels(); }
  function netLeave(dev) { const i = S.slots.findIndex(x => x && x.dev === dev); if (i >= 0) { removeSlot(i); if (S.screen === 'chars') renderPanels(); } }
  function netSlot(dev, d) {
    const s = S.slots.find(x => x && x.dev === dev); if (!s) return;
    const before = JSON.stringify([s.char, s.locked, s.team]);
    if (d.char === 'random' || CHARACTERS[d.char]) s.char = d.char;
    s.locked = !!d.locked;
    if (mode().teams && (d.team === 0 || d.team === 1)) s.team = d.team;
    s.hover = d.hover && (d.hover === 'random' || CHARACTERS[d.hover]) ? d.hover : null;
    if (JSON.stringify([s.char, s.locked, s.team]) !== before) { if (s.locked) Sfx.join(); if (S.screen === 'chars') renderPanels(); }
  }
  // invitado: copia lo que manda el anfitrión
  function remoteSel(sel, me) {
    const old = S.remote ? S.slots[mySlot()] : null;
    const slots = sel.slots.map(x => x && { type: x.type, dev: x.owner === me ? 'me' : (x.owner ? 'net:' + x.owner : 'cpu'), mine: x.owner === me,
      char: x.char, locked: x.locked, picked: !!x.picked, level: x.level, team: x.team, hover: x.hover, name: x.owner === me ? Net.nick : Net.cleanName(x.name) || null });
    while (slots.length < 4) slots.push(null);
    const mi = slots.findIndex(x => x && x.mine);
    if (mi >= 0 && old && S.pend > 0) Object.assign(slots[mi], { char: old.char, locked: old.locked, team: old.team });
    if (S.remoteVote) { S.remoteVote = null; Pointer.forceGhosts(false); }         // venía de la pantalla de arenas
    const structural = JSON.stringify([sel.mode, sel.stocks, sel.time, sel.stage, slots.map(x => x && [x.type, x.dev, x.char, x.locked, x.picked, x.level, x.team, x.name])]);
    const fresh = S.screen !== 'chars' || !S.remote;
    S.remote = me; S.mode = sel.mode; S.stocks = sel.stocks; S.time = sel.time || 0; S.stage = sel.stage; S.slots = slots;
    if (fresh) {
      S.cur = {}; S.lastStruct = structural; S.pend = 0;
      game = null;
      go('charScr');
      const st = S.stage === 'random' ? 'ARENA ALEATORIA' : STAGES[S.stage].name.toUpperCase();
      $('cModeTag').textContent = `${mode().name} · ${S.stocks} VIDAS${timeTag()} · ${st}`;
      buildCharGrid(); renderPanels(); attach('chars');
    } else if (structural !== S.lastStruct) { S.lastStruct = structural; renderPanels(); }
  }
  function leaveRemote() { Pointer.forceGhosts(false); if (S.remote) { S.remote = null; S.remoteVote = null; if (S.screen) { Pointer.detach(); S.screen = null; } } }

  // ============================================================
  //  ARENA EN LÍNEA: elige el anfitrión (en vivo) o votación
  // ============================================================
  const validStage = id => id === 'random' || STAGE_ORDER.includes(id);
  function castVote(key, id) {
    if (!S.vote || !validStage(id)) return;
    S.vote.votes[key] = id; Sfx.join();
    renderVote(stageState());
  }
  function netVote(dev, id) { if (S.screen === 'stage' && S.vote && (S.vote.phase === 'open' || S.vote.phase === 'count')) castVote(dev, id); }
  // un paso de la votación (anfitrión): todos votan → 3 s para cambiar → recuento → sorteo entre empatadas
  function stepVote() {
    const V = S.vote, roster = Net.roster(), keys = roster.map(p => p.key);
    for (const k in V.votes) if (!keys.includes(k)) delete V.votes[k];          // se fue: su voto no cuenta
    const all = keys.every(k => V.votes[k]);
    if (V.phase === 'open' && all) { V.phase = 'count'; V.t = 180; }
    else if (V.phase === 'count') {
      if (!all) V.phase = 'open';
      else if (--V.t <= 0) {
        const n = {}; for (const k of keys) n[V.votes[k]] = (n[V.votes[k]] || 0) + 1;
        const best = Math.max(...Object.values(n));
        V.tied = Object.keys(n).filter(id => n[id] === best);
        V.winner = V.tied[Math.random() * V.tied.length | 0];             // al azar, pero solo entre las primeras
        if (V.tied.length > 1) { V.phase = 'draw'; V.t = 0; Sfx.vsSwing(); } else { V.phase = 'win'; V.t = 0; Sfx.remate(); }
      }
    } else if (V.phase === 'draw') {
      V.t++;
      // la luz va saltando entre las empatadas, cada vez más despacio, y se para en la ganadora
      const steps = [0, 5, 10, 15, 21, 27, 34, 42, 51, 61, 72, 84, 97, 111];
      const k = steps.filter(s => s <= V.t).length - 1, i0 = V.tied.indexOf(V.winner);
      V.pick = V.tied[((i0 - (steps.length - 1 - k)) % V.tied.length + V.tied.length * 99) % V.tied.length];
      if (steps.includes(V.t) && V.t > 0) Sfx.blip();
      if (V.t >= 120) { V.phase = 'win'; V.t = 0; V.pick = V.winner; Sfx.remate(); }
    } else if (V.phase === 'win') {
      if (++V.t >= 90) { S.stage = V.winner; S.vote = null; openChars(); return; }
    }
    renderVote(stageState());
  }
  // lo que ven todos de la pantalla de arenas
  function stageState() {
    const V = S.vote;
    return { mode: S.mode, stocks: S.stocks, time: S.time, items: S.items, vote: !!S.arenaVote,
      hover: S.hoverStage || S.stage, roster: Net.isHost ? Net.roster() : [],
      v: V ? { votes: V.votes, phase: V.phase, sec: Math.ceil(V.t / 60), tied: V.tied, pick: V.pick, winner: V.winner } : null };
  }
  let lastVoteDraw = '';
  function renderVote(st) {
    const bar = $('sVote'); if (!bar) return;
    const key = JSON.stringify([st.vote, st.v, st.roster, !!S.remote]);
    if (key === lastVoteDraw) return; lastVoteDraw = key;
    const online = Net.online;
    bar.className = 'voteBar'; bar.innerHTML = '';
    for (const t of document.querySelectorAll('#sGrid .stile')) { t.classList.remove('vpick', 'vwin', 'vlose'); const s = t.querySelector('.vstamps'); if (s) s.remove(); }
    if (!online) return;
    if (!st.vote) {                                                  // elige el anfitrión
      if (S.remote) { bar.classList.add('on'); bar.innerHTML = 'El anfitrión está eligiendo la arena: <b>míralo en vivo</b>'; }
      return;
    }
    const V = st.v; if (!V) return;
    const nameOf = Object.fromEntries(st.roster.map(p => [p.key, p]));
    // sellos de voto en cada arena
    for (const k in V.votes) {
      const p = nameOf[k], tile = document.querySelector(`#sGrid .stile[data-act="stage:${V.votes[k]}"]`); if (!p || !tile) continue;
      let box = tile.querySelector('.vstamps'); if (!box) { box = document.createElement('div'); box.className = 'vstamps'; tile.appendChild(box); }
      const s = document.createElement('span'); s.className = 'vstamp'; s.style.setProperty('--sc', PCOL[(p.n - 1) % 4]); s.textContent = 'J' + p.n; s.title = p.name;
      box.appendChild(s);
    }
    const voted = st.roster.filter(p => V.votes[p.key]).length, total = st.roster.length;
    const nm = id => id === 'random' ? 'ARENA ALEATORIA' : STAGES[id] ? STAGES[id].name.toUpperCase() : id;
    bar.classList.add('on');
    if (V.phase === 'open') bar.innerHTML = `VOTACIÓN · elige la arena que quieras (puedes cambiar tu voto) · Votos <b>${voted}/${total}</b>`;
    else if (V.phase === 'count') { bar.classList.add('hot'); bar.innerHTML = `¡Todos han votado! La votación se cierra en <b>${V.sec}</b>…`; }
    else if (V.phase === 'draw') {
      bar.innerHTML = `¡EMPATE! Sorteo entre las más votadas…`;
      for (const id of V.tied) { const t = document.querySelector(`#sGrid .stile[data-act="stage:${id}"]`); if (t && id === V.pick) t.classList.add('vpick'); }
    } else if (V.phase === 'win') {
      bar.innerHTML = `¡Se juega en <b>${nm(V.winner)}</b>!`;
      for (const t of document.querySelectorAll('#sGrid .stile')) t.classList.add(t.dataset.act === 'stage:' + V.winner ? 'vwin' : 'vlose');
    }
  }
  // invitado: copia la pantalla de arenas del anfitrión
  function remoteStage(sel, me) {
    const fresh = S.screen !== 'stage' || !S.remote;
    S.remoteVote = sel;
    if (fresh) {
      S.remote = me; S.mode = sel.mode; S.stocks = sel.stocks; S.time = sel.time || 0; S.items = sel.items;
      game = null; S.myVote = null; lastVoteDraw = '';
      openStageScreen();
      if (sel.vote) Pointer.forceGhosts(false); else { Pointer.detach(); S.screen = 'stage'; Pointer.forceGhosts(true); }   // sin votación: solo se ve el puntero del anfitrión
    }
    if (!sel.vote && sel.hover && sel.hover !== S.prevStage) setPreview(sel.hover);
    renderVote(sel);
  }

  // ---------------- por frame ----------------
  function tick(frame, locked) {
    if (!S.screen) return;
    Pointer.update(locked);
    if (S.screen === 'stage') tickPreview(frame);
    if (S.screen === 'stage' && S.vote && Net.isHost) stepVote();
    if (S.screen === 'mode') tickModeArt(frame);
    if (S.screen === 'chars') {
      drawPanels(frame);
      if (S.remote) {                                   // el invitado cuenta a qué apunta
        const h = hoverOf(mySlot()) || null;
        if (h !== S.sentHover) { S.sentHover = h; pushMine(); }
        if (S.pend > 0) S.pend--;
      }
      if (!locked && ready().ok && !S.remote) {
        for (const d of Input.devices()) if (Input.pressed(d, 'start')) { start(); return; }
        if (Input.key('Enter')) { start(); return; }
      }
      // un mando desconectado deja su hueco
      if (!S.remote) for (let i = 0; i < 4; i++) {
        const s = S.slots[i];
        if (s && s.type === 'human' && !(s.dev.startsWith('net:') ? Net.connected(s.dev) : Input.connected(s.dev))) { removeSlot(i); renderPanels(); }
      }
    }
  }
  return { openMode, openStage, openChars, tick, get screen() { return S.screen; }, state: S, ready, MODES,
    netState, netJoin, netLeave, netSlot, remoteSel, leaveRemote, openPractice,
    stageState, remoteStage, netVote,
    openOnlineSetup() { S.onlineSetup = true; openMode(); },
    refresh() { if (S.screen === 'chars') renderPanels(); },
    reattach() { if (S.screen) attach(S.screen); } };
})();
