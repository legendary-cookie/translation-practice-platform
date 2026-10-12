import { getLanguage } from '../domain/languages'
import type { ConsentedCloudAudioEvidence, EvaluationInput, EvaluationRequest, InterpretingEvaluationInput, ScoreDimension } from '../domain/types'
import { hasConsentedCloudAudioDeliveryEvidence, hasCompleteInterpretingDeliveryEvidence } from '../domain/scoring'

const dimensions: ScoreDimension[] = ['accuracy', 'terminology', 'grammar', 'fluency', 'taskStyle']

export const evaluationSystemPrompt = `You are a careful translation practice coach. Return only a JSON object, never Markdown and never a calibrated or official exam result. Give a practice estimate based on the source and learner answer. Accept multiple valid translations. Every sourceQuote must be copied literally from the source text, and every learnerQuote must be copied literally from the learner answer. Do not invent evidence. If evidence is insufficient, explain that in uncertainty.`

function buildWrittenEvaluationPrompt(input: EvaluationInput): string {
  const sourceLanguage = getLanguage(input.exercise.sourceLanguage)
  const targetLanguage = getLanguage(input.exercise.targetLanguage)
  const dimensionList = dimensions.join(', ')

  return `Evaluate this ${input.mode} translation from ${sourceLanguage.label} to ${targetLanguage.label}.

Return this JSON shape:
{
  "summary": "short evidence-based summary",
  "overallScore": 0,
  "dimensions": {"accuracy": 0, "terminology": 0, "grammar": 0, "fluency": 0, "taskStyle": 0},
  "strengths": ["specific strength"],
  "issues": [{"dimension": "accuracy", "sourceQuote": "literal source text or empty", "learnerQuote": "literal learner text or empty", "explanation": "why it matters", "suggestion": "a concrete revision or alternative"}],
  "alternatives": ["another valid rendering when useful"],
  "uncertainty": "what the evaluator cannot confidently determine"
}

Use exactly these five dimension keys: ${dimensionList}. Use a higher-is-better scale for every dimension: 100 means fully successful performance with no consequential errors for that dimension; lower scores mean more frequent or severe shortcomings. Keep all scores between 0 and 100. This is practice feedback only; do not call it a CATTI or MTI result.

SOURCE TEXT (${sourceLanguage.label}):
<<<SOURCE>>>
${input.exercise.sourceText}
<<<END SOURCE>>>

LEARNER ANSWER (${targetLanguage.label}):
<<<ANSWER>>>
${input.learnerAnswer}
<<<END ANSWER>>>
`
}

