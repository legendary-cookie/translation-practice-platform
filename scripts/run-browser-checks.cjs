const { spawnSync } = require('node:child_process')
const path = require('node:path')

for (const file of ['browser-smoke.cjs', 'browser-extended-smoke.cjs', 'browser-draft-ownership.cjs', 'browser-polish-checks.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', env: process.env })
  if (result.status !== 0) process.exit(result.status || 1)
}
