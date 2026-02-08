-- 제작자만 balance_games 수정 가능
CREATE POLICY "Creator can update balance_games"
  ON balance_games FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- 제작자만 자신의 게임 선택지 수정/삭제 가능
CREATE POLICY "Creator can update balance_game_options"
  ON balance_game_options FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM balance_games WHERE id = balance_game_options.game_id AND created_by = auth.uid())
  );
CREATE POLICY "Creator can delete balance_game_options"
  ON balance_game_options FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM balance_games WHERE id = balance_game_options.game_id AND created_by = auth.uid())
  );
