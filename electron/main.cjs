const path = require('node:path')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const { app, BrowserWindow, dialog, session } = require('electron')
const { startDesktopServer } = require('./desktop-origin.cjs')

const APP_ID = 'com.legendarycookie.lingopractice'
const isSmokeRun = process.argv.includes('--smoke')
let localServer
let mainWindow
let microphoneDecision

const profileOverride = app.commandLine.getSwitchValue('user-data-dir')
if (profileOverride) app.setPath('userData', path.resolve(profileOverride))
const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) app.quit()
app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.show()
  mainWindow?.focus()
})

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
      const chinese = await webContents.executeJavaScript("document.documentElement.lang === 'zh-CN'")
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: chinese ? '麦克风权限' : 'Microphone access',
        message: chinese ? '允许 Lingo Practice 使用此设备的麦克风吗？' : 'Allow Lingo Practice to use the microphone on this device?',
        detail: chinese ? '仅在你开始口译录音时使用麦克风。' : 'The microphone is used only when you start an interpreting recording.',
        buttons: chinese ? ['允许', '拒绝'] : ['Allow', 'Deny'],
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
  localServer = await startDesktopServer(path.join(app.getAppPath(), 'dist'), app.getPath('userData'), async (ports) => {
    const result = await dialog.showMessageBox({
      type: 'question', title: 'Choose an earlier workspace / 选择旧工作区',
      message: 'Earlier builds used several storage origins. Choose the workspace to keep using. All other workspaces remain on disk. / 旧版本使用了多个存储地址。请选择要继续使用的工作区，其余数据会保留。',
      buttons: [...ports.map((port) => `Workspace / 工作区 ${port}`), 'Cancel / 取消'],
      cancelId: ports.length, noLink: true,
    })
    return ports[result.response]
  })
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

  // A new bundle must not reuse an HTTP-cached HTML document from an earlier build.
  // The query changes across builds while the storage origin remains stable.
  const build = createHash('sha256').update(fs.readFileSync(path.join(app.getAppPath(), 'dist', 'index.html'))).digest('hex').slice(0, 16)
  await mainWindow.loadURL(`${localServer.origin}/?build=${build}`)

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
if (primaryInstance) app.whenReady().then(openMainWindow).catch((error) => {
  console.error('Unable to start Lingo Practice:', error)
  if (!isSmokeRun) dialog.showErrorBox('Lingo Practice could not start / 无法启动', `${error.message}\n\nSaved work remains in ${app.getPath('userData')}. / 已保存的数据仍保留在此文件夹。`)
  app.exit(1)
})

app.on('before-quit', () => {
  if (localServer) void localServer.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
