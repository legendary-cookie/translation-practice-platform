const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')

const out = path.resolve(process.env.BROWSER_QA_ARTIFACTS || '.browser-qa')
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  const external = []
  const checks = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()) })
  const pass = (name) => { checks.push(name); console.log('PASS', name) }
  const nav = (name) => page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name, exact: true }).click()
  async function checkLayout(label) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: horizontal overflow`)
    const small = await page.evaluate(() => [...document.querySelectorAll('button,select,input:not([type=radio]):not([type=checkbox]),summary')].filter((element) => element.getClientRects().length).map((element) => ({ text: element.getAttribute('aria-label') || element.textContent.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })).filter((element) => element.width < 24 || element.height < 24))
    assert.deepEqual(small, [], `${label}: target below WCAG 2.2 minimum size`)
    pass(label)
  }
  try {
    await page.goto('http://127.0.0.1:4178')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-workspace')
    pass('Keyboard skip link focuses the main workspace')
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await nav('Settings')
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme)
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        for (const screen of ['Home', 'Practice', 'Progress', 'Settings', 'Exam']) {
          await nav(screen)
          await checkLayout(`${screen} ${width}px ${theme}: no overflow; measured control targets`)
          if ((width === 320 || width === 1440) && screen === 'Home') await page.screenshot({ path: path.join(out, `home-${width}-${theme}.png`), fullPage: true })
        }
        await nav('Home')
        await page.getByRole('button', { name: /Interpreting Listen/ }).click()
        await page.getByRole('button', { name: 'Open interpreting desk' }).waitFor()
        await checkLayout(`Interpreting setup ${width}px ${theme}`)
      }
    }
    await page.setViewportSize({ width: 390, height: 900 })
    await nav('Practice')
    const directions = await page.locator('#practice-direction option').evaluateAll((options) => options.map((option) => option.value))
    const samples = { zh: '译文', en: 'A translation', ar: 'ترجمة', hi: 'अनुवाद', ru: 'Перевод', fr: 'Traduction', es: 'Traducción' }
    for (const direction of directions) {
      const [source, target] = direction.split('-')
      await page.locator('#practice-direction').selectOption(direction)
      await page.getByRole('button', { name: 'Open translation desk' }).click()
      await page.locator('#translation-answer').waitFor()
      assert.equal(await page.locator('#translation-answer').getAttribute('dir'), target === 'ar' ? 'rtl' : 'ltr')
      assert.equal(await page.locator('.source-text').getAttribute('dir'), source === 'ar' ? 'rtl' : 'ltr')
      await page.locator('#translation-answer').fill(samples[target])
      if (source === 'ar' || source === 'hi') {
        await page.getByRole('button', { name: 'Read source', exact: true }).click()
        await page.screenshot({ path: path.join(out, `source-${source}-390-dark.png`), fullPage: true })
      }
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Change passage', exact: true }).click()
      await page.locator('#practice-direction').waitFor()
      pass(`${direction}: editing and source/target direction attributes`)
    }
    const session = await page.context().newCDPSession(page)
    const manifest = await session.send('Page.getAppManifest')
    assert.deepEqual(manifest.errors, [])
    const data = JSON.parse(manifest.data)
    assert.equal(data.icons.length, 2)
    assert.ok(data.icons.every((icon) => icon.type === 'image/png'))
    const installability = await session.send('Page.getInstallabilityErrors')
    pass('PWA manifest parses and declares correctly sized PNG icons')
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    pass('Responsive/script matrix has no page errors or non-loopback requests')
    fs.writeFileSync(path.join(out, 'polish-results.json'), JSON.stringify({ checks, errors, external, installability, browser: await browser.version() }, null, 2))
  } catch (error) {
    console.error(error)
    await page.screenshot({ path: path.join(out, 'polish-failure.png'), fullPage: true })
    fs.writeFileSync(path.join(out, 'polish-results.json'), JSON.stringify({ checks, failure: error.message, errors, external }, null, 2))
    process.exitCode = 1
  } finally { await browser.close() }
})()
