/*
  Dessin d'un panorama équirectangulaire de pièce, exécuté dans le navigateur.

  Repères : la largeur de l'image couvre 360° de cap, la hauteur 180° de hauteur
  angulaire, l'horizon exactement au milieu. Un point situé à la distance
  horizontale r et à la hauteur z au-dessus de l'objectif se projette donc en
  y = H/2 − atan(z / r) × H / π.

  Pour une pièce rectangulaire de demi-largeur d, la distance au mur dans la
  direction θ vaut d / max(|cos θ|, |sin θ|). C'est cette variation qui fait
  onduler les lignes de plafond et de plinthe, et qui rend l'image crédible une
  fois plaquée sur la sphère.

  Toutes les cotes des pièces sont en mètres au-dessus du sol ; la conversion en
  hauteur relative à l'objectif se fait ici, en un seul endroit (`z`).
*/
(() => {
  const W = 2048;
  const H = 1024;
  const RAD = Math.PI / 180;

  const P = {
    ceiling: '#f6f7f9',
    ceilingEdge: '#e8eaee',
    wallLit: '#f3f2ef',
    wallLitFoot: '#e6e5e1',
    wallShade: '#e6e5e1',
    wallShadeFoot: '#d5d4cf',
    floorNear: '#c6a67f',
    floorFar: '#b08c64',
    plank: 'rgba(110, 82, 52, 0.13)',
    skirting: '#f1f0ed',
    glass: ['#dceaf8', '#f8fbff'],
    frame: '#39414a',
    doorway: '#4b535d',
    doorGlow: '#8d97a3',
    wood: '#8a6544',
    woodDark: '#6d5136',
    fabric: '#6d7783',
    fabricLight: '#8e99a5',
    linen: '#f3f4f6',
    linenShade: '#dfe2e7',
    panel: '#eeece8',
    panelLine: 'rgba(57, 65, 74, 0.22)',
    plant: '#3f6b4e',
    pot: '#cdc5b9',
    shadow: 'rgba(28, 35, 43, 0.18)',
  };

  const xOf = (yaw) => (yaw / 360) * W;
  const yAt = (z, r) => H / 2 - (Math.atan2(z, r) / Math.PI) * H;
  /** Distance horizontale au mur, dans la direction `yaw`. */
  const wallAt = (yaw, depth) => {
    const a = yaw * RAD;
    return depth / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  };

  const gradient = (g, y0, y1, from, to) => {
    const grad = g.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, from);
    grad.addColorStop(1, to);
    return grad;
  };

  function drawRoom(slug) {
    const room = window.__rooms.find((r) => r.slug === slug);
    /** Hauteur au-dessus de l'objectif, à partir d'une cote prise au sol. */
    const z = (metres) => metres - room.eye;
    const ceiling = z(room.height);
    const floor = z(0);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');

    /* ------------------------------------------------------------ plafond --- */
    g.fillStyle = gradient(g, 0, H / 2, P.ceiling, P.ceilingEdge);
    g.fillRect(0, 0, W, H / 2);

    /* --------------------------------------------------------------- sol --- */
    g.fillStyle = gradient(g, H / 2, H, P.floorFar, P.floorNear);
    g.fillRect(0, H / 2, W, H / 2);

    // Lames : des rayons partant du nadir, qui est la façon dont un sol régulier
    // se projette au centre d'une pièce.
    g.save();
    g.strokeStyle = P.plank;
    g.lineWidth = 2.5;
    for (let yaw = 0; yaw < 360; yaw += 3) {
      const r = wallAt(yaw, room.depth);
      g.beginPath();
      g.moveTo(xOf(yaw), yAt(floor, r));
      g.lineTo(xOf(yaw), H);
      g.stroke();
    }
    g.restore();

    /* -------------------------------------------------------------- murs --- */
    const step = 0.5;
    for (let yaw = 0; yaw < 360; yaw += step) {
      const r = wallAt(yaw, room.depth);
      const top = yAt(ceiling, r);
      const bottom = yAt(floor, r);
      // Écart au mur éclairé : de 0 (face à la fenêtre) à 180 (dos à elle).
      const delta = Math.abs(((yaw - room.light + 540) % 360) - 180);
      const lit = 1 - delta / 180;
      g.fillStyle = gradient(
        g,
        top,
        bottom,
        lit > 0.45 ? P.wallLit : P.wallShade,
        lit > 0.45 ? P.wallLitFoot : P.wallShadeFoot,
      );
      g.fillRect(xOf(yaw), top, (W / 360) * step + 1, bottom - top);
    }

    // Voile de lumière depuis la fenêtre.
    const glow = g.createRadialGradient(xOf(room.light), H * 0.44, 0, xOf(room.light), H * 0.44, W * 0.26);
    glow.addColorStop(0, 'rgba(255, 253, 246, 0.55)');
    glow.addColorStop(1, 'rgba(255, 253, 246, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    const ctx = { g, room, z, ceiling, floor };
    for (const item of room.items) DRAW[item.type]?.(ctx, item);

    /* ---------------------------------------------------------- plinthes --- */
    for (let yaw = 0; yaw < 360; yaw += step) {
      const r = wallAt(yaw, room.depth);
      const y = yAt(floor, r);
      const h = y - yAt(z(0.07), r);
      g.fillStyle = P.skirting;
      g.fillRect(xOf(yaw), y - h, (W / 360) * step + 1, h);
    }

    /* ------------------------------------------------- fondu zénith/nadir --- */
    g.fillStyle = gradient(g, 0, H * 0.1, 'rgba(246, 247, 249, 0.95)', 'rgba(246, 247, 249, 0)');
    g.fillRect(0, 0, W, H * 0.1);
    g.fillStyle = gradient(g, H * 0.88, H, 'rgba(150, 118, 82, 0)', 'rgba(150, 118, 82, 0.5)');
    g.fillRect(0, H * 0.88, W, H * 0.12);

    return canvas.toDataURL('image/jpeg', 0.86);
  }

  /* ===================================================== motifs des objets === */

  /**
   * Un élément plaqué au mur occupe un secteur de caps. On le dessine trois fois,
   * décalé de ±360°, pour qu'aucun meuble ne soit coupé au raccord de l'image.
   */
  function span(ctx, item, draw) {
    for (const shift of [-360, 0, 360]) {
      const from = item.yaw + shift - item.width / 2;
      const to = item.yaw + shift + item.width / 2;
      if (to < -30 || from > 390) continue;
      draw(from, to);
    }
  }

  /**
   * Rectangle plaqué au mur, entre deux cotes prises au sol.
   *
   * Point capital : une arête horizontale d'un mur plat n'est pas une droite
   * dans une image équirectangulaire. Sa hauteur angulaire suit atan(h / r(θ)),
   * et r varie avec le cap. On échantillonne donc la courbe degré par degré —
   * un simple `fillRect` produirait des fenêtres bombées une fois sur la sphère.
   */
  function plate(ctx, from, to, lowM, highM, fill) {
    const { g, room, z } = ctx;
    const step = 0.4;
    const rAt = (yaw) => wallAt(((yaw % 360) + 720) % 360, room.depth);
    g.beginPath();
    for (let yaw = from; yaw <= to; yaw += step) {
      const y = yAt(z(highM), rAt(yaw));
      if (yaw === from) g.moveTo(xOf(yaw), y);
      else g.lineTo(xOf(yaw), y);
    }
    g.lineTo(xOf(to), yAt(z(highM), rAt(to)));
    for (let yaw = to; yaw >= from; yaw -= step) {
      g.lineTo(xOf(yaw), yAt(z(lowM), rAt(yaw)));
    }
    g.lineTo(xOf(from), yAt(z(lowM), rAt(from)));
    g.closePath();

    const rMid = rAt((from + to) / 2);
    const y0 = yAt(z(highM), rMid);
    const y1 = yAt(z(lowM), rMid);
    g.fillStyle = typeof fill === 'function' ? fill(y0, y1) : fill;
    g.fill();
    return { x0: xOf(from), x1: xOf(to), y0, y1 };
  }

  /** Ombre douce au pied d'un meuble. */
  function footShadow(ctx, from, to) {
    const { g, room, floor } = ctx;
    const r = wallAt(((from + to) / 2 + 720) % 360, room.depth);
    const y = yAt(floor, r);
    const x0 = xOf(from) - 14;
    const x1 = xOf(to) + 14;
    const grad = g.createLinearGradient(0, y - 4, 0, y + 54);
    grad.addColorStop(0, P.shadow);
    grad.addColorStop(1, 'rgba(28, 35, 43, 0)');
    g.fillStyle = grad;
    g.fillRect(x0, y - 4, x1 - x0, 58);
  }

  const DRAW = {
    window(ctx, item) {
      span(ctx, item, (from, to) => {
        plate(ctx, from, to, item.from - 0.06, item.to + 0.06, P.frame);
        plate(ctx, from + 1.3, to - 1.3, item.from, item.to, (y0, y1) =>
          gradient(ctx.g, y0, y1, P.glass[1], P.glass[0]),
        );
        // Meneau et traverse : sans eux, une fenêtre n'est qu'un rectangle clair.
        const mid = (from + to) / 2;
        const cross = item.from + (item.to - item.from) * 0.62;
        plate(ctx, mid - 0.35, mid + 0.35, item.from, item.to, P.frame);
        plate(ctx, from + 1.3, to - 1.3, cross - 0.03, cross + 0.03, P.frame);
        // Appui de fenêtre, débordant de part et d'autre.
        plate(ctx, from - 1.2, to + 1.2, item.from - 0.05, item.from - 0.01, '#ffffff');
      });
    },

    door(ctx, item) {
      span(ctx, item, (from, to) => {
        plate(ctx, from, to, 0, item.to + 0.05, P.frame);
        // L'ouverture laisse deviner la pièce suivante : c'est ce qui donne
        // envie de cliquer sur le point de passage posé au même endroit.
        plate(ctx, from + 1.1, to - 1.1, 0.01, item.to, (y0, y1) =>
          gradient(ctx.g, y0, y1, P.doorGlow, P.doorway),
        );
      });
    },

    art(ctx, item) {
      span(ctx, item, (from, to) => {
        plate(ctx, from, to, item.from, item.to, P.frame);
        plate(ctx, from + 0.7, to - 0.7, item.from + 0.04, item.to - 0.04, (y0, y1) =>
          gradient(ctx.g, y0, y1, '#e4e8ed', '#c6cfd8'),
        );
      });
    },

    sofa(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from, to, 0.08, item.back, P.fabric);
        plate(ctx, from + 3, to - 3, 0.3, item.seat, P.fabricLight);
        plate(ctx, from - 1, from + 5, 0.12, item.back + 0.02, P.fabric);
        plate(ctx, to - 5, to + 1, 0.12, item.back + 0.02, P.fabric);
        // Deux coussins.
        plate(ctx, from + 8, from + 18, item.seat, item.back - 0.06, P.linenShade);
        plate(ctx, to - 18, to - 8, item.seat, item.back - 0.06, P.linenShade);
      });
    },

    bed(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from + 7, to - 7, item.mattress, item.headboard, P.linenShade);
        plate(ctx, from, to, 0.12, item.mattress, P.linen);
        plate(ctx, from + 3, to - 3, 0.2, item.mattress - 0.16, P.fabric);
        plate(ctx, from + 9, from + 24, item.mattress - 0.02, item.mattress + 0.14, '#ffffff');
        plate(ctx, to - 24, to - 9, item.mattress - 0.02, item.mattress + 0.14, '#ffffff');
      });
    },

    wardrobe(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from, to, 0.02, item.to, (y0, y1) => gradient(ctx.g, y0, y1, P.panel, '#dcd8d1'));
        const mid = (from + to) / 2;
        plate(ctx, mid - 0.22, mid + 0.22, 0.02, item.to, P.panelLine);
      });
    },

    cabinets(ctx, item) {
      span(ctx, item, (from, to) => {
        plate(ctx, from, to, item.from, item.to, P.panel);
        for (let i = 1; i < 3; i += 1) {
          const at = from + ((to - from) * i) / 3;
          plate(ctx, at - 0.16, at + 0.16, item.from, item.to, P.panelLine);
        }
      });
    },

    counter(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from, to, 0.02, item.top - 0.04, P.panel);
        plate(ctx, from, to, item.top - 0.04, item.top, P.frame);
        for (let i = 1; i < 5; i += 1) {
          const at = from + ((to - from) * i) / 5;
          plate(ctx, at - 0.16, at + 0.16, 0.02, item.top - 0.04, P.panelLine);
        }
      });
    },

    shelf(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from, to, item.from, item.to, P.wood);
        plate(ctx, from + 1, to - 1, item.to - 0.04, item.to, P.woodDark);
        for (let i = 0; i < 6; i += 1) {
          const a = from + 2 + ((to - from - 4) * i) / 6;
          plate(ctx, a, a + (to - from - 4) / 9, item.to, item.to + 0.22, i % 2 ? P.fabricLight : '#cfd5db');
        }
      });
    },

    table(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from, to, item.top - 0.05, item.top, P.wood);
        plate(ctx, from + 2, from + 5, 0.02, item.top - 0.05, P.woodDark);
        plate(ctx, to - 5, to - 2, 0.02, item.top - 0.05, P.woodDark);
      });
    },

    rug(ctx, item) {
      const { g, room, floor } = ctx;
      span(ctx, item, (from, to) => {
        const r = wallAt(((from + to) / 2 + 720) % 360, room.depth);
        const x0 = xOf(from);
        const x1 = xOf(to);
        const y0 = yAt(floor, r);
        g.save();
        g.beginPath();
        // Le tapis part de la plinthe et s'étale vers le nadir : une ellipse
        // aplatie suffit, la sphère se charge du reste.
        g.ellipse((x0 + x1) / 2, y0 + (H - y0) * 0.42, (x1 - x0) / 2, (H - y0) * 0.4, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(236, 233, 227, 0.75)';
        g.fill();
        g.restore();
      });
    },

    plant(ctx, item) {
      span(ctx, item, (from, to) => {
        footShadow(ctx, from, to);
        plate(ctx, from + 1, to - 1, 0.02, 0.34, P.pot);
        const mid = (from + to) / 2;
        for (let i = -2; i <= 2; i += 1) {
          const a = mid + i * (item.width / 6);
          plate(ctx, a - 0.9, a + 0.9, 0.3, item.tall - Math.abs(i) * 0.14, P.plant);
        }
      });
    },
  };

  window.drawRoom = drawRoom;
})();
