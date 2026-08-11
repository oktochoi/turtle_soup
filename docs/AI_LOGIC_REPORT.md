# AI 분석 로직 전체 구조 리포트

> 분석일: 2026-08-11
> 프로젝트: Turtle Soup (바다거북스프)

---

## A) AI 판정 흐름 (질문 → yes/no/irrelevant)

### 전체 파이프라인

```
┌─────────────────────────────────────────────────────────────────────┐
│ 사용자 질문 입력                                                    │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. 전처리 (normalizeText → normalizeNegationQuestion)              │
│    - 유니코드 정리, 공백 정규화                                      │
│    - 부정(negation) 감지 → invert flag 추출 (원문 유지)              │
│    - 길이 검증 (4~420자)                                            │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. 정답 포함 여부 체크 (questionContainsAnswerWording)              │
│    - 질문에 정답의 핵심 토큰이 60% 이상 포함되면 즉시 YES            │
│    - invert=true이면 NO 반환                                       │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. 개념(Concept) 추출                                              │
│    ┌──────────────────────┐  ┌──────────────────────┐              │
│    │ qConceptsExact       │  │ qConceptsExpanded    │              │
│    │ (직접 canonical만)   │  │ (유의어+상하위어+문맥)│              │
│    └──────────────────────┘  └──────────────────────┘              │
│    ┌──────────────────────┐                                        │
│    │ aConcepts            │                                        │
│    │ (정답 토큰+추론개념) │                                        │
│    └──────────────────────┘                                        │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. 반의어(Antonym) 감지 - 3중 신호 게이팅                          │
│    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│    │ Text 기반      │ │ Concept 기반   │ │ Lexicon 기반   │        │
│    │(축별 pos/neg)  │ │(개념 축 매칭)  │ │(사전 직접조회) │        │
│    └────────────────┘ └────────────────┘ └────────────────┘        │
│    → 3개 중 2개 이상 hit → hasStrongAntonymMismatch = true         │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Force NO 검사 (shouldForceNoByOntologyV9)                       │
│    - 수량 불일치 (양발 vs 한쪽)                                     │
│    - Taxonomy 기반 일반화 질문 감지                                  │
│    - 추상 상위 개념 불일치                                          │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Embedding 유사도 계산                                           │
│    모델: Xenova/paraphrase-multilingual-MiniLM-L12-v2 (quantized)  │
│    실행: 브라우저 (@xenova/transformers)                             │
│    - 질문 → embedding vector                                       │
│    - 내용 Top-K 문장 (16개) → cosine similarity                    │
│    - 정답 Top-K 문장 (16개) → cosine similarity                    │
│    - LRU+TTL 캐시 (2500개, 12시간)                                 │
│    - 동시성 제어 (4 worker)                                         │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. 조기 IRRELEVANT 판정                                            │
│    - simAnswer ≤ 0.35 AND simContent ≤ 0.30                       │
│    - tokenCommonRatio < 0.15 AND 낮은 유사도                       │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. 유사도 보정 (Adjustment)                                        │
│    - Antonym penalty: -0.30                                        │
│    - Concept match bonus: +0.10                                    │
│    - Infer match bonus: +0.08                                      │
│    - Taxonomy match bonus: +0.10                                   │
│    - Generalization penalty: -0.18                                 │
│    - 최종: simFinal = simAdj × 0.7 + simAvg × 0.3                 │
└────────────────────────┬────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. 최종 판정 (우선순위: NO → YES → IRRELEVANT)                     │
│                                                                     │
│  [NO 조건]                                                          │
│   ├─ 속성질문("~인가요?") + 정답에 근거 없음                        │
│   ├─ simContent ≥ 0.44 AND simAnswer ≤ 0.32                       │
│   ├─ 강한 antonym + simAnswer ≥ 0.50                               │
│   └─ 범주 안(연결 있음) + YES 미달                                  │
│                                                                     │
│  [YES 조건] (매우 보수적)                                           │
│   ├─ simAnswer ≥ 0.65                                              │
│   ├─ conceptExactHitCount > 0                                      │
│   └─ hasExplicitEvidence = true                                    │
│                                                                     │
│  [IRRELEVANT 조건]                                                  │
│   └─ 범주 밖 (질문↔정답 연결 없음)                                  │
│                                                                     │
│  [invert 적용] yes↔no 반전 (irrelevant 유지)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 한국어 vs 영어 분석기 차이

| 구분 | `ai-analyzer.ts` (KO) | `ai-analyzer-en.ts` (EN) |
|------|----------------------|--------------------------|
| 토큰화 | `tokenizeKo` (roughStemKo 조사 제거) + `tokenizeEn` | `tokenizeEn`만 사용 |
| 개념 추출 | Exact/Expanded 분리 | 단일 Set |
| Canonical Map | KO↔EN 양방향 매핑 | 없음 |
| JudgeResult | `yes/no/irrelevant` | `yes/no/irrelevant/decisive` |
| 부정 처리 | 원문 유지, invert flag만 | 부정어 제거 후 정규화 |
| YES threshold | 0.65 (보수적) | 0.60 |
| 학습 데이터 | `CONFIG.LEARNING` flag로 게이팅 (기본 OFF) | 항상 로드 |

---

## B) 학습 시스템 흐름

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ 사용자가     │     │ ai_bug_reports   │     │ ai_learning_    │
│ 버그 리포트  │────▶│ 테이블 INSERT    │────▶│ queue 자동 추가 │
│ 제출         │     │                  │     │ (DB Trigger)    │
└──────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                    ┌──────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Cron 트리거 (2가지 경로)                                    │
│  ┌──────────────────┐  ┌─────────────────────────────────┐  │
│  │ Vercel Cron API  │  │ pg_cron (Supabase 내부)         │  │
│  │ /api/cron/       │  │ */10 * * * * (10분마다)         │  │
│  │ process-ai-      │  │ SELECT run_ai_learning_cycle()  │  │
│  │ learning         │  │                                 │  │
│  └────────┬─────────┘  └──────────────┬──────────────────┘  │
│           └─────────┬─────────────────┘                     │
│                     ▼                                       │
│       run_ai_learning_cycle(p_batch_size)                   │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 학습 사이클 내부 (PL/pgSQL)                                 │
│                                                             │
│ 1. get_next_learning_job(batch)                             │
│    └─ pending 상태, 우선순위/시간순, FOR UPDATE SKIP LOCKED  │
│                                                             │
│ 2. status → 'processing'                                    │
│                                                             │
│ 3. analyze_bug_reports_for_learning(min=5, lookback=30일)   │
│    ├─ threshold_patterns: 유사도 범위별 오류 빈도 분석       │
│    ├─ synonym_patterns: 기대답↔AI답 차이, 유사도 > 0.4      │
│    │   └─ is_valid_synonym_token() blacklist 필터            │
│    └─ context_patterns: 버그 유형+언어별 공통 키워드         │
│        └─ filter_stopwords() 불용어 제거                     │
│                                                             │
│ 4. ai_learning_patterns INSERT (중복 방지)                   │
│                                                             │
│ 5. status → 'completed'                                     │
│                                                             │
│ 6. update_ai_learning_stats()                               │
│                                                             │
│ 7. mark_reports_as_studied()                                │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 패턴 적용 → AI 분석기 반영                                  │
│                                                             │
│ apply_learning_patterns()                                   │
│   └─ ai_learning_patterns.applied = true                    │
│                                                             │
│ ai-learning-loader.ts (클라이언트 사이드)                    │
│   ├─ loadLearnedSynonyms() → GLOBAL_SYNONYMS에 병합         │
│   ├─ loadLearnedAntonyms() → GLOBAL_ANTONYM_LEXICON에 병합  │
│   └─ loadLearnedThresholds() → (현재 미사용)                │
│                                                             │
│ ⚠️ KO: CONFIG.LEARNING.USE_LEARNED_* = false (기본 OFF)     │
│ ⚠️ EN: 항상 로드 (게이팅 없음)                              │
└─────────────────────────────────────────────────────────────┘
```

