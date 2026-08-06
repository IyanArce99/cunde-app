#!/usr/bin/env node --experimental-strip-types
/**
 * ¿QUÉ EJE ADMITE ADJETIVOS?
 *
 * Poner "poca / normal / mucha" solo es honesto si al subir de nivel sube (o
 * baja) DE VERDAD algo que al usuario le importe. Hoy no pasa con el precio:
 * 12 de 15 celdas salen desordenadas. La pregunta es si pasa con otra cosa.
 *
 * Se ordenan las tres construcciones POR PRECIO y se mira, para cada métrica,
 * cuántas veces es monótona en ese orden. La que salga monótona es la que
 * puede llevar nombre; las demás son datos que se enseñan, no promesas.
 *
 * Y una cuarta pregunta que puede matar el control entero: ¿cuánto se
 * diferencian? Si las tres semanas caben en un 3% del presupuesto, el usuario
 * está eligiendo entre tres cosas iguales y el deslizador del dinero ya hace
 * ese trabajo mejor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Variedad } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const NIVELES: Variedad[] = ['poca', 'normal', 'mucha'];
const CASOS: { N: number; presupuesto: number }[] = [];
for (const N of [1, 2, 4]) for (const presupuesto of [45, 55, 65, 80, 100]) CASOS.push({ N, presupuesto });

interface Medida {
  carrito: number; platos: number; repite: number; perecedero: number;
  proteina: number; minutos: number; tandas: number;
}

const METRICAS: { clave: keyof Medida; nombre: string; sube: string }[] = [
  { clave: 'platos', nombre: 'platos distintos', sube: 'más variedad' },
  { clave: 'repite', nombre: 'huecos repetidos', sube: 'repites más' },
  { clave: 'proteina', nombre: 'proteína g/día', sube: 'comes más proteína' },
  { clave: 'perecedero', nombre: 'perecedero €', sube: 'tiras más' },
  { clave: 'minutos', nombre: 'minutos de cocina', sube: 'cocinas más' },
  { clave: 'tandas', nombre: 'tandas', sube: 'más veces al fuego' },
];

const filas: { caso: string; tres: Medida[] }[] = [];

for (const { N, presupuesto } of CASOS) {
  const tres = NIVELES.map((v) => {
    const s = generarSemana({ datos, N, numHuecos: 14, variedad: v, presupuesto, proteina: 'normal', semanaNumero: 1 });
    const huecos = s.huecos ?? [];
    return {
      carrito: s.carrito?.totalCarrito ?? Infinity,
      platos: s.recetasDistintas?.length ?? 0,
      repite: huecos.filter((h) => h.tipo !== 'cocinado' && h.receta).length,
      perecedero: s.carrito?.totalPerecedero ?? 0,
      proteina: s.nutricion?.proteinaPorPersonaDia ?? 0,
      minutos: (s.tandas ?? []).reduce((a, t) => a + (t.receta?.minutos ?? 0), 0),
      tandas: (s.tandas ?? []).length,
    } satisfies Medida;
  }).sort((a, b) => a.carrito - b.carrito);
  filas.push({ caso: `N=${N} ${presupuesto} €`, tres });
}

console.log('=== 1 · ¿QUÉ SE MUEVE DE VERDAD AL SUBIR DE PRECIO? ===');
console.log('(las tres semanas ordenadas de barata a cara; cuenta cuántas de las 15 celdas son monótonas)\n');
console.log('métrica                monótona subiendo   monótona bajando   ni una cosa ni otra');
for (const m of METRICAS) {
  let sube = 0, baja = 0;
  for (const f of filas) {
    const v = f.tres.map((t) => t[m.clave]);
    if (v[0] <= v[1] && v[1] <= v[2]) sube++;
    else if (v[0] >= v[1] && v[1] >= v[2]) baja++;
  }
  const ni = filas.length - sube - baja;
  console.log(
    `${m.nombre.padEnd(22)} ${String(sube).padStart(7)}/15 ${String(baja).padStart(17)}/15 ${String(ni).padStart(18)}/15`,
  );
}

console.log('\n=== 2 · ¿SE DIFERENCIAN LO SUFICIENTE COMO PARA MERECER UN CONTROL? ===');
console.log('caso           barata    cara   diferencia   % del presupuesto');
let sumaPct = 0, pocas = 0;
for (let i = 0; i < filas.length; i++) {
  const f = filas[i];
  const presupuesto = CASOS[i].presupuesto;
  const dif = f.tres[2].carrito - f.tres[0].carrito;
  const pct = (dif / presupuesto) * 100;
  sumaPct += pct;
  if (pct < 5) pocas++;
  console.log(
    `${f.caso.padEnd(12)} ${f.tres[0].carrito.toFixed(2).padStart(7)} ${f.tres[2].carrito.toFixed(2).padStart(7)}`
    + ` ${dif.toFixed(2).padStart(10)} € ${pct.toFixed(1).padStart(14)}%`,
  );
}
console.log(`\nmedia: ${(sumaPct / filas.length).toFixed(1)}% del presupuesto entre la más barata y la más cara`);
console.log(`celdas donde la diferencia es menor del 5%: ${pocas}/${filas.length}`);

console.log('\n=== 3 · LO QUE COSTARÍA MANTENER LOS ADJETIVOS ===');
console.log('Si se conservan poca/normal/mucha y se fuerza el orden por precio,');
console.log('a cada adjetivo le toca la semana que le toque. Cuántas veces');
console.log('mentiría cada etiqueta con lo que de verdad entrega:\n');
let mentiraPoca = 0, mentiraMucha = 0;
for (const f of filas) {
  // "poca variedad" debería tener MENOS platos que "mucha".
  if (f.tres[0].platos > f.tres[2].platos) mentiraPoca++;
  // "casi sin repetir" debería repetir MENOS que la barata.
  if (f.tres[2].repite > f.tres[0].repite) mentiraMucha++;
}
console.log(`  "poca variedad" (la barata) con MÁS platos que la cara:      ${mentiraPoca}/15`);
console.log(`  "casi sin repetir" (la cara) repitiendo MÁS que la barata:   ${mentiraMucha}/15`);
