'use strict';
// ───────────────────────── Lava Surfer 2 ─────────────────────────
const $ = s => document.querySelector(s);
const canvas = $('#game'), ctx = canvas.getContext('2d'), keys = new Set();
const VIEW_H = 370, GRAVITY = 390, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const ease = t => t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const rand = (a, b) => a + Math.random() * (b - a);

let mode = 1, players = [], running = false, paused = false, last = 0, time = 0;
let cam = { cx: 0, cy: 0, zoom: 1, ready: false };
let shake = 0, flash = 0, flashColor = '#fff', slowmo = 0;
let hazards = [], sparks = [], popups = [], rings = [];
let giants = [], giantId = 0, nextGiantX = 1300;
let stormClock = 0, spawnClock = 0, finish = 24000, muted = true, audio, shownState = '';
let best = 0;
try { best = Number(localStorage.getItem('lavasurfer-best')) || 0 } catch (e) { /* storage unavailable */ }
const ui = $('#overlay'), startBtn = $('#start');

function resize() {
  canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
  canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ───────────────────────── Surface ─────────────────────────
// The lava surface moves over time: two travelling swells plus the giant waves.
function baseWave(x, t) {
  return 270 + 62 * (1 + .28 * Math.sin(x / 1400)) * Math.sin(x / 160 - t * .55) + 24 * Math.sin(x / 72 + t * .9);
}
// Giant wave life: swell (grows) → curl (lip forms) → crash (lip falls) → foam (fades away).
function giantState(g, t) {
  const age = t - g.t0, X = g.x0 - g.c * age;
  let h = g.H * smoother(clamp(age / g.grow, 0, 1)), curl = 0, crash = 0, foam = 0;
  if (g.breakT !== null && t > g.breakT) {
    const b = t - g.breakT;
    curl = clamp(b / .75, 0, 1);
    crash = clamp((b - .75) / .6, 0, 1);
    foam = clamp((b - 1.35) / 3.4, 0, 1);
    h = g.hBreak * (1 - .64 * smoother(crash)) * (1 - smoother(foam));
  }
  return { X, h, curl, crash, foam };
}
function giantHeight(g, x, t) {
  const s = giantState(g, t);
  if (s.h <= 0) return 0;
  const u = (x - s.X) / g.L, k = u < 0 ? u : u / g.back;   // steep front face, long back
  return k < -3.2 || k > 3.2 ? 0 : s.h * Math.exp(-k * k);
}
function surf(x, t = time) { let y = baseWave(x, t); for (const g of giants) y -= giantHeight(g, x, t); return y }
function slopeAt(x) { return (surf(x + 1.5) - surf(x - 1.5)) / 3 }
function giantSlope(x) { let s = 0; for (const g of giants) s -= (giantHeight(g, x + 1.5, time) - giantHeight(g, x - 1.5, time)) / 3; return s }
// Partial derivatives in space and time, needed for take-offs from moving waves.
function surfInfo(x) {
  const e = 1.5, d = .012, t = time;
  const y = surf(x, t), yl = surf(x - e, t), yr = surf(x + e, t), yp = surf(x, t + d), ym = surf(x, t - d);
  return {
    y, yx: (yr - yl) / (2 * e), yxx: (yr - 2 * y + yl) / (e * e), yt: (yp - ym) / (2 * d), ytt: (yp - 2 * y + ym) / (d * d),
    yxt: (surf(x + e, t + d) - surf(x + e, t - d) - surf(x - e, t + d) + surf(x - e, t - d)) / (4 * e * d)
  };
}

// ───────────────────────── Setup & input ─────────────────────────
const CONTROLS = [
  { backward: 'ArrowLeft', forward: 'ArrowRight', brake: 'ArrowDown', jump: 'ArrowUp', turbo: 'Shift', rocket: ' ', attack: 'Enter' },
  { backward: 'a', forward: 'd', brake: 's', jump: 'w', turbo: 'f', rocket: 'e', attack: 'q' }
];
const boardType = i => $('#board' + (i + 1)).value;
const live = p => p.alive && !p.done;

function freshState(x, i) {
  return {
    x, y: surf(x) - 15, v: 70, vy: 0, board: 100, fuel: 100, angle: Math.atan(slopeAt(x)), angVel: 0, spin: 0,
    airLoops: 0, trickDir: 0, airTime: 0, grabTime: 0, grabbing: false, doubleUsed: false, jumpBoost: 0, jumpHeld: true,
    air: false, alive: true, done: false, diamond: boardType(i) === 'diamond', attackTime: 0, attackCooldown: 0,
    shield: 0, tumble: 0, twist: 0, autoTrick: null, autoDone: null, bonus: 0, combo: 0, comboTimer: 0, trail: [],
    prevX: x, prevY: surf(x) - 15
  };
}

function select(n) {
  if (running) return;
  mode = n;
  $('#solo').classList.toggle('selected', n === 1);
  $('#duo').classList.toggle('selected', n === 2);
}
$('#solo').onclick = () => select(1);
$('#duo').onclick = () => select(2);

function tone(freq, len = .18, vol = .035, type = 'sine') {
  if (muted) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.connect(g); g.connect(audio.destination); o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + len);
  o.start(); o.stop(audio.currentTime + len);
}
function chord(freqs) { freqs.forEach((f, i) => setTimeout(() => tone(f, .35, .03, 'triangle'), i * 90)) }
$('#sound').onclick = () => { muted = !muted; $('#sound').textContent = muted ? 'TON AUS' : 'TON AN'; tone(440) };

function showOverlay(html, menu) { ui.innerHTML = html; ui.style.display = 'block'; ui.classList.toggle('menu', !!menu) }
function hideOverlay() { ui.style.display = 'none' }
function setRunUi(active) {
  startBtn.disabled = active;
  startBtn.textContent = active ? 'RUN LÄUFT · PAUSE FÜR NEUSTART' : 'NEUER RUN ↗';
  $('#pauseBtn').disabled = !active;
}

