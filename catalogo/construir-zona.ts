#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ EL CATÁLOGO DE UNA ZONA QUE NO ES MADRID ═══
 *
 * Una zona es un conjunto de almacenes de Mercadona MEDIDOS el mismo día. Las
 * recetas son las mismas en todas; lo que cambia es qué producto hay en el
 * lineal, a qué precio y en qué formato. Este script produce, por zona, un
 * fichero con un SKU por ingrediente canónico —o `null` si en esa zona no hay
 * uno verificado— y el motivo de cada decisión.
 *
 * Tres pasos, porque en medio hay que preguntar a la red y eso no se hace a
 * escondidas de nadie:
 *
 *   1. proponer   Sin red. Para cada canónico: el SKU de Madrid si existe en
 *                 TODOS los almacenes de la zona con el mismo precio por
 *                 kilo; si no, la alternativa escrita a mano en
 *                 <zona>-alternativas.json, si se puede convertir desde las
 *                 unidades de las recetas.
 *   2. auditar    Con red: auditar-catalogo.ts --skus <propuesta> --solo <alternativas>
 *                 en cada almacén. Lo hace quien ejecuta, no este script.
 *   3. cerrar     Sin red. Entra un SKU solo si:
 *                   · existe (HTTP 200) en todos los almacenes de la zona —un
 *                     fallo de descarga NO cuenta como «no existe», pero
 *                     tampoco como «existe»: queda pendiente y fuera—;
 *                   · da el mismo precio y formato en todos, o, si es de peso
 *                     variable, el mismo precio por kilo (±1 %);
 *                   · está publicado y sin fecha de baja;
 *                   · si es ALTERNATIVA, además: la ha propuesto alguien en
 *                     <zona>-alternativas.json, un humano la ha marcado
 *                     `revisado` (es quien confirma que ES ese ingrediente:
 *                     el nombre o la categoría no lo prueban), y la auditoría
 *                     no encuentra ninguna discrepancia —la etiqueta no
 *                     declara alérgenos ni trazas que el vocabulario no tenga—.
 *                 Lo que no pasa queda en `null` con su motivo. El motor quita
 *                 las recetas que lo necesitan; no se sustituye en silencio.
 *
 * Uso:
 *   node --experimental-strip-types catalogo/construir-zona.ts proponer gran-canaria 2026-10-14
 *   node --experimental-strip-types catalogo/construir-zona.ts cerrar   gran-canaria 2026-10-14
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esCandidatoUsable } from '../src/motor/carrito.ts';
import type { DatosMotor, Sku, UnidadReceta } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));

/** Las zonas que se saben construir. Los almacenes salen de zonas-gran-canaria.ts. */
const ZONAS: Record<string, { nombre: string; almacenes: string[]; referencia: string; cps: string }> = {
  'gran-canaria': {
    nombre: 'Gran Canaria',
    almacenes: ['4701', '3120', '3544', '3864', '4745', '4418', '4570', '4377', '4677'],
    // El catálogo completo de UN almacén para buscar alternativas. Que esté en
    // los demás lo dice la auditoría, no esta elección.
    referencia: '4701',
    cps: path.join(aqui, 'zonas', 'gran-canaria-cp.json'),
  },
};

const [paso, zonaId, fecha] = process.argv.slice(2);
const zona = ZONAS[zonaId];
if (!['proponer', 'cerrar'].includes(paso) || !zona || !fecha) {
  console.error('Uso: construir-zona.ts proponer|cerrar <zona> <fecha>');
  process.exit(1);
}

