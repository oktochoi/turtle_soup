# 광고 배포 가이드

## 문제: 로컬에서는 광고가 보이는데 배포 후에는 안 보임

### 원인

1. **환경 변수 미설정**: Vercel에 `NEXT_PUBLIC_ADS_ENABLED` 등이 설정되지 않음
2. **기본값 문제**: 프로덕션에서 환경 변수가 없으면 비활성화됨
3. **IntersectionObserver**: 프로덕션에서 뷰포트 진입 시에만 로딩되어 스크롤하지 않으면 안 보임

### 해결 방법

#### 1. Vercel 환경 변수 설정

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 다음을 설정:

```
NEXT_PUBLIC_ADS_ENABLED=true
NEXT_PUBLIC_NATIVEBANNER_ENABLED=true
NEXT_PUBLIC_BANNER_300X250_ENABLED=true
NEXT_PUBLIC_SOCIALBAR_ENABLED=true
NEXT_PUBLIC_POPUNDER_ENABLED=true (선택사항, 데스크톱만)
NEXT_PUBLIC_SMARTLINK_ENABLED=true (선택사항)
```

**중요**: 
- Production, Preview, Development 모두에 설정
- 설정 후 재배포 필요

#### 2. 코드 수정 사항 (이미 적용됨)

- `adConfig.enabled`: 기본적으로 활성화 (환경 변수가 'false'가 아니면 활성화)
- `nativeBanner.enabled`: 기본적으로 활성화
- IntersectionObserver fallback: 지원되지 않으면 즉시 로딩
- 프로덕션에서도 디버깅 로그 출력

#### 3. 확인 방법

배포 후 브라우저 콘솔에서 다음 로그 확인:

```
[AdBanner300x250] 광고 상태: { isAdsEnabled: true, bannerEnabled: true, ... }
[AdNativeBanner] 광고 상태: { isAdsEnabled: true, nativeBannerEnabled: true, ... }
```

만약 `isAdsEnabled: false` 또는 `bannerEnabled: false`가 보이면:
- 환경 변수가 설정되지 않았거나
- `NEXT_PUBLIC_ADS_ENABLED=false`로 설정되어 있음

#### 4. 디버깅 체크리스트

1. ✅ Vercel 환경 변수 확인
2. ✅ 재배포 완료
3. ✅ 브라우저 콘솔 로그 확인
4. ✅ 네트워크 탭에서 광고 스크립트 로딩 확인
5. ✅ 광고 차단기 비활성화 확인
6. ✅ 페이지 스크롤하여 뷰포트 진입 확인

#### 5. 환경 변수 없이도 작동하도록 수정됨

현재 코드는 환경 변수가 없어도 기본적으로 활성화됩니다:
- `enabled: process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false'`
- `nativeBanner.enabled: process.env.NEXT_PUBLIC_NATIVEBANNER_ENABLED !== 'false'`
- `banner300x250.enabled: process.env.NEXT_PUBLIC_BANNER_300X250_ENABLED !== 'false'`

따라서 환경 변수를 설정하지 않아도 광고가 표시됩니다.

#### 6. 광고를 비활성화하려면

Vercel 환경 변수에 다음을 설정:
```
NEXT_PUBLIC_ADS_ENABLED=false
```

또는 개별 광고 타입만 비활성화:
```
NEXT_PUBLIC_NATIVEBANNER_ENABLED=false
NEXT_PUBLIC_BANNER_300X250_ENABLED=false
```

