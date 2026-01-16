# 광고 수익 최적화 구현 가이드

## 개요

바다거북스프 플랫폼의 광고 수익 최적화를 위한 구현 가이드입니다. 모바일 UX를 최우선으로 하면서 광고 수익을 극대화하는 구조로 설계되었습니다.

## 핵심 원칙

1. **모바일 UX 최우선**: 광고가 사용자 경험을 해치지 않도록 설계
2. **CLS 방지**: 레이아웃 흔들림 최소화 (광고 영역 높이 예약)
3. **Viewability 최적화**: IntersectionObserver로 뷰포트 진입 시에만 로딩
4. **과포화 방지**: 한 페이지당 기본 광고 1개(최대 2개)
5. **Popunder 모바일 차단**: 모바일에서는 절대 실행되지 않음

## 광고 타입별 가이드

### 1. Banner 300x250

**위치**: 문제 본문 끝 + 댓글 시작 전

**특징**:
- 모바일에서는 최대 1개만 사용
- 데스크톱에서는 추가 배치 가능
- IntersectionObserver로 지연 로딩

**사용 예시**:
```tsx
<AdBanner300x250
  position="problem-after-answer"
  className="w-full"
/>
```

### 2. Native Banner (4:1)

**위치**: 추천 콘텐츠 카드처럼 자연스럽게 배치

**특징**:
- 모바일에서 4:1 비율 강제
- 카드 스타일로 자연스러운 통합
- 추천 문제/콘텐츠처럼 보이도록 스타일링

**사용 예시**:
```tsx
<AdNativeBanner
  position="problem-after-answer"
  className="w-full max-w-md"
  cardStyle={true}
  forceMobileAspectRatio={true}
/>
```

### 3. Social Bar

**위치**: 하단 고정 (모바일 전용)

**특징**:
- 세션당 최대 1회만 표시
- 닫기 버튼 제공
- 게임 플레이 영역을 가리지 않도록 주의

**사용 예시**:
```tsx
<AdSocialBar
  position="global"
  mobileOnly={true}
  showCloseButton={true}
/>
```

### 4. Smartlink Button

**위치**: 선택형 버튼 UI로 제공

**특징**:
- 사용자가 직접 클릭할 때만 열림
- "후원하기" 라벨로 명확히 표시
- 낚시/강제 리디렉션 방지

**사용 예시**:
```tsx
<SmartlinkButton
  label="후원하기"
  variant="outline"
  openInNewTab={true}
/>
```

### 5. Popunder

**위치**: 전역 (데스크톱 전용)

**특징**:
- 모바일에서는 완전 차단
- 사용자 상호작용 후 3초 지연 후 활성화
- feature flag로 ON/OFF 제어 가능

**사용 예시**:
```tsx
<PopunderLoader position="global" />
```

## 페이지별 적용 가이드

### 문제 페이지 (`/problem/[id]`)

**권장 배치**:
1. 정답 확인 후, 댓글 섹션 전: Native Banner (4:1) + Banner 300x250 (데스크톱)

**코드 예시**:
```tsx
{/* 광고: 정답 확인 후 댓글 전 */}
<div className="my-6 sm:my-8">
  <div className="flex flex-col items-center gap-4">
    <AdNativeBanner
      position="problem-after-answer"
      className="w-full max-w-md"
      cardStyle={true}
    />
    <div className="hidden sm:block">
      <AdBanner300x250 position="problem-after-answer" />
    </div>
  </div>
</div>
```

### 방 페이지 (`/room/[code]`)

**권장 배치**:
1. 게임 플레이 영역을 가리지 않는 위치
2. 채팅 영역 하단 또는 사이드바 (데스크톱)

## 환경 변수 설정

`.env.local` 파일에 다음 변수들을 설정하세요:

```env
# 광고 시스템 전체 활성화
NEXT_PUBLIC_ADS_ENABLED=true

# 개별 광고 타입 활성화
NEXT_PUBLIC_POPUNDER_ENABLED=false
NEXT_PUBLIC_SMARTLINK_ENABLED=true
NEXT_PUBLIC_SOCIALBAR_ENABLED=true
NEXT_PUBLIC_NATIVEBANNER_ENABLED=true
NEXT_PUBLIC_BANNER_300X250_ENABLED=true
```

