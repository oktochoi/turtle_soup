/**
 * V10 AI 질문 분석기
 * 확률 기반 분류기로 판정하는 새로운 버전
 */

import {
  JudgeResult,
  ProblemKnowledge,
  analyzeQuestionV8,
  getEmbedding,
  selectTopKSentences,
  mapWithConcurrency,
  maxSimilarity,
  avgSimilarity,
  extractQuestionConceptsV9,
  extractAnswerConcepts,
  detectAntonymMismatchByTextV9,
  detectAntonymMismatchByConceptsV9,
  detectAntonymMismatchByLexiconV9,
  antonymSignalCount,
  shouldForceNoByOntologyV9,
  hasQuantityMismatch,
  normalizeNegationQuestion,
  detectContextualMismatch,
  calculateTokenCommonRatio,
} from '../../ai-analyzer';

/**
 * V10 Config (copied from ai-analyzer.ts CONFIG)
 */
const   V10_CONFIG = {
  TOP_K_CONTENT: 16,
  TOP_K_ANSWER: 16,
  EMBEDDING_CONCURRENCY: 4,
  MIN_QUESTION_LEN: 4,
  MAX_QUESTION_LEN: 420,
  LEXICON: {
    MIN_TOKEN_LEN: 2,
    MAX_TOKENS: 120,
  },
  V9: {
    ANTONYM_REQUIRE_SIGNALS: 2, // text/concept/lexicon 중 2개 이상일 때만 강한 mismatch
  },
};

/**
 * Helper: Normalize text (copied from ai-analyzer.ts)
 */
