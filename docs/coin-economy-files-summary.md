# 코인 경제 시스템 생성 파일 정리

## 📁 생성된 파일 목록

### 1. Next.js API Routes (서버 사이드)
- `app/api/coins/claim-rewarded/route.ts` - Rewarded 광고 클레임 API
- `app/api/coins/buy-item/route.ts` - 아이템 구매 API
- `app/api/coins/grant-iap/route.ts` - 인앱결제 코인 지급 API

### 2. Next.js UI 페이지
- `app/[lang]/wallet/page.tsx` - 코인 지갑 및 거래 내역 페이지
- `app/[lang]/shop/page.tsx` - 상점 페이지 (아이템 구매)
- `app/[lang]/earn/page.tsx` - 코인 획득 페이지 (광고 시청)

### 3. Flutter 코드
- `lib/flutter/coin_economy.dart` - Flutter 앱용 전체 구현 코드
  - 모델 (Wallet, Transaction, ShopItem)
  - API 서비스 (CoinEconomyService)
  - Rewarded Ad 관리 (RewardedAdManager)
  - IAP 관리 (IAPManager)
  - UI 위젯 (WalletPage, EarnPage, ShopPage, BuyCoinsPage)

### 4. 문서
- `docs/coin-economy-test-scenarios.md` - 테스트 시나리오 10개
- `docs/coin-economy-setup.md` - 설정 가이드
- `docs/coin-economy-files-summary.md` - 이 파일 (파일 정리)

### 5. 헤더 수정
- `app/components/Header.tsx` - Shop 링크 추가됨

## 🗄️ 데이터베이스 테이블

다음 테이블들이 생성되어야 함:
1. `user_wallets` - 사용자 코인 지갑
2. `coin_transactions` - 코인 거래 내역
3. `shop_items` - 상점 아이템
4. `user_inventory` - 사용자 인벤토리
5. `purchases` - 구매 기록
6. `rewarded_claims` - 광고 보상 클레임
7. `iap_receipts` - 인앱결제 영수증

## 🔧 RPC 함수

다음 RPC 함수들이 생성되어야 함:
1. `rpc_buy_item` - 아이템 구매
2. `rpc_claim_rewarded` - 광고 보상 클레임
3. `rpc_grant_iap` - IAP 코인 지급
4. `rpc_get_daily_claims_remaining` - 일일 클레임 남은 횟수

## 📝 사용 방법

### Next.js에서
- `/wallet` - 지갑 페이지 접근
- `/shop` - 상점 페이지 접근
- `/earn` - 코인 획득 페이지 접근

### Flutter에서
```dart
import 'package:your_app/lib/flutter/coin_economy.dart';

// 서비스 초기화
final service = CoinEconomyService(
  baseUrl: 'your_supabase_url',
  accessToken: userAccessToken,
);

// 페이지 사용
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => WalletPage(service: service),
  ),
);
```

## ⚠️ 주의사항

- 테이블이 생성되지 않으면 404 오류 발생
- 마이그레이션을 순서대로 실행해야 함
- RPC 함수도 함께 생성되어야 함

