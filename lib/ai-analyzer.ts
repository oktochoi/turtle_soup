// AI 질문 분석기 - Semantic + Problem-Knowledge Engine V9
// (Upgraded from V8.7) - Unified KO+EN+Mixed
//
// Runtime: Next.js/Vercel Browser (@xenova/transformers)
// Embedding model: Xenova/paraphrase-multilingual-MiniLM-L12-v2 (quantized)
//
// V9 주요 변경사항:
// [A] ProblemKnowledge 확장: taxonomyEdges, hypernymMap, hyponymMap, antonymLexicon, conceptVecCache
// [B] taxonomy 구축: GLOBAL_TAXONOMY + heuristic extraction
// [C] QuestionConcepts 확장: synonyms + (limited) hyper/hypo, concept explosion guard
// [D] Force-NO/YES: shouldForceNoByOntologyV9 (quantity mismatch, generalization guard)
// [E] Antonym 강화: axes 확장 + antonymLexicon + 2-of-3 signal gating
// [F] Answer Similarity V9: embedding + knowledge bonus(유의어/상하위어) + antonym penalty
// [G] KO+EN+Mixed 토큰화 + canonical concept layer

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

    // ✅ Antonym / contradiction control
    ANTONYM_PENALTY: 0.30,
    ANTONYM_FORCE_NO_SIM_BASE: 0.55,
    ANTONYM_FORCE_NO_SIM_EARLY_DELTA: +0.00,
    ANTONYM_FORCE_NO_SIM_LATE_DELTA: -0.05,

    // taxonomy bonus/penalty
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
    // concept explosion guard
    MAX_CONCEPTS_TOTAL: 180,
    MAX_HYPERNYM_PER_TOKEN: 3,
    MAX_HYPONYM_PER_TOKEN: 3,
    TAXONOMY_MAX_DEPTH: 3,

    // antonym false positive guard
    ANTONYM_REQUIRE_SIGNALS: 2, // text/concept/lexicon 중 2개 이상일 때만 강한 mismatch

    // answer similarity bonus/penalty
    ANSWER_SYNONYM_BONUS: 0.10,
    ANSWER_TAXONOMY_BONUS: 0.08,
    ANSWER_ANTONYM_PENALTY: 0.35,

    // embedding calls upper bound in AnswerSimilarityV9 (ua/ca/content)
    ANSWER_SIM_MAX_EMBEDS: 3,
  },
} as const;

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
// 텍스트 정규화 / 토큰화 (KO+EN+Mixed)
// -------------------------
type Lang = "ko" | "en" | "mixed";
type CanonicalConcept = string;

function detectLang(text: string): Lang {
  const hasKo = /[가-힣]/.test(text);
  const hasEn = /[a-zA-Z]/.test(text);
  if (hasKo && hasEn) return "mixed";
  if (hasKo) return "ko";
  if (hasEn) return "en";
  return "mixed";
}

function tokenizeEn(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter(t => t.length >= CONFIG.LEXICON.MIN_TOKEN_LEN)
    .slice(0, CONFIG.LEXICON.MAX_TOKENS);
}

function tokenizeUniversal(text: string): { token: string; lang: Lang }[] {
  const detectedLang = detectLang(text);
  if (detectedLang === "ko") return tokenizeKo(text).map(t => ({ token: t, lang: "ko" as Lang }));
  if (detectedLang === "en") return tokenizeEn(text).map(t => ({ token: t, lang: "en" as Lang }));
  return [
    ...tokenizeKo(text).map(t => ({ token: t, lang: "ko" as Lang })),
    ...tokenizeEn(text).map(t => ({ token: t, lang: "en" as Lang })),
  ];
}

// -------------------------
// Canonical Concept Layer (KO+EN mapping)
// -------------------------
const CANONICAL_MAP: Map<string, CanonicalConcept> = new Map([
  // person
  ["사람", "person"],
  ["남자", "person"],
  ["여자", "person"],
  ["아이", "person"],
  ["인간", "person"],
  ["human", "person"],
  ["person", "person"],
  ["man", "person"],
  ["woman", "person"],
  ["child", "person"],
  ["kid", "person"],
  ["boy", "person"],
  ["girl", "person"],

  // animal
  ["동물", "animal"],
  ["animal", "animal"],
  ["개", "dog"],
  ["고양이", "cat"],
  ["dog", "dog"],
  ["cat", "cat"],
  ["강아지", "dog"],
  ["냥이", "cat"],

  // place
  ["장소", "place"],
  ["집", "home"],
  ["가정", "home"],
  ["house", "home"],
  ["home", "home"],
  ["학교", "school"],
  ["school", "school"],
  ["병원", "hospital"],
  ["hospital", "hospital"],
  ["교회", "church"],
  ["church", "church"],

  // alive / dead
  ["살", "alive"],
  ["살아", "alive"],
  ["생존", "alive"],
  ["alive", "alive"],
  ["죽", "dead"],
  ["사망", "dead"],
  ["시체", "dead"],
  ["dead", "dead"],

  // open / closed
  ["열", "open"],
  ["열려", "open"],
  ["open", "open"],
  ["닫", "closed"],
  ["잠겨", "closed"],
  ["closed", "closed"],

  // accident / intentional
  ["사고", "accident"],
  ["우발", "accident"],
  ["실수", "accident"],
  ["accident", "accident"],
  ["고의", "intentional"],
  ["의도", "intentional"],
  ["계획", "intentional"],
  ["intentional", "intentional"],

  // crime-ish
  ["살인", "murder"],
  ["살인자", "killer"],
  ["범인", "culprit"],
  ["가해자", "culprit"],
  ["murder", "murder"],
  ["killer", "killer"],
  ["culprit", "culprit"],
]);