function buildInterpretingEvaluationPrompt(input: InterpretingEvaluationInput, cloudAudioEvidence?: ConsentedCloudAudioEvidence): string {
  const sourceLanguage = getLanguage(input.exercise.sourceLanguage)
  const targetLanguage = getLanguage(input.exercise.targetLanguage)
  const sourceSegments = input.exercise.segments.map((segment) => `${segment.id}: ${segment.transcript}`).join('\n')
  const responses = input.responseSegments.map((segment) => `${segment.id} (source ${segment.sourceSegmentId}, ${segment.transcriptSource}, ${segment.recognitionStatus}): ${segment.transcript}`).join('\n')
  const delivery = input.deliveryAnalysis.map((analysis) => {
    if (analysis.method.startsWith('local-web-audio-energy-') || analysis.method === 'local-analysis-unavailable-v1') {
      return JSON.stringify({
        recordingId: analysis.recordingId,
        durationMs: analysis.durationMs,
        analysisConfidence: analysis.analysisConfidence,
        method: analysis.method,
        qualification: 'unqualified amplitude/envelope data only; not evidence of speech presence, signal quality, or delivery quality',
      })
    }
    return JSON.stringify(analysis)
  }).join('\n')
  const attachedCloudAudioCanBeScored = hasConsentedCloudAudioDeliveryEvidence(input, cloudAudioEvidence)
  const deliveryCanBeScored = hasCompleteInterpretingDeliveryEvidence(input) || attachedCloudAudioCanBeScored
  const deliveryScoreField = deliveryCanBeScored
    ? '  "deliveryScores": {"fluency": 0, "pacing": 0, "hesitation": 0},\n'
    : ''
  const sourceTranscriptNote = input.exercise.sourceTranscriptStatus === 'missing'
    ? deliveryCanBeScored
      ? 'The imported source has no supplied transcript. Do not fabricate content scores or source evidence; return delivery scores only and explain the limitation.'
      : 'The imported source has no supplied transcript, and there is no sufficiently confident delivery analysis. Do not fabricate content or delivery scores or source evidence; explain the limitation.'
    : 'Source transcript evidence is available for literal evidence checks.'

  const consentedAudioWasAttached = cloudAudioEvidence?.taskConsentGranted === true
  const audioInstruction = attachedCloudAudioCanBeScored
    ? 'The learner explicitly consented to send the attached response audio to this cloud evaluator. The text prompt is followed by input_audio parts in the 1-based order shown in the attachment map below. Use each part only for its listed response ranges; do not infer transcript content from it or override supplied transcript evidence.'
    : consentedAudioWasAttached
      ? 'The learner explicitly consented to send the listed audio parts to this cloud evaluator, but their mapping does not qualify as trusted delivery evidence. Do not score delivery from these parts; use only the transcripts and any sufficiently confident local delivery analysis. Do not infer transcript content from the audio.'
      : 'Use only the transcripts and derived delivery metrics below; response audio stays on the learner\'s device and is not attached to this evaluation.'
  const audioAttachmentMap = consentedAudioWasAttached && cloudAudioEvidence
    ? `\n\nCLOUD AUDIO ATTACHMENT MAP:\n${JSON.stringify(cloudAudioEvidence.audioAttachments, null, 2)}\nEND CLOUD AUDIO ATTACHMENT MAP`
    : ''
  const deliveryInstruction = deliveryCanBeScored
    ? 'Sufficiently confident local delivery analysis is available for the saved response recordings.'
    : 'No sufficiently confident analysis covers every response recording. Omit deliveryScores and do not invent a delivery estimate. Amplitude/envelope-only metrics do not establish speech presence, signal quality, or delivery quality; do not infer these from loudness, peaks, or pauses.'

  return `Evaluate this ${input.interpretingMode} interpreting practice from ${sourceLanguage.label} to ${targetLanguage.label}. ${audioInstruction} ${deliveryInstruction}

${sourceTranscriptNote}
${audioAttachmentMap}

Return this JSON shape:
{
  "summary": "short evidence-based summary",
  "contentScores": {"meaningTransfer": 0, "omissions": 0, "additionsMistranslations": 0, "terminology": 0},
${deliveryScoreField}  "overallScore": 0,
  "strengths": ["specific strength"],
  "issues": [{"category": "omission", "sourceSegmentId": "segment-id", "responseSegmentId": "response-id", "sourceQuote": "literal source transcript", "learnerQuote": "literal learner transcript", "explanation": "why it matters", "suggestion": "a concrete revision", "evidenceStatus": "verified"}],
  "uncertainEvidence": [],
  "alternatives": [],
  "uncertainty": "what the evaluator cannot confidently determine"
}

Keep content and delivery scores separate. Every dimension uses a higher-is-better scale: 100 means excellent performance with no consequential error or shortcoming for that dimension; lower scores indicate more frequent or severe problems. In particular, omissions=100 means no consequential omissions and complete content transfer; additionsMistranslations=100 means no consequential unsupported additions or mistranslations; hesitation=100 means no consequential delivery disruption from hesitation. Meaning transfer, terminology, fluency, and pacing are also strongest at 100. Do not infer meaning errors from a recognition-uncertain response; put that evidence in uncertainEvidence instead. All scores must be between 0 and 100. This is practice feedback only, never an official exam result.

SOURCE SEGMENTS (${sourceLanguage.label}):
<<<SOURCE>>>
${sourceSegments}
<<<END SOURCE>>>

LEARNER RESPONSE SEGMENTS (${targetLanguage.label}):
<<<RESPONSE>>>
${responses}
<<<END RESPONSE>>>

LOCAL DELIVERY METRICS:
<<<METRICS>>>
${delivery}
<<<END METRICS>>>
`
}

export function buildEvaluationPrompt(input: EvaluationRequest, options?: { cloudAudioEvidence?: ConsentedCloudAudioEvidence }): string {
  return 'learnerAnswer' in input
    ? buildWrittenEvaluationPrompt(input)
    : buildInterpretingEvaluationPrompt(input, options?.cloudAudioEvidence)
}
