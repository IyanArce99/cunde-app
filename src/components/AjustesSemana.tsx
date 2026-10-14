import { useEffect, useState } from 'react';
import type { Comensales, ComidasPref, Esfuerzo, NivelProteina, Perfil, Preferencias, Variedad } from '../state/types';
import type { Existencias } from '../motor/carrito.ts';
import type { PreferenciasPlatos } from '../lib/preferencias';
import { costesDeProteina, costesDeVariedad } from '../lib/derive';
import type { Contexto } from '../lib/derive';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import { numComensales } from '../state/types';
import { presupuestoMinimoViable } from '../lib/derive';
import { diaConFecha, eur, eurSinSimbolo } from '../lib/format';
import BudgetSlider from './BudgetSlider';
import { hoy } from '../lib/fechas';
import type { FechaDia } from '../lib/fechas';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import SelectorExclusiones from './SelectorExclusiones';
import SelectorVariedad from './SelectorVariedad';
import SelectorProteina from './SelectorProteina';
import './AjustesSemana.css';
import { URL_PRIVACIDAD } from '../lib/legal';

const OPCIONES_COMIDAS: { valor: ComidasPref; label: string; meta: string }[] = [
  { valor: 'comidas', label: 'Comidas', meta: '7 platos' },
  { valor: 'cenas', label: 'Cenas', meta: '7 platos' },
  { valor: 'ambas', label: 'Las dos', meta: '14 platos' },
];

/* Las mismas cinco y en el mismo orden que en el onboarding (Datos.tsx). */
const OPCIONES_COMENSALES: Comensales[] = ['1', '2', '3', '4', '5+'];

const OPCIONES_ESFUERZO: { valor: Esfuerzo; label: string; sub: string }[] = [
  { valor: 'minimo', label: 'Lo mínimo', sub: 'menos de 20 min' },
  { valor: 'normal', label: 'Lo normal', sub: '30 a 40 min' },
  { valor: 'libre', label: 'Me gusta cocinar', sub: 'sin límite' },
];

interface AjustesSemanaProps {
  preferenciasActuales: Preferencias;
  perfil: Perfil;
  origen: 'exclusiones' | 'sobrante';
  /** Lo que cuesta la cesta que hay AHORA detrás de la hoja. La referencia. */
  cestaActual: number;
  /**
   * Se guardan las dos cosas a la vez porque cambian juntas: subir de 2 a 4
   * comensales sube el suelo del presupuesto, y guardar una sin la otra deja el
   * tope por debajo de lo que cuesta comer.
   *
   * El súper NO está aquí: solo Mercadona tiene catálogo, así que el selector
   * serían cinco tarjetas apagadas para cambiar algo que solo puede valer una
   * cosa. Cuando haya una segunda cadena, entra — y entra en la capa de «lo que
   * no cambia», que es donde le toca.
   */
  onGuardar: (preferencias: Preferencias, perfil: Pick<Perfil, 'comensales' | 'presupuestoSemanal'>) => void;
  onCerrar: () => void;
  /** Cuántos platos tiene bloqueados, para la fila de la capa 2. */
  bloqueados: number;
  /** Abre la lista para devolver alguno. La abre la pantalla, no esta hoja. */
  onAbrirBloqueados: () => void;
  /** Cuándo empieza la semana, para la fila de arriba. */
  inicioSemana: FechaDia;
  /** Abre el selector de fecha. Lo abre la pantalla, como los bloqueados. */
  onAbrirInicio: () => void;

  /**
   * ═══ EL ESTADO DE LA CUENTA · SIN ESTO LA HOJA MIENTE ═══
   *
   * Son los cuatro que `regenerar()` pasa al motor. La hoja no los recibía, así
   * que estimaba un problema distinto: 63,14 € contra los 47,29 que la app
   * monta de verdad con dos semanas de historial.
   *
   * No son opcionales. Ponerlos con valor por defecto habría dejado que un
   * `<AjustesSemana>` nuevo se olvidara de pasarlos y volviera el fallo sin que
   * nada se quejara.
   */
  /** Si el usuario tiene Cunde+. Solo lo usa el selector de proteína. */
  tienePlus: boolean;
  /** Se llama al tocar Proteína alta sin Cunde+. Cierra la hoja y abre el muro. */
  onPideAlta: () => void;
  semanaNumero: number;
  historial: string[][];
  despensa: Existencias;
  preferenciasPlatos: PreferenciasPlatos;
}

