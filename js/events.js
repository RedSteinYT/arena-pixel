'use strict';
// ============================================================
//  EVENTOS DE ARENA (opcionales: OPCIONES DE COMBATE → EVENTOS)
//  Cada arena tiene los suyos. Cada 45–60 s sale uno al azar:
//   1) AVISO (3 s): cartel gigante + advertencia visual, para que dé tiempo a reaccionar
//   2) EVENTO (unos segundos): con sus sonidos y su cambio de música
//   3) FIN: todo vuelve a la normalidad
//  No salen en Práctica, Tutorial ni Muerte súbita. Se congelan durante las cinemáticas.
// ============================================================
const EVENT_FIRST = 30 * 60;                 // el primero, a los 30 s de pelea
const EVENT_GAP = [45 * 60, 60 * 60];        // luego, cada 45–60 s
const EVENT_WARN = 180;                      // 3 s de aviso
// "atacante" de los eventos (como los géiseres): no es nadie
const evHazard = { landedHit: false, landedAt: 0, t: 0, dealt: 0, hitlag: 0, kos: 0, dir: 1, move: null, moveName: null, hitSet: new Set(), pal: { light: '#ffb040', main: '#ff6a20' } };
const evHit = (g, d, h, dir) => { evHazard.hitSet = new Set(); g.applyHit(evHazard, d, h, dir, 1, d.x, d.y - d.S.hh / 2); };
const alive = f => f.alive() && f.st !== 'respawn' && f.st !== 'gone' && f.st !== 'portal';

