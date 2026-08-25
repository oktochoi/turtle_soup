# Threads + Groq 자동 바다거북스프 생성 — SETUP

이 문서는 **구현 후 사용자가 직접 해야 할 설정**만 정리합니다.

---

## 1. 이미 있는 값 (기존 DB)

프로젝트는 이미 Supabase를 사용합니다. 새 DB를 만들지 마세요.

| 변수 | 출처 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 동일 (anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | 동일 (**service_role**, 서버 전용) |
| `NEXT_PUBLIC_SITE_URL` | `https://turtle-soup-rust.vercel.app` |

### 필수 SQL

Supabase SQL Editor에서 적용:

```text
supabase/migrations/074_threads_automation.sql
```

(아직이면 기존 `072`, `073`도 적용)

---

## 2. Groq에서 가져올 값

1. https://console.groq.com 가입
2. API Keys → Create API Key
3. `.env.local` / Vercel에 설정:

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
GROQ_JUDGE_MODEL=openai/gpt-oss-20b
```

---

## 3. Meta Developers에서 가져올 값

1. https://developers.facebook.com → 기존 Threads 앱
2. App ID / App Secret 복사

```env
THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_REDIRECT_URI=https://turtle-soup-rust.vercel.app/auth/threads/callback
```

### Meta 앱에 등록할 URL

| 용도 | URL |
|------|-----|
| Callback / Redirect | `https://turtle-soup-rust.vercel.app/auth/threads/callback` |
| Deauthorize | `https://turtle-soup-rust.vercel.app/auth/threads/deauthorize` |
| Data deletion | `https://turtle-soup-rust.vercel.app/auth/threads/delete` |

### 권한 (App Review)

- `threads_basic`
- `threads_content_publish`
- `threads_manage_insights`

---

## 4. 내가 직접 랜덤으로 만들 값

```bash
openssl rand -hex 32
```

세 번(또는 네 번) 실행해서 각각 넣:

```env
THREADS_STATE_SECRET=<openssl 결과>
TOKEN_ENCRYPTION_KEY=<openssl 결과>   # 64 hex chars 권장
CRON_SECRET=<openssl 결과>
ADMIN_SECRET=<openssl 결과>
```

`TOKEN_ENCRYPTION_KEY`는 64자리 hex(`openssl rand -hex 32`) 또는 임의 문자열(내부에서 SHA-256) 모두 가능합니다.

---

## 5. OAuth 이후 생기는 값

### 최초 OAuth 방법

1. 위 환경변수를 Vercel + 로컬에 넣고 배포
2. OAuth 시작:

```bash
curl -X POST "https://turtle-soup-rust.vercel.app/api/admin/threads/oauth-start" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

3. 응답의 `url`을 브라우저에서 열어 Threads 계정 승인
4. 콜백이 `threads_tokens` 테이블에 암호화 저장
5. (선택) 장기 토큰을 env에도 복사:

```env
THREADS_ACCESS_TOKEN=<장기 토큰>
THREADS_USER_ID=<숫자 user id>
```

콜백 redirect 쿼리의 `user_id`만 노출되며 **access token은 로그/URL에 찍히지 않습니다.**

---

## 6. 검수 워크플로 (중요)

AI는 문제를 **바로 공개하지 않습니다.** `status=pending`으로만 쌓입니다.

1. **관리 → AI 문제 검수**에서 「한번에 만들기」(5/8/10/12개) 클릭
2. 목록에서 읽고 편집
3. **수락**한 것만 `published` + (선택) Threads 게시
4. **거절**하면 `archived`

### API로도 가능

```bash
curl -X POST "https://turtle-soup-rust.vercel.app/api/admin/run-generation" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"batchSize\":8}"
```

---

## 7. Threads 테스트 게시

어드민 **AI 문제 검수**에서 후보를 고른 뒤 **수락 (사이트+Threads)** 를 누릅니다.

게시 형식:

```text
{제목}

{본문}

왜 그랬을까?
```

사이트만 올리고 싶으면 **수락 (사이트만)** 을 사용합니다.

---

## 8. Insight 수집 테스트

```bash
curl -X POST "https://turtle-soup-rust.vercel.app/api/admin/collect-insights" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

또는 cron:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://turtle-soup-rust.vercel.app/api/cron/collect-insights"
```

1h / 6h / 24h / 72h 윈도우가 지나면 `threads_insights`에 저장됩니다.

---

## 9. Vercel Hobby cron (하루 1개)

Hobby는 **cron 1개 · 하루 1회**만 가능합니다.  
**2~3시간마다 1개 생성은 Hobby에서 불가**합니다 → **어드민 「한번에 만들기」**로 여러 개 만드세요.

`vercel.json`에는 유지보수만 묶은 단일 cron:

| Path | Schedule | 의미 (KST) |
|------|----------|------------|
| `/api/cron/daily` | `0 1 * * *` | 매일 **10:00** — 방 정리 + Threads insight + AI 학습 |

AI 문제 생성은 cron이 아니라 `/ko/admin/ai-puzzles` 버튼 (기본 8개, 최대 15개).

---

## 10. Vercel에 넣을 환경변수 체크리스트

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

GROQ_API_KEY
GROQ_MODEL
GROQ_JUDGE_MODEL

THREADS_APP_ID
THREADS_APP_SECRET
THREADS_REDIRECT_URI
THREADS_ACCESS_TOKEN          # OAuth 후 (또는 DB만 사용)
THREADS_USER_ID
THREADS_STATE_SECRET
TOKEN_ENCRYPTION_KEY

CRON_SECRET
ADMIN_SECRET
GENERATION_BATCH_SIZE=5
```

`NEXT_PUBLIC_`에는 **절대** Groq/Threads/service_role secret을 넣지 마세요.

---

## 11. 재사용한 DB 구조

- **기존** `problems` 테이블에 insert  
  필드: `title`, `content`, `answer`, `explanation`, `difficulty`, `tags`, `lang`, `type='soup'`, `status='published'`, `author`
- **신규(최소)** `074_threads_automation.sql`  
  `threads_posts`, `threads_insights`, `threads_tokens`, `puzzle_generation_logs`

기존 UGC/게임/목록 로직은 그대로입니다.
