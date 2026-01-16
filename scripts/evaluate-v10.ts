/**
 * V10 vs V9 평가 스크립트
 * Golden Testset을 사용하여 정확도 비교 및 confusion matrix 생성
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface GoldenQuestion {
  problemId: string;
  content: string;
  answer: string;
  q: string;
  expected: 'yes' | 'no' | 'irrelevant' | 'decisive';
}

interface EvaluationResult {
  v9: {
    correct: number;
    total: number;
    accuracy: number;
    perLabel: Record<string, { correct: number; total: number; accuracy: number }>;
    confusionMatrix: Record<string, Record<string, number>>;
  };
  v10: {
    correct: number;
    total: number;
    accuracy: number;
    perLabel: Record<string, { correct: number; total: number; accuracy: number }>;
    confusionMatrix: Record<string, Record<string, number>>;
  };
  wrongYesNo: {
    v9: number;
    v10: number;
  };
  wrongIrrelevant: {
    v9: number;
    v10: number;
  };
  improvements: {
    v10Better: number;
    v9Better: number;
    same: number;
  };
}

/**
 * Load golden testset
 */
function loadGoldenTestset(): GoldenQuestion[] {
  const filePath = join(process.cwd(), 'tests', 'golden_questions.json');
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Evaluate V9
 */
async function evaluateV9(question: GoldenQuestion): Promise<'yes' | 'no' | 'irrelevant' | 'decisive'> {
  // Dynamic import to avoid SSR issues
  const { analyzeQuestionSemanticV8 } = await import('../lib/ai-analyzer');
  return await analyzeQuestionSemanticV8(question.q, question.content, question.answer);
}

/**
 * Evaluate V10
 */
async function evaluateV10(question: GoldenQuestion): Promise<'yes' | 'no' | 'irrelevant' | 'decisive'> {
  // Dynamic import to avoid SSR issues
  const { analyzeQuestionSemanticV10 } = await import('../lib/ai/v10/analyzer');
  return await analyzeQuestionSemanticV10(question.q, question.content, question.answer);
}

/**
 * Build confusion matrix
 */
function buildConfusionMatrix(
  predictions: string[],
  expected: string[]
): Record<string, Record<string, number>> {
  const labels = ['yes', 'no', 'irrelevant', 'decisive'];
  const matrix: Record<string, Record<string, number>> = {};
  
  for (const label of labels) {
    matrix[label] = {};
    for (const pred of labels) {
      matrix[label][pred] = 0;
    }
  }
  
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const exp = expected[i];
    matrix[exp][pred] = (matrix[exp][pred] || 0) + 1;
  }
  
  return matrix;
}

/**
 * Main evaluation function
 */
export async function evaluateV10VsV9(): Promise<EvaluationResult> {
  const testset = loadGoldenTestset();
  const labels = ['yes', 'no', 'irrelevant', 'decisive'];
  
  const v9Predictions: string[] = [];
  const v10Predictions: string[] = [];
  const expected: string[] = [];
  
  console.log(`Evaluating ${testset.length} questions...\n`);
  
  // Evaluate each question
  for (let i = 0; i < testset.length; i++) {
    const question = testset[i];
    process.stdout.write(`[${i + 1}/${testset.length}] ${question.problemId}... `);
    
    try {
      const [v9Result, v10Result] = await Promise.all([
        evaluateV9(question),
        evaluateV10(question),
      ]);
      
      v9Predictions.push(v9Result);
      v10Predictions.push(v10Result);
      expected.push(question.expected);
      
      const v9Correct = v9Result === question.expected ? '✓' : '✗';
      const v10Correct = v10Result === question.expected ? '✓' : '✗';
      console.log(`V9: ${v9Correct} V10: ${v10Correct}`);
    } catch (error) {
      console.error(`Error: ${error}`);
      v9Predictions.push('irrelevant');
      v10Predictions.push('irrelevant');
      expected.push(question.expected);
    }
  }
  
  // Calculate metrics
  const v9Correct = v9Predictions.filter((p, i) => p === expected[i]).length;
  const v10Correct = v10Predictions.filter((p, i) => p === expected[i]).length;
  
  // Per-label accuracy
  const v9PerLabel: Record<string, { correct: number; total: number; accuracy: number }> = {};
  const v10PerLabel: Record<string, { correct: number; total: number; accuracy: number }> = {};
  
  for (const label of labels) {
    const labelIndices = expected.map((e, i) => e === label ? i : -1).filter(i => i >= 0);
    const v9LabelCorrect = labelIndices.filter(i => v9Predictions[i] === label).length;
    const v10LabelCorrect = labelIndices.filter(i => v10Predictions[i] === label).length;
    
    v9PerLabel[label] = {
      correct: v9LabelCorrect,
      total: labelIndices.length,
      accuracy: labelIndices.length > 0 ? v9LabelCorrect / labelIndices.length : 0,
    };
    
    v10PerLabel[label] = {
      correct: v10LabelCorrect,
      total: labelIndices.length,
      accuracy: labelIndices.length > 0 ? v10LabelCorrect / labelIndices.length : 0,
    };
  }
  
  // Wrong yes/no (should be irrelevant but predicted as yes/no)
  const wrongYesNoV9 = expected
    .map((e, i) => e === 'irrelevant' && (v9Predictions[i] === 'yes' || v9Predictions[i] === 'no') ? 1 : 0)
    .reduce((a, b) => a + b, 0);
  const wrongYesNoV10 = expected
    .map((e, i) => e === 'irrelevant' && (v10Predictions[i] === 'yes' || v10Predictions[i] === 'no') ? 1 : 0)
    .reduce((a, b) => a + b, 0);
  
  // Wrong irrelevant (should be yes/no but predicted as irrelevant)
  const wrongIrrelevantV9 = expected
    .map((e, i) => (e === 'yes' || e === 'no') && v9Predictions[i] === 'irrelevant' ? 1 : 0)
    .reduce((a, b) => a + b, 0);
  const wrongIrrelevantV10 = expected
    .map((e, i) => (e === 'yes' || e === 'no') && v10Predictions[i] === 'irrelevant' ? 1 : 0)
    .reduce((a, b) => a + b, 0);
  
  // Improvements
  let v10Better = 0;
  let v9Better = 0;
  let same = 0;
  
  for (let i = 0; i < expected.length; i++) {
    const v9Match = v9Predictions[i] === expected[i];
    const v10Match = v10Predictions[i] === expected[i];
    
    if (v10Match && !v9Match) v10Better++;
    else if (v9Match && !v10Match) v9Better++;
    else same++;
  }
  
  const result: EvaluationResult = {
    v9: {
      correct: v9Correct,
      total: testset.length,
      accuracy: v9Correct / testset.length,
      perLabel: v9PerLabel,
      confusionMatrix: buildConfusionMatrix(v9Predictions, expected),
    },
    v10: {
      correct: v10Correct,
      total: testset.length,
      accuracy: v10Correct / testset.length,
      perLabel: v10PerLabel,
      confusionMatrix: buildConfusionMatrix(v10Predictions, expected),
    },
    wrongYesNo: {
      v9: wrongYesNoV9,
      v10: wrongYesNoV10,
    },
    wrongIrrelevant: {
      v9: wrongIrrelevantV9,
      v10: wrongIrrelevantV10,
    },
    improvements: {
      v10Better,
      v9Better,
      same,
    },
  };
  
  return result;
}

