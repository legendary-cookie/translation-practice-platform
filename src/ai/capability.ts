import type { EvaluationRequest } from '../domain/types'
import type { LanguageCode } from '../domain/languages'
import { DEFAULT_LOCAL_MODEL_ID } from '../domain/types'
import { buildLocalWrittenPrompt, localEvaluationSystemPrompt } from './local-evidence'
import { buildEvaluationPrompt, evaluationSystemPrompt } from './evaluation-prompt'
import { withCapabilityDeadline } from './capability-deadline'

export type CapabilityTier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export type DeviceClass =
  | 'unknown'
  | 'ios'
  | 'android-mid-range'
  | 'android-flagship-candidate'
  | 'desktop-limited'
  | 'desktop-capable'

export type CapabilityAssessment = {
  tier: CapabilityTier
  deviceClass: DeviceClass
  deviceLabel: string
  webGpu: {
    status: 'checking' | 'available' | 'unavailable'
    adapterAvailable: boolean
    maxStorageBufferBindingSize?: number
    features: string[]
    reason: string
  }
  memory: {
    deviceMemoryGiB?: number
    jsHeapLimitGiB?: number
  }
  storage: {
    status: 'unknown' | 'available' | 'insufficient'
    freeBytes?: number
    quotaBytes?: number
    usageBytes?: number
    modelCached?: boolean
    persistent?: boolean
    reason: string
  }
  localModel: {
    modelId: string
    requiredMemoryMB: number
    estimatedDownloadBytes: number
    contextWindowTokens: number
    status: 'unavailable' | 'restricted' | 'available'
    reason: string
  }
  detectedAt?: string
}

export type LocalEvaluationDecision = {
  allowed: boolean
  reason: string
}

type GpuAdapter = {
  features?: Iterable<string>
  limits?: {
    maxStorageBufferBindingSize?: number
  }
}

type NavigatorSignals = Navigator & {
  deviceMemory?: number
  gpu?: {
    requestAdapter: (options?: { powerPreference?: 'low-power' | 'high-performance' }) => Promise<GpuAdapter | null>
  }
  userAgentData?: {
    mobile?: boolean
  }
}

type PerformanceSignals = Performance & {
  memory?: {
    jsHeapSizeLimit?: number
  }
}

export const LOCAL_MODEL_REQUIREMENTS = {
  modelId: DEFAULT_LOCAL_MODEL_ID,
  requiredMemoryMB: 3867.82,
  estimatedDownloadBytes: 2_600_000_000,
  contextWindowTokens: 4096,
} as const

export const WEAK_LOCAL_LANGUAGES: LanguageCode[] = ['hi', 'ar']

const LOCAL_MODEL_STORAGE_RESERVE_BYTES = 3_000_000_000
const LOCAL_MODEL_OUTPUT_TOKEN_RESERVE = 1400
const LOCAL_MODEL_CONTEXT_SAFETY_MARGIN = 256
const CAPABILITY_CHECK_TIMEOUT_MS = 10_000
const HAN_CHARACTER = /\p{Script=Han}/u

const tierRank: Record<CapabilityTier, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
}

function isIosDevice(signals: NavigatorSignals): boolean {
  return /iPhone|iPad|iPod/u.test(signals.userAgent) || (signals.platform === 'MacIntel' && signals.maxTouchPoints > 1)
}

function isAndroidDevice(signals: NavigatorSignals): boolean {
  return /Android/u.test(signals.userAgent)
}

function classifyDevice(signals: NavigatorSignals): { deviceClass: DeviceClass; deviceLabel: string } {
  if (isIosDevice(signals)) {
    return { deviceClass: 'ios', deviceLabel: 'iPhone or iPad' }
  }

  if (isAndroidDevice(signals)) {
    const isFlagshipCandidate = (signals.deviceMemory ?? 0) >= 8 && (signals.hardwareConcurrency ?? 0) >= 8
    return isFlagshipCandidate
      ? { deviceClass: 'android-flagship-candidate', deviceLabel: 'Android flagship candidate' }
      : { deviceClass: 'android-mid-range', deviceLabel: 'Android mobile' }
  }

  if ((signals.deviceMemory ?? 0) >= 8) {
    return { deviceClass: 'desktop-capable', deviceLabel: 'Desktop or laptop with a higher memory signal' }
  }

  return { deviceClass: 'desktop-limited', deviceLabel: 'Desktop or laptop with a limited or unavailable memory signal' }
}

