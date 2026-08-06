import type { NivelProteina } from '../state/types';
import type { Contexto } from '../lib/derive';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import { eur } from '../lib/format';
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
 * El precio NO es el protagonista de este selector. El intercambio de esta
 * palanca es proteína contra desperdicio, y poner euros grandes hacía leer
 * los tres niveles como una escalera de precio que no son: básica puede salir
 * más cara que alta y no pasa nada, porque lo que compra es otra cosa.
 *
 * Debajo de cada nivel van las dos cosas que sí se intercambian, y el precio
 * queda en la línea pequeña, donde le corresponde.
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
      ejes={(c) => ({
        principal: `${c.proteina.toFixed(0)} g`,
        // Dos líneas, no dos cifras separadas por un punto medio: en una
        // columna de 100 px "tiras 1,45 € · 50,42 €" se partía en tres
        // trozos arbitrarios. Primero lo que cuesta la cesta, que es lo que
        // decide, y debajo lo que se tira, que es el argumento.
        secundario: `${eur(c.carrito)}
tira ${eur(c.perecedero)}`,
      })}
    />
    <p className="selcoste__consecuencia">{CONSECUENCIA[ctx.proteina]}</p>
  </>
);

export default SelectorProteina;
