'use strict';
// ============================================================
//  Juego en línea P2P (WebRTC con PeerJS)
//  · El anfitrión crea una sala con un código corto. PeerJS solo se usa
//    para el "apretón de manos" inicial; después todo va directo entre
//    navegadores, sin servidores propios.
//  · El anfitrión manda: simula la pelea y envía el estado 60 veces por
//    segundo (solo lo que cambió). Los invitados envían sus botones.
//  · Hasta 4 jugadores (anfitrión + 3 amigos). Quien sobre, mira.
// ============================================================
const Net = (() => {
  const LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'arenapixel-rs-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const MAX_GUESTS = 3, HIST = 120;
  const $ = id => document.getElementById(id);

  let role = null, peer = null, code = null, ui = 'menu', uiMsg = '';
  // anfitrión
  const peers = {};                 // pid -> { n, ctl, st, inp, seq, ack }
  let lastStatus = '', lastCfg = null, fighting = false, roomCap = 4, roomMode = null, lastCode = '', padShown = null, kindShown = null;
  const hostHist = new Map();       // frame -> { v, s }
  let sentFx = new WeakSet(), sndBuf = [], rec = false;
  // invitado
  let hostCtl = null, hostSt = null, myNum = 0, hostStatus = null, hostPaused = false;
  const cliHist = new Map(); let latest = -1, applied = -1, pendFx = [], pendSnd = [], inSeq = 0;

  const stats = { on: false, n: 0, bytes: 0, full: 0 };
  // ---------- tu nombre (se guarda en este navegador) ----------
  const NAMES = ['Fénix', 'Rayo', 'Lobo', 'Tigre', 'Cometa', 'Trueno', 'Nova', 'Sombra', 'Bólido', 'Halcón', 'Titán', 'Ninja', 'Dragón', 'Píxel'];
  const cleanName = v => String(v || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  let nick = null;
  try { nick = cleanName(localStorage.getItem('arenaPixel.nick')); } catch (e) {}
  if (!nick) nick = NAMES[Math.random() * NAMES.length | 0] + (100 + (Math.random() * 900 | 0));
  function setNick(v) {
    const n = cleanName(v); if (!n || n === nick) return nick;
    nick = n; try { localStorage.setItem('arenaPixel.nick', nick); } catch (e) {}
    if (role === 'client' && hostCtl && hostCtl.open) hostCtl.send({ t: 'name', name: nick });
    if (role) { lastStatus = ''; renderUI(); }
    return nick;
  }
  // ---------- sonidos: el anfitrión graba los que suenan durante la pelea ----------
  for (const k of Object.keys(Sfx)) {
    if (typeof Sfx[k] !== 'function' || k === 'unlock' || k === 'vsSwing') continue;
    const fn = Sfx[k];
    Sfx[k] = (...a) => { if (rec && !Sfx.muted) sndBuf.push([k, ...a]); return fn(...a); };
  }

  // ---------- utilidades ----------
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIB; s.onload = res;
      s.onerror = () => rej(new Error('No se pudo cargar la librería de conexión (¿sin internet?)'));
      document.head.appendChild(s);
    });
  }
  const genCode = () => Array.from({ length: 5 }, () => ALPHA[Math.random() * ALPHA.length | 0]).join('');
  function openPeer(id) {
    return new Promise((res, rej) => {
      const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
      const t = setTimeout(() => rej({ type: 'timeout' }), 12000);
      p.on('open', () => { clearTimeout(t); res(p); });
      p.on('error', e => { clearTimeout(t); rej(e); });
    });
  }
  function sendAll(msg, chan = 'ctl') { for (const pid in peers) { const c = peers[pid][chan]; if (c && c.open) c.send(msg); } }
  const IN_KEYS = ['jump', 'atk', 'spc', 'shd', 'grab', 'str', 'start'];
  const r2 = v => Math.round(v * 100) / 100;
  function packInput(I) { let b = 0; IN_KEYS.forEach((k, i) => { if (I[k]) b |= 1 << i; }); return [r2(I.mx), r2(I.my), r2(I.cx), r2(I.cy), b]; }
  function unpackInput(a) { const I = blankInput(); [I.mx, I.my, I.cx, I.cy] = a; IN_KEYS.forEach((k, i) => { I[k] = !!(a[4] & (1 << i)); }); return I; }
  // el invitado juega con todos sus dispositivos locales a la vez
  function localInput() {
    const I = blankInput();
    for (const d of Input.devices()) {
      const r = Input.read(d); if (!r) continue;
      for (const k of ['mx', 'my', 'cx', 'cy']) if (Math.abs(r[k]) > Math.abs(I[k])) I[k] = r[k];
      for (const k of IN_KEYS) if (r[k]) I[k] = true;
    }
    return I;
  }

  // ---------- estado de la pelea <-> mensajes ----------
  let MOVES = null;
  function moveMap() {
    if (MOVES) return MOVES;
    MOVES = new Map();
    for (const id in CHARACTERS) for (const n in CHARACTERS[id].moves) MOVES.set(CHARACTERS[id].moves[n], id + '.' + n);
    for (const id in ITEMS) for (const n in ITEMS[id].moves || {}) MOVES.set(ITEMS[id].moves[n], 'I:' + id + '.' + n);
    return MOVES;
  }
  function enc(v, g, d = 0) {
    if (v === null || v === undefined) return v === null ? null : undefined;
    const t = typeof v;
    if (t === 'number') return Number.isInteger(v) ? v : r2(v);
    if (t === 'string' || t === 'boolean') return v;
    if (t !== 'object') return undefined;
    if (v instanceof Fighter) return { $F: v.slot };
    const mv = moveMap().get(v); if (mv) return { $M: mv };
    if (v === g.stage.main) return { $P: 'm' };
    const pi = g.stage.plats.indexOf(v); if (pi >= 0) return { $P: pi };
    if (v instanceof Set) return { $S: [...v].map(x => enc(x, g, d + 1)) };
    if (Array.isArray(v)) return v.map(x => { const e = enc(x, g, d + 1); return e === undefined ? null : e; });
    if (v instanceof HTMLCanvasElement || d > 5) return undefined;
    const o = {}; for (const k in v) { const e = enc(v[k], g, d + 1); if (e !== undefined) o[k] = e; }
    return o;
  }
  function dec(v, g) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(x => dec(x, g));
    if ('$F' in v) return g.fighters[v.$F];
    if ('$M' in v) { const [c, n] = v.$M.split('.'); return c.startsWith('I:') ? ITEMS[c.slice(2)].moves[n] : CHARACTERS[c].moves[n]; }
    if ('$P' in v) return v.$P === 'm' ? g.stage.main : g.stage.plats[v.$P];
    if ('$S' in v) return new Set(v.$S.map(x => dec(x, g)));
    const o = {}; for (const k in v) o[k] = dec(v[k], g); return o;
  }
  const FSKIP = new Set(['cfg', 'ch', 'S', 'baseS', 'pal', 'ai', 'prev', 'buf', 'flickX', 'flickY', 'cstick', 'cHeld', 'cBufT', 'cBufDir', 'cArmed', '_slam', 'hitSet', '_pose']);
  const GKEYS = ['frame', 'phase', 'phaseT', 'shake', 'slow', 'placing', 'cloudX', 'items', 'timeLeft', 'sd', 'endSeq', 'cam', 'finalSlow', 'duo', 'ev', 'evNext', 'evLast'];
  const SSKIP = new Set(['def', 'id', 'spawns', 'respawn', 'blast', 'grav', 'main', 'plats', 'flakes', 'embers', 'motes']);
  function snapshot(g) {
    const v = {}, s = {};
    const put = (k, val) => { if (val === undefined) return; v[k] = val; s[k] = JSON.stringify(val); };
    g.fighters.forEach((f, i) => { for (const k in f) if (!FSKIP.has(k)) put(i + '.' + k, enc(f[k], g)); });
    for (const k of GKEYS) put('g.' + k, enc(g[k], g));
    put('g.proj', enc(g.projectiles, g));
    for (const k in g.stage) if (!SSKIP.has(k)) put('s.' + k, enc(g.stage[k], g));
    put('s.platY', g.stage.plats.map(p => [r2(p.y), r2(p.prevY)]));
    return { v, s };
  }
  function applyState(g, m) {
    for (const k in m) {
      const val = m[k], dot = k.indexOf('.'), a = k.slice(0, dot), key = k.slice(dot + 1);
      if (a === 'g') { if (key === 'proj') g.projectiles = dec(val, g); else g[key] = dec(val, g); }
      else if (a === 's') {
        if (key === 'platY') val.forEach((y, i) => { if (g.stage.plats[i]) { g.stage.plats[i].y = y[0]; g.stage.plats[i].prevY = y[1]; } });
        else g.stage[key] = dec(val, g);
      } else { const f = g.fighters[+a]; if (f) f[key] = dec(val, g); }
    }
  }

  // ============================================================
  //  ANFITRIÓN
  // ============================================================
  async function create() {
    setUI('connecting', 'Creando la sala…');
    if (screen !== 'online') go('online');                 // se ve el "creando…" y después la sala
    try {
      await loadLib();
      for (let i = 0; i < 5 && !peer; i++) {
        const c = genCode();
        try { peer = await openPeer(PREFIX + c); code = c; }
        catch (e) { if (e.type !== 'unavailable-id') throw e; }
      }
      if (!peer) throw { type: 'unavailable-id' };
    } catch (e) { return fail(e); }
    role = 'host'; lastStatus = ''; roomMode = Select.state.mode; roomCap = Select.MODES[roomMode].cap;
    peer.on('connection', onConn);
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    peer.on('error', e => console.warn('Red:', e.type || e));
    setUI('host');
  }
  function onConn(c) {
    const pid = c.peer;
    if (!peers[pid]) {
      if (Object.keys(peers).length >= Math.min(MAX_GUESTS, roomCap - 1)) { c.on('open', () => { c.send({ t: 'full', cap: roomCap }); setTimeout(() => c.close(), 400); }); return; }
      const used = new Set(Object.values(peers).map(p => p.n)); let n = 2; while (used.has(n)) n++;   // el número libre más bajo
      peers[pid] = { n, inp: blankInput(), seq: -1, ack: -1, name: cleanName(c.metadata && c.metadata.name) || 'Amigo' };
    }
    const P = peers[pid];
    P[c.label === 'st' ? 'st' : 'ctl'] = c;
    c.on('data', d => onHostData(pid, d));
    c.on('close', () => drop(pid));
    c.on('error', () => drop(pid));
    c.on('open', () => {
      if (c.label === 'st') return;
      c.send({ t: 'welcome', n: P.n, code });
      lastStatus = '';                                     // que reciba el estado actual
      if (fighting && lastCfg) c.send({ t: 'start', cfg: lastCfg, late: true });
      if (Select.screen === 'chars') Select.netJoin('net:' + pid);
      Sfx.join(); renderUI();
    });
  }
  function drop(pid) {
    const P = peers[pid]; if (!P) return;
    delete peers[pid];
    const dev = 'net:' + pid;
    Select.netLeave(dev);
    if (typeof game !== 'undefined' && game) for (const f of game.fighters) if (f.device === dev) { f.cpu = true; f.level = 'normal'; }
    try { P.ctl && P.ctl.close(); P.st && P.st.close(); } catch (e) {}
    Sfx.blip(); renderUI();
  }
  function onHostData(pid, d) {
    const P = peers[pid]; if (!P || !d) return;
    if (d.t === 'i') { if (d.s > P.seq) { P.seq = d.s; P.inp = unpackInput(d.i); P.ack = d.a; } }
    else if (d.t === 'slot') Select.netSlot('net:' + pid, d);
    else if (d.t === 'name') { P.name = cleanName(d.name) || 'Amigo'; lastStatus = ''; renderUI(); if (Select.screen === 'chars') Select.refresh(); }
    else if (d.t === 'cur') { P.cur = Array.isArray(d.c) ? d.c.slice(0, 4) : []; P.curT = performance.now(); }
    else if (d.t === 'bye') drop(pid);
    else if (d.t === 'vote' && typeof d.s === 'string') Select.netVote('net:' + pid, d.s);
  }
  // en qué pantalla está el anfitrión (los invitados le siguen)
  function hostScreen() {
    if (screen === 'modeScr') return 'mode';
    if (screen === 'stageScr') return 'stage';
    if (screen === 'charScr') return 'chars';
    if (screen === 'vs' || screen === 'game' || screen === 'pause') return 'fight';
    if (screen === 'controls') return ctrlReturn === 'pause' ? 'fight' : ({ modeScr: 'mode', stageScr: 'stage', charScr: 'chars' })[ctrlReturn] || 'lobby';
    if (screen === 'results') return 'results';
    return 'lobby';
  }
  // punteros de la selección: cada uno ve los de los demás
  let curTick = 0;
  const ghostList = (list, pre) => (list || []).map((c, i) => ({ id: pre + i, x: +c.x || 0, y: +c.y || 0, label: String(c.label || '').slice(0, 12), color: /^#[0-9a-f]{3,8}$/i.test(c.color) ? c.color : '#ffffff' }));
  function cursorsTick() {
    if (++curTick % 3) return;
    const onChars = Select.screen === 'chars' || Select.screen === 'stage';
    if (role === 'client') { if (onChars && hostSt && hostSt.open) hostSt.send({ t: 'cur', c: Pointer.mine() }); return; }
    if (!onChars) return;
    const now = performance.now(), mine = ghostList(Pointer.mine(), 'h'), others = {};
    for (const pid in peers) others[pid] = now - (peers[pid].curT || 0) < 1000 ? ghostList(peers[pid].cur, pid + ':') : [];
    Pointer.setGhosts([].concat(...Object.values(others)));
    for (const pid in peers) {
      const ch = peers[pid].st; if (!ch || !ch.open) continue;
      const list = mine.slice(); for (const q in others) if (q !== pid) list.push(...others[q]);
      ch.send({ t: 'curs', c: list });
    }
  }
  function hostTick() {
    const scr = hostScreen();
    fighting = scr === 'fight' || scr === 'results';
    const players = [{ n: 1, name: nick, host: true }].concat(Object.keys(peers).map(pid => ({ n: peers[pid].n, name: peers[pid].name })));
    const st = { t: 'status', scr, players, room: roomInfo(), sel: scr === 'chars' ? Select.netState() : scr === 'stage' ? Select.stageState() : null, paused: !!(scr === 'fight' && paused) };
    const js = JSON.stringify(st);
    if (js !== lastStatus) { lastStatus = js; sendAll(st); }
  }
  function roomInfo() {
    const S = Select.state, M = Select.MODES[S.mode] || Select.MODES['1v1'];
    return { mode: M.name, cap: roomCap, stocks: S.stocks, time: S.time || 0, items: !!S.items, ruby: S.ruby !== false, events: S.events !== false, vote: !!S.arenaVote };
  }
  // tras simular: estado de la pelea para cada invitado (solo lo que cambió desde lo que confirmó)
  function hostSend(g) {
    if (!Object.keys(peers).length) { sndBuf.length = 0; return; }
    const snap = snapshot(g);
    hostHist.set(g.frame, snap);
    for (const k of hostHist.keys()) if (k < g.frame - HIST) hostHist.delete(k);
    const fx = []; for (const e of g.fx) if (!sentFx.has(e)) { sentFx.add(e); fx.push(enc(e, g)); }
    const snd = sndBuf.splice(0);
    for (const pid in peers) {
      const P = peers[pid], ch = P.st; if (!ch || !ch.open) continue;
      const base = P.ack >= 0 ? hostHist.get(P.ack) : null;
      const d = {};
      for (const k in snap.v) if (!base || base.s[k] !== snap.s[k]) d[k] = snap.v[k];
      const msg = { t: 'snap', f: g.frame, b: base ? P.ack : -1, d, x: fx, s: snd };
      if (stats.on) { stats.n++; stats.bytes += JSON.stringify(msg).length; if (!base) stats.full++; }
      ch.send(msg);
    }
  }

  // ============================================================
  //  INVITADO
  // ============================================================
  async function join(c) {
    c = (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 5) { setUI('menu', 'El código tiene 5 letras o números.'); return; }
    setUI('connecting', 'Conectando con la sala ' + c + '…');
    try { await loadLib(); peer = await openPeer(null); }
    catch (e) { return fail(e); }
    role = 'client'; code = c; cliHist.clear(); latest = applied = -1;
    peer.on('error', e => { if (e.type === 'peer-unavailable') fail({ type: 'peer-unavailable' }); else console.warn('Red:', e.type || e); });
    hostCtl = peer.connect(PREFIX + c, { label: 'ctl', reliable: true, serialization: 'json', metadata: { name: nick } });
    hostSt = peer.connect(PREFIX + c, { label: 'st', reliable: false, serialization: 'json' });
    const t = setTimeout(() => { if (ui === 'connecting') fail({ type: 'peer-unavailable' }); }, 15000);
    hostCtl.on('open', () => clearTimeout(t));
    for (const ch of [hostCtl, hostSt]) ch.on('data', onClientData);
    hostCtl.on('close', () => { if (role === 'client') lost('Se perdió la conexión con el anfitrión.'); });
  }
  function onClientData(d) {
    if (!d) return;
    if (d.t === 'snap') return onSnap(d);
    if (d.t === 'curs') { if (Select.screen === 'chars' || Select.screen === 'stage') Pointer.setGhosts(ghostList(d.c, '')); return; }
    if (d.t === 'welcome') { myNum = d.n; setUI('client'); return; }
    if (d.t === 'full') return fail({ type: 'full', cap: d.cap });
    if (d.t === 'closed') return lost('El anfitrión cerró la sala.');
    if (d.t === 'kicked') { const c = code; lost(`El anfitrión cambió el modo de la sala. Vuelve a entrar con el mismo código: ${c}`); lastCode = c; renderUI(); return; }
    if (d.t === 'start') { Select.leaveRemote(); cliHist.clear(); latest = applied = -1; pendFx = []; pendSnd = []; startFight(d.cfg, { late: !!d.late, remote: true }); return; }
    if (d.t === 'status') {
      hostStatus = d; hostPaused = d.paused;
      if (d.scr === 'chars') Select.remoteSel(d.sel, 'net:' + peer.id);
      else if (d.scr === 'stage' && d.sel) Select.remoteStage(d.sel, 'net:' + peer.id);
      else if (d.scr === 'lobby' || d.scr === 'mode' || d.scr === 'stage') {
        if (screen !== 'online' && screen !== 'controls') { Select.leaveRemote(); game = null; go('online'); }
        renderUI();
      }
    }
  }
  function onSnap(d) {
    if (d.x && d.x.length) pendFx.push(...d.x);
    if (d.s && d.s.length) pendSnd.push(...d.s);
    if (d.f <= latest) return;                              // llegó tarde: ya hay uno más nuevo
    let full;
    if (d.b < 0) full = d.d;
    else { const base = cliHist.get(d.b); if (!base) return; full = Object.assign({}, base, d.d); }
    cliHist.set(d.f, full); latest = d.f;
    for (const k of cliHist.keys()) if (k < d.f - HIST) cliHist.delete(k);
  }
  // cada frame del invitado durante la pelea: enviar botones y mostrar el último estado
  function clientFrame(g) {
    if (hostSt && hostSt.open) hostSt.send({ t: 'i', s: inSeq++, a: latest, i: packInput(localInput()) });
    stepStage(g.stage, {});                                 // nieve, brasas, motas: cosméticos locales
    g.stepFx();
    if (latest > applied && cliHist.has(latest)) { applyState(g, cliHist.get(latest)); applied = latest; }
    for (const e of pendFx.splice(0)) g.fx.push(dec(e, g));
    for (const [k, ...a] of pendSnd.splice(0)) if (Sfx[k]) Sfx[k](...a);
  }

  // ---------- fin ----------
  function fail(e) {
    const why = { 'peer-unavailable': 'No existe ninguna sala con ese código (o el anfitrión la cerró).', 'unavailable-id': 'No se pudo crear la sala. Prueba otra vez.',
      full: `La sala está llena${e && e.cap ? ' (es para ' + e.cap + ' jugadores)' : ''}.`, timeout: 'No hay respuesta del servicio de conexión. Revisa tu internet.',
      network: 'Sin conexión con el servicio de salas. Revisa tu internet.', 'browser-incompatible': 'Tu navegador no permite juego en línea.' }[e && e.type] || (e && e.message) || 'Error de conexión.';
    close(true); setUI('menu', why);
    if (screen !== 'online') { Select.leaveRemote(); go('online'); }
  }
  function lost(why) {
    close(true); Select.leaveRemote(); game = null; paused = false;
    setUI('menu', why); Pointer.detach(); go('online');
  }
  function close(quiet) {
    if (role === 'host') { sendAll({ t: 'closed' }); for (const pid in peers) delete peers[pid]; }
    if (role === 'client' && hostCtl && hostCtl.open) hostCtl.send({ t: 'bye' });
    const p = peer; peer = null; role = null; hostCtl = hostSt = null; hostHist.clear(); cliHist.clear();
    if (p) setTimeout(() => { try { p.destroy(); } catch (e) {} }, 300);
    if (!quiet) setUI('menu');
  }

  // ============================================================
  //  Pantalla "EN LÍNEA"
  // ============================================================
  function setUI(u, m = '') { ui = u; uiMsg = m; renderUI(); }
  function playerList() {
    const rows = [];
    if (role === 'host') {
      rows.push(`<li class="me"><b>J1</b> ${nick} <small>(tú · anfitrión)</small></li>`);
      for (const pid in peers) rows.push(`<li><b>J${peers[pid].n}</b> ${peers[pid].name} conectado</li>`);
    } else if (hostStatus && Array.isArray(hostStatus.players)) {
      for (const p of hostStatus.players) {
        const nm = cleanName(p.name) || 'Amigo';
        rows.push(`<li class="${p.n === myNum ? 'me' : ''}"><b>J${p.n}</b> ${nm} <small>${p.host ? '(anfitrión)' : p.n === myNum ? '(tú)' : 'conectado'}</small></li>`);
      }
    }
    const cap = role === 'host' ? roomCap : hostStatus && hostStatus.room ? hostStatus.room.cap : 4;
    for (let i = rows.length; i < cap; i++) rows.push(`<li class="free"><b>J${i + 1}</b> libre</li>`);
    return `<ul class="onlPlayers">${rows.join('')}</ul>`;
  }
  function renderUI() {
    const el = $('onlBody'); if (!el) return;
    const link = location.origin + location.pathname + '?sala=' + code;
    let h = '';
    if (ui === 'menu') {
      padShown = !!(typeof Nav !== 'undefined' && Nav.padMode); kindShown = lastPadKind;
      h = `<p class="onlInfo">Juega con tus amigos por internet: uno crea la sala y los demás entran con su código.</p>
        <button class="go big" id="oCreate">✚ CREAR SALA</button>
        <div class="onlJoin"><input id="oCode" maxlength="5" placeholder="CÓDIGO" autocomplete="off" spellcheck="false" value="${lastCode}"><button id="oJoin">ENTRAR ▶</button></div>
        ${padKeyboard()}
        ${uiMsg ? `<p class="onlErr">${uiMsg}</p>` : ''}
        <button id="oBack">◀ VOLVER${padShown ? ` <i class="okbKey">${padLabels().back}</i>` : ''}</button>`;
    } else if (ui === 'connecting') {
      h = `<p class="onlInfo blink">${uiMsg}</p><button id="oCancel">CANCELAR</button>`;
    } else if (ui === 'host') {
      const n = 1 + Object.keys(peers).length, full = n >= roomCap;
      h = `<p class="onlInfo">Comparte este código con tus amigos:</p>
        <div class="onlCode">${code}</div>
        <div class="row onlRow"><button id="oCopy">COPIAR CÓDIGO</button><button id="oLink">COPIAR ENLACE</button></div>
        ${roomTags(roomInfo())}
        <p class="onlCount${full ? ' full' : ''}">Jugadores: <b>${n} / ${roomCap}</b></p>
        ${playerList()}
        <p class="onlHint">${uiMsg || (full ? '¡Sala llena! Ya podéis empezar.' : `${roomCap - n === 1 ? 'Falta 1 jugador' : 'Faltan ' + (roomCap - n) + ' jugadores'} para empezar: la sala tiene que estar llena.`)}</p>
        <div class="row onlRow"><button class="go" id="oGo"${full ? '' : ' disabled'}>EMPEZAR ▶</button><button id="oOpts">CAMBIAR MODO</button><button id="oClose">CERRAR SALA</button></div>`;
    } else if (ui === 'client') {
      const R = hostStatus && hostStatus.room;
      const what = { mode: 'El anfitrión está cambiando el modo…', stage: 'El anfitrión está eligiendo la arena…' }[hostStatus && hostStatus.scr] || (R && (hostStatus.players || []).length >= R.cap ? '¡Sala llena! Esperando a que el anfitrión empiece…' : 'Esperando a que la sala se llene…');
      h = `<p class="onlInfo">Estás en la sala</p><div class="onlCode">${code}</div>${R ? roomTags(R) : ''}
        ${R ? `<p class="onlCount">Jugadores: <b>${(hostStatus.players || []).length} / ${R.cap}</b></p>` : ''}${playerList()}
        <p class="onlHint blink">${what}</p><button id="oLeave">SALIR DE LA SALA</button>`;
    }
    el.innerHTML = h;
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = () => { Sfx.blip(); fn(); }; };
    on('oCreate', () => Select.openOnlineSetup());     // primero el modo y las opciones; después se crea la sala
    on('oJoin', () => join($('oCode').value));
    on('oBack', () => go('title'));
    on('oCancel', () => close());
    on('oCopy', () => copy(code, 'Código copiado'));
    on('oLink', () => copy(link, 'Enlace copiado: tus amigos solo tienen que abrirlo'));
    on('oGo', () => { if (1 + Object.keys(peers).length >= roomCap) Select.openStage(); });
    on('oOpts', () => Select.openOnlineSetup());
    on('oClose', () => close());
    on('oLeave', () => close());
    for (const b of el.querySelectorAll('.okb button')) b.onclick = () => {
      const i = $('oCode'), k = b.dataset.k; Sfx.blip();
      if (k === 'del') i.value = i.value.slice(0, -1);
      else if (k === 'clr') i.value = '';
      else if (i.value.length < 5) i.value += k;
      lastCode = i.value;
    };
    const inp = $('oCode');
    if (inp) {
      inp.addEventListener('input', () => { lastCode = inp.value; });
      inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') join(inp.value); };
      inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    }
  }
  // teclado en pantalla para escribir el código con el mando (solo si estás usando mando).
  // Los códigos usan letras y números sin I, L, O, 0 ni 1 (para no confundirlos)
  function padKeyboard() {
    padShown = !!(typeof Nav !== 'undefined' && Nav.padMode);
    if (!padShown) return '';
    const rows = ['23456789', 'QWERTYUP', 'ASDFGHJK', 'ZXCVBNM'], B = padLabels();
    return `<div class="okb">${rows.map(r => `<div>${[...r].map(ch => `<button data-k="${ch}">${ch}</button>`).join('')}</div>`).join('')}
      <div><button data-k="del" class="okbDel">⌫ BORRAR <i>${B.del}</i></button><button data-k="clr" class="okbDel">✖ BORRAR TODO <i>${B.clr}</i></button></div></div>`;
  }
  // letras de los botones según el mando (posición física: izquierda = borrar, arriba = borrar todo)
  function padLabels() {
    const k = typeof lastPadKind !== 'undefined' && lastPadKind || 'xbox';
    return { xbox: { back: 'B', del: 'X', clr: 'Y' }, ps: { back: '○', del: '□', clr: '△' }, nin: { back: 'B', del: 'Y', clr: 'X' } }[k] || { back: 'B', del: 'X', clr: 'Y' };
  }
  // atajos del mando en la pantalla EN LÍNEA (antes de entrar en una sala)
  function padKey(what) {
    if (role || ui !== 'menu') return false;
    if (what === 'back') { Sfx.blip(); go('title'); return true; }
    const i = $('oCode'); if (!i || !document.querySelector('.okb')) return false;
    if (what === 'del') i.value = i.value.slice(0, -1);
    else if (what === 'clr') i.value = '';
    lastCode = i.value; Sfx.blip(); return true;
  }
  // resumen de la sala: modo, vidas, tiempo, objetos, rubí y cómo se elige la arena
  function roomTags(R) {
    return `<div class="onlRoom"><span>MODO <b>${R.mode}</b></span><span>VIDAS <b>${R.stocks}</b></span><span>TIEMPO <b>${R.time ? R.time + ' MIN' : 'SIN LÍMITE'}</b></span>
      <span>OBJETOS <b>${R.items ? 'SÍ' : 'NO'}</b></span><span>RUBÍ <b>${R.ruby !== false ? 'SÍ' : 'NO'}</b></span><span>EVENTOS <b>${R.events !== false ? 'SÍ' : 'NO'}</b></span><span>ARENA <b>${R.vote ? 'VOTACIÓN' : 'ANFITRIÓN'}</b></span></div>`;
  }
  function copy(txt, ok) {
    const done = () => { uiMsg = ok; renderUI(); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => { uiMsg = txt; renderUI(); });
    else { uiMsg = txt; renderUI(); }
  }

  return {
    get role() { return role; },
    get isHost() { return role === 'host'; },
    get isClient() { return role === 'client'; },
    get online() { return !!role; },
    get hostPaused() { return hostPaused; },
    get code() { return code; },
    get nick() { return nick; },
    setNick, cleanName,
    // nombre de quien usa ese dispositivo (anfitrión: sus amigos por la red)
    nameOf(dev) { if (dev && dev.startsWith('net:')) { const P = peers[dev.slice(4)]; return P ? P.name : null; } return null; },
    stats,
    // abrir la pantalla "EN LÍNEA" (si ya hay sala, vuelve a su sala)
    open() { if (!role) setUI('menu'); else renderUI(); go('online'); },
    showLobby() { Pointer.detach(); go('online'); renderUI(); },
    joinCode: join,
    leave() { Select.leaveRemote(); close(); go('online'); },
    peerDevs: () => Object.keys(peers).filter(pid => peers[pid].ctl && peers[pid].ctl.open).map(pid => 'net:' + pid),
    connected: dev => role === 'host' ? !!peers[dev.slice(4)] : true,
    inputs() { const o = {}; for (const pid in peers) o['net:' + pid] = peers[pid].inp; return o; },
    padKey,
    tick() {
      if (role === 'host') hostTick(); if (role) cursorsTick();
      if (!role && ui === 'menu' && screen === 'online' && (padShown !== !!Nav.padMode || (padShown && kindShown !== lastPadKind))) renderUI();   // mando ↔ ratón, o cambio de mando
    },
    record(v) { rec = v; },
    hostSend, clientFrame,
    sendStart(cfg) { lastCfg = cfg; sentFx = new WeakSet(); hostHist.clear(); for (const pid in peers) peers[pid].ack = -1; sendAll({ t: 'start', cfg }); },
    sendSlot(d) { if (hostCtl && hostCtl.open) hostCtl.send(Object.assign({ t: 'slot' }, d)); },
    sendVote(id) { if (hostCtl && hostCtl.open) hostCtl.send({ t: 'vote', s: id }); },
    create,
    // anfitrión: quiénes están en la sala (para la votación) y cuántos son
    roster: () => [{ key: 'host', n: 1, name: nick }].concat(Object.keys(peers).map(pid => ({ key: 'net:' + pid, n: peers[pid].n, name: peers[pid].name }))),
    playerCount: () => 1 + Object.keys(peers).length,
    // el anfitrión guardó modo y opciones: si cambió el modo, los invitados salen y vuelven a entrar con el mismo código
    roomChanged() {
      const mode = Select.state.mode;
      if (mode !== roomMode && Object.keys(peers).length) {
        for (const pid in peers) { const c = peers[pid].ctl; if (c && c.open) c.send({ t: 'kicked' }); }
        const ids = Object.keys(peers); setTimeout(() => ids.forEach(drop), 300);    // tiempo para que llegue el aviso
        uiMsg = 'Cambiaste el modo: tus amigos tienen que volver a entrar con el mismo código.';
      }
      roomMode = mode; roomCap = Select.MODES[mode].cap; lastStatus = ''; renderUI();
    },
    get roomCap() { return roomCap; },
  };
})();