async function detectWebGpu(signals: NavigatorSignals): Promise<CapabilityAssessment['webGpu']> {
  if (!signals.gpu?.requestAdapter) {
    return {
      status: 'unavailable',
      adapterAvailable: false,
      features: [],
      reason: 'This browser does not expose WebGPU.',
    }
  }

  try {
    const adapter = await signals.gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) {
      return {
        status: 'unavailable',
        adapterAvailable: false,
        features: [],
        reason: 'WebGPU is present, but this browser could not provide a usable adapter.',
      }
    }

    return {
      status: 'available',
      adapterAvailable: true,
      maxStorageBufferBindingSize: adapter.limits?.maxStorageBufferBindingSize,
      features: adapter.features ? Array.from(adapter.features) : [],
      reason: 'A WebGPU adapter is available for this browser context.',
    }
  } catch (error) {
    return {
      status: 'unavailable',
      adapterAvailable: false,
      features: [],
      reason: error instanceof Error ? 'WebGPU adapter detection failed: ' + error.message : 'WebGPU adapter detection failed.',
    }
  }
}

async function detectStorage(): Promise<CapabilityAssessment['storage']> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return {
      status: 'unknown',
      reason: 'This browser did not expose a storage estimate; model caching remains best-effort.',
    }
  }

  try {
    const estimate = await navigator.storage.estimate()
    const usageBytes = estimate.usage
    const quotaBytes = estimate.quota
    const freeBytes = usageBytes !== undefined && quotaBytes !== undefined ? Math.max(0, quotaBytes - usageBytes) : undefined
    const { hasModelInCache, prebuiltAppConfig } = await import('@mlc-ai/web-llm')
    const modelCached = await hasModelInCache(LOCAL_MODEL_REQUIREMENTS.modelId, prebuiltAppConfig).catch(() => false)
    const persistent = typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : undefined

    if (freeBytes !== undefined && freeBytes < LOCAL_MODEL_STORAGE_RESERVE_BYTES && !modelCached) {
      return {
        status: 'insufficient',
        freeBytes,
        quotaBytes,
        usageBytes,
        modelCached,
        persistent,
        reason: 'The estimated free origin storage is below the model cache reserve.',
      }
    }

    return {
      status: 'available',
      freeBytes,
      quotaBytes,
      usageBytes,
      modelCached,
      persistent,
      reason: modelCached
        ? 'The local model is already cached. Current free space is not used as a download gate, though browser storage can still evict the cache under pressure.'
        : persistent === true
          ? 'The model cache has enough estimated space and persistent storage is currently granted.'
          : 'The model cache has enough estimated space, but browser storage can still be evicted under pressure.',
    }
  } catch {
    return {
      status: 'unknown',
      reason: 'The browser refused a storage estimate; model caching remains best-effort.',
    }
  }
}

function assessTier(
  deviceClass: DeviceClass,
  webGpu: CapabilityAssessment['webGpu'],
  storage: CapabilityAssessment['storage'],
  deviceMemoryGiB: number | undefined,
): CapabilityTier {
  if (webGpu.status !== 'available' || storage.status === 'insufficient') {
    return 'L0'
  }

  if (deviceClass === 'ios' || deviceClass === 'android-mid-range' || deviceClass === 'android-flagship-candidate') {
    return 'L1'
  }

  if (deviceMemoryGiB === undefined || deviceMemoryGiB < 8) {
    return 'L1'
  }

  return 'L2'
}

