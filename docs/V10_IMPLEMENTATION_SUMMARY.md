# V10 AI 질문 분석기 구현 요약

## 개요

V10은 V9의 규칙 기반 판정을 확률 기반 분류기로 전환한 새로운 버전입니다. 시간이 지나도 안정적으로 발전할 수 있도록 설계되었습니다.

## 구현된 주요 기능

### ✅ 1. Feature 기반 Classifier
- **파일**: `lib/ai/v10/classifier.ts`
- **구현**: Logistic Regression 분류기
- **입력**: 18개 feature 벡터
- **출력**: 4개 클래스(yes/no/irrelevant/decisive)의 확률 분포
- **모델 가중치**: `lib/ai/v10/model-weights.json` (현재 초기값)

### ✅ 2. Feature Extractor
- **파일**: `lib/ai/v10/features.ts`
- **18개 Feature 추출**:
  1. simAnswerMaxRaw
  2. simContentMaxRaw
  3. simAnswerAvg
  4. simContentAvg
  5. simQA (Pair embedding)
  6. simQC (Pair embedding)
  7. tokenCommonRatio
  8. domainMatchRatio
  9. exactConceptHitCount
  10. expandedConceptHitCount
  11. hasNegation
  12. hasModality
  13. questionLen
  14. antonymSignalCount
  15. quantityMismatch
  16. taxonomyHit
  17. forceNoTriggered
  18. decisionPathV9

### ✅ 3. Pair Embedding
- **파일**: `lib/ai/v10/pair-embedding.ts`
- **구현**: Q||A, Q||C 기반 유사도 계산
- **제한**: 최대 2회의 추가 embedding 호출
- **최적화**: Top1 sentence만 사용

### ✅ 4. V10 분석 함수
- **파일**: `lib/ai/v10/analyzer.ts`
- **함수**: `analyzeQuestionV10()`, `analyzeQuestionSemanticV10()`
- **Hard Guards**: 
  - HARD1: quantityMismatch → 무조건 no
  - HARD2: strongAntonymMismatch + highSim → 무조건 no
- **V9 병렬 지원**: V9와 함께 사용 가능 (A/B 테스트)

### ✅ 5. Golden Testset
- **파일**: `tests/golden_questions.json`
- **20개 샘플** 포함
- **형식**: problemId, content, answer, q, expected

### ✅ 6. 평가 스크립트
- **파일**: `scripts/evaluate-v10.ts`
- **기능**:
  - V9 vs V10 정확도 비교
  - Per-label accuracy
  - Confusion matrix
  - Wrong yes/no, wrong irrelevant 비율
  - Improvement 통계

### ✅ 7. 학습 데이터 승인 시스템
- **파일**: `supabase/migrations/040_ai_learning_approval.sql`
- **테이블**:
  - `ai_learning_candidates`: 후보 데이터 (pending/approved/rejected)
  - `ai_learning_deployed`: 승인된 데이터만 배포
- **로더**: `lib/ai/v10/learning-loader.ts`
- **정책**: 승인된 데이터만 사용 (자동 반영 방지)

## 파일 구조

```
lib/ai/v10/
├── types.ts              # 타입 정의
├── features.ts           # Feature Extractor
├── pair-embedding.ts     # Pair Embedding 계산
├── classifier.ts         # Logistic Regression Classifier
├── analyzer.ts           # V10 메인 분석 함수
├── learning-loader.ts    # 승인된 학습 데이터 로더
├── model-weights.json    # 모델 가중치 (초기값)
├── README.md            # 상세 문서
└── USAGE.md             # 사용 가이드

tests/
└── golden_questions.json # Golden Testset (20개 샘플)

scripts/
└── evaluate-v10.ts      # 평가 스크립트

supabase/migrations/
└── 040_ai_learning_approval.sql # 학습 데이터 승인 시스템
```

## 사용 예시

### 기본 사용

```typescript
import { analyzeQuestionV10 } from '@/lib/ai/v10/analyzer';
import { buildProblemKnowledge } from '@/lib/ai-analyzer';

const knowledge = await buildProblemKnowledge(content, answer);
const result = await analyzeQuestionV10(question, knowledge);

console.log(result.labelV10);      // 'yes' | 'no' | 'irrelevant' | 'decisive'
console.log(result.confidence);    // 0~1
console.log(result.probs);         // 각 라벨의 확률
console.log(result.v9Baseline);    // V9 결과 비교
```

### V9와 병렬 사용

```typescript
const [v9Result, v10Result] = await Promise.all([
  analyzeQuestionV8(question, knowledge),
  analyzeQuestionV10(question, knowledge),
]);
```

## 다음 단계

### 1. 모델 학습
현재 `model-weights.json`은 초기값(모두 0)입니다. 실제 사용을 위해서는:
- Golden Testset으로 학습 데이터 수집
- Logistic Regression으로 가중치 학습
- `model-weights.json` 업데이트

### 2. 평가 실행
```bash
npx ts-node scripts/evaluate-v10.ts
```

### 3. 학습 데이터 승인
- Supabase 마이그레이션 적용
- 관리자 대시보드에서 후보 데이터 승인/거부
- 승인된 데이터만 자동 배포

## 주의사항

1. **V10은 V9를 대체하지 않음**: 병렬로 동작하여 A/B 테스트 가능
2. **Embedding 호출 수 제한**: Pair embedding 최대 2회
3. **Hard guards 우선**: Hard guards는 항상 classifier보다 우선 적용
4. **모델 가중치**: 학습되지 않으면 기본값(0)으로 동작 (랜덤에 가까움)

## 변경된 함수 목록

### 신규 함수
- `analyzeQuestionV10()` - V10 메인 분석 함수
- `analyzeQuestionSemanticV10()` - V10 호환성 래퍼
- `extractFeaturesV10()` - Feature 추출
- `classifyV10()` - Logistic Regression 분류
- `calculatePairEmbeddings()` - Pair embedding 계산
- `loadApprovedLearningData()` - 승인된 학습 데이터 로드

### 유지된 함수 (V9)
- `analyzeQuestionV8()` - V9 메인 분석 함수 (그대로 유지)
- `buildProblemKnowledge()` - Knowledge 구축 (그대로 유지)
- 기타 V9 함수들 (그대로 유지)

## 성능 고려사항

- **Embedding 호출**: V9와 동일 + Pair embedding 2회 추가
- **Classifier**: 매우 경량 (Logistic Regression, 브라우저에서 즉시 실행)
- **Feature 계산**: V9 분석 과정에서 대부분 계산되므로 추가 비용 최소

## 안정성 보장

1. **Hard Guards**: 명확한 규칙은 항상 우선 적용
2. **Golden Testset**: 회귀 방지
3. **승인 기반 학습**: 자동 반영 오염 방지
4. **V9 병렬**: 문제 발생 시 V9로 fallback 가능

