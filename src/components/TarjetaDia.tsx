import { memo } from 'react';
import type { DiaSemana, Plato, Ranura } from '../state/types';
import { eur } from '../lib/format';
import { nombreDiaCompleto, nombreRanura } from '../lib/menu';
import './TarjetaDia.css';

interface TarjetaDiaProps {
  dia: DiaSemana;
  ranuras: { clave: Ranura; etiqueta: string }[];
  onAbrirHueco: (dia: string, ranura: Ranura, plato: Plato | null) => void;
  /** El plato más caro de la semana. Da la escala común de la barra de coste. */
  precioMaximo: number;
}

function metaDe(plato: Plato): string {
  if (plato.tipo === 'sobras') return 'solo calentar';
  return `${plato.minutos} min`;
}

/**
 * Tres cosas distintas, tres verbos. Hasta ahora había dos y el usuario no
 * podía saber si el martes se comía lo mismo recalentado o un plato nuevo
 * hecho con lo de ayer — que es justo la diferencia que este producto vende.
 *
 *   cocinas      — el plato entero, de cero.
 *   recalientas  — lo mismo tal cual. 0 €.
 *   aprovechas   — otro plato con la tanda de ayer. Cuesta lo que se añade.
 *
 * En caja de frase y no en versalitas: van dentro de la línea de servicio
 * ("comida · 25 min · cocinas"), que es una frase, no una cabecera de columna.
 */
function selloDe(plato: Plato | null): string {
  if (!plato) return 'libre';
  if (plato.tipo === 'sobras') return 'recalientas';
  if (plato.tipo === 'ensamblaje') return 'aprovechas';
  return 'cocinas';
}

function origenDe(plato: Plato): string | null {
  if (!plato.origen) return null;
  const cuando = `${nombreRanura(plato.origen.ranura)} del ${nombreDiaCompleto(plato.origen.dia).toLowerCase()}`;
  // Con `desde` es un plato nuevo: se dice de qué sale. Sin él, el principal
  // aguanta y solo se rehace la guarnición.
  if (plato.desde) return `con ${plato.desde.toLowerCase()} de la ${cuando}`;
  return plato.tipo === 'ensamblaje' ? `lo de la ${cuando}, con guarnición nueva` : `de la ${cuando}`;
}

/**
 * EL DÍA ES UNA LÍNEA DE TICKET, NO UNA TARJETA.
 *
 * Formato F6, salido de comparar cinco maquetaciones a 390×844 y medirlas:
 *
 *   · la ESTRUCTURA de línea de ticket —el plato, la guía de puntos, el
 *     precio a la derecha, y el total del día en su cabecera—, que es el
 *     sistema visual del proyecto aplicado al sitio donde antes había una
 *     caja con borde que no decía nada;
 *   · la BARRA DE COSTE de 4 px bajo cada línea, que es lo único que hace
 *     comparable un plato de 0,35 € con uno de 2,01 € de un vistazo. Sin ella
 *     los precios son catorce números sueltos.
 *
 * La caja con borde se va: encerraba dos filas que ya estaban agrupadas por
 * su cabecera de día, y gastaba 16 px de padding y 8 px de hueco por día — 168
 * px en la semana, casi una tarjeta entera de las que no cabían.
 *
 * La miniatura sale casi gratis y está medido: la línea ya apila tres cosas
 * (nombre, barra y servicio), así que los 44 px del cuadro caben en el alto
 * que el texto ocupaba igual. Con foto la lista mide 1.109 px y sin ella
 * 1.089: 20 px en catorce comidas, un 1,8%, y las mismas comidas visibles.
 * Hasta que haya fotos de verdad no se pinta el hueco: un cuadro gris repetido
 * catorce veces es peor que no tener nada.
 */
const TarjetaDia: React.FC<TarjetaDiaProps> = ({ dia, ranuras, onAbrirHueco, precioMaximo }) => {
  const totalDia = ranuras.reduce((a, { clave }) => a + (dia[clave]?.precioRacion ?? 0), 0);

  return (
    <div className="dia">
      <div className="dia__cabecera">
        <span className="dia__nombre">{dia.dia}</span>
        <span className="dia__guia" />
        <span className="dia__total">{eur(totalDia)}</span>
      </div>

      {ranuras.map(({ clave, etiqueta }) => {
        const plato = dia[clave];
        const origen = plato ? origenDe(plato) : null;
        const precio = plato?.precioRacion ?? 0;
        // Mínimo visible: una sobra cuesta 0 € y aun así tiene que dejar
        // rastro, o la fila parece que le falta algo.
        const ancho = precioMaximo > 0 ? Math.max(1.5, (precio / precioMaximo) * 100) : 0;
        const tipo = plato?.tipo ?? 'libre';

        return (
          <button
            className={`dia__hueco dia__hueco--${tipo}`}
            type="button"
            key={clave}
            onClick={() => onAbrirHueco(dia.dia, clave, plato)}
          >
            <span className="dia__plato">{plato ? plato.nombre : 'No cocinas'}</span>
            <span className="dia__linea-guia" />
            <span className="dia__precio">{eur(precio)}</span>
            <span className="dia__pista">
              <span className="dia__barra" style={{ width: `${ancho}%` }} />
            </span>
            <span className="dia__servicio">
              {etiqueta.toLowerCase()} · {plato ? metaDe(plato) : '—'} · {selloDe(plato)}
              {origen && <span className="dia__origen"> · {origen}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default memo(TarjetaDia);
