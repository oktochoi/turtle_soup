# SEO 전체 분석 리포트

> 분석일: 2026-08-11
> 대상: https://turtle-soup-rust.vercel.app (Next.js 15, ko/en 다국어)

---

## 심각도별 요약

### 치명적 (즉시 수정 필요)

1. **5개 주요 페이지의 메타데이터 미적용**
   - `problems`, `rooms`, `ranking`, `play` 페이지가 `'use client'`로 선언되어 있어 별도 `metadata.ts` 파일이 **완전히 무시**됨
   - 이 페이지들은 layout.tsx의 전역 메타데이터만 적용
   - **해결**: 서버 컴포넌트 래퍼(별도 layout.tsx)를 만들어 metadata를 export하고, 현재 클라이언트 컴포넌트를 child로 렌더링

2. **sitemap에 동적 문제 URL 미포함**
   - `app/sitemap.ts`에 정적 라우트 8개만 ko/en로 생성
   - `/ko/problem/[id]` 같은 동적 URL이 누락
   - **해결**: `app/sitemap.ts`에서 DB 조회하여 문제 URL 추가

3. **sitemap/robots 이중 시스템 충돌**
   - Next.js 내장 `app/sitemap.ts`와 `next-sitemap` 패키지가 동시에 설정
   - `app/robots.ts`와 `next-sitemap.config.js`의 `generateRobotsTxt: true`도 충돌 가능
   - **해결**: 하나로 통일 (Next.js 내장 권장)

### 높음

4. **hreflang 중복 출력**
   - `layout.tsx`에서 Next.js `alternates.languages` API가 자동 생성하는 hreflang + JSX `<link>` 태그로 수동 추가 → 이중 출력
   - **해결**: 수동 `<link>` 태그 제거

5. **guide/faq 영문 description에 "Pelican Soup" 오역**
   - 다른 파일에서는 "Turtle Soup"인데 이 페이지만 "Pelican Soup"
   - **해결**: "Turtle Soup"으로 통일

6. **opengraph-image.tsx의 alt/텍스트가 한국어 고정**
   - 영어 문제에서도 한국어 alt 출력
   - `params`에 `lang`이 없어 다국어 대응 불가
   - **해결**: `params`에 `lang` 추가, 분기 처리

### 보통

7. **guide/faq 페이지에 Twitter 메타데이터 및 OG 이미지 누락**
   - `twitter` 객체와 `openGraph.images` 미설정

8. **hreflang이 존재하지 않는 언어 버전 URL을 가리킬 가능성**
   - 동적 문제 페이지에서 DB에 해당 언어의 문제가 없어도 hreflang 생성

9. **robots.txt의 불필요한 allow 나열**
   - `allow: ['/']`만으로 충분한데 개별 경로를 모두 나열

10. **데드코드 metadata.ts 파일 7개**
    - `problems/metadata.ts`, `rooms/metadata.ts`, `ranking/metadata.ts`, `play/metadata.ts`, `guide/metadata.ts`, `faq/metadata.ts` 등 미사용

### 낮음

11. **JSON-LD가 layout에만 존재** - 개별 문제 페이지에 Article/Quiz 추가 권장
12. **twitterHandle 하드코딩** (`@turtlesoup`) - 실제 계정 아니면 제거
13. **JSON-LD의 비표준 `game` 속성** - `WebApplication`에서 분리 또는 제거

---

## 파일별 상세 분석

### 1. `app/[lang]/layout.tsx` — 전역 메타데이터

**잘 된 점:**
- title/description이 ko/en 분리, 길이 제한(60자/155자) 적용
- `metadataBase` 설정 완료
- `alternates.languages`에 ko, en, x-default 모두 포함
- OG/Twitter 메타데이터 완비
- JSON-LD 구조화 데이터 (WebApplication) 포함

**문제점:**
- hreflang 중복 (API + 수동 `<link>` 태그)
- 수동 hreflang이 전역 고정 (`/ko`, `/en`만 가리킴)
- JSON-LD의 `game` 속성은 표준 아님

### 2. `app/[lang]/page.tsx` — 홈 메타데이터

- `lib/seo.ts`의 `generateMetadata` 헬퍼 사용으로 일관된 구조
- keywords, canonical, hreflang, OG/Twitter 모두 자동 생성
- **문제 없음**

### 3. `app/[lang]/problems/page.tsx` — 문제 목록 [심각]

- `'use client'` 선언으로 `generateMetadata` export 불가
- `problems/metadata.ts`가 존재하지만 import되지 않아 무시됨
- 전역 메타데이터만 적용

### 4. `app/[lang]/problem/[id]/page.tsx` — 개별 문제 (동적)

**잘 된 점:**
- `metadata.ts`를 정상 import하여 `generateMetadata` export
- DB에서 동적 title/description 생성
- 언어 불일치 시 noindex 처리
- keywords, publishedTime, modifiedTime 포함

**문제점:**
- hreflang이 존재하지 않는 언어 버전 URL을 가리킬 수 있음

### 5. `app/[lang]/problem/[id]/opengraph-image.tsx`

- Edge Runtime, 1200x630 표준 크기
- **alt가 `'바다거북스프 문제'`로 한국어 고정**
- **"문제 풀기 →" 텍스트도 한국어 고정**

### 6. `app/sitemap.ts`

- 정적 라우트만 생성, **동적 문제 URL 미포함**
- `next-sitemap.config.js`와 이중 시스템

### 7. `app/robots.ts`

- 비공개 경로 차단 잘 되어 있음
- allow 목록이 불필요하게 장황함

### 8. `middleware.ts`

- Accept-Language 기반 locale redirect
- SEO 정적 파일 스킵 처리
- **문제 없음**

### 9. `lib/seo.ts` — SEO 헬퍼

- 일관된 메타데이터 생성 패턴
- `twitterHandle`이 `'@turtlesoup'`으로 하드코딩
- locale prefix 교체 로직에 edge case 존재

---

## 권장 수정 우선순위

| 순위 | 작업 | 영향도 |
|------|------|--------|
| 1 | 5개 페이지에 서버 컴포넌트 래퍼 추가하여 metadata 적용 | 치명적 |
| 2 | sitemap에 동적 문제 URL 추가 | 치명적 |
| 3 | sitemap/robots 이중 시스템 통일 | 치명적 |
| 4 | layout.tsx 수동 hreflang `<link>` 제거 | 높음 |
| 5 | "Pelican Soup" → "Turtle Soup" 오역 수정 | 높음 |
| 6 | opengraph-image.tsx 다국어 대응 | 높음 |
| 7 | guide/faq에 Twitter/OG 이미지 추가 | 보통 |
| 8 | 데드코드 metadata.ts 정리 | 보통 |
| 9 | 개별 문제 페이지에 JSON-LD 추가 | 낮음 |
