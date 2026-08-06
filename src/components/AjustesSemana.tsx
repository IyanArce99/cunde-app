import { useEffect, useState } from 'react';
import type { ComidasPref, Esfuerzo, NivelProteina, Perfil, Preferencias, Variedad } from '../state/types';
import { costesDeProteina, costesDeVariedad } from '../lib/derive';
import type { Contexto } from '../lib/derive';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import { ALERGIAS, DIETAS } from '../lib/restricciones';
import { eur } from '../lib/format';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import SelectorVariedad from './SelectorVariedad';
import SelectorProteina from './SelectorProteina';
import './AjustesSemana.css';

const OPCIONES_COMIDAS: { valor: ComidasPref; label: string; meta: string }[] = [
  { valor: 'comidas', label: 'Comidas', meta: '7 platos' },
  { valor: 'cenas', label: 'Cenas', meta: '7 platos' },
  { valor: 'ambas', label: 'Las dos', meta: '14 platos' },
];

const OPCIONES_ESFUERZO: { valor: Esfuerzo; label: string; sub: string }[] = [
  { valor: 'minimo', label: 'Lo mínimo', sub: 'menos de 20 min' },
  { valor: 'normal', label: 'Lo normal', sub: '30 a 40 min' },
  { valor: 'libre', label: 'Me gusta cocinar', sub: 'sin límite' },
];

// El mismo orden y los mismos grupos que en el onboarding: quien puso "sin
// gluten" en la primera pantalla tiene que encontrarlo en el mismo sitio al
// volver. Ver src/lib/restricciones.ts, que además comprueba que la lista de
// la app y la del motor no se separen.
const RESTRICCIONES = [
  { titulo: 'Alergias e intolerancias', opciones: ALERGIAS },
  { titulo: 'Por dieta', opciones: DIETAS },
];

interface AjustesSemanaProps {
  preferenciasActuales: Preferencias;
  perfil: Perfil;
  origen: 'exclusiones' | 'sobrante';
  /** Lo que cuesta la cesta que hay AHORA detrás de la hoja. La referencia. */
  cestaActual: number;
  onGuardar: (preferencias: Preferencias) => void;
  onCerrar: () => void;
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
  preferenciasActuales, perfil, origen, cestaActual, onGuardar, onCerrar,
}) => {
  const [comidas, setComidas] = useState(preferenciasActuales.comidas);
  const [esfuerzo, setEsfuerzo] = useState(preferenciasActuales.esfuerzo);
  const [variedad, setVariedad] = useState(preferenciasActuales.variedad);
  const [proteina, setProteina] = useState(preferenciasActuales.proteina);
  const [exclusiones, setExclusiones] = useState(preferenciasActuales.exclusiones);
  const [postre, setPostre] = useState(preferenciasActuales.postre);
  const [capa, setCapa] = useState<'semana' | 'fijo'>('semana');

  const alternarDieta = (dieta: string) => {
    setExclusiones((actual) =>
      actual.includes(dieta) ? actual.filter((d) => d !== dieta) : actual.concat(dieta),
    );
  };

  const ctx: Contexto = {
    comensales: perfil.comensales,
    comidas,
    esfuerzo,
    exclusiones,
    presupuesto: perfil.presupuestoSemanal,
    variedad,
    proteina,
    postre,
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
  const claveCtx = `${comidas}|${esfuerzo}|${variedad}|${proteina}|${exclusiones.join(',')}|${postre}`;
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
  const tePasas = nuevaCesta !== null && nuevaCesta > perfil.presupuestoSemanal;

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
      onGuardar({ comidas, esfuerzo, variedad, proteina, exclusiones, postre });
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
          <span className="ajustes__total-pie">Te pasas del tope de {eur(perfil.presupuestoSemanal)}.</span>
        )}
      </div>

      {capa === 'semana' ? (
        <>
          {/* Ya no se pregunta "cuánta variedad": se enseñan las tres semanas que
              el motor sabe montar, ordenadas por lo que cuestan. */}
          <h2 className="ajustes__pregunta">Tu semana</h2>
          <SelectorVariedad ctx={ctx} costes={costes?.variedad ?? null} onCambiar={setVariedad} />

          <h2 className="ajustes__pregunta">¿Cuánta proteína?</h2>
          <SelectorProteina ctx={ctx} costes={costes?.proteina ?? null} onCambiar={setProteina} />

          {/* EL POSTRE VA EN ESTA CAPA, no detrás de la puerta, porque mueve
              dinero: entre 4 y 8 € a la semana según cuántos sean. Cualquier
              cosa que cambie la cifra tiene que estar donde se ve la cifra.

              Y como el total está pegado arriba, al encenderlo se lee al
              momento lo que cuesta —que es justo lo que hace que la decisión
              sea del usuario y no nuestra. */}
          <h2 className="ajustes__pregunta">¿Postre?</h2>
          <div className="ajustes__fila-pill">
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
              <span className="ajustes__pill-label">En cada comida</span>
              <span className="ajustes__pill-meta">yogur, fruta, gelatina</span>
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

          <h2 className="ajustes__pregunta">¿Algo que no comes?</h2>
          <button
            type="button"
            className={`ajustes__pill ajustes__pill--ancho${exclusiones.length === 0 ? ' ajustes__pill--seleccionado' : ''}`}
            aria-pressed={exclusiones.length === 0}
            onClick={() => setExclusiones([])}
          >
            <span className="ajustes__pill-label">Nada, como de todo</span>
          </button>
          {RESTRICCIONES.map(({ titulo, opciones }) => (
            <div key={titulo}>
              <span className="ajustes__grupo">{titulo}</span>
              <div className="ajustes__chips">
                {opciones.map((dieta) => (
                  <button
                    key={dieta}
                    type="button"
                    className={`ajustes__chip${exclusiones.includes(dieta) ? ' ajustes__chip--seleccionado' : ''}`}
                    aria-pressed={exclusiones.includes(dieta)}
                    onClick={() => alternarDieta(dieta)}
                  >
                    {dieta}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {avisoFiltro && (
            <p className="ajustes__nota ajustes__nota--coste">
              Lo que has quitado sube la semana {eur(sobrecoste)}: {eur(sinFiltros.carrito)} sin filtros,{' '}
              {eur(conFiltros.carrito)} con ellos.
            </p>
          )}
        </>
      )}

      {/* El nombre de la acción se conserva: "Guardar ajustes" pasa a
          "Guardando ajustes", no a "Cargando…" ni a un giro sin texto. */}
      <PrimaryButton disabled={guardando} onClick={guardar}>
        {guardando ? 'Guardando ajustes…' : 'Guardar ajustes'}
      </PrimaryButton>
    </BottomSheet>
  );
};

export default AjustesSemana;
