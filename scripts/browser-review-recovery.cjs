const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright-core')
const report = { checks: [], errors: [] }
;(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(error.message))
    const nav = name => page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name, exact: true }).click()
    await page.goto('http://127.0.0.1:4178')
    await nav('Exam')
    await page.getByRole('button', { name: 'Start Exam Simulation', exact: true }).first().click()
    await page.locator('#exam-answer-input').fill('Synthetic recoverable exam answer')
    await page.evaluate(() => {
      window.qaRejectResumable = true
      const original = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (value, ...args) {
        if (window.qaRejectResumable && this.name === 'examRuns' && !value.evaluationPausedAt) throw new DOMException('Synthetic resumable write rejection', 'QuotaExceededError')
        return original.call(this, value, ...args)
      }
    })
    await page.getByRole('button', { name: 'Submit Exam', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, Submit Now →', exact: true }).click()
    await page.getByText(/resume state could not be saved/).first().waitFor()
    assert.equal(await page.locator('#exam-answer-input').inputValue(), 'Synthetic recoverable exam answer')
    await page.evaluate(() => { window.qaRejectResumable = false })
    await page.getByRole('button', { name: 'Save & Exit', exact: true }).click()
    await page.getByRole('button', { name: /Resume Exam \(/ }).waitFor()
    report.checks.push('Evaluation plus resumable-save failure leaves exact answer and a working Save & Exit retry')
    await nav('Home')
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'lingo-practice-data-cleared-v1', newValue: 'active:synthetic-other-tab' })))
    await page.getByText(/reload it before saving new work/).waitFor()
    await page.getByRole('button', { name: /Interpreting Listen/ }).click()
    const start = page.getByRole('button', { name: 'Open interpreting desk' })
    await start.waitFor()
    await start.click()
    assert.equal(await page.locator('.interpreting-workspace').count(), 0)
    report.checks.push('A remotely cleared tab refuses to start an unsavable interpreting workspace')
    assert.deepEqual(report.errors, [])
    report.checks.forEach(check => console.log('PASS', check))
    await context.close()
  } catch (error) { report.failure = error.message; console.error(error); process.exitCode = 1 }
  finally { fs.mkdirSync('.browser-qa', { recursive: true }); fs.writeFileSync('.browser-qa/review-recovery-results.json', JSON.stringify(report, null, 2)); await browser.close() }
})()
