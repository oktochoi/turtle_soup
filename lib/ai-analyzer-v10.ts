/**
 * AI 질문 분석기 V10 — Embedding Retrieval + Multilingual NLI
 *
 * V9의 heuristic-heavy 판정과 병행 실험하기 위한 별도 모듈.
 * Production 기본 판정은 V9 유지. V10은 비교 실험 전용.
 *
 * Pipeline:
 *   질문 → normalize → embedding retrieval (Top-K evidence) → NLI → YES/NO/IRRELEVANT
 *
 * NLI 모델: Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7
 * Embedding: 기존 V9의 MiniLM 재사용
 */

import type { JudgeResult, ProblemKnowledge } from './ai-analyzer';
import {
  getEmbedding,
  cosineSimilarity,
  normalizeNegationQuestion,
  initializeModel as initEmbeddingModel,
} from './ai-analyzer';

// ─── Types ───────────────────────────────────────────────────

export interface Evidence {
  text: string;
  similarity: number;
  source: 'content' | 'answer';
}

export interface NLIJudgeResult {
  label: JudgeResult;
  rawLabel: 'entailment' | 'contradiction' | 'neutral';
  confidence: number;
  evidence: Evidence[];
  selectedEvidence?: Evidence;
  entailmentScore: number;
  contradictionScore: number;
  neutralScore: number;
  invert: boolean;
  model: string;
  inferenceMs: number;
  fallback?: boolean;
}

export interface AIComparisonLog {
  question: string;
  v9Result: string;
  v10Result: string;
  nliLabel?: string;
  nliConfidence?: number;
  evidence?: string;
  retrievalSimilarity?: number;
  inferenceMs?: number;
}

// ─── Config ──────────────────────────────────────────────────

export const V10_CONFIG = {
  TOP_K: 3,
  MIN_RETRIEVAL_SIMILARITY: 0.25,
  MIN_ENTAILMENT_CONFIDENCE: 0.50,
  MIN_CONTRADICTION_CONFIDENCE: 0.50,
  MIN_DECISION_MARGIN: 0.10,
  NLI_MODEL_ID: 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7',
} as const;

// ─── NLI model singleton ─────────────────────────────────────

type NLIPipelineType = any;

let nliPipeline: NLIPipelineType | null = null;
let nliModelLoading = false;
let nliModelPromise: Promise<NLIPipelineType> | null = null;

export type NLIModelStatus = 'idle' | 'loading' | 'ready' | 'error';
let nliModelStatus: NLIModelStatus = 'idle';
let nliLoadProgress = 0;

export function getNLIModelStatus(): { status: NLIModelStatus; progress: number } {
  return { status: nliModelStatus, progress: nliLoadProgress };
}

async function getNLIPipeline(): Promise<NLIPipelineType> {
  if (nliPipeline) return nliPipeline;
  if (nliModelLoading && nliModelPromise) return nliModelPromise;

  if (typeof window === 'undefined') {
    throw new Error('NLI model can only be loaded in browser');
  }

  nliModelLoading = true;
  nliModelStatus = 'loading';

  nliModelPromise = (async () => {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;

      // WebGPU → WASM fallback
      let device: string = 'wasm';
      try {
        if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
          const gpu = (navigator as any).gpu;
          if (gpu) {
            const adapter = await gpu.requestAdapter();
            if (adapter) device = 'webgpu';
          }
        }
      } catch {
        // WebGPU not available, fallback to WASM
      }

      const classifier = await pipeline(
        'zero-shot-classification',
        V10_CONFIG.NLI_MODEL_ID,
        {
          device: device as any,
          dtype: 'q8' as any,
          progress_callback: (p: any) => {
            if (p && typeof p.progress === 'number') {
              nliLoadProgress = Math.round(p.progress);
            }
          },
        }
      );

      nliPipeline = classifier;
      nliModelLoading = false;
      nliModelStatus = 'ready';
      nliLoadProgress = 100;
      return classifier;
    } catch (e) {
      nliModelLoading = false;
      nliModelPromise = null;
      nliModelStatus = 'error';
      throw e;
    }
  })();

  return nliModelPromise;
}

