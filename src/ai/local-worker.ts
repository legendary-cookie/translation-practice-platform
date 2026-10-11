import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()

type WorkerMessage = {
  kind?: string
  uuid?: string
  content?: unknown
}

function summarizeMessage(message: WorkerMessage): Record<string, unknown> {
  const content = message.content
  const contentRecord = content && typeof content === 'object' ? content as Record<string, unknown> : undefined
  const request = contentRecord?.request && typeof contentRecord.request === 'object'
    ? contentRecord.request as Record<string, unknown>
    : undefined
  return {
    kind: message.kind,
    uuid: message.uuid,
    requestStream: request?.stream,
    responseFormat: request?.response_format && typeof request.response_format === 'object'
      ? (request.response_format as Record<string, unknown>).type
      : undefined,
    progress: contentRecord?.progress,
    progressText: contentRecord?.text,
    choices: Array.isArray(contentRecord?.choices) ? contentRecord.choices.length : undefined,
    finishReason: Array.isArray(contentRecord?.choices)
      ? (contentRecord.choices[0] as Record<string, unknown> | undefined)?.finish_reason
      : undefined,
    contentType: typeof content,
  }
}

function logWorkerEvent(event: string, message: WorkerMessage): void {
  if (import.meta.env.DEV) {
    console.info(`[local-worker] ${event} ${JSON.stringify(summarizeMessage(message))}`)
  }
}

const postMessage = handler.postMessage.bind(handler)
handler.postMessage = (message: WorkerMessage) => {
  logWorkerEvent('outbound', message)
  postMessage(message)
}

self.onmessage = (event) => {
  logWorkerEvent('inbound', event.data as WorkerMessage)
  handler.onmessage(event)
}
