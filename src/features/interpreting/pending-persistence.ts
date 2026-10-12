export type GenerationTaggedPendingSave = { generation: number }

export function rebasePendingInterpretingSaves<T extends GenerationTaggedPendingSave>(
  saves: readonly T[],
  generation: number,
): T[] {
  return saves.map((save) => save.generation === generation ? save : { ...save, generation })
}
