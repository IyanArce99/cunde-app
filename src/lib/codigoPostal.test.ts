import { describe, expect, it } from 'vitest';
import { esCodigoPostal, limpiarCodigoPostal, provinciaDe } from './codigoPostal';

describe('código postal', () => {
  it('vale con cinco cifras y una provincia que exista', () => {
    for (const cp of ['28001', '01001', '52006', '33011', '08002']) expect(esCodigoPostal(cp)).toBe(true);
  });

  it('no vale a medias, ni con letras, ni con una provincia inventada', () => {
    for (const cp of ['', '2800', '280011', '28O01', '00123', '53001', '99999', ' 28001']) {
      expect(esCodigoPostal(cp), cp).toBe(false);
    }
    expect(esCodigoPostal(null)).toBe(false);
    expect(esCodigoPostal(undefined)).toBe(false);
  });

  it('lo tecleado se queda en cifras y en cinco', () => {
    expect(limpiarCodigoPostal('28 001')).toBe('28001');
    expect(limpiarCodigoPostal('28001234')).toBe('28001');
    expect(limpiarCodigoPostal('a2b8')).toBe('28');
  });

  it('del código solo sale la provincia', () => {
    expect(provinciaDe('33011')).toBe('33');
    expect(provinciaDe('08002')).toBe('08');
  });

  it('y de uno que no vale no sale nada', () => {
    expect(provinciaDe('3301')).toBeUndefined();
    expect(provinciaDe(null)).toBeUndefined();
  });
});