export function releaseNLIModel(): void {
  nliPipeline = null;
  nliModelLoading = false;
  nliModelPromise = null;
  nliModelStatus = 'idle';
  nliLoadProgress = 0;
}

// ─── Text utilities (reuse V9 normalize) ─────────────────────

function normalizeText(text: string): string {
  return (text ?? '')
    .replace(/\u200B/g, '')
    .replace(/[\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];
  const rough = cleaned.split(/[\n\r]+/g);
  const results: string[] = [];
  for (const line of rough) {
    const subs = line.split(/(?<=[.!?。！？])\s+/);
    for (const s of subs) {
      const t = s.trim();
      if (t.length >= 4) results.push(t);
    }
  }
  if (results.length === 0 && cleaned.length >= 4) results.push(cleaned);
  return results;
}

/**
 * 질문을 간단한 평서형으로 변환 (방식 A + 최소 방식 B)
 * 과도한 regex 없이 의문 어미를 제거하는 수준.
 */
function questionToHypothesis(question: string): string {
  let h = normalizeText(question);
  // 한국어 의문 어미 제거
  h = h.replace(/\?+$/g, '');
  h = h.replace(/(인가요|인가|인지요|인지|입니까|습니까|나요|세요|할까요|할까|인건가요|인건가|건가요|건가|는가요|는가|은가요|은가)[\s.?!]*$/g, '');
  h = h.replace(/(했나요|했습니까|했는가|했을까요|했을까|됐나요|됐습니까|있나요|있습니까|있는가|었나요|었습니까|였나요|였습니까)[\s.?!]*$/g, '');
  return h.trim();
}

// ─── Evidence Retrieval ──────────────────────────────────────

async function retrieveTopEvidence(
  question: string,
  knowledge: ProblemKnowledge,
  topK: number = V10_CONFIG.TOP_K
): Promise<Evidence[]> {
  const contentSentences = splitSentences(knowledge.content || '');
  const answerSentences = splitSentences(knowledge.answer || '');

  if (contentSentences.length === 0 && answerSentences.length === 0) return [];

  const questionVec = await getEmbedding(question);

  const allCandidates: Evidence[] = [];

  // Embed content sentences
  for (const s of contentSentences) {
    try {
      const vec = await getEmbedding(s);
      const sim = cosineSimilarity(questionVec, vec);
      allCandidates.push({ text: s, similarity: sim, source: 'content' });
    } catch { /* skip */ }
  }

  // Embed answer sentences
  for (const s of answerSentences) {
    try {
      const vec = await getEmbedding(s);
      const sim = cosineSimilarity(questionVec, vec);
      allCandidates.push({ text: s, similarity: sim, source: 'answer' });
    } catch { /* skip */ }
  }

  // Sort by similarity desc, take top K
  allCandidates.sort((a, b) => b.similarity - a.similarity);

  return allCandidates
    .filter(e => e.similarity >= V10_CONFIG.MIN_RETRIEVAL_SIMILARITY)
    .slice(0, topK);
}

// ─── NLI classification ──────────────────────────────────────

interface NLIScores {
  entailment: number;
  contradiction: number;
  neutral: number;
}

async function runNLI(premise: string, hypothesis: string): Promise<NLIScores> {
  const classifier = await getNLIPipeline();

  // zero-shot-classification with hypothesis_template
  // The pipeline internally constructs premise-hypothesis pairs
  const result = await classifier(premise, ['entailment', 'contradiction', 'neutral'], {
    hypothesis_template: hypothesis + ' 따라서 {}.',
    multi_label: true,
  });

  const scores: NLIScores = { entailment: 0, contradiction: 0, neutral: 0 };

  if (result && result.labels && result.scores) {
    for (let i = 0; i < result.labels.length; i++) {
      const label = result.labels[i].toLowerCase();
      if (label === 'entailment') scores.entailment = result.scores[i];
      else if (label === 'contradiction') scores.contradiction = result.scores[i];
      else if (label === 'neutral') scores.neutral = result.scores[i];
    }
  }

  return scores;
}

// ─── Main V10 judge function ─────────────────────────────────

export async function judgeQuestionV10(
  questionRaw: string,
  knowledge: ProblemKnowledge
): Promise<NLIJudgeResult> {
  const startMs = performance.now();

  // Browser guard
  if (typeof window === 'undefined') {
    return makeIrrelevantResult(0, false, 'SSR environment');
  }

  const q0 = normalizeText(questionRaw);
  if (!q0 || q0.length < 4) {
    return makeIrrelevantResult(performance.now() - startMs, false, 'Question too short');
  }

  if (!knowledge.content && !knowledge.answer) {
    return makeIrrelevantResult(performance.now() - startMs, false, 'No content/answer');
  }

  // 1) Negation detection (reuse V9)
  const { normalized: qNorm, invert } = normalizeNegationQuestion(q0);

  // 2) Convert to hypothesis
  const hypothesis = questionToHypothesis(qNorm);

  // 3) Ensure embedding model is loaded
  await initEmbeddingModel();

  // 4) Retrieve top evidence
  const evidence = await retrieveTopEvidence(qNorm, knowledge, V10_CONFIG.TOP_K);

  if (evidence.length === 0) {
    return makeIrrelevantResult(performance.now() - startMs, invert, 'No evidence found');
  }

  // 5) Run NLI on each evidence, compute weighted scores
  let bestEntailment = 0;
  let bestContradiction = 0;
  let bestNeutral = 0;
  let bestEvidence: Evidence | undefined;
  let bestRawLabel: 'entailment' | 'contradiction' | 'neutral' = 'neutral';

  for (const ev of evidence) {
    try {
      const nliScores = await runNLI(ev.text, hypothesis);

      const wEntail = nliScores.entailment * ev.similarity;
      const wContra = nliScores.contradiction * ev.similarity;
      const wNeutral = nliScores.neutral * ev.similarity;

      if (wEntail > bestEntailment) {
        bestEntailment = wEntail;
        if (wEntail >= bestContradiction && wEntail >= bestNeutral) {
          bestEvidence = ev;
          bestRawLabel = 'entailment';
        }
      }
      if (wContra > bestContradiction) {
        bestContradiction = wContra;
        if (wContra > bestEntailment && wContra >= bestNeutral) {
          bestEvidence = ev;
          bestRawLabel = 'contradiction';
        }
      }
      if (wNeutral > bestNeutral) {
        bestNeutral = wNeutral;
        if (wNeutral > bestEntailment && wNeutral > bestContradiction) {
          bestEvidence = ev;
          bestRawLabel = 'neutral';
        }
      }
    } catch (e) {
      console.warn('[V10] NLI inference error for evidence:', e);
    }
  }

  // 6) Determine label
  const maxScore = Math.max(bestEntailment, bestContradiction, bestNeutral);
  let label: JudgeResult;
  let rawLabel: 'entailment' | 'contradiction' | 'neutral';
  let confidence: number;

  if (bestEntailment >= bestContradiction && bestEntailment >= bestNeutral) {
    rawLabel = 'entailment';
    confidence = bestEntailment;
    label = confidence >= V10_CONFIG.MIN_ENTAILMENT_CONFIDENCE * (bestEvidence?.similarity || 0.5)
      ? 'yes' : 'irrelevant';
  } else if (bestContradiction >= bestEntailment && bestContradiction >= bestNeutral) {
    rawLabel = 'contradiction';
    confidence = bestContradiction;
    label = confidence >= V10_CONFIG.MIN_CONTRADICTION_CONFIDENCE * (bestEvidence?.similarity || 0.5)
      ? 'no' : 'irrelevant';
  } else {
    rawLabel = 'neutral';
    confidence = bestNeutral;
    label = 'irrelevant';
  }

  // Check margin
  const secondBest = [bestEntailment, bestContradiction, bestNeutral]
    .sort((a, b) => b - a)[1] || 0;
  if (maxScore - secondBest < V10_CONFIG.MIN_DECISION_MARGIN && label !== 'irrelevant') {
    label = 'irrelevant';
  }

  // 7) Apply invert
  if (invert) {
    if (label === 'yes') label = 'no';
    else if (label === 'no') label = 'yes';
  }

  const inferenceMs = performance.now() - startMs;

  return {
    label,
    rawLabel,
    confidence,
    evidence,
    selectedEvidence: bestEvidence,
    entailmentScore: bestEntailment,
    contradictionScore: bestContradiction,
    neutralScore: bestNeutral,
    invert,
    model: V10_CONFIG.NLI_MODEL_ID,
    inferenceMs,
  };
}

function makeIrrelevantResult(inferenceMs: number, invert: boolean, _reason?: string): NLIJudgeResult {
  return {
    label: 'irrelevant',
    rawLabel: 'neutral',
    confidence: 0,
    evidence: [],
    entailmentScore: 0,
    contradictionScore: 0,
    neutralScore: 0,
    invert,
    model: V10_CONFIG.NLI_MODEL_ID,
    inferenceMs,
  };
}

// ─── Comparison mode ─────────────────────────────────────────

const ENABLE_V10_COMPARISON =
  typeof process !== 'undefined' &&
  process.env?.NEXT_PUBLIC_AI_V10_COMPARE === 'true';

export function isV10ComparisonEnabled(): boolean {
  return ENABLE_V10_COMPARISON;
}

const comparisonLogs: AIComparisonLog[] = [];
const MAX_COMPARISON_LOGS = 200;

export function getComparisonLogs(): AIComparisonLog[] {
  return [...comparisonLogs];
}

export function clearComparisonLogs(): void {
  comparisonLogs.length = 0;
}

export function logComparison(log: AIComparisonLog): void {
  comparisonLogs.push(log);
  if (comparisonLogs.length > MAX_COMPARISON_LOGS) {
    comparisonLogs.shift();
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(
      `\n==========================\n` +
      `AI V10 DEBUG\n\n` +
      `Question:\n${log.question}\n\n` +
      `V9: ${log.v9Result}\n` +
      `V10: ${log.v10Result}\n\n` +
      (log.evidence ? `Evidence:\n${log.evidence}\n\n` : '') +
      (log.retrievalSimilarity != null ? `Retrieval similarity: ${log.retrievalSimilarity.toFixed(3)}\n` : '') +
      (log.nliLabel ? `NLI label: ${log.nliLabel}\n` : '') +
      (log.nliConfidence != null ? `NLI confidence: ${log.nliConfidence.toFixed(3)}\n` : '') +
      (log.inferenceMs != null ? `Time: ${Math.round(log.inferenceMs)}ms\n` : '') +
      `==========================\n`
    );
  }
}

/**
 * 동일 질문에 대해 V9와 V10을 모두 실행하고 비교 로그를 남긴다.
 * 사용자에게는 V9 결과를 반환한다.
 */
export async function analyzeWithComparison(
  questionRaw: string,
  knowledge: ProblemKnowledge,
  v9Judge: () => Promise<JudgeResult>
): Promise<{ v9: JudgeResult; v10?: NLIJudgeResult }> {
  const v9Result = await v9Judge();

  if (!isV10ComparisonEnabled()) {
    return { v9: v9Result };
  }

  let v10Result: NLIJudgeResult | undefined;
  try {
    v10Result = await judgeQuestionV10(questionRaw, knowledge);

    logComparison({
      question: questionRaw,
      v9Result,
      v10Result: v10Result.label,
      nliLabel: v10Result.rawLabel,
      nliConfidence: v10Result.confidence,
      evidence: v10Result.selectedEvidence?.text,
      retrievalSimilarity: v10Result.selectedEvidence?.similarity,
      inferenceMs: v10Result.inferenceMs,
    });
  } catch (e) {
    console.warn('[V10] Comparison failed, V9 result used:', e);
  }

  return { v9: v9Result, v10: v10Result };
}

// ─── Initialize V10 (preload NLI model) ──────────────────────

export async function initializeV10(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await getNLIPipeline();
  } catch (e) {
    console.warn('[V10] NLI model initialization failed:', e);
  }
}
