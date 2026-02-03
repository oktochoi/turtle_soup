// AI 질문 분석기 - English Version (V9-based)
// 영어 전용 버전: 영어 토큰화, 영어 유의어, 영어 반의어 지원

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
    IRRELEVANT_MAX: 0.35, // 상향 조정: 문맥에 따라 완전히 바뀔 수 있으므로 더 관대하게
    IRRELEVANT_CONTENT_MAX: 0.30, // 내용 유사도가 낮을 때 irrelevant 판단
  },

  ADJUST: {
    CONCEPT_MATCH_BONUS: 0.10,
    INFER_MATCH_BONUS: 0.08,
    GENERALIZATION_NO_BONUS: 0.22,
    ANTONYM_PENALTY: 0.30,
    ANTONYM_FORCE_NO_SIM_BASE: 0.55,
    ANTONYM_FORCE_NO_SIM_EARLY_DELTA: +0.00,
    ANTONYM_FORCE_NO_SIM_LATE_DELTA: -0.05,
    TAXONOMY_MATCH_BONUS: 0.10,
    TAXONOMY_GENERALIZATION_PENALTY: 0.18,
  },

  LEXICON: {
    SYNONYM_SIM_THRESHOLD: 0.72,
    MAX_SYNONYMS_PER_TOKEN: 6,
    MAX_TOKENS: 120,
    MIN_TOKEN_LEN: 2,
  },

  AMBIGUOUS_RANGE: { min: 0.40, max: 0.62 },

  V9: {
    MAX_CONCEPTS_TOTAL: 180,
    MAX_HYPERNYM_PER_TOKEN: 3,
    MAX_HYPONYM_PER_TOKEN: 3,
    TAXONOMY_MAX_DEPTH: 3,
    ANTONYM_REQUIRE_SIGNALS: 2,
    ANSWER_SYNONYM_BONUS: 0.10,
    ANSWER_TAXONOMY_BONUS: 0.08,
    ANSWER_ANTONYM_PENALTY: 0.35,
    ANSWER_SIM_MAX_EMBEDS: 3,
  },
} as const;

// -------------------------
// Model singleton
// -------------------------
let embeddingPipeline: Pipeline | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<Pipeline> | null = null;

