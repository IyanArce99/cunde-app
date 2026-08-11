import type { ValoracionPlato } from '../lib/preferencias';
import './ValoracionPlatoSelector.css';

/**
 * El orden es el del efecto sobre el motor, de más a menos presencia: ponlo
 * más, déjalo como está, no lo pongas. Alfabético o por frecuencia serían
 * ordenaciones sin significado; ésta se lee como un mando.
 */
const OPCIONES: { valor: ValoracionPlato; label: string }[] = [
  { valor: 'me_gusta', label: 'Me gusta' },
  { valor: 'neutral', label: 'Está bien' },
  { valor: 'no_quiero', label: 'No, gracias' },
];

interface ValoracionPlatoSelectorProps {
  valor: ValoracionPlato;
  onCambiar: (valoracion: ValoracionPlato) => void;
}

/**
 * ═══ QUÉ TE PARECE ESTE PLATO ═══
 *
 * Tres píldoras en una fila. Ni estrellas, ni caras, ni pulgares: esto no es
 * una nota que se le pone a un restaurante, es una instrucción para el motor.
 * «No, gracias» no dice que el plato sea malo — dice qué tiene que hacer la app.
 *
 * ═══ POR QUÉ NO SON TRES FILAS ═══
 *
 * Tres botones de ancho completo son 168 px en una hoja que ya lleva cabecera,
 * precios, alternativas y tres acciones, y que tiene que caber sin scroll. En
 * fila son 48. El precio es que las etiquetas tienen que ser cortas, y de ahí
 * sale «No, gracias» en vez del «No me lo vuelvas a poner» del encargo: a 13 px
 * en un tercio de 342 px no cabe, y partido en tres líneas deja las tres
 * píldoras descuadradas. Lo que se pierde es precisión, y se recupera entera en
 * la línea que aparece al elegirlo — que además solo la lee quien la necesita.
 *
 * ═══ SE GUARDA AL TOCAR ═══
 *
 * Sin botón de guardar. Es una preferencia de una sola decisión, reversible de
 * un toque y sin consecuencia inmediata en pantalla: pedir confirmación para
 * eso es pedirle al usuario que confirme algo que no ha pasado todavía.
 */
const ValoracionPlatoSelector: React.FC<ValoracionPlatoSelectorProps> = ({ valor, onCambiar }) => (
  <div className="valoracion">
    <span className="valoracion__pregunta" id="valoracion-pregunta">
      ¿Qué te parece este plato?
    </span>
    {/* `group` y no `radiogroup`: un radiogroup obliga a mover el foco con
        flechas y a que Tab entre y salga del grupo entero, y aquí las tres
        opciones son tres botones normales con aria-pressed — el mismo recurso
        que ya usan OptionButton y SelectorCoste en el resto de la app. */}
    <div className="valoracion__opciones" role="group" aria-labelledby="valoracion-pregunta">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={`valoracion__opcion${valor === o.valor ? ' valoracion__opcion--elegida' : ''}`}
          aria-pressed={valor === o.valor}
          onClick={() => onCambiar(o.valor)}
        >
          {o.label}
        </button>
      ))}
    </div>

    {/**
      * Confirmación SOLO al bloquear, y fija mientras la hoja siga abierta.
      *
      * Solo ahí porque es la única de las tres que hace algo que el usuario no
      * ve: las otras dos no cambian nada que no esté ya en pantalla. Y fija en
      * vez de un aviso que se va solo porque lo que dice —que la semana de
      * ahora NO cambia— es justo lo que el usuario va a comprobar mirando la
      * pantalla, y para eso tiene que poder volver a leerlo.
      */}
    {valor === 'no_quiero' && (
      <p className="valoracion__nota" role="status">
        No saldrá en las próximas semanas. Esta se queda como está.
      </p>
    )}
  </div>
);

export default ValoracionPlatoSelector;
