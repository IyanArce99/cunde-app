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
 * Dos capas:
 *   · `skus`        lo que existe igual en TODOS los almacenes de la zona.
 *   · `porAlmacen`  lo que existe igual solo en ALGUNOS: el caldo de verduras
 *                   de Madrid en 4701 y 4570, la barra de pan 83264.1 en ocho de
 *                   nueve. Se aplica encima cuando el código postal cae en ese
 *                   almacén (src/motor/zona.ts). Sin ella, lo que no está en
 *                   todos se perdía para todos.
 *
 * Tres pasos, porque en medio hay que preguntar a la red y eso no se hace a
 * escondidas de nadie:
 *
 *   1. proponer   Sin red. Para cada canónico: el SKU de Madrid donde exista
 *                 igual; donde no, la alternativa escrita a mano en
 *                 <zona>-alternativas.json, si se puede convertir desde las
 *                 unidades de las recetas.
 *   2. auditar    Con red: auditar-catalogo.ts --skus <propuesta> --solo <alternativas>
 *                 en cada almacén. Lo hace quien ejecuta, no este script.
 *   3. cerrar     Sin red. Un SKU vale en un almacén solo si:
 *                   · existe allí (HTTP 200) —un fallo de descarga NO cuenta
 *                     como «no existe», pero tampoco como «existe»: ese
 *                     almacén queda fuera—;
 *                   · da el mismo precio y formato en todos los almacenes donde
 *                     existe, o, si es de peso variable, el mismo precio por
 *                     kilo (±1 %);
 *                   · está publicado y sin fecha de baja;
 *                   · si es ALTERNATIVA, además, tres cosas que no se mezclan:
 *                     1. validación TÉCNICA (<zona>-alternativas.json): formato,
 *                        cantidades, ingredientes y alérgenos, cada uno `ok`,
 *                        `segun-perfil`, `pendiente` o `incompatible`, con su
 *                        evidencia. Una pendiente o incompatible la deja fuera;
 *                     2. aceptación CULINARIA (<zona>-aceptacion.json): solo la
 *                        da una persona, y no valida nada técnico;
 *                     3. COMPATIBILIDAD por perfil: lo que la etiqueta declara y
 *                        el vocabulario no (`segun-perfil`) se añade en la zona
 *                        (`alergenos_zona`, `trazas_zona`) y filtra con las reglas
 *                        de la app; no se rechaza para todos.
 *                     Y la auditoría no encuentra otra discrepancia.
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
    // los demás lo dice la auditoría, no esta elección. Si hay más catálogos
    // completos de la zona en capturas-crudas/, también se miran.
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
const RUTA_SALIDA = process.argv.includes('--suponer-aceptadas')
  ? path.join(aqui, 'capturas-crudas', `zona-${zonaId}-supuesta.json`)
  : path.join(aqui, '..', 'src', 'data', 'zonas', `${zonaId}.json`);
const RUTA_ALTERNATIVAS = path.join(aqui, 'zonas', `${zonaId}-alternativas.json`);
/** La aceptación CULINARIA, que solo da una persona. La técnica va en RUTA_ALTERNATIVAS. */
const RUTA_ACEPTACION = path.join(aqui, 'zonas', `${zonaId}-aceptacion.json`);
/**
 * Para MEDIR qué cambiaría si aceptaras todas, sin tocar el catálogo de la app.
 * Supone la aceptación culinaria, NUNCA la técnica: lo que tenga una dimensión
 * pendiente o incompatible sigue fuera.
 */
