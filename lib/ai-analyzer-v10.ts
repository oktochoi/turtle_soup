/**
 * AI 질문 분석기 V10 — Embedding Retrieval + Multilingual NLI
 *
 * V9의 heuristic-heavy 판정과 병행 실험하기 위한 별도 모듈.
 * Production 기본 판정은 V9 유지. V10은 비교 실험 전용.
 *
 * Pipeline:
 *   질문 → normalize → embedding retrieval (Top-K evidence) → NLI → YES/NO/IRRELEVANT
 *
 * 판정 정책:
 *   entailment  → YES
 *   contradiction → NO
 *   neutral → Story relevance 검사
 *     related   → NO
 *     unrelated → IRRELEVANT
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

export type DecisionReason =
  | 'entailment'
  | 'contradiction'
  | 'neutral_but_story_related'
  | 'neutral_and_unrelated'
  | 'weak_nli_but_story_related'
  | 'no_evidence'
  | 'empty_question'
  | 'ssr';

export interface NLIJudgeResult {
  label: JudgeResult;
  rawLabel: 'entailment' | 'contradiction' | 'neutral';
  confidence: number;
  evidence: Evidence[];
  selectedEvidence?: Evidence;
  entailmentScore: number;
  contradictionScore: number;
  neutralScore: number;
  bestAnswerSimilarity: number;
  bestContentSimilarity: number;
  relatedToStory: boolean;
  decisionReason: DecisionReason;
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
  entailmentScore?: number;
  contradictionScore?: number;
  neutralScore?: number;
  bestAnswerSimilarity?: number;
  bestContentSimilarity?: number;
  relatedToStory?: boolean;
  decisionReason?: string;
  evidence?: string;
  retrievalSimilarity?: number;
  inferenceMs?: number;
}

// ─── Config ──────────────────────────────────────────────────

export const V10_CONFIG = {
  TOP_K: 3,
  /** NLI에 넣을 evidence 최소 유사도 (너무 약한 문장은 제외) */
  MIN_RETRIEVAL_SIMILARITY: 0.20,

  MIN_ENTAILMENT_CONFIDENCE: 0.60,
  MIN_CONTRADICTION_CONFIDENCE: 0.55,

  /** Story relevance: answer/content embedding max sim */
  RELATED_ANSWER_THRESHOLD: 0.32,
  RELATED_CONTENT_THRESHOLD: 0.32,

  /** Top evidence 유사도가 이 이상이면 관련으로 보조 판단 */
  RELATED_EVIDENCE_THRESHOLD: 0.30,

  MIN_DECISION_MARGIN: 0.08,

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
        // WebGPU not available → WASM
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

// ─── Text utilities ──────────────────────────────────────────

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

function questionToHypothesis(question: string): string {
  let h = normalizeText(question);
  h = h.replace(/\?+$/g, '');
  h = h.replace(/(인가요|인가|인지요|인지|입니까|습니까|나요|세요|할까요|할까|인건가요|인건가|건가요|건가|는가요|는가|은가요|은가)[\s.?!]*$/g, '');
  h = h.replace(/(했나요|했습니까|했는가|했을까요|했을까|됐나요|됐습니까|있나요|있습니까|있는가|었나요|었습니까|였나요|였습니까)[\s.?!]*$/g, '');
  return h.trim();
}

// ─── Evidence Retrieval ──────────────────────────────────────

interface RetrievalResult {
  evidence: Evidence[];
  bestAnswerSimilarity: number;
  bestContentSimilarity: number;
}