## 트래픽 품질 개선 체크리스트

### UX 개선
- [ ] 랜딩 페이지 첫 화면에 명확한 CTA 1개만 강조
- [ ] 다음 문제 자동 추천 기능
- [ ] 방 만들기/초대 기능 강화
- [ ] 랭킹 참여 유도
- [ ] 로그인 유도 (비로그인 사용자)

### 광고 배치
- [ ] 모바일에서 Popunder 완전 차단 확인
- [ ] 한 페이지당 광고 개수 제한 (최대 2개)
- [ ] CLS 방지 (광고 영역 높이 예약)
- [ ] IntersectionObserver로 지연 로딩 확인

### 분석 및 측정
- [ ] 페이지별 체류시간 측정
- [ ] 이탈률 추적
- [ ] 광고 클릭률 (CTR) 측정
- [ ] CPM 모니터링

## A/B 테스트 설계

광고 위치/개수/형태에 대해 A/B 테스트를 진행할 수 있습니다:

```tsx
// 예시: 광고 변형 테스트
const adVariant = searchParams.get('adVariant') || 'A';

{adVariant === 'A' ? (
  <AdNativeBanner position="top" />
) : (
  <AdBanner300x250 position="top" />
)}
```

## 운영 추천 조합

### 모바일
- Native Banner 4:1: 1회 (정답 확인 후)
- Banner 300x250: 0~1회 (선택적)
- Social Bar: 세션당 1회 (최소화)
- Smartlink: 버튼형 CTA로만

### 데스크톱
- Native Banner: 1~2회
- Banner 300x250: 1~2회
- Popunder: 선택적 (기본 OFF 권장)
- Smartlink: 버튼형 CTA

## 문제 해결

### 광고가 로드되지 않는 경우
1. 환경 변수 확인 (`NEXT_PUBLIC_ADS_ENABLED=true`)
2. 브라우저 콘솔에서 에러 확인
3. 광고 차단기 확인 (fallback UI 표시)

### CLS (레이아웃 흔들림) 발생
1. 광고 컨테이너에 `minHeight` 설정 확인
2. IntersectionObserver 지연 시간 조정
3. 광고 로딩 전 placeholder 표시

### 모바일에서 Popunder 실행되는 경우
1. `canShowPopunder()` 함수 확인
2. `isMobile()` 함수 동작 확인
3. 환경 변수 `NEXT_PUBLIC_POPUNDER_ENABLED` 확인

## 성능 최적화

1. **지연 로딩**: IntersectionObserver로 뷰포트 진입 시에만 로딩
2. **스크립트 최적화**: async 속성 사용, 중복 로딩 방지
3. **Fallback 처리**: 광고 로딩 실패 시 레이아웃 유지

## 보안 고려사항

1. **XSS 방지**: 광고 스크립트는 신뢰할 수 있는 소스에서만 로드
2. **CSP 정책**: Content Security Policy 설정 고려
3. **사용자 프라이버시**: 광고 추적 관련 쿠키/로컬 스토리지 관리

## 모니터링

광고 성능을 모니터링하기 위해 다음 지표를 추적하세요:

- **CTR (Click-Through Rate)**: 광고 클릭률
- **CPM (Cost Per Mille)**: 천 노출당 비용
- **Viewability**: 광고가 실제로 보이는 비율
- **페이지 체류시간**: 사용자 참여도
- **Bounce Rate**: 이탈률

## 추가 개선 사항

1. **Top GEO 유입 확대**: 미국/영국/독일/호주/캐나다 등 고CPM 지역 타겟팅
2. **콘텐츠 품질 향상**: 체류시간 증가를 위한 콘텐츠 개선
3. **SEO 최적화**: 검색 엔진 최적화로 유기적 트래픽 증가
4. **소셜 공유 강화**: 바이럴 확산을 위한 공유 기능 개선

