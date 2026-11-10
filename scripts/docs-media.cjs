/*
 * Regenerates the README / user-guide screenshots and the captioned walkthrough video.
 *
 *   npm run build
 *   node scripts/docs-media.cjs            # screenshots + video
 *   node scripts/docs-media.cjs --shots    # screenshots only
 *
 * Needs Google Chrome (Playwright "chrome" channel) and ffmpeg on PATH.
 * Writes docs/images/01-06*.png and docs/video/lingo-walkthrough.mp4.
 * docs/images/00-download-page.png is a screenshot of the GitHub release page
 * and is captured separately once the release is published.
 */
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')

const PORT = 4181
const ORIGIN = `http://127.0.0.1:${PORT}`
const root = path.resolve(__dirname, '..')
const imagesDir = path.join(root, 'docs', 'images')
const videoFile = path.join(root, 'docs', 'video', 'lingo-walkthrough.mp4')
const shotsOnly = process.argv.includes('--shots')

// A learner-style answer with two deliberate slips so the offline check has something to show:
// a wrong figure (8% instead of 9%) and a missing fourth paragraph.
const PRACTICE_ANSWER = [
  'China’s per capita water resources are only about a quarter of the world average and are unevenly distributed, so China is one of the most water-scarce countries. As urbanization speeds up, cities need more and more water.',
  'Building water-saving cities is an important way to ease shortages. Cities are renovating old pipe networks to reduce leakage, promoting water-saving appliances and using reclaimed water for irrigation, street cleaning and industrial cooling.',
  'One northern city cut its leakage rate from 15% to 8% in three years, saving about 20 million cubic metres of water a year, as much as 100,000 households use annually.',
].join('\n\n')