const datos: DatosMotor = leer(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'));
const RUTA_PROPUESTA = path.join(aqui, 'zonas', `${zonaId}-propuesta.json`);
const RUTA_SALIDA = process.argv.includes('--suponer-revisadas')
  ? path.join(aqui, 'capturas-crudas', `zona-${zonaId}-supuesta.json`)
  : path.join(aqui, '..', 'src', 'data', 'zonas', `${zonaId}.json`);
const RUTA_CATALOGO = path.join(aqui, 'capturas-crudas', `catalogo_mercadona_${zona.referencia}_${fecha}.json`);
const RUTA_ALTERNATIVAS = path.join(aqui, 'zonas', `${zonaId}-alternativas.json`);
/** Para MEDIR qué cambiaría al aprobarlas, sin tocar el catálogo de la app. */
const SUPONER_REVISADAS = process.argv.includes('--suponer-revisadas');

/** En qué unidades piden las recetas (y ensamblajes) cada canónico. */
const unidadesDe = new Map<string, Set<UnidadReceta>>();
const anotar = (c: string, u: UnidadReceta) => {
  if (!unidadesDe.has(c)) unidadesDe.set(c, new Set());
  unidadesDe.get(c)!.add(u);
};
for (const r of datos.recetas) for (const i of r.ingredientes) anotar(i.canonico, i.unidad);
for (const lista of Object.values((datos as any).ensamblajes ?? {}) as any[][]) {
  for (const e of lista) for (const i of e.ingredientes) anotar(i.canonico, i.unidad);
}

type Fila = {
  canonico: string; sku: string; estado: string; correspondencia: string;
  mercadona: any; hallazgos: { campo: string; gravedad: string }[]; pendientes: string[];
  procedencia: { fuente: string; consultadoEn: string; http: number | null; respuesta: string };
};
function auditorias(sufijo: string): Map<string, Map<string, Fila>> {
  const m = new Map<string, Map<string, Fila>>();
  for (const wh of zona.almacenes) {
    const r = path.join(aqui, 'auditoria', `${wh}-${fecha}${sufijo}.json`);
    if (!fs.existsSync(r)) throw new Error(`falta ${path.relative(aqui, r)}: audita ese almacén primero`);
    m.set(wh, new Map(leer(r).filas.map((f: Fila) => [f.canonico, f])));
  }
  return m;
}

/** El Sku tal y como lo trae el catálogo de la zona, con el escurrido aplicado. */
function skuDelCatalogo(p: any): Sku {
  const s: Sku = {
    sku: p.sku, nombre: p.nombre, contenido: p.contenido, unidad: p.unidad_contenido,
    precio: p.precio, precio_kg_l_ud: Number((p.precio / p.contenido).toFixed(3)),
    packaging: p.packaging, unidades_pack: p.unidades_pack, peso_variable: p.peso_variable,
    departamento: p.departamento, subfamilia: p.subfamilia,
  };
  if (p.peso_escurrido && p.peso_escurrido / p.contenido < 0.97) {
    s.contenido_etiqueta = p.contenido;
    s.contenido = p.peso_escurrido;
    s.precio_kg_l_ud = Number((p.precio / p.peso_escurrido).toFixed(3));
  }
  return s;
}

function usable(canonico: string, s: Sku): boolean {
  const us = unidadesDe.get(canonico) ?? new Set([datos.ingredientes[canonico]?.unidad_base as UnidadReceta]);
  return [...us].every((u) => esCandidatoUsable(u, s));
}

/** ¿Dicen lo mismo todos los almacenes de este SKU? null si sí; el motivo si no. */
function divergencia(filas: (Fila | undefined)[]): string | null {
  const faltan = filas.filter((f) => !f);
  if (faltan.length) return `sin auditar en ${faltan.length} almacenes`;
  const fallos = filas.filter((f) => f!.procedencia.respuesta === 'fallo');
  if (fallos.length) return `descarga fallida en ${fallos.length} almacenes: ni existe ni falta, pendiente`;
  const no = filas.filter((f) => f!.procedencia.respuesta === 'no-existe');
  if (no.length) return `no existe en ${no.length} de ${filas.length} almacenes`;
  const ms = filas.map((f) => f!.mercadona);
  if (ms.some((m) => m.publicado === false || m.noDisponibleDesde)) return 'despublicado o con fecha de baja en algún almacén';
  const variable = ms.every((m) => m.granel);
  if (variable) {
    const kilos = ms.map((m) => m.precio / m.contenido);
    const [min, max] = [Math.min(...kilos), Math.max(...kilos)];
    if ((max - min) / min > 0.01) return `peso variable con precio por kilo distinto: ${min.toFixed(2)}–${max.toFixed(2)} €`;
    return null;
  }
  const huellas = new Set(ms.map((m) => `${m.precio}|${m.contenido}|${m.escurrido}|${m.unidades}`));
  return huellas.size > 1 ? `precio o formato distinto entre almacenes: ${[...huellas].join(' · ')}` : null;
}

if (paso === 'proponer') {
  const auds = auditorias('');
  const catalogo: any[] = leer(RUTA_CATALOGO);
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));
  const alternativas: Record<string, { sku: string | null; motivo: string; revisado: boolean }> =
    leer(RUTA_ALTERNATIVAS).alternativas;

  const skus: Record<string, Sku | null> = {};
  const motivo: Record<string, { origen: 'mismo-sku' | 'alternativa' | 'ninguno'; detalle: string }> = {};
  for (const [canonico, madrid] of Object.entries(datos.skus)) {
    const filas = zona.almacenes.map((wh) => auds.get(wh)!.get(canonico));
    const div = divergencia(filas);
    const enCatalogo = porSku.get(madrid.sku);
    if (!div && enCatalogo) {
      skus[canonico] = skuDelCatalogo(enCatalogo);
      motivo[canonico] = { origen: 'mismo-sku', detalle: 'el SKU de Madrid, igual en todos los almacenes de la zona' };
      continue;
    }
    // Una alternativa: la que propone gran-canaria-alternativas.json, escrita
    // a mano. Buscarla sola salió mal —«filetes de hígado» por entrecot,
    // «caldo de pollo» por caldo de verduras— y es justo lo que la guía del
    // proyecto deja para un humano: la máquina propone, alguien revisa.
    const alt = alternativas[canonico];
    const p = alt?.sku ? porSku.get(alt.sku) : null;
    const porQue = `el de Madrid (${madrid.sku}): ${div ?? 'no está en el catálogo de la zona'}`;
    if (!alt) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; nadie ha propuesto alternativa` };
    } else if (!alt.sku) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; ${alt.motivo}` };
    } else if (!p || !(p.precio > 0) || !(p.contenido > 0)) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; la propuesta ${alt.sku} no tiene precio y contenido completos en el catálogo` };
    } else if (!usable(canonico, skuDelCatalogo(p))) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; la propuesta ${alt.sku} no se puede convertir desde las unidades de las recetas` };
    } else {
      skus[canonico] = skuDelCatalogo(p);
      motivo[canonico] = { origen: 'alternativa', detalle: `${porQue}; ${alt.motivo}`, revisado: alt.revisado === true } as any;
    }
  }
  fs.writeFileSync(RUTA_PROPUESTA, `${JSON.stringify({ zona: zonaId, fecha, skus, motivo }, null, 2)}\n`);
  const aAuditar = Object.entries(motivo).filter(([, m]) => m.origen === 'alternativa').map(([c]) => c);
  const cuenta = (o: string) => Object.values(motivo).filter((m) => m.origen === o).length;
  console.log(`mismo SKU ${cuenta('mismo-sku')} · alternativa ${cuenta('alternativa')} · ninguno ${cuenta('ninguno')}`);
  console.log(`\nAhora, en cada almacén de la zona:\n  node --experimental-strip-types catalogo/auditar-catalogo.ts <wh> --skus ${path.relative(process.cwd(), RUTA_PROPUESTA)} --solo ${aAuditar.join(',')}`);
}

