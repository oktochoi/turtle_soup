// AI 질문 분석기 - 의미 기반(Semantic) 판정 엔진 V2
// transformers.js를 사용한 sentence embedding 기반 분석
// 문장 단위 분할 + 최대 유사도 기준 + 캐싱

// @ts-ignore - @xenova/transformers는 동적 import로 로드되므로 타입 체크 우회
type Pipeline = any;

// 싱글톤 패턴으로 모델 인스턴스 관리
let embeddingPipeline: Pipeline | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<Pipeline> | null = null;

// 임베딩 캐시 (같은 텍스트는 재사용)
const embeddingCache = new Map<string, Float32Array>();

/**
 * 문장 단위로 텍스트 분할
 * @param text 입력 텍스트
 * @returns 문장 배열
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[\.\n\?\!]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Sentence embedding 모델 로드 (싱글톤)
 * 최초 1회만 로드되도록 보장
 */
async function loadEmbeddingModel(): Promise<Pipeline> {
  // 이미 로드된 경우 즉시 반환
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  // 로딩 중인 경우 기존 Promise 반환
  if (isModelLoading && modelLoadPromise) {
    return modelLoadPromise;
  }

  // 브라우저 환경에서만 실행
  if (typeof window === 'undefined') {
    throw new Error('Embedding model can only be loaded in browser environment');
  }

  // 모델 로딩 시작
  isModelLoading = true;
  modelLoadPromise = (async () => {
    try {
      // @ts-ignore - 동적 import 타입 체크 우회
      const { pipeline } = await import('@xenova/transformers');
      
      // 다국어 sentence embedding 모델 로드
      // 한국어 포함 다국어 지원, 경량 모델
      // @ts-ignore - transformers.js 옵션 타입 체크 우회
      const model = await pipeline(
        'feature-extraction',
        'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        {
          // 모바일 저사양 환경 고려
          quantized: true, // 양자화된 모델 사용 (메모리 절약)
        }
      );

      embeddingPipeline = model;
      isModelLoading = false;
      return model;
    } catch (error) {
      isModelLoading = false;
      modelLoadPromise = null;
      console.error('모델 로드 오류:', error);
      throw error;
    }
  })();

  return modelLoadPromise;
}

/**
 * 텍스트를 임베딩 벡터로 변환 (캐싱 포함)
 * @param text 입력 텍스트
 * @returns 정규화된 임베딩 벡터 (Float32Array)
 */
async function getEmbedding(text: string): Promise<Float32Array> {
  if (!text || text.trim().length === 0) {
    throw new Error('Empty text cannot be embedded');
  }

  const normalizedText = text.trim();

  // 캐시 확인 (같은 텍스트는 재사용)
  if (embeddingCache.has(normalizedText)) {
    return embeddingCache.get(normalizedText)!;
  }

  const model = await loadEmbeddingModel();
  
  try {
    // 모델 실행하여 임베딩 추출
    const output = await model(normalizedText, {
      pooling: 'mean', // 평균 풀링으로 문장 레벨 임베딩 생성
      normalize: true, // L2 정규화 (cosine similarity를 위해)
    });

    // 출력을 Float32Array로 변환
    let embedding: Float32Array;
    
    if (Array.isArray(output)) {
      // 배열인 경우
      const flatArray = output.flat(Infinity) as number[];
      embedding = new Float32Array(flatArray);
    } else if (output && typeof output === 'object') {
      // Tensor 객체인 경우
      if (output.data) {
        embedding = new Float32Array(output.data);
      } else if (Array.isArray(output)) {
        embedding = new Float32Array(output.flat(Infinity) as number[]);
      } else {
        // 객체의 값들을 배열로 변환
        const values = Object.values(output) as number[];
        embedding = new Float32Array(values.flat(Infinity));
      }
    } else {
      throw new Error('Unexpected output format from embedding model');
    }

    // L2 정규화 (cosine similarity를 위해)
    const normalizedEmbedding = normalizeVector(embedding);
    
    // 캐시에 저장 (최대 1000개까지)
    if (embeddingCache.size < 1000) {
      embeddingCache.set(normalizedText, normalizedEmbedding);
    }
    
    return normalizedEmbedding;
  } catch (error) {
    console.error('임베딩 생성 오류:', error);
    throw error;
  }
}

/**
 * 벡터 L2 정규화
 * @param vector 입력 벡터
 * @returns 정규화된 벡터
 */
