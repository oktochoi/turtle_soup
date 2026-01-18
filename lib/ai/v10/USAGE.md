# V10 사용 가이드

## 기본 사용법

```typescript
import { analyzeQuestionV10 } from '@/lib/ai/v10/analyzer';
import { buildProblemKnowledge } from '@/lib/ai-analyzer';

// 1. ProblemKnowledge 구축
const knowledge = await buildProblemKnowledge(
  "문제 내용...",
  "정답..."
);

// 2. V10으로 분석
const result = await analyzeQuestionV10("질문...", knowledge);

// 3. 결과 확인
console.log(result.labelV10);      // 'yes' | 'no' | 'irrelevant'
console.log(result.confidence);    // 0~1
console.log(result.probs);         // { yes: 0.3, no: 0.5, irrelevant: 0.2 }
console.log(result.v9Baseline);   // V9 결과와 비교
```

## V9와 병렬 사용 (A/B 테스트)

```typescript
import { analyzeQuestionV8 } from '@/lib/ai-analyzer';
import { analyzeQuestionV10 } from '@/lib/ai/v10/analyzer';

const [v9Result, v10Result] = await Promise.all([
  analyzeQuestionV8(question, knowledge),
  analyzeQuestionV10(question, knowledge),
]);

// Confidence 기반 선택
const useResult = v10Result.confidence > 0.7 
  ? v10Result.labelV10 
  : v9Result;
```

## Feature 확인

```typescript
const result = await analyzeQuestionV10(question, knowledge);

console.log('Features:', result.features);
console.log('Embeddings:', result.embeddings);
console.log('Hard Guards:', result.hardGuardsTriggered);
```

## 모델 가중치 업데이트

1. 학습 데이터로 모델 학습
2. `lib/ai/v10/model-weights.json` 업데이트
3. 재배포

## 평가 실행

```bash
# Node.js 환경
npx ts-node scripts/evaluate-v10.ts

# 또는 브라우저에서
import { evaluateV10VsV9, printEvaluationResults } from '@/scripts/evaluate-v10';
const result = await evaluateV10VsV9();
printEvaluationResults(result);
```

