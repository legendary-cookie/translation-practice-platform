const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')

const out = path.resolve(process.env.BROWSER_QA_ARTIFACTS || '.browser-qa')
fs.mkdirSync(out, { recursive: true })

async function readDraft(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingo-practice-local')
    open.onsuccess = () => {
      const db = open.result
      const read = db.transaction('workspace').objectStore('workspace').get('written-draft')
      read.onsuccess = () => { resolve(read.result); db.close() }
      read.onerror = () => { reject(read.error); db.close() }
    }
    open.onerror = () => reject(open.error)
  }))
}

;(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const checks = []
  const pass = (name) => { checks.push(name); console.log('PASS', name) }
  const nav = (page, name) => page.locator('.sidebar').getByRole('button', { name, exact: true }).click()
  try {
    const a = await context.newPage()
    await a.goto('http://127.0.0.1:4178')
    await nav(a, 'Practice')
    await a.getByRole('button', { name: 'Open translation desk' }).click()
    await a.locator('#translation-answer').fill('Synthetic v1')
    await a.getByText('Draft saved on this device', { exact: false }).waitFor()
    const b = await context.newPage()
    await b.goto('http://127.0.0.1:4178')
    await b.getByRole('button', { name: 'Continue translation' }).waitFor()
    await a.locator('#translation-answer').fill('Synthetic v2 from first owner')
    await a.getByText('Draft saved on this device', { exact: false }).waitFor()
    await b.getByRole('button', { name: 'Continue translation' }).click()
    await b.getByText('This saved draft is already open', { exact: false }).waitFor()
    assert.equal(await b.locator('#translation-answer').count(), 0)
    assert.equal((await readDraft(a)).answer, 'Synthetic v2 from first owner')
    pass('A second tab cannot overwrite the active singleton draft')
    await a.close()
    await b.getByRole('button', { name: 'Continue translation' }).click()
    await b.locator('#translation-answer').waitFor()
    assert.equal(await b.locator('#translation-answer').inputValue(), 'Synthetic v2 from first owner')
    pass('Stale Home snapshot is refreshed after editor ownership handoff')
    await b.locator('#translation-answer').fill('Synthetic v3 before news setup')
    await b.getByText('Draft saved on this device', { exact: false }).waitFor()
    await nav(b, 'Home')
    await b.getByRole('button', { name: /News translation Work/ }).click()
    await b.getByRole('button', { name: 'Open translation desk' }).waitFor()
    assert.equal((await readDraft(b)).answer, 'Synthetic v3 before news setup')
    pass('Opening News setup retains the saved written answer')
    b.once('dialog', (dialog) => dialog.dismiss())
    await b.getByRole('button', { name: 'Open translation desk' }).click()
    assert.equal((await readDraft(b)).answer, 'Synthetic v3 before news setup')
    await nav(b, 'Home')
    await b.getByRole('button', { name: 'Continue translation' }).click()
    await b.locator('#translation-answer').fill('Synthetic v4 after cancel')
    await b.getByText('Draft saved on this device', { exact: false }).waitFor()
    assert.equal((await readDraft(b)).answer, 'Synthetic v4 after cancel')
    pass('Cancelling replacement retains ownership and subsequent autosave')
    const stale = await context.newPage()
    await stale.goto('http://127.0.0.1:4178')
    await nav(b, 'Settings')
    await b.getByRole('button', { name: 'Delete local data', exact: true }).click()
    await b.getByRole('button', { name: 'Confirm deletion', exact: true }).click()
    await b.getByRole('heading', { name: 'Translate with intention.', exact: true }).waitFor()
    assert.equal(await readDraft(b), undefined)
    await stale.getByText('Local data was cleared in another tab.', { exact: false }).waitFor()
    const fresh = await context.newPage()
    await fresh.goto('http://127.0.0.1:4178')
    await nav(fresh, 'Practice')
    await fresh.getByRole('button', { name: 'Open translation desk' }).click()
    await fresh.locator('#translation-answer').fill('Synthetic new post-delete draft')
    await fresh.getByText('Draft saved on this device', { exact: false }).waitFor()
    assert.equal((await readDraft(fresh)).answer, 'Synthetic new post-delete draft')
    pass('Successful deletion releases the old owner and fresh-tab saving works')
    await stale.locator('.sidebar').getByRole('button', { name: 'Practice', exact: true }).click()
    await stale.getByRole('button', { name: 'Open translation desk' }).click()
    assert.equal(await stale.locator('#translation-answer').count(), 0)
    assert.equal((await readDraft(fresh)).answer, 'Synthetic new post-delete draft')
    pass('Stale pre-delete tab cannot resurrect its old answer')
    fs.writeFileSync(path.join(out, 'draft-ownership-results.json'), JSON.stringify({ checks, browser: await browser.version() }, null, 2))
  } catch (error) {
    console.error(error)
    fs.writeFileSync(path.join(out, 'draft-ownership-results.json'), JSON.stringify({ checks, failure: error.message }, null, 2))
    process.exitCode = 1
  } finally { await context.close(); await browser.close() }
})()
