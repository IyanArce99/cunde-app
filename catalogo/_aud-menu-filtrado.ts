/**
 * ═══ ¿CÓMO ES LA SEMANA DE VERDAD CON CADA FILTRO? ═══
 *
 * _aud-cobertura.ts mide si el motor CUADRA. Cuadra casi siempre, así que esa
 * no es la pregunta interesante: la pregunta es qué come esa persona.
 *
 * Aquí se generan semanas reales y se mira lo que el usuario nota:
 *   · platos distintos en catorce comidas
 *   · cuántas veces se repite la fuente de proteína que más sale
 *   · gramos de proteína al día
 *   · si la semana se apoya siempre en el mismo ingrediente
 *
 * Un recetario puede cuadrar catorce comidas y ser catorce veces garbanzos.
 *
 * ═══ RESULTADO · 7 AGO 2026 ═══
 *
 * NINGÚN filtro rompe la app. Con «mucha variedad» —que pide 12 recetas
 * distintas— los once casos llegan a 12 de 12 y a 55-57 g de proteína. Vegano
 * sin gluten incluido, que es el más apretado con 46 recetas de 112.
 *
 * O sea que el recetario NO es la restricción que aprieta, y añadir cobertura
 * «para que los filtros funcionen» no arreglaría nada: ya funcionan.
 *
 * Lo que sí está flojo es de qué VIVE esa semana:
 *
 *   vegetariano sin lactosa   huevo en 5 de 12 platos
 *   vegano                    soja + garbanzo + quinoa en 9,6 de 12
 *   vegano sin gluten         soja + garbanzo + tofu en 9 de 12
 *
 * Tres cuartas partes del menú de un vegano salen de tres ingredientes. Eso no
 * lo arregla un SKU nuevo: lo arreglan RECETAS nuevas. `recetarioAdaptado`
 * filtra recetas, así que un producto que no use ninguna receta es invisible
 * para el motor.
 *
 * Y del revés, el dato que nadie buscaba: quitar el pescado deja 100 de 112
 * recetas porque solo 12 llevan pescado y 4 marisco. En una app española el
 * agujero no es protegerse del filtro, es que hay poco pescado para quien sí lo
 * come.
 *
 *   node --experimental-strip-types catalogo/_aud-menu-filtrado.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana, nutricionDe } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;

const CASOS: { etiqueta: string; exclusiones: string[] }[] = [
  { etiqueta: 'sin filtros', exclusiones: [] },
  { etiqueta: 'sin pescado', exclusiones: ['Pescado'] },
  { etiqueta: 'sin pescado ni marisco', exclusiones: ['Pescado', 'Marisco'] },
  { etiqueta: 'sin cerdo', exclusiones: ['Cerdo'] },
  { etiqueta: 'sin gluten', exclusiones: ['Gluten'] },
  { etiqueta: 'sin lactosa', exclusiones: ['Lactosa'] },
  { etiqueta: 'sin huevo', exclusiones: ['Huevo'] },
  { etiqueta: 'vegetariano', exclusiones: ['Vegetariano'] },
  { etiqueta: 'vegetariano sin lactosa', exclusiones: ['Vegetariano', 'Lactosa'] },
  { etiqueta: 'vegano', exclusiones: ['Vegano'] },
  { etiqueta: 'vegano sin gluten', exclusiones: ['Vegano', 'Gluten'] },
];

/**
 * `mucha` y no `normal`, y es lo que hace útil esta medición.
 *
 * Con variedad normal el tope son 9 recetas y TODOS los filtros llegan a 9: el
 * recetario no es lo que aprieta, así que la tabla salía plana y no decía nada.
 * «Mucha» pide 12, que es donde un recetario flaco se queda corto y se ve.
 */
const VARIEDAD = 'mucha' as const;
const PRESUPUESTO = 90;

console.log(`\nSemanas de 14 comidas para 2, ${PRESUPUESTO} €, variedad ${VARIEDAD}, tres números de semana.`);
console.log('«platos» es sobre 12, que es lo que pide esa variedad.\n');
console.log('                            platos  repite  proteína  el ingrediente que más sale');

for (const caso of CASOS) {
  let platos = 0; let repes = 0; let prot = 0; let n = 0;
  const dominante = new Map<string, number>();
  for (const semanaNumero of [1, 2, 3]) {
    const s = generarSemana({
      datos, N: 2, numHuecos: 14, presupuesto: PRESUPUESTO, variedad: VARIEDAD, proteina: 'normal',
      esfuerzo: 'libre', exclusiones: caso.exclusiones, semanaNumero,
    });
    if (!s.huecos.length) continue;
    n++;
    platos += new Set(s.tandas.map((t) => t.receta.id)).size;
    repes += s.huecos.filter((h) => h.receta && h.tipo !== 'cocinado').length;
    prot += nutricionDe(s.huecos, datos, 2, 55).proteinaPorPersonaDia;
    // De qué vive la semana: la fuente de proteína que aparece en más tandas.
    for (const t of s.tandas) {
      const vistos = new Set<string>();
      for (const ing of t.receta.ingredientes) {
        const meta = datos.ingredientes[ing.canonico];
        if (!meta || meta.es_despensa) continue;
        if (((meta as { proteina_g_por_100?: number }).proteina_g_por_100 ?? 0) < 8) continue;
        vistos.add(ing.canonico);
      }
      for (const v of vistos) dominante.set(v, (dominante.get(v) ?? 0) + 1);
    }
  }
  if (!n) { console.log(`  ${caso.etiqueta.padEnd(26)} SIN SEMANA`); continue; }
  const top = [...dominante].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, c]) => `${datos.ingredientes[id]?.nombre ?? id} ×${(c / n).toFixed(1)}`);
  console.log(
    `  ${caso.etiqueta.padEnd(26)}`
    + `${(platos / n).toFixed(1).padStart(5)}`
    + `${(repes / n).toFixed(1).padStart(8)}`
    + `${(prot / n).toFixed(0).padStart(9)} g   `
    + top.join(', '),
  );
}
console.log('');