function toCanonical(token: string): CanonicalConcept {
  return CANONICAL_MAP.get(token) ?? token;
}

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
  const qTokens = [...tokenizeKo(question), ...tokenizeEn(question)];
  const sTokens = new Set([...tokenizeKo(sentence), ...tokenizeEn(sentence)]);
  if (!qTokens.length) return 0;

  // 정확한 토큰 매칭 + canonical 매칭
  let hits = 0;
  for (const t of qTokens) {
    if (sTokens.has(t)) hits++;
    // canonical 매칭도 고려
    const canon = toCanonical(t);
    if (canon !== t) {
      for (const st of sTokens) {
        if (toCanonical(st) === canon) {
          hits += 0.5;
          break;
        }
      }
    }
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
  // EN
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
];
const MODALITY_PATTERNS = ["가능", "일 수도", "아마", "추정", "확실", "반드시", "모르", "불확실", "어쩌면", "maybe", "perhaps", "possibly", "likely", "uncertain"];

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

  // KO
  nq = nq.replace(/지\s*않/g, "");
  nq = nq.replace(/지않/g, "");
  nq = nq.replace(/안\s*/g, "");
  nq = nq.replace(/못\s*/g, "");
  nq = nq.replace(/없/g, "있");

  // EN
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
  // EN alias
  { parent: "hand", child: "finger", rel: "part_of" },
  { parent: "finger", child: "nail", rel: "part_of" },
  { parent: "foot", child: "toe", rel: "part_of" },
  { parent: "toe", child: "toenail", rel: "part_of" },
];

// is_a (global minimal) - V9
const GLOBAL_TAXONOMY: OntologyEdge[] = [
  // 사람 계층
  { parent: "사람", child: "남자", rel: "is_a" },
  { parent: "사람", child: "여자", rel: "is_a" },
  { parent: "사람", child: "아이", rel: "is_a" },
  { parent: "사람", child: "어린이", rel: "is_a" },
  { parent: "사람", child: "소년", rel: "is_a" },
  { parent: "사람", child: "소녀", rel: "is_a" },
  
  // 동물 계층
  { parent: "동물", child: "개", rel: "is_a" },
  { parent: "동물", child: "고양이", rel: "is_a" },
  
  // 교통수단 계층
  { parent: "교통수단", child: "자동차", rel: "is_a" },
  { parent: "교통수단", child: "차", rel: "is_a" },
  { parent: "교통수단", child: "자전거", rel: "is_a" },
  { parent: "교통수단", child: "버스", rel: "is_a" },
  { parent: "교통수단", child: "기차", rel: "is_a" },
  
  // 범죄 계층
  { parent: "범죄", child: "살인", rel: "is_a" },
  { parent: "범죄", child: "도둑질", rel: "is_a" },
  { parent: "범죄", child: "살인자", rel: "is_a" },
  
  // 장소 계층
  { parent: "장소", child: "집", rel: "is_a" },
  { parent: "장소", child: "학교", rel: "is_a" },
  { parent: "장소", child: "병원", rel: "is_a" },
  { parent: "장소", child: "교회", rel: "is_a" },
  { parent: "장소", child: "사무실", rel: "is_a" },
  { parent: "장소", child: "방", rel: "is_a" },
  
  // 시간 계층
  { parent: "시간", child: "전", rel: "is_a" },
  { parent: "시간", child: "후", rel: "is_a" },
  { parent: "시간", child: "이전", rel: "is_a" },
  { parent: "시간", child: "이후", rel: "is_a" },
  { parent: "시간", child: "현재", rel: "is_a" },
  
  // EN 계층
  { parent: "person", child: "man", rel: "is_a" },
  { parent: "person", child: "woman", rel: "is_a" },
  { parent: "person", child: "child", rel: "is_a" },
  { parent: "person", child: "kid", rel: "is_a" },
  { parent: "person", child: "boy", rel: "is_a" },
  { parent: "person", child: "girl", rel: "is_a" },
  { parent: "animal", child: "dog", rel: "is_a" },
  { parent: "animal", child: "cat", rel: "is_a" },
  { parent: "vehicle", child: "car", rel: "is_a" },
  { parent: "vehicle", child: "bus", rel: "is_a" },
  { parent: "vehicle", child: "train", rel: "is_a" },
  { parent: "crime", child: "murder", rel: "is_a" },
  { parent: "crime", child: "theft", rel: "is_a" },
  { parent: "place", child: "home", rel: "is_a" },
  { parent: "place", child: "house", rel: "is_a" },
  { parent: "place", child: "school", rel: "is_a" },
  { parent: "place", child: "hospital", rel: "is_a" },
  { parent: "place", child: "church", rel: "is_a" },
  { parent: "place", child: "office", rel: "is_a" },
  { parent: "place", child: "room", rel: "is_a" },
];