function normalizeVector(vector: Float32Array): Float32Array {
  const magnitude = Math.sqrt(
    Array.from(vector).reduce((sum, val) => sum + val * val, 0)
  );
  
  if (magnitude === 0) {
    return vector;
  }

  return new Float32Array(vector.map(val => val / magnitude));
}

/**
 * Cosine Similarity 계산
 * @param vec1 첫 번째 벡터 (정규화됨)
 * @param vec2 두 번째 벡터 (정규화됨)
 * @returns cosine similarity 값 (-1 ~ 1, 보통 0 ~ 1)
 */
function cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vector dimensions must match');
  }

  // 정규화된 벡터의 내적 = cosine similarity
  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }

  // 정규화된 벡터이므로 magnitude는 1이지만, 안전을 위해 확인
  return Math.max(-1, Math.min(1, dotProduct));
}

/**
 * 최대 유사도 계산 (한 문장만 맞아도 YES)
 * @param questionVec 질문 벡터
 * @param sentenceVecs 문장 벡터 배열
 * @returns 최대 유사도 값
 */
function maxSimilarity(
  questionVec: Float32Array,
  sentenceVecs: Float32Array[]
): number {
  if (sentenceVecs.length === 0) {
    return 0;
  }

  return Math.max(
    ...sentenceVecs.map(vec => cosineSimilarity(questionVec, vec))
  );
}

/**
 * 의미 기반 질문 분석 (Semantic Analysis) V2
 * 
 * @param question 참가자의 질문
 * @param problemContent 문제 설명 텍스트
 * @param problemAnswer 정답 설명 텍스트
 * @returns 판정 결과: 'yes' | 'no' | 'irrelevant' | 'decisive'
 * 
 * V2 개선 사항:
 * - 문장 단위 분할 및 개별 임베딩
 * - 최대 유사도 기준 (한 문장만 맞아도 YES)
 * - 판정 순서 재정의 (decisive → yes → no → irrelevant → fallback)
 * - 임베딩 캐싱 (성능 향상)
 * - 질문 길이 제한 (트롤 방지)
 */
export async function analyzeQuestionSemantic(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<'yes' | 'no' | 'irrelevant' | 'decisive'> {
  try {
    // 입력 검증
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return 'irrelevant';
    }
    if (!problemContent || typeof problemContent !== 'string') {
      problemContent = '';
    }
    if (!problemAnswer || typeof problemAnswer !== 'string') {
      problemAnswer = '';
    }

    // 브라우저 환경에서만 실행
    if (typeof window === 'undefined') {
      return 'irrelevant';
    }

    // 텍스트 정규화 (공백 정리)
    const normalizedQuestion = question.trim();
    const normalizedContent = problemContent.trim();
    const normalizedAnswer = problemAnswer.trim();

    // 질문 길이 컷 (트롤 방지 + 모델 낭비 방지)
    if (normalizedQuestion.length < 5) {
      return 'irrelevant';
    }

    // 문제 설명이나 정답이 없으면 IRRELEVANT
    if (normalizedContent.length === 0 && normalizedAnswer.length === 0) {
      return 'irrelevant';
    }

    // 질문 임베딩
    const questionEmbedding = await getEmbedding(normalizedQuestion);

    // 문장 단위로 분할
    const contentSentences = normalizedContent.length > 0 
      ? splitSentences(normalizedContent)
      : [];
    const answerSentences = normalizedAnswer.length > 0
      ? splitSentences(normalizedAnswer)
      : [];

    // 각 문장을 개별 임베딩 (병렬 처리)
    const contentEmbeddings = await Promise.all(
      contentSentences.map(sentence => getEmbedding(sentence))
    );
    const answerEmbeddings = await Promise.all(
      answerSentences.map(sentence => getEmbedding(sentence))
    );

    // 최대 유사도 계산 (한 문장만 맞아도 YES)
    const simContent = contentEmbeddings.length > 0
      ? maxSimilarity(questionEmbedding, contentEmbeddings)
      : 0;
    
    const simAnswer = answerEmbeddings.length > 0
      ? maxSimilarity(questionEmbedding, answerEmbeddings)
      : 0;

    // 디버깅용 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('Similarity scores:', { 
        simAnswer, 
        simContent, 
        diff: Math.abs(simAnswer - simContent),
        answerSentences: answerSentences.length,
        contentSentences: contentSentences.length
      });
    }

    // 판정 로직 적용 (순서 중요!)
    // 1. DECISIVE 먼저 (정답과 문제 설명 경계에 위치)
    if (
      simAnswer > 0.45 &&
      simContent > 0.45 &&
      Math.abs(simAnswer - simContent) < 0.08
    ) {
      return 'decisive';
    }

    // 2. YES (정답 문장에 강하게 닿을 때만)
    if (simAnswer > 0.55) {
      return 'yes';
    }

    // 3. NO (문제에는 닿지만 정답과는 반대)
    if (simContent > 0.40 && simAnswer < 0.30) {
      return 'no';
    }

    // 4. IRRELEVANT (문제/정답과 모두 멀 때)
    if (simAnswer < 0.25 && simContent < 0.25) {
      return 'irrelevant';
    }

    // 5. Fallback (기본적으로 관련이 있으면 판정)
    // 정답 유사도가 더 높으면 YES, 문제 설명 유사도가 더 높으면 NO
    return simAnswer >= simContent ? 'yes' : 'no';

  } catch (error) {
    console.error('의미 기반 질문 분석 오류:', error);
    // 에러 발생 시 항상 IRRELEVANT로 fallback
    return 'irrelevant';
  }
}

