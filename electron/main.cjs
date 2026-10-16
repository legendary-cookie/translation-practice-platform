const path = require('node:path')
const { app, BrowserWindow, dialog, session } = require('electron')
const { createStaticServer } = require('./static-server.cjs')

const APP_ID = 'com.legendarycookie.lingopractice'
const isSmokeRun = process.argv.includes('--smoke')
let localServer
let mainWindow
let microphoneDecision

async function requestMicrophonePermission(webContents, permission, callback, details) {
  let permitted = false
  try {
    const mediaTypes = details.mediaTypes || []
    permitted = permission === 'media' && mediaTypes.includes('audio') && !mediaTypes.includes('video') &&
      new URL(webContents.getURL()).origin === localServer.origin
  } catch {
    permitted = false
  }

  if (!permitted) {
    callback(false)
    return
  }

  if (microphoneDecision === undefined) {
    try {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Microphone access',
        message: 'Allow Lingo Practice to use the microphone on this device?',
        detail: 'The microphone is used only when you start an interpreting recording.',
        buttons: ['Allow', 'Deny'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      microphoneDecision = result.response === 0
    } catch {
      microphoneDecision = false
    }
  }

  callback(microphoneDecision)
}

async function openMainWindow() {
  localServer = await createStaticServer(path.join(app.getAppPath(), 'dist'))
  session.defaultSession.setPermissionRequestHandler(requestMicrophonePermission)
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, origin, details) =>
    permission === 'media' && origin === localServer.origin && details.mediaType === 'audio' && microphoneDecision === true,
  )

  const icon = path.join(app.getAppPath(), 'assets', 'windows', 'icon.ico')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 360,
    minHeight: 620,
    backgroundColor: '#f4f7fb',
    icon,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== localServer.origin) event.preventDefault()
    } catch {
      event.preventDefault()
    }
  })

  await mainWindow.loadURL(localServer.origin)

  if (isSmokeRun) {
    const result = await mainWindow.webContents.executeJavaScript(`({
      title: document.title,
      origin: location.origin,
      secureContext: isSecureContext,
      indexedDb: typeof indexedDB !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      appRendered: Boolean(document.querySelector('#root')?.children.length)
    })`)
    if (!result.appRendered || !result.indexedDb || !result.serviceWorker || !result.secureContext) {
      console.error('FAIL Electron renderer smoke:', JSON.stringify(result))
      app.exit(1)
      return
    }
    console.log('PASS Electron renderer smoke:', JSON.stringify(result))
    app.quit()
    return
  }

  mainWindow.show()
}

app.setAppUserModelId(APP_ID)
app.whenReady().then(openMainWindow).catch((error) => {
  console.error('Unable to start Lingo Practice:', error)
  app.exit(1)
})

app.on('before-quit', () => {
  if (localServer) void localServer.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
