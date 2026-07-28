describe('Onboarding', () => {
  it('muestra la portada al visitar la raíz', () => {
    cy.visit('/')
    cy.contains('LA COMPRA').should('be.visible')
    cy.contains('button', 'Empezar').should('be.visible')
  })
})