/* ═══════════════════════════════════════════════════════════════════
   CREATIVE TECHNOLOGIST & 3D ARTIST — CORE ENGINE
   Features:
   1. Real-time 3D Canvas Projection Engine (Hero & 3D Geometry Lab)
   2. Interactive 4D Tesseract, Torus Knot, & Icosahedron Mesh Math
   3. Live FPS & Telemetry Engine
   4. Procedural Raymarcher Canvas Simulation (Project Card 03)
   5. Web Audio Micro-Acoustic Feedback System
   6. One-Click Clipboard Engine with Status Toast
   7. Filter & Navigation State Management
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ──────────── GLOBAL SHARED ENGINE STATE ────────────
  let heroMode = 'code'; // 'code' | 'reel'
  let heroInView = true;
  let heroLoopRunning = false;
  let renderHero = null;

  let shaderInView = false;
  let shaderLoopRunning = false;
  let renderShaderSim = null;

  // ──────────── AUDIO SYNTHESIZER ENGINE ────────────
  let audioCtx = null;
  let audioEnabled = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playMicroClick(freq = 880, duration = 0.025, vol = 0.035) {
    if (!audioEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent
    }
  }

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', function () {
      initAudio();
      audioEnabled = !audioEnabled;
      soundToggle.classList.toggle('active', audioEnabled);
      const label = soundToggle.querySelector('.sound-label');
      if (label) {
        label.textContent = audioEnabled ? 'AUDIO: ON' : 'AUDIO: OFF';
      }
      if (audioEnabled) {
        playMicroClick(1200, 0.05, 0.08);
      }
    });
  }

  // Bind audio clicks to interactive elements
  function attachMicroSounds() {
    const interactive = document.querySelectorAll('button, .nav-item, .filter-tag, .tool-btn, .preset-btn, .color-btn, .work-card');
    interactive.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        playMicroClick(1100, 0.015, 0.02);
      });
      el.addEventListener('click', function () {
        playMicroClick(750, 0.03, 0.04);
      });
    });
  }

  // ──────────── 3D VECTOR & MATRIX UTILS ────────────
  function rotateX(p, a) {
    const cos = Math.cos(a), sin = Math.sin(a);
    return { x: p.x, y: p.y * cos - p.z * sin, z: p.y * sin + p.z * cos };
  }
  function rotateY(p, a) {
    const cos = Math.cos(a), sin = Math.sin(a);
    return { x: p.x * cos + p.z * sin, y: p.y, z: -p.x * sin + p.z * cos };
  }
  function rotateZ(p, a) {
    const cos = Math.cos(a), sin = Math.sin(a);
    return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos, z: p.z };
  }

  // Project 3D Point to 2D Screen
  function project(p, width, height, fov = 350) {
    const distance = 400;
    const z = p.z + distance;
    if (z <= 10) return null;
    const factor = fov / z;
    return {
      x: p.x * factor + width / 2,
      y: p.y * factor + height / 2,
      scale: factor,
      z: p.z
    };
  }

  // ──────────── GEOMETRY GENERATORS ────────────
  // 1. Icosahedron generator
  function createIcosahedron(radius) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const a = radius / Math.sqrt(1 + phi * phi);
    const b = a * phi;

    const vertices = [
      { x: -a, y:  b, z:  0 }, { x:  a, y:  b, z:  0 },
      { x: -a, y: -b, z:  0 }, { x:  a, y: -b, z:  0 },
      { x:  0, y: -a, z:  b }, { x:  0, y:  a, z:  b },
      { x:  0, y: -a, z: -b }, { x:  0, y:  a, z: -b },
      { x:  b, y:  0, z: -a }, { x:  b, y:  0, z:  a },
      { x: -b, y:  0, z: -a }, { x: -b, y:  0, z:  a }
    ];

    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    const edges = [];
    const edgeSet = new Set();
    faces.forEach(function (f) {
      for (let i = 0; i < 3; i++) {
        const u = f[i];
        const v = f[(i + 1) % 3];
        const key = Math.min(u, v) + '_' + Math.max(u, v);
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([u, v]);
        }
      }
    });

    return { vertices: vertices, faces: faces, edges: edges };
  }

  // 2. Torus Knot generator
  function createTorusKnot(p = 2, q = 3, r1 = 110, r2 = 45, segments = 120, tubeSegments = 8, tubeRadius = 14) {
    const vertices = [];
    const edges = [];
    const faces = [];

    for (let i = 0; i < segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      const r = r1 + r2 * Math.cos(q * u);
      const cx = r * Math.cos(p * u);
      const cy = r * Math.sin(p * u);
      const cz = -r2 * Math.sin(q * u);

      // Tangent vector
      const du = 0.01;
      const u2 = u + du;
      const r_next = r1 + r2 * Math.cos(q * u2);
      const cx2 = r_next * Math.cos(p * u2);
      const cy2 = r_next * Math.sin(p * u2);
      const cz2 = -r2 * Math.sin(q * u2);

      const tx = cx2 - cx, ty = cy2 - cy, tz = cz2 - cz;
      const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
      const nx = -ty / tlen, ny = tx / tlen, nz = 0;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;

      const rTube = tubeRadius;
      for (let j = 0; j < tubeSegments; j++) {
        const v = (j / tubeSegments) * Math.PI * 2;
        const cv = Math.cos(v) * rTube;
        const sv = Math.sin(v) * rTube;
        vertices.push({
          x: cx + nx * cv + bx * sv,
          y: cy + ny * cv + by * sv,
          z: cz + nz * cv + bz * sv
        });
      }
    }

    for (let i = 0; i < segments; i++) {
      const nextI = (i + 1) % segments;
      for (let j = 0; j < tubeSegments; j++) {
        const nextJ = (j + 1) % tubeSegments;
        const idx1 = i * tubeSegments + j;
        const idx2 = nextI * tubeSegments + j;
        const idx3 = nextI * tubeSegments + nextJ;
        const idx4 = i * tubeSegments + nextJ;

        edges.push([idx1, idx2]);
        edges.push([idx1, idx4]);
        faces.push([idx1, idx2, idx3]);
        faces.push([idx1, idx3, idx4]);
      }
    }

    return { vertices: vertices, faces: faces, edges: edges };
  }

  // 3. 4D Hypercube / Tesseract projected to 3D
  function createHypercube(size = 90) {
    const raw4D = [];
    for (let i = 0; i < 16; i++) {
      raw4D.push({
        x: (i & 1 ? 1 : -1) * size,
        y: (i & 2 ? 1 : -1) * size,
        z: (i & 4 ? 1 : -1) * size,
        w: (i & 8 ? 1 : -1) * size
      });
    }

    const edges = [];
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        const diff = (i ^ j);
        // Connect if vertices differ in exactly 1 bit
        if ((diff & (diff - 1)) === 0) {
          edges.push([i, j]);
        }
      }
    }

    return { raw4D: raw4D, edges: edges };
  }

  // ──────────── HERO 3D VIEWPORT ENGINE ────────────
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    let width = 0, height = 0;

    let rotX = 0.25, rotY = 0.4, rotZ = 0;
    let velX = 0.003, velY = 0.007;
    let isDragging = false;
    let prevMouseX = 0, prevMouseY = 0;

    let renderMode = 'wireframe'; // 'wireframe' | 'solid' | 'points'
    let currentShape = 'torus'; // 'torus' | 'icosahedron'

    const icosa = createIcosahedron(105);
    const torus = createTorusKnot(2, 3, 68, 24, 60, 6, 9);

    function resizeHero() {
      if (!heroCanvas || !heroCanvas.parentElement) return;
      const rect = heroCanvas.parentElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(height * dpr);
      if (heroCanvas.width !== targetW || heroCanvas.height !== targetH) {
        heroCanvas.width = targetW;
        heroCanvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeHero, { passive: true });
    if (window.ResizeObserver && heroCanvas.parentElement) {
      new ResizeObserver(resizeHero).observe(heroCanvas.parentElement);
    }
    resizeHero();

    // Mouse Controls
    const mount = document.getElementById('canvas-container');
    mount.addEventListener('mousedown', function (e) {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });
    window.addEventListener('mouseup', function () {
      isDragging = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (isDragging) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        velY = dx * 0.005;
        velX = dy * 0.005;
        rotY += velY;
        rotX += velX;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });

    // Touch support for mobile
    mount.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    }, { passive: true });
    window.addEventListener('touchend', function () {
      isDragging = false;
    });
    window.addEventListener('touchmove', function (e) {
      if (isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - prevMouseX;
        const dy = e.touches[0].clientY - prevMouseY;
        velY = dx * 0.005;
        velX = dy * 0.005;
        rotY += velY;
        rotX += velX;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    // Mode Buttons
    const wireBtn = document.getElementById('tool-wire');
    const solidBtn = document.getElementById('tool-solid');
    const pointsBtn = document.getElementById('tool-points');
    const shapeBtn = document.getElementById('tool-shape');
    const resetBtn = document.getElementById('tool-reset');

    function setActiveMode(mode, targetBtn) {
      renderMode = mode;
      [wireBtn, solidBtn, pointsBtn].forEach(function (b) { if (b) b.classList.remove('active'); });
      if (targetBtn) targetBtn.classList.add('active');
    }

    if (wireBtn) wireBtn.addEventListener('click', function () { setActiveMode('wireframe', wireBtn); });
    if (solidBtn) solidBtn.addEventListener('click', function () { setActiveMode('solid', solidBtn); });
    if (pointsBtn) pointsBtn.addEventListener('click', function () { setActiveMode('points', pointsBtn); });

    if (shapeBtn) {
      shapeBtn.addEventListener('click', function () {
        if (currentShape === 'torus') {
          currentShape = 'icosahedron';
          shapeBtn.textContent = 'SHAPE: ICOSAHEDRON';
        } else {
          currentShape = 'torus';
          shapeBtn.textContent = 'SHAPE: TORUS KNOT';
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        rotX = 0.25;
        rotY = 0.4;
        velX = 0.003;
        velY = 0.007;
      });
    }

    // FPS Telemetry
    let lastTime = performance.now();
    let frameCount = 0;
    const fpsCounter = document.getElementById('hero-fps-counter');
    const vertCounter = document.getElementById('hero-vert-counter');

    renderHero = function () {
      if (!heroInView || document.hidden || heroMode === 'reel') {
        heroLoopRunning = false;
        return;
      }
      heroLoopRunning = true;
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 500) {
        const currentFps = Math.round((frameCount * 1000) / (now - lastTime));
        if (fpsCounter) fpsCounter.textContent = currentFps + '.0 FPS';
        frameCount = 0;
        lastTime = now;
      }

      if (heroCanvas.parentElement) {
        const curRect = heroCanvas.parentElement.getBoundingClientRect();
        if (Math.abs(curRect.width - width) > 1 || Math.abs(curRect.height - height) > 1) {
          resizeHero();
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Inertia & Auto-spin
      if (!isDragging) {
        rotX += velX;
        rotY += velY;
        velX *= 0.98;
        velY *= 0.98;
        if (Math.abs(velX) < 0.002) velX = 0.002;
        if (Math.abs(velY) < 0.004) velY = 0.004;
      }

      const activeGeom = currentShape === 'icosahedron' ? icosa : torus;
      if (vertCounter) {
        vertCounter.textContent = activeGeom.vertices.length + ' VERTS';
      }

      // Rotate vertices
      const transformed = [];
      const projected = [];

      // Dynamic responsive FOV based on viewport aspect ratio
      const baseDim = Math.min(width, height);
      const dynamicFov = Math.max(220, Math.min(380, baseDim * 0.9));

      for (let i = 0; i < activeGeom.vertices.length; i++) {
        let p = activeGeom.vertices[i];
        p = rotateX(p, rotX);
        p = rotateY(p, rotY);
        transformed.push(p);
        const proj = project(p, width, height, dynamicFov);
        projected.push(proj);
      }

      // Render mode: SOLID (faceted depth sorted)
      if (renderMode === 'solid') {
        const sortedFaces = [];
        for (let i = 0; i < activeGeom.faces.length; i++) {
          const f = activeGeom.faces[i];
          const p1 = transformed[f[0]];
          const p2 = transformed[f[1]];
          const p3 = transformed[f[2]];

          // Calculate normal
          const ax = p2.x - p1.x, ay = p2.y - p1.y, az = p2.z - p1.z;
          const bx = p3.x - p1.x, by = p3.y - p1.y, bz = p3.z - p1.z;
          const nx = ay * bz - az * by;
          const ny = az * bx - ax * bz;
          const nz = ax * by - ay * bx;

          // Backface culling
          if (nz > 0) {
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            // Diffuse dot with key light from (-0.5, -0.7, 0.6)
            const lightX = -0.4, lightY = -0.6, lightZ = 0.7;
            const diff = Math.max(0.12, (nx * lightX + ny * lightY + nz * lightZ) / len);
            const avgZ = (p1.z + p2.z + p3.z) / 3;
            sortedFaces.push({ f: f, z: avgZ, diff: diff });
          }
        }

        sortedFaces.sort(function (a, b) { return a.z - b.z; });

        for (let i = 0; i < sortedFaces.length; i++) {
          const item = sortedFaces[i];
          const f = item.f;
          const pt1 = projected[f[0]];
          const pt2 = projected[f[1]];
          const pt3 = projected[f[2]];
          if (!pt1 || !pt2 || !pt3) continue;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.lineTo(pt3.x, pt3.y);
          ctx.closePath();

          // Acid Lime tinted lighting
          const g = Math.floor(200 + item.diff * 55);
          const r = Math.floor(160 + item.diff * 40);
          const b = Math.floor(item.diff * 30);
          ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.35 + item.diff * 0.5) + ')';
          ctx.fill();

          ctx.strokeStyle = 'rgba(200, 255, 0, 0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Render mode: WIREFRAME
      if (renderMode === 'wireframe') {
        ctx.strokeStyle = 'rgba(200, 255, 0, 0.75)';
        ctx.lineWidth = 1.2;

        for (let i = 0; i < activeGeom.edges.length; i++) {
          const edge = activeGeom.edges[i];
          const p1 = projected[edge[0]];
          const p2 = projected[edge[1]];
          if (p1 && p2) {
            // Depth fading
            const zAlpha = Math.max(0.15, Math.min(0.9, (p1.z + p2.z + 180) / 360));
            ctx.strokeStyle = 'rgba(200, 255, 0, ' + zAlpha + ')';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        // Draw node vertices
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < projected.length; i++) {
          const pt = projected[i];
          if (pt) {
            ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
          }
        }
      }

      // Render mode: POINTS
      if (renderMode === 'points') {
        for (let i = 0; i < projected.length; i++) {
          const pt = projected[i];
          if (pt) {
            const sz = Math.max(1.5, pt.scale * 3);
            ctx.fillStyle = 'rgba(200, 255, 0, 0.9)';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, sz, 0, Math.PI * 2);
            ctx.fill();

            // Glow ring
            ctx.strokeStyle = 'rgba(200, 255, 0, 0.25)';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, sz * 2.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      if (heroInView && !document.hidden && heroMode === 'code') {
        requestAnimationFrame(renderHero);
      } else {
        heroLoopRunning = false;
      }
    }
    requestAnimationFrame(renderHero);
  }

  // ──────────── AMBIENT VIDEO BACKDROP CONTROLLER ────────────
  const ambientToggle = document.getElementById('ambient-toggle');
  const ambientWrap = document.getElementById('hero-ambient-wrap');
  const ambientVideo = document.getElementById('hero-ambient-video');
  let ambientEnabled = true;

  function toggleAmbientVideo(forcedState) {
    if (typeof forcedState === 'boolean') ambientEnabled = forcedState;
    else ambientEnabled = !ambientEnabled;

    if (ambientToggle) {
      ambientToggle.classList.toggle('active', ambientEnabled);
      const label = ambientToggle.querySelector('.ambient-label');
      if (label) {
        label.textContent = ambientEnabled ? 'AMBIENT: ON' : 'AMBIENT: OFF';
      }
    }
    if (ambientWrap) {
      ambientWrap.classList.toggle('disabled', !ambientEnabled);
    }
    if (ambientVideo) {
      if (ambientEnabled) {
        ambientVideo.play().catch(function () {});
        playMicroClick(980, 0.03, 0.05);
      } else {
        ambientVideo.pause();
        playMicroClick(440, 0.03, 0.04);
      }
    }
  }

  if (ambientToggle) {
    ambientToggle.addEventListener('click', function () {
      toggleAmbientVideo();
    });
  }

  // ──────────── DUAL-MODE HERO VIEWPORT (CODE vs REEL) ────────────
  const tabHeroCode = document.getElementById('tab-hero-code');
  const tabHeroReel = document.getElementById('tab-hero-reel');
  const heroReelContainer = document.getElementById('hero-reel-container');
  const heroReelVideo = document.getElementById('hero-reel-video');
  const toolbarCodeGroup = document.getElementById('toolbar-code-group');
  const toolbarReelGroup = document.getElementById('toolbar-reel-group');
  const viewportHint = document.getElementById('viewport-hint');
  const viewportHintText = document.getElementById('viewport-hint-text');
  const reelFrameCounter = document.getElementById('reel-frame-counter');
  const heroFpsTag = document.getElementById('hero-fps-counter');
  const heroVertTag = document.getElementById('hero-vert-counter');
  heroMode = 'code'; // 'code' | 'reel'

  function setHeroViewportMode(mode) {
    heroMode = mode;
    if (mode === 'code') {
      if (tabHeroCode) {
        tabHeroCode.classList.add('active');
        tabHeroCode.setAttribute('aria-selected', 'true');
      }
      if (tabHeroReel) {
        tabHeroReel.classList.remove('active');
        tabHeroReel.setAttribute('aria-selected', 'false');
      }
      if (heroCanvas) heroCanvas.classList.remove('faded');
      if (heroReelContainer) heroReelContainer.classList.remove('active');
      if (toolbarCodeGroup) toolbarCodeGroup.classList.remove('hidden');
      if (toolbarReelGroup) toolbarReelGroup.classList.add('hidden');
      if (heroReelVideo) heroReelVideo.pause();
      if (viewportHint) viewportHint.style.display = 'flex';
      if (viewportHintText) viewportHintText.textContent = 'Click & drag to rotate sculpture';
      if (heroFpsTag) heroFpsTag.textContent = '60.0 FPS';
      if (heroVertTag) heroVertTag.textContent = '1,440 VERTS';
      if (!heroLoopRunning && heroInView && !document.hidden) {
        requestAnimationFrame(renderHero);
      }
      playMicroClick(1050, 0.03, 0.05);
    } else {
      if (tabHeroCode) {
        tabHeroCode.classList.remove('active');
        tabHeroCode.setAttribute('aria-selected', 'false');
      }
      if (tabHeroReel) {
        tabHeroReel.classList.add('active');
        tabHeroReel.setAttribute('aria-selected', 'true');
      }
      if (heroCanvas) heroCanvas.classList.add('faded');
      if (heroReelContainer) heroReelContainer.classList.add('active');
      if (toolbarCodeGroup) toolbarCodeGroup.classList.add('hidden');
      if (toolbarReelGroup) toolbarReelGroup.classList.remove('hidden');
      if (viewportHint) viewportHint.style.display = 'none';
      if (heroReelVideo) {
        heroReelVideo.play().catch(function () {});
      }
      if (heroFpsTag) heroFpsTag.textContent = '24.0 FPS';
      if (heroVertTag) heroVertTag.textContent = 'CYCLES PBR';
      playMicroClick(820, 0.04, 0.06);
    }
  }

  if (tabHeroCode) tabHeroCode.addEventListener('click', function () { setHeroViewportMode('code'); });
  if (tabHeroReel) tabHeroReel.addEventListener('click', function () { setHeroViewportMode('reel'); });

  // Reel Video Controls
  const btnReelPlay = document.getElementById('btn-reel-play');
  const btnReelSpeed = document.getElementById('btn-reel-speed');
  const btnReelRestart = document.getElementById('btn-reel-restart');

  if (btnReelPlay && heroReelVideo) {
    btnReelPlay.addEventListener('click', function () {
      if (heroReelVideo.paused) {
        delete heroReelVideo.dataset.userPaused;
        heroReelVideo.play().catch(function () {});
        btnReelPlay.textContent = 'PAUSE ||';
        btnReelPlay.classList.add('active');
      } else {
        heroReelVideo.dataset.userPaused = 'true';
        heroReelVideo.pause();
        btnReelPlay.textContent = 'PLAY ▶';
        btnReelPlay.classList.remove('active');
      }
      playMicroClick(880, 0.025, 0.04);
    });
  }

  const speeds = [1.0, 0.5, 1.5, 2.0];
  let speedIdx = 0;
  if (btnReelSpeed && heroReelVideo) {
    btnReelSpeed.addEventListener('click', function () {
      speedIdx = (speedIdx + 1) % speeds.length;
      heroReelVideo.playbackRate = speeds[speedIdx];
      btnReelSpeed.textContent = 'SPEED: ' + speeds[speedIdx].toFixed(1) + 'x';
      playMicroClick(920, 0.025, 0.04);
    });
  }

  if (btnReelRestart && heroReelVideo) {
    btnReelRestart.addEventListener('click', function () {
      heroReelVideo.currentTime = 0;
      heroReelVideo.play().catch(function () {});
      if (btnReelPlay) {
        btnReelPlay.textContent = 'PAUSE ||';
        btnReelPlay.classList.add('active');
      }
      playMicroClick(740, 0.03, 0.04);
    });
  }

  if (heroReelVideo) {
    heroReelVideo.addEventListener('timeupdate', function () {
      if (heroMode === 'reel' && heroVertTag) {
        const duration = heroReelVideo.duration || 16.66;
        const progress = Math.max(0, Math.min(1, heroReelVideo.currentTime / duration));
        const frameNum = Math.min(500, Math.floor(progress * 500) + 1);
        heroVertTag.textContent = 'FRAME ' + String(frameNum).padStart(4, '0') + '/0500';
      }
    });
  }

  // Hero Intersection Observer (Pauses video and canvas when scrolled away)
  const heroObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      heroInView = entry.isIntersecting;
      if (heroInView) {
        if (!heroLoopRunning && heroMode === 'code' && !document.hidden) {
          requestAnimationFrame(renderHero);
        }
        if (ambientEnabled && ambientVideo && !document.hidden) {
          ambientVideo.play().catch(function () {});
        }
        if (heroMode === 'reel' && heroReelVideo && !heroReelVideo.dataset.userPaused && !document.hidden) {
          heroReelVideo.play().catch(function () {});
        }
      } else {
        if (ambientVideo) ambientVideo.pause();
        if (heroReelVideo) heroReelVideo.pause();
      }
    });
  }, { threshold: 0.08 });

  const heroSectionEl = document.getElementById('hero');
  if (heroSectionEl) heroObserver.observe(heroSectionEl);

  // ──────────── 3D GEOMETRY LAB ENGINE ────────────
  const labCanvas = document.getElementById('lab-canvas');
  if (labCanvas) {
    const ctx = labCanvas.getContext('2d');
    let width = 0, height = 0;

    let labShape = 'wave';
    let labRotX = 0, labRotY = 0, labRotZ = 0;
    let labSpeed = 1.0;
    let labScale = 1.0;
    let labColor = 'lime';

    const labTorus = createTorusKnot(3, 4, 110, 40, 80, 8);
    const labIcosa = createIcosahedron(130);
    const labHypercube = createHypercube(90);

    const hudGeom = document.getElementById('lab-hud-geom');
    const hudPoly = document.getElementById('lab-hud-poly');

    function resizeLab() {
      if (!labCanvas || !labCanvas.parentElement) return;
      const rect = labCanvas.parentElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(height * dpr);
      if (labCanvas.width !== targetW || labCanvas.height !== targetH) {
        labCanvas.width = targetW;
        labCanvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeLab, { passive: true });
    if (window.ResizeObserver && labCanvas.parentElement) {
      new ResizeObserver(resizeLab).observe(labCanvas.parentElement);
    }
    resizeLab();

    // Lab Controls binding
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        presetBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        labShape = btn.getAttribute('data-shape');

        if (hudGeom) hudGeom.textContent = labShape === 'wave' ? 'WAVE_GRID' : labShape.toUpperCase();
        if (hudPoly) {
          if (labShape === 'torus') hudPoly.textContent = labTorus.faces.length + ' FACES';
          else if (labShape === 'icosahedron') hudPoly.textContent = labIcosa.faces.length + ' FACES';
          else if (labShape === 'hypercube') hudPoly.textContent = '32 EDGES (4D)';
          else hudPoly.textContent = '841 VERTICES';
        }
      });
    });

    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider) {
      speedSlider.addEventListener('input', function () {
        labSpeed = parseFloat(speedSlider.value);
        if (speedVal) speedVal.textContent = labSpeed.toFixed(1) + 'x';
      });
    }

    const scaleSlider = document.getElementById('scale-slider');
    const scaleVal = document.getElementById('scale-val');
    if (scaleSlider) {
      scaleSlider.addEventListener('input', function () {
        labScale = parseFloat(scaleSlider.value);
        if (scaleVal) scaleVal.textContent = Math.round(labScale * 100) + '%';
      });
    }

    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        colorBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        labColor = btn.getAttribute('data-color');
      });
    });

    function getColorCode(alpha = 1) {
      if (labColor === 'lime') return 'rgba(200, 255, 0, ' + alpha + ')';
      if (labColor === 'mono') return 'rgba(235, 235, 240, ' + alpha + ')';
      return 'rgba(255, 85, 0, ' + alpha + ')';
    }

    let tesseractAngle = 0;
    let labInView = true;
    let labLoopRunning = false;

    function renderLab() {
      if (!labInView || document.hidden) {
        labLoopRunning = false;
        return;
      }
      labLoopRunning = true;
      if (labCanvas.parentElement) {
        const curRect = labCanvas.parentElement.getBoundingClientRect();
        if (Math.abs(curRect.width - width) > 1 || Math.abs(curRect.height - height) > 1) {
          resizeLab();
        }
      }
      ctx.clearRect(0, 0, width, height);

      labRotX += 0.008 * labSpeed;
      labRotY += 0.012 * labSpeed;
      labRotZ += 0.004 * labSpeed;
      tesseractAngle += 0.015 * labSpeed;

      const scale = labScale;
      const baseLabDim = Math.min(width, height);
      const labFov = Math.max(200, Math.min(480, baseLabDim * 1.05));

      if (labShape === 'hypercube') {
        // 4D Rotation in XW and YZ planes
        const cos = Math.cos(tesseractAngle);
        const sin = Math.sin(tesseractAngle);

        const projected3D = [];
        for (let i = 0; i < 16; i++) {
          const p = labHypercube.raw4D[i];
          // 4D Rotation
          const x4 = p.x * cos - p.w * sin;
          const w4 = p.x * sin + p.w * cos;
          const distance4D = 240;
          const scale4D = distance4D / (distance4D - w4);

          // Project 4D -> 3D
          let p3 = {
            x: x4 * scale4D * scale,
            y: p.y * scale4D * scale,
            z: p.z * scale4D * scale
          };

          p3 = rotateX(p3, labRotX * 0.4);
          p3 = rotateY(p3, labRotY * 0.6);
          projected3D.push(project(p3, width, height, labFov));
        }

        ctx.strokeStyle = getColorCode(0.85);
        ctx.lineWidth = 1.3;

        for (let i = 0; i < labHypercube.edges.length; i++) {
          const edge = labHypercube.edges[i];
          const pt1 = projected3D[edge[0]];
          const pt2 = projected3D[edge[1]];
          if (pt1 && pt2) {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < projected3D.length; i++) {
          const pt = projected3D[i];
          if (pt) ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        }
      } else if (labShape === 'wave') {
        // Wave Grid (3D mathematical matrix)
        const gridSize = 14;
        const step = 22 * scale;
        const pts = [];

        const time = performance.now() * 0.002 * labSpeed;

        for (let ix = -gridSize; ix <= gridSize; ix++) {
          for (let iz = -gridSize; iz <= gridSize; iz++) {
            const dist = Math.sqrt(ix * ix + iz * iz);
            const y = Math.sin(dist * 0.4 - time) * 32 * scale;
            let p = { x: ix * step, y: y, z: iz * step };
            p = rotateX(p, 0.72);
            p = rotateY(p, labRotY * 0.45);
            pts.push(project(p, width, height, labFov * 0.95));
          }
        }

        const dim = gridSize * 2 + 1;

        // Draw connecting 3D wireframe grid lines
        ctx.strokeStyle = getColorCode(0.32);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let r = 0; r < dim; r++) {
          for (let c = 0; c < dim; c++) {
            const idx = r * dim + c;
            const pt = pts[idx];
            if (!pt) continue;
            if (c + 1 < dim) {
              const rightPt = pts[idx + 1];
              if (rightPt) {
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(rightPt.x, rightPt.y);
              }
            }
            if (r + 1 < dim) {
              const downPt = pts[idx + dim];
              if (downPt) {
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(downPt.x, downPt.y);
              }
            }
          }
        }
        ctx.stroke();

        // Draw glowing vertex points
        ctx.fillStyle = getColorCode(0.85);
        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i];
          if (pt) {
            ctx.fillRect(pt.x - 1.25, pt.y - 1.25, 2.5, 2.5);
          }
        }
      } else {
        // Torus or Icosahedron
        const active = labShape === 'torus' ? labTorus : labIcosa;
        const projected = [];

        for (let i = 0; i < active.vertices.length; i++) {
          let p = {
            x: active.vertices[i].x * scale,
            y: active.vertices[i].y * scale,
            z: active.vertices[i].z * scale
          };
          p = rotateX(p, labRotX);
          p = rotateY(p, labRotY);
          p = rotateZ(p, labRotZ);
          projected.push(project(p, width, height, labFov));
        }

        ctx.strokeStyle = getColorCode(0.75);
        ctx.lineWidth = 1.2;

        for (let i = 0; i < active.edges.length; i++) {
          const e = active.edges[i];
          const p1 = projected[e[0]];
          const p2 = projected[e[1]];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(renderLab);
    }
    requestAnimationFrame(renderLab);

    const labObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        labInView = entry.isIntersecting;
        if (labInView && !labLoopRunning && !document.hidden) {
          requestAnimationFrame(renderLab);
        }
      });
    }, { threshold: 0.08 });

    const labSectionEl = document.getElementById('lab');
    if (labSectionEl) labObserver.observe(labSectionEl);
  }

  // ──────────── SHADER PREVIEW CANVAS (PROJECT 03) ────────────
  const shaderCanvas = document.getElementById('canvas-preview-shader');
  if (shaderCanvas) {
    const sctx = shaderCanvas.getContext('2d');
    let sw = 0, sh = 0;

    function resizeShader() {
      const rect = shaderCanvas.parentElement.getBoundingClientRect();
      sw = shaderCanvas.width = rect.width;
      sh = shaderCanvas.height = rect.height;
    }
    window.addEventListener('resize', resizeShader);
    resizeShader();

    let shaderTime = 0;

    renderShaderSim = function () {
      if (!shaderInView || document.hidden) {
        shaderLoopRunning = false;
        return;
      }
      shaderLoopRunning = true;
      shaderTime += 0.03;
      sctx.fillStyle = '#06060a';
      sctx.fillRect(0, 0, sw, sh);

      // Draw procedural volumetric wave contour bands
      const bands = 7;
      for (let b = 0; b < bands; b++) {
        sctx.beginPath();
        const baseZ = b * 30;
        const alpha = 0.2 + (b / bands) * 0.6;
        sctx.strokeStyle = 'rgba(200, 255, 0, ' + alpha + ')';
        sctx.lineWidth = 1.2;

        for (let x = 0; x <= sw; x += 12) {
          const nx = x * 0.015;
          const y = (sh / 2) + Math.sin(nx + shaderTime + b * 0.6) * 45 + Math.cos(nx * 2 - shaderTime * 0.7) * 20;
          if (x === 0) sctx.moveTo(x, y);
          else sctx.lineTo(x, y);
        }
        sctx.stroke();
      }

      // Digital crosshairs
      sctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.moveTo(sw / 2 - 20, sh / 2);
      sctx.lineTo(sw / 2 + 20, sh / 2);
      sctx.moveTo(sw / 2, sh / 2 - 20);
      sctx.lineTo(sw / 2, sh / 2 + 20);
      sctx.stroke();

      // GLSL tag overlay
      sctx.font = '10px Space Mono, monospace';
      sctx.fillStyle = '#c8ff00';
      sctx.fillText('GLSL 450 // RAYMARCH_FBM()', 16, 26);
      sctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      sctx.fillText('t: ' + shaderTime.toFixed(2) + 's | ITER: 64', 16, 42);

      requestAnimationFrame(renderShaderSim);
    }

    const shaderObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        shaderInView = entry.isIntersecting;
        if (shaderInView && !shaderLoopRunning && !document.hidden) {
          requestAnimationFrame(renderShaderSim);
        }
      });
    }, { threshold: 0.1 });
    shaderObserver.observe(shaderCanvas);
  }

  // Global Page Visibility Manager (battery & memory protection)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (ambientVideo) ambientVideo.pause();
      if (heroReelVideo) heroReelVideo.pause();
    } else {
      if (heroInView) {
        if (ambientEnabled && ambientVideo) ambientVideo.play().catch(function () {});
        if (heroMode === 'reel' && heroReelVideo && !heroReelVideo.dataset.userPaused) heroReelVideo.play().catch(function () {});
        if (!heroLoopRunning && heroMode === 'code') requestAnimationFrame(renderHero);
      }
      if (labInView && !labLoopRunning) requestAnimationFrame(renderLab);
      if (shaderInView && !shaderLoopRunning) requestAnimationFrame(renderShaderSim);
    }
  });

  // ──────────── LIVE UTC CLOCK TELEMETRY ────────────
  const clockEl = document.getElementById('hero-local-clock');
  function updateClock() {
    if (clockEl) {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      clockEl.textContent = h + ':' + m + ':' + s + ' UTC';
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ──────────── CLIPBOARD ENGINE & TOAST ────────────
  const toast = document.getElementById('toast-notify');
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    const msgEl = toast.querySelector('.toast-msg');
    if (msgEl) msgEl.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2800);
  }

  function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(successMsg);
      }).catch(function () {
        showToast('Email: ' + text);
      });
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(successMsg);
    }
  }

  const quickCopy = document.getElementById('quick-copy-email');
  if (quickCopy) {
    quickCopy.addEventListener('click', function () {
      copyTextToClipboard('sujalphapale95@gmail.com', 'Copied: sujalphapale95@gmail.com');
    });
  }

  const copyBottom = document.getElementById('copy-email-bottom');
  if (copyBottom) {
    copyBottom.addEventListener('click', function () {
      copyTextToClipboard('sujalphapale95@gmail.com', 'Copied: sujalphapale95@gmail.com');
    });
  }

  // ──────────── FILTER WORKS ENGINE ────────────
  const filterTags = document.querySelectorAll('.filter-tag');
  const workCards = document.querySelectorAll('.work-card');

  filterTags.forEach(function (tag) {
    tag.addEventListener('click', function () {
      filterTags.forEach(function (t) { t.classList.remove('active'); });
      tag.classList.add('active');

      const filter = tag.getAttribute('data-filter');

      workCards.forEach(function (card) {
        const cat = card.getAttribute('data-category') || '';
        if (filter === 'all' || cat.indexOf(filter) !== -1) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // ──────────── ACTIVE NAVBAR SCROLL TRACKING (THROTTLED VIA RAF) ────────────
  const masthead = document.getElementById('masthead');
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('section[id]');
  let scrollTicking = false;

  function updateScrollState() {
    const scrollY = window.scrollY;

    // Header border style
    if (masthead) {
      if (scrollY > 40) masthead.classList.add('scrolled');
      else masthead.classList.remove('scrolled');
    }

    // Active link highlighting
    let currentId = 'hero';
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const top = sec.offsetTop - 140;
      const height = sec.offsetHeight;
      if (scrollY >= top && scrollY < top + height) {
        currentId = sec.getAttribute('id');
      }
    }

    if ((window.innerHeight + Math.round(scrollY)) >= document.body.offsetHeight - 60) {
      currentId = 'contact';
    }

    navItems.forEach(function (item) {
      if (item.getAttribute('href') === '#' + currentId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    scrollTicking = false;
  }

  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(updateScrollState);
    }
  }, { passive: true });
  updateScrollState();

  // ──────────── MOBILE MENU TOGGLE ────────────
  const mobileToggle = document.getElementById('mobile-toggle');
  const mastheadNav = document.getElementById('masthead-nav');

  if (mobileToggle && mastheadNav) {
    mobileToggle.addEventListener('click', function () {
      mastheadNav.classList.toggle('open');
    });

    navItems.forEach(function (item) {
      item.addEventListener('click', function () {
        mastheadNav.classList.remove('open');
      });
    });
  }

  // ──────────── CONTACT FORM SIMULATION ────────────
  const contactForm = document.getElementById('contact-form');
  const submitBtn = document.getElementById('form-submit-btn');

  if (contactForm && submitBtn) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Processing Dispatch...</span>';

      setTimeout(function () {
        submitBtn.innerHTML = '<span>Transmission Confirmed &check;</span>';
        submitBtn.style.background = '#10b981';
        showToast('Inquiry dispatched successfully! Expect a reply within 24h.');

        setTimeout(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
          submitBtn.style.background = '';
          contactForm.reset();
        }, 3500);
      }, 900);
    });
  }

  // ──────────── BLENDER 3D GALLERY LIGHTBOX & VIDEO ENGINE ────────────
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxMediaBox = document.getElementById('lightbox-media-box');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxOrigLink = document.getElementById('lightbox-orig-link');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  function openLightbox(item) {
    if (!lightboxModal) return;
    const mediaSrc = item.getAttribute('data-media');
    const mediaType = item.getAttribute('data-type');
    const title = item.getAttribute('data-title');
    const desc = item.getAttribute('data-desc');
    const fullLink = item.getAttribute('data-link') || mediaSrc;

    if (lightboxTitle) lightboxTitle.textContent = title || 'Artwork Inspector';
    if (lightboxDesc) lightboxDesc.textContent = desc || '';
    if (lightboxOrigLink) {
      lightboxOrigLink.setAttribute('href', fullLink);
      lightboxOrigLink.textContent = mediaType === 'video' ? 'Download Original Animation Render &nearr;' : 'View Master Full-Resolution Asset &nearr;';
    }

    if (lightboxMediaBox) {
      lightboxMediaBox.innerHTML = '';
      if (mediaType === 'video') {
        const vid = document.createElement('video');
        vid.src = mediaSrc;
        vid.controls = true;
        vid.autoplay = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.className = 'lightbox-media-element';
        lightboxMediaBox.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = mediaSrc;
        img.alt = title || 'Blender Render by Sujal Phapale';
        img.className = 'lightbox-media-element';
        lightboxMediaBox.appendChild(img);
      }
    }

    lightboxModal.classList.add('open');
    lightboxModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    playMicroClick(880, 0.04, 0.06);
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('open');
    lightboxModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lightboxMediaBox) {
      lightboxMediaBox.innerHTML = '';
    }
    playMicroClick(520, 0.03, 0.04);
  }

  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }

  if (lightboxModal) {
    lightboxModal.addEventListener('click', function (e) {
      if (e.target === lightboxModal) {
        closeLightbox();
      }
    });
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('open')) {
      closeLightbox();
    }
  });

  galleryItems.forEach(function (item) {
    item.addEventListener('click', function () {
      openLightbox(item);
    });

    // Auto-preview muted video on hover
    if (item.getAttribute('data-type') === 'video') {
      const vidThumb = item.querySelector('video');
      if (vidThumb) {
        item.addEventListener('mouseenter', function () {
          vidThumb.play().catch(function () {});
        });
        item.addEventListener('mouseleave', function () {
          vidThumb.pause();
        });
      }
    }
  });

  // ──────────── PROJECT DEEP-DIVE CASE STUDY DATA & ENGINE ────────────
  const caseStudiesData = {
    'future-you': {
      id: '01',
      title: 'Future-You: Self-Accountability Contract Platform',
      badge: 'CASE STUDY // 01',
      category: 'NEXT.JS • SUPABASE • WEB PUSH API',
      summary: 'A self-accountability web app and PWA designed to turn promises into binding commitments. Users write contracts to their future self that trigger situational notifications when moments of friction or temptation arrive.',
      media: {
        type: 'image',
        src: 'assets/images/project-future-you.png',
        alt: 'Future-You Contract App Design'
      },
      liveUrl: 'https://future-you-virid.vercel.app',
      githubUrl: 'https://github.com/SujalPhapale95/Future-You',
      stats: [
        { label: 'FRAMEWORK', val: 'Next.js 14 App Router' },
        { label: 'DATABASE', val: 'Supabase PostgreSQL' },
        { label: 'NOTIFICATIONS', val: 'Web Push (VAPID API)' },
        { label: 'STYLING', val: 'Tailwind CSS + Lucide' }
      ],
      sections: [
        {
          heading: '01 // The Problem & Concept',
          text: 'Most habit and goal-tracking apps suffer from high drop-off rates because users lose affective connection with their long-term milestones. Future-You was designed with behavioral psychology principles—allowing users to structure chronological letters, milestones, and automated future self reminders.'
        },
        {
          heading: '02 // System Architecture & Implementation',
          text: 'Built with the Next.js 14 App Router for server-rendered page shells and fast client transitions. User authentication and relational data (goals, check-ins, scheduled dispatches) are secured via Supabase Row-Level Security (RLS) policies. State mutations update optimistically on the client before network roundtrips complete.'
        },
        {
          heading: '03 // Engineering Challenge: Background Push Scheduling',
          text: 'Standard browser notifications require active tabs. To solve delivery when the user is offline, we implemented Service Workers paired with web-push encryption using VAPID keys. A scheduled Edge Function triggers database lookups and dispatches encrypted payload notifications directly to user OS notification centers.'
        }
      ]
    },
    'rag-chatbot': {
      id: '02',
      title: 'RAG Document Intelligence Chatbot',
      badge: 'CASE STUDY // 02',
      category: 'AI & LLM ARCHITECTURE • PYTHON',
      summary: 'An enterprise-grade Retrieval-Augmented Generation (RAG) system delivering sub-300ms grounded conversational answers over proprietary PDF and markdown corpora using dense semantic vector search and ultra-fast LPU inference.',
      media: {
        type: 'cli',
        title: 'python rag_chatbot.py --chromadb ./vector_store',
        lines: [
          '> Initializing Hugging Face Embeddings: BAAI/bge-small-en-v1.5',
          '> ChromaDB collection loaded: 12,400 chunk vectors indexed',
          '> Query received: "Explain RLS policies in auth pipeline"',
          '> Semantic cosine similarity top-k=4 retrieved in 18ms',
          '> Groq LPU inference (Llama-3-70B) completed in 220ms [94% score]'
        ]
      },
      liveUrl: null,
      githubUrl: 'https://github.com/SujalPhapale95/RAG-Document-Chatbot',
      stats: [
        { label: 'ORCHESTRATION', val: 'LangChain / Python' },
        { label: 'VECTOR DB', val: 'ChromaDB Local' },
        { label: 'EMBEDDINGS', val: 'Hugging Face BGE' },
        { label: 'INFERENCE', val: 'Groq LPU (Llama 3)' }
      ],
      sections: [
        {
          heading: '01 // The Objective',
          text: 'Standard LLMs suffer from knowledge cutoffs and hallucinations when queried on private technical documentation. This project provides a fully localized, low-latency document QA engine that strictly grounds answers in authoritative source citations.'
        },
        {
          heading: '02 // Ingestion & Chunking Pipeline',
          text: 'Raw PDF and Markdown manuals are processed via LangChain with recursive character splitting (chunk size: 800, overlap: 150) to preserve semantic continuity across code snippets and paragraphs. Dense embeddings are generated and persisted into ChromaDB with metadata indexing for filtering by document type.'
        },
        {
          heading: '03 // Low-Latency Query Execution',
          text: 'Instead of slow cloud GPU endpoints that take 3–5 seconds, queries hit Groq LPUs running Llama-3-70B. Coupled with local vector cosine similarity retrieval, complete synthesized answers with precise document page citations are streamed back in under 260 milliseconds.'
        }
      ]
    },
    'chrome-skulls': {
      id: '03',
      title: 'Chrome Skulls: Iridescent Metallic Lookdev',
      badge: 'CASE STUDY // 03',
      category: 'BLENDER 3D • SHADER LOOKDEV • CYCLES',
      summary: 'A deep-dive technical 3D lookdev study exploring quad-remeshed anatomical geometry, thin-film optical interference, and anisotropic roughness shaders under multi-point studio lighting.',
      media: {
        type: 'image',
        src: 'assets/blender/Skullfinal.png',
        alt: 'Chrome Skulls Cycles Render'
      },
      liveUrl: '#blender-gallery',
      githubUrl: 'https://www.instagram.com/sujal.phapale/',
      stats: [
        { label: 'DCC SOFTWARE', val: 'Blender 4.2 LTS' },
        { label: 'RENDER ENGINE', val: 'Cycles X (Path Tracer)' },
        { label: 'GEOMETRY', val: 'Quad-Remeshed SubD' },
        { label: 'LIGHTING PASS', val: '3-Point Rim & Area' }
      ],
      sections: [
        {
          heading: '01 // Artistic & Technical Vision',
          text: 'The goal was to create an aggressive, hyper-stylized cybernetic centerpiece that balances anatomical authenticity with high-fashion futuristic chrome aesthetics, reminiscent of industrial Y2K and biomechanical art.'
        },
        {
          heading: '02 // Shader Craft: Iridescence & Anisotropy',
          text: 'Standard Blender metallic shaders look flat and synthetic. To create organic life in the reflections, custom shader node trees were constructed: combining anisotropic roughness along brushed vertex vectors, subtle bump map micro-scratches, and a thin-film interference rainbow gradient hooked into the Fresnel viewing angle.'
        },
        {
          heading: '03 // Lighting & Color Lookdev',
          text: 'Rendered with Cycles X with 1024 samples and OpenImageDenoise. Lighting was constructed using strong cool cyan and warm magenta rim lights placed behind the craniums to carve out sharp silhouettes against a true obsidian black horizon.'
        }
      ]
    },
    'crime-rate-ai': {
      id: '04',
      title: 'CrimeRate AI: Urban Crime Prediction & Analytics',
      badge: 'CASE STUDY // 04',
      category: 'MACHINE LEARNING • PYTHON & FLASK • PREDICTIVE ANALYTICS',
      summary: 'A smart machine learning web application that predicts and compares crime rates across major Indian metropolitan centers based on year, city, and crime type, factoring in dynamic historical population growth modeling.',
      media: {
        type: 'image',
        src: 'assets/images/project-crimerate-ai.png',
        alt: 'CrimeRate AI Machine Learning Analytics'
      },
      liveUrl: 'https://crimerate-ai.onrender.com/',
      githubUrl: 'https://github.com/shreyassindhur/CrimeRate-AI',
      stats: [
        { label: 'BACKEND', val: 'Python / Flask' },
        { label: 'ML ENGINE', val: 'Scikit-learn Regression' },
        { label: 'DATASET', val: 'NCRB 2014–2021 Corpus' },
        { label: 'FRONTEND', val: 'TailwindCSS + Chart.js' }
      ],
      sections: [
        {
          heading: '01 // Predictive Intelligence & Purpose',
          text: 'Crime trends fluctuate significantly as urbanization accelerates. CrimeRate AI provides citizens, law enforcement, and researchers with an intuitive interface to query historical crime statistics and forecast future crime rates across key Indian metropolitan areas with multivariate regression analysis.'
        },
        {
          heading: '02 // Dynamic Population Growth Weighting',
          text: 'Raw crime frequencies without demographic normalization produce distorted risk metrics. The system dynamically adjusts baseline predictions by computing longitudinal population growth curves between census intervals, yielding a standardized crime rate per 100,000 residents.'
        },
        {
          heading: '03 // 4-Tier Risk Categorization & Dual-City Benchmarking',
          text: 'Beyond raw numerical outputs, predictions are mapped into an actionable 4-tier risk matrix (Very Low, Low, High, Critical) and visualized via Chart.js comparative multi-line charts to benchmark relative safety between any two cities.'
        }
      ]
    },
    'web-engine': null
  };
  caseStudiesData['web-engine'] = caseStudiesData['crime-rate-ai'];

  const csDrawer = document.getElementById('case-study-drawer');
  const csBadge = document.getElementById('cs-badge');
  const csCategory = document.getElementById('cs-category');
  const csContent = document.getElementById('cs-content');
  const csCloseBtn = document.getElementById('cs-close-btn');

  function openCaseStudy(studyId) {
    const data = caseStudiesData[studyId];
    if (!data || !csDrawer) return;

    if (csBadge) csBadge.textContent = data.badge;
    if (csCategory) csCategory.textContent = data.category;

    if (csContent) {
      let html = '';
      html += '<h2 class="cs-title">' + data.title + '</h2>';
      html += '<p class="cs-summary">' + data.summary + '</p>';

      if (data.media) {
        if (data.media.type === 'image') {
          html += '<div class="cs-media-box"><img src="' + data.media.src + '" alt="' + (data.media.alt || data.title) + '"></div>';
        } else if (data.media.type === 'cli') {
          html += '<div class="cli-terminal-mock"><div class="cli-topbar"><span class="cli-dot red"></span><span class="cli-dot yellow"></span><span class="cli-dot green"></span><span class="cli-title">' + data.media.title + '</span></div><div class="cli-output">';
          data.media.lines.forEach(function (line) {
            html += '<p class="cli-line green">' + line + '</p>';
          });
          html += '</div></div>';
        }
      }

      if (data.stats && data.stats.length > 0) {
        html += '<div class="cs-stats-grid">';
        data.stats.forEach(function (stat) {
          html += '<div class="cs-stat-item"><span class="cs-stat-label">' + stat.label + '</span><span class="cs-stat-val">' + stat.val + '</span></div>';
        });
        html += '</div>';
      }

      if (data.sections && data.sections.length > 0) {
        data.sections.forEach(function (sec) {
          html += '<div class="cs-section-block">';
          html += '  <h4 class="cs-section-heading">' + sec.heading + '</h4>';
          html += '  <p class="cs-section-text">' + sec.text + '</p>';
          html += '</div>';
        });
      }

      html += '<div class="cs-actions-row">';
      if (data.liveUrl) {
        html += '<a href="' + data.liveUrl + '" target="_blank" rel="noopener" class="cs-action-btn cs-btn-primary"><span>Launch Live Demo</span> &nearr;</a>';
      }
      if (data.githubUrl) {
        html += '<a href="' + data.githubUrl + '" target="_blank" rel="noopener" class="cs-action-btn cs-btn-secondary"><span>View Repository / Work</span> &nearr;</a>';
      }
      html += '</div>';

      csContent.innerHTML = html;
    }

    csDrawer.classList.add('open');
    csDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    playMicroClick(920, 0.04, 0.06);
  }

  function closeCaseStudy() {
    if (!csDrawer) return;
    csDrawer.classList.remove('open');
    csDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    playMicroClick(480, 0.02, 0.03);
  }

  if (csCloseBtn) {
    csCloseBtn.addEventListener('click', closeCaseStudy);
  }

  if (csDrawer) {
    csDrawer.addEventListener('click', function (e) {
      if (e.target === csDrawer) {
        closeCaseStudy();
      }
    });
  }

  // Hook up case study triggers
  document.querySelectorAll('[data-study]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      const studyId = trigger.getAttribute('data-study');
      if (studyId) {
        e.preventDefault();
        e.stopPropagation();
        openCaseStudy(studyId);
      }
    });
  });

  // Handle Resume Action
  function handleResumeDownload() {
    showToast('📄 Downloading Sujal Phapale\'s Resume (PDF)...');
    playMicroClick(1050, 0.03, 0.05);
    const link = document.createElement('a');
    link.href = 'assets/docs/Sujal_Phapale_Resume.pdf';
    link.download = 'Sujal_Phapale_Resume.pdf';
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const heroResumeBtn = document.getElementById('hero-resume-btn');
  if (heroResumeBtn) {
    heroResumeBtn.addEventListener('click', function () {
      showToast('📄 Downloading Sujal Phapale\'s Resume (PDF)...');
      playMicroClick(1050, 0.03, 0.05);
    });
  }

  // ──────────── GLOBAL COMMAND PALETTE ENGINE (CTRL + K) ────────────
  const cmdPalette = document.getElementById('cmd-palette');
  const cmdInput = document.getElementById('cmd-input');
  const cmdResults = document.getElementById('cmd-results');
  const cmdTriggerBtn = document.getElementById('cmd-trigger-btn');
  const cmdCloseBtn = document.getElementById('cmd-close-btn');

  let selectedCmdIndex = 0;
  let activeFilteredCommands = [];

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const commandList = [
    { id: 'nav-lab', title: '01 3D Geometry Lab', group: 'Navigation', icon: '◈', badge: 'Section', action: function () { scrollToSection('lab'); } },
    { id: 'nav-works', title: '02 Featured Projects', group: 'Navigation', icon: '❖', badge: 'Section', action: function () { scrollToSection('works'); } },
    { id: 'nav-gallery', title: '03 3D Art & Animation', group: 'Navigation', icon: '✦', badge: 'Section', action: function () { scrollToSection('blender-gallery'); } },
    { id: 'nav-capabilities', title: '04 Technical Skills', group: 'Navigation', icon: '⚙', badge: 'Section', action: function () { scrollToSection('capabilities'); } },
    { id: 'nav-philosophy', title: '05 About & Philosophy', group: 'Navigation', icon: '◎', badge: 'Section', action: function () { scrollToSection('philosophy'); } },
    { id: 'nav-contact', title: '06 Contact & Inquiries', group: 'Navigation', icon: '✉', badge: 'Section', action: function () { scrollToSection('contact'); } },
    { id: 'cs-future-you', title: 'Case Study: Future-You Web App', group: 'Case Studies', icon: '✦', badge: 'Next.js', action: function () { openCaseStudy('future-you'); } },
    { id: 'cs-rag', title: 'Case Study: RAG Document Chatbot', group: 'Case Studies', icon: '✦', badge: 'AI/LLM', action: function () { openCaseStudy('rag-chatbot'); } },
    { id: 'cs-skulls', title: 'Case Study: Chrome Skulls Lookdev', group: 'Case Studies', icon: '✦', badge: 'Blender', action: function () { openCaseStudy('chrome-skulls'); } },
    { id: 'cs-crimerate', title: 'Case Study: CrimeRate AI Platform', group: 'Case Studies', icon: '✦', badge: 'ML/Python', action: function () { openCaseStudy('crime-rate-ai'); } },
    { id: 'act-resume', title: 'Download Sujal Phapale\'s Resume (PDF)', group: 'Actions', icon: '📄', badge: 'Resume', action: handleResumeDownload },
    { id: 'act-copy-email', title: 'Copy Email Address', group: 'Actions', icon: '📋', badge: 'Clipboard', action: function () { copyTextToClipboard('sujalphapale95@gmail.com', 'Copied: sujalphapale95@gmail.com'); } },
    { id: 'act-ambient', title: 'Toggle Ambient Hero Video', group: 'Actions', icon: '🎬', badge: 'Backdrop', action: function () { toggleAmbientVideo(); } },
    { id: 'act-sound', title: 'Toggle Synthesizer Sound FX', group: 'Actions', icon: '🔊', badge: 'Web Audio', action: function () {
      if (soundToggle) soundToggle.click();
      else {
        initAudio();
        audioEnabled = !audioEnabled;
        showToast(audioEnabled ? 'Audio FX Enabled' : 'Audio FX Muted');
      }
    }},
    { id: 'link-github', title: 'View GitHub Repositories', group: 'Links', icon: '↗', badge: 'External', action: function () { window.open('https://github.com', '_blank'); } },
    { id: 'link-linkedin', title: 'View LinkedIn Profile', group: 'Links', icon: '↗', badge: 'External', action: function () { window.open('https://linkedin.com', '_blank'); } }
  ];

  function openCommandPalette() {
    if (!cmdPalette) return;
    cmdPalette.classList.add('open');
    cmdPalette.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (cmdInput) {
      cmdInput.value = '';
      cmdInput.focus();
    }
    selectedCmdIndex = 0;
    renderCommandResults('');
    playMicroClick(1000, 0.03, 0.04);
  }

  function closeCommandPalette() {
    if (!cmdPalette) return;
    cmdPalette.classList.remove('open');
    cmdPalette.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    playMicroClick(500, 0.02, 0.03);
  }

  function toggleCommandPalette() {
    if (cmdPalette && cmdPalette.classList.contains('open')) closeCommandPalette();
    else openCommandPalette();
  }

  function renderCommandResults(query) {
    if (!cmdResults) return;
    const q = query.trim().toLowerCase();

    activeFilteredCommands = commandList.filter(function (cmd) {
      if (!q) return true;
      return cmd.title.toLowerCase().indexOf(q) !== -1 ||
             cmd.group.toLowerCase().indexOf(q) !== -1 ||
             cmd.badge.toLowerCase().indexOf(q) !== -1;
    });

    if (activeFilteredCommands.length === 0) {
      cmdResults.innerHTML = '<div class="cmd-empty-msg">No matching commands or destinations found.</div>';
      return;
    }

    if (selectedCmdIndex >= activeFilteredCommands.length) {
      selectedCmdIndex = 0;
    }

    const groups = {};
    activeFilteredCommands.forEach(function (cmd, idx) {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push({ cmd: cmd, globalIdx: idx });
    });

    let html = '';
    Object.keys(groups).forEach(function (groupName) {
      html += '<div class="cmd-group-label">' + groupName + '</div>';
      groups[groupName].forEach(function (item) {
        const isSelected = item.globalIdx === selectedCmdIndex;
        html += '<div class="cmd-item' + (isSelected ? ' selected' : '') + '" data-idx="' + item.globalIdx + '">';
        html += '  <div class="cmd-item-left">';
        html += '    <span class="cmd-item-icon">' + item.cmd.icon + '</span>';
        html += '    <span class="cmd-item-title">' + item.cmd.title + '</span>';
        html += '  </div>';
        html += '  <span class="cmd-item-badge">' + item.cmd.badge + '</span>';
        html += '</div>';
      });
    });

    cmdResults.innerHTML = html;

    const renderedItems = cmdResults.querySelectorAll('.cmd-item');
    renderedItems.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && idx !== selectedCmdIndex) {
          selectedCmdIndex = idx;
          updateSelectionHighlight();
          playMicroClick(1150, 0.015, 0.02);
        }
      });
      el.addEventListener('click', function () {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        executeCommand(idx);
      });
    });

    const selectedEl = cmdResults.querySelector('.cmd-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function updateSelectionHighlight() {
    if (!cmdResults) return;
    const items = cmdResults.querySelectorAll('.cmd-item');
    items.forEach(function (el) {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      el.classList.toggle('selected', idx === selectedCmdIndex);
    });
    const selectedEl = cmdResults.querySelector('.cmd-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function executeCommand(idx) {
    if (idx >= 0 && idx < activeFilteredCommands.length) {
      const targetCmd = activeFilteredCommands[idx];
      closeCommandPalette();
      playMicroClick(1200, 0.04, 0.06);
      setTimeout(function () {
        targetCmd.action();
      }, 120);
    }
  }

  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }

    if (e.key === '/' && !cmdPalette.classList.contains('open')) {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        openCommandPalette();
        return;
      }
    }

    if (e.key === 'Escape' && csDrawer && csDrawer.classList.contains('open')) {
      e.preventDefault();
      closeCaseStudy();
      return;
    }

    if (cmdPalette && cmdPalette.classList.contains('open')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeFilteredCommands.length > 0) {
          selectedCmdIndex = (selectedCmdIndex + 1) % activeFilteredCommands.length;
          updateSelectionHighlight();
          playMicroClick(1100, 0.015, 0.02);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeFilteredCommands.length > 0) {
          selectedCmdIndex = (selectedCmdIndex - 1 + activeFilteredCommands.length) % activeFilteredCommands.length;
          updateSelectionHighlight();
          playMicroClick(1100, 0.015, 0.02);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeCommand(selectedCmdIndex);
      }
    }
  });

  if (cmdInput) {
    cmdInput.addEventListener('input', function () {
      selectedCmdIndex = 0;
      renderCommandResults(cmdInput.value);
    });
  }

  if (cmdTriggerBtn) {
    cmdTriggerBtn.addEventListener('click', openCommandPalette);
  }

  if (cmdCloseBtn) {
    cmdCloseBtn.addEventListener('click', closeCommandPalette);
  }

  if (cmdPalette) {
    cmdPalette.addEventListener('click', function (e) {
      if (e.target === cmdPalette) {
        closeCommandPalette();
      }
    });
  }

  // Attach micro sounds to all interactive elements
  attachMicroSounds();

  // Force geometry synchronisation after fonts & stylesheets finish rendering
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      window.dispatchEvent(new Event('resize'));
    });
  }
  window.addEventListener('load', function () {
    window.dispatchEvent(new Event('resize'));
  });
})();
