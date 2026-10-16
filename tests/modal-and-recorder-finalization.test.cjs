const assert = require('node:assert/strict')
const test = require('node:test')

function createFakeDocument() {
  const documentListeners = new Map()
  const doc = {
    activeElement: undefined,
    body: { children: [] },
    listeners: documentListeners,
    addEventListener(type, listener, capture) {
      const key = `${type}:${capture === true}`
      const listeners = documentListeners.get(key) ?? new Set()
      listeners.add(listener)
      documentListeners.set(key, listeners)
    },
    removeEventListener(type, listener, capture) {
      documentListeners.get(`${type}:${capture === true}`)?.delete(listener)
    },
    dispatch(type, event, capture = false) {
      for (const listener of documentListeners.get(`${type}:${capture}`) ?? []) listener(event)
    },
  }
  class FakeElement {
    constructor(ownerDocument, { inert = false } = {}) {
      this.ownerDocument = ownerDocument
      this.inert = inert
      this.open = false
      this.isConnected = true
      this.attributes = new Map()
      this.children = []
      this.listeners = new Map()
      this.tabIndex = 0
      this.classNames = new Set()
      this.classList = {
        add: (name) => this.classNames.add(name),
        remove: (name) => this.classNames.delete(name),
      }
    }
    addEventListener(type, listener, capture) {
      const key = `${type}:${capture === true}`
      const listeners = this.listeners.get(key) ?? new Set()
      listeners.add(listener)
      this.listeners.set(key, listeners)
    }
    removeEventListener(type, listener, capture) {
      this.listeners.get(`${type}:${capture === true}`)?.delete(listener)
    }
    dispatch(type, event = {}, capture = false) {
      for (const listener of this.listeners.get(`${type}:${capture}`) ?? []) listener(event)
    }
    setAttribute(name, value) { this.attributes.set(name, value) }
    removeAttribute(name) { this.attributes.delete(name) }
    hasAttribute(name) { return this.attributes.has(name) }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    querySelector(selector) { return selector === '[data-modal-cancel]' ? this.cancelButton : null }
    querySelectorAll() { return this.focusables ?? [] }
    contains(element) { return this === element || this.children.some((child) => child.contains(element)) }
    focus() {
      this.ownerDocument.activeElement = this
      this.ownerDocument.dispatch('focusin', { target: this }, true)
    }
  }
  doc.createElement = () => new FakeElement(doc)
  return { doc, FakeElement }
}

test('modal lifecycle focuses the safe cancel action, contains focus, handles Escape, and restores focus', () => {
  const { activateModalDialog } = require('../src/components/modal-dialog.ts')
  const { doc, FakeElement } = createFakeDocument()
  const background = new FakeElement(doc)
  const host = new FakeElement(doc)
  const dialog = new FakeElement(doc)
  const cancel = new FakeElement(doc)
  const secondAction = new FakeElement(doc)
  const previousFocus = new FakeElement(doc)
  doc.body.children.push(background, host)
  host.children.push(dialog)
  dialog.parentElement = host
  doc.activeElement = previousFocus
  dialog.cancelButton = cancel
  dialog.focusables = [cancel, secondAction]
  dialog.children.push(cancel, secondAction)
  dialog.showModal = function showModal() { this.open = true }
  dialog.matches = (selector) => selector === ':modal' && dialog.open
  dialog.close = function close() { this.open = false }
  const canceled = []

  const cleanup = activateModalDialog(dialog, { onCancel: () => canceled.push(true) })
  assert.equal(dialog.open, true)
  assert.equal(doc.activeElement, cancel)

  const escaped = { key: 'Escape', preventDefault() { this.defaultPrevented = true } }
  dialog.dispatch('cancel', escaped)
  assert.equal(escaped.defaultPrevented, true)
  assert.deepEqual(canceled, [true])

  const tab = { key: 'Tab', preventDefault() { this.defaultPrevented = true } }
  secondAction.focus()
  doc.dispatch('keydown', tab, true)
  assert.equal(tab.defaultPrevented, true)
  assert.equal(doc.activeElement, cancel)

  cleanup()
  cleanup()
  assert.equal(dialog.open, false)
  assert.equal(doc.activeElement, previousFocus)
  assert.equal(background.inert, false)
  assert.equal(Array.from(doc.listeners.values()).every((listeners) => listeners.size === 0), true)
})

