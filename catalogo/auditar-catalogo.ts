#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ AUDITORÍA DE TODOS LOS SKU QUE USA LA APP ═══
 *
 * Para cada ingrediente canónico con producto elegido —recetas, postres y
 * despensa— se pide el detalle a la API de Mercadona en un almacén y se
 * contrasta con lo que la app tiene en src/data/motor-datos.json:
 *
 *   datos         existe, nombre, precio, formato, unidades, peso variable
 *   conversión    que las cantidades de las recetas se puedan pasar al envase
 *                 y que el envase diga cuánto se aprovecha (peso escurrido)
 *   alérgenos     lo que declara la etiqueta HOY contra lo que dice el
 *                 vocabulario, trazas incluidas
 *   correspondencia  qué prueba hay de que el producto ES el ingrediente:
 *                 la lista legal de ingredientes, o solo la categoría, o solo
 *                 el nombre. Lo segundo y lo tercero NO verifican nada.
 *
 * Estado por SKU: `comprobado` solo si todo cuadra Y la correspondencia la
 * respalda la etiqueta. `discrepancia` si algo no cuadra. `pendiente` si falta
 * información para afirmarlo (descarga fallida, sin etiqueta, solo nombre).
 *
 * Una descarga fallida NO es un producto retirado: queda `pendiente` con su
 * motivo. Solo un 404 dice «no está en este almacén».
 *
 * Uso:
 *   node --experimental-strip-types catalogo/auditar-catalogo.ts mad3
 *   node --experimental-strip-types catalogo/auditar-catalogo.ts 4701 --solo canonico1,canonico2
 *   node --experimental-strip-types catalogo/auditar-catalogo.ts 4701 --skus catalogo/zonas/gran-canaria.json
 *
 * Con `--skus` se audita el catálogo de una zona (sus `skus` por canónico) en
 * vez del de motor-datos.json. Las recetas y el vocabulario son los mismos.
 *
 * Escribe:
 *   catalogo/auditoria/<almacen>-<fecha>.json   lo derivado, con procedencia y fecha
 *   catalogo/capturas-crudas/…                  la respuesta cruda (no va a git)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deMercadona, normalizar } from './alergenos-etiqueta.js';
import { BloqueoDetectado, producto } from './mercadona-api.ts';
import type { ProductoApi, Respuesta } from './mercadona-api.ts';
import type { DatosMotor, IngredienteCanonico, Sku } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const almacen = process.argv[2];
if (!almacen) { console.error('Uso: auditar-catalogo.ts <almacen> [--solo a,b]'); process.exit(1); }
const iSolo = process.argv.indexOf('--solo');
const solo = iSolo > -1 ? new Set(process.argv[iSolo + 1].split(',')) : null;
const iSkus = process.argv.indexOf('--skus');
const rutaSkus = iSkus > -1 ? path.resolve(process.argv[iSkus + 1]) : null;
const catalogo: Record<string, Sku | null> = rutaSkus
  ? JSON.parse(fs.readFileSync(rutaSkus, 'utf8')).skus
  : datos.skus;

/** Alérgenos que la app sabe filtrar (ver FILTROS en seleccionar.ts). */
const FILTRABLES = new Set(['gluten', 'lactosa', 'frutos_secos', 'cacahuete', 'huevo', 'pescado', 'marisco', 'soja', 'sesamo', 'mostaza', 'apio', 'sulfitos', 'cerdo']);
/** Palabras del id canónico que no dicen qué alimento es. */
const GENERICAS = new Set(['cocido', 'cocida', 'seco', 'seca', 'lata', 'congelado', 'congelada', 'fresco', 'fresca', 'postre', 'de', 'en', 'semi', 'molido', 'molida', 'dulce', 'rojo', 'roja', 'verde', 'blanca', 'blanco', 'negra', 'negro', 'natural', 'picada', 'picado', 'triturado', 'frito']);

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(',', '.')));
const unidadApi = (f?: string) => (f === 'kg' ? 'kg' : f === 'l' ? 'l' : f === 'ud' || f === 'uds' ? 'ud' : f ?? null);

