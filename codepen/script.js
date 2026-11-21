/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/js/modules/maschere.js
/**
 * Archetipi QPC — dagli SVG alle maschere della griglia.
 *
 * Legge index.json e gli SVG da una cartella (locale o remota, es. jsDelivr).
 * Ogni archetipo è disegnato su moduli da 16px che riempiono esattamente il
 * viewBox (8×8, Il Compasso 9×8). Con N multiplo di 72 ogni bordo di modulo
 * cade su un confine di cella, quindi basta riempire i path a N×N e leggere
 * l'alpha di ogni pixel: niente supersampling, niente bounding box.
 */

/**
 * Rasterizza un SVG in una maschera N×N di 0/1
 * @param {SVGSVGElement} svg
 * @param {number} N
 * @returns {Uint8Array}
 */
function rasterize(svg, N) {
  const [, , vw, vh] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
  const canvas = Object.assign(document.createElement('canvas'), { width: N, height: N });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fit = N / Math.max(vw, vh);

  // centra il disegno senza deformarlo (Il Compasso è più largo che alto)
  ctx.translate((N - vw * fit) / 2, (N - vh * fit) / 2);
  ctx.scale(fit, fit);
  svg.querySelectorAll('path').forEach(p => {
    ctx.fill(new Path2D(p.getAttribute('d')), p.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero');
  });

  const px = ctx.getImageData(0, 0, N, N).data;
  const mask = new Uint8Array(N * N);
  for (let k = 0; k < mask.length; k++) mask[k] = px[k * 4 + 3] > 127 ? 1 : 0;
  return mask;
}

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res;
}

/**
 * Carica gli archetipi da una cartella con index.json
 * — [{ "file", "name", "bg" }, …] dove bg è il fondo, facoltativo
 *
 * @param {Object} [opts]
 * @param {string} [opts.dir='archetipi/'] - Cartella con index.json e gli SVG
 * @param {number} [opts.n=72] - Celle per lato: 72 allinea anche Il Compasso
 * @returns {Promise<{ n: number, items: Array<{ n, name, color, bg, mask }> }>}
 *
 * @example
 * QPC.loadArchetipi({ dir: 'archetipi/', n: 72 }).then(QPC.archetipi);
 */
async function loadArchetipi({ dir = 'archetipi/', n: N = 72 } = {}) {
  const base = dir.replace(/\/?$/, '/');
  const manifest = await (await fetchOk(base + 'index.json')).json();
  const parser = new DOMParser();

  const items = await Promise.all(manifest.map(async (entry, i) => {
    const text = await (await fetchOk(base + entry.file)).text();
    const svg = parser.parseFromString(text, 'image/svg+xml').documentElement;
    const fill = svg.querySelector('path[fill]');

    return {
      n: i + 1,
      name: entry.name,
      color: fill ? fill.getAttribute('fill') : '#ffffff',
      bg: entry.bg || null,
      mask: rasterize(svg, N),
    };
  }));

  return { n: N, items };
}

;// ./src/js/modules/archetipi.js
/**
 * QPC Archetipi — i 24 archetipi QPC come stati di una sola griglia modulare.
 *
 * L'identità non sono le ventiquattro forme, è la griglia che le genera tutte.
 * Quindi non animiamo le forme: animiamo la griglia, e le forme ci emergono dentro.
 *
 * Markup atteso:
 *   <div class="qpc-archetipi">
 *     <canvas class="qpc-archetipi__stage"></canvas>
 *     <nav class="qpc-archetipi__ribbon"></nav>
 *   </div>
 *
 * gsap è globale: dalla CDN su CodePen, iniettato da webpack nella build del sito.
 */

/* Una sola transizione per tutto: autoplay, click, rotella, tastiera e nastro
   passano da go() con gli stessi tempi e le stesse curve. Il puntatore decide
   solo da quale modulo parte l'onda. */
