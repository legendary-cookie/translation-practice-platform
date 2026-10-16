import type { InterpretingExercise } from '../domain/types'

type RightsRecord = {
  assetPath?: unknown
  sha256?: unknown
  mimeType?: unknown
  durationMs?: unknown
  origin?: unknown
  licenseOrPermission?: unknown
  speakerPermission?: unknown
  allowedUse?: unknown
}

function isRecord(value: unknown): value is Record<string, RightsRecord> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateInterpretingRightsManifest(
  exercises: readonly InterpretingExercise[],
  candidate: unknown,
): string[] {
  if (!isRecord(candidate)) {
    return ['The packaged audio rights manifest is missing or malformed.']
  }

  const issues: string[] = []
  const referencedRecordIds = new Set<string>()
  for (const exercise of exercises) {
    const id = exercise.rightsRecordId
    referencedRecordIds.add(id)
    const record = candidate[id]
    if (!record) {
      issues.push(`Rights record ${id} is missing.`)
      continue
    }

    if (!nonEmptyString(record.assetPath)
      || !record.assetPath.startsWith('/audio/interpreting/')
      || record.assetPath.includes('..')
      || record.assetPath !== exercise.audioUrl) {
      issues.push(`Rights record ${id} has an unsafe or mismatched asset path.`)
    }
    if (record.mimeType !== exercise.audioMimeType) {
      issues.push(`Rights record ${id} has a mismatched audio MIME type.`)
    }
    if (record.durationMs !== exercise.durationMs || !Number.isFinite(record.durationMs)) {
      issues.push(`Rights record ${id} has a mismatched audio duration.`)
    }
    if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(record.sha256)) {
      issues.push(`Rights record ${id} has no valid SHA-256 asset digest.`)
    }
    for (const field of ['origin', 'licenseOrPermission', 'speakerPermission', 'allowedUse'] as const) {
      if (!nonEmptyString(record[field])) {
        issues.push(`Rights record ${id} is missing ${field} metadata.`)
      }
    }
  }

  for (const recordId of Object.keys(candidate)) {
    if (!referencedRecordIds.has(recordId)) {
      issues.push(`Rights manifest contains unreferenced record ${recordId}.`)
    }
  }
  return issues
}
