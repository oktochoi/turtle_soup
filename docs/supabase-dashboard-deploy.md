# Supabase 대시보드에서 Edge Function 배포하기

## 단계별 가이드

### 1단계: Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택

### 2단계: Edge Functions 메뉴로 이동
1. 왼쪽 사이드바에서 **Edge Functions** 클릭
2. 또는 URL: `https://app.supabase.com/project/YOUR_PROJECT_ID/functions`

### 3단계: 새 Function 생성
1. **Create a new function** 버튼 클릭
2. Function 이름 입력: `process-ai-learning`
3. **Create function** 클릭

### 4단계: 코드 복사 및 붙여넣기
아래 코드를 복사하여 대시보드 에디터에 붙여넣기:

```typescript
// Supabase Edge Function: AI 학습 큐 처리
// 이 함수는 주기적으로 호출되어 ai_learning_queue의 작업을 처리합니다.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 배치 크기 (한 번에 처리할 작업 수)
    const batchSize = parseInt(Deno.env.get("BATCH_SIZE") || "10");

    // 1. 큐에서 다음 작업 가져오기
    const { data: jobs, error: fetchError } = await supabase.rpc(
      "get_next_learning_job",
      { batch_size: batchSize }
    );

    if (fetchError) {
      console.error("작업 가져오기 오류:", fetchError);
      return new Response(
        JSON.stringify({ error: "작업 가져오기 실패", details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "처리할 작업이 없습니다.", processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📦 ${jobs.length}개의 작업을 처리합니다.`);

    // 2. 모든 작업을 'processing'으로 업데이트
    const jobIds = jobs.map(j => j.id);
    for (const jobId of jobIds) {
      await supabase.rpc("update_learning_job_status", {
        job_id: jobId,
        new_status: "processing",
      });
    }

    // 3. AI 학습 패턴 분석 실행
    const minReports = 5;
    const lookbackDays = 30;

    const { data: patterns, error: analyzeError } = await supabase.rpc(
      "analyze_bug_reports_for_learning",
      {
        min_reports: minReports,
        lookback_days: lookbackDays,
      }
    );

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
      patterns_found: 0,
    };

    if (analyzeError) {
      // 모든 작업을 실패로 표시
      for (const jobId of jobIds) {
        await supabase.rpc("update_learning_job_status", {
          job_id: jobId,
          new_status: "failed",
          error_msg: `패턴 분석 오류: ${analyzeError.message}`,
        });
      }
      results.failed = jobIds.length;
      results.errors.push(`패턴 분석 오류: ${analyzeError.message}`);
    } else {
      // 패턴이 발견되면 ai_learning_patterns에 저장
      if (patterns && patterns.length > 0) {
        for (const pattern of patterns) {
          try {
            // 기존 패턴 확인
            const { data: existing } = await supabase
              .from("ai_learning_patterns")
              .select("id")
              .eq("pattern_type", pattern.pattern_type)
              .eq("pattern_data", JSON.stringify(pattern.pattern_data))
              .maybeSingle();

            if (!existing) {
              // 새 패턴 저장
              const { error: insertError } = await supabase
                .from("ai_learning_patterns")
                .insert({
                  pattern_type: pattern.pattern_type,
                  pattern_data: pattern.pattern_data,
                  confidence_score: pattern.confidence,
                  bug_report_count: pattern.report_count,
                  applied: false,
                });

              if (insertError) {
                console.error("패턴 저장 오류:", insertError);
                results.errors.push(`패턴 저장 오류: ${insertError.message}`);
              } else {
                results.patterns_found++;
                console.log(`✅ 새 패턴 저장: ${pattern.pattern_type}`);
              }
            }
          } catch (error: any) {
            console.error("패턴 처리 오류:", error);
            results.errors.push(`패턴 처리 오류: ${error.message}`);
          }
        }
      }

      // 모든 작업을 완료로 표시
      for (const jobId of jobIds) {
        await supabase.rpc("update_learning_job_status", {
          job_id: jobId,
          new_status: "completed",
        });
      }
      results.processed = jobIds.length;
    }

    // 4. 통계 업데이트
    try {
      await supabase.rpc("update_ai_learning_stats");
    } catch (statsError) {
      console.error("통계 업데이트 오류:", statsError);
    }

    // 5. 학습된 리포트를 studied로 표시
    if (results.processed > 0) {
      try {
        const { error: markError } = await supabase.rpc("mark_reports_as_studied");
        if (markError) {
          console.error("학습 리포트 표시 오류:", markError);
        }
      } catch (error) {
        console.error("학습 리포트 표시 오류:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: `${results.processed}개 처리 완료, ${results.failed}개 실패, ${results.patterns_found}개 패턴 발견`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Edge Function 오류:", error);
    return new Response(
      JSON.stringify({
        error: "서버 오류",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

### 5단계: 환경 변수 설정 (선택사항)
1. Function 페이지에서 **Settings** 탭 클릭
2. **Secrets** 섹션에서 환경 변수 추가:
   - `BATCH_SIZE`: `10` (기본값, 선택사항)

### 6단계: 배포
1. **Deploy** 버튼 클릭
2. 배포 완료 대기 (몇 초 소요)

### 7단계: Next.js API Route 수정
Edge Function이 배포되면, `app/api/cron/process-ai-learning/route.ts`를 Edge Function을 호출하도록 수정:

```typescript
// Edge Function 호출로 변경
const response = await fetch(
  `${supabaseUrl}/functions/v1/process-ai-learning`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
  }
);
```

## 완료!

이제 Vercel Cron Job이 10분마다 Edge Function을 호출하여 AI 학습 큐를 처리합니다.

## 테스트

배포 후 테스트:
1. Supabase 대시보드에서 Function 로그 확인
2. Vercel 대시보드에서 Cron Job 실행 로그 확인

