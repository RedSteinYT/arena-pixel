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
//  Todo pasa por un bus con compresor (para que los golpes suenen gordos sin saturar) y un envío
//  de reverberación (espacio y colas para los impactos grandes). Los golpes se hacen por capas:
//  chasquido de ataque + cuerpo + "sub" grave que se siente; cuanto más fuerte, más peso y cola.
const Sfx = (() => {
  let ac = null, final = null, master = null, out = null, verb = null, noiseBuf = null, shaper = null, userLevel = 1;    // userLevel: volumen de efectos elegido (0-1)
  // impulso de reverberación sintetizado: ruido estéreo con caída exponencial (sala grande)
  function impulse(a, secs, decay) {
    const n = Math.floor(a.sampleRate * secs), b = a.createBuffer(2, n, a.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function ctx() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        // limitador final, compartido con la música: por mucho que se sumen golpes y música, nunca satura
        final = ac.createDynamicsCompressor();
        final.threshold.value = -4; final.knee.value = 2; final.ratio.value = 20; final.attack.value = 0.001; final.release.value = 0.12;
        final.connect(ac.destination);
        master = ac.createGain(); master.gain.value = 0.5 * userLevel; master.connect(final);
        const comp = ac.createDynamicsCompressor();                 // pega los golpes sin que distorsione al sumarse
        comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
        comp.connect(master);
        out = ac.createGain(); out.gain.value = 1.15; out.connect(comp);
        const conv = ac.createConvolver(), vlp = ac.createBiquadFilter(), vg = ac.createGain();
        conv.buffer = impulse(ac, 2.2, 3.2); vlp.type = 'lowpass'; vlp.frequency.value = 4200; vg.gain.value = 0.55;
        verb = ac.createGain(); verb.connect(conv).connect(vlp).connect(vg).connect(comp);
        shaper = ac.createWaveShaper();                               // saturación para los "crujidos"
        const c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 511 * 2 - 1; c[i] = Math.tanh(3 * x); }
        shaper.curve = c; shaper.connect(out);
      } catch (e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function env(g, t, peak, dur, att = 0.004) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  // salida con reverberación opcional (wet 0..1) y paneo
  function route(node, wet = 0, pan = 0) {
    let n = node;
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(out);
    if (wet > 0) { const w = ac.createGain(); w.gain.value = wet; n.connect(w).connect(verb); }
  }
  function tone(freq, type, vol, dur, slide, delay = 0, wet = 0, att) {
    if (api.muted) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(g, t, vol, dur, att); o.connect(g); route(g, wet); o.start(t); o.stop(t + dur + 0.05);
  }
  function nbuf(a) {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 1.2, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  // ruido filtrado: hp = paso alto (como antes); o = { lp, bp, sweep: [desde, hasta], q, wet, pan, att }
  function noise(vol, dur, hp, delay = 0, o = {}) {
    if (api.muted) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, s = a.createBufferSource(), g = a.createGain();
    s.buffer = nbuf(a);
    let node = s;
    if (hp) { const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (o.lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    if (o.sweep) {
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = o.q || 1.4;
      f.frequency.setValueAtTime(o.sweep[0], t); f.frequency.exponentialRampToValueAtTime(o.sweep[1], t + dur);
      node.connect(f); node = f;
    }
    env(g, t, vol, dur, o.att); node.connect(g); route(g, o.wet || 0, o.pan || 0);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // golpe grave que se siente (sub): seno que cae de f0 a f1
  function sub(f0, f1, vol, dur, delay = 0, wet = 0) { tone(f0, 'sine', vol, dur, f1, delay, wet, 0.002); }
  // crujido saturado (para los golpes fuertes)
  function crunch(freq, vol, dur, delay = 0) {
    if (api.muted) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.35, t + dur);
    env(g, t, vol, dur, 0.002); o.connect(g).connect(shaper); o.start(t); o.stop(t + dur + 0.05);
  }
  // parciales metálicos / de cristal (campanas, hojas, rubí)
  function ring(parts, delay = 0, wet = 0.5) { for (const [f, v, d] of parts) tone(f, 'sine', v, d, f * 0.996, delay, wet, 0.002); }

  const api = {
    muted: false,
    unlock: ctx,
    output: () => (ctx(), final),                                    // salida final (la música también va por aquí)
    setLevel(v) { userLevel = v; if (master) master.gain.setTargetAtTime(0.5 * v, ac.currentTime, 0.03); },
    ctxState: () => ac ? ac.state : "none",
    // golpe: chasquido + cuerpo + sub; con potencia, crujido saturado y cola de reverberación
    hit(power) {
      const p = clamp(power / 14, 0.2, 1.6), big = p > 0.75;
      noise(0.35 + p * 0.25, 0.025, 2600, 0, { att: 0.001 });                         // chasquido de ataque
      noise(0.3 + p * 0.4, 0.09 + p * 0.18, 220, 0, { lp: 2600 - p * 900, wet: big ? 0.25 : 0.06 });   // cuerpo
      sub(150 - p * 30, 42, 0.35 + p * 0.45, 0.12 + p * 0.2, 0, big ? 0.15 : 0);                       // el "pum" que se siente
      tone(260 - p * 110, 'square', 0.06 + p * 0.07, 0.07 + p * 0.1, 60);
      if (big) { crunch(220, 0.12 + (p - 0.75) * 0.2, 0.18 + p * 0.1); noise(0.25, 0.5 + p * 0.3, 90, 0.02, { lp: 900, wet: 0.5 }); }
      if (power >= 18) {                                                                            // impacto de película
        sub(90, 28, 0.9, 1.1, 0.01, 0.35); noise(0.5, 1.2, 40, 0.01, { lp: 600, wet: 0.7 });
        ring([[2093, 0.04, 1.2], [3136, 0.03, 1], [4186, 0.02, 0.8]], 0.01, 0.8);
        if (typeof Music !== 'undefined' && Music.stab) Music.stab();                                 // golpe de orquesta en la música (en las técnicas)
      }
    },
    shield() { tone(900, 'triangle', 0.14, 0.09); tone(1350, 'triangle', 0.08, 0.07); noise(0.08, 0.05, 3000); sub(220, 120, 0.15, 0.06); },
    jump() { tone(330, 'square', 0.045, 0.08, 660); noise(0.05, 0.06, 1500); },
    djump() { tone(440, 'square', 0.045, 0.1, 990); noise(0.06, 0.12, 1800, 0, { sweep: [800, 4000] }); },
    swing() { noise(0.16, 0.09, 0, 0, { sweep: [700, 4200], q: 1.2 }); },                             // silbido del golpe
    shoot() { tone(700, 'sawtooth', 0.08, 0.15, 1400); noise(0.08, 0.06, 2500); },
    // KO: estallido, retumbe grave largo y cola enorme
    ko() {
      noise(0.9, 0.08, 1200, 0, { att: 0.001 });
      noise(0.9, 1.4, 50, 0, { lp: 1600, wet: 0.8 });
      sub(110, 24, 1.0, 1.4, 0, 0.4); crunch(180, 0.25, 0.5);
      tone(900, 'square', 0.07, 0.35, 200, 0.05, 0.4);
      ring([[1760, 0.05, 1.6], [2637, 0.035, 1.3]], 0.04, 0.9);
    },
    blip() { tone(880, 'square', 0.06, 0.06); },
    join() { tone(660, 'square', 0.07, 0.07); tone(990, 'square', 0.07, 0.1, null, 0.07, 0.2); },
    count(go) {
      if (go) { [523, 659, 784, 1047].forEach(f => tone(f, 'square', 0.06, 0.5, null, 0, 0.35)); noise(0.3, 0.9, 3500, 0, { wet: 0.5 }); sub(120, 40, 0.6, 0.4); }
      else { tone(660, 'square', 0.1, 0.15, null, 0, 0.25); sub(140, 60, 0.25, 0.12); }
    },
    land() { noise(0.06, 0.05, 900, 0, { lp: 3000 }); sub(90, 50, 0.12, 0.06); },
    grab() { tone(300, 'square', 0.12, 0.08, 200); noise(0.18, 0.07, 600, 0, { lp: 3500 }); sub(130, 60, 0.3, 0.1); },
    // rotura (escudo, hielo, rocas): cristal que estalla
    brk() {
      noise(0.45, 0.35, 900, 0, { wet: 0.4 }); sub(120, 40, 0.5, 0.3);
      tone(500, 'square', 0.12, 0.4, 80);
      for (let i = 0; i < 6; i++) tone(2000 + Math.random() * 3500, 'sine', 0.035, 0.25 + Math.random() * 0.3, null, Math.random() * 0.08, 0.6);
    },
    // ---- combos ----
    combo(n) { tone(440 + Math.min(n, 10) * 70, 'square', 0.05, 0.08, null, 0, 0.15); },
    remate() {
      [392, 523, 659, 1047].forEach((f, i) => tone(f, 'square', 0.07, 0.2, null, i * 0.05, 0.35));
      noise(0.4, 0.45, 200, 0, { lp: 2500, wet: 0.5 }); sub(130, 35, 0.7, 0.5, 0, 0.3);
    },
    // ---- objetos ----
    saber() { tone(180, 'sawtooth', 0.07, 0.16, 420); tone(360, 'square', 0.03, 0.12, 900); noise(0.08, 0.12, 0, 0, { sweep: [1200, 5000] }); },
    saberHum() { tone(120, 'sawtooth', 0.03, 0.25, 110); },
    laser() { tone(1500, 'square', 0.07, 0.14, 300); tone(900, 'sawtooth', 0.04, 0.1, 200); },
    crack() { noise(0.6, 0.12, 1800); tone(900, 'square', 0.15, 0.08, 1400); tone(220, 'triangle', 0.25, 0.2, 90); sub(110, 40, 0.4, 0.2); },
    boom() { noise(0.9, 0.9, 50, 0, { lp: 1200, wet: 0.7 }); sub(100, 26, 0.9, 0.9, 0, 0.3); noise(0.4, 0.25, 900, 0.03); crunch(140, 0.2, 0.4); },
    freeze() { tone(1800, 'triangle', 0.08, 0.35, 2600, 0, 0.5); tone(2400, 'sine', 0.06, 0.45, 3200, 0.05, 0.6); noise(0.12, 0.25, 5000, 0, { wet: 0.4 }); },
    pickup() { tone(520, 'square', 0.06, 0.05); tone(780, 'square', 0.06, 0.07, null, 0.05, 0.2); },
    toss() { noise(0.14, 0.14, 0, 0, { sweep: [900, 3000] }); tone(300, 'triangle', 0.06, 0.1, 160); },
    powerup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 'square', 0.06, 0.14, null, i * 0.06, 0.3)); },
    heal() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 'triangle', 0.08, 0.25, null, i * 0.07, 0.4)); },
    appear() { tone(1200, 'sine', 0.05, 0.25, 2400, 0, 0.5); tone(1800, 'sine', 0.03, 0.3, 3600, 0.08, 0.5); },
    whoosh() { noise(0.18, 0.25, 0, 0, { sweep: [500, 3500], q: 1 }); },
    smashStone() { noise(0.7, 0.4, 100, 0, { lp: 2000, wet: 0.4 }); sub(80, 30, 0.8, 0.5, 0, 0.2); crunch(120, 0.15, 0.3); },

    // ---- técnicas (¡¡¡DUPLA!!! y Ultimate Ruby) ----
    // arranque de una ¡¡¡DUPLA!!!: golpe seco + subida de tensión
    duoStart() {
      sub(140, 40, 0.8, 0.5, 0, 0.3); noise(0.5, 0.08, 1500, 0, { att: 0.001 });
      noise(0.22, 1.4, 0, 0.05, { sweep: [300, 6000], q: 2, wet: 0.5, att: 1.2 });            // "riser"
      tone(220, 'sawtooth', 0.05, 1.4, 880, 0.05, 0.4, 1.2);
      [523, 784, 1047].forEach(f => tone(f, 'square', 0.04, 0.6, null, 0, 0.6));
    },
    // latido del corazón de rubí (lub-dub)
    heartbeat(k = 1) {
      sub(70, 38, 0.7 * k, 0.22, 0, 0.25); noise(0.15 * k, 0.06, 0, 0, { lp: 400 });
      sub(62, 34, 0.5 * k, 0.2, 0.16, 0.25);
    },
    // el corazón de rubí estalla: cristal que se rompe + gran explosión con cola
    rubyShatter() {
      noise(0.8, 0.06, 1500, 0, { att: 0.001 });
      noise(0.7, 1.6, 40, 0, { lp: 1400, wet: 0.9 });
      sub(120, 22, 1.0, 1.5, 0, 0.4); crunch(240, 0.2, 0.5);
      for (let i = 0; i < 12; i++) tone(1800 + Math.random() * 5000, 'sine', 0.04, 0.4 + Math.random() * 0.8, null, Math.random() * 0.15, 0.8);
      ring([[1318, 0.06, 2], [1976, 0.05, 1.8], [2637, 0.04, 1.5]], 0.02, 0.9);
      noise(0.2, 1.2, 0, 0.1, { sweep: [6000, 400], q: 1.5, wet: 0.6 });                        // los pedazos cayendo
    },
    // explosión final de una técnica (más grande que cualquier golpe)
    bigImpact() {
      noise(0.9, 0.05, 2000, 0, { att: 0.001 });
      noise(0.9, 1.8, 30, 0, { lp: 1000, wet: 0.9 });
      sub(100, 20, 1.1, 1.8, 0, 0.45); crunch(160, 0.3, 0.6);
      ring([[1568, 0.05, 2], [2349, 0.04, 1.6]], 0.03, 0.9);
    },
    // Comeback de Rubí: brillo de rubí + golpe
    rubyCb() {
      [784, 1175, 1568].forEach((f, i) => tone(f, 'triangle', 0.06, 0.4, null, i * 0.04, 0.6));
      noise(0.3, 0.5, 0, 0, { sweep: [400, 5000], q: 1.5, wet: 0.4 }); sub(130, 45, 0.5, 0.3);
    },
    // concentración: zumbido que sube con la carga (k 0..1)
    charge(k) { tone(180 + k * 520, 'triangle', 0.05 + k * 0.04, 0.2, 200 + k * 560, 0, 0.3); noise(0.04, 0.12, 2000, 0, { wet: 0.3 }); },
    // Ultimate cargado
    rubyReady() {
      [659, 988, 1319, 1976].forEach((f, i) => tone(f, 'triangle', 0.07, 0.6, null, i * 0.06, 0.7));
      sub(110, 50, 0.5, 0.4, 0, 0.3); noise(0.2, 0.8, 3000, 0, { wet: 0.6 });
    },
    // ---- eventos de arena ----
    // aviso: sirena de dos tonos (tres veces) sobre un golpe grave
    alarm() {
      sub(110, 50, 0.6, 0.5, 0, 0.3);
      for (let i = 0; i < 3; i++) { tone(880, 'square', 0.07, 0.22, null, i * 0.5, 0.35); tone(660, 'square', 0.07, 0.22, null, i * 0.5 + 0.25, 0.35); }
      noise(0.15, 1.4, 0, 0.1, { sweep: [300, 3000], q: 2, wet: 0.4, att: 1 });
    },
    // empieza el evento: golpe + acorde
    eventGo() { sub(130, 30, 0.9, 0.7, 0, 0.4); noise(0.5, 0.6, 200, 0, { lp: 3000, wet: 0.6 }); [262, 392, 523, 784].forEach(f => tone(f, 'sawtooth', 0.04, 0.6, null, 0, 0.5)); crunch(200, 0.15, 0.3); },
    // termina el evento: acorde que baja
    eventEnd() { [784, 659, 523, 392].forEach((f, i) => tone(f, 'triangle', 0.06, 0.25, null, i * 0.07, 0.4)); },
    // tic-tac de la bomba (urgente: más agudo)
    tick(urgent) { tone(urgent ? 2200 : 1500, 'square', urgent ? 0.09 : 0.07, 0.04); noise(0.12, 0.03, 3000); if (urgent) sub(160, 90, 0.15, 0.05); },
    // la bomba cambia de manos
    pass() { noise(0.2, 0.15, 0, 0, { sweep: [800, 4000], q: 1.5 }); tone(990, 'square', 0.07, 0.08); tone(1320, 'square', 0.07, 0.1, null, 0.06, 0.3); },
    // ¡te quemaste! golpe grave + chasquido + llamarada que baja
    lavaBurn() { sub(90, 35, 0.7, 0.35); crunch(160, 0.12, 0.35); noise(0.45, 0.35, 0, 0, { sweep: [3000, 400], q: 1, wet: 0.4 }); tone(220, 'sawtooth', 0.06, 0.25, 110); },
    // ¡GRAVEDAD LUNAR!: campanitas de cristal que flotan
    lunarChime() { ring([[1568, 0.04, 1.2], [2093, 0.03, 1.4], [2637, 0.02, 1.6]], 0, 0.8); ring([[1760, 0.03, 1.2], [2349, 0.02, 1.4]], 0.35, 0.8); },
    // ¡TORMENTA ELÉCTRICA!: la marca chisporrotea (aviso del rayo)
    zapWarn() { for (let i = 0; i < 4; i++) noise(0.08, 0.05, 2500, i * 0.09, { wet: 0.2 }); tone(1200, 'sawtooth', 0.03, 0.5, 2400, 0, 0.3); },
    // el rayo: chasquido seco + trueno que retumba
    thunder() { noise(0.6, 0.12, 1200, 0, { wet: 0.3 }); crunch(220, 0.25, 0.25); sub(70, 30, 0.8, 0.9, 0.05, 0.4); noise(0.35, 1.6, 0, 0.08, { lp: 400, wet: 0.7, att: 0.05 }); },
    // trueno lejano (durante el aviso)
    thunderFar() { noise(0.25, 1.8, 0, 0, { lp: 260, wet: 0.8, att: 0.2 }); sub(55, 35, 0.3, 1.2, 0.1, 0.5); },
    // ¡VENTISCA!: ráfaga (silbido que barre)
    gust(k = 1) { noise(0.22 * k, 1.1, 0, 0, { sweep: [400, 1800], q: 3, wet: 0.5, att: 0.3, pan: Math.random() - 0.5 }); noise(0.12 * k, 0.9, 0, 0.3, { sweep: [1600, 500], q: 4, wet: 0.5, att: 0.2 }); },
    // ¡LLUVIA DE HIELO!: tintineo de aviso, silbido de caída y estallido de cristal
    iceTinkle() { ring([[2637, 0.03, 0.4], [3520, 0.02, 0.5]], 0, 0.6); ring([[3136, 0.025, 0.4]], 0.12, 0.6); },
    iceWhistle() { tone(2400, 'sine', 0.04, 0.26, 700, 0, 0.3); },
    iceShatter(size = 1) {
      crunch(500 - size * 80, 0.14 + size * 0.04, 0.12); sub(120 - size * 15, 50, 0.3 + size * 0.1, 0.25);
      noise(0.3, 0.25, 3000, 0, { wet: 0.4 });
      ring([[1760 + Math.random() * 400, 0.05, 0.5], [2793, 0.04, 0.6], [3951, 0.03, 0.7]], 0.01, 0.6);
    },
    // ¡BALANZA ENLOQUECIDA!: crujido de bronce al cambiar de lado y golpe de catapulta
    creak(k = 1) { tone(90, 'sawtooth', 0.06 * k, 0.5, 60, 0, 0.4); noise(0.12 * k, 0.45, 0, 0, { sweep: [300, 900], q: 8, wet: 0.4 }); ring([[523, 0.02 * k, 0.6], [784, 0.015 * k, 0.7]], 0.05, 0.5); },
    catapult() { sub(160, 60, 0.5, 0.3); noise(0.3, 0.3, 0, 0, { sweep: [500, 3500], q: 1.5, wet: 0.3 }); tone(440, 'square', 0.05, 0.25, 1320, 0, 0.3); },
    // ¡ESPÍRITUS GUARDIANES!: aparecen (oleaje al revés + campana), susurran y golpean
    spiritAppear() { noise(0.18, 0.8, 0, 0, { sweep: [200, 2400], q: 3, wet: 0.7, att: 0.7 }); ring([[659, 0.03, 1.2], [988, 0.025, 1.4], [1319, 0.02, 1.6]], 0.6, 0.8); },
    spiritWhisper() { noise(0.07, 0.9, 0, 0, { sweep: [1200, 700], q: 6, wet: 0.8, att: 0.3, pan: Math.random() - 0.5 }); },
    // te atrapa: acorde que se hincha y aire que gira
    spiritGrab() { noise(0.25, 1.0, 0, 0, { sweep: [300, 1600], q: 4, wet: 0.7, att: 0.4 }); [220, 277, 330, 440].forEach((f, i) => tone(f, 'sine', 0.05, 0.9, f * 1.5, i * 0.04, 0.7, 0.3)); sub(70, 50, 0.4, 0.8, 0, 0.3); },
    // las runas se cierran: tono que sube
    spiritRise() { tone(330, 'sawtooth', 0.04, 0.35, 1320, 0, 0.5); noise(0.15, 0.35, 0, 0, { sweep: [800, 5000], q: 2, wet: 0.5 }); },
    // ¡ESTALLA!
    spiritBurst() { sub(140, 35, 1, 0.8, 0, 0.4); crunch(260, 0.3, 0.3); noise(0.6, 0.7, 0, 0, { lp: 2500, wet: 0.7 }); ring([[880, 0.06, 1.6], [1319, 0.05, 1.8], [1760, 0.04, 2], [2637, 0.03, 2.2]], 0.02, 0.9); },
    spiritHit() { noise(0.3, 0.4, 0, 0, { sweep: [3000, 300], q: 2, wet: 0.6 }); ring([[880, 0.05, 0.8], [1320, 0.04, 1], [1760, 0.03, 1.1]], 0, 0.7); sub(130, 60, 0.35, 0.25); },
    // siseo y burbujeo de la lava
    lavaHiss() { noise(0.12, 0.7, 1800, 0, { wet: 0.3 }); for (let i = 0; i < 3; i++) sub(90 + Math.random() * 60, 50, 0.12, 0.12, Math.random() * 0.4); },
    // pantalla VS: un "swinggg" de espada que cruza de izquierda a derecha y choca
    vsSwing() {
      if (api.muted) return;
      const a = ctx(); if (!a) return;
      const t = a.currentTime, s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      s.buffer = nbuf(a); bp.type = 'bandpass'; bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.2); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
      let o = g;
      if (a.createStereoPanner) { const pn = a.createStereoPanner(); pn.pan.setValueAtTime(-0.85, t); pn.pan.linearRampToValueAtTime(0.85, t + 0.32); g.connect(pn); o = pn; }
      s.connect(bp).connect(g); o.connect(out); s.start(t); s.stop(t + 0.56);
      // el "shiiing" metálico de la hoja al chocar (parciales inarmónicos)
      ring([[1318, 0.05, 1.4], [2093, 0.07, 1.2], [3136, 0.05, 1.0], [4699, 0.035, 0.8], [6272, 0.02, 0.55]], 0.19, 0.6);
      sub(120, 38, 0.6, 0.6, 0.19, 0.3);
      noise(0.45, 0.4, 70, 0.19, { lp: 1500, wet: 0.5 });
    },
  };
  return api;
})();
