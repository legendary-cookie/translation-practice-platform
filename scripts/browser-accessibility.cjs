const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')
const { default: AxeBuilder } = require('@axe-core/playwright')
const output = path.resolve(process.env.BROWSER_QA_ARTIFACTS || '.browser-qa')
fs.mkdirSync(output, { recursive: true })
const report = { checks: [], scans: [], errors: [] }
;(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) })
  try {
    for (const language of ['en', 'zh-CN']) {
      const context = await browser.newContext()
      await context.addInitScript(language => localStorage.setItem('lingo-workspace-preferences-v1', JSON.stringify({ interfaceLanguage: language })), language)
      const page = await context.newPage()
      page.on('pageerror', error => report.errors.push(error.message))
      await page.goto('http://127.0.0.1:4178')
      const names = language === 'en' ? ['Home', 'Practice', 'Interpreting', 'Exam', 'Progress', 'Settings'] : ['首页', '练习', '口译', '考试', '进度', '设置']
      const nav = async name => { if (name === names[2] && (await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name, exact: true }).isVisible()) === false) { await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name: names[0], exact: true }).click(); await page.getByRole('button', { name: language === 'en' ? /Interpreting Listen/ : /口译.*本地音频/ }).click() } else await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name, exact: true }).click() }
      const scan = async label => {
        assert.doesNotMatch(await page.locator('body').ariaSnapshot(), /(?:color|font-size|background-color)\s*:\s*(?:#[0-9a-f]{3,8}|[0-9]+px)/iu, 'Raw CSS must not enter the accessibility tree')
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
        report.scans.push({ label, violations: result.violations, incomplete: result.incomplete.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })) })
        console.log('SCAN', label, result.violations.length)
      }
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { const key = 'lingo-workspace-preferences-v1'; localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), theme })); window.dispatchEvent(new Event('lingo-preferences-change')) }, theme)
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 950 })
          for (const name of names) {
            await nav(name)
            await scan(`${language} ${theme} ${width} ${name}`)
            assert.equal(await page.locator('main').count(), 1, 'One main landmark')
          }
        }
      }
      const deleteName = language === 'en' ? 'Delete local data' : '删除本地数据'
      await page.getByRole('button', { name: deleteName, exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)))
      await scan(`${language} delete confirmation`)
      await page.keyboard.press('Shift+Tab')
      assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)))
      await page.keyboard.press('Tab')
      assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)))
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), deleteName)
      report.checks.push(`${language}: delete dialog focuses, contains Tab/Shift+Tab, cancels with Escape and restores focus`)
      await nav(names[1])
      assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1')
      report.checks.push(`${language}: route changes focus the workspace heading`)
      await page.getByRole('button', { name: language === 'en' ? 'Open translation desk' : '打开笔译练习区' }).click()
      await page.locator('#translation-answer').waitFor()
      await scan(`${language} written workspace`)
      fs.writeFileSync(path.join(output, `accessibility-tree-${language}.yml`), await page.locator('body').ariaSnapshot())
      await nav(names[3])
      await page.getByRole('button', { name: language === 'en' ? 'Start Exam Simulation' : '开始模拟考试', exact: true }).first().click()
      await page.locator('#exam-answer-input').waitFor()
      await scan(`${language} exam workspace`)
      const tabs = page.getByRole('tab')
      if (await tabs.count() > 1) {
        await tabs.first().focus()
        await page.keyboard.press('ArrowRight')
        assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true')
        assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'), await tabs.nth(1).getAttribute('id'))
        await page.keyboard.press('Home')
        assert.equal(await tabs.first().getAttribute('aria-selected'), 'true')
        report.checks.push(`${language}: exam passage tabs support ArrowRight, Home and a labeled panel`)
      }
      await page.getByRole('button', { name: language === 'en' ? /Paper Dictionaries|Closed Book/ : /纸质词典|闭卷/ }).click()
      await page.getByRole('dialog').waitFor()
      assert.ok(await page.getByRole('dialog').evaluate(element => element.contains(document.activeElement)))
      await scan(`${language} exam aids dialog`)
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      await page.getByRole('button', { name: language === 'en' ? 'Submit Exam' : '提交考试', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await scan(`${language} exam submit dialog`)
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      report.checks.push(`${language}: exam dialogs focus their actions and cancel with Escape`)
      await context.close()
    }
    assert.deepEqual(report.errors, [])
    const violations = report.scans.flatMap(scan => scan.violations.map(violation => ({ label: scan.label, id: violation.id, targets: violation.nodes.map(node => node.target) })))
    assert.deepEqual(violations, [], JSON.stringify(violations, null, 2))
  } catch (error) { report.failure = error.message; console.error(error); process.exitCode = 1 }
  finally { fs.writeFileSync(path.join(output, 'accessibility-results.json'), JSON.stringify(report, null, 2)); await browser.close() }
})()
