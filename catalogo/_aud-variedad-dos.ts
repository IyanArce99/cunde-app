/**
 * ═══ ¿HACEN FALTA TRES NIVELES DE VARIEDAD? ¿Y SE PUEDE «NUNCA REPETIR»? ═══
 *
 * La propuesta es dejar dos: «lo más barato posible, se repite» y «nunca se
 * repite». Antes de decidirlo hay que saber dos cosas que solo dicen los datos:
 *
 *   1. Qué separa de verdad a los tres niveles hoy. Si «normal» y «mucha» dan
 *      lo mismo, sobra una y la decisión está tomada.
 *   2. Si «nunca se repite» es siquiera alcanzable. Ojo con el vocabulario: en
 *      esta app «repetir» NO es cocinar dos veces el mismo plato, es que un
 *      hueco se cubra con lo que sobró de otro. Y eso es el mecanismo con el que
 *      la semana es barata: una tanda de garbanzos da tres comidas. Una semana
 *      sin ninguna sobra son 14 tandas distintas, y eso lo paga el usuario.
 *
 *   node --experimental-strip-types catalogo/_aud-variedad-dos.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const VARIEDADES = ['poca', 'normal', 'mucha'] as const;

console.log('\nSemanas para 2 personas, semanas 1-5.');
console.log('«repite» = huecos cubiertos con sobras o ensamblaje, no cocinando.\n');
console.log('  huecos  tope   variedad   platos   repite   carrito   come    tira');

for (const numHuecos of [7, 14]) {
  for (const presupuesto of [65, 90]) {
    for (const variedad of VARIEDADES) {
      let platos = 0; let repite = 0; let carrito = 0; let consumo = 0; let perecedero = 0; let n = 0;
      for (const semanaNumero of [1, 2, 3, 4, 5]) {
        const s = generarSemana({
          datos, N: 2, numHuecos, presupuesto, variedad, proteina: 'normal',
          esfuerzo: 'libre', exclusiones: [], semanaNumero,
        });
        if (!s.huecos.length) continue;
        n++;
        platos += new Set(s.tandas.map((t) => t.receta.id)).size;
        repite += s.huecos.filter((h) => h.receta && h.tipo !== 'cocinado').length;
        carrito += s.carrito.totalCarrito;
        consumo += s.carrito.totalConsumo;
        perecedero += s.carrito.totalPerecedero;
      }
      if (!n) { console.log(`  ${String(numHuecos).padStart(6)}${String(presupuesto).padStart(6)}   ${variedad.padEnd(10)} SIN SEMANA`); continue; }
      console.log(
        `  ${String(numHuecos).padStart(6)}${String(presupuesto).padStart(6)} €  ${variedad.padEnd(10)}`
        + `${(platos / n).toFixed(1).padStart(7)}`
        + `${(repite / n).toFixed(1).padStart(9)}`
        + `${(carrito / n).toFixed(2).padStart(10)} €`
        + `${(consumo / n).toFixed(2).padStart(8)}`
        + `${(perecedero / n).toFixed(2).padStart(8)}`,
      );
    }
    console.log('');
  }
}

/**
 * ¿Y si se pidiera CERO repeticiones? No hay palanca para eso en el motor, así
 * que se aproxima con el techo de variedad más alto y se mira cuánto falta.
 */
console.log('¿Cuánto le falta a «mucha» para no repetir NINGUNA vez?\n');
for (const numHuecos of [7, 14]) {
  let repite = 0; let n = 0;
  for (const semanaNumero of [1, 2, 3, 4, 5]) {
    const s = generarSemana({
      datos, N: 2, numHuecos, presupuesto: 200, variedad: 'mucha', proteina: 'normal',
      esfuerzo: 'libre', exclusiones: [], semanaNumero,
    });
    if (!s.huecos.length) continue;
    n++;
    repite += s.huecos.filter((h) => h.receta && h.tipo !== 'cocinado').length;
  }
  console.log(`  ${numHuecos} huecos, tope 200 € (sin apretar): repite ${(repite / n).toFixed(1)} veces`);
}
console.log('');
