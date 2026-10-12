import { getLanguage } from '../domain/languages'
import type { EvaluationInput, EvaluationRequest, InterpretingEvaluationInput, ScoreDimension } from '../domain/types'

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

Use exactly these five dimension keys: ${dimensionList}. Keep all scores between 0 and 100. This is practice feedback only; do not call it a CATTI or MTI result.

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

function buildInterpretingEvaluationPrompt(input: InterpretingEvaluationInput, attachedAudioAvailable: boolean): string {
  const sourceLanguage = getLanguage(input.exercise.sourceLanguage)
  const targetLanguage = getLanguage(input.exercise.targetLanguage)
  const sourceSegments = input.exercise.segments.map((segment) => `${segment.id}: ${segment.transcript}`).join('\n')
  const responses = input.responseSegments.map((segment) => `${segment.id} (source ${segment.sourceSegmentId}, ${segment.transcriptSource}, ${segment.recognitionStatus}): ${segment.transcript}`).join('\n')
  const delivery = input.deliveryAnalysis.map((analysis) => JSON.stringify(analysis)).join('\n')
  const deliveryCanBeScored = input.recordings.length > 0 && input.responseSegments.length > 0
    && input.responseSegments.every((segment) => segment.recordingId
      && input.recordings.some((recording) => recording.id === segment.recordingId)
      && input.deliveryAnalysis.some((analysis) => analysis.recordingId === segment.recordingId && analysis.analysisConfidence >= 0.5))
  const deliveryScoreField = deliveryCanBeScored
    ? '  "deliveryScores": {"fluency": 0, "pacing": 0, "hesitation": 0},\n'
    : ''
  const sourceTranscriptNote = input.exercise.sourceTranscriptStatus === 'missing'
    ? deliveryCanBeScored
      ? 'The imported source has no supplied transcript. Do not fabricate content scores or source evidence; return delivery scores only and explain the limitation.'
      : 'The imported source has no supplied transcript, and there is no sufficiently confident delivery analysis. Do not fabricate content or delivery scores or source evidence; explain the limitation.'
    : 'Source transcript evidence is available for literal evidence checks.'

  const audioInstruction = attachedAudioAvailable
    ? 'The learner explicitly consented to send the attached response audio to this cloud evaluator. You may use the audio only to assess delivery (fluency, pacing, hesitation); do not infer transcript content from it or override the supplied transcript evidence.'
    : 'Use only the transcripts and derived delivery metrics below; response audio stays on the learner\'s device and is not attached to this evaluation.'
  const deliveryInstruction = deliveryCanBeScored
    ? 'Sufficiently confident local delivery analysis is available for the saved response recordings.'
    : 'No sufficiently confident analysis covers every response recording. Omit deliveryScores and do not invent a delivery estimate.'

  return `Evaluate this ${input.interpretingMode} interpreting practice from ${sourceLanguage.label} to ${targetLanguage.label}. ${audioInstruction} ${deliveryInstruction}

${sourceTranscriptNote}

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

Keep content and delivery scores separate. Do not infer meaning errors from a recognition-uncertain response; put that evidence in uncertainEvidence instead. All scores must be between 0 and 100. This is practice feedback only, never an official exam result.

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

export function buildEvaluationPrompt(input: EvaluationRequest, options?: { attachedAudioAvailable?: boolean }): string {
  return 'learnerAnswer' in input
    ? buildWrittenEvaluationPrompt(input)
    : buildInterpretingEvaluationPrompt(input, options?.attachedAudioAvailable === true)
}
