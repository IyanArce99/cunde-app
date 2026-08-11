import { useCallback, useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { numComensales, platosDeSemana, ranurasVisibles } from '../state/types';
import type { Plato, Ranura, SinCobertura } from '../state/types';
import { semanaEfectiva, totalLista } from '../lib/derive';
import { eur, eurSinSimbolo } from '../lib/format';
import { fechaDePosicion } from '../lib/fechas';
import { alternativasParaApp, indiceDeHueco, retocarParaApp } from '../data/motor';
import type { AlternativaParaApp, Retoque } from '../data/motor';
import { useContador } from '../hooks/useContador';
import TopTabs from '../components/TopTabs';
import PrimaryButton from '../components/PrimaryButton';
import MuroDePago from '../components/MuroDePago';
import { ALTERNATIVAS_GRATIS, ALTERNATIVAS_POR_TANDA, MURO_ACTIVO } from '../lib/suscripcion';
import AjustesSemana from '../components/AjustesSemana';
import TarjetaDia from '../components/TarjetaDia';
import HojaDeDia from '../components/HojaDeDia';
import CambioSemana from '../components/CambioSemana';
import RecetaPlato from '../components/RecetaPlato';
import HojaPlatosBloqueados from '../components/HojaPlatosBloqueados';
import HojaInicioSemana from '../components/HojaInicioSemana';
import HojaCompartir from '../components/HojaCompartir';
import { cuentaPreferencias } from '../lib/preferencias';
import { rangoDeSemana } from '../lib/compartible';
import type { DatosCompartibles } from '../lib/compartible';
import { extrasSinPrecio, totalExtras } from '../lib/extras';
import { analitica } from '../lib/analitica';
import './Semana.css';

interface HuecoAbierto {
  dia: string;
  ranura: Ranura;
  plato: Plato | null;
}

/**
 * A partir de qué fracción del presupuesto el sobrante merece el amarillo de
 * oferta. Por debajo va como una línea de ticket cualquiera.
 *
 * El bloque relleno era el segundo elemento más fuerte de la pantalla, a 40 px
 * de la cifra grande, y la regla del proyecto es que la cifra en euros es
 * siempre el elemento más grande. Por 3,08 € no hay nada que hacer y no hay
 * nada que gritar; a partir del 15% sí hay una acción —subir la variedad— y
 * entonces se gana el color.
 */
const UMBRAL_SOBRANTE = 0.15;

/** Cada tipo de salida se pide de una forma distinta: no todas se "quitan". */
function textoSalida(s: SinCobertura['salidas'][number]): string {
  if (s.tipo === 'exclusion') return `Quita «${s.que}» y salen ${s.huecosCubribles} comidas`;
  if (s.tipo === 'esfuerzo') return `Cocina ${s.que} y salen ${s.huecosCubribles} comidas`;
  /* «Revisa» y no «quita todos»: la salida es ir a la lista y devolver los que
     hagan falta, no rendirse entera. Nunca se desbloquea nada por su cuenta —
     una preferencia que la app borra sola para poder generar es una app que no
     escucha. */
  if (s.tipo === 'bloqueados') return `Revisa los ${s.que} platos que no quieres`;
  return `Resuélveme ${s.que}: eso sí sale`;
}

const Semana: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const {
    perfil, preferencias, semana, lista, cierre, suscripcion, contadores, sinCobertura, salidaPresupuesto,
    historial, despensa, deshacerCierre, preferenciasPlatos, extrasCompra,
  } = estado;

  /**
   * Cerrar la semana es lo único que no tiene vuelta, y se toca en el súper,
   * de pie y con una mano. El aviso conserva el nombre de la acción —el botón
   * decía "Guardar esta semana"— y va en las DOS ramas de esta pantalla:
   * cerrar sube el contador a 2, así que en el plan gratis lo siguiente que se
   * ve es el muro, y ahí es justo donde más falta hace poder volver.
   */
  const avisoDeshacer = deshacerCierre && (
    <div className="semana__deshacer">
      {/* Decía "Pagaste 61,20 €", que es un dato que el usuario acaba de
          escribir él mismo. Lo que no sabe —y es lo único que le dice si esto
          le sirve— es la diferencia contra su tope. Es la frase que decide si
          vuelve la semana que viene, así que va aquí y no en un resumen que
          nadie abre. */}
      <span className="semana__deshacer-texto">
        Semana guardada.
        {cierre.importeRealTicket !== null && (
          perfil.presupuestoSemanal - cierre.importeRealTicket >= 0
            ? ` Te sobraron ${eur(perfil.presupuestoSemanal - cierre.importeRealTicket)}.`
            : ` Te pasaste ${eur(cierre.importeRealTicket - perfil.presupuestoSemanal)}.`
        )}
      </span>
      <button
        className="semana__deshacer-accion"
        type="button"
        onClick={() => dispatch({ type: 'DESHACER_CIERRE' })}
      >
        Deshacer
      </button>
      <button
        className="semana__deshacer-cerrar"
        type="button"
        aria-label="Quitar el aviso"
        onClick={() => dispatch({ type: 'OLVIDAR_DESHACER' })}
      >
        ✕
      </button>
    </div>
  );

  // Carrito real (lo que pasa por caja), no consumo: el "X € ración" de cada
  // hueco es el único sitio donde toca enseñar consumo.
  const total = totalLista(lista);
  const sobra = perfil.presupuestoSemanal - total;
  const pctBarra = Math.min(100, (total / perfil.presupuestoSemanal) * 100);
  /* Sin el símbolo: lo pinta la pantalla aparte, en volado. Ver la cabecera. */
  const cifraRef = useContador(total, { formatear: (n) => eurSinSimbolo(n) });

  /**
   * ═══ LO QUE SE PUEDE COMPARTIR, CAMPO A CAMPO ═══
   *
   * Se construye aquí y a mano, no pasándole el estado a la tarjeta. `lib/
   * compartible.ts` no conoce `AppState` a propósito: para que un dato privado
   * acabe en una imagen que se manda por WhatsApp hay que venir a escribirlo a
   * esta lista. Nombres de plato, exclusiones, código postal y almacén no
   * están, y no están por decisión.
   *
   * `menu` es el CARRITO —lo que pasa por caja—, nunca el consumo: es lo que el
   * usuario compara con su ticket, y son las dos cifras que este proyecto lleva
   * desde el principio sin mezclar.
   *
   * Con la semana cerrada la tarjeta cambia de cara sola: pasa a ser el
   * resultado, que es lo que de verdad tiene algo que contar —lo que dijo Cunde
   * contra lo que marcó la caja—.
   *
   * ═══ Y EL RESULTADO SE LEE DEL CIERRE, NUNCA DEL ESTADO VIVO ═══
   *
   * Salió mirando la tarjeta en el navegador: se construía con `extrasCompra`,
   * que `GUARDAR_CIERRE` acababa de vaciar. Con detergente de 6,80 € y un café
   * sin precio en la compra, la imagen decía «DIFERENCIA +13,90 €» — le
   * atribuía a Cunde trece euros de los que la mitad eran detergente y otra
   * parte un precio que nadie llegó a saber. Justo la afirmación que la hoja de
   * cierre lleva desde el principio negándose a hacer.
   *
   * Los tres números se congelan al cerrar. Si faltan —un cierre guardado antes
   * de que existieran—, no se enseña resultado: se enseña la semana. Suponer
   * cero extras es la suposición que provocó el fallo.
   */
  const foto = cierre.importeRealTicket !== null && cierre.menuPrevisto !== undefined
    ? cierre
    : null;
  const datosCompartibles: DatosCompartibles = {
    tipo: foto ? 'resultado' : 'semana',
    supermercado: perfil.super,
    personas: numComensales(perfil.comensales),
    // Los platos que hay, no los que se pidieron: si la semana salió con
    // trece huecos, la tarjeta dice trece.
    comidas: platosDeSemana(semana.dias).length,
    rango: rangoDeSemana(semana.fechaInicio),
    menu: foto ? foto.menuPrevisto! : total,
    ...(foto
      ? {
        ticket: foto.importeRealTicket!,
        ...(foto.extras ? { extras: foto.extras } : {}),
        ...(foto.extrasSinPrecio ? { extrasSinPrecio: foto.extrasSinPrecio } : {}),
      }
      : {
        presupuesto: perfil.presupuestoSemanal,
        ...(totalExtras(extrasCompra) > 0 ? { extras: totalExtras(extrasCompra) } : {}),
        ...(extrasSinPrecio(extrasCompra) > 0 ? { extrasSinPrecio: extrasSinPrecio(extrasCompra) } : {}),
      }),
  };

  const [mostrarAjustes, setMostrarAjustes] = useState<'exclusiones' | 'sobrante' | null>(null);
  const [verCompartir, setVerCompartir] = useState(false);
  /**
   * La cabecera se colapsa al empezar a leer los días. No se OCULTA —esconder
   * la cifra en la app cuya tesis es la cifra sería absurdo—: se queda una
   * línea con el total y el saldo. Reposo: dos tarjetas completas. Colapsada:
   * tres. El umbral son 24 px de scroll, suficiente para no dispararse con el
   * rebote del gesto.
   */
  const [compacta, setCompacta] = useState(false);
  const alScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setCompacta(e.currentTarget.scrollTop > 24);
  }, []);
  const [huecoAbierto, setHuecoAbierto] = useState<HuecoAbierto | null>(null);
  const [recetaAbierta, setRecetaAbierta] = useState<HuecoAbierto | null>(null);
  // Previsualización del retoque: se calcula con el mismo motor y no se
  // aplica hasta que el usuario ve qué cambia y dice que sí.
  const [propuesta, setPropuesta] = useState<{
    retoque: Retoque;
    hueco: HuecoAbierto;
    resultado: ReturnType<typeof retocarParaApp>;
  } | null>(null);

  const ranuras = ranurasVisibles(preferencias.comidas);

  const abrirHueco = useCallback(
    (dia: string, ranura: Ranura, plato: Plato | null) => setHuecoAbierto({ dia, ranura, plato }),
    [],
  );

  /**
   * LAS ALTERNATIVAS DEL HUECO ABIERTO.
   *
   * Cada una es una construcción completa del motor (~35 ms), así que se piden
   * DESPUÉS de pintar la hoja, con el mismo patrón de dos marcos que usan las
   * estimaciones de ajustes: primero se ve la hoja, luego aparecen las
   * opciones. Pedirlas dentro del render dejaba la hoja sin abrirse durante
   * una décima larga y parecía que el toque no había hecho nada.
   */
  const [alternativas, setAlternativas] = useState<AlternativaParaApp[]>([]);
  /* Cuántas se han pedido para ESTE hueco. Vuelve a una al abrir otro: "ver
     más" es una decisión sobre el plato que tienes delante, no una preferencia
     que se arrastre. Ver ALTERNATIVAS_GRATIS en lib/suscripcion.ts, que lleva
     escrita la objeción a capar esto. */
  const [cuantasAlt, setCuantasAlt] = useState(ALTERNATIVAS_GRATIS);
  useEffect(() => {
    setAlternativas([]);
    setCuantasAlt(ALTERNATIVAS_GRATIS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huecoAbierto?.dia, huecoAbierto?.ranura]);

  /* El muro abierto a mano desde "ver más platos", que es distinto del que sale
     solo al entrar en la semana 2. */
  const [muroPorPlatos, setMuroPorPlatos] = useState(false);
  /* La lista de platos bloqueados. Se abre desde ajustes y desde el aviso de
     "no me salen las cuentas", así que vive aquí y no dentro de ninguna hoja. */
  const [verBloqueados, setVerBloqueados] = useState(false);
  /* El selector de cuándo empieza la semana. Vive aquí y no dentro de ajustes
     por lo mismo que la lista de bloqueados: dos hojas apiladas no se cierran
     en el orden que uno espera. */
  const [verInicio, setVerInicio] = useState(false);

  /**
   * QUÉ HACE "VER MÁS PLATOS".
   *
   * Nada, si el motor ya no tiene qué ofrecer: la última tanda vino corta, se
   * acabaron los candidatos y el enlace desaparece en vez de mentir.
   *
   * Con el muro activo y sin suscripción, abre el muro. Se cierra antes la hoja
   * del día: dos capas superpuestas sobre la semana no se cierran en el orden
   * que uno espera, y la de abajo se queda huérfana detrás.
   *
   * Con suscripción, pide otra tanda al motor (~35 ms por candidato).
   */
  const verMasPlatos = (() => {
    if (alternativas.length < cuantasAlt) return undefined;
    if (MURO_ACTIVO && suscripcion === null) {
      return () => { setHuecoAbierto(null); setMuroPorPlatos(true); };
    }
    return () => setCuantasAlt((n) => n + ALTERNATIVAS_POR_TANDA);
  })();
  useEffect(() => {
    if (!huecoAbierto?.plato) return;
    const indice = indiceDeHueco(semana.plan, huecoAbierto.dia, huecoAbierto.ranura);
    if (indice < 0) return;
    let vivo = true;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!vivo) return;
      setAlternativas(alternativasParaApp(
        perfil, preferencias, semana.plan, indice, numeroSemana, historial, despensa, cuantasAlt,
        preferenciasPlatos,
      ));
    }));
    return () => { vivo = false; cancelAnimationFrame(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huecoAbierto?.dia, huecoAbierto?.ranura, cuantasAlt]);

  const numeroSemana = semanaEfectiva(contadores.semanaNumero, semana.generadaEn);
  // Persistido en estado global, no en useState: si viviera en el componente,
  // navegar a Compra y volver reseteaba la decisión y el muro reaparecía en
  // cada visita dentro de la misma semana (en vez de una vez por semana).
  const yaVistoGratisEstaSemana = contadores.semanaVistaGratis === numeroSemana;
  /**
   * EL MURO YA NO TAPA NADA, Y NO ES UN DESCUIDO.
   *
   * Lo que se paga —la despensa acumulada y la memoria de tres semanas— son
   * dos parámetros del motor, no pantallas (ver AppStateContext). Así que no
   * hay ruta que bloquear: el plan gratuito ve su semana entera, su lista
   * entera y todas las rutas. El muro es una OFERTA que aparece encima, y
   * cerrarla deja la app funcionando.
   *
   * Eso además arregla el agujero que tenía: antes solo tapaba /semana y se
   * llegaba a /compra y a /semana/variante escribiendo la URL. Ahora no hay
   * nada que esquivar porque el bloqueo no está en el enrutador.
   *
   * Y sale APAGADO tras MURO_ACTIVO. Ver lib/suscripcion.ts.
   */
  /* Dos puertas al mismo muro: la de la semana 2, que sale sola una vez por
     semana, y la de "ver más platos", que la pide el usuario y por eso no
     respeta el "seguir gratis" de esta semana — es una pregunta distinta. */
  const mostrarMuro =
    muroPorPlatos
    || (MURO_ACTIVO && numeroSemana >= 2 && suscripcion === null && !yaVistoGratisEstaSemana);

  const proponerRetoque = (retoque: Retoque) => {
    if (!huecoAbierto) return;
    const indice = indiceDeHueco(semana.plan, huecoAbierto.dia, huecoAbierto.ranura);
    if (indice < 0) return;
    setPropuesta({
      retoque,
      hueco: huecoAbierto,
      resultado: retocarParaApp(
        perfil, preferencias, semana.plan, indice, retoque, numeroSemana, historial, despensa,
        preferenciasPlatos,
      ),
    });
    setHuecoAbierto(null);
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla semana">
          <TopTabs activo="semana" />
          {avisoDeshacer}

          {/* CABECERA CONDENSADA.
              Medido a 390×844: la primera tarjeta de día empezaba a 412 px —el
              49% del viewport— con ocho bloques apilados encima, y solo se veía
              UNA tarjeta completa. El contenido útil son 741 px (ahí empieza el
              pie fijo) y las tarjetas miden 183-193, así que para ver dos
              completas la primera tiene que arrancar antes de 363 px.

              Tres bloques en vez de ocho:
                · el rótulo comparte línea con la entrada a los ajustes, que
                  antes gastaba una fila propia de 56 px ("Dime lo que no
                  comes") para ofrecer algo que ya se preguntó en el onboarding
                  y que no dice nada de ESTA semana;
                · el saldo sube a la línea de la cifra, que es donde tiene que
                  estar: es el segundo dato de la pantalla y estaba a tres filas
                  del primero, separado por la barra y el contexto;
                · "€ por ración" se va a la línea de contexto. Era una cabecera
                  de columna de 21 px que no encabezaba nada —las tarjetas ya
                  llevan día, precio y minutos—; lo que sí hacía falta era decir
                  la unidad una vez, porque los precios pequeños no suman la
                  cifra grande. */}
          <div className={`semana__resumen${compacta ? ' semana__resumen--compacta' : ''}`}>
            {/* La guía de puntos se va con la metáfora del ticket. "Ajustar" pasa
                a ser un enlace azul subrayado: es LA acción de esta cabecera y
                el azul del rediseño está reservado justo para eso. */}
            <button className="semana__rotulo" type="button" onClick={() => setMostrarAjustes('exclusiones')}>
              <span className="semana__etiqueta">TU SEMANA</span>
              <span className="semana__rotulo-accion">
                <span className="semana__rotulo-accion-texto">Ajustar</span>
                <span aria-hidden="true">›</span>
              </span>
            </button>

            <div className="semana__cifra-fila">
              {/* El € va aparte, pequeño y en volado. Al mismo cuerpo que la
                  cifra se lleva un tercio del ancho para decir una unidad que
                  ya se da por sabida; en volado deja que se lean los números,
                  que es a lo que viene la pantalla. */}
              <div className="semana__cifra" style={{ color: sobra < 0 ? 'var(--roja)' : undefined }}>
                <span ref={cifraRef} />
                <span className="semana__cifra-moneda">€</span>
              </div>
              {sobra !== 0 && (() => {
                /**
                 * EL SALDO SOLO ES UN BOTÓN CUANDO HAY ALGO QUE HACER.
                 *
                 * Había dos entradas a la misma hoja de ajustes en la misma
                 * cabecera, a cien píxeles una de otra: "ajustar" y esto. Y la
                 * segunda prometía algo que la hoja no puede cumplir — con
                 * 0,21 € de sobrante no hay nada dentro que vaya de veintiún
                 * céntimos, así que la flecha llevaba a una decepción.
                 *
                 * La regla ya existía y estaba escrita para el COLOR (ver
                 * UMBRAL_SOBRANTE): por debajo del 15% no hay nada que hacer y
                 * nada que gritar. Lo que faltaba era aplicarla también a si se
                 * puede tocar. Ahora el sobrante pequeño es lo que de verdad
                 * es: un dato. Y pasarse del presupuesto siempre es accionable,
                 * sobre poco o mucho.
                 *
                 * De paso, "ajustar" se queda como puerta única y por eso ya se
                 * gana el sitio que ocupa.
                 */
                const pequeno = sobra > 0 && sobra / perfil.presupuestoSemanal <= UMBRAL_SOBRANTE;
                {/* Una línea, no dos. El chip del rediseño es una píldora
                    compacta —"Sobran 10,20 €"— y el salto de línea que hacía
                    falta cuando era una caja de dos filas ahora la parte por la
                    mitad. */}
                const contenido = (
                  <span className="semana__saldo-titulo">
                    {sobra > 0 ? 'Sobran' : 'Te pasas'} {eur(Math.abs(sobra))}
                  </span>
                );
                if (pequeno) return <span className="semana__saldo semana__saldo--menor">{contenido}</span>;
                return (
                  <button
                    className={`semana__saldo${sobra < 0 ? ' semana__saldo--negativo' : ''}`}
                    type="button"
                    onClick={() => setMostrarAjustes('sobrante')}
                  >
                    {contenido}
                    <span className="semana__saldo-flecha">›</span>
                  </button>
                );
              })()}
            </div>

            {/* LA BARRA DEL TOPE VUELVE, y fina.
                El prototipo no la trae, pero el encargo del diseñador sí la
                lista — se contradice consigo mismo. Se resuelve mirando el
                dato: la gráfica de abajo va en CONSUMO POR RACIÓN y el tope va
                en CARRITO, que son unidades distintas. O sea que la gráfica no
                puede llevar la referencia del presupuesto por mucho que se
                quiera, y sin barra no queda ninguna lectura visual de cuánto
                se lleva gastado del tope: solo el número del chip.

                A 4 px en vez de 10: sigue estando, deja de pesar. */}
            <div className="semana__barra">
              <div
                className="semana__barra-relleno"
                style={{ width: `${pctBarra}%`, background: sobra < 0 ? 'var(--roja)' : 'var(--azulete)' }}
              />
            </div>

            {/**
              * ═══ AQUÍ HABÍA UNA GRÁFICA DE SIETE BARRAS. SE FUE. ═══
              *
              * Se defendía diciendo que «con ella se ve de un vistazo que el
              * jueves cuesta el triple que el martes». En la pantalla real no:
              * los días de una semana cuadrada cuestan casi lo mismo, así que
              * las siete barras salían de alturas casi idénticas y no se leía
              * ninguna diferencia.
              *
              * Y aunque se leyera, no lleva a nada: saber que el jueves es caro
              * no es accionable —no eliges qué día cocinar qué— y el gasto de
              * cada día ya está escrito con su cifra en la cabecera de su propia
              * tarjeta, dos dedos más abajo y con el número exacto.
              *
              * Ocupaba 52 px de la pantalla donde el alto va contado y donde ya
              * se han peleado 18 px en el pie. Un adorno que cuesta media
              * tarjeta de día.
              */}
          </div>

          {salidaPresupuesto && (
            <div className="semana__sin-cobertura">
              {/* El texto dice QUÉ falló de verdad. La semana vegana gastaba
                  33 € de 51 y aun así decía "no me salen las cuentas": lo que
                  no llegaba era la proteína, no el dinero — y para una app
                  cuyo producto es la cifra, culpar al dinero que sobra
                  destroza la confianza en todos los demás números. */}
              <p className="semana__sin-cobertura-texto">
                {salidaPresupuesto.motivo === 'proteina'
                  ? 'El dinero llega, la proteína no: con este recetario y tus filtros no alcanzo la que pediste.'
                  : salidaPresupuesto.motivo === 'ambos'
                    ? `Con ${eur(perfil.presupuestoSemanal)} no llego ni al presupuesto ni a la proteína que pediste.`
                    : `Con ${eur(perfil.presupuestoSemanal)} y esta variedad no me salen las cuentas.`}
              </p>
              {salidaPresupuesto.motivo !== 'presupuesto' && salidaPresupuesto.proteinaAlcanzable && (
                <button
                  type="button"
                  className="semana__sin-cobertura-salida"
                  onClick={() =>
                    dispatch({
                      type: 'SET_PREFERENCIAS',
                      preferencias: { ...preferencias, proteina: salidaPresupuesto.proteinaAlcanzable! },
                    })
                  }
                >
                  Baja la proteína a {salidaPresupuesto.proteinaAlcanzable === 'basica' ? 'básica' : salidaPresupuesto.proteinaAlcanzable} ›
                </button>
              )}
              {salidaPresupuesto.variedadMasBarata && (
                <button
                  type="button"
                  className="semana__sin-cobertura-salida"
                  onClick={() =>
                    dispatch({
                      type: 'SET_PREFERENCIAS',
                      preferencias: {
                        ...preferencias,
                        variedad: salidaPresupuesto.variedadMasBarata!,
                        /* Aceptar la salida ES elegir: si no se marcase, la
                           próxima regeneración volvería a la que menos
                           desperdicia —que es la que no cabía— y el usuario
                           vería reaparecer el aviso que acaba de cerrar. */
                        variedadElegida: true,
                      },
                    })
                  }
                >
                  Bájame a {salidaPresupuesto.variedadMasBarata} variedad ›
                </button>
              )}
              {salidaPresupuesto.motivo !== 'proteina' && (
                <button
                  type="button"
                  className="semana__sin-cobertura-salida"
                  onClick={() =>
                    dispatch({ type: 'SET_PRESUPUESTO', presupuesto: salidaPresupuesto.presupuestoNecesario })
                  }
                >
                  Sube a {salidaPresupuesto.presupuestoNecesario} € y déjala como está ›
                </button>
              )}
            </div>
          )}

          {sinCobertura && (
            <div className="semana__sin-cobertura">
              {/**
                * ═══ DOS FRASES, SEGÚN QUIÉN HAYA CERRADO EL RECETARIO ═══
                *
                * Si lo que aprieta son los platos bloqueados, se dice ESO y con
                * su número. Con la frase genérica —"solo me quedan 12 recetas"—
                * quien ha bloqueado cuarenta platos no tiene forma de atar la
                * causa al efecto, y lo más probable es que se ponga a quitar
                * alergias, que es lo único que la pantalla le nombra.
                *
                * Y la promesa importante va en las dos: LA SEMANA ANTERIOR SE
                * QUEDA. No se borra nada mientras el usuario decide.
                */}
              <p className="semana__sin-cobertura-texto">
                {sinCobertura.platosBloqueados
                  ? `Has quitado ${sinCobertura.platosBloqueados} platos y no me quedan suficientes para
                     completar la semana. Te dejo la anterior hasta que decidas.`
                  : `Con lo que me has dicho solo me quedan ${sinCobertura.recetasVivas} recetas, y no dan
                     para ${sinCobertura.huecosPedidos} comidas. Te dejo la semana anterior hasta que
                     decidas.`}
              </p>
              {sinCobertura.salidas.map((s) => (
                <button
                  key={s.que}
                  type="button"
                  className="semana__sin-cobertura-salida"
                  onClick={() => (s.tipo === 'bloqueados'
                    ? setVerBloqueados(true)
                    : setMostrarAjustes('exclusiones'))}
                >
                  {textoSalida(s)} ›
                </button>
              ))}
            </div>
          )}

          {/**
           * ═══ LA LÍNEA QUE EVITA QUE LOS NÚMEROS PAREZCAN MENTIRA ═══
           *
           * Esta pantalla enseña dos costes que CLAUDE.md dice explícitamente
           * que NO se mezclan: arriba el carrito —51,74 €, lo que pasa por
           * caja— y en cada plato el consumo por ración —0,44 €—. Sin decirlo,
           * el usuario suma los siete días, le salen doce euros, mira la
           * cabecera y ve 51,74. La conclusión natural no es "ah, son cosas
           * distintas": es que uno de los dos números está mal.
           *
           * Y en una app cuya única defensa es que sus cifras no mienten, esa
           * sospecha se paga en todas las demás pantallas.
           *
           * Una línea, y no una explicación: rotula las 21 cifras de golpe.
           * Quien quiera el detalle lo tiene al abrir el día, donde ya se dicen
           * las dos ("0,44 € la ración · 0,88 € las 2").
           */}
          <div className="semana__dias-envoltorio">
            <span className="semana__dias-rotulo">Por persona y ración</span>
            <div className="semana__dias" onScroll={alScroll}>
              {semana.dias.map((dia, i) => (
                <TarjetaDia
                  key={dia.dia}
                  dia={dia}
                  fecha={fechaDePosicion(semana.fechaInicio, i)}
                  ranuras={ranuras}
                  onAbrirHueco={abrirHueco}
                />
              ))}
            </div>
          </div>

          {/**
            * COMPARTIR NO COMPITE CON «VER LA LISTA», Y NO GASTA UNA FILA.
            *
            * Esta pantalla tiene una acción y es ir a la compra: es lo que el
            * usuario ha venido a hacer y lo que sostiene la métrica que decide
            * si esto es un negocio. Compartir es bueno para nosotros, no para
            * él, y una app que pone lo suyo al mismo tamaño que lo del usuario
            * ya ha empezado a ser otra cosa.
            *
            * Primero fue un enlace debajo del botón. Se quitó: eran 48 px de
            * alto —la zona pulsable mínima, no se puede recortar— robados a la
            * lista de días en la pantalla donde el alto ya iba contado. El
            * icono va en la misma fila, a la derecha, y cuesta cero.
            */}
          <div className="semana__pie">
            <PrimaryButton className="semana__pie-principal" onClick={() => history.push('/compra')}>
              Ver la lista
            </PrimaryButton>
            <button
              type="button"
              className="semana__compartir"
              /* Un icono solo NO se explica: sin nombre accesible, un lector de
                 pantalla lee «botón» y ya. El rótulo dice el verbo, igual que
                 el título de la hoja que abre. */
              aria-label="Compartir"
              onClick={() => setVerCompartir(true)}
            >
              {/* El glifo de compartir de Android —tres nudos y dos líneas—,
                  que es la única plataforma en la que esto se publica y donde
                  la gente ya lo reconoce. Dibujado a mano y no traído de una
                  librería de iconos: son doce caracteres de path contra 300 KB
                  y una dependencia más en una app que funciona sin conexión. */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 10.5 15.4 6.6M8.6 13.5l6.8 3.9" />
              </svg>
            </button>
          </div>
        </div>

        {mostrarAjustes && (
          <AjustesSemana
            preferenciasActuales={preferencias}
            perfil={perfil}
            origen={mostrarAjustes}
            cestaActual={total}
            /* Una sola acción con todo: la hoja cambia perfil y preferencias a
               la vez, y encadenar tres despachos regeneraba dos veces —o
               ninguna, si solo movías el tope. Ver SET_AJUSTES. */
            onGuardar={(nuevasPreferencias, nuevoPerfil) => {
              dispatch({ type: 'SET_AJUSTES', preferencias: nuevasPreferencias, perfil: nuevoPerfil });
              setMostrarAjustes(null);
            }}
            onCerrar={() => setMostrarAjustes(null)}
            bloqueados={cuentaPreferencias(preferenciasPlatos).bloqueados}
            inicioSemana={perfil.fechaInicioSemana}
            onAbrirInicio={() => { setMostrarAjustes(null); setVerInicio(true); analitica('week_start_date_picker_opened', { source: 'ajustes', week_number: numeroSemana }); }}
            /* Se cierra ajustes al abrir la lista: dos hojas apiladas sobre la
               semana no se cierran en el orden que uno espera, y la de abajo
               se queda huérfana detrás. Mismo criterio que el muro. */
            onAbrirBloqueados={() => { setMostrarAjustes(null); setVerBloqueados(true); }}
          />
        )}

        {/**
          * La lista de bloqueados vive en la PANTALLA y no dentro de ajustes.
          * Se llega a ella desde ajustes, pero también desde el aviso de "has
          * quitado tantos platos que no me salen las cuentas", y una hoja que
          * solo supiera abrirse desde dentro de otra no serviría para lo
          * segundo — que es justo el caso en que más falta hace.
          */}
        {verInicio && (
          <HojaInicioSemana
            valor={perfil.fechaInicioSemana}
            onElegir={(fecha, origen) => {
              dispatch({ type: 'SET_INICIO_SEMANA', fecha, origen });
              setVerInicio(false);
            }}
            onCerrar={() => setVerInicio(false)}
          />
        )}

        {verCompartir && (
          <HojaCompartir datos={datosCompartibles} onCerrar={() => setVerCompartir(false)} />
        )}

        {verBloqueados && (
          <HojaPlatosBloqueados
            preferenciasPlatos={preferenciasPlatos}
            onPermitir={(platoId, tipo) => {
              dispatch({ type: 'VALORAR_PLATO', platoId, valoracion: 'neutral', tipo });
              analitica('disliked_dish_restored', {
                dish_id: platoId,
                dish_type: tipo,
                source_screen: 'platos_bloqueados',
                week_number: numeroSemana,
              });
            }}
            onCerrar={() => setVerBloqueados(false)}
          />
        )}

        {huecoAbierto && (
          <HojaDeDia
            dia={huecoAbierto.dia}
            fecha={fechaDePosicion(semana.fechaInicio, semana.dias.findIndex((d) => d.dia === huecoAbierto.dia))}
            ranura={huecoAbierto.ranura}
            plato={huecoAbierto.plato}
            comensales={perfil.comensales}
            exclusiones={preferencias.exclusiones}
            alternativas={alternativas}
            onVerMas={verMasPlatos}
            preferenciasPlatos={preferenciasPlatos}
            /* Guarda y punto: la hoja no se cierra y la semana no se mueve.
               Cambiarle el menú a alguien que acaba de decir "no me lo vuelvas
               a poner" sería leerle "no me lo pongas", que es otra frase. */
            onValorar={(platoId, valoracion, tipo) =>
              dispatch({ type: 'VALORAR_PLATO', platoId, valoracion, tipo })}
            onElegirAlternativa={(a) => {
              dispatch({ type: 'APLICAR_SEMANA', semana: a.semana });
              setHuecoAbierto(null);
            }}
            onRetocar={proponerRetoque}
            onVerReceta={() => {
              setRecetaAbierta(huecoAbierto);
              setHuecoAbierto(null);
            }}
            onCerrar={() => setHuecoAbierto(null)}
          />
        )}

        {propuesta && (
          <CambioSemana
            antes={semana.dias}
            fechaInicio={semana.fechaInicio}
            despues={propuesta.resultado.dias}
            totalAntes={total}
            totalDespues={propuesta.resultado.carrito.totalCarrito}
            retoque={propuesta.retoque}
            onConfirmar={() => {
              dispatch({
                type: 'RETOCAR_HUECO',
                dia: propuesta.hueco.dia,
                ranura: propuesta.hueco.ranura,
                retoque: propuesta.retoque,
              });
              setPropuesta(null);
            }}
            onCancelar={() => setPropuesta(null)}
          />
        )}

        {recetaAbierta?.plato && (
          <RecetaPlato
            plato={recetaAbierta.plato}
            dia={recetaAbierta.dia}
            comensales={perfil.comensales}
            exclusiones={preferencias.exclusiones}
            onCerrar={() => setRecetaAbierta(null)}
          />
        )}
        {mostrarMuro && (
          <MuroDePago
            logro={{
              // Datos reales de ESTE usuario. delArmario es lo que la despensa
              // ha evitado pagar esta semana; si no hay, el muro no enseña cifra.
              ahorroDespensa: lista.filter((it) => it.yaEnCasa && it.loTengo !== false).reduce((a, it) => a + it.precio, 0),
              bajadoConRetoques: contadores.bajadoConRetoques ?? 0,
              ajustes: contadores.ajustesEstaSemana,
            }}
            onElegirPlan={(plan) => { setMuroPorPlatos(false); dispatch({ type: 'SET_SUSCRIPCION', plan }); }}
            onSeguirGratis={() => {
              setMuroPorPlatos(false);
              dispatch({ type: 'SEGUIR_GRATIS', numeroSemana });
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Semana;
