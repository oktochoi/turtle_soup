# SEO 리팩토링 가이드: CSR → SSR/SSG 전환

Next.js App Router + Vercel + Supabase 환경에서 Google 크롤러가 HTML에서 실제 콘텐츠를 읽을 수 있도록, AdSense Thin content 이슈를 해결하기 위한 가이드입니다.

---

## 1. 현재 상태 분석

| 페이지 | 현재 방식 | SEO 상태 |
|--------|-----------|----------|
| `/[lang]/problem/[id]` | CSR (`'use client'`, useEffect + Supabase) | ❌ 크롤러가 콘텐츠 읽지 못함. `metadata.ts` 존재하나 Client Component라 `generateMetadata` 미사용 |
| `/[lang]/community/[id]` | CSR | ❌ 동일 |
| `/[lang]/about` | SSR (Server Component) | ✅ 양호 |
| `/[lang]/guide` | SSR | ✅ 양호 |
| `/[lang]/faq` | SSR | ✅ 양호 |
| `/[lang]/tutorial` | CSR | ⚠️ 개선 필요 |

**핵심 원칙:** 핵심 콘텐츠(문제 제목/본문/정답/해설, 게시글 본문)는 **서버에서 HTML에 렌더링**되어야 합니다. 질문하기, 댓글, 좋아요 등 인터랙티브 기능은 CSR로 유지 가능합니다.

---

## 2. 아키텍처 패턴: 하이브리드 SSR + CSR

```
┌─────────────────────────────────────────────────────────┐
│  Server Component (page.tsx)                             │
│  - generateMetadata() → SEO 메타데이터                   │
│  - Supabase fetch (createClient from server.ts)         │
│  - 핵심 콘텐츠를 HTML로 렌더링                            │
│  - <ProblemClient problem={problem} /> 로 데이터 전달     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Client Component (ProblemClient.tsx)                    │
│  - 'use client'                                          │
│  - props로 받은 problem을 초기 상태로 사용                │
│  - 질문하기, 댓글, 좋아요 등 인터랙티브 기능               │
│  - 실시간 업데이트는 useEffect로 처리                     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 문제 페이지 (`/[lang]/problem/[id]`) 리팩토링

### 3.1 디렉터리 구조

```
app/[lang]/problem/[id]/
├── page.tsx          ← Server Component (새로 작성)
├── ProblemClient.tsx  ← Client Component (기존 page.tsx 로직 이동)
├── metadata.ts       ← 기존 유지 (generateMetadataForProblem)
└── components/       ← 기존 유지
```

### 3.2 Server Component (page.tsx)

```tsx
// app/[lang]/problem/[id]/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateMetadataForProblem } from './metadata';
import ProblemClient from './ProblemClient';
import type { Problem } from '@/lib/types';

type Props = { params: Promise<{ lang: string; id: string }> };

// SEO: 메타데이터는 서버에서 생성
export async function generateMetadata({ params }: Props) {
  const { lang, id } = await params;
  const metadata = await generateMetadataForProblem(id);
  // lang에 맞는 canonical/hreflang은 lib/seo에서 처리
  return metadata;
}

// 동적 라우트: ISR 또는 on-demand
export const dynamic = 'force-dynamic'; // 또는 revalidate: 60
// export const revalidate = 60; // ISR: 60초마다 재검증

// 서버에서 문제 데이터 fetch
async function getProblem(problemId: string, lang: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', problemId)
    .single();

  if (error || !data) return null;

  // 언어 필터 (선택)
  const problemLang = data.lang || data.language || 'ko';
  if (problemLang !== lang) return null;

  return data as Problem;
}

// quiz_contents (퀴즈 타입인 경우)
async function getQuizContent(problemId: string, quizType: string) {
  if (quizType === 'soup') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('quiz_contents')
    .select('content')
    .eq('quiz_id', problemId)
    .maybeSingle();
  return data?.content ?? null;
}

