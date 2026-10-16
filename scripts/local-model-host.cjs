const { app, BrowserWindow } = require('electron')
const target = process.env.LINGO_QUALIFICATION_URL
if (target !== 'http://127.0.0.1:4181') throw new Error('The qualification host only loads its owned loopback server.')
app.whenReady().then(() => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.loadURL(target)
})
app.on('window-all-closed', () => app.quit())
