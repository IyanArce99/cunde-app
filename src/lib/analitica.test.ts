import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analitica, registrarSumideroAnalitica } from './analitica';
import {
  CLAVE_INSTALL, _olvidarInstallId, installId, plataforma, sessionId, versionApp,
} from './analitica-identidad';
import {
  CLAVE_COLA, MAXIMO_COLA, _reiniciarCola, _volcarYa, asomar, confirmar,
  cuantosHay, encolar, type EventoEnCola,
} from './analitica-cola';
import { tramoDeltaPrecio, tramoDiferencia, tramoPresupuesto } from './analitica-buckets';
import { construirEvento } from './analitica-supabase';

function evento(id: string, nombre = 'week_generated'): EventoEnCola {
  return {
    event_id: id,
    event_name: nombre,
    install_id: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    app_version: '0.0.1',
    platform: 'web',
    week_number: 1,
    screen: null,
    properties: {},
    ocurrido_en: '2026-08-11T10:00:00.000Z',
  };
}

beforeEach(() => {
  window.localStorage.clear();
  _reiniciarCola();
  _olvidarInstallId();
  registrarSumideroAnalitica(null);
});

describe('identidad', () => {
  it('crea un install_id la primera vez y lo guarda', () => {
    expect(window.localStorage.getItem(CLAVE_INSTALL)).toBeNull();
    const id = installId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(window.localStorage.getItem(CLAVE_INSTALL)).toBe(id);
  });

  it('reutiliza el mismo entre arranques', () => {
    const primero = installId();
    _olvidarInstallId(); // como si la app se cerrara y volviera a abrir
    expect(installId()).toBe(primero);
  });

  it('descarta un valor guardado que no sea un UUID', () => {
    window.localStorage.setItem(CLAVE_INSTALL, 'pepe');
    const id = installId();
    expect(id).not.toBe('pepe');
    expect(id).toMatch(/^[0-9a-f]{8}-/i);
  });

  it('la sesión es estable dentro del mismo arranque', () => {
    expect(sessionId()).toBe(sessionId());
  });

  it('sin Capacitor, la plataforma es web', () => {
    expect(plataforma()).toBe('web');
  });

  it('la versión sale de package.json, no de una constante a mano', () => {
    expect(versionApp()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('cola', () => {
  it('el evento se guarda en la cola antes de enviarse', () => {
    encolar(evento('a'));
    expect(cuantosHay()).toBe(1);
  });

  it('confirmar saca solo los confirmados', () => {
    encolar(evento('a'));
    encolar(evento('b'));
    confirmar(['a']);
    expect(cuantosHay()).toBe(1);
    expect(asomar(10)[0].event_id).toBe('b');
  });

  it('lo no confirmado permanece', () => {
    encolar(evento('a'));
    confirmar([]);
    expect(cuantosHay()).toBe(1);
  });

  it('la cola sobrevive a reiniciar la app', () => {
    encolar(evento('a'));
    _volcarYa();
    const enDisco = window.localStorage.getItem(CLAVE_COLA);
    _reiniciarCola();
    window.localStorage.setItem(CLAVE_COLA, enDisco!);
    expect(cuantosHay()).toBe(1);
  });

  it('respeta el máximo tirando los más antiguos', () => {
    for (let i = 0; i < MAXIMO_COLA + 10; i++) encolar(evento(`e${i}`));
    expect(cuantosHay()).toBe(MAXIMO_COLA);
    /* FIFO: se van los primeros, se quedan los últimos. */
    expect(asomar(1)[0].event_id).toBe('e10');
  });

  it('un JSON corrupto no rompe nada', () => {
    window.localStorage.setItem(CLAVE_COLA, '{no es json');
    _reiniciarCola();
    window.localStorage.setItem(CLAVE_COLA, '{no es json');
    expect(() => cuantosHay()).not.toThrow();
    expect(cuantosHay()).toBe(0);
  });

  it('descarta entradas sin forma de evento', () => {
    window.localStorage.setItem(CLAVE_COLA, JSON.stringify([{ basura: 1 }, evento('ok')]));
    _reiniciarCola();
    window.localStorage.setItem(CLAVE_COLA, JSON.stringify([{ basura: 1 }, evento('ok')]));
    expect(cuantosHay()).toBe(1);
  });
});

describe('lo que se manda, y lo que no', () => {
  it('week_number y screen van en columna, no dentro de properties', () => {
    const e = construirEvento('week_generated', { week_number: 3, screen: 'semana', people: 2 });
    expect(e.week_number).toBe(3);
    expect(e.screen).toBe('semana');
    expect(e.properties).not.toHaveProperty('week_number');
    expect(e.properties).not.toHaveProperty('screen');
    expect(e.properties.people).toBe(2);
  });

  it('un screen que no está en la lista no viaja', () => {
    const e = construirEvento('app_opened', { screen: '/ruta/rara/123' as never });
    expect(e.screen).toBeNull();
  });

  it('un week_number absurdo no viaja', () => {
    expect(construirEvento('week_generated', { week_number: 99999 }).week_number).toBeNull();
    expect(construirEvento('week_generated', { week_number: -1 }).week_number).toBeNull();
  });

  it('cada evento lleva su event_id único', () => {
    const a = construirEvento('app_opened', {});
    const b = construirEvento('app_opened', {});
    expect(a.event_id).not.toBe(b.event_id);
  });

  it('unas propiedades enormes se recortan en vez de viajar enteras', () => {
    const e = construirEvento('week_generated', { dish_id: 'x'.repeat(5000) });
    expect(e.properties._recortado).toBe(true);
    expect(JSON.stringify(e.properties).length).toBeLessThan(200);
  });
});

describe('buckets', () => {
  it('el presupuesto sale por tramos, nunca el importe', () => {
    expect(tramoPresupuesto(63.27)).toBe('50-75');
    expect(tramoPresupuesto(30)).toBe('30-50');
    expect(tramoPresupuesto(200)).toBe('150+');
    expect(tramoPresupuesto(0)).toBe('desconocido');
  });

  it('la diferencia lleva signo: pasarse y ahorrar no son lo mismo', () => {
    expect(tramoDiferencia(100, 100.5)).toBe('clavado');
    expect(tramoDiferencia(100, 107)).toBe('+5-10pct');
    expect(tramoDiferencia(100, 93)).toBe('-5-10pct');
    expect(tramoDiferencia(0, 50)).toBe('desconocido');
  });

  it('el delta de precio también', () => {
    expect(tramoDeltaPrecio(2, 2)).toBe('igual');
    expect(tramoDeltaPrecio(2, 2.4)).toBe('+10-25pct');
    expect(tramoDeltaPrecio(2, 1.2)).toBe('-25pct+');
  });
});

describe('el contrato con la app', () => {
  it('sin sumidero registrado, emitir no hace nada y no rompe', () => {
    expect(() => analitica('app_opened')).not.toThrow();
    expect(cuantosHay()).toBe(0);
  });

  it('un sumidero que revienta no tumba la acción del usuario', () => {
    registrarSumideroAnalitica(() => { throw new Error('supabase caído'); });
    expect(() => analitica('shopping_item_checked')).not.toThrow();
  });

  it('el sumidero se puede sustituir en tests', () => {
    const espia = vi.fn();
    registrarSumideroAnalitica(espia);
    analitica('week_generated', { week_number: 2, people: 2 });
    expect(espia).toHaveBeenCalledWith('week_generated', { week_number: 2, people: 2 });
  });

  it('emitir es síncrono: no devuelve una promesa que nadie espera', () => {
    registrarSumideroAnalitica(() => {});
    expect(analitica('app_opened')).toBeUndefined();
  });
});