/**
 * ═══ POR QUÉ ESTA HOJA TIENE DOS CAPAS ═══
 *
 * Medía 1426 px en una caja de 776: 1,7 pantallas de scroll con cinco
 * preguntas seguidas. Pero el problema no era el alto, era el orden.
 *
 * Se entra aquí desde "ajustar" o desde "te sobran 1,11 €", o sea con UNA
 * intención: mover la cifra. Y lo primero que aparecía era "¿qué resuelvo?",
 * que se contesta una vez en la vida. Las dos palancas que de verdad mueven el
 * dinero —qué semana y cuánta proteína— quedaban por debajo del pliegue.
 *
 * Así que las cinco preguntas se parten por lo que son:
 *
 *   · LO DE ESTA SEMANA (aquí): qué semana y cuánta proteína. Las dos que
 *     cambian el precio y las dos que se tocan cada domingo.
 *   · LO QUE NO CAMBIA (una capa detrás): comidas o cenas, cuánto cocinar y
 *     alergias. Se ponen una vez. Siguen a un toque y la fila las resume, así
 *     que no quedan escondidas — las alergias, que son seguridad alimentaria,
 *     se leen sin abrir nada.
 *
 * Y arriba del todo, pegado, lo que cuesta la cesta con lo que llevas elegido
 * y cuánto sube o baja respecto a la que tienes detrás. Antes se cambiaban
 * cosas a ciegas y el precio nuevo no aparecía hasta guardar.
 */
