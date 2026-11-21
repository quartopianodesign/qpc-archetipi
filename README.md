# QPC Archetipi

I 24 archetipi di Quarto Piano come stati di una sola griglia modulare.
Non si animano le forme: si anima la griglia, e le forme ci emergono dentro.
Tra un archetipo e l'altro la griglia fa morphing: le celle in comune restano accese, le altre si spengono o si accendono, e colore e fondo sfumano verso il nuovo archetipo.

**Demo su CodePen:** https://codepen.io/qpcmos/pen/ogWWwbz

- **Click / rotella / frecce / spazio**: archetipo successivo (shift+click per tornare indietro)
- **Nastro in basso**: salta a un archetipo
- **Cursore sopra la forma**: i moduli sotto la mano rientrano
- **Autoplay**: riparte da solo dopo 9 secondi di inattività

## Uso

```html
<div class="qpc-archetipi">
  <canvas class="qpc-archetipi__stage"></canvas>
  <nav class="qpc-archetipi__ribbon" aria-label="Archetipi QPC"></nav>
</div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    QPC.loadArchetipi({ dir: 'archetipi/', n: 72 })   // 72 = 8×9: esatto per tutti
      .then(QPC.archetipi)                            // (data, root = primo .qpc-archetipi)
      .catch(console.error);
  });
</script>
```

`DOMContentLoaded` serve perché lo script inline viene letto prima dello script dell'utility (in `dist/` è `defer`, su CodePen `script.js` sta in fondo): così la chiamata parte quando `QPC` esiste già.

La cartella contiene gli SVG e un `index.json`:

```json
[
  { "file": "qpc-01-sigillo.svg", "name": "Il Sigillo", "bg": "#312782" }
]
```

`bg` è il fondo dell'archetipo. Se manca, si sceglie da solo: archetipo scuro su fondo chiaro e viceversa.
Serve un server (anche locale): da `file://` il browser blocca `fetch`.

Una volta montato, il setaccio si pilota da `el.qpcArchetipi`:

```js
const archetipi = document.querySelector('.qpc-archetipi').qpcArchetipi;
archetipi.go(5);   // Il Compasso
archetipi.next();
archetipi.prev();
archetipi.play();
archetipi.pause();
archetipi.index;
```

## Come funziona

- Ogni SVG in `src/archetipi/` è disegnato su moduli da 16px che riempiono il viewBox (8×8, Il Compasso 9×8).
- `loadArchetipi()` riempie i path con `Path2D` su un canvas 72×72 e legge l'alpha di ogni pixel: una maschera 0/1 per archetipo. 72 è il minimo comune multiplo di 8 e 9, quindi ogni bordo di modulo cade esattamente sul confine di una cella.
- `archetipi()` disegna il campo su canvas e anima le 5.184 celle con GSAP (stagger `grid` dal punto del puntatore, ingresso ruotato di 45°).

## Struttura

```
src/
  index.html       template unico della pagina
  archetipi/       SVG + index.json (nome, famiglia, fondo)
  js/app.js        entry: API window.QPC + helper mos() + initCode()
  js/modules/      maschere.js (SVG → maschere), archetipi.js (canvas + regia),
                   info.js (icona info + modale con il link al repo, facoltativa)
  scss/style.scss
dist/              build del sito (generata, non nel repo)
codepen/           build per CodePen (generata, non nel repo)
```

## Comandi

```bash
npm install
npm run dev     # watch + BrowserSync su localhost:3000 (serve dist/)
npm run build   # dist/ (minificato, gsap incluso) + codepen/ (leggibile, gsap da CDN)
```

## CodePen

`dist/` e `codepen/` non sono nel repo: si generano con `npm install && npm run build`.

`codepen/` contiene i tre file del pen, pronti per CodePen 2.0 o per essere copiati così come sono:

| File | Contenuto |
| --- | --- |
| `index.html` | documento completo: `style.css`, gsap dalla CDN, markup, chiamata all'API, `script.js` |
| `style.css` | CSS leggibile, compilato da `src/scss/style.scss` |
| `script.js` | JS leggibile, senza runtime di webpack |

Su CodePen gli SVG arrivano da questo repo via jsDelivr (`dir` nello script di `index.html`).

## Licenza

Codice MIT. Gli archetipi sono parte dell'identità di Quarto Piano Comunicazione.
