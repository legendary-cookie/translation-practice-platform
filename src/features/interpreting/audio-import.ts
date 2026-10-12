const MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
}

export function hasUnsupportedDeclaredAudioMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase()
  return normalized.length > 0 && !normalized.startsWith('audio/')
}

export function inferImportedAudioMime(mimeType: string, fileName: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized.startsWith('audio/')) return normalized
  if (normalized) return normalized
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? ''
}
