# QPC Archetipi

I 24 archetipi di Quarto Piano come stati di una sola griglia modulare.
Non si animano le forme: si anima la griglia, e le forme ci emergono dentro.

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

`DOMContentLoaded` serve su CodePen: il pannello HTML viene eseguito prima del pannello JS, quindi `QPC` non esiste ancora.

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
  js/app.js        entry: API window.QPC + helper mos()
  js/modules/      maschere.js (SVG → maschere), archetipi.js (canvas + regia)
  scss/style.scss
dist/              build del sito: index.html, app.min.js, app.min.css, archetipi/
codepen/           build per CodePen: index.html, style.css, script.js (leggibili)
```

## Comandi

```bash
npm install
npm run dev     # watch + BrowserSync su localhost:3000 (serve dist/)
npm run build   # dist/ (minificato, gsap incluso) + codepen/ (leggibile, gsap da CDN)
```

## CodePen

| Pannello | File |
| --- | --- |
| HTML | `codepen/index.html` |
| CSS | `codepen/style.css` (oppure `src/scss/style.scss` con preprocessore SCSS) |
| JS | `codepen/script.js` |
| External script | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js` |

Su CodePen gli SVG arrivano da questo repo via jsDelivr (`dir` nello script di `codepen/index.html`).

## Licenza

Codice MIT. Gli archetipi sono parte dell'identità di Quarto Piano Comunicazione.