### 안전장치

- `rollback_applied_patterns()`: 적용된 패턴 되돌리기
- `check_if_learned_error()`: 중복 버그 감지
- `retry_failed_learning_jobs()`: 실패 작업 재시도 (max 3)
- `FOR UPDATE SKIP LOCKED`: 동시 처리 방지

---

## C) 주요 설정값 (CONFIG)

### 판정 Threshold

| 설정 | 한국어 | 영어 | 설명 |
|------|--------|------|------|
| `YES` | **0.65** | **0.60** | YES 판정 최소 유사도 |
| `NO_CONTENT` | 0.44 | 0.44 | NO 판정 시 content 최소 유사도 |
| `NO_ANSWER_MAX` | 0.32 | 0.32 | NO 판정 시 answer 최대 유사도 |
| `IRRELEVANT_MAX` | 0.35 | 0.35 | irrelevant 판정 answer 임계값 |
| `IRRELEVANT_CONTENT_MAX` | 0.30 | 0.30 | irrelevant 판정 content 임계값 |
| `DECISIVE_ANSWER` | - | **0.70** | decisive 판정 (EN만) |

### 보정값 (ADJUST)

| 설정 | 값 | 설명 |
|------|---|------|
| `CONCEPT_MATCH_BONUS` | +0.10 | 개념 매칭 보너스 |
| `INFER_MATCH_BONUS` | +0.08 | 추론 개념 매칭 보너스 |
| `ANTONYM_PENALTY` | -0.30 | 반의어 감지 페널티 |
| `ANTONYM_FORCE_NO_SIM_BASE` | 0.55 | 반의어+고유사도 시 강제 NO |
| `TAXONOMY_MATCH_BONUS` | +0.10 | 상하위어 매칭 보너스 |
| `GENERALIZATION_NO_BONUS` | +0.22 | 일반화 질문 NO 방향 |
| `TAXONOMY_GENERALIZATION_PENALTY` | -0.18 | 일반화 질문 시 answer 감점 |