/**
 * Print evaluation results
 */
export function printEvaluationResults(result: EvaluationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION RESULTS: V10 vs V9');
  console.log('='.repeat(80) + '\n');
  
  // Overall accuracy
  console.log('Overall Accuracy:');
  console.log(`  V9:  ${(result.v9.accuracy * 100).toFixed(2)}% (${result.v9.correct}/${result.v9.total})`);
  console.log(`  V10: ${(result.v10.accuracy * 100).toFixed(2)}% (${result.v10.correct}/${result.v10.total})`);
  console.log(`  Improvement: ${((result.v10.accuracy - result.v9.accuracy) * 100).toFixed(2)}%p\n`);
  
  // Per-label accuracy
  console.log('Per-Label Accuracy:');
  const labels = ['yes', 'no', 'irrelevant', 'decisive'];
  for (const label of labels) {
    const v9 = result.v9.perLabel[label];
    const v10 = result.v10.perLabel[label];
    if (v9.total > 0) {
      console.log(`  ${label}:`);
      console.log(`    V9:  ${(v9.accuracy * 100).toFixed(2)}% (${v9.correct}/${v9.total})`);
      console.log(`    V10: ${(v10.accuracy * 100).toFixed(2)}% (${v10.correct}/${v10.total})`);
    }
  }
  console.log();
  
  // Wrong predictions
  console.log('Wrong Predictions:');
  console.log(`  Irrelevant → Yes/No:`);
  console.log(`    V9:  ${result.wrongYesNo.v9}`);
  console.log(`    V10: ${result.wrongYesNo.v10}`);
  console.log(`  Yes/No → Irrelevant:`);
  console.log(`    V9:  ${result.wrongIrrelevant.v9}`);
  console.log(`    V10: ${result.wrongIrrelevant.v10}`);
  console.log();
  
  // Improvements
  console.log('Improvements:');
  console.log(`  V10 Better: ${result.improvements.v10Better}`);
  console.log(`  V9 Better:  ${result.improvements.v9Better}`);
  console.log(`  Same:       ${result.improvements.same}`);
  console.log();
  
  // Confusion matrices
  console.log('V9 Confusion Matrix:');
  printConfusionMatrix(result.v9.confusionMatrix);
  console.log();
  
  console.log('V10 Confusion Matrix:');
  printConfusionMatrix(result.v10.confusionMatrix);
  console.log();
}

/**
 * Print confusion matrix
 */
function printConfusionMatrix(matrix: Record<string, Record<string, number>>): void {
  const labels = ['yes', 'no', 'irrelevant', 'decisive'];
  const header = '        ' + labels.map(l => l.padEnd(12)).join('');
  console.log(header);
  console.log('-'.repeat(header.length));
  
  for (const expected of labels) {
    const row = expected.padEnd(8) + labels.map(pred => {
      const count = matrix[expected]?.[pred] || 0;
      return count.toString().padEnd(12);
    }).join('');
    console.log(row);
  }
}

/**
 * Main entry point (for Node.js execution)
 */
if (require.main === module) {
  evaluateV10VsV9()
    .then(result => {
      printEvaluationResults(result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Evaluation failed:', error);
      process.exit(1);
    });
}

