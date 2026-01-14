-- 게임 방에 힌트 기능 추가
-- rooms 테이블에 hints 컬럼 추가 (JSON 배열, 최대 3개)

ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS hints JSONB DEFAULT NULL;

-- 힌트는 최대 3개까지 제한 (애플리케이션 레벨에서 처리)
-- JSON 배열 형식: ["힌트1", "힌트2", "힌트3"]

-- 인덱스 추가 (선택사항, 힌트 검색이 필요한 경우)
-- CREATE INDEX IF NOT EXISTS idx_rooms_hints ON rooms USING GIN (hints);

