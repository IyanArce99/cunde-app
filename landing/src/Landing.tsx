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
    /* Decía «14 comidas EQUILIBRADAS». Fuera: «equilibrado» en comida se lee
       como una afirmación nutricional, y el motor no la sostiene — fija un
       suelo de proteína y nada más. Los macros detallados están en la lista de
       lo que este producto NO construye (CLAUDE.md). */
    texto: '14 comidas que caben en tu presupuesto, con el precio de cada plato.',
  },
  {
    n: 3,
    titulo: 'Compra sin sorpresas',
    /**
     * Decía «Lo que ves es lo que pagas en caja». Es la frase más peligrosa de
     * la página: la app entera tiene una pantalla —CierreDeSemana— construida
     * sobre que el ticket real NO coincide con lo previsto, y la analítica
     * guarda un `difference_bucket` justamente porque no coincide.
     *
     * Prometerlo aquí es montar la decepción que el producto está diseñado para
     * absorber. Lo que sí se puede prometer, y es la frase que define a Cunde,
     * es saber la cifra ANTES de salir de casa.
     */
    texto: 'La lista sale ordenada por pasillo, y sabes lo que vas a pagar antes de salir de casa.',
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
            <a className="nav__descargar" href="#descargar">
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
            {/* Los espacios explícitos son obligatorios: en móvil el `<br>` se
                oculta, y sin ellos el titular se lee «tope.Yo pongo el menúy la
                lista». Visto en la primera captura a 390 px. */}
            <h1 className="hero__h1">
              Tú pones el tope.{' '}<br />
              Yo pongo el menú{' '}<br />
              y la lista.
            </h1>
            {/* Decía «Cunde arma la semana…». En el titular la app habla en
                primera persona —«Yo pongo el menú»— y dos líneas después se
                nombraba a sí misma en tercera. Es la regla de la casa: una voz
                se conserva en todo el recorrido. */}
            <p className="hero__sub">
              Dime cuánto quieres gastar y para cuántos sois. Te armo la semana entera y
              la lista de la compra que cabe en tu presupuesto, con precios de tu súper.
            </p>
            <div className="hero__botones">
              <BotonesStore />
            </div>
            <p className="hero__nota">Gratis para empezar · sin registro y sin tarjeta.</p>
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
            {/* Decía «el resto, en camino». No es cierto: solo Mercadona tiene
                catálogo raspado, y Carrefour vía Awin es el plan de continuidad
                si el scraping deja de ser viable, no una hoja de ruta. En una
                app cuyo argumento es que sus datos no mienten, la landing no
                puede abrir prometiendo cinco supermercados que no hay. */}
            <span className="franja__nota">Hoy, precios de Mercadona</span>
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
              <h2 className="h2 h2--claro">Ajusta la semana{' '}<br />sin salirte del tope</h2>
              <p className="oscura__texto">
                Más variedad, más proteína, postre a diario. Cambia lo que quieras y mira
                cómo se mueve la cesta en tiempo real, siempre dentro de lo que dijiste.
              </p>
              <ul className="checks checks--claro">
                <li><Check />Precio por plato y por ración, siempre visible</li>
                <li><Check />Alergias y lo que no te gusta, fuera del menú</li>
                <li><Check />Repite platos o no repitas ninguno, tú eliges</li>
              </ul>
            </div>
            <PanelAjustar />
          </div>
        </section>

        <section className="contenedor cambiar">
          <TarjetaPlato />
          <div>
            <p className="eyebrow">Todo cambiable</p>
            <h2 className="h2">¿No te convence{' '}<br />un plato? Cámbialo</h2>
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

        {/**
          * ═══ EL PRECIO, DICHO ═══
          *
          * Esta sección no está en el handoff, y se añade porque sin ella la
          * página miente por omisión:
          *
          *   · La nav tiene un enlace que dice «Precio» y apuntaba al CTA
          *     final, donde no se habla de dinero.
          *   · La página dice «Gratis» dos veces.
          *   · Y la app cobra 29,99 € al año a partir de la segunda semana.
          *
          * Un usuario que descarga leyendo «gratis, sin tarjeta» y se encuentra
          * un muro de pago la semana siguiente es exactamente el recorrido que
          * este proyecto tiene escrito como inaceptable: «hay una app
          * compitiendo en España con suscripción semanal de 9,99 € y prueba
          * trampa de 3 días… nuestro posicionamiento es ser lo contrario».
          *
          * El texto es el del muro de la propia app, que ya lo dice bien: lo de
          * esta semana es gratis para siempre; se paga que la app se acuerde.
          *
          * OJO: los importes están escritos a mano aquí y la verdad vive en
          * `src/lib/suscripcion.ts` (`PRECIOS`). Son dos proyectos de Vite
          * distintos y no comparten módulos. Si se cambia el precio, hay que
          * cambiarlo en los dos sitios.
          */}
        <section className="precio" id="precio">
          <div className="contenedor precio__interior">
            <p className="eyebrow">Precio</p>
            <h2 className="h2">La primera semana es gratis.<br /> Para siempre.</h2>
            <p className="precio__texto">
              El menú, los precios reales y la lista de la compra no se pagan nunca. Lo
              que se paga es que la app se acuerde: la despensa que se te va acumulando,
              no repetirte platos en tres semanas y la cuenta de lo que llevas ahorrado.
            </p>

            <div className="precio__planes">
              {/* Los tres al mismo peso y ninguno marcado como «el recomendado»:
                  tres precios con uno destacado en medio es el patrón del
                  señuelo, y este proyecto se posiciona justo en contra. En orden
                  de compromiso creciente: semana, mes, siempre.

                  Y cada uno dice lo que suma AL AÑO. Sin esa línea, 1,49 parece
                  tres veces más barato que 3,99 cuando en realidad es un 62%
                  más caro — que es el truco de la app que cobra 9,99 a la
                  semana, con otra cifra. */}
              <div className="precio__plan">
                <span className="precio__cifra cifra">1,49 €</span>
                <span className="precio__periodo">a la semana</span>
                <span className="precio__unidad">77,48 € al año</span>
              </div>
              <div className="precio__plan">
                <span className="precio__cifra cifra">3,99 €</span>
                <span className="precio__periodo">al mes</span>
                <span className="precio__unidad">47,88 € al año</span>
              </div>
              <div className="precio__plan">
                <span className="precio__cifra cifra">29,99 €</span>
                <span className="precio__periodo">una vez</span>
                <span className="precio__unidad">y ya está</span>
              </div>
            </div>

            <p className="precio__letra-pequena">
              Sin prueba con cargo automático. Sin tarjeta para empezar. Los planes de
              semana y mes se cancelan cuando quieras; el de una vez no se renueva nunca.
              Pase lo que pase, sigues teniendo tu semana.
            </p>
          </div>
        </section>

        {/* El CTA final es claro en escritorio y oscuro en móvil: lo pide el
            handoff, y en una pantalla larga de scroll el bloque oscuro sirve de
            cierre donde el escritorio ya tiene el footer. */}
        <section className="cta" id="descargar">
          <div className="contenedor cta__interior">
            <h2 className="cta__h2">
              Come rico toda la semana{' '}<br />por lo que tú decidas
            </h2>
            <div className="cta__botones">
              <div className="solo-ancho"><BotonesStore tam="grande" /></div>
              <div className="solo-estrecho"><BotonesStore claro ancho /></div>
            </div>
            <p className="cta__nota">Gratis para empezar · sin registro y sin tarjeta.</p>
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
