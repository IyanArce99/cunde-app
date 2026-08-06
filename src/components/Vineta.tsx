import './Vineta.css';

/**
 * VIÑETA DE PANTALLA · ancla visual del onboarding.
 *
 * Comensales y restricciones eran solo título y botones. Presupuesto funciona
 * porque tiene la cifra de 56 px haciendo de ancla; esas dos no tenían nada, y
 * una pantalla que es un titular y tres botones se lee como una plantilla.
 *
 * Dos juegos, conmutables con `?v=b` para poder compararlos con los ojos:
 *
 *   A · vinetas  — fragmentos del mismo ticket contando cosas distintas.
 *                  Trazo de 6, remates rectos, uniones en ángulo, borde
 *                  inferior dentado, cero curvas. Es cómo imprime una
 *                  impresora térmica, no cómo dibuja un vector limpio.
 *   B · iconos   — los de librería: círculos, remates redondos, prohibido.
 *
 * Va con `mask` y no con `<img>` para que herede el color del texto: así el
 * mismo fichero sirve sobre papel y sobre crema, y no hay dos versiones que
 * se desincronicen.
 */
export type Vineta = 'comensales' | 'restricciones' | 'generando';

export function juegoDeVinetas(): 'vinetas' | 'iconos' {
  if (typeof window === 'undefined') return 'vinetas';
  // Se guarda en sessionStorage porque el onboarding navega por rutas y el
  // ?v=b se pierde en el primer push. Es un conmutador de comparación
  // temporal: se va con la decisión.
  const q = new URLSearchParams(window.location.search).get('v');
  if (q) window.sessionStorage.setItem('cunde:vineta', q);
  return window.sessionStorage.getItem('cunde:vineta') === 'b' ? 'iconos' : 'vinetas';
}

const Vineta: React.FC<{ nombre: Vineta }> = ({ nombre }) => (
  <span
    className="vineta"
    aria-hidden="true"
    style={{ ['--vineta' as string]: `url(/marca/${juegoDeVinetas()}/${nombre}.svg)` }}
  />
);

export default Vineta;
