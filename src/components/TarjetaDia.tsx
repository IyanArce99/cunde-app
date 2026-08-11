import { memo } from 'react';
import type { DiaSemana, Plato, Ranura } from '../state/types';
import { diaConFecha, eur, fechaParaLeer } from '../lib/format';
import type { FechaDia } from '../lib/fechas';
import { nombreDiaCompleto, nombreRanura } from '../lib/menu';
import './TarjetaDia.css';

interface TarjetaDiaProps {
  dia: DiaSemana;
  /**
   * El día real que ocupa esta tarjeta. `null` en las semanas generadas antes
   * de que la app supiera de fechas: entonces se enseña `dia.dia`, que es lo
   * que esa semana significaba cuando se montó.
   */
  fecha: FechaDia | null;
  ranuras: { clave: Ranura; etiqueta: string }[];
  onAbrirHueco: (dia: string, ranura: Ranura, plato: Plato | null) => void;
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
function selloDe(plato: Plato | null): string | null {
  if (!plato) return 'libre';
  if (plato.tipo === 'sobras') return 'recalientas';
  if (plato.tipo === 'ensamblaje') return 'aprovechas';
  /* Cocinar es el caso por defecto y no hace falta decirlo: aparecía en doce
     de las catorce filas. Lo que informa es cuando NO se cocina. */
  return null;
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
 * EL DÍA ES UNA TARJETA CON FILAS CLICABLES.
 *
 * Sustituye al formato de línea de ticket (nombre · guía de puntos · precio,
 * con una barra de coste debajo de cada plato). Tres cosas se van, cada una
 * por su motivo:
 *
 *   · LA BARRA DE COSTE POR PLATO. Medía lo caro que era un plato respecto al
 *     más caro de la semana, y no se leía así: parecía una barra de progreso.
 *     El precio ya está escrito justo al lado.
 *   · LA GUÍA DE PUNTOS. Era la metáfora del ticket térmico, que el rediseño
 *     retira entera.
 *   · EL NOMBRE RECOLOREADO. Las sobras pintaban el nombre en gris, y eso las
 *     hacía leer como deshabilitadas cuando son comida igual de real. Ahora el
 *     nombre va siempre en tinta y lo que cambia es el verbo de la línea de
 *     debajo: cocinas / recalientas / aprovechas.
 *
 * Cada hueco es un botón de fila con chevron, que es lo que dice "esto se
 * toca" sin gastar una palabra.
 */
const TarjetaDia: React.FC<TarjetaDiaProps> = ({ dia, fecha, ranuras, onAbrirHueco }) => {
  const totalDia = ranuras.reduce((a, { clave }) => a + (dia[clave]?.precioRacion ?? 0), 0);

  return (
    <div className="dia">
      <div className="dia__cabecera">
        {/**
          * El día REAL, no la posición. «VIE · 7 AGO» y no «LUN», porque la
          * semana de este usuario puede empezar cualquier día.
          *
          * Sin fecha —semanas generadas antes de que la app supiera de
          * fechas— se enseña el nombre de siempre. No se calcula una: esa
          * semana se montó para otros siete días y no sabemos cuáles.
          *
          * El aria-label lleva la fecha entera con año: «VIE · 7 AGO» leído
          * en voz alta es «vie punto siete ago», que no dice nada.
          */}
        <span className="dia__nombre" aria-label={fecha ? fechaParaLeer(fecha) : undefined}>
          {fecha ? diaConFecha(fecha) : dia.dia}
        </span>
        <span className="dia__total">{eur(totalDia)}</span>
      </div>

      {ranuras.map(({ clave, etiqueta }) => {
        const plato = dia[clave];
        const origen = plato ? origenDe(plato) : null;
        const precio = plato?.precioRacion ?? 0;
        const tipo = plato?.tipo ?? 'libre';
        const sello = selloDe(plato);
        /* Sobras a coste cero: la tanda ya se pagó el día que se cocinó. */
        const esGratis = plato !== null && precio === 0;

        return (
          <button
            className={`dia__hueco dia__hueco--${tipo}`}
            type="button"
            key={clave}
            onClick={() => onAbrirHueco(dia.dia, clave, plato)}
          >
            <span className="dia__texto">
              <span className="dia__plato">{plato ? plato.nombre : 'No cocinas'}</span>
              {/* El verbo SOLO cuando no es el de siempre.
                  "cocinas" salía en doce de las catorce filas, así que no
                  distinguía nada: era una palabra repetida que empujaba el
                  origen a una segunda línea. Lo que hay que decir es cuándo la
                  comida NO se cocina — recalientas, aprovechas—, que es
                  justamente lo que abarata la semana. */}
              <span className="dia__servicio">
                {etiqueta.toLowerCase()} · {plato ? metaDe(plato) : '—'}
                {sello && <> · {sello}</>}
                {origen && <span className="dia__origen"> · {origen}</span>}
                {/**
                  * EL POSTRE, EN LA LÍNEA QUE YA EXISTE.
                  *
                  * En su propia fila serían 18 px por hueco — 250 px en catorce
                  * comidas— en la pantalla donde el alto va contado y donde se
                  * acaban de recuperar 18 px del pie. Aquí no cuesta nada.
                  *
                  * «postre:» y no «con», que fue lo primero que puse. En los
                  * huecos de aprovechamiento el origen ya empieza por «con»
                  * —«con merluza en salsa verde de la comida del domingo»— y
                  * salía «con … · con gelatina de fresa»: dos veces la misma
                  * palabra en una frase, y no se distingue qué es el plato y qué
                  * el postre. Con dos puntos se lee de un vistazo y no compite.
                  *
                  * Y sin precio: esta tarjeta es para barrer la semana, y el
                  * céntimo del yogur no cambia ninguna decisión. La cifra va en
                  * la hoja del día, que es donde se para a mirar.
                  */}
                {plato?.postre && <> · postre: {plato.postre.nombre.toLowerCase()}</>}
              </span>
            </span>
            {/* Una sobra no cuesta 0,00 €: no cuesta. El cero se lee como un
                fallo de cálculo o como comida gratis, y no es ninguna de las
                dos — es comida que ya está pagada. */}
            <span className="dia__precio">{esGratis ? 'sobras' : eur(precio)}</span>
            <span className="dia__chevron" aria-hidden="true">›</span>
          </button>
        );
      })}
    </div>
  );
};

export default memo(TarjetaDia);
