# iOS en Codemagic · 15 oct 2026

Cómo se compila Cunde para iOS sin un Mac: en las máquinas macOS de Codemagic,
con `codemagic.yaml` en la raíz. Los dos flujos se lanzan **solo a mano**: un
push no compila nada.

| flujo | para qué | necesita | sale |
|---|---|---|---|
| `ios-simulador` | Comprobar que el proyecto compila | Nada: ni cuenta de Apple ni variables | `Cunde-SIMULADOR-no-instalable-en-iPhone.zip`: un `.app` de **simulador**. No se instala en un iPhone de ninguna forma |
| `ios-testflight` | Subir un build firmado a App Store Connect | Membresía de Apple y lo de §3 | Un `.ipa` en App Store Connect, visible para probadores **internos**. No pide revisión de TestFlight externo ni de la App Store |

---

## 1. El proyecto iOS

- **Capacitor 8.4.2:** `@capacitor/ios` a la misma versión que `core` y `android`.
- **Swift Package Manager**, que es lo que Capacitor 8 genera por defecto, no
  CocoaPods. Por eso no hay `Podfile`, ni `pod install`, ni `.xcworkspace`, y se
  compila `ios/App/App.xcodeproj` con el esquema `App`. Los 7 plugins traen
  `Package.swift` y piden iOS 15, igual que el proyecto.
- **Identificador:** `es.cunde.app`, el mismo que Android, desde
  `capacitor.config.ts`. Nombre bajo el icono: «Cunde». Versión 1.3, como
  Android.
- **Icono y pantalla de arranque:** generados desde `assets/` con
  `@capacitor/assets`. El icono, sin transparencia, como exige Apple.
- **`Info.plist`:**
  - Región `es`.
  - `NSPhotoLibraryAddUsageDescription`: compartir la imagen de la semana
    ofrece «Guardar imagen», y sin este texto iOS cierra la app.
  - `ITSAppUsesNonExemptEncryption = false`, porque la app solo cifra con
    HTTPS del sistema. Evita la pregunta de exportación en cada build. **Es
    una declaración tuya ante Apple:** si algún día se añade cifrado propio,
    hay que cambiarla.
- **Android no cambia.**

**Ojo en Windows:** `npx cap sync` a secas también regenera
`ios/App/CapApp-SPM/Package.swift` con rutas `..\..\..`, que en macOS no
valen. Aquí usa `npx cap sync android`. Si se cuela, no rompe Codemagic, que
hace `cap sync ios` en macOS y reescribe ese fichero, pero no lo subas así.

---

## 2. Variables de la app

Vite las incrusta al compilar la web. **Todas acaban dentro de la app**: ninguna
puede ser privada.

| variable | qué es | dónde | ¿hace falta? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto | Grupo `cunde_web` en Codemagic | Solo en `ios-testflight`. `build:release` falla sin ella |
| `VITE_SUPABASE_ANON_KEY` | La clave **publicable** (`sb_publishable_…`), nunca la `service_role` ni la `sb_secret_` | Grupo `cunde_web` | Igual |
| `VITE_PRECIOS_URL` | La RPC de precios con `&p_zona={zona}` | Grupo `cunde_web` | Igual |

**No las pongas en Codemagic:**
- `VITE_REVENUECAT_ANDROID_KEY`. El código solo conoce la clave de Android y
  la usaría también en iOS. Hoy no se llama porque el muro está apagado
  (`MURO_ACTIVO = false`). Para cobrar en iOS hará falta una clave de iOS
  aparte, y eso es código nuevo.
- `SUPABASE_DB_URL`, la clave de OpenAI, ni nada sin `VITE_`. Son del
  ordenador y del cron, no de la app.

Los valores de Supabase **no existen todavía**: el proyecto no responde
(`docs/lanzamiento-beta.md` §1). Hasta entonces el grupo no se puede rellenar,
y `ios-testflight` falla en «Compilar la web». Está hecho así a propósito: un
build para probadores sin analítica no mide nada.

