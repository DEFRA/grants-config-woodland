import agreement from './agreement.json'

describe('document agreement page', () => {
  test('retains document and print behaviour with explicit full-width component trees', () => {
    const documentPage = agreement.pages.document
    const [pageRow] = documentPage.components

    expect(documentPage).toMatchObject({
      layout: 'document',
      contents: true,
      print: true
    })
    expect(pageRow).toMatchObject({
      component: 'grid-row',
      components: [
        {
          component: 'grid-column',
          width: 'full'
        }
      ]
    })
    expect(pageRow.components[0].components[0]).toMatchObject({
      component: 'notification-banner'
    })

    for (const section of documentPage.sections) {
      expect(section.components).toHaveLength(1)
      expect(section.components[0]).toMatchObject({
        component: 'grid-row',
        components: [
          {
            component: 'grid-column',
            width: 'full'
          }
        ]
      })
    }
  })
})