if (paso === 'cerrar') {
  const propuesta = leer(RUTA_PROPUESTA);
  const auds = auditorias('');
  const audsAlt = auditorias(`-${zonaId}-propuesta-parcial`);

  const skus: Record<string, Sku | null> = {};
  const estado: Record<string, { origen: string; verificacion: string; detalle: string }> = {};
  for (const [canonico, s] of Object.entries<Sku | null>(propuesta.skus)) {
    const m = propuesta.motivo[canonico];
    if (!s) {
      skus[canonico] = null;
      estado[canonico] = { origen: 'ninguno', verificacion: 'sin producto', detalle: m.detalle };
      continue;
    }
    if (m.origen === 'mismo-sku') {
      skus[canonico] = s;
      estado[canonico] = { origen: 'mismo-sku', verificacion: 'existe y coincide en todos los almacenes', detalle: m.detalle };
      continue;
    }
    const filas = zona.almacenes.map((wh) => audsAlt.get(wh)!.get(canonico));
    const div = divergencia(filas);
    const ref = filas[0];
    const problemas: string[] = [];
    if (div) problemas.push(div);
    if (ref) {
      // Que ES ese ingrediente lo confirma quien revisa (`revisado`); la
      // auditoría confirma que existe, cuánto cuesta y qué alérgenos declara.
      // Una discrepancia la tumba aunque esté revisada.
      const graves = ref.hallazgos.filter((h) => h.gravedad === 'discrepancia').map((h) => h.campo);
      if (graves.length) problemas.push(`discrepancias: ${graves.join(', ')}`);
    }
    if (problemas.length) {
      skus[canonico] = null;
      estado[canonico] = { origen: 'alternativa rechazada', verificacion: 'no verificada', detalle: `${s.sku} ${s.nombre}: ${problemas.join('; ')}` };
    } else if (!m.revisado && !SUPONER_REVISADAS) {
      skus[canonico] = null;
      estado[canonico] = {
        origen: 'alternativa sin revisar',
        verificacion: `la auditoría no le encuentra problemas (correspondencia: ${ref!.correspondencia}); falta que un humano la apruebe en ${path.basename(RUTA_ALTERNATIVAS)}`,
        detalle: `${s.sku} ${s.nombre}`,
      };
    } else {
      skus[canonico] = s;
      estado[canonico] = {
        origen: 'alternativa',
        verificacion: `existe y coincide en todos los almacenes, sin discrepancias; revisada a mano (correspondencia automática: ${ref!.correspondencia})`,
        detalle: `${m.detalle} → ${s.sku} ${s.nombre}`,
      };
    }
  }

  // Procedencia: la consulta más antigua de las que sostienen el catálogo.
  const consultas = [...auds.values(), ...audsAlt.values()].flatMap((a) => [...a.values()].map((f) => f.procedencia.consultadoEn));
  const salida = {
    zona: zonaId,
    nombre: zona.nombre,
    cadena: 'mercadona',
    almacenes: zona.almacenes,
    /** La fecha de los precios: el día de la medición. Es la versión de la zona. */
    version: fecha,
    verificadoDesde: consultas.sort()[0],
    verificadoHasta: consultas.sort().at(-1),
    fuente: 'https://tienda.mercadona.es/api/products/<sku>/?wh=<almacén>, un almacén cada vez. Ver catalogo/construir-zona.ts.',
    codigosPostales: leer(zona.cps).codigos
      .filter((c: any) => c.isla !== 'control')
      .map((c: any) => ({ cp: c.cp, almacen: c.almacen })),
    skus,
    estado,
  };
  fs.mkdirSync(path.dirname(RUTA_SALIDA), { recursive: true });
  fs.writeFileSync(RUTA_SALIDA, `${JSON.stringify(salida, null, 2)}\n`);
  const cuenta = (f: (e: any) => boolean) => Object.values(estado).filter(f).length;
  console.log(`${zona.nombre}: ${cuenta((e) => e.origen === 'mismo-sku')} mismo SKU · ${cuenta((e) => e.origen === 'alternativa')} alternativas en uso · ${cuenta((e) => e.origen.includes('sin revisar'))} verificadas sin revisar · ${cuenta((e) => e.origen.includes('rechazada'))} rechazadas · ${cuenta((e) => e.origen === 'ninguno')} sin producto`);
  for (const [c, e] of Object.entries(estado)) if (e.origen !== 'mismo-sku') console.log(`  ${c.padEnd(24)} ${e.origen.padEnd(22)} ${e.detalle}`);
  console.log(`Escrito ${path.relative(process.cwd(), RUTA_SALIDA)}`);
}
