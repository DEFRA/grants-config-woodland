import agreement from './agreement.json'

describe('offered agreement page', () => {
  test('configures the Payments table and preceding printable-link spacing', () => {
    const components = agreement.pages.offered.components
    const paymentsHeadingIndex = components.findIndex(
      ({ component, text }) => component === 'heading' && text === 'Payments'
    )
    const paymentsTable = components.find(
      ({ component }) => component === 'table'
    )

    expect(paymentsTable).toMatchObject({
      classes: 'govuk-table--small-text-until-tablet table-bordered',
      layout: 'full-width',
      insertActionsAfter: true
    })
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
