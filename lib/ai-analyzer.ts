// AI 질문 분석기 - Semantic + Ontology Inference Engine V7
// 목적: 바다거북스프 Yes/No/Irrelevant/Decisive 판정을 "문제별 룰" 없이 최대한 안정화
//
// 구성
// 1) Embedding 기반 유사도 (semantic)
// 2) 질문/정답에서 엔티티(개념) 추출 (dictionary)
// 3) Ontology(부분-전체 계층) 추론으로 "일반화 질문"을 NO로 처리 (손 vs 손톱 문제 해결)
// 4) Inference rule로 정답 텍스트에 없는 상위개념(사고/고의 등) 자동 태깅
// 5) (옵션) 애매할 때만 LLM/NLI fallback hook 가능 (무료/유료 선택)
//
// NOTE: Vercel/Next.js 브라우저 실행 전제 (@xenova/transformers)

type Pipeline = any;

export type JudgeResult = "yes" | "no" | "irrelevant" | "decisive";

const CONFIG = {
  TOP_K_CONTENT: 14,
  TOP_K_ANSWER: 14,

  EMBEDDING_CONCURRENCY: 4,

  CACHE_MAX: 2000,
  CACHE_TTL_MS: 1000 * 60 * 60 * 12,

  MIN_QUESTION_LEN: 5,
  MAX_QUESTION_LEN: 420,

  THRESHOLD: {
    DECISIVE_ANSWER: 0.68,
    DECISIVE_CONTENT: 0.35,

    YES: 0.59,
    NO_CONTENT: 0.42,
    NO_ANSWER_MAX: 0.30,

    IRRELEVANT_MAX: 0.25,
  },

  ADJUST: {
    NEGATION_MISMATCH_PENALTY: 0.06,
    MODALITY_MISMATCH_PENALTY: 0.04,

    // ✅ 엔티티/추론 보정
    CONCEPT_MATCH_BONUS: 0.12,
    INFER_MATCH_BONUS: 0.10,

    // ✅ "일반화 질문(부위/부분/전체)"이면서 정답은 더 좁은 경우 NO 쪽으로 강하게
    GENERALIZATION_NO_BONUS: 0.25,
  },

  // fallback(옵션) 구간
  AMBIGUOUS_RANGE: { min: 0.38, max: 0.62 },
};

// -------------------------
// 모델 싱글톤
// -------------------------
let embeddingPipeline: Pipeline | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<Pipeline> | null = null;

// -------------------------
// LRU + TTL 캐시
// -------------------------
type CacheValue = { vec: Float32Array; expiresAt: number };

class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private limit: number) {}

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;

    // TTL check (CacheValue 가정)
    const expiresAt = (val as any).expiresAt;
    if (typeof expiresAt === "number" && Date.now() >= expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);

    if (this.map.size > this.limit) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
  }

  clear() {
    this.map.clear();
  }
}

const embeddingCache = new LRUCache<string, CacheValue>(CONFIG.CACHE_MAX);

