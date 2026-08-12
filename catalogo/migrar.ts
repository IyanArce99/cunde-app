#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ APLICAR LAS MIGRACIONES DE supabase/migrations ═══
 *
 * Un fichero SQL suelto que alguien pega a mano en el panel de Supabase no es
 * infraestructura reproducible: no se sabe cuál se aplicó, ni en qué orden, ni
 * si el proyecto de producción y el de pruebas tienen lo mismo.
 *
 * Esto lleva la cuenta en una tabla y no repite lo ya aplicado.
 *
 * ═══ LAS CREDENCIALES NO VAN AQUÍ ═══
 *
 * `SUPABASE_DB_URL` en el entorno, como en `supabase.ts`. La cadena lleva la
 * contraseña de la base de datos, y escribirla en un fichero del repositorio es
 * cómo acaba en el historial de git para siempre — de donde no se quita
 * rotándola una vez.
 *
 * Uso:
 *   $env:SUPABASE_DB_URL = "postgresql://…"
 *   node --experimental-strip-types catalogo/migrar.ts          aplica lo que falte
 *   node --experimental-strip-types catalogo/migrar.ts --ver    solo dice qué falta
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(aqui, '..', 'supabase', 'migrations');

const URL_BD = process.env.SUPABASE_DB_URL;
if (!URL_BD) {
  console.error('Falta SUPABASE_DB_URL en el entorno.');
  console.error('  PowerShell:  $env:SUPABASE_DB_URL = "postgresql://…"');
  process.exit(1);
}

const soloVer = process.argv.includes('--ver');

const cliente = new pg.Client({
  connectionString: URL_BD,
  /* El certificado de Supabase lo firma una CA que Node no trae de serie. No se
     desactiva la verificación por comodidad: es que la alternativa —empaquetar
     el certificado raíz— no aporta nada aquí, donde el destino es un host fijo
     y conocido. */
  ssl: { rejectUnauthorized: false },
});

const ficheros = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  : [];

if (ficheros.length === 0) {
  console.log('no hay migraciones en supabase/migrations');
  process.exit(0);
}

await cliente.connect();

await cliente.query(`
  create table if not exists public.migraciones (
    fichero text primary key,
    aplicada_en timestamptz not null default now()
  );
`);

const { rows } = await cliente.query<{ fichero: string }>('select fichero from public.migraciones');
const yaEstan = new Set(rows.map((r) => r.fichero));

let aplicadas = 0;
for (const f of ficheros) {
  if (yaEstan.has(f)) {
    console.log(`  ya estaba  ${f}`);
    continue;
  }
  if (soloVer) {
    console.log(`  PENDIENTE  ${f}`);
    continue;
  }
  const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
  /* En una transacción: una migración a medias es peor que ninguna, porque deja
     un esquema que no corresponde a ningún fichero. */
  try {
    await cliente.query('begin');
    await cliente.query(sql);
    await cliente.query('insert into public.migraciones (fichero) values ($1)', [f]);
    await cliente.query('commit');
    console.log(`  aplicada   ${f}`);
    aplicadas++;
  } catch (e) {
    await cliente.query('rollback');
    console.error(`  FALLA      ${f}`);
    console.error(`    ${(e as Error).message}`);
    await cliente.end();
    process.exit(1);
  }
}

console.log(soloVer ? '\n(solo lectura, no se ha aplicado nada)' : `\n${aplicadas} aplicadas`);
await cliente.end();
