/**
 * QPC Archetipi — entry point
 */
import { loadArchetipi } from './modules/maschere.js';
import { createArchetipi } from './modules/archetipi.js';

/**
 * API pubblica
 *
 * @example
 * QPC.loadArchetipi({ dir: 'archetipi/', n: 72 })   // 72 = 8×9: esatto per tutti
 *   .then(QPC.archetipi)
 *   .catch(console.error);
 */
window.QPC = { loadArchetipi, archetipi: createArchetipi };

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
