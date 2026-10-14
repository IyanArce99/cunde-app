#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ EL LADO SERVIDOR DE LOS PRECIOS ═══
 *
 * Tres órdenes, que son los tres pasos del ciclo:
 *
 *   esquema    crea las tablas. Idempotente: se puede repetir.
 *   guardar    mete la última revisión en `precio`. Es el HISTORIAL, y esto lo
 *              hace el cron todos los días pase lo que pase.
 *   publicar   sube la instantánea y la marca activa. Esto NO lo hace el cron:
 *              es la decisión de que estos precios son los buenos.
 *
 * Uso:
 *   node --experimental-strip-types catalogo/supabase.ts esquema
 *   node --experimental-strip-types catalogo/supabase.ts guardar catalogo/precios-2026-08-07.json
 *   node --experimental-strip-types catalogo/supabase.ts publicar
 *   node --experimental-strip-types catalogo/supabase.ts publicar --zona gran-canaria
 *
 * ═══ LAS CREDENCIALES NO VAN AQUÍ ═══
 *
 * `SUPABASE_DB_URL` en el entorno. La cadena de conexión lleva la contraseña de
 * la base de datos y escribirla en un fichero del repositorio es cómo acaba en
 * el historial de git para siempre — de donde no se quita rotándola una vez.
 * En el cron va como secreto de GitHub Actions.
 */

import fs from 'node:fs';
import pg from 'pg';

const URL_BD = process.env.SUPABASE_DB_URL;
if (!URL_BD) {
  console.error('Falta SUPABASE_DB_URL en el entorno.');
  console.error('  PowerShell:  $env:SUPABASE_DB_URL = "postgresql://…"');
  process.exit(1);
}

const CADENA = 'mercadona';
const orden = process.argv[2];

const cliente = new pg.Client({
  connectionString: URL_BD,
  // Supabase exige TLS. `rejectUnauthorized: false` porque el pooler presenta un
  // certificado que la cadena de confianza de Node no valida por defecto; el
  // tráfico va cifrado igual.
  ssl: { rejectUnauthorized: false },
});

