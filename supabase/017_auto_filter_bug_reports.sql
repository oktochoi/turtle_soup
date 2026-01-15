-- 버그 리포트 자동 필터링 함수
-- AI가 학습에 부적합한 리포트를 자동으로 판단하여 ignore_for_learning = true로 설정

-- 1. 버그 리포트 자동 필터링 함수
CREATE OR REPLACE FUNCTION auto_filter_bug_reports()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  filtered_count INTEGER := 0;
  report_record RECORD;
  should_exclude BOOLEAN;
  exclusion_reason TEXT;
  result JSONB;
  special_char_count INTEGER;
  text_length INTEGER;
  special_ratio FLOAT;
BEGIN
  -- pending 상태이고 아직 학습 제외되지 않은 리포트만 처리
  FOR report_record IN
    SELECT *
    FROM ai_bug_reports
    WHERE status = 'pending'
      AND ignore_for_learning = false
    ORDER BY created_at ASC
  LOOP
    should_exclude := false;
    exclusion_reason := NULL;

    -- 1. 명백히 잘못된 신고: 정답과 AI 제안이 실제로 일치하는 경우
    -- (사용자가 잘못 신고한 경우)
    IF report_record.bug_type = 'wrong_answer' 
       AND report_record.correct_answer IS NOT NULL
       AND report_record.ai_suggested_answer IS NOT NULL
       AND LOWER(TRIM(report_record.correct_answer)) = LOWER(TRIM(report_record.ai_suggested_answer)) THEN
      should_exclude := true;
      exclusion_reason := '정답과 AI 제안이 일치함 (잘못된 신고)';
    
    -- 2. 질문 텍스트가 너무 짧거나 의미없는 경우 (3글자 미만)
    ELSIF LENGTH(TRIM(report_record.question_text)) < 3 THEN
      should_exclude := true;
      exclusion_reason := '질문 텍스트가 너무 짧음';
    
    -- 3. 질문 텍스트가 반복 문자나 의미없는 패턴인 경우
    ELSIF report_record.question_text ~ '^(.)\1{4,}$' THEN
      should_exclude := true;
      exclusion_reason := '의미없는 반복 문자';
    
    -- 4. (제거됨) 같은 사용자의 반복 리포트는 학습 대상에 포함
    -- 사용자가 여러 번 리포트를 올려도 학습에 포함시킴
    
    -- 5. 유사도 점수가 매우 낮은 경우 (0.1 미만) - 명백히 다른 문제
    ELSIF report_record.similarity_score IS NOT NULL 
          AND report_record.similarity_score < 0.1 
          AND report_record.bug_type IN ('wrong_answer', 'wrong_similarity') THEN
      should_exclude := true;
      exclusion_reason := '유사도 점수가 매우 낮음 (명백히 다른 문제)';
    
    -- 6. (제거됨) expected_answer는 이제 필수 필드이므로 이 조건 불필요
    
    -- 7. (제거됨) expected_answer는 이제 필수 필드이므로 이 조건 불필요
    
    -- 8. 같은 문제에 대해 서로 반대 의견이 많은 경우 (논쟁적 문제)
    ELSIF (
      SELECT COUNT(DISTINCT ai_suggested_answer)
      FROM ai_bug_reports
      WHERE problem_id = report_record.problem_id
        AND bug_type = report_record.bug_type
        AND created_at >= NOW() - INTERVAL '7 days'
        AND ignore_for_learning = false
    ) >= 3 
    AND (
      SELECT COUNT(*)
      FROM ai_bug_reports
      WHERE problem_id = report_record.problem_id
        AND created_at >= NOW() - INTERVAL '7 days'
        AND ignore_for_learning = false
    ) >= 5 THEN
      should_exclude := true;
      exclusion_reason := '논쟁적인 문제 (서로 다른 의견 다수)';
    
    -- 9. 질문 텍스트에 특수문자나 이상한 패턴이 많은 경우 (30% 이상)
    ELSIF LENGTH(report_record.question_text) > 0 THEN
      text_length := LENGTH(report_record.question_text);
      special_char_count := text_length - LENGTH(REGEXP_REPLACE(report_record.question_text, '[^가-힣a-zA-Z0-9\s]', '', 'g'));
      special_ratio := special_char_count::FLOAT / NULLIF(text_length, 0);
      
      IF special_ratio > 0.3 THEN
        should_exclude := true;
        exclusion_reason := '특수문자 비율이 높음 (의미없는 텍스트 가능성)';
      END IF;
    END IF;

    -- 필터링 대상이면 업데이트
    IF should_exclude THEN
      UPDATE ai_bug_reports
      SET 
        ignore_for_learning = true,
        admin_notes = COALESCE(admin_notes || E'\n', '') || 
                     '[자동 필터링] ' || exclusion_reason || ' (' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || ')',
        updated_at = NOW()
      WHERE id = report_record.id;
      
      filtered_count := filtered_count + 1;
    END IF;
  END LOOP;

  -- 결과 반환
  result := jsonb_build_object(
    'success', true,
    'filtered_count', filtered_count,
    'timestamp', NOW()
  );

  RETURN result;