export default async function ProblemPage({ params }: Props) {
  const { lang, id } = await params;
  const problem = await getProblem(id, lang);

  if (!problem) notFound();

  const quizContent = await getQuizContent(id, (problem as any).type || 'soup');

  return (
    <ProblemClient
      initialProblem={problem}
      initialQuizContent={quizContent}
      lang={lang}
      problemId={id}
    />
  );
}
```

### 3.3 Client Component (ProblemClient.tsx)

기존 `page.tsx`의 로직을 `ProblemClient.tsx`로 이동하고, **초기 데이터를 props로 받아** 사용합니다.

```tsx
// app/[lang]/problem/[id]/ProblemClient.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Problem } from '@/lib/types';

type Props = {
  initialProblem: Problem;
  initialQuizContent: any;
  lang: string;
  problemId: string;
};

export default function ProblemClient({
  initialProblem,
  initialQuizContent,
  lang,
  problemId,
}: Props) {
  // 서버에서 받은 데이터를 초기 상태로 사용 → HTML에 이미 포함됨
  const [problem, setProblem] = useState<Problem | null>(initialProblem);
  const [quizContent, setQuizContent] = useState(initialQuizContent);
  const [isLoading, setIsLoading] = useState(false);
  // ... 나머지 state

  // 실시간 업데이트(좋아요, 댓글 수 등)만 useEffect로 갱신
  useEffect(() => {
    // 조회수 증가, 좋아요 상태 확인 등
  }, [problemId]);

  // 핵심 콘텐츠(제목, 본문, 정답, 해설)는 problem에 이미 있음
  // → 첫 렌더 시 HTML에 포함되어 크롤러가 읽을 수 있음
  return (
    <main>
      <ProblemHeader problem={problem} />
      <ProblemContent problem={problem} quizContent={quizContent} />
      <QuestionInputSection ... />
      <CommentsSection ... />
    </main>
  );
}
```

### 3.4 핵심: details/summary로 해설·정답 포함

크롤러가 접힌 콘텐츠도 읽을 수 있도록 `details`/`summary`를 사용합니다. (이미 적용된 경우 유지)

```tsx
<details>
  <summary>해설 보기</summary>
  <div>{problem.explanation}</div>
