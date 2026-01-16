# 광고 시스템 빠른 시작 가이드

## 설치 및 설정

### 1. 환경 변수 설정

`.env.local` 파일에 다음을 추가:

```env
NEXT_PUBLIC_ADS_ENABLED=true
NEXT_PUBLIC_POPUNDER_ENABLED=false
NEXT_PUBLIC_SMARTLINK_ENABLED=true
NEXT_PUBLIC_SOCIALBAR_ENABLED=true
NEXT_PUBLIC_NATIVEBANNER_ENABLED=true
NEXT_PUBLIC_BANNER_300X250_ENABLED=true
```

### 2. 컴포넌트 사용

#### 문제 페이지에 광고 추가

```tsx
import AdBanner300x250 from '@/components/ads/AdBanner300x250';
import AdNativeBanner from '@/components/ads/AdNativeBanner';

// 정답 확인 후, 댓글 전
<AdNativeBanner
  position="problem-after-answer"
  className="w-full max-w-md"
  cardStyle={true}
/>
```

#### Smartlink 버튼 추가

```tsx
import SmartlinkButton from '@/components/ads/SmartlinkButton';

<SmartlinkButton
  label="후원하기"
  variant="outline"
/>
```

## 운영 추천 설정

### 모바일 (한국 트래픽)
- ✅ Native Banner 4:1: 1회
- ✅ Banner 300x250: 0~1회 (선택)
- ✅ Social Bar: 세션당 1회
- ❌ Popunder: 완전 차단

### 데스크톱
- ✅ Native Banner: 1~2회
- ✅ Banner 300x250: 1~2회
- ⚠️ Popunder: 선택적 (기본 OFF)

## 주요 기능

1. **IntersectionObserver**: 뷰포트 진입 시에만 로딩
2. **CLS 방지**: 광고 영역 높이 예약
3. **모바일 Popunder 차단**: 완전 차단
4. **세션 제한**: Social Bar는 세션당 1회
5. **Fallback UI**: 광고 로딩 실패 시 레이아웃 유지

## 문제 해결

### 광고가 안 보여요
- 환경 변수 `NEXT_PUBLIC_ADS_ENABLED=true` 확인
- 브라우저 콘솔 에러 확인
- 광고 차단기 비활성화

### 모바일에서 Popunder가 실행돼요
- `canShowPopunder()` 함수 확인
- 환경 변수 `NEXT_PUBLIC_POPUNDER_ENABLED=false` 확인

## 상세 문서

더 자세한 내용은 `docs/ADS_IMPLEMENTATION.md`를 참고하세요.

