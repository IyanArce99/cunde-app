import './Privacidad.css';

/**
 * POLÍTICA DE PRIVACIDAD.
 *
 * ═══ POR QUÉ SE REESCRIBIÓ (12 ago 2026) ═══
 *
 * El aviso que había aquí decía: «hay una implementación de analítica hacia
 * Supabase en marcha: en cuanto exista, el apartado 7 tiene que decir exactamente
 * qué se envía o esta página pasará a ser falsa».
 *
 * Existió el 11 de agosto, y la página pasó a ser falsa en tres sitios:
 *
 *   · Decía que los datos «no se suben a nuestros servidores salvo que actives
 *     una copia de seguridad». Se suben eventos de analítica, sin activar nada.
 *   · Llamaba a la analítica «agregada y anónima». No es ninguna de las dos:
 *     son filas por evento con un `install_id` que persiste. Un identificador
 *     estable por instalación es dato personal seudonimizado en el RGPD, aunque
 *     no lleve nombre — lo que importa es que singulariza, no que identifique.
 *   · Declaraba el código postal, que dejó de pedirse. Declarar de más no es
 *     ilegal, pero delata que el texto no describe la app.
 *
 * Y faltaba entero lo de las compras.
 *
 * ═══ Y OTRA VEZ (14 oct 2026) ═══
 *
 * Volvió a desviarse del código en cuatro sitios: decía «nunca enviamos tu
 * ubicación» y `onboarding_completed` envía la provincia (dos cifras del código
 * postal); prometía ver el identificador de instalación y borrar los datos
 * «desde los ajustes de la app», y no hay ninguna de las dos pantallas; y
 * prometía avisar dentro de la app de los cambios, que tampoco existe. Además
 * faltaban el código postal (que se pide desde septiembre), el identificador de
 * sesión y la descarga de precios.
 *
 * ═══ LA REGLA PARA MANTENERLO ═══
 *
 * Esta página describe el código, no la intención. Si cambia lo que se envía —un
 * campo nuevo en `PropsAnalitica`, un encargado nuevo, otra base legal— se
 * cambia aquí en el mismo commit. La lista de `DATOS_ENVIADOS` sale una a una de
 * `lib/analitica.ts`; si dejan de coincidir, esta página vuelve a mentir.
 *
 * ═══ LO QUE FALTA Y NO PUEDO SABER YO ═══
 *
 * Va marcado en el texto con [POR CONFIRMAR]. Son datos de la operativa real
 * —razón social, región del servidor, plazo de conservación— que hay que rellenar
 * antes de publicar. Están a la vista a propósito: si se publica sin rellenar,
 * se ve. El aviso del final sigue diciendo que hay que revisarla con un
 * profesional. No lo quites.
 */

/** Lo que no sale del teléfono. Sale de `AppState`. */
const DATOS_LOCALES = [
  {
    titulo: 'Tu código postal',
    texto: 'Sirve para saber de qué zona son los precios (por ejemplo, Madrid o Gran Canaria). Se guarda en tu teléfono; de él solo sale la provincia, como se explica abajo.',
  },
  {
    titulo: 'Presupuesto y número de comensales',
    texto: 'El tope semanal y para cuántas personas cocinas.',
  },
  {
    titulo: 'Alergias, dietas y preferencias',
    texto: 'Lo que no puedes o no quieres comer, para dejarlo fuera del menú. Puede incluir datos de salud (alergias). Se quedan en tu dispositivo: nunca enviamos qué alergia tienes.',
  },
  {
    titulo: 'Tu menú, tu lista y tu despensa',
    texto: 'Los platos de la semana, los productos marcados y lo que te sobró. No se suben.',
  },
  {
    titulo: 'Valoraciones de platos',
    texto: 'Si marcas «me gusta» o «no quiero», para afinar tus próximas semanas.',
  },
];

/**
 * Lo que SÍ sale, una a una. Sacado de `PropsAnalitica` en `lib/analitica.ts`.
 * Si se añade un campo allí y no aquí, esta página miente.
 */