test('modal fallback fails closed or makes the background inert and restores its original state', () => {
  const { activateModalDialog } = require('../src/components/modal-dialog.ts')
  const { doc, FakeElement } = createFakeDocument()
  const previouslyInert = new FakeElement(doc, { inert: true })
  const background = new FakeElement(doc)
  const host = new FakeElement(doc)
  const dialog = new FakeElement(doc)
  const cancel = new FakeElement(doc)
  const secondAction = new FakeElement(doc)
  doc.body.children.push(previouslyInert, background, host)
  host.children.push(dialog)
  dialog.parentElement = host
  dialog.cancelButton = cancel
  dialog.focusables = [cancel, secondAction]
  dialog.children.push(cancel, secondAction)
  const canceled = []

  const cleanup = activateModalDialog(dialog, { onCancel: () => canceled.push(true) })
  assert.equal(previouslyInert.inert, true)
  assert.equal(background.inert, true)
  assert.equal(doc.activeElement, cancel)
  background.focus()
  assert.equal(doc.activeElement, cancel)
  const shiftTab = { key: 'Tab', shiftKey: true, preventDefault() { this.defaultPrevented = true } }
  doc.dispatch('keydown', shiftTab, true)
  assert.equal(shiftTab.defaultPrevented, true)
  assert.equal(doc.activeElement, secondAction)
  const escaped = { key: 'Escape', preventDefault() { this.defaultPrevented = true } }
  doc.dispatch('keydown', escaped, true)
  assert.equal(escaped.defaultPrevented, true)
  assert.deepEqual(canceled, [true])
  cleanup()
  assert.equal(previouslyInert.inert, true)
  assert.equal(background.inert, false)

  delete previouslyInert.inert
  delete background.inert
  assert.throws(() => activateModalDialog(dialog, { onCancel() {} }), /cannot safely contain focus/i)
})

function withStalledRecorder(run) {
  const saved = new Map(['window', 'navigator', 'MediaRecorder'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const trackListeners = new Set()
  const track = {
    stopped: false,
    addEventListener(type, listener) { if (type === 'ended') trackListeners.add(listener) },
    stop() { this.stopped = true },
    end() { for (const listener of trackListeners) listener({ type: 'ended' }) },
  }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  const instances = []
  class StalledMediaRecorder {
    static isTypeSupported() { return true }
    constructor(_stream, options = {}) { this.mimeType = options.mimeType ?? 'audio/webm'; this.state = 'inactive'; this.listeners = new Map(); instances.push(this) }
    addEventListener(type, listener) { const list = this.listeners.get(type) ?? []; list.push(listener); this.listeners.set(type, list) }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive' }
    emit(type, event) { for (const listener of this.listeners.get(type) ?? []) listener(event) }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, location: { hostname: 'localhost' } } })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: StalledMediaRecorder })
  return Promise.resolve().then(() => run({ track, instances })).finally(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
}

test('recorder stop deadline releases the stream, reports retryable error, and ignores late events', async () => {
  await withStalledRecorder(async ({ track, instances }) => {
    const { createResponseRecorder } = require('../src/audio/audio-recorder.ts')
    const recorder = createResponseRecorder('synthetic-exercise', { finalizationTimeoutMs: 15 })
    const states = []
    const completions = []
    recorder.subscribe((state, completion) => { states.push(state); if (completion) completions.push(completion) })
    try {
      await recorder.start('segment-one', 'consecutive')
      let testDeadline
      try {
        await Promise.race([
          assert.rejects(recorder.stop(), /did not finish.*microphone was released.*try recording again/i),
          new Promise((_, reject) => { testDeadline = setTimeout(() => reject(new Error('Recorder stop did not settle at the test boundary.')), 250) }),
        ])
      } finally {
        if (testDeadline !== undefined) clearTimeout(testDeadline)
      }
      assert.equal(states.at(-1).status, 'error')
      assert.match(states.at(-1).error, /try recording again/i)
      assert.equal(track.stopped, true)
      assert.equal(completions.length, 0)

      instances[0].emit('dataavailable', { data: new Blob(['late data']) })
      instances[0].emit('stop', {})
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(completions.length, 0)
      assert.equal(states.at(-1).status, 'error')
    } finally {
      recorder.dispose()
    }
  })
})

test('track-ended automatic stop hint is bounded when MediaRecorder never emits stop', async () => {
  await withStalledRecorder(async ({ track }) => {
    const { createResponseRecorder } = require('../src/audio/audio-recorder.ts')
    const recorder = createResponseRecorder('synthetic-exercise', { finalizationTimeoutMs: 15 })
    const errorState = new Promise((resolve) => {
      recorder.subscribe((state) => { if (state.status === 'error') resolve(state) })
    })
    try {
      await recorder.start('segment-one', 'consecutive')
      track.end()
      const state = await errorState
      assert.match(state.error, /microphone was released.*try recording again/i)
      assert.equal(track.stopped, true)
      assert.equal(await recorder.stop(), undefined)
    } finally {
      recorder.dispose()
    }
  })
})
