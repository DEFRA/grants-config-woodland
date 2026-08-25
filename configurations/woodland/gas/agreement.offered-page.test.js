import agreement from './agreement.json'

const legacyLayoutProperties = ['width', 'insertActionsAfter']

function flattenComponents(components) {
  return components.flatMap((component) => [
    component,
    ...flattenComponents(component.components ?? [])
  ])
}

describe('offered agreement page', () => {
  test('places the payments table, Continue button and update details in explicit rows', () => {
    const [contentRow, tableRow, actionRow] = agreement.pages.offered.components
    const tableColumn = tableRow.components[0]
    const actionColumn = actionRow.components[0]

    expect(contentRow).toMatchObject({
      component: 'grid-row',
      components: [{ component: 'grid-column', width: 'two-thirds' }]
    })
    expect(tableColumn).toMatchObject({
      component: 'grid-column',
      width: 'full',
      components: [{ component: 'table' }]
    })
    expect(actionColumn.components.map(({ component }) => component)).toEqual([
      'button',
      'details'
    ])
    expect(actionColumn.components[0]).toEqual({
      component: 'button',
      actionId: 'accept'
    })

    for (const component of flattenComponents(
      agreement.pages.offered.components
    )) {
      expect(component.component).not.toBe('actions')
      for (const property of legacyLayoutProperties) {
        if (component.component !== 'grid-column') {
          expect(component).not.toHaveProperty(property)
        }
      }
    }
  })
})