function start() {
  if (document.activeElement) document.activeElement.blur();
  finish = Number($('#level').value);
  time = 0; giants = []; giantId = 0; nextGiantX = 1300; hazards = []; sparks = []; popups = []; rings = [];
  stormClock = 0; spawnClock = 0; shake = flash = slowmo = 0; cam.ready = false;
  players = Array.from({ length: mode }, (_, i) => Object.assign(freshState(80 - i * 35, i), {
    id: i, color: i ? '#64e0d7' : '#fff0cb', controls: CONTROLS[i], score: 0, tricks: 0, smashes: 0, bestTrick: '—'
  }));
  keys.clear();
  running = true; paused = false; hideOverlay(); setRunUi(true); tone(330);
}
startBtn.onclick = start;

function rebuild(p) {
  const others = players.filter(q => q !== p && live(q));
  const x = others.length ? Math.min(...others.map(q => q.x)) : Math.min(p.x, finish - 100);
  Object.assign(p, freshState(x, p.id));
  if (!running) { running = true; paused = false; hideOverlay(); setRunUi(true) }
}

function setPaused(v) {
  if (!running) return;
  paused = v; keys.clear();
  if (v) showPause(); else { hideOverlay(); if (document.activeElement) document.activeElement.blur() }
}
function showPause() {
  showOverlay(`<p>PAUSE</p><h2>Kurz<br>durchatmen.</h2><span>P oder „Weiter“ setzt fort. Neustart gibt es nur hier – per Mausklick.</span>
    <div class="menu-buttons"><button id="resume">▶ WEITER</button><button id="restart">↺ NEUSTART</button></div>`, true);
  $('#resume').onclick = () => setPaused(false);
  $('#restart').onclick = start;
}
$('#pauseBtn').onclick = () => setPaused(!paused);

window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.repeat) { keys.add(k); return }
  if (k === 'p') { setPaused(!paused); return }
  if (paused) return;
  keys.add(k);
  const dead = players.filter(p => !p.alive);
  if (dead.length) { dead.forEach(rebuild); keys.delete(k) }
});
window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener('blur', () => { keys.clear(); if (running && !paused) setPaused(true) });

// ───────────────────────── Effects ─────────────────────────
function burst(x, y, color, n = 12, power = 1) {
  for (let i = 0; i < n; i++) sparks.push({ x, y, vx: (Math.random() - .5) * 240 * power, vy: -Math.random() * 180 * power, life: .6, max: .6, color, size: 4 })
}
function addPopup(x, y, text, color = '#fff3c7', size = 16, life = 1.3) { popups.push({ x, y, text, color, size, life, max: life }) }
function updateEffects(dt) {
  for (const f of sparks) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += GRAVITY * (f.float ? .15 : 1) * dt }
  sparks = sparks.filter(f => f.life > 0);
  if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
  for (const p of popups) { p.life -= dt; p.y -= 38 * dt }
  popups = popups.filter(p => p.life > 0);
  for (const r of rings) { r.life -= dt; r.r += r.speed * dt }
  rings = rings.filter(r => r.life > 0);
}

// ───────────────────────── Tricks ─────────────────────────
function flipName(n, dir) {
  const base = dir < 0 ? 'Backflip' : 'Frontflip';
  return n === 1 ? base : n === 2 ? 'Double ' + base : n === 3 ? 'Triple ' + base : n + '× ' + base;
}
function flipPoints(n) { return [0, 500, 1200, 2100, 3200][Math.min(n, 4)] + Math.max(0, n - 4) * 1300 }

function launch(p, info, manual) {
  let vy = info.yx * p.v + info.yt;
  if (manual) vy = Math.min(vy - 330, -270);
  const g = giantUnder(p.x);
  if (g) {
    // The face of a giant wave throws the rider high into the air.
    vy = Math.max(-490, Math.min(vy - (manual ? 90 : 140), -330));
    burst(p.x, p.y, '#fff0b0', 18, 1.3);
  }
  Object.assign(p, { air: true, vy, spin: 0, angVel: 0, airLoops: 0, airTime: 0, grabTime: 0, doubleUsed: false, jumpBoost: manual ? .32 : 0, autoDone: null });
  tone(manual ? 600 : 520);
}
function giantUnder(x) {
  for (const g of giants) {
    const s = giantState(g, time);
    if (s.h > 40 && x < s.X + g.L * .3 && giantHeight(g, x, time) > s.h * .3) return g;
  }
  return null;
}

function startAutoTrick(p) {
  const d = p.diamond;
  p.autoTrick = { name: d ? 'DIAMANT-SUPERNOVA' : 'LAVA-TORNADO', t: 0, dur: d ? 1.55 : 1.2, turns: d ? 3 : 2, twists: d ? 2 : 1, start: p.angle, pts: d ? 6000 : 3000 };
  p.angVel = 0; p.grabbing = false; p.shield = Math.max(p.shield, .5);
  addPopup(p.x, p.y - 120, p.autoTrick.name + '!', d ? '#a9ffff' : '#ffb35a', 24, 1.8);
  shake = Math.max(shake, .3);
  if (d) {
    slowmo = .95; flash = .45; flashColor = '#c8ffff';
    rings.push({ x: p.x, y: p.y - 25, r: 12, speed: 420, life: .7, max: .7, color: '#9fffff', width: 6 },
      { x: p.x, y: p.y - 25, r: 4, speed: 260, life: .9, max: .9, color: '#ff9cf5', width: 4 });
    const cols = ['#a9ffff', '#ffffff', '#ff9cf5', '#7fd8ff', '#fff59a'];
    for (let i = 0; i < 46; i++) { const a = Math.random() * TAU, sp = rand(90, 380); sparks.push({ x: p.x, y: p.y - 25, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, max: 1, color: cols[i % 5], size: 5, float: true, diamond: true }) }
    chord([880, 1175, 1480, 1760]);
  } else {
    flash = .22; flashColor = '#ffb05a';
    rings.push({ x: p.x, y: p.y - 25, r: 10, speed: 330, life: .6, max: .6, color: '#ff8a35', width: 6 });
    for (let i = 0; i < 28; i++) { const a = Math.random() * TAU, sp = rand(60, 260); sparks.push({ x: p.x, y: p.y - 25, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .8, max: .8, color: i % 2 ? '#ffcf5a' : '#ff6a2a', size: 5, float: true }) }
    chord([440, 554, 660]);
  }
}
function runAutoTrick(p, dt) {
  const a = p.autoTrick; a.t += dt;
  const k = Math.min(1, a.t / a.dur), e = ease(k);
  p.angle = lerp(a.start, .2, e) - TAU * a.turns * e;   // backflips
  p.twist = TAU * a.twists * e;                          // body spin
  const cols = p.diamond ? ['#a9ffff', '#ffffff', '#ff9cf5', '#fff59a'] : ['#ffcf5a', '#ff6a2a', '#ff9a3a'];
  for (let i = 0; i < (p.diamond ? 3 : 2); i++) sparks.push({ x: p.x + rand(-20, 20), y: p.y - 20 + rand(-20, 20), vx: rand(-60, 60) - p.v * .3, vy: rand(-50, 30), life: .55, max: .55, color: cols[(Math.random() * cols.length) | 0], size: p.diamond ? 4 : 5, float: true, diamond: p.diamond });
  if (k >= 1) finishAutoTrick(p);
}
function finishAutoTrick(p) {
  const a = p.autoTrick; if (!a) return;
  p.autoDone = a; p.autoTrick = null; p.twist = 0; p.tricks += a.turns;
  p.angle = wrap(p.angle); p.spin = 0; p.airLoops = 0; p.angVel = 0;
  if (!p.diamond) p.fuel = Math.min(150, p.fuel + 60);
}

