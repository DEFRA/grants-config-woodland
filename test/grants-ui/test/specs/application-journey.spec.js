import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import Ajv2020 from 'ajv/dist/2020.js'
import { authenticateTo } from '../utils/auth.js'
import { clearApplicationData } from '../utils/backend.js'
import { analyzeAccessibility } from '../utils/accessibility.js'
import { getApplicationSubmission } from '../utils/gas.js'

const gasConfig = JSON.parse(
  readFileSync(
    new URL(
      '../../../../configurations/woodland/gas/gas.json',
      import.meta.url
    ),
    'utf8'
  )
)

const CRN = '1100943757'
const SBI = '113593357'
const GRANT_CODE = 'woodland'

test.describe('Woodland Management Plan application', () => {
  test.beforeEach(async () => {
    await clearApplicationData(SBI, GRANT_CODE)
  })

  test(
    'submits a full WMP application from start to confirmation',
    { tag: ['@cdp', '@ci'] },
    async ({ page }) => {
      let referenceNumber
      await test.step('authentication', async () => {
        await authenticateTo(page, 'woodland', CRN)
      })

      await test.step('check-details', async () => {
        await expect(page).toHaveURL('/woodland/check-details')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Confirm your details'
        )
        await analyzeAccessibility(page)
      })

      await test.step('check-details -> update-details -> check-details', async () => {
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Continue' }).click()

        await expect(page).toHaveURL('/woodland/update-details')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Update your details'
        )
        await analyzeAccessibility(page)
        await page.getByRole('link', { name: 'Back', exact: true }).click()

        await expect(page).toHaveURL('/woodland/check-details')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Confirm your details'
        )
      })

      await test.step('check-details -> tasks', async () => {
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Continue' }).click()
      })

      await test.step('tasks', async () => {
        await expect(page).toHaveURL('/woodland/tasks')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Apply for a woodland management plan (WMP)'
        )
        await analyzeAccessibility(page)
        await assertTaskStatuses(page, [
          { name: 'Check your eligibility', status: 'Not started' },
          { name: 'About your woodland', status: 'Cannot start yet' },
          { name: 'Check and submit application', status: 'Cannot start yet' }
        ])
        await page.getByRole('link', { name: 'Check your eligibility' }).click()
      })

      await test.step('eligibility-land-registered', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-land-registered')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Is all the land in your application registered with the Rural Payments service?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        await expect(page).toHaveURL(
          '/woodland/exit-eligibility-land-registered'
        )
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'All the land in your application must be registered with the Rural Payments service'
        )
        await analyzeAccessibility(page)
        await page.getByRole('link', { name: 'Back', exact: true }).click()

        await expect(page).toHaveURL('/woodland/eligibility-land-registered')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-management-control -> eligibility-tenant', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-management-control')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Management control'
        )
        await analyzeAccessibility(page)
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-tenant', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-tenant')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Are you a tenant of a public body?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('link', { name: 'Back', exact: true }).click()
      })

      await test.step('eligibility-management-control -> eligibility-countersignature', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-management-control')
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-countersignature', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-countersignature')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Have you got the countersignature of the parties who do have management control of the land?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        await expect(page).toHaveURL(
          '/woodland/exit-eligibility-countersignature'
        )
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          "You must get your landlord's countersignature"
        )
        await analyzeAccessibility(page)
        await page.getByRole('link', { name: 'Back', exact: true }).click()

        await expect(page).toHaveURL('/woodland/eligibility-countersignature')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-tenant -> eligibility-grazing-rights', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-tenant')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Are you a tenant of a public body?'
        )
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-grazing-rights', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Does your application include common land or shared grazing?'
        )
        await page.getByRole('link', { name: 'Back', exact: true }).click()
      })

      await test.step('eligibility-tenant -> eligibility-tenant-obligations', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-tenant')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Are you a tenant of a public body?'
        )
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-tenant-obligations', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-tenant-obligations')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Is the proposed plan a requirement of your tenancy or any other legally binding obligation?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        await expect(page).toHaveURL(
          '/woodland/exit-eligibility-tenant-obligations'
        )
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'You cannot apply for a woodland management plan (WMP) for any work that is a requirement of your tenancy or any other legally binding obligation'
        )
        await analyzeAccessibility(page)
        await page.getByRole('link', { name: 'Back', exact: true }).click()

        await expect(page).toHaveURL('/woodland/eligibility-tenant-obligations')
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-grazing-rights -> eligibility-valid-wmp', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Does your application include common land or shared grazing?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
        await page.getByRole('link', { name: 'Back', exact: true }).click()
      })

      await test.step('eligibility-grazing-rights -> eligibility-grazing-rights-guidance', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-grazing-rights-guidance -> eligibility-valid-wmp', async () => {
        await expect(page).toHaveURL(
          '/woodland/eligibility-grazing-rights-guidance'
        )
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'What you need to do'
        )
        await analyzeAccessibility(page)
        await page.getByRole('button', { name: 'Confirm and continue' }).click()
      })

      await test.step('eligibility-valid-wmp -> eligibility-higher-tier', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Do you already have any live woodland management plans (WMPs) on any land in your application?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-higher-tier', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Countryside Stewardship Higher Tier (CSHT)'
        )
        await analyzeAccessibility(page)
        await page.getByRole('link', { name: 'Back', exact: true }).click()
      })

      await test.step('eligibility-valid-wmp -> eligibility-wmp-agreement', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Do you already have any live woodland management plans (WMPs) on any land in your application?'
        )
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-wmp-agreement', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-wmp-agreement')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Enter the FC plan references for any live WMPs'
        )
        await analyzeAccessibility(page)
        await page.getByRole('textbox').fill('WMP-12345, WMP-23456')
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('eligibility-higher-tier', async () => {
        await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Countryside Stewardship Higher Tier (CSHT)'
        )
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('tasks', async () => {
        await expect(page).toHaveURL('/woodland/tasks')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Apply for a woodland management plan (WMP)'
        )
        await assertTaskStatuses(page, [
          { name: 'Check your eligibility', status: 'Completed' },
          { name: 'About your woodland', status: 'Not started' },
          { name: 'Check and submit application', status: 'Cannot start yet' }
        ])
        await page.getByRole('link', { name: 'About your woodland' }).click()
      })

      await test.step('land-parcels', async () => {
        await expect(page).toHaveURL('/woodland/land-parcels')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Select all the eligible land parcels for the location of your woodland'
        )
        await analyzeAccessibility(page)

        // SD6252 7537 is under 0.5ha — selecting it alone should fail validation
        await page.getByRole('checkbox', { name: 'SD6252 7537' }).check()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        await expect(page).toHaveURL('/woodland/land-parcels')
        await expect(page.locator('.govuk-error-summary')).toContainText(
          'Total area of selected land parcels must be more than 0.5ha'
        )

        await page.getByRole('checkbox', { name: 'SD6351 8781' }).check()
        await page.getByRole('checkbox', { name: 'SD6352 8774' }).check()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('total-area-of-woodland', async () => {
        await expect(page).toHaveURL('/woodland/total-area-of-woodland')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Enter total area of woodland in your application'
        )
        await analyzeAccessibility(page)

        await expect(page.locator('.govuk-inset-text')).toContainText(
          'The total area of your selected land parcels is 79.4865ha'
        )

        // combined total below 0.5ha minimum
        await page
          .getByLabel('Enter total area of woodland over 10 years old')
          .fill('0.2')
        await page
          .getByLabel('Enter total area of new woodland under 10 years old')
          .fill('0.2')
        await page.getByRole('button', { name: 'Save and continue' }).click()
        await expect(page.locator('.govuk-error-summary')).toContainText(
          'The total area of woodland must be at least 0.5ha'
        )

        // over-10-years value below 0.4ha minimum
        await page
          .getByLabel('Enter total area of woodland over 10 years old')
          .fill('0.1')
        await page
          .getByLabel('Enter total area of new woodland under 10 years old')
          .fill('0.5')
        await page.getByRole('button', { name: 'Save and continue' }).click()
        await expect(page.locator('.govuk-error-summary')).toContainText(
          'The area of woodland over 10 years old (0.1 ha) does not meet the minimum required area of (0.4 ha)'
        )

        // combined total exceeds total land parcel area
        await page
          .getByLabel('Enter total area of woodland over 10 years old')
          .fill('50')
        await page
          .getByLabel('Enter total area of new woodland under 10 years old')
          .fill('30')
        await page.getByRole('button', { name: 'Save and continue' }).click()
        await expect(page.locator('.govuk-error-summary')).toContainText(
          'Total area of woodland cannot be more than total area of selected land parcels (79.4865ha)'
        )

        await page
          .getByLabel('Enter total area of woodland over 10 years old')
          .fill('40.25')
        await page
          .getByLabel('Enter total area of new woodland under 10 years old')
          .fill('15.75')
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('centre-of-woodland', async () => {
        await expect(page).toHaveURL('/woodland/centre-of-woodland')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Grid reference'
        )
        await analyzeAccessibility(page)
        await page.getByRole('textbox').fill('SP 1234 5678')
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('woodland-name', async () => {
        await expect(page).toHaveURL('/woodland/woodland-name')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'What is the name of your woodland?'
        )
        await analyzeAccessibility(page)
        await page.getByRole('textbox').fill('Test Woodland')
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('which-forestry-commission-team', async () => {
        await expect(page).toHaveURL('/woodland/which-forestry-commission-team')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Which Forestry Commission (FC) team will be advising you?'
        )
        await analyzeAccessibility(page)
        await page
          .getByRole('radio', { name: 'East and East Midlands' })
          .click()
        await page.getByRole('button', { name: 'Save and continue' }).click()
      })

      await test.step('tasks', async () => {
        await expect(page).toHaveURL('/woodland/tasks')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Apply for a woodland management plan (WMP)'
        )
        await assertTaskStatuses(page, [
          { name: 'Check your eligibility', status: 'Completed' },
          { name: 'About your woodland', status: 'Completed' },
          { name: 'Check and submit application', status: 'Not started' }
        ])
        await page
          .getByRole('link', { name: 'Check and submit application' })
          .click()
      })

      await test.step('summary', async () => {
        await expect(page).toHaveURL('/woodland/summary')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Check your answers'
        )
        await analyzeAccessibility(page)
        await page.getByRole('button', { name: 'Continue' }).click()
      })

      await test.step('potential-funding', async () => {
        await expect(page).toHaveURL('/woodland/potential-funding')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Potential funding'
        )
        await analyzeAccessibility(page)
        await page.getByRole('button', { name: 'Continue' }).click()
      })

      await test.step('declaration', async () => {
        await expect(page).toHaveURL('/woodland/declaration')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Submit your application'
        )
        await analyzeAccessibility(page)
        await page.getByRole('button', { name: 'Confirm and submit' }).click()
      })

      await test.step('confirmation', async () => {
        await expect(page).toHaveURL('/woodland/confirmation')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Application submitted'
        )
        await analyzeAccessibility(page)
        await expect(page.locator('.govuk-panel__body')).toContainText(
          /WMP-[A-Z0-9]+-[A-Z0-9]+/
        )
        referenceNumber = await page
          .locator('.govuk-panel__body strong')
          .textContent()

        await test.step('common land extra guidance', async () => {
          await expect(
            page.getByRole('heading', { level: 2, name: 'What you need to do' })
          ).toBeVisible()
          await expect(
            page.getByText(
              'Because your application includes common land or shared grazing'
            )
          ).toBeVisible()
        })
      })

      await test.step('print-submitted-application', async () => {
        const [printTab] = await Promise.all([
          page.context().waitForEvent('page'),
          page
            .getByRole('link', { name: 'View / Print submitted application' })
            .click()
        ])
        await printTab.waitForLoadState()
        await expect(printTab).toHaveURL(
          '/woodland/print-submitted-application'
        )
        await expect(printTab.getByRole('heading', { level: 1 })).toContainText(
          'Apply for a woodland management plan (WMP)'
        )
        await expect(printTab.getByText(referenceNumber)).toBeVisible()
        await expect(
          printTab.getByRole('button', { name: 'Print this page' })
        ).toBeVisible()
        await analyzeAccessibility(printTab)
        await printTab.close()
      })

      if (CI()) {
        await test.step('verify GAS submission', async () => {
          const request = await getApplicationSubmission(referenceNumber)
          expect(request).not.toBeNull()

          expect(request.body.json.metadata.clientRef).toEqual(
            referenceNumber.toLowerCase()
          )
          expect(request.body.json.metadata.sbi).toEqual(SBI)
          expect(request.body.json.metadata.crn).toEqual(CRN)
          expect(request.body.json.metadata.frn).toBeTruthy()
          expect(request.body.json.metadata.configVersion).toMatch(
            /^\d+\.\d+\.\d+$/
          )

          const ajv = new Ajv2020({
            strict: false,
            formats: { 'date-time': true }
          })
          const validate = ajv.compile(gasConfig.phases[0].questions)
          const valid = validate(request.body.json.answers)
          expect(valid, ajv.errorsText(validate.errors)).toBe(true)
        })
      }
    }
  )
})

function CI() {
  return !!process.env.MOCKSERVER_HOST
}

async function assertTaskStatuses(page, tasks) {
  for (const { name, status } of tasks) {
    const item = page.locator('.govuk-task-list__item', { hasText: name })
    await expect(item.locator('.govuk-task-list__status')).toContainText(status)
  }
}
