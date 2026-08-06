#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Y SI EL EJE NO ES LA VARIEDAD, SINO EL DINERO?
 *
 * "Poca variedad · repites bastante" ofrece algo que nadie quiere. Repetir no
 * es un deseo, es el precio de apretar. El deseo es gastar menos.
 *
 * Y eso no es solo copy: hoy el nivel es una RESTRICCIÓN (tope de recetas
 * distintas) y no un OBJETIVO, así que el motor recorta el conjunto y luego
 * optimiza otra cosa. Por eso "poca" sale más cara que "normal" en 12 de 15
 * casos: nadie le ha pedido nunca que sea barata.
 *
 * Con el eje en el dinero, el tope de recetas deja de ser una promesa al
 * usuario y pasa a ser UNA ESTRATEGIA DE BÚSQUEDA. Si a quien pide "lo más
 * barato" le sale una semana variada, mejor para él. Entonces:
 *
 *   lo más barato = min(las tres construcciones)
 *   sin repetir   = la de más platos distintos que quepa
 *
 * Y la monotonía sale gratis: el mínimo de un superconjunto no puede ser mayor
 * que ninguno de sus miembros. Esto lo comprueba.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Variedad } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const eur = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—').padStart(6);

const NIVELES: Variedad[] = ['poca', 'normal', 'mucha'];
const CASOS: { N: number; presupuesto: number }[] = [];
for (const N of [1, 2, 4]) for (const presupuesto of [45, 55, 65, 80, 100]) CASOS.push({ N, presupuesto });

let ordenadoHoy = 0, ordenadoNuevo = 0;
let sumaHoy = 0, sumaNuevo = 0;
const filas: string[] = [];

for (const { N, presupuesto } of CASOS) {
  const construidas = NIVELES.map((v) => {
    const s = generarSemana({ datos, N, numHuecos: 14, variedad: v, presupuesto, proteina: 'normal', semanaNumero: 1 });
    return { v, carrito: s.carrito?.totalCarrito ?? Infinity, platos: s.recetasDistintas?.length ?? 0, sem: s };
  });

  // COMO ESTÁ HOY: cada nivel se queda con lo suyo.
  const hoy = construidas.map((c) => c.carrito);
  const okHoy = hoy[0] <= hoy[1] && hoy[1] <= hoy[2];
  if (okHoy) ordenadoHoy++;

  /**
   * PROPUESTA. Los tres se calculan igual que ahora; lo que cambia es a quién
   * se le asigna cada resultado.
   *   · barato  -> el más barato de los tres, venga de donde venga.
   *   · variado -> el de más platos distintos; a igualdad, el más barato.
   *   · normal  -> lo que quede en medio por precio.
   */
  const porPrecio = [...construidas].sort((a, b) => a.carrito - b.carrito);
  const barato = porPrecio[0];
  const variado = [...construidas].sort((a, b) => (b.platos - a.platos) || (a.carrito - b.carrito))[0];
  const resto = porPrecio.filter((c) => c !== barato && c !== variado);
  const medio = resto[0] ?? porPrecio[1];
  const nuevo = [barato.carrito, medio.carrito, variado.carrito];
  const okNuevo = nuevo[0] <= nuevo[1] && nuevo[1] <= nuevo[2];
  if (okNuevo) ordenadoNuevo++;

  sumaHoy += hoy[0];
  sumaNuevo += nuevo[0];

  filas.push(
    `N=${N} ${String(presupuesto).padStart(3)} €  hoy ${hoy.map(eur).join(' ')} ${okHoy ? 'ok ' : 'NO '}`
    + `  nuevo ${nuevo.map(eur).join(' ')} ${okNuevo ? 'ok ' : 'NO '}`
    + `  ahorro en «barato»: ${(hoy[0] - nuevo[0]).toFixed(2).padStart(5)} €`
    + `  platos ${barato.platos}/${medio.platos}/${variado.platos}`,
  );
}

console.log('           poca/barato  normal/medio  mucha/variado');
for (const f of filas) console.log(f);
console.log(`\nordenados HOY:    ${ordenadoHoy}/${CASOS.length}`);
console.log(`ordenados NUEVO:  ${ordenadoNuevo}/${CASOS.length}`);
console.log(`\ncarrito medio del nivel barato:  hoy ${(sumaHoy / CASOS.length).toFixed(2)} €  ->  nuevo ${(sumaNuevo / CASOS.length).toFixed(2)} €`);
console.log(`o sea ${((sumaHoy - sumaNuevo) / CASOS.length).toFixed(2)} € menos por semana a quien pide lo más barato, sin tocar el greedy.`);

/**
 * VERSIÓN COHERENTE: un solo eje.
 *
 * Se construyen las tres igual que ahora, se ORDENAN POR PRECIO, y cada una se
 * enseña con lo que de verdad entrega. No se promete que la barata repita más:
 * se dice cuánto repite cada una, que es un dato, no una promesa.
 *
 * Ordenado por construcción, así que la escalera deja de poder romperse.
 */
console.log('\n=== UN SOLO EJE: ordenadas por precio, etiquetadas por lo que dan ===');
console.log('                 barata            media             suelta        ¿repetir baja al subir?');
let coherentes = 0;
for (const { N, presupuesto } of CASOS) {
  const tres = NIVELES.map((v) => {
    const s = generarSemana({ datos, N, numHuecos: 14, variedad: v, presupuesto, proteina: 'normal', semanaNumero: 1 });
    const huecos = s.huecos?.length ?? 0;
    const cocinados = s.huecos?.filter((h) => h.tipo === 'cocinado').length ?? 0;
    return {
      carrito: s.carrito?.totalCarrito ?? Infinity,
      platos: s.recetasDistintas?.length ?? 0,
      repite: huecos - cocinados,
    };
  }).sort((a, b) => a.carrito - b.carrito);

  // ¿La más cara repite menos que la más barata? Es lo único que hay que poder
  // decir para que los tres niveles tengan sentido puestos en fila.
  const tieneSentido = tres[2].repite <= tres[0].repite;
  if (tieneSentido) coherentes++;
  console.log(
    `N=${N} ${String(presupuesto).padStart(3)} €  `
    + tres.map((t) => `${eur(t.carrito)} ${String(t.platos).padStart(2)}pl ${String(t.repite).padStart(2)}rep`).join('  ')
    + `   ${tieneSentido ? 'sí' : 'NO'}`,
  );
}
console.log(`\nordenadas por precio: 15/15 por construcción`);
console.log(`y además "la cara repite menos que la barata": ${coherentes}/${CASOS.length}`);
