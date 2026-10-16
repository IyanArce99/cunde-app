/**
 * El recorrido de «me gusta» en un móvil (375×812, el ancho de un iPhone):
 * onboarding → marcar un plato desde las alternativas, sin cambiarlo →
 * «Aplicar al menú» con su confirmación → menú → lista → recargar.
 *
 * No marca favoritos «de verdad» del usuario: el estado se borra al empezar.
 */
const platos = () => cy.get('.dia__plato').then(($p) => [...$p].map((e) => e.textContent ?? ''));

describe('favoritos en móvil', () => {
  beforeEach(() => {
    cy.viewport(375, 812);
  });

  it('marcar, aplicar, revisar menú y lista, y recargar', () => {
    cy.visit('/', { onBeforeLoad: (w) => w.localStorage.clear() });
    cy.contains('button', 'Cuadrar mi semana').click();
    cy.get('.super__cp-input').type('35007');
    cy.contains('button', 'Mercadona').click();
    cy.contains('button', 'Seguir').click();
    cy.contains('button', 'Seguir').click();
    cy.contains('button', 'Ver mi semana').click();
    cy.contains('TU SEMANA', { timeout: 60000 }).should('be.visible');
    cy.screenshot('1-semana');

    platos().then((antes) => {
      // Abrir un hueco y marcar «Me gusta» en la primera alternativa.
      cy.get('.dia__hueco--cocinado').first().click();
      cy.get('.hoja-dia__alt-gusta', { timeout: 60000 }).first().as('gusta');
      cy.get('@gusta').should('have.attr', 'aria-pressed', 'false').click();
      cy.get('.hoja-dia__alt-gusta').first().should('have.attr', 'aria-pressed', 'true').and('contain', 'Te gusta');
      cy.screenshot('2-me-gusta');
      cy.get('.hoja-dia__cerrar').click();

      // La semana no ha cambiado; queda pendiente.
      platos().should('deep.equal', antes);
      cy.contains('Has marcado platos que este menú todavía no tiene en cuenta.').should('be.visible');
      cy.screenshot('3-pendiente');

      // Primer toque: dice qué cambia. Segundo: lo hace.
      cy.contains('button', 'Aplicar al menú').click();
      cy.contains('Cambian el menú, la lista y el total.').should('be.visible');
      cy.contains('El presupuesto sigue en').should('be.visible');
      cy.screenshot('4-confirmar');
      cy.contains('button', 'Aplicar al menú').click();
      cy.contains('Has marcado platos', { timeout: 60000 }).should('not.exist');
      cy.contains('Aplicado al menú.').should('be.visible').invoke('text').then((t) => cy.log(t));
      cy.screenshot('5-aplicada');
    });

    platos().then((menu) => {
      cy.contains('button', 'COMPRA').click();
      cy.get('.compra__lista', { timeout: 30000 }).should('be.visible');
      cy.get('.compra__pie-cifra').invoke('text').then((total) => {
        cy.screenshot('6-lista');
        cy.reload();
        cy.get('.compra__pie-cifra', { timeout: 30000 }).invoke('text').should('equal', total);
        cy.screenshot('7-lista-recargada');
        cy.contains('button', 'SEMANA').click();
        platos().should('deep.equal', menu);
        cy.contains('Has marcado platos').should('not.exist');
        cy.window().then((w) => {
          const clave = Object.keys(w.localStorage).find((k) => k.startsWith('cunde:estado'))!;
          const estado = JSON.parse(w.localStorage.getItem(clave)!);
          expect(Object.values(estado.preferenciasPlatos).filter((p) => (p as { valoracion: string }).valoracion === 'me_gusta')).to.have.length(1);
        });
      });
    });
  });
});
