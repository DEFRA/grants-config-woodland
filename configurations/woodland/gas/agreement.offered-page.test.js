import agreement from './agreement.json'

describe('offered agreement page', () => {
  test('configures the Payments table, actions, and printable-link spacing', () => {
    const components = agreement.pages.offered.components
    const paymentsHeadingIndex = components.findIndex(
      ({ component, text }) => component === 'heading' && text === 'Payments'
    )
    const paymentsTableIndex = components.findIndex(
      ({ component }) => component === 'table'
    )
    const paymentsTable = components[paymentsTableIndex]

    expect(paymentsTable).toMatchObject({
      classes: 'govuk-table--small-text-until-tablet table-bordered',
      width: 'full'
    })
    expect(paymentsTable).not.toHaveProperty('insertActionsAfter')
    expect(
      components
        .slice(paymentsTableIndex, paymentsTableIndex + 3)
        .map(({ component }) => component)
    ).toEqual(['table', 'actions', 'details'])
    expect(
      components.slice(paymentsHeadingIndex - 2, paymentsHeadingIndex + 1)
    ).toEqual([
      {
        component: 'paragraph',
        items: [
          {
            component: 'url',
            href: {
              urlTemplate: '/agreements/{agreementNumber}/document',
              params: {
                agreementNumber: '$.agreement.agreementNumber'
              }
            },
            text: 'View a printable version of your draft agreement (opens in new tab)',
            target: '_blank'
          }
        ]
      },
      {
        component: 'line-break'
      },
      {
        component: 'heading',
        level: 2,
        text: 'Payments'
      }
    ])
  })
})
