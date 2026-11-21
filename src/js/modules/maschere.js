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
export async function loadArchetipi({ dir = 'archetipi/', n: N = 72 } = {}) {
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
