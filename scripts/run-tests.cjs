const { spawnSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const files = readdirSync('tests').filter(file => file.endsWith('.test.cjs')).map(file => `tests/${file}`)
const result = spawnSync(process.execPath, ['--require', './tests/register-typescript.cjs', '--test', ...files], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