interface Hallazgo { campo: string; app: unknown; mercadona: unknown; gravedad: 'discrepancia' | 'aviso' }

function tokens(canonico: string): string[] {
  return canonico.split('_').map(normalizar).filter((t) => t.length > 2 && !GENERICAS.has(t))
    // plurales y formas cortas: «cebolla» casa con «cebollas», «huevo» con «huevos»
    .map((t) => t.replace(/(es|s)$/, ''));
}
const contiene = (texto: string, ts: string[]) => ts.length > 0 && ts.some((t) => normalizar(texto).includes(t));

function categoriaDe(p: ProductoApi): string {
  const c = p.categories?.[0];
  const n2 = c?.categories?.[0];
  const n3 = n2?.categories?.[0];
  return [c?.name, n2?.name, n3?.name].filter(Boolean).join(' > ');
}

const usos = new Map<string, { recetas: Set<string>; unidades: Set<string> }>();
for (const r of datos.recetas) for (const i of r.ingredientes) {
  if (!usos.has(i.canonico)) usos.set(i.canonico, { recetas: new Set(), unidades: new Set() });
  usos.get(i.canonico)!.recetas.add(r.id);
  usos.get(i.canonico)!.unidades.add(i.unidad);
}
for (const lista of Object.values(datos.ensamblajes ?? {})) for (const e of lista) for (const i of e.ingredientes) {
  if (!usos.has(i.canonico)) usos.set(i.canonico, { recetas: new Set(), unidades: new Set() });
  usos.get(i.canonico)!.recetas.add(`ensamblaje:${e.id}`);
  usos.get(i.canonico)!.unidades.add(i.unidad);
}

const porSku = new Map<string, string[]>();
for (const [c, s] of Object.entries(catalogo)) if (s) porSku.set(s.sku, [...(porSku.get(s.sku) ?? []), c]);

const fecha = new Date().toISOString().slice(0, 10);
const crudas: Record<string, Respuesta<ProductoApi>> = {};
const filas: unknown[] = [];
let bloqueado: string | null = null;

// Un canónico a null en una zona es «sin producto en esta zona»: no hay nada que pedir.
const entradas = Object.entries(catalogo).filter((e): e is [string, Sku] => e[1] !== null && (!solo || solo.has(e[0])));
console.log(`Auditando ${entradas.length} SKU en el almacén ${almacen}…`);

