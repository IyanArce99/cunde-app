#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ BANCO DE ESCENARIOS DEL MOTOR ═══
 *
 * Un conjunto pequeño y fijo de hogares, presupuestos, despensas y filtros,
 * y para cada uno lo que de verdad importa: lo que pasa por caja, si cuadra,
 * lo que se come, lo que se tira, lo que se guarda, cuántos platos y cuánto
 * tarda. Sirve para comparar el motor ANTES y DESPUÉS de un cambio sobre
 * exactamente las mismas entradas.
 *
 * Uso:
 *   node --experimental-strip-types catalogo/_aud-bench-motor.ts guardar <etiqueta>
 *   node --experimental-strip-types catalogo/_aud-bench-motor.ts comparar <a> <b>
 *
 * Los resultados van a catalogo/bench-motor/<etiqueta>.json. No modifica nada
 * del motor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { PeticionSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const CARPETA = path.join(aqui, 'bench-motor');

type Pet = Omit<PeticionSemana, 'datos'>;
interface Escenario {
  id: string;
  que: string;
  peticion: Pet;
  /** Semanas encadenadas con despensa y memoria. */
  cadena?: number;
}

const base = (p: Partial<Pet>): Pet => ({
  N: 2, numHuecos: 14, variedad: 'normal', proteina: 'normal', esfuerzo: 'libre',
  exclusiones: [], presupuesto: 65, semanaNumero: 1, ...p,
});

export const ESCENARIOS: Escenario[] = [
  { id: 'arranque', que: '2 personas · 14 comidas · 65 €', peticion: base({}) },
  { id: 'arranque-cadena', que: '2 personas · 65 € · 4 semanas con despensa y memoria', peticion: base({}), cadena: 4 },
  { id: 'uno-ajustado', que: '1 persona · 7 comidas · 32 €', peticion: base({ N: 1, numHuecos: 7, presupuesto: 32 }) },
  { id: 'uno-cadena', que: '1 persona · 14 comidas · 45 € · 4 semanas con despensa', peticion: base({ N: 1, presupuesto: 45 }), cadena: 4 },
  { id: 'dos-apretado', que: '2 personas · 14 comidas · 45 €', peticion: base({ presupuesto: 45 }) },
  { id: 'cuatro-holgado', que: '4 personas · 14 comidas · 110 €', peticion: base({ N: 4, presupuesto: 110 }) },
  { id: 'cuatro-apretado', que: '4 personas · 14 comidas · 85 €', peticion: base({ N: 4, presupuesto: 85 }) },
  { id: 'cuatro-cadena', que: '4 personas · 100 € · 3 semanas con despensa', peticion: base({ N: 4, presupuesto: 100 }), cadena: 3 },
  { id: 'dos-50-cadena', que: '2 personas · 50 € · 4 semanas con despensa', peticion: base({ presupuesto: 50 }), cadena: 4 },
  { id: 'tres-postre-cadena', que: '3 personas · 80 € · postre · 3 semanas con despensa', peticion: base({ N: 3, presupuesto: 80, postre: true }), cadena: 3 },
  { id: 'vegano-cadena', que: '2 personas · 55 € · vegano · 3 semanas con despensa', peticion: base({ presupuesto: 55, exclusiones: ['Vegano'] }), cadena: 3 },
  { id: 'vegano', que: '2 personas · 65 € · vegano', peticion: base({ exclusiones: ['Vegano'] }) },
  { id: 'gluten-lactosa', que: '2 personas · 65 € · sin gluten ni lactosa', peticion: base({ exclusiones: ['Gluten', 'Lactosa'] }) },
  { id: 'vegetariano-minimo', que: '2 personas · 65 € · vegetariano · lo mínimo', peticion: base({ exclusiones: ['Vegetariano'], esfuerzo: 'minimo' }) },
  { id: 'tres-postre', que: '3 personas · 80 € · con postre', peticion: base({ N: 3, presupuesto: 80, postre: true }) },
  { id: 'mucha-alta', que: '2 personas · 90 € · mucha variedad · proteína alta', peticion: base({ presupuesto: 90, variedad: 'mucha', proteina: 'alta' }) },
  { id: 'poca-basica', que: '2 personas · 50 € · poca variedad · proteína básica', peticion: base({ presupuesto: 50, variedad: 'poca', proteina: 'basica' }) },
  { id: 'inalcanzable', que: '2 personas · 14 comidas · 30 € (no cabe)', peticion: base({ presupuesto: 30 }) },
];

export interface Medida {
  id: string;
  semana: number;
  carrito: number;
  presupuesto: number;
  cuadra: boolean;
  exceso: number;
  consumo: number;
  delArmario: number;
  comidaNueva: number;
  perecedero: number;
  inventario: number;
  desperdicio: number;
  distintas: number;
  sobras: number;
  proteina: number;
  cumpleSuelo: boolean;
  frescos: number;
  ms: number;
  huella: string;
}

function medir(id: string, p: PeticionSemana): { m: Medida; s: ReturnType<typeof generarSemana> } {
  const t0 = performance.now();
  const s = generarSemana(p);
  const ms = Math.round(performance.now() - t0);
  const c = s.carrito;
  const presupuesto = p.presupuesto ?? Infinity;
  return {
    s,
    m: {
      id,
      semana: p.semanaNumero ?? 1,
      carrito: c.totalCarrito,
      presupuesto,
      cuadra: s.cuadra,
      exceso: Math.max(0, Number((c.totalCarrito - presupuesto).toFixed(2))),
      consumo: c.totalConsumo,
      delArmario: c.totalDelArmario,
      comidaNueva: Number((c.totalConsumo - c.totalDelArmario).toFixed(2)),
      perecedero: c.totalPerecedero,
      inventario: c.totalInventario,
      // Lo que se paga esta semana y no se come esta semana. Lo del armario
      // ya se pagó antes: se resta para no contar comida vieja como nueva.
      desperdicio: Number((c.totalCarrito - (c.totalConsumo - c.totalDelArmario)).toFixed(2)),
      distintas: s.recetasDistintas.length,
      sobras: s.huecos.filter((h) => h.receta && h.tipo !== 'cocinado').length,
      proteina: s.nutricion.proteinaPorPersonaDia,
      cumpleSuelo: s.nutricion.cumpleSuelo,
      frescos: s.nutricion.huecosConFresca,
      ms,
      huella: s.huecos.map((h) => `${h.tipo[0]}:${h.receta?.id ?? '-'}`).join(' '),
    },
  };
}

export function correr(): Medida[] {
  const medidas: Medida[] = [];
  for (const e of ESCENARIOS) {
    if (!e.cadena) {
      medidas.push(medir(e.id, { datos, ...e.peticion }).m);
      continue;
    }
    let armario: Existencias = {};
    let historial: string[][] = [];
    for (let n = 1; n <= e.cadena; n++) {
      const { m, s } = medir(e.id, {
        datos, ...e.peticion, semanaNumero: n, existencias: armario, recetasRecientes: historial,
      });
      medidas.push(m);
      armario = existenciasTrasLaSemana(s.carrito, armario);
      historial = [[...new Set(s.tandas.map((t) => t.receta.id))], ...historial].slice(0, 3);
    }
  }
  return medidas;
}

const e2 = (n: number) => n.toFixed(2).padStart(7);

function tabla(ms: Medida[]) {
  console.log('  escenario            sem  carrito   tope  cuadra  consumo armario  perec.    inv.  desper.  platos sobras   prot  fresc    ms');
  for (const m of ms) {
    console.log(
      `  ${m.id.padEnd(20)} ${String(m.semana).padStart(2)} ${e2(m.carrito)} ${String(m.presupuesto).padStart(5)}`
      + `  ${m.cuadra ? ' sí ' : ' NO '} ${e2(m.consumo)} ${e2(m.delArmario)} ${e2(m.perecedero)} ${e2(m.inventario)} ${e2(m.desperdicio)}`
      + `   ${String(m.distintas).padStart(3)}    ${String(m.sobras).padStart(2)}  ${m.proteina.toFixed(1).padStart(5)}${m.cumpleSuelo ? ' ' : '!'}`
      + `  ${String(m.frescos).padStart(3)} ${String(m.ms).padStart(5)}`,
    );
  }
}

function resumen(ms: Medida[]) {
  const suma = (f: (m: Medida) => number) => ms.reduce((a, m) => a + f(m), 0);
  const n = ms.length;
  const r = (x: number) => Number(x.toFixed(2));
  const conDespensa = ms.filter((m) => m.delArmario > 0);
  const ratio = (xs: Medida[], f: (m: Medida) => number) => r(xs.reduce((a, m) => a + f(m), 0) / Math.max(0.01, xs.reduce((a, m) => a + m.carrito, 0)));
  return {
    carrito: r(suma((m) => m.carrito) / n),
    consumo: r(suma((m) => m.consumo) / n),
    comidaNueva: r(suma((m) => m.comidaNueva) / n),
    perecedero: r(suma((m) => m.perecedero) / n),
    desperdicio: r(suma((m) => m.desperdicio) / n),
    /** Por euro de caja: cuánto se come de lo nuevo y cuánto se tira. */
    comidaNuevaPorEuro: ratio(ms, (m) => m.comidaNueva),
    perecederoPorEuro: ratio(ms, (m) => m.perecedero),
    /** Solo las semanas con algo en casa, que es donde actúa la despensa. */
    conDespensa: {
      semanas: conDespensa.length,
      carrito: r(conDespensa.reduce((a, m) => a + m.carrito, 0)),
      comidaNueva: r(conDespensa.reduce((a, m) => a + m.comidaNueva, 0)),
      consumo: r(conDespensa.reduce((a, m) => a + m.consumo, 0)),
      perecedero: r(conDespensa.reduce((a, m) => a + m.perecedero, 0)),
      comidaNuevaPorEuro: ratio(conDespensa, (m) => m.comidaNueva),
      consumoPorEuro: ratio(conDespensa, (m) => m.consumo),
    },
    cuadran: ms.filter((m) => m.cuadra).length,
    excesoTotal: r(suma((m) => m.exceso)),
    proteina: r(suma((m) => m.proteina) / n),
    msMax: Math.max(...ms.map((m) => m.ms)),
    msMedia: Math.round(suma((m) => m.ms) / n),
  };
}

const orden = process.argv[2];
if (orden === 'guardar') {
  const etiqueta = process.argv[3] ?? 'actual';
  const ms = correr();
  tabla(ms);
  fs.mkdirSync(CARPETA, { recursive: true });
  const destino = path.join(CARPETA, `${etiqueta}.json`);
  fs.writeFileSync(destino, JSON.stringify({ medidoEn: new Date().toISOString(), medidas: ms }, null, 2));
  console.log('\nresumen:', JSON.stringify(resumen(ms)));
  console.log(`\nGuardado ${destino}`);
} else if (orden === 'comparar') {
  const leer = (e: string) => JSON.parse(fs.readFileSync(path.join(CARPETA, `${e}.json`), 'utf8')).medidas as Medida[];
  const a = leer(process.argv[3]);
  const b = leer(process.argv[4]);
  const d = (p: number, q: number) => `${p.toFixed(2).padStart(6)}→${q.toFixed(2).padStart(6)}`;
  console.log('  escenario            sem   carrito A→B      consumo A→B     perec. A→B    desper. A→B   platos  prot A→B  cuadra   ms A→B    menú');
  let iguales = 0;
  for (let k = 0; k < a.length; k++) {
    const x = a[k];
    const y = b[k];
    const cambia = x.huella !== y.huella;
    if (!cambia) iguales++;
    console.log(
      `  ${x.id.padEnd(20)} ${String(x.semana).padStart(2)}  ${d(x.carrito, y.carrito)}  ${d(x.consumo, y.consumo)}  ${d(x.perecedero, y.perecedero)}  ${d(x.desperdicio, y.desperdicio)}`
      + `   ${x.distintas}→${y.distintas}    ${x.proteina.toFixed(0)}→${y.proteina.toFixed(0)}   ${x.cuadra ? 'sí' : 'NO'}→${y.cuadra ? 'sí' : 'NO'}  ${String(x.ms).padStart(4)}→${String(y.ms).padStart(4)}   ${cambia ? 'DISTINTO' : 'igual'}`,
    );
  }
  console.log(`\n  ${iguales} de ${a.length} semanas con el mismo menú`);
  console.log('  A:', JSON.stringify(resumen(a)));
  console.log('  B:', JSON.stringify(resumen(b)));
} else {
  console.log('uso: guardar <etiqueta> | comparar <a> <b>');
}
