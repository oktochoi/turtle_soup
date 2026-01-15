-- 자동 필터링 함수 복원 (수동 실행 전용)
-- 이 함수들은 자동으로 실행되지 않으며, 관리자가 수동으로 버튼을 눌러야만 실행됩니다.

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
  -- 이미 ignore_for_learning = true이거나 studied = true인 것은 제외
  FOR report_record IN
    SELECT *
    FROM ai_bug_reports
    WHERE status = 'pending'
      AND ignore_for_learning = false
      AND studied = false
    ORDER BY created_at ASC
  LOOP
    should_exclude := false;
    exclusion_reason := NULL;

    -- 1. 명백히 잘못된 신고: 정답과 AI 제안이 실제로 일치하는 경우
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
    
    -- 4. 유사도 점수가 너무 낮은 경우 (0.1 미만)
    ELSIF report_record.similarity_score IS NOT NULL 
          AND report_record.similarity_score < 0.1 THEN
      should_exclude := true;
      exclusion_reason := '유사도 점수가 너무 낮음';
    
    -- 5. yes/no 질문인데 기대 답변이 없는 경우 (이미 required이므로 제거 가능하지만 호환성 유지)
    ELSIF report_record.bug_type = 'wrong_yes_no' 
          AND (report_record.expected_answer IS NULL OR TRIM(report_record.expected_answer) = '') THEN
      should_exclude := true;
      exclusion_reason := 'yes/no 질문에 기대 답변이 없음';
    
    -- 6. 논쟁적인 문제: 같은 문제에 대해 많은 상충하는 답변이 있는 경우
    ELSIF EXISTS (
      SELECT 1
      FROM ai_bug_reports abr2
      WHERE abr2.problem_id = report_record.problem_id
        AND abr2.id != report_record.id
        AND abr2.status = 'pending'
        AND abr2.ignore_for_learning = false
        AND abr2.studied = false
      GROUP BY abr2.problem_id
      HAVING COUNT(*) >= 5
    ) THEN
      should_exclude := true;
      exclusion_reason := '논쟁적인 문제 (많은 상충하는 답변)';
    
    -- 7. 특수문자 비율이 너무 높은 경우 (30% 이상)
    ELSE
      text_length := LENGTH(report_record.question_text);
      IF text_length > 0 THEN
        special_char_count := LENGTH(report_record.question_text) - LENGTH(REGEXP_REPLACE(report_record.question_text, '[가-힣a-zA-Z0-9\s]', '', 'g'));
        special_ratio := special_char_count::FLOAT / text_length::FLOAT;
        
        IF special_ratio > 0.3 THEN
          should_exclude := true;
          exclusion_reason := '특수문자 비율이 너무 높음';
        END IF;
      END IF;
    END IF;

    -- 필터링 대상이면 ignore_for_learning = true로 설정
    IF should_exclude THEN
      UPDATE ai_bug_reports
      SET ignore_for_learning = true,
          updated_at = NOW()
      WHERE id = report_record.id;
      
      filtered_count := filtered_count + 1;
    END IF;
  END LOOP;

  -- 결과 반환
  result := jsonb_build_object(
    'filtered_count', filtered_count,
    'timestamp', NOW()
  );

  RETURN result;
END;
$$;