function land(p, ground) {
  const s = slopeAt(p.x), tang = Math.atan(s);
  if (p.autoTrick) { finishAutoTrick(p); p.angle = tang }
  const auto = p.autoDone;
  let diff = Math.abs(wrap(p.angle - tang));
  if (auto && diff < 1.4) diff = 0;                     // automatic tricks always land
  const names = []; let pts = 0;
  if (auto) { names.push(auto.name); pts += auto.pts }
  if (p.airLoops) { names.push(flipName(p.airLoops, p.trickDir)); pts += flipPoints(p.airLoops) }
  if (p.grabTime > .25) { names.push('Lava-Grab'); pts += Math.round(p.grabTime * 900) }
  if (p.doubleUsed) pts += 150;
  if (p.airTime > 1) pts += Math.round((p.airTime - 1) * 250);
  const impact = p.vy;
  p.v = Math.max(35, (p.v + p.vy * s) / (1 + s * s));
  Object.assign(p, { y: ground, vy: 0, air: false, angle: tang, angVel: 0, grabbing: false, twist: 0 });
  if (diff > 1.2) {
    if (!p.diamond) p.board = Math.max(0, p.board - 18);
    p.v = Math.max(35, p.v * .6); p.combo = 0; p.comboTimer = 0; p.tumble = .6;
    addPopup(p.x, p.y - 80, 'BRUCHLANDUNG', '#ff7a5a', 17);
    shake = Math.max(shake, .35); burst(p.x, p.y, '#ff8e36', 16); tone(100);
  } else {
    const perfect = diff < .3;
    if (perfect && p.airTime > .5) p.v = Math.min(640, p.v + 45);
    if (p.airLoops || auto) p.fuel = Math.min(150, p.fuel + 15);
    if (pts >= 400) {
      p.combo++; p.comboTimer = 4.5;
      const mult = Math.min(5, 1 + .5 * (p.combo - 1)) * (perfect ? 1.5 : 1);
      const total = Math.round(pts * mult / 10) * 10;
      p.score += total; p.bonus = 2;
      const label = names.join(' + ') || 'BIG AIR';
      if (pts > (p.bestPts || 0)) { p.bestPts = pts; p.bestTrick = label }
      addPopup(p.x, p.y - 100, label, p.color, 17);
      addPopup(p.x, p.y - 76, `+${total.toLocaleString('de-DE')}${mult > 1 ? ' · ×' + mult.toFixed(1).replace('.', ',') : ''}`, '#ffd56a', 15);
      tone(1000);
    }
    if (perfect && p.airTime > .5) addPopup(p.x, p.y - 52, 'PERFEKT!', '#9fffb0', 13, 1);
  }
  p.autoDone = null; p.airLoops = 0; p.spin = 0; p.grabTime = 0; p.airTime = 0; p.doubleUsed = false;
  if (impact > 520) shake = Math.max(shake, .25);
}

function wipeout(p) {
  p.v = Math.max(35, p.v * (p.diamond ? .6 : .35));
  if (!p.diamond) { p.board = Math.max(0, p.board - 22); p.fuel = Math.max(0, p.fuel - 15) }
  p.shield = 1.6; p.tumble = .9; p.combo = 0; p.comboTimer = 0; p.x -= 30;
  addPopup(p.x, p.y - 90, 'WIPEOUT!', '#ff7a5a', 20);
  shake = Math.max(shake, .6); burst(p.x, p.y - 20, '#fff0b8', 24, 1.4); tone(70, .4, .05, 'sawtooth');
}

// ───────────────────────── Player ─────────────────────────
const hasFuel = p => p.diamond || p.fuel > 0;
const activeDrive = (p, control) => live(p) && keys.has(p.controls?.[control]) && hasFuel(p);
const attacking = p => live(p) && (p.diamond ? keys.has(p.controls.attack) : p.attackTime > 0);