// -------------------------
// 유틸
// -------------------------
function normalizeText(text: string): string {
  return (text ?? "")
    .replace(/\u200B/g, "")
    .replace(/[\u200C\u200D\uFEFF]/g, "")
    .replace(/[“”"''""]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentencesKo(text: string): string[] {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];

  const rough = cleaned.split(/[\n\r]+/g);
  const out: string[] = [];

  for (const chunk of rough) {
    const parts = chunk
      .split(/(?<=[\.\?\!。？！])\s+/g)
      .flatMap(p => p.split(/(?<=[다요죠까네임음])\s+(?=[가-힣A-Za-z0-9])/g));

    for (const p of parts) {
      const s = p.trim();
      if (s.length >= 3) out.push(s);
    }
  }
  return out.length ? out : [cleaned];
}

function roughRelevanceScore(question: string, sentence: string): number {
  const q = normalizeText(question).toLowerCase();
  const s = normalizeText(sentence).toLowerCase();
  if (!q || !s) return 0;

  const qTokens = q.split(/\s+/).filter(t => t.length >= 2);
  const sTokens = new Set(s.split(/\s+/).filter(t => t.length >= 2));
  if (!qTokens.length) return 0;

  let exactHits = 0;
  for (const t of qTokens) if (sTokens.has(t)) exactHits++;

  let partial = 0;
  for (const t of qTokens) if (t.length >= 3 && s.includes(t)) partial += 0.5;

  const exactScore = exactHits / qTokens.length;
  const partialScore = Math.min(0.8, (partial / qTokens.length));

  return exactScore * 0.65 + partialScore * 0.35;
}

function selectTopKSentences(question: string, sentences: string[], k: number): string[] {
  if (sentences.length <= k) return sentences;
  return sentences
    .map(s => ({ s, score: roughRelevanceScore(question, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(x => x.s);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let idx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const cur = idx++;
      if (cur >= items.length) break;
      results[cur] = await fn(items[cur]);
    }
  });

  await Promise.all(workers);
  return results;
}

// -------------------------
// 부정/모달리티 (간단)
// -------------------------
const NEGATION_PATTERNS = [
  "아니", "아니다", "아닌", "안 ", "못 ", "없", "전혀", "절대", "결코", "틀렸",
  "지 않", "지않", "지 못", "지못", "하지 않", "하지않", "하지 못", "하지못",
  "않았", "않는", "않을", "못했", "못하는", "못할", "안 했", "안했", "안 하는", "안하는"
];
const MODALITY_PATTERNS = ["가능", "일 수도", "아마", "추정", "확실", "반드시", "모르", "불확실", "어쩌면"];

function hasAny(text: string, patterns: string[]) {
  const t = normalizeText(text);
  if (!t) return false;
  return patterns.some(p => t.includes(p));
}
function hasNegation(text: string) {
  return hasAny(text, NEGATION_PATTERNS);
}
function hasModality(text: string) {
  return hasAny(text, MODALITY_PATTERNS);
}

// -------------------------
// ✅ 엔티티 사전 (문제별 X, 범용)
// - 게임에서 자주 나오는 축만 먼저 탑재
// - 계속 추가해도 "문제 수"와 무관하게 동작
// -------------------------

// "일반화 질문" 감지: "부위/부분/전체/전반/어느/무슨" 같은 표현이 들어가면
// 손톱 같은 세부사실을 "손(부위) 먹었냐"로 일반화 질문하는 패턴을 잡아냄
const GENERALIZATION_HINTS = ["부위", "부분", "전체", "전반", "어느", "어떤 부위", "어떤 부분", "무슨 부위", "무슨 부분"];

// Ontology: 부모 -> 자식
// (여기 예시는 body 중심이지만, 필요하면 차량/동물/물건 등 확장 가능)
const ONTOLOGY: Record<string, string[]> = {
  hand: ["palm", "back_of_hand", "finger", "nail", "wrist"],
  finger: ["nail", "finger_tip", "finger_joint"],

  face: ["eye", "nose", "mouth", "ear", "tooth", "tongue"],
  eye: ["eyelid", "eyeball", "retina", "cornea"],

  body: ["head", "neck", "chest", "back", "arm", "leg", "hand", "foot"],
  foot: ["toe", "toenail", "sole", "ankle"],
  toe: ["toenail"],

  // 음식/재료 쪽도 자주 나옴
  meat: ["skin", "fat", "bone", "organ"],
};

// 엔티티(개념) -> 표현들
// "손 부위"처럼 질문에서 부모를 직접 말하는 표현도 포함시키는 게 포인트.
const ENTITY_SYNONYMS: Record<string, string[]> = {
  // body
  hand: ["손", "손부위", "손 부위", "손 부분", "손쪽", "손 전체"],
  palm: ["손바닥", "손 안쪽", "손안쪽", "손 안 짝"],
  back_of_hand: ["손등", "손 바깥쪽", "손의 바깥"],
  finger: ["손가락", "손가락 부위", "손가락 부분"],
  nail: ["손톱", "손톱 부위", "손톱을", "손톱만"],

  foot: ["발", "발 전체", "발 부위", "발 부분"],
  toe: ["발가락"],
  toenail: ["발톱"],

  face: ["얼굴", "안면"],
  eye: ["눈", "안구"],
  mouth: ["입", "입안"],
  tooth: ["이", "치아"],
  tongue: ["혀"],

  // 사건 성격(상위개념)
  accident: ["실수", "우발", "사고", "불의", "의도치", "예기치", "뜻하지 않게", "우연히"],
  intentional: ["고의", "일부러", "의도", "계획", "작정", "노림"],
  murder: ["살인", "살해", "타살", "죽였다", "죽인"],
  suicide: ["자살", "극단적 선택", "스스로 죽", "목숨을 끊", "자해"],

  // 도구/상황 힌트(사고 추론에 사용)
  brake_failure: ["브레이크 고장", "브레이크가 고장", "브레이크가 안", "브레이크 불량", "브레이크 망가"],
  crash_event: ["충돌", "부딪", "박았", "가드레일", "넘어", "추락", "떨어", "낙하"],
  speed_run: ["빠르게", "속도", "도주", "도망", "질주", "달리"],

  // 행위
  eat: ["먹", "먹었", "섭취", "씹", "삼켰"],
};

// 엔티티 추출: text에서 발견된 엔티티 key들 반환
function extractEntities(text: string): Set<string> {
  const t = normalizeText(text);
  const found = new Set<string>();
  if (!t) return found;

  for (const [entity, words] of Object.entries(ENTITY_SYNONYMS)) {
    if (words.some(w => t.includes(w))) found.add(entity);
  }
  return found;
}

function isGeneralizationQuestion(text: string): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  return GENERALIZATION_HINTS.some(h => t.includes(h));
}

// 부모/자식 관계 체크
function isParentOf(parent: string, child: string): boolean {
  const children = ONTOLOGY[parent] ?? [];
  if (children.includes(child)) return true;
  // 깊이 2~3까지 재귀 (필요시 깊이 늘려도 됨)
  for (const c of children) {
    if (isParentOf(c, child)) return true;
  }
  return false;
}

// 질문이 "부모 범주"를 물었는데, 정답은 "자식만" 확정인 케이스를 잡아 NO로 강제
// 예) Q: 손 부위 먹었나요?  A facts: nail만 먹음  => NO
function shouldForceNoByOntology(questionText: string, qEnt: Set<string>, aEnt: Set<string>): boolean {
  // 일반화 힌트 없으면 너무 공격적으로 NO 내리면 오탐 가능 → 힌트가 있을 때 우선 적용
  const generalized = isGeneralizationQuestion(questionText);

  // 질문 엔티티 중 ontology 부모가 있고, 정답은 그 자식만 있는 경우
  for (const q of qEnt) {
    for (const a of aEnt) {
      if (q !== a && isParentOf(q, a)) {
        // 정답에 parent 자체가 명시되어 있지 않으면 "자식만"이라고 보는 편이 안전
        const answerHasParent = aEnt.has(q);

        // 일반화 질문이면 매우 강하게 NO
        if (generalized && !answerHasParent) return true;

        // 일반화 힌트가 없어도, "손 부위" 같은 표현은 사실상 일반화이므로
        // 질문 텍스트에 parent 표현이 직접 들어가면 NO
        const t = normalizeText(questionText);
        const parentWords = ENTITY_SYNONYMS[q] ?? [];
        const parentDirect = parentWords.some(w => t.includes(w) && (w.includes("부위") || w.includes("부분") || w.includes("전체")));
        if (parentDirect && !answerHasParent) return true;
      }
    }
  }
  return false;
}

// -------------------------
// ✅ 상위개념 추론(문제별 X, 범용)
// -------------------------
function inferConceptsFromText(text: string): Set<string> {
  const t = normalizeText(text);
  const concepts = new Set<string>();
  if (!t) return concepts;

  // 사고 추론: 기계고장/통제불능 + 충돌/추락/가드레일 등
  const e = extractEntities(t);
  const hasBrake = e.has("brake_failure") || (t.includes("브레이크") && (t.includes("고장") || t.includes("안") || t.includes("불량")));
  const hasCrash = e.has("crash_event");
  const hasRun = e.has("speed_run");

  if (hasBrake && (hasCrash || hasRun)) concepts.add("accident");

  // 고의 추론: "계획/고의/일부러" 등 직접 표현이 있을 때
  if (e.has("intentional")) concepts.add("intentional");

  // 살인/자살은 텍스트에 단서가 있을 때
  if (e.has("murder")) concepts.add("murder");
  if (e.has("suicide")) concepts.add("suicide");

  return concepts;
}

// -------------------------
// 모델 로드/임베딩
// -------------------------
async function loadEmbeddingModel(maxRetries = 1): Promise<Pipeline> {
  if (embeddingPipeline) return embeddingPipeline;
  if (isModelLoading && modelLoadPromise) return modelLoadPromise;

  if (typeof window === "undefined") throw new Error("Embedding model can only be loaded in browser environment");

  isModelLoading = true;
  modelLoadPromise = (async () => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { pipeline } = await import("@xenova/transformers");
        const model = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
          quantized: true,
        });
        embeddingPipeline = model;
        isModelLoading = false;
        return model;
      } catch (e) {
        lastError = e;
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 700));
      }
    }
    isModelLoading = false;
    modelLoadPromise = null;
    throw lastError ?? new Error("Model load failed");
  })();

  return modelLoadPromise;
}

