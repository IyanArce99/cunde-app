# Beta privada · Madrid y Gran Canaria · 14 oct 2026

> Rama `beta/preparacion`. Cierre de pendientes para invitar a 5-10 personas.
> Sin auditoría nueva ni funciones nuevas. Lo probado por mí y lo que tienes que
> probar tú van separados (sección 6).

## 1. Zonas: a quién se puede invitar

| zona | quién | catálogo que recibe | recetas (sin filtros · con «Gluten») | ¿invitar? |
|---|---|---|---|---|
| **Madrid** | Códigos 28xxx | Almacén mad3: 118 SKU, todos activos. **36 pendientes** de confirmar que son el ingrediente (los usan 62 recetas). La app dice «almacén mad3; en la fruta y el fresco tu tienda puede variar» | 152 · 96 | **Sí**, con esa limitación dicha |
| **Gran Canaria, 9 almacenes** | Los 55 códigos postales medidos con almacén (tabla abajo) | Solo lo **verificado**: 67 SKU (62 comprobados + 5 de despensa) y la capa de su almacén. Las 30 alternativas siguen fuera | 37-40 · 25-27 | **Sí**, sabiendo que el recetario es corto (9 platos por semana con variedad normal; 12 con «mucha») |
| Gran Canaria sin reparto online | 35111 35280 35290 35470 35418 35457 35468 35489 35330 35340 35320 35360 35350 | Madrid **como ejemplo**, y dicho en Semana y en Compra: «allí no te sirven para comprar» | — | **No** |
| Resto de Canarias (35xxx y 38xxx no medidos: Lanzarote, Fuerteventura, Tenerife…) | — | Igual que la fila anterior | — | **No** |
| Resto de España | — | Madrid como referencia, dicho: «Tu zona aún no la tengo. Los precios son los de Madrid» | — | Solo si sabe que son de Madrid |

| almacén | códigos postales | capa propia |
|---|---|---|
| 4701 | 35001-35004, 35011, 35014 | caldo de verduras y barra de pan de Madrid (40 recetas) |
| 3120 | 35005-35009 | — |
| 3544 | 35010, 35012, 35013, 35019 | — |
| 3864 | 35015, 35016 | — |
| 4745 | 35017, 35018, 35200, 35210, 35213, 35300, 35307, 35308, 35310 | — |
| 4418 | 35211, 35212, 35214, 35215, 35217, 35219, 35240, 35250, 35118, 35260 | — |
| 4570 | 35100, 35106, 35107, 35110, 35119 | caldo de verduras (39 recetas) |
| 4377 | 35120, 35129, 35130, 35138, 35140 | — |
| 4677 | 35400, 35411-35413, 35420, 35430, 35450, 35460, 35480 | — |

- **Nadie recibe Madrid en silencio.** Fuera de una zona medida, el texto sale
  en el paso del código postal, en Semana y en Compra (tests en
  `src/lib/zona.test.ts`).
- **Nadie recibe un almacén que no le toca.** Un código de Gran Canaria que no
  está en la tabla medida queda **sin cobertura**; no se le asigna el almacén
  «más cercano».
- **Madrid tiene tres almacenes** (mad1, mad2, mad3) y solo está medido mad3.
  Sin preguntar a Mercadona desde el móvil no se sabe cuál toca a cada código.
  Por eso se enseña mad3 y se dice.

**Limitación de Madrid que conviene decidir** (no la he cambiado). Gran Canaria
solo usa lo verificado; Madrid usa también los 36 pendientes. Si se aplicara el
mismo criterio, Madrid perdería unas 60 recetas. Los pendientes son casi todos
«solo la categoría respalda que es el ingrediente» (aceite, cebolla, pan…). Se
cierran como los siete básicos de Gran Canaria: ficha y foto de etiqueta.

## 2. Alérgenos: lo que no se sabe

**El plátano.** En el informe anterior, «sale para cualquier filtro» quería decir
**se excluye**: con un filtro de alergia, el plátano **no se ofrece**. La frase
era ambigua y ya está corregida en el código y en sus comentarios.

**Había una contradicción y está corregida.** Los postres trataban un producto
de etiqueta desconocida como «no compatible», y las recetas lo trataban como
«sin alérgenos». Ahora las dos usan la misma regla, `compatibilidadIncierta`
(src/motor/filtros.ts):

| caso | con un filtro de alergia | con una preferencia (vegetariano, vegano, cerdo) |
|---|---|---|
| Etiqueta contrastada, sin el alérgeno | se ofrece | según el origen |
| Etiqueta contrastada, con el alérgeno o su traza | no se ofrece | según el origen (las trazas no cuentan) |
| **Desconocida**: ficha sin ingredientes ni alérgenos, y nadie ha mirado su etiqueta | **no se ofrece** | según el origen, que sí se conoce |
| Ficha sin texto pero **verificada con la foto** de la etiqueta (cebolla, patata) | se ofrece | según el origen |

