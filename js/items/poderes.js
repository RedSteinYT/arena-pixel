'use strict';
// ============================================================
//  PODERES: se activan al tocarlos (no hace falta recogerlos)
// ============================================================
(() => {
  const label = (g, f, txt, col) => g.fx.push({ kind: 'part', ptype: 'star', x: f.x, y: f.y - f.S.hh - 6, vx: 0, vy: -0.4, t: 0, life: 30, size: 2, col });

  defineItem({
    id: 'corazon', name: 'Corazón', kind: 'power', weight: 0.7, color: '#ff5a7a',
    icon(c) {
      rect(c, 3, 5, 4, 3, '#ff5a7a'); rect(c, 9, 5, 4, 3, '#ff5a7a'); rect(c, 2, 6, 12, 4, '#ff5a7a');
      rect(c, 3, 10, 10, 2, '#e8344f'); rect(c, 5, 12, 6, 1, '#e8344f'); rect(c, 7, 13, 2, 1, '#c8243f');
      rect(c, 4, 6, 2, 2, '#ffd0d8'); px(c, 3, 7, '#ffd0d8');
    },
    apply(f, g) {
      f.dmg = Math.max(0, f.dmg - 45);
      label(g, f, '', '#ff5a7a'); Sfx.heal();
    },
  });

  defineItem({
    id: 'cristal', name: 'Cristal arcoíris', kind: 'power', weight: 0.35, color: '#c48cff',
    icon(c) {
      const cols = ['#ff5a5a', '#ffd34a', '#5ee08a', '#5aa0ff', '#c48cff'];
      for (let y = 0; y < 12; y++) { const w = y < 6 ? y + 1 : 12 - y; rect(c, 8 - w, 2 + y, w * 2, 1, cols[(y >> 1) % cols.length]); }
      rect(c, 6, 4, 2, 3, '#ffffff'); px(c, 8, 2, '#ffffff');
    },
    apply(f, g) { ItemSys.giveBuff(f, 'star', g); Sfx.powerup(); },
  });

  defineItem({
    id: 'botas', name: 'Botas de rayo', kind: 'power', weight: 0.7, color: '#ffe066',
    icon(c) {
      rect(c, 3, 4, 4, 8, '#5a6078'); rect(c, 3, 11, 8, 3, '#5a6078'); rect(c, 3, 14, 9, 1, '#2a2440');
      rect(c, 3, 4, 4, 1, '#8a90a8'); pline(c, 10, 3, 8, 7, 1, '#ffe066'); pline(c, 8, 7, 11, 7, 1, '#ffe066'); pline(c, 11, 7, 9, 11, 1, '#ffe066');
    },
    apply(f, g) { ItemSys.giveBuff(f, 'speed', g); Sfx.powerup(); },
  });

  defineItem({
    id: 'burbuja', name: 'Escudo burbuja', kind: 'power', weight: 0.6, color: '#9fe8ff',
    icon(c) {
      disc(c, 8, 8, 6, '#3a7ab0'); disc(c, 8, 8, 5, '#6cc0e8'); disc(c, 8, 8, 3, '#9fe8ff');
      rect(c, 5, 5, 2, 2, '#ffffff'); px(c, 10, 11, '#dff8ff');
    },
    apply(f, g) { ItemSys.giveBuff(f, 'bubble', g); Sfx.powerup(); },
  });

  defineItem({
    id: 'aura', name: 'Aura de fuego', kind: 'power', weight: 0.6, color: '#ff6a20',
    icon(c) {
      for (let y = 0; y < 13; y++) { const w = Math.round(Math.sin(y / 13 * Math.PI) * 5); rect(c, 8 - w, 2 + y, w * 2, 1, y < 5 ? '#ffd34a' : y < 9 ? '#ff9a30' : '#e8443f'); }
      rect(c, 7, 7, 2, 5, '#fff6b0'); px(c, 8, 1, '#ffd34a');
    },
    apply(f, g) { ItemSys.giveBuff(f, 'power', g); Sfx.powerup(); },
  });

  defineItem({
    id: 'alas', name: 'Alas', kind: 'power', weight: 0.6, color: '#ffffff',
    icon(c) {
      for (const s of [1, -1]) {
        pline(c, 8, 9, 8 + s * 6, 3, 2, '#ffffff'); pline(c, 8, 10, 8 + s * 6, 7, 2, '#dfe8ff'); pline(c, 8, 11, 8 + s * 5, 11, 1, '#b8c8f0');
      }
      rect(c, 7, 8, 2, 5, '#ffd34a');
    },
    apply(f, g) { ItemSys.giveBuff(f, 'wings', g); Sfx.powerup(); },
  });
})();