function normalizeVector(vector: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) sumSq += vector[i] * vector[i];
  const mag = Math.sqrt(sumSq);
  if (mag === 0) return vector;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / mag;
  return out;
}

function toFloat32Array(output: any): Float32Array {
  if (output?.data) {
    const data = output.data;
    if (data instanceof Float32Array) return data;
    if (Array.isArray(data)) return new Float32Array(data.flat(Infinity) as number[]);
  }
  if (Array.isArray(output)) return new Float32Array((output.flat(Infinity) as number[]));
  if (output && typeof output === "object") return new Float32Array((Object.values(output).flat(Infinity) as number[]));
  throw new Error("Unexpected embedding output");
}

async function getEmbedding(text: string): Promise<Float32Array> {
  const normalized = normalizeText(text);
  if (!normalized) throw new Error("Empty text");

  const cached = embeddingCache.get(normalized);
  if (cached && Date.now() < cached.expiresAt) return cached.vec;

  const model = await loadEmbeddingModel();
  const output = await model(normalized, { pooling: "mean", normalize: true });
  const vec = normalizeVector(toFloat32Array(output));

  embeddingCache.set(normalized, { vec, expiresAt: Date.now() + CONFIG.CACHE_TTL_MS });
  return vec;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`Vector dims mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

function maxSimilarity(questionVec: Float32Array, sentenceVecs: Float32Array[]): number {
  if (!sentenceVecs.length) return 0;
  let max = -1;
  for (const v of sentenceVecs) {
    const s = cosineSimilarity(questionVec, v);
    if (s > max) max = s;
  }
  return max;
}

function avgSimilarity(questionVec: Float32Array, sentenceVecs: Float32Array[]): number {
  if (!sentenceVecs.length) return 0;
  let sum = 0;
  for (const v of sentenceVecs) sum += cosineSimilarity(questionVec, v);
  return sum / sentenceVecs.length;
}

// -------------------------
// ✅ 최종 분석 함수 (V7)
// -------------------------

// (옵션) 애매할 때만 외부 NLI/LLM을 태울 수 있는 훅
export type FallbackJudge = (args: {
  question: string;
  problemContent: string;
  problemAnswer: string;
}) => Promise<JudgeResult | null>;

export async function analyzeQuestionSemanticV7(
  question: string,
  problemContent: string,
  problemAnswer: string,
  fallbackJudge?: FallbackJudge
): Promise<JudgeResult> {
  try {
    if (!question || typeof question !== "string") return "irrelevant";

    const q0 = normalizeText(question);
    if (q0.length < CONFIG.MIN_QUESTION_LEN) return "irrelevant";

    const q = q0.length > CONFIG.MAX_QUESTION_LEN ? q0.slice(0, CONFIG.MAX_QUESTION_LEN) : q0;

    const content = normalizeText(problemContent ?? "");
    const answer = normalizeText(problemAnswer ?? "");

    if (typeof window === "undefined") return "irrelevant";
    if (!content && !answer) return "irrelevant";

    // -------------------------
    // 0) 엔티티/추론 준비
    // -------------------------
    const qEntities = extractEntities(q);
    const aEntities = extractEntities(answer);

    // 정답 텍스트에 없는 상위개념을 infer로 태깅
    const aInferred = inferConceptsFromText(answer);
    for (const c of aInferred) aEntities.add(c);

    // 0-1) Ontology 강제 NO 먼저 적용 (손 vs 손톱 같은 문제를 가장 안정적으로 해결)
    // 단, 질문이 정확히 "손톱"을 물으면 YES 가능해야 하므로, 아래는 "부모 범주를 묻는 경우"에만 발동
    if (shouldForceNoByOntology(q, qEntities, aEntities)) {
      // 그래도 질문이 자식(손톱) 자체면 NO로 막으면 안 됨:
      // (예: qEntities에 nail이 있고 answer도 nail이면 yes)
      for (const qe of qEntities) {
        if (aEntities.has(qe)) {
          // exact entity match면 ontology NO 취소
          break;
        }
      }
      // exact match가 없는 경우만 NO
      const hasExact = [...qEntities].some(e => aEntities.has(e));
      if (!hasExact) return "no";
    }

    // -------------------------
    // 1) 임베딩 기반 유사도
    // -------------------------
    const questionVec = await getEmbedding(q);

    const contentSentences = content ? selectTopKSentences(q, splitSentencesKo(content), CONFIG.TOP_K_CONTENT) : [];
    const answerSentences = answer ? selectTopKSentences(q, splitSentencesKo(answer), CONFIG.TOP_K_ANSWER) : [];

    const [contentVecs, answerVecs] = await Promise.all([
      mapWithConcurrency(contentSentences, CONFIG.EMBEDDING_CONCURRENCY, getEmbedding),
      mapWithConcurrency(answerSentences, CONFIG.EMBEDDING_CONCURRENCY, getEmbedding),
    ]);

    const simContentMax = contentVecs.length ? maxSimilarity(questionVec, contentVecs) : 0;
    const simAnswerMax = answerVecs.length ? maxSimilarity(questionVec, answerVecs) : 0;

    const simContentAvg = contentVecs.length ? avgSimilarity(questionVec, contentVecs) : 0;
    const simAnswerAvg = answerVecs.length ? avgSimilarity(questionVec, answerVecs) : 0;

    // -------------------------
    // 2) 부정/모달리티 보정
    // -------------------------
    const qNeg = hasNegation(q);
    const qMod = hasModality(q);

    const aNeg = answerSentences.some(hasNegation);
    const aMod = answerSentences.some(hasModality);

    let simAnswerAdj = simAnswerMax;
    let simContentAdj = simContentMax;

    // 부정 질문 처리: "죽이지 않았나요?" 같은 질문은 답변을 반전시켜야 함
    // 질문에 부정이 있고, 정답에 부정이 없으면 -> 유사도를 반전
    // 예: Q: "죽이지 않았나요?" (부정) + A: "죽였다" (긍정) -> NO가 되어야 함
    if (qNeg && !aNeg) {
      // 부정 질문에 긍정 답변 -> 유사도를 반전 (높은 유사도 = NO, 낮은 유사도 = YES)
      simAnswerAdj = 1 - simAnswerAdj;
      simContentAdj = 1 - simContentAdj;
    } else if (qNeg !== aNeg) {
      // 부정이 일치하지 않으면 페널티
      simAnswerAdj -= CONFIG.ADJUST.NEGATION_MISMATCH_PENALTY;
    }
    
    if (qMod !== aMod) simAnswerAdj -= CONFIG.ADJUST.MODALITY_MISMATCH_PENALTY;

    // -------------------------
    // 3) ✅ 엔티티/추론 매칭 보정
    // -------------------------
    const conceptMatched = [...qEntities].some(e => aEntities.has(e));
    if (conceptMatched) simAnswerAdj += CONFIG.ADJUST.CONCEPT_MATCH_BONUS;

    // 질문이 accident/intentional 같은 상위개념이고, infer로 정답에서 도출되면 보너스
    const inferMatched = (qEntities.has("accident") && aEntities.has("accident")) ||
                         (qEntities.has("intentional") && aEntities.has("intentional"));
    if (inferMatched) simAnswerAdj += CONFIG.ADJUST.INFER_MATCH_BONUS;

    // "부위/부분/전체" 같은 일반화 질문인데 정답은 더 좁은 엔티티(예: nail)만 있을 때 NO 쪽으로 밀기
    // (이미 shouldForceNoByOntology로 많은 케이스를 잡았지만, 여기선 점수 보정으로도 처리)
    if (isGeneralizationQuestion(q)) {
      // 질문이 parent, 정답이 child만 있을 때
      const qHasParent = [...qEntities].some(parent => (ONTOLOGY[parent]?.length ?? 0) > 0);
      const aHasChildOnly = [...aEntities].some(child => {
        // 어떤 parent의 child인지
        return Object.keys(ONTOLOGY).some(parentKey => {
          const parentStr = parentKey as string;
          return isParentOf(parentStr, child) && !aEntities.has(parentStr);
        });
      });

      if (qHasParent && aHasChildOnly && !conceptMatched) {
        // YES를 약화시키고 NO를 강화 (간접)
        simContentAdj += CONFIG.ADJUST.GENERALIZATION_NO_BONUS;
        simAnswerAdj -= CONFIG.ADJUST.GENERALIZATION_NO_BONUS * 0.6;
      }
    }

    // clamp
    simAnswerAdj = Math.max(-1, Math.min(1, simAnswerAdj));
    simContentAdj = Math.max(-1, Math.min(1, simContentAdj));

    // 최종 점수(최대/평균 혼합)
    const simAnswerFinal = simAnswerAdj * 0.7 + simAnswerAvg * 0.3;
    const simContentFinal = simContentAdj * 0.7 + simContentAvg * 0.3;

    // -------------------------
    // 4) 판정
    // -------------------------
    if (
      simAnswerFinal >= CONFIG.THRESHOLD.DECISIVE_ANSWER &&
      simContentFinal >= CONFIG.THRESHOLD.DECISIVE_CONTENT
    ) return "decisive";

    if (simAnswerFinal >= CONFIG.THRESHOLD.YES) return "yes";

    if (simContentFinal >= CONFIG.THRESHOLD.NO_CONTENT && simAnswerFinal <= CONFIG.THRESHOLD.NO_ANSWER_MAX) {
      return "no";
    }

    if (simAnswerFinal <= CONFIG.THRESHOLD.IRRELEVANT_MAX && simContentFinal <= CONFIG.THRESHOLD.IRRELEVANT_MAX) {
      return "irrelevant";
    }

    // -------------------------
    // 5) 애매하면 fallbackJudge(옵션)
    // -------------------------
    const inAmbiguous =
      simAnswerFinal >= CONFIG.AMBIGUOUS_RANGE.min && simAnswerFinal <= CONFIG.AMBIGUOUS_RANGE.max;

    if (inAmbiguous && fallbackJudge) {
      const fb = await fallbackJudge({ question: q, problemContent: content, problemAnswer: answer });
      if (fb) return fb;
    }

    // 기본 fallback
    return simAnswerFinal >= simContentFinal ? "yes" : "no";
  } catch (e) {
    console.error("analyzeQuestionSemanticV7 error:", e);
    return "irrelevant";
  }
}

// 하위 호환 alias
export async function analyzeQuestion(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<JudgeResult> {
  return analyzeQuestionSemanticV7(question, problemContent, problemAnswer);
}

export async function initializeModel(): Promise<void> {
  try {
    if (typeof window !== "undefined") await loadEmbeddingModel();
  } catch (e) {
    console.error("initializeModel error:", e);
  }
}

export function releaseModel(): void {
  embeddingPipeline = null;
  isModelLoading = false;
  modelLoadPromise = null;
}

export function clearCache(): void {
  embeddingCache.clear();
}

// -------------------------
// 정답 유사도 계산 (0~100%)
// -------------------------
export async function calculateAnswerSimilarity(
  userAnswer: string,
  correctAnswer: string
): Promise<number> {
  const ua = normalizeText(userAnswer);
  const ca = normalizeText(correctAnswer);
  if (!ua || !ca) return 0;

  try {
    const userEmbedding = await getEmbedding(ua);
    const correctEmbedding = await getEmbedding(ca);

    const similarity = cosineSimilarity(userEmbedding, correctEmbedding);
    
    // 비선형 보정: 높은 유사도 구간을 더 잘 구분
    let adjustedSimilarity = similarity;
    if (similarity > 0.8) {
      adjustedSimilarity = 0.8 + (similarity - 0.8) * 1.2;
    } else if (similarity > 0.5) {
      adjustedSimilarity = similarity;
    } else {
      adjustedSimilarity = similarity * 0.9;
    }
    
    const percentage = Math.max(0, Math.min(100, adjustedSimilarity * 100));
    return Math.round(percentage * 10) / 10;
  } catch (error) {
    console.error("정답 유사도 계산 오류:", error);
    return calculateSimpleMatch(userAnswer, correctAnswer);
  }
}

// 폴백 문자열 매칭
function calculateSimpleMatch(userAnswer: string, correctAnswer: string): number {
  const userWords = normalizeText(userAnswer).toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const correctWords = normalizeText(correctAnswer).toLowerCase().split(/\s+/).filter(w => w.length > 0);

  if (correctWords.length === 0) return 0;

  // 정확한 단어 매칭
  const matchedWords = userWords.filter(word =>
    correctWords.some(correctWord => correctWord.includes(word) || word.includes(correctWord))
  ).length;
  const wordMatchRatio = matchedWords / Math.max(correctWords.length, userWords.length);

  // 부분 문자열 매칭
  const userLower = normalizeText(userAnswer).toLowerCase();
  const correctLower = normalizeText(correctAnswer).toLowerCase();
  
  let substringMatch = 0;
  if (userLower && correctLower) {
    if (correctLower.includes(userLower) || userLower.includes(correctLower)) {
      substringMatch = Math.min(0.8, Math.max(userLower.length, correctLower.length) / Math.min(userLower.length, correctLower.length) * 0.4);
    }
  }

  // 문자 레벨 유사도
  let charSimilarity = 0;
  if (userLower && correctLower) {
    const maxLen = Math.max(userLower.length, correctLower.length);
    const minLen = Math.min(userLower.length, correctLower.length);
    if (maxLen > 0) {
      let matches = 0;
      for (let i = 0; i < minLen; i++) {
        if (userLower[i] === correctLower[i]) matches++;
      }
      charSimilarity = (matches / maxLen) * 0.3;
    }
  }

  // 종합 점수 (가중 평균)
  const similarity = (wordMatchRatio * 0.5 + substringMatch * 0.3 + charSimilarity * 0.2) * 100;
  return Math.round(similarity * 10) / 10;
}

// 하위 호환: analyzeQuestionSemantic도 export
export async function analyzeQuestionSemantic(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<JudgeResult> {
  return analyzeQuestionSemanticV7(question, problemContent, problemAnswer);
}