async function esquema() {
  const sql = fs.readFileSync(new URL('./esquema-precios.sql', import.meta.url), 'utf8');
  await cliente.query(sql);
  const { rows } = await cliente.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('producto','precio','instantanea')
      order by table_name`,
  );
  console.log('Tablas:', rows.map((r) => r.table_name).join(', '));
}

/**
 * Mete la revisión del día en el historial.
 *
 * `upsert` por la clave entera y NUNCA `delete` + `insert`: si esto se corta a
 * la mitad, lo que hay que quedarse es lo que ya estaba, no medio catálogo.
 * Misma regla que gobierna la ingesta desde el principio.
 */
async function guardar(ruta: string) {
  const informe = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const capturado = informe.revisadoEn ?? new Date().toISOString();
  const almacen = informe.almacen ?? 'mad3';

  /* El informe solo trae lo que CAMBIÓ. Para el historial hace falta el precio
     de todos, así que se lee el catálogo del motor y se le aplican los cambios
     encima: así cada captura deja una foto completa y no un diff. */
  const motor = JSON.parse(fs.readFileSync('src/data/motor-datos.json', 'utf8'));
  const cambios = new Map<string, number>();
  for (const c of informe.cambios ?? []) cambios.set(String(c.sku), c.precioNuevo);

  let productos = 0;
  let precios = 0;
  await cliente.query('begin');
  try {
    for (const s of Object.values(motor.skus) as Record<string, unknown>[]) {
      const sku = String(s.sku);
      await cliente.query(
        `insert into producto (cadena, sku, nombre, contenido, unidad, packaging,
                               unidades_pack, peso_variable, departamento, subfamilia, ultima_vez_visto)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11)
         on conflict (cadena, sku) do update set
           nombre = excluded.nombre, contenido = excluded.contenido, unidad = excluded.unidad,
           packaging = excluded.packaging, unidades_pack = excluded.unidades_pack,
           peso_variable = excluded.peso_variable, departamento = excluded.departamento,
           subfamilia = excluded.subfamilia, ultima_vez_visto = excluded.ultima_vez_visto`,
        [CADENA, sku, s.nombre, s.contenido, s.unidad, s.packaging,
          s.unidades_pack, s.peso_variable, s.departamento, s.subfamilia, capturado],
      );
      productos++;

      const precio = cambios.get(sku) ?? (s.precio as number);
      await cliente.query(
        `insert into precio (cadena, sku, almacen, precio, precio_unidad, capturado_en)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (cadena, sku, almacen, capturado_en) do update
           set precio = excluded.precio, precio_unidad = excluded.precio_unidad`,
        [CADENA, sku, almacen, precio, s.precio_kg_l_ud, capturado],
      );
      precios++;
    }
    await cliente.query('commit');
  } catch (e) {
    await cliente.query('rollback');
    throw e;
  }
  console.log(`Guardado ${capturado} · almacén ${almacen}`);
  console.log(`  ${productos} productos · ${precios} precios · ${cambios.size} cambiaron`);
}

/**
 * Publica la instantánea que la app se descarga y la deja como la única activa.
 *
 * Se sube lo que hay en `catalogo/instantanea-precios.json`, que genera
 * `publicar-precios.js` desde el catálogo YA revisado por una persona. Aquí no
 * se decide nada: se sube lo decidido.
 */
async function publicar() {
  /* Una por zona (ver supabase/migrations/20261014_instantanea_por_zona.sql).
     La de Madrid sigue en el fichero de siempre; la de otra zona, en
     instantanea-precios-<zona>.json, que escribe publicar-precios.js --zona. */
  const i = process.argv.indexOf('--zona');
  const zona = i > -1 ? process.argv[i + 1] : 'madrid';
  const fichero = zona === 'madrid' ? 'catalogo/instantanea-precios.json' : `catalogo/instantanea-precios-${zona}.json`;
  const inst = JSON.parse(fs.readFileSync(fichero, 'utf8'));
  if (!inst.version || !inst.skus || !Object.keys(inst.skus).length) {
    throw new Error('La instantánea no tiene versión o viene vacía.');
  }
  // Que el fichero diga la misma zona que se publica: subir la de Madrid como de
  // Gran Canaria es justo lo que la zona existe para impedir.
  if ((inst.zona ?? 'madrid') !== zona) throw new Error(`${fichero} es de la zona «${inst.zona ?? 'madrid'}», no de «${zona}».`);
  await cliente.query('begin');
  try {
    // Primero se desactiva la anterior: el índice único no deja dos activas, y
    // hacerlo al revés fallaría por conflicto en vez de sustituir.
    await cliente.query('update instantanea set activa = false where cadena = $1 and zona = $2 and activa', [CADENA, zona]);
    await cliente.query(
      `insert into instantanea (version, cadena, zona, almacen, datos, activa)
       values ($1,$2,$3,$4,$5,true)
       on conflict (cadena, zona, version) do update
         set datos = excluded.datos, almacen = excluded.almacen,
             activa = true, publicada_en = now()`,
      [inst.version, CADENA, zona, inst.almacen ?? 'mad3', inst],
    );
    await cliente.query('commit');
  } catch (e) {
    await cliente.query('rollback');
    throw e;
  }
  const kb = Math.round(JSON.stringify(inst).length / 1024);
  console.log(`Publicada ${inst.version} · zona ${zona} · ${Object.keys(inst.skus).length} SKU · ${kb} KB`);
}

const ORDENES: Record<string, () => Promise<void>> = {
  esquema,
  guardar: () => {
    const ruta = process.argv[3];
    if (!ruta) throw new Error('Falta el informe: supabase.ts guardar catalogo/precios-<fecha>.json');
    return guardar(ruta);
  },
  publicar,
};

const elegida = ORDENES[orden ?? ''];
if (!elegida) {
  console.error(`Órdenes: ${Object.keys(ORDENES).join(', ')}`);
  process.exit(1);
}

await cliente.connect();
try {
  await elegida();
} finally {
  await cliente.end();
}
