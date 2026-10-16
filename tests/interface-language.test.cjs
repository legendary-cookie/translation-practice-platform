const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
const { zhCN } = require('../src/i18n/zh-CN.ts')
const { translateInterface } = require('../src/i18n/index.ts')

test('every marked interface message has Chinese copy with the same interpolation fields', () => {
  const missing = []
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) { if (entry.name !== 'i18n') walk(file); continue }
      if (!/\.tsx?$/u.test(file)) continue
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text.trim()
          if (!(key in zhCN)) missing.push(`${file}: ${key}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  walk(path.resolve(__dirname, '../src'))
  assert.deepEqual(missing, [])
  const fields = text => [...text.matchAll(/\{\d+\}/gu)].map(match => match[0]).sort()
  for (const [source, translated] of Object.entries(zhCN)) assert.deepEqual(fields(translated), fields(source), source)
})

test('localization keeps inserted learner text and unknown content verbatim', () => {
  const learner = '原文 العربية <script>never execute</script> {0}'
  assert.equal(translateInterface('Attachment {0}: {1}', 'zh-CN', 2, learner), `附件 2：${learner}`)
  assert.equal(translateInterface(learner, 'zh-CN'), learner)
  assert.equal(translateInterface(' Home ', 'zh-CN'), ' 首页 ')
  assert.equal(translateInterface('Home', 'en'), 'Home')
})
