/**
 * ESTADO REAL DE LA ANALÍTICA EN SUPABASE
 *
 * Qué hay aplicado, qué permisos tiene y cuántos eventos han llegado. No
 * modifica nada: solo pregunta.
 *
 * Uso:
 *   $env:SUPABASE_DB_URL = "postgresql://…"
 *   node catalogo/_aud-analitica.mjs
 */
import pg from 'pg';

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const uno = async (sql, args = []) => (await c.query(sql, args)).rows;

console.log('═══ MIGRACIONES APLICADAS ═══');
try {
  for (const r of await uno('select fichero, aplicada_en from migraciones order by fichero')) {
    console.log(`  ${r.fichero}  ${r.aplicada_en.toISOString().slice(0, 16).replace('T', ' ')}`);
  }
} catch { console.log('  (no existe la tabla de migraciones)'); }

console.log('\n═══ TABLAS ═══');
for (const r of await uno(`
  select c.relname as tabla, c.relrowsecurity as rls,
         (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`)) {
  console.log(`  ${r.tabla.padEnd(22)} RLS ${r.rls ? 'sí' : 'NO'}   políticas: ${r.politicas}`);
}

console.log('\n═══ ÍNDICES DE analytics_events ═══');
for (const r of await uno(`
  select indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as tam
  from pg_indexes where tablename = 'analytics_events' order by indexname`)) {
  console.log(`  ${r.indexname.padEnd(40)} ${r.tam}`);
}

console.log('\n═══ PERMISOS DEL CLIENTE (anon) ═══');
const permisos = await uno(`
  select table_name, string_agg(privilege_type, ', ' order by privilege_type) as permisos
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
  group by table_name order by table_name`);
if (permisos.length === 0) console.log('  ninguno sobre ninguna tabla  ← es lo correcto');
else for (const r of permisos) console.log(`  ${r.table_name.padEnd(22)} ${r.permisos}`);

console.log('\n═══ FUNCIONES QUE anon PUEDE EJECUTAR ═══');
for (const r of await uno(`
  select p.proname, p.prosecdef as security_definer,
         has_function_privilege('anon', p.oid, 'execute') as puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' order by p.proname`)) {
  console.log(`  ${r.proname.padEnd(22)} definer:${r.security_definer ? 'sí' : 'no'}  anon:${r.puede ? 'SÍ' : 'no'}`);
}

console.log('\n═══ EVENTOS RECIBIDOS ═══');
const [tot] = await uno('select count(*)::int as n, count(distinct install_id)::int as inst from analytics_events');
console.log(`  ${tot.n} eventos · ${tot.inst} instalaciones`);
const [peso] = await uno(`select pg_size_pretty(pg_total_relation_size('analytics_events')) as t`);
console.log(`  ocupa ${peso.t}`);
for (const r of await uno(`
  select event_name, count(*)::int as n from analytics_events
  group by 1 order by 2 desc limit 12`)) {
  console.log(`    ${String(r.n).padStart(4)}  ${r.event_name}`);
}

console.log('\n═══ EMBUDO ═══');
for (const r of await uno('select * from analytics_funnel order by primera_vez desc limit 5')) {
  console.log(`  ${r.install_id.slice(0, 8)}  onb:${r.onboarding_completado ? '✓' : '·'}`
    + ` sem:${r.primera_semana ? '✓' : '·'} compra:${r.compra_abierta ? '✓' : '·'}`
    + ` cierre:${r.compra_cerrada ? '✓' : '·'}  última semana: ${r.ultima_semana ?? '-'}`);
}

await c.end();
