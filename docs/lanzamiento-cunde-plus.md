# Encender Cunde+ · lo que hay que hacer fuera del código

> El código está terminado y probado. Nada de esto se puede hacer desde el
> repositorio: son paneles web y cuentas.
>
> Orden pensado para que nada te bloquee: los pasos 1-3 no dependen de nadie,
> el 4 espera aprobación de Google (24-48 h) y el 5 no se toca hasta tener
> usuarios en la semana 4.

---

## 0 · Antes de nada: dos credenciales que están quemadas

Las dos se pegaron en el chat, así que hay que darlas por públicas.

- [ ] **Rotar la contraseña de Postgres de Supabase.**
      Panel → Project Settings → Database → Reset database password.
      Después actualizar el secreto `SUPABASE_DB_URL` de GitHub (paso 2).
- [ ] **Revocar la clave de OpenAI.**
      platform.openai.com → API keys → la que empieza por `sk-proj-CXG06c01…`
      → Revoke. Crear otra si vas a seguir generando fotos.

**Nunca** metas la `service_role` ni la contraseña de Postgres en la app. En el
binario solo va la clave publicable (`anon`).

---

## 1 · RevenueCat

Cuenta gratis hasta 2.500 $/mes de ingresos. Después, 1%.

- [ ] Crear cuenta en `app.revenuecat.com` y un **proyecto** llamado `Cunde`.
- [ ] Añadir la app Android: **Project settings → Apps → + New → Play Store**.
      - Package name: el `appId` de `capacitor.config.ts`.
      - Hay que subir el **Service Account JSON** de Google Play. Cómo sacarlo
        está en el paso 3.
- [ ] Crear el **entitlement**. Este nombre tiene que ser exacto, el código lo
      busca literal:

      cunde_plus

      **Project settings → Entitlements → + New**.

- [ ] Crear los tres **productos**, con estos identificadores exactos:

      cunde_plus_weekly     suscripción, 1 semana
      cunde_plus_monthly    suscripción, 1 mes
      cunde_plus_lifetime   NO consumible  ← no es suscripción

      Si `cunde_plus_lifetime` se da de alta como suscripción, RevenueCat pensará
      que caduca y a quien pagó 29,99 € se le retirará el acceso.

- [ ] **Asociar los tres productos al entitlement `cunde_plus`.** Los tres. Si
      falta uno, quien lo compre pagará y no se le activará nada.
- [ ] Crear un **offering** llamado exactamente:

      default

      y marcarlo como **Current**. Con tres paquetes, uno por producto.

- [ ] Copiar la **Public SDK key de Android** (empieza por `goog_`).
      Está en **Project settings → API keys**. Es la pública, no la secreta.

---

## 2 · Secretos

### En tu máquina — fichero `.env.local` en la raíz

