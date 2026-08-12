import type { CosteOpcion } from '../motor/seleccionar.ts';
import { eur } from '../lib/format';
import './SelectorCoste.css';

export interface OpcionCoste<T extends string> {
  valor: T;
  label: string;
  /**
   * Una línea, sin adjetivos: qué obtienes. Opcional — el selector de proteína
   * las quitó porque a tres columnas descuadraban las alturas y porque
   * prometían un calendario («carne 3 días») que el motor no firma.
   */
  nota?: string;
}

interface SelectorCosteProps<T extends string> {
  opciones: OpcionCoste<T>[];
  /**
   * `null` mientras el motor calcula. Las opciones siguen siendo elegibles:
   * el precio informa la decisión pero no hace falta para tomarla, y bloquear
   * los tres botones durante un segundo por un dato que aún no está sería
   * castigar al usuario por la lentitud del motor.
   */
  costes: Record<T, CosteOpcion> | null;
  valor: T;
  onCambiar: (v: T) => void;
  /**
   * Qué se enseña bajo la etiqueta. En variedad el precio ES el intercambio;
   * en proteína no —el intercambio es proteína contra desperdicio— y poner el
   * precio de protagonista hacía leer los tres niveles como una escalera de
   * precio que no son.
   */
  ejes?: (coste: CosteOpcion) => { principal: string; secundario: string };
  /**
   * ═══ SIN CIFRAS · SOLO NOMBRE Y QUÉ ES ═══
   *
   * Para el selector de proteína, que llevaba TRES números por tarjeta —gramos,
   * euros y lo que se tira— en columnas de 100 px. Nueve cifras en una fila,
   * ninguna dominante, y con nombres largos partiendo en tres líneas.
   *
   * Y hay una segunda razón, más de fondo: esos tres precios en fila invitan a
   * compararlos, y el motor NO garantiza que sean comparables. Medido, en el
   * 60-69% de los casos subir de nivel sale MÁS BARATO, porque cada nivel
   * optimiza una cosa distinta (ver OBJETIVO_POR_NIVEL). Enseñarlos juntos es
   * poner al usuario delante de una contradicción que no lo es.
   *
   * Sin las tres cifras, lo que cuesta cada elección se ve donde debe verse: en
   * la cesta de arriba, que cambia al tocar. Una cifra que se mueve dice lo
   * mismo que tres que se contradicen, y no miente.
   *
   * Lo que NO se calla es que un nivel no se pueda montar: eso sigue saliendo.
   */
  soloEtiqueta?: boolean;
  /**
   * Opciones que llevan una marca al lado de la etiqueta. Hoy solo la usa la
   * proteína para señalar que Alta va con Cunde+.
   *
   * Marca, no bloqueo: la opción sigue siendo elegible y quien decide qué pasa
   * al tocarla es quien pasa `onCambiar`. Este componente no sabe nada de
   * suscripciones y no tiene por qué.
   */
  marcadas?: Partial<Record<T, string>>;
}

/**
 * Las dos palancas del producto se eligen igual: con las consecuencias
 * delante en el momento de decidir, no después de generar. Lo que cambia es
 * QUÉ consecuencia manda en cada una.
 *
 * Un nivel que no se puede montar sale marcado AQUÍ, no falla al elegirlo.
 * Dejar que se elija para luego enseñar un error es el muro por la puerta de
 * atrás.
 */
function SelectorCoste<T extends string>({
  opciones, costes, valor, onCambiar, ejes, soloEtiqueta, marcadas,
}: Readonly<SelectorCosteProps<T>>) {
  const posibles = costes
    ? opciones.map((o) => costes[o.valor]).filter((c) => c.disponible && Number.isFinite(c.carrito))
    : [];
  const masBarata = posibles.length ? Math.min(...posibles.map((c) => c.carrito)) : Number.NaN;

  return (
    <div className="selcoste" aria-busy={costes === null}>
      {opciones.map((o) => {
        const coste = costes?.[o.valor] ?? null;
        const seleccionado = valor === o.valor;
        const clases = ['selcoste__opcion'];
        if (seleccionado) clases.push('selcoste__opcion--seleccionado');
        if (coste && !coste.disponible) clases.push('selcoste__opcion--fuera');

        const fuera = coste ? motivo(coste) : null;
        /* Sin cifras se pinta solo el nombre y qué es — salvo que el nivel no se
           pueda montar, que eso hay que decirlo siempre. Y sin el «calculando»:
           si no hay nada que calcular, esperar no significa nada. */
        let lineas: { principal: string; secundario: string } | null = null;
        if (soloEtiqueta) {
          if (fuera) lineas = { principal: '—', secundario: fuera };
        } else if (!coste) lineas = { principal: '···', secundario: 'calculando' };
        else if (ejes && !fuera) lineas = ejes(coste);
        else lineas = { principal: precioDe(coste), secundario: fuera ?? extraDe(coste, masBarata) };

        return (
          <button
            key={o.valor}
            type="button"
            className={clases.join(' ')}
            onClick={() => onCambiar(o.valor)}
            aria-pressed={seleccionado}
            disabled={!!coste && !coste.disponible}
          >
            <span className="selcoste__label">
              {o.label}
              {/* La marca de Cunde+. Va DENTRO de la etiqueta y no debajo para
                  no descuadrar las alturas: las tres tarjetas siguen midiendo
                  lo mismo. */}
              {marcadas?.[o.valor] && (
                <span className="selcoste__plus">{marcadas[o.valor]}</span>
              )}
            </span>
            {/* Sin nota, ni el hueco: un `<span>` vacío deja su altura de línea
                y las tarjetas vuelven a descuadrarse, que es lo que se venía a
                arreglar. */}
            {o.nota && <span className="selcoste__nota">{o.nota}</span>}
            {lineas && (
              <>
                <span className="selcoste__principal">{lineas.principal}</span>
                <span className="selcoste__extra">{lineas.secundario}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

const precioDe = (c: CosteOpcion) =>
  (c.disponible && Number.isFinite(c.carrito) ? eur(c.carrito) : '—');

/** Por qué no se puede. En una palabra, o null si sí se puede. */
function motivo(coste: CosteOpcion): string | null {
  if (coste.porque === 'recetario') return 'no hay recetas';
  if (coste.porque === 'presupuesto') return 'no cabe';
  if (coste.porque === 'proteina') return 'no llega';
  return null;
}

function extraDe(coste: CosteOpcion, masBarata: number): string {
  const extra = coste.carrito - masBarata;
  return extra < 0.005 ? 'lo más barato' : `+${eur(extra)}`;
}

export default SelectorCoste;
