import fs from 'node:fs';
import path from 'node:path';
/**
 * ═══ LO QUE DICE LA ETIQUETA, CLASIFICADO ═══
 *
 * Extraído de enriquecer.js para que la auditoría del catálogo use EXACTAMENTE
 * el mismo clasificador que alimenta alergenos-por-ean.json. Dos copias de esto
 * acabarían dando dos respuestas distintas a «¿lleva gluten?».
 */

export const normalizar = (t) => (t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Términos de la etiqueta española -> alérgeno/origen nuestro. */
export const TERMINOS = [
  { clave: 'gluten', palabras: ['gluten', 'trigo', 'cebada', 'centeno', 'avena', 'espelta', 'kamut', 'semola'] },
  { clave: 'lactosa', palabras: ['leche', 'lacteo', 'lactosa', 'nata', 'queso', 'mantequilla', 'suero lacteo', 'caseina'] },
  // El cacahuete va aparte: es una legumbre, no un fruto de cáscara, y el
  // reglamento 1169/2011 lo lista como alérgeno propio. Meterlo dentro de
  // "frutos secos" dejaba a un alérgico al cacahuete sin filtro propio y le
  // quitaba de más al que solo lo es a la almendra.
  // «Frutos de cáscara» es el término LEGAL del reglamento, y el que usan las
  // etiquetas cuando no nombran uno concreto («puede contener frutos de
  // cáscara», el yogur Danone). Sin él se perdía esa traza entera.
  { clave: 'frutos_secos', palabras: ['almendra', 'avellana', 'nuez', 'nueces', 'anacardo', 'pistacho', 'macadamia', 'pecana', 'frutos de cascara', 'fruto de cascara', 'frutos secos'] },
  { clave: 'cacahuete', palabras: ['cacahuete', 'cacahuate', 'mani'] },
  { clave: 'huevo', palabras: ['huevo', 'ovoalbumina', 'clara de huevo', 'yema'] },
  { clave: 'pescado', palabras: ['pescado', 'anchoa', 'atun', 'bacalao', 'merluza', 'sardina', 'caballa', 'boqueron', 'salmon'] },
  { clave: 'marisco', palabras: ['crustaceo', 'molusco', 'gamba', 'langostino', 'mejillon', 'calamar', 'sepia', 'almeja', 'berberecho', 'cangrejo'] },
  { clave: 'cerdo', palabras: ['cerdo', 'porcino', 'tocino', 'panceta', 'jamon', 'bacon', 'chorizo', 'manteca de cerdo'] },
  { clave: 'soja', palabras: ['soja'] },
  { clave: 'apio', palabras: ['apio'] },
  { clave: 'mostaza', palabras: ['mostaza'] },
  { clave: 'sesamo', palabras: ['sesamo'] },
  { clave: 'sulfitos', palabras: ['sulfito', 'disulfito', 'anhidrido sulfuroso', 'metabisulfito'] },
];

/** Etiquetas de Open Food Facts -> lo mismo. */
export const TAGS_OFF = {
  'en:gluten': 'gluten', 'en:milk': 'lactosa', 'en:eggs': 'huevo', 'en:fish': 'pescado',
  'en:crustaceans': 'marisco', 'en:molluscs': 'marisco', 'en:nuts': 'frutos_secos',
  'en:peanuts': 'cacahuete', 'en:soybeans': 'soja', 'en:celery': 'apio',
  'en:mustard': 'mostaza', 'en:sesame-seeds': 'sesamo', 'en:sulphur-dioxide-and-sulphites': 'sulfitos',
};

/**
 * Lo resaltado en <strong> dentro de la lista de ingredientes ES la
 * declaración legal de alérgenos. Se lee de ahí y, además, del texto entero
 * por si el resaltado viene mal puesto.
 */
/**
 * Una etiqueta dice tres cosas distintas y hay que separarlas o el resultado
 * miente en las dos direcciones:
 *
 *   "Sémola de trigo (gluten)"            -> LO LLEVA
 *   "Puede contener trazas de huevos"     -> trazas, no ingrediente
 *   "sin gluten. Sin lactosa. Sin soja."  -> NO lo lleva
 *
 * La primera versión de esto metía las tres en el mismo saco: daba por
 * alérgeno el "puede contener" y, peor, leía "sin gluten" como gluten. Un
 * preparado de carne picada que dice literalmente "sin gluten" salía
 * marcado con gluten.
 */
export function deMercadona(nutricion) {
  if (!nutricion) return { contiene: [], trazas: [], resaltados: [], ingredientes: null, alergenosTexto: null };

  const crudoIng = String(nutricion.ingredients ?? '');
  const crudoAle = String(nutricion.allergens ?? '');
  const resaltados = [...crudoIng.matchAll(/<strong>([^<]*)<\/strong>/gi)].map((m) => m[1]);

  const limpio = (t) => normalizar(t.replace(/<[^>]+>/g, ' '));
  const todo = `${limpio(crudoIng)} . ${limpio(crudoAle)}`;

  // Se parte por frases y cada una se clasifica: de trazas, negativa o normal.
  const frases = todo.split(/[.;]/).map((f) => f.trim()).filter(Boolean);
  const contiene = new Set();
  const trazas = new Set();

  // Mercadona redacta el campo de alérgenos con tres fórmulas fijas:
  //   "Contiene leche y sus derivados."        -> lo lleva
  //   "Libre de cereales que contengan gluten." -> NO lo lleva
  //   "Puede contener granos de sésamo."        -> trazas
  // La negación va al principio de la frase, no pegada al alérgeno, así que
  // hay que clasificar la FRASE ENTERA y no mirar las palabras de al lado.
  for (const frase of frases) {
    if (/\b(libre de|exento de|no contiene|0% de|sin gluten|sin lactosa)\b/.test(frase)) continue;
    const esTraza = /puede contener|trazas de|elaborado en (una|la misma) linea|misma linea/.test(frase);
    for (const { clave, palabras } of TERMINOS) {
      if (palabras.some((p) => frase.includes(normalizar(p)))) (esTraza ? trazas : contiene).add(clave);
    }
  }

  // Lo que va en trazas no cuenta como que lo lleva.
  for (const t of trazas) if (contiene.has(t)) trazas.delete(t);

  return {
    contiene: [...contiene].sort((a, b) => a.localeCompare(b)),
    trazas: [...trazas].sort((a, b) => a.localeCompare(b)),
    resaltados,
    ingredientes: crudoIng ? crudoIng.replace(/<[^>]+>/g, '') : null,
    alergenosTexto: crudoAle ? crudoAle.replace(/<[^>]+>/g, '') : null,
  };
}

/**
 * ¿Se desconoce qué alérgenos declara este producto?
 *
 * Sí, si su ficha no trae lista de ingredientes ni un texto de alérgenos de
 * verdad («x99.» no lo es: lo llevan fichas sin ingredientes y fichas con
 * sulfitos en ellos), y nadie lo ha comprobado con la foto de su etiqueta
 * (catalogo/verificaciones.json). Lo usan generar.ts y postres.js; el motor lo
 * lee en `Sku.alergenos_desconocidos` (src/motor/filtros.ts).
 *
 * @param registro   la entrada de alergenos-por-ean.json, o undefined
 * @param verificacion la entrada de verificaciones.json, o undefined
 */
/**
 * Los SKU que la última auditoría de un almacén NO da por comprobados (solo la
 * categoría o el nombre respaldan que son el ingrediente, o falta etiqueta).
 * Lee el fichero más reciente de catalogo/auditoria/<almacén>-<fecha>.json.
 */
export function pendientesDeAuditoria(dirAuditoria, almacen) {
  const fichero = fs.readdirSync(dirAuditoria)
    .filter((f) => f.startsWith(`${almacen}-`) && /^\d{4}-\d{2}-\d{2}\.json$/.test(f.slice(almacen.length + 1))).sort().at(-1);
  if (!fichero) return new Set();
  const a = JSON.parse(fs.readFileSync(path.join(dirAuditoria, fichero), 'utf8'));
  return new Set(a.filas.filter((f) => f.estado !== 'comprobado').map((f) => String(f.sku)));
}

export function etiquetaDesconocida(registro, verificacion) {
  if (verificacion?.alergenos?.estado === 'verificado') return false;
  if (!registro) return true;
  const texto = (registro.mercadona?.alergenosTexto ?? '').trim();
  return !registro.mercadona?.ingredientes && (!texto || texto === 'x99.');
}
