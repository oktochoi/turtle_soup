/**
 * V10 AI 질문 분석기 타입 정의
 */

import { JudgeResult, ProblemKnowledge } from '../../ai-analyzer';

/**
 * V10 Feature Vector
 */
export interface V10Features {
  // Embedding similarities
  simAnswerMaxRaw: number;
  simContentMaxRaw: number;
  simAnswerAvg: number;
  simContentAvg: number;
  simQA: number; // Pair embedding: Q||A vs A
  simQC: number; // Pair embedding: Q||C vs C

  // Token/Concept features
  tokenCommonRatio: number;
  domainMatchRatio: number;
  exactConceptHitCount: number;
  expandedConceptHitCount: number;

  // Question properties
  hasNegation: number; // 0 or 1
  hasModality: number; // 0 or 1
  questionLen: number;

  // Antonym/Contradiction
  antonymSignalCount: number;

  // Ontology/Taxonomy
  quantityMismatch: number; // 0 or 1
  taxonomyHit: number; // 0 or 1
  forceNoTriggered: number; // 0 or 1

  // Decision path encoding (one-hot or numeric)
  decisionPathV9: number; // Encoded decision path from V9
}

/**
 * V10 Classifier Output
 */
export interface V10ClassifierOutput {
  label: JudgeResult;
  confidence: number; // 0~1
  probs: {
    yes: number;
    no: number;
    irrelevant: number;
    decisive: number;
  };
}

/**
 * V10 Analysis Result with Explanation
 */
export interface V10AnalysisResult {
  labelV10: JudgeResult;
  confidence: number;
  probs: {
    yes: number;
    no: number;
    irrelevant: number;
    decisive: number;
  };
  hardGuardsTriggered: string[];
  features: V10Features;
  embeddings: {
    simAnswerRaw: number;
    simContentRaw: number;
    simQA: number;
    simQC: number;
  };
  v9Baseline: {
    labelV9: JudgeResult;
    simAnswerFinal: number;
    simContentFinal: number;
  };
}

/**
 * Logistic Regression Model Weights
 */
export interface LogisticRegressionWeights {
  // Bias terms for each class
  bias: {
    yes: number;
    no: number;
    irrelevant: number;
    decisive: number;
  };
  // Feature weights for each class
  weights: {
    yes: number[];
    no: number[];
    irrelevant: number[];
    decisive: number[];
  };
  // Feature names (for debugging)
  featureNames: string[];
  // Model metadata
  version: string;
  trainedAt: string;
  trainingSamples?: number;
}

