const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')
let server
let exited = false
;(async () => {
  try {
    let occupied = false
    try { await fetch('http://127.0.0.1:4178'); occupied = true } catch { /* No existing preview. */ }
    if (occupied) throw new Error('Port 4178 is already in use. Stop the other preview before verification.')
    server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'inherit', windowsHide: true })
    server.on('exit', () => { exited = true })
    let ready = false
    for (let attempt = 0; attempt < 100 && !exited; attempt++) {
      try { if ((await fetch('http://127.0.0.1:4178')).ok) { ready = true; break } } catch { /* Wait for the preview listener. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!ready || exited) throw new Error('Production preview did not start; ensure port 4178 is available.')
    for (const script of ['run-browser-checks.cjs', 'browser-localization.cjs', 'browser-startup-recovery.cjs']) {
      const result = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', env: process.env, windowsHide: true })
      if (result.status !== 0) throw new Error(`${script} failed with status ${result.status}`)
    }
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { server?.kill() }
})()