async function startPreview() {
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(ORIGIN)).ok) return server } catch { /* not ready yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  server.kill()
  throw new Error(`Preview did not start on ${ORIGIN}; run "npm run build" first.`)
}

async function nav(page, name) {
  await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name, exact: true }).click()
  // Park the pointer and drop focus so no hover or focus style lingers on the menu in screenshots.
  await page.mouse.move(1100, 700)
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  // The menu highlight fades between items; let the transition finish.
  await page.waitForTimeout(700)
}

async function openPracticeDesk(page) {
  await nav(page, 'Practice')
  await page.locator('#practice-direction').selectOption({ label: 'Chinese → English' })
  await page.getByRole('button', { name: 'Open translation desk' }).click()
  await page.locator('#translation-answer').waitFor()
}

async function screenshots(browser) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 760 }, colorScheme: 'light', deviceScaleFactor: 1 })
  const page = await context.newPage()
  const shot = (name) => page.screenshot({ path: path.join(imagesDir, name) })
  await page.goto(ORIGIN)
  await page.getByRole('heading', { name: 'Translate with intention.' }).waitFor()
  await shot('01-home.png')

  await nav(page, 'Practice')
  await page.locator('#practice-direction').selectOption({ label: 'Chinese → English' })
  await page.getByText('Selected passage', { exact: false }).first().waitFor()
  await shot('02-practice-setup.png')

  await page.getByRole('button', { name: 'Open translation desk' }).click()
  await page.locator('#translation-answer').fill(PRACTICE_ANSWER.split('\n\n')[0])
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('03-translation-desk.png')

  await page.locator('#translation-answer').fill(PRACTICE_ANSWER)
  await page.getByRole('button', { name: 'Check translation offline' }).click()
  const panel = page.locator('.offline-check').first()
  await panel.waitFor()
  await panel.evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -16))
  await shot('05-offline-check.png')

  await nav(page, 'Exam')
  await page.getByRole('heading', { name: /Dated syllabus references/ }).waitFor()
  await page.getByText('CATTI Level 3 · English ↔ Chinese').first().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await shot('06-exam-catalog.png')

  await nav(page, 'Settings')
  await page.locator('#interface-language').evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await shot('04-settings.png')
  await context.close()
}

const CAPTION_SCRIPT = () => {
  window.__caption = (text) => {
    let box = document.getElementById('__docs-caption')
    if (!box) {
      box = document.createElement('div')
      box.id = '__docs-caption'
      box.setAttribute('aria-hidden', 'true')
      Object.assign(box.style, {
        position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: 2147483647,
        background: 'rgba(17, 24, 39, 0.94)', color: '#fff', font: '600 26px/1.35 "Segoe UI", system-ui, sans-serif',
        padding: '14px 28px', borderRadius: '12px', maxWidth: '1100px', textAlign: 'center', pointerEvents: 'none',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      })
      document.body.appendChild(box)
    }
    box.textContent = text
  }
}

async function video(browser) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-video-'))
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'light', recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } })
  await context.addInitScript(CAPTION_SCRIPT)
  const page = await context.newPage()
  const caption = (text) => page.evaluate((value) => window.__caption(value), text)
  const pause = (ms) => page.waitForTimeout(ms)

  await page.goto(ORIGIN)
  await page.getByRole('heading', { name: 'Translate with intention.' }).waitFor()
  await caption('Lingo Practice: CATTI Level 3 translation practice. No account or AI needed.')
  await pause(3500)

  await caption('Step 1: Choose “Practice” in the menu.')
  await pause(1500)
  await nav(page, 'Practice')
  await pause(1500)

  await caption('Step 2: Choose a direction and a CATTI 3 passage.')
  await page.locator('#practice-direction').selectOption({ label: 'Chinese → English' })
  await pause(3000)

  await caption('Step 3: Press “Open translation desk”.')
  await pause(1200)
  await page.getByRole('button', { name: 'Open translation desk' }).click()
  await pause(2500)

  await caption('Step 4: Read the passage and type your translation.')
  await page.locator('#translation-answer').click()
  const [first, ...rest] = PRACTICE_ANSWER.split('\n\n')
  await page.keyboard.type(first, { delay: 18 })
  await page.locator('#translation-answer').fill([first, ...rest].join('\n\n'))
  await pause(1500)

  await caption('Step 5: Press “Check translation offline”.')
  await pause(1200)
  await page.getByRole('button', { name: 'Check translation offline' }).click()
  const panel = page.locator('.offline-check').first()
  await panel.waitFor()
  await panel.evaluate((element) => element.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  await pause(2000)

  await caption('The check finds a missing paragraph and a wrong figure: 9% became 8%.')
  await pause(5000)
  await caption('It also checks key terms and length against the reference.')
  await pause(4000)

  await caption('Step 6: Compare each paragraph with the reference translation (参考译文).')
  await page.getByRole('table').first().evaluate((element) => element.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  await pause(5000)
  await page.evaluate(() => window.scrollBy({ top: 360, behavior: 'smooth' }))
  await pause(3500)

  await caption('Exam mode: timed CATTI 3 papers for English ↔ Chinese and Russian ↔ Chinese.')
  await nav(page, 'Exam')
  await pause(4500)

  await caption('Your work stays on this device. Optional AI feedback can be added in Settings.')
  await pause(4000)

  const recorded = page.video()
  await context.close()
  const webm = await recorded.path()
  fs.mkdirSync(path.dirname(videoFile), { recursive: true })
  const result = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', videoFile], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('ffmpeg failed to encode the walkthrough video.')
  fs.rmSync(tmp, { recursive: true, force: true })
}

;(async () => {
  fs.mkdirSync(imagesDir, { recursive: true })
  const server = await startPreview()
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'chrome', headless: true })
  try {
    await screenshots(browser)
    console.log('Screenshots written to docs/images')
    if (!shotsOnly) {
      await video(browser)
      console.log('Video written to docs/video/lingo-walkthrough.mp4')
    }
  } finally {
    await browser.close()
    server.kill()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
