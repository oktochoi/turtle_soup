-- 기존 사용자들에게 추천인 코드 생성

-- referral_code가 NULL인 모든 사용자에게 랜덤 추천인 코드 생성
DO $$
DECLARE
  user_record RECORD;
  new_code TEXT;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
  char_index INTEGER;
  exists_check INTEGER;
  attempts INTEGER;
BEGIN
  -- referral_code가 NULL인 모든 사용자 순회
  FOR user_record IN 
    SELECT id FROM game_users WHERE referral_code IS NULL
  LOOP
    attempts := 0;
    
    -- 고유한 코드 생성 (최대 100번 시도)
    LOOP
      new_code := '';
      
      -- 7자리 랜덤 코드 생성
      FOR i IN 1..7 LOOP
        char_index := 1 + floor(random() * length(chars))::INTEGER;
        new_code := new_code || substring(chars FROM char_index FOR 1);
      END LOOP;
      
      -- 중복 확인
      SELECT COUNT(*) INTO exists_check
      FROM game_users
      WHERE referral_code = new_code;
      
      -- 중복이 없으면 루프 종료
      EXIT WHEN exists_check = 0;
      
      attempts := attempts + 1;
      
      -- 100번 시도 후에도 중복이면 에러 (거의 불가능하지만 안전장치)
      IF attempts >= 100 THEN
        RAISE EXCEPTION 'Could not generate unique referral code after 100 attempts for user %', user_record.id;
      END IF;
    END LOOP;
    
    -- 추천인 코드 업데이트
    UPDATE game_users
    SET referral_code = new_code
    WHERE id = user_record.id;
    
  END LOOP;
END $$;