async function retrieveEvidence(
  question: string,
  knowledge: ProblemKnowledge,
  topK: number = V10_CONFIG.TOP_K
): Promise<RetrievalResult> {
  const contentSentences = splitSentences(knowledge.content || '');
  const answerSentences = splitSentences(knowledge.answer || '');

  if (contentSentences.length === 0 && answerSentences.length === 0) {
    return { evidence: [], bestAnswerSimilarity: 0, bestContentSimilarity: 0 };
  }

  const questionVec = await getEmbedding(question);
  const allCandidates: Evidence[] = [];
  let bestAnswerSimilarity = 0;
  let bestContentSimilarity = 0;

  for (const s of contentSentences) {
    try {
      const vec = await getEmbedding(s);
      const sim = cosineSimilarity(questionVec, vec);
      bestContentSimilarity = Math.max(bestContentSimilarity, sim);
      allCandidates.push({ text: s, similarity: sim, source: 'content' });
    } catch { /* skip */ }
  }

  for (const s of answerSentences) {
    try {
      const vec = await getEmbedding(s);
      const sim = cosineSimilarity(questionVec, vec);
      bestAnswerSimilarity = Math.max(bestAnswerSimilarity, sim);
      allCandidates.push({ text: s, similarity: sim, source: 'answer' });
    } catch { /* skip */ }
  }

  allCandidates.sort((a, b) => b.similarity - a.similarity);

  const evidence = allCandidates
    .filter((e) => e.similarity >= V10_CONFIG.MIN_RETRIEVAL_SIMILARITY)
    .slice(0, topK);

  // NLI용 evidence가 비어도 top1은 남겨 두면 약한 관련성 판단에 도움
  if (evidence.length === 0 && allCandidates.length > 0) {
    evidence.push(allCandidates[0]);
  }

  return { evidence, bestAnswerSimilarity, bestContentSimilarity };
}

function isRelatedToStory(
  bestAnswerSimilarity: number,
  bestContentSimilarity: number,
  topEvidenceSim: number
): boolean {
  return (
    bestAnswerSimilarity >= V10_CONFIG.RELATED_ANSWER_THRESHOLD ||
    bestContentSimilarity >= V10_CONFIG.RELATED_CONTENT_THRESHOLD ||
    topEvidenceSim >= V10_CONFIG.RELATED_EVIDENCE_THRESHOLD
  );
}

// ─── NLI classification ──────────────────────────────────────

interface NLIScores {
  entailment: number;
  contradiction: number;
  neutral: number;
}

