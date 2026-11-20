'use strict';
// ============================================================
//  MODO TUTORIAL
//  Lecciones (Básicos, Combos, Avanzados, Objetos), cada una con sus
//  tareas. Te dice qué botones pulsar (con las teclas de TU teclado o
//  mando); si lo haces bien pasas a la siguiente, y si te equivocas te
//  dice en qué paso y lo vuelves a intentar.
// ============================================================
const Tutorial = (() => {
  // ---------- nombres de los movimientos, para los mensajes ----------
  const MOVE_NAME = {
    jab: 'Ataque', jab2: 'Ataque (2.º)', jab3: 'Ataque (3.º)', ftilt: '→ + Ataque', utilt: '↑ + Ataque', dtilt: '↓ + Ataque', dash: 'Ataque corriendo',
    fsmash: 'Fuerte →', usmash: 'Fuerte ↑', dsmash: 'Fuerte ↓', nair: 'Ataque aéreo', fair: '→ + Ataque aéreo', bair: '← + Ataque aéreo',
    uair: '↑ + Ataque aéreo', dair: '↓ + Ataque aéreo', nspc: 'Especial', sspc: '→ + Especial', uspc: '↑ + Especial', dspc: '↓ + Especial',
    dspcLand: '↓ + Especial', grab: 'Agarre', fthrow: 'Lanzamiento', bthrow: 'Lanzamiento', uthrow: 'Lanzamiento', dthrow: 'Lanzamiento',
  };
  const nameOf = n => MOVE_NAME[n] || (n && n.startsWith('I:') ? 'ataque con el arma' : n);

  // ---------- teclas del dispositivo que estás usando ----------
  let kind = 'kb1';                                            // kb1 · kb2 · xbox · ps · nin
  const KB_LABEL = { Space: 'ESPACIO', Semicolon: 'Ñ', ShiftLeft: 'MAYÚS', ShiftRight: 'MAYÚS D', ControlRight: 'CTRL D', Period: '.', Slash: '-', Comma: ',',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  const kbLabel = code => KB_LABEL[code] || (code.startsWith('Key') ? code.slice(3) : code.startsWith('Numpad') ? 'NUM ' + code.slice(6) : code);
  const PAD = {
    xbox: { atk: 'A', spc: 'B', jump: 'X', shd: 'RT', grab: 'RB', str: 'PALANCA D.', start: 'MENU' },
    ps:   { atk: '✕', spc: '○', jump: '□', shd: 'R2', grab: 'R1', str: 'PALANCA D.', start: 'OPTIONS' },
    nin:  { atk: 'A', spc: 'B', jump: 'Y', shd: 'ZR', grab: 'R', str: 'PALANCA D.', start: '+' },
  };
  const DIR = { up: '↑', down: '↓', left: '←', right: '→' };
  function label(tok) {
    if (tok.startsWith('hold:')) return label(tok.slice(5)) + ' (mantén)';
    if (kind === 'kb1' || kind === 'kb2') {
      const m = Input.keymaps[kind];
      return m[tok] ? kbLabel(m[tok][0]) : tok;
    }
    if (DIR[tok]) return 'PALANCA ' + DIR[tok];
    return PAD[kind][tok] || tok;
  }
  const ACTION_NAME = { atk: 'Ataque', spc: 'Especial', jump: 'Salto', shd: 'Escudo', grab: 'Agarre', str: 'Fuerte', up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha' };
  function trackDevice() {
    for (const dev of Input.devices()) {
      const r = Input.read(dev); if (!r) continue;
      const act = Math.abs(r.mx) > 0.5 || Math.abs(r.my) > 0.5 || r.atk || r.spc || r.jump || r.shd || r.grab || r.str;
      if (act) kind = dev.startsWith('gp') ? Input.kind(dev) : dev;
    }
  }

  // ---------- las lecciones ----------
  //  Cada tarea: { title, text, keys: [['right'], ['atk']] (grupos que se pulsan juntos),
  //               setup(c), check(c) -> true (hecho) | 'mensaje' (fallo) | nada,
  //               seq: [...movimientos], hit: true (todos deben acertar) }
  const near = (c, x = 30) => { const { p, d } = c; d.spawn(p.x + p.dir * x, STAGE.main.y, -p.dir); };
  const LESSONS = [
    { id: 'basicos', name: 'BÁSICOS', icon: '★', desc: 'Moverte, saltar, atacar y defenderte.', tasks: [
      { title: 'Camina', text: 'Camina hacia la derecha hasta la línea azul.', keys: [['right']],
        setup(c) { c.mark = 320; }, check(c) { return c.p.x > c.mark - 4 && c.p.grounded; } },
      { title: 'Salta', text: 'Pulsa salto para saltar.', keys: [['jump']], check(c) { return c.ev.jump; } },
      { title: 'Doble salto', text: 'Salta y, en el aire, vuelve a pulsar salto.', keys: [['jump'], ['jump']], check(c) { return c.ev.djump; } },
      { title: 'Ataca', text: 'Acércate al Dummy y golpéalo con el ataque.', keys: [['atk']], setup: c => near(c, 20), check(c) { return c.ev.hit; } },
      { title: 'Ataque con dirección', text: 'Mantén → y entonces pulsa ataque.', keys: [['right', 'atk']], setup: c => near(c, 34),
        check(c) { if (c.ev.move === 'fsmash') return 'Te salió un ataque FUERTE: mantén → un momento ANTES de atacar.'; return c.ev.move === 'ftilt' || c.ev.move === 'dash'; } },
      { title: 'Ataque hacia arriba', text: 'Mantén ↑ y pulsa ataque.', keys: [['up', 'atk']],
        check(c) { if (c.ev.move === 'usmash') return 'Te salió el ataque FUERTE: mantén ↑ antes de atacar.'; return c.ev.move === 'utilt'; } },
      { title: 'Ataque fuerte', text: 'Usa el ataque fuerte (con mando, la palanca derecha hacia el Dummy).', keys: [['right', 'str']], setup: c => near(c, 34),
        check(c) { return /smash$/.test(c.lastHitMove || '') && c.ev.hit; } },
      { title: 'Especial', text: 'Pulsa el botón especial: cada luchador tiene los suyos.', keys: [['spc']], check(c) { return c.ev.move === 'nspc'; } },
      { title: 'Escudo', text: 'Mantén el escudo pulsado un momento.', keys: [['hold:shd']], check(c) { c.n = c.p.st === 'shield' ? (c.n || 0) + 1 : 0; return c.n > 45; } },
      { title: 'Agarra y lanza', text: 'Pulsa agarre junto al Dummy y luego una dirección para lanzarlo.', keys: [['grab'], ['right']], setup: c => near(c, 18),
        check(c) { return /throw$/.test(c.ev.move || ''); } },
    ] },
    { id: 'combos', name: 'COMBOS', icon: '✦', desc: 'Encadenar golpes y rematar.', tasks: [
      { title: 'Cadena 1-2-3', text: 'Pulsa ataque tres veces seguidas: los tres golpes deben acertar.', keys: [['atk'], ['atk'], ['atk']],
        setup: c => near(c, 18), seq: ['jab', 'jab2', 'jab3'], hit: true },
      { title: 'Sube de nivel', text: 'Ataque, ataque y, al acertar, ↑ + ataque.', keys: [['atk'], ['atk'], ['up', 'atk']],
        setup: c => near(c, 18), seq: ['jab', 'jab2', 'utilt'], hit: true },
      { title: 'Golpe lateral', text: 'Ataque, ataque y, al acertar, → + ataque para lanzarlo.', keys: [['atk'], ['atk'], ['right', 'atk']],
        setup(c) { near(c, 18); c.d.dmg = 30; }, seq: ['jab', 'jab2', 'ftilt'], hit: true },
      { title: 'Al aire', text: '↑ + ataque y, al acertar, salta y ataca en el aire.', keys: [['up', 'atk'], ['jump'], ['atk']],
        setup(c) { near(c, 16); c.d.dmg = 20; }, seq: ['utilt', 'nair'], hit: true },
      { title: '¡Remate!', text: 'Encadena 2 golpes y remata el combo con un ataque fuerte o un especial.', keys: [['atk'], ['atk'], ['str']],
        setup(c) { near(c, 18); c.d.dmg = 40; }, check(c) { return c.ev.remate; } },
    ] },
    { id: 'avanzados', name: 'AVANZADOS', icon: '✸', desc: 'Esquivas, caída rápida, carga y bordes.', tasks: [
      { title: 'Esquiva rodando', text: 'Con el escudo pulsado, empuja ← o →.', keys: [['shd', 'right']], check(c) { return c.p.st === 'dodge' && c.p.dodgeKind === 'roll'; } },
      { title: 'Esquiva en el sitio', text: 'Con el escudo pulsado, empuja ↓.', keys: [['shd', 'down']], check(c) { return c.p.st === 'dodge' && c.p.dodgeKind === 'spot'; } },
      { title: 'Esquiva aérea', text: 'Salta y pulsa escudo en el aire.', keys: [['jump'], ['shd']], check(c) { return c.p.st === 'dodge' && c.p.dodgeKind === 'air'; } },
      { title: 'Caída rápida', text: 'Salta y, mientras caes, empuja ↓ rápido.', keys: [['jump'], ['down']], check(c) { return c.p.ff && !c.p.grounded; } },
      { title: 'Fuerte cargado', text: 'Mantén el ataque fuerte (con mando, la palanca derecha) para cargarlo y suéltalo.', keys: [['hold:str']],
        check(c) { if (c.p.st === 'attack' && c.p.charge > (c.maxCh || 0)) c.maxCh = c.p.charge; return c.maxCh > 25 && c.p.st !== 'attack'; } },
      { title: 'Agárrate al borde', text: 'Déjate caer por el borde del escenario: te agarrarás solo.', keys: [['right']],
        setup(c) { c.p.spawn(STAGE.main.x2 - 30, STAGE.main.y, 1); }, check(c) { return c.p.st === 'ledge'; } },
      { title: 'Vuelve arriba', text: 'Estás colgado del borde: empuja hacia el escenario (←) para subir.', keys: [['left']],
        setup(c) {                                       // empiezas colgado del borde derecho
          const p = c.p, M = STAGE.main;
          p.spawn(M.x2 + 6, M.y + p.S.hh, -1); p.grounded = false; p.plat = null; p.vy = 1; p.setSt('air'); p.tryLedge(c.g);
        },
        check(c) { c.seen = c.seen || c.p.st === 'ledge'; return c.seen && c.p.grounded && c.p.plat === STAGE.main; } },
    ] },
    { id: 'objetos', name: 'OBJETOS', icon: '⚔', desc: 'Recoger, usar, soltar y lanzar objetos.', tasks: [
      { title: 'Recoge un objeto', text: 'Ponte encima de la espada y pulsa agarre.', keys: [['grab']],
        setup(c) { const it = ItemSys.spawn(c.g, 'sable', c.p.x + 26, STAGE.main.y); it.st = 'ground'; it.plat = STAGE.main; }, check(c) { return c.p.item && c.p.item.id === 'sable'; } },
      { title: 'Ataca con el arma', text: 'Con la espada en la mano, tu ataque es el de la espada. ¡Golpea al Dummy!', keys: [['atk']],
        setup(c) { if (!c.p.item) { c.p.item = { id: 'sable', uses: ITEMS.sable.uses, t: 0 }; ItemSys.refreshStats(c.p); } near(c, 26); }, check(c) { return c.ev.hit && (c.lastHitMove || '').startsWith('I:'); } },
      { title: 'Suelta el objeto', text: 'Pulsa agarre SIN dirección para dejarlo en el suelo.', keys: [['grab']],
        setup(c) { if (!c.p.item) { c.p.item = { id: 'sable', uses: ITEMS.sable.uses, t: 0 }; ItemSys.refreshStats(c.p); } },
        check(c) { if (!c.p.item && c.g.items.some(i => i.st === 'thrown')) return 'Lo has LANZADO: suéltalo sin pulsar ninguna dirección.'; return !c.p.item && c.g.items.length > 0; } },
      { title: 'Lánzalo', text: 'Recoge la espada y lánzala contra el Dummy: agarre + dirección.', keys: [['grab'], ['grab', 'right']],
        setup(c) { near(c, 80); const it = ItemSys.spawn(c.g, 'sable', c.p.x + 8, STAGE.main.y); it.st = 'ground'; it.plat = STAGE.main; },
        check(c) { return c.ev.hit && !c.p.item && c.lastHitMove === null; } },
      { title: 'Usa un poder', text: 'Los poderes se activan al tocarlos: ¡coge el corazón!', keys: [['right']],
        setup(c) { c.p.dmg = 60; const it = ItemSys.spawn(c.g, 'corazon', c.p.x + 40, STAGE.main.y); it.st = 'ground'; it.plat = STAGE.main; },
        check(c) { return c.p.dmg < 60; } },
    ] },
  ];

  // ---------- progreso guardado ----------
  let done = {};
  try { done = JSON.parse(localStorage.getItem('arenaPixel.tutorial') || '{}') || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem('arenaPixel.tutorial', JSON.stringify(done)); } catch (e) {} };

  // ---------- estado de la lección en curso ----------
  let L = null, idx = 0, phase = 'task', timer = 0, msg = '', ctx = null, prev = null;
  const lesson = id => LESSONS.find(l => l.id === id);
  function setupTask(g) {
    const T = L.tasks[idx];
    const p = g.fighters[0], d = g.fighters[1];
    // todo a su sitio
    p.spawn(176, STAGE.main.y, 1); d.spawn(304, STAGE.main.y, -1);
    for (const f of g.fighters) { f.dmg = 0; f.burn = 0; f.comboN = 0; f.comboT = 0; f.remateT = 0; f.item = null; f.buffs = {}; ItemSys.refreshStats(f); }
    g.items = []; g.projectiles = [];
    ctx = { g, p, d, step: 0, seqT: 0, lastHitMove: undefined };
    if (T.setup) T.setup(ctx);
    prev = snap(p, d);
    phase = 'task'; timer = 0; msg = '';
  }
  const snap = (p, d) => ({ st: p.st, move: p.moveName, t: p.t, grounded: p.grounded, jumps: p.jumps, ddmg: d.dmg, rem: d.remateT, dst: d.st });
  function start(id) {
    L = lesson(id); idx = 0;
    startFight({ tutorial: id, teams: false, stocks: 99, stage: 'entrenamiento', items: false,
      players: [{ device: 'any', pal: 0, team: 0, char: 'maniqui', num: 1 }, { device: 'dummy', pal: 2, team: 1, char: 'dummy', num: 0 }] });
  }
  function ok() { phase = 'ok'; timer = 70; Sfx.powerup(); }
  function fail(m) { phase = 'fail'; timer = 150; msg = m; Sfx.brk(); }

  function tick(g) {
    if (!L || g.cfg.tutorial !== L.id) return;
    trackDevice();
    for (const f of g.fighters) f.stocks = 99;
    if (!ctx || ctx.g !== g) setupTask(g);
    const p = ctx.p, d = ctx.d, T = L.tasks[idx];
    p.noFlick = true;          // en el tutorial dirección + ataque es siempre el ataque normal (el fuerte se enseña con su botón / la palanca derecha)
    if (phase === 'ok') { if (--timer <= 0) { idx++; if (idx >= L.tasks.length) { phase = 'done'; timer = 240; done[L.id] = true; save(); Sfx.remate(); } else setupTask(g); } return; }
    if (phase === 'fail') { if (--timer <= 0) setupTask(g); return; }
    if (phase === 'done') { if (--timer <= 0 || (timer < 180 && anyConfirm())) quit(); return; }
    // ¿qué ha pasado este frame?
    const newMove = p.st === 'attack' && (prev.st !== 'attack' || prev.move !== p.moveName || p.t < prev.t);
    const ev = {
      move: newMove ? p.moveName : null,
      jump: prev.grounded && !p.grounded && p.vy < 0,
      djump: !p.grounded && p.jumps < prev.jumps,
      hit: d.dmg > prev.ddmg,
      remate: d.remateT > 0 && d.remateT > prev.rem,
    };
    if (ev.hit) ctx.lastHitMove = p.st === 'attack' ? p.moveName : null;
    ctx.ev = ev;
    prev = snap(p, d);
    // tareas de secuencia (combos)
    if (T.seq) {
      const want = T.seq[ctx.step];
      if (ev.move) {
        if (ev.move === want) { ctx.step++; ctx.seqT = 0; }
        else if (ctx.step > 0 && !(T.seq[ctx.step - 1] === ev.move)) return fail(`Paso ${ctx.step + 1}: hiciste "${nameOf(ev.move)}", tocaba "${nameOf(want)}".`);
      }
      if (ctx.step > 0) {
        ctx.seqT++;
        if (T.hit && ctx.step >= T.seq.length) { if (d.comboN >= T.seq.length && d.comboBy === p) return ok(); }
        else if (!T.hit && ctx.step >= T.seq.length) return ok();
        // el combo se cortó: el Dummy se recuperó o tardaste demasiado
        if (T.hit && ctx.seqT > 12 && !d.stunned(g) && p.st !== 'attack' && !(p.st === 'jumpsquat' || (!p.grounded && ctx.seqT < 50))) return fail(`El combo se cortó después del paso ${ctx.step}: ${ctx.step >= T.seq.length ? 'el último golpe no acertó' : 'encadena el siguiente golpe justo al acertar'}.`);
        if (ctx.seqT > 120) return fail(`Tardaste demasiado en el paso ${ctx.step + 1}.`);
      }
      return;
    }
    const r = T.check(ctx);
    if (r === true) ok();
    else if (typeof r === 'string') fail(r);
  }
  function anyConfirm() { for (const dev of Input.devices()) if (Input.pressed(dev, 'atk') || Input.pressed(dev, 'start')) return true; return false; }
  function quit() { L = null; ctx = null; game = null; paused = false; openMenu(); }

  // ---------- dibujo ----------
  function renderWorld(c, g) {
    if (!L || !ctx || phase === 'done') return;
    if (ctx.mark) {                                     // la línea de meta de "camina"
      const x = ctx.mark;
      for (let y = STAGE.main.y - 40; y < STAGE.main.y; y += 2) px(c, x, y, '#43c6f0');
      withAlpha(c, 0.15 + 0.1 * Math.sin(g.frame * 0.15), () => rect(c, x - 3, STAGE.main.y - 40, 7, 40, '#43c6f0'));
    }
  }
  function keyBox(t, x, y, txt) {
    const w = txt.length * 8 + 10;
    dctx.setTransform(S, 0, 0, S, 0, 0);
    dctx.fillStyle = '#120d24'; dctx.fillRect(x, y, w, 15);
    dctx.fillStyle = '#ffffff'; dctx.fillRect(x + 1, y + 1, w - 2, 13);
    dctx.fillStyle = '#dfe4f2'; dctx.fillRect(x + 1, y + 11, w - 2, 3);
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    t.text(txt, x + 5, y + 4, 8, '#120d24');
    return w;
  }
  // parte un texto en líneas de como mucho n caracteres
  function wrap(txt, n) {
    const out = []; let line = '';
    for (const w of txt.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; }
    if (line.trim()) out.push(line.trim());
    return out;
  }
  function renderText(t, g) {
    if (!L || !ctx) return;
    const T = L.tasks[Math.min(idx, L.tasks.length - 1)];
    const lines = phase === 'done' ? [] : wrap(T.text, 54);
    const ph = phase === 'done' ? 62 : 52 + lines.length * 11;
    // panel superior
    dctx.setTransform(S, 0, 0, S, 0, 0);
    dctx.fillStyle = 'rgba(18,13,36,0.82)'; dctx.fillRect(8, 6, W - 16, ph);
    dctx.fillStyle = '#43c6f0'; dctx.fillRect(8, 6, W - 16, 2);
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    t.text(`TUTORIAL · ${L.name}`, 16, 12, 8, '#43c6f0');
    t.text(`TAREA ${Math.min(idx + 1, L.tasks.length)}/${L.tasks.length}`, W - 16, 12, 8, '#9fb0d8', 'right');
    if (phase === 'done') {
      t.text('¡LECCIÓN COMPLETADA!', W / 2, 30, 16, '#ffd34a', 'center');
      t.text('Pulsa ataque para volver a las lecciones', W / 2, 52, 8, '#ffffff', 'center');
      return;
    }
    t.text(T.title.toUpperCase(), 16, 24, 8, '#ffd34a');
    lines.forEach((ln, i) => t.text(ln, 16, 36 + i * 11, 8, '#ffffff'));
    // teclas que hay que pulsar
    let x = 16; const y = 38 + lines.length * 11;
    T.keys.forEach((grp, gi) => {
      if (gi) { t.text('›', x + 1, y + 4, 8, '#9fb0d8'); x += 12; }
      grp.forEach((tok, k) => {
        if (k) { t.text('+', x + 1, y + 4, 8, '#9fb0d8'); x += 11; }
        const done = T.seq && gi < ctx.step;
        x += keyBox(t, x, y, label(tok)) + 3;
        if (done) t.text('✓', x - 10, y - 6, 8, '#5ee08a');
      });
    });
    // resultado
    const y0 = 6 + ph + 10;
    if (phase === 'ok') t.text('¡BIEN!', W / 2, y0 + 4, 24, '#5ee08a', 'center');
    if (phase === 'fail') {
      const ml = wrap(msg, 50), h = 28 + ml.length * 11;
      dctx.setTransform(S, 0, 0, S, 0, 0); dctx.fillStyle = 'rgba(120,20,40,0.88)'; dctx.fillRect(20, y0, W - 40, h); dctx.setTransform(1, 0, 0, 1, 0, 0);
      t.text('✗ ¡CASI!', W / 2, y0 + 4, 8, '#ffd34a', 'center');
      ml.forEach((ln, i) => t.text(ln, W / 2, y0 + 16 + i * 11, 8, '#ffffff', 'center'));
      t.text('Vuelve a intentarlo…', W / 2, y0 + 16 + ml.length * 11, 8, '#ffb0b8', 'center');
    }
  }

  // ---------- menú de lecciones ----------
  function openMenu() {
    const el = document.getElementById('tutList'); el.innerHTML = '';
    for (const l of LESSONS) {
      const b = document.createElement('button');
      b.className = 'tutCard' + (done[l.id] ? ' done' : '');
      b.innerHTML = `<span class="ti">${l.icon}</span><b>${l.name}</b><small>${l.desc}</small><em>${l.tasks.length} tareas${done[l.id] ? ' · ✓ COMPLETADA' : ''}</em>`;
      b.onclick = () => { Sfx.blip(); start(l.id); };
      el.appendChild(b);
    }
    go('tutScr');
  }

  return {
    LESSONS, openMenu, start, tick, renderText, renderWorld, quit,
    get active() { return !!L; },
    get state() { return { lesson: L && L.id, idx, phase, msg }; },
    skip(g) { if (!L) return; if (phase === 'task' || phase === 'fail') ok(); },
    retry(g) { if (L && ctx) setupTask(ctx.g); },
  };
})();
