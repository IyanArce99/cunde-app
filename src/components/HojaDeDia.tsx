import { numComensales } from '../state/types';
import type { Comensales, Plato, Ranura } from '../state/types';
import { diaCortoConNumero, eur, eurConSigno, fechaParaLeer } from '../lib/format';
import type { FechaDia } from '../lib/fechas';
import { nombreRanura } from '../lib/menu';
import type { AlternativaParaApp, Retoque } from '../data/motor';
import BottomSheet from './BottomSheet';
import TicketRow from './TicketRow';
import AvisoAlergenos from './AvisoAlergenos';
import ValoracionPlatoSelector from './ValoracionPlatoSelector';
import { identidadDePlato, valoracionDe } from '../lib/preferencias';
import type { PreferenciasPlatos, ValoracionPlato } from '../lib/preferencias';
import './HojaDeDia.css';

interface HojaDeDiaProps {
  /** El hueco concreto al que se aplican las tres acciones. */
  dia: string;
  /** El día real de este hueco. Nulo en semanas anteriores a las fechas. */
  fecha: FechaDia | null;
  ranura: Ranura;
  plato: Plato | null;
  comensales: Comensales;
  /** Para el aviso de alérgenos. Ver AvisoAlergenos. */
  exclusiones: string[];
  /** Qué más puede ir en este hueco. Vacío mientras el motor calcula. */
  alternativas: AlternativaParaApp[];
  onElegirAlternativa: (a: AlternativaParaApp) => void;
  /**
   * Cuántos cambios gratis quedan esta semana. `null` con Cunde+: no se cuenta,
   * y por tanto no se enseña nada — quien ha pagado no necesita un recordatorio
   * de que pagó en cada pantalla.
   */
  cambiosRestantes: number | null;
  /** Pide otra tanda al motor. Sin esto, el enlace no se pinta. */
  onVerMas?: () => void;
  /** Lo que el usuario tiene dicho de los platos. Para marcar la opción puesta. */
  preferenciasPlatos: PreferenciasPlatos;
  /** Guarda la valoración. NO regenera la semana: ver el reducer. */
  onValorar: (platoId: string, valoracion: ValoracionPlato, tipo: 'receta' | 'ensamblaje') => void;
  onRetocar: (retoque: Retoque) => void;
  onVerReceta: () => void;
  onCerrar: () => void;
}

function tiempoDe(plato: Plato | null): string {
  if (!plato) return 'no cocinas';
  if (plato.tipo === 'sobras') return 'solo calentar';
  if (plato.tipo === 'ensamblaje') return `${plato.minutos} min`;
  return `${plato.minutos} min`;
}