function updatePlayer(p, dt) {
  if (!live(p)) return;
  p.prevX = p.x; p.prevY = p.y;
  const c = p.controls, jumpDown = keys.has(c.jump), jumpPressed = jumpDown && !p.jumpHeld;
  p.jumpHeld = jumpDown;
  p.attackTime = Math.max(0, p.attackTime - dt); p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.shield = Math.max(0, p.shield - dt); p.tumble = Math.max(0, p.tumble - dt); p.bonus = Math.max(0, p.bonus - dt);
  if (keys.has(c.attack) && p.attackCooldown <= 0) { p.attackTime = .25; p.attackCooldown = .45 }
  const boost = activeDrive(p, 'turbo'), rocket = activeDrive(p, 'rocket');
  const info = surfInfo(p.x);

  let acc = -(p.air ? 1 : 4);
  if (!p.air && p.board > 0) {
    if (keys.has(c.brake)) acc -= 300;
    // Pumping: downhill gives extra speed, uphill costs less – giant waves carry you up their face.
    const gs = giantSlope(p.x), bs = info.yx - gs;
    acc += GRAVITY * (bs * (bs > 0 ? 1.35 : .85) + gs * (gs > 0 ? 1.1 : .22)) / (1 + info.yx * info.yx);
  }
  const limit = rocket ? 640 : boost ? 360 : 0;
  if (p.v < limit) acc += (boost ? 160 : 0) + (rocket ? 650 : 0);
  p.v = clamp(p.v + acc * dt, 35, 640);
  if (!p.diamond) {
    p.board = Math.max(0, p.board - dt * (p.air ? .3 : boost ? 2 : 1.25));
    if (boost || rocket) p.fuel = Math.max(0, p.fuel - dt * ((boost ? 23 : 0) + (rocket ? 38 : 0)));
  }
  if (!p.air && p.combo) { p.comboTimer -= dt; if (p.comboTimer <= 0) p.combo = 0 }

  if (p.board > 0 && !p.air) {
    // Contact is lost when the surface falls away faster than gravity can follow.
    const ay = info.yxx * p.v * p.v + 2 * info.yxt * p.v + info.ytt;
    if (jumpPressed && p.tumble <= 0) launch(p, info, true);
    else if (ay > GRAVITY) launch(p, info, false);
  }
  p.x = Math.min(finish, p.x + p.v * dt);

  if (p.board <= 0) {
    p.air = true; p.vy += (GRAVITY - (boost ? 650 : 0)) * dt; p.y += p.vy * dt;
    if (p.y >= surf(p.x) - 5) { p.y = surf(p.x) - 15; p.alive = false; tone(80) }
  } else if (p.air) airUpdate(p, dt, jumpDown, jumpPressed, boost);
  else { p.y = surf(p.x) - 15; p.angle = Math.atan(slopeAt(p.x)) }

  if (p.air && (p.autoTrick || p.diamond)) { p.trail.push({ x: p.x, y: p.y, angle: p.angle, twist: p.twist }); if (p.trail.length > 9) p.trail.shift() }
  else if (p.trail.length) p.trail.shift();
  if (p.x >= finish && !p.done) { p.done = true; tone(1000); addPopup(p.x, p.y - 90, 'ZIEL!', p.color, 22) }
}

function airUpdate(p, dt, jumpDown, jumpPressed, boost) {
  const c = p.controls;
  p.airTime += dt;
  if (jumpPressed && !p.doubleUsed && !p.autoTrick) {
    p.doubleUsed = true; p.vy = Math.min(p.vy - 140, -290); p.jumpBoost = .18;
    burst(p.x, p.y, p.diamond ? '#a9ffff' : '#ffd28a', 10); tone(720);
  }
  let ay = GRAVITY - (boost && p.vy > 0 ? 130 : 0);   // turbo lets you glide down
  if (p.jumpBoost > 0 && jumpDown && p.vy < 0) { ay *= .45; p.jumpBoost -= dt } else p.jumpBoost = 0;   // hold = higher
  if (p.autoTrick) ay *= .8;                                                                         // epic hang time
  p.y += p.vy * dt + .5 * ay * dt * dt; p.vy += ay * dt;

  if (p.autoTrick) runAutoTrick(p, dt);
  else {
    p.grabbing = keys.has(c.brake);
    if (p.grabbing) p.grabTime += dt;
    const r = (keys.has(c.forward) ? 1 : 0) - (keys.has(c.backward) ? 1 : 0), top = 7.2 * (p.grabbing ? 1.25 : 1);
    if (r) p.angVel += (r * top - p.angVel) * Math.min(1, dt * 10);
    else {
      p.angVel *= Math.exp(-dt * 7);
      if (p.autoDone) p.angle += wrap(Math.atan(slopeAt(p.x)) - p.angle) * Math.min(1, dt * 5);   // landing assist after auto trick
    }
    p.angle += p.angVel * dt; p.spin += p.angVel * dt;
    const loops = Math.floor((Math.abs(p.spin) + .05) / TAU);
    if (loops > p.airLoops) {
      const n = loops - p.airLoops;
      p.airLoops = loops; p.trickDir = Math.sign(p.spin); p.tricks += n;
      p.fuel = Math.min(150, p.fuel + 35 * n); p.bonus = 1.5;
      tone(850 + loops * 80);
      addPopup(p.x, p.y - 70, flipName(loops, p.trickDir), p.color, 14, .9);
    }
  }
  const ground = surf(p.x) - 15;
  if (p.y >= ground) land(p, ground);
}

// ───────────────────────── Giant waves ─────────────────────────
function lipTip(g, s) {
  const base = baseWave(s.X, time), cy = base - s.h;
  const x = s.X - g.L * (.3 + .95 * s.curl) - g.L * .45 * s.crash;
  return { x, y: lerp(cy + 12 + 38 * s.curl, surf(x) + 5, smoother(s.crash)), cy, base };
}
function updateGiants(dt) {
  const active = players.filter(live);
  if (!active.length) return;
  const lead = Math.max(...active.map(p => p.x));
  if (lead > nextGiantX && lead < finish - 1600 && giants.every(g => g.breakT !== null)) {
    giants.push({ id: ++giantId, x0: lead + 1350, t0: time, c: rand(150, 195), H: rand(165, 210), L: rand(112, 128), back: 2.1, grow: 1.9, breakT: null, hBreak: 0, tricked: new Set(), rel: new Map(), spray: 0 });
    nextGiantX = lead + rand(2800, 4400);
    tone(110, .6, .05, 'sawtooth');
  }
  for (const g of giants) {
    const s = giantState(g, time), age = time - g.t0;
    if (g.breakT === null) {
      const ahead = active.filter(p => p.x < s.X);
      const near = ahead.length && s.X - Math.max(...ahead.map(p => p.x)) < 310;
      if ((near && age > g.grow * .75) || age > 11 || (!ahead.length && age > g.grow)) {
        g.breakT = time; g.hBreak = s.h; tone(90, .7, .05, 'sawtooth');
      }
    }
    const tip = lipTip(g, s);
    // Spray from the curling lip and the crash.
    if (s.curl > 0 && s.foam < .6) {
      g.spray -= dt;
      if (g.spray <= 0) {
        g.spray = .03;
        for (let i = 0; i < (s.crash > 0 && s.crash < 1 ? 6 : 2); i++)
          sparks.push({ x: tip.x + rand(-15, 25), y: tip.y + rand(-10, 5), vx: rand(-160, 40), vy: rand(-260, -60), life: .7, max: .7, color: ['#fff3c2', '#ffd56a', '#ff9a3a'][i % 3], size: rand(3, 6) });
      }
    }
    if (s.crash > 0 && s.crash < 1 && Math.random() < .3) shake = Math.max(shake, .18);
    // The crashing lip wipes out anyone caught under it.
    if (s.crash > 0 && s.crash < 1) {
      for (const p of active) if (p.shield <= 0 && !p.autoTrick && p.x > tip.x - 50 && p.x < s.X - g.L * .15 && (!p.air || p.y > tip.cy - 10)) wipeout(p);
    }
    // Flying over the crest triggers the automatic super trick.
    for (const p of active) {
      const rel = p.x - s.X, prev = g.rel.get(p.id); g.rel.set(p.id, rel);
      if (p.air && p.board > 0 && s.h > 50 && prev !== undefined && prev < 0 && rel >= 0 && !g.tricked.has(p.id) && !p.autoTrick && p.y < tip.cy + 60) {
        g.tricked.add(p.id); startAutoTrick(p);
      }
    }
  }
  giants = giants.filter(g => !(g.breakT !== null && time - g.breakT > 4.8) && giantState(g, time).X > lead - 4000);
}

