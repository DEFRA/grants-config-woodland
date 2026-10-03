import { test, expect } from '@playwright/test'
import { authenticateTo } from '../utils/auth.js'
import { clearApplicationData } from '../utils/backend.js'
import { analyzeAccessibility } from '../utils/accessibility.js'
import {
  clearExpectation,
  setDefaultStatusQuery404Response,
  getApplicationSubmission,
  setStatusQueryResponse
} from '../utils/gas.js'
import { Mongo } from '../utils/mongo.js'

const CRN = '1100943838'
const SBI = '107173507'
const GRANT_CODE = 'woodland'

test.describe('Woodland Management Plan application lifecycle', () => {
  const expectationIds = []
  let statusQuery404ExpectationId

  async function clearDefaultStatusQuery404Response() {
    if (!statusQuery404ExpectationId) {
      return
    }

    const index = expectationIds.indexOf(statusQuery404ExpectationId)

    await clearExpectation(statusQuery404ExpectationId)
    statusQuery404ExpectationId = undefined

    if (index !== -1) {
      expectationIds.splice(index, 1)
    }
  }

  test.beforeEach(async () => {
    await clearApplicationData(SBI, GRANT_CODE)
    statusQuery404ExpectationId = await setDefaultStatusQuery404Response()
    expectationIds.push(statusQuery404ExpectationId)
  })

  test.afterEach(async () => {
    for (const id of expectationIds) {
      await clearExpectation(id)
    }
    expectationIds.length = 0
    statusQuery404ExpectationId = undefined
  })

  test(
    'submits, amends, receives an offer, submits claims, and is withdrawn',
    { tag: ['@ci'] },
    async ({ page: initialPage, browser }) => {
      let page = initialPage
      let referenceNumber

      await test.step('submit application', async () => {
        await authenticateTo(page, 'woodland', CRN)

        // check-details
        await expect(page).toHaveURL('/woodland/check-details')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Continue' }).click()

        // tasks
        await expect(page).toHaveURL('/woodland/tasks')
        await page.getByRole('link', { name: 'Check your eligibility' }).click()

        // eligibility-land-registered
        await expect(page).toHaveURL('/woodland/eligibility-land-registered')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // eligibility-management-control
        await expect(page).toHaveURL('/woodland/eligibility-management-control')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // eligibility-tenant
        await expect(page).toHaveURL('/woodland/eligibility-tenant')
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // eligibility-grazing-rights
        await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // eligibility-valid-wmp
        await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
        await page.getByRole('radio', { name: 'No' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // eligibility-higher-tier
        await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
        await page.getByRole('radio', { name: 'Yes' }).click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // tasks
        await expect(page).toHaveURL('/woodland/tasks')
        await page.getByRole('link', { name: 'About your woodland' }).click()

        // land-parcels
        await expect(page).toHaveURL('/woodland/land-parcels')
        await page.getByRole('checkbox', { name: 'SD6351 8781' }).check()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // total-area-of-woodland
        await expect(page).toHaveURL('/woodland/total-area-of-woodland')
        await page
          .getByLabel('Enter total area of woodland over 10 years old')
          .fill('60')
        await page
          .getByLabel('Enter total area of new woodland under 10 years old')
          .fill('8.0498')
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // centre-of-woodland
        await expect(page).toHaveURL('/woodland/centre-of-woodland')
        await page.getByRole('textbox').fill('SP 1234 5678')
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // woodland-name
        await expect(page).toHaveURL('/woodland/woodland-name')
        await page.getByRole('textbox').fill('Test Woodland')
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // which-forestry-commission-team
        await expect(page).toHaveURL('/woodland/which-forestry-commission-team')
        await page
          .getByRole('radio', { name: 'East and East Midlands' })
          .click()
        await page.getByRole('button', { name: 'Save and continue' }).click()

        // tasks
        await expect(page).toHaveURL('/woodland/tasks')
        await page
          .getByRole('link', { name: 'Check and submit application' })
          .click()

        // summary
        await expect(page).toHaveURL('/woodland/summary')
        await page.getByRole('button', { name: 'Continue' }).click()

        // potential-funding
        await expect(page).toHaveURL('/woodland/potential-funding')
        await page.getByRole('button', { name: 'Continue' }).click()

        // declaration
        await expect(page).toHaveURL('/woodland/declaration')
        // After submit, GAS should have a status for the generated reference.
        await clearDefaultStatusQuery404Response()
        await page.getByRole('button', { name: 'Confirm and submit' }).click()

        // confirmation
        await expect(page).toHaveURL('/woodland/confirmation')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Application submitted'
        )
        await expect(page.locator('.govuk-panel__body')).toContainText(
          /WMP-[A-Z0-9]+-[A-Z0-9]+/
        )
        referenceNumber = await page
          .locator('.govuk-panel__body strong')
          .textContent()
      })

      await test.step('verify application submission to GAS', async () => {
        const request = await getApplicationSubmission(referenceNumber)
        expect(request).not.toBeNull()
        expect(request.body.json.metadata.clientRef).toEqual(
          referenceNumber.toLowerCase()
        )
        expect(request.body.json.metadata.sbi).toEqual(SBI)
        expect(request.body.json.metadata.crn).toEqual(CRN)
      })

      await test.step('GAS status is now APPLICATION_RECEIVED', async () => {
        expectationIds.push(
          await setStatusQueryResponse(referenceNumber, 'APPLICATION_RECEIVED')
        )
      })

      await test.step('reopen browser and are redirected to /confirmation', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/woodland/confirmation')
      })

      await test.step('GAS status is now STATUS_RETURNED_TO_CUSTOMER', async () => {
        expectationIds.push(
          await setStatusQueryResponse(
            referenceNumber,
            'STATUS_RETURNED_TO_CUSTOMER'
          )
        )
      })

      await test.step('reopen browser and are redirected to /returned-to-customer', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/woodland/returned-to-customer')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'returned to you to make amendments'
        )
        await analyzeAccessibility(page)
        expect(await Mongo.getApplicationStatus(SBI, GRANT_CODE)).toBe(
          'REOPENED'
        )
      })

      await test.step('amend application and resubmit', async () => {
        // continue from the returned-to-customer landing page into the summary
        await page.getByRole('button', { name: 'Continue' }).click()

        // summary
        await expect(page).toHaveURL('/woodland/summary')
        await page.getByRole('button', { name: 'Continue' }).click()

        // potential-funding
        await expect(page).toHaveURL('/woodland/potential-funding')
        await page.getByRole('button', { name: 'Continue' }).click()

        // declaration
        await expect(page).toHaveURL('/woodland/declaration')
        await page.getByRole('button', { name: 'Confirm and submit' }).click()

        // confirmation
        await expect(page).toHaveURL('/woodland/confirmation')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Application submitted'
        )
        await expect(page.locator('.govuk-panel__body')).toContainText(
          /WMP-[A-Z0-9]+-[A-Z0-9]+/
        )
        referenceNumber = await page
          .locator('.govuk-panel__body strong')
          .textContent()
      })

      await test.step('GAS status is now STATUS_AGREEMENT_OFFERED', async () => {
        expectationIds.push(
          await setStatusQueryResponse(
            referenceNumber,
            'STATUS_AGREEMENT_OFFERED'
          )
        )
      })

      await test.step('reopen browser and are redirected to /agreement', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/agreement')
      })

      await test.step('GAS status is now STATUS_APPLICATION_COMPLETED', async () => {
        expectationIds.push(
          await setStatusQueryResponse(
            referenceNumber,
            'STATUS_APPLICATION_COMPLETED'
          )
        )
      })

      await test.step('reopen browser and are redirected to /agreement', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/agreement')
      })

      await test.step('GAS status is now STATUS_AWAITING_CLAIM', async () => {
        expectationIds.push(
          await setStatusQueryResponse(referenceNumber, 'STATUS_AWAITING_CLAIM')
        )
      })

      await test.step('reopen browser and are redirected to /claim', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/woodland/claim')
        expect(await Mongo.getApplicationStatus(SBI, GRANT_CODE)).toBe(
          'CLAIM_STARTED'
        )
      })

      await test.step('review WMP claim', async () => {
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Review your WMP claim'
        )
        await expect(page.locator('.govuk-inset-text')).toContainText(
          'Total claim amount: £2,553.30'
        )
        await analyzeAccessibility(page)
        await page.getByRole('button', { name: 'Continue' }).click()
      })

      await test.step('submit claim', async () => {
        await expect(page).toHaveURL('/woodland/claim-declaration')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Declarations'
        )
        await analyzeAccessibility(page)
        await page.getByRole('button', { name: 'Confirm and submit' }).click()
        expect(await Mongo.getApplicationStatus(SBI, GRANT_CODE)).toBe(
          'CLAIM_SUBMITTED'
        )
      })

      await test.step('claim confirmation', async () => {
        await expect(page).toHaveURL('/woodland/claim-confirmation')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'Claim submitted'
        )
        await expect(page.locator('.govuk-panel__body')).toContainText(
          `${referenceNumber}-C01`
        )
        await analyzeAccessibility(page)
      })

      await test.step('reopen browser and are redirected to /claim-confirmation', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/woodland/claim-confirmation')
      })

      await test.step('grants-ui-backend status is SUBMITTED and GAS status is APPLICATION_WITHDRAWN', async () => {
        await Mongo.setApplicationStatus(SBI, GRANT_CODE, 'SUBMITTED')
        expectationIds.push(
          await setStatusQueryResponse(referenceNumber, 'APPLICATION_WITHDRAWN')
        )
      })

      await test.step('reopen browser and are redirected to /check-details', async () => {
        await page.context().close()
        const context = await browser.newContext()
        page = await context.newPage()
        await authenticateTo(page, 'woodland', CRN)
        await expect(page).toHaveURL('/woodland/check-details')
        expect(await Mongo.getApplicationStatus(SBI, GRANT_CODE)).toBe(
          'CLEARED'
        )
      })
    }
  )
})
