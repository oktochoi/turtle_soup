-- 새로운 멋진 칭호 추가

INSERT INTO titles (name, description, rarity, unlock_type, unlock_value, icon) VALUES
  -- 레벨 기반 칭호
  ('그랜드마스터', '레벨 100 달성', 'legendary', 'level', 100, '👑'),
  ('신의 탐정', '레벨 200 달성', 'legendary', 'level', 200, '⚡'),
  
  -- 스트릭 기반 칭호
  ('불타는 영혼', '연속 100일 참여', 'legendary', 'streak', 100, '🔥'),
  ('시간의 지배자', '연속 365일 참여', 'legendary', 'streak', 365, '⏰'),
  
  -- 해결 기반 칭호
  ('백전노장', '문제를 100회 해결', 'epic', 'solve_count', 100, '🏅'),
  ('천전노장', '문제를 1000회 해결', 'legendary', 'solve_count', 1000, '🌟'),
  ('완벽한 추론가', '힌트 없이 50회 성공', 'epic', 'solve_count', 50, '💎'),
  ('번개 추론가', '3질문 이내 성공 10회', 'epic', 'solve_count', 10, '⚡'),
  
  -- 특별 칭호
  ('커뮤니티 스타', '게시글을 50개 작성', 'rare', 'manual', NULL, '⭐'),
  ('인기 작가', '받은 좋아요 500개', 'epic', 'manual', NULL, '❤️'),
  ('베스트 작가', '받은 좋아요 1000개', 'legendary', 'manual', NULL, '💖'),
  ('댓글 마스터', '댓글을 200개 작성', 'rare', 'manual', NULL, '💬'),
  ('소통의 달인', '댓글을 500개 작성', 'epic', 'manual', NULL, '🗣️'),
  
  -- 전설적 칭호
  ('바다거북의 수호자', '모든 조건을 달성한 전설', 'legendary', 'manual', NULL, '🐢'),
  ('진실의 탐구자', '레벨 50 + 스트릭 30일 + 해결 50회', 'legendary', 'manual', NULL, '🔮'),
  ('완벽주의 탐정', '힌트 없이 20회 + 3질문 이내 5회', 'legendary', 'manual', NULL, '✨')
ON CONFLICT (name) DO NOTHING;

-- 영어 이름 추가 (name_en 컬럼이 있다면)
-- 참고: 현재 스키마에 name_en이 없을 수 있으므로, 필요시 마이그레이션에서 추가해야 함
-- ALTER TABLE titles ADD COLUMN IF NOT EXISTS name_en TEXT;
-- ALTER TABLE titles ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 영어 이름 업데이트 (컬럼이 있는 경우)
DO $$
BEGIN
  -- name_en 컬럼이 있는지 확인하고 업데이트
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'titles' AND column_name = 'name_en'
  ) THEN
    UPDATE titles SET name_en = 'Grandmaster' WHERE name = '그랜드마스터';
    UPDATE titles SET name_en = 'Divine Detective' WHERE name = '신의 탐정';
    UPDATE titles SET name_en = 'Burning Soul' WHERE name = '불타는 영혼';
    UPDATE titles SET name_en = 'Master of Time' WHERE name = '시간의 지배자';
    UPDATE titles SET name_en = 'Veteran Warrior' WHERE name = '백전노장';
    UPDATE titles SET name_en = 'Thousand Battles' WHERE name = '천전노장';
    UPDATE titles SET name_en = 'Perfect Reasoner' WHERE name = '완벽한 추론가';
    UPDATE titles SET name_en = 'Lightning Reasoner' WHERE name = '번개 추론가';
    UPDATE titles SET name_en = 'Community Star' WHERE name = '커뮤니티 스타';
    UPDATE titles SET name_en = 'Popular Writer' WHERE name = '인기 작가';
    UPDATE titles SET name_en = 'Best Writer' WHERE name = '베스트 작가';
    UPDATE titles SET name_en = 'Comment Master' WHERE name = '댓글 마스터';
    UPDATE titles SET name_en = 'Communication Expert' WHERE name = '소통의 달인';
    UPDATE titles SET name_en = 'Guardian of Turtle Soup' WHERE name = '바다거북의 수호자';
    UPDATE titles SET name_en = 'Seeker of Truth' WHERE name = '진실의 탐구자';
    UPDATE titles SET name_en = 'Perfectionist Detective' WHERE name = '완벽주의 탐정';
  END IF;
END $$;

