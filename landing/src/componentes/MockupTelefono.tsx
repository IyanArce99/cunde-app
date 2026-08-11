import { IconoCompartir } from './Iconos';
import './MockupTelefono.css';

/**
 * LA PANTALLA SEMANA, DENTRO DE UN TELÉFONO.
 *
 * HTML y CSS, no una captura: así escala nítido en cualquier pantalla y no hay
 * que rehacer una imagen cada vez que la app cambia un padding.
 *
 * ═══ LOS NÚMEROS SON DE LA APP DE VERDAD ═══
 *
 * 60,04 € de cesta, «sobran 4,96 €» sobre un tope de 65, el potaje a 3,64 € y
 * los jamoncitos a 1,03 €. Salen de una semana real generada por el motor, no
 * son cifras bonitas: si el hero enseñara precios inventados, la primera cosa
 * que el visitante ve de un producto cuyo argumento es «los precios son reales»
 * sería falsa.
 *
 * Todo el bloque es `aria-hidden`: es una ilustración del producto, y un lector
 * de pantalla que lea «SEMANA COMPRA TU SEMANA 60,04 ajustar» en medio del hero
 * no informa de nada. Lo que hay que leer está en el H1 y en el párrafo.
 */

interface Plato { nombre: string; cuando: string; precio: string }
interface Dia { fecha: string; total: string; platos: Plato[] }

const DIAS: Dia[] = [
  {
    fecha: 'MAR · 11 AGO',
    total: '4,56 €',
    platos: [
      { nombre: 'Potaje de vigilia', cuando: 'comida · 45 min', precio: '3,64 €' },
      { nombre: 'Lentejas salteadas', cuando: 'cena · 15 min', precio: '0,92 €' },
    ],
  },
  {
    fecha: 'MIÉ · 12 AGO',
    total: '1,99 €',
    platos: [
      { nombre: 'Jamoncitos al ajillo', cuando: 'comida · 35 min', precio: '1,03 €' },
      { nombre: 'Espaguetis con soja', cuando: 'cena · 25 min', precio: '0,96 €' },
    ],
  },
];

export default function MockupTelefono({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className={`tel${compacto ? ' tel--compacto' : ''}`} aria-hidden="true">
      <div className="tel__pantalla">
        {!compacto && (
          <div className="tel__estado">
            <span>20:41</span>
            <span className="tel__estado-der">
              <span className="tel__5g">5G</span>
              <span className="tel__pila"><span className="tel__pila-carga" /></span>
            </span>
          </div>
        )}

        <div className="tel__tabs">
          <span className="tel__tab tel__tab--activa">SEMANA</span>
          <span className="tel__tab">COMPRA</span>
        </div>

        <div className="tel__cabecera">
          <div className="tel__fila">
            <span className="tel__rotulo">TU SEMANA</span>
            <span className="tel__ajustar">Ajustar ›</span>
          </div>
          <div className="tel__fila tel__fila--cifra">
            <span className="tel__total cifra">
              60,04<span className="tel__euro">€</span>
            </span>
            <span className="tel__sobran">Sobran 4,96 €</span>
          </div>
          <div className="tel__barra"><div className="tel__barra-progreso" /></div>
          {!compacto && <div className="tel__pie-cabecera">Por persona y ración</div>}
        </div>

        <div className="tel__dias">
          {(compacto ? DIAS.slice(0, 1) : DIAS).map((dia) => (
            <div className="tel__dia" key={dia.fecha}>
              <div className="tel__dia-cabecera">
                <span className="tel__dia-fecha">{dia.fecha}</span>
                <span className="tel__dia-total cifra">{dia.total}</span>
              </div>
              {dia.platos.map((p) => (
                <div className="tel__plato" key={p.nombre}>
                  <span>
                    <span className="tel__plato-nombre">{p.nombre}</span>
                    <span className="tel__plato-cuando">{p.cuando}</span>
                  </span>
                  <span className="tel__plato-precio cifra">
                    {p.precio}
                    {!compacto && <span className="tel__chevron">›</span>}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="tel__pie">
          <div className="tel__boton">Ver la lista</div>
          {!compacto && <div className="tel__compartir"><IconoCompartir /></div>}
        </div>
      </div>
    </div>
  );
}
