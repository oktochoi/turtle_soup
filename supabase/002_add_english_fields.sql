-- 업적과 칭호에 영어 필드 추가 및 번역 데이터 업데이트

-- 1. titles 테이블에 영어 필드 추가
ALTER TABLE titles 
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 2. achievements 테이블에 영어 필드 추가
ALTER TABLE achievements 
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 3. 기존 칭호 데이터에 영어 번역 추가
UPDATE titles SET 
  name_en = 'Trainee Detective',
  description_en = 'Reached Level 1'
WHERE name = '수습 탐정';

UPDATE titles SET 
  name_en = 'Junior Detective',
  description_en = 'Reached Level 5'
WHERE name = '신입 탐정';

UPDATE titles SET 
  name_en = 'Junior Detective',
  description_en = 'Reached Level 10'
WHERE name = '주니어 탐정';

UPDATE titles SET 
  name_en = 'Senior Detective',
  description_en = 'Reached Level 20'
WHERE name = '시니어 탐정';

UPDATE titles SET 
  name_en = 'Master Detective',
  description_en = 'Reached Level 30'
WHERE name = '마스터 탐정';

UPDATE titles SET 
  name_en = 'Legendary Detective',
  description_en = 'Reached Level 50'
WHERE name = '레전드 탐정';

UPDATE titles SET 
  name_en = 'Unyielding Detective',
  description_en = '7 consecutive days of participation'
WHERE name = '불굴의 탐정';

UPDATE titles SET 
  name_en = 'Immortal Detective',
  description_en = '30 consecutive days of participation'
WHERE name = '불멸의 탐정';

UPDATE titles SET 
  name_en = 'Perfectionist',
  description_en = '5 successes without hints'
WHERE name = '완벽주의자';

UPDATE titles SET 
  name_en = 'Genius Detective',
  description_en = '1 success within 3 questions'
WHERE name = '천재 탐정';

-- 4. 기존 업적 데이터에 영어 번역 추가
UPDATE achievements SET 
  name_en = 'First Steps',
  description_en = 'Completed your first participation'
WHERE name = '첫 걸음';

UPDATE achievements SET 
  name_en = 'Fire Starter',
  description_en = '3 consecutive days of participation'
WHERE name = '불꽃의 시작';

UPDATE achievements SET 
  name_en = 'Week Miracle',
  description_en = '7 consecutive days of participation'
WHERE name = '일주일의 기적';

UPDATE achievements SET 
  name_en = 'First Victory',
  description_en = 'Solved your first problem'
WHERE name = '첫 승리';

UPDATE achievements SET 
  name_en = '10 Victories',
  description_en = 'Solved 10 problems'
WHERE name = '10회 승리';

UPDATE achievements SET 
  name_en = 'Perfect Deduction',
  description_en = '5 successes without hints'
WHERE name = '완벽한 추리';

UPDATE achievements SET 
  name_en = 'Lightning Deduction',
  description_en = 'Success within 3 questions'
WHERE name = '번개 같은 추리';

UPDATE achievements SET 
  name_en = 'Level 10 Achieved',
  description_en = 'Reached Level 10'
WHERE name = '레벨 10 달성';

UPDATE achievements SET 
  name_en = 'Level 20 Achieved',
  description_en = 'Reached Level 20'
WHERE name = '레벨 20 달성';

UPDATE achievements SET 
  name_en = 'Communication King',
  description_en = 'Wrote 50 comments'
WHERE name = '소통왕';

UPDATE achievements SET 
  name_en = 'Writing King',
  description_en = 'Wrote 10 posts'
WHERE name = '작성왕';

