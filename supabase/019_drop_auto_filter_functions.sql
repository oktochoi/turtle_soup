-- 자동 필터링 함수 삭제 스크립트
-- 필요시 이 스크립트를 실행하여 자동 필터링 함수들을 삭제할 수 있습니다.

-- 1. 자동 필터링 함수 삭제
DROP FUNCTION IF EXISTS auto_filter_bug_reports() CASCADE;

-- 2. 관리자용 자동 필터링 실행 함수 삭제
DROP FUNCTION IF EXISTS run_auto_filter_bug_reports(BOOLEAN) CASCADE;

-- 참고: CASCADE 옵션은 이 함수들을 참조하는 다른 객체들도 함께 삭제합니다.
-- 만약 다른 함수나 트리거가 이 함수들을 참조하고 있다면 함께 삭제됩니다.

