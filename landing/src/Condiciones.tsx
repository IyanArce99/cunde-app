import './Privacidad.css';

/**
 * CONDICIONES DE USO Y DE CONTRATACIÓN.
 *
 * Comparte hoja de estilos con la política de privacidad: son el mismo tipo de
 * página y duplicar el CSS garantizaría que se separaran a la tercera semana.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * Google no aprueba una app con compras integradas sin condiciones, y el pie de
 * la landing tenía un enlace «Términos» que llevaba a la política de privacidad
 * — o sea que el hueco estaba señalado desde el principio.
 *
 * ═══ LAS DOS CLÁUSULAS QUE NO SON RELLENO ═══
 *
 * 1. ALÉRGENOS (apartado 8). El filtro se apoya en datos raspados de una web con
 *    agujeros conocidos y documentados: 19 SKU sin lista de ingredientes,
 *    fabricantes que reformulan, referencias que el súper sustituye sin avisar.
 *    Este texto dice exactamente lo mismo que `AvisoAlergenos` enseña dentro de
 *    la app. Si algún día uno de los dos se suaviza, el otro lo desmiente.
 *
 * 2. PRECIOS (apartado 7). La app promete «el coste total antes de salir de
 *    casa» y esa promesa hay que sostenerla sin prometer exactitud al céntimo,
 *    porque el fresco de peso variable y las promociones no lo permiten.
 *
 * Ninguna de las dos se escribe para cubrirse: se escriben porque son verdad y
 * el usuario merece saberlas antes, no después.
 *
 * ═══ RENOVACIÓN AUTOMÁTICA ═══
 *
 * El apartado 5 la explica entera y en primer lugar, no escondida. Es la parte
 * que las apps que nos sirven de contraejemplo entierran, y es justo la que la
 * gente necesita entender antes de pagar.
 *
 * ═══ LO QUE NO PUEDO SABER YO ═══
 *
 * Va como [POR CONFIRMAR], a la vista a propósito. Y el aviso del final sigue
 * diciendo que hay que revisarlo con un profesional: no lo quites.
 */

/** Qué incluye Cunde+. Sale de `FuncionPlus` en `src/lib/premium.ts`. */
const QUE_INCLUYE = [
  {
    titulo: 'Cambios de plato sin límite',
    texto: 'Sin Cunde+ puedes cambiar dos platos por semana. Con Cunde+, los que quieras.',
  },
  {
    titulo: 'Nivel de proteína alta',
    texto: 'Rehace la semana con más proteína en cada comida sin salirse de tu presupuesto.',
  },
];

/** Lo que es gratis para siempre. Es un compromiso, no una promoción. */
const SIEMPRE_GRATIS = [
  {
    titulo: 'El menú, la lista y el precio previsto',
    texto: 'La promesa entera de Cunde. No depende de que pagues y no va a depender nunca.',
  },
  {
    titulo: 'Todos los filtros de alergia y de dieta',
    texto: 'Sin excepción y sin límite. Son seguridad alimentaria, no una función de pago.',
  },
  {
    titulo: '«Bájame el precio» y «no cocino este día»',
    texto: 'Sin límite. Rehacer tu semana cuando se te tuerce el martes es lo que la app hace.',
  },
];