// -------------------------
// 전역 유의어 사전 (일반적인 유의어 쌍)
// -------------------------
const GLOBAL_SYNONYMS: Map<string, string[]> = new Map([
  // 범죄 관련
  ["살인자", ["범인", "가해자", "범죄자", "죄인", "killer", "murderer", "culprit"]],
  ["범인", ["살인자", "가해자", "범죄자", "죄인", "culprit", "killer"]],
  ["가해자", ["살인자", "범인", "범죄자", "죄인", "perpetrator", "attacker"]],
  ["범죄자", ["살인자", "범인", "가해자", "죄인", "criminal", "offender"]],
  ["죄인", ["살인자", "범인", "가해자", "범죄자", "criminal"]],
  ["피해자", ["희생자", "사망자", "victim", "casualty"]],
  ["희생자", ["피해자", "사망자", "victim", "casualty"]],
  ["사망자", ["피해자", "희생자", "dead", "deceased"]],
  
  // 사람 관련
  ["여자", ["여성", "여인", "여성분", "woman", "female", "lady"]],
  ["여성", ["여자", "여인", "여성분", "woman", "female"]],
  ["남자", ["남성", "남성분", "man", "male", "guy"]],
  ["남성", ["남자", "남성분", "man", "male"]],
  ["아이", ["어린이", "소년", "소녀", "아동", "child", "kid", "youngster"]],
  ["어린이", ["아이", "소년", "소녀", "아동", "child", "kid"]],
  ["소년", ["아이", "어린이", "아동", "boy", "child"]],
  ["소녀", ["아이", "어린이", "아동", "girl", "child"]],
  ["아동", ["아이", "어린이", "소년", "소녀", "child"]],
  ["사람", ["인간", "인", "person", "human", "individual"]],
  ["인간", ["사람", "인", "human", "person"]],
  
  // 교통수단
  ["차", ["자동차", "승용차", "차량", "car", "vehicle", "automobile"]],
  ["자동차", ["차", "승용차", "차량", "car", "vehicle"]],
  ["차량", ["차", "자동차", "승용차", "vehicle", "car"]],
  ["버스", ["bus", "버스"]],
  ["기차", ["train", "열차"]],
  
  // 장소
  ["집", ["집안", "집안에", "가정", "주택", "home", "house", "residence"]],
  ["집안", ["집", "가정", "주택", "home", "house"]],
  ["가정", ["집", "집안", "주택", "home", "house"]],
  ["학교", ["school", "교육기관"]],
  ["병원", ["hospital", "의원", "클리닉"]],
  ["교회", ["church", "성당", "예배당"]],
  ["사무실", ["office", "오피스"]],
  ["방", ["room", "룸"]],
  
  // 시간/순서
  ["전", ["이전", "before", "earlier", "prior"]],
  ["후", ["이후", "after", "later", "subsequent"]],
  ["이전", ["전", "before", "earlier"]],
  ["이후", ["후", "after", "later"]],
  ["지금", ["현재", "now", "currently", "present"]],
  ["현재", ["지금", "now", "currently"]],
  
  // 상태/조건
  ["열", ["열려", "open", "opened", "개방"]],
  ["닫", ["닫혀", "closed", "shut", "폐쇄"]],
  ["살", ["살아", "alive", "living", "생존"]],
  ["죽", ["죽어", "dead", "died", "사망"]],
  ["있", ["존재", "exist", "present", "있다"]],
  ["없", ["부재", "absent", "없다", "none"]],
  
  // 행동
  ["도망", ["도주", "escape", "flee", "run away"]],
  ["도주", ["도망", "escape", "flee"]],
  ["죽이다", ["살해", "kill", "murder"]],
  ["살해", ["죽이다", "kill", "murder"]],
  ["떨어지다", ["추락", "fall", "drop", "crash"]],
  ["추락", ["떨어지다", "fall", "drop"]],
  
  // 사고/의도
  ["사고", ["사건", "accident", "incident", "우발"]],
  ["우발", ["사고", "accident", "unintentional"]],
  ["고의", ["의도", "intentional", "deliberate", "on purpose"]],
  ["의도", ["고의", "intentional", "deliberate"]],
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

  const partWholeKeywords = ["부위", "부분", "전체", "안에", "속에", "포함", "part", "inside", "included", "contains"];
  const hasPartWholeContext = partWholeKeywords.some(kw => text.includes(kw));
  if (!hasPartWholeContext) return edges;

  const existing = new Set(GLOBAL_ONTOLOGY.map(e => `${e.parent}::${e.child}::${e.rel}`));

  for (let i = 0; i < allTokens.length; i++) {
    for (let j = i + 1; j < allTokens.length; j++) {
      const t1 = allTokens[i];
      const t2 = allTokens[j];

      if (t1.includes(t2) && t1.length > t2.length && t2.length >= 2) {
        const key = `${t1}::${t2}::part_of`;
        if (!existing.has(key) && text.includes(t1) && text.includes(t2)) edges.push({ parent: t1, child: t2, rel: "part_of" });
      } else if (t2.includes(t1) && t2.length > t1.length && t1.length >= 2) {
        const key = `${t2}::${t1}::part_of`;
        if (!existing.has(key) && text.includes(t1) && text.includes(t2)) edges.push({ parent: t2, child: t1, rel: "part_of" });
      }
    }
  }
  return edges.slice(0, 40);
}

// heuristic: auto taxonomy edges (is_a) - extremely gated (V9)
function extractAutoTaxonomyEdges(
  content: string,
  answer: string,
  contentTokens: string[],
  answerTokens: string[]
): OntologyEdge[] {
  const text = normalizeText(`${content} ${answer}`).toLowerCase();
  const ctxKeywords = ["종류", "분류", "중 하나", "이다", "인", "라고", "kind", "type", "category", "one of", "classified"];
  const ok = ctxKeywords.some(k => text.includes(k));
  if (!ok) return [];

  const edges: OntologyEdge[] = [];
  const all = [...new Set([...contentTokens, ...answerTokens])];

  for (let i = 0; i < all.length; i++) {
    for (let j = 0; j < all.length; j++) {
      if (i === j) continue;
      const child = all[i];
      const parent = all[j];
      if (child.length < 2 || parent.length < 2) continue;
      if (child.includes(parent) && child.length > parent.length) {
        edges.push({ parent, child, rel: "is_a" });
      }
    }
  }

  const set = new Set<string>();
  const out = edges.filter(e => {
    const k = `${e.parent}::${e.child}`;
    if (set.has(k)) return false;
    set.add(k);
    return true;
  });

  return out.slice(0, 40);
}

// taxonomy maps (V9)
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
// Antonym axes (global minimal) + per-problem activation
// -------------------------
type AntonymAxis = { label: string; pos: string[]; neg: string[] };

const GLOBAL_ANTONYM_AXES: AntonymAxis[] = [
  { label: "alive/dead", pos: ["살", "생존", "살아", "살아있", "alive", "survive"], neg: ["죽", "사망", "시체", "숨졌", "dead", "died", "corpse"] },
  { label: "open/closed", pos: ["열", "열려", "개방", "열림", "open", "opened"], neg: ["닫", "잠겨", "폐쇄", "닫힘", "closed", "shut", "locked"] },
  { label: "possible/impossible", pos: ["가능", "할수있", "될수있", "possible", "can"], neg: ["불가능", "할수없", "안되", "못하", "impossible", "cannot", "can't"] },
  { label: "exist/not", pos: ["있", "존재", "exist", "exists", "present"], neg: ["없", "부재", "not exist", "none", "absent"] },
  { label: "intentional/accident", pos: ["고의", "일부러", "의도", "계획", "intentional", "on purpose"], neg: ["사고", "우발", "실수", "뜻하지", "accident", "by accident"] },
  // V9 추가 축
  { label: "inside/outside", pos: ["안", "내부", "실내", "inside", "indoors"], neg: ["밖", "외부", "실외", "outside", "outdoors"] },
  { label: "up/down", pos: ["위", "상", "올라", "up", "above"], neg: ["아래", "밑", "내려", "down", "below"] },
  { label: "left/right", pos: ["왼쪽", "좌", "좌측", "left"], neg: ["오른쪽", "우", "우측", "right"] },
  { label: "before/after", pos: ["이전", "전", "전에", "before", "earlier"], neg: ["이후", "후", "뒤에", "after", "later"] },
  { label: "increase/decrease", pos: ["증가", "늘", "올라", "커져", "increase", "rise"], neg: ["감소", "줄", "내려", "작아져", "decrease", "drop"] },
];

const GLOBAL_ANTONYM_LEXICON: Map<string, string[]> = new Map([
  // KO
  ["안", ["밖", "외부", "실외"]],
  ["밖", ["안", "내부", "실내"]],
  ["위", ["아래", "밑"]],
  ["아래", ["위", "상"]],
  ["왼쪽", ["오른쪽"]],
  ["오른쪽", ["왼쪽"]],
  ["이전", ["이후"]],
  ["이후", ["이전"]],
  ["증가", ["감소"]],
  ["감소", ["증가"]],
  ["고의", ["사고", "우발", "실수"]],
  ["사고", ["고의", "의도"]],
  // EN
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

// exist/not gating (avoid high false positives)
const EXIST_POS_ROOTS = ["있", "존재", "exist", "present"];
const EXIST_NEG_ROOTS = ["없", "부재", "absent", "none"];

function hasExistTargetContext(text: string): boolean {
  const tokens = [...tokenizeKo(text), ...tokenizeEn(text)];
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

// 반의어(대립 개념) 감지 - 텍스트 기반 (V9)
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

// 반의어(대립 개념) 감지 - 개념 기반 (V9)
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

// 반의어(대립 개념) 감지 - lexicon 기반 (V9)
function detectAntonymMismatchByLexiconV9(
  question: string,
  answer: string,
  antonymLexicon: Map<string, string[]>
): { hit: boolean; pairs?: [string, string][] } {
  const qTok = [...tokenizeKo(question), ...tokenizeEn(question)];
  const aTok = [...tokenizeKo(answer), ...tokenizeEn(answer)];
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
  antonymAxes: AntonymAxis[];
  antonymLexicon: Map<string, string[]>; // V9

  entitySet: Set<string>;
  ontology: OntologyEdge[]; // part_of + (optional) extra
  taxonomyEdges: OntologyEdge[]; // is_a 중심 - V9

  hypernymMap: Map<string, string[]>; // V9
  hyponymMap: Map<string, string[]>; // V9

  inferredConcepts: Set<string>;
  quantityPatterns: QuantityPattern[];

  conceptVecCache: Map<string, Float32Array>; // V9
};

export type KnowledgeBuilderLLM = (args: { content: string; answer: string }) => Promise<{
  entities?: string[];
  ontologyEdges?: OntologyEdge[];
  taxonomyEdges?: OntologyEdge[];
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

  // 사고 관련 패턴 (강화)
  const hasBrake = [...tset].some(t => t.includes("브레이크") || t.includes("제동") || t.includes("brake") || t.includes("braking"));
  const hasFail = [...tset].some(t => t.includes("고장") || t.includes("불량") || t.includes("망가") || t.includes("안되") || t.includes("fail") || t.includes("broken") || t.includes("malfunction"));
  const hasCrash = [...tset].some(t => t.includes("추락") || t.includes("충돌") || t.includes("가드레일") || t.includes("넘어") || t.includes("떨어") || t.includes("crash") || t.includes("fall") || t.includes("collision"));
  const hasRun = [...tset].some(t => t.includes("도주") || t.includes("도망") || t.includes("질주") || t.includes("달리") || t.includes("run") || t.includes("escape") || t.includes("flee"));

  if (hasBrake && hasFail && (hasCrash || hasRun)) concepts.add("accident");
  if ((hasCrash || hasRun) && hasFail) concepts.add("accident"); // 더 관대한 패턴

  // 의도 관련 패턴 (강화)
  const hasIntent = [...tset].some(t => t.includes("고의") || t.includes("의도") || t.includes("계획") || t.includes("일부러") || t.includes("intent") || t.includes("purpose") || t.includes("deliberate") || t.includes("plan"));
  if (hasIntent) concepts.add("intentional");

  // 살인/범죄 패턴
  const hasKill = [...tset].some(t => t.includes("살해") || t.includes("죽이다") || t.includes("kill") || t.includes("murder"));
  const hasCriminal = [...tset].some(t => t.includes("범인") || t.includes("살인자") || t.includes("killer") || t.includes("culprit") || t.includes("murderer"));
  if (hasKill || hasCriminal) concepts.add("crime");

  // 도주/탈출 패턴
  if (hasRun) concepts.add("escape");

  // 시간 관련
  const hasBefore = [...tset].some(t => t.includes("전") || t.includes("이전") || t.includes("before") || t.includes("earlier"));
  const hasAfter = [...tset].some(t => t.includes("후") || t.includes("이후") || t.includes("after") || t.includes("later"));
  if (hasBefore) concepts.add("past");
  if (hasAfter) concepts.add("future");

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

// ontology/quantity force NO (V9)
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

  // taxonomy bonus
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

  const abstractSupers = ["person", "animal", "place", "범죄", "crime", "사람", "동물", "장소"].map(toCanonical);
  const qHasAbstract = [...qConcepts].some(c => abstractSupers.includes(c));
  const aHasAbstract = [...aConcepts].some(c => abstractSupers.includes(c));

  if (generalized && qHasAbstract && !aHasAbstract) {
    if (aConcepts.size >= 2) {
      return { forceNo: true, taxonomyHit, taxonomyBonus };
    }
  }

  return { forceNo: false, taxonomyHit, taxonomyBonus };
}

// V8 호환성
function shouldForceNoByOntologyV8(
  question: string,
  qConcepts: Set<string>,
  aConcepts: Set<string>,
  ontology: OntologyEdge[],
  answerText: string,
  quantityPatterns: QuantityPattern[] = []
): boolean {
  // V9로 변환하여 호출
  const knowledge = {
    answer: answerText,
    quantityPatterns,
    hypernymMap: new Map(),
  } as ProblemKnowledge;
  const result = shouldForceNoByOntologyV9({ question, qConcepts, aConcepts, knowledge });
  return result.forceNo;
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
  llmBuilder?: KnowledgeBuilderLLM,
  hints?: string[] | null
): Promise<ProblemKnowledge> {
  // 힌트가 있으면 content에 포함 (힌트는 추가 맥락 정보로 활용)
  let content = normalizeText(problemContent ?? "");
  if (hints && hints.length > 0) {
    const hintsText = hints.filter(h => h && h.trim()).map(h => h.trim()).join(' ');
    if (hintsText) {
      content = `${content} ${hintsText}`;
    }
  }
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
  let taxonomyEdges: OntologyEdge[] = [...GLOBAL_TAXONOMY];

  const inferredConcepts = inferConceptsFromTokens([...contentTokens, ...answerTokens]);
  const quantityPatterns = extractQuantityPatterns(content, answer);

  ontology = ontology.concat(extractAutoOntologyEdges(content, answer, contentTokens, answerTokens));
  taxonomyEdges = taxonomyEdges.concat(extractAutoTaxonomyEdges(content, answer, contentTokens, answerTokens));

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
  await loadLearnedDataOnce();
  const antonymLexicon = new Map<string, string[]>(GLOBAL_ANTONYM_LEXICON);
  if (learnedAntonymsCache) {
    for (const [token, antonyms] of learnedAntonymsCache.entries()) {
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
let learnedSynonymsCache: Map<string, string[]> | null = null;
let learnedAntonymsCache: Map<string, string[]> | null = null;
let learnedDataLoadPromise: Promise<void> | null = null;

async function loadLearnedDataOnce(): Promise<void> {
  if (learnedDataLoadPromise) return learnedDataLoadPromise;
  
  learnedDataLoadPromise = (async () => {
    try {
      // 동적 import로 클라이언트 사이드에서만 로드
      if (typeof window !== 'undefined') {
        const { loadAllLearningData } = await import('./ai-learning-loader');
        const { synonyms, antonyms } = await loadAllLearningData();
        learnedSynonymsCache = synonyms;
        learnedAntonymsCache = antonyms;
      }
    } catch (error) {
      console.warn('학습 데이터 로드 실패 (무시):', error);
      learnedSynonymsCache = new Map();
      learnedAntonymsCache = new Map();
    }
  })();
  
  return learnedDataLoadPromise;
}

// -------------------------
// Synonym expansion (per problem, lazy)
// 목표: 유의어 사전 수동 관리 최소화 - 문제 내부에서 embedding으로 자동 확장
// - 전역 유의어 사전을 먼저 확인 (살인자-범인 등 일반적인 유의어)
// - 학습된 유의어를 확인 (버그 리포트에서 추출)
// - 문제의 entitySet 내에서 embedding 유사도 기반으로 동적 유의어 발견
// - CONFIG.LEXICON.SYNONYM_SIM_THRESHOLD 이상의 유사도를 가진 토큰들을 유의어로 확장
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
  await loadLearnedDataOnce();

  // 1) global synonyms first
  const globalSyns = GLOBAL_SYNONYMS.get(token);
  const synonyms: string[] = globalSyns ? [...globalSyns] : [];

  // 1-1) learned synonyms (버그 리포트에서 학습한 유의어)
  if (learnedSynonymsCache) {
    const learnedSyns = learnedSynonymsCache.get(token);
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

async function extractQuestionConceptsV9(question: string, knowledge: ProblemKnowledge): Promise<Set<string>> {
  const toks = tokenizeUniversal(question);
  const concepts = new Set<string>();

  // base tokens -> canonical
  for (const { token } of toks) {
    concepts.add(toCanonical(token));
    if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
  }

  // synonyms expansion
  for (const { token } of toks) {
    const syns = await getOrBuildSynonymsForToken(token, knowledge);
    for (const s of syns) {
      concepts.add(toCanonical(s));
      if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
    }
  }

  // taxonomy expansion (limited)
  for (const { token } of toks) {
    const t = toCanonical(token);

    const hypers = (knowledge.hypernymMap.get(token) ?? [])
      .concat(knowledge.hypernymMap.get(t) ?? [])
      .map(toCanonical);

    for (const h of hypers.slice(0, CONFIG.V9.MAX_HYPERNYM_PER_TOKEN)) {
      concepts.add(h);
      if (concepts.size >= CONFIG.V9.MAX_CONCEPTS_TOTAL) return concepts;
    }

    const hypos = (knowledge.hyponymMap.get(token) ?? [])
      .concat(knowledge.hyponymMap.get(t) ?? [])
      .map(toCanonical);

    for (const h of hypos.slice(0, CONFIG.V9.MAX_HYPONYM_PER_TOKEN)) {
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

  // infer concepts
  const qNorm = normalizeText(question).toLowerCase();
  if (qNorm.includes("사고") || qNorm.includes("우발") || qNorm.includes("실수") || qNorm.includes("accident")) concepts.add("accident");
  if (qNorm.includes("고의") || qNorm.includes("일부러") || qNorm.includes("의도") || qNorm.includes("계획") || qNorm.includes("intentional") || qNorm.includes("on purpose")) concepts.add("intentional");

  return concepts;
}

// 문맥적 불일치 감지 (V9+)
// 질문과 문제 내용/답변 간의 문맥적 거리를 계산하여 irrelevant 판단 보조
function detectContextualMismatch(
  question: string,
  knowledge: ProblemKnowledge,
  simAnswer: number,
  simContent: number
): { isIrrelevant: boolean; reason?: string } {
  const qNorm = normalizeText(question).toLowerCase();
  const qTokens = new Set([...tokenizeKo(question), ...tokenizeEn(question)]);
  const contentTokens = new Set([...knowledge.contentTokens, ...knowledge.answerTokens]);
  
  // 1) 공통 토큰이 매우 적은 경우 (문맥적 불일치)
  const commonTokens = [...qTokens].filter(t => contentTokens.has(t) || contentTokens.has(toCanonical(t)));
  const commonRatio = qTokens.size > 0 ? commonTokens.length / qTokens.size : 0;
  
  // 2) 질문이 문제와 완전히 다른 주제인 경우 감지
  const problemDomainKeywords = new Set([
    ...knowledge.contentTokens.slice(0, 20), // 상위 20개 토큰
    ...knowledge.answerTokens.slice(0, 10),  // 상위 10개 토큰
  ]);
  
  const questionDomainMatch = [...qTokens].filter(t => 
    problemDomainKeywords.has(t) || 
    problemDomainKeywords.has(toCanonical(t)) ||
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
    '무엇', '뭐', '어떤', '어디', '언제', '누구', '왜', '어떻게',
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
  const qTokens = [...tokenizeKo(question), ...tokenizeEn(question)];
  const qTokensSet = new Set(qTokens);

  // 시간/순서 패턴
  const timePatterns = [
    { pattern: ["전", "이전", "before", "earlier"], concept: "past" },
    { pattern: ["후", "이후", "after", "later"], concept: "future" },
    { pattern: ["지금", "현재", "now", "currently"], concept: "present" },
  ];
  for (const { pattern, concept } of timePatterns) {
    if (pattern.some(p => qNorm.includes(p))) concepts.add(concept);
  }

  // 인과관계 패턴
  const causalPatterns = [
    { pattern: ["때문", "인해", "로", "because", "due to", "caused"], concept: "causal" },
    { pattern: ["결과", "결과적으로", "result", "consequence"], concept: "result" },
  ];
  for (const { pattern, concept } of causalPatterns) {
    if (pattern.some(p => qNorm.includes(p))) concepts.add(concept);
  }

  // 복합 개념 (여러 토큰 조합)
  const hasPerson = qTokensSet.has("사람") || qTokensSet.has("person") || qTokensSet.has("인간") || qTokensSet.has("human");
  const hasDead = qTokensSet.has("죽") || qTokensSet.has("dead") || qTokensSet.has("사망");
  const hasKill = qTokensSet.has("살해") || qTokensSet.has("kill") || qTokensSet.has("죽이다");
  
  if (hasPerson && hasDead) concepts.add("death_person");
  if (hasPerson && hasKill) concepts.add("murder_action");
  
  // 장소 + 행동 조합
  const hasPlace = qTokensSet.has("집") || qTokensSet.has("home") || qTokensSet.has("장소") || qTokensSet.has("place");
  const hasEscape = qTokensSet.has("도망") || qTokensSet.has("escape") || qTokensSet.has("도주");
  if (hasPlace && hasEscape) concepts.add("escape_from_place");

  return concepts;
}

// V8 호환성
async function extractQuestionConcepts(question: string, knowledge: ProblemKnowledge): Promise<Set<string>> {
  return extractQuestionConceptsV9(question, knowledge);
}

function extractAnswerConceptsV9(knowledge: ProblemKnowledge): Set<string> {
  const base = new Set<string>();
  for (const t of knowledge.answerTokens) base.add(toCanonical(t));
  knowledge.inferredConcepts.forEach(c => base.add(c));
  return base;
}

function extractAnswerConcepts(knowledge: ProblemKnowledge): Set<string> {
  return extractAnswerConceptsV9(knowledge);
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

    // 1-0) antonym/contradiction check (V9: 2-of-3 signal gating)
    const antiText = detectAntonymMismatchByTextV9(q, knowledge.answer, knowledge.antonymAxes);
    const antiConcept = detectAntonymMismatchByConceptsV9(qConcepts, aConcepts, knowledge.antonymAxes, q, knowledge.answer);
    const antiLex = detectAntonymMismatchByLexiconV9(q, knowledge.answer, knowledge.antonymLexicon);
    const signalCount = antonymSignalCount({ antiText, antiConcept, antiLex });
    const hasStrongAntonymMismatch = signalCount >= CONFIG.V9.ANTONYM_REQUIRE_SIGNALS;

    // 1-1) force NO by ontology / quantity mismatch (V9)
    const force = shouldForceNoByOntologyV9({ question: q, qConcepts, aConcepts, knowledge });
    if (force.forceNo) {
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

    // ✅ antonym mismatch penalty (V9: strong only)
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

    // 8) taxonomy bonus (V9)
    if (force.taxonomyHit) simAnswerAdj += force.taxonomyBonus;

    // generalization push-to-NO (V9: taxonomyHit 또는 conceptMatched면 약화)
    if (isGeneralizationQuestion(q) && !conceptMatched && !force.taxonomyHit) {
      simContentAdj += CONFIG.ADJUST.GENERALIZATION_NO_BONUS;
      simAnswerAdj -= CONFIG.ADJUST.TAXONOMY_GENERALIZATION_PENALTY;
    }

    // modality mismatch small penalty
    const qMod = hasModality(q);
    const aMod = answerTop.some(hasModality);
    if (qMod !== aMod) simAnswerAdj -= 0.03;

    simAnswerAdj = Math.max(-1, Math.min(1, simAnswerAdj));
    simContentAdj = Math.max(-1, Math.min(1, simContentAdj));

    const simAnswerFinal = simAnswerAdj * 0.7 + simAnswerAvg * 0.3;
    const simContentFinal = simContentAdj * 0.7 + simContentAvg * 0.3;

    // ✅ If contradiction + high similarity => force NO (V9)
    const forceNoSim = CONFIG.ADJUST.ANTONYM_FORCE_NO_SIM_BASE;
    if (hasStrongAntonymMismatch && simAnswerFinal >= forceNoSim) {
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

        // ✅ fallback only when ambiguous AND contradiction suspected (V9)
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
// Answer Similarity V9
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
      const uTokens = tokenizeUniversal(ua).map(x => x.token);
      const cTokens = tokenizeUniversal(ca).map(x => x.token);
      const uCanon = uTokens.map(toCanonical);
      const cCanon = cTokens.map(toCanonical);

      // synonym bonus
      let synHit = 0;
      for (const ut of uTokens) {
        const syns = GLOBAL_SYNONYMS.get(ut) ?? (await getOrBuildSynonymsForToken(ut, k));
        const synCanon = syns.map(toCanonical);
        if (synCanon.some(s => cCanon.includes(s))) synHit++;
      }
      if (synHit > 0) sim = Math.min(1.0, sim + CONFIG.V9.ANSWER_SYNONYM_BONUS);

      // taxonomy bonus
      const hyper = k.hypernymMap;
      let taxHit = 0;
      for (const uc of uCanon) {
        for (const cc of cCanon) {
          if (uc === cc) continue;
          if (isHypernymOf(uc, cc, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH) || isHyponymOf(uc, cc, hyper, CONFIG.V9.TAXONOMY_MAX_DEPTH)) {
            taxHit++;
            break;
          }
        }
        if (taxHit >= 1) break;
      }
      if (taxHit > 0) sim = Math.min(1.0, sim + CONFIG.V9.ANSWER_TAXONOMY_BONUS);

      // antonym penalty
      const aText = detectAntonymMismatchByTextV9(ua, ca, k.antonymAxes);
      const aConcept = detectAntonymMismatchByConceptsV9(new Set(uCanon), new Set(cCanon), k.antonymAxes, ua, ca);
      const aLex = detectAntonymMismatchByLexiconV9(ua, ca, k.antonymLexicon);
      const sig = antonymSignalCount({ antiText: aText, antiConcept: aConcept, antiLex: aLex });
      if (sig >= CONFIG.V9.ANTONYM_REQUIRE_SIGNALS) {
        sim = Math.max(-1, sim - CONFIG.V9.ANSWER_ANTONYM_PENALTY);
      }
    }

    const uWords = [...tokenizeKo(ua), ...tokenizeEn(ua)].map(toCanonical);
    const cWords = [...tokenizeKo(ca), ...tokenizeEn(ca)].map(toCanonical);
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

function calculateSimpleMatch(userAnswer: string, correctAnswer: string): number {
  const uWords = [...tokenizeKo(userAnswer), ...tokenizeEn(userAnswer)].map(toCanonical);
  const cWords = [...tokenizeKo(correctAnswer), ...tokenizeEn(correctAnswer)].map(toCanonical);
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

/*
Usage:

// 1) build once per selected problem
const knowledge = await buildProblemKnowledge(problemContent, problemAnswer, optionalLLMBuilder);

// 2) for each question
const r = await analyzeQuestionV8(userQuestion, knowledge, optionalFallbackJudge);

// If you want the old signature:
const r2 = await analyzeQuestionSemanticV8(userQuestion, problemContent, problemAnswer);
*/