for (const [canonico, sku] of entradas) {
  const meta = datos.ingredientes[canonico] as IngredienteCanonico & { es_postre?: boolean; trazas?: string[] };
  const papel = meta?.es_postre ? 'postre' : meta?.es_despensa ? 'despensa' : 'receta';
  const uso = usos.get(canonico);
  let r: Respuesta<ProductoApi>;
  try {
    r = await producto(sku.sku, almacen);
  } catch (err) {
    if (err instanceof BloqueoDetectado) { bloqueado = err.message; break; }
    throw err;
  }
  crudas[sku.sku] = r;
  const hallazgos: Hallazgo[] = [];
  const pendientes: string[] = [];
  let correspondencia = 'sin datos';
  let alergenos: { etiqueta: string[]; trazasEtiqueta: string[]; app: string[]; trazasApp: string[]; texto: string | null } | null = null;
  let mercadona: Record<string, unknown> | null = null;

  if (r.estado === 'no-existe') {
    hallazgos.push({ campo: 'existe', app: sku.sku, mercadona: '404 en este almacén', gravedad: 'discrepancia' });
  } else if (r.estado === 'fallo') {
    pendientes.push(`descarga fallida (${r.motivo}); no se puede afirmar que exista ni que falte`);
  } else {
    const p = r.datos;
    const pi = p.price_instructions ?? {};
    const precio = num(pi.unit_price);
    // Congelados sin neto en la ficha: el peso que vale es el escurrido (ver construir-zona.ts).
    const contenido = num(pi.unit_size) ?? num(pi.drained_weight);
    const unidad = unidadApi(pi.size_format);
    const unidades = pi.total_units ?? null;
    const escurrido = num(pi.drained_weight);
    mercadona = {
      nombre: p.display_name, ean: p.ean ?? null, packaging: p.packaging ?? null, precio, contenido, unidad, unidades,
      escurrido, granel: pi.approx_size ?? null, metodoVenta: pi.selling_method ?? null,
      precioReferencia: num(pi.reference_price), formatoReferencia: pi.reference_format ?? null,
      publicado: p.published ?? null, noDisponibleDesde: p.unavailable_from ?? null, categoria: categoriaDe(p),
      impuesto: num(pi.tax_percentage),
    };
    if (p.published === false) hallazgos.push({ campo: 'publicado', app: true, mercadona: false, gravedad: 'discrepancia' });
    if (p.unavailable_from) hallazgos.push({ campo: 'noDisponibleDesde', app: null, mercadona: p.unavailable_from, gravedad: 'discrepancia' });
    if (p.display_name !== sku.nombre) hallazgos.push({ campo: 'nombre', app: sku.nombre, mercadona: p.display_name, gravedad: 'aviso' });
    if (precio === null || Math.abs(precio - sku.precio) > 0.005) hallazgos.push({ campo: 'precio', app: sku.precio, mercadona: precio, gravedad: 'discrepancia' });
    // El neto de la etiqueta: `contenido_etiqueta` en las conservas, `contenido` en lo demás.
    const neto = sku.contenido_etiqueta ?? sku.contenido;
    if (contenido === null || Math.abs(contenido - neto) > 1e-6) hallazgos.push({ campo: 'contenido', app: neto, mercadona: contenido, gravedad: 'discrepancia' });
    if (unidad !== sku.unidad) hallazgos.push({ campo: 'unidad', app: sku.unidad, mercadona: unidad, gravedad: 'discrepancia' });
    if ((unidades ?? null) !== (sku.unidades_pack ?? null) && !(unidad === 'ud')) {
      hallazgos.push({ campo: 'unidadesPack', app: sku.unidades_pack, mercadona: unidades, gravedad: sku.unidades_pack === null ? 'aviso' : 'discrepancia' });
    }
    if (Boolean(pi.approx_size) !== Boolean(sku.peso_variable)) hallazgos.push({ campo: 'pesoVariable', app: sku.peso_variable, mercadona: pi.approx_size, gravedad: 'discrepancia' });
    if ((p.packaging ?? null) !== (sku.packaging ?? null)) hallazgos.push({ campo: 'packaging', app: sku.packaging, mercadona: p.packaging ?? null, gravedad: 'aviso' });
    // El precio por unidad interno tiene que salir del precio y el contenido.
    if (sku.contenido > 0 && Math.abs(sku.precio / sku.contenido - sku.precio_kg_l_ud) > 0.011) {
      hallazgos.push({ campo: 'precioPorUnidadInterno', app: sku.precio_kg_l_ud, mercadona: Number((sku.precio / sku.contenido).toFixed(4)), gravedad: 'discrepancia' });
    }

    // ── conversión ─────────────────────────────────────────────────────────
    for (const u of uso?.unidades ?? []) {
      const ok = (u === 'g' && sku.unidad === 'kg') || (u === 'ml' && sku.unidad === 'l') || (u === 'ud' && (sku.unidad === 'ud' || sku.unidades_pack != null || sku.packaging === 'Pieza'));
      if (!ok) hallazgos.push({ campo: 'conversion', app: `receta en ${u}`, mercadona: `envase en ${sku.unidad}${sku.unidades_pack ? ` · ${sku.unidades_pack} uds` : ''}`, gravedad: 'discrepancia' });
      if (u === 'ud' && sku.unidad !== 'ud' && sku.unidades_pack == null && sku.packaging === 'Pieza') {
        pendientes.push(`la receta cuenta piezas y el producto se vende a peso (${sku.contenido} ${sku.unidad} por pieza, de la ficha): sin verificar en tienda`);
      }
    }
    // Lo que va en líquido rinde su escurrido (ver escurridos.ts). Cualquier
    // producto con escurrido de verdad, no una lista de nombres: el queso
    // fresco y el tofu también lo traen.
    if (escurrido && escurrido > 0 && contenido && escurrido / contenido < 0.97) {
      const ratio = escurrido / contenido;
      if (sku.contenido_etiqueta == null) {
        hallazgos.push({
          campo: 'pesoEscurrido', app: `se usa el neto: ${sku.contenido} ${sku.unidad} por envase`,
          mercadona: `escurrido ${escurrido} de ${contenido} (${Math.round(ratio * 100)} %)`, gravedad: 'discrepancia',
        });
      } else if (Math.abs(sku.contenido - escurrido) > 1e-6) {
        hallazgos.push({ campo: 'pesoEscurrido', app: `escurrido ${sku.contenido}`, mercadona: `escurrido ${escurrido}`, gravedad: 'discrepancia' });
      }
    } else if (sku.contenido_etiqueta != null) {
      hallazgos.push({ campo: 'pesoEscurrido', app: `escurrido ${sku.contenido} de ${sku.contenido_etiqueta}`, mercadona: 'la ficha no da escurrido', gravedad: 'discrepancia' });
    }

    // ── alérgenos ──────────────────────────────────────────────────────────
    const etiqueta = deMercadona(p.nutrition_information);
    const declarados = new Set<string>([
      // Los postres declaran «Lactosa», «Huevo», «Soja» (el nombre del filtro);
      // las recetas, «lactosa». Se compara sin mayúsculas.
      ...(meta?.alergenos ?? []).map((a) => String(a).toLowerCase()),
      ...(meta?.origen === 'huevo' ? ['huevo'] : []), ...(meta?.origen === 'lacteo' ? ['lactosa'] : []),
      ...(meta?.origen === 'pescado' ? ['pescado'] : []), ...(meta?.origen === 'marisco' ? ['marisco'] : []),
    ]);
    const trazasApp = new Set<string>((meta?.trazas ?? []).map((a) => String(a).toLowerCase()));
    const conEtiqueta = Boolean(p.nutrition_information?.ingredients || p.nutrition_information?.allergens);
    alergenos = {
      etiqueta: etiqueta.contiene, trazasEtiqueta: etiqueta.trazas, app: [...declarados], trazasApp: [...trazasApp],
      texto: etiqueta.alergenosTexto ?? null,
    };
    if (!conEtiqueta) {
      pendientes.push('sin lista de ingredientes ni alérgenos en la ficha: los alérgenos no se pueden contrastar');
    } else {
      for (const a of etiqueta.contiene) {
        if (FILTRABLES.has(a) && !declarados.has(a)) hallazgos.push({ campo: 'alergeno', app: [...declarados], mercadona: `contiene ${a}`, gravedad: 'discrepancia' });
      }
      for (const a of etiqueta.trazas) {
        if (FILTRABLES.has(a) && !declarados.has(a) && !trazasApp.has(a)) hallazgos.push({ campo: 'trazas', app: [...trazasApp], mercadona: `puede contener ${a}`, gravedad: 'discrepancia' });
      }
      for (const a of declarados) {
        if (FILTRABLES.has(a) && !etiqueta.contiene.includes(a) && !etiqueta.trazas.includes(a)) {
          hallazgos.push({ campo: 'alergenoDeMas', app: `declara ${a}`, mercadona: 'la etiqueta no lo dice', gravedad: 'aviso' });
        }
      }
    }

    // ── correspondencia ────────────────────────────────────────────────────
    const ts = tokens(canonico);
    const primerIngrediente = (etiqueta.ingredientes ?? '').split(/[,(.:]/)[0] ?? '';
    if (etiqueta.ingredientes && contiene(primerIngrediente, ts)) correspondencia = 'etiqueta';
    else if (contiene(categoriaDe(p), ts)) correspondencia = 'categoria';
    else if (contiene(p.display_name, ts)) correspondencia = 'nombre';
    else correspondencia = 'sin evidencia';
    if (correspondencia !== 'etiqueta') {
      pendientes.push(correspondencia === 'sin evidencia'
        ? 'ni la etiqueta, ni la categoría, ni el nombre nombran el ingrediente: revisar a mano'
        : `la correspondencia solo la respalda ${correspondencia === 'nombre' ? 'el nombre' : 'la categoría'}: falta revisión humana`);
    }
  }

  const otros = (porSku.get(sku.sku) ?? []).filter((c) => c !== canonico);
  if (otros.length) hallazgos.push({ campo: 'duplicado', app: `mismo SKU que ${otros.join(', ')}`, mercadona: null, gravedad: 'aviso' });
  if (!uso && papel === 'receta') hallazgos.push({ campo: 'sinUso', app: 'ninguna receta lo usa', mercadona: null, gravedad: 'aviso' });

  const graves = hallazgos.filter((h) => h.gravedad === 'discrepancia');
  const estado = graves.length ? 'discrepancia' : pendientes.length ? 'pendiente' : 'comprobado';
  filas.push({
    canonico, papel, sku: sku.sku, nombreApp: sku.nombre, estado, correspondencia,
    recetas: uso?.recetas.size ?? 0, unidadesReceta: [...(uso?.unidades ?? [])],
    app: { precio: sku.precio, contenido: sku.contenido, unidad: sku.unidad, unidadesPack: sku.unidades_pack, pesoVariable: sku.peso_variable, packaging: sku.packaging, precioPorUnidad: sku.precio_kg_l_ud },
    mercadona, alergenos, hallazgos, pendientes,
    procedencia: { fuente: r.url, consultadoEn: r.en, http: r.http, respuesta: r.estado, ...(r.estado === 'fallo' ? { motivo: r.motivo } : {}) },
  });
  process.stdout.write(estado === 'comprobado' ? '.' : estado === 'pendiente' ? 'p' : 'D');
}
console.log('');

fs.mkdirSync(path.join(aqui, 'capturas-crudas'), { recursive: true });
fs.writeFileSync(path.join(aqui, 'capturas-crudas', `${almacen}-${fecha}.json`), JSON.stringify(crudas));
fs.mkdirSync(path.join(aqui, 'auditoria'), { recursive: true });
const sufijo = `${rutaSkus ? `-${path.basename(rutaSkus, '.json')}` : ''}${solo ? '-parcial' : ''}`;
const salida = path.join(aqui, 'auditoria', `${almacen}-${fecha}${sufijo}.json`);
fs.writeFileSync(salida, `${JSON.stringify({
  almacen, auditadoEn: new Date().toISOString(), catalogoApp: datos.generadoEn,
  ...(rutaSkus ? { catalogoAuditado: path.relative(path.join(aqui, '..'), rutaSkus) } : {}),
  ...(bloqueado ? { interrumpida: bloqueado } : {}), filas,
}, null, 2)}\n`);

const cuenta = (e: string) => filas.filter((f) => (f as { estado: string }).estado === e).length;
console.log(`comprobado ${cuenta('comprobado')} · discrepancia ${cuenta('discrepancia')} · pendiente ${cuenta('pendiente')} · de ${filas.length}`);
if (bloqueado) console.log(`INTERRUMPIDA: ${bloqueado}`);
console.log(`Escrito ${salida}`);
