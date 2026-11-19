'use strict';
// ============================================================
//  MODO PRÁCTICA: tú contra el Dummy, con vidas infinitas.
//  El Dummy se queda quieto (o salta, se cubre o pelea, a elegir en la
//  pausa). Se muestra tu último combo y tu mejor combo, y con R (o el
//  botón SELECT del mando) se reinicia el daño.
// ============================================================
const Practice = (() => {
  const BEHAV = [['quieto', 'QUIETO'], ['salta', 'SALTA'], ['escudo', 'SE CUBRE'], ['cpu', 'PELEA']];
  let mode = 0, last = null, best = null, flashT = 0, prevR = false;
  const dummy = g => g.fighters.find(f => f.ch.id === 'dummy');
  const player = g => g.fighters.find(f => f.ch.id !== 'dummy' || f.device !== 'dummy');

  // los "botones" del Dummy según su comportamiento
  function input(g) {
    const I = blankInput(), b = BEHAV[mode][0];
    if (b === 'salta') I.jump = g.frame % 80 < 3;
    if (b === 'escudo') I.shd = true;
    return I;
  }
  function reset(g) {
    for (const f of g.fighters) {
      f.dmg = 0; f.burn = 0; f.comboN = 0; f.comboT = 0;
      const sp = STAGE.spawns[f.slot]; f.spawn(sp[0], sp[2] ?? STAGE.main.y, sp[1]);
    }
    g.projectiles = []; flashT = 60; Sfx.join();
  }
  function tick(g) {
    for (const f of g.fighters) f.stocks = 99;                 // vidas infinitas
    const d = dummy(g); if (!d) return;
    d.cpu = BEHAV[mode][0] === 'cpu'; d.level = 'normal';
    // último combo y mejor combo
    if (d.comboBy && d.comboBy !== d && d.comboT === 110) {
      last = { n: d.comboN, dmg: d.comboDmg || 0 };
      if (!best || last.n > best.n || (last.n === best.n && last.dmg > best.dmg)) best = Object.assign({}, last);
    }
    // reiniciar con R o SELECT
    const r = Input.key('KeyR');
    let pad = false; for (const dev of Input.devices()) if (dev.startsWith('gp') && Input.rawPressed(dev, 8)) pad = true;
    if ((r && !prevR) || pad) reset(g);
    prevR = r;
    if (flashT > 0) flashT--;
  }
  function renderText(t, g) {
    const d = dummy(g); if (!d) return;
    dctx.setTransform(S, 0, 0, S, 0, 0);
    dctx.fillStyle = 'rgba(18,13,36,0.8)'; dctx.fillRect(8, 6, 244, 56);
    dctx.fillStyle = '#ffd34a'; dctx.fillRect(8, 6, 244, 2);
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    t.text('PRÁCTICA', 14, 12, 8, '#ffd34a');
    t.text('Dummy: ' + BEHAV[mode][1], 14, 24, 8, '#ffffff');
    t.text('Último combo: ' + (last ? last.n + ' golpes · ' + last.dmg + '%' : '—'), 14, 36, 8, '#9fe8ff');
    t.text('Mejor combo:  ' + (best ? best.n + ' golpes · ' + best.dmg + '%' : '—'), 14, 48, 8, '#5ee08a');
    t.text('R / SELECT: reiniciar', W - 12, 12, 8, '#46527a', 'right');
    t.text('ESC / START: opciones', W - 12, 24, 8, '#46527a', 'right');
    if (flashT > 0 && (flashT >> 2) % 2) t.text('¡REINICIADO!', W / 2, 74, 16, '#43c6f0', 'center');
  }
  return {
    BEHAV, input, tick, reset, renderText,
    get behaviour() { return BEHAV[mode][1]; },
    get last() { return last; }, get best() { return best; },
    cycle() { mode = (mode + 1) % BEHAV.length; return BEHAV[mode][1]; },
    begin() { last = null; best = null; flashT = 0; },
  };
})();