`ios-simulador` no usa variables. La app arranca con el catálogo que lleva
dentro, sin precios remotos ni analítica.

---

## 3. Configuración manual

### Para la primera compilación (`ios-simulador`)

Nada. En Codemagic: la app → **Start new build** → rama `beta/preparacion` →
flujo **iOS · simulador, sin firma**.

### Para `ios-testflight`, cuando tengas la membresía

1. **Apple Developer Program** activo (99 €/año).
2. **Decide el identificador antes del primer build.** En App Store Connect es
   permanente. `capacitor.config.ts` avisa de que, si el dominio es
   `cunde.app`, el invertido «correcto» sería `app.cunde`. Mantener
   `es.cunde.app` tiene sentido si Android ya lo usa en Play y RevenueCat
   empareja por él. Lo que no se puede es cambiarlo después.
3. **App Store Connect → Apps → +:** nueva app iOS con bundle ID
   `es.cunde.app`. Antes regístralo en developer.apple.com → Identifiers.
4. **Clave de API de App Store Connect:** Users and Access → Integrations →
   App Store Connect API → nueva clave con rol *App Manager*. Descarga el
   `.p8` (solo se puede una vez) y apunta el Issuer ID y el Key ID.
5. **Codemagic → Team settings → Integrations → Developer Portal → Manage
   keys:** añade esa clave con el nombre exacto **`Cunde App Store Connect`**,
   el que espera `codemagic.yaml`.
6. **Codemagic → Team settings → Code signing identities:**
   - En *iOS certificates*, genera un certificado *Apple Distribution* con la
     clave del paso 5.
   - En *iOS provisioning profiles*, descarga el perfil *App Store* de
     `es.cunde.app`.
7. **Codemagic → la app → Environment variables:** grupo `cunde_web` con las
   tres variables de §2, marcadas *Secure*. No hace falta, pero así no salen
   en los registros.
8. **Start new build** → flujo **iOS · TestFlight (manual)**.
9. **App Store Connect → TestFlight:** añade probadores internos.
   - Para externos (gente fuera de tu cuenta): cambia
     `submit_to_testflight: true` en `codemagic.yaml`. Apple revisa el primer
     build.
   - Las fichas de privacidad de la App Store también hay que rellenarlas;
     salen de la política (`landing/src/Privacidad.tsx`).

---

## 4. Qué está comprobado y qué no

**Comprobado aquí, en Windows:**

- `@capacitor/ios` 8.4.2 instalado; el lockfile lo registra.
- `npx cap add ios` y `npx cap sync ios`: los 7 plugins tienen
  `Package.swift`; no hace falta CocoaPods.
- Los plugins piden iOS 15, igual que el proyecto.
- `Info.plist` es un plist válido.
- El icono mide 1024×1024 y no tiene transparencia.
- `codemagic.yaml`:
  - **0 errores** contra el esquema oficial de Codemagic
    (`codemagic.io/codemagic-schema.json`).
  - El esquema sí detecta fallos: con dos errores metidos a propósito, los
    encuentra.
  - Ningún flujo tiene `triggering`, así que ninguno se lanza solo.
- `npm run build`, `tsc` y la suite completa (454 tests), en verde. Android no
  ha cambiado.

**Pendiente de ejecutar en macOS** (el primer `ios-simulador` lo dice):

- Que `xcodebuild` vea el esquema `App`. El proyecto no trae uno compartido y
  Xcode lo crea al abrirlo. El paso «Ver el proyecto» lo lista antes de
  compilar.
- Que resuelvan y compilen los paquetes Swift, RevenueCat incluido.
- Que la versión de Xcode de Codemagic (`latest`) valga para Capacitor 8.
- Que la app arranque en un simulador. El flujo compila pero no ejecuta.
  Para verla, descarga el `.zip` y ábrelo en un simulador de un Mac.
- Todo `ios-testflight`: firma, `.ipa` y subida.
- **Nada de esto se ha probado en un iPhone.**
