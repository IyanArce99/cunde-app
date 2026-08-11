import type { NivelProteina } from '../state/types';
import type { Contexto } from '../lib/derive';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import SelectorCoste from './SelectorCoste';
import type { OpcionCoste } from './SelectorCoste';

const OPCIONES: OpcionCoste<NivelProteina>[] = [
  { valor: 'basica', label: 'Básica', nota: 'legumbre y huevo' },
  { valor: 'normal', label: 'Normal', nota: 'carne 3 días' },
  { valor: 'alta', label: 'Alta', nota: 'carne casi a diario' },
];

/**
 * Los textos dicen lo que el motor entrega, no lo que suena bien. "Casi no
 * tiras nada" describía una semana que tiraba el 13,4% —lo mismo que el nivel
 * más alto—, porque "básica" minimizaba precio en vez de desperdicio. Ahora
 * cada nivel optimiza lo suyo (ver OBJETIVO_POR_NIVEL) y estas frases se
 * pueden sostener.
 */
const CONSECUENCIA: Record<NivelProteina, string> = {
  basica: 'Lo que compras aguanta la semana entera: casi no tiras nada.',
  normal: 'Algo de lo fresco se queda por el camino.',
  alta: 'La carne fresca no llega al domingo: se estropea el doble que en básica.',
};

/**
 * ═══ ESTE SELECTOR NO ENSEÑA CIFRAS, Y ES DELIBERADO ═══
 *
 * Llevaba tres por tarjeta: gramos de proteína, lo que costaba la cesta y lo
 * que se tiraba. Nueve números en una fila de tres columnas de 100 px, con
 * «carne casi a diario» partiendo en tres líneas. Ilegible.
 *
 * Pero el motivo de fondo no es el espacio, es que esas cifras invitaban a una
 * comparación que el motor NO sostiene. Medido sobre 162 casos: en el 60-69%,
 * subir de nivel sale MÁS BARATO. No es un fallo del optimizador —se probó a
 * unificarlo y salía igual o peor— sino que el suelo de proteína entra en la
 * puntuación hueco a hueco, así que cada nivel recorre un valle distinto y sus
 * precios no son comparables aunque se pinten en fila.
 *
 * Enseñar tres precios que se contradicen, en una app cuya única defensa es que
 * sus cifras no mienten, es el peor sitio donde podía estar ese problema.
 *
 * Lo que cuesta la elección se ve donde siempre debió verse: en la cesta de
 * arriba, que cambia al tocar. UNA cifra que se mueve dice lo mismo que tres
 * que se contradicen, y esa sí es verdad.
 *
 * Lo que se pierde: ya no se ven los gramos de cada nivel. Se cambian por la
 * frase de consecuencia de debajo, que es lo que el usuario decide de verdad
 * —proteína contra desperdicio— y que está medida: al subir de nivel suben los
 * gramos el 89% de las veces y lo que se tira el 88%.
 *
 * Cuidado con el precio: `lib/suscripcion.ts` llegó a apoyar una decisión de
 * negocio en que «alta cuesta más», que es falso tres de cada cuatro veces.
 */
const SelectorProteina: React.FC<{
  ctx: Contexto;
  /** Los trae la hoja ya calculados, o null mientras el motor trabaja. */
  costes: Record<NivelProteina, CosteOpcion> | null;
  onCambiar: (v: NivelProteina) => void;
}> = ({ ctx, costes, onCambiar }) => (
  <>
    <SelectorCoste
      opciones={OPCIONES}
      costes={costes}
      valor={ctx.proteina}
      onCambiar={onCambiar}
      soloEtiqueta
    />
    <p className="selcoste__consecuencia">{CONSECUENCIA[ctx.proteina]}</p>
  </>
);

export default SelectorProteina;
