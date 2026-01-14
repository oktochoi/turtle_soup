# AI 자동 학습 시스템

`ai_bug_reports` 테이블의 데이터를 활용하여 AI가 자동으로 학습하고 개선하는 시스템입니다.

## 아키텍처

### 1. 데이터 수집
- 사용자가 버그 리포트를 제출하면 `ai_bug_reports` 테이블에 저장됩니다.
- 버그 유형: `wrong_answer`, `wrong_yes_no`, `wrong_irrelevant`, `wrong_similarity`, `other`

### 2. 패턴 분석
- `analyze_bug_reports_for_learning()` 함수가 버그 리포트를 분석하여 패턴을 추출합니다.
- 패턴 유형:
  - **threshold_adjustment**: 특정 유사도 범위에서 자주 틀리는 경우 threshold 조정 제안
  - **synonym_discovery**: 새로운 유의어 관계 발견
  - **antonym_discovery**: 새로운 반의어 관계 발견
  - **context_rule**: 특정 문맥에서 자주 틀리는 규칙

### 3. 패턴 저장
- 추출된 패턴은 `ai_learning_patterns` 테이블에 저장됩니다.
- 각 패턴은 `confidence_score` (0.0 ~ 1.0)와 `bug_report_count`를 가집니다.

### 4. 패턴 적용
- `apply_learning_patterns()` 함수가 confidence가 0.6 이상인 패턴을 자동으로 적용합니다.
- 적용된 패턴은 `applied = true`로 표시됩니다.

### 5. AI 로직 통합
- `lib/ai-learning-loader.ts`가 학습된 패턴을 로드합니다.
- `lib/ai-analyzer.ts`가 분석 시 학습된 유의어/반의어를 우선적으로 사용합니다.

## 사용 방법

### 자동 학습 사이클 실행

```bash
# 전체 학습 사이클 실행 (분석 + 적용 + 통계 업데이트)
POST /api/ai/learning/cycle
```

또는 Supabase에서 직접:

```sql
SELECT run_ai_learning_cycle();
```

### 수동 분석

```bash
# 버그 리포트 분석
GET /api/ai/learning/analyze?min_reports=5&lookback_days=30

# 패턴 적용
POST /api/ai/learning/apply

# 통계 조회
GET /api/ai/learning/stats?days=7
```

### 스케줄링 (Supabase Cron)

Supabase에서 pg_cron extension을 활성화한 후:

```sql
-- 매일 자정에 자동 학습 실행
SELECT cron.schedule(
  'ai-learning-daily',
  '0 0 * * *',
  'SELECT run_ai_learning_cycle();'
);
```

## 학습 데이터 구조

### ai_learning_patterns 테이블

```sql
CREATE TABLE ai_learning_patterns (
  id UUID PRIMARY KEY,
  pattern_type TEXT, -- 'threshold_adjustment', 'synonym_discovery', etc.
  pattern_data JSONB, -- 패턴 데이터 (유연한 구조)
  confidence_score NUMERIC, -- 신뢰도 (0.0 ~ 1.0)
  bug_report_count INTEGER, -- 관련 버그 리포트 수
  applied BOOLEAN, -- 적용 여부
  applied_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 패턴 데이터 예시

**유의어 발견:**
```json
{
  "question_token": "살인자",
  "expected": "범인",
  "ai_suggested": "killer",
  "context": "문제 내용 일부..."
}
```

**Threshold 조정:**
```json
{
  "bug_type": "wrong_yes_no",
  "avg_similarity": 0.45,
  "min_similarity": 0.40,
  "max_similarity": 0.50,
  "suggested_threshold": 0.40
}
```

## 성능 고려사항

1. **캐싱**: 학습 데이터는 한 번만 로드하고 메모리에 캐싱됩니다.
2. **비동기 로딩**: 클라이언트 사이드에서만 로드되며, 서버 사이드에서는 무시됩니다.
3. **점진적 적용**: confidence가 높은 패턴부터 점진적으로 적용됩니다.

## 모니터링

`ai_learning_stats` 테이블에서 일일 통계를 확인할 수 있습니다:

- 총 버그 리포트 수
- 버그 유형별 통계
- 평균 confidence
- 발견된 패턴 수
- 적용된 패턴 수

## 주의사항

1. **오탐 방지**: confidence가 낮은 패턴은 자동 적용되지 않습니다.
2. **수동 검토**: threshold 조정 등 중요한 변경사항은 수동 검토를 권장합니다.
3. **롤백**: 잘못 적용된 패턴은 `applied = false`로 되돌릴 수 있습니다.