// ───────────────────────── Hazards ─────────────────────────
function stormPhase() { const ph = stormClock % 22; return ph >= 6 && ph < 8 ? 'warning' : ph >= 8 && ph < 15 ? 'active' : 'calm' }
function hitDistance(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(ax + dx * t, ay + dy * t) }
function updateHazards(dt) {
  stormClock += dt;
  if (stormPhase() === 'active') {
    spawnClock -= dt;
    if (spawnClock <= 0) {
      spawnClock = .65;
      for (const p of players.filter(live)) { const meteor = Math.random() < .5; hazards.push({ x: p.x + p.v * .9 + (Math.random() - .5) * 220, y: Math.min(-50, p.y - 300), vx: -40 - Math.random() * 45, vy: 90, r: meteor ? 17 : 10, meteor, warning: .75, life: 7 }) }
    }
  } else spawnClock = 0;
  for (const h of hazards) {
    h.life -= dt; if (h.warning > 0) { h.warning -= dt; continue }
    const ox = h.x, oy = h.y; h.vy += GRAVITY * .65 * dt; h.x += h.vx * dt; h.y += h.vy * dt;
    for (const p of players) {
      if (!live(p)) continue;
      const d = hitDistance(ox - p.prevX, oy - (p.prevY - 25), h.x - p.x, h.y - (p.y - 25));
      if (attacking(p) && d < h.r + (p.diamond ? 105 : 80)) { h.life = 0; p.smashes++; p.score += 100; p.fuel = Math.min(150, p.fuel + 10); burst(h.x, h.y, p.diamond ? '#8fffff' : '#ffd490'); tone(700); break }
      if (p.shield <= 0 && !p.autoTrick && d < h.r + 25) {
        h.life = 0; p.shield = 1.2; p.v = Math.max(35, p.v * .6);
        if (!p.diamond) { p.board = Math.max(0, p.board - (h.meteor ? 24 : 14)); p.fuel = Math.max(0, p.fuel - 10) }
        burst(h.x, h.y, '#ff6735'); tone(95); break;
      }
    }
    if (h.y > surf(h.x) + 25) { h.life = 0; burst(h.x, surf(h.x), '#ff8e36') }
  }
  hazards = hazards.filter(h => h.life > 0);
}

// ───────────────────────── Main update ─────────────────────────
function statusText() {
  if (giants.some(g => g.breakT === null)) return '🌊 MONSTERWELLE! VOLLGAS – SPRING ÜBER DIE KUPPE';
  if (giants.some(g => { const s = giantState(g, time); return s.curl > 0 && s.crash < 1 })) return '💥 DIE WELLE BRICHT!';
  const ph = stormPhase();
  return ph === 'warning' ? '⚠ LAVASCHAUER IM ANFLUG' : ph === 'active' ? '☄ AUSWEICHEN ODER ZERSCHMETTERN' : 'RUN LÄUFT';
}
function update(dt) {
  time += dt;
  updateGiants(dt);
  for (const p of players) updatePlayer(p, dt);
  updateHazards(dt);
  updateEffects(dt);
  if (players.every(p => !live(p))) endRun();
}
function endRun() {
  running = false; setRunUi(false);
  const won = players.some(p => p.done), dead = players.some(p => !p.alive);
  const top = Math.max(...players.map(p => p.score));
  if (top > best) { best = top; try { localStorage.setItem('lavasurfer-best', String(best)) } catch (e) { /* ignore */ } }
  const scores = players.map((p, i) => `P${i + 1}: ${p.score.toLocaleString('de-DE')} Punkte · bester Trick: ${p.bestTrick}`).join('<br>');
  showOverlay(`<p>RUN BEENDET</p><h2>${won ? 'Insel erreicht!' : 'Noch ein Versuch?'}</h2><span>${scores}<br>Rekord: ${best.toLocaleString('de-DE')}${dead ? '<br>Beliebige Taste: Brett neu aufbauen und weiterfahren.' : ''}</span>
    <div class="menu-buttons"><button id="again">NEUER RUN ↗</button></div>`, true);
  $('#again').onclick = start;
}

// ───────────────────────── Camera ─────────────────────────
function updateCamera(dt) {
  const w = canvas.clientWidth;
  const alive = players.filter(live);
  const vis = alive.length ? alive : players.length ? players : [{ x: w * .67, y: 244 }];
  let minX = Math.min(...vis.map(p => p.x)) - 110, maxX = Math.max(...vis.map(p => p.x)) + 170;
  let minY = Math.min(110, ...vis.map(p => p.y - 90)), maxY = Math.max(370, ...vis.map(p => p.y + 85));
  for (const g of giants) {
    // Zoom out so the giant wave can be seen rolling in across the screen.
    const s = giantState(g, time);
    if (s.h < 30 || s.foam > .6 || s.X < minX - 650 || s.X > maxX + 1250) continue;
    minX = Math.min(minX, s.X - g.L * 1.6); maxX = Math.max(maxX, s.X + g.L * 1.4);
    minY = Math.min(minY, baseWave(s.X, time) - s.h - 60);
  }
  const tz = clamp(Math.min(w / (maxX - minX), (VIEW_H - 30) / (maxY - minY)), .42, 1);
  const tcx = (minX + maxX) / 2, tcy = (minY + maxY) / 2;
  if (!cam.ready) { cam = { cx: tcx, cy: tcy, zoom: tz, ready: true }; return }
  cam.zoom += (tz - cam.zoom) * (1 - Math.exp(-dt * (tz < cam.zoom ? 6 : 2)));
  const kp = 1 - Math.exp(-dt * 9);
  cam.cx += (tcx - cam.cx) * kp; cam.cy += (tcy - cam.cy) * kp;
}

