import agreement from './agreement.json'

describe('accepted agreement page', () => {
  test('places all confirmation content in an explicit two-thirds grid column', () => {
    const [row] = agreement.pages.accepted.components
    const [column] = row.components

    expect(agreement.pages.accepted.components).toHaveLength(1)
    expect(row.component).toBe('grid-row')
    expect(column).toMatchObject({
      component: 'grid-column',
      width: 'two-thirds'
    })
    expect(column.components[0]).toMatchObject({
      component: 'panel',
      title: 'Agreement offer accepted'
    })
    expect(column.components.at(-1)).toMatchObject({
      component: 'paragraph',
      text: 'The RPA responds to email queries within 10 working days.'
    })
    expect(column.components).toHaveLength(10)
  })
})