const DATOS_ENVIADOS = [
  {
    titulo: 'Un identificador de instalación y otro de sesión',
    texto: 'Números aleatorios: el de instalación se crea al instalar la app y el de sesión cada vez que la abres. No salen de tu correo, ni de tu nombre, ni del identificador publicitario, ni de una huella del dispositivo. Sirven para poder contar «cuántas personas vuelven la semana 4» sin saber quién eres. Si borras los datos de la app, desaparecen y vuelves a contar como instalación nueva.',
  },
  {
    titulo: 'Tu provincia',
    texto: 'Las dos primeras cifras de tu código postal (por ejemplo, «35» para Las Palmas), una sola vez, al terminar la configuración. Sirve para saber en qué zonas hay usuarios y cuáles merecen precios propios. El código postal completo no sale de tu teléfono.',
  },
  {
    titulo: 'Qué pantallas usas y cuándo',
    texto: 'Por ejemplo: que has generado una semana, que has abierto la lista de la compra, o que has cerrado la compra. Con la versión de la app y si es Android, iOS o web.',
  },
  {
    titulo: 'Tramos, nunca cifras exactas',
    texto: 'Para cuántas personas cocinas, cuántas comidas, y tu presupuesto en tramos (por ejemplo «entre 60 y 80 €»), nunca el importe exacto. Si cierras la compra, en qué tramo quedó la diferencia entre lo previsto y lo que pagaste (por ejemplo «entre un 2 y un 5 % más»), nunca lo que pagaste. Y cuántos productos marcaste de cuántos.',
  },
  {
    titulo: 'Si usas filtros de dieta, no cuáles',
    texto: 'Enviamos si tienes filtros activos y cuántos. Nunca cuáles. Que seas celíaco o alérgico al marisco no sale de tu teléfono.',
  },
  {
    titulo: 'Ajustes de la semana',
    texto: 'Nivel de variedad y de proteína, si llevas postre, si te has quedado dentro del presupuesto, y si tu lista tiene productos añadidos a mano sin precio (si los hay, no cuáles).',
  },
  {
    titulo: 'Cunde+',
    texto: 'Si ves la pantalla de Cunde+ o compras: qué plan elegiste y qué función te la mostró. Y en cada evento, si tienes Cunde+ o no.',
  },
];

/** Quién trata datos por nuestra cuenta, y para qué exactamente. */
const ENCARGADOS = [
  {
    titulo: 'Supabase — analítica y precios',
    texto: 'Guarda los eventos descritos arriba y sirve el fichero de precios de cada zona. No recibe tus preferencias, ni tu menú, ni tu lista. Servidores en [POR CONFIRMAR: región del proyecto].',
  },
  {
    titulo: 'RevenueCat — gestión de la suscripción',
    texto: 'Comprueba si tu compra de Cunde+ sigue activa. Cuando las compras están activadas en la app, se conecta al abrirla y recibe un identificador anónimo de comprador y, si compras, el producto y el país de tu tienda. En la versión de prueba (beta) las compras están desactivadas y RevenueCat no recibe nada. Empresa estadounidense: la transferencia se ampara en las cláusulas contractuales tipo de la Comisión Europea.',
  },
  {
    titulo: 'Google Play — el cobro',
    texto: 'Procesa el pago y es responsable independiente de los datos de tu método de pago, con su propia política. Cunde no ve tu tarjeta en ningún momento, ni sabe tu nombre ni tu dirección de facturación.',
  },
];

