/**
 * V10 Logistic Regression Classifier
 * 브라우저에서 실행 가능한 경량 분류기
 */

import { JudgeResult } from '../../ai-analyzer';
import { V10ClassifierOutput, LogisticRegressionWeights } from './types';
import { featuresToArray, FEATURE_NAMES } from './features';

/**
 * Sigmoid function
 */
function sigmoid(x: number): number {
  // Clamp to prevent overflow
  const clamped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clamped));
}

/**
 * Softmax function
 */
function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map(x => Math.exp(x - maxLogit));
  const sum = expLogits.reduce((a, b) => a + b, 0);
  return expLogits.map(x => x / sum);
}

/**
 * Load model weights (default or from file)
 */
let cachedWeights: LogisticRegressionWeights | null = null;

export async function loadModelWeights(): Promise<LogisticRegressionWeights> {
  if (cachedWeights) return cachedWeights;

  try {
    // Try to load from file
    const response = await fetch('/lib/ai/v10/model-weights.json');
    if (response.ok) {
      cachedWeights = await response.json();
      return cachedWeights!;
    }
  } catch (error) {
    console.warn('[V10 Classifier] Failed to load model weights, using defaults:', error);
  }

  // Default weights (untrained, will be replaced with trained model)
  cachedWeights = getDefaultWeights();
  return cachedWeights;
}

/**
 * Get default (untrained) weights
 */
function getDefaultWeights(): LogisticRegressionWeights {
  const featureCount = FEATURE_NAMES.length;
  const labels: JudgeResult[] = ['yes', 'no', 'irrelevant', 'decisive'];

  return {
    bias: {
      yes: 0,
      no: 0,
      irrelevant: 0,
      decisive: 0,
    },
    weights: {
      yes: new Array(featureCount).fill(0),
      no: new Array(featureCount).fill(0),
      irrelevant: new Array(featureCount).fill(0),
      decisive: new Array(featureCount).fill(0),
    },
    featureNames: [...FEATURE_NAMES],
    version: '1.0.0',
    trainedAt: new Date().toISOString(),
  };
}

/**
 * Classify using logistic regression
 */
export async function classifyV10(
  features: number[]
): Promise<V10ClassifierOutput> {
  const weights = await loadModelWeights();
  
  if (features.length !== weights.featureNames.length) {
    throw new Error(
      `Feature count mismatch: expected ${weights.featureNames.length}, got ${features.length}`
    );
  }

  // Calculate logits for each class
  const labels: JudgeResult[] = ['yes', 'no', 'irrelevant', 'decisive'];
  const logits = labels.map(label => {
    const bias = weights.bias[label];
    const classWeights = weights.weights[label];
    const dotProduct = features.reduce(
      (sum, feature, i) => sum + feature * classWeights[i],
      0
    );
    return bias + dotProduct;
  });

  // Apply softmax to get probabilities
  const probs = softmax(logits);

  // Get label with highest probability
  const maxProbIndex = probs.indexOf(Math.max(...probs));
  const label = labels[maxProbIndex];
  const confidence = probs[maxProbIndex];

  return {
    label,
    confidence,
    probs: {
      yes: probs[0],
      no: probs[1],
      irrelevant: probs[2],
      decisive: probs[3],
    },
  };
}

