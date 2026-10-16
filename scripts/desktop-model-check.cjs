const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require('playwright-core')
const root = path.resolve(__dirname, '..')
const output = path.join(root, '.browser-qa')
fs.mkdirSync(output, { recursive: true })
const profile = process.env.DESKTOP_QA_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-model-qa-'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
let application
let progress
const report = { profile, checks: [], posts: [], errors: [], diagnostics: [] }
;(async () => {
  try {
    const executablePath = process.env.DESKTOP_QA_EXECUTABLE || require('electron')
    const args = [`--user-data-dir=${profile}`]
    if (!process.env.DESKTOP_QA_EXECUTABLE) args.unshift(root)
    application = await _electron.launch({ executablePath, args, env, timeout: 45000 })
    const page = await application.firstWindow()
    page.on('dialog', dialog => dialog.accept())
    await page.evaluate(() => sessionStorage.setItem('lingo-local-diagnostics', 'metadata'))
    page.on('console', message => {
      const text = message.text()
      if (text.startsWith('[local-provider] evaluation.') && !text.includes('.chunk ')) { report.diagnostics.push(text); console.log(text) }
    })
    page.on('request', request => { if (request.method() === 'POST' && !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) report.posts.push(request.url()) })
    page.on('pageerror', error => report.errors.push(error.message))
    const nav = name => page.locator('.sidebar').getByRole('button', { name, exact: true }).click()
    await page.getByRole('heading', { name: 'Translate with intention.' }).waitFor()
    await nav('Settings')
    const prepare = page.getByRole('button', { name: /^(Prepare local model|Prepare again|Retry local model)/ })
    await prepare.waitFor()
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => /^(Prepare local model|Prepare again|Retry local model)/.test(b.textContent))?.disabled)
    const started = Date.now()
    await prepare.click()
    progress = setInterval(async () => console.log('MODEL', await page.locator('.model-status-grid').innerText().catch(() => 'working')), 20000)
    await page.waitForFunction(() => document.querySelector('.settings-card__status--ready, .settings-card__status--unavailable'), { }, { timeout: 600000 })
    clearInterval(progress)
    report.preparationMs = Date.now() - started
    report.preparation = await page.locator('.model-status-grid').innerText()
    assert.equal(await page.locator('.settings-card__status--ready').count(), 1, report.preparation)
    report.checks.push('Electron WebGPU model reaches ready state')
    console.log('PASS local model ready', report.preparationMs)
    await page.context().setOffline(true)
    await nav('Practice')
    await page.getByRole('button', { name: 'Open translation desk' }).click()
    report.source = await page.locator('.source-text').innerText()
    await page.locator('#translation-answer').fill('In a city near a river mouth, residents turned an unused parking lot into a community garden. Volunteers take turns caring for vegetables and herbs and open the garden to neighbours on weekends. The small project has not transformed the city, but it has given people of different ages a shared reason to care for a piece of land.')
    const evaluationStarted = Date.now()
    await page.getByRole('button', { name: 'Submit for feedback' }).click()
    await page.waitForFunction(() => document.body.innerText.includes('Your practice readout.') || document.querySelector('.form-message')?.textContent.match(/invalid feedback|timed out|failed|unavailable/), {}, { timeout: 150000 })
    const hasFeedback = await page.getByRole('heading', { name: 'Your practice readout.' }).count() === 1
    assert.ok(hasFeedback, hasFeedback ? undefined : await page.locator('.form-message').innerText().catch(() => 'Missing feedback'))
    report.evaluationMs = Date.now() - evaluationStarted
    report.feedback = await page.locator('main').innerText()
    report.practiceEstimate = Number(await page.locator('.estimate-badge strong').innerText())
    assert.ok(report.practiceEstimate >= 60, 'The accurate synthetic translation must not receive an unsuccessful score')
    assert.doesNotMatch(report.feedback, /specific strength|short evidence-based summary|limits of this small model.s practice estimate/u)
    assert.equal(report.posts.length, 0)
    assert.deepEqual(report.errors, [])
    report.checks.push('Synthetic written task produces validated local feedback with networking disabled after preparation')
    console.log('PASS local inference', report.evaluationMs)
    await page.screenshot({ path: path.join(output, 'desktop-model-feedback.png'), fullPage: true })
  } catch (error) {
    report.failure = error.message
    console.error(error)
    if (application) {
      const page = await application.firstWindow()
      report.visibleFailure = await page.locator('body').innerText().catch(() => '')
    }
    process.exitCode = 1
  } finally {
    clearInterval(progress)
    fs.writeFileSync(path.join(output, 'desktop-model-results.json'), JSON.stringify(report, null, 2))
    await application?.close().catch(() => {})
  }
})()