-- 2. 관리자용 자동 필터링 실행 함수 (dry_run 옵션 포함)
CREATE OR REPLACE FUNCTION run_auto_filter_bug_reports(dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  filtered_count INTEGER := 0;
  report_record RECORD;
  should_exclude BOOLEAN;
  exclusion_reason TEXT;
  preview_data JSONB[] := ARRAY[]::JSONB[];
  preview_count INTEGER := 0;
  result JSONB;
  special_char_count INTEGER;
  text_length INTEGER;
  special_ratio FLOAT;
BEGIN
  -- pending 상태이고 아직 학습 제외되지 않은 리포트만 처리
  -- 이미 ignore_for_learning = true이거나 studied = true인 것은 제외
  FOR report_record IN
    SELECT *
    FROM ai_bug_reports
    WHERE status = 'pending'
      AND ignore_for_learning = false
      AND studied = false
    ORDER BY created_at ASC
  LOOP
    should_exclude := false;
    exclusion_reason := NULL;

    -- 1. 명백히 잘못된 신고: 정답과 AI 제안이 실제로 일치하는 경우
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
    
    -- 4. 유사도 점수가 너무 낮은 경우 (0.1 미만)
    ELSIF report_record.similarity_score IS NOT NULL 
          AND report_record.similarity_score < 0.1 THEN
      should_exclude := true;
      exclusion_reason := '유사도 점수가 너무 낮음';
    
    -- 5. yes/no 질문인데 기대 답변이 없는 경우
    ELSIF report_record.bug_type = 'wrong_yes_no' 
          AND (report_record.expected_answer IS NULL OR TRIM(report_record.expected_answer) = '') THEN
      should_exclude := true;
      exclusion_reason := 'yes/no 질문에 기대 답변이 없음';
    
    -- 6. 논쟁적인 문제: 같은 문제에 대해 많은 상충하는 답변이 있는 경우
    ELSIF EXISTS (
      SELECT 1
      FROM ai_bug_reports abr2
      WHERE abr2.problem_id = report_record.problem_id
        AND abr2.id != report_record.id
        AND abr2.status = 'pending'
        AND abr2.ignore_for_learning = false
        AND abr2.studied = false
      GROUP BY abr2.problem_id
      HAVING COUNT(*) >= 5
    ) THEN
      should_exclude := true;
      exclusion_reason := '논쟁적인 문제 (많은 상충하는 답변)';
    
    -- 7. 특수문자 비율이 너무 높은 경우 (30% 이상)
    ELSE
      text_length := LENGTH(report_record.question_text);
      IF text_length > 0 THEN
        special_char_count := LENGTH(report_record.question_text) - LENGTH(REGEXP_REPLACE(report_record.question_text, '[가-힣a-zA-Z0-9\s]', '', 'g'));
        special_ratio := special_char_count::FLOAT / text_length::FLOAT;
        
        IF special_ratio > 0.3 THEN
          should_exclude := true;
          exclusion_reason := '특수문자 비율이 너무 높음';
        END IF;
      END IF;
    END IF;

    -- 미리보기 모드인 경우
    IF dry_run THEN
      IF should_exclude THEN
        preview_data := preview_data || jsonb_build_object(
          'id', report_record.id,
          'question_text', report_record.question_text,
          'bug_type', report_record.bug_type,
          'exclusion_reason', exclusion_reason
        );
        preview_count := preview_count + 1;
      END IF;
    ELSE
      -- 실제 실행 모드인 경우
      IF should_exclude THEN
        UPDATE ai_bug_reports
        SET ignore_for_learning = true,
            updated_at = NOW()
        WHERE id = report_record.id;
        
        filtered_count := filtered_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 결과 반환
  IF dry_run THEN
    result := jsonb_build_object(
      'preview_count', preview_count,
      'preview_data', preview_data,
      'timestamp', NOW()
    );
  ELSE
    result := jsonb_build_object(
      'filtered_count', filtered_count,
      'timestamp', NOW()
    );
  END IF;

  RETURN result;
END;
$$;

-- 3. 주석 추가
COMMENT ON FUNCTION auto_filter_bug_reports() IS 
'버그 리포트를 자동으로 필터링하여 학습에 부적합한 리포트를 제외합니다. 수동 실행 전용입니다.';

COMMENT ON FUNCTION run_auto_filter_bug_reports(BOOLEAN) IS 
'관리자가 수동으로 버튼을 눌러 실행하는 자동 필터링 함수입니다. dry_run=true이면 미리보기, false이면 실제 실행합니다.';