// ───────────────────────── Drawing ─────────────────────────
function poly(points, fill) { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill() }

function drawLava(left, right, bottom, z) {
  const xs = [], ys = [];
  for (let x = left; x <= right + 6; x += 5 / z) { xs.push(x); ys.push(surf(x)) }
  const fills = ['#ffbd45', '#ff6b24', '#d73b1c'], strokes = ['#ffe491', '#ffb447', '#f9862d'];
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath(); ctx.moveTo(left, bottom);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i] + layer * 16);
    ctx.lineTo(right + 6, bottom); ctx.fillStyle = fills[layer]; ctx.fill();
    ctx.strokeStyle = strokes[layer]; ctx.lineWidth = 3; ctx.stroke();
  }
}

function drawGiant(g) {
  const s = giantState(g, time); if (s.h < 3) return;
  const L = g.L, X = s.X, x1 = X - 2.6 * L, x2 = X + 2.6 * g.back * L;
  const right = cam.x + canvas.clientWidth / cam.zoom;
  if (x2 < cam.x - 60 || x1 > right + 60) return;
  const tip = lipTip(g, s), cy = tip.cy, base = tip.base;
  ctx.save(); ctx.globalAlpha = 1 - s.foam * .9;
  // Glowing body of the wave
  const grad = ctx.createLinearGradient(0, cy, 0, base + 30);
  grad.addColorStop(0, '#fff1a6'); grad.addColorStop(.18, '#ffb43a'); grad.addColorStop(.6, '#f2551f'); grad.addColorStop(1, '#a8281a');
  ctx.beginPath();
  for (let x = x1; x <= x2; x += 6) ctx.lineTo(x, surf(x) + 2);
  for (let x = x2; x >= x1; x -= 12) ctx.lineTo(x, baseWave(x, time) + 30);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  // Flowing magma veins on the face
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(120,22,10,${.38 - i * .07})`; ctx.beginPath();
    for (let x = X - 2.1 * L; x <= X + 1.8 * L; x += 8) {
      const depth = 22 + i * 26 + 4 * Math.sin((x + time * 90) / 26 + i);
      if (baseWave(x, time) - surf(x) < depth + 10) { ctx.moveTo(x, surf(x) + depth); continue }
      ctx.lineTo(x, surf(x) + depth);
    }
    ctx.stroke();
  }
  // Bright crest line
  ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 4; ctx.beginPath();
  for (let x = X - 1.3 * L; x <= X + 1.8 * L; x += 6) ctx.lineTo(x, surf(x));
  ctx.stroke();
  // Tube and curling lip
  if (s.curl > 0 && s.foam < 1) {
    const k = s.curl;
    ctx.fillStyle = 'rgba(70,14,10,.55)'; ctx.beginPath();
    ctx.ellipse(X - L * (.25 + .4 * k), cy + s.h * .42, Math.max(1, L * .45 * k), Math.max(1, s.h * .28 * k), 0, 0, TAU); ctx.fill();
    const sx = X + L * .5, sy = surf(sx), ex = X - L * .45, ey = surf(ex) + s.h * .05;
    const lg = ctx.createLinearGradient(0, cy - 30, 0, tip.y + 10);
    lg.addColorStop(0, '#fff3b0'); lg.addColorStop(1, '#ff8a2a');
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(X - L * .05, cy - 34 * k - 6, X - L * (.2 + .5 * k), cy - 18 * k);
    ctx.quadraticCurveTo(X - L * (.4 + .8 * k), cy - 6 * k, tip.x, tip.y);
    ctx.quadraticCurveTo(X - L * (.25 + .35 * k), cy + 30 * k, ex, ey);
    ctx.closePath(); ctx.fillStyle = lg; ctx.fill();
    ctx.strokeStyle = '#fff7d0'; ctx.lineWidth = 3; ctx.stroke();
  }
  // Foam and steam after the crash
  if (s.crash > 0) {
    for (let i = 0; i < 26; i++) {
      const fx = tip.x - 40 + i * (L * 3.4 / 26), fy = surf(fx) - 4 - Math.abs(Math.sin(time * 6 + i)) * 10 * (1 - s.foam);
      ctx.fillStyle = i % 3 ? '#fff0b8' : '#ffc86a';
      ctx.beginPath(); ctx.arc(fx, fy, 5 + (i * 7) % 9 + s.crash * 6, 0, TAU); ctx.fill();
    }
    if (s.foam > 0) for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = (1 - s.foam) * .5; ctx.fillStyle = i % 2 ? '#9a7771' : '#6d5a5a';
      ctx.beginPath(); ctx.arc(X + (i - 3) * 38, cy - s.foam * 120 - i * 9, 20 + s.foam * 30, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawHazards() {
  for (const h of hazards) {
    if (h.warning > 0) {
      ctx.strokeStyle = '#ffda65'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x, surf(h.x)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffe795'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('!', h.x - 4, surf(h.x) - 45); continue;
    }
    poly([[h.x - h.r, h.y], [h.x - h.vx * .16, h.y - h.vy * .16], [h.x + h.r, h.y]], '#ff6439');
    ctx.fillStyle = h.meteor ? '#492e29' : '#ffb338'; ctx.strokeStyle = '#ff9a3b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill(); ctx.stroke();
    if (h.meteor) { ctx.fillStyle = '#ffa94b'; ctx.fillRect(h.x - 7, h.y - 5, 6, 4); ctx.fillRect(h.x + 3, h.y + 3, 4, 5) }
  }
}

function drawEffects() {
  for (const f of sparks) {
    ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.fillStyle = f.color;
    if (f.diamond) poly([[f.x, f.y - f.size], [f.x + f.size * .7, f.y], [f.x, f.y + f.size], [f.x - f.size * .7, f.y]], f.color);
    else ctx.fillRect(f.x, f.y, f.size, f.size);
  }
  for (const r of rings) { ctx.globalAlpha = r.life / r.max; ctx.strokeStyle = r.color; ctx.lineWidth = r.width; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke() }
  ctx.globalAlpha = 1;
}

function drawBoard(p, alpha) {
  ctx.fillStyle = p.diamond ? '#a9ffff' : '#ffdd83';
  ctx.beginPath(); ctx.ellipse(0, 8, 29, Math.max(2, p.board / 16), 0, 0, TAU); ctx.fill();
  if (alpha) return;
  ctx.strokeStyle = '#5c2f25'; ctx.lineWidth = 2; ctx.stroke();
  if (p.diamond) for (let k = -2; k <= 2; k++) poly([[k * 10 - 5, 8], [k * 10, 3], [k * 10 + 5, 8], [k * 10, 13]], '#36aebd');
}

function drawPlayer(p) {
  // Afterimages during tricks
  if (p.trail.length > 1 && p.board > 0) {
    p.trail.forEach((t, i) => {
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(1.5, 1.5); ctx.rotate(t.angle);
      if (t.twist) { const c = Math.cos(t.twist); ctx.scale((c >= 0 ? 1 : -1) * Math.max(.12, Math.abs(c)), 1) }
      ctx.globalAlpha = (i / p.trail.length) * (p.autoTrick ? .4 : .18);
      ctx.fillStyle = p.diamond ? '#9fffff' : '#ff9a3a';
      ctx.beginPath(); ctx.ellipse(0, 8, 29, 5, 0, 0, TAU); ctx.fill();
      ctx.fillRect(-4, -30, 8, 30);
      ctx.restore();
    });
  }
  ctx.save(); ctx.translate(p.x, p.y);
  if (!p.alive) { ctx.fillStyle = p.color; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TASTE → NEUAUFBAU', 0, -65); ctx.globalAlpha = .45 }
  if (p.shield > 0 && !p.autoTrick) { ctx.strokeStyle = '#fff5bd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -25, 48, 0, TAU); ctx.stroke() }
  if (p.combo > 1 && live(p)) { ctx.fillStyle = '#ffd56a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('COMBO ×' + p.combo, 0, p.air ? 34 : -72) }
  ctx.scale(1.5, 1.5); ctx.rotate(p.board ? p.angle : 0);
  if (p.twist) { const c = Math.cos(p.twist); ctx.scale((c >= 0 ? 1 : -1) * Math.max(.12, Math.abs(c)), 1) }
  ctx.shadowColor = p.autoTrick ? (p.diamond ? '#8fffff' : '#ff8a35') : '#171310'; ctx.shadowBlur = p.autoTrick ? 18 : 4;
  if (p.board) drawBoard(p);
  ctx.fillStyle = '#777b7a'; ctx.fillRect(-19, 8, 10, 8); ctx.fillRect(9, 8, 10, 8);
  if (activeDrive(p, 'rocket')) { ctx.fillStyle = '#73898d'; ctx.fillRect(-35, -4, 19, 13); poly([[-35, -2], [-78 - Math.sin(time * 40) * 12, 3], [-35, 8]], '#ff943d'); poly([[-35, 0], [-60, 3], [-35, 5]], '#fff2aa') }
  if (activeDrive(p, 'turbo') || !running && !players.length) { poly([[-18, 16], [-13, 38 + Math.sin(time * 30) * 8], [-9, 16]], '#63e6df'); poly([[9, 16], [14, 38 + Math.cos(time * 30) * 8], [19, 16]], '#63e6df') }
  if (attacking(p)) {
    if (p.diamond) { poly([[15, -16], [62, 0], [15, 16]], '#9cffff'); ctx.strokeStyle = '#2391a5'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(20 + k * 9, -12 + k * 3); ctx.lineTo(24 + k * 9, 10 - k * 2); ctx.stroke() } }
    else { ctx.fillStyle = '#ffe2b7'; ctx.fillRect(18, -40, 18, 15); ctx.fillRect(-36, -33, 18, 15) }
    ctx.strokeStyle = p.diamond ? '#89ffff' : '#ffe2b7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -16, p.diamond ? 65 : 50, 0, TAU); ctx.stroke();
  }
  // Rider
  if (p.tumble > 0) { ctx.translate(0, -10); ctx.rotate(p.tumble * 9); ctx.translate(0, 10) }
  ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const crouch = p.grabbing || p.autoTrick;
  if (crouch) {
    ctx.moveTo(-11, 3); ctx.lineTo(-6, -6); ctx.lineTo(6, -4); ctx.lineTo(14, 3);
    ctx.moveTo(-6, -6); ctx.lineTo(-2, -20);
    ctx.moveTo(-2, -20); ctx.lineTo(9, -9); ctx.lineTo(16, 5);
    ctx.moveTo(-2, -19); ctx.lineTo(-14, -16); ctx.lineTo(-22, -24);
  } else {
    ctx.moveTo(-11, 2); ctx.lineTo(-4, -12); ctx.lineTo(8, -4); ctx.lineTo(17, 3);
    ctx.moveTo(-4, -12); ctx.lineTo(0, -29); ctx.lineTo(12, -20); ctx.lineTo(22, -24);
    ctx.moveTo(0, -28); ctx.lineTo(-13, -20); ctx.lineTo(-21, -22);
  }
  ctx.stroke();
  const hy = crouch ? -29 : -39, hx = crouch ? -1 : 1;
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#322526'; ctx.fillRect(hx - 1, hy - 3, 9, 3);
  ctx.restore();
}

function drawPopups(z) {
  for (const p of popups) {
    const a = Math.min(1, p.life / p.max * 2.5);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(p.size / Math.max(.55, z))}px 'Barlow Condensed', Impact, sans-serif`;
    const y = Math.max(p.y, cam.y + (p.size + 8) / Math.max(.55, z));
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a100b'; ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';
}

