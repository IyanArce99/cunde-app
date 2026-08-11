import './Privacidad.css';

/**
 * POLÍTICA DE PRIVACIDAD.
 *
 * El texto es el del handoff, palabra por palabra: es copy final y jurídico, no
 * material de relleno, así que no se reescribe «para que suene mejor».
 *
 * ═══ ESTE TEXTO CADUCA ═══
 *
 * Dice que los datos «se almacenan localmente en tu teléfono» y que la analítica
 * es «agregada y anónima». Hay una implementación de analítica hacia Supabase en
 * marcha: en cuanto exista, el apartado 7 tiene que decir exactamente qué se
 * envía —identificador de instalación anónimo, sin nombre, sin email, sin
 * alergias concretas, sin texto libre— o esta página pasará a ser falsa.
 *
 * El aviso del final ya dice que es una plantilla y hay que revisarla con un
 * profesional. No lo quites.
 */

const DATOS = [
  {
    titulo: 'Presupuesto y número de comensales',
    texto: 'El tope semanal y para cuántas personas cocinas.',
  },
  {
    titulo: 'Código postal (opcional)',
    texto: 'Solo para cargar el catálogo de precios de tu zona. Si no lo indicas, usamos uno por defecto.',
  },
  {
    titulo: 'Alergias, dietas y preferencias',
    texto: 'Lo que no puedes o no quieres comer, para dejarlo fuera del menú. Puede incluir datos de salud (alergias); los tratas tú, se quedan en tu dispositivo y nunca se asocian a tu identidad.',
  },
  {
    titulo: 'Valoraciones de platos',
    texto: 'Si marcas «me gusta», «no cocino», etc., para afinar tus próximas semanas.',
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
        <p className="legal__fecha">Última actualización: 11 de agosto de 2026</p>

        <p className="legal__entrada">
          En Cunde creemos que planificar tus comidas no debería costarte tus datos. Esta
          política explica, sin letra pequeña, qué información tratamos, para qué y qué
          control tienes sobre ella. La idea de fondo es simple:{' '}
          <strong>cuanto menos sepamos de ti, mejor</strong>.
        </p>

        <h2>1. Quién es el responsable</h2>
        <p>
          El responsable del tratamiento es <strong>Cunde</strong> (en adelante, «la app»,
          «nosotros»). Para cualquier cuestión sobre privacidad puedes escribirnos a{' '}
          <a href="mailto:hola@cunde.app">hola@cunde.app</a>.
        </p>

        <h2>2. Sin registro, sin cuenta</h2>
        <p>
          Cunde funciona sin que crees una cuenta, sin correo y sin tarjeta. No te pedimos
          nombre, teléfono ni datos de pago para usar la app. No podemos identificarte
          personalmente, porque no recogemos nada que lo permita.
        </p>

        <h2>3. Qué datos tratamos</h2>
        <p>Para armar tu semana, la app guarda en tu propio dispositivo tus preferencias:</p>
        <dl className="legal__lista">
          {DATOS.map((d) => (
            <div className="legal__dato" key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd>{d.texto}</dd>
            </div>
          ))}
        </dl>
        <p>
          Estos datos se almacenan <strong>localmente en tu teléfono</strong>. No se suben a
          nuestros servidores salvo que actives una copia de seguridad, en cuyo caso te lo
          pediremos de forma expresa.
        </p>

        <h2>4. Para qué los usamos</h2>
        <p>
          Usamos tus preferencias únicamente para generar tu menú semanal y tu lista de la
          compra ajustados a tu presupuesto, y para mejorar las recomendaciones dentro de la
          app. <strong>No vendemos ni cedemos tus datos</strong> a terceros, ni los usamos
          para publicidad.
        </p>

        <h2>5. Base legal</h2>
        <p>
          Tratamos tus preferencias sobre la base de la <strong>ejecución del servicio</strong>{' '}
          que nos pides (armar tu semana) y de tu <strong>consentimiento</strong>, que otorgas
          al introducir esos datos y puedes retirar en cualquier momento borrándolos desde los
          ajustes de la app.
        </p>

        <h2>6. Precios de los supermercados</h2>
        <p>
          Los precios que ves proceden de catálogos públicos de cada supermercado.
          Consultarlos no implica compartir ningún dato tuyo con esas cadenas: Cunde no se
          comunica con tu cuenta del súper ni realiza pedidos en tu nombre.
        </p>

        <h2>7. Analítica</h2>
        <p>
          Podemos usar analítica agregada y anónima (por ejemplo, cuántas personas abren la
          pantalla de compra) para mejorar la app. Estas métricas no permiten identificarte y
          no se combinan con tus preferencias. Si usamos un proveedor externo para ello, se
          limita a datos anonimizados.
        </p>

        <h2>8. Tus derechos</h2>
        <p>
          Como los datos viven en tu dispositivo, tienes el control directo: puedes
          consultarlos, modificarlos o borrarlos por completo desde los ajustes de la app en
          cualquier momento. Además, conforme al RGPD, te asisten los derechos de{' '}
          <strong>acceso, rectificación, supresión, oposición, limitación y portabilidad</strong>.
          Para ejercerlos o presentar una reclamación ante la Agencia Española de Protección
          de Datos, escríbenos a <a href="mailto:hola@cunde.app">hola@cunde.app</a>.
        </p>

        <h2>9. Menores</h2>
        <p>
          Cunde está pensada para personas mayores de 14 años. No recogemos conscientemente
          datos de menores de esa edad.
        </p>

        <h2>10. Cambios en esta política</h2>
        <p>
          Si cambiamos algo relevante, actualizaremos esta página y la fecha de arriba, y te
          avisaremos dentro de la app cuando el cambio afecte a cómo tratamos tus datos.
        </p>

        <aside className="legal__contacto">
          <p className="legal__contacto-titulo">¿Dudas sobre tu privacidad?</p>
          <p>
            Escríbenos a <a href="mailto:hola@cunde.app">hola@cunde.app</a> y te respondemos.
          </p>
        </aside>

        <p className="legal__aviso">
          Este texto es una plantilla de partida y no constituye asesoramiento legal. Antes de
          publicar, revísalo con un profesional para adaptarlo a tu operativa real (proveedor
          de analítica, copias de seguridad, razón social y domicilio fiscal).
        </p>
      </main>
    </>
  );
}
