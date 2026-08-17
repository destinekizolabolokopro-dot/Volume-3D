/* =========================================================================
   Câblage des écrans extraits.

   Le HTML vient du site réel : les boutons sont là, mais leurs gestionnaires
   d'événements vivaient dans React. On les rebranche ici, un par un.
   ========================================================================= */

(function () {
  'use strict';

  var el = window.V3D.el;
  var els = window.V3D.els;
  var A = window.V3D_ASSETS || {};
  var DATA = window.V3D_DATA || {};

  /* ------------------------------------------------------ formulaires --- */

  // Aucune écriture ne part nulle part : on empêche les soumissions.
  document.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ------------------------------------------- le viewer de la landing --- */

  var landing = document.getElementById('ec-accueil');
  var landingPano = el('[class*="PanoViewer_root"]', landing);
  if (landingPano) new window.V3D.Pano(landingPano, DATA.demoRooms);

  // Le menu déroulant du téléphone : la feuille de style l'ouvre sur
  // `data-open="1"`, c'est React qui posait l'attribut.
  var burger = el('.nav-burger', landing);
  var sheet = el('.nav-sheet', landing);
  if (burger && sheet) {
    burger.addEventListener('click', function () {
      var open = sheet.getAttribute('data-open') === '1';
      sheet.setAttribute('data-open', open ? '0' : '1');
      burger.setAttribute('aria-expanded', open ? 'false' : 'true');
      burger.setAttribute('aria-label', open ? 'Ouvrir le menu' : 'Fermer le menu');
    });
    els('a', sheet).forEach(function (a) {
      a.addEventListener('click', function () {
        sheet.setAttribute('data-open', '0');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // La vidéo de démonstration de la page d'accueil.
  els('video', landing).forEach(function (v) {
    if (A['/demo/visite.webm']) {
      v.src = A['/demo/visite.webm'];
      v.poster = A['/demo/poster.jpg'] || v.poster;
      v.setAttribute('controls', '');
      v.setAttribute('playsinline', '');
    }
  });
  // Le bouton « Lancer la démonstration » posé par-dessus l'affiche.
  els('[class*="video-cover"], .video-cover', landing).forEach(function (cover) {
    cover.addEventListener('click', function () {
      var v = el('video', cover.parentElement) || el('video', landing);
      if (!v) return;
      cover.style.display = 'none';
      v.play();
    });
  });

  /* ---------------------------------- la page de visite : les formats --- */

  var visite = document.getElementById('ec-visite');
  if (visite) {
    var stage = el('[class*="TourStage_frame"]', visite);
    var tabs = els('[class*="TourStage_tab"]', visite);
    var tourPano = el('[class*="PanoViewer_root"]', visite);

    if (tourPano) {
      tourPano.classList.add('v3d-pane');
      new window.V3D.Pano(tourPano, DATA.tourRooms);
    }

    // Le volume reconstruit depuis le plan : on le crée à côté du 360°.
    var planPane = null;
    if (stage && DATA.plan) {
      planPane = document.createElement('div');
      planPane.className = 'v3d-plan v3d-pane';
      planPane.hidden = true;
      planPane.innerHTML =
        '<div class="v3d-plan-name"></div>' +
        '<div class="v3d-plan-hint">Touchez le sol pour avancer · glissez pour regarder</div>' +
        '<div class="v3d-plan-bar">' +
        DATA.plan.rooms.map(function (r, i) {
          return '<button type="button" class="v3d-plan-chip' + (i === 0 ? ' on' : '') + '">' + r.name + '</button>';
        }).join('') +
        '</div>';
      stage.appendChild(planPane);
    }

    // La vidéo walkthrough.
    var videoPane = null;
    if (stage && A['/demo/visite.webm']) {
      videoPane = document.createElement('div');
      videoPane.className = 'v3d-pane';
      videoPane.hidden = true;
      videoPane.style.cssText = 'width:100%;height:100%;background:#0f1418;display:grid;place-items:center';
      var v = document.createElement('video');
      v.src = A['/demo/visite.webm'];
      v.poster = A['/demo/poster.jpg'] || '';
      v.controls = true;
      v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:contain';
      videoPane.appendChild(v);
      stage.appendChild(videoPane);
    }

    var panes = [tourPano, planPane, videoPane];
    var walker = null;

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
        panes.forEach(function (p, k) { if (p) p.hidden = k !== i; });
        window.V3D.VIEWERS.forEach(function (vw) {
          vw.setActive(panes.some(function (p) { return p && !p.hidden && (p === vw.node || p.contains(vw.node)); }));
        });
        if (i === 1 && planPane && !walker) {
          walker = new window.V3D.PlanWalk(planPane, DATA.plan, DATA.doors, DATA.photos);
          els('.v3d-plan-chip', planPane).forEach(function (chip, k) {
            chip.addEventListener('click', function () { walker.enterRoom(k); });
          });
          setTimeout(function () {
            var hint = el('.v3d-plan-hint', planPane);
            if (hint) hint.style.opacity = '0';
          }, 5000);
        }
        if (i === 1 && walker) walker.setActive(true);
        if (i !== 2 && videoPane) { var vd = el('video', videoPane); if (vd) vd.pause(); }
      });
    });

    buildChat(visite);
  }

  /* ------------------------------------------------------- l'assistant --- */

  /**
   * L'assistant, version hors ligne.
   *
   * Sur le site, il tourne sur l'API Claude et répond à partir de la fiche
   * confirmée par le propriétaire. Ici il n'y a pas de réseau : les réponses
   * viennent des mêmes données — description, nom des pièces, légendes — et
   * la règle de fond est respectée à la lettre : **ce qui n'est pas dans la
   * fiche est annoncé comme absent**, jamais deviné.
   */
  function buildChat(root) {
    var p = DATA.property || {};
    var rooms = (DATA.plan ? DATA.plan.rooms.map(function (r) { return r.name; }) : []);
    var tourRooms = (DATA.tourRooms || []).map(function (r) { return r.name; });

    var KNOWN = [
      { k: /(surface|m2|m²|taille|grand|superficie)/i,
        a: 'Le logement fait ' + (DATA.plan ? DATA.plan.declaredArea : 42) + ' m². Le relevé du plan donne ' +
           (rooms.length ? rooms.length + ' pièces : ' + rooms.join(', ') + '.' : '') },
      { k: /(pi[eè]ce|chambre|combien de)/i,
        a: rooms.length ? 'Le plan relève ' + rooms.length + ' pièces : ' + rooms.join(', ') + '. Vous pouvez les parcourir dans l’onglet « Plan 3D ».'
                        : 'Les pièces visitables sont : ' + tourRooms.join(', ') + '.' },
      { k: /(étage|ascenseur)/i, a: (p.description || '').match(/étage[^.]*\./) ? (p.description.match(/[^.]*étage[^.]*\./)[0]).trim() : null },
      { k: /(lit|couchage|dormir)/i, a: (p.description || '').match(/lit[^.]*\./) ? (p.description.match(/[^.]*lit[^.]*\./)[0]).trim() : null },
      { k: /(cuisine|équipée|equipee)/i, a: (p.description || '').match(/cuisine[^.]*\./) ? (p.description.match(/[^.]*cuisine[^.]*\./)[0]).trim() : null },
      { k: /(o[uù]|adresse|quartier|situ)/i, a: p.city ? 'Le logement se trouve à ' + p.city + '. L’adresse exacte est communiquée après la réservation.' : null },
      // Les questions ci-dessous reviennent tout le temps et n'ont pas de
      // réponse dans la fiche : mieux vaut le dire franchement que broder.
      { k: /(prix|tarif|coûte|coute|nuit[ée]e)/i, a: null },
      { k: /(animal|animaux|chien|chat|nac)/i, a: null },
      { k: /(wifi|wi-fi|internet|d[ée]bit|fibre)/i, a: null },
      { k: /(parking|voiture|garer|stationnement)/i, a: null },
      { k: /(fum|cigarette|tabac)/i, a: null },
      { k: /(arriv|d[ée]part|cl[ée]|check.?in|check.?out|horaire)/i, a: null },
      { k: /(drap|linge|serviette|m[ée]nage|caution)/i, a: null },
      { k: /(bruit|calme|voisin)/i, a: null },
      { k: /(enfant|b[ée]b[ée]|lit parapluie)/i, a: null },
      { k: /(clim|climatisation|chauffage|temp[ée]rature)/i, a: null },
    ];

    var ABSENT = 'Ce point ne figure pas dans la fiche du logement. Je préfère vous le dire plutôt que de l’inventer — posez la question au propriétaire, il vous répondra précisément.';

    function answer(q) {
      var hit = KNOWN.find(function (r) { return r.k.test(q); });
      if (hit && hit.a) return hit.a;
      if (hit) return ABSENT;
      if (/bonjour|salut|hello/i.test(q)) return 'Bonjour. Posez-moi vos questions sur ce logement — je réponds à partir de ce que le propriétaire a renseigné.';
      if (/merci/i.test(q)) return 'Avec plaisir. Bonne visite.';
      if (p.description) {
        return 'Voici ce que dit la fiche : « ' + p.description + ' » Si votre question n’y trouve pas de réponse, je ne la devinerai pas — demandez au propriétaire.';
      }
      return ABSENT;
    }

    var open = document.createElement('button');
    open.type = 'button';
    open.className = 'v3d-chat-open';
    open.innerHTML = '<span aria-hidden="true">💬</span> Une question sur ce logement ?';

    var panel = document.createElement('div');
    panel.className = 'v3d-chat';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="v3d-chat-head"><strong>Une question sur ce logement ?</strong>' +
      '<button type="button" aria-label="Fermer">✕</button></div>' +
      '<div class="v3d-chat-log"></div>' +
      '<div class="v3d-chat-sugg">' +
      ['Quelle est la surface ?', 'Combien de pièces ?', 'Y a-t-il un ascenseur ?', 'Les animaux sont-ils acceptés ?']
        .map(function (s) { return '<button type="button">' + s + '</button>'; }).join('') +
      '</div>' +
      '<form class="v3d-chat-form"><input type="text" placeholder="Votre question…" aria-label="Votre question" />' +
      '<button type="submit">Envoyer</button></form>';

    root.appendChild(open);
    root.appendChild(panel);

    var log = el('.v3d-chat-log', panel);
    function say(text, mine) {
      var b = document.createElement('div');
      b.className = 'v3d-msg ' + (mine ? 'v3d-msg-me' : 'v3d-msg-bot');
      b.textContent = text;
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
    }
    function ask(q) {
      say(q, true);
      setTimeout(function () { say(answer(q), false); }, 420);
    }

    say('Bonjour. Je réponds à partir de ce que le propriétaire a renseigné sur ce logement. Ce qui n’y figure pas, je vous le dirai plutôt que de l’inventer.', false);

    open.addEventListener('click', function () { panel.hidden = false; open.hidden = true; });
    el('.v3d-chat-head button', panel).addEventListener('click', function () { panel.hidden = true; open.hidden = false; });
    els('.v3d-chat-sugg button', panel).forEach(function (b) {
      b.addEventListener('click', function () { ask(b.textContent); });
    });
    el('.v3d-chat-form', panel).addEventListener('submit', function (e) {
      e.preventDefault();
      var input = el('input', panel);
      var q = input.value.trim();
      if (!q) return;
      input.value = '';
      ask(q);
    });
  }

  /* --------------------------------------------- la fiche du logement --- */

  // L'éditeur porte le même viewer que la visite publique.
  var espacePano = el('#ec-espace [class*="PanoViewer_root"]');
  if (espacePano) new window.V3D.Pano(espacePano, DATA.tourRooms);

  /**
   * Le questionnaire, vivant.
   *
   * Chaque réponse met à jour, en temps réel, le bloc « ce qu'il reste à
   * faire » et la bande d'avancement — exactement ce que fait le site, où le
   * calcul se refait côté serveur à chaque enregistrement.
   */
  var espace = document.getElementById('ec-espace');
  if (espace) {
    var form = el('.form-grid', espace);
    if (form) {
      var STORE = 'v3d-fiche';
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { saved = {}; }

      /** Les questions obligatoires portent une étoile dans leur libellé. */
      function fields() {
        var out = [];
        els('.field, .field-group', form).forEach(function (f) {
          var label = el('label, legend', f);
          if (!label) return;
          var required = /\*\s*$/.test(label.textContent.trim()) || label.textContent.indexOf(' *') !== -1;
          var inputs = els('input, select, textarea', f);
          if (!inputs.length) return;
          var key = (inputs[0].name || '').replace('fait-', '');
          var filled = inputs.some(function (i) {
            return i.type === 'checkbox' ? i.checked : String(i.value || '').trim() !== '';
          });
          out.push({ key: key, required: required, filled: filled, inputs: inputs });
        });
        return out;
      }

      function restore() {
        Object.keys(saved).forEach(function (key) {
          var value = saved[key];
          els('[name="fait-' + key + '"]', form).forEach(function (i) {
            if (i.type === 'checkbox') i.checked = value.indexOf(i.value) !== -1;
            else i.value = value;
          });
        });
      }

      function collect() {
        var out = {};
        fields().forEach(function (f) {
          if (!f.key) return;
          if (f.inputs[0].type === 'checkbox') {
            out[f.key] = f.inputs.filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
          } else {
            out[f.key] = f.inputs[0].value;
          }
        });
        return out;
      }

      function refresh() {
        var all = fields();
        var required = all.filter(function (f) { return f.required; });
        var missing = required.filter(function (f) { return !f.filled; });
        var progress = required.length ? Math.round(((required.length - missing.length) / required.length) * 100) : 100;

        // Le message « complétez la fiche » du bloc « ce qu'il reste à faire ».
        var line = els('.callout-warn', espace).find(function (n) { return /Complétez la fiche/.test(n.textContent); });
        var list = el('.stack-sm', espace);
        if (missing.length === 0 && line) { line.remove(); }
        else if (missing.length && !line && list) {
          line = document.createElement('li');
          line.className = 'callout-box callout-warn';
          list.appendChild(line);
        }
        if (line && missing.length) {
          line.textContent = 'Complétez la fiche ci-dessous : ' + missing.length + ' réponse(s) obligatoire(s) manquante(s).';
        }

        // Le compteur de progression.
        var tiny = els('.tiny', espace).find(function (n) { return /% des réponses obligatoires/.test(n.textContent); });
        if (tiny) {
          tiny.textContent = tiny.textContent.replace(/Fiche\s*:\s*\d+\s*%/, 'Fiche : ' + progress + ' %');
        }

        // La bande d'avancement : l'étape « La fiche ».
        var steps = els('.journey-step', espace);
        var fiche = steps.find(function (s) { return /La fiche/.test(s.textContent); });
        if (fiche) {
          var done = missing.length === 0;
          fiche.classList.toggle('journey-step-done', done);
          fiche.classList.toggle('journey-step-todo', !done);
          var dot = el('.journey-dot', fiche);
          if (dot) dot.textContent = done ? '✓' : '';
        }
        var counter = el('.journey .tiny', espace);
        if (counter) {
          var d = els('.journey-step-done', espace).length;
          counter.textContent = d + ' étape' + (d > 1 ? 's' : '') + ' sur ' + steps.length + '.';
        }
      }

      restore();
      refresh();
      form.addEventListener('input', refresh);
      form.addEventListener('change', refresh);

      var save = els('button', form).find(function (b) { return /Enregistrer la fiche/.test(b.textContent); });
      if (save) {
        save.addEventListener('click', function (e) {
          e.preventDefault();
          saved = collect();
          try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (err) { /* mode privé */ }
          refresh();
          var was = save.textContent;
          save.textContent = 'Enregistré ✓';
          setTimeout(function () { save.textContent = was; }, 1800);
        });
      }
    }

    // Le bouton de pré-remplissage : indisponible sans clé, comme sur le site.
    els('button', espace).forEach(function (b) {
      if (/Pré-remplir depuis les photos/.test(b.textContent)) b.disabled = true;
    });
  }

  /* --------------------------------------- à publier sur votre annonce --- */

  /*
   * Le bloc « À publier » est rendu par le serveur, textes compris : il ne reste
   * qu'à rebrancher les deux gestes utiles, copier et télécharger. Le plan est
   * déjà dans la page sous forme de data URI, donc le téléchargement fonctionne
   * hors ligne comme le reste.
   */
  var kit = els('section.card', espace || document).find(function (c) {
    return /À publier sur votre annonce/.test(c.textContent || '');
  });
  if (kit) {
    els('button', kit).forEach(function (button) {
      var label = (button.textContent || '').trim();

      if (label === 'Copier') {
        button.addEventListener('click', function () {
          var field = button.closest('.field');
          var source = field && (el('textarea', field) || el('input', field));
          if (!source) return;
          var done = function () {
            var was = button.textContent;
            button.textContent = 'Copié ✓';
            setTimeout(function () { button.textContent = was; }, 1600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(source.value).then(done, function () { source.select(); });
          } else {
            source.select();
            done();
          }
        });
      }

      if (/Télécharger le plan/.test(label)) {
        button.addEventListener('click', function () { savePlan(kit, button); });
      }
    });
  }

  /**
   * Enregistre le plan.
   *
   * Ouvert en local — le cas nominal, un fichier sur un disque — un lien
   * `download` suffit. Affiché dans un cadre qui refuse les téléchargements
   * directs, il faut passer par l'hôte, qui demande son accord au lecteur et
   * n'accepte que quelques formats : on rastérise alors le plan en PNG.
   *
   * Aucun des deux chemins n'est supposé disponible : on essaie, et on le dit
   * quand ça n'aboutit pas.
   */
  function savePlan(kit, button) {
    var img = el('img[alt^="Plan de"]', kit);
    if (!img) return;

    var say = function (text) {
      var was = button.textContent;
      button.textContent = text;
      setTimeout(function () { button.textContent = was; }, 2200);
    };

    var host = window.claude && typeof window.claude.use === 'function' ? window.claude : null;
    if (!host) {
      var link = document.createElement('a');
      link.href = img.src;
      link.download = 'plan-logement.svg';
      link.click();
      return;
    }

    host.use('downloads').then(function (downloads) {
      if (!downloads) { say('Indisponible ici'); return; }
      toPng(img, function (blob) {
        if (!blob) { say('Échec du rendu'); return; }
        downloads.save({ filename: 'plan-logement.png', data: blob }).then(
          function () { say('Enregistré ✓'); },
          function (error) {
            say(error && error.code === 'declined' ? 'Annulé' : 'Indisponible ici');
          },
        );
      });
    });
  }

  /** Rastérise le plan : le SVG est autonome, le canevas n'est donc pas souillé. */
  function toPng(img, done) {
    var source = new Image();
    source.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth || 1200;
      canvas.height = source.naturalHeight || 900;
      var ctx = canvas.getContext('2d');
      if (!ctx) { done(null); return; }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      try { canvas.toBlob(done, 'image/png'); } catch (e) { done(null); }
    };
    source.onerror = function () { done(null); };
    source.src = img.src;
  }

  /* ------------------------------------------------------- ancres ------- */

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.dataset.goto) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
})();
