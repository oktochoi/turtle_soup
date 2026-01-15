/**
 * 학습된 오류 체크 유틸리티
 * 버그 리포트를 제출하기 전에 이미 학습된 오류인지 확인
 */

import { createClient } from '@/lib/supabase/client';

export type LearnedErrorCheck = {
  isLearnedError: boolean;
  matchedPatternId: string | null;
  matchedPatternHash: string | null;
  confidence: number;
};

/**
 * 버그 리포트가 학습된 오류인지 확인
 */
export async function checkIfLearnedError(
  questionText: string,
  aiSuggestedAnswer: string,
  expectedAnswer: string,
  bugType: 'wrong_answer' | 'wrong_yes_no' | 'wrong_irrelevant' | 'wrong_similarity' | 'other',
  similarityScore?: number | null
): Promise<LearnedErrorCheck> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('check_if_learned_error', {
      p_question_text: questionText,
      p_ai_suggested_answer: aiSuggestedAnswer,
      p_expected_answer: expectedAnswer,
      p_bug_type: bugType,
      p_similarity_score: similarityScore || null
    });

    if (error) {
      // 함수가 없거나 RLS 문제인 경우 조용히 false 반환
      if (error.code === '42883' || error.code === 'PGRST116' || error.message?.includes('permission')) {
        console.warn('학습된 오류 체크 함수가 없거나 접근 권한이 없습니다.');
        return {
          isLearnedError: false,
          matchedPatternId: null,
          matchedPatternHash: null,
          confidence: 0
        };
      }
      console.error('학습된 오류 체크 오류:', error);
      return {
        isLearnedError: false,
        matchedPatternId: null,
        matchedPatternHash: null,
        confidence: 0
      };
    }

    if (data && data.length > 0) {
      return {
        isLearnedError: data[0].is_learned_error || false,
        matchedPatternId: data[0].matched_pattern_id || null,
        matchedPatternHash: data[0].matched_pattern_hash || null,
        confidence: data[0].confidence || 0
      };
    }

    return {
      isLearnedError: false,
      matchedPatternId: null,
      matchedPatternHash: null,
      confidence: 0
    };
  } catch (error) {
    console.error('학습된 오류 체크 중 오류:', error);
    return {
      isLearnedError: false,
      matchedPatternId: null,
      matchedPatternHash: null,
      confidence: 0
    };
  }
}

