# Vercel Analytics 조건부 트래킹 구현 가이드

## 개요

Vercel Web Analytics의 이벤트 수를 줄이기 위해, 동적 세그먼트가 포함된 상세 페이지만 추적하도록 구현했습니다.

## 추적 대상 경로

다음 패턴의 경로만 이벤트를 기록합니다:

- ✅ `/ko/problem/[id]` - 문제 상세 페이지
- ✅ `/ko/room/[code]` - 방 상세 페이지  
- ✅ `/ko/community/[id]` - 커뮤니티 게시글 상세 페이지
- ✅ `/problem/[id]` (언어 코드 없이)
- ✅ `/room/[code]` (언어 코드 없이)
- ✅ `/community/[id]` (언어 코드 없이)

## 추적하지 않는 경로

다음 정적 경로는 이벤트를 기록하지 않습니다:

- ❌ `/ko` - 홈
- ❌ `/ko/problems` - 문제 목록
- ❌ `/ko/rooms` - 방 목록
- ❌ `/ko/community` - 커뮤니티 목록
- ❌ `/ko/auth/login` - 로그인
- ❌ `/ko/auth/signup` - 회원가입
- ❌ `/ko/ranking` - 랭킹
- ❌ `/ko/tutorial` - 튜토리얼
- ❌ 기타 정적 경로

## 구현 파일

### 1. `lib/analytics.ts`
- 경로 패턴 매칭 로직
- `shouldTrackPath()`: 경로가 추적 대상인지 확인
- `getPathType()`: 경로 타입 추출 (problem/room/community)
- `trackPageView()`: 조건부 페이지뷰 이벤트 기록
- `trackEvent()`: 커스텀 이벤트 기록 (추적 대상 경로에서만)

### 2. `components/AnalyticsGate.tsx`
- `usePathname()` 훅을 사용하여 경로 변경 감지
- 경로가 변경될 때마다 `trackPageView()` 자동 호출
- 조건부로 이벤트 기록

### 3. `app/[lang]/layout.tsx`
- 기존 `<Analytics />` 컴포넌트 제거
- `<AnalyticsGate />` 컴포넌트로 교체

## 이벤트 이름 규칙

- `page_view_problem_detail` - 문제 상세 페이지
- `page_view_room` - 방 상세 페이지
- `page_view_community_post` - 커뮤니티 게시글 상세 페이지

## 사용 예시

### 자동 페이지뷰 추적
`AnalyticsGate` 컴포넌트가 자동으로 처리하므로 별도 코드 불필요.

### 커스텀 이벤트 기록
```typescript
import { trackEvent } from '@/lib/analytics';
import { usePathname } from 'next/navigation';

const pathname = usePathname();

// 추적 대상 경로에서만 이벤트 기록
trackEvent('custom_action', { 
  action: 'button_click',
  value: 'example'
}, pathname);
```

## 이벤트 절감 효과

### 변경 전
- 모든 페이지뷰가 이벤트로 기록됨
- 홈, 목록, 로그인 등 모든 페이지 포함
- 예상 이벤트 수: ~1000/일 (사용자당 평균 10페이지 방문 × 100명)

### 변경 후
- 동적 세그먼트가 포함된 상세 페이지만 기록
- 예상 이벤트 수: ~300/일 (사용자당 평균 3개 상세 페이지 × 100명)
- **약 70% 이벤트 절감**

## 테스트 방법

1. 개발자 도구 콘솔에서 확인:
   ```javascript
   // Vercel Analytics 이벤트 확인
   window.__VERCEL_ANALYTICS__?.track('page_view_problem_detail', { path: '/ko/problem/123' });
   ```

2. Vercel 대시보드에서 확인:
   - Analytics → Events 섹션에서 이벤트 확인
   - 상세 페이지만 기록되는지 확인

## 주의사항

- 쿼리스트링은 무시하고 pathname만 사용합니다
- UUID/코드 검증은 엄격하지 않으며, 최소한 1개 이상의 세그먼트가 존재하면 추적합니다
- 정적 경로(`/ko/problems`)는 추적하지 않지만, 동적 경로(`/ko/problem/[id]`)는 추적합니다