const HojaDeDia: React.FC<HojaDeDiaProps> = ({
  dia, fecha, ranura, plato, comensales, exclusiones, alternativas, onElegirAlternativa, onVerMas,
  cambiosRestantes,
  preferenciasPlatos, onValorar, onRetocar, onVerReceta, onCerrar,
}) => {
  const n = numComensales(comensales);
  const costeHueco = (plato?.precioRacion ?? 0) * n;
  const esSobras = plato?.tipo === 'sobras' || plato?.tipo === 'ensamblaje';
  /* Qué se valora al valorar este hueco. `null` en los huecos libres, y
     entonces la sección no se pinta. Ver lib/preferencias.ts: una sobra se
     valora como su receta, y un ensamblaje con nombre propio como él mismo. */
  const identidad = identidadDePlato(plato);
  const valoracion = valoracionDe(preferenciasPlatos, plato);

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="hoja-dia__cabecera">
        {/* Dos líneas y no una frase corrida. Con "LUN · COMIDA · GARBANZOS CON
            TOMATE" a un solo cuerpo, un nombre largo parte por donde le toca y
            deja "TOMATE" solo en la segunda línea, sin que se lea dónde acaba
            el sitio y empieza el plato. Separados, el rótulo de arriba es
            siempre corto y el nombre manda. */}
        <span className="hoja-dia__titulo">
          {/* «VIE 7 · COMIDA» y no «VIE · 7 AGO · COMIDA»: en un rótulo que ya
              lleva el hueco, el mes es lo único que se puede quitar sin perder
              nada — la semana son siete días seguidos y el mes se sabe. */}
          <span
            className="hoja-dia__titulo-donde"
            aria-label={fecha ? `${fechaParaLeer(fecha)}, ${nombreRanura(ranura)}` : undefined}
          >
            {fecha ? diaCortoConNumero(fecha) : dia} · {nombreRanura(ranura).toUpperCase()}
          </span>
          <span className="hoja-dia__titulo-plato">{(plato?.nombre ?? 'Libre').toUpperCase()}</span>
        </span>
        <button className="hoja-dia__cerrar" type="button" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      {/**
        * ═══ AQUÍ NO VA FOTO · SOLO EN LA FICHA DE LA RECETA ═══
        *
        * Esta hoja es para DECIDIR: cuánto cuesta la ración, si lo cambias por
        * otro plato, si lo valoras. La foto empujaba las tres acciones hacia
        * abajo con una imagen que no informa ninguna de ellas — quien abre este
        * hueco ya sabe qué plato es, lo acaba de leer en la tarjeta.
        *
        * Y choca con dos reglas de la casa a la vez: «la cifra en euros es
        * siempre el elemento más grande de la pantalla, nunca una foto de
        * comida» y «fotos de comida grandes» en la lista de lo prohibido.
        *
        * En `RecetaPlato` sí se queda: ahí el usuario ha decidido cocinar y
        * quiere ver cómo tiene que quedar.
        */}

      {/* Los DOS precios, y dichos. En la lista de la semana el plato pone
          0,98 € —la ración— y aquí ponía 1,96 € sin más aviso que un "2
          raciones" en la etiqueta: dos cifras distintas para el mismo plato en
          dos pantallas seguidas, y la de dentro el doble que la de fuera. El
          usuario que las ve no piensa "una es por ración", piensa que una de
          las dos está mal — y en una app cuya tesis es la cifra, eso se paga
          en todos los demás números. */}
      <TicketRow
        label={`${tiempoDe(plato)} · ${eur(plato?.precioRacion ?? 0)} la ración`}
        value={n === 1 ? eur(costeHueco) : `${eur(costeHueco)} las ${n}`}
        size={15}
      />

      {/**
        * ═══ EL POSTRE ═══
        *
        * Aquí SÍ con su precio: es la pantalla donde se para a mirar, y es la
        * única respuesta a «¿por qué sube la cifra si activo el postre?».
        *
        * En una fila aparte y no sumado al plato: no se cocina, no se puede
        * cambiar por otro y no entra en la comparación con las alternativas —si
        * entrara, comparar dos platos incluiría un yogur idéntico en los dos y
        * el ahorro dejaría de ser el del plato.
        */}
      {plato?.postre && (
        <TicketRow
          label={`de postre · ${plato.postre.nombre.toLowerCase()}`}
          value={n === 1
            ? eur(plato.postre.precioRacion)
            : `${eur(plato.postre.precioRacion * n)} las ${n}`}
          size={15}
        />
      )}

      {esSobras && (
        <p className="hoja-dia__aviso">
          {plato?.desde
            ? `Este plato sale de ${plato.desde.toLowerCase()}, que cocinas antes. Solo compras lo que se le añade.`
            : 'Este hueco lo cubre lo que cocinas antes. Si lo cambias, recoloco esa tanda.'}
        </p>
      )}

      {!!plato?.omitidos?.length && (
        <p className="hoja-dia__aviso">
          Lo hago sin {plato.omitidos.join(' ni ').toLowerCase()}: no encaja con lo que has quitado. El plato
          funciona igual.
        </p>
      )}

      {/* ═══ CAMBIAR POR ═══
          Antes había un botón "Cambiar plato · otro reparto desde aquí" que se
          tocaba a ciegas: salía otra cosa, sin saber cuál ni a cuánto. Ahora se
          ven dos candidatos con su diferencia POR RACIÓN y con signo.

          Por ración y no el precio absoluto: saber que el otro plato vale
          0,95 € no sitúa a nadie; saber que ahorra 0,89 € sí, y además es la
          misma unidad que ya se lee en la tarjeta del día.

          Cada alternativa trae SU semana ya construida, así que al elegir una
          se guarda esa misma. Si se recalculara al aplicar, el motor podría
          devolver otra y el usuario habría elegido un precio que no recibe. */}
      {alternativas.length > 0 && (
        <>
          {/**
            * ═══ CUÁNTOS CAMBIOS QUEDAN · DISCRETO, NO UN CONTADOR ═══
            *
            * Va al lado del rótulo, en gris y a 12 px. No es una cuenta atrás ni
            * un marcador: es la misma clase de nota que «25 min · 0,93 € la
            * ración», que esta hoja ya tiene.
            *
            * Con Cunde+ no sale NADA. Nada de «ilimitado» ni de sellos: quien ha
            * pagado no tiene que ver un recordatorio de que pagó en cada
            * pantalla. Simplemente funciona.
            *
            * Y con cero restantes tampoco se enseña un aviso aquí: el usuario
            * puede seguir mirando alternativas: lo que sale es el muro cuando
            * elige una. Bloquear la lista antes de tiempo sería enseñarle un
            * candado en vez de un producto.
            */}
          <span className="hoja-dia__rotulo">
            Cambiar por
            {cambiosRestantes !== null && cambiosRestantes > 0 && (
              <span className="hoja-dia__cambios">
                {cambiosRestantes === 1 ? 'te queda 1 cambio gratis' : `${cambiosRestantes} cambios gratis`}
              </span>
            )}
          </span>
          <div className="hoja-dia__alternativas">
            {alternativas.map((a) => (
              <button
                key={a.recetaId}
                type="button"
                className="hoja-dia__alternativa"
                onClick={() => onElegirAlternativa(a)}
              >
                <span className="hoja-dia__alt-texto">
                  <span className="hoja-dia__alt-nombre">{a.nombre}</span>
                  <span className="hoja-dia__alt-meta">{a.minutos} min · cocinas</span>
                </span>
                <span className="hoja-dia__alt-precio">
                  <span
                    className={`hoja-dia__alt-delta${a.deltaRacion < 0 ? ' hoja-dia__alt-delta--baja' : ''}`}
                  >
                    {eurConSigno(a.deltaRacion)}
                  </span>
                  <span className="hoja-dia__alt-unidad">por ración</span>
                </span>
              </button>
            ))}
          </div>
          {/* Dos de salida porque cada candidato es una construcción entera del
              motor. Quien no encuentra lo suyo en dos pide más y las paga; el
              resto no espera por opciones que no iba a mirar. */}
          {onVerMas && (
            <button type="button" className="hoja-dia__mas" onClick={onVerMas}>
              Ver más platos ›
            </button>
          )}
        </>
      )}

      {/**
        * ═══ LA VALORACIÓN VA AQUÍ, Y NO ARRIBA NI ABAJO ═══
        *
        * Después de las alternativas y antes de las acciones. La hoja se lee
        * de arriba abajo como una escalera de compromiso: qué es este plato →
        * qué cuesta → qué otros hay → qué opino → qué hago. Poner la opinión
        * antes de las alternativas la haría parecer un paso obligatorio para
        * llegar a lo que el usuario venía a hacer; ponerla al final, debajo de
        * las tres acciones, la dejaría fuera de la vista y detrás de tres
        * botones que cierran la hoja.
        *
        * Solo si hay algo que valorar: un hueco libre no es un plato. Ver
        * `identidadDePlato`.
        */}
      {identidad && (
        <ValoracionPlatoSelector
          valor={valoracion}
          onCambiar={(v) => onValorar(identidad.id, v, identidad.tipo)}
        />
      )}

      {/* Fila compacta de tres. Lo que antes eran tres filas de 56 px con
          título y subtítulo cada una son ahora tres cuadros: son acciones
          conocidas y no necesitan que se les explique cada vez. */}
      <div className="hoja-dia__acciones">
        <button className="hoja-dia__accion" type="button" onClick={() => onRetocar('barato')}>
          <span className="hoja-dia__icono hoja-dia__icono--accion">↓</span>
          <span className="hoja-dia__accion-titulo">Más barato</span>
        </button>

        <button className="hoja-dia__accion" type="button" onClick={() => onRetocar('libre')}>
          <span className="hoja-dia__icono">✕</span>
          <span className="hoja-dia__accion-titulo">No cocino</span>
        </button>

        <button
          className="hoja-dia__accion"
          type="button"
          disabled={plato?.tipo !== 'cocinado'}
          onClick={onVerReceta}
        >
          <span className="hoja-dia__icono">▤</span>
          <span className="hoja-dia__accion-titulo">Receta</span>
        </button>
      </div>

      <AvisoAlergenos exclusiones={exclusiones} compacto />
    </BottomSheet>
  );
};

export default HojaDeDia;