/**
 * 기존 analyzeQuestion 함수를 analyzeQuestionSemantic으로 리다이렉트
 * (하위 호환성 유지)
 */
export async function analyzeQuestion(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<'yes' | 'no' | 'irrelevant' | 'decisive'> {
  return analyzeQuestionSemantic(question, problemContent, problemAnswer);
}

/**
 * 모델 초기화 (선택적, 사전 로딩용)
 * 사용자가 질문하기 전에 모델을 미리 로드할 수 있음
 */
export async function initializeModel(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      await loadEmbeddingModel();
    }
  } catch (error) {
    console.error('모델 초기화 오류:', error);
    // 에러는 무시 (lazy loading으로 처리)
  }
}

/**
 * 모델 메모리 해제 (선택적)
 * 메모리 부족 시 호출 가능
 */
export function releaseModel(): void {
  embeddingPipeline = null;
  isModelLoading = false;
  modelLoadPromise = null;
}

/**
 * 캐시 초기화 (선택적)
 * 메모리 부족 시 호출 가능
 */
export function clearCache(): void {
  embeddingCache.clear();
}

/**
 * 정답 유사도 계산 (0 ~ 100% 반환)
 * @param userAnswer 사용자가 입력한 정답
 * @param correctAnswer 실제 정답
 * @returns 유사도 퍼센트 (0 ~ 100)
 */
export async function calculateAnswerSimilarity(
  userAnswer: string,
  correctAnswer: string
): Promise<number> {
  if (!userAnswer.trim() || !correctAnswer.trim()) {
    return 0;
  }

  try {
    // 두 텍스트를 임베딩으로 변환
    const userEmbedding = await getEmbedding(userAnswer.trim());
    const correctEmbedding = await getEmbedding(correctAnswer.trim());

    // Cosine similarity 계산 (0 ~ 1 범위)
    const similarity = cosineSimilarity(userEmbedding, correctEmbedding);

    // 0 ~ 1 범위를 0 ~ 100%로 변환 (음수는 0으로 처리)
    const percentage = Math.max(0, Math.min(100, (similarity * 100)));

    return Math.round(percentage * 10) / 10; // 소수점 첫째 자리까지
  } catch (error) {
    console.error('정답 유사도 계산 오류:', error);
    // 오류 발생 시 간단한 문자열 매칭으로 폴백
    return calculateSimpleMatch(userAnswer, correctAnswer);
  }
}

/**
 * 간단한 문자열 매칭 (폴백용)
 * @param userAnswer 사용자 정답
 * @param correctAnswer 실제 정답
 * @returns 유사도 퍼센트 (0 ~ 100)
 */
function calculateSimpleMatch(userAnswer: string, correctAnswer: string): number {
  const userWords = userAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const correctWords = correctAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  if (correctWords.length === 0) {
    return 0;
  }

  // 단어 매칭 비율
  const matchedWords = userWords.filter(word => 
    correctWords.some(correctWord => 
      correctWord.includes(word) || word.includes(correctWord)
    )
  ).length;

  const wordMatchRatio = matchedWords / correctWords.length;

  // 부분 문자열 매칭
  const userLower = userAnswer.toLowerCase();
  const correctLower = correctAnswer.toLowerCase();
  let substringMatch = 0;

  // 사용자 정답이 실제 정답에 포함되는 비율
  if (correctLower.includes(userLower) || userLower.includes(correctLower)) {
    substringMatch = 0.5;
  }

  // 최종 유사도 (단어 매칭 70% + 부분 문자열 30%)
  const similarity = (wordMatchRatio * 0.7 + substringMatch * 0.3) * 100;

  return Math.round(similarity * 10) / 10;
}
