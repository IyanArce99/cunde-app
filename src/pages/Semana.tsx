import { useCallback, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { etiquetaComensales, numComensales, ranurasVisibles } from '../state/types';
import type { Plato, Ranura, SinCobertura } from '../state/types';
import { semanaEfectiva, totalLista } from '../lib/derive';
import { eur } from '../lib/format';
import { indiceDeHueco, retocarParaApp } from '../data/motor';
import type { Retoque } from '../data/motor';
import { useContador } from '../hooks/useContador';
import TopTabs from '../components/TopTabs';
import PrimaryButton from '../components/PrimaryButton';
import MuroDePago from '../components/MuroDePago';
import { MURO_ACTIVO } from '../lib/suscripcion';
import AjustesSemana from '../components/AjustesSemana';
import TarjetaDia from '../components/TarjetaDia';
import HojaDeDia from '../components/HojaDeDia';
import CambioSemana from '../components/CambioSemana';
import RecetaPlato from '../components/RecetaPlato';
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
  return `Resuélveme ${s.que}: eso sí sale`;
}

const Semana: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const {
    perfil, preferencias, semana, lista, cierre, suscripcion, contadores, sinCobertura, salidaPresupuesto,
    historial, despensa, deshacerCierre,
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
  const cifraRef = useContador(total);

  const [mostrarAjustes, setMostrarAjustes] = useState<'exclusiones' | 'sobrante' | null>(null);
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
  /* Escala común de la barra de coste: el plato más caro de la semana. Se
     calcula aquí y no dentro de la tarjeta porque una barra normalizada por
     día haría que el día de 0,35 € y el de 2,01 € se pintaran igual. */
  const precioMaximo = Math.max(
    0,
    ...semana.dias.flatMap((d) => ranuras.map(({ clave }) => d[clave]?.precioRacion ?? 0)),
  );
  const abrirHueco = useCallback(
    (dia: string, ranura: Ranura, plato: Plato | null) => setHuecoAbierto({ dia, ranura, plato }),
    [],
  );

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
  const mostrarMuro = MURO_ACTIVO && numeroSemana >= 2 && suscripcion === null && !yaVistoGratisEstaSemana;

  const proponerRetoque = (retoque: Retoque) => {
    if (!huecoAbierto) return;
    const indice = indiceDeHueco(semana.plan, huecoAbierto.dia, huecoAbierto.ranura);
    if (indice < 0) return;
    setPropuesta({
      retoque,
      hueco: huecoAbierto,
      resultado: retocarParaApp(
        perfil, preferencias, semana.plan, indice, retoque, numeroSemana, historial, despensa,
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
            <button className="semana__rotulo" type="button" onClick={() => setMostrarAjustes('exclusiones')}>
              <span className="semana__etiqueta">TU SEMANA</span>
              <span className="semana__rotulo-guia" />
              <span className="semana__rotulo-accion">ajustar ›</span>
            </button>

            <div className="semana__cifra-fila">
              <div className="semana__cifra" style={{ color: sobra < 0 ? 'var(--roja)' : undefined }}>
                <span ref={cifraRef} />
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
                const contenido = (
                  <span className="semana__saldo-titulo">
                    {sobra > 0 ? 'Te sobran' : 'Te pasas'}{' '}
                    {/* El espacio va explícito: en el estado colapsado el salto
                        se oculta y sin él las palabras salían pegadas
                        ("Te sobran3,08 €"). */}
                    <br />
                    <span style={{ color: sobra < 0 ? 'var(--roja)' : undefined }}>{eur(Math.abs(sobra))}</span>
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

            <div className="semana__barra">
              <div
                className="semana__barra-relleno"
                style={{ width: `${pctBarra}%`, background: sobra < 0 ? 'var(--roja)' : 'var(--azulete)' }}
              />
            </div>

            {/* Decía "66,00 € de presupuesto · 14 comidas · 2 personas · € por
                ración": tres ajustes que el usuario acaba de meter, más una
                cabecera de columna suelta a mitad de frase. Le devolvía sus
                propios datos.

                Ahora dice lo que se lleva y a qué precio la ración, que es el
                número con el que se compara con un menú del día o con lo que
                gastó la semana pasada. El tope va al final: ya está dicho en la
                barra y en el saldo, y aquí es contexto, no titular. */}
            <div className="semana__contexto">
              {ranuras.length * 7} comidas para {etiquetaComensales(perfil.comensales)}
              {' · '}{eur(total / (ranuras.length * 7 * numComensales(perfil.comensales)), 2)} la ración
              {' · '}tope {eur(perfil.presupuestoSemanal)}
            </div>
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
                      preferencias: { ...preferencias, variedad: salidaPresupuesto.variedadMasBarata! },
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
              <p className="semana__sin-cobertura-texto">
                Con lo que me has dicho solo me quedan {sinCobertura.recetasVivas} recetas, y no dan para{' '}
                {sinCobertura.huecosPedidos} comidas. Te dejo la semana anterior hasta que decidas.
              </p>
              {sinCobertura.salidas.map((s) => (
                <button
                  key={s.que}
                  type="button"
                  className="semana__sin-cobertura-salida"
                  onClick={() => setMostrarAjustes('exclusiones')}
                >
                  {textoSalida(s)} ›
                </button>
              ))}
            </div>
          )}

          <div className="semana__dias-envoltorio">
            <div className="semana__dias" onScroll={alScroll}>
              {semana.dias.map((dia) => (
                <TarjetaDia key={dia.dia} dia={dia} ranuras={ranuras} onAbrirHueco={abrirHueco} precioMaximo={precioMaximo} />
              ))}
            </div>
          </div>

          <div className="semana__pie">
            <PrimaryButton onClick={() => history.push('/compra')}>Ver la lista</PrimaryButton>
          </div>
        </div>

        {mostrarAjustes && (
          <AjustesSemana
            preferenciasActuales={preferencias}
            perfil={perfil}
            origen={mostrarAjustes}
            cestaActual={total}
            onGuardar={(nuevasPreferencias) => {
              dispatch({ type: 'SET_PREFERENCIAS', preferencias: nuevasPreferencias });
              setMostrarAjustes(null);
            }}
            onCerrar={() => setMostrarAjustes(null)}
          />
        )}

        {huecoAbierto && (
          <HojaDeDia
            dia={huecoAbierto.dia}
            ranura={huecoAbierto.ranura}
            plato={huecoAbierto.plato}
            comensales={perfil.comensales}
            exclusiones={preferencias.exclusiones}
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
            onElegirPlan={(plan) => dispatch({ type: 'SET_SUSCRIPCION', plan })}
            onSeguirGratis={() => dispatch({ type: 'SEGUIR_GRATIS', numeroSemana })}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Semana;
