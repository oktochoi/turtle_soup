-- 업데이트: 고전 퍼즐 출처/원작자 메타데이터
-- title 매칭으로 업데이트합니다. 필요 시 실행 전 백업을 권장합니다.

UPDATE problems SET
  original_author = 'Classic Turtle Soup (Public Domain)',
  original_title = 'Turtle Soup Riddle / ウミガメのスープ',
  source_url = 'https://en.wikipedia.org/wiki/Turtle_soup_(riddle)'
WHERE title = '바다거북 수프';

UPDATE problems SET
  original_author = 'Classic Turtle Soup (Public Domain)',
  original_title = 'The Broken Matchstick Riddle',
  source_url = 'https://en.wikipedia.org/wiki/Turtle_soup_(riddle)'
WHERE title = '사막';

UPDATE problems SET
  original_author = 'Classic Logic Puzzle (Unknown)',
  original_title = 'The Elevator Riddle',
  source_url = 'https://en.wikipedia.org/wiki/Logic_puzzle'
WHERE title = '엘리베이터';

UPDATE problems SET
  original_author = 'Classic Turtle Soup (Public Domain)',
  original_title = 'The Bartender and the Hiccup',
  source_url = 'https://en.wikipedia.org/wiki/Turtle_soup_(riddle)'
WHERE title = '바텐더';

UPDATE problems SET
  original_author = 'Classic Japanese Turtle Soup',
  original_title = '灯台守の自殺',
  source_url = 'https://ja.wikipedia.org/wiki/ウミガメのスープ'
WHERE title = '등대';

UPDATE problems SET
  original_author = 'Classic Logic Puzzle (Unknown)',
  original_title = 'The Broken Bicycle Brake',
  source_url = 'https://en.wikipedia.org/wiki/Logic_puzzle'
WHERE title = '밤손님';

UPDATE problems SET
  original_author = 'Classic Turtle Soup (Public Domain)',
  original_title = 'The Scuba Diver in the Tree',
  source_url = 'https://en.wikipedia.org/wiki/Turtle_soup_(riddle)'
WHERE title = '스킨스쿠버';

UPDATE problems SET
  original_author = 'Classic Japanese Puzzle',
  original_title = '消えた黒猫',
  source_url = 'https://ja.wikipedia.org/wiki/論理パズル'
WHERE title = '고양이';