// -------------------------
// LRU + TTL cache
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
// Text normalize / tokenize (English)
// -------------------------
function normalizeText(text: string): string {
  return (text ?? "")
    .replace(/\u200B/g, "")
    .replace(/[\u200C\u200D\uFEFF]/g, "")
    .replace(/[""'']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeEn(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter(t => t.length >= CONFIG.LEXICON.MIN_TOKEN_LEN)
    .slice(0, CONFIG.LEXICON.MAX_TOKENS);
}

function splitSentencesEn(text: string): string[] {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];
  const rough = cleaned.split(/[\n\r]+/g);
  const out: string[] = [];
  for (const chunk of rough) {
    const parts = chunk
      .split(/(?<=[\.\?\!])\s+/g)
      .map(p => p.trim())
      .filter(p => p.length >= 3);
    out.push(...parts);
  }
  return out.length ? out : [cleaned];
}

// -------------------------
// Negation handling (English)
// -------------------------
const NEGATION_PATTERNS = [
  "not ",
  "no ",
  "never",
  "none",
  "cannot",
  "can't",
  "won't",
  "don't",
  "didn't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "hasn't",
  "haven't",
  "hadn't",
  "doesn't",
  "wouldn't",
  "couldn't",
  "shouldn't",
];

const MODALITY_PATTERNS = [
  "maybe",
  "perhaps",
  "possibly",
  "likely",
  "uncertain",
  "probably",
  "might",
  "could",
  "may",
];

function hasAny(text: string, patterns: string[]) {
  const t = normalizeText(text).toLowerCase();
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

  let nq = q.toLowerCase();
  
  nq = nq.replace(/\bnot\b/g, "");
  nq = nq.replace(/\bnever\b/g, "");
  nq = nq.replace(/\bno\b/g, "");
  nq = nq.replace(/\bcan't\b/g, "can");
  nq = nq.replace(/\bcannot\b/g, "can");
  nq = nq.replace(/\bdon't\b/g, "");
  nq = nq.replace(/\bdidn't\b/g, "");
  nq = nq.replace(/\bisn't\b/g, "is");
  nq = nq.replace(/\baren't\b/g, "are");
  nq = nq.replace(/\bwasn't\b/g, "was");
  nq = nq.replace(/\bweren't\b/g, "were");
  nq = nq.replace(/\bhasn't\b/g, "has");
  nq = nq.replace(/\bhaven't\b/g, "have");
  nq = nq.replace(/\bhadn't\b/g, "had");
  nq = nq.replace(/\bdoesn't\b/g, "");
  nq = nq.replace(/\bwouldn't\b/g, "would");
  nq = nq.replace(/\bcouldn't\b/g, "could");
  nq = nq.replace(/\bshouldn't\b/g, "should");

  nq = normalizeText(nq);

  return { normalized: nq || q, invert: true };
}

// -------------------------
// Ontology / Taxonomy (English)
// -------------------------
type OntologyEdge = { parent: string; child: string; rel: "part_of" | "is_a" };

const GLOBAL_ONTOLOGY: OntologyEdge[] = [
  { parent: "hand", child: "finger", rel: "part_of" },
  { parent: "finger", child: "nail", rel: "part_of" },
  { parent: "foot", child: "toe", rel: "part_of" },
  { parent: "toe", child: "toenail", rel: "part_of" },
  { parent: "face", child: "eye", rel: "part_of" },
  { parent: "face", child: "mouth", rel: "part_of" },
];

const GLOBAL_TAXONOMY: OntologyEdge[] = [
  // Person hierarchy
  { parent: "person", child: "man", rel: "is_a" },
  { parent: "person", child: "woman", rel: "is_a" },
  { parent: "person", child: "child", rel: "is_a" },
  { parent: "person", child: "kid", rel: "is_a" },
  { parent: "person", child: "boy", rel: "is_a" },
  { parent: "person", child: "girl", rel: "is_a" },
  { parent: "person", child: "human", rel: "is_a" },
  
  // Animal hierarchy
  { parent: "animal", child: "dog", rel: "is_a" },
  { parent: "animal", child: "cat", rel: "is_a" },
  
  // Vehicle hierarchy
  { parent: "vehicle", child: "car", rel: "is_a" },
  { parent: "vehicle", child: "bus", rel: "is_a" },
  { parent: "vehicle", child: "train", rel: "is_a" },
  { parent: "vehicle", child: "bicycle", rel: "is_a" },
  
  // Crime hierarchy
  { parent: "crime", child: "murder", rel: "is_a" },
  { parent: "crime", child: "theft", rel: "is_a" },
  { parent: "crime", child: "killer", rel: "is_a" },
  { parent: "crime", child: "murderer", rel: "is_a" },
  
  // Place hierarchy
  { parent: "place", child: "home", rel: "is_a" },
  { parent: "place", child: "house", rel: "is_a" },
  { parent: "place", child: "school", rel: "is_a" },
  { parent: "place", child: "hospital", rel: "is_a" },
  { parent: "place", child: "church", rel: "is_a" },
  { parent: "place", child: "office", rel: "is_a" },
  { parent: "place", child: "room", rel: "is_a" },
  
  // Time hierarchy
  { parent: "time", child: "before", rel: "is_a" },
  { parent: "time", child: "after", rel: "is_a" },
  { parent: "time", child: "earlier", rel: "is_a" },
  { parent: "time", child: "later", rel: "is_a" },
  { parent: "time", child: "now", rel: "is_a" },
  { parent: "time", child: "currently", rel: "is_a" },
];

// -------------------------
// Global synonyms (English)
// -------------------------
const GLOBAL_SYNONYMS: Map<string, string[]> = new Map([
  // Crime related
  ["killer", ["murderer", "culprit", "attacker", "perpetrator", "assassin"]],
  ["murderer", ["killer", "culprit", "attacker", "assassin"]],
  ["culprit", ["killer", "murderer", "perpetrator", "offender"]],
  ["perpetrator", ["killer", "murderer", "culprit", "attacker"]],
  ["victim", ["casualty", "sufferer", "target"]],
  ["casualty", ["victim", "sufferer"]],
  
  // People
  ["person", ["human", "individual", "someone", "somebody"]],
  ["human", ["person", "individual"]],
  ["man", ["male", "guy", "gentleman"]],
  ["woman", ["female", "lady", "girl"]],
  ["child", ["kid", "youngster", "boy", "girl"]],
  ["kid", ["child", "youngster"]],
  ["boy", ["child", "kid", "youngster"]],
  ["girl", ["child", "kid", "youngster"]],
  
  // Vehicles
  ["car", ["vehicle", "automobile", "auto"]],
  ["vehicle", ["car", "automobile"]],
  ["bus", ["bus", "coach"]],
  ["train", ["train", "locomotive"]],
  
  // Places
  ["home", ["house", "residence", "dwelling", "abode"]],
  ["house", ["home", "residence", "dwelling"]],
  ["school", ["school", "educational institution"]],
  ["hospital", ["hospital", "clinic", "medical center"]],
  ["church", ["church", "cathedral", "chapel"]],
  ["office", ["office", "workspace", "workplace"]],
  ["room", ["room", "chamber", "space"]],
  
  // Time/Order
  ["before", ["earlier", "prior", "previously", "preceding"]],
  ["after", ["later", "subsequent", "following", "next"]],
  ["earlier", ["before", "prior", "previously"]],
  ["later", ["after", "subsequent", "following"]],
  ["now", ["currently", "present", "at present", "right now"]],
  ["currently", ["now", "present", "at present"]],
  
  // States/Conditions
  ["open", ["opened", "unlocked", "accessible"]],
  ["closed", ["shut", "locked", "sealed"]],
  ["alive", ["living", "surviving", "survived"]],
  ["dead", ["died", "deceased", "killed", "corpse"]],
  ["exist", ["exists", "present", "there is", "there are"]],
  ["present", ["exist", "exists", "there"]],
  ["absent", ["not exist", "none", "missing"]],
  
  // Actions
  ["escape", ["flee", "run away", "get away", "break free"]],
  ["flee", ["escape", "run away", "get away"]],
  ["kill", ["murder", "slay", "eliminate"]],
  ["murder", ["kill", "slay", "assassinate"]],
  ["fall", ["drop", "crash", "collapse", "tumble"]],
  ["drop", ["fall", "crash", "collapse"]],
  
  // Accident/Intent
  ["accident", ["incident", "mishap", "unintentional"]],
  ["incident", ["accident", "event", "occurrence"]],
  ["intentional", ["deliberate", "on purpose", "planned", "premeditated"]],
  ["deliberate", ["intentional", "on purpose", "planned"]],
  ["purpose", ["intent", "intention", "aim"]],
]);

// -------------------------
// Generalization hints (English)
// -------------------------
const GENERALIZATION_HINTS = [
  "any",
  "anything",
  "anywhere",
  "where",
  "overall",
  "everything",
  "all",
  "both",
  "related",
  "involved",
  "part",
  "whole",
  "entire",
];

const QUANTITY_SPECIFIC_HINTS = ["both", "all", "every", "each"];
const SINGLE_SPECIFIC_HINTS = ["one", "single", "only one", "a single"];

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

  const quantityRegex = /(both|all|every|each)/gi;
  const quantityFound = text.match(quantityRegex);
  if (quantityFound) {
    quantityFound.forEach(m => {
      const cleaned = m.trim().toLowerCase();
      if (!baseQuantity.includes(cleaned) && !quantityMatches.includes(cleaned)) {
        quantityMatches.push(cleaned);
      }
    });
  }

  const singleRegex = /(one|single|only\s+one|a\s+single)/gi;
  const singleFound = text.match(singleRegex);
  if (singleFound) {
    singleFound.forEach(m => {
      const cleaned = m.trim().toLowerCase();
      if (!baseSingle.includes(cleaned) && !singleMatches.includes(cleaned)) {
        singleMatches.push(cleaned);
      }
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

// -------------------------
// Antonym axes (English)
// -------------------------
type AntonymAxis = { label: string; pos: string[]; neg: string[] };

const GLOBAL_ANTONYM_AXES: AntonymAxis[] = [
  { label: "alive/dead", pos: ["alive", "survive", "living"], neg: ["dead", "died", "corpse", "death"] },
  { label: "open/closed", pos: ["open", "opened"], neg: ["closed", "shut", "locked"] },
  { label: "possible/impossible", pos: ["possible", "can", "able"], neg: ["impossible", "cannot", "can't", "unable"] },
  { label: "exist/not", pos: ["exist", "exists", "present"], neg: ["not exist", "none", "absent"] },
  { label: "intentional/accident", pos: ["intentional", "on purpose", "deliberate"], neg: ["accident", "by accident", "mistake"] },
  { label: "inside/outside", pos: ["inside", "indoors", "within"], neg: ["outside", "outdoors", "out"] },
  { label: "up/down", pos: ["up", "above", "over"], neg: ["down", "below", "under"] },
  { label: "left/right", pos: ["left"], neg: ["right"] },
  { label: "before/after", pos: ["before", "earlier", "prior"], neg: ["after", "later", "subsequent"] },
  { label: "increase/decrease", pos: ["increase", "rise", "grow"], neg: ["decrease", "drop", "fall"] },
];

const GLOBAL_ANTONYM_LEXICON: Map<string, string[]> = new Map([
  ["inside", ["outside"]],
  ["outside", ["inside"]],
  ["up", ["down"]],
  ["down", ["up"]],
  ["left", ["right"]],
  ["right", ["left"]],
  ["before", ["after"]],
  ["after", ["before"]],
  ["increase", ["decrease"]],
  ["decrease", ["increase"]],
  ["alive", ["dead"]],
  ["dead", ["alive"]],
  ["open", ["closed", "shut"]],
  ["closed", ["open"]],
]);

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

const EXIST_POS_ROOTS = ["exist", "exists", "present"];
const EXIST_NEG_ROOTS = ["not exist", "none", "absent"];

function hasExistTargetContext(text: string): boolean {
  const tokens = tokenizeEn(text);
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

function detectAntonymMismatchByTextV9(
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

function detectAntonymMismatchByConceptsV9(
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

function detectAntonymMismatchByLexiconV9(
  question: string,
  answer: string,
  antonymLexicon: Map<string, string[]>
): { hit: boolean; pairs?: [string, string][] } {
  const qTok = tokenizeEn(question);
  const aTok = tokenizeEn(answer);
  const pairs: [string, string][] = [];

  for (const qt of qTok) {
    const ants = antonymLexicon.get(qt);
    if (!ants) continue;
    for (const a of ants) {
      if (aTok.some(t => t === a || t.includes(a) || a.includes(t))) {
        pairs.push([qt, a]);
        if (pairs.length >= 3) break;
      }
    }
    if (pairs.length >= 3) break;
  }

  return pairs.length ? { hit: true, pairs } : { hit: false };
}

function antonymSignalCount(args: {
  antiText: { hit: boolean };
  antiConcept: { hit: boolean };
  antiLex: { hit: boolean };
}): number {
  let s = 0;
  if (args.antiText.hit) s++;
  if (args.antiConcept.hit) s++;
  if (args.antiLex.hit) s++;
  return s;
}

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
        const { pipeline, env } = await import("@xenova/transformers");
        // 모델 로딩 시 절대 경로 사용하도록 설정
        if (typeof window !== 'undefined') {
          env.allowLocalModels = false; // Hugging Face Hub에서 직접 로드
        }
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

function roughRelevanceScore(question: string, sentence: string): number {
  const qTokens = tokenizeEn(question);
  const sTokens = new Set(tokenizeEn(sentence));
  if (!qTokens.length) return 0;

  // 정확한 토큰 매칭
  let hits = 0;
  for (const t of qTokens) {
    if (sTokens.has(t)) hits++;
  }

  // 부분 매칭 (substring) + 유의어 매칭
  let partial = 0;
  const sLower = normalizeText(sentence).toLowerCase();
  for (const t of qTokens) {
    if (t.length >= 2 && sLower.includes(t)) partial += 0.35;
    // 유의어 매칭 (간단한 체크)
    const syns = GLOBAL_SYNONYMS.get(t);
    if (syns) {
      for (const syn of syns.slice(0, 3)) {
        if (sLower.includes(syn)) {
          partial += 0.25;
          break;
        }
      }
    }
  }

  // 문장 길이 정규화 보너스
  const exact = hits / Math.max(qTokens.length, 1);
  const part = Math.min(0.8, partial / Math.max(qTokens.length, 1));
  const lengthBonus = sentence.length < 50 ? 0.05 : 0;
  
  return exact * 0.65 + part * 0.3 + lengthBonus;
}

function selectTopKSentences(question: string, sentences: string[], k: number): string[] {
  if (sentences.length <= k) return sentences;
  return sentences
    .map(s => ({ s, score: roughRelevanceScore(question, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(x => x.s);
}

// -------------------------
// Taxonomy maps
// -------------------------
function buildTaxonomyMaps(edges: OntologyEdge[]): { hypernymMap: Map<string, string[]>; hyponymMap: Map<string, string[]> } {
  const hyper = new Map<string, string[]>();
  const hypo = new Map<string, string[]>();
  const isa = edges.filter(e => e.rel === "is_a");

  for (const e of isa) {
    if (!hyper.has(e.child)) hyper.set(e.child, []);
    hyper.get(e.child)!.push(e.parent);

    if (!hypo.has(e.parent)) hypo.set(e.parent, []);
    hypo.get(e.parent)!.push(e.child);
  }

  for (const [k, v] of hyper.entries()) hyper.set(k, [...new Set(v)]);
  for (const [k, v] of hypo.entries()) hypo.set(k, [...new Set(v)]);

  return { hypernymMap: hyper, hyponymMap: hypo };
}

function isHypernymOf(parent: string, child: string, hypernymMap: Map<string, string[]>, depth = 3): boolean {
  if (depth <= 0) return false;
  const parents = hypernymMap.get(child) ?? [];
  if (parents.includes(parent)) return true;
  for (const p of parents) if (isHypernymOf(parent, p, hypernymMap, depth - 1)) return true;
  return false;
}

function isHyponymOf(child: string, parent: string, hypernymMap: Map<string, string[]>, depth = 3): boolean {
  return isHypernymOf(parent, child, hypernymMap, depth);
}

// -------------------------
// Inferred concepts
// -------------------------
function inferConceptsFromTokens(tokens: string[]): Set<string> {
  const tset = new Set(tokens);
  const concepts = new Set<string>();

  // 사고 관련 패턴 (강화)
  const hasBrake = [...tset].some(t => t.includes("brake") || t.includes("braking"));
  const hasFail = [...tset].some(t => t.includes("fail") || t.includes("broken") || t.includes("malfunction"));
  const hasCrash = [...tset].some(t => t.includes("crash") || t.includes("fall") || t.includes("collision"));
  const hasRun = [...tset].some(t => t.includes("run") || t.includes("escape") || t.includes("flee"));

  if (hasBrake && hasFail && (hasCrash || hasRun)) concepts.add("accident");
  if ((hasCrash || hasRun) && hasFail) concepts.add("accident"); // 더 관대한 패턴

  // 의도 관련 패턴 (강화)
  const hasIntent = [...tset].some(t => t.includes("intent") || t.includes("purpose") || t.includes("deliberate") || t.includes("plan"));
  if (hasIntent) concepts.add("intentional");

  // 살인/범죄 패턴
  const hasKill = [...tset].some(t => t.includes("kill") || t.includes("murder") || t.includes("slay"));
  const hasCriminal = [...tset].some(t => t.includes("killer") || t.includes("culprit") || t.includes("murderer") || t.includes("perpetrator"));
  if (hasKill || hasCriminal) concepts.add("crime");

  // 도주/탈출 패턴
  if (hasRun) concepts.add("escape");

  // 시간 관련
  const hasBefore = [...tset].some(t => t.includes("before") || t.includes("earlier") || t.includes("prior"));
  const hasAfter = [...tset].some(t => t.includes("after") || t.includes("later") || t.includes("subsequent"));
  if (hasBefore) concepts.add("past");
  if (hasAfter) concepts.add("future");

  return concepts;
}

// -------------------------
// ProblemKnowledge (English)
// -------------------------
export type ProblemKnowledge = {
  content: string;
  answer: string;
  contentSentences: string[];
  answerSentences: string[];
  contentTokens: string[];
  answerTokens: string[];
  synonymMap: Map<string, string[]>;
  antonymMap: Map<string, string[]>;
  antonymAxes: AntonymAxis[];
  antonymLexicon: Map<string, string[]>;
  entitySet: Set<string>;
  ontology: OntologyEdge[];
  taxonomyEdges: OntologyEdge[];
  hypernymMap: Map<string, string[]>;
  hyponymMap: Map<string, string[]>;
  inferredConcepts: Set<string>;
  quantityPatterns: QuantityPattern[];
  conceptVecCache: Map<string, Float32Array>;
};

export type KnowledgeBuilderLLM = (args: { content: string; answer: string }) => Promise<{
  entities?: string[];
  ontologyEdges?: OntologyEdge[];
  taxonomyEdges?: OntologyEdge[];
  concepts?: string[];
} | null>;

// -------------------------
// Build ProblemKnowledge (English)
// -------------------------
export async function buildProblemKnowledge(
  problemContent: string,
  problemAnswer: string,
  llmBuilder?: KnowledgeBuilderLLM,
  hints?: string[] | null,
  explanation?: string | null
): Promise<ProblemKnowledge> {
  let content = normalizeText(problemContent ?? "");
  if (hints && hints.length > 0) {
    const hintsText = hints.filter(h => h && h.trim()).map(h => h.trim()).join(' ');
    if (hintsText) {
      content = `${content} ${hintsText}`;
    }
  }
  if (explanation && explanation.trim()) {
    content = `${content} ${normalizeText(explanation.trim())}`;
  }
  const answer = normalizeText(problemAnswer ?? "");

  const contentSentences = content ? splitSentencesEn(content) : [];
  const answerSentences = answer ? splitSentencesEn(answer) : [];

  const contentTokens = content ? tokenizeEn(content) : [];
  const answerTokens = answer ? tokenizeEn(answer) : [];

  const freq = new Map<string, number>();
  for (const t of [...contentTokens, ...answerTokens]) freq.set(t, (freq.get(t) ?? 0) + 1);

  const entityCandidates = [...freq.entries()]
    .filter(([t]) => t.length >= 2 && !/^\d+$/.test(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([t]) => t);

  const entitySet = new Set<string>(entityCandidates);

  let ontology: OntologyEdge[] = [...GLOBAL_ONTOLOGY];
  let taxonomyEdges: OntologyEdge[] = [...GLOBAL_TAXONOMY];

  const inferredConcepts = inferConceptsFromTokens([...contentTokens, ...answerTokens]);
  const quantityPatterns = extractQuantityPatterns(content, answer);

  if (llmBuilder) {
    try {
      const extra = await llmBuilder({ content, answer });
      if (extra?.entities?.length) extra.entities.forEach(e => entitySet.add(e));
      if (extra?.ontologyEdges?.length) ontology = ontology.concat(extra.ontologyEdges);
      if (extra?.taxonomyEdges?.length) taxonomyEdges = taxonomyEdges.concat(extra.taxonomyEdges);
      if (extra?.concepts?.length) extra.concepts.forEach(c => inferredConcepts.add(c));
    } catch {
      // ignore
    }
  }

  const { hypernymMap, hyponymMap } = buildTaxonomyMaps(taxonomyEdges);

  const antonymAxes = buildActiveAntonymAxes(content, answer);
  
  // 학습된 반의어 병합
  await loadLearnedDataOnceEn();
  const antonymLexicon = new Map<string, string[]>(GLOBAL_ANTONYM_LEXICON);
  if (learnedAntonymsCacheEn) {
    for (const [token, antonyms] of learnedAntonymsCacheEn.entries()) {
      const existing = antonymLexicon.get(token) || [];
      const merged = [...new Set([...existing, ...antonyms])];
      antonymLexicon.set(token, merged);
    }
  }

  const synonymMap = new Map<string, string[]>();
  const antonymMap = new Map<string, string[]>();
  const conceptVecCache = new Map<string, Float32Array>();

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
    antonymLexicon,
    entitySet,
    ontology,
    taxonomyEdges,
    hypernymMap,
    hyponymMap,
    inferredConcepts,
    quantityPatterns,
    conceptVecCache,
  };
}

// -------------------------
// Learned data cache (동적 학습 데이터)
// -------------------------
let learnedSynonymsCacheEn: Map<string, string[]> | null = null;
let learnedAntonymsCacheEn: Map<string, string[]> | null = null;
let learnedDataLoadPromiseEn: Promise<void> | null = null;

async function loadLearnedDataOnceEn(): Promise<void> {
  if (learnedDataLoadPromiseEn) return learnedDataLoadPromiseEn;
  
  learnedDataLoadPromiseEn = (async () => {
    try {
      // 동적 import로 클라이언트 사이드에서만 로드
      if (typeof window !== 'undefined') {
        const { loadAllLearningData } = await import('./ai-learning-loader');
        const { synonyms, antonyms } = await loadAllLearningData();
        learnedSynonymsCacheEn = synonyms;
        learnedAntonymsCacheEn = antonyms;
      }
    } catch (error) {
      console.warn('학습 데이터 로드 실패 (무시):', error);
      learnedSynonymsCacheEn = new Map();
      learnedAntonymsCacheEn = new Map();
    }
  })();
  
  return learnedDataLoadPromiseEn;
}

// -------------------------
// Synonym expansion
// -------------------------
async function getConceptVecCached(concept: string, knowledge: ProblemKnowledge): Promise<Float32Array> {
  const key = concept;
  const cached = knowledge.conceptVecCache.get(key);
  if (cached) return cached;
  const vec = await getEmbedding(concept);
  knowledge.conceptVecCache.set(key, vec);
  return vec;
}

async function getOrBuildSynonymsForToken(token: string, knowledge: ProblemKnowledge): Promise<string[]> {
  const key = token;
  const cached = knowledge.synonymMap.get(key);
  if (cached) return cached;

  // 학습 데이터 로드 (한 번만)
  await loadLearnedDataOnceEn();

  // 1) global synonyms first
  const globalSyns = GLOBAL_SYNONYMS.get(token);
  const synonyms: string[] = globalSyns ? [...globalSyns] : [];

  // 1-1) learned synonyms (버그 리포트에서 학습한 유의어)
  if (learnedSynonymsCacheEn) {
    const learnedSyns = learnedSynonymsCacheEn.get(token);
    if (learnedSyns) {
      for (const syn of learnedSyns) {
        if (!synonyms.includes(syn)) synonyms.push(syn);
      }
    }
  }

  const candidates = [...knowledge.entitySet].filter(t => t !== token && !synonyms.includes(t));
  if (candidates.length > 0) {
    const tokenVec = await getConceptVecCached(token, knowledge);
    const picked: { t: string; s: number }[] = [];
    const limited = candidates.slice(0, 120);

    for (const c of limited) {
      const cVec = await getConceptVecCached(c, knowledge);
      const s = cosineSimilarity(tokenVec, cVec);
      if (s >= CONFIG.LEXICON.SYNONYM_SIM_THRESHOLD) picked.push({ t: c, s });
    }

    picked.sort((a, b) => b.s - a.s);
    const embeddingSyns = picked.slice(0, CONFIG.LEXICON.MAX_SYNONYMS_PER_TOKEN).map(x => x.t);
    synonyms.push(...embeddingSyns);
  }

  const out = synonyms.slice(0, CONFIG.LEXICON.MAX_SYNONYMS_PER_TOKEN + (globalSyns?.length ?? 0));
  knowledge.synonymMap.set(key, out);
  return out;
}

// -------------------------
// Concepts extraction (English)
// -------------------------
// 문맥적 불일치 감지 (V9+)
// 질문과 문제 내용/답변 간의 문맥적 거리를 계산하여 irrelevant 판단 보조
function detectContextualMismatch(
  question: string,
  knowledge: ProblemKnowledge,
  simAnswer: number,
  simContent: number
): { isIrrelevant: boolean; reason?: string } {
  const qNorm = normalizeText(question).toLowerCase();
  const qTokens = new Set(tokenizeEn(question));
  const contentTokens = new Set([...knowledge.contentTokens, ...knowledge.answerTokens]);
  
  // 1) 공통 토큰이 매우 적은 경우 (문맥적 불일치)
  const commonTokens = [...qTokens].filter(t => contentTokens.has(t));
  const commonRatio = qTokens.size > 0 ? commonTokens.length / qTokens.size : 0;
  
  // 2) 질문이 문제와 완전히 다른 주제인 경우 감지
  const problemDomainKeywords = new Set([
    ...knowledge.contentTokens.slice(0, 20), // 상위 20개 토큰
    ...knowledge.answerTokens.slice(0, 10),  // 상위 10개 토큰
  ]);
  
  const questionDomainMatch = [...qTokens].filter(t => 
    problemDomainKeywords.has(t) ||
    [...problemDomainKeywords].some(pt => t.includes(pt) || pt.includes(t))
  ).length;
  
  const domainMatchRatio = qTokens.size > 0 ? questionDomainMatch / qTokens.size : 0;
  
  // 3) 유사도가 낮고 공통 토큰도 적은 경우
  if (simAnswer <= 0.30 && simContent <= 0.35 && commonRatio < 0.15) {
    return { isIrrelevant: true, reason: 'low_similarity_and_tokens' };
  }
  
  // 4) 도메인 매칭이 매우 낮고 유사도도 낮은 경우
  if (domainMatchRatio < 0.10 && simAnswer <= 0.32 && simContent <= 0.38) {
    return { isIrrelevant: true, reason: 'domain_mismatch' };
  }
  
  // 5) 질문이 너무 일반적이거나 추상적인 경우 (문제와 관련 없을 가능성)
  const genericQuestions = [
    'what', 'where', 'when', 'who', 'why', 'how', 'which'
  ];
  const isGenericQuestion = genericQuestions.some(gq => qNorm.includes(gq)) && 
                           commonRatio < 0.20 && simAnswer <= 0.35;
  
  if (isGenericQuestion) {
    return { isIrrelevant: true, reason: 'generic_question_low_match' };
  }
  
  return { isIrrelevant: false };
}

// 문맥 기반 개념 확장 (V9+)
function extractContextualConcepts(question: string, knowledge: ProblemKnowledge): Set<string> {
  const concepts = new Set<string>();
  const qNorm = normalizeText(question).toLowerCase();
  const qTokens = tokenizeEn(question);
  const qTokensSet = new Set(qTokens);

  // 시간/순서 패턴
  const timePatterns = [
    { pattern: ["before", "earlier", "prior", "previously"], concept: "past" },
    { pattern: ["after", "later", "subsequent", "following"], concept: "future" },
    { pattern: ["now", "currently", "present", "at present"], concept: "present" },
  ];
  for (const { pattern, concept } of timePatterns) {
    if (pattern.some(p => qNorm.includes(p))) concepts.add(concept);
  }

  // 인과관계 패턴
  const causalPatterns = [
    { pattern: ["because", "due to", "caused", "resulted"], concept: "causal" },
    { pattern: ["result", "consequence", "outcome"], concept: "result" },
  ];
  for (const { pattern, concept } of causalPatterns) {
    if (pattern.some(p => qNorm.includes(p))) concepts.add(concept);
  }

  // 복합 개념 (여러 토큰 조합)
  const hasPerson = qTokensSet.has("person") || qTokensSet.has("human") || qTokensSet.has("man") || qTokensSet.has("woman");
  const hasDead = qTokensSet.has("dead") || qTokensSet.has("died") || qTokensSet.has("death") || qTokensSet.has("corpse");
  const hasKill = qTokensSet.has("kill") || qTokensSet.has("murder") || qTokensSet.has("slay");
  
  if (hasPerson && hasDead) concepts.add("death_person");
  if (hasPerson && hasKill) concepts.add("murder_action");
  
  // 장소 + 행동 조합
  const hasPlace = qTokensSet.has("home") || qTokensSet.has("house") || qTokensSet.has("place") || qTokensSet.has("room");
  const hasEscape = qTokensSet.has("escape") || qTokensSet.has("flee") || qTokensSet.has("run");
  if (hasPlace && hasEscape) concepts.add("escape_from_place");

  return concepts;
}

async function extractQuestionConceptsV9(question: string, knowledge: ProblemKnowledge): Promise<Set<string>> {
  const toks = tokenizeEn(question);
  const concepts = new Set<string>();

  for (const token of toks) {
    concepts.add(token);
    if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
  }

  for (const token of toks) {
    const syns = await getOrBuildSynonymsForToken(token, knowledge);
    for (const s of syns) {
      concepts.add(s);
      if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
    }
  }

  for (const token of toks) {
    const hypers = (knowledge.hypernymMap.get(token) ?? []).slice(0, CONFIG.V9.MAX_HYPERNYM_PER_TOKEN);
    for (const h of hypers) {
      concepts.add(h);
      if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
    }

    const hypos = (knowledge.hyponymMap.get(token) ?? []).slice(0, CONFIG.V9.MAX_HYPONYM_PER_TOKEN);
    for (const h of hypos) {
      concepts.add(h);
      if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
    }
  }

  // 문맥 기반 개념 확장 (V9+)
  const contextualConcepts = extractContextualConcepts(question, knowledge);
  for (const c of contextualConcepts) {
    concepts.add(c);
    if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
  }

  const qNorm = normalizeText(question).toLowerCase();
  if (qNorm.includes("accident") || qNorm.includes("mistake")) concepts.add("accident");
  if (qNorm.includes("intentional") || qNorm.includes("deliberate") || qNorm.includes("on purpose")) concepts.add("intentional");

  return concepts;
}

function extractAnswerConceptsV9(knowledge: ProblemKnowledge): Set<string> {
  const base = new Set<string>();
  for (const t of knowledge.answerTokens) base.add(t);
  knowledge.inferredConcepts.forEach(c => base.add(c));
  return base;
}

// -------------------------
// Force NO by ontology/taxonomy
// -------------------------
function isGeneralizationQuestion(text: string): boolean {
  const t = normalizeText(text).toLowerCase();
  if (!t) return false;
  return GENERALIZATION_HINTS.some(h => t.includes(h));
}

function hasQuantityMismatch(question: string, answerText: string, quantityPatterns: QuantityPattern[] = []): boolean {
  const qNorm = normalizeText(question).toLowerCase();
  const aNorm = normalizeText(answerText).toLowerCase();

  if (quantityPatterns.length > 0) {
    for (const pattern of quantityPatterns) {
      const hasQuantityQuestion = pattern.quantity.some(h => qNorm.includes(h.toLowerCase()));
      if (!hasQuantityQuestion) continue;

      const hasSingleAnswer = pattern.single.some(h => aNorm.includes(h.toLowerCase()));
      if (hasSingleAnswer) return true;
    }
  }

  const hasQuantityQuestion = QUANTITY_SPECIFIC_HINTS.some(h => qNorm.includes(h.toLowerCase()));
  if (!hasQuantityQuestion) return false;

  const hasSingleAnswer = SINGLE_SPECIFIC_HINTS.some(h => aNorm.includes(h.toLowerCase()));
  if (hasSingleAnswer) return true;

  return false;
}

function shouldForceNoByOntologyV9(args: {
  question: string;
  qConcepts: Set<string>;
  aConcepts: Set<string>;
  knowledge: ProblemKnowledge;
}): { forceNo: boolean; taxonomyHit: boolean; taxonomyBonus: number } {
  const { question, qConcepts, aConcepts, knowledge } = args;

  if (hasQuantityMismatch(question, knowledge.answer, knowledge.quantityPatterns)) {
    return { forceNo: true, taxonomyHit: false, taxonomyBonus: 0 };
  }

  const generalized = isGeneralizationQuestion(question);
  let taxonomyHit = false;
  let taxonomyBonus = 0;

  const hyper = knowledge.hypernymMap;

  for (const q of qConcepts) {
    for (const a of aConcepts) {
      if (q === a) continue;

      const qIsHyper = isHypernymOf(q, a, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH);
      const qIsHypo = isHyponymOf(q, a, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH);

      if (qIsHyper || qIsHypo) {
        taxonomyHit = true;
        taxonomyBonus = Math.max(taxonomyBonus, CONFIG.ADJUST.TAXONOMY_MATCH_BONUS);
      }
    }
  }

  if (generalized) {
    for (const q of qConcepts) {
      for (const a of aConcepts) {
        if (q === a) continue;

        const qIsHyper = isHypernymOf(q, a, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH);
        if (qIsHyper) {
          const answerHasParent = aConcepts.has(q);
          if (!answerHasParent) {
            return { forceNo: true, taxonomyHit, taxonomyBonus };
          }
        }
      }
    }
  }

  const abstractSupers = ["person", "animal", "place", "crime"];
  const qHasAbstract = [...qConcepts].some(c => abstractSupers.includes(c));
  const aHasAbstract = [...aConcepts].some(c => abstractSupers.includes(c));

  if (generalized && qHasAbstract && !aHasAbstract) {
    if (aConcepts.size >= 2) {
      return { forceNo: true, taxonomyHit, taxonomyBonus };
    }
  }

  return { forceNo: false, taxonomyHit, taxonomyBonus };
}

// -------------------------
// Fallback hook
// -------------------------
export type FallbackJudge = (args: {
  question: string;
  problemContent: string;
  problemAnswer: string;
}) => Promise<JudgeResult | null>;

// 질문에 정답의 말이 들어가면 대부분 정답(yes)으로 처리 (해설은 참고용)
function questionContainsAnswerWordingEn(qNorm: string, knowledge: ProblemKnowledge): boolean {
  const a = knowledge.answer;
  if (!a || a.length < 2) return false;
  const aNorm = normalizeText(a).toLowerCase();
  const qLower = qNorm.toLowerCase();
  if (aNorm.length >= 3 && qLower.includes(aNorm)) return true;
  const qTokenSet = new Set(tokenizeEn(qNorm).map(t => t.toLowerCase()));
  const aTokens = knowledge.answerTokens.filter(t => t.length >= 2);
  if (!aTokens.length) return false;
  let matched = 0;
  for (const t of aTokens) {
    if (qTokenSet.has(t.toLowerCase())) matched++;
  }
  return matched / aTokens.length >= 0.6;
}

// -------------------------
// Main judge (English V9)
// -------------------------
export async function analyzeQuestionV9(
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

    const { normalized: q, invert } = normalizeNegationQuestion(qCut);

    if (knowledge.answer && questionContainsAnswerWordingEn(q, knowledge)) {
      return invert ? "no" : "yes";
    }

    const qConcepts = await extractQuestionConceptsV9(q, knowledge);
    const aConcepts = extractAnswerConceptsV9(knowledge);

    const antiText = detectAntonymMismatchByTextV9(q, knowledge.answer, knowledge.antonymAxes);
    const antiConcept = detectAntonymMismatchByConceptsV9(qConcepts, aConcepts, knowledge.antonymAxes, q, knowledge.answer);
    const antiLex = detectAntonymMismatchByLexiconV9(q, knowledge.answer, knowledge.antonymLexicon);

    const signalCount = antonymSignalCount({ antiText, antiConcept, antiLex });
    const hasStrongAntonymMismatch = signalCount >= CONFIG.V9.ANTONYM_REQUIRE_SIGNALS;

    const force = shouldForceNoByOntologyV9({ question: q, qConcepts, aConcepts, knowledge });

    if (force.forceNo) {
      if (hasQuantityMismatch(q, knowledge.answer, knowledge.quantityPatterns)) return invert ? "yes" : "no";

      const hasExact = [...qConcepts].some(c => aConcepts.has(c));
      if (!hasExact) return invert ? "yes" : "no";
    }

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

    if (hasStrongAntonymMismatch) {
      simAnswerAdj -= CONFIG.ADJUST.ANTONYM_PENALTY;
    }

    // 3) concept/infer bonus (강화)
    const conceptMatched = [...qConcepts].some(c => aConcepts.has(c));
    if (conceptMatched) {
      simAnswerAdj += CONFIG.ADJUST.CONCEPT_MATCH_BONUS;
      // 여러 개념이 매칭되면 추가 보너스
      const matchCount = [...qConcepts].filter(c => aConcepts.has(c)).length;
      if (matchCount >= 2) simAnswerAdj += 0.03;
    }

    const inferMatched =
      (qConcepts.has("accident") && aConcepts.has("accident")) ||
      (qConcepts.has("intentional") && aConcepts.has("intentional")) ||
      (qConcepts.has("crime") && aConcepts.has("crime")) ||
      (qConcepts.has("escape") && aConcepts.has("escape"));
    if (inferMatched) simAnswerAdj += CONFIG.ADJUST.INFER_MATCH_BONUS;

    // 문맥 개념 매칭 (V9+)
    const contextualMatches = [
      qConcepts.has("past") && aConcepts.has("past"),
      qConcepts.has("future") && aConcepts.has("future"),
      qConcepts.has("causal") && aConcepts.has("causal"),
      qConcepts.has("death_person") && aConcepts.has("death_person"),
      qConcepts.has("murder_action") && aConcepts.has("murder_action"),
    ];
    if (contextualMatches.some(m => m)) simAnswerAdj += 0.05;

    if (force.taxonomyHit) simAnswerAdj += force.taxonomyBonus;

    if (isGeneralizationQuestion(q) && !conceptMatched && !force.taxonomyHit) {
      simContentAdj += CONFIG.ADJUST.GENERALIZATION_NO_BONUS;
      simAnswerAdj -= CONFIG.ADJUST.TAXONOMY_GENERALIZATION_PENALTY;
    }

    const qMod = hasModality(q);
    const aMod = answerTop.some(hasModality);
    if (qMod !== aMod) simAnswerAdj -= 0.03;

    simAnswerAdj = Math.max(-1, Math.min(1, simAnswerAdj));
    simContentAdj = Math.max(-1, Math.min(1, simContentAdj));

    const simAnswerFinal = simAnswerAdj * 0.7 + simAnswerAvg * 0.3;
    const simContentFinal = simContentAdj * 0.7 + simContentAvg * 0.3;

    const forceNoSim = CONFIG.ADJUST.ANTONYM_FORCE_NO_SIM_BASE;
    if (hasStrongAntonymMismatch && simAnswerFinal >= forceNoSim) {
      return invert ? "yes" : "no";
    }

    let result: JudgeResult;

    if (simAnswerFinal >= CONFIG.THRESHOLD.DECISIVE_ANSWER && simContentFinal >= CONFIG.THRESHOLD.DECISIVE_CONTENT) {
      result = "decisive";
    } else if (simAnswerFinal >= CONFIG.THRESHOLD.YES) {
      result = "yes";
    } else if (simContentFinal >= CONFIG.THRESHOLD.NO_CONTENT && simAnswerFinal <= CONFIG.THRESHOLD.NO_ANSWER_MAX) {
      result = "no";
    } else {
      // 문맥적 불일치 감지: 질문과 문제 내용/답변 간의 문맥적 거리 계산
      const contextMismatch = detectContextualMismatch(q, knowledge, simAnswerFinal, simContentFinal);
      
      // irrelevant 판단: 유사도가 낮거나 문맥적 불일치가 있을 때
      if (contextMismatch.isIrrelevant || 
          (simAnswerFinal <= CONFIG.THRESHOLD.IRRELEVANT_MAX && simContentFinal <= CONFIG.THRESHOLD.IRRELEVANT_CONTENT_MAX) ||
          (simAnswerFinal <= CONFIG.THRESHOLD.IRRELEVANT_MAX && simContentFinal < 0.40)) {
        result = "irrelevant";
      } else {
        const inAmbiguous = simAnswerFinal >= CONFIG.AMBIGUOUS_RANGE.min && simAnswerFinal <= CONFIG.AMBIGUOUS_RANGE.max;

        if (inAmbiguous && fallbackJudge && hasStrongAntonymMismatch) {
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
    }

    if (invert && (result === "yes" || result === "no")) result = result === "yes" ? "no" : "yes";
    return result;
  } catch (e) {
    console.error("analyzeQuestionV9 error:", e);
    return "irrelevant";
  }
}

// -------------------------
// API compatibility wrappers
// -------------------------
export async function analyzeQuestionV8(
  questionRaw: string,
  knowledge: ProblemKnowledge,
  fallbackJudge?: FallbackJudge
): Promise<JudgeResult> {
  return analyzeQuestionV9(questionRaw, knowledge, fallbackJudge);
}

export async function analyzeQuestionSemanticV8(
  question: string,
  problemContent: string,
  problemAnswer: string,
  fallbackJudge?: FallbackJudge,
  llmBuilder?: KnowledgeBuilderLLM
): Promise<JudgeResult> {
  const knowledge = await buildProblemKnowledge(problemContent, problemAnswer, llmBuilder);
  return analyzeQuestionV9(question, knowledge, fallbackJudge);
}

export async function analyzeQuestion(
  question: string,
  problemContent: string,
  problemAnswer: string
): Promise<JudgeResult> {
  return analyzeQuestionSemanticV8(question, problemContent, problemAnswer);
}

// -------------------------
// Answer Similarity V9 (English)
// -------------------------
export async function calculateAnswerSimilarityV9(args: {
  userAnswer: string;
  correctAnswer: string;
  problemContent?: string;
  knowledge?: ProblemKnowledge;
}): Promise<number> {
  const ua = normalizeText(args.userAnswer);
  const ca = normalizeText(args.correctAnswer);
  if (!ua || !ca) return 0;

  try {
    const userEmbedding = await getEmbedding(ua);
    const correctEmbedding = await getEmbedding(ca);

    let sim = cosineSimilarity(userEmbedding, correctEmbedding);

    if (args.problemContent) {
      const contentNormalized = normalizeText(args.problemContent);
      if (contentNormalized) {
        const contentEmbedding = await getEmbedding(contentNormalized);
        const contentUserSim = cosineSimilarity(contentEmbedding, userEmbedding);
        const contentCorrectSim = cosineSimilarity(contentEmbedding, correctEmbedding);
        if (contentUserSim > 0.5 && contentCorrectSim > 0.5) {
          const contextBonus = Math.min(0.15, (contentUserSim + contentCorrectSim) / 2 * 0.2);
          sim = Math.min(1.0, sim + contextBonus);
        }
      }
    }

    if (args.knowledge) {
      const k = args.knowledge;

      const uTokens = tokenizeEn(ua);
      const cTokens = tokenizeEn(ca);

      let synHit = 0;
      for (const ut of uTokens) {
        const syns = GLOBAL_SYNONYMS.get(ut) ?? (await getOrBuildSynonymsForToken(ut, k));
        if (syns.some(s => cTokens.includes(s))) synHit++;
      }
      if (synHit > 0) sim = Math.min(1.0, sim + CONFIG.V9.ANSWER_SYNONYM_BONUS);

      const hyper = k.hypernymMap;
      let taxHit = 0;
      for (const uc of uTokens) {
        for (const cc of cTokens) {
          if (uc === cc) continue;
          if (isHypernymOf(uc, cc, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH) || isHyponymOf(uc, cc, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH)) {
            taxHit++;
            break;
          }
        }
        if (taxHit >= 1) break;
      }
      if (taxHit > 0) sim = Math.min(1.0, sim + CONFIG.V9.ANSWER_TAXONOMY_BONUS);

      const aText = detectAntonymMismatchByTextV9(ua, ca, k.antonymAxes);
      const aConcept = detectAntonymMismatchByConceptsV9(new Set(uTokens), new Set(cTokens), k.antonymAxes, ua, ca);
      const aLex = detectAntonymMismatchByLexiconV9(ua, ca, k.antonymLexicon);
      const sig = antonymSignalCount({ antiText: aText, antiConcept: aConcept, antiLex: aLex });

      if (sig >= CONFIG.V9.ANTONYM_REQUIRE_SIGNALS) {
        sim = Math.max(-1, sim - CONFIG.V9.ANSWER_ANTONYM_PENALTY);
      }
    }

    const uWords = tokenizeEn(ua);
    const cWords = tokenizeEn(ca);
    const cSet = new Set(cWords);

    let match = 0;
    for (const w of uWords) {
      if (cSet.has(w)) match++;
      else {
        const c = cWords.find(x => x.includes(w) || w.includes(x));
        if (c) match += 0.5;
      }
    }
    const keywordRatio = match / Math.max(cWords.length, uWords.length, 1);
    if (keywordRatio > 0.3) {
      const keywordBonus = Math.min(0.1, keywordRatio * 0.15);
      sim = Math.min(1.0, sim + keywordBonus);
    }

    let adjusted = sim;
    if (sim > 0.7) adjusted = 0.7 + (sim - 0.7) * 1.5;
    else if (sim > 0.5) adjusted = 0.5 + (sim - 0.5) * 1.2;
    else if (sim <= 0.3) adjusted = sim * 0.85;

    const pct = Math.max(0, Math.min(100, adjusted * 100));
    return Math.round(pct * 10) / 10;
  } catch (e) {
    console.error("calculateAnswerSimilarityV9 error:", e);
    return calculateSimpleMatch(ua, ca);
  }
}

function calculateSimpleMatch(userAnswer: string, correctAnswer: string): number {
  const uWords = tokenizeEn(userAnswer);
  const cWords = tokenizeEn(correctAnswer);
  if (!cWords.length) return 0;

  const cSet = new Set(cWords);
  let matched = 0;
  for (const w of uWords) {
    if (cSet.has(w)) matched++;
    else {
      const c = cWords.find(x => x.includes(w) || w.includes(x));
      if (c) matched += 0.5;
    }
  }

  const ratio = matched / Math.max(cWords.length, uWords.length, 1);
  return Math.round(ratio * 1000) / 10;
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
// Compatibility: calculateAnswerSimilarity
// -------------------------
export async function calculateAnswerSimilarityEn(
  userAnswer: string,
  correctAnswer: string,
  problemContent?: string,
  knowledge?: ProblemKnowledge | null
): Promise<number> {
  return calculateAnswerSimilarityV9({
    userAnswer,
    correctAnswer,
    problemContent,
    knowledge: knowledge || undefined,
  });
}

export async function calculateAnswerSimilarity(
  userAnswer: string, 
  correctAnswer: string, 
  problemContent?: string
): Promise<number> {
  return calculateAnswerSimilarityV9({
    userAnswer,
    correctAnswer,
    problemContent,
  });
}

