# AI 학습 큐 처리 Edge Function

이 Edge Function은 `ai_learning_queue` 테이블의 작업을 처리하여 AI 학습 패턴을 생성합니다.

## 배포 방법

```bash
# Supabase CLI 설치 필요
supabase functions deploy process-ai-learning
```

## 환경 변수 설정

Supabase 대시보드에서 다음 환경 변수를 설정하세요:

- `BATCH_SIZE`: 한 번에 처리할 작업 수 (기본값: 10)

## 호출 방법

### 1. 수동 호출 (테스트용)

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/process-ai-learning \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 2. 자동 스케줄링 (Cron Job)

Supabase 대시보드에서 Cron Job을 설정하거나, Vercel Cron Jobs를 사용할 수 있습니다.

#### Vercel Cron Jobs 설정

`vercel.json` 파일에 추가:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-ai-learning",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

그리고 `app/api/cron/process-ai-learning/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  // Vercel Cron Secret 확인
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/process-ai-learning`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
```

## 동작 방식

1. `get_next_learning_job()` 함수로 pending 작업 가져오기
2. 각 작업에 대해:
   - 버그 리포트 조회
   - `analyze_bug_reports_for_learning()` 실행
   - 발견된 패턴을 `ai_learning_patterns`에 저장
   - 작업 상태를 'completed'로 업데이트
3. 통계 업데이트

## 에러 처리

- 실패한 작업은 자동으로 재시도됩니다 (최대 3회)
- `retry_failed_learning_jobs()` 함수로 수동 재시도 가능