function normalizeText(text: string): string {
  return (text ?? "")
    .replace(/\u200B/g, "")
    .replace(/[\u200C\u200D\uFEFF]/g, "")
    .replace(/[""'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Helper: Rough stem Korean token (copied from ai-analyzer.ts)
 */
function roughStemKo(token: string): string {
  let t = token.trim();
  if (!t) return t;

  t = t.replace(/[.,!?;:()[\]{}<>~`@#$%^&*_+=|\\/]/g, "");

  t = t.replace(
    /(으로|로|에서|에게|께|한테|부터|까지|보다|처럼|같이|만|도|는|은|이|가|을|를|의|와|과|랑|하고|나|이나|거나|라도|든지|조차|마저)$/g,
    ""
  );

  t = t.replace(
    /(했나요|했니|했어|했지|했습니까|합니까|인가요|인가|인가\?|나요|니|냐|죠|지|요|다|음)$/g,
    ""
  );

  return t;
}

/**
 * Helper: Tokenize Korean (copied from ai-analyzer.ts)
 */
function tokenizeKo(text: string): string[] {
  const t = normalizeText(text).toLowerCase();
  if (!t) return [];
  const raw = t.split(/\s+/).filter(Boolean);

  const tokens: string[] = [];
  for (const r of raw) {
    const s = roughStemKo(r);
    if (!s) continue;
    if (s.length < V10_CONFIG.LEXICON.MIN_TOKEN_LEN) continue;
    tokens.push(s);
  }
  return tokens.slice(0, V10_CONFIG.LEXICON.MAX_TOKENS);
}

/**
 * Helper: Tokenize English (copied from ai-analyzer.ts)
 */
function tokenizeEn(text: string): string[] {
  const t = normalizeText(text).toLowerCase();
  if (!t) return [];
  const raw = t.split(/\s+/).filter(Boolean);

  const tokens: string[] = [];
  for (const r of raw) {
    const cleaned = r.replace(/[.,!?;:()[\]{}<>~`@#$%^&*_+=|\\/]/g, "");
    if (!cleaned) continue;
    if (cleaned.length < V10_CONFIG.LEXICON.MIN_TOKEN_LEN) continue;
    tokens.push(cleaned);
  }
  return tokens.slice(0, V10_CONFIG.LEXICON.MAX_TOKENS);
}

/**
 * Helper: Canonical concept map (simplified version)
 */
const CANONICAL_MAP = new Map<string, string>([
  ["살인자", "killer"],
  ["범인", "culprit"],
  ["가해자", "culprit"],
  ["killer", "killer"],
  ["culprit", "culprit"],
  ["사람", "person"],
  ["person", "person"],
  ["집", "home"],
  ["home", "home"],
  ["학교", "school"],
  ["school", "school"],
]);

/**
 * Helper: To canonical (copied from ai-analyzer.ts)
 */
function toCanonical(token: string): string {
  return CANONICAL_MAP.get(token) ?? token;
}

/**
 * Helper: Calculate domain match ratio
 */
function calculateDomainMatchRatio(question: string, knowledge: ProblemKnowledge): number {
  const qTokens = new Set([...tokenizeKo(question), ...tokenizeEn(question)]);
  const problemDomainKeywords = new Set([
    ...knowledge.contentTokens.slice(0, 20),
    ...knowledge.answerTokens.slice(0, 10),
  ]);
  const questionDomainMatch = [...qTokens].filter(t => 
    problemDomainKeywords.has(t) || 
    problemDomainKeywords.has(toCanonical(t)) ||
    [...problemDomainKeywords].some(pt => t.includes(pt) || pt.includes(t))
  ).length;
  return qTokens.size > 0 ? questionDomainMatch / qTokens.size : 0;
}

/**
 * Helper: Check if question has negation
 */
function hasNegation(text: string): boolean {
  const negationPatterns = [
    /지\s*않/, /지않/, /안\s/, /못\s/, /없/, /\bnot\b/, /\bnever\b/, /\bno\b/,
    /\bcan't\b/, /\bcannot\b/, /\bdon't\b/, /\bdidn't\b/, /\bisn't\b/, /\baren't\b/,
    /\bwasn't\b/, /\bweren't\b/
  ];
  return negationPatterns.some(pattern => pattern.test(text));
}

/**
 * Helper: Check if question has modality
 */
function hasModality(text: string): boolean {
  const modalityPatterns = [
    /할 수/, /할까/, /해야/, /해야 할/, /해야 하는/, /해야 한다/, /해야 합니다/,
    /해야 했/, /해야 했던/, /해야 했습니다/, /해야 했어/, /해야 했어요/,
    /해야 했어야/, /해야 했어야 했/, /해야 했어야 했던/, /해야 했어야 했습니다/,
    /해야 했어야 했어/, /해야 했어야 했어요/, /해야 했어야 했어야/,
    /can/, /should/, /must/, /might/, /may/, /could/, /would/
  ];
  return modalityPatterns.some(pattern => pattern.test(text));
}
import { V10AnalysisResult, V10Features } from './types';
import { extractFeaturesV10, featuresToArray } from './features';
import { calculatePairEmbeddings } from './pair-embedding';
import { classifyV10 } from './classifier';

/**
 * Hard guard rules (V10에서도 유지)
 */
function checkHardGuards(
  question: string,
  knowledge: ProblemKnowledge,
  simAnswerRaw: number,
  hasStrongAntonymMismatch: boolean,
  invert: boolean
): { triggered: string[]; forceResult: JudgeResult | null } {
  const triggered: string[] = [];
  let forceResult: JudgeResult | null = null;

  // HARD1: quantityMismatch == true 이면 결과는 무조건 no (invert 적용)
  if (hasQuantityMismatch(question, knowledge.answer, knowledge.quantityPatterns)) {
    triggered.push('HARD1: quantityMismatch');
    forceResult = invert ? 'yes' : 'no';
  }

  // HARD2: strong antonym mismatch AND simAnswerRaw >= 0.75이면 no (invert 적용)
  if (hasStrongAntonymMismatch && simAnswerRaw >= 0.75) {
    triggered.push('HARD2: strongAntonymMismatch_highSim');
    forceResult = invert ? 'yes' : 'no';
  }

  return { triggered, forceResult };
}

/**
 * V10 Main Analysis Function
 */
export async function analyzeQuestionV10(
  questionRaw: string,
  knowledge: ProblemKnowledge
): Promise<V10AnalysisResult> {
  // Early returns (same as V9)
  if (!questionRaw || typeof questionRaw !== "string") {
    return createIrrelevantResult(questionRaw, knowledge);
  }

  const q0 = normalizeText(questionRaw);
  if (q0.length < V10_CONFIG.MIN_QUESTION_LEN) {
    return createIrrelevantResult(questionRaw, knowledge);
  }

  const qCut = q0.length > V10_CONFIG.MAX_QUESTION_LEN ? q0.slice(0, V10_CONFIG.MAX_QUESTION_LEN) : q0;

  if (typeof window === "undefined") {
    return createIrrelevantResult(questionRaw, knowledge);
  }

  if (!knowledge.content && !knowledge.answer) {
    return createIrrelevantResult(questionRaw, knowledge);
  }

  // 0) Negation normalize
  const { normalized: q, invert } = normalizeNegationQuestion(qCut);

  // 1) Concepts
  const { qConceptsExact, qConceptsExpanded } = await extractQuestionConceptsV9(q, knowledge);
  const aConcepts = extractAnswerConcepts(knowledge);

  // 2) Antonym/Contradiction check
  const antiText = detectAntonymMismatchByTextV9(q, knowledge.answer, knowledge.antonymAxes);
  const antiConcept = detectAntonymMismatchByConceptsV9(qConceptsExact, aConcepts, knowledge.antonymAxes, q, knowledge.answer);
  const antiLex = detectAntonymMismatchByLexiconV9(q, knowledge.answer, knowledge.antonymLexicon);
  const signalCount = antonymSignalCount({ antiText, antiConcept, antiLex });
  const hasStrongAntonymMismatch = signalCount >= V10_CONFIG.V9.ANTONYM_REQUIRE_SIGNALS;

  // 3) Force NO check
  const force = shouldForceNoByOntologyV9({ question: q, qConcepts: qConceptsExact, aConcepts, knowledge });

  // 4) Embeddings (V9 style)
  const questionVec = await getEmbedding(q);
  const contentTop = knowledge.content ? selectTopKSentences(q, knowledge.contentSentences, V10_CONFIG.TOP_K_CONTENT) : [];
  const answerTop = knowledge.answer ? selectTopKSentences(q, knowledge.answerSentences, V10_CONFIG.TOP_K_ANSWER) : [];

  const [contentVecs, answerVecs] = await Promise.all([
    mapWithConcurrency(contentTop, V10_CONFIG.EMBEDDING_CONCURRENCY, getEmbedding),
    mapWithConcurrency(answerTop, V10_CONFIG.EMBEDDING_CONCURRENCY, getEmbedding),
  ]);

  const simContentMaxRaw = contentVecs.length ? maxSimilarity(questionVec, contentVecs) : 0;
  const simAnswerMaxRaw = answerVecs.length ? maxSimilarity(questionVec, answerVecs) : 0;
  const simContentAvg = contentVecs.length ? avgSimilarity(questionVec, contentVecs) : 0;
  const simAnswerAvg = answerVecs.length ? avgSimilarity(questionVec, answerVecs) : 0;

  // 5) Pair Embeddings (V10 추가)
  const pairEmbeddings = await calculatePairEmbeddings(q, knowledge, questionVec);

  // 6) Hard Guards 체크
  const hardGuards = checkHardGuards(q, knowledge, simAnswerMaxRaw, hasStrongAntonymMismatch, invert);
  if (hardGuards.forceResult) {
    return createHardGuardResult(
      questionRaw,
      knowledge,
      hardGuards.forceResult,
      hardGuards.triggered,
      {
        simAnswerMaxRaw,
        simContentMaxRaw,
        simAnswerAvg,
        simContentAvg,
        qConceptsExact,
        qConceptsExpanded,
        aConcepts,
        hasStrongAntonymMismatch,
        signalCount,
        force,
        questionVec,
        answerTop,
        contentTop,
        invert,
        simAnswerFinal: simAnswerMaxRaw,
        simContentFinal: simContentMaxRaw,
      },
      pairEmbeddings
    );
  }

  // 7) V9 baseline 계산 (for comparison)
  const v9Result = await analyzeQuestionV8(questionRaw, knowledge);
  
  // V9의 final similarity 계산 (간략화)
  let simAnswerFinal = simAnswerMaxRaw;
  let simContentFinal = simContentMaxRaw;
  // 간단한 보정 (실제로는 V9의 전체 로직을 따라야 하지만, 여기서는 근사치)
  if (hasStrongAntonymMismatch) {
    simAnswerFinal = Math.max(0, simAnswerFinal - 0.3);
  }
  const conceptMatched = [...qConceptsExact].some(c => aConcepts.has(c));
  if (conceptMatched) {
    simAnswerFinal = Math.min(1, simAnswerFinal + 0.1);
  }
  if (force.taxonomyHit) {
    simAnswerFinal = Math.min(1, simAnswerFinal + 0.1);
  }
  simAnswerFinal = simAnswerFinal * 0.7 + simAnswerAvg * 0.3;
  simContentFinal = simContentFinal * 0.7 + simContentAvg * 0.3;

  // 8) Calculate additional features needed for V10
  const tokenCommonRatio = calculateTokenCommonRatio(q, knowledge);
  const domainMatchRatio = calculateDomainMatchRatio(q, knowledge);
  const hasNegationFlag = hasNegation(q);
  const hasModalityFlag = hasModality(q);
  const quantityMismatchFlag = hasQuantityMismatch(q, knowledge.answer, knowledge.quantityPatterns) ? 1 : 0;

  // 9) Feature Extraction
  const features = extractFeaturesV10(q, knowledge, {
    simAnswerMaxRaw,
    simContentMaxRaw,
    simAnswerAvg,
    simContentAvg,
    simAnswerFinal,
    simContentFinal,
    qConceptsExact,
    qConceptsExpanded,
    aConcepts,
    hasStrongAntonymMismatch,
    signalCount,
    force,
    questionVec,
    answerTop,
    contentTop,
    invert,
    tokenCommonRatio,
    domainMatchRatio,
    hasNegation: hasNegationFlag,
    hasModality: hasModalityFlag,
    quantityMismatch: quantityMismatchFlag,
  });

  // 10) Update features with pair embeddings
  features.simQA = pairEmbeddings.simQA;
  features.simQC = pairEmbeddings.simQC;

  // 11) Classifier
  const featureArray = featuresToArray(features);
  const classifierOutput = await classifyV10(featureArray);

  // 12) Apply invert if needed
  let finalLabel = classifierOutput.label;
  if (invert && (finalLabel === "yes" || finalLabel === "no")) {
    finalLabel = finalLabel === "yes" ? "no" : "yes";
  }

  // 13) Build result
  return {
    labelV10: finalLabel,
    confidence: classifierOutput.confidence,
    probs: classifierOutput.probs,
    hardGuardsTriggered: hardGuards.triggered,
    features,
    embeddings: {
      simAnswerRaw: simAnswerMaxRaw,
      simContentRaw: simContentMaxRaw,
      simQA: pairEmbeddings.simQA,
      simQC: pairEmbeddings.simQC,
    },
    v9Baseline: {
      labelV9: v9Result,
      simAnswerFinal,
      simContentFinal,
    },
  };
}

/**
 * Helper: Create irrelevant result
 */
function createIrrelevantResult(
  questionRaw: string,
  knowledge: ProblemKnowledge
): V10AnalysisResult {
  return {
    labelV10: 'irrelevant',
    confidence: 1.0,
    probs: { yes: 0, no: 0, irrelevant: 1 },
    hardGuardsTriggered: [],
    features: createEmptyFeatures(),
    embeddings: { simAnswerRaw: 0, simContentRaw: 0, simQA: 0, simQC: 0 },
    v9Baseline: { labelV9: 'irrelevant', simAnswerFinal: 0, simContentFinal: 0 },
  };
}

/**
 * Helper: Create hard guard result
 */
function createHardGuardResult(
  questionRaw: string,
  knowledge: ProblemKnowledge,
  forceResult: JudgeResult,
  triggered: string[],
  v9Intermediate: any,
  pairEmbeddings: { simQA: number; simQC: number }
): V10AnalysisResult {
  const features = createEmptyFeatures();
  return {
    labelV10: forceResult,
    confidence: 1.0,
    probs: {
      yes: forceResult === 'yes' ? 1 : 0,
      no: forceResult === 'no' ? 1 : 0,
      irrelevant: forceResult === 'irrelevant' ? 1 : 0,
    },
    hardGuardsTriggered: triggered,
    features,
    embeddings: {
      simAnswerRaw: v9Intermediate.simAnswerMaxRaw,
      simContentRaw: v9Intermediate.simContentMaxRaw,
      simQA: pairEmbeddings.simQA,
      simQC: pairEmbeddings.simQC,
    },
    v9Baseline: {
      labelV9: forceResult,
      simAnswerFinal: v9Intermediate.simAnswerFinal,
      simContentFinal: v9Intermediate.simContentFinal,
    },
  };
}

/**
 * Helper: Create empty features
 */
function createEmptyFeatures(): V10Features {
  return {
    simAnswerMaxRaw: 0,
    simContentMaxRaw: 0,
    simAnswerAvg: 0,
    simContentAvg: 0,
    simQA: 0,
    simQC: 0,
    tokenCommonRatio: 0,
    domainMatchRatio: 0,
    exactConceptHitCount: 0,
    expandedConceptHitCount: 0,
    hasNegation: 0,
    hasModality: 0,
    questionLen: 0,
    antonymSignalCount: 0,
    quantityMismatch: 0,
    taxonomyHit: 0,
    forceNoTriggered: 0,
    decisionPathV9: 0,
  };
}

/**
 * Compatibility wrapper (V9 API 유지)
 */
export async function analyzeQuestionSemanticV10(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<JudgeResult> {
  const { buildProblemKnowledge } = await import('../../ai-analyzer');
  const knowledge = await buildProblemKnowledge(problemContent, problemAnswer);
  const result = await analyzeQuestionV10(question, knowledge);
  return result.labelV10;
}