const STAGE_EVENTS = {
  fortaleza: [
    // ---------------- ¡EL PISO ES LAVA! ----------------
    //  El suelo principal (no las plataformas) arde 15 s: tocarlo quema y te hace saltar.
    {
      id: 'lava', name: '¡EL PISO ES LAVA!', sub: '¡Súbete a las plataformas!', dur: 900, col: '#ff6a20', icon: '🔥',
      warn(g, E) {
        const M = STAGE.main;
        if (E.t % 4 === 0) g.burst(M.x1 + Math.random() * (M.x2 - M.x1), M.y - 1, 1, E.t > 90 ? 'fire' : 'smoke');
        if (E.t > 120) g.shake = Math.max(g.shake, 1.5);
      },
      step(g, E) {
        const M = STAGE.main;
        if (E.t % 2 === 0) g.burst(M.x1 + Math.random() * (M.x2 - M.x1), M.y - 1, 1, 'fire');
        if (E.t % 50 === 0) Sfx.lavaHiss();
        for (const f of g.fighters) {
          if (!alive(f) || f.invuln > 0 || !f.grounded || f.plat !== STAGE.main) continue;
          if ((f.lavaCD || 0) > g.frame) continue;
          f.lavaCD = g.frame + 30;                                               // un respiro corto para escapar
          evHit(g, f, { d: 13, b: 5.4, g: 0.85, ang: 90, burn: 100 }, f.dir || 1);   // ¡duele! caer es un castigo
          g.shake = Math.max(g.shake, 5);
          Sfx.lavaBurn();
          for (let i = 0; i < 14; i++) g.burst(f.x + (Math.random() * 14 - 7), f.y - 2 - Math.random() * 6, 1, 'fire');
        }
      },
      drawBack(c, g, E) {
        const M = STAGE.main, T = g.frame, w = M.x2 - M.x1;
        if (E.phase === 'warn') {                                               // el suelo se pone al rojo
          const k = E.t / EVENT_WARN, a = (0.25 + 0.5 * k) * (0.6 + 0.4 * Math.sin(T * (0.15 + k * 0.4)));
          rect(c, M.x1, M.y - 1, w, 3, '#ff3a1a', a);
          for (let x = M.x1 + 4; x < M.x2; x += 13) if (((x * 7 + (T >> 3)) % 5) < 2 + k * 3) rect(c, x, M.y + 1, 4, 1, '#ffb040', a);   // grietas que brillan
          glow(c, (M.x1 + M.x2) / 2, M.y, w * 0.5, '#ff4a1a', 0.08 + 0.1 * k, 3);
          return;
        }
        const fade = E.phase === 'end' ? Math.max(0, 1 - E.t / 50) : Math.min(1, E.t / 12);
        if (fade <= 0) return;
        glow(c, (M.x1 + M.x2) / 2, M.y - 4, w * 0.55, '#ff5a1a', 0.16 * fade, 3);
        for (let x = M.x1; x < M.x2; x += 2) {                                 // lenguas de fuego por todo el suelo
          const h = Math.round((5 + 4 * Math.sin(x * 0.31 + T * 0.45) + 3 * Math.sin(x * 0.13 - T * 0.27)) * fade);
          if (h <= 0) continue;
          rect(c, x, M.y - h, 2, h, '#c8281e');
          rect(c, x, M.y - Math.round(h * 0.7), 2, Math.round(h * 0.7), '#ff7a20');
          if (h > 5) rect(c, x, M.y - Math.round(h * 0.35), 2, Math.round(h * 0.35), x % 4 ? '#ffd040' : '#fff3b0');
        }
        rect(c, M.x1, M.y, w, 2, '#ffd040', 0.8 * fade);
      },
    },
    // ---------------- ¡PAPA CALIENTE! ----------------
    //  Un luchador al azar lleva una bomba con 7 s. Si golpea a un rival, se la pasa. Al llegar a 0, ¡BUM!
    {
      id: 'papa', name: '¡PAPA CALIENTE!', sub: '¡Golpea a un rival para pasársela!', dur: 420, col: '#ff3a3a', icon: '💣',
      start(g, E) { E.holder = this.pick(g, null); E.passT = 0; if (E.holder) Sfx.pass(); },
      pick(g, not) { const c = g.fighters.filter(f => alive(f) && f !== not); return c.length ? c[Math.random() * c.length | 0] : null; },
      step(g, E) {
        if (!E.holder || !alive(E.holder) || E.holder.out) { E.holder = this.pick(g, E.holder); if (!E.holder) { E.abort = true; E.t = this.dur; return; } }   // cayó: la bomba busca a otro
        const left = this.dur - E.t;
        if (left > 180 ? E.t % 60 === 0 : left % 20 === 0) Sfx.tick(left <= 180);     // tic-tac (más rápido al final)
        if (E.t % 3 === 0) { const h = E.holder; g.fx.push({ kind: 'part', ptype: 'spark', x: h.x + (Math.random() * 4 - 2), y: h.y - h.S.hh - 14, vx: (Math.random() - 0.5) * 1.2, vy: -0.8, t: 0, life: 10, size: 1, col: E.t % 6 ? '#ffd040' : '#ffffff' }); }
      },
      stop(g, E) {
        const h = E.holder; if (E.abort || !h || !alive(h)) return;
        // ¡BUM!
        evHit(g, h, { d: 28, b: 6.4, g: 2.3, ang: 78 }, Math.random() < 0.5 ? -1 : 1);
        g.shake = Math.max(g.shake, 14); Sfx.boom(); Sfx.bigImpact();
        duoRadial(g, h.x, h.y - h.S.hh / 2, 40, ['#ff3a3a', '#ffd040', '#ff7a20', '#ffffff'], 3.2);
        for (let i = 0; i < 10; i++) g.burst(h.x + (Math.random() * 20 - 10), h.y - Math.random() * h.S.hh, 1, 'fire');
        g.burst(h.x, h.y - h.S.hh / 2, 8, 'smoke');
        E.boomX = h.x; E.boomY = h.y - h.S.hh / 2;
      },
      // al golpear, la bomba pasa al rival golpeado
      onHit(g, E, a, d) {
        if (E.phase !== 'on' || E.holder !== a || d === a || g.allies(a, d) || g.frame < (E.passT || 0)) return;
        E.holder = d; E.passT = g.frame + 24; Sfx.pass();
        g.spark(d.x, d.y - d.S.hh - 8, 12, '#ff3a3a');
      },
      drawFront(c, g, E) {
        if (E.phase === 'end' && E.boomX != null && E.t < 24) {                // onda de la explosión
          const k = E.t / 24; withAlpha(c, 1 - k, () => { ring(c, Math.round(E.boomX), Math.round(E.boomY), 8 + E.t * 4, '#ffd040'); ring(c, Math.round(E.boomX), Math.round(E.boomY), 4 + E.t * 3, '#ff3a3a'); });
        }
        const h = E.holder; if (E.phase !== 'on' || !h || !alive(h)) return;
        // la bomba sobre la cabeza
        const x = Math.round(h.x), y = Math.round(h.y - h.S.hh - 12), left = this.dur - E.t, urgent = left <= 180;
        glow(c, x, y, 9 + (urgent && (E.t >> 2) % 2 ? 3 : 0), '#ff3a3a', 0.35, 3);
        disc(c, x, y, 5, OUTLINE); disc(c, x, y, 4, '#2a2030'); px(c, x - 2, y - 2, '#6a6080'); px(c, x - 1, y - 3, '#8a80a0');
        rect(c, x - 1, y - 6, 3, 2, '#8a80a0'); pline(c, x + 1, y - 6, x + 3, y - 9, 1, '#c8a070');
        px(c, x + 3 + ((E.t >> 1) % 2), y - 10, (E.t >> 1) % 2 ? '#ffd040' : '#ffffff');
      },
    },
  ],
};

