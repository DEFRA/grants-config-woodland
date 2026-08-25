import agreement from './agreement.json'

describe('accept agreement page', () => {
  test('contains the checkbox and submit button in a form followed by update details', () => {
    const [row] = agreement.pages.accept.components
    const [column] = row.components
    const formIndex = column.components.findIndex(
      ({ component }) => component === 'form'
    )
    const form = column.components[formIndex]

    expect(row.component).toBe('grid-row')
    expect(column).toMatchObject({
      component: 'grid-column',
      width: 'two-thirds'
    })
    expect(form).toEqual({
      component: 'form',
      actionId: 'accept',
      components: [
        expect.objectContaining({ component: 'checkboxes', name: 'confirm' }),
        { component: 'button', actionId: 'accept' }
      ]
    })
    expect(column.components[formIndex + 1]).toMatchObject({
      component: 'details'
    })
    expect(form.components).not.toContainEqual(
      expect.objectContaining({ component: 'details' })
    )
  })
})