No se sube a git (está en `.gitignore`). Si no existe, créalo:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_REVENUECAT_ANDROID_KEY=goog_...
```

- [ ] Añadida la línea `VITE_REVENUECAT_ANDROID_KEY`.

Solo llegan al binario las que empiezan por `VITE_`, y llegan **en tiempo de
compilación**: si cambias el fichero hay que volver a compilar.

Sin esa clave la app no se rompe — arranca sin compras y todo el mundo se queda
en el plan gratuito, con un aviso en la consola.

### En GitHub — Settings → Secrets and variables → Actions

- [ ] `SUPABASE_DB_URL` con la contraseña **nueva** del paso 0.
      Esto es lo que hace fallar el cron de precios ahora mismo.

---

## 3 · Google Play Console

Cuota de alta: 25 $ una vez.

- [ ] Cuenta de desarrollador creada y verificada. **La verificación de
      identidad puede tardar días** — empieza por aquí si aún no la tienes.
- [ ] App creada en Play Console con el mismo package name.
- [ ] Subida una compilación a **Testing interno**. Sin una compilación subida,
      Play Console **no deja crear productos de pago**. No hace falta que esté
      publicada, solo subida.
- [ ] **Monetización → Perfil de pagos** completo. Sin esto no se puede cobrar.

### Los tres productos

**Monetización → Productos**. Ojo a las dos secciones distintas:

- [ ] **Suscripciones** → crear dos:

      cunde_plus_weekly    1,49 €   periodo: 1 semana
      cunde_plus_monthly   3,99 €   periodo: 1 mes

      **Sin prueba gratuita.** Ni de tres días ni de ninguno. Es una regla del
      proyecto: la app contra la que nos posicionamos usa exactamente eso.

- [ ] **Productos en la aplicación** (otra sección) → crear uno:

      cunde_plus_lifetime  29,99 €

      Este NO va en Suscripciones.

- [ ] Los tres **activados**, no en borrador.

### El puente con RevenueCat

- [ ] En Google Cloud Console, crear una **cuenta de servicio** y descargar su
      JSON. Darle el rol de Play Console con permiso de **ver datos financieros**
      y **gestionar pedidos**.
- [ ] Subir ese JSON a RevenueCat (paso 1).
- [ ] En Play Console → **Monetización → Configuración de monetización**, pegar
      la **URL de notificaciones en tiempo real** que da RevenueCat.
      Sin esto, RevenueCat no se entera de las cancelaciones ni de las
      renovaciones fallidas.

---

## 4 · Probarlo de verdad antes de cobrar a nadie

- [ ] Tu cuenta de Google añadida en **Play Console → Configuración → Pruebas de
      licencia**. Así compras sin que se te cobre.
- [ ] Compilar con la clave puesta:

      npm run build:release
      npx cap sync android

- [ ] Instalada desde **Testing interno**, no por `adb install`. Las compras no
      funcionan en una compilación instalada a mano.
- [ ] **Comprado el semanal.** Cunde+ se activa.
- [ ] **Comprado el mensual.** Igual.
- [ ] **Comprado el de por vida.** Igual, y **no caduca**.
- [ ] **Cancelado a medias** en el diálogo de Google: la app no enseña ningún
      error. Cancelar no es fallar.
- [ ] **Desinstalada y reinstalada** → «Restaurar compras» devuelve Cunde+.
- [ ] **Restaurar con una cuenta que nunca compró** → dice que no había nada, no
      finge éxito.
- [ ] **En avión, con Cunde+ comprado** → sigue teniéndolo. Es el caso del
      sótano del súper.
- [ ] Los precios del muro son los de la tienda, con el «€» donde toca.

---

## 5 · Encender el muro

**No hagas esto todavía.** Primero:

- [ ] Hay usuarios que han llegado a la **semana 4**. Se ve en la vista
      `analytics_funnel` de Supabase. Es la métrica que decide si esto es un
      negocio, y no se puede poner precio a algo que nadie ha usado una semana
      entera.
- [ ] Borradas las filas de prueba de la analítica:

      delete from analytics_events where created_at < '2026-08-12';

Cuando eso esté, es **una línea** en `src/lib/suscripcion.ts`:

```ts
export const MURO_ACTIVO = true;
```

Y volver a compilar. Nada más: no hay más sitios donde tocar.

---

## Decisiones tuyas que no son técnicas

- [ ] **¿Proteína Alta detrás del muro?** Está implementado así porque lo
      pediste, pero es la decisión más discutible del conjunto y el argumento en
      contra sigue escrito en el código. Está razonado en
      [`docs/monetizacion.md`](monetizacion.md#2--proteína-alta). Quitarlo es
      borrar un valor de un enum.
- [ ] **¿Dos límites a la vez sobre la misma acción?** Un usuario sin Cunde+ ve
      una alternativa por hueco **y** solo puede aplicar dos en toda la semana.
      Puede que sea demasiado. Si hay que aflojar, aflojar uno de los dos, no
      los dos.
- [ ] **Abogado de PI antes de lanzar en público.** El `robots.txt` de Mercadona
      bloquea `/api`. No hace el scraping ilegal por sí solo, pero debilita el
      argumento de «son datos públicos». Esto no es nuevo, pero cobrar dinero
      cambia la conversación.
- [ ] **Condiciones y política de privacidad** enlazadas desde el muro. Google
      lo exige para aprobar una app con compras. La privacidad ya está escrita
      (`landing/privacidad.html`); faltan las condiciones.

---

## Lo que NO tienes que hacer

- **App Store / iOS.** Necesita macOS y aquí solo hay Windows. Cuando llegue el
  momento: los mismos identificadores de producto, y en RevenueCat solo hay que
  añadir la app de iOS al mismo proyecto y asociar los productos al mismo
  entitlement. El código no cambia.
- **Un servidor para validar recibos.** Lo hace RevenueCat.
- **Tocar nada en Supabase para las compras.** No pasan por ahí. Supabase solo
  guarda analítica anónima.
