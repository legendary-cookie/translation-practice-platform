const assert = require('node:assert/strict')
const test = require('node:test')
const speech = require('../src/audio/local-speech-recognition.ts')

test('Android WebView never calls exposed on-device speech methods with missing native binders', async t => {
  let probes = 0
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const fake = function () {}
  fake.available = () => { probes++; return true }
  fake.install = () => { probes++; return true }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Mozilla/5.0 (Linux; Android 16; SM-S938B; wv) AppleWebKit/537.36 Chrome/154.0.8037.106' } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { SpeechRecognition: fake } })
  t.after(() => {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor); else delete globalThis.navigator
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else delete globalThis.window
  })
  assert.equal((await speech.getLocalRecognitionCapability('en-US')).status, 'unavailable')
  assert.equal((await speech.installLocalRecognitionLanguage('en-US')).status, 'unavailable')
  assert.equal(probes, 0)
})
