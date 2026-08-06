import { useState } from 'react';
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

export const CADENAS_QUE_VIENEN = CADENAS.filter((c) => !c.disponible).map((c) => c.nombre);

/** De dónde son los precios que la app lleva cargados hoy. */
export const ZONA_CARGADA = 'Madrid';

const CP_VALIDO = /^\d{5}$/;
export const cpValido = (cp: string) => CP_VALIDO.test(cp);

interface ElegirSuperProps {
  valor: string;
  codigoPostal: string | null;
  onElegir: (cadena: string) => void;
  onCodigoPostal: (cp: string | null) => void;
}

/**
 * DÓNDE COMPRA, EN DOS PARTES: la cadena y, si tiene catálogo, la zona.
 *
 * EL CÓDIGO POSTAL NO ESTÁ AQUÍ POR EL PRECIO. Medido contra la API el 30 jul
 * (catalogo/comparar-almacenes.js), la misma cesta de 83 productos cuesta
 * 144,50 € en A Coruña y 145,54 € en Barcelona: un 0,7%, y con cero variación
 * en los 69 productos envasados. Nacional para el tarro, regional para el
 * fresco.
 *
 * Está por la REFERENCIA. El mismo producto lleva SKU distinto según la zona:
 * los filetes de vacuno son 8936 en Madrid y 2900 en Sevilla —mismo nombre,
 * otro número—, y la dorada es 87300 en A Coruña y 81234.1 en Sevilla. 25 de
 * nuestros 108 SKU no existen en algún almacén, pero el ingrediente sí:
 * Sevilla tiene cinco corderos y seis doradas. Sin el código postal la lista
 * manda a buscar una referencia que esa tienda no usa.
 *
 * El campo solo aparece con una cadena que tenga catálogo: pedirle el CP a
 * quien ha elegido Lidl sería pedir un dato para nada.
 */
const ElegirSuper: React.FC<ElegirSuperProps> = ({ valor, codigoPostal, onElegir, onCodigoPostal }) => {
  const [cp, setCp] = useState(codigoPostal ?? '');
  const elegida = CADENAS.find((c) => c.nombre === valor);
  const conCatalogo = !!elegida?.disponible;

  return (
    <>
      {/* SOLO LAS CADENAS QUE SE PUEDEN ELEGIR.
          Las otras cinco estaban aquí como tarjetas apagadas: 314 px —de 526
          útiles en un iPhone SE— para decir cinco veces "todavía no", y encima
          repetidos palabra por palabra en el párrafo de abajo, que es el que
          quedaba fuera de pantalla. La intención era enseñar que el producto
          crece; eso lo hace igual una línea de texto que las nombra, y por eso
          la línea se queda. */}
      <div className="super__lista">
        {CADENAS.filter((c) => c.disponible).map((c) => (
          <button
            key={c.nombre}
            type="button"
            className={`super__opcion${valor === c.nombre ? ' super__opcion--seleccionado' : ''}`}
            aria-pressed={valor === c.nombre}
            onClick={() => onElegir(c.nombre)}
          >
            <span className="super__nombre">{c.nombre}</span>
            <span className="super__estado">precios de hoy</span>
          </button>
        ))}
      </div>

      {conCatalogo && (
        <>
          <span className="super__etiqueta super__etiqueta--segunda">Tu código postal</span>
          <div className="super__cp">
            <input
              className="super__cp-campo"
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="28001"
              value={cp}
              aria-label="Tu código postal, cinco cifras"
              aria-describedby="super-cp-nota"
              onChange={(e) => {
                const limpio = e.target.value.replace(/\D/g, '').slice(0, 5);
                setCp(limpio);
                // Se guarda en cuanto es válido, no al salir: si el usuario
                // escribe el CP y toca "Seguir" sin quitar el foco, el dato
                // tiene que estar puesto igual.
                onCodigoPostal(cpValido(limpio) ? limpio : null);
              }}
            />
          </div>
          {/* Se dice de dónde es el catálogo que hay cargado AHORA. Callarlo
              sería el mismo error que ofrecer Lidl sin catálogo: una cifra que
              no corresponde a la tienda del usuario, y él sin saberlo.

              El campo viene con el CP de Madrid puesto (ver CP_POR_DEFECTO),
              así que la frase de reposo ya no puede ser "con tu código postal
              cojo las tuyas": prometía algo que no pasa. Se dice cuál llevo y
              se avisa en cuanto se escribe uno de otra provincia.

              Sin el preámbulo de "cada tienda usa referencias distintas para
              el fresco": era explicar nuestras tripas, ocupaba una línea más y
              "referencias" no es una palabra que use nadie en un súper. */}
          <p className="super__nota" id="super-cp-nota">
            Llevo cargado el catálogo de {ZONA_CARGADA}
            {cpValido(cp) && !cp.startsWith('28')
              ? ', así que algún producto puede no cuadrar hasta que cargue tu zona.'
              : '.'}
          </p>
        </>
      )}
    </>
  );
};

export default ElegirSuper;
