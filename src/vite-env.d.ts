/// <reference types="vite/client" />

/**
 * La versión de `package.json`, incrustada por Vite (ver `vite.config.ts`).
 * Declarada aquí para que TypeScript la conozca sin que nadie tenga que
 * escribirla a mano en un segundo sitio.
 */
declare const __VERSION_APP__: string;

interface ImportMetaEnv {
  /** De dónde se baja la app los precios actualizados. Ver lib/precios.ts. */
  readonly VITE_PRECIOS_URL?: string;
  /**
   * Destino de la analítica. Sin estas dos, la app no encola ni envía nada —
   * que es el estado correcto en desarrollo y en un clon sin credenciales.
   * La clave es la `publishable`/`anon`: va dentro del APK y es pública de
   * facto. Lo que protege los datos es que con ella solo se pueda ejecutar
   * `track_events`, no leer ni borrar la tabla.
   */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
