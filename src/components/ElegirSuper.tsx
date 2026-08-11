import './SelectorSuper.css';

/**
 * Las cadenas, y cuáles tienen catálogo de verdad.
 *
 * `disponible` sale de si hay catálogo raspado, no de una intención. La regla
 * que gobierna esta lista: **nadie puede elegir una cadena sin catálogo y
 * recibir precios de otra.** Antes se ofrecían seis y solo había precios de
 * Mercadona, así que quien elegía Lidl se llevaba el ticket de Mercadona sin
 * saberlo. Eso no es un ajuste que no funciona: es una cifra en euros que
 * miente, que es lo único que este producto no se puede permitir.
 */
export const CADENAS: { nombre: string; disponible: boolean }[] = [
  { nombre: 'Mercadona', disponible: true },
  { nombre: 'Lidl', disponible: false },
  { nombre: 'Carrefour', disponible: false },
  { nombre: 'Dia', disponible: false },
  { nombre: 'Alcampo', disponible: false },
  { nombre: 'Consum', disponible: false },
];

/** De dónde son los precios que la app lleva cargados hoy. */
export const ZONA_CARGADA = 'Madrid';

interface ElegirSuperProps {
  valor: string;
  onElegir: (cadena: string) => void;
  /** Se toca una cadena sin catálogo. La pantalla decide qué contar. */
  onSinCatalogo: (cadena: string) => void;
}

/**
 * DÓNDE COMPRA. Solo la cadena.
 *
 * ═══ LAS SEIS SE VEN, AUNQUE SOLO UNA SE PUEDA ELEGIR ═══
 *
 * Estuvieron ocultas una temporada: cinco tarjetas apagadas gastaban 314 px de
 * los 526 útiles de un iPhone SE para decir cinco veces "todavía no". Vuelven
 * porque en rejilla de dos columnas cuestan la mitad, y porque enseñar lo que
 * viene es lo que hace que una app con un solo súper no parezca un experimento.
 *
 * El control es REDONDO, no cuadrado: un cuadrado dice "puedes marcar varias" y
 * aquí solo se elige una. Las que no tienen catálogo no llevan control —no hay
 * nada que marcar— y al tocarlas dan una salida, no un muro.
 *
 * ═══ POR QUÉ SE FUE EL CÓDIGO POSTAL ═══
 *
 * Estaba por un motivo bueno: el mismo producto lleva SKU distinto según la
 * zona —los filetes de vacuno son 8936 en Madrid y 2900 en Sevilla—, así que
 * sin la zona la lista manda a buscar una referencia que esa tienda no usa.
 * Pero eso solo importa el día que haya catálogo POR ALMACÉN, y hoy hay uno
 * solo: `almacen` no lo lee ninguna línea de la app. O sea que se le pedían
 * cinco cifras al usuario en la primera pantalla del embudo a cambio de nada.
 */
const ElegirSuper: React.FC<ElegirSuperProps> = ({ valor, onElegir, onSinCatalogo }) => (
  <div className="super__lista">
    {CADENAS.map((c) => {
      const elegida = valor === c.nombre;
      return (
        <button
          key={c.nombre}
          type="button"
          className={`super__opcion${elegida ? ' super__opcion--seleccionado' : ''}${c.disponible ? '' : ' super__opcion--fuera'}`}
          /* No `disabled`: un botón deshabilitado no se puede enfocar ni
             anunciar, y aquí tocarlo SÍ hace algo — explica por qué no está.
             `aria-disabled` lo dice sin quitarlo del recorrido de teclado. */
          aria-disabled={!c.disponible}
          aria-pressed={elegida}
          onClick={() => (c.disponible ? onElegir(c.nombre) : onSinCatalogo(c.nombre))}
        >
          <span className="super__fila">
            <span className="super__nombre">{c.nombre}</span>
            {c.disponible && (
              <span className={`super__radio${elegida ? ' super__radio--marcado' : ''}`} aria-hidden="true">
                {elegida ? '✓' : ''}
              </span>
            )}
          </span>
          <span className="super__estado">{c.disponible ? `precios de ${ZONA_CARGADA}` : 'próximamente'}</span>
        </button>
      );
    })}
  </div>
);

export default ElegirSuper;
