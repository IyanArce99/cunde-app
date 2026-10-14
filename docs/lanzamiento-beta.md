# Lanzar la beta · Gran Canaria primero · 14 oct 2026

Lo que hay que hacer, en orden, para dar Cunde Beta a 5-10 personas. Lo que ya
está hecho en el código, en `docs/beta-privada-2026-10-14.md`. Aquí solo hay
pasos, y quién los da.

Lo que **solo puedes hacer tú** (panel de Supabase, DNS, Vercel, correo,
datos del titular, el teléfono) está marcado **[TÚ]**. Lo demás son órdenes que
puedo lanzar yo cuando me des acceso o permiso.

---

## 1. Supabase

### 1.1 Qué pasa con el proyecto `vxvn…` · [TÚ]

Desde aquí no se puede saber más: el servidor DNS autoritativo de `supabase.co`
dice que ese subdominio no existe, y no hay sesión de la CLI. **Que no resuelva
no prueba que esté borrado.** Mira en el panel:

1. Entra en [supabase.com/dashboard](https://supabase.com/dashboard) con la
   cuenta que creó el proyecto. Si tienes varias organizaciones, mira en todas
   (selector arriba a la izquierda).
2. Busca un proyecto cuya URL empiece por `vxvn`
   (Project Settings → General → Reference ID).
3. Apunta cuál de estos ves:

| lo que ves | qué significa | siguiente paso |
|---|---|---|
| Proyecto **activo** | El DNS debería resolver. Raro | Ejecuta el comprobador (1.4) y pásame la salida |
| **Paused** con botón *Restore* | Pausado por inactividad. Los datos siguen | *Restore project*, espera a que esté verde, y 1.2 |
| *Paused* **sin** opción de restaurar, o «can no longer be restored» | Pausado hace más de 90 días. Puede ofrecer descargar una copia | Descarga la copia si la ofrece, y 1.3 |
| **No aparece** en ninguna organización | Borrado | 1.3 |

No borres nada ni crees nada hasta decirme qué has visto.

### 1.2 Si se puede restaurar: conservar lo que hay

El orden importa: **la copia va antes que cualquier migración.**

```powershell
$env:SUPABASE_DB_URL = "postgresql://…"   # Panel → Connect → Session pooler. No la pegues en el chat.
node --experimental-strip-types catalogo/supabase.ts respaldo
```

`respaldo` solo lee. Vuelca `producto`, `precio` (el historial, que no se puede
reconstruir), `instantanea` y `analytics_events` a
`catalogo/capturas-crudas/respaldo-<fecha>/`, que no está en git. Dice cuántas
filas tiene cada una: apúntalas.

Después, **con tu permiso**:

```powershell
node --experimental-strip-types catalogo/migrar.ts --ver   # qué falta, sin tocar nada
node --experimental-strip-types catalogo/migrar.ts          # aplica 20260811, 20260811b y 20261014
node catalogo/publicar-precios.js                           # Madrid
node catalogo/publicar-precios.js --zona gran-canaria
node --experimental-strip-types catalogo/supabase.ts publicar
node --experimental-strip-types catalogo/supabase.ts publicar --zona gran-canaria
node --experimental-strip-types catalogo/comprobar-supabase.ts
```

**Qué se conserva al migrar.** Probado hoy en Postgres (PGlite 0.5.9, en local),
sobre el esquema de antes de la zona con dos instantáneas de Madrid dentro:

| | resultado |
|---|---|
| Las instantáneas existentes | Siguen, con `zona = madrid`, y la activa sigue activa |
| La app vieja (sin `p_zona`) | Sigue recibiendo la de Madrid |
| Publicar Gran Canaria y Madrid | Una activa por zona; la de una no toca la de la otra |
| Dos activas en la misma zona | La base de datos lo impide |
| Aplicar la migración dos veces | No falla ni cambia nada |
| `esquema-precios.sql` actual encima | No falla ni cambia nada |
| Permisos de la clave pública | Puede pedir precios y enviar eventos; **no** puede leer eventos |

Un proyecto vacío también queda bien con `supabase.ts esquema` y luego
`migrar.ts`. `track_events` inserta una vez y no duplica al reenviar.

No probado, porque PGlite no lo tiene: el pooler, RLS con los roles reales de
Supabase y la latencia. Eso lo dice el comprobador contra el proyecto de verdad.

### 1.3 Si no se puede restaurar: proyecto nuevo · [TÚ crea, yo configuro]

1. Crea el proyecto en la región **eu-west** más cercana (Fráncfort, París o
   Irlanda). Apunta la región: va en la política.
2. Pásame **por fichero, no por chat**: `.env` con `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (la *publishable*, que va dentro del APK).
   `VITE_PRECIOS_URL` la monto yo con `&p_zona={zona}`.
3. Pon la cadena de conexión en tu terminal (`$env:SUPABASE_DB_URL`) y en el
   secreto `SUPABASE_DB_URL` de GitHub (Settings → Secrets → Actions), que usa
   el cron.
4. Luego: `supabase.ts esquema` → `migrar.ts` → los dos `publicar` → el
   comprobador.
5. **Recompilar el APK.** La clave pública va dentro: un APK viejo no recibe
   precios ni envía eventos, aunque funciona igual con el catálogo que lleva.

Del historial de `precio` no quedará nada. El cron empieza a llenarlo el día
siguiente.

### 1.4 El comprobador

```powershell
node --experimental-strip-types catalogo/comprobar-supabase.ts
```

Solo lee. Para enviar eventos usa un lote vacío, así que no inserta nada. No
imprime claves: de la URL enseña cuatro letras. Comprueba DNS, HTTPS (avisa del
HTTP 540 de proyecto pausado), la instantánea de cada zona, si la migración por
zona está aplicada, la analítica, y que el historial está cerrado a la clave
pública. Hoy dice:

```
FALLO DNS · ENOTFOUND · el dominio padre existe: el servidor autoritativo dice que este proyecto no
```

La beta se puede repartir cuando todas las líneas digan `OK`.

---

## 2. Credenciales

Sin enseñar ningún valor. **No revoques nada sin tener su sustituta puesta.**

| credencial | por qué cambiarla | cómo | quién |
|---|---|---|---|
| Contraseña de Postgres (dentro de `SUPABASE_DB_URL`) | Ha pasado por un chat | Proyecto restaurado: Project Settings → Database → *Reset database password* → actualizar el secreto de GitHub y tu entorno → `comprobar-supabase.ts`. Proyecto nuevo: nace con una nueva. Borrado: no hay nada que revocar | [TÚ] |
| Clave de OpenAI (en `.env.local`) | Ha pasado por un chat. Solo la usa `catalogo/generar-fotos.js`, la app no la lleva | Crear una nueva en platform.openai.com → cambiarla en `.env.local` → **después** revocar la vieja | [TÚ] |
| Clave publicable de Supabase | Pública por diseño, no hay que rotarla. Solo cambia si el proyecto es nuevo | `.env` → recompilar el APK | yo |
| Firma de Android de Play (`android/keystore.properties`) | Nada que cambiar. No está en git, ni en el APK, ni en la web | — | — |

Revisado hoy: ni el código, ni el historial de git, ni `dist/`, ni la web, ni
el APK de la beta llevan ninguna clave privada. Dentro del APK solo va la
publicable (`sb_publishable_…`), como debe. `catalogo/comprobar-build.mjs`
pasa.

---

## 3. Privacidad

### 3.1 Datos del titular · [TÚ]

La política (`landing/src/Privacidad.tsx`) los tiene marcados `[POR CONFIRMAR]`
a la vista. Me hacen falta:

| dato | para qué |
|---|---|
| Nombre y apellidos o razón social | Responsable del tratamiento |
| NIF | Lo mismo. Si eres autónomo, el tuyo |
| Domicilio a efectos de notificaciones | Lo mismo |
| Región del proyecto de Supabase | Dónde están los eventos (1.3) |
| Plazo de conservación de los eventos | Ver 3.2 |
| Proveedor del correo de `hola@` | Pasa a ser encargado del tratamiento |
| Que `hola@cunde.app` **recibe correo** | Ver 4.2. Hoy no |

Antes de abrir la beta a desconocidos, la política la tiene que revisar un
profesional. El aviso del final de la página lo dice y se queda.

### 3.2 Cuánto tiempo guardar los eventos · propuesta

**No lo he fijado.** La política dice `[POR CONFIRMAR: plazo]`; antes proponía
24 meses y lo he quitado.

Mi propuesta, por minimización:

| qué | cuánto | por qué |
|---|---|---|
| Eventos crudos (con `install_id`) | **6 meses** desde que pasaron | La métrica que decide es el retorno en la semana 4. Con 6 meses cabe la beta entera y una comparación entre versiones. Pasado eso, saber qué hizo un teléfono concreto en marzo no sirve para nada |
| Recuentos por semana y versión, **sin** `install_id` | Indefinido | Ya no son datos personales: no se puede volver a la persona |
| Correos de «Cuéntanos qué falla» | 3 meses después de resolverlo | Solo sirven para contestar y arreglar |

El borrado sería un `delete … where coalesce(ocurrido_en, created_at) <
now() - interval '6 months'` mensual, por ejemplo con `pg_cron`. **No está
creado:** es una migración más, y la hago cuando decidas el plazo.

### 3.3 Lo que la política describe

Coincide con lo que la app manda, evento por evento (`lib/analitica.ts`). Hoy
he añadido lo único nuevo: si alguien escribe desde «Cuéntanos qué falla»,
recibimos su correo, lo que escriba, la versión y la zona.

La app enlaza la política desde la portada y desde Ajustes, con
`https://www.cunde.app/privacidad.html`, que responde 200 hoy.

---

## 4. Dominio, web y correo · [TÚ]

### 4.1 `cunde.app` y la política

Medido hoy:

| | |
|---|---|
| `cunde.app` | Dos registros A. `31.214.178.55` no acepta HTTPS (puerto 443 cerrado); `216.198.79.1` es Vercel, pero su certificado solo cubre `www`. Según qué IP te toque, falla de una forma o de otra |
| `www.cunde.app` | Vercel. Bien |
| `https://www.cunde.app/privacidad.html` | 200 |
| `https://www.cunde.app/privacidad` | 404. Se arregla con `landing/vercel.json` (`cleanUrls`), que está en git sin desplegar |

Para dejarlo bien, **cuando me digas**:

1. **Vercel**, en el proyecto de la web: Settings → Domains → *Add*
   `cunde.app` → elegir **Redirect to `www.cunde.app`**. Vercel emite el
   certificado del dominio desnudo.
2. **DonDominio** (el SPF apunta ahí): quita el registro A `31.214.178.55` de
   `cunde.app`. Deja el de Vercel. Si Vercel pide otro valor en el paso 1,
   pon ese.
3. **Desplegar la web** con `cleanUrls`, desde la rama que elijas.
4. Comprobar:
   `https://cunde.app/privacidad` → redirige a `https://www.cunde.app/privacidad` → 200.

La URL estable es `https://www.cunde.app/privacidad`. La app sigue apuntando a
`…/privacidad.html`, que funciona hoy y, con `cleanUrls`, redirige a la limpia.
No hay que recompilar.

### 4.2 Correo

`cunde.app` **no tiene registros MX**: lo que se mande a `hola@cunde.app`
rebota. Lo usan la política, las condiciones, la web y, desde hoy, «Cuéntanos
qué falla».

Lo más simple: en DonDominio → Correo → **redirección** de `hola@cunde.app` a
tu buzón personal. Después, prueba a escribir desde otro correo y comprueba que
llega. Si prefieres otra dirección, se cambia en `src/lib/legal.ts` y en
`landing/src`.

---

## 5. Catálogo y alérgenos · hecho, para que lo sepas al invitar

- **Gran Canaria** solo lleva productos verificados: 62 con etiqueta o
  comprobación a mano, y 5 de despensa (aceite, colorante, curry, mostaza,
  romero). La despensa se asume en casa y queda fuera del total; en la lista
  sale como **«sin verificar»**.
- **Madrid** conserva 36 productos que la auditoría de mad3 no da por
  comprobados. Para quien no tiene alergias valen, y en la lista llevan
  **«sin verificar»** (32 de recetas y 4 postres).
- **Con cualquier alergia** marcada, nada cuya etiqueta no se conoce llega a
  la semana: ni platos, ni postres, ni alternativas. Hay tests para Madrid y
  Gran Canaria con gluten, lactosa y frutos secos
  (`src/state/sin-verificar.test.ts`).

**Al invitar:** a quien tenga una alergia seria, dile que la beta filtra por la
etiqueta de Mercadona, y que **la etiqueta del envase manda**.

---

## 6. Repartir el APK

**Qué se reparte:** `android/app/build/outputs/apk/beta/app-beta.apk`.
Identificador `es.cunde.app.beta`, nombre «Cunde Beta», versión 1.3-beta. Se
instala **junto** a la versión de Play, si alguien la tiene, sin tocar sus
datos.

**Antes de compilar la que se reparte:** `.env` apuntando al Supabase bueno, y
el comprobador en verde. Después:

```powershell
npm run build; npx cap sync android
cd android; .\gradlew assembleBeta; cd ..
```

**Cómo llega a cada persona:**

1. Sube el APK a una carpeta de Google Drive **con enlace solo para invitados**,
   no pública.
2. Manda a cada persona, por WhatsApp o correo, el enlace y este texto:

   > Es la beta de Cunde: menú y lista de la compra para Mercadona con
   > precios reales. Para instalarla: abre el enlace desde el móvil, descarga
   > `app-beta.apk` y ábrelo. Android te pedirá permiso para instalar apps de
   > ese origen: acéptalo solo para esto. Lo que no funcione, desde la app:
   > Ajustes → «Cuéntanos qué falla».

3. Apunta a quién se la das y en qué fecha, en un sitio tuyo. En la analítica
   cada teléfono es un identificador anónimo: no se puede saber quién es quién,
   y así debe ser.

**Actualizar:** el APK va firmado con la firma de depuración de **este**
ordenador. Una versión compilada en otro no se instala encima: Android pide
desinstalar, y eso borra la semana guardada. Compila las actualizaciones
siempre aquí, con `versionCode` mayor (`android/app/build.gradle`), y repite
el enlace.

**Solo Android.** En iPhone no hay beta.

---

## 7. Errores y opiniones

| canal | qué recoge | dónde se mira |
|---|---|---|
| **Ajustes → «Cuéntanos qué falla»** | Abre el correo del teléfono con la versión y la zona ya puestas. Nada más: ni presupuesto, ni filtros, ni código postal | Tu buzón, cuando `hola@` reciba (4.2) |
| **Analítica** | Dónde se queda cada teléfono (§8) | Panel de Supabase → SQL |
| **Una llamada** a la semana 1 y a la semana 3 con 2-3 personas | Lo que no se ve en los números: si se fían del total, si la lista sirve en el súper | Notas tuyas |

No hay recogida automática de errores (Sentry y similares): sería otro
encargado, otro SDK y otra línea en la política, para 10 personas que te
pueden escribir.

---

## 8. Métricas mínimas

`supabase/consultas-beta.sql`: cuatro consultas de solo lectura para el editor
SQL del panel. Probadas hoy en Postgres con datos de prueba.

| cifra | evento | consulta |
|---|---|---|
| Semana generada | `week_generated` | 1 y 2 |
| Lista creada / abierta | `shopping_opened` | 1 |
| Compra completada | `checkout_completed` (al guardar el ticket) | 1 y 3 |
| Vuelve la semana siguiente | `week_generated` con `week_number` = N+1 | 2 |

Con 10 personas se cuentan **personas**, no porcentajes. La consulta 4 enseña
cada teléfono: hasta qué semana llegó y cuándo usó la app por última vez.

Los eventos se agrupan por **cuándo pasaron**, no por cuándo llegaron: la
pantalla Compra se usa sin cobertura y la cola se vacía días después.

Mientras no haya Supabase, los eventos se quedan en la cola del teléfono
(`cunde:analytics-queue`) y se envían cuando haya servidor. No se pierden, pero
la cola tiene tope: una beta larga sin servidor sí pierde los más antiguos.

---

## 9. Fecha de los precios

Se ve en las dos pestañas:

- **Semana**, encima de los días: «Precios del 13 oct · Gran Canaria». Pasados
  7 días: «Precios de hace N días».
- **Compra**, encima de la lista: la misma fecha, y la misma regla de los 7
  días.

Es la fecha de los precios **con los que se valoró esa lista**, no la del APK.
Con la compra empezada, unos precios nuevos esperan y la fecha no cambia.

---

## 10. Prueba en tu teléfono · 15 minutos · [TÚ]

**Nada de esto está hecho en un teléfono real.** En el emulador, sí: 8 de 8
pasos (`e2e/recorrido-android.mjs`).

Con el APK de §6 y, si puede ser, con Supabase ya en verde:

| min | paso | qué tiene que pasar |
|---|---|---|
| 1 | Instalar `app-beta.apk` | Sale «Cunde Beta», junto a «Cunde» si la tienes |
| 2 | «Cuadrar mi semana» → código **35007** | La nota nombra el almacén **3120** |
| 3 | Personas, presupuesto → «Ver mi semana» | Total grande arriba; encima de los días, «Precios del … · Gran Canaria» |
| 4 | Toca un plato → «No cocino» → «Dejarlo así» | El total no sube |
| 5 | Pestaña **Compra** | Misma fecha y zona. Ninguna fila «sin verificar» salvo despensa al final |
| 6 | Ajustes → marca **Gluten** → vuelve a Compra | Lista rehecha |
| 7 | Marca productos con una mano, de pie | Se lee con luz fuerte, el dedo acierta |
| 8 | «Cerrar la compra» → importe del ticket → «Guardar esta semana» | Semana guardada |
| 9 | **Modo avión**, cierra la app desde recientes, ábrela | Misma semana, misma fecha de precios |
| 10 | Quita el modo avión | (Con Supabase) los eventos de los pasos anteriores aparecen en la consulta 4 |
| 11 | Ajustes → «Cuéntanos qué falla» | Se abre el correo con «Cunde 1.3.0 · Gran Canaria» en el asunto |
| 12 | Ajustes → «Política de privacidad» | Abre la política en el navegador |
| 13 | Ajustes de Android → fecha **+7 días** → abre la app | «Preparar siguiente semana» → semana 2. **Vuelve a poner la fecha automática** |
| 14 | Ajustes de Android → Apps → Cunde Beta → Almacenamiento → **Borrar datos** → abre y pon **28001** | Madrid: «Precios del … · Madrid», y alguna fila «sin verificar» |
| 15 | Borrar datos otra vez → **35007** | Otra vez Gran Canaria, con su almacén |

El código postal **no se puede cambiar desde la app** una vez hecho el
onboarding: no hay pantalla para ello. Por eso el cambio de zona se prueba
borrando datos. Que la app rehaga un plan de otra zona está cubierto por tests
(`src/state/zona.test.ts`), no a mano. Para la beta de Gran Canaria no hace
falta; si alguien se muda o se equivoca de código, que borre datos.

Anota la hora de lo que no cuadre. Hasta que no lo hagas, la beta **no** está
probada en un teléfono.

---

## 11. Lista de lanzamiento

Por orden. Cada línea, cuando esté hecha.

- [ ] **[TÚ]** Estado del proyecto `vxvn` en el panel (1.1)
- [ ] Copia de lo que haya (1.2) o proyecto nuevo (1.3)
- [ ] Migraciones y precios de las dos zonas publicados, **con tu permiso**
- [ ] `comprobar-supabase.ts` todo en `OK`
- [ ] **[TÚ]** Contraseña de Postgres rotada; clave de OpenAI rotada (2)
- [ ] **[TÚ]** Redirección de `hola@cunde.app`, probada (4.2)
- [ ] **[TÚ]** Datos del titular y plazo de conservación → los meto en la política (3.1, 3.2)
- [ ] **[TÚ]** `cunde.app` en Vercel, registro A viejo fuera, web desplegada (4.1)
- [ ] APK compilado con el `.env` bueno; `aapt` dice `es.cunde.app.beta`
- [ ] **[TÚ]** Los 15 minutos en tu teléfono (§10), sin nada grave
- [ ] **[TÚ]** Enlace de Drive y mensaje a las primeras 3 personas de Gran Canaria
- [ ] A la semana: consulta 4. Si alguien no llegó a la lista, llámale
- [ ] A las 2 semanas: el resto, hasta 10

**Se puede empezar sin:** revisión legal completa, si la beta es solo para
conocidos; Madrid; automatizar los precios de Gran Canaria (hoy, unos 10
minutos a mano por actualización).

**No se puede empezar sin:** Supabase en verde (sin él no hay métricas, y la
beta es para medir), el correo recibiendo (es el canal de errores) y tu prueba
en el teléfono.
