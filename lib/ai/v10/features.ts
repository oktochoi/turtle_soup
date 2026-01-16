/**
 * V10 Feature Extractor
 * V9 분석 과정에서 feature를 추출하여 classifier 입력으로 변환
 */

import { ProblemKnowledge } from '../../ai-analyzer';
import { V10Features } from './types';
// Note: Most functions are internal to ai-analyzer.ts, so we'll import what we need
// For now, we'll pass the necessary data from analyzer.ts instead of importing directly

/**
 * Decision path encoding (V9의 판정 경로를 숫자로 인코딩)
 */
function encodeDecisionPathV9(
  simAnswerFinal: number,
  simContentFinal: number,
  hasStrongAntonymMismatch: boolean,
  conceptMatched: boolean,
  taxonomyHit: boolean
): number {
  // 간단한 인코딩: 여러 조건을 조합하여 0~1 범위로 정규화
  let encoded = 0;
  
  // Similarity 기반 (0~0.4)
  encoded += Math.min(0.4, (simAnswerFinal + simContentFinal) / 2 * 0.4);
  
  // Antonym mismatch (0~0.2)
  if (hasStrongAntonymMismatch) encoded += 0.2;
  
  // Concept match (0~0.2)
  if (conceptMatched) encoded += 0.1;
  
  // Taxonomy hit (0~0.2)
  if (taxonomyHit) encoded += 0.1;
  
  return Math.min(1.0, encoded);
}

/**
 * Extract V10 features from question and knowledge
 * Note: This function receives pre-computed values from analyzer.ts to avoid circular dependencies
 */
export function extractFeaturesV10(
  question: string,
  knowledge: ProblemKnowledge,
  v9Intermediate: {
    simAnswerMaxRaw: number;
    simContentMaxRaw: number;
    simAnswerAvg: number;
    simContentAvg: number;
    simAnswerFinal: number;
    simContentFinal: number;
    qConceptsExact: Set<string>;
    qConceptsExpanded: Set<string>;
    aConcepts: Set<string>;
    hasStrongAntonymMismatch: boolean;
    signalCount: number;
    force: { forceNo: boolean; taxonomyHit: boolean; taxonomyBonus: number };
    questionVec: Float32Array;
    answerTop: string[];
    contentTop: string[];
    invert: boolean;
    tokenCommonRatio: number; // Pre-computed
    domainMatchRatio: number; // Pre-computed
    hasNegation: boolean; // Pre-computed
    hasModality: boolean; // Pre-computed
    quantityMismatch: number; // Pre-computed (0 or 1)
  }
): V10Features {
  const q = question.toLowerCase();

  // Concept hit counts
  const exactConceptHitCount = [...v9Intermediate.qConceptsExact].filter(c => 
    v9Intermediate.aConcepts.has(c)
  ).length;
  const expandedConceptHitCount = [...v9Intermediate.qConceptsExpanded].filter(c => 
    v9Intermediate.aConcepts.has(c)
  ).length;

  // Question properties (use pre-computed values)
  const hasNegationFlag = v9Intermediate.hasNegation ? 1 : 0;
  const hasModalityFlag = v9Intermediate.hasModality ? 1 : 0;
  const questionLen = Math.min(1.0, question.length / 420); // Normalized (MAX_QUESTION_LEN)

  // Antonym signal count (normalized)
  const antonymSignalCountNorm = Math.min(1.0, v9Intermediate.signalCount / 3.0);

  // Ontology features (use pre-computed value)
  const quantityMismatchFlag = v9Intermediate.quantityMismatch;
  const taxonomyHitFlag = v9Intermediate.force.taxonomyHit ? 1 : 0;
  const forceNoTriggeredFlag = v9Intermediate.force.forceNo ? 1 : 0;

  // Decision path encoding
  const conceptMatched = exactConceptHitCount > 0;
  const decisionPathV9 = encodeDecisionPathV9(
    v9Intermediate.simAnswerFinal,
    v9Intermediate.simContentFinal,
    v9Intermediate.hasStrongAntonymMismatch,
    conceptMatched,
    v9Intermediate.force.taxonomyHit
  );

  // Pair embeddings will be calculated separately and merged
  // For now, set to 0 (will be filled by pair embedding function)
  const simQA = 0;
  const simQC = 0;

  return {
    simAnswerMaxRaw: Math.max(0, Math.min(1, v9Intermediate.simAnswerMaxRaw)),
    simContentMaxRaw: Math.max(0, Math.min(1, v9Intermediate.simContentMaxRaw)),
    simAnswerAvg: Math.max(0, Math.min(1, v9Intermediate.simAnswerAvg)),
    simContentAvg: Math.max(0, Math.min(1, v9Intermediate.simContentAvg)),
    simQA,
    simQC,
    tokenCommonRatio: Math.max(0, Math.min(1, v9Intermediate.tokenCommonRatio)),
    domainMatchRatio: Math.max(0, Math.min(1, v9Intermediate.domainMatchRatio)),
    exactConceptHitCount: Math.min(1.0, exactConceptHitCount / 10.0), // Normalized
    expandedConceptHitCount: Math.min(1.0, expandedConceptHitCount / 20.0), // Normalized
    hasNegation: hasNegationFlag,
    hasModality: hasModalityFlag,
    questionLen,
    antonymSignalCount: antonymSignalCountNorm,
    quantityMismatch: quantityMismatchFlag,
    taxonomyHit: taxonomyHitFlag,
    forceNoTriggered: forceNoTriggeredFlag,
    decisionPathV9,
  };
}

/**
 * Feature vector to array (for classifier input)
 */
export function featuresToArray(features: V10Features): number[] {
  return [
    features.simAnswerMaxRaw,
    features.simContentMaxRaw,
    features.simAnswerAvg,
    features.simContentAvg,
    features.simQA,
    features.simQC,
    features.tokenCommonRatio,
    features.domainMatchRatio,
    features.exactConceptHitCount,
    features.expandedConceptHitCount,
    features.hasNegation,
    features.hasModality,
    features.questionLen,
    features.antonymSignalCount,
    features.quantityMismatch,
    features.taxonomyHit,
    features.forceNoTriggered,
    features.decisionPathV9,
  ];
}

/**
 * Feature names (for debugging)
 */
export const FEATURE_NAMES = [
  'simAnswerMaxRaw',
  'simContentMaxRaw',
  'simAnswerAvg',
  'simContentAvg',
  'simQA',
  'simQC',
  'tokenCommonRatio',
  'domainMatchRatio',
  'exactConceptHitCount',
  'expandedConceptHitCount',
  'hasNegation',
  'hasModality',
  'questionLen',
  'antonymSignalCount',
  'quantityMismatch',
  'taxonomyHit',
  'forceNoTriggered',
  'decisionPathV9',
] as const;

