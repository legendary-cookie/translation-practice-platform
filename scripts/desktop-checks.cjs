const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require('playwright-core')

const root = path.resolve(__dirname, '..')
const output = path.join(root, '.browser-qa')
fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-desktop-qa-'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const executablePath = process.env.DESKTOP_QA_EXECUTABLE || require('electron')
const checks = []
let application
const launch = async () => {
  const args = [`--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  if (!process.env.DESKTOP_QA_EXECUTABLE) args.unshift(root)
  application = await _electron.launch({ executablePath, args, env, timeout: 45000 })
  const page = await application.firstWindow()
  await page.getByRole('heading', { name: 'Translate with intention.' }).waitFor()
  return page
}
const pass = (name) => { checks.push(name); console.log('PASS', name) }
;(async () => {
  try {
    let page = await launch()
    const origin = new URL(page.url()).origin
    assert.equal(await page.evaluate(() => isSecureContext && typeof indexedDB !== 'undefined' && Boolean(document.querySelector('#root')?.children.length)), true)
    await page.locator('.sidebar').getByRole('button', { name: 'Practice', exact: true }).click()
    await page.getByRole('button', { name: 'Open translation desk' }).click()
    await page.locator('#translation-answer').fill('Desktop relaunch fixture 中文 العربية')
    await page.getByText('Draft saved on this device', { exact: false }).waitFor()
    await page.evaluate(() => localStorage.setItem('desktop-qa-marker', 'persisted'))
    await application.close()
    page = await launch()
    assert.equal(new URL(page.url()).origin, origin)
    assert.equal(await page.evaluate(() => localStorage.getItem('desktop-qa-marker')), 'persisted')
    await page.getByRole('button', { name: 'Continue translation' }).click()
    await page.locator('#translation-answer').waitFor()
    assert.equal(await page.locator('#translation-answer').inputValue(), 'Desktop relaunch fixture 中文 العربية')
    pass('Packaged renderer and both localStorage/IndexedDB written drafts survive a full app relaunch at one stable origin')
    const capability = await page.evaluate(async () => {
      const gpu = navigator.gpu
      const adapter = await gpu?.requestAdapter({ powerPreference: 'high-performance' })
      return { userAgent: navigator.userAgent, secureContext: isSecureContext, webGpu: Boolean(adapter), adapterInfo: adapter?.info, memory: navigator.deviceMemory }
    })
    fs.writeFileSync(path.join(output, 'desktop-results.json'), JSON.stringify({ checks, origin, capability, profile }, null, 2))
    await page.screenshot({ path: path.join(output, 'desktop-native.png') })
    console.log(JSON.stringify(capability))
  } catch (error) {
    console.error(error)
    fs.writeFileSync(path.join(output, 'desktop-results.json'), JSON.stringify({ checks, failure: error.message, profile }, null, 2))
    process.exitCode = 1
  } finally {
    await application?.close().catch(() => {})
  }
})()
