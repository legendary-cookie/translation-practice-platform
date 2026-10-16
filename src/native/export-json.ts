import { Capacitor, registerPlugin } from '@capacitor/core'

const LocalExport = registerPlugin<{ saveJson(options: { data: string; fileName: string }): Promise<{ saved: boolean }> }>('LocalExport')

/** The system document picker controls the destination on Android; web/desktop use a download. */
export async function exportJson(payload: unknown, fileName: string): Promise<boolean> {
  const data = JSON.stringify(payload, null, 2)
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/gu, '_')
  if (Capacitor.getPlatform() === 'android') {
    return (await LocalExport.saveJson({ data, fileName: safeName })).saved
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  return true
}
