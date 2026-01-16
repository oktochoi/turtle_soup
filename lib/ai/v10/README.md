# AI 질문 분석기 V10

## 개요

V10은 V9의 규칙 기반 판정을 확률 기반 분류기로 전환한 새로운 버전입니다. 시간이 지나도 안정적으로 발전할 수 있도록 설계되었습니다.

## 주요 변경사항

### 1. Feature 기반 Classifier
- V9의 지표들을 feature로 추출
- Logistic Regression 분류기 사용
- 브라우저에서 실행 가능한 경량 모델

### 2. Pair Embedding
- 질문+컨텍스트 기반 임베딩으로 판단 강화
- `simQA`: Q||A vs A similarity
- `simQC`: Q||C vs C similarity

### 3. Hard Guards
- HARD1: quantityMismatch → 무조건 no
- HARD2: strongAntonymMismatch + highSim → 무조건 no
- 나머지는 classifier가 판단

### 4. 학습 데이터 승인 시스템
- `ai_learning_candidates`: 후보 데이터 (pending/approved/rejected)
- `ai_learning_deployed`: 승인된 데이터만 배포
- 자동 반영 방지

## 파일 구조

```
lib/ai/v10/
├── types.ts              # 타입 정의
├── features.ts           # Feature Extractor
├── pair-embedding.ts     # Pair Embedding 계산
├── classifier.ts         # Logistic Regression Classifier
├── analyzer.ts           # V10 메인 분석 함수
├── learning-loader.ts    # 승인된 학습 데이터 로더
├── model-weights.json    # 모델 가중치
└── README.md            # 이 파일

tests/
└── golden_questions.json # Golden Testset

scripts/
└── evaluate-v10.ts      # 평가 스크립트
```

## 사용법

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

### V9와 병렬 사용 (A/B 테스트)

```typescript
import { analyzeQuestionV8 } from '@/lib/ai-analyzer';
import { analyzeQuestionV10 } from '@/lib/ai/v10/analyzer';

const [v9Result, v10Result] = await Promise.all([
  analyzeQuestionV8(question, knowledge),
  analyzeQuestionV10(question, knowledge),
]);

// 비교 및 선택
if (v10Result.confidence > 0.8) {
  useResult = v10Result.labelV10;
} else {
  useResult = v9Result; // fallback to V9
}
```

## Feature 목록

1. `simAnswerMaxRaw` - 답변 최대 유사도
2. `simContentMaxRaw` - 내용 최대 유사도
3. `simAnswerAvg` - 답변 평균 유사도
4. `simContentAvg` - 내용 평균 유사도
5. `simQA` - Pair embedding: Q||A vs A
6. `simQC` - Pair embedding: Q||C vs C
7. `tokenCommonRatio` - 공통 토큰 비율
8. `domainMatchRatio` - 도메인 매칭 비율
9. `exactConceptHitCount` - 정확한 개념 매칭 수
10. `expandedConceptHitCount` - 확장된 개념 매칭 수
11. `hasNegation` - 부정문 여부
12. `hasModality` - 양상 표현 여부
13. `questionLen` - 질문 길이 (정규화)
14. `antonymSignalCount` - 반의어 신호 수
15. `quantityMismatch` - 수량 불일치 여부
16. `taxonomyHit` - 택소노미 매칭 여부
17. `forceNoTriggered` - 강제 NO 트리거 여부
18. `decisionPathV9` - V9 판정 경로 인코딩

## 모델 학습

현재 `model-weights.json`은 초기값(모두 0)입니다. 실제 사용을 위해서는:

1. Golden Testset으로 학습 데이터 수집
2. Logistic Regression으로 가중치 학습
3. `model-weights.json` 업데이트

학습 스크립트는 별도로 구현 필요합니다.

## 평가

```bash
# Node.js 환경에서 실행
npx ts-node scripts/evaluate-v10.ts
```

또는 브라우저에서:

```typescript
import { evaluateV10VsV9, printEvaluationResults } from '@/scripts/evaluate-v10';

const result = await evaluateV10VsV9();
printEvaluationResults(result);
```

## 학습 데이터 승인

1. 후보 데이터는 `ai_learning_candidates` 테이블에 저장
2. 관리자가 승인/거부 결정
3. 승인된 데이터만 `ai_learning_deployed`에 자동 배포
4. V10은 `ai_learning_deployed`만 사용

## 주의사항

- V10은 V9를 대체하지 않고 병렬로 동작
- Embedding 호출 수는 엄격히 제한 (Pair embedding 최대 2회)
- Hard guards는 항상 우선 적용
- 모델 가중치가 학습되지 않으면 기본값(0)으로 동작

