/* =========================================================================
   Volume3D — version un seul fichier.

   Le HTML et la feuille de style viennent du site réel, extraits tels quels.
   Ce script rend vivant ce qu'un fichier statique ne peut pas rendre seul :
   le viewer 360°, la marche dans le volume reconstruit depuis le plan, la
   navigation entre les écrans, l'assistant et le questionnaire.

   Aucune bibliothèque : le viewer panoramique est un shader de vingt lignes
   — pour chaque pixel on calcule la direction du regard et on va lire la
   couleur correspondante dans l'image équirectangulaire. Charger un moteur
   3D complet pour ça coûterait un mégaoctet et ne ferait rien de plus.
   ========================================================================= */

(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var A = window.V3D_ASSETS || {};
  var DATA = window.V3D_DATA || {};

  /* ----------------------------------------------------------- utilitaires */

  function el(sel, root) { return (root || document).querySelector(sel); }
  function els(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ------------------------------------------------------------- écrans -- */

  var SCREENS = ['accueil', 'visite', 'tableau', 'espace'];

  function show(name, anchor) {
    if (SCREENS.indexOf(name) === -1) name = 'accueil';
    SCREENS.forEach(function (s) {
      var node = document.getElementById('ec-' + s);
      if (node) node.hidden = s !== name;
    });
    els('[data-goto]').forEach(function (b) {
      b.setAttribute('aria-current', b.dataset.goto === name ? 'page' : 'false');
    });
    els('.v3d-switch button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.screen === name);
    });
    window.scrollTo(0, 0);
    if (anchor) {
      var target = document.getElementById(anchor);
      if (target) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth' }); }, 60);
    }
    // Les viewers d'un écran caché ne tournent pas : on les réveille au retour.
    VIEWERS.forEach(function (v) { v.setActive(document.getElementById('ec-' + name).contains(v.node)); });
  }

  document.addEventListener('click', function (event) {
    var go = event.target.closest('[data-goto]');
    if (go) {
      event.preventDefault();
      show(go.dataset.goto, go.dataset.anchor || '');
      return;
    }
    var sw = event.target.closest('.v3d-switch button');
    if (sw) { show(sw.dataset.screen); }
  });

  /* ------------------------------------------------- panorama équirect --- */

  var PANO_VS =
    'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.,1.);}';

  /* Pour chaque pixel : la direction du regard, puis la couleur de l'image
     équirectangulaire dans cette direction. `yaw - PI/2` reprend la même
     correction d'origine que le site (lib/demo.ts, fonction `facing`). */
  var PANO_FS = [
    'precision highp float;',
    'varying vec2 uv;',
    'uniform sampler2D img;',
    'uniform vec2 res;',
    'uniform float yaw, pitch, fov;',
    'const float PI = 3.14159265359;',
    'void main(){',
    '  float t = tan(fov * 0.5);',
    '  float aspect = res.x / res.y;',
    '  vec3 f = vec3(cos(pitch)*sin(yaw), sin(pitch), -cos(pitch)*cos(yaw));',
    '  vec3 r = vec3(cos(yaw), 0.0, sin(yaw));',
    '  vec3 u = cross(r, f);',
    '  vec3 d = normalize(f + uv.x * aspect * t * r + uv.y * t * u);',
    '  float a = atan(d.x, -d.z) - PI * 0.5;',
    '  float s = fract(a / (2.0 * PI));',
    '  float v = 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI;',
    '  gl_FragColor = texture2D(img, vec2(s, v));',
    '}',
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'shader');
    }
    return sh;
  }

  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'link');
    }
    return p;
  }

  var VIEWERS = [];

  /**
   * Viewer panoramique.
   *
   * `rooms` : [{ id, name, url, yaw, pitch, hotspots: [{ to, label, yaw, pitch }] }]
   */
  function Pano(node, rooms, opts) {
    opts = opts || {};
    var self = this;
    this.node = node;
    this.rooms = rooms;
    this.index = 0;
    this.active = true;

    var holder = el('[class*="canvasHolder"]', node) || node;
    var canvas = el('canvas', holder);
    if (!canvas) { canvas = document.createElement('canvas'); holder.appendChild(canvas); }
    canvas.removeAttribute('data-engine');
    this.canvas = canvas;

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { node.classList.add('v3d-nogl'); return; }
    this.gl = gl;

    var prog = program(gl, PANO_VS, PANO_FS);
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {
      res: gl.getUniformLocation(prog, 'res'),
      yaw: gl.getUniformLocation(prog, 'yaw'),
      pitch: gl.getUniformLocation(prog, 'pitch'),
      fov: gl.getUniformLocation(prog, 'fov'),
    };

    this.tex = {};
    this.fov = 75;
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.fade = 0;

    this.nameNode = el('[class*="sceneName"]', node);
    this.chips = els('[class*="roomChip"]', node);
    // Le nom de la classe « pièce active » est généré par le build du site :
    // on le relève sur la pastille déjà active plutôt que de le coder en dur.
    var activeChip = this.chips.filter(function (c) { return /roomChipActive/.test(c.className); })[0];
    this.activeClass = activeChip
      ? (activeChip.className.match(/\S*roomChipActive\S*/) || ['v3d-chip-on'])[0]
      : 'v3d-chip-on';
    this.hotspot = el('[class*="hotspot"]', node);
    this.mask = el('[class*="fadeMask"]', node);
    this.hint = el('[class*="hint"]', node);

    // Le bandeau des pièces du site est en place : on lui rebranche ses clics.
    this.chips.forEach(function (chip, i) {
      chip.addEventListener('click', function () { self.go(i); });
    });

    // Les points de passage sont recréés : leur position dépend du regard.
    this.hotspotNodes = [];
    if (this.hotspot) this.hotspot.remove();
    this.buildHotspots();

    var full = el('[class*="iconBtn"]', node);
    if (full) {
      full.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (node.requestFullscreen) node.requestFullscreen();
      });
    }

    this.bindPointer();
    this.load(0, true);
    VIEWERS.push(this);
    this.loop();
  }

  Pano.prototype.setActive = function (on) { this.active = on; };

  Pano.prototype.buildHotspots = function () {
    var self = this;
    this.hotspotNodes.forEach(function (n) { n.remove(); });
    this.hotspotNodes = [];
    var room = this.rooms[this.index];
    (room.hotspots || []).forEach(function (h) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'v3d-hotspot';
      b.innerHTML = '<span class="v3d-ring">↗</span><span class="v3d-label">' + h.label + '</span>';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = self.rooms.findIndex(function (r) { return r.id === h.to; });
        if (i >= 0) self.go(i);
      });
      b._h = h;
      self.node.appendChild(b);
      self.hotspotNodes.push(b);
    });
  };

  Pano.prototype.load = function (i, immediate) {
    var self = this;
    var room = this.rooms[i];
    this.index = i;
    if (this.nameNode) this.nameNode.textContent = room.name;
    this.chips.forEach(function (chip, k) {
      chip.classList.toggle(self.activeClass, k === i);
    });
    this.targetYaw = room.yaw * DEG;
    this.targetPitch = (room.pitch || 0) * DEG;
    if (immediate) { this.yaw = this.targetYaw; this.pitch = this.targetPitch; }
    this.buildHotspots();

    if (this.tex[room.id]) { this.current = this.tex[room.id]; return; }
    var img = new Image();
    img.onload = function () {
      var gl = self.gl;
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      self.tex[room.id] = t;
      if (self.rooms[self.index].id === room.id) self.current = t;
      self.node.classList.add('v3d-ready');
    };
    img.src = A[room.url] || room.url;
  };

  Pano.prototype.go = function (i) {
    if (i === this.index) return;
    this.fade = 1;
    this.load(i, false);
    if (this.hint) this.hint.style.opacity = '0';
  };

  Pano.prototype.bindPointer = function () {
    var self = this;
    var dragging = false, lastX = 0, lastY = 0, moved = 0;
    var node = this.node;

    function down(x, y) { dragging = true; lastX = x; lastY = y; moved = 0; node.classList.add('v3d-drag'); }
    function move(x, y) {
      if (!dragging) return;
      var dx = x - lastX, dy = y - lastY;
      lastX = x; lastY = y;
      moved += Math.abs(dx) + Math.abs(dy);
      // Le déplacement est rapporté à la largeur : le geste a le même effet
      // sur un téléphone et sur un écran large.
      var k = (self.fov * DEG) / self.canvas.clientWidth;
      self.targetYaw -= dx * k;
      self.targetPitch = clamp(self.targetPitch + dy * k, -85 * DEG, 85 * DEG);
      if (self.hint && moved > 40) self.hint.style.opacity = '0';
    }
    function up() { dragging = false; node.classList.remove('v3d-drag'); }

    node.addEventListener('mousedown', function (e) { e.preventDefault(); down(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', up);
    node.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      down(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    node.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    node.addEventListener('touchend', up);
    node.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.fov = clamp(self.fov + (e.deltaY > 0 ? 3 : -3), 38, 100);
    }, { passive: false });
  };

  Pano.prototype.project = function (yawDeg, pitchDeg) {
    // Direction du point, puis passage dans le repère de la caméra.
    var y = yawDeg * DEG, p = pitchDeg * DEG;
    var d = [Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y)];
    var cy = this.yaw, cp = this.pitch;
    var f = [Math.cos(cp) * Math.sin(cy), Math.sin(cp), -Math.cos(cp) * Math.cos(cy)];
    var r = [Math.cos(cy), 0, Math.sin(cy)];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    var dz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (dz <= 0.05) return null;
    var dx = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
    var dy = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    var t = Math.tan(this.fov * DEG * 0.5);
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    var aspect = w / h;
    var sx = (dx / dz) / (t * aspect);
    var sy = (dy / dz) / t;
    if (Math.abs(sx) > 1.25 || Math.abs(sy) > 1.25) return null;
    return { x: (sx * 0.5 + 0.5) * w, y: (0.5 - sy * 0.5) * h };
  };

  Pano.prototype.loop = function () {
    var self = this;
    function frame() {
      requestAnimationFrame(frame);
      if (!self.active || !self.gl) return;
      var c = self.canvas;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (!w || !h) return;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }

      // Amorti : le regard rejoint sa cible sans à-coup.
      self.yaw += (self.targetYaw - self.yaw) * 0.16;
      self.pitch += (self.targetPitch - self.pitch) * 0.16;
      if (self.fade > 0) {
        self.fade = Math.max(0, self.fade - 0.06);
        if (self.mask) self.mask.style.opacity = String(self.fade);
      }

      var gl = self.gl;
      gl.viewport(0, 0, w, h);
      if (!self.current) { gl.clearColor(0.09, 0.08, 0.07, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
      gl.bindTexture(gl.TEXTURE_2D, self.current);
      gl.uniform2f(self.u.res, w, h);
      gl.uniform1f(self.u.yaw, self.yaw);
      gl.uniform1f(self.u.pitch, self.pitch);
      gl.uniform1f(self.u.fov, self.fov * DEG);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      self.hotspotNodes.forEach(function (n) {
        var q = self.project(n._h.yaw, n._h.pitch);
        if (!q) { n.style.display = 'none'; return; }
        n.style.display = '';
        n.style.left = q.x + 'px';
        n.style.top = q.y + 'px';
      });
    }
    frame();
  };

  /* ------------------------------------------ marche dans le volume 3D --- */

  /* Géométrie reprise de lib/plan.ts : mêmes règles, même marge de 35 cm. */

  function roomWalls(room) {
    var pts = room.points, out = [];
    for (var i = 0; i < pts.length; i++) out.push([pts[i], pts[(i + 1) % pts.length]]);
    return out;
  }

  /**
   * Aire signée du contour. Son signe donne le sens de parcours, dont dépend
   * le côté « intérieur » de chaque mur. Le supposer conduit à des normales
   * retournées : ombrage inversé et photos accrochées face au mur.
   */
  function signedArea(room) {
    var pts = room.points, sum = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
  }

  function containsPoint(room, p) {
    var pts = room.points, inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  }

  function distToSeg(p, seg) {
    var a = seg[0], b = seg[1];
    var vx = b.x - a.x, vy = b.y - a.y;
    var len = vx * vx + vy * vy;
    var t = len === 0 ? 0 : clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / len, 0, 1);
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  }

  function canStandAt(room, p, margin) {
    if (!containsPoint(room, p)) return false;
    return roomWalls(room).every(function (w) { return distToSeg(p, w) >= margin; });
  }

  /** Un mouvement qui bute contre un mur glisse le long au lieu de se bloquer. */
  function slideMove(room, from, to, margin) {
    if (canStandAt(room, to, margin)) return to;
    var ax = { x: to.x, y: from.y };
    if (canStandAt(room, ax, margin)) return ax;
    var ay = { x: from.x, y: to.y };
    if (canStandAt(room, ay, margin)) return ay;
    return from;
  }

  /** Avance aussi loin que possible vers un point hors d'atteinte. */
  function reachableToward(room, from, to, margin) {
    if (!canStandAt(room, from, margin)) return null;
    if (canStandAt(room, to, margin)) return to;
    var lo = 0, hi = 1;
    for (var i = 0; i < 18; i++) {
      var mid = (lo + hi) / 2;
      var p = { x: from.x + (to.x - from.x) * mid, y: from.y + (to.y - from.y) * mid };
      if (canStandAt(room, p, margin)) lo = mid; else hi = mid;
    }
    if (lo < 0.02) return null;
    return { x: from.x + (to.x - from.x) * lo, y: from.y + (to.y - from.y) * lo };
  }

  /** Projette une ouverture sur un mur : position le long, et largeur. */
  function projectOnWall(wall, door) {
    var a = wall[0], b = wall[1];
    var vx = b.x - a.x, vy = b.y - a.y;
    var len = Math.hypot(vx, vy);
    if (len === 0) return null;
    var ux = vx / len, uy = vy / len;
    function on(p) {
      var t = (p.x - a.x) * ux + (p.y - a.y) * uy;
      var d = Math.abs((p.x - a.x) * -uy + (p.y - a.y) * ux);
      return { t: t, d: d };
    }
    var pa = on(door.a), pb = on(door.b);
    if (pa.d > 0.25 || pb.d > 0.25) return null;
    var s = Math.max(0, Math.min(pa.t, pb.t));
    var e = Math.min(len, Math.max(pa.t, pb.t));
    if (e - s < 0.1) return null;
    return { start: s, end: e, height: door.height, sill: door.sill || 0 };
  }

  /** Portions pleines d'un mur : le complément des ouvertures. */
  function solidSpans(length, gaps) {
    var sorted = gaps.slice().sort(function (m, n) { return m.start - n.start; });
    var out = [], cursor = 0;
    sorted.forEach(function (g) {
      if (g.start > cursor) out.push([cursor, g.start]);
      cursor = Math.max(cursor, g.end);
    });
    if (cursor < length) out.push([cursor, length]);
    return out;
  }

  /* --- petite algèbre matricielle, juste ce qu'il faut --- */

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }

  function lookAt(eye, center, up) {
    var z = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]];
    var zl = Math.hypot(z[0], z[1], z[2]) || 1;
    z = [z[0] / zl, z[1] / zl, z[2] / zl];
    var x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
    var xl = Math.hypot(x[0], x[1], x[2]) || 1;
    x = [x[0] / xl, x[1] / xl, x[2] / xl];
    var y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
      1,
    ];
  }

  function multiply(a, b) {
    var out = new Array(16);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        out[i * 4 + j] = s;
      }
    }
    return out;
  }

  var PLAN_VS = [
    'attribute vec3 pos; attribute vec3 nrm; attribute vec2 tex;',
    'uniform mat4 mvp;',
    'varying vec3 vN; varying vec2 vT; varying vec3 vP;',
    'void main(){ vN = nrm; vT = tex; vP = pos; gl_Position = mvp * vec4(pos, 1.0); }',
  ].join('\n');

  var PLAN_FS = [
    'precision highp float;',
    'varying vec3 vN; varying vec2 vT; varying vec3 vP;',
    'uniform sampler2D img;',
    'uniform float useTex;',
    'uniform vec3 tint;',
    'void main(){',
    // Lumière douce venant du haut, plus une composante latérale pour que
    // deux murs perpendiculaires ne se confondent pas.
    '  float lambert = 0.86 + 0.14 * max(vN.y, 0.0) + 0.10 * abs(vN.x) - 0.04 * abs(vN.z) - 0.06 * max(-vN.y, 0.0);',
    '  vec3 base = useTex > 0.5 ? texture2D(img, vT).rgb : tint;',
    '  gl_FragColor = vec4(base * lambert, 1.0);',
    '}',
  ].join('\n');

  /* Le ciel qu'on aperçoit par les fenêtres. Un aplat bleu se voit tout de
     suite pour ce qu'il est : un trou dans le mur. Un dégradé, même simple,
     donne la lumière du jour — c'est le rôle du dôme de ciel du viewer réel. */
  var SKY_VS = 'attribute vec2 p;varying float h;void main(){h=p.y*0.5+0.5;gl_Position=vec4(p,0.999,1.);}';
  var SKY_FS = [
    'precision mediump float;',
    'varying float h;',
    'void main(){',
    '  vec3 zenith = vec3(0.42, 0.62, 0.86);',
    '  vec3 horizon = vec3(0.90, 0.93, 0.95);',
    '  gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.75)), 1.0);',
    '}',
  ].join('\n');

  function PlanWalk(node, plan, doors, photos) {
    var self = this;
    this.node = node;
    this.plan = plan;
    this.doors = doors;
    this.photos = photos;
    this.roomIndex = 0;
    this.active = true;

    var canvas = document.createElement('canvas');
    canvas.className = 'v3d-plan-canvas';
    node.appendChild(canvas);
    this.canvas = canvas;

    var gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) { node.classList.add('v3d-nogl'); return; }
    this.gl = gl;
    gl.enable(gl.DEPTH_TEST);

    this.prog = program(gl, PLAN_VS, PLAN_FS);
    gl.useProgram(this.prog);
    this.attr = {
      pos: gl.getAttribLocation(this.prog, 'pos'),
      nrm: gl.getAttribLocation(this.prog, 'nrm'),
      tex: gl.getAttribLocation(this.prog, 'tex'),
    };
    this.uni = {
      mvp: gl.getUniformLocation(this.prog, 'mvp'),
      useTex: gl.getUniformLocation(this.prog, 'useTex'),
      tint: gl.getUniformLocation(this.prog, 'tint'),
      img: gl.getUniformLocation(this.prog, 'img'),
    };

    this.sky = program(gl, SKY_VS, SKY_FS);
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.skyAttr = gl.getAttribLocation(this.sky, 'p');

    this.textures = {};
    this.build();
    this.enterRoom(0);
    this.bind();
    this.loop();
    VIEWERS.push(this);
  }

  PlanWalk.prototype.setActive = function (on) { this.active = on; };

  /** Construit le volume : sols, plafonds, murs percés, photos sur les murs. */
  PlanWalk.prototype.build = function () {
    var self = this;
    var gl = this.gl;
    this.pieces = [];

    var SURFACE = {
      floor: [0.68, 0.56, 0.43],
      ceiling: [0.98, 0.98, 0.97],
      wall: [0.95, 0.94, 0.92],
    };

    this.plan.rooms.forEach(function (room) {
      var verts = [];
      function tri(a, b, c, n, uv) {
        [a, b, c].forEach(function (p, i) {
          verts.push(p[0], p[1], p[2], n[0], n[1], n[2], uv ? uv[i][0] : 0, uv ? uv[i][1] : 0);
        });
      }
      var pts = room.points;
      var h = room.height || 2.5;
      var winding = signedArea(room) > 0 ? 1 : -1;

      // Sol puis plafond, chacun d'un seul tenant : deux éventails depuis le
      // premier sommet (les pièces d'un plan sont convexes). Les deux lots
      // restent séparés, sans quoi le plafond hériterait de la teinte du sol.
      var i;
      for (i = 1; i < pts.length - 1; i++) {
        tri([pts[0].x, 0, pts[0].y], [pts[i].x, 0, pts[i].y], [pts[i + 1].x, 0, pts[i + 1].y], [0, 1, 0]);
      }
      var floorCount = verts.length / 8;
      for (i = 1; i < pts.length - 1; i++) {
        tri([pts[0].x, h, pts[0].y], [pts[i + 1].x, h, pts[i + 1].y], [pts[i].x, h, pts[i].y], [0, -1, 0]);
      }
      var ceilCount = verts.length / 8 - floorCount;

      // Murs : on retire les ouvertures, on remet linteaux et allèges.
      var wallVerts = [];
      function quad(target, ax, az, bx, bz, y0, y1, n) {
        var v = [
          [ax, y0, az], [bx, y0, bz], [bx, y1, bz],
          [ax, y0, az], [bx, y1, bz], [ax, y1, az],
        ];
        v.forEach(function (p) { target.push(p[0], p[1], p[2], n[0], n[1], n[2], 0, 0); });
      }

      roomWalls(room).forEach(function (wall) {
        var a = wall[0], b = wall[1];
        var len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 0.01) return;
        var ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        // Normale rentrante : la gauche du sens de parcours si le contour est
        // décrit dans le sens direct, la droite sinon.
        var n = [-uy * winding, 0, ux * winding];
        var gaps = [];
        self.doors.forEach(function (door) {
          if (door.from !== room.id && door.to !== room.id) return;
          var g = projectOnWall(wall, door);
          if (g) gaps.push(g);
        });
        var at = function (t) { return [a.x + ux * t, a.y + uy * t]; };
        solidSpans(len, gaps).forEach(function (span) {
          var p0 = at(span[0]), p1 = at(span[1]);
          quad(wallVerts, p0[0], p0[1], p1[0], p1[1], 0, h, n);
        });
        gaps.forEach(function (g) {
          var p0 = at(g.start), p1 = at(g.end);
          if (g.height < h) quad(wallVerts, p0[0], p0[1], p1[0], p1[1], g.height, h, n);
          if (g.sill > 0) quad(wallVerts, p0[0], p0[1], p1[0], p1[1], 0, g.sill, n);
        });
      });

      var all = verts.concat(wallVerts);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all), gl.STATIC_DRAW);

      var parts = [
        { start: 0, count: floorCount, tint: SURFACE.floor },
        { start: floorCount, count: ceilCount, tint: SURFACE.ceiling },
        { start: floorCount + ceilCount, count: wallVerts.length / 8, tint: SURFACE.wall },
      ];

      // Photos accrochées sur les murs de cette pièce.
      var photoParts = [];
      self.photos.filter(function (p) { return p.roomId === room.id; }).forEach(function (photo) {
        var walls = roomWalls(room);
        var wall = walls[clamp(photo.wallIndex || 0, 0, walls.length - 1)];
        var a = wall[0], b = wall[1];
        var len = Math.hypot(b.x - a.x, b.y - a.y);
        var ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        var nx = -uy * winding, nz = ux * winding;
        var w = Math.min(2.0, len * 0.62), hh = w * 0.62;
        var mid = 0.5 * len;
        var y0 = 1.55 - hh / 2, y1 = y0 + hh;
        var off = 0.03;
        var s0 = [a.x + ux * (mid - w / 2) + nx * off, a.y + uy * (mid - w / 2) + nz * off];
        var s1 = [a.x + ux * (mid + w / 2) + nx * off, a.y + uy * (mid + w / 2) + nz * off];
        var pv = [];
        // `UNPACK_FLIP_Y_WEBGL` place déjà v = 0 en bas de l'image : les coins
        // bas du cadre prennent donc v = 0, sans quoi la photo est retournée.
        var quadUV = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
        var corners = [
          [s0[0], y0, s0[1]], [s1[0], y0, s1[1]], [s1[0], y1, s1[1]],
          [s0[0], y0, s0[1]], [s1[0], y1, s1[1]], [s0[0], y1, s0[1]],
        ];
        corners.forEach(function (p, i) {
          pv.push(p[0], p[1], p[2], nx, 0, nz, quadUV[i][0], quadUV[i][1]);
        });
        var pbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pv), gl.STATIC_DRAW);
        photoParts.push({
          buffer: pbuf, count: 6, url: photo.url,
          center: { x: (s0[0] + s1[0]) / 2, y: (s0[1] + s1[1]) / 2 },
        });
        self.loadTexture(photo.url);
      });

      self.pieces.push({ room: room, buffer: buf, parts: parts, photos: photoParts, height: h });
    });
  };

  PlanWalk.prototype.loadTexture = function (url) {
    var self = this, gl = this.gl;
    if (this.textures[url]) return;
    var img = new Image();
    img.onload = function () {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      self.textures[url] = t;
    };
    img.src = A[url] || url;
  };

  PlanWalk.prototype.enterRoom = function (i) {
    var piece = this.pieces[i];
    if (!piece) return;
    this.roomIndex = i;
    var pts = piece.room.points;
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p.x; cy += p.y; });
    this.pos = { x: cx / pts.length, y: cy / pts.length };
    this.walkTo = null;

    // On n'ouvre pas sur un mur nu : on se tourne vers la photo accrochée dans
    // la pièce, à défaut vers le mur le plus long — celui qui donne la
    // profondeur. Même intention que les caps d'ouverture d'un panorama.
    var look = piece.photos.length ? piece.photos[0].center : null;
    if (!look) {
      var longest = null, best = 0;
      roomWalls(piece.room).forEach(function (w) {
        var d = Math.hypot(w[1].x - w[0].x, w[1].y - w[0].y);
        if (d > best) { best = d; longest = w; }
      });
      if (longest) look = { x: (longest[0].x + longest[1].x) / 2, y: (longest[0].y + longest[1].y) / 2 };
    }
    var yaw = 0;
    if (look) yaw = Math.atan2(look.x - this.pos.x, -(look.y - this.pos.y));
    this.yaw = yaw;
    this.pitch = -4 * DEG;
    this.targetYaw = yaw;
    this.targetPitch = -4 * DEG;
    var self = this;
    els('.v3d-plan-chip', this.node).forEach(function (c, k) { c.classList.toggle('on', k === i); });
    var label = el('.v3d-plan-name', this.node);
    if (label) label.textContent = piece.room.name;
  };

  PlanWalk.prototype.bind = function () {
    var self = this;
    var node = this.node, canvas = this.canvas;
    var dragging = false, lastX = 0, lastY = 0, moved = 0;

    canvas.addEventListener('mousedown', function (e) {
      e.preventDefault(); dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0;
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      self.targetYaw -= dx * 0.0042;
      self.targetPitch = clamp(self.targetPitch - dy * 0.0035, -60 * DEG, 60 * DEG);
    });
    window.addEventListener('mouseup', function () { dragging = false; });

    canvas.addEventListener('click', function (e) {
      if (moved > 8) return;
      self.tap(e.clientX, e.clientY);
    });

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; moved = 0;
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1 || !dragging) return;
      e.preventDefault();
      var dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      self.targetYaw -= dx * 0.0052;
      self.targetPitch = clamp(self.targetPitch - dy * 0.0042, -60 * DEG, 60 * DEG);
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      dragging = false;
      if (moved > 10) return;
      var t = e.changedTouches[0];
      if (t) self.tap(t.clientX, t.clientY);
    });

    this.keys = {};
    window.addEventListener('keydown', function (e) { self.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', function (e) { self.keys[e.key.toLowerCase()] = false; });
  };

  /** Un appui sur le sol : on marche vers ce point, autant que le mur permet. */
  PlanWalk.prototype.tap = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    var sx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var sy = 1 - ((clientY - rect.top) / rect.height) * 2;
    var t = Math.tan(this.fovY() / 2);
    var aspect = rect.width / rect.height;
    var cy = this.yaw, cp = this.pitch;
    var f = [Math.cos(cp) * Math.sin(cy), Math.sin(cp), -Math.cos(cp) * Math.cos(cy)];
    var r = [Math.cos(cy), 0, Math.sin(cy)];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    var d = [
      f[0] + sx * aspect * t * r[0] + sy * t * u[0],
      f[1] + sx * aspect * t * r[1] + sy * t * u[1],
      f[2] + sx * aspect * t * r[2] + sy * t * u[2],
    ];
    if (d[1] >= -0.02) return; // on ne vise pas le sol
    var eye = 1.62;
    var k = -eye / d[1];
    var target = { x: this.pos.x + d[0] * k, y: this.pos.y + d[2] * k };
    var room = this.pieces[this.roomIndex].room;
    var reach = reachableToward(room, this.pos, target, 0.35);
    if (reach) this.walkTo = reach;
  };

  PlanWalk.prototype.fovY = function () { return 70 * DEG; };

  PlanWalk.prototype.step = function () {
    var room = this.pieces[this.roomIndex].room;
    var speed = 0.045;
    var move = { x: 0, y: 0 };
    var k = this.keys;
    var fwd = k['z'] || k['w'] || k['arrowup'] ? 1 : k['s'] || k['arrowdown'] ? -1 : 0;
    var side = k['d'] || k['arrowright'] ? 1 : k['q'] || k['a'] || k['arrowleft'] ? -1 : 0;

    if (fwd || side) {
      this.walkTo = null;
      var sy = Math.sin(this.yaw), cy2 = Math.cos(this.yaw);
      move.x = (sy * fwd + cy2 * side) * speed * 1.6;
      move.y = (-cy2 * fwd + sy * side) * speed * 1.6;
    } else if (this.walkTo) {
      var dx = this.walkTo.x - this.pos.x, dy = this.walkTo.y - this.pos.y;
      var dist = Math.hypot(dx, dy);
      if (dist < 0.06) { this.walkTo = null; }
      else { move.x = (dx / dist) * Math.min(speed, dist); move.y = (dy / dist) * Math.min(speed, dist); }
    }

    if (move.x || move.y) {
      var to = { x: this.pos.x + move.x, y: this.pos.y + move.y };
      this.pos = slideMove(room, this.pos, to, 0.35);
    }
  };

  PlanWalk.prototype.loop = function () {
    var self = this;
    function frame() {
      requestAnimationFrame(frame);
      if (!self.active || !self.gl) return;
      var c = self.canvas;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (!w || !h) return;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }

      self.yaw += (self.targetYaw - self.yaw) * 0.2;
      self.pitch += (self.targetPitch - self.pitch) * 0.2;
      self.step();

      var gl = self.gl;
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Le ciel d'abord, au fond du tampon de profondeur : les murs le
      // recouvrent, les ouvertures le laissent voir.
      gl.useProgram(self.sky);
      gl.bindBuffer(gl.ARRAY_BUFFER, self.skyBuf);
      gl.enableVertexAttribArray(self.skyAttr);
      gl.vertexAttribPointer(self.skyAttr, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.useProgram(self.prog);

      var eye = [self.pos.x, 1.62, self.pos.y];
      var dir = [
        Math.cos(self.pitch) * Math.sin(self.yaw),
        Math.sin(self.pitch),
        -Math.cos(self.pitch) * Math.cos(self.yaw),
      ];
      var view = lookAt(eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], [0, 1, 0]);
      var proj = perspective(self.fovY(), w / h, 0.05, 60);
      var mvp = multiply(proj, view);
      gl.uniformMatrix4fv(self.uni.mvp, false, new Float32Array(mvp));

      self.pieces.forEach(function (piece) {
        gl.bindBuffer(gl.ARRAY_BUFFER, piece.buffer);
        var stride = 8 * 4;
        gl.enableVertexAttribArray(self.attr.pos);
        gl.vertexAttribPointer(self.attr.pos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(self.attr.nrm);
        gl.vertexAttribPointer(self.attr.nrm, 3, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(self.attr.tex);
        gl.vertexAttribPointer(self.attr.tex, 2, gl.FLOAT, false, stride, 24);
        gl.uniform1f(self.uni.useTex, 0);
        piece.parts.forEach(function (part) {
          gl.uniform3fv(self.uni.tint, new Float32Array(part.tint));
          gl.drawArrays(gl.TRIANGLES, part.start, part.count);
        });
        piece.photos.forEach(function (ph) {
          var tex = self.textures[ph.url];
          if (!tex) return;
          gl.bindBuffer(gl.ARRAY_BUFFER, ph.buffer);
          gl.vertexAttribPointer(self.attr.pos, 3, gl.FLOAT, false, stride, 0);
          gl.vertexAttribPointer(self.attr.nrm, 3, gl.FLOAT, false, stride, 12);
          gl.vertexAttribPointer(self.attr.tex, 2, gl.FLOAT, false, stride, 24);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(self.uni.img, 0);
          gl.uniform1f(self.uni.useTex, 1);
          gl.drawArrays(gl.TRIANGLES, 0, ph.count);
          gl.uniform1f(self.uni.useTex, 0);
        });
      });
    }
    frame();
  };

  window.V3D = { Pano: Pano, PlanWalk: PlanWalk, show: show, VIEWERS: VIEWERS, els: els, el: el };
})();
