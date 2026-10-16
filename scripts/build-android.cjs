const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const androidDirectory = path.join(root, 'android')
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk') : '')

if (!sdkRoot || !fs.existsSync(sdkRoot)) {
  console.error('Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT to the installed SDK directory.')
  process.exit(1)
}

function findJavaHome() {
  const candidates = []
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
  const locator = process.platform === 'win32' ? 'where.exe' : 'which'
  const located = spawnSync(locator, ['java'], { encoding: 'utf8', windowsHide: true })
  if (located.status === 0) {
    candidates.push(...located.stdout.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))
  }

  for (const javaPath of candidates) {
    if (!fs.existsSync(javaPath)) continue
    const version = spawnSync(javaPath, ['-version'], { encoding: 'utf8', windowsHide: true })
    const match = `${version.stdout || ''}\n${version.stderr || ''}`.match(/version "(\d+)/u)
    if (version.status === 0 && match && Number(match[1]) >= 21) return path.dirname(path.dirname(javaPath))
  }
  return ''
}

const javaHome = findJavaHome()
if (!javaHome) {
  console.error('A JDK 21 or newer is required for this Android build.')
  process.exit(1)
}

const escapedSdk = sdkRoot.replace(/\\/gu, '\\\\')
fs.writeFileSync(path.join(androidDirectory, 'local.properties'), `sdk.dir=${escapedSdk}\n`, 'utf8')

const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const result = spawnSync(wrapper, ['assembleDebug'], {
  cwd: androidDirectory,
  env: { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot, JAVA_HOME: javaHome },
  stdio: 'inherit',
  shell: process.platform === 'win32',
  windowsHide: true,
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
if (result.status !== 0) process.exit(result.status || 1)

const apkPath = path.join(androidDirectory, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
if (!fs.existsSync(apkPath)) {
  console.error(`Gradle completed without producing ${apkPath}`)
  process.exit(1)
}

const outputDirectory = path.join(root, 'artifacts', 'android')
fs.mkdirSync(outputDirectory, { recursive: true })
const outputPath = path.join(outputDirectory, 'Lingo-Practice-0.1.0-debug.apk')
fs.copyFileSync(apkPath, outputPath)
console.log(`Created ${path.relative(root, outputPath)}`)