function drawGoal() {
  const goal = finish;
  if (goal > cam.x + canvas.clientWidth / cam.zoom + 150) return;
  poly([[goal - 20, 300], [goal + 15, 210], [goal + 170, 200], [goal + 230, 370], [goal - 20, 370]], '#40352b');
  ctx.fillStyle = '#ffe8bc'; ctx.fillRect(goal + 30, 140, 3, 100);
  poly([[goal + 33, 140], [goal + 85, 155], [goal + 33, 173]], '#64e0d7');
}

function draw(dt) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  updateCamera(dt);
  const z = cam.zoom;
  cam.x = cam.cx - w / (2 * z); cam.y = cam.cy - VIEW_H / (2 * z);
  ctx.save(); ctx.scale(1, h / VIEW_H);
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#231922'); sky.addColorStop(.7, '#78372c'); sky.addColorStop(1, '#ed6b2a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, VIEW_H);
  ctx.fillStyle = '#fa9c58'; ctx.beginPath(); ctx.arc(w * .76 - cam.x * .018 % w, 108, 44, 0, TAU); ctx.fill();
  for (let i = -1; i < Math.ceil(w / 230) + 2; i++) {
    const x = i * 230 - ((cam.x * .13 % 230) + 230) % 230;
    poly([[x, 265], [x + 70, 115 + (((i % 3) + 3) % 3) * 28], [x + 100, 146], [x + 125, 127], [x + 230, 270]], '#39262b');
    poly([[x + 70, 115 + (((i % 3) + 3) % 3) * 28], [x + 100, 146], [x + 125, 127], [x + 108, 185]], '#97422c');
  }
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake * 18, (Math.random() - .5) * shake * 14);
  ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const left = cam.x - 20, right = cam.x + w / z + 20, bottom = cam.y + VIEW_H / z + 60;
  drawLava(left, right, bottom, z);
  for (let i = 0; i < 45; i++) {
    const x = cam.x + ((i * 97 - cam.x * .5) % w + w) % w / z, y = cam.y + (VIEW_H - ((time * 22 + i * 39) % 250)) / z;
    ctx.fillStyle = i % 2 ? '#ffad4a' : '#d96c3a'; ctx.fillRect(x, Math.max(y, surf(x) + 20), 2, 3);
  }
  drawGoal();
  giants.forEach(drawGiant);
  drawHazards();
  drawEffects();
  const shown = players.length ? players : [{ x: w * .67, y: surf(w * .67) - 15, angle: Math.atan(slopeAt(w * .67)), board: 85, color: '#fff0cb', alive: true, fuel: 100, trail: [], twist: 0 }];
  shown.forEach(drawPlayer);
  drawPopups(z);
  ctx.restore();
  // Screen-space overlays
  for (const g of giants) {
    const s = giantState(g, time);
    if (g.breakT === null && s.X > cam.x + w / z - 30 && Math.sin(time * 10) > -.3) {
      ctx.fillStyle = '#fff0b8'; ctx.font = "900 18px 'Barlow Condensed', Impact, sans-serif"; ctx.textAlign = 'right';
      ctx.fillText('MONSTERWELLE ›››', w - 14, 70); ctx.textAlign = 'start';
    }
  }
  if (slowmo > 0) { ctx.fillStyle = 'rgba(140,255,255,.08)'; ctx.fillRect(0, 0, w, VIEW_H) }
  if (flash > 0) { ctx.globalAlpha = Math.min(.6, flash); ctx.fillStyle = flashColor; ctx.fillRect(0, 0, w, VIEW_H); ctx.globalAlpha = 1 }
  ctx.restore();
  updateHud();
}