### Embedding/캐시

| 설정 | 값 |
|------|---|
| 모델 | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (quantized) |
| 실행 환경 | 브라우저 (`@xenova/transformers`) |
| TOP_K | 16 (content/answer 각각) |
| 캐시 크기 | 2500 (LRU) |
| 캐시 TTL | 12시간 |
| 동시성 | 4 worker |

### 학습 시스템

| 설정 | 값 |
|------|---|
| Batch Size | 50 (환경변수로 조정, max 100) |
| Cron 주기 | 10분 |
| 최소 리포트 수 | 5건 이상 |
| Lookback | 30일 |
| 재시도 | 최대 3회 |
| 유의어 최소 confidence | 0.6 |
| `USE_LEARNED_SYNONYMS` (KO) | **false** |
| `USE_LEARNED_ANTONYMS` (KO) | **false** |

---

## D) 현재 구조의 강점과 약점

### 강점

1. **LLM 없는 온디바이스 추론**: 브라우저에서 경량 embedding 모델을 직접 실행하여 서버 비용 없이 실시간 판정
2. **다층 판정 파이프라인**: embedding + 개념 매칭 + 반의어 감지 + 온톨로지 + 수량 불일치 + 속성 질문 감지 등 7+ 단계 복합 판정
3. **반의어 3중 게이팅**: text/concept/lexicon 3가지 신호 중 2개 이상 일치해야 강한 mismatch 판단 (false positive 억제)
4. **Exact vs Expanded 개념 분리 (V9)**: YES 판정은 Exact만, 보너스는 Expanded로 차등 적용
5. **자동 학습 파이프라인**: 버그 리포트 → 큐 → 패턴 분석 → 적용이 DB 트리거/pg_cron으로 완전 자동화
6. **KO+EN 이중 언어 지원**: Canonical Concept Layer + 다국어 embedding 모델

### 약점

1. **학습 데이터 반영이 기본 OFF**: `USE_LEARNED_SYNONYMS = false`, `USE_LEARNED_ANTONYMS = false`로 학습 파이프라인이 동작하지만 결과가 분석기에 반영되지 않음
2. **하드코딩된 사전 의존**: `GLOBAL_SYNONYMS`, `GLOBAL_ANTONYM_AXES`, `CANONICAL_MAP`, `GLOBAL_TAXONOMY` 모두 하드코딩. 새로운 도메인/어휘 확장에 수동 작업 필요
3. **한국어 형태소 분석 한계**: `roughStemKo`가 정규식 기반 조사 제거만 수행. 복합 조사, 용언 활용, 합성어 처리 불완전
4. **브라우저 전용 실행**: 서버 사이드에서 항상 `"irrelevant"` 반환. SSR/API 라우트에서 AI 판정 사용 불가
5. **영어 분석기에 학습 게이팅 없음**: 품질 미검증 학습 데이터가 영어 분석에 곧바로 반영될 수 있음
6. **threshold 학습 미반영**: `loadLearnedThresholds()` 수집만 하고 `CONFIG.THRESHOLD`에 적용하는 코드 없음
