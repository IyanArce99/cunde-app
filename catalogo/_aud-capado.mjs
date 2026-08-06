import { despensaVisible, semanasDeMemoria, MURO_ACTIVO } from '../src/lib/suscripcion.ts';
const despensa = {
  'arroz (semana pasada)': { cantidad: 1, diasRestantes: 300, semanas: 0 },
  'yogur (2 semanas)':     { cantidad: 1, diasRestantes: 20,  semanas: 2 },
  'lenteja (3 semanas)':   { cantidad: 1, diasRestantes: 10,  semanas: 3 },
};
const esNueva = (v) => (v.semanas ?? 0) === 0;
console.log('MURO_ACTIVO =', MURO_ACTIVO, '\n');
console.log('=== LO QUE EL MOTOR PUEDE DESCONTAR ===');
for (const est of ['ninguna', 'activa', 'caducada']) {
  const v = despensaVisible(despensa, est, esNueva);
  console.log(`  ${est.padEnd(9)} usa ${Object.keys(v).length}/3 · memoria ${semanasDeMemoria(est, 3)}/3 semanas`);
  console.log(`            [${Object.keys(v).join(' · ') || 'nada'}]`);
}
console.log('\n=== Y LO GUARDADO NO SE TOCA ===');
console.log('  claves tras las tres llamadas:', Object.keys(despensa).length, '→', Object.keys(despensa).join(' · '));