function modelStatusForTier(tier: CapabilityTier, deviceClass: DeviceClass, webGpu: CapabilityAssessment['webGpu']): CapabilityAssessment['localModel'] {
  if (tier === 'L0') {
    return {
      ...LOCAL_MODEL_REQUIREMENTS,
      status: 'unavailable',
      reason: webGpu.status !== 'available'
        ? webGpu.reason
        : 'Local inference is unavailable because this device does not have enough storage for a safe model cache.',
    }
  }

  if (tier === 'L1') {
    const mobileReason = deviceClass === 'ios' || deviceClass.startsWith('android')
      ? 'This mobile device needs real-device memory, throughput, cache-survival, and language-quality validation before the 4B model can be offered.'
      : 'The available memory signal is not enough to offer the 4B model confidently.'
    return {
      ...LOCAL_MODEL_REQUIREMENTS,
      status: 'restricted',
      reason: mobileReason + ' No smaller local fallback is bundled in this release.',
    }
  }

  return {
    ...LOCAL_MODEL_REQUIREMENTS,
    status: 'available',
    reason: 'This device passes the conservative WebGPU, storage, and memory preflight for the 4B model. A real provider warm-up still remains necessary.',
  }
}

export function createInitialCapability(): CapabilityAssessment {
  return {
    tier: 'L0',
    deviceClass: 'unknown',
    deviceLabel: 'Checking this device',
    webGpu: {
      status: 'checking',
      adapterAvailable: false,
      features: [],
      reason: 'Checking WebGPU and browser capability…',
    },
    memory: {},
    storage: {
      status: 'unknown',
      reason: 'Checking browser storage…',
    },
    localModel: {
      ...LOCAL_MODEL_REQUIREMENTS,
      status: 'unavailable',
      reason: 'Checking whether local inference can be offered…',
    },
  }
}

export async function detectDeviceCapability(timeoutMs = CAPABILITY_CHECK_TIMEOUT_MS): Promise<CapabilityAssessment> {
  if (typeof navigator === 'undefined') {
    return createInitialCapability()
  }

  const signals = navigator as NavigatorSignals
  const performanceSignals = performance as PerformanceSignals
  const deviceMemoryGiB = typeof signals.deviceMemory === 'number' ? signals.deviceMemory : undefined
  const jsHeapLimitGiB = typeof performanceSignals.memory?.jsHeapSizeLimit === 'number'
    ? performanceSignals.memory.jsHeapSizeLimit / 1024 ** 3
    : undefined
  const [webGpu, storage] = await Promise.all([
    withCapabilityDeadline(detectWebGpu(signals), timeoutMs, () => ({
      status: 'unavailable' as const,
      adapterAvailable: false,
      features: [],
      reason: 'WebGPU adapter detection timed out. Retry the device capability check from Settings.',
    })),
    withCapabilityDeadline(detectStorage(), timeoutMs, () => ({
      status: 'unknown' as const,
      reason: 'The browser storage check timed out. Model caching remains best-effort; retry the device capability check from Settings.',
    })),
  ])
  const { deviceClass, deviceLabel } = classifyDevice(signals)
  const tier = assessTier(deviceClass, webGpu, storage, deviceMemoryGiB)

  return {
    tier,
    deviceClass,
    deviceLabel,
    webGpu,
    memory: { deviceMemoryGiB, jsHeapLimitGiB },
    storage,
    localModel: modelStatusForTier(tier, deviceClass, webGpu),
    detectedAt: new Date().toISOString(),
  }
}

export function hasAtLeastTier(capability: CapabilityAssessment, minimumTier: CapabilityTier): boolean {
  return tierRank[capability.tier] >= tierRank[minimumTier]
}

export function isWeakLocalDirection(sourceLanguage: LanguageCode, targetLanguage: LanguageCode): boolean {
  return WEAK_LOCAL_LANGUAGES.includes(sourceLanguage) || WEAK_LOCAL_LANGUAGES.includes(targetLanguage)
}