export default function Privacidad() {
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
        <h1 className="legal__h1">Política de privacidad</h1>
        <p className="legal__fecha">Última actualización: 14 de octubre de 2026</p>

        <p className="legal__entrada">
          En Cunde creemos que planificar tus comidas no debería costarte tus datos. Esta
          política explica, sin letra pequeña, qué información tratamos, para qué y qué
          control tienes sobre ella. La idea de fondo es simple:{' '}
          <strong>cuanto menos sepamos de ti, mejor</strong>.
        </p>

        <h2>1. Quién es el responsable</h2>
        <p>
          El responsable del tratamiento es <strong>[POR CONFIRMAR: razón social y
          domicilio]</strong> (en adelante, «Cunde», «la app», «nosotros»). Para cualquier
          cuestión sobre privacidad puedes escribirnos a{' '}
          <a href="mailto:hola@cunde.app">hola@cunde.app</a>.
        </p>

        <h2>2. Sin cuenta y sin correo</h2>
        <p>
          Cunde funciona sin que crees una cuenta y sin darnos tu correo. No te pedimos
          nombre ni teléfono, y no podemos identificarte personalmente porque no recogemos
          nada que lo permita.
        </p>
        <p>
          Si compras <strong>Cunde+</strong>, el pago lo procesa la tienda de tu móvil
          (Google Play). <strong>Nosotros no vemos ni guardamos tu tarjeta</strong>, ni tu
          nombre, ni tu dirección de facturación. Lo explicamos en el apartado 6.
        </p>

        <h2>3. Qué se queda en tu teléfono</h2>
        <p>
          Casi todo. Para armar tu semana, la app guarda en tu propio dispositivo:
        </p>
        <dl className="legal__lista">
          {DATOS_LOCALES.map((d) => (
            <div className="legal__dato" key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd>{d.texto}</dd>
            </div>
          ))}
        </dl>
        <p>
          Estos datos <strong>no se suben a ningún servidor</strong>. Viven en el
          almacenamiento local de la app y desaparecen si la desinstalas o borras sus datos.
        </p>

        <h2>4. Qué sí sale de tu teléfono</h2>
        <p>
          Para saber si la app le sirve a la gente, enviamos eventos de uso a nuestro
          servidor. Esto es exactamente lo que se envía, sin resumir:
        </p>
        <dl className="legal__lista">
          {DATOS_ENVIADOS.map((d) => (
            <div className="legal__dato" key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd>{d.texto}</dd>
            </div>
          ))}
        </dl>
        <p>
          <strong>Nunca enviamos</strong>: importes exactos, qué alergias o dietas tienes,
          los nombres de los productos que añades a mano, ningún texto que escribas, tu
          código postal completo ni tu ubicación precisa (solo la provincia), el
          identificador publicitario de tu móvil ni tu nombre o tu correo.
        </p>
        <p>
          Llamamos a estos datos <strong>seudonimizados</strong>, no anónimos, y la
          diferencia importa: no sabemos quién eres, pero el identificador de instalación
          permite distinguir tu móvil del de otra persona. Por eso los tratamos como datos
          personales y te damos todos los derechos del apartado 9, aunque no podamos
          ponerles un nombre.
        </p>

        <p>
          <strong>Los precios.</strong> Para tener los precios al día, la app pide a
          nuestro servidor el fichero de precios de tu zona. Esa petición no lleva
          ningún dato tuyo; solo dice la zona (por ejemplo «gran-canaria»).
        </p>
        <p>
          Como cualquier conexión a internet, el servidor ve la dirección IP desde la
          que llegan los eventos y la petición de precios. La tabla donde guardamos los
          eventos no guarda la IP; el proveedor del servidor puede registrarla en sus
          registros técnicos según su propia política.
        </p>

        <h2>5. Para qué usamos todo esto</h2>
        <p>
          Tus preferencias, solo para generar tu menú y tu lista ajustados a tu presupuesto.
          Los eventos de uso, solo para saber qué partes de la app funcionan y cuáles no.{' '}
          <strong>No vendemos ni cedemos tus datos</strong>, no hacemos publicidad, no
          hacemos perfiles con fines comerciales y no tomamos ninguna decisión automatizada
          que te afecte legalmente.
        </p>

        <h2>6. Compras: Cunde+</h2>
        <p>
          Cunde es gratis y su promesa entera —menú, lista, precios y total— seguirá siendo
          gratis. <strong>Cunde+</strong> es una suscripción opcional que desbloquea
          personalización.
        </p>
        <p>
          Cuando compras, el pago lo procesa <strong>Google Play</strong> con tu método de
          pago de la tienda. Cunde no interviene en el cobro y no recibe los datos de tu
          tarjeta. Para saber si tu suscripción sigue activa usamos{' '}
          <strong>RevenueCat</strong>, que recibe un identificador anónimo de comprador, qué
          producto compraste y el país de tu tienda. <strong>Ese identificador no se cruza
          con el de analítica</strong>: no podemos saber qué hizo en la app la persona que
          pagó.
        </p>
        <p>
          Para gestionar o cancelar tu suscripción, se hace desde la tienda de tu móvil, no
          desde Cunde. Cancelar no borra nada de lo que tienes guardado.
        </p>

        <h2>7. Base legal</h2>
        <p>
          Tratamos tus preferencias y tu compra sobre la base de la{' '}
          <strong>ejecución del contrato</strong>: son necesarias para darte el servicio que
          nos pides. Las <strong>alergias</strong>, que pueden ser datos de salud, se tratan
          sobre la base de tu <strong>consentimiento explícito</strong>, que das al
          introducirlas y retiras borrándolas — y que en la práctica nunca salen de tu
          dispositivo. Los <strong>eventos de uso</strong> se tratan por{' '}
          <strong>interés legítimo</strong> en mejorar la app, un interés que hemos ponderado
          frente a tu privacidad limitando los datos a tramos y booleanos; puedes oponerte
          escribiéndonos.
        </p>

        <h2>8. Con quién se comparte</h2>
        <p>Solo con quien hace falta para que la app funcione:</p>
        <dl className="legal__lista">
          {ENCARGADOS.map((d) => (
            <div className="legal__dato" key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd>{d.texto}</dd>
            </div>
          ))}
        </dl>
        <p>
          No hay ningún otro. Sin redes publicitarias, sin herramientas de marketing, sin
          SDK de terceros que recojan datos por su cuenta.
        </p>

        <h2>9. Cuánto tiempo guardamos las cosas</h2>
        <p>
          Lo que está en tu teléfono, mientras tengas la app instalada: lo borras tú cuando
          quieras. Los eventos de uso se conservan{' '}
          <strong>[POR CONFIRMAR: plazo, propuesta 24 meses]</strong> y después se eliminan.
          Los datos de tu suscripción, mientras esté activa y el tiempo que exijan las
          obligaciones fiscales y contables.
        </p>

        <h2>10. Precios de los supermercados</h2>
        <p>
          Los precios que ves proceden de catálogos públicos de cada supermercado.
          Consultarlos no implica compartir ningún dato tuyo con esas cadenas: Cunde no se
          comunica con tu cuenta del súper ni realiza pedidos en tu nombre.
        </p>

        <h2>11. Tus derechos</h2>
        <p>
          Sobre lo que vive en tu dispositivo tienes el control directo: puedes cambiarlo
          en la app y borrarlo por completo borrando los datos de Cunde desde los ajustes
          de tu teléfono o desinstalándola. Sobre lo demás te asisten, conforme al RGPD, los derechos de{' '}
          <strong>acceso, rectificación, supresión, oposición, limitación y portabilidad</strong>.
        </p>
        <p>
          Para ejercerlos escríbenos a <a href="mailto:hola@cunde.app">hola@cunde.app</a>.
          Ten en cuenta una limitación honesta: como no sabemos quién eres, no tenemos
          forma de encontrar tus eventos entre los de los demás. La app no te enseña hoy
          su identificador de instalación, así que no podemos localizarlos — no por
          negarnos, sino porque no hay nada que nos permita relacionarlos contigo. Si
          borras los datos de la app, los eventos que ya se enviaron quedan sin ninguna
          relación con tu teléfono. También puedes reclamar
          ante la <strong>Agencia Española de Protección de Datos</strong> (aepd.es).
        </p>

        <h2>12. Menores</h2>
        <p>
          Cunde está pensada para personas mayores de 14 años. No recogemos conscientemente
          datos de menores de esa edad.
        </p>

        <h2>13. Cambios en esta política</h2>
        <p>
          Si cambiamos algo relevante, actualizaremos esta página y la fecha de arriba.
        </p>

        <aside className="legal__contacto">
          <p className="legal__contacto-titulo">¿Dudas sobre tu privacidad?</p>
          <p>
            Escríbenos a <a href="mailto:hola@cunde.app">hola@cunde.app</a> y te respondemos.
            Si lo que buscas son las condiciones del servicio y de Cunde+, están en las{' '}
            <a href="/condiciones.html">condiciones de uso</a>.
          </p>
        </aside>

        <p className="legal__aviso">
          Este texto es una plantilla de partida y no constituye asesoramiento legal. Antes de
          publicar hay que rellenar lo marcado como [POR CONFIRMAR] —razón social y domicilio,
          región de los servidores y plazo de conservación— y revisarlo con un profesional
          para adaptarlo a la operativa real. La ficha de Seguridad de los datos de Google
          Play tiene que coincidir con lo que dice esta página.
        </p>
      </main>
    </>
  );
}