const T = {
  dur: 0.55, ease: 'power3.out',
  stagAmount: 0.8, stagEase: 'power1.inOut',
  themeDur: 0.85, themeEase: 'power2.inOut',
  hold: 3.4,      // pausa fra un archetipo e il successivo in autoplay
  idle: 9,        // inattività dopo cui l'autoplay riprende
  brush: 2.4,     // raggio del pennello sotto il cursore, in moduli
  brushGap: 0.55, // secondi prima che lo stesso modulo possa rientrare
};

const GROUND_DARK = [0x0E, 0x0D, 0x12];
const GROUND_LIGHT = [0xED, 0xEC, 0xF2];
const TAU8 = Math.PI / 4; // 45°: l'unico angolo che il sistema conosce

// ------------------------------------------------------------------ colore

function hexToRgb(h) {
  h = String(h).trim().toLowerCase();
  if (h === 'white') return [255, 255, 255];
  if (h === 'black') return [0, 0, 0];
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const v = parseInt(h, 16);
  return isNaN(v) ? null : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = rgb => `rgb(${rgb.join(',')})`;

// ------------------------------------------------------------------ archetipi

/**
 * Monta gli archetipi su un elemento
 * @param {{ n: number, items: Array }} data - da loadArchetipi()
 * @param {Element} [root] - .qpc-archetipi (default: il primo della pagina)
 * @returns {Object} API per pilotarlo da fuori, salvata anche in root.qpcArchetipi
 */
function createArchetipi({ n: N, items }, root = document.querySelector('.qpc-archetipi')) {
  const CELLS = N * N;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const masks = items.map(it => it.mask);
  const inks = items.map(it => hexToRgb(it.color) || [255, 255, 255]);
  // fondo dal manifesto; se manca, archetipo scuro → fondo chiaro e viceversa
  const grounds = items.map((it, i) =>
    (it.bg && hexToRgb(it.bg)) || (luminance(inks[i]) > 0.3 ? GROUND_DARK : GROUND_LIGHT));

  // un oggetto per cella: GSAP tiene migliaia di tween in parallelo senza fatica
  const cells = Array.from({ length: CELLS }, () => ({ v: 0 }));
  const [ir, ig, ib] = inks[0];
  const [gr, gg, gb] = grounds[0];
  const theme = { ir, ig, ib, gr, gg, gb };

  const pointer = { x: -1e5, y: -1e5, active: false };
  const geo = { side: 0, step: 0, ox: 0, oy: 0 };
  let cur = -1;
  let settling = false; // vero mentre l'onda attraversa il campo
  let settleCall = null;

  // -------------------------------------------------------------- canvas

  const canvas = root.querySelector('.qpc-archetipi__stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 0, H = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    geo.side = Math.min(W * 0.9, H * 0.76);
    geo.step = geo.side / N;
    geo.ox = (W - geo.side) / 2;
    geo.oy = (H - geo.side) / 2 - Math.min(30, H * 0.035); // alzato di un soffio
  }

  function render() {
    const ink = [theme.ir | 0, theme.ig | 0, theme.ib | 0];
    const ground = [theme.gr | 0, theme.gg | 0, theme.gb | 0];
    const { step, ox, oy } = geo;
    const unit = step * 0.9; // lascia respirare la fuga tra i moduli
    const dot = Math.max(1, step * 0.12);
    const dh = dot / 2;

    ctx.fillStyle = css(ground);
    ctx.fillRect(0, 0, W, H);

    /* 1) Il reticolo copre tutto lo schermo e resta in fase con il campo:
       l'archetipo è una porzione visibile di una griglia senza bordi.
       Tutti i punti in un solo path, chiuso con un unico fill. */
    const i0 = Math.floor(-ox / step), i1 = Math.ceil((W - ox) / step);
    const j0 = Math.floor(-oy / step), j1 = Math.ceil((H - oy) / step);

    ctx.fillStyle = css(mix(ground, ink, 0.16));
    ctx.beginPath();
    for (let j = j0; j <= j1; j++) {
      const y = oy + j * step + step / 2;
      const inRow = j >= 0 && j < N;
      for (let i = i0; i <= i1; i++) {
        // dentro il campo il punto cede il posto al modulo acceso
        if (inRow && i >= 0 && i < N && cells[j * N + i].v > 0.02) continue;
        ctx.rect(ox + i * step + step / 2 - dh, y - dh, dot, dot);
      }
    }
    ctx.fill();

    // 2) i moduli a regime, anche questi in un solo path
    const moving = [];
    ctx.fillStyle = css(ink);
    ctx.beginPath();
    for (let j = 0, k = 0; j < N; j++) {
      const cy = oy + j * step + step / 2;
      for (let i = 0; i < N; i++, k++) {
        const v = cells[k].v;
        if (v <= 0.02) continue;
        const cx = ox + i * step + step / 2;
        if (v > 0.995) ctx.rect(cx - unit / 2, cy - unit / 2, unit, unit);
        else moving.push(cx, cy, v);
      }
    }
    ctx.fill();

    // 3) i moduli in transizione entrano ruotando di 45°
    for (let k = 0; k < moving.length; k += 3) {
      const v = moving[k + 2];
      const half = unit * v / 2;
      ctx.save();
      ctx.translate(moving[k], moving[k + 1]);
      ctx.rotate((1 - v) * TAU8);
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.restore();
    }
  }

  // -------------------------------------------------------------- cornice

  function paintChrome() {
    const ground = [theme.gr | 0, theme.gg | 0, theme.gb | 0];
    const far = luminance(ground) > 0.5 ? [0x16, 0x15, 0x1A] : GROUND_LIGHT;
    root.style.setProperty('--ground', css(ground));
    root.style.setProperty('--soft', css(mix(ground, far, 0.82)));
  }

  function buildRibbon() {
    const ribbon = root.querySelector('.qpc-archetipi__ribbon');
    items.forEach((it, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'qpc-archetipi__tick';
      b.style.setProperty('--c', it.color);
      b.title = `${String(it.n).padStart(2, '0')} · ${it.name}`;
      b.setAttribute('aria-label', it.name);
      b.addEventListener('click', () => { stopAuto(); go(idx); });
      ribbon.appendChild(b);
    });
  }

  // -------------------------------------------------------------- regia

  // la transizione parte da dove sta il puntatore: la mano guida l'onda
  function originIndex() {
    if (!pointer.active) return Math.floor(CELLS / 2) + Math.floor(N / 2);
    const clamp = v => Math.max(0, Math.min(N - 1, v));
    const gx = clamp(Math.floor((pointer.x - geo.ox) / geo.step));
    const gy = clamp(Math.floor((pointer.y - geo.oy) / geo.step));
    return gy * N + gx;
  }

  /* Il pennello: i moduli accesi sotto il cursore rientrano con la stessa
     durata, curva e rotazione della transizione — l'onda, detta piano.
     A cursore fermo non succede niente. */
  const lastBrush = new Float32Array(CELLS).fill(-1e9);

  function brush() {
    if (RM || !pointer.active || settling) return;
    const t = gsap.ticker.time;
    const mask = masks[cur];
    const R = T.brush;
    const gx = (pointer.x - geo.ox) / geo.step - 0.5;
    const gy = (pointer.y - geo.oy) / geo.step - 0.5;
    const i0 = Math.max(0, Math.floor(gx - R)), i1 = Math.min(N - 1, Math.ceil(gx + R));
    const j0 = Math.max(0, Math.floor(gy - R)), j1 = Math.min(N - 1, Math.ceil(gy + R));

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i - gx, j - gy);
        const k = j * N + i;
        if (d > R || !mask[k] || t - lastBrush[k] < T.brushGap) continue;
        lastBrush[k] = t;
        cells[k].v = 0.05;
        gsap.to(cells[k], {
          v: 1,
          duration: T.dur,
          ease: T.ease,
          delay: (d / R) * T.stagAmount * 0.2, // la stessa onda, in scala ridotta
          overwrite: true,
        });
      }
    }
  }

  function go(next) {
    next = ((next % items.length) + items.length) % items.length;
    if (next === cur) return;
    cur = next;

    const mask = masks[next];
    const [ir, ig, ib] = inks[next];
    const [gr, gg, gb] = grounds[next];

    // il pennello tace finché l'onda non ha finito di posarsi
    settling = true;
    if (settleCall) settleCall.kill();
    settleCall = gsap.delayedCall(RM ? 0 : T.dur + T.stagAmount, () => { settling = false; });

    gsap.to(cells, {
      v: i => mask[i],
      duration: RM ? 0 : T.dur,
      ease: T.ease,
      overwrite: true,
      stagger: RM ? 0 : { grid: [N, N], from: originIndex(), amount: T.stagAmount, ease: T.stagEase },
    });

    gsap.to(theme, {
      ir, ig, ib, gr, gg, gb,
      duration: RM ? 0 : T.themeDur,
      ease: T.themeEase,
      overwrite: true,
      onUpdate: paintChrome,
    });

    mos('.qpc-archetipi__tick', (tick, i) => tick.setAttribute('aria-current', i === next), root);
  }

  // -------------------------------------------------------------- autoplay

  let auto = null;
  const idle = gsap.delayedCall(T.idle, startAuto).pause(); // dopo un po' riparte da solo

  function tickAuto() { go(cur + 1); auto = gsap.delayedCall(T.hold, tickAuto); }
  function startAuto() { if (!RM && !auto) auto = gsap.delayedCall(T.hold, tickAuto); }
  function stopAuto() { if (auto) { auto.kill(); auto = null; } idle.restart(true); }

  // -------------------------------------------------------------- input

  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', e => {
    Object.assign(pointer, { x: e.clientX, y: e.clientY, active: true });
    brush();
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });

  canvas.addEventListener('pointerdown', e => {
    Object.assign(pointer, { x: e.clientX, y: e.clientY, active: true });
    stopAuto();
    go(cur + (e.shiftKey ? -1 : 1));
  });

  let wheelLock = false;
  window.addEventListener('wheel', e => {
    if (wheelLock || Math.abs(e.deltaY) < 6) return;
    wheelLock = true;
    stopAuto();
    go(cur + (e.deltaY > 0 ? 1 : -1));
    gsap.delayedCall(0.42, () => { wheelLock = false; });
  }, { passive: true });

  window.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ' ': 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    stopAuto();
    go(cur + step);
  });

  // -------------------------------------------------------------- avvio

  resize();
  buildRibbon();
  paintChrome();
  gsap.ticker.add(render);
  go(0);
  startAuto();

  return (root.qpcArchetipi = {
    go: i => { stopAuto(); go(i); },
    next: () => { stopAuto(); go(cur + 1); },
    prev: () => { stopAuto(); go(cur - 1); },
    play: startAuto,
    pause: stopAuto,
    get index() { return cur; },
  });
}