async function runNLI(premise: string, hypothesis: string): Promise<NLIScores> {
  const classifier = await getNLIPipeline();

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

// ─── Decision policy ─────────────────────────────────────────

function decideLabel(args: {
  bestEntailment: number;
  bestContradiction: number;
  bestNeutral: number;
  relatedToStory: boolean;
}): { label: JudgeResult; rawLabel: 'entailment' | 'contradiction' | 'neutral'; confidence: number; reason: DecisionReason } {
  const { bestEntailment, bestContradiction, bestNeutral, relatedToStory } = args;

  const marginOk =
    bestEntailment - Math.max(bestContradiction, bestNeutral) >= V10_CONFIG.MIN_DECISION_MARGIN ||
    bestEntailment >= V10_CONFIG.MIN_ENTAILMENT_CONFIDENCE + 0.05;

  // 1) Entailment → YES
  if (
    bestEntailment >= V10_CONFIG.MIN_ENTAILMENT_CONFIDENCE &&
    bestEntailment > bestContradiction &&
    marginOk
  ) {
    return {
      label: 'yes',
      rawLabel: 'entailment',
      confidence: bestEntailment,
      reason: 'entailment',
    };
  }

  // 2) Contradiction → NO
  if (
    bestContradiction >= V10_CONFIG.MIN_CONTRADICTION_CONFIDENCE &&
    bestContradiction >= bestEntailment
  ) {
    return {
      label: 'no',
      rawLabel: 'contradiction',
      confidence: bestContradiction,
      reason: 'contradiction',
    };
  }

  // 3) Neutral / weak NLI → Story relevance
  const rawLabel: 'entailment' | 'contradiction' | 'neutral' =
    bestNeutral >= bestEntailment && bestNeutral >= bestContradiction
      ? 'neutral'
      : bestContradiction >= bestEntailment
        ? 'contradiction'
        : 'entailment';

  const confidence = Math.max(bestEntailment, bestContradiction, bestNeutral);

  if (relatedToStory) {
    return {
      label: 'no',
      rawLabel,
      confidence,
      reason: rawLabel === 'neutral' ? 'neutral_but_story_related' : 'weak_nli_but_story_related',
    };
  }

  return {
    label: 'irrelevant',
    rawLabel,
    confidence,
    reason: 'neutral_and_unrelated',
  };
}

// ─── Main V10 judge ──────────────────────────────────────────

export async function judgeQuestionV10(
  questionRaw: string,
  knowledge: ProblemKnowledge
): Promise<NLIJudgeResult> {
  const startMs = performance.now();

  if (typeof window === 'undefined') {
    return makeResult({
      label: 'irrelevant',
      rawLabel: 'neutral',
      confidence: 0,
      evidence: [],
      entailmentScore: 0,
      contradictionScore: 0,
      neutralScore: 0,
      bestAnswerSimilarity: 0,
      bestContentSimilarity: 0,
      relatedToStory: false,
      decisionReason: 'ssr',
      invert: false,
      inferenceMs: 0,
    });
  }

  const q0 = normalizeText(questionRaw);
  if (!q0 || q0.length < 4) {
    return makeResult({
      label: 'irrelevant',
      rawLabel: 'neutral',
      confidence: 0,
      evidence: [],
      entailmentScore: 0,
      contradictionScore: 0,
      neutralScore: 0,
      bestAnswerSimilarity: 0,
      bestContentSimilarity: 0,
      relatedToStory: false,
      decisionReason: 'empty_question',
      invert: false,
      inferenceMs: performance.now() - startMs,
    });
  }

  if (!knowledge.content && !knowledge.answer) {
    return makeResult({
      label: 'irrelevant',
      rawLabel: 'neutral',
      confidence: 0,
      evidence: [],
      entailmentScore: 0,
      contradictionScore: 0,
      neutralScore: 0,
      bestAnswerSimilarity: 0,
      bestContentSimilarity: 0,
      relatedToStory: false,
      decisionReason: 'no_evidence',
      invert: false,
      inferenceMs: performance.now() - startMs,
    });
  }

  const { normalized: qNorm, invert } = normalizeNegationQuestion(q0);
  const hypothesis = questionToHypothesis(qNorm);

  await initEmbeddingModel();

  const { evidence, bestAnswerSimilarity, bestContentSimilarity } = await retrieveEvidence(
    qNorm,
    knowledge,
    V10_CONFIG.TOP_K
  );

  const topEvidenceSim = evidence[0]?.similarity ?? 0;
  const relatedToStory = isRelatedToStory(
    bestAnswerSimilarity,
    bestContentSimilarity,
    topEvidenceSim
  );

  if (evidence.length === 0) {
    // evidence 없음 → 관련성만으로 보수적 판단
    const label: JudgeResult = relatedToStory ? 'no' : 'irrelevant';
    return makeResult({
      label,
      rawLabel: 'neutral',
      confidence: 0,
      evidence: [],
      entailmentScore: 0,
      contradictionScore: 0,
      neutralScore: 0,
      bestAnswerSimilarity,
      bestContentSimilarity,
      relatedToStory,
      decisionReason: relatedToStory ? 'weak_nli_but_story_related' : 'no_evidence',
      invert,
      inferenceMs: performance.now() - startMs,
    });
  }

  // NLI: 가중 점수 = nliConfidence * retrievalSimilarity
  let bestEntailment = 0;
  let bestContradiction = 0;
  let bestNeutral = 0;
  let bestEvidence: Evidence | undefined = evidence[0];
  let rawEntail = 0;
  let rawContra = 0;
  let rawNeutral = 0;

  for (const ev of evidence) {
    try {
      const nliScores = await runNLI(ev.text, hypothesis);

      const wEntail = nliScores.entailment * ev.similarity;
      const wContra = nliScores.contradiction * ev.similarity;
      const wNeutral = nliScores.neutral * ev.similarity;

      if (wEntail > bestEntailment) {
        bestEntailment = wEntail;
        rawEntail = nliScores.entailment;
        if (wEntail >= bestContradiction && wEntail >= bestNeutral) bestEvidence = ev;
      }
      if (wContra > bestContradiction) {
        bestContradiction = wContra;
        rawContra = nliScores.contradiction;
        if (wContra > bestEntailment && wContra >= bestNeutral) bestEvidence = ev;
      }
      if (wNeutral > bestNeutral) {
        bestNeutral = wNeutral;
        rawNeutral = nliScores.neutral;
        if (wNeutral > bestEntailment && wNeutral > bestContradiction) bestEvidence = ev;
      }
    } catch (e) {
      console.warn('[V10] NLI inference error for evidence:', e);
    }
  }

  // 판정에는 raw NLI confidence도 함께 고려 (가중치만으로 threshold가 과소 평가되는 것 방지)
  // → max(weighted, raw * topEvidenceSim) 형태로 안정화
  const entailForDecision = Math.max(bestEntailment, rawEntail * Math.max(topEvidenceSim, 0.5));
  const contraForDecision = Math.max(bestContradiction, rawContra * Math.max(topEvidenceSim, 0.5));
  const neutralForDecision = Math.max(bestNeutral, rawNeutral * Math.max(topEvidenceSim, 0.5));

  let decision = decideLabel({
    bestEntailment: entailForDecision,
    bestContradiction: contraForDecision,
    bestNeutral: neutralForDecision,
    relatedToStory,
  });

  // negation invert: YES ↔ NO, IRRELEVANT 유지
  let label = decision.label;
  if (invert) {
    if (label === 'yes') label = 'no';
    else if (label === 'no') label = 'yes';
  }

  return makeResult({
    label,
    rawLabel: decision.rawLabel,
    confidence: decision.confidence,
    evidence,
    selectedEvidence: bestEvidence,
    entailmentScore: entailForDecision,
    contradictionScore: contraForDecision,
    neutralScore: neutralForDecision,
    bestAnswerSimilarity,
    bestContentSimilarity,
    relatedToStory,
    decisionReason: decision.reason,
    invert,
    inferenceMs: performance.now() - startMs,
  });
}

function makeResult(partial: Omit<NLIJudgeResult, 'model'>): NLIJudgeResult {
  return {
    ...partial,
    model: V10_CONFIG.NLI_MODEL_ID,
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
        `NLI:\n` +
        `  raw: ${log.nliLabel ?? '-'}\n` +
        `  entailment: ${log.entailmentScore?.toFixed(3) ?? '-'}\n` +
        `  contradiction: ${log.contradictionScore?.toFixed(3) ?? '-'}\n` +
        `  neutral: ${log.neutralScore?.toFixed(3) ?? '-'}\n\n` +
        `Answer similarity: ${log.bestAnswerSimilarity?.toFixed(3) ?? '-'}\n` +
        `Content similarity: ${log.bestContentSimilarity?.toFixed(3) ?? '-'}\n` +
        `relatedToStory: ${log.relatedToStory ?? '-'}\n\n` +
        (log.evidence ? `Evidence:\n${log.evidence}\n\n` : '') +
        `Final: ${log.v10Result?.toUpperCase()}\n` +
        `Reason: ${log.decisionReason ?? '-'}\n` +
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
      entailmentScore: v10Result.entailmentScore,
      contradictionScore: v10Result.contradictionScore,
      neutralScore: v10Result.neutralScore,
      bestAnswerSimilarity: v10Result.bestAnswerSimilarity,
      bestContentSimilarity: v10Result.bestContentSimilarity,
      relatedToStory: v10Result.relatedToStory,
      decisionReason: v10Result.decisionReason,
      evidence: v10Result.selectedEvidence?.text,
      retrievalSimilarity: v10Result.selectedEvidence?.similarity,
      inferenceMs: v10Result.inferenceMs,
    });
  } catch (e) {
    console.warn('[V10] Comparison failed, V9 result used:', e);
  }

  return { v9: v9Result, v10: v10Result };
}

export async function initializeV10(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await getNLIPipeline();
  } catch (e) {
    console.warn('[V10] NLI model initialization failed:', e);
  }
}
