'use strict';
// ============================================================
//  Música sintetizada en el navegador (WebAudio)
//  Un tema para los menús y uno para cada arena. Rock, pero suave:
//  guitarras con saturación ligera y filtradas (nada chillón),
//  batería contenida y el volumen por debajo de los efectos.
// ============================================================
const Music = (() => {
  const VOL = 0.2;                       // volumen general de la música
  let ac = null, bus = null, gtrIn = null, leadIn = null, dlyIn = null, nbuf = null;
  let song = null, songId = null, want = null, ducked = false, switchAt = 0, vol = 0;
  let userGain = null, userLevel = 1;                 // volumen de música elegido por el jugador (0-1)
  let nextT = 0, step = 0, bar = 0, sec = 0;

  // ---------- notas ----------
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midi = s => { const m = /^([A-G][#b]?)(\d)$/.exec(s); return NOTE[m[1]] + (+m[2] + 1) * 12; };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // melodía: compases separados por "|", notas "Nota:duración" en semicorcheas (cada compás = 16)
  function parseLead(str) {
    if (!str) return null;
    return str.split('|').map(b => {
      const ev = []; let t = 0;
      for (const tok of b.trim().split(/\s+/)) { const [n, l] = tok.split(':'); if (n !== 'r') ev.push([t, midi(n), +l]); t += +l; }
      if (t !== 16) console.warn('Música: compás de', t, 'semicorcheas:', b);
      return ev;
    });
  }
  const parseChord = s => { const m = /^([A-G][#b]?\d)(m?)$/.exec(s); return { root: midi(m[1]), minor: !!m[2] }; };

  // ---------- baterías (16 pasos por compás) ----------
  const DRUMS = {
    rock:   { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    drive:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' },
    half:   { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...' },
    soft:   { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' },
    metal:  { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    temple: { k: 'x.....x...x.....', s: '....x.......x...', h: '..x...x...x...x.', t: 'x..x..x.......x.' },
    intro:  { k: 'x.......x.......', s: '................', h: 'x.x.x.x.x.x.x.x.' },
  };
  const FILL = { s: '............xxxx', k: 'x.......x.x.....' };
  const GALLOP = 'x.xxx.xxx.xxx.xx';

  // ---------- temas ----------
  const SONGS = {
    // Menús: "Arena Píxel" (mi menor, rock de medio tiempo)
    menu: {
      bpm: 124, lead: 'glead', loop: 1,
      parts: {
        I: { chords: ['E2m', 'C2', 'G2', 'D2'], drums: 'intro', bass: 'eighth', gtr: 'chug' },
        A: { chords: ['E2m', 'C2', 'G2', 'D2'], drums: 'rock', bass: 'eighth', gtr: 'chug', crash: true,
             lead: 'B4:2 E5:2 G5:2 E5:2 F#5:2 G5:2 A5:2 G5:2 | E5:6 D5:2 E5:4 G5:4 | D5:2 G4:2 B4:2 D5:2 G5:4 F#5:2 E5:2 | F#5:8 D5:4 A4:4' },
        B: { chords: ['C2', 'D2', 'E2m', 'E2m'], drums: 'drive', bass: 'eighth', gtr: 'power', crash: true, fill: true,
             lead: 'G5:4 E5:2 G5:2 A5:4 G5:2 E5:2 | F#5:4 D5:2 F#5:2 A5:4 B5:4 | B5:6 A5:2 G5:4 F#5:4 | E5:12 r:4' },
      },
      order: ['I', 'A', 'B', 'A', 'B'],
    },
    // Arena de entrenamiento: tranquila y concentrada, para practicar sin cansarse
    entrenamiento: {
      bpm: 96, lead: 'square', loop: 0,
      parts: {
        A: { chords: ['C2', 'A1m', 'F1', 'G1'], drums: 'soft', bass: 'root', pad: true, arp: 'bell',
             lead: 'E5:4 G5:4 C6:4 G5:4 | E5:4 A5:4 C6:4 A5:4 | F5:4 A5:4 C6:4 A5:4 | G5:4 B5:4 D6:8' },
        B: { chords: ['F1', 'G1', 'E2m', 'A1m'], drums: 'half', bass: 'root', pad: true, arp: 'bell',
             lead: 'A5:6 G5:2 F5:4 E5:4 | D5:6 E5:2 G5:8 | B5:6 A5:2 G5:4 E5:4 | A5:16' },
      },
      order: ['A', 'A', 'B', 'A'],
    },
    // Isla Celeste: pop-rock luminoso en re mayor, con arpegios de cielo
    cielo: {
      bpm: 142, lead: 'square', loop: 0,
      parts: {
        A: { chords: ['D2', 'A1', 'B1m', 'G1'], drums: 'rock', bass: 'eighth', gtr: 'power', arp: 'square', crash: true,
             lead: 'F#5:2 A5:2 D6:4 C#6:2 A5:2 F#5:4 | E5:2 A5:2 C#6:4 B5:2 A5:2 E5:4 | F#5:2 B5:2 D6:4 C#6:2 B5:2 F#5:2 A5:2 | G5:4 B5:4 A5:2 G5:2 F#5:2 E5:2' },
        B: { chords: ['G1', 'A1', 'F#1m', 'B1m'], drums: 'drive', bass: 'eighth', gtr: 'chug', arp: 'square', crash: true, fill: true,
             lead: 'D6:4 B5:2 D6:2 E6:4 D6:4 | C#6:4 A5:2 C#6:2 E6:8 | C#6:4 A5:4 F#5:4 A5:4 | B5:12 r:4' },
      },
      order: ['A', 'A', 'B', 'B'],
    },
    // Glaciar Boreal: fa# menor, aire y campanas de hielo, batería a medio tiempo
    hielo: {
      bpm: 100, lead: 'bell', loop: 0,
      parts: {
        A: { chords: ['F#2m', 'D2', 'A1', 'E2'], drums: 'soft', bass: 'long', gtr: 'swell', pad: true, arp: 'bell',
             lead: 'C#6:6 B5:2 A5:4 F#5:4 | A5:6 F#5:2 E5:4 D5:4 | E5:4 A5:4 C#6:4 B5:4 | B5:8 G#5:4 E5:4' },
        B: { chords: ['B1m', 'D2', 'E2', 'F#2m'], drums: 'half', bass: 'root', gtr: 'swell', pad: true, arp: 'bell', crash: true,
             lead: 'D6:4 C#6:4 B5:4 F#5:4 | A5:4 B5:2 A5:2 F#5:8 | G#5:4 B5:4 E6:8 | C#6:16' },
      },
      order: ['A', 'A', 'B', 'B'],
    },
    // Templo del Equilibrio: la menor armónica, tambores de templo y cuerdas pulsadas
    balanza: {
      bpm: 116, lead: 'pluck', loop: 0,
      parts: {
        A: { chords: ['A1m', 'A1m', 'D2m', 'E2'], drums: 'temple', bass: 'root', gtr: 'hits', pad: true,
             lead: 'A4:2 C5:2 E5:2 F5:2 E5:4 C5:2 B4:2 | A4:2 B4:2 C5:2 E5:2 G#5:4 A5:4 | F5:2 E5:2 D5:2 F5:2 A5:4 F5:4 | G#5:4 F5:2 E5:2 D5:2 C5:2 B4:4' },
        B: { chords: ['F2', 'E2', 'D2m', 'E2'], drums: 'temple', bass: 'eighth', gtr: 'power', crash: true, fill: true,
             lead: 'A5:4 C6:4 B5:2 A5:2 G#5:4 | B5:4 G#5:2 E5:2 F5:4 G#5:4 | A5:4 F5:2 D5:2 E5:4 F5:4 | E5:12 r:4' },
      },
      order: ['A', 'A', 'B', 'B'],
    },
    // Fortaleza RedStein: re menor, galope pesado y solo heroico (lo más rockero)
    fortaleza: {
      bpm: 150, lead: 'glead', loop: 0,
      parts: {
        A: { chords: ['D2m', 'D2m', 'Bb1', 'C2'], drums: 'metal', bass: 'gallop', gtr: 'gallop', crash: true,
             lead: 'D5:2 F5:2 A5:2 D6:2 C#6:2 A5:2 F5:2 A5:2 | D6:4 E6:2 F6:2 E6:4 C#6:4 | D6:2 Bb5:2 F5:2 Bb5:2 D6:4 C6:4 | E6:4 C6:2 G5:2 E5:4 G5:4' },
        B: { chords: ['D2m', 'F2', 'C2', 'A1'], drums: 'drive', bass: 'eighth', gtr: 'power', crash: true, fill: true,
             lead: 'A5:6 D6:2 F6:4 E6:4 | F6:4 E6:2 D6:2 C6:4 A5:4 | G5:4 C6:4 E6:4 G6:4 | E6:4 C#6:4 A5:8' },
      },
      order: ['A', 'A', 'B', 'B'],
    },
  };
  for (const s of Object.values(SONGS)) for (const p of Object.values(s.parts)) { p.ch = p.chords.map(parseChord); p.mel = parseLead(p.lead); }

  // ---------- montaje del audio ----------
  function curve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  function chain(drive, cutoff, gain) {                // entrada -> saturación suave -> filtro -> bus
    const inp = ac.createGain(), sh = ac.createWaveShaper(), lp = ac.createBiquadFilter(), out = ac.createGain();
    sh.curve = curve(drive); sh.oversample = '2x';
    lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.4;
    out.gain.value = gain;
    inp.connect(sh).connect(lp).connect(out).connect(bus);
    return inp;
  }
  function init() {
    if (ac) return true;
    ac = Sfx.unlock(); if (!ac) return false;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.2;
    userGain = ac.createGain(); userGain.gain.value = userLevel; userGain.connect(ac.destination);
    comp.connect(userGain);
    bus = ac.createGain(); bus.gain.value = 0; bus.connect(comp);
    gtrIn = chain(2.4, 1900, 0.55);                    // guitarra rítmica: cálida, sin agudos que molesten
    leadIn = chain(1.7, 2900, 0.6);                    // guitarra solista
    // eco del solista
    dlyIn = ac.createGain();
    const d = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
    d.delayTime.value = 0.32; fb.gain.value = 0.3; lp.type = 'lowpass'; lp.frequency.value = 2200; wet.gain.value = 0.32;
    dlyIn.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(wet).connect(bus);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    setInterval(tick, 25);
    return true;
  }

  // ---------- instrumentos ----------
  function envGain(t, peak, att, dur, rel = 0.08) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.setValueAtTime(peak, t + Math.max(att, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    return g;
  }
  function osc(type, f, t, end, det = 0) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
    o.start(t); o.stop(end + 0.05); return o;
  }
  function noiseHit(t, vol, dur, type, freq, dest = bus) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function kick(t, v = 1) {
    const o = osc('sine', 150, t, t + 0.3), g = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.85 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(bus);
  }
  function snare(t, v = 1) {
    noiseHit(t, 0.3 * v, 0.16, 'highpass', 1600);
    const o = osc('triangle', 190, t, t + 0.1), g = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(bus);
  }
  const hat = (t, open) => noiseHit(t, open ? 0.06 : 0.045, open ? 0.2 : 0.035, 'highpass', 7800);
  const crash = t => noiseHit(t, 0.09, 1.3, 'highpass', 4500);
  function tom(t, f) {
    const o = osc('sine', f, t, t + 0.3), g = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.25);
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(bus);
  }
  function bass(t, m, dur) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + Math.min(0.3, dur));
    const g = envGain(t, 0.3, 0.006, dur, 0.05);
    osc('sawtooth', hz(m), t, t + dur + 0.1).connect(f);
    osc('sine', hz(m), t, t + dur + 0.1).connect(g);       // cuerpo
    f.connect(g).connect(bus);
  }
  // acorde de quinta (power chord): la base del rock
  function gtr(t, root, dur, mode) {
    const mute = mode === 'mute', swell = mode === 'swell';
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = mute ? 1000 : 2400;
    const g = mute ? ac.createGain() : envGain(t, swell ? 0.07 : 0.09, swell ? 0.45 : 0.006, dur, 0.12);
    if (mute) { g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); dur = 0.12; }
    for (const iv of [0, 7, 12]) for (const det of [-7, 7]) osc('sawtooth', hz(root + 12 + iv), t, t + dur + 0.15, det).connect(f);
    f.connect(g).connect(gtrIn);
  }
  function lead(t, m, dur, kind) {
    const end = t + dur;
    if (kind === 'glead') {                              // guitarra solista con vibrato
      const g = envGain(t, 0.13, 0.01, dur, 0.1), lfo = osc('sine', 5.5, t, end + 0.2), lg = ac.createGain();
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(dur > 0.25 ? 14 : 0, t + Math.min(dur, 0.25));
      lfo.connect(lg);
      for (const det of [0, 9]) { const o = osc('sawtooth', hz(m), t, end + 0.15, det); lg.connect(o.detune); o.connect(g); }
      g.connect(leadIn); g.connect(dlyIn);
    } else if (kind === 'square') {                      // chiptune brillante
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
      const g = envGain(t, 0.07, 0.005, dur * 0.9, 0.06);
      osc('square', hz(m), t, end + 0.1).connect(f); osc('square', hz(m), t, end + 0.1, 8).connect(f);
      f.connect(g); g.connect(bus); g.connect(dlyIn);
    } else if (kind === 'bell') {                        // campana de hielo
      const g = ac.createGain(), g2 = ac.createGain();
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.2, dur));
      g2.gain.setValueAtTime(0.05, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc('sine', hz(m), t, t + Math.max(1.2, dur)).connect(g);
      osc('sine', hz(m) * 2.76, t, t + 0.4).connect(g2);
      g.connect(bus); g2.connect(bus); g.connect(dlyIn);
    } else if (kind === 'pluck') {                       // cuerda pulsada (tipo koto)
      const g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(4000, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.4);
      g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.5, dur));
      osc('sawtooth', hz(m), t, t + Math.max(0.5, dur)).connect(f); osc('triangle', hz(m) * 2, t, t + 0.3).connect(g);
      f.connect(g); g.connect(bus); g.connect(dlyIn);
    }
  }
  function pad(t, ch, dur) {
    const iv = [0, ch.minor ? 3 : 4, 7];
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const g = envGain(t, 0.035, 0.5, dur, 0.4);
    for (const i of iv) osc('triangle', hz(ch.root + 24 + i), t, t + dur + 0.5).connect(f);
    f.connect(g).connect(bus);
  }
  function arp(t, ch, s, kind, sd) {
    if (s % 2) return;
    const iv = [0, ch.minor ? 3 : 4, 7, 12, 15 + (ch.minor ? 0 : 1), 19, 15 + (ch.minor ? 0 : 1), 12];
    const m = ch.root + 36 + iv[(s / 2) % 8];
    if (kind === 'bell') { const g = ac.createGain(); g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); osc('sine', hz(m), t, t + 0.6).connect(g); g.connect(bus); g.connect(dlyIn); }
    else { const g = envGain(t, 0.022, 0.004, sd * 1.5, 0.04); osc('square', hz(m), t, t + sd * 2).connect(g); g.connect(bus); }
  }

  // ---------- secuenciador ----------
  function playStep(t) {
    const P = song.parts[song.order[sec]], ch = P.ch[bar % P.ch.length], s = step;
    const sd = 60 / song.bpm / 4, last = bar === P.ch.length - 1;
    // batería
    const D = DRUMS[P.drums], k = (last && P.fill ? FILL.k : D.k), sn = (last && P.fill ? FILL.s : D.s);
    if (k[s] === 'x') kick(t);
    if (sn[s] === 'x') snare(t, last && P.fill && s >= 12 ? 0.55 + (s - 12) * 0.15 : 1);
    if (D.h[s] !== '.') hat(t, D.h[s] === 'o');
    if (D.t && D.t[s] === 'x') tom(t, s < 8 ? 160 : 110);
    if (P.crash && bar === 0 && s === 0) crash(t);
    if (P.drums === 'metal' && last && s >= 12) kick(t + sd / 2, 0.7);     // doble bombo al final
    // bajo
    const r = ch.root;
    if (P.bass === 'eighth' && s % 2 === 0) bass(t, r, sd * 1.7);
    else if (P.bass === 'root') { if (s === 0 || s === 8) bass(t, r, sd * 5.5); else if (s === 6 || s === 14) bass(t, r + 12, sd * 1.6); }
    else if (P.bass === 'long' && s === 0) bass(t, r, sd * 15);
    else if (P.bass === 'gallop' && GALLOP[s] === 'x') bass(t, r, sd * 0.9);
    // guitarra
    if (P.gtr === 'chug' && s % 2 === 0) gtr(t, r, sd, s === 0 ? 'open' : 'mute');
    else if (P.gtr === 'gallop' && GALLOP[s] === 'x') gtr(t, r, sd, s === 0 || s === 8 ? 'open' : 'mute');
    else if (P.gtr === 'power') { if (s === 0) gtr(t, r, sd * 5.5, 'open'); else if (s === 6) gtr(t, r, sd * 3.5, 'open'); else if (s === 10) gtr(t, r, sd * 5.5, 'open'); }
    else if (P.gtr === 'swell' && s === 0) gtr(t, r, sd * 15.5, 'swell');
    else if (P.gtr === 'hits' && (s === 0 || s === 10)) gtr(t, r, sd * (s ? 5.5 : 9.5), 'open');
    if (P.pad && s === 0) pad(t, ch, sd * 16);
    if (P.arp) arp(t, ch, s, P.arp, sd);
    // melodía
    if (P.mel) for (const e of P.mel[bar % P.mel.length]) if (e[0] === s) lead(t, e[1], e[2] * sd, song.lead);
    // avanzar
    if (++step === 16) { step = 0; if (++bar >= P.ch.length) { bar = 0; if (++sec >= song.order.length) sec = song.loop || 0; } }
  }

  function setVol(v, tc = 0.12) {
    if (v === vol) return; vol = v;
    bus.gain.cancelScheduledValues(ac.currentTime);
    bus.gain.setTargetAtTime(v, ac.currentTime, tc);
  }
  function tick() {
    const now = ac.currentTime;
    if (want !== songId) {
      if (songId && vol > 0) { setVol(0, 0.15); switchAt = now + 0.6; }
      if (now >= switchAt) {
        songId = want; song = SONGS[want] || null; step = bar = sec = 0; nextT = now + 0.08;
      }
      if (want !== songId) return;
    }
    if (!song) return;
    setVol(ducked ? VOL * 0.3 : VOL, 0.15);
    if (nextT < now - 0.3) nextT = now + 0.05;              // pestaña dormida: no amontonar notas
    while (nextT < now + 0.12) { playStep(nextT); nextT += 60 / song.bpm / 4; }
  }

  return {
    SONGS,
    // qué debería sonar ahora (se llama cada frame; solo cambia cuando hace falta)
    want(id, duck = false) {
      want = id && SONGS[id] ? id : null; ducked = duck;
      if (!ac && want && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      if (init() && ac.state === 'suspended') ac.resume();
    },
    get playing() { return songId; },
    setLevel(v) { userLevel = v; if (userGain) userGain.gain.setTargetAtTime(v, ac.currentTime, 0.03); },
  };
})();