;// ./src/js/app.js
/**
 * QPC Archetipi — entry point
 */



/**
 * API pubblica
 *
 * @example
 * QPC.loadArchetipi({ dir: 'archetipi/', n: 72 })   // 72 = 8×9: esatto per tutti
 *   .then(QPC.archetipi)
 *   .catch(console.error);
 */
window.QPC = { loadArchetipi: loadArchetipi, archetipi: createArchetipi };

/**
 * Funzione helper globale per il DOM
 * Permette iterazione facile sugli elementi DOM
 *
 * @param {string|Element} selectorOrElement - Selettore CSS o elemento DOM
 * @param {Function} callback - Funzione da eseguire su ogni elemento (riceve el, index)
 * @param {Element} [context=document] - Contesto in cui cercare (opzionale)
 *
 * @example
 * mos('.my-class', el => el.classList.add('active'));
 * mos('.my-class', (el, index) => console.log(index, el));
 * mos('.child', el => console.log(el), parentElement);
 */

/**
 * DOM Ready handler
 */
document.addEventListener('DOMContentLoaded', () => {

  window.mos = function (selectorOrElement, callback, context = document) {
    let elements = [];

    if (typeof selectorOrElement === 'string') {
      elements = context.querySelectorAll(selectorOrElement);
    } else if (selectorOrElement instanceof Element || selectorOrElement === document) {
      elements = [selectorOrElement];
    } else {
      return;
    }

    if (typeof callback !== 'function') {
      return;
    }

    elements.forEach((el, index) => callback(el, index));
  };
});

/******/ })()
;