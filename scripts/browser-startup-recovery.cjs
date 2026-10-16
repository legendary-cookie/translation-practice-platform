const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'chrome', headless: true })
  const report = { checks: [], errors: [] }
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => report.errors.push(error.message))
    await page.addInitScript(() => {
      const pending = []
      window.__qaPendingDatabase = pending
      window.__qaReleaseDatabase = () => { pending.splice(0).forEach(release => release()) }
      const add = IDBOpenDBRequest.prototype.addEventListener
      IDBOpenDBRequest.prototype.addEventListener = function (type, listener, options) {
        if (type !== 'success') return add.call(this, type, listener, options)
        return add.call(this, type, event => pending.push(() => typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event)), options)
      }
    })
    await page.goto('http://127.0.0.1:4178')
    await page.waitForFunction(() => window.__qaPendingDatabase.length > 0)
    await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name: 'Practice', exact: true }).click()
    const open = page.getByRole('button', { name: 'Open translation desk' })
    assert.equal(await open.isDisabled(), true, 'Starting practice must wait for saved-draft recovery')
    await page.evaluate(() => window.__qaReleaseDatabase())
    await open.click()
    await page.locator('#translation-answer').waitFor()
    assert.deepEqual(report.errors, [])
    report.checks.push('Practice start waits for delayed saved-draft recovery and opens once it completes')
    console.log('PASS', report.checks[0])
    await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name: 'Progress', exact: true }).click()
    const library = page.locator('.learning-tools')
    await library.getByLabel('Source', { exact: true }).fill('城市')
    await library.getByLabel('Translation or revision').fill('city')
    await page.evaluate(() => {
      void navigator.locks.request('lingo-practice-local-data-v1', { mode: 'exclusive' }, () => {
        window.__qaWriteHeld = true
        return new Promise(resolve => { window.__qaReleaseWrite = resolve })
      })
    })
    await page.waitForFunction(() => window.__qaWriteHeld)
    await library.getByRole('button', { name: 'Save card', exact: true }).click()
    assert.equal(await library.getByText('city', { exact: true }).evaluate(element => element.tagName), 'TEXTAREA')
    assert.equal(await library.locator('.learning-card').count(), 0)
    await page.evaluate(() => window.__qaReleaseWrite())
    await library.locator('.learning-card').getByText('city', { exact: true }).waitFor()
    await page.reload()
    await page.waitForFunction(() => window.__qaPendingDatabase.length > 0)
    await page.evaluate(() => window.__qaReleaseDatabase())
    await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name: 'Progress', exact: true }).click()
    await library.locator('.learning-card').getByText('city', { exact: true }).waitFor()
    assert.deepEqual(report.errors, [])
    report.checks.push('A queued glossary write is shown as saved only after completion and survives reload')
    console.log('PASS', report.checks[1])
  } catch (error) { report.failure = error.message; console.error(error); process.exitCode = 1 }
  finally { fs.mkdirSync('.browser-qa', { recursive: true }); fs.writeFileSync('.browser-qa/startup-recovery-results.json', JSON.stringify(report, null, 2)); await browser.close() }
})()