export function getDirectionQualityDisclosure(sourceLanguage: LanguageCode, targetLanguage: LanguageCode): string | undefined {
  if (!isWeakLocalDirection(sourceLanguage, targetLanguage)) {
    return undefined
  }

  return 'Local Qwen3.5-4B critique is not offered for Hindi or Arabic directions yet. Language support is not the same as validated critique quality; use manual review or explicit cloud consent for this direction.'
}

/**
 * Conservative context estimate: count Han characters individually and other
 * Unicode characters at no more than three characters per token. Include the
 * complete system and task prompt, not only the learner's answer.
 */
export function estimateEvaluationPromptTokens(input: EvaluationRequest): number {
  const prompt = 'learnerAnswer' in input ? `${localEvaluationSystemPrompt}\n${buildLocalWrittenPrompt(input)}` : `${evaluationSystemPrompt}\n${buildEvaluationPrompt(input)}`
  let hanCharacters = 0
  let otherCharacters = 0
  for (const character of prompt) {
    if (HAN_CHARACTER.test(character)) {
      hanCharacters += 1
    } else {
      otherCharacters += 1
    }
  }
  return hanCharacters + Math.ceil(otherCharacters / 3)
}

export function getLocalEvaluationDecision(capability: CapabilityAssessment, input: EvaluationRequest): LocalEvaluationDecision {
  if (capability.webGpu.status === 'checking') {
    return { allowed: false, reason: 'Device capability is still being checked. Local evaluation will not start until the check is complete.' }
  }

  if (capability.webGpu.status !== 'available') {
    return { allowed: false, reason: capability.webGpu.reason }
  }

  if (capability.storage.status === 'insufficient') {
    return { allowed: false, reason: capability.storage.reason }
  }

  if (!hasAtLeastTier(capability, 'L2')) {
    return { allowed: false, reason: capability.tier + ' detected on ' + capability.deviceLabel + '. The current 4B local model is offered only on L2 devices after a successful warm-up; no smaller fallback is bundled.' }
  }

  const directionDisclosure = getDirectionQualityDisclosure(input.exercise.sourceLanguage, input.exercise.targetLanguage)
  if (directionDisclosure) {
    return { allowed: false, reason: directionDisclosure }
  }

  const availablePromptTokens = capability.localModel.contextWindowTokens
    - LOCAL_MODEL_OUTPUT_TOKEN_RESERVE
    - LOCAL_MODEL_CONTEXT_SAFETY_MARGIN
  if (estimateEvaluationPromptTokens(input) > availablePromptTokens) {
    return { allowed: false, reason: 'The complete source, answer, and evaluation instructions exceed the conservative local context budget. Keep this task for manual review or choose explicit cloud consent.' }
  }

  return { allowed: true, reason: capability.localModel.reason }
}

export function formatMemorySignal(capability: CapabilityAssessment): string {
  if (capability.memory.deviceMemoryGiB !== undefined) {
    return capability.memory.deviceMemoryGiB + ' GiB coarse device-memory signal'
  }

  if (capability.memory.jsHeapLimitGiB !== undefined) {
    return capability.memory.jsHeapLimitGiB.toFixed(1) + ' GiB JavaScript heap limit signal'
  }

  return 'Memory signal unavailable'
}

export function formatStorageSignal(capability: CapabilityAssessment): string {
  if (capability.storage.freeBytes === undefined) {
    return 'Storage estimate unavailable'
  }

  const freeGiB = capability.storage.freeBytes / 1024 ** 3
  return freeGiB.toFixed(1) + ' GiB estimated origin headroom'
}

export function formatTierLabel(tier: CapabilityTier): string {
  const labels: Record<CapabilityTier, string> = {
    L0: 'No local inference',
    L1: 'Restricted local inference',
    L2: 'Baseline local critique',
    L3: 'Enhanced local critique',
    L4: 'Desktop quality candidate',
  }
  return tier + ' · ' + labels[tier]
}
