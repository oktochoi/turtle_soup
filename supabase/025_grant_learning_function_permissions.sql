-- AI 학습 함수 실행 권한 부여

-- run_ai_learning_cycle 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION run_ai_learning_cycle() TO authenticated;
GRANT EXECUTE ON FUNCTION run_ai_learning_cycle() TO anon;

-- analyze_bug_reports_for_learning 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION analyze_bug_reports_for_learning(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_bug_reports_for_learning(INTEGER, INTEGER) TO anon;

-- apply_learning_patterns 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION apply_learning_patterns() TO authenticated;
GRANT EXECUTE ON FUNCTION apply_learning_patterns() TO anon;

-- sync_learning_patterns_to_errors 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION sync_learning_patterns_to_errors() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_learning_patterns_to_errors() TO anon;

-- mark_reports_as_studied 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION mark_reports_as_studied() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_reports_as_studied() TO anon;

-- update_ai_learning_stats 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION update_ai_learning_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION update_ai_learning_stats() TO anon;

-- check_if_learned_error 함수 실행 권한 부여 (실제 시그니처: 5개 매개변수)
GRANT EXECUTE ON FUNCTION check_if_learned_error(TEXT, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION check_if_learned_error(TEXT, TEXT, TEXT, TEXT, NUMERIC) TO anon;

