'use strict';
// ============================================================
//  Núcleo: constantes compartidas, escenario, utilidades y sonido
// ============================================================

const W = 480, H = 270;            // resolución interna (pixel art)
const FPS = 60;

// La arena activa (forma, plataformas, reglas). La define js/stages/*.js
let STAGE = null;

const PH = {
  grav: 0.3, maxFall: 4.4, fastFall: 6.4,
  walk: 2.3, gAcc: 0.5, fric: 0.45,
  airSpd: 2.0, aAcc: 0.2, airFric: 0.03,
  jumpV: 6.4, hopV: 4.4, djumpV: 6.0,
  hw: 6, hh: 24,
  decay: 0.95,
};

// Paletas de los luchadores de prueba
const PLAYER_PALS = [
  { name: 'Rojo',     main: '#e8443f', dark: '#9c1f3c', light: '#ff9a76', glow: '#ffe0c8' },
  { name: 'Azul',     main: '#3d7ef2', dark: '#263f9c', light: '#86c8ff', glow: '#dcf3ff' },
  { name: 'Amarillo', main: '#f4c03a', dark: '#b06a1f', light: '#fff08c', glow: '#fffbe6' },
  { name: 'Verde',    main: '#3ec96b', dark: '#1d7448', light: '#a2f29b', glow: '#e8ffe0' },
  { name: 'Naranja',  main: '#f08a2e', dark: '#a8461f', light: '#ffc477', glow: '#fff0d8' },
  { name: 'Cian',     main: '#33d6d0', dark: '#1a7d8f', light: '#9ff7ee', glow: '#e6fffc' },
];
const TEAM_PALS = [[0, 4], [1, 5]];   // equipo rojo: rojo/naranja · equipo azul: azul/cian
const TEAM_NAMES = ['Equipo Rojo', 'Equipo Azul'];

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function blankInput() { return { mx: 0, my: 0, cx: 0, cy: 0, jump: false, atk: false, spc: false, shd: false, grab: false, str: false, start: false }; }
function boxHit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ---------------- Sonido sintetizado ----------------
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  function ctx() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      } catch (e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, type, vol, dur, slide, delay = 0) {
    if (api.muted) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(g, t, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(vol, dur, hp, delay = 0) {
    if (api.muted) return;
    const a = ctx(); if (!a) return;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 0.6, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    env(g, t, vol, dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
  }
  const api = {
    muted: false,
    unlock: ctx,
    hit(power) {
      const p = clamp(power / 14, 0.2, 1);
      noise(0.25 + p * 0.45, 0.08 + p * 0.2, 400 - p * 300);
      tone(260 - p * 120, 'square', 0.1 + p * 0.15, 0.08 + p * 0.15, 50);
    },
    shield() { tone(900, 'triangle', 0.15, 0.08); tone(1350, 'triangle', 0.08, 0.06); },
    jump() { tone(330, 'square', 0.05, 0.08, 660); },
    djump() { tone(440, 'square', 0.05, 0.1, 990); },
    swing() { noise(0.06, 0.06, 2500); },
    shoot() { tone(700, 'sawtooth', 0.08, 0.15, 1400); },
    ko() { noise(0.9, 0.7, 80); tone(180, 'sawtooth', 0.3, 0.8, 30); tone(900, 'square', 0.08, 0.3, 200, 0.05); },
    blip() { tone(880, 'square', 0.06, 0.06); },
    join() { tone(660, 'square', 0.07, 0.07); tone(990, 'square', 0.07, 0.1, null, 0.07); },
    count(go) { tone(go ? 1320 : 660, 'square', 0.1, go ? 0.4 : 0.15); },
    land() { noise(0.05, 0.05, 1200); },
    grab() { tone(300, 'square', 0.12, 0.08, 200); noise(0.15, 0.06, 800); },
    brk() { tone(500, 'square', 0.2, 0.5, 80); noise(0.4, 0.3, 600); },
    // pantalla VS: un "swinggg" de espada que cruza de izquierda a derecha y choca
    vsSwing() {
      if (api.muted) return;
      const a = ctx(); if (!a) return;
      noise(0.0001, 0.01, 100);                              // crea el búfer de ruido
      const t = a.currentTime, s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.2); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
      let out = g;
      if (a.createStereoPanner) { const pn = a.createStereoPanner(); pn.pan.setValueAtTime(-0.85, t); pn.pan.linearRampToValueAtTime(0.85, t + 0.32); g.connect(pn); out = pn; }
      s.connect(bp).connect(g); out.connect(master); s.start(t); s.stop(t + 0.56);
      // el "shiiing" metálico de la hoja al chocar (parciales inarmónicos)
      for (const [f, v, d] of [[1318, 0.05, 1.4], [2093, 0.07, 1.2], [3136, 0.05, 1.0], [4699, 0.035, 0.8], [6272, 0.02, 0.55]]) tone(f, 'sine', v, d, f * 0.995, 0.19);
      tone(120, 'sine', 0.55, 0.55, 38, 0.19);              // golpe grave
      noise(0.45, 0.3, 70, 0.19);
    },
  };
  return api;
})();
