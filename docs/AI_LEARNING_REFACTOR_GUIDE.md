# AI 학습 API 리팩터 가이드

CPU throttle, Cold Start, 안정성 개선을 위한 AI 학습 파이프라인 리팩터링 가이드입니다.

---

## 현재 구조 (리팩터 완료)

```
Vercel Cron (10분마다)
  → /api/cron/process-ai-learning
    → supabase.rpc('run_ai_learning_cycle', { p_batch_size: 50 })
      ← PostgreSQL 내부에서 전체 사이클 처리 (무거운 작업)
```

**개선 사항:**
- Edge Function 제거 → 단일 RPC 호출만 수행 (트리거 전용)
- `AI_LEARNING_BATCH_SIZE` env 지원 (기본 50, 1~100)
- `batch_size`, `processing_time_ms`, `patterns_found` 로깅

---

## 권장 구조 (우선순위)

### 1순위: AI 작업 Edge에서 분리

**목표:** Cron은 트리거만, 실제 처리는 DB/Worker에서

#### 옵션 A: Supabase pg_cron (추천, 인프라 추가 없음)

```
Supabase pg_cron (10분마다)
  → run_ai_learning_cycle(50)  ← PostgreSQL 함수
    → get_next_learning_job(50)
    → analyze_bug_reports_for_learning()
    → 패턴 저장, 통계 업데이트
```

- **장점:** Vercel 부하 제로, DB 내부에서 완결
- **마이그레이션:** `069_ai_learning_pg_cron.sql` 참고

**pg_cron 설정 방법 (Supabase 대시보드):**

1. Database → Extensions → `pg_cron` 활성화
2. SQL Editor에서 실행:

```sql
SELECT cron.schedule(
  'ai-learning-cycle',
  '*/10 * * * *',
  $$SELECT run_ai_learning_cycle(50)$$
);
```

3. pg_cron 사용 시 Vercel Cron에서 `/api/cron/process-ai-learning` 제거 가능 (vercel.json)

#### 옵션 B: Cron → Queue → Worker

```
Vercel Cron
  → 큐에 작업 등록만 (가벼움)
  → 202 Accepted 즉시 반환

별도 Worker (Railway, Fly.io, Supabase Edge)
  → 큐에서 꺼내서 처리
```

---

### 2순위: 배치 처리 강화

- `AI_LEARNING_BATCH_SIZE` env 추가 (기본 50)
- 50~100개 단위로 묶어 처리 → CPU burst 감소

---

### 3순위: 캐싱 강화

- `ai_learning_patterns` 조회 결과 TTL 캐시
- `loadLearnedSynonyms()` 등 → Redis/메모리 캐시 (선택)

---

### 4순위: 모니터링/로깅

로그에 포함할 항목:
- `batch_size`
- `processing_time_ms`
- `patterns_found`
- `error_count`

---

## 적용 체크리스트

- [x] AI 작업 Edge에서 분리 (run_ai_learning_cycle RPC로 트리거만)
- [x] 배치 크기 50+ 적용 (AI_LEARNING_BATCH_SIZE env)
- [x] 처리 시간/배치 크기 로깅
- [ ] Cold start 완화 (필요 시 5~10분 ping)
- [ ] pg_cron 사용 시 Vercel Cron 제거 (선택)

---

## 한 줄 결론

**무거운 AI/분석 작업을 서버리스/엣지에서 직접 돌리지 말고, pg_cron 또는 전용 Worker로 분리하면 체감 성능과 안정성이 크게 개선됩니다.**
