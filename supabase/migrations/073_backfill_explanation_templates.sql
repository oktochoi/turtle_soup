-- explanation이 없는 공개 soup 사건에 기본 해설 템플릿 적용 (AdSense/SEO 품질)
-- 065, 066 적용 후 실행. author-written explanation은 덮어쓰지 않음.

UPDATE problems
SET explanation = CASE difficulty
  WHEN 'easy' THEN
    '이 사건은 쉬운 난이도의 바다거북스프 AI 수사 퍼즐입니다. 넓은 범위의 예/아니요 질문으로 장소·인물·행동을 먼저 확인하세요. ' ||
    '표면적 설명에 숨겨진 논리적 모순을 찾는 것이 핵심이며, 성급한 결론보다 사실 관계를 하나씩 검증하는 접근이 효과적입니다. ' ||
    '수사 완료 후 CASE CLOSED 화면에서 정답과 반전 포인트를 확인할 수 있습니다.'
  WHEN 'hard' THEN
    '이 사건은 어려운 난이도의 바다거북스프 AI 수사 퍼즐입니다. 단어·주어·시간의 정의를 의심하고, 가설 A/B를 번갈아 검증하세요. ' ||
    '여러 층의 함정과 이중 반전이 포함될 수 있으므로 질문을 기록하며 중복을 피하는 것이 중요합니다. ' ||
    '15회 이상 질문해도 정상이며, 수사 파일(Dossier)의 추천 질문을 참고하면 방향을 잡기 쉽습니다.'
  ELSE
    '이 사건은 중간 난이도의 바다거북스프 AI 수사 퍼즐입니다. 질문을 기록하며 사실 관계와 해석을 분리하고, ' ||
    '「진실을 알 것 같아요」로 중간 점검 후 최종 추리를 제출하세요. 약 10~15회 질문 후 결론에 가까워지는 것이 일반적입니다. ' ||
    '각 사건 하단의 수사 파일에서 유형별 수사법과 추천 질문을 미리 확인할 수 있습니다.'
END
WHERE explanation IS NULL
  AND (type = 'soup' OR type IS NULL)
  AND status IN ('published', 'featured');