function updateHud() {
  $('#hud').innerHTML = players.map((p, i) => {
    const status = p.done ? 'IM ZIEL' : !p.alive ? 'TASTE: NEUAUFBAU' : p.diamond ? 'DIAMANT ∞' : p.board ? 'BRETT ' + Math.ceil(p.board) + '%' : 'DÜSENFLUG';
    const trick = p.autoTrick ? '★ ' + p.autoTrick.name : p.bonus > 0 ? '· TRICK-BONUS!' : '';
    return `<div class="playerhud" style="color:${p.color}">P${i + 1} · ${status} · ${p.score.toLocaleString('de-DE')} PKT${p.combo > 1 ? ' · COMBO ×' + p.combo : ''}
      <div class="bar"><i style="width:${p.board}%"></i></div>TEMPO ${Math.round(p.v)} · ${p.tricks} LOOPS · ${p.smashes} TREFFER ${trick}<br>
      TURBO ${p.diamond ? '∞' : Math.ceil(p.fuel) + ' / 150'} ${activeDrive(p, 'rocket') ? '· HECKANTRIEB' : ''}
      <div class="bar"><i style="width:${p.diamond ? 100 : p.fuel / 150 * 100}%;background:#64e0d7"></i></div></div>`;
  }).join('');
  $('#finish').textContent = 'FINISH · ' + finish.toLocaleString('de-DE') + ' m';
  $('#distance').textContent = `${Math.min(finish, Math.floor(Math.max(0, ...players.map(p => p.x)))).toLocaleString('de-DE')} / ${finish.toLocaleString('de-DE')} m`;
  const text = !running && !players.length ? 'BEREIT FÜR DEN RITT?' : paused ? 'PAUSE · P ODER WEITER' : running ? statusText() : 'RUN BEENDET';
  if (text !== shownState) { $('#state').textContent = text; shownState = text }
}

function frame(now) {
  const dt = Math.min(.035, (now - last) / 1000 || 0); last = now;
  shake = Math.max(0, shake - dt * 1.6); flash = Math.max(0, flash - dt * 1.5);
  if (running && !paused) {
    let scale = 1;
    if (slowmo > 0) { slowmo -= dt; scale = .4 }
    const steps = Math.ceil(dt * scale / (1 / 120)) || 1;
    for (let i = 0; i < steps && running; i++) update(dt * scale / steps);
  } else if (!players.length) time += dt;
  draw(dt);
  requestAnimationFrame(frame);
}
setRunUi(false); $('#pauseBtn').disabled = true; startBtn.textContent = 'AB AUF DIE LAVA ↗';
requestAnimationFrame(frame);
