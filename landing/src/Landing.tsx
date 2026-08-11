import BotonesStore from './componentes/BotonesStore';
import MockupTelefono from './componentes/MockupTelefono';
import PanelAjustar from './componentes/PanelAjustar';
import TarjetaPlato from './componentes/TarjetaPlato';
import { IconoApple } from './componentes/Iconos';
import './Landing.css';

/**
 * ═══ UNA SOLA PÁGINA, NO DOS ═══
 *
 * El handoff trae `LandingPage` y `LandingMobile` como ficheros separados, pero
 * dice explícitamente que «los tres anchos son el mismo contenido reflowing, no
 * tres diseños distintos». Así que esto es un único componente con media
 * queries, no dos árboles con un `useMediaQuery` decidiendo cuál pintar.
 *
 * La diferencia importa: con dos árboles, el móvil descarga y monta también el
 * de escritorio, el contenido se duplica para Google, y cada cambio de copy hay
 * que hacerlo dos veces —y a la tercera se olvida uno.
 *
 * Lo único que sí cambia de verdad entre anchos, y no se puede resolver con
 * CSS, es que el móvil enseña un mockup recortado (un día en vez de dos, sin
 * barra de estado). Eso se resuelve pintando los dos y ocultando uno, que en
 * una landing de este tamaño cuesta menos que la alternativa.
 */

const PASOS = [
  {
    n: 1,
    titulo: 'Pon tu tope',
    texto: 'Cuánto quieres gastar a la semana y para cuántos sois. Tú mandas.',
  },
  {
    n: 2,
    titulo: 'Recibe tu semana',
    texto: '14 comidas equilibradas que caben en tu presupuesto, con el precio de cada plato.',
  },
  {
    n: 3,
    titulo: 'Compra sin sorpresas',
    texto: 'La lista sale ordenada por pasillo. Lo que ves es lo que pagas en caja.',
  },
];

/* Mercadona es la única con catálogo. Las otras se enseñan en gris: el handoff
   lo pide y coincide con la regla del producto — nadie puede creerse que elige
   una cadena que no existe todavía. */
const CADENAS = [
  { nombre: 'Mercadona', activa: true },
  { nombre: 'Lidl', activa: false },
  { nombre: 'Carrefour', activa: false },
  { nombre: 'Dia', activa: false },
  { nombre: 'Alcampo', activa: false },
  { nombre: 'Consum', activa: false },
];

function Check({ oscuro = false }: { oscuro?: boolean }) {
  return <span className={`check${oscuro ? ' check--oscuro' : ''}`} aria-hidden="true">✓</span>;
}

export default function Landing() {
  return (
    <>
      <header className="nav">
        <div className="contenedor nav__interior">
          <a className="logo" href="/">cunde</a>
          <nav className="nav__enlaces" aria-label="Principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#supermercados">Supermercados</a>
            <a href="#precio">Precio</a>
            <a className="nav__descargar" href="#precio">
              <IconoApple tam={15} />
              Descargar
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="contenedor hero">
          <div className="hero__texto">
            <p className="pill">
              <span className="pill__punto" aria-hidden="true" />
              Precios reales de tu súper, hoy
            </p>
            <h1 className="hero__h1">
              Tú pones el tope.<br />Yo pongo el menú<br />y la lista.
            </h1>
            <p className="hero__sub">
              Dime cuánto quieres gastar y para cuántos sois. Cunde arma la semana de
              comidas y la lista de la compra que cabe en tu presupuesto — sin sorpresas
              en caja.
            </p>
            <div className="hero__botones">
              <BotonesStore />
            </div>
            <p className="hero__nota">Gratis para iPhone y Android · sin registro, sin tarjeta.</p>
          </div>

          <div className="hero__mockup">
            <div className="solo-ancho"><MockupTelefono /></div>
            <div className="solo-estrecho"><MockupTelefono compacto /></div>
          </div>
        </section>

        <section className="franja" id="supermercados">
          <div className="contenedor franja__interior">
            <span className="franja__rotulo">Con precios de</span>
            <div className="franja__cadenas">
              {CADENAS.map((c) => (
                <span key={c.nombre} className={c.activa ? '' : 'franja__cadena--pendiente'}>
                  {c.nombre}
                </span>
              ))}
            </div>
            <span className="franja__nota">Mercadona ya · el resto, en camino</span>
          </div>
        </section>

        <section id="como-funciona">
          <div className="contenedor seccion__titulo">
            <p className="eyebrow">Cómo funciona</p>
            <h2 className="h2">Tres pasos y a comer</h2>
          </div>
          <div className="contenedor pasos">
            {PASOS.map((p) => (
              <article className="paso" key={p.n}>
                <div className="paso__numero">{p.n}</div>
                <h3 className="paso__titulo">{p.titulo}</h3>
                <p className="paso__texto">{p.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="oscura">
          <div className="contenedor oscura__interior">
            <div>
              <p className="eyebrow eyebrow--claro">Tú decides</p>
              <h2 className="h2 h2--claro">Ajusta la semana<br />sin salirte del tope</h2>
              <p className="oscura__texto">
                Más variedad, más proteína, postre a diario. Cambia lo que quieras y mira
                cómo se mueve la cesta en tiempo real, siempre dentro de lo que dijiste.
              </p>
              <ul className="checks checks--claro">
                <li><Check />Precio por plato y por ración, siempre visible</li>
                <li><Check />Alergias y lo que no te gusta, fuera del menú</li>
                <li><Check />Repite platos o vive sin repetir, tú eliges</li>
              </ul>
            </div>
            <PanelAjustar />
          </div>
        </section>

        <section className="contenedor cambiar">
          <TarjetaPlato />
          <div>
            <p className="eyebrow">Todo cambiable</p>
            <h2 className="h2">¿No te convence<br />un plato? Cámbialo</h2>
            <p className="cambiar__texto">
              Toca cualquier comida y elige otra. Cunde te dice al momento cuánto sube o
              baja por ración, te propone algo más barato o simplemente marca «no cocino»
              ese día.
            </p>
            <ul className="checks">
              <li><Check oscuro />Alternativas con su diferencia de precio real</li>
              <li><Check oscuro />Aprende lo que te gusta y lo que no cocinas</li>
              <li><Check oscuro />Receta paso a paso cuando toca cocinar</li>
            </ul>
          </div>
        </section>

        {/* El CTA final es claro en escritorio y oscuro en móvil: lo pide el
            handoff, y en una pantalla larga de scroll el bloque oscuro sirve de
            cierre donde el escritorio ya tiene el footer. */}
        <section className="cta" id="precio">
          <div className="contenedor cta__interior">
            <h2 className="cta__h2">
              Come rico toda la semana<br />por lo que tú decidas
            </h2>
            <div className="cta__botones">
              <div className="solo-ancho"><BotonesStore tam="grande" /></div>
              <div className="solo-estrecho"><BotonesStore claro ancho /></div>
            </div>
            <p className="cta__nota">Gratis para iPhone y Android · sin registro, sin tarjeta.</p>
          </div>
        </section>
      </main>

      <footer className="pie">
        <div className="contenedor pie__interior">
          <span className="logo logo--pie">cunde</span>
          <div className="pie__enlaces">
            <a href="/privacidad.html">Privacidad</a>
            <a href="/privacidad.html">Términos</a>
            <a href="mailto:hola@cunde.app">Contacto</a>
          </div>
          <span className="pie__copy">© 2026 Cunde</span>
        </div>
      </footer>
    </>
  );
}
