# Edge Function 배포 가이드

## 방법 1: Supabase CLI 사용 (권장)

### 1. Supabase CLI 설치

**Windows (PowerShell):**
```powershell
# Scoop 사용 (권장)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 또는 Chocolatey 사용
choco install supabase

# 또는 직접 다운로드
# https://github.com/supabase/cli/releases 에서 최신 버전 다운로드
```

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Linux:**
```bash
# npm 사용
npm install -g supabase

# 또는 직접 다운로드
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.zip -o supabase.zip
unzip supabase.zip
sudo mv supabase /usr/local/bin/
```

### 2. Supabase 로그인
```bash
supabase login
```

### 3. 프로젝트 연결
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. Edge Function 배포
```bash
supabase functions deploy process-ai-learning
```

---

## 방법 2: Supabase 대시보드에서 직접 배포

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **Edge Functions** 클릭

### 2. 새 Function 생성
1. **Create a new function** 클릭
2. Function 이름: `process-ai-learning`
3. **Create function** 클릭

### 3. 코드 복사 및 붙여넣기
`supabase/functions/process-ai-learning/index.ts` 파일의 내용을 복사하여 대시보드 에디터에 붙여넣기

### 4. 환경 변수 설정
대시보드에서 다음 환경 변수 설정:
- `BATCH_SIZE`: `10` (기본값)

### 5. 배포
**Deploy** 버튼 클릭

---

## 방법 3: Next.js API Route로 대체 (임시)

Edge Function을 배포할 수 없는 경우, Next.js API Route를 사용할 수 있습니다.

이미 `app/api/cron/process-ai-learning/route.ts`가 구현되어 있으므로, 이 엔드포인트를 직접 호출하면 됩니다.

### Vercel Cron Job 설정

`vercel.json`에 이미 설정되어 있습니다:
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

### 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수 설정:
- `CRON_SECRET`: 랜덤 문자열 (보안용)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key

---

## 권장 방법

**Pro 플랜을 최대한 활용하려면 방법 1 (Supabase CLI)을 권장합니다.**

Edge Functions의 장점:
- ✅ 더 빠른 실행 속도
- ✅ Vercel Function Invocations 절감
- ✅ Supabase 네트워크 내에서 실행 (지연 시간 감소)
- ✅ Pro 플랜에서 무제한 사용 가능

---

## 테스트

배포 후 테스트:
```bash
# Edge Function 직접 호출 (테스트용)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/process-ai-learning \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

또는 Vercel Cron Job이 자동으로 실행되는지 확인:
- Vercel 대시보드 > Functions > Cron Jobs에서 실행 로그 확인