</details>
```

---

## 4. 커뮤니티 게시글 (`/[lang]/community/[id]`) 리팩토링

블로그를 공지사항(커뮤니티)으로 통합했으므로, 게시글 상세 페이지를 SSR로 전환합니다.

### 4.1 Server Component

```tsx
// app/[lang]/community/[id]/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PostClient from './PostClient';

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, content')
    .eq('id', id)
    .single();

  if (!post) return { title: '게시글을 찾을 수 없습니다' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  return {
    title: post.title,
    description: post.content?.slice(0, 155) + '...',
    alternates: {
      canonical: `${siteUrl}/ko/community/${id}`,
      languages: { ko: `${siteUrl}/ko/community/${id}`, en: `${siteUrl}/en/community/${id}` },
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !post) notFound();

  return <PostClient initialPost={post} lang={lang} postId={id} />;
}
```

---

## 5. generateStaticParams vs dynamic

| 전략 | 사용 시점 | 설정 |
|------|-----------|------|
| **SSG** | 문제/게시글 수가 제한적일 때 | `generateStaticParams` + `dynamicParams = true` |
| **ISR** | 주기적 갱신 필요 | `revalidate = 60` |
| **SSR** | 항상 최신 데이터 | `dynamic = 'force-dynamic'` |

### SSG 예시 (문제 목록이 고정된 경우)

```tsx
// app/[lang]/problem/[id]/page.tsx
export async function generateStaticParams() {
  const supabase = await createClient();
  const { data: problems } = await supabase
    .from('problems')
    .select('id')
    .eq('status', 'published')
    .limit(100); // 상위 100개만 미리 빌드

  return (problems || []).map((p) => ({ id: p.id }));
}

export const dynamicParams = true; // 미리 빌드 안 된 ID는 요청 시 생성
export const revalidate = 3600; // 1시간마다 재검증
```

### Vercel 권장

- **콘텐츠 페이지**: `revalidate = 60` ~ `3600` (ISR)
- **실시간성 중요**: `dynamic = 'force-dynamic'`

---

## 6. Canonical / hreflang 설정

`lib/seo.ts`의 `generateMetadata`를 활용합니다. 이미 `alternates.languages`를 지원합니다.

```ts
// lib/seo.ts (기존)
alternates: {
  canonical: canonicalUrl,
  languages: {
    'ko': `${baseUrl}/ko${path}`,
    'en': `${baseUrl}/en${path}`,
    'x-default': `${baseUrl}/ko${path}`,
  },
},
```

**path 형식:** `/[lang]/problem/[id]` 형태로 전달하면 됩니다.

```ts
// metadata.ts - generateMetadataForProblem(problemId, lang) 시그니처 확장
return generateMetadata({
  title,
  description,
  path: `/${lang}/problem/${problemId}`,
  locale: lang as Locale,
});
```

**참고:** 현재 `metadata.ts`의 `generateMetadataForProblem`은 `lang`을 받지 않아 path가 `/problem/[id]`로만 설정됩니다. SSR 전환 시 `lang` 파라미터를 추가해 `/${lang}/problem/${id}` 형태로 canonical/hreflang을 설정하세요.

---

## 7. noindex 적용 (크롤러 제외)

auth, dashboard, profile 등은 `robots: { index: false }`로 설정합니다.

### 7.1 layout.tsx에서 경로별 메타데이터

```tsx
// app/[lang]/layout.tsx 또는 각 페이지
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
```

### 7.2 noindex가 필요한 경로

| 경로 | noindex |
|------|---------|
| `/auth/*` | ✅ |
| `/admin/*` | ✅ |
| `/profile/*` | ✅ (선택: 공개 프로필은 index 가능) |
| `/create-*`, `/edit/*` | ✅ |
| `/room/*`, `/turtle_room/*` | ✅ |
| `/wallet`, `/shop`, `/earn` | ✅ |

### 7.3 robots.txt (이미 설정된 경우)

```
Disallow: /api/
Disallow: /admin/
Disallow: /auth/
Disallow: /play/
Disallow: /profile/
Disallow: /create-
Disallow: /edit/
Disallow: /room/
Disallow: /wallet/
Disallow: /shop/
Disallow: /earn/
```

---

## 8. Supabase 서버 사이드 fetch

```ts
// lib/supabase/server.ts (기존)
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data } = await supabase.from('problems').select('*').eq('id', id).single();
```

- **캐싱:** Next.js `fetch`는 기본 캐시되지만, Supabase 클라이언트는 캐시하지 않습니다.
- **캐시 적용:** `unstable_cache` 또는 Route Handler + `fetch` 조합 사용 가능.

```ts
import { unstable_cache } from 'next/cache';

const getCachedProblem = unstable_cache(
  async (id: string) => {
    const supabase = await createClient();
    const { data } = await supabase.from('problems').select('*').eq('id', id).single();
    return data;
  },
  ['problem'],
  { revalidate: 60 }
);
```

---

## 9. 체크리스트

- [x] `/[lang]/problem/[id]`: Server Component로 초기 데이터 fetch, ProblemClient에 props 전달 ✅
- [x] `/[lang]/community/[id]`: 동일 패턴 적용 (PostClient) ✅
- [ ] `/[lang]/tutorial`: CSR 유지 (useTranslations 사용으로 전환 복잡)
- [x] `generateMetadata`에서 canonical, hreflang 설정 ✅
- [x] auth, admin, profile, create-*, wallet, shop, earn에 `robots: { index: false }` 적용 ✅
- [x] `details`/`summary`로 해설·정답이 HTML에 포함 (기존 적용됨)
- [ ] Vercel 배포 후 Google Search Console에서 "URL 검사"로 HTML 확인

---

## 10. 검증 방법

1. **curl로 HTML 확인**
   ```bash
   curl -A "Googlebot" https://turtle-soup-rust.vercel.app/ko/problem/[id]
   ```
   → `<main>` 안에 문제 제목, 본문, 해설 텍스트가 보여야 합니다.

2. **Google Search Console**
   - URL 검사 → "테스트된 URL" → "크롤링" → "페이지를 가져옴"에서 HTML 확인

3. **View Page Source**
   - 브라우저에서 "페이지 소스 보기" → JavaScript 없이도 텍스트가 보여야 합니다.

---

## 참고

- [Next.js: Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Next.js: Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Supabase: Server-side](https://supabase.com/docs/guides/auth/server-side/nextjs)