const AjustesSemana: React.FC<AjustesSemanaProps> = ({
  preferenciasActuales, perfil, origen, cestaActual, onGuardar, onCerrar, bloqueados, onAbrirBloqueados,
  inicioSemana, onAbrirInicio,
  semanaNumero, historial, despensa, preferenciasPlatos, tienePlus, onPideAlta,
}) => {
  const [comidas, setComidas] = useState(preferenciasActuales.comidas);
  const [esfuerzo, setEsfuerzo] = useState(preferenciasActuales.esfuerzo);
  const [variedad, setVariedad] = useState(preferenciasActuales.variedad);
  const [proteina, setProteina] = useState(preferenciasActuales.proteina);
  const [exclusiones, setExclusiones] = useState(preferenciasActuales.exclusiones);
  const [postre, setPostre] = useState(preferenciasActuales.postre);
  const [capa, setCapa] = useState<'semana' | 'fijo'>('semana');

  /**
   * ═══ CUÁNTOS SOIS, CUÁNTO TIENES Y DÓNDE COMPRAS · SE PODÍAN CONTESTAR UNA
   * SOLA VEZ EN LA VIDA ═══
   *
   * `SET_COMENSALES` y `SET_SUPER` solo se despachaban desde el onboarding, y
   * `SET_PRESUPUESTO` desde el onboarding y desde el botón de «con 46 € sí».
   * O sea: contestabas «somos 2, Mercadona, 65 €» el primer día y no había
   * forma de volver a tocarlo nunca. Reinstalar la app era la única salida.
   *
   * Y el presupuesto es SEMANAL por definición: la frase que define el producto
   * es «tengo 65 € **esta semana**». Un tope semanal que no se puede cambiar
   * cada semana no es un tope semanal.
   *
   * Van en esta capa y no detrás de «lo que no cambia» porque son las dos
   * palancas que más mueven la cifra que hay justo encima. El súper sí va
   * detrás: eso sí que no cambia.
   */
  const [comensales, setComensales] = useState(perfil.comensales);
  const [presupuesto, setPresupuesto] = useState(perfil.presupuestoSemanal);
  const n = numComensales(comensales);

  /* El suelo se mueve con los comensales, las comidas y lo que no comes. Mismo
     cálculo que en el onboarding, y por eso mismo helper: si aquí se pudiera
     bajar de él, la semana siguiente saldría sin cuadrar. */
  const minimoViable = presupuestoMinimoViable(comensales, comidas, esfuerzo, exclusiones, proteina, postre);
  const techo = Math.ceil((minimoViable * 2.5) / 10) * 10;
  const tope = Math.max(presupuesto, minimoViable);
  useEffect(() => {
    if (presupuesto < minimoViable) setPresupuesto(minimoViable);
  }, [minimoViable, presupuesto]);

  /**
   * EL DESLIZADOR NO RECALCULA MIENTRAS EL DEDO SE MUEVE.
   *
   * Los otros controles de esta hoja son botones: un toque, un valor nuevo,
   * seis generaciones del motor. El deslizador no — arrastrarlo de 50 a 80 €
   * emite decenas de valores, y cada uno dispararía esas seis generaciones de
   * ~1,2 s. La hoja se quedaría clavada durante todo el gesto.
   *
   * Así que el precio se recalcula 350 ms después de soltar. El número grande
   * de arriba sí sigue al dedo, porque ese es el tope y lo pone el usuario; lo
   * que espera es la estimación de lo que cabe dentro, que es lo caro.
   */
  const [topeQuieto, setTopeQuieto] = useState(tope);
  useEffect(() => {
    const id = setTimeout(() => setTopeQuieto(tope), 350);
    return () => clearTimeout(id);
  }, [tope]);

  /**
   * ═══ EL CONTEXTO LLEVA TAMBIÉN EL ESTADO DE LA CUENTA ═══
   *
   * Sin estos cuatro, la hoja estimaba un problema distinto del que resuelve
   * `regenerar()`: enseñaba 63,14 € para una semana que la app monta por 47,29.
   * Quince euros de desfase, y la misma cifra pasara lo que pasara en la cuenta
   * — porque no sabía qué había en casa ni qué se comió la semana pasada.
   *
   * Se notaba al abrir la hoja sin tocar nada: aparecía un «sube 2,37 €» que el
   * usuario no había provocado. Ver `lib/derive.ts:Contexto`.
   */
  const ctx: Contexto = {
    comensales,
    comidas,
    esfuerzo,
    exclusiones,
    presupuesto: topeQuieto,
    variedad,
    proteina,
    postre,
    semanaNumero,
    historial,
    despensa,
    preferenciasPlatos,
    /* La fecha de inicio decide `ordenDias`, y de ahí en qué días caen los
       huecos aprovechados. Sin ella la estimación reparte la semana distinto
       de como la reparte la app. */
    fechaInicioSemana: inicioSemana,
  };

  /**
   * LAS ESTIMACIONES NO SE CALCULAN EN EL RENDER.
   *
   * Cada nivel de cada selector es una generación completa del motor —seis en
   * total, ~1,2 s cada una— y al pedirlas dentro del render el hilo se iba
   * antes de pintar nada. Medido en el navegador: abrir la hoja tardaba 7,3 s
   * y cada toque dentro otros 4,5, sin ninguna señal de que algo pasara. La
   * app parecía colgada, que en la práctica es peor que ser lenta.
   *
   * Ahora la hoja se pinta al instante con los precios en "calculando" y el
   * motor arranca después de dos cuadros: uno pinta el toque, el otro el
   * estado. Los tres botones siguen siendo elegibles mientras tanto — el
   * precio informa la decisión, no la condiciona.
   */
  const claveCtx = `${comidas}|${esfuerzo}|${variedad}|${proteina}|${exclusiones.join(',')}|${postre}`
    + `|${comensales}|${topeQuieto}`;
  const [costes, setCostes] = useState<{
    variedad: Record<Variedad, CosteOpcion>;
    proteina: Record<NivelProteina, CosteOpcion>;
    sinFiltros: CosteOpcion | null;
  } | null>(null);

  useEffect(() => {
    setCostes(null);
    let vivo = true;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!vivo) return;
      setCostes({
        variedad: costesDeVariedad(ctx),
        proteina: costesDeProteina(ctx),
        // Solo si hay algo que comparar. Estaba fuera del if y montaba tres
        // semanas más en el caso normal —la mayoría no tiene restricciones—
        // para una nota que luego no se enseñaba.
        sinFiltros: exclusiones.length > 0 ? costesDeVariedad({ ...ctx, exclusiones: [] })[variedad] : null,
      });
    }));
    return () => { vivo = false; cancelAnimationFrame(id); };
    // ctx se reconstruye en cada render; la clave es lo que de verdad cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveCtx]);

  // Lo que cuestan los filtros que hay puestos AHORA, comparado con no tener
  // ninguno. Se dice al activarlos, no después de generar: enterarse de que
  // "sin gluten" se come 24 € cuando ya tienes la semana delante es tarde.
  const conFiltros = costes?.variedad[variedad] ?? null;
  const sinFiltros = costes?.sinFiltros ?? null;
  const sobrecoste = conFiltros && sinFiltros ? conFiltros.carrito - sinFiltros.carrito : 0;
  const avisoFiltro = conFiltros !== null && sinFiltros !== null
    && Number.isFinite(sobrecoste) && sobrecoste > 0.5;

  /**
   * LO QUE COSTARÍA LA CESTA CON LO QUE LLEVAS ELEGIDO.
   *
   * La referencia es `cestaActual`, o sea el número que el usuario tiene
   * detrás de la hoja en ese mismo momento, y no otra estimación del motor:
   * es la comparación que él puede comprobar con los ojos, y además sale
   * gratis. Comparar dos estimaciones habría costado otra semana construida
   * para responder a algo que ya sabemos.
   *
   * Se cuenta como cambio a partir de 5 céntimos: por debajo de eso es ruido
   * de redondeo y una flecha que se mueve sin motivo mina la confianza en
   * todas las demás cifras.
   */
  const nuevaCesta = conFiltros && Number.isFinite(conFiltros.carrito) ? conFiltros.carrito : null;
  const delta = nuevaCesta === null ? 0 : nuevaCesta - cestaActual;
  const cambia = nuevaCesta !== null && Math.abs(delta) >= 0.05;
  /* Contra el tope que hay puesto EN LA HOJA, no contra el guardado: si acabas
     de subirlo para que quepa, el rojo tiene que irse en ese momento. */
  const tePasas = nuevaCesta !== null && nuevaCesta > tope;

  /**
   * Guardar sí bloquea: regenera la semana entera y son 2,6 s medidos. No se
   * puede hacer en dos cuadros como las estimaciones —el resultado ES la
   * pantalla siguiente— así que lo que se hace es pintar el botón trabajando
   * ANTES de arrancar. Sin esto el usuario tocaba, no pasaba nada visible
   * durante casi tres segundos, y volvía a tocar.
   */
  const [guardando, setGuardando] = useState(false);
  const guardar = () => {
    setGuardando(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      onGuardar({
        comidas,
        esfuerzo,
        variedad,
        /**
         * ═══ GUARDAR AJUSTES ES ELEGIR LA VARIEDAD, SE HAYA TOCADO O NO ═══
         *
         * Aquí ponía `variedadElegida || variedad !== preferenciasActuales.variedad`:
         * solo contaba como elegida si CAMBIABA. El comentario que lo acompañaba
         * decía, con estas palabras, que «un ajuste que el usuario pone y la app
         * le quita por su cuenta es peor que uno mal puesto de salida» — y era
         * exactamente lo que provocaba.
         *
         * El fallo, reproducido en navegador y con el que arranca TODO usuario
         * recién salido del onboarding (`variedadElegida: false`):
         *
         *   1. Abre Ajustes. La pantalla enseña «nunca repites plato» MARCADO.
         *   2. Toca solo la proteína. Sigue marcado «nunca repites plato».
         *   3. Pulsa Guardar → se guarda `variedad: 'poca'`. O sea «repites».
         *
         * Porque la variedad no había cambiado respecto a la anterior, esto
         * dejaba `variedadElegida` en false, y entonces `regenerar` volvía a
         * llamar a `variedadQueMenosDesperdicia` con la proteína NUEVA y se
         * quedaba con la más barata, que ya no era la que el usuario tenía
         * delante. La hoja enseñaba una cosa y guardaba la contraria.
         *
         * Ahora es `true` y punto: si has abierto la hoja, has visto las dos
         * semanas con su precio, una marcada, y has pulsado «Guardar ajustes»,
         * eso ES tu elección. No hace falta que la muevas para que cuente.
         *
         * Lo que se pierde: a quien abre Ajustes solo para mover el tope se le
         * congela la variedad que tenía en pantalla, y la app deja de
         * reoptimizársela sola. Es un precio pequeño y se paga a gusto —
         * congelar lo que el usuario vio es predecible; cambiárselo por debajo
         * después de que pulse Guardar no lo es, y era lo que pasaba.
         *
         * El automatismo sigue vivo donde tiene sentido: quien nunca abre
         * Ajustes mantiene `variedadElegida: false` desde el onboarding y el
         * motor le sigue eligiendo la que menos desperdicia.
         */
        variedadElegida: true,
        proteina,
        exclusiones,
        postre,
      }, { comensales, presupuestoSemanal: tope });
    }));
  };

  return (
    <BottomSheet onDismiss={onCerrar}>
      {/* La única hoja de la app que no tenía salida visible. Se cerraba
          tocando el velo —que nadie descubre— y su único botón, "Guardar
          ajustes", rehace la semana entera y tira lo que lleves marcado en la
          compra. Quien la abría por curiosidad no tenía forma segura de salir.

          De paso le pone nombre: sin cabecera, un lector de pantalla anunciaba
          la hoja como "¿Qué resuelvo?", que es la primera pregunta, no lo que
          es esto. */}
      <div className="ajustes__cabecera">
        {capa === 'fijo' && (
          <button
            className="ajustes__volver"
            type="button"
            onClick={() => setCapa('semana')}
            aria-label="Volver a los ajustes de la semana"
          >
            ‹
          </button>
        )}
        <span className="ajustes__titulo">
          {capa === 'semana' ? 'AJUSTAR LA SEMANA' : 'LO QUE NO CAMBIA'}
        </span>
        <button className="ajustes__cerrar" type="button" onClick={onCerrar} aria-label="Cerrar sin guardar">
          ✕
        </button>
      </div>

      {/* EL TOTAL, PEGADO ARRIBA.
          Es una app de dinero, así que también aquí manda la cifra en euros. Va
          pegada porque el sitio donde se toca —los selectores— y el sitio donde
          se ve el efecto tienen que verse a la vez: antes se cambiaban cosas a
          ciegas y el precio nuevo no aparecía hasta después de guardar. */}
      <div className="ajustes__total" aria-live="polite">
        <span className="ajustes__total-rotulo">TU CESTA</span>
        <div className="ajustes__total-fila">
          <span className="ajustes__total-cifra" style={tePasas ? { color: 'var(--roja)' } : undefined}>
            {nuevaCesta === null ? '···' : eur(nuevaCesta)}
          </span>
          {cambia && (
            /* Baja: resaltado con el amarillo de rebaja, que es el color que
               este proyecto tiene para el ahorro. Sube: neutro, porque subir no
               es un error mientras quepa — solo va en rojo cuando de verdad se
               pasa del tope. */
            <span
              className={`ajustes__delta${delta < 0 ? ' ajustes__delta--baja' : ''}`}
              style={delta > 0 && tePasas ? { color: 'var(--roja)' } : undefined}
            >
              {delta < 0 ? `baja ${eur(-delta)}` : `sube ${eur(delta)}`}
            </span>
          )}
        </div>
        {tePasas && (
          <span className="ajustes__total-pie">Te pasas del tope de {eur(tope)}.</span>
        )}
      </div>

      {capa === 'semana' ? (
        <>
          {/**
            * ═══ EMPIEZA · EN LA PRIMERA CAPA, NO EN «LO QUE NO CAMBIA» ═══
            *
            * La estructura de esta hoja dice que lo que se pone una vez en la
            * vida va detrás y lo que se toca cada domingo va delante. La fecha
            * de inicio se toca cada semana —o al menos puede— así que meterla
            * con las alergias y el "comidas o cenas" habría sido seguir la
            * forma de la hoja contra su propio criterio.
            *
            * Y va ARRIBA del todo, antes de variedad, porque es lo primero que
            * se decide al planificar: cuándo empieza esto. Lo demás es cómo.
            *
            * Es una fila y no un selector desplegado: son cuatro opciones que
            * no caben aquí sin empujar las dos palancas que mueven el dinero
            * por debajo del pliegue, que es el problema que esta hoja ya tuvo.
            */}
          <button type="button" className="ajustes__puerta ajustes__puerta--primera" onClick={onAbrirInicio}>
            <span className="ajustes__puerta-fila">
              <span className="ajustes__puerta-titulo">Empieza</span>
              <span className="ajustes__puerta-flecha" aria-hidden="true">›</span>
            </span>
            <span className="ajustes__puerta-resumen">
              {inicioSemana === hoy() ? 'Hoy · ' : ''}{diaConFecha(inicioSemana)}
            </span>
          </button>

          {/**
            * ═══ SOIS · LAS MISMAS CINCO CASILLAS QUE EN EL ONBOARDING ═══
            *
            * Mismo control y mismo orden a propósito. Quien contestó «2» el
            * primer día tiene que reconocer aquí la pregunta que contestó, no
            * encontrarse otro artefacto que hace lo mismo.
            *
            * Va antes que el tope porque lo condiciona: subir de 2 a 4 sube el
            * suelo del deslizador, y verlo moverse después de tocar aquí
            * explica la relación sin escribirla en ningún sitio.
            */}
          <span className="ajustes__rotulo">Sois</span>
          <div className="ajustes__comensales">
            {OPCIONES_COMENSALES.map((o) => (
              <button
                key={o}
                type="button"
                className={`ajustes__comensal${comensales === o ? ' ajustes__comensal--seleccionado' : ''}`}
                aria-pressed={comensales === o}
                onClick={() => setComensales(o)}
              >
                {o}
              </button>
            ))}
          </div>

          {/**
            * ═══ EL TOPE · LA CIFRA QUE DEFINE EL PRODUCTO ═══
            *
            * «Tengo 65 € **esta semana**». Es semanal en la propia frase que
            * define la app, y hasta ahora solo se podía contestar una vez.
            *
            * El carril no baja del suelo, igual que en el onboarding: la
            * consecuencia de pedir catorce comidas con poco dinero se aprende
            * moviendo el dedo y no chocando con un error. Y el suelo se mueve
            * solo cuando cambias los comensales o las alergias.
            */}
          <span className="ajustes__rotulo">Tu tope</span>
          <div className="ajustes__tope">
            <div className="ajustes__tope-cifra">
              <span className="ajustes__tope-numero">{eurSinSimbolo(tope, 0)}</span>
              <span className="ajustes__tope-moneda">€</span>
              <span className="ajustes__tope-nota">a la semana · {eur(tope / 7 / n, 2)} por persona y día</span>
            </div>
            <BudgetSlider
              value={tope}
              min={minimoViable}
              max={techo}
              extremos={['AJUSTADO', 'HOLGADO']}
              etiquetaValor={(v) => `${v} euros a la semana, ${eur(v / 7 / n, 2)} por persona y día`}
              onChange={setPresupuesto}
            />
          </div>

          {/* Ya no se pregunta "cuánta variedad": se enseñan las tres semanas que
              el motor sabe montar, ordenadas por lo que cuestan. */}
          <span className="ajustes__rotulo">Variedad</span>
          <SelectorVariedad ctx={ctx} costes={costes?.variedad ?? null} onCambiar={setVariedad} />

          {/**
            * ═══ ALTA REQUIERE CUNDE+, Y NO SE APLICA AL TOCARLA ═══
            *
            * `onPideAlta` cierra esta hoja y abre el muro. El ajuste NO se
            * toca: si se aplicara y luego saliera el muro, cerrar el muro
            * dejaría la semana con proteína alta puesta sin haberla pagado —o,
            * peor, habría que deshacerla, y deshacer un ajuste que el usuario
            * ve aplicado es la clase de cosa que hace pensar que la app está
            * rota.
            *
            * Al comprar, `Semana.tsx` retoma la intención y aplica Alta. Ver
            * `pendiente` allí.
            */}
          <span className="ajustes__rotulo">Proteína</span>
          <SelectorProteina
            ctx={ctx}
            costes={costes?.proteina ?? null}
            onCambiar={setProteina}
            tienePlus={tienePlus}
            onPideAlta={onPideAlta}
          />

          {/* EL POSTRE VA EN ESTA CAPA, no detrás de la puerta, porque mueve
              dinero: entre 4 y 8 € a la semana según cuántos sean. Cualquier
              cosa que cambie la cifra tiene que estar donde se ve la cifra.

              Y como el total está pegado arriba, al encenderlo se lee al
              momento lo que cuesta —que es justo lo que hace que la decisión
              sea del usuario y no nuestra. */}
          <span className="ajustes__rotulo">Postre</span>
          {/* Centrado porque son dos etiquetas de una línea: a la izquierda,
              dentro de columnas iguales, «Sin postre» dejaba un hueco a la
              derecha que parecía un fallo. */}
          <div className="ajustes__fila-pill ajustes__fila-pill--centrado">
            <button
              type="button"
              className={`ajustes__pill${!postre ? ' ajustes__pill--seleccionado' : ''}`}
              aria-pressed={!postre}
              onClick={() => setPostre(false)}
            >
              <span className="ajustes__pill-label">Sin postre</span>
            </button>
            <button
              type="button"
              className={`ajustes__pill${postre ? ' ajustes__pill--seleccionado' : ''}`}
              aria-pressed={postre}
              onClick={() => setPostre(true)}
            >
              {/* Sin «yogur, fruta, gelatina» debajo: los dos botones de esta
                  fila dejaban de tener la misma forma —uno con dos líneas y otro
                  con una— y lo que enumeraba no era una promesa, era la carta de
                  postres de ESTA semana, que cambia con las exclusiones. Qué
                  postre toca ya se dice donde importa: en cada comida de la
                  tarjeta del día y en la hoja, con su precio. */}
              <span className="ajustes__pill-label">En cada comida</span>
            </button>
          </div>

          {/* La puerta a la otra capa, con su resumen debajo. Las alergias se
              leen aquí sin abrir nada: son seguridad alimentaria y no pueden
              depender de que alguien encuentre un botón. */}
          <button type="button" className="ajustes__puerta" onClick={() => setCapa('fijo')}>
            <span className="ajustes__puerta-fila">
              <span className="ajustes__puerta-titulo">Lo que no cambia cada semana</span>
              <span className="ajustes__puerta-flecha" aria-hidden="true">›</span>
            </span>
            <span className="ajustes__puerta-resumen">
              {OPCIONES_COMIDAS.find((o) => o.valor === comidas)?.meta}
              {' · '}
              {OPCIONES_ESFUERZO.find((o) => o.valor === esfuerzo)?.label.toLowerCase()}
              {' · '}
              {exclusiones.length ? exclusiones.join(', ') : 'sin filtros'}
            </span>
          </button>

          {origen === 'sobrante' && (
            <p className="ajustes__nota">
              Al guardar rehago la semana con lo que me digas. Lo que ya lleves marcado en la compra se pierde.
            </p>
          )}
        </>
      ) : (
        <>
          <h2 className="ajustes__pregunta">¿Qué resuelvo?</h2>
          <div className="ajustes__fila-pill">
            {OPCIONES_COMIDAS.map((o) => (
              <button
                key={o.valor}
                type="button"
                className={`ajustes__pill${comidas === o.valor ? ' ajustes__pill--seleccionado' : ''}`}
                aria-pressed={comidas === o.valor}
                onClick={() => setComidas(o.valor)}
              >
                <span className="ajustes__pill-label">{o.label}</span>
                <span className="ajustes__pill-meta">{o.meta}</span>
              </button>
            ))}
          </div>

          {/* Píldoras, no bloques apilados. Decían lo mismo que las de arriba y
              ocupaban 236 px contra 56: tres cajas de ancho completo para una
              etiqueta y cuatro palabras. Y de paso la hoja deja de tener cinco
              formas de control distintas para cinco preguntas. */}
          <h2 className="ajustes__pregunta">¿Cuánto quieres cocinar?</h2>
          <div className="ajustes__fila-pill">
            {OPCIONES_ESFUERZO.map((o) => (
              <button
                key={o.valor}
                type="button"
                className={`ajustes__pill${esfuerzo === o.valor ? ' ajustes__pill--seleccionado' : ''}`}
                aria-pressed={esfuerzo === o.valor}
                onClick={() => setEsfuerzo(o.valor)}
              >
                <span className="ajustes__pill-label">{o.label}</span>
                <span className="ajustes__pill-meta">{o.sub}</span>
              </button>
            ))}
          </div>

          {/* El mismo selector que antes de generar la semana: una alergia
              contestada en el onboarding tiene que verse igual aquí, con los
              mismos grupos y en el mismo orden. Ver SelectorExclusiones.tsx. */}
          <h2 className="ajustes__pregunta">¿Algo que no comes?</h2>
          <SelectorExclusiones valor={exclusiones} onCambiar={setExclusiones} />

          {avisoFiltro && (
            <p className="ajustes__nota ajustes__nota--coste">
              Lo que has quitado sube la semana {eur(sobrecoste)}: {eur(sinFiltros.carrito)} sin filtros,{' '}
              {eur(conFiltros.carrito)} con ellos.
            </p>
          )}

          {/**
            * ═══ PLATOS QUE NO QUIERES · UNA FILA, NO UNA SECCIÓN ═══
            *
            * Va DEBAJO de las alergias y separada de ellas, y esa distancia es
            * la decisión: son dos cosas que bloquean igual y no se parecen en
            * nada más. Arriba, lo que no puedes comer. Aquí, lo que no te
            * apetece. Juntarlas habría puesto "sin gluten" y "no me gusta la
            * merluza" en la misma lista, y eso convierte una restricción de
            * salud en una preferencia — que es exactamente el error que hay que
            * no cometer cuando se maneja seguridad alimentaria.
            *
            * Una fila y no la lista entera porque quien entra aquí casi nunca
            * viene a esto: viene a las alergias. La lista se abre a un toque.
            */}
          <button type="button" className="ajustes__puerta" onClick={onAbrirBloqueados}>
            <span className="ajustes__puerta-fila">
              <span className="ajustes__puerta-titulo">Platos que no quieres</span>
              <span className="ajustes__puerta-flecha" aria-hidden="true">›</span>
            </span>
            <span className="ajustes__puerta-resumen">
              {bloqueados === 0
                ? 'Ninguno'
                : `${bloqueados} ${bloqueados === 1 ? 'plato' : 'platos'}`}
            </span>
          </button>
        </>
      )}

      {/* El nombre de la acción se conserva: "Guardar ajustes" pasa a
          "Guardando ajustes", no a "Cargando…" ni a un giro sin texto. */}
      <PrimaryButton disabled={guardando} onClick={guardar}>
        {guardando ? 'Guardando ajustes…' : 'Guardar ajustes'}
      </PrimaryButton>
      {/* La única puerta a la política desde dentro de la app. Abre el
          navegador del teléfono: es una página de la web, no de la app. */}
      <a className="ajustes__legal" href={URL_PRIVACIDAD} target="_blank" rel="noopener noreferrer">
        Política de privacidad
      </a>
    </BottomSheet>
  );
};

export default AjustesSemana;