- **«x99.» no es una declaración**: lo llevan fichas sin ingredientes y fichas
  con sulfitos.
- **Productos desconocidos hoy en Madrid (12):** pechuga, contramuslo, muslo y
  pollo troceado, panceta, sardina fresca, brócoli, calabacín, calabaza,
  repollo, romero y plátano. Con un filtro de alergia, 33 recetas quedan fuera (no se ofrecen).
- **Especias de despensa:** si una es desconocida, se quita del plato (como el
  comino con gluten) en vez de tumbar la receta.
- **En Gran Canaria:** solo el romero.
- **Se cierra igual que los básicos:** foto de la etiqueta.

Pruebas: `src/motor/filtros.test.ts` (recetas, despensa, verificado frente a
desconocido, y la misma regla en recetas y postres) y
`src/motor/postres-alergenos.test.ts`.

## 3. Supabase y precios

### Diagnóstico

| comprobación | resultado |
|---|---|
| URL configurada | `https://<ref>.supabase.co`. La misma referencia en los 16 sitios que la nombran (`.env`, `.env.local`, docs) |
| DNS | NXDOMAIN en 1.1.1.1, 8.8.8.8 y 9.9.9.9. Por DNS sobre HTTPS, la respuesta trae la autoridad de `supabase.co` (Cloudflare): el dominio existe y **su servidor autoritativo dice que ese subdominio no**. No es mi red ni un resolutor |
| Estado del servicio | status.supabase.com: «All Systems Operational» (consultado hoy) |
| Credenciales | No se pueden probar: no hay a quién conectarse. No tengo sesión de la CLI de Supabase ni token |
| Conclusión | Lo más probable es que **el proyecto ya no exista** (borrado o eliminado tras una pausa larga), y no que esté pausado, porque un proyecto pausado sigue teniendo DNS. **Solo el panel lo confirma** |

### El flujo, y lo que fallaba aparte del servidor

```
cron diario (GitHub Actions)  → revisa precios de mad3 y los GUARDA en `precio` (historial)
a mano: aplicar-precios.js    → actualiza el catálogo del repositorio
a mano: publicar-precios.js   → escribe la instantánea
a mano: supabase.ts publicar  → la sube a `instantanea` y la deja activa
app al arrancar               → GET /rest/v1/rpc/instantanea_actual → la guarda → la aplica al abrir
```

**Descargar precios no llega a ningún móvil sin los dos pasos a mano.** Y para
las zonas faltaban cuatro cosas. Las dejo preparadas, **sin aplicar a ningún
servidor**:

1. **Esquema:** con `version` como clave única, Madrid y Gran Canaria chocaban.
   La migración `supabase/migrations/20261014_instantanea_por_zona.sql` añade
   `zona` (por defecto `madrid`), la clave (cadena, zona, versión), una
   instantánea activa por zona y la RPC con `p_zona`.
2. **`supabase.ts publicar --zona gran-canaria`:** sube la de esa zona y
   comprueba que el fichero es de esa zona.
3. **La app:** `VITE_PRECIOS_URL` lleva `&p_zona={zona}`. Ya está así en tu
   `.env` local, que no está en git. Una app sin `{zona}` solo pide Madrid.
4. **El cron solo mide mad3.** En Gran Canaria, actualizar precios es manual:
   `auditar-catalogo.ts` en los 9 almacenes → `construir-zona.ts cerrar` →
   `publicar-precios.js --zona` → `supabase.ts publicar --zona`. Unos 10
   minutos. Automatizarlo puede esperar a después de la beta.

~~La migración SQL no se ha ejecutado en ningún Postgres.~~ **Actualizado el
mismo día:** con PGlite 0.5.9 (la 0.2 fallaba en este Windows) se ha ejecutado
sobre el esquema viejo con instantáneas de Madrid dentro, y sobre un proyecto
vacío. Resultados en `docs/lanzamiento-beta.md` §1. Falta, como siempre,
ejecutarla en el proyecto de verdad.

### Probado en local, contra un servidor de pruebas

`catalogo/servidor-pruebas.mjs` imita las dos RPC con su contrato: precios por
zona, y analítica idempotente por `event_id`. Hay una build de la app en modo
`pruebas` apuntada a él. Recorrido `e2e/precios-local.mjs`, **10/10**:

