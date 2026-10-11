import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// Asset fetches are permitted only during the learner's explicit preparation.
// A device-loss reload during evaluation must fail rather than fetch remotely.
let downloadAllowed = false
let reloadId: string | undefined
const originalFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (...args: Parameters<typeof fetch>) => {
  if (!downloadAllowed) return Promise.reject(new Error('Prepare the local model again before downloading runtime assets.'))
  return originalFetch(...args)
}

class LocalWorkerHandler extends WebWorkerMLCEngineHandler {
  override postMessage(message: { kind: string; uuid: string }) {
    if (message.uuid === reloadId && ['return', 'throw'].includes(message.kind)) { downloadAllowed = false; reloadId = undefined }
    super.postMessage(message)
  }
}

const handler = new LocalWorkerHandler()
globalThis.onmessage = (event: MessageEvent<{ kind: string; uuid: string }>) => {
  if (event.data.kind === 'reload') { downloadAllowed = true; reloadId = event.data.uuid }
  handler.onmessage(event)
}
