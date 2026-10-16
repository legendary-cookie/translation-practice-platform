const assert = require('node:assert/strict')
const test = require('node:test')
const Module = require('node:module')

function fixture(context, platform = 'android') {
  const memory = new Map(), native = new Map(), calls = []
  let failNext = false
  const original = Module._load
  Module._load = function (name, ...rest) {
    if (name === '@capacitor/core') return { Capacitor: { getPlatform: () => platform } }
    if (name === '@capacitor/preferences') return { Preferences: {
      get: async ({ key }) => ({ value: native.get(key) ?? null }),
      set: async ({ key, value }) => { calls.push(['set', value]); if (failNext) { failNext = false; throw new Error('disk failure') } native.set(key, value) },
      remove: async ({ key }) => { calls.push(['remove']); native.delete(key) },
    } }
    return original.call(this, name, ...rest)
  }
  const previous = global.localStorage
  global.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  const file = require.resolve('../src/native/preferences.ts')
  delete require.cache[file]
  const api = require(file)
  Module._load = original
  context.after(() => { global.localStorage = previous; delete require.cache[file] })
  return { ...api, memory, native, calls, fail: () => { failNext = true } }
}

test('native preferences recover the durable value before rendering and preserve an existing browser migration', async context => {
  const f = fixture(context)
  f.memory.set(f.WORKSPACE_PREFERENCE_KEY, '{"interfaceLanguage":"en"}')
  await f.hydrateNativeWorkspace()
  assert.equal(f.native.get(f.WORKSPACE_PREFERENCE_KEY), '{"interfaceLanguage":"en"}')
  await f.persistNativeWorkspace('{"interfaceLanguage":"zh-CN"}')
  await f.hydrateNativeWorkspace()
  assert.equal(f.memory.get(f.WORKSPACE_PREFERENCE_KEY), '{"interfaceLanguage":"zh-CN"}')
})

test('native preference reset is ordered after writes and a failed write cannot poison deletion', async context => {
  const f = fixture(context)
  f.fail()
  await assert.rejects(f.persistNativeWorkspace('{}'), /disk failure/)
  const writing = f.persistNativeWorkspace('{"theme":"dark"}')
  const clearing = f.persistNativeWorkspace(null)
  await Promise.all([writing, clearing])
  assert.equal(f.native.get(f.WORKSPACE_PREFERENCE_KEY), '{}')
  assert.deepEqual(f.calls.at(-1), ['set', '{}'])
})

test('cleared native preferences cannot migrate a stale WebView snapshot back after restart', async context => {
  const f = fixture(context)
  const stale = '{"interfaceLanguage":"zh-CN","theme":"dark"}'
  await f.persistNativeWorkspace(stale)
  await f.persistNativeWorkspace(null)
  f.memory.set(f.WORKSPACE_PREFERENCE_KEY, stale)
  await f.hydrateNativeWorkspace()
  assert.deepEqual(JSON.parse(f.memory.get(f.WORKSPACE_PREFERENCE_KEY)), {})
})

test('web preferences require no native plugin or migration', async context => {
  const f = fixture(context, 'web')
  await f.persistNativeWorkspace('{}')
  await f.hydrateNativeWorkspace()
  assert.deepEqual(f.calls, [])
})
