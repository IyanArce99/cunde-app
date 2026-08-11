/**
 * ═══ ¿CUÁNTO IMPORTA DE VERDAD QUE FALTEN 13 REFERENCIAS? ═══
 *
 * 13 de 108 es un 12%, pero ese número no dice nada por sí solo: lo que importa
 * no es cuántas referencias faltan en el catálogo, sino **cuántas caen en la
 * lista de la compra de una persona concreta** y cuánto dinero son.
 *
 * Si el motor casi nunca las elige, la intuición de que «no variará tanto» es
 * correcta y esto no bloquea nada. Si las elige a menudo, cada semana generada
 * en Oviedo manda a alguien a por un producto que no está.
 *
 * Se generan semanas reales y se cuentan.
 *
 *   node --experimental-strip-types catalogo/_aud-oviedo-impacto.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

/* Se lee del carrito y no de `listaDe`, que vive en src/data/motor.ts y usa
   importaciones sin extensión que Node no resuelve fuera de Vite. Las líneas
   del carrito son la misma información antes de darle forma de pantalla. */

const datos = datosJson as unknown as DatosMotor;

/** Los que devuelven 404 en el almacén 4480. Verificado contra Mercadona. */
const NO_ESTAN_EN_OVIEDO = new Set([
  '2807', '8932', '8936', '16314', '17463', '21836', '24417',
  '35286', '62401', '62750', '87300', '87310', '87916',
]);

const CASOS = [
  { etiqueta: 'sin filtros', exclusiones: [] as string[] },
  { etiqueta: 'sin pescado', exclusiones: ['Pescado'] },
  { etiqueta: 'vegetariano', exclusiones: ['Vegetariano'] },
];

console.log('\nSemanas de 14 comidas para 2 personas, 65 €, semanas 1-8.');
console.log('«fallan» = productos de la lista cuya referencia no existe en Oviedo.\n');
console.log('  perfil          variedad   productos  fallan   € que fallan   % del carro   semanas con fallo');

for (const caso of CASOS) {
  for (const variedad of ['normal', 'mucha'] as const) {
    let productos = 0; let fallan = 0; let euros = 0; let carro = 0; let conFallo = 0; let n = 0;
    for (const semanaNumero of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = generarSemana({
        datos, N: 2, numHuecos: 14, presupuesto: 65, variedad, proteina: 'normal',
        esfuerzo: 'libre', exclusiones: caso.exclusiones, semanaNumero,
      });
      if (!s.huecos.length) continue;
      n++;
      let falloAqui = 0;
      for (const l of s.carrito.lineas) {
        productos++;
        carro += l.carritoCoste;
        if (NO_ESTAN_EN_OVIEDO.has(l.sku)) { fallan++; euros += l.carritoCoste; falloAqui++; }
      }
      if (falloAqui) conFallo++;
    }
    if (!n) continue;
    console.log(
      `  ${caso.etiqueta.padEnd(16)}${variedad.padEnd(11)}`
      + `${(productos / n).toFixed(1).padStart(9)}`
      + `${(fallan / n).toFixed(1).padStart(8)}`
      + `${(euros / n).toFixed(2).padStart(14)} €`
      + `${(euros / carro * 100).toFixed(1).padStart(13)}%`
      + `${String(conFallo).padStart(15)} de ${n}`,
    );
  }
}
console.log('');