| | |
|---|---|
| Con 35007, descarga y guarda la instantánea de **Gran Canaria**, en su propia clave | ✓ |
| Al reabrir, la aplica y avisa: «Precios del 20 OCT: tu lista pasa de 57,04 € a 57,44 €» | ✓ |
| La fecha visible es la de los precios de la lista | ✓ |
| Con la compra empezada, la lista y sus precios no cambian; los nuevos esperan, y lo dice | ✓ |
| Una instantánea de **otra zona** no se guarda | ✓ |
| Un precio que se dispara (+800 %) no se aplica | ✓ |
| Sin conexión: misma zona y misma fecha | ✓ |
| El servidor recibe eventos de analítica | ✓ |
| La cola sin conexión se reenvía al volver, **sin duplicados** (2 en cola → 2 nuevos, 0 repetidos) | ✓ |

No es Supabase: no prueba RLS, ni la migración, ni el pooler.

### Credenciales

| credencial | dónde se usa | estado | cambio coordinado |
|---|---|---|---|
| **Contraseña de Postgres** (en `SUPABASE_DB_URL`) | `catalogo/supabase.ts` en local y el secreto `SUPABASE_DB_URL` del cron | Filtrada en un chat. **Si el proyecto ya no existe, no hay nada que revocar** | Proyecto restaurado: Panel → Project Settings → Database → Reset database password → actualizar el secreto `SUPABASE_DB_URL` en GitHub → `supabase.ts esquema` para comprobarla. Proyecto nuevo: nace con contraseña nueva |
| **Clave de OpenAI** (empieza por `sk-proj-CXG0…`) | Solo `catalogo/generar-fotos.js`, fuera de la app. Está en `.env.local` | Filtrada. Activa hasta que la revoques | Crear una nueva en platform.openai.com → sustituirla en `.env.local` → revocar la vieja. La app no se entera |
| Clave publicable de Supabase (`VITE_SUPABASE_ANON_KEY` y `apikey` en `VITE_PRECIOS_URL`) | Dentro del APK. Es pública por diseño (RLS) | Si el proyecto es nuevo, cambia | Ponerla en `.env` y **recompilar la app**: un APK viejo no recibe precios ni envía analítica, y sigue funcionando sin red |
| Clave de RevenueCat | No configurada: el muro está apagado | — | Nada para la beta |
| Claves de firma de Android (`android/keystore.properties`) | Solo la versión de Play | Fuera de git | Nada |

## 4. Privacidad

**Corregido en `landing/src/Privacidad.tsx`** para que diga lo que hace el
código:

- **Provincia:** decía «nunca enviamos tu ubicación», y `onboarding_completed`
  envía la provincia (dos cifras del código postal). Ahora se declara; el
  código postal completo se queda en el teléfono.
- **Campos que faltaban:** identificador de sesión; tramo de la diferencia
  entre lo previsto y el ticket; productos marcados sobre el total; extras sin
  precio; eventos de Cunde+.
- **Pantallas inexistentes:** decía que se puede ver el identificador de
  instalación y borrar los datos «desde los ajustes de la app». Ninguna de las
  dos existe; ahora explica cómo borrarlos desde los ajustes del teléfono.
- **Precios e IP:** la descarga de precios lleva solo la zona; el servidor ve
  la IP, y la tabla de eventos no la guarda.
- **RevenueCat:** se conecta al abrir la app cuando las compras están activas,
  no solo al comprar. En la beta, no.
- **Avisos de cambios:** prometía avisar dentro de la app y no existe; quitado.

**Acceso desde la app:** no había ninguno. Ahora hay un enlace en la portada y
otro al final de Ajustes, que abren `https://www.cunde.app/privacidad.html`.

**Requiere despliegue o configuración de dominio** (no lo he tocado):

| | estado hoy | qué hacer |
|---|---|---|
| `https://cunde.app/…` | Falla: dos registros A, uno (31.214.178.55) rechaza el 443 y el otro sirve un certificado **solo** para `www.cunde.app` | Quitar el registro A que sobra y añadir `cunde.app` al proyecto de Vercel para que emita su certificado |
| `/privacidad` y `/condiciones` | 404 incluso en `www` | `landing/vercel.json` con `cleanUrls` (preparado) → redesplegar la landing |
| La política nueva | Solo en local | Redesplegar la landing |

## 5. Versión de pruebas

`android/app/build/outputs/apk/beta/app-beta.apk` (20 MB):

