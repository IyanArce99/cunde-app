/**
 * ═══ EL CÓDIGO POSTAL ELIGE LA ZONA, Y LO QUE NO SE SABE SE DICE ═══
 *
 * Los códigos de Gran Canaria salen de la medición del 14 oct 2026
 * (catalogo/zonas/gran-canaria-cp.json): Mercadona asigna cada uno a un
 * almacén, o a ninguno. Un almacén no representa la isla: cuenta el que toca.
 */
import { describe, expect, it } from 'vitest';
import { resolverZona, textoDeZona, zonaAlArrancar } from './zona';

describe('resolver la zona', () => {
  it('Las Palmas de Gran Canaria, con su almacén', () => {
    expect(resolverZona('35001')).toEqual({ zona: 'gran-canaria', almacen: '4701', cobertura: 'medida' });
    expect(resolverZona('35005')).toEqual({ zona: 'gran-canaria', almacen: '3120', cobertura: 'medida' });
  });

  it('el sur y el norte de la isla, cada uno con el suyo', () => {
    expect(resolverZona('35100').almacen).toBe('4570'); // San Bartolomé de Tirajana
    expect(resolverZona('35120').almacen).toBe('4377'); // Mogán
    expect(resolverZona('35400').almacen).toBe('4677'); // Arucas
  });

  it('Gran Canaria sin reparto online no es Gran Canaria medida', () => {
    // Teror: Mercadona no le asigna almacén. La tienda física no está medida.
    expect(resolverZona('35330')).toMatchObject({ zona: 'madrid', cobertura: 'sin-cobertura' });
  });

  it('el resto de Canarias, sin cobertura: allí faltan productos, no solo cambian precios', () => {
    expect(resolverZona('35500').cobertura).toBe('sin-cobertura'); // Lanzarote
    expect(resolverZona('35600').cobertura).toBe('sin-cobertura'); // Fuerteventura
    expect(resolverZona('38001').cobertura).toBe('sin-cobertura'); // Tenerife
  });

  it('Madrid es Madrid; el resto, Madrid como referencia y dicho', () => {
    expect(resolverZona('28001')).toEqual({ zona: 'madrid', almacen: 'mad3', cobertura: 'medida' });
    expect(resolverZona('41001')).toMatchObject({ zona: 'madrid', cobertura: 'referencia' });
    expect(resolverZona(null)).toMatchObject({ zona: 'madrid', cobertura: 'referencia' });
    expect(resolverZona('99999')).toMatchObject({ zona: 'madrid', cobertura: 'referencia' });
  });

  it('lo que se dice nunca hace pasar Madrid por la zona del usuario', () => {
    expect(textoDeZona(resolverZona('38001'))).toMatch(/Madrid como ejemplo/);
    expect(textoDeZona(resolverZona('41001'))).toMatch(/de Madrid/);
    expect(textoDeZona(resolverZona('35001'))).toMatch(/Gran Canaria.*4701/);
  });
});

describe('al arrancar', () => {
  const guardado = (cp: string | null) => (clave: string) =>
    (clave === 'cunde:estado:v16' ? JSON.stringify({ perfil: { codigoPostal: cp } }) : null);

  it('sale del código postal guardado', () => {
    expect(zonaAlArrancar(guardado('35014')).zona).toBe('gran-canaria');
    expect(zonaAlArrancar(guardado('28001')).zona).toBe('madrid');
  });

  it('también de una clave vieja del estado', () => {
    const leer = (clave: string) => (clave === 'cunde:estado:v15' ? JSON.stringify({ perfil: { codigoPostal: '35014' } }) : null);
    expect(zonaAlArrancar(leer).zona).toBe('gran-canaria');
  });

  it('sin estado, o roto, Madrid como referencia', () => {
    expect(zonaAlArrancar(() => null)).toMatchObject({ zona: 'madrid', cobertura: 'referencia' });
    expect(zonaAlArrancar(() => '{roto')).toMatchObject({ zona: 'madrid', cobertura: 'referencia' });
  });
});
