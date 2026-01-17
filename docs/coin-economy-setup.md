# 코인 경제 시스템 설정 가이드

## 1. Supabase 마이그레이션 실행

위에서 생성한 마이그레이션을 순서대로 실행:
1. `create_coin_economy_tables_fixed` - 테이블 생성
2. `create_coin_economy_rpc_functions` - RPC 함수 생성
3. `create_wallet_trigger` - 트리거 생성

## 2. 샘플 데이터 삽입

```sql
-- 샘플 상점 아이템
INSERT INTO shop_items (name, description, category, price_coins, is_active) VALUES
('힌트 1개', '문제 해결을 위한 힌트', 'hint', 50, true),
('힌트 3개', '문제 해결을 위한 힌트 3개 세트', 'hint', 120, true),
('스킨 변경권', '프로필 스킨 변경', 'skin', 200, true),
('프리미엄 배지', '특별한 배지 획득', 'badge', 500, true);
```

## 3. Flutter 설정

### pubspec.yaml
```yaml
dependencies:
  flutter:
    sdk: flutter
  google_mobile_ads: ^5.0.0
  in_app_purchase: ^3.2.0
  http: ^1.1.0
  uuid: ^4.0.0
  shared_preferences: ^2.2.0
```

### Android 설정 (android/app/src/main/AndroidManifest.xml)
```xml
<manifest>
  <application>
    <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
  </application>
</manifest>
```

### iOS 설정 (ios/Runner/Info.plist)
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
```

## 4. 환경 변수 설정

### Next.js (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Flutter (lib/config.dart)
```dart
class Config {
  static const String supabaseUrl = 'your_supabase_url';
  static const String supabaseAnonKey = 'your_anon_key';
  static const String rewardedAdUnitId = 'ca-app-pub-3940256099942544/5224354917'; // 테스트 ID
}
```

## 5. 사용 방법

### Next.js 페이지
- `/wallet` - 코인 지갑 및 거래 내역
- `/shop` - 상점 (아이템 구매)
- `/earn` - 코인 획득 (광고 시청)

### Flutter 앱
```dart
// 서비스 초기화
final service = CoinEconomyService(
  baseUrl: Config.supabaseUrl,
  accessToken: userAccessToken,
);

// 광고 매니저 초기화
final adManager = RewardedAdManager();
adManager.loadAd(Config.rewardedAdUnitId);

// IAP 매니저 초기화
final iapManager = IAPManager(
  service: service,
  platform: Platform.isAndroid ? 'android' : 'ios',
);

// 페이지 사용
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => WalletPage(service: service),
  ),
);
```

## 6. 테스트

위의 `coin-economy-test-scenarios.md` 파일의 시나리오를 순서대로 테스트하세요.