END;
$$;

-- 2. 관리자가 수동으로 자동 필터링을 실행할 수 있는 함수 (더 안전한 버전)
CREATE OR REPLACE FUNCTION run_auto_filter_bug_reports(
  dry_run BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  filtered_count INTEGER;
  preview_data JSONB;
BEGIN
  IF dry_run THEN
    -- 미리보기 모드: 실제로 업데이트하지 않고 어떤 리포트가 필터링될지 보여줌
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'question_text', question_text,
        'bug_type', bug_type,
        'reason', '자동 필터링 대상 (실제 실행 시 제외됨)'
      )
    ) INTO preview_data
    FROM ai_bug_reports
    WHERE status = 'pending'
      AND ignore_for_learning = false
      AND (
        -- 필터링 조건들 (실제 함수와 동일)
        (bug_type = 'wrong_answer' 
         AND correct_answer IS NOT NULL
         AND ai_suggested_answer IS NOT NULL
         AND LOWER(TRIM(correct_answer)) = LOWER(TRIM(ai_suggested_answer)))
        OR LENGTH(TRIM(question_text)) < 3
        OR question_text ~ '^(.)\1{4,}$'
        OR (similarity_score IS NOT NULL 
            AND similarity_score < 0.1 
            AND bug_type IN ('wrong_answer', 'wrong_similarity'))
      )
    LIMIT 50;

    result := jsonb_build_object(
      'success', true,
      'dry_run', true,
      'preview_count', COALESCE(jsonb_array_length(preview_data), 0),
      'preview_data', preview_data,
      'message', '미리보기 모드: 실제로는 업데이트되지 않았습니다.'
    );
  ELSE
    -- 실제 실행
    SELECT auto_filter_bug_reports() INTO result;
  END IF;

  RETURN result;
END;
$$;

-- 3. 주석 추가
COMMENT ON FUNCTION auto_filter_bug_reports() IS 
'버그 리포트를 자동으로 분석하여 학습에 부적합한 리포트를 필터링합니다. 
필터링 기준:
1. 정답과 AI 제안이 일치하는 경우 (잘못된 신고)
2. 질문 텍스트가 너무 짧거나 의미없는 경우
3. 같은 사용자의 반복 리포트 (스팸 가능성)
4. 유사도 점수가 매우 낮은 경우
5. 논쟁적인 문제 (서로 다른 의견이 많은 경우)
6. 기타 품질이 낮은 리포트';

COMMENT ON FUNCTION run_auto_filter_bug_reports(BOOLEAN) IS 
'자동 필터링을 실행합니다. dry_run=true이면 미리보기만 하고 실제로는 업데이트하지 않습니다.';

