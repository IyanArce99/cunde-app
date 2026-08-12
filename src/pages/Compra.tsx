import { useCallback, useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import type { ItemLista } from '../state/types';
import { pasillosOrdenados, subtotalPasillo, totalLista, totalLlevas } from '../lib/derive';
import { eur, fechaCorta } from '../lib/format';
import { useContador } from '../hooks/useContador';
import { useEnLinea } from '../hooks/useEnLinea';
import TopTabs from '../components/TopTabs';
import TicketRow from '../components/TicketRow';
import ShoppingRow from '../components/ShoppingRow';
import PrimaryButton from '../components/PrimaryButton';
import CierreDeSemana from '../components/CierreDeSemana';
import BottomSheet from '../components/BottomSheet';
import AvisoAlergenos from '../components/AvisoAlergenos';
import FilaExtra from '../components/FilaExtra';
import HojaExtra from '../components/HojaExtra';
import {
  extrasLlevados, extrasSinPrecio, totalCompraPrevista, totalExtras,
} from '../lib/extras';
import { analitica } from '../lib/analitica';
import { tramoImporte } from '../lib/analitica-buckets';
import { versionDePrecios } from '../data/motor';
import { DIAS_PRECIOS_VIEJOS, diasDePrecios } from '../lib/precios';
import { hoy } from '../lib/fechas';
import './Compra.css';

/**
 * Qué semanas ya han contado su apertura de Compra, en esta sesión.
 *
 * Fuera del componente a propósito: dentro de un `useRef` se reiniciaría en
 * cada montaje, que es exactamente lo que hay que evitar. Se vacía sola al
 * cerrar la app, y una sesión nueva vuelve a contar — que es lo correcto: dos
 * viajes al súper en días distintos sí son dos aperturas.
 */
const yaContadaLaCompra = new Set<number>();

const Compra: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { lista, perfil, extrasCompra } = estado;
  const enLinea = useEnLinea();
  const [mostrarCierre, setMostrarCierre] = useState(false);

  /* Se calcula en el render y no en un efecto: es una cuenta sobre dos fechas,
     no un dato que haya que ir a buscar. Y se recalcula al volver a la pantalla,
     que es cuando importa — la app puede llevar días abierta en segundo plano. */
  const diasDeLosPrecios = diasDePrecios(versionDePrecios(), hoy());
  const preciosDesfasados = diasDeLosPrecios >= DIAS_PRECIOS_VIEJOS;

  /**
   * ═══ ABRIR LA COMPRA · UNA VEZ POR MONTAJE ═══
   *
   * Es el tercer escalón del embudo: cuánta gente que genera una semana llega
   * de verdad al supermercado con ella. Va en un efecto con `[]` porque lo que
   * se cuenta es la visita, no cada repintado — y esta pantalla repinta en cada
   * casilla marcada.
   */
  useEffect(() => {
    /* Una vez por SEMANA y por sesión, no por montaje.
       Sin el guardia salían dos eventos por visita —React monta dos veces en
       desarrollo— y uno más cada vez que el usuario va y vuelve de la pestaña
       Semana. Cinco idas y venidas en un mismo viaje al súper no son cinco
       aperturas de la compra. */
    if (yaContadaLaCompra.has(estado.contadores.semanaNumero)) return;
    yaContadaLaCompra.add(estado.contadores.semanaNumero);
    analitica('shopping_opened', {
      screen: 'compra',
      week_number: estado.contadores.semanaNumero,
      items_total: estado.lista.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por visita
  }, []);

  /**
   * El `dispatch` va PRIMERO y la analítica después, sin `await`: marcar una
   * casilla no puede quedar detrás de nada. Si el sumidero se cayera, la
   * casilla se marca igual.
   *
   * Aquí no viaja ni el nombre ni el SKU del producto: solo si se marcó o se
   * desmarcó. Para saber si la lista se usa basta con contar, y el contenido de
   * la compra de alguien no es asunto de una métrica.
   */
  const onToggle = useCallback((id: string) => {
    const iba = estado.lista.find((i) => i.id === id)?.enElCarro ?? false;
    dispatch({ type: 'TOGGLE_ITEM', id });
    analitica(iba ? 'shopping_item_unchecked' : 'shopping_item_checked', {
      screen: 'compra',
      week_number: estado.contadores.semanaNumero,
    });
  }, [dispatch, estado.lista, estado.contadores.semanaNumero]);

  const onToggleLoTengo = useCallback((id: string) => dispatch({ type: 'TOGGLE_LO_TENGO', id }), [dispatch]);

  // Tres listas y no dos: lo que hay que comprar, lo que la app da por hecho
  // de semanas anteriores, y la despensa de siempre (aceite, sal, especias).
  // Un producto "ya en casa" que el usuario desmarca deja de estarlo y pasa a
  // los pasillos como uno más — por eso el filtro mira loTengo y no el flag.
  const seDaPorHecho = (item: ItemLista) => (item.esDespensa || item.yaEnCasa) && item.loTengo !== false;
  /**
   * UNA sola sección, y plegada.
   *
   * Antes eran dos seguidas —"ya lo tienes en casa" y "por si te falta"— con
   * la misma mecánica y dos notas casi iguales. Desde el lado del usuario son
   * lo mismo: cosas que no compra porque las tiene. Que una venga marcada en
   * el ingrediente (aceite, sal) y la otra de un sobrante es detalle de
   * implementación.
   *
   * Y plegada porque medido en la app eran 30 filas, 16 de ellas (53%) de
   * productos que NO se compran, y 7 pantallas de scroll. Esta pantalla se usa
   * de pie, con una mano, empujando un carro: pasar por delante de dieciséis
   * filas que no hay que coger es lo contrario de lo que hace falta ahí.
   */
  const yaTienes = lista.filter(seDaPorHecho);
  /**
   * Y al quitar la marca, el producto se va A SU PASILLO. Si se quedara en la
   * sección plegada habría dinero en el total sin ninguna fila visible que lo
   * explique, que es la peor cosa que puede hacer una pantalla que se llama
   * "lo que llevas".
   */
  const principal = lista.filter((item) => !seDaPorHecho(item));
  const ahorrado = yaTienes.reduce((a, it) => a + it.precio, 0);
  const [verYaTienes, setVerYaTienes] = useState(false);

  const pasillos = pasillosOrdenados(principal);
  // Carrito real, no consumo. totalLista/totalLlevas ya excluyen la despensa
  // que el usuario da por hecha (ver ItemLista.loTengo y lib/derive.ts).
  /**
   * ═══ LOS TRES NÚMEROS, Y CUÁL DE ELLOS ES LA PROMESA ═══
   *
   *   total       — el MENÚ. `totalLista` sobre la lista del motor. Es la
   *                 cifra de la que Cunde responde y la que enseña Semana.
   *                 NO la tocan los extras: no están en `lista`.
   *   extras      — solo los que tienen precio.
   *   totalCompra — lo que va a pasar por caja, si todo tiene precio.
   *
   * `restan` y la barra siguen siendo del MENÚ a propósito: miden el tope
   * semanal, y el tope es de la comida.
   */
  const total = totalLista(lista);
  const llevas = totalLlevas(lista);
  const restan = total - llevas;
  const pct = total === 0 ? 0 : (llevas / total) * 100;
  const extras = totalExtras(extrasCompra);
  const sinPrecio = extrasSinPrecio(extrasCompra);
  const totalCompra = totalCompraPrevista(total, extrasCompra);
  /* LLEVAS sí los suma: en el carro van juntos, no hay dos carros. */
  const cifraLlevasRef = useContador(llevas + extrasLlevados(extrasCompra), { formatear: (n) => eur(n) });

  const [anadiendoExtra, setAnadiendoExtra] = useState(false);
  const [editandoExtra, setEditandoExtra] = useState<string | null>(null);
  const extraEditado = extrasCompra.find((e) => e.id === editandoExtra) ?? null;
  const onMarcarExtra = useCallback((id: string) => dispatch({ type: 'TOGGLE_EXTRA', id }), [dispatch]);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla compra">
          <TopTabs activo="compra" />

          {!enLinea && (
            <div className="compra__offline">
              <TicketRow label="Sin conexión" value="tus marcas se guardan" size={13} color="var(--gris)" />
            </div>
          )}

          {/* Fuera del contenedor con scroll: el momento de riesgo es el súper
              y ahí la lista se recorre entera. Un aviso que se va con el
              scroll no está puesto donde hace falta. */}
          <AvisoAlergenos exclusiones={estado.preferencias.exclusiones} />


          <div className="compra__lista-envoltorio">
            <div className="compra__lista">
              {/* La fecha del catálogo, UNA vez. Iba pegada a cada producto —27
                  filas repitiendo "precio del 28 jul"— y era una línea entera
                  por artículo diciendo lo mismo, en la pantalla que se recorre
                  de pie y con una mano. */}
              {/**
                * ═══ CUANDO LOS PRECIOS SON VIEJOS, SE DICE ═══
                *
                * La fecha sola se lee igual con dos días que con cuarenta, y
                * quien mira «10 AGO» un 21 de agosto tiene que restar de cabeza
                * delante del lineal. Pasados siete días —más que la semana que
                * están valorando— el rótulo dice la antigüedad y la fecha se
                * queda donde estaba, que es lo que uno comprueba.
                *
                * Sin rojo ni icono de alerta: el rojo está reservado a pasarse
                * del presupuesto, y esto no es un error del usuario ni algo que
                * pueda arreglar. Es una condición del dato, como el aviso de
                * alérgenos. Ver DIAS_PRECIOS_VIEJOS en lib/precios.ts.
                */}
              <div className={`compra__fuente${preciosDesfasados ? ' compra__fuente--vieja' : ''}`}>
                <span>
                  {preciosDesfasados
                    ? `Precios de ${perfil.super} de hace ${diasDeLosPrecios} días`
                    : `Precios de ${perfil.super} del`}
                </span>
                {/* La fecha a la derecha y en versalitas: es el dato que se
                    comprueba —"¿esto es de hoy?"—, y en el medio de una frase
                    corrida hay que leerla entera para encontrarlo. */}
                {/* La fecha de los precios que se están viendo, no la del APK:
                    desde que los precios se actualizan sin publicar versión,
                    los dos números pueden ser distintos y el que importa es el
                    de los precios. Ver lib/precios.ts. */}
                <span className="compra__fuente-fecha">{fechaCorta(versionDePrecios())}</span>
              </div>
              {pasillos.map((pasillo) => {
                const delPasillo = principal.filter((item) => item.pasillo === pasillo);
                const marcados = delPasillo.filter((item) => item.enElCarro).length;
                const todos = marcados === delPasillo.length;
                const aMedias = marcados > 0 && !todos;
                return (
                  <div key={pasillo}>
                    {/* La cabecera del pasillo marca el pasillo entero.
                        La lista tiene 25-40 productos y se recorre de pie, con
                        una mano, empujando un carro: ir fila a fila son
                        cuarenta toques. Delante del lineal se coge el pasillo
                        de golpe, así que el gesto que hace falta es ese.

                        Tri-estado de verdad —vacío, a medias, lleno— con
                        aria-checked="mixed", que es lo único que distingue
                        "no he cogido nada de aquí" de "me falta uno". La
                        casilla va en la misma columna que las de las filas:
                        alineadas se lee que la de arriba manda sobre las de
                        abajo, sin tener que explicarlo. */}
                    <button
                      type="button"
                      className={`compra__pasillo-cabecera${todos ? ' compra__pasillo-cabecera--hecha' : ''}`}
                      role="checkbox"
                      aria-checked={todos ? 'true' : (aMedias ? 'mixed' : 'false')}
                      aria-label={`${pasillo}: ${marcados} de ${delPasillo.length} en el carro`}
                      onClick={() => dispatch({ type: 'TOGGLE_PASILLO', pasillo, marcar: !todos })}
                    >
                      <span
                        className={`fila-producto__caja${todos ? ' fila-producto__caja--marcada' : ''}${aMedias ? ' fila-producto__caja--media' : ''}`}
                        aria-hidden="true"
                      >
                        {todos ? '✓' : ''}
                      </span>
                      <span className="compra__pasillo-nombre" aria-hidden="true">{pasillo}</span>
                      <span className="compra__pasillo-linea" aria-hidden="true" />
                      <span className="compra__pasillo-subtotal" aria-hidden="true">
                        {eur(subtotalPasillo(principal, pasillo))}
                      </span>
                    </button>
                    {delPasillo.map((item) => (
                      <ShoppingRow key={item.id} item={item} onToggle={onToggle} onToggleLoTengo={onToggleLoTengo} />
                    ))}
                  </div>
                );
              })}

              {/* Ni sección desplegable ni pestaña nueva: una línea de ticket
                  que abre una HOJA.

                  Desplegar aquí mismo metía dieciséis filas en el mismo scroll
                  y te hacía perder el sitio en el pasillo, y esta pantalla se
                  recorre de pie empujando un carro. Una pestaña arriba está
                  descartada por CLAUDE.md y además sería chrome permanente
                  para algo que se toca cuando te equivocas, una vez cada
                  varias semanas — y partiría el dinero en dos totales.

                  La hoja es el patrón que ya usa todo lo secundario de la app
                  (el día, el cambio de semana, los ajustes, el cierre): se
                  abre desde abajo, se corrige, se cierra, y la lista no se
                  ha movido. */}
              {yaTienes.length > 0 && (
                <button className="compra__ya-tienes" type="button" onClick={() => setVerYaTienes(true)}>
                  <span className="compra__pasillo-nombre">YA LO TIENES</span>
                  <span className="compra__pasillo-linea" />
                  <span className="compra__pasillo-subtotal">
                    {yaTienes.length} · −{eur(ahorrado)}{' '}
                    <span className="compra__ya-tienes-flecha">›</span>
                  </span>
                </button>
              )}

              {/**
                * ═══ OTRAS COSAS ═══
                *
                * Va DESPUÉS de los pasillos y de "ya lo tienes", al final del
                * ticket. No es un capricho de orden: los pasillos están puestos
                * en el orden en que se recorre el súper, y estas cosas no
                * tienen pasillo —el usuario las apunta, no las coloca la app—.
                * Meterlas en medio rompería el recorrido, que es lo único que
                * esta pantalla ordena.
                *
                * Sin subtotal en la banda, al contrario que los pasillos: el
                * subtotal de los extras vive en el pie, junto al del menú, que
                * es donde se comparan. Repetirlo aquí sería la misma cifra dos
                * veces en la misma pantalla.
                */}
              <div className="compra__extras">
                <div className="compra__pasillo-cabecera compra__pasillo-cabecera--extras">
                  <span className="compra__pasillo-nombre">OTRAS COSAS</span>
                  <span className="compra__pasillo-linea" />
                </div>

                {extrasCompra.map((extra) => (
                  <FilaExtra
                    key={extra.id}
                    extra={extra}
                    onMarcar={onMarcarExtra}
                    onAbrir={setEditandoExtra}
                  />
                ))}

                {/* Una línea del ticket, no un botón flotante: lo principal de
                    esta pantalla es la lista del menú, y un botón encima
                    taparía producto justo donde se recorre de pie. */}
                <button className="compra__anadir" type="button" onClick={() => setAnadiendoExtra(true)}>
                  <span className="compra__anadir-mas" aria-hidden="true">+</span>
                  Añadir otra cosa
                </button>
              </div>
            </div>
          </div>

          {verYaTienes && (
            <BottomSheet onDismiss={() => setVerYaTienes(false)}>
              <h2 className="cambio__titulo">
                {yaTienes.length} {yaTienes.length === 1 ? 'producto' : 'productos'} que ya tienes.
              </h2>
              <p className="compra__despensa-nota">
                Doy por hecho que están en tu cocina. Quita la marca de lo que no tengas y vuelve a
                la lista con su precio.
              </p>
              <div className="compra__hoja-lista">
                {yaTienes.map((item) => (
                  <ShoppingRow key={item.id} item={item} onToggle={onToggle} onToggleLoTengo={onToggleLoTengo} />
                ))}
              </div>
              <PrimaryButton onClick={() => setVerYaTienes(false)}>Volver a la lista</PrimaryButton>
            </BottomSheet>
          )}

          <div className="compra__pie">
            {/**
              * ═══ LLEVAS SIGUE MANDANDO ═══
              *
              * Es la cifra que se lee de pie, con una mano, avanzando por el
              * lineal, y responde a la única pregunta que se hace ahí: cuánto
              * llevo ya. Se le añade lo que va cayendo de extras porque en el
              * carro van juntos —no hay dos carros—, pero la cifra grande no
              * cambia de sitio ni de tamaño.
              *
              * Y la BARRA sigue midiendo SOLO EL MENÚ. Es la única lectura de
              * "cuánto de tu tope llevas gastado", y el tope es del menú: si el
              * detergente empujara la barra, se pondría roja por comprar
              * detergente y diría que te has pasado con la comida.
              */}
            <div className="compra__pie-cabecera">
              <div>
                <span className="compra__pie-etiqueta">LLEVAS</span>
                <div className="compra__pie-cifra">
                  <span ref={cifraLlevasRef} />
                </div>
              </div>
              <span className="compra__pie-restan">
                restan
                <br />
                {eur(restan)}
              </span>
            </div>
            <div className="compra__pie-barra">
              <div className="compra__pie-barra-relleno" style={{ width: `${pct}%` }} />
            </div>

            {/**
              * ═══ EL DESGLOSE · SOLO SI HAY EXTRAS ═══
              *
              * Sin extras no se pinta nada: enseñar «EXTRAS 0,00 €» a quien no
              * ha añadido ninguno es tres líneas de ticket para decir que no
              * pasa nada.
              *
              * Y con extras, las tres cifras separadas y dichas por su nombre.
              * Es la funcionalidad entera: MENÚ es lo que Cunde promete y no se
              * mueve; EXTRAS es lo que has puesto tú; TOTAL es lo que vas a
              * pagar. Un solo número que los mezclara borraría la única cifra
              * de la que la app responde.
              */}
            {extrasCompra.length > 0 && (
              <div className="compra__desglose">
                <TicketRow label="Menú" value={eur(total)} size={13} />
                <TicketRow label="Otras cosas" value={eur(extras)} size={13} />
                <div className="compra__desglose-total">
                  <TicketRow
                    label={sinPrecio > 0 ? 'Total con precios' : 'Total'}
                    value={eur(totalCompra)}
                    size={15}
                  />
                </div>
                {/**
                  * ═══ LO QUE NO SE SABE, DICHO ═══
                  *
                  * Con extras sin precio, el total NO es toda la compra, y
                  * callarlo sería enseñar una cifra que no es verdad —lo único
                  * que esta app no se puede permitir—. No se estima, no se
                  * pone 0: se dice cuántos faltan y se deja al usuario decidir
                  * si le importa.
                  */}
                {sinPrecio > 0 && (
                  <p className="compra__desglose-aviso">
                    {sinPrecio} {sinPrecio === 1 ? 'cosa' : 'cosas'} sin precio. No {sinPrecio === 1 ? 'está' : 'están'} en esa suma.
                  </p>
                )}
              </div>
            )}

            <PrimaryButton onClick={() => {
              setMostrarCierre(true);
              /* Abrir el cierre y completarlo son dos cosas: entre las dos está
                 la gente que abre la hoja y no llega a meter el ticket, que es
                 la fuga que interesa ver. */
              analitica('checkout_opened', {
                screen: 'compra',
                week_number: estado.contadores.semanaNumero,
                items_checked: lista.filter((i) => i.enElCarro).length,
                items_total: lista.length,
              });
            }}
            >
              Cerrar la compra
            </PrimaryButton>
          </div>
        </div>

        {(anadiendoExtra || extraEditado) && (
          <HojaExtra
            extra={extraEditado}
            onAnadir={(nombre, precio) => dispatch({ type: 'ANADIR_EXTRA', nombre, precio })}
            onPrecio={(id, precio) => dispatch({ type: 'PRECIO_EXTRA', id, precio })}
            onQuitar={(id) => dispatch({ type: 'QUITAR_EXTRA', id })}
            onCerrar={() => { setAnadiendoExtra(false); setEditandoExtra(null); }}
          />
        )}

        {mostrarCierre && (
          <CierreDeSemana
            previsto={total}
            extras={extras}
            extrasSinPrecio={sinPrecio}
            presupuesto={perfil.presupuestoSemanal}
            onGuardar={(importeReal) => {
              if (extrasCompra.length > 0) {
                analitica('shopping_closed_with_extras', {
                  extras_count: extrasCompra.length,
                  extras_total_bucket: tramoImporte(extras),
                  unpriced_extras_count: sinPrecio,
                  week_number: estado.contadores.semanaNumero,
                });
              }
              dispatch({ type: 'GUARDAR_CIERRE', importeRealTicket: importeReal });
              setMostrarCierre(false);
              history.push('/semana');
            }}
            onCerrar={() => setMostrarCierre(false)}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Compra;