const EventSys = {
  list(g) { return g && g.cfg && g.cfg.events !== false && !g.cfg.practice && !g.cfg.tutorial ? STAGE_EVENTS[g.stage.id] : null; },
  def(id) { for (const k in STAGE_EVENTS) for (const d of STAGE_EVENTS[k]) if (d.id === id) return d; return null; },
  // cada fotograma de la pelea (solo el anfitrión simula)
  step(g) {
    const L = this.list(g);
    if (!L || g.phase !== 'play' || g.sd) { if (g.ev) this.clear(g); return; }
    if (!g.ev) {
      if (g.evNext == null) g.evNext = EVENT_FIRST;
      if (--g.evNext > 0) return;
      const pool = L.length > 1 && g.evLast ? L.filter(d => d.id !== g.evLast || Math.random() < 0.3) : L;   // mejor no repetir
      const D = pool[Math.random() * pool.length | 0];
      g.ev = { id: D.id, phase: 'warn', t: 0 }; g.evLast = D.id;
      Sfx.alarm();
      return;
    }
    const E = g.ev, D = this.def(E.id); E.t++;
    if (E.phase === 'warn') {
      if (D.warn) D.warn(g, E);
      if (E.t >= EVENT_WARN) { E.phase = 'on'; E.t = 0; Sfx.eventGo(); if (D.start) D.start(g, E); }
    } else if (E.phase === 'on') {
      if (D.step) D.step(g, E);
      if (E.t >= D.dur) { E.phase = 'end'; E.t = 0; if (D.stop) D.stop(g, E); if (!E.abort) Sfx.eventEnd(); }
    } else if (E.t >= 60) { g.ev = null; g.evNext = EVENT_GAP[0] + (Math.random() * (EVENT_GAP[1] - EVENT_GAP[0]) | 0); }
  },
  clear(g) { g.ev = null; },
  onHit(g, a, d) { const E = g.ev; if (!E) return; const D = this.def(E.id); if (D && D.onHit) D.onHit(g, E, a, d); },
  holder(g) { return g.ev && g.ev.id === 'papa' && g.ev.phase === 'on' ? g.ev.holder : null; },
  // ¿qué evento suena ahora? (para la música)
  playing(g) { return g && g.ev && g.ev.phase === 'on' ? g.ev.id : null; },
  // dibujo
  drawBack(c, g) { const E = g.ev; if (!E) return; const D = this.def(E.id); if (D && D.drawBack) D.drawBack(c, g, E); },
  drawFront(c, g) { const E = g.ev; if (!E) return; const D = this.def(E.id); if (D && D.drawFront) D.drawFront(c, g, E); },
  // franja del aviso (en pantalla)
  drawScreen(c, g) {
    const E = g.ev; if (!E || E.phase !== 'warn') return;
    const D = this.def(E.id), k = Math.min(1, E.t / 10, (EVENT_WARN - E.t) / 10), h = Math.round(46 * k), y = 58;
    rect(c, 0, y, W, h, '#0c0a24', 0.6);
    for (let x = -20; x < W + 20; x += 16) { const o = (E.t * 2) % 16; rect(c, x + o, y, 8, 2, D.col, 0.9 * k); rect(c, x - o, y + h - 2, 8, 2, D.col, 0.9 * k); }   // franjas de peligro en movimiento
  },
  text(t, g) {
    const E = g.ev; if (!E) return;
    const D = this.def(E.id);
    if (E.phase === 'warn') {
      const pop = E.t < 8 ? 1 + (8 - E.t) * 0.12 : 1, blink = (E.t >> 3) % 2;
      t.text(D.name, W / 2, 64, Math.round(24 * pop), blink ? D.col : '#ffffff', 'center');
      if (E.t > 10) t.text(D.sub, W / 2, 92, 8, '#ffd34a', 'center');
      t.text('en ' + Math.ceil((EVENT_WARN - E.t) / 60) + '…', W / 2, 102, 8, '#ffffff', 'center');
    } else if (E.phase === 'on') {
      const left = Math.ceil((D.dur - E.t) / 60);
      t.text(`${D.name}  ${left}`, W / 2, 28, 8, (E.t >> 4) % 2 ? D.col : '#ffffff', 'center');
      const h = this.holder(g);
      if (h && alive(h)) {                                                      // la cuenta atrás sobre la bomba
        const urgent = left <= 3, x = clamp(h.x, 20, W - 20), y = clamp(h.y - h.S.hh - 40, 14, H - 60);
        t.text(String(left), x, y, urgent ? 24 : 16, urgent && (E.t >> 2) % 2 ? '#ffffff' : '#ff3a3a', 'center');
      }
    }
  },
  // la CPU, DESPUÉS de decidir qué hacer: durante la lava (y al final del aviso) no pisa el suelo.
  //  En el suelo -> corre y salta a la plataforma más cercana; en el aire -> se guía hacia una
  //  plataforma (sin caída rápida); sobre una plataforma -> no se deja caer ni camina fuera del borde.
  aiPost(f, g, I) {
    const E = g.ev;
    if (!E || E.id !== 'lava' || E.phase === 'end' || (E.phase === 'warn' && E.t < EVENT_WARN - 110)) return I;
    if (!alive(f) || f.st === 'hitstun' || f.st === 'helpless' || f.st === 'ledge' || f.st === 'grabbed' || f.holding) return I;
    const M = STAGE.main;
    if (f.x < M.x1 - 4 || f.x > M.x2 + 4) return I;                         // fuera del escenario: que se recupere a su modo
    let best = null, bd = 1e9;
    for (const p of STAGE.plats) {
      const d = Math.abs((p.x1 + p.x2) / 2 - f.x) + (p.y > f.y + 4 ? 0 : 30);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return I;
    const tx = (best.x1 + best.x2) / 2, half = (best.x2 - best.x1) / 2, ddx = tx - f.x;
    if (f.grounded && f.plat && f.plat !== M) {                              // a salvo en una plataforma
      if (I.my > 0.5) I.my = 0;
      const P = f.plat;
      if ((I.mx < 0 && f.x - P.x1 < 10) || (I.mx > 0 && P.x2 - f.x < 10)) I.mx = 0;
      return I;
    }
    if (f.grounded) {                                                        // en el suelo que arde: ¡fuera!
      I.mx = Math.abs(ddx) > 6 ? sgn(ddx) : 0; I.my = 0; I.shd = false; I.grab = false;
      if (Math.abs(ddx) < half + 34) I.jump = !f.prev.jump;
      return I;
    }
    if (Math.abs(ddx) > half - 6) I.mx = sgn(ddx);                           // en el aire: hacia la plataforma
    if (I.my > 0.5) I.my = 0;
    if (f.vy > 0 && f.y > best.y - 2 && f.jumps > 0) I.jump = !f.prev.jump;  // por debajo y cayendo: salta otra vez
    return I;
  },
  // la CPU: huir de quien lleva la bomba
  ai(f, g, I) {
    const E = g.ev; if (!E) return false;
    if (E.id === 'papa' && E.phase === 'on' && E.holder && E.holder !== f) {
      const h = E.holder, dx = f.x - h.x;
      if (Math.abs(dx) < 70 && Math.abs(f.y - h.y) < 60 && (f.st === 'ground' || f.st === 'air')) { I.mx = sgn(dx) || 1; if (f.grounded && Math.random() < 0.08) I.jump = !f.prev.jump; return true; }
    }
    return false;
  },
};
