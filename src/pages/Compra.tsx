import { useCallback, useState } from 'react';
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
import datosMotor from '../data/motor-datos.json';
import './Compra.css';

const Compra: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { lista, perfil } = estado;
  const enLinea = useEnLinea();
  const [mostrarCierre, setMostrarCierre] = useState(false);

  const onToggle = useCallback((id: string) => dispatch({ type: 'TOGGLE_ITEM', id }), [dispatch]);
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
  const total = totalLista(lista);
  const llevas = totalLlevas(lista);
  const restan = total - llevas;
  const pct = total === 0 ? 0 : (llevas / total) * 100;
  const cifraLlevasRef = useContador(llevas, { formatear: (n) => eur(n) });

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
              <div className="compra__fuente">
                Precios de {perfil.super} del {fechaCorta(datosMotor.generadoEn)}
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
            <PrimaryButton onClick={() => setMostrarCierre(true)}>Cerrar la compra</PrimaryButton>
          </div>
        </div>

        {mostrarCierre && (
          <CierreDeSemana
            previsto={total}
            presupuesto={perfil.presupuestoSemanal}
            onGuardar={(importeReal) => {
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