const SUPONER_ACEPTADAS = process.argv.includes('--suponer-aceptadas');

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
  /* El marisco y el pescado congelados no traen neto en la ficha, solo el
     escurrido (sin glaseo), y Mercadona calcula su precio de referencia sobre
     él: la gamba pelada, 4,95 € / 0,36 kg = 13,75 €/kg. Ese es su peso. */
  const contenido = p.contenido ?? p.peso_escurrido;
  const s: Sku = {
    sku: p.sku, nombre: p.nombre, contenido, unidad: p.unidad_contenido,
    precio: p.precio, precio_kg_l_ud: Number((p.precio / contenido).toFixed(3)),
    packaging: p.packaging, unidades_pack: p.unidades_pack, peso_variable: p.peso_variable,
    departamento: p.departamento, subfamilia: p.subfamilia,
  };
  if (p.contenido && p.peso_escurrido && p.peso_escurrido / p.contenido < 0.97) {
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

/**
 * DÓNDE existe este SKU y es el mismo: los almacenes con HTTP 200, publicado,
 * sin fecha de baja, y con el mismo precio y formato que los demás de la lista
 * (o, si es de peso variable, el mismo precio por kilo, ±1 %). Un almacén con
 * descarga fallida no entra: ni existe ni falta, no se sabe.
 *
 * Si los que lo tienen no coinciden entre sí, no vale en ninguno: no se elige
 * a ojo cuál es el bueno.
 */
function coincidencia(filas: [string, Fila | undefined][]): { en: string[]; motivo: string | null } {
  const sinAuditar = filas.filter(([, f]) => !f).length;
  const fallos = filas.filter(([, f]) => f?.procedencia.respuesta === 'fallo').length;
  const ok = filas.filter(([, f]) => f?.procedencia.respuesta === 'ok'
    && f.mercadona.publicado !== false && !f.mercadona.noDisponibleDesde) as [string, Fila][];
  const ausentes = filas.length - sinAuditar - fallos - ok.length;
  const notas = [
    sinAuditar ? `sin auditar en ${sinAuditar}` : '',
    fallos ? `descarga fallida en ${fallos} (ni existe ni falta)` : '',
    ausentes ? `no existe en ${ausentes} de ${filas.length} almacenes` : '',
  ].filter(Boolean);
  if (!ok.length) return { en: [], motivo: notas.join('; ') || 'no existe' };
  const ms = ok.map(([, f]) => f.mercadona);
  if (ms.every((m) => m.granel)) {
    const kilos = ms.map((m) => m.precio / (m.contenido ?? m.escurrido));
    const [min, max] = [Math.min(...kilos), Math.max(...kilos)];
    if ((max - min) / min > 0.01) return { en: [], motivo: `peso variable con precio por kilo distinto: ${min.toFixed(2)}–${max.toFixed(2)} €` };
  } else {
    const huellas = new Set(ms.map((m) => `${m.precio}|${m.contenido}|${m.escurrido}|${m.unidades}`));
    if (huellas.size > 1) return { en: [], motivo: `precio o formato distinto entre almacenes: ${[...huellas].join(' · ')}` };
  }
  return { en: ok.map(([wh]) => wh), motivo: ok.length === filas.length ? null : notas.join('; ') };
}

/** Las filas de un canónico en cada almacén de la zona. */
const filasDe = (auds: Map<string, Map<string, Fila>>, canonico: string): [string, Fila | undefined][] =>
  zona.almacenes.map((wh) => [wh, auds.get(wh)!.get(canonico)]);

/** Los catálogos completos que haya de la zona: un SKU puede no estar en el de referencia. */
function catalogosDeLaZona(): Map<string, any> {
  const porSku = new Map<string, any>();
  for (const wh of [zona.referencia, ...zona.almacenes]) {
    const r = path.join(aqui, 'capturas-crudas', `catalogo_mercadona_${wh}_${fecha}.json`);
    if (!fs.existsSync(r)) continue;
    for (const p of leer(r)) if (!porSku.has(p.sku)) porSku.set(p.sku, p);
  }
  return porSku;
}

if (paso === 'proponer') {
  const auds = auditorias('');
  const porSku = catalogosDeLaZona();
  const alternativas: Record<string, { sku: string | null; motivo: string }> =
    leer(RUTA_ALTERNATIVAS).alternativas;

  const skus: Record<string, Sku | null> = {};
  const motivo: Record<string, { origen: 'mismo-sku' | 'alternativa' | 'ninguno'; detalle: string }> = {};
  /* El SKU de Madrid donde SÍ está igual, cuando no está en todos. Es el mismo
     producto, así que no necesita revisión: solo vale en esos almacenes. */
  const madridParcial: Record<string, { sku: Sku; almacenes: string[] }> = {};
  for (const [canonico, madrid] of Object.entries(datos.skus)) {
    const { en, motivo: div } = coincidencia(filasDe(auds, canonico));
    const enCatalogo = porSku.get(madrid.sku);
    if (en.length === zona.almacenes.length && enCatalogo) {
      skus[canonico] = skuDelCatalogo(enCatalogo);
      motivo[canonico] = { origen: 'mismo-sku', detalle: 'el SKU de Madrid, igual en todos los almacenes de la zona' };
      continue;
    }
    if (en.length && enCatalogo) madridParcial[canonico] = { sku: skuDelCatalogo(enCatalogo), almacenes: en };
    // Una alternativa: la que propone <zona>-alternativas.json, escrita a mano.
    // Buscarla sola salió mal —«filetes de hígado» por entrecot, «caldo de
    // pollo» por caldo de verduras— y es justo lo que la guía del proyecto deja
    // para un humano: la máquina propone, alguien revisa.
    const alt = alternativas[canonico];
    const p = alt?.sku ? porSku.get(alt.sku) : null;
    const porQue = `el de Madrid (${madrid.sku}): ${div ?? 'no está en el catálogo de la zona'}`;
    const peso = p ? (p.contenido ?? p.peso_escurrido) : null;
    if (!alt) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; nadie ha propuesto alternativa` };
    } else if (!alt.sku) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; ${alt.motivo}` };
    } else if (!p || !(p.precio > 0) || !(peso > 0)) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; la propuesta ${alt.sku} no tiene precio y peso en ningún catálogo de la zona` };
    } else if (!usable(canonico, skuDelCatalogo(p))) {
      skus[canonico] = null;
      motivo[canonico] = { origen: 'ninguno', detalle: `${porQue}; la propuesta ${alt.sku} no se puede convertir desde las unidades de las recetas` };
    } else {
      skus[canonico] = skuDelCatalogo(p);
      motivo[canonico] = { origen: 'alternativa', detalle: `${porQue}; ${alt.motivo}` };
    }
  }
  fs.writeFileSync(RUTA_PROPUESTA, `${JSON.stringify({ zona: zonaId, fecha, skus, motivo, madridParcial }, null, 2)}\n`);
  const aAuditar = Object.entries(motivo).filter(([, m]) => m.origen === 'alternativa').map(([c]) => c);
  const cuenta = (o: string) => Object.values(motivo).filter((m) => m.origen === o).length;
  console.log(`mismo SKU ${cuenta('mismo-sku')} · alternativa ${cuenta('alternativa')} · ninguno ${cuenta('ninguno')}`);
  console.log(`de Madrid solo en algunos almacenes: ${Object.entries(madridParcial).map(([c, x]) => `${c} (${x.almacenes.join(',')})`).join(' · ') || '—'}`);
  console.log(`\nAhora, en cada almacén de la zona:\n  node --experimental-strip-types catalogo/auditar-catalogo.ts <wh> --skus ${path.relative(process.cwd(), RUTA_PROPUESTA)} --solo ${aAuditar.join(',')}`);
}

if (paso === 'cerrar') {
  const propuesta = leer(RUTA_PROPUESTA);
  type Dimension = { estado: 'ok' | 'pendiente' | 'segun-perfil' | 'incompatible'; nota: string; falta?: string; anadirEnLaZona?: { alergenos?: string[]; trazas?: string[] } };
  const tecnicaDe: Record<string, { tecnica?: Record<string, Dimension> }> = leer(RUTA_ALTERNATIVAS).alternativas;
  const aceptada: Record<string, boolean | null> = fs.existsSync(RUTA_ACEPTACION) ? leer(RUTA_ACEPTACION).decisiones : {};
  const auds = auditorias('');
  const audsAlt = auditorias(`-${zonaId}-propuesta-parcial`);

  const skus: Record<string, Sku | null> = {};
  /* `almacenes`: dónde vale la alternativa, si no es en todos. `madridEn`:
     dónde vale el SKU de Madrid, si solo en algunos. Pueden estar los dos. */
  const estado: Record<string, { origen: string; verificacion: string; detalle: string; almacenes?: string[]; madridEn?: string[] }> = {};
  /* Lo que vale solo en algunos almacenes. Se aplica encima de `skus` cuando el
     código postal cae en ese almacén (src/motor/zona.ts). */
  const porAlmacen: Record<string, Record<string, Sku>> = {};
  const poner = (almacenes: string[], canonico: string, s: Sku) => {
    for (const wh of almacenes) (porAlmacen[wh] ??= {})[canonico] = s;
  };
  /* Si la auditoría no encontró ni lista de ingredientes ni texto de alérgenos,
     lo que ese producto declara es DESCONOCIDO, que no es «nada». Lo leen los
     postres (src/motor/postres.ts). */
  const sinEtiqueta = (f: Fila | undefined) =>
    (f?.pendientes ?? []).some((x) => x.startsWith('sin lista de ingredientes'));
  const marcar = (s: Sku, f: Fila | undefined): Sku => (sinEtiqueta(f) ? { ...s, alergenos_desconocidos: true } : s);
  for (const [canonico, x] of Object.entries<{ sku: Sku; almacenes: string[] }>(propuesta.madridParcial ?? {})) {
    poner(x.almacenes, canonico, marcar(x.sku, auds.get(x.almacenes[0])!.get(canonico)));
  }

  for (const [canonico, s] of Object.entries<Sku | null>(propuesta.skus)) {
    const m = propuesta.motivo[canonico];
    const madridEn: string[] = propuesta.madridParcial?.[canonico]?.almacenes ?? [];
    const conMadrid = madridEn.length ? { madridEn } : {};
    if (!s) {
      skus[canonico] = null;
      estado[canonico] = {
        origen: 'ninguno',
        verificacion: madridEn.length ? `el de Madrid solo en ${madridEn.join(', ')}` : 'sin producto',
        detalle: m.detalle,
        ...conMadrid,
      };
      continue;
    }
    if (m.origen === 'mismo-sku') {
      /* El mismo producto que en Madrid, igual en los nueve almacenes. Entra
         si ESTÁ VERIFICADO: la etiqueta o una comprobación a mano
         (verificaciones.json) respaldan que es el ingrediente, sin nada
         pendiente ni alérgenos que no cuadren. La despensa (aceite, sal,
         especias) se asume en casa y queda fuera del total: entra igual, con
         su estado dicho. */
      const fila = auds.get(zona.almacenes[0])!.get(canonico);
      const correspondencia = ['etiqueta', 'verificada a mano'].includes(fila?.correspondencia ?? '');
      const alergenosMal = (fila?.hallazgos ?? []).some((h) => (h.campo === 'alergeno' || h.campo === 'trazas') && h.gravedad === 'discrepancia');
      const verificado = correspondencia && !(fila?.pendientes.length) && !alergenosMal;
      const despensa = datos.ingredientes[canonico]?.es_despensa === true;
      if (verificado || despensa) {
        skus[canonico] = marcar(s, fila);
        estado[canonico] = {
          origen: 'mismo-sku',
          verificacion: verificado ? 'existe y coincide en todos los almacenes; verificado' : `existe y coincide; despensa, se asume en casa (sin verificar: ${(fila?.pendientes ?? []).join('; ')})`,
          detalle: m.detalle,
        };
      } else {
        skus[canonico] = null;
        estado[canonico] = {
          origen: 'mismo-sku sin verificar',
          verificacion: [...(fila?.pendientes ?? []), ...(alergenosMal ? ['alérgenos que no cuadran con el vocabulario'] : [])].join('; ') || 'sin auditoría',
          detalle: `${s.sku} ${s.nombre}`,
        };
      }
      continue;
    }
    const { en, motivo: div } = coincidencia(filasDe(audsAlt, canonico));
    const ref = en.length ? audsAlt.get(en[0])!.get(canonico) : undefined;
    // Donde ya está el de Madrid, manda el de Madrid: es el mismo producto.
    const dondeVa = en.filter((wh) => !madridEn.includes(wh));
    const parcial = dondeVa.length < zona.almacenes.length;
    const problemas: string[] = [];
    if (!en.length) problemas.push(div ?? 'no existe');
    // La validación TÉCNICA: formato, cantidades, ingredientes, alérgenos.
    const tecnica = tecnicaDe[canonico]?.tecnica ?? {};
    const abiertas = Object.entries(tecnica).filter(([, d]) => d.estado === 'pendiente' || d.estado === 'incompatible');
    for (const [dim, d] of abiertas) problemas.push(`${dim} ${d.estado}: ${d.falta ?? d.nota}`);
    if (!Object.keys(tecnica).length) problemas.push('sin validación técnica');
    // Lo que la alternativa declara y el vocabulario no, si se ha decidido
    // llevarlo a la zona (`segun-perfil`): filtra con las reglas de siempre.
    const anadir = tecnica.alergenos?.estado === 'segun-perfil' ? tecnica.alergenos.anadirEnLaZona ?? {} : {};
    if (ref) {
      // La auditoría confirma que existe, cuánto cuesta y qué alérgenos declara.
      // Una discrepancia la tumba, salvo un alérgeno o traza que ya va a la zona.
      for (const h of ref.hallazgos.filter((x) => x.gravedad === 'discrepancia')) {
        const texto = String((h as { mercadona?: unknown }).mercadona ?? '');
        const cubierto = (h.campo === 'trazas' && (anadir.trazas ?? []).some((t) => texto.includes(t)))
          || (h.campo === 'alergeno' && (anadir.alergenos ?? []).some((t) => texto.includes(t)));
        if (!cubierto) problemas.push(`discrepancia de auditoría: ${h.campo}`);
      }
    }
    const conZona: Sku = {
      ...marcar(s, ref),
      ...(anadir.alergenos?.length ? { alergenos_zona: anadir.alergenos as Sku['alergenos_zona'] } : {}),
      ...(anadir.trazas?.length ? { trazas_zona: anadir.trazas as Sku['trazas_zona'] } : {}),
    };
    const culinaria = SUPONER_ACEPTADAS || aceptada[canonico] === true;
    skus[canonico] = null;
    if (problemas.length) {
      estado[canonico] = {
        origen: aceptada[canonico] === false ? 'alternativa no aceptada' : 'alternativa no validada',
        verificacion: problemas.join(' · '),
        detalle: `${s.sku} ${s.nombre}`,
        ...(parcial && en.length ? { almacenes: dondeVa } : {}),
        ...conMadrid,
      };
    } else if (aceptada[canonico] === false) {
      estado[canonico] = { origen: 'alternativa no aceptada', verificacion: 'validada técnicamente; no la aceptas para cocinar', detalle: `${s.sku} ${s.nombre}`, ...conMadrid };
    } else if (!culinaria) {
      estado[canonico] = {
        origen: 'alternativa sin aceptar',
        verificacion: `validada técnicamente en ${parcial ? dondeVa.join(', ') : 'los nueve almacenes'}; falta tu aceptación culinaria en ${path.basename(RUTA_ACEPTACION)}`,
        detalle: `${s.sku} ${s.nombre}`,
        ...(parcial ? { almacenes: dondeVa } : {}),
        ...conMadrid,
      };
    } else {
      if (parcial) poner(dondeVa, canonico, conZona);
      else skus[canonico] = conZona;
      estado[canonico] = {
        origen: 'alternativa',
        verificacion: `validada técnicamente y aceptada; vale en ${parcial ? dondeVa.join(', ') : 'todos los almacenes'}${anadir.trazas?.length || anadir.alergenos?.length ? `; en la zona declara además ${[...(anadir.alergenos ?? []), ...(anadir.trazas ?? []).map((t) => `trazas de ${t}`)].join(', ')}` : ''}`,
        detalle: `${m.detalle} → ${s.sku} ${s.nombre}`,
        ...(parcial ? { almacenes: dondeVa } : {}),
        ...conMadrid,
      };
    }
  }

  // Procedencia: la consulta más antigua y la más nueva de las que sostienen el catálogo.
  const consultas = [...auds.values(), ...audsAlt.values()].flatMap((a) => [...a.values()].map((f) => f.procedencia.consultadoEn)).sort();
  const salida = {
    zona: zonaId,
    nombre: zona.nombre,
    cadena: 'mercadona',
    almacenes: zona.almacenes,
    /** La fecha de los precios: el día de la medición. Es la versión de la zona. */
    version: fecha,
    verificadoDesde: consultas[0],
    verificadoHasta: consultas.at(-1),
    fuente: 'https://tienda.mercadona.es/api/products/<sku>/?wh=<almacén>, un almacén cada vez: precios y disponibilidad de la TIENDA ONLINE. Ver catalogo/construir-zona.ts.',
    codigosPostales: leer(zona.cps).codigos
      .filter((c: any) => c.isla !== 'control')
      .map((c: any) => ({ cp: c.cp, almacen: c.almacen })),
    skus,
    porAlmacen,
    estado,
  };
  fs.mkdirSync(path.dirname(RUTA_SALIDA), { recursive: true });
  fs.writeFileSync(RUTA_SALIDA, `${JSON.stringify(salida, null, 2)}\n`);
  const cuenta = (f: (e: any) => boolean) => Object.values(estado).filter(f).length;
  console.log(`${zona.nombre}: ${cuenta((e) => e.origen === 'mismo-sku')} mismo SKU · ${cuenta((e) => e.origen === 'mismo-sku sin verificar')} mismo SKU sin verificar · ${cuenta((e) => e.origen === 'alternativa')} alternativas en uso · ${cuenta((e) => e.origen === 'alternativa sin aceptar')} validadas sin aceptar · ${cuenta((e) => e.origen === 'alternativa no validada')} no validadas · ${cuenta((e) => e.origen === 'alternativa no aceptada')} no aceptadas · ${cuenta((e) => e.origen === 'ninguno')} sin producto común`);
  for (const [c, e] of Object.entries(estado)) if (e.origen !== 'mismo-sku') console.log(`  ${c.padEnd(24)} ${e.origen.padEnd(23)} ${e.almacenes ? `[${e.almacenes.join(',')}] ` : ''}${e.madridEn ? `(Madrid en ${e.madridEn.join(',')}) ` : ''}${e.detalle}`);
  for (const [wh, x] of Object.entries(porAlmacen)) console.log(`  solo en ${wh}: ${Object.entries(x).map(([c, s]) => `${c} ${s.sku}`).join(' · ')}`);
  console.log(`Escrito ${path.relative(process.cwd(), RUTA_SALIDA)}`);
}
