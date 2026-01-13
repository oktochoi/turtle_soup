// AI 질문 분석기 - Semantic + Problem-Knowledge Engine V8.7 (Synonym + Antonym + Ontology + Quantity)
// 목표:
// - 문제별(콘텐츠+정답) 지식(ProblemKnowledge)을 1회 생성해서 질문 판정을 안정화/고속화
// - 유의어 사전 수동 관리 최소화(문제 내부에서 embedding으로 자동 확장)
// - 반의어(대립 개념) 감지로 "임베딩이 반의어도 가깝게 보는" 문제 방어
// - 부분-전체(손 vs 손톱) / 양쪽-한쪽(양발 vs 한발) 같은 일반화 질문을 NO로 안정화
// - (옵션) 애매 + 모순 의심 구간에서만 fallbackJudge(NLI/LLM) 호출
//
// 실행 환경: Next.js/Vercel 브라우저 (@xenova/transformers)
// 주의: 형태소 분석은 브라우저에서 무거움 → roughStemKo + embedding 기반으로 커버

type Pipeline = any;

export type JudgeResult = "yes" | "no" | "irrelevant" | "decisive";

const CONFIG = {
  TOP_K_CONTENT: 16,
  TOP_K_ANSWER: 16,
  EMBEDDING_CONCURRENCY: 4,

  CACHE_MAX: 2500,
  CACHE_TTL_MS: 1000 * 60 * 60 * 12,

  MIN_QUESTION_LEN: 4,
  MAX_QUESTION_LEN: 420,

  THRESHOLD: {
    DECISIVE_ANSWER: 0.70,
    DECISIVE_CONTENT: 0.38,
    YES: 0.60,
    NO_CONTENT: 0.44,
    NO_ANSWER_MAX: 0.32,
    IRRELEVANT_MAX: 0.26,
  },

  ADJUST: {
    CONCEPT_MATCH_BONUS: 0.10,
    INFER_MATCH_BONUS: 0.08,
    GENERALIZATION_NO_BONUS: 0.22,

    // ✅ Antonym / contradiction control
    ANTONYM_PENALTY: 0.30,
    ANTONYM_FORCE_NO_SIM: 0.55,
  },

  LEXICON: {
    SYNONYM_SIM_THRESHOLD: 0.72,
    MAX_SYNONYMS_PER_TOKEN: 6,
    MAX_TOKENS: 120,
    MIN_TOKEN_LEN: 2,
  },

  AMBIGUOUS_RANGE: { min: 0.40, max: 0.62 },
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
// 텍스트 정규화 / 토큰화 (가벼운 한국어 대응)
// -------------------------
function normalizeText(text: string): string {
  return (text ?? "")
    .replace(/\u200B/g, "")
    .replace(/[\u200C\u200D\uFEFF]/g, "")
    .replace(/[“”"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

function tokenizeKo(text: string): string[] {
  const t = normalizeText(text).toLowerCase();
  if (!t) return [];
  const raw = t.split(/\s+/).filter(Boolean);

  const tokens: string[] = [];
  for (const r of raw) {
    const s = roughStemKo(r);
    if (!s) continue;
    if (s.length < CONFIG.LEXICON.MIN_TOKEN_LEN) continue;
    tokens.push(s);
  }
  return tokens.slice(0, CONFIG.LEXICON.MAX_TOKENS);
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
  const qTokens = tokenizeKo(question);
  const sTokens = new Set(tokenizeKo(sentence));
  if (!qTokens.length) return 0;

  let hits = 0;
  for (const t of qTokens) if (sTokens.has(t)) hits++;

  let partial = 0;
  const sLower = normalizeText(sentence).toLowerCase();
  for (const t of qTokens) if (t.length >= 2 && sLower.includes(t)) partial += 0.35;

  const exact = hits / qTokens.length;
  const part = Math.min(0.8, partial / qTokens.length);
  return exact * 0.7 + part * 0.3;
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
// 부정(negation) 처리: 질문 정규화 + 최종 라벨 invert
// -------------------------
const NEGATION_PATTERNS = [
  "아니",
  "아니다",
  "아닌",
  "안 ",
  "못 ",
  "없",
  "전혀",
  "절대",
  "결코",
  "지 않",
  "지않",
  "지 못",
  "지못",
  "하지 않",
  "하지않",
  "하지 못",
  "하지못",
  "않았",
  "않는",
  "않을",
  "못했",
  "못하는",
  "못할",
  "안 했",
  "안했",
  "안 하는",
  "안하는",
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

function normalizeNegationQuestion(question: string): { normalized: string; invert: boolean } {
  const q = normalizeText(question);
  if (!q) return { normalized: q, invert: false };
  if (!hasNegation(q)) return { normalized: q, invert: false };

  let nq = q;
  nq = nq.replace(/지\s*않/g, "");
  nq = nq.replace(/지않/g, "");
  nq = nq.replace(/안\s*/g, "");
  nq = nq.replace(/못\s*/g, "");
  nq = nq.replace(/없/g, "있");
  nq = normalizeText(nq);

  return { normalized: nq || q, invert: true };
}

// -------------------------
// 최소 전역 온톨로지 (part_of/is_a)
// -------------------------
type OntologyEdge = { parent: string; child: string; rel: "part_of" | "is_a" };

const GLOBAL_ONTOLOGY: OntologyEdge[] = [
  { parent: "손", child: "손가락", rel: "part_of" },
  { parent: "손가락", child: "손톱", rel: "part_of" },
  { parent: "발", child: "발가락", rel: "part_of" },
  { parent: "발가락", child: "발톱", rel: "part_of" },
  { parent: "얼굴", child: "눈", rel: "part_of" },
  { parent: "얼굴", child: "입", rel: "part_of" },
];

// -------------------------
// 전역 유의어 사전 (일반적인 유의어 쌍)
// -------------------------
const GLOBAL_SYNONYMS: Map<string, string[]> = new Map([
  ["살인자", ["범인", "가해자", "범죄자", "죄인"]],
  ["범인", ["살인자", "가해자", "범죄자", "죄인"]],
  ["가해자", ["살인자", "범인", "범죄자", "죄인"]],
  ["범죄자", ["살인자", "범인", "가해자", "죄인"]],
  ["죄인", ["살인자", "범인", "가해자", "범죄자"]],
  ["피해자", ["희생자", "사망자"]],
  ["희생자", ["피해자", "사망자"]],
  ["사망자", ["피해자", "희생자"]],
  ["여자", ["여성", "여인", "여성분"]],
  ["여성", ["여자", "여인", "여성분"]],
  ["남자", ["남성", "남성분"]],
  ["남성", ["남자", "남성분"]],
  ["아이", ["어린이", "소년", "소녀", "아동"]],
  ["어린이", ["아이", "소년", "소녀", "아동"]],
  ["소년", ["아이", "어린이", "아동"]],
  ["소녀", ["아이", "어린이", "아동"]],
  ["아동", ["아이", "어린이", "소년", "소녀"]],
  ["차", ["자동차", "승용차", "차량"]],
  ["자동차", ["차", "승용차", "차량"]],
  ["차량", ["차", "자동차", "승용차"]],
  ["집", ["집안", "집안에", "가정", "주택"]],
  ["집안", ["집", "가정", "주택"]],
  ["가정", ["집", "집안", "주택"]],
]);

const GENERALIZATION_HINTS = [
  "부위",
  "부분",
  "전체",
  "전반",
  "어느",
  "어떤 부위",
  "어떤 부분",
  "무슨 부위",
  "무슨 부분",
  "어디",
  "양발",
  "양쪽",
  "양쪽에",
  "양발에",
  "둘 다",
  "모두",
  "전부",
  "모든",
  "전체에",
  "양손",
  "양손에",
];

// quantity hints
const QUANTITY_SPECIFIC_HINTS = ["양발", "양쪽", "양쪽에", "양발에", "둘 다", "모두", "전부", "모든", "양손", "양손에"];
const SINGLE_SPECIFIC_HINTS = ["한쪽", "한쪽에", "하나만", "하나", "단 하나", "한 발", "한 손"];

type QuantityPattern = {
  quantity: string[];
  single: string[];
  context: string;
};

function extractQuantityPatterns(content: string, answer: string): QuantityPattern[] {
  const text = normalizeText(`${content} ${answer}`).toLowerCase();

  const baseQuantity = [...QUANTITY_SPECIFIC_HINTS];
  const baseSingle = [...SINGLE_SPECIFIC_HINTS];

  const quantityMatches: string[] = [];
  const singleMatches: string[] = [];

  const quantityRegex =
    /(양\s*[발손쪽]|둘\s*다|모두|전부|모든|양\s*쪽|양\s*발|양\s*손|양쪽\s*모두|양쪽\s*전부|양\s*발\s*모두|양\s*손\s*모두)/gi;
  const quantityFound = text.match(quantityRegex);
  if (quantityFound) {
    quantityFound.forEach(m => {
      const cleaned = m.trim().toLowerCase().replace(/\s+/g, "");
      const withSpace = m.trim().toLowerCase();
      [cleaned, withSpace].forEach(variant => {
        if (!baseQuantity.includes(variant) && !quantityMatches.includes(variant)) quantityMatches.push(variant);
      });
    });
  }

  const singleRegex =
    /(한\s*[쪽발손]|하나\s*만|단\s*하나|한\s*쪽|한\s*발|한\s*손|한쪽\s*에만|한\s*쪽에만|한\s*발에만|한\s*손에만)/gi;
  const singleFound = text.match(singleRegex);
  if (singleFound) {
    singleFound.forEach(m => {
      const cleaned = m.trim().toLowerCase().replace(/\s+/g, "");
      const withSpace = m.trim().toLowerCase();
      [cleaned, withSpace].forEach(variant => {
        if (!baseSingle.includes(variant) && !singleMatches.includes(variant)) singleMatches.push(variant);
      });
    });
  }

  return [
    {
      quantity: [...baseQuantity, ...quantityMatches],
      single: [...baseSingle, ...singleMatches],
      context: text.substring(0, 150),
    },
  ];
}

// auto ontology edges from tokens (very light heuristic)
function extractAutoOntologyEdges(
  content: string,
  answer: string,
  contentTokens: string[],
  answerTokens: string[]
): OntologyEdge[] {
  const edges: OntologyEdge[] = [];
  const allTokens = [...new Set([...contentTokens, ...answerTokens])];
  const text = normalizeText(`${content} ${answer}`).toLowerCase();

  const partWholeKeywords = ["부위", "부분", "전체", "안에", "속에", "포함"];
  const hasPartWholeContext = partWholeKeywords.some(kw => text.includes(kw));
  if (!hasPartWholeContext) return edges;

  const existing = new Set(GLOBAL_ONTOLOGY.map(e => `${e.parent}::${e.child}`));

  for (let i = 0; i < allTokens.length; i++) {
    for (let j = i + 1; j < allTokens.length; j++) {
      const t1 = allTokens[i];
      const t2 = allTokens[j];

      if (t1.includes(t2) && t1.length > t2.length && t2.length >= 2) {
        const key = `${t1}::${t2}`;
        if (!existing.has(key) && text.includes(t1) && text.includes(t2)) edges.push({ parent: t1, child: t2, rel: "part_of" });
      } else if (t2.includes(t1) && t2.length > t1.length && t1.length >= 2) {
        const key = `${t2}::${t1}`;
        if (!existing.has(key) && text.includes(t1) && text.includes(t2)) edges.push({ parent: t2, child: t1, rel: "part_of" });
      }
    }
  }
  return edges;
}

// -------------------------
// Antonym axes (global minimal) + per-problem activation
// -------------------------
type AntonymAxis = { label: string; pos: string[]; neg: string[] };

const GLOBAL_ANTONYM_AXES: AntonymAxis[] = [
  { label: "alive/dead", pos: ["살", "생존", "살아", "살아있"], neg: ["죽", "사망", "시체", "숨졌"] },
  { label: "open/closed", pos: ["열", "열려", "개방", "열림"], neg: ["닫", "잠겨", "폐쇄", "닫힘"] },
  { label: "possible/impossible", pos: ["가능", "할수있", "될수있"], neg: ["불가능", "할수없", "안되", "못하"] },
  { label: "exist/not", pos: ["있", "존재"], neg: ["없", "부재"] },
  { label: "intentional/accident", pos: ["고의", "일부러", "의도", "계획"], neg: ["사고", "우발", "실수", "뜻하지"] },
];

function axisAppearsInProblem(axis: AntonymAxis, text: string): boolean {
  const t = normalizeText(text).toLowerCase();
  const hasPos = axis.pos.some(r => t.includes(r));
  const hasNeg = axis.neg.some(r => t.includes(r));
  return hasPos && hasNeg;
}

function buildActiveAntonymAxes(content: string, answer: string): AntonymAxis[] {
  const text = `${content} ${answer}`;
  const active = GLOBAL_ANTONYM_AXES.filter(ax => axisAppearsInProblem(ax, text));

  const mustKeep = new Set(["alive/dead", "open/closed", "possible/impossible"]);
  for (const ax of GLOBAL_ANTONYM_AXES) {
    if (mustKeep.has(ax.label) && !active.some(a => a.label === ax.label)) active.push(ax);
  }
  return active;
}

// exist/not gating (avoid high false positives)
const EXIST_POS_ROOTS = ["있", "존재"];
const EXIST_NEG_ROOTS = ["없", "부재"];

function hasExistTargetContext(text: string): boolean {
  const tokens = tokenizeKo(text);
  if (tokens.length < 2) return false;

  const hasExist = tokens.some(
    t => EXIST_POS_ROOTS.some(r => t.includes(r)) || EXIST_NEG_ROOTS.some(r => t.includes(r))
  );
  if (!hasExist) return false;

  const hasTarget = tokens.some(
    t =>
      t.length >= 2 &&
      !EXIST_POS_ROOTS.some(r => t.includes(r)) &&
      !EXIST_NEG_ROOTS.some(r => t.includes(r))
  );

  return hasTarget;
}

// 반의어(대립 개념) 감지 - 텍스트 기반
// 목표: "임베딩이 반의어도 가깝게 보는" 문제 방어
// - 문제별로 활성화된 반의어 축(antonymAxes)을 사용하여 질문-답변 간 대립 감지
function detectAntonymMismatchByTextV87(
  question: string,
  answer: string,
  activeAxes: AntonymAxis[]
): { hit: boolean; label?: string } {
  const q = normalizeText(question).toLowerCase();
  const a = normalizeText(answer).toLowerCase();

  for (const axis of activeAxes) {
    if (axis.label === "exist/not") {
      if (!hasExistTargetContext(question) && !hasExistTargetContext(answer)) continue;
    }

    const qPos = axis.pos.some(x => q.includes(x));
    const qNeg = axis.neg.some(x => q.includes(x));
    const aPos = axis.pos.some(x => a.includes(x));
    const aNeg = axis.neg.some(x => a.includes(x));

    if ((qPos && aNeg) || (qNeg && aPos)) return { hit: true, label: axis.label };
  }
  return { hit: false };
}

// 반의어(대립 개념) 감지 - 개념 기반
// 목표: "임베딩이 반의어도 가깝게 보는" 문제 방어
// - 질문과 답변의 개념 집합에서 반의어 축의 양극단이 대립되는지 확인
function detectAntonymMismatchByConceptsV87(
  qConcepts: Set<string>,
  aConcepts: Set<string>,
  activeAxes: AntonymAxis[],
  questionRaw: string,
  answerRaw: string
): { hit: boolean; label?: string } {
  const qArr = [...qConcepts];
  const aArr = [...aConcepts];

  for (const axis of activeAxes) {
    if (axis.label === "exist/not") {
      if (!hasExistTargetContext(questionRaw) && !hasExistTargetContext(answerRaw)) continue;
    }

    const qPos = axis.pos.some(root => qArr.some(c => c.includes(root)));
    const qNeg = axis.neg.some(root => qArr.some(c => c.includes(root)));
    const aPos = axis.pos.some(root => aArr.some(c => c.includes(root)));
    const aNeg = axis.neg.some(root => aArr.some(c => c.includes(root)));

    if ((qPos && aNeg) || (qNeg && aPos)) return { hit: true, label: axis.label };
  }
  return { hit: false };
}

// -------------------------
// ProblemKnowledge
// -------------------------
export type ProblemKnowledge = {
  content: string;
  answer: string;

  contentSentences: string[];
  answerSentences: string[];

  contentTokens: string[];
  answerTokens: string[];

  synonymMap: Map<string, string[]>;
  antonymMap: Map<string, string[]>; // (reserved, optional future)
  antonymAxes: AntonymAxis[]; // ✅ active axes per problem

  entitySet: Set<string>;
  ontology: OntologyEdge[];

  inferredConcepts: Set<string>;
  quantityPatterns: QuantityPattern[];
};

export type KnowledgeBuilderLLM = (args: { content: string; answer: string }) => Promise<{
  entities?: string[];
  ontologyEdges?: OntologyEdge[];
  concepts?: string[];
} | null>;

// -------------------------
// Embedding / Similarity
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
  if (Array.isArray(output)) return new Float32Array(output.flat(Infinity) as number[]);
  if (output && typeof output === "object") return new Float32Array(Object.values(output).flat(Infinity) as number[]);
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
// 상위개념 추론(룰 최소)
// -------------------------
function inferConceptsFromTokens(tokens: string[]): Set<string> {
  const tset = new Set(tokens);
  const concepts = new Set<string>();

  const hasBrake = [...tset].some(t => t.includes("브레이크") || t.includes("제동"));
  const hasFail = [...tset].some(t => t.includes("고장") || t.includes("불량") || t.includes("망가") || t.includes("안되"));
  const hasCrash = [...tset].some(t => t.includes("추락") || t.includes("충돌") || t.includes("가드레일") || t.includes("넘어") || t.includes("떨어"));
  const hasRun = [...tset].some(t => t.includes("도주") || t.includes("도망") || t.includes("질주") || t.includes("달리"));

  if (hasBrake && hasFail && (hasCrash || hasRun)) concepts.add("accident");

  const hasIntent = [...tset].some(t => t.includes("고의") || t.includes("의도") || t.includes("계획") || t.includes("일부러"));
  if (hasIntent) concepts.add("intentional");

  return concepts;
}

// -------------------------
// Ontology utils
// -------------------------
function isGeneralizationQuestion(text: string): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  return GENERALIZATION_HINTS.some(h => t.includes(h));
}

function buildAdjList(edges: OntologyEdge[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of edges) {
    if (e.rel !== "part_of" && e.rel !== "is_a") continue;
    if (!m.has(e.parent)) m.set(e.parent, []);
    m.get(e.parent)!.push(e.child);
  }
  return m;
}

function isParentOf(parent: string, child: string, adj: Map<string, string[]>, depth = 3): boolean {
  if (depth <= 0) return false;
  const kids = adj.get(parent) ?? [];
  if (kids.includes(child)) return true;
  for (const k of kids) {
    if (isParentOf(k, child, adj, depth - 1)) return true;
  }
  return false;
}

// quantity mismatch
function hasQuantityMismatch(question: string, answerText: string, quantityPatterns: QuantityPattern[] = []): boolean {
  const qNorm = normalizeText(question).toLowerCase();
  const aNorm = normalizeText(answerText).toLowerCase();

  if (quantityPatterns.length > 0) {
    for (const pattern of quantityPatterns) {
      const hasQuantityQuestion = pattern.quantity.some(h => qNorm.includes(h.toLowerCase()));
      if (!hasQuantityQuestion) continue;

      const hasSingleAnswer = pattern.single.some(h => aNorm.includes(h.toLowerCase()));
      if (hasSingleAnswer) return true;

      const hasAnySingle = pattern.single.some(h => {
        const hLower = h.toLowerCase();
        return aNorm.includes(hLower) || aNorm.includes(hLower.replace(/\s+/g, ""));
      });
      if (hasAnySingle) return true;
    }
  }

  const hasQuantityQuestion = QUANTITY_SPECIFIC_HINTS.some(h => qNorm.includes(h.toLowerCase()));
  if (!hasQuantityQuestion) return false;

  const hasSingleAnswer = SINGLE_SPECIFIC_HINTS.some(h => aNorm.includes(h.toLowerCase()));
  if (hasSingleAnswer) return true;

  if (aNorm.includes("한쪽") || aNorm.includes("하나만") || aNorm.includes("단 하나")) return true;

  return false;
}

// ontology/quantity force NO
// 목표: 부분-전체(손 vs 손톱) / 양쪽-한쪽(양발 vs 한발) 같은 일반화 질문을 NO로 안정화
// - 수량 불일치(양발 질문 vs 한쪽 답변) 우선 검사
// - 일반화 질문에서 부분-전체 관계가 맞지 않으면 NO 반환
function shouldForceNoByOntologyV8(
  question: string,
  qConcepts: Set<string>,
  aConcepts: Set<string>,
  ontology: OntologyEdge[],
  answerText: string,
  quantityPatterns: QuantityPattern[] = []
): boolean {
  if (hasQuantityMismatch(question, answerText, quantityPatterns)) return true;

  const generalized = isGeneralizationQuestion(question);
  if (!generalized) return false;

  const adj = buildAdjList(ontology);

  for (const q of qConcepts) {
    for (const a of aConcepts) {
      if (q === a) continue;
      if (isParentOf(q, a, adj, 3)) {
        const answerHasParent = aConcepts.has(q);
        if (!answerHasParent) return true;
      }
    }
  }
  return false;
}

// -------------------------
// Build ProblemKnowledge (one-time per problem)
// 목표: 문제별(콘텐츠+정답) 지식을 1회 생성해서 질문 판정을 안정화/고속화
// - 토큰화, 엔티티 추출, 온톨로지 구축, 수량 패턴 추출 등을 한 번에 수행
// - 이후 analyzeQuestionV8에서 재사용하여 성능 최적화
// -------------------------
export async function buildProblemKnowledge(
  problemContent: string,
  problemAnswer: string,
  llmBuilder?: KnowledgeBuilderLLM
): Promise<ProblemKnowledge> {
  const content = normalizeText(problemContent ?? "");
  const answer = normalizeText(problemAnswer ?? "");

  const contentSentences = content ? splitSentencesKo(content) : [];
  const answerSentences = answer ? splitSentencesKo(answer) : [];

  const contentTokens = content ? tokenizeKo(content) : [];
  const answerTokens = answer ? tokenizeKo(answer) : [];

  const freq = new Map<string, number>();
  for (const t of [...contentTokens, ...answerTokens]) freq.set(t, (freq.get(t) ?? 0) + 1);

  const entityCandidates = [...freq.entries()]
    .filter(([t]) => t.length >= 2 && !/^\d+$/.test(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([t]) => t);

  const entitySet = new Set(entityCandidates);

  let ontology: OntologyEdge[] = [...GLOBAL_ONTOLOGY];

  const inferredConcepts = inferConceptsFromTokens([...contentTokens, ...answerTokens]);

  const quantityPatterns = extractQuantityPatterns(content, answer);

  const autoOntologyEdges = extractAutoOntologyEdges(content, answer, contentTokens, answerTokens);
  ontology = ontology.concat(autoOntologyEdges);

  if (llmBuilder) {
    try {
      const extra = await llmBuilder({ content, answer });
      if (extra?.entities?.length) extra.entities.forEach(e => entitySet.add(e));
      if (extra?.ontologyEdges?.length) ontology = ontology.concat(extra.ontologyEdges);
      if (extra?.concepts?.length) extra.concepts.forEach(c => inferredConcepts.add(c));
    } catch {
      // ignore
    }
  }

  const synonymMap = new Map<string, string[]>();
  const antonymMap = new Map<string, string[]>();
  const antonymAxes = buildActiveAntonymAxes(content, answer);

  return {
    content,
    answer,
    contentSentences,
    answerSentences,
    contentTokens,
    answerTokens,
    synonymMap,
    antonymMap,
    antonymAxes,
    entitySet,
    ontology,
    inferredConcepts,
    quantityPatterns,
  };
}

// -------------------------
// Synonym expansion (per problem, lazy)
// 목표: 유의어 사전 수동 관리 최소화 - 문제 내부에서 embedding으로 자동 확장
// - 전역 유의어 사전을 먼저 확인 (살인자-범인 등 일반적인 유의어)
// - 문제의 entitySet 내에서 embedding 유사도 기반으로 동적 유의어 발견
// - CONFIG.LEXICON.SYNONYM_SIM_THRESHOLD 이상의 유사도를 가진 토큰들을 유의어로 확장
// -------------------------
async function getOrBuildSynonymsForToken(token: string, knowledge: ProblemKnowledge): Promise<string[]> {
  const key = token;
  const cached = knowledge.synonymMap.get(key);
  if (cached) return cached;

  // 1) 전역 유의어 사전 확인 (우선 적용)
  const globalSyns = GLOBAL_SYNONYMS.get(token);
  const synonyms: string[] = globalSyns ? [...globalSyns] : [];

  // 2) 문제 내부 entitySet에서 embedding 기반 유의어 찾기
  const candidates = [...knowledge.entitySet].filter(t => t !== token && !synonyms.includes(t));
  if (candidates.length > 0) {
    const tokenVec = await getEmbedding(token);
    const picked: { t: string; s: number }[] = [];

    const limited = candidates.slice(0, 120);
    for (const c of limited) {
      const cVec = await getEmbedding(c);
      const s = cosineSimilarity(tokenVec, cVec);
      if (s >= CONFIG.LEXICON.SYNONYM_SIM_THRESHOLD) picked.push({ t: c, s });
    }

    picked.sort((a, b) => b.s - a.s);
    const embeddingSyns = picked.slice(0, CONFIG.LEXICON.MAX_SYNONYMS_PER_TOKEN).map(x => x.t);
    synonyms.push(...embeddingSyns);
  }

  // 전역 유의어와 embedding 유의어를 합쳐서 최대 개수 제한
  const out = synonyms.slice(0, CONFIG.LEXICON.MAX_SYNONYMS_PER_TOKEN + (globalSyns?.length ?? 0));

  knowledge.synonymMap.set(key, out);
  return out;
}

async function extractQuestionConcepts(question: string, knowledge: ProblemKnowledge): Promise<Set<string>> {
  const qTokens = tokenizeKo(question);
  const concepts = new Set<string>();

  for (const t of qTokens) concepts.add(t);

  for (const t of qTokens) {
    const syns = await getOrBuildSynonymsForToken(t, knowledge);
    syns.forEach(s => concepts.add(s));
  }

  const qNorm = normalizeText(question);
  if (qNorm.includes("사고") || qNorm.includes("우발") || qNorm.includes("실수")) concepts.add("accident");
  if (qNorm.includes("고의") || qNorm.includes("일부러") || qNorm.includes("의도") || qNorm.includes("계획")) concepts.add("intentional");

  return concepts;
}

function extractAnswerConcepts(knowledge: ProblemKnowledge): Set<string> {
  const s = new Set<string>(knowledge.answerTokens);
  knowledge.inferredConcepts.forEach(c => s.add(c));
  return s;
}

// -------------------------
// Fallback hook (optional)
// -------------------------
export type FallbackJudge = (args: {
  question: string;
  problemContent: string;
  problemAnswer: string;
}) => Promise<JudgeResult | null>;

// -------------------------
// V8.7 main judge (question + knowledge)
// 목표: ProblemKnowledge를 재사용하여 안정적이고 빠른 질문 판정
// - 반의어 감지, 온톨로지 기반 NO 강제, 수량 불일치 검사
// - (옵션) 애매 + 모순 의심 구간에서만 fallbackJudge 호출
// -------------------------
export async function analyzeQuestionV8(
  questionRaw: string,
  knowledge: ProblemKnowledge,
  fallbackJudge?: FallbackJudge
): Promise<JudgeResult> {
  try {
    if (!questionRaw || typeof questionRaw !== "string") return "irrelevant";

    const q0 = normalizeText(questionRaw);
    if (q0.length < CONFIG.MIN_QUESTION_LEN) return "irrelevant";

    const qCut = q0.length > CONFIG.MAX_QUESTION_LEN ? q0.slice(0, CONFIG.MAX_QUESTION_LEN) : q0;

    if (typeof window === "undefined") return "irrelevant";
    if (!knowledge.content && !knowledge.answer) return "irrelevant";

    // 0) negation normalize
    const { normalized: q, invert } = normalizeNegationQuestion(qCut);

    // 1) concepts (synonyms included)
    const qConcepts = await extractQuestionConcepts(q, knowledge);
    const aConcepts = extractAnswerConcepts(knowledge);

    // 1-0) antonym/contradiction check (per-problem active axes + exist gating)
    const antiText = detectAntonymMismatchByTextV87(q, knowledge.answer, knowledge.antonymAxes);
    const antiConcept = detectAntonymMismatchByConceptsV87(qConcepts, aConcepts, knowledge.antonymAxes, q, knowledge.answer);
    const hasAntonymMismatch = antiText.hit || antiConcept.hit;

    // 1-1) force NO by ontology / quantity mismatch
    if (shouldForceNoByOntologyV8(q, qConcepts, aConcepts, knowledge.ontology, knowledge.answer, knowledge.quantityPatterns)) {
      if (hasQuantityMismatch(q, knowledge.answer, knowledge.quantityPatterns)) return invert ? "yes" : "no";
      const hasExact = [...qConcepts].some(c => aConcepts.has(c));
      if (!hasExact) return invert ? "yes" : "no";
    }

    // 2) embeddings
    const questionVec = await getEmbedding(q);

    const contentTop = knowledge.content ? selectTopKSentences(q, knowledge.contentSentences, CONFIG.TOP_K_CONTENT) : [];
    const answerTop = knowledge.answer ? selectTopKSentences(q, knowledge.answerSentences, CONFIG.TOP_K_ANSWER) : [];

    const [contentVecs, answerVecs] = await Promise.all([
      mapWithConcurrency(contentTop, CONFIG.EMBEDDING_CONCURRENCY, getEmbedding),
      mapWithConcurrency(answerTop, CONFIG.EMBEDDING_CONCURRENCY, getEmbedding),
    ]);

    const simContentMax = contentVecs.length ? maxSimilarity(questionVec, contentVecs) : 0;
    const simAnswerMax = answerVecs.length ? maxSimilarity(questionVec, answerVecs) : 0;

    const simContentAvg = contentVecs.length ? avgSimilarity(questionVec, contentVecs) : 0;
    const simAnswerAvg = answerVecs.length ? avgSimilarity(questionVec, answerVecs) : 0;

    let simAnswerAdj = simAnswerMax;
    let simContentAdj = simContentMax;

    // ✅ antonym mismatch penalty (before rewarding synonyms)
    if (hasAntonymMismatch) {
      simAnswerAdj -= CONFIG.ADJUST.ANTONYM_PENALTY;
    }

    // 3) concept/infer bonus
    const conceptMatched = [...qConcepts].some(c => aConcepts.has(c));
    if (conceptMatched) simAnswerAdj += CONFIG.ADJUST.CONCEPT_MATCH_BONUS;

    const inferMatched =
      (qConcepts.has("accident") && aConcepts.has("accident")) ||
      (qConcepts.has("intentional") && aConcepts.has("intentional"));
    if (inferMatched) simAnswerAdj += CONFIG.ADJUST.INFER_MATCH_BONUS;

    // generalization push-to-NO
    if (isGeneralizationQuestion(q) && !conceptMatched) {
      simContentAdj += CONFIG.ADJUST.GENERALIZATION_NO_BONUS;
      simAnswerAdj -= CONFIG.ADJUST.GENERALIZATION_NO_BONUS * 0.55;
    }

    // modality mismatch small penalty
    const qMod = hasModality(q);
    const aMod = answerTop.some(hasModality);
    if (qMod !== aMod) simAnswerAdj -= 0.03;

    simAnswerAdj = Math.max(-1, Math.min(1, simAnswerAdj));
    simContentAdj = Math.max(-1, Math.min(1, simContentAdj));

    const simAnswerFinal = simAnswerAdj * 0.7 + simAnswerAvg * 0.3;
    const simContentFinal = simContentAdj * 0.7 + simContentAvg * 0.3;

    // ✅ If contradiction + high similarity => force NO (avoid synonym flip)
    if (hasAntonymMismatch && simAnswerFinal >= CONFIG.ADJUST.ANTONYM_FORCE_NO_SIM) {
      return invert ? "yes" : "no";
    }

    // 4) decision
    let result: JudgeResult;

    if (simAnswerFinal >= CONFIG.THRESHOLD.DECISIVE_ANSWER && simContentFinal >= CONFIG.THRESHOLD.DECISIVE_CONTENT) {
      result = "decisive";
    } else if (simAnswerFinal >= CONFIG.THRESHOLD.YES) {
      result = "yes";
    } else if (simContentFinal >= CONFIG.THRESHOLD.NO_CONTENT && simAnswerFinal <= CONFIG.THRESHOLD.NO_ANSWER_MAX) {
      result = "no";
    } else if (simAnswerFinal <= CONFIG.THRESHOLD.IRRELEVANT_MAX && simContentFinal <= CONFIG.THRESHOLD.IRRELEVANT_MAX) {
      result = "irrelevant";
    } else {
      const inAmbiguous = simAnswerFinal >= CONFIG.AMBIGUOUS_RANGE.min && simAnswerFinal <= CONFIG.AMBIGUOUS_RANGE.max;

      // ✅ fallback only when ambiguous AND contradiction suspected (주석 목표에 맞춤)
      if (inAmbiguous && fallbackJudge && hasAntonymMismatch) {
        const fb = await fallbackJudge({
          question: q,
          problemContent: knowledge.content,
          problemAnswer: knowledge.answer,
        });
        if (fb) result = fb;
        else result = simAnswerFinal >= simContentFinal ? "yes" : "no";
      } else {
        result = simAnswerFinal >= simContentFinal ? "yes" : "no";
      }
    }

    // 5) invert apply (decisive/irrelevant keep)
    if (invert && (result === "yes" || result === "no")) result = result === "yes" ? "no" : "yes";

    return result;
  } catch (e) {
    console.error("analyzeQuestionV8 error:", e);
    return "irrelevant";
  }
}

// -------------------------
// Compatibility wrapper (build knowledge internally)
// -------------------------
export async function analyzeQuestionSemanticV8(
  question: string,
  problemContent: string,
  problemAnswer: string,
  fallbackJudge?: FallbackJudge,
  llmBuilder?: KnowledgeBuilderLLM
): Promise<JudgeResult> {
  const knowledge = await buildProblemKnowledge(problemContent, problemAnswer, llmBuilder);
  return analyzeQuestionV8(question, knowledge, fallbackJudge);
}

export async function analyzeQuestion(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<JudgeResult> {
  return analyzeQuestionSemanticV8(question, problemContent, problemAnswer);
}

// -------------------------
// Model/cache management
// -------------------------
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
// Answer similarity (unchanged)
// -------------------------
export async function calculateAnswerSimilarity(
  userAnswer: string, 
  correctAnswer: string, 
  problemContent?: string
): Promise<number> {
  const ua = normalizeText(userAnswer);
  const ca = normalizeText(correctAnswer);
  if (!ua || !ca) return 0;

  try {
    const userEmbedding = await getEmbedding(ua);
    const correctEmbedding = await getEmbedding(ca);
    let similarity = cosineSimilarity(userEmbedding, correctEmbedding);

    // 문제 내용이 제공된 경우, 맥락 유사도도 고려
    if (problemContent) {
      const contentNormalized = normalizeText(problemContent);
      if (contentNormalized) {
        const contentEmbedding = await getEmbedding(contentNormalized);
        const contentUserSim = cosineSimilarity(contentEmbedding, userEmbedding);
        const contentCorrectSim = cosineSimilarity(contentEmbedding, correctEmbedding);
        
        // 맥락 유사도가 높으면 보너스 (맥락상 맞는 경우)
        if (contentUserSim > 0.5 && contentCorrectSim > 0.5) {
          const contextBonus = Math.min(0.15, (contentUserSim + contentCorrectSim) / 2 * 0.2);
          similarity = Math.min(1.0, similarity + contextBonus);
        }
      }
    }

    // 키워드 매칭 보너스
    const userWords = tokenizeKo(ua);
    const correctWords = tokenizeKo(ca);
    const correctSet = new Set(correctWords);
    let keywordMatch = 0;
    for (const w of userWords) {
      if (correctSet.has(w)) keywordMatch++;
      else {
        const c = correctWords.find(x => x.includes(w) || w.includes(x));
        if (c) keywordMatch += 0.5;
      }
    }
    const keywordRatio = keywordMatch / Math.max(correctWords.length, userWords.length, 1);
    if (keywordRatio > 0.3) {
      // 키워드가 30% 이상 일치하면 보너스
      const keywordBonus = Math.min(0.1, keywordRatio * 0.15);
      similarity = Math.min(1.0, similarity + keywordBonus);
    }

    // 조정: 높은 유사도는 더 높게, 낮은 유사도는 약간 낮게
    let adjusted = similarity;
    if (similarity > 0.7) {
      // 0.7 이상이면 더 관대하게 평가
      adjusted = 0.7 + (similarity - 0.7) * 1.5;
    } else if (similarity > 0.5) {
      // 0.5~0.7 사이는 약간 보정
      adjusted = 0.5 + (similarity - 0.5) * 1.2;
    } else if (similarity <= 0.3) {
      // 0.3 이하는 더 낮게
      adjusted = similarity * 0.85;
    }

    const pct = Math.max(0, Math.min(100, adjusted * 100));
    return Math.round(pct * 10) / 10;
  } catch (error) {
    console.error("정답 유사도 계산 오류:", error);
    return calculateSimpleMatch(userAnswer, correctAnswer);
  }
}

function calculateSimpleMatch(userAnswer: string, correctAnswer: string): number {
  const userWords = tokenizeKo(userAnswer);
  const correctWords = tokenizeKo(correctAnswer);
  if (!correctWords.length) return 0;

  const correctSet = new Set(correctWords);
  let matched = 0;
  for (const w of userWords) {
    if (correctSet.has(w)) matched++;
    else {
      const c = correctWords.find(x => x.includes(w) || w.includes(x));
      if (c) matched += 0.5;
    }
  }

  const ratio = matched / Math.max(correctWords.length, userWords.length, 1);
  return Math.round(ratio * 1000) / 10;
}

/*
Usage:

// 1) build once per selected problem
const knowledge = await buildProblemKnowledge(problemContent, problemAnswer, optionalLLMBuilder);

// 2) for each question
const r = await analyzeQuestionV8(userQuestion, knowledge, optionalFallbackJudge);

// If you want the old signature:
const r2 = await analyzeQuestionSemanticV8(userQuestion, problemContent, problemAnswer);
*/
