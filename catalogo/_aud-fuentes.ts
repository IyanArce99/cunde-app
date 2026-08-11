/**
 * ═══ BARRIDO DE `PENAL_FUENTE_REPETIDA` ═══
 *
 * Mide, para cada peso, de cuántas fuentes de proteína distintas vive la semana
 * y qué cuesta esa variedad. Sin esto, el 3 sería un número inventado.
 *
 * Lo que hay que vigilar mientras sube: que no se coma el presupuesto, que no
 * hunda la proteína contra su suelo y que no dispare el desperdicio. Una semana
 * variadísima que se pasa del tope no sirve de nada.
 *
 * Se ejecuta cambiando a mano PENAL_FUENTE_REPETIDA en seleccionar.ts y
 * relanzando. No hay interruptor: es una constante del motor y meterle un
 * parámetro de calibración por un barrido de una tarde es cómo se acumulan
 * banderas que nadie quita.
 *
 *   node --experimental-strip-types catalogo/_aud-fuentes.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana, nutricionDe } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const PROTEINA_QUE_DEFINE = 8;

const CASOS = [
  { etiqueta: 'sin filtros', exclusiones: [] as string[] },
  { etiqueta: 'sin pescado', exclusiones: ['Pescado'] },
  { etiqueta: 'vegetariano', exclusiones: ['Vegetariano'] },
  { etiqueta: 'vegetariano sin lactosa', exclusiones: ['Vegetariano', 'Lactosa'] },
  { etiqueta: 'vegano', exclusiones: ['Vegano'] },
  { etiqueta: 'vegano sin gluten', exclusiones: ['Vegano', 'Gluten'] },
];

/** La familia de la que vive cada tanda. Igual que en el motor. */
function familia(id: string): string { return id.split('_')[0]; }

console.log('\nSemanas de 14 comidas para 2, 90 €, variedad mucha, semanas 1-5.');
console.log('«top-3» son los platos que salen de las tres fuentes más repetidas, sobre 12.\n');
console.log('                          fuentes  top-3/12  carrito  come   tira  proteína');

for (const caso of CASOS) {
  let fuentesN = 0; let top3 = 0; let carrito = 0; let consumo = 0; let perecedero = 0; let prot = 0; let n = 0;
  for (const semanaNumero of [1, 2, 3, 4, 5]) {
    const s = generarSemana({
      datos, N: 2, numHuecos: 14, presupuesto: 90, variedad: 'mucha', proteina: 'normal',
      esfuerzo: 'libre', exclusiones: caso.exclusiones, semanaNumero,
    });
    if (!s.tandas.length) continue;
    n++;
    const cuenta = new Map<string, number>();
    for (const t of s.tandas) {
      const vistas = new Set<string>();
      for (const ing of t.receta.ingredientes) {
        const meta = datos.ingredientes[ing.canonico];
        if (!meta || meta.es_despensa) continue;
        if ((meta.proteina_g_por_100 ?? 0) < PROTEINA_QUE_DEFINE) continue;
        vistas.add(familia(ing.canonico));
      }
      for (const v of vistas) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    }
    fuentesN += cuenta.size;
    top3 += [...cuenta.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    carrito += s.carrito.totalCarrito;
    consumo += s.carrito.totalConsumo;
    perecedero += s.carrito.totalPerecedero;
    prot += nutricionDe(s.huecos, datos, 2, 55).proteinaPorPersonaDia;
  }
  if (!n) { console.log(`  ${caso.etiqueta.padEnd(24)} SIN SEMANA`); continue; }
  console.log(
    `  ${caso.etiqueta.padEnd(24)}`
    + `${(fuentesN / n).toFixed(1).padStart(7)}`
    + `${(top3 / n).toFixed(1).padStart(10)}`
    + `${(carrito / n).toFixed(2).padStart(9)} €`
    + `${(consumo / n).toFixed(2).padStart(7)}`
    + `${(perecedero / n).toFixed(2).padStart(7)}`
    + `${(prot / n).toFixed(0).padStart(9)} g`,
  );
}
console.log('');
