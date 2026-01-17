# 코인 경제 시스템 테스트 시나리오

## 1. 지갑 생성 테스트
- **시나리오**: 새 유저 가입 시 자동으로 wallet 생성되는지 확인
- **예상 결과**: `user_wallets` 테이블에 `coins = 0`인 레코드 생성

## 2. Rewarded Ad 클레임 테스트
- **시나리오**: 광고 시청 완료 후 클레임 요청
- **입력**: `claim_key = "test_123"`, `reward_coins = 10`
- **예상 결과**: 
  - `user_wallets.coins` 10 증가
  - `rewarded_claims` 테이블에 레코드 추가
  - `coin_transactions` 테이블에 'earn' 타입 레코드 추가

## 3. 일일 클레임 제한 테스트
- **시나리오**: 같은 유저가 11번째 클레임 시도
- **예상 결과**: 10번째까지 성공, 11번째는 "Daily limit reached" 오류

## 4. 중복 클레임 방지 테스트
- **시나리오**: 동일한 `claim_key`로 두 번 클레임 시도
- **예상 결과**: 첫 번째는 성공, 두 번째는 "Duplicate claim key" 오류

## 5. 아이템 구매 테스트
- **시나리오**: 코인 충분한 상태에서 아이템 구매
- **입력**: `item_id`, `quantity = 1`
- **예상 결과**:
  - `user_wallets.coins` 차감
  - `purchases` 테이블에 레코드 추가
  - `user_inventory` 테이블에 아이템 추가/수량 증가
  - `coin_transactions` 테이블에 'spend' 타입 레코드 추가

## 6. 코인 부족 구매 테스트
- **시나리오**: 코인 부족한 상태에서 아이템 구매 시도
- **예상 결과**: "Insufficient coins" 오류, wallet/inventory 변경 없음

## 7. IAP 코인 지급 테스트
- **시나리오**: 인앱결제 완료 후 서버에 검증 요청
- **입력**: `product_id = "coins_100"`, `purchase_token = "token_123"`, `platform = "android"`
- **예상 결과**:
  - `user_wallets.coins` 100 증가
  - `iap_receipts` 테이블에 레코드 추가
  - `coin_transactions` 테이블에 'iap' 타입 레코드 추가

## 8. 중복 IAP 방지 테스트
- **시나리오**: 동일한 `purchase_token`으로 두 번 지급 요청
- **예상 결과**: 첫 번째는 성공, 두 번째는 "Duplicate purchase token" 오류

## 9. RLS 정책 테스트
- **시나리오**: 다른 유저의 wallet/transactions 조회 시도
- **예상 결과**: 빈 결과 반환 (본인 것만 조회 가능)

## 10. 트랜잭션 원자성 테스트
- **시나리오**: 구매 중 오류 발생 시 롤백 확인
- **예상 결과**: wallet, purchases, inventory 모두 원상복구 (atomic)