export default function Condiciones() {
  return (
    <>
      <header className="legal__nav">
        <div className="legal__nav-interior">
          <a className="logo" href="/">cunde</a>
          <a className="legal__volver" href="/">← Volver</a>
        </div>
      </header>

      <main className="legal">
        <p className="eyebrow">Legal</p>
        <h1 className="legal__h1">Condiciones de uso</h1>
        <p className="legal__fecha">Última actualización: 12 de agosto de 2026</p>

        <p className="legal__entrada">
          Esto explica qué es Cunde, qué te damos, qué cuesta y qué pasa si algo sale mal.
          Está escrito para leerse, no para no leerse. Si algo no se entiende,{' '}
          <a href="mailto:hola@cunde.app">escríbenos</a> y lo aclaramos — y si hay que
          reescribirlo, se reescribe.
        </p>

        <h2>1. Quién te presta el servicio</h2>
        <p>
          Cunde es un servicio de <strong>[POR CONFIRMAR: razón social, NIF y domicilio]</strong>.
          Puedes contactarnos en <a href="mailto:hola@cunde.app">hola@cunde.app</a>.
        </p>

        <h2>2. Qué es Cunde y qué no es</h2>
        <p>
          Cunde te organiza la compra semanal del supermercado con un presupuesto cerrado:
          le dices para cuántos cocinas y cuánto quieres gastar, y te devuelve un menú, la
          lista de la compra con productos concretos y el coste previsto.
        </p>
        <p>
          <strong>Cunde no vende comida ni hace pedidos.</strong> No tenemos relación con
          los supermercados, no somos sus representantes y no compramos nada en tu nombre.
          Tú vas al súper y compras tú.
        </p>
        <p>
          <strong>Cunde no da consejo médico ni nutricional.</strong> Los menús buscan
          cuadrar con tu presupuesto, no tratar ninguna condición de salud. Si tienes una
          patología, un embarazo o sigues una pauta médica, consúltalo con un profesional.
        </p>

        <h2>3. Usar Cunde</h2>
        <p>
          Puedes usar Cunde sin crear una cuenta ni darnos tu correo. Necesitas tener{' '}
          <strong>14 años o más</strong>. Te pedimos lo obvio: no intentar romper el
          servicio, no acceder a él por medios automatizados y no revender ni redistribuir
          su contenido.
        </p>

        <h2>4. Cunde+ y qué cuesta</h2>
        <p>
          Cunde es gratis. <strong>Cunde+</strong> es una suscripción opcional que
          desbloquea personalización:
        </p>
        <dl className="legal__lista">
          {QUE_INCLUYE.map((d) => (
            <div className="legal__dato" key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd>{d.texto}</dd>
            </div>
          ))}
        </dl>
        <p>
          Hay tres formas de pagarlo —<strong>1,49 € a la semana</strong>,{' '}
          <strong>3,99 € al mes</strong> o <strong>29,99 € una sola vez</strong>— y{' '}
          <strong>las tres dan exactamente lo mismo</strong>. Lo único que cambia es cuánto
          dura y cómo se paga. Los precios incluyen los impuestos aplicables y se muestran
          en la app con lo que suman en un año, para que puedas compararlos.
        </p>
        <p>Y esto es gratis para siempre, con o sin Cunde+:</p>
        <dl className="legal__lista">
          {SIEMPRE_GRATIS.map((d) => (
            <div className="legal__dato" key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd>{d.texto}</dd>
            </div>
          ))}
        </dl>

        <h2>5. Renovación automática y cómo cancelar</h2>
        <p>
          Lee esto antes de pagar. Los planes semanal y mensual{' '}
          <strong>se renuevan solos</strong> hasta que los canceles:
        </p>
        <dl className="legal__lista">
          <div className="legal__dato">
            <dt>Se cobra en tu cuenta de la tienda</dt>
            <dd>El cargo lo hace Google Play con el método de pago que tengas ahí. Nosotros no cobramos nada directamente.</dd>
          </div>
          <div className="legal__dato">
            <dt>Se renueva en las 24 horas antes de acabar el periodo</dt>
            <dd>Por el mismo precio y el mismo periodo, salvo que lo hayas cancelado antes.</dd>
          </div>
          <div className="legal__dato">
            <dt>Cancelas desde la tienda, no desde Cunde</dt>
            <dd>En Google Play → Pagos y suscripciones. Hazlo al menos 24 horas antes de que acabe el periodo para que no se renueve.</dd>
          </div>
          <div className="legal__dato">
            <dt>Cancelar no te corta a mitad</dt>
            <dd>Mantienes Cunde+ hasta que se acabe el periodo que ya has pagado. No devolvemos la parte proporcional de un periodo empezado.</dd>
          </div>
          <div className="legal__dato">
            <dt>El plan de 29,99 € no se renueva nunca</dt>
            <dd>Es un pago único. No hay nada que cancelar.</dd>
          </div>
        </dl>
        <p>
          <strong>No hay prueba gratuita con cargo automático</strong>, ni periodo de prueba
          que se convierta en suscripción sin que lo pidas. Si cancelas, no pierdes nada de
          lo que tengas guardado: tu despensa, tu historial y tus preferencias siguen en tu
          teléfono, y vuelven enteros si algún día vuelves.
        </p>
        <p>
          Si alguna vez subimos el precio, te lo diremos con antelación y podrás cancelar
          antes de que se aplique. Una subida nunca se cobra en silencio.
        </p>

        <h2>6. Derecho de desistimiento y devoluciones</h2>
        <p>
          Como consumidor tienes <strong>14 días naturales</strong> para desistir de la
          compra sin dar explicaciones. Hay una excepción legal que te afecta aquí: si
          empiezas a usar Cunde+ inmediatamente después de comprarlo, aceptas que la
          prestación comience durante ese plazo y{' '}
          <strong>pierdes el derecho de desistimiento</strong> una vez ejecutada
          (art. 103 del texto refundido de la Ley General para la Defensa de los
          Consumidores y Usuarios).
        </p>
        <p>
          En la práctica, <strong>los reembolsos los gestiona Google Play</strong>, que es
          quien procesa el cobro, y su política suele ser más generosa que el mínimo legal.
          Empieza por ahí. Si tienes un problema que Google no te resuelve,{' '}
          <a href="mailto:hola@cunde.app">escríbenos</a>: si Cunde+ no te ha dado lo que
          promete, no vamos a discutirte un reembolso.
        </p>

        <h2>7. Los precios del supermercado son una previsión, no una factura</h2>
        <p>
          Los precios que ves salen de los catálogos públicos del supermercado y se
          actualizan a diario. Son buenos, y son lo que hace útil a Cunde. Pero{' '}
          <strong>lo que pagues en caja puede no coincidir al céntimo</strong>, y conviene
          que sepas por qué:
        </p>
        <dl className="legal__lista">
          <div className="legal__dato">
            <dt>El fresco se vende al peso</dt>
            <dd>La merluza o el solomillo que te corten no pesarán exactamente lo que la app supone.</dd>
          </div>
          <div className="legal__dato">
            <dt>Hay promociones y precios por tienda</dt>
            <dd>Las ofertas y algunos frescos varían entre almacenes de la misma cadena.</dd>
          </div>
          <div className="legal__dato">
            <dt>Puede faltar un producto</dt>
            <dd>Si no hay stock y coges otro, el total cambia.</dd>
          </div>
        </dl>
        <p>
          Por eso Cunde te deja apuntar lo que has pagado de verdad al cerrar la semana: la
          diferencia es información útil, no un fallo.
        </p>

        <h2>8. Alergias e intolerancias: léelo entero</h2>
        <p>
          Cunde deja fuera del menú los platos que contienen los alérgenos que marques, y
          ese filtro es gratis y lo será siempre. Pero{' '}
          <strong>no es una garantía de seguridad y no debes usarlo como tal</strong>. Te
          decimos exactamente por qué, porque tienes derecho a saberlo:
        </p>
        <dl className="legal__lista">
          <div className="legal__dato">
            <dt>Los datos vienen del catálogo del supermercado</dt>
            <dd>Hay productos frescos a granel sin lista de ingredientes publicada, que solo podemos cubrir por el nombre del producto.</dd>
          </div>
          <div className="legal__dato">
            <dt>Los fabricantes reformulan</dt>
            <dd>Un producto puede cambiar de ingredientes sin que el catálogo lo refleje ese mismo día.</dd>
          </div>
          <div className="legal__dato">
            <dt>El supermercado sustituye referencias</dt>
            <dd>A veces cambia el producto detrás del mismo nombre, sin avisar.</dd>
          </div>
          <div className="legal__dato">
            <dt>No controlamos las trazas ni tu cocina</dt>
            <dd>La contaminación cruzada en fábrica o al cocinar queda fuera de lo que Cunde puede saber.</dd>
          </div>
        </dl>
        <p>
          <strong>
            Comprueba siempre la etiqueta del producto antes de comprarlo y antes de
            cocinarlo.
          </strong>{' '}
          Es lo que la app te dice dentro, en la pantalla de la compra y al abrir cada
          plato, y lo repetimos aquí porque importa. Si tienes una alergia grave, trata
          Cunde como una ayuda para descartar, nunca como la comprobación final.
        </p>

        <h2>9. Contenido y propiedad intelectual</h2>
        <p>
          Las recetas, los textos, el diseño y el software son nuestros o los usamos con
          licencia. Puedes usarlos para lo que la app sirve: cocinar y comprar. No puedes
          copiarlos para publicarlos en otro sitio, ni extraer el catálogo de forma
          sistemática, ni construir un producto derivado con ellos.
        </p>
        <p>
          Las marcas de los supermercados y de los productos pertenecen a sus titulares. Las
          nombramos para identificar dónde comprar y qué comprar, sin sugerir ninguna
          relación, patrocinio ni aprobación por su parte.
        </p>

        <h2>10. Disponibilidad y cambios</h2>
        <p>
          Hacemos lo posible por que Cunde funcione siempre, pero no podemos garantizar que
          esté disponible sin interrupciones: depende de tu conexión, de tu dispositivo y de
          servicios de terceros. La pantalla de la compra está pensada para funcionar sin
          cobertura precisamente por esto.
        </p>
        <p>
          Podemos cambiar o retirar funciones. Si un cambio afecta a lo que has pagado, te
          avisaremos y podrás cancelar. Si dejáramos de prestar el servicio, avisaremos con
          antelación razonable y devolveremos la parte no disfrutada de los planes en vigor.
        </p>

        <h2>11. Responsabilidad</h2>
        <p>
          Respondemos de los daños que te causemos por incumplir estas condiciones, en los
          términos que marca la ley.{' '}
          <strong>
            No limitamos nuestra responsabilidad por dolo, negligencia grave, ni por daños a
            la vida, la integridad física o la salud
          </strong>
          , ni ninguna otra que la normativa de consumo no permita excluir.
        </p>
        <p>
          Fuera de eso, no respondemos de decisiones de compra que tomes basándote en las
          previsiones de precio, ni de diferencias con lo que finalmente pagues en caja, ni
          de que un producto no esté disponible en tu tienda.
        </p>

        <h2>12. Ley aplicable y reclamaciones</h2>
        <p>
          Estas condiciones se rigen por la <strong>ley española</strong>. Como consumidor,
          conservas la protección de las normas imperativas del país donde residas y{' '}
          <strong>puedes reclamar ante los tribunales de tu domicilio</strong>.
        </p>
        <p>
          Antes de eso, escríbenos a <a href="mailto:hola@cunde.app">hola@cunde.app</a>:
          contestamos. También puedes acudir a las{' '}
          <strong>Juntas Arbitrales de Consumo</strong> o a la oficina de consumo de tu
          comunidad autónoma.
        </p>

        <h2>13. Cambios en estas condiciones</h2>
        <p>
          Si las cambiamos, actualizaremos la fecha de arriba y te avisaremos dentro de la
          app cuando el cambio sea relevante. Si el cambio afecta a una suscripción que
          tengas en marcha, podrás cancelar antes de que se aplique.
        </p>

        <aside className="legal__contacto">
          <p className="legal__contacto-titulo">¿Algo no cuadra?</p>
          <p>
            Escríbenos a <a href="mailto:hola@cunde.app">hola@cunde.app</a>. Y si buscas qué
            hacemos con tus datos, está en la{' '}
            <a href="/privacidad.html">política de privacidad</a>.
          </p>
        </aside>

        <p className="legal__aviso">
          Este texto es una plantilla de partida y no constituye asesoramiento legal. Antes
          de publicar hay que rellenar lo marcado como [POR CONFIRMAR] —razón social, NIF y
          domicilio— y revisarlo con un profesional, en especial los apartados 6
          (desistimiento), 8 (alérgenos) y 11 (responsabilidad).
        </p>
      </main>
    </>
  );
}
