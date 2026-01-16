/**
 * V10 Pair Embedding
 * 질문+컨텍스트 기반 임베딩으로 판단 강화
 */

import { ProblemKnowledge } from '../../ai-analyzer';
import { getEmbedding, cosineSimilarity, selectTopKSentences } from '../../ai-analyzer';

/**
 * V10 Pair Embedding Config
 */
const PAIR_EMBEDDING_CONFIG = {
  TOP_K_CONTENT: 1, // Pair embedding은 Top1만 사용
  TOP_K_ANSWER: 1,
};

/**
 * Pair embedding 결과
 */
export interface PairEmbeddingResult {
  simQA: number; // Q||A vs A similarity
  simQC: number; // Q||C vs C similarity
}

/**
 * Calculate pair embeddings with strict call limit
 * 최대 2회의 추가 embedding 호출만 허용
 */
export async function calculatePairEmbeddings(
  question: string,
  knowledge: ProblemKnowledge,
  questionVec: Float32Array
): Promise<PairEmbeddingResult> {
  // Top1 sentence만 사용하여 embedding 호출 수 제한
  const contentTop1 = knowledge.content 
    ? selectTopKSentences(question, knowledge.contentSentences, 1)[0] || ''
    : '';
  const answerTop1 = knowledge.answer
    ? selectTopKSentences(question, knowledge.answerSentences, 1)[0] || ''
    : '';

  let simQA = 0;
  let simQC = 0;

  // Q||A pair embedding
  if (answerTop1) {
    const qaPair = `Q: ${question} || A: ${answerTop1}`;
    const vecQA = await getEmbedding(qaPair);
    const vecA = await getEmbedding(`A: ${answerTop1}`);
    simQA = cosineSimilarity(vecQA, vecA);
  }

  // Q||C pair embedding
  if (contentTop1) {
    const qcPair = `Q: ${question} || C: ${contentTop1}`;
    const vecQC = await getEmbedding(qcPair);
    const vecC = await getEmbedding(`C: ${contentTop1}`);
    simQC = cosineSimilarity(vecQC, vecC);
  }

  return {
    simQA: Math.max(0, Math.min(1, simQA)),
    simQC: Math.max(0, Math.min(1, simQC)),
  };
}

