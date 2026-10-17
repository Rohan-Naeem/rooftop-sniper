/* ==========================================================
   ROOFTOP SNIPER - game code
   Everything is drawn with code. No image files needed.
   Sections: 1 Settings, 2 Map drawing, 3 Characters (targets),
             4 Game logic, 5 Drawing each frame, 6 Sound, 7 Buttons
   ========================================================== */
(function () {
  'use strict';

  var W = 960, H = 540;
  var FONT = '"Nunito","Trebuchet MS","Segoe UI",Arial,sans-serif';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  function $(id) { return document.getElementById(id); }

  /* ---------- 1. SETTINGS (change these to tune the game) ---------- */
  var MAPS = {
    night: {
      name: 'Night City', seed: 7,
      sky: ['#0a1230', '#2b3d78'], far: '#121a38',
      near: ['#1a2342', '#222c52', '#171e3a'],
      decor: 0.35, decorColor: '#ffd36b',
      orb: '#e8eefc', orbX: 790, orbY: 80, stars: true, ground: '#090d1b'
    },
    desert: {
      name: 'Desert Town', seed: 21,
      sky: ['#f08a4b', '#fcdca3'], far: '#c27a52',
      near: ['#d9a273', '#c98e62', '#e2b283'],
      decor: 0.15, decorColor: '#7a4a32',
      orb: '#fff3c4', orbX: 190, orbY: 90, stars: false, ground: '#8a5a3c'
    }
  };

  // time = seconds, clip = bullets, life = seconds a target stays,
  // spawn = seconds between targets, maxAlive = targets at once,
  // civ = chance a target is a civilian, sway = scope shake in pixels,
  // lens = scope size, dark = how dark it is outside the scope
  var DIFFS = {
    easy:   { time: 60, clip: 10, life: 2.3, spawn: 1.1,  maxAlive: 2, civ: 0.15, sway: 0, lens: 125, dark: 0.60 },
    medium: { time: 50, clip: 8,  life: 1.7, spawn: 0.85, maxAlive: 3, civ: 0.25, sway: 3, lens: 108, dark: 0.78 },
    hard:   { time: 40, clip: 6,  life: 1.2, spawn: 0.65, maxAlive: 4, civ: 0.35, sway: 6, lens: 92,  dark: 0.88 }
  };

  var SHIRTS = ['#3fa66b', '#4c8bf5', '#c065d8', '#e08a3c', '#2fb7c4'];
  var SKINS = ['#e4b08a', '#c68642', '#8d5524', '#f1c27d'];
  var WIN_W = 44, WIN_H = 58;

  /* ---------- State ---------- */
  var mapKey = 'night', diffKey = 'medium', modeKey = 'timed', sideKey = 'left', limitKey = 60;
  var state = 'idle';            // idle | play | over
  var G = null;                  // data of the current round
  var built = {};                // pre-drawn maps
  var mx = W / 2, my = H / 2;    // mouse position
  var aimX = W / 2, aimY = H / 2;
  var scene = 'landing', walkX = 0;   // landing | leaving | menu
  var helpOpen = false, reloadShown = false;
  var isTouch = ('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var t = 0, kick = 0, flash = 0, redFlash = 0, muted = false;

  /* ---------- 2. MAP DRAWING ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var a = Math.imul(seed ^ seed >>> 15, 1 | seed);
      a = a + Math.imul(a ^ a >>> 7, 61 | a) ^ a;
      return ((a ^ a >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildMap(m) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var r = rng(m.seed), spots = [], i;

    var sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, m.sky[0]); sky.addColorStop(1, m.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    if (m.stars) {
      g.fillStyle = '#fff';
      for (i = 0; i < 70; i++) {
        g.globalAlpha = 0.3 + r() * 0.7;
        g.fillRect(r() * W, r() * H * 0.45, 1.5, 1.5);
      }
      g.globalAlpha = 1;
    }
    g.fillStyle = m.orb;
    g.beginPath(); g.arc(m.orbX, m.orbY, 34, 0, Math.PI * 2); g.fill();

    // far buildings
    g.fillStyle = m.far;
    var x = -10;
    while (x < W) {
      var fw = 50 + r() * 60, fh = 120 + r() * 160;
      g.fillRect(x, H - fh - 60, fw, fh + 60);
      x += fw + 4;
    }

    // near buildings with windows (windows = places where targets appear)
    var bw = W / 5;
    for (var b = 0; b < 5; b++) {
      var bx = b * bw + 8, w = bw - 16, top = 120 + Math.floor(r() * 70);
      g.fillStyle = m.near[b % 3];
      g.fillRect(bx, top, w, H - top);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(bx - 3, top - 8, w + 6, 8);
      if (r() < 0.5) g.fillRect(bx + 20 + r() * (w - 40), top - 30, 3, 22);

      for (var row = 0; ; row++) {
        var wy = top + 26 + row * 82;
        if (wy + WIN_H > H - 56) break;
        for (var col = 0; col < 3; col++) {
          var wx = bx + 11 + col * 55;
          spots.push({ x: wx, y: wy, w: WIN_W, h: WIN_H });
          g.fillStyle = '#0b0d14'; g.fillRect(wx, wy, WIN_W, WIN_H);
          if (r() < m.decor) {
            g.fillStyle = m.decorColor; g.fillRect(wx + 3, wy + 3, WIN_W - 6, WIN_H - 6);
            g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(wx + WIN_W / 2 - 1, wy + 3, 2, WIN_H - 6);
          }
          g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(wx, wy, WIN_W, WIN_H);
          g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(wx - 3, wy + WIN_H, WIN_W + 6, 4);
        }
      }
    }
    g.fillStyle = m.ground; g.fillRect(0, H - 50, W, 50);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, H - 50, W, 5);
    return { img: c, spots: spots };
  }

  // Sunset skyline used behind the start screen and the menu steps
  function buildLanding() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), r = rng(99), i, base = H - 62;
    var sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a0d3a'); sky.addColorStop(0.45, '#52206b');
    sky.addColorStop(0.75, '#d63a73'); sky.addColorStop(1, '#ff9a4d');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    for (i = 0; i < 60; i++) { g.globalAlpha = 0.2 + r() * 0.6; g.fillRect(r() * W, r() * H * 0.4, 1.6, 1.6); }
    g.globalAlpha = 1;
    var glow = g.createRadialGradient(560, 360, 20, 560, 360, 230);
    glow.addColorStop(0, 'rgba(255,214,120,.95)'); glow.addColorStop(0.35, 'rgba(255,170,90,.45)');
    glow.addColorStop(1, 'rgba(255,140,80,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(560, 360, 70, 0, Math.PI * 2); g.fill();
    [['#4a1f66', 60, 170, 0], ['#25103f', 80, 210, 0.45]].forEach(function (L) {
      var x = -20;
      while (x < W) {
        var bw = 40 + r() * 70, bh = L[1] + r() * (L[2] - L[1]), wy, wx;
        g.fillStyle = L[0]; g.fillRect(x, base - bh, bw, bh + 10);
        if (L[3] > 0) {
          g.fillStyle = '#ffc86b';
          for (wy = base - bh + 10; wy < base - 12; wy += 16)
            for (wx = x + 6; wx < x + bw - 8; wx += 12) if (r() < L[3] * 0.5) g.fillRect(wx, wy, 5, 7);
        }
        x += bw + 2;
      }
    });
    g.fillStyle = '#12082a'; g.fillRect(0, base, W, H - base);
    g.fillStyle = '#3a1d62'; g.fillRect(0, base, W, 6);
    return c;
  }

  /* ---------- 3. CHARACTERS (drawn at 0,0 inside a 44 x 58 window) ---------- */
  function drawThief() {
    ctx.fillStyle = '#f1f1f1'; ctx.fillRect(6, 34, 32, 24);
    ctx.fillStyle = '#16181d';
    for (var y = 37; y < 58; y += 6) ctx.fillRect(6, y, 32, 2.5);
    ctx.fillStyle = '#8a6a2f'; ctx.fillRect(30, 40, 13, 15);
    ctx.fillStyle = '#f0cf6a'; ctx.font = 'bold 10px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('$', 36.5, 51);
    ctx.fillStyle = '#e4b08a'; ctx.beginPath(); ctx.arc(22, 24, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1c22'; ctx.beginPath(); ctx.arc(22, 22, 10.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(12, 22, 20, 6);
    ctx.fillStyle = '#fff'; ctx.fillRect(15, 23.5, 4, 2.5); ctx.fillRect(25, 23.5, 4, 2.5);
  }

  function drawCivilian(o) {
    ctx.fillStyle = o.shirt; ctx.fillRect(6, 34, 32, 24);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(20, 34, 4, 24);
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(22, 24, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(22, 21, 10.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(22, 19, 16, 3);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(18, 25, 1.4, 0, Math.PI * 2); ctx.arc(26, 25, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b3a2a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(22, 27.5, 4, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  /* ---------- 4. GAME LOGIC ---------- */
  var RISE = 0.18, FALL = 0.45;

  function offsetOf(o) {
    var s = o.s, full = s.h + 4;
    if (o.state === 'hit') {
      var f = Math.min(1, o.fall / FALL);
      return o.off0 + (full - o.off0) * f * f;
    }
    var p = 1;
    if (o.age < RISE) p = o.age / RISE;
    else if (o.life - o.age < RISE) p = (o.life - o.age) / RISE;
    p = Math.max(0, Math.min(1, p));
    return (1 - p * p * (3 - 2 * p)) * full;
  }

  function testHit(o, x, y) {
    var s = o.s;
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return 0;
    var off = offsetOf(o), hx = s.x + 22, hy = s.y + off + 24;
    if ((x - hx) * (x - hx) + (y - hy) * (y - hy) <= 144) return 2;          // head
    if (x >= s.x + 6 && x <= s.x + 38 && y >= s.y + off + 34 && y <= s.y + off + 58) return 1; // body
    return 0;
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function multiplier() { return Math.min(3, 1 + Math.floor(Math.max(0, G.combo - 1) / 3) * 0.5); }

  function addText(x, y, s, c) { G.texts.push({ x: x, y: y, s: s, c: c, t: 0 }); }

  function startGame() {
    audio();
    var d = DIFFS[diffKey];
    G = { d: d, time: limitKey, limit: limitKey, score: 0, shots: 0, thieves: 0, heads: 0, civs: 0, combo: 0,
          ammo: d.clip, reload: 0, spawn: 0.5, elapsed: 0, targets: [], texts: [], puffs: [],
          mode: modeKey, lives: 3, trace: null };
    state = 'play';
    show(null);
    canvas.classList.add('playing');
    openHelp();
  }

  function fmt(sec) { return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }

  // windows hidden behind the sniper are not used for targets
  function blocked(s) {
    if (s.y + s.h <= 430) return false;
    return sideKey === 'left' ? s.x < 120 : s.x + s.w > W - 120;
  }

  function spawnTarget() {
    var d = G.d, endless = G.mode === 'endless';
    var hard = endless ? Math.min(1, G.elapsed / 120) : 0;   // endless: gets harder for 2 minutes
    G.spawn = d.spawn * (1 - 0.4 * hard) * (0.8 + Math.random() * 0.4);
    var alive = 0, i;
    for (i = 0; i < G.targets.length; i++) if (G.targets[i].state === 'up') alive++;
    if (alive >= d.maxAlive + Math.floor(hard * 2)) return;
    var free = built[mapKey].spots.filter(function (s) {
      return !blocked(s) && !G.targets.some(function (o) { return o.s === s; });
    });
    if (!free.length) return;
    var ramp = endless ? 1 - 0.45 * hard : 1 - 0.3 * (G.elapsed / G.limit);
    G.targets.push({
      s: pick(free), kind: Math.random() < d.civ + 0.15 * hard ? 'civ' : 'thief',
      age: 0, life: d.life * ramp * (0.85 + Math.random() * 0.3),
      state: 'up', fall: 0, off0: 0, shirt: pick(SHIRTS), skin: pick(SKINS)
    });
  }

  function computeAim() {
    var s = (state === 'play' && G) ? G.d.sway : 0;
    aimX = mx + (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 2.9 + 1)) * s;
    aimY = my + (Math.cos(t * 1.3) + 0.5 * Math.cos(t * 2.3 + 2)) * s;
  }

  function startReload() {
    if (!G || G.reload > 0 || G.ammo === G.d.clip) return;
    G.reload = 1.2; sfx('reload');
  }

  function shoot() {
    if (state !== 'play' || G.reload > 0) return;
    if (G.ammo <= 0) { startReload(); return; }
    G.ammo--; G.shots++; kick = 1; flash = 1; sfx('shot');
    G.trace = { x0: muzzle.x, y0: muzzle.y, x1: aimX, y1: aimY, t: 0 };

    var hit = null, part = 0, i;
    for (i = G.targets.length - 1; i >= 0; i--) {
      var o = G.targets[i];
      if (o.state !== 'up') continue;
      part = testHit(o, aimX, aimY);
      if (part) { hit = o; break; }
    }
    if (hit) {
      hit.off0 = offsetOf(hit); hit.state = 'hit'; hit.fall = 0;
      var cx = hit.s.x + 22, cy = hit.s.y - 6;
      if (hit.kind === 'thief') {
        G.thieves++; G.combo++;
        if (part === 2) G.heads++;
        var pts = Math.round((part === 2 ? 200 : 100) * multiplier());
        G.score += pts;
        addText(cx, cy, (part === 2 ? 'Headshot +' : '+') + pts, part === 2 ? '#f2b134' : '#ffffff');
        sfx('hit');
      } else {
        G.civs++; G.combo = 0; G.score = Math.max(0, G.score - 150); redFlash = 1;
        if (G.mode === 'endless') G.lives--; else G.time -= 4;
        addText(cx, cy, 'Civilian -150', '#ff6b70');
        sfx('bad');
      }
    } else {
      G.puffs.push({ x: aimX, y: aimY, t: 0 });
    }
    if (G.mode === 'endless' && G.lives <= 0) { endGame(); return; }
    if (G.ammo === 0) startReload();
  }

  function endGame() {
    state = 'over';
    G.trace = null;
    canvas.classList.remove('playing');
    var key = 'rooftop_best_' + mapKey + '_' + diffKey + (G.mode === 'endless' ? '_endless' : '_t' + G.limit), best = 0;
    try { best = parseInt(localStorage.getItem(key), 10) || 0; } catch (e) {}
    if (G.score > best) { best = G.score; try { localStorage.setItem(key, String(best)); } catch (e) {} }
    var s = G.score;
    var k = G.mode === 'endless' ? 2 : 1;
    $('oRank').textContent = s < 400 * k ? 'Rank: Rookie' : s < 1200 * k ? 'Rank: Marksman' : s < 2500 * k ? 'Rank: Sharpshooter' : 'Rank: Legend';
    $('oTitle').textContent = G.mode === 'endless' ? 'Game over' : 'Time is up';
    $('oSurvLi').classList.toggle('hidden', G.mode !== 'endless');
    $('oSurv').textContent = fmt(Math.floor(G.elapsed));
    $('oScore').textContent = s;
    $('oBest').textContent = best;
    $('oThieves').textContent = G.thieves;
    $('oHeads').textContent = G.heads;
    $('oAcc').textContent = (G.shots ? Math.round(G.thieves / G.shots * 100) : 0) + '%';
    $('oCivs').textContent = G.civs;
    show('over');
  }

  function update(dt) {
    t += dt;
    kick = Math.max(0, kick - dt * 6);
    flash = Math.max(0, flash - dt * 9);
    redFlash = Math.max(0, redFlash - dt * 2.5);
    computeAim();
    var wantReload = isTouch && state === 'play' && !helpOpen;
    if (wantReload !== reloadShown) { reloadShown = wantReload; $('reloadBtn').classList.toggle('hidden', !wantReload); }
    if (scene === 'leaving') {
      walkX += 300 * dt;
      if (walkX > W + 140) { scene = 'menu'; openWizard(0); checkOrientation(); }
    }
    if (state !== 'play' || helpOpen) return;

    G.elapsed += dt;
    if (G.mode === 'timed') {
      G.time -= dt;
      if (G.time <= 0) { G.time = 0; endGame(); return; }
    }

    if (G.reload > 0) {
      G.reload -= dt;
      if (G.reload <= 0) { G.reload = 0; G.ammo = G.d.clip; sfx('ready'); }
    }
    G.spawn -= dt;
    if (G.spawn <= 0) spawnTarget();

    G.targets.forEach(function (o) {
      if (o.state === 'up') {
        o.age += dt;
        if (o.age >= o.life) {
          o.state = 'gone';
          if (o.kind === 'thief') {
            G.combo = 0; addText(o.s.x + 22, o.s.y + 10, 'Escaped', '#b6bfcc');
          }
        }
      } else if (o.state === 'hit') {
        o.fall += dt;
        if (o.fall > FALL) o.state = 'gone';
      }
    });
    G.targets = G.targets.filter(function (o) { return o.state !== 'gone'; });
    if (G.mode === 'endless' && G.lives <= 0) { endGame(); return; }

    G.texts.forEach(function (x) { x.t += dt; x.y -= 32 * dt; });
    G.texts = G.texts.filter(function (x) { return x.t < 1.1; });
    G.puffs.forEach(function (p) { p.t += dt; });
    G.puffs = G.puffs.filter(function (p) { return p.t < 0.4; });
    if (G.trace) { G.trace.t += dt; if (G.trace.t > 0.1) G.trace = null; }
  }

  /* ---------- 5. DRAWING EACH FRAME ---------- */
  function drawTarget(o) {
    var s = o.s;
    ctx.save();
    ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.translate(s.x, s.y + offsetOf(o));
    if (o.kind === 'thief') drawThief(); else drawCivilian(o);
    if (o.state === 'hit' && o.fall < 0.15) {
      ctx.fillStyle = 'rgba(229,72,77,.55)'; ctx.fillRect(0, 0, WIN_W, WIN_H);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3; ctx.strokeRect(s.x, s.y, s.w, s.h);
  }

  function drawScope() {
    var R = G.d.lens, x = aimX, y = aimY - kick * 10, i;
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,10,' + G.d.dark + ')';
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.moveTo(x + R, y); ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.restore();

    ctx.strokeStyle = '#05070c'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - R + 6, y); ctx.lineTo(x - 10, y);
    ctx.moveTo(x + 10, y); ctx.lineTo(x + R - 6, y);
    ctx.moveTo(x, y - R + 6); ctx.lineTo(x, y - 10);
    ctx.moveTo(x, y + 10); ctx.lineTo(x, y + R - 6);
    for (i = 1; i <= 3; i++) { ctx.moveTo(x - 4, y + i * 16); ctx.lineTo(x + 4, y + i * 16); }
    ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();

    ctx.fillStyle = '#e5484d';
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  function label(txt, x, y, size, color, align) {
    ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align || 'left';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(txt, x, y);
    ctx.fillStyle = color; ctx.fillText(txt, x, y);
  }

  function drawHUD() {
    var d = G.d, secs = Math.ceil(G.time), i;
    label('Score ' + G.score, 16, 32, 22, '#ffffff');
    var m = multiplier();
    if (G.combo > 0 && m > 1) label('Combo x' + m, 16, 56, 16, '#f2b134');
    if (G.mode === 'timed') {
      label(fmt(secs), W / 2, 34, 26, secs <= 10 ? '#ff6b70' : '#ffffff', 'center');
    } else {
      label(fmt(Math.floor(G.elapsed)), W / 2, 34, 26, '#ffffff', 'center');
      for (i = 0; i < 3; i++) heart(W / 2 - 30 + i * 30, 56, 9, i < G.lives ? '#e5484d' : 'rgba(255,255,255,.22)');
    }
    for (i = 0; i < d.clip; i++) {
      ctx.fillStyle = i < G.ammo ? '#f2b134' : 'rgba(255,255,255,.2)';
      ctx.fillRect(W - 18 - (d.clip - i) * 15, 18, 7, 18);
    }
    if (G.reload > 0) label('Reloading...', W - 16, 62, 16, '#ffffff', 'right');
  }

  var muzzle = { x: 0, y: 0 };

  function heart(x, y, sz, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y + sz * 0.8);
    ctx.bezierCurveTo(x - sz * 1.5, y - sz * 0.1, x - sz * 0.7, y - sz * 1.1, x, y - sz * 0.4);
    ctx.bezierCurveTo(x + sz * 0.7, y - sz * 1.1, x + sz * 1.5, y - sz * 0.1, x, y + sz * 0.8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Draws the sniper. px,py = feet, sc = size, dir = 1 faces right / -1 faces left,
  // ang = rifle angle, walking = legs move
  function drawSniper(px, py, sc, dir, ang, walking) {
    var bob = Math.sin(t * 1.6) * 1.4 - (walking ? Math.abs(Math.sin(t * 12)) * 2.5 : 0);
    var rec = kick * 6, swing = walking ? Math.sin(t * 12) * 0.55 : 0;
    function leg(x, a) {
      ctx.save(); ctx.translate(x, -44); ctx.rotate(a);
      ctx.fillStyle = '#2b2f3a'; ctx.fillRect(-4, 0, 8, 38);
      ctx.fillStyle = '#14161c'; ctx.fillRect(-6, 38, 13, 6);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(px, py); ctx.scale(dir * sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, -1, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    leg(-5, swing); leg(6, -swing);
    // body, backpack, head, cap
    ctx.save(); ctx.translate(-kick * 2, bob * 0.5);
    ctx.fillStyle = '#3a4630'; ctx.fillRect(-21, -74, 10, 28);
    ctx.fillStyle = '#4a5a3a';
    ctx.beginPath(); ctx.moveTo(-12, -44); ctx.lineTo(12, -44); ctx.lineTo(13, -76); ctx.lineTo(-10, -78); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e4b08a'; ctx.beginPath(); ctx.arc(5, -88, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2027'; ctx.beginPath(); ctx.arc(5, -90, 9.5, Math.PI, 0); ctx.fill(); ctx.fillRect(4, -91, 13, 3);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(9.5, -86.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // rifle and arms
    ctx.save(); ctx.translate(6, -72 + bob); ctx.rotate(ang); ctx.translate(-rec, 0);
    ctx.fillStyle = '#5b4330'; ctx.fillRect(-22, -4, 24, 9);
    ctx.fillStyle = '#2a2d34'; ctx.fillRect(2, -5, 40, 8);
    ctx.fillStyle = '#16181d'; ctx.fillRect(42, -3, 52, 4);
    ctx.fillStyle = '#0f1116'; ctx.fillRect(10, -12, 26, 6); ctx.fillRect(14, -7, 3, 3);
    ctx.fillStyle = '#4a5a3a'; ctx.fillRect(2, 4, 32, 7); ctx.fillRect(-12, 3, 14, 7);
    ctx.fillStyle = '#e4b08a';
    ctx.beginPath(); ctx.arc(36, 7, 4.5, 0, Math.PI * 2); ctx.arc(-12, 7, 4, 0, Math.PI * 2); ctx.fill();
    if (flash > 0.55) {
      ctx.fillStyle = 'rgba(255,220,120,.95)';
      ctx.beginPath(); ctx.moveTo(94, -1); ctx.lineTo(114, -9); ctx.lineTo(106, -1); ctx.lineTo(114, 7); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  // In the game the sniper stands on the left and aims where the scope is
  function drawPlayer() {
    var px = 72, py = H - 6;
    var sx = px + 6, sy = py - 72 + Math.sin(t * 1.6) * 1.4;
    var ang = Math.atan2(aimY - sy, Math.max(aimX - sx, 60));
    ang = Math.max(-1.1, Math.min(0.45, ang));
    ang += Math.sin(t * 1.3) * 0.012 - kick * 0.05;
    drawSniper(px, py, 1, 1, ang, false);
    var lx = 94 - kick * 6;                       // bullet leaves the barrel here (tracer line)
    muzzle.x = sx + lx * Math.cos(ang);
    muzzle.y = sy + lx * Math.sin(ang);
  }

  // Start screen: sniper just stands on the right. After Start he turns and walks away.
  function drawIdleScene() {
    ctx.drawImage(built.landing, 0, 0);
    if (scene === 'landing') drawSniper(W - 190, H - 62, 1.7, -1, -0.95, false);
    else if (scene === 'leaving') drawSniper(walkX, H - 62, 1.7, 1, -0.5, true);
  }

  function drawTrace() {
    var tr = G.trace;
    if (!tr) return;
    ctx.strokeStyle = 'rgba(255,235,170,' + (1 - tr.t / 0.1) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (state === 'idle') { drawIdleScene(); return; }
    ctx.drawImage(built[mapKey].img, 0, 0);
    if (G) {
      G.targets.forEach(drawTarget);
      G.puffs.forEach(function (p) {
        ctx.fillStyle = 'rgba(220,210,190,' + (0.6 * (1 - p.t / 0.4)) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + p.t * 40, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (state === 'play') drawScope();
    if (G && G.trace) drawTrace();
    drawPlayer();
    if (state === 'play') {
      G.texts.forEach(function (x) {
        ctx.globalAlpha = Math.max(0, 1 - x.t / 1.1);
        label(x.s, x.x, x.y, 18, x.c, 'center');
      });
      ctx.globalAlpha = 1;
      drawHUD();
      if (flash > 0) { ctx.fillStyle = 'rgba(255,240,200,' + flash * 0.25 + ')'; ctx.fillRect(0, 0, W, H); }
      if (redFlash > 0) { ctx.fillStyle = 'rgba(229,72,77,' + redFlash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
    }
  }

  /* ---------- 6. SOUND (made with code, no files) ---------- */
  var AC = null;
  function audio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function tone(f1, f2, dur, type, vol) {
    if (!AC || muted) return;
    var o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f1, n); o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), n + dur);
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(n + dur);
  }
  function noise(dur, vol) {
    if (!AC || muted) return;
    var len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0), i;
    for (i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = AC.createBufferSource(), g = AC.createGain();
    s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(AC.destination); s.start();
  }
  function sfx(name) {
    if (name === 'shot') { noise(0.18, 0.5); tone(180, 40, 0.2, 'sawtooth', 0.3); }
    else if (name === 'hit') tone(520, 880, 0.12, 'square', 0.12);
    else if (name === 'bad') tone(160, 70, 0.35, 'sawtooth', 0.25);
    else if (name === 'reload') tone(300, 200, 0.08, 'square', 0.1);
    else if (name === 'ready') tone(500, 700, 0.08, 'square', 0.1);
  }

  /* ---------- 7. MENU (one choice per step) AND INPUT ---------- */
  var screens = { landing: $('landing'), wizard: $('wizard'), over: $('over') };
  function show(name) {
    for (var k in screens) screens[k].classList.toggle('hidden', k !== name);
  }

  var ICONS = {
    clock: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><circle cx="24" cy="24" r="18"/><path d="M24 13v11l7 5"/></svg>',
    heart: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z"/></svg>'
  };
  function pips(n) {
    return '<span class="pips">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') + '</span>';
  }
  function swatch(css) { return '<span class="sw" style="background:' + css + '"></span>'; }

  // Edit the names, texts and numbers here to change the menu
  var STEP_DEFS = {
    mode: { title: 'Pick your game mode', opts: [
      { v: 'timed', name: 'Time Attack', text: 'Score as much as you can before the clock runs out.', vis: ICONS.clock },
      { v: 'endless', name: 'Endless', text: 'You have 3 hearts. Shoot a civilian and you lose one. How long can you last?', vis: ICONS.heart } ] },
    map: { title: 'Choose your map', opts: [
      { v: 'night', name: 'Night City', text: 'Dark sky and glowing windows', vis: swatch('linear-gradient(#0a1230,#2b3d78)') },
      { v: 'desert', name: 'Desert Town', text: 'Bright sun and sandy walls', vis: swatch('linear-gradient(#f08a4b,#fcdca3)') } ] },
    diff: { title: 'Choose your difficulty', opts: [
      { v: 'easy', name: 'Easy', text: 'Slow targets, steady scope, 10 bullets', vis: pips(1) },
      { v: 'medium', name: 'Medium', text: 'Faster targets, small scope shake, 8 bullets', vis: pips(2) },
      { v: 'hard', name: 'Hard', text: 'Fast targets, shaky scope, 6 bullets', vis: pips(3) } ] },
    time: { title: 'How long do you want to play?', opts: [
      { v: 30, name: '30 seconds', text: 'Quick round', vis: '<span class="num">30</span>' },
      { v: 60, name: '60 seconds', text: 'Classic round', vis: '<span class="num">60</span>' },
      { v: 90, name: '90 seconds', text: 'Long round', vis: '<span class="num">90</span>' } ] }
  };

  var steps = ['mode'], stepIdx = 0, picked = {};

  function openWizard(i) {
    stepIdx = i;
    var key = steps[i], def = STEP_DEFS[key], box = $('wzCards');
    $('wzTitle').textContent = def.title;
    $('wzStep').textContent = 'Step ' + (i + 1) + (steps.length > 1 ? ' of ' + steps.length : '');
    box.innerHTML = '';
    box.className = 'cards n' + def.opts.length;
    def.opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card' + (picked[key] === o.v ? ' on' : '');
      b.innerHTML = '<span class="vis">' + o.vis + '</span><b>' + o.name + '</b><small>' + o.text + '</small>';
      b.addEventListener('click', function () { choose(key, o.v); });
      box.appendChild(b);
    });
    show('wizard');
  }

  function choose(key, v) {
    audio();
    picked[key] = v;
    if (key === 'mode') { modeKey = v; steps = v === 'timed' ? ['mode', 'map', 'diff', 'time'] : ['mode', 'map', 'diff']; }
    else if (key === 'map') mapKey = v;
    else if (key === 'diff') diffKey = v;
    else limitKey = v;
    if (stepIdx + 1 < steps.length) openWizard(stepIdx + 1); else startGame();   // last choice starts the game
  }

  /* ---------- Mobile Fullscreen, Rotation & Desktop Lock Helpers ---------- */
  function getStage() {
    return $('stage') || document.querySelector('.stage');
  }

  function isMobileOrTablet() {
    return isTouch || (window.innerWidth <= 1024 && window.innerHeight <= 1024) ||
           /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent);
  }

  function enterFullscreen(elem) {
    var el = elem || getStage();
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        var p = el.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } catch (e) {}
  }

  function exitFullscreen() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
        if (document.exitFullscreen) {
          var p = document.exitFullscreen();
          if (p && p.catch) p.catch(function () {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        }
      }
    } catch (e) {}
  }

  function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {});
      } else if (screen.lockOrientation) {
        screen.lockOrientation('landscape');
      } else if (screen.webkitLockOrientation) {
        screen.webkitLockOrientation('landscape');
      } else if (screen.mozLockOrientation) {
        screen.mozLockOrientation('landscape');
      } else if (screen.msLockOrientation) {
        screen.msLockOrientation('landscape');
      }
    } catch (e) {}
  }

  function unlockOrientation() {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      } else if (screen.unlockOrientation) {
        screen.unlockOrientation();
      }
    } catch (e) {}
  }

  function checkOrientation() {
    var prompt = $('rotatePrompt');
    if (!prompt) return;
    var mobile = isMobileOrTablet();
    var isPortrait = window.innerHeight > window.innerWidth;
    var inActiveGame = (scene === 'menu' || scene === 'leaving' || state === 'play' || state === 'over');
    if (mobile && inActiveGame && isPortrait) {
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  }

  function activateGameView() {
    var stage = getStage();
    window.scrollTo(0, 0);
    if (isMobileOrTablet()) {
      enterFullscreen(stage);
      lockLandscape();
      if (stage) stage.classList.add('mobile-fullscreen');
      document.body.classList.add('in-game');
      document.body.classList.add('game-active');
      checkOrientation();
    } else {
      document.body.classList.add('game-active');
    }
  }

  function exitGameView() {
    document.body.classList.remove('game-active');
    document.body.classList.remove('game-locked');
    document.body.classList.remove('in-game');
    var stage = getStage();
    if (stage) stage.classList.remove('mobile-fullscreen');
    var prompt = $('rotatePrompt');
    if (prompt) prompt.classList.add('hidden');
    exitFullscreen();
    unlockOrientation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  var startButton = $('startBtn');
  if (startButton) {
    startButton.addEventListener('click', function () {
      audio();
      activateGameView();
      show(null);
      scene = 'leaving';
      walkX = W - 190;
    });
  }

  var backButton = $('wzBack');
  if (backButton) {
    backButton.addEventListener('click', function () {
      if (stepIdx > 0) openWizard(stepIdx - 1);
      else {
        scene = 'landing';
        show('landing');
        exitGameView();
      }
    });
  }

  /* Internal navigation links */
  var brandLink = $('brandLogo');
  if (brandLink) {
    brandLink.addEventListener('click', function (e) {
      e.preventDefault();
      scene = 'landing';
      show('landing');
      exitGameView();
      var stage = getStage();
      if (stage && stage.scrollIntoView) {
        stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  var jumpBtn = $('jumpToPlayBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var stage = getStage();
      if (stage && stage.scrollIntoView) {
        stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      var sBtn = $('startBtn');
      if (sBtn) sBtn.focus();
    });
  }
  // How to play popup (shown at the start of every round, game waits until closed)
  function openHelp() {
    var endless = G.mode === 'endless';
    $('helpList').innerHTML =
      (isTouch ? '<li><b>Tap</b> the screen to fire.</li>' +
                 '<li>Tap the <b>Reload</b> button (bottom right) to reload.</li>'
               : '<li><b>Left click</b> to fire.</li>' +
                 '<li><b>Right click</b> (or R) to reload.</li>') +
      '<li>Shoot the <b>thieves</b> (black mask, striped shirt). Do not shoot civilians.</li>' +
      '<li>Headshot on a thief: <b>+200 points</b></li>' +
      '<li>Body shot on a thief: <b>+100 points</b></li>' +
      '<li>Thieves in a row build a combo and multiply your points.</li>' +
      '<li class="bad">Shoot a civilian: <b>-150 points</b> and ' + (endless ? 'you lose 1 heart (3 hearts total).' : 'you lose 4 seconds.') + '</li>';
    if (isTouch) $('helpList').innerHTML += '<li>Tip: turn your phone sideways for a bigger view.</li>';
    helpOpen = true;
    canvas.classList.remove('playing');
    $('help').classList.remove('hidden');
  }
  function closeHelp() {
    helpOpen = false;
    $('help').classList.add('hidden');
    if (state === 'play') canvas.classList.add('playing');
  }
  $('helpBtn').addEventListener('click', closeHelp);
  $('reloadBtn').addEventListener('pointerdown', function (e) { e.preventDefault(); startReload(); });
  $('help').addEventListener('contextmenu', function (e) { e.preventDefault(); });
  $('againBtn').addEventListener('click', startGame);
  $('changeBtn').addEventListener('click', function () {
    state = 'idle'; G = null; scene = 'menu'; steps = ['mode']; picked = {}; openWizard(0);
  });
  $('muteBtn').addEventListener('click', function () {
    muted = !muted; this.textContent = muted ? 'Sound off' : 'Sound on';
  });

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) * W / r.width;
    my = (e.clientY - r.top) * H / r.height;
  }
  canvas.addEventListener('pointermove', pos);
  canvas.addEventListener('pointerdown', function (e) {
    pos(e); computeAim();
    if (e.button === 2) startReload(); else shoot();   // right click = reload
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    if ((e.key === 'r' || e.key === 'R') && state === 'play' && !helpOpen) startReload();
    if (e.key === 'Escape') {
      if (scene === 'landing') exitGameView();
    }
  });

  function onFullscreenChange() {
    var isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
    if (!isFull) {
      var stage = getStage();
      if (stage) stage.classList.remove('mobile-fullscreen');
      if (scene === 'landing') {
        exitGameView();
      }
    }
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('mozfullscreenchange', onFullscreenChange);

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', function () {
    setTimeout(checkOrientation, 200);
  });

  window.addEventListener('wheel', function (e) {
    if (document.body.classList.contains('game-active') || document.body.classList.contains('game-locked')) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchmove', function (e) {
    if (document.body.classList.contains('game-active') || document.body.classList.contains('game-locked') || (state === 'play' && !helpOpen)) {
      e.preventDefault();
    }
  }, { passive: false });

  /* ---------- Start ---------- */
  built.night = buildMap(MAPS.night);
  built.desert = buildMap(MAPS.desert);
  built.landing = buildLanding();

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt); draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