| | |
|---|---|
| Identificador | `es.cunde.app.beta`. El de producción, `es.cunde.app`, no cambia |
| Nombre visible | «Cunde Beta» (`android/app/src/beta/res/values/strings.xml`) |
| Versión | 1.3-beta (código 4) |
| Firma | La de depuración de este ordenador. Otra máquina compila con otra firma: para actualizar la beta de alguien, compila siempre aquí |
| Datos | Separados de la versión de Play: instalarla no toca nada de la otra |
| Lo que depende del identificador | El FileProvider usa `${applicationId}`. No hay `google-services.json`, enlaces profundos ni RevenueCat activo |
| Precios y analítica | Apuntan al Supabase actual, que no responde: la beta funciona con el catálogo que lleva dentro (14 oct) y la analítica se queda en la cola del teléfono hasta que haya servidor |

### El aviso «System UI isn't responding» del emulador

Reproducido y medido en el registro del sistema (logcat):

- **El ANR es de `com.android.systemui`**, a las 10:52:12, con el motivo
  «executing service com.android.systemui/.SystemUIService, waited 20037ms».
- **Contexto:** carga 20,62 y presión de CPU del 79 % (renderizado por
  software); otro ANR de Google Play Services en el mismo segundo.
- **Ningún proceso de Cunde existía aún:** el primero arranca a las 10:52:18.
- **El diálogo se queda en pantalla** hasta que alguien lo cierra; por eso sale
  en las capturas posteriores.
- **En dos recorridos completos** (24.572 líneas de registro), ningún ANR, error
  fatal ni cierre de Cunde.

## 6. Qué está probado y qué tienes que probar tú

| | yo, en emulador (Pixel 7, Android 16) | yo, en navegador o local | **tú, en teléfono real** |
|---|---|---|---|
| Instalar la beta junto a la actual sin perder sus datos | ✓ | — | pendiente |
| Zona (35007 → 3120) | ✓ | ✓ | pendiente |
| Generar | ✓ | ✓ | pendiente |
| Modificar comida («No cocino», sin subir la compra) | ✓ | tests | pendiente |
| Comprar y cerrar | ✓ | — | pendiente |
| Reabrir sin red, en frío | ✓ | — | pendiente |
| Preparar la siguiente semana (fecha adelantada 7 días) | ✓ | tests | pendiente |
| Precios por zona, rechazo, compra en curso, analítica y cola | — | ✓ (servidor local) | con Supabase real, pendiente |

**No había ningún teléfono conectado: nada de la columna de la derecha está
hecho.** Recorrido para hacerlo tú, unos 15 minutos:

1. **Instalar.** Copia `app-beta.apk` al teléfono y ábrelo; acepta instalar de
   origen desconocido. Debe aparecer «Cunde Beta» junto a «Cunde», si la
   tienes.
2. **Zona.** En «¿Dónde compras?» pon tu código. La nota tiene que nombrar tu
   almacén (35007 → 3120). Seguir: la app se recarga.
3. **Generar.** Personas, presupuesto y «Ver mi semana».
4. **Modificar comida.** Toca un plato → «No cocino» → «Dejarlo así». La compra
   no puede subir.
5. **Comprar.** En Compra, marca productos con una mano. ¿Se lee con la luz del
   súper?
6. **Cerrar.** «Cerrar la compra», mete el importe del ticket y «Guardar esta
   semana».
7. **Reabrir sin red.** Modo avión, cierra la app del todo (desde recientes) y
   ábrela: misma semana, misma fecha de precios.
8. **Semana siguiente con fechas controladas.** Ajustes de Android → Sistema →
   Fecha y hora → desactiva la automática y adelanta **7 días** → abre la app:
   «Esta semana ya ha terminado» → «Preparar siguiente semana». **Vuelve a
   poner la fecha automática** después.

Anota lo que no cuadre con la hora, para cruzarlo con el registro.

## 7. Cierre

**Resuelto:**
- Cobertura acotada y dicha en cada pantalla.
- Una regla de alérgenos desconocidos para recetas y postres.
- Precios por zona en la app, preparados en el servidor y probados en local.
- Política alineada con el código y enlazada desde la app.
- Beta instalable junto a la versión de Play.
- El aviso del emulador, explicado con su registro.

**Bloquea invitar a usuarios:**
1. El proyecto de Supabase. Sin él no hay precios actualizables ni analítica.
   La app funciona igual con el catálogo del 14 oct, pero envejece, y la
   analítica es la métrica de la beta.
2. Los datos del titular en la política (razón social, NIF, domicilio).
3. El dominio y el redespliegue de la landing, para que la política se vea en
   su URL.
4. Tu recorrido en un teléfono real.

**Puede esperar a después de la beta:**
- El cron de Gran Canaria (hoy, actualización manual).
- Cerrar los 36 pendientes de Madrid.
- Las alternativas de Gran Canaria.
- Una pantalla en la app con el identificador de instalación.
- Probar la migración en un Postgres local.
