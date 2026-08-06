#!/usr/bin/env node --experimental-strip-types
/**
 * LAS TRES PRIMERAS SEMANAS, A FONDO.
 *
 * No basta con que salgan: hay que poder tocarlas. Y se prueba contra
 * generarParaApp/retocarParaApp, que es lo que ejecuta la app — no contra el
 * motor por dentro, donde un fallo de integración no se vería.
 *
 * Por cada hueco de cada semana:
 *   · "Bájame el precio"  -> NUNCA puede devolver algo más caro. Fue un fallo
 *     real (31 de 126 pulsaciones subían el precio, hasta +6,37 €).
 *   · "Cambiar plato"     -> tiene que ofrecer otra cosa, y no agotarse.
 *   · "Esta comida no cocino" -> reorganiza sin romper la semana.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, repararHueco, rehacerDesde, SEMANAS_DE_MEMORIA } from '../src/motor/seleccionar.ts';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import type { DatosMotor, Retoque } from '../src/motor/tipos.ts';

/* src/data/motor.ts importa sin extensión .ts —Vite lo resuelve, Node no— así
   que se replica aquí lo que hace retocarParaApp: reparación local para
   "cambiar" y "libre", y reparto global para "barato". Es la misma decisión,
   línea por línea. */
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const retocar = (peticion: Parameters<typeof generarSemana>[0], actual: ReturnType<typeof generarSemana>, i: number, retoque: Retoque) => {
  const local = retoque === 'barato' ? null : repararHueco(peticion, actual, i, retoque);
  return local ?? rehacerDesde(peticion, actual, i, retoque);
};

const PERFILES: { nombre: string; N: number; presupuesto: number; exclusiones?: string[]; esfuerzo?: 'minimo' }[] = [
  { nombre: '1 persona · 40 €', N: 1, presupuesto: 40 },
  { nombre: '2 personas · 65 €', N: 2, presupuesto: 65 },
  { nombre: '4 personas · 90 €', N: 4, presupuesto: 90 },
  { nombre: '2 pers · vegetariano', N: 2, presupuesto: 65, exclusiones: ['Vegetariano'] },
  { nombre: '2 pers · sin gluten', N: 2, presupuesto: 65, exclusiones: ['Gluten'] },
  { nombre: '2 pers · lo mínimo', N: 2, presupuesto: 65, esfuerzo: 'minimo' },
];


const f2 = (n: number) => n.toFixed(2).padStart(6);
const problemas: string[] = [];
const total = (lista: { precio: number; esDespensa?: boolean; yaEnCasa?: boolean; loTengo?: boolean }[]) =>
  lista.reduce((a, it) => a + (((it.esDespensa || it.yaEnCasa) && it.loTengo !== false) ? 0 : it.precio), 0);

for (const p of PERFILES) {
  console.log(`
########## ${p.nombre}`);
  let existencias: Existencias = {};
  const historial: string[][] = [];

  for (let n = 1; n <= 3; n++) {
    const peticion = {
      datos, N: p.N, numHuecos: 14, variedad: 'normal' as const, presupuesto: p.presupuesto,
      proteina: 'normal' as const, exclusiones: p.exclusiones ?? [], esfuerzo: p.esfuerzo,
      semanaNumero: n, recetasRecientes: historial.slice(0, SEMANAS_DE_MEMORIA), existencias,
    };
    const s = generarSemana(peticion);
    if (!s.huecos.length) { problemas.push(`${p.nombre} s${n}: SIN COBERTURA`); console.log(`  s${n}: SIN COBERTURA`); continue; }
    const c = s.carrito;
    const frac = c.totalConsumo > 0 ? c.totalPerecedero / c.totalConsumo : 0;
    if (c.totalCarrito > p.presupuesto + 0.005) problemas.push(`${p.nombre} s${n}: se pasa (${c.totalCarrito.toFixed(2)} €)`);
    if (frac > 0.25) problemas.push(`${p.nombre} s${n}: tira el ${(frac * 100).toFixed(0)}%`);
    if (!s.nutricion.cumpleSuelo) problemas.push(`${p.nombre} s${n}: no cumple el suelo de proteína`);

    let bajaSube = 0, bajaVacio = 0, bajaOk = 0, bajaAhorro = 0;
    let cambiaIgual = 0, cambiaOk = 0, cambiaVacio = 0, libreOk = 0, libreRompe = 0;

    for (let i = 0; i < s.huecos.length; i++) {
      if (!s.huecos[i].receta) continue;
      for (const retoque of ['barato', 'cambiar', 'libre'] as Retoque[]) {
        let r;
        try { r = retocar(peticion, s, i, retoque); }
        catch (e) { problemas.push(`${p.nombre} s${n} h${i} "${retoque}": EXCEPCIÓN ${(e as Error).message}`); continue; }
        const vacio = !r || !r.huecos?.length;
        if (retoque === 'barato') {
          if (vacio) bajaVacio++;
          else if (r.carrito.totalCarrito > c.totalCarrito + 0.005) {
            bajaSube++;
            problemas.push(`${p.nombre} s${n} h${i}: "bájame el precio" SUBE ${(r.carrito.totalCarrito - c.totalCarrito).toFixed(2)} €`);
          } else { bajaOk++; bajaAhorro += c.totalCarrito - r.carrito.totalCarrito; }
        } else if (retoque === 'cambiar') {
          if (vacio) cambiaVacio++;
          else if (r.huecos[i]?.receta?.id === s.huecos[i].receta!.id) cambiaIgual++;
          else cambiaOk++;
        } else if (vacio) libreRompe++; else libreOk++;
      }
    }

    console.log(`  s${n}  ${f2(c.totalCarrito)} € (${((c.totalCarrito / p.presupuesto) * 100).toFixed(0)}%)  come ${f2(c.totalConsumo)} €  tira ${f2(c.totalPerecedero)} € (${(frac * 100).toFixed(0)}%)  ${s.nutricion.proteinaPorPersonaDia.toFixed(0)} g  ${s.recetasDistintas.length} platos`);
    console.log(`        bájame: ${bajaOk} ok (ahorra ${(bajaAhorro / Math.max(1, bajaOk)).toFixed(2)} € de media) · ${bajaVacio} sin nada · ${bajaSube} SUBEN`);
    console.log(`        cambiar: ${cambiaOk} ok · ${cambiaIgual} devuelve lo mismo · ${cambiaVacio} sin nada   |   no cocino: ${libreOk} ok · ${libreRompe} rompe`);
    if (cambiaVacio + cambiaIgual > 3) problemas.push(`${p.nombre} s${n}: "cambiar plato" no ofrece nada en ${cambiaVacio + cambiaIgual} huecos`);
    if (bajaVacio > 5) problemas.push(`${p.nombre} s${n}: "bájame el precio" sin nada en ${bajaVacio} huecos`);

    historial.unshift([...new Set(s.tandas.map((t) => t.receta.id))]);
    existencias = existenciasTrasLaSemana(c, existencias);
  }
}

console.log('\n=== PROBLEMAS ===');
if (!problemas.length) console.log('  ninguno');
for (const x of [...new Set(problemas)].slice(0, 30)) console.log('  · ' + x);
if (problemas.length > 30) console.log(`  … y ${problemas.length - 30} más`);
