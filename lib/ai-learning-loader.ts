/**
 * AI 학습 데이터 로더
 * 버그 리포트에서 추출한 패턴을 AI 분석기에 동적으로 적용
 */

import { createClient } from '@/lib/supabase/client';

export type LearningSynonym = {
  token: string;
  synonyms: string[];
  confidence: number;
  source: 'bug_report' | 'manual';
};

export type LearningAntonym = {
  token: string;
  antonyms: string[];
  confidence: number;
  source: 'bug_report' | 'manual';
};

export type LearningThreshold = {
  threshold_type: string;
  value: number;
  confidence: number;
  reason: string;
};

/**
 * 학습된 유의어 사전 로드
 */
export async function loadLearnedSynonyms(): Promise<Map<string, string[]>> {
  try {
    const supabase = createClient();
    
    // 적용된 유의어 패턴 조회
    const { data, error } = await supabase
      .from('ai_learning_patterns')
      .select('pattern_data, confidence_score')
      .eq('pattern_type', 'synonym_discovery')
      .eq('applied', true)
      .gte('confidence_score', 0.6)
      .order('confidence_score', { ascending: false });

    if (error) {
      // 테이블이 없거나 RLS 문제인 경우 조용히 빈 Map 반환
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('permission')) {
        console.warn('학습된 유의어 테이블이 없거나 접근 권한이 없습니다. 빈 데이터를 반환합니다.');
        return new Map();
      }
      console.error('학습된 유의어 로드 오류:', error);
      return new Map();
    }

    const synonymMap = new Map<string, string[]>();

    for (const pattern of data || []) {
      const patternData = pattern.pattern_data as any;
      const questionToken = patternData.question_token;
      const expected = patternData.expected;
      const aiSuggested = patternData.ai_suggested;

      if (questionToken && expected && aiSuggested) {
        // 유의어 관계 추론
        const existing = synonymMap.get(questionToken) || [];
        if (!existing.includes(expected)) {
          existing.push(expected);
        }
        if (!existing.includes(aiSuggested)) {
          existing.push(aiSuggested);
        }
        synonymMap.set(questionToken, existing);
      }
    }

    return synonymMap;
  } catch (error) {
    console.error('학습된 유의어 로드 중 오류:', error);
    return new Map();
  }
}

/**
 * 학습된 반의어 사전 로드
 */
export async function loadLearnedAntonyms(): Promise<Map<string, string[]>> {
  try {
    const supabase = createClient();
    
    // 적용된 반의어 패턴 조회
    const { data, error } = await supabase
      .from('ai_learning_patterns')
      .select('pattern_data, confidence_score')
      .eq('pattern_type', 'antonym_discovery')
      .eq('applied', true)
      .gte('confidence_score', 0.6)
      .order('confidence_score', { ascending: false });

    if (error) {
      // 테이블이 없거나 RLS 문제인 경우 조용히 빈 Map 반환
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('permission')) {
        console.warn('학습된 반의어 테이블이 없거나 접근 권한이 없습니다. 빈 데이터를 반환합니다.');
        return new Map();
      }
      console.error('학습된 반의어 로드 오류:', error);
      return new Map();
    }

    const antonymMap = new Map<string, string[]>();

    for (const pattern of data || []) {
      const patternData = pattern.pattern_data as any;
      const token1 = patternData.token1;
      const token2 = patternData.token2;

      if (token1 && token2) {
        const existing = antonymMap.get(token1) || [];
        if (!existing.includes(token2)) {
          existing.push(token2);
        }
        antonymMap.set(token1, existing);

        // 역방향도 추가
        const existingReverse = antonymMap.get(token2) || [];
        if (!existingReverse.includes(token1)) {
          existingReverse.push(token1);
        }
        antonymMap.set(token2, existingReverse);
      }
    }

    return antonymMap;
  } catch (error) {
    console.error('학습된 반의어 로드 중 오류:', error);
    return new Map();
  }
}

/**
 * 학습된 threshold 값 로드
 */
export async function loadLearnedThresholds(): Promise<Map<string, number>> {
  try {
    const supabase = createClient();
    
    // 적용된 threshold 조정 패턴 조회
    const { data, error } = await supabase
      .from('ai_learning_patterns')
      .select('pattern_data, confidence_score')
      .eq('pattern_type', 'threshold_adjustment')
      .eq('applied', true)
      .gte('confidence_score', 0.7)
      .order('confidence_score', { ascending: false });

    if (error) {
      // 테이블이 없거나 RLS 문제인 경우 조용히 빈 Map 반환
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('permission')) {
        console.warn('학습된 threshold 테이블이 없거나 접근 권한이 없습니다. 빈 데이터를 반환합니다.');
        return new Map();
      }
      console.error('학습된 threshold 로드 오류:', error);
      return new Map();
    }

    const thresholdMap = new Map<string, number>();

    for (const pattern of data || []) {
      const patternData = pattern.pattern_data as any;
      const bugType = patternData.bug_type;
      const suggestedThreshold = patternData.suggested_threshold;

      if (bugType && typeof suggestedThreshold === 'number') {
        // 버그 타입에 따라 threshold 매핑
        const thresholdKey = `THRESHOLD_${bugType.toUpperCase()}`;
        thresholdMap.set(thresholdKey, suggestedThreshold);
      }
    }

    return thresholdMap;
  } catch (error) {
    console.error('학습된 threshold 로드 중 오류:', error);
    return new Map();
  }
}

/**
 * 모든 학습 데이터를 한 번에 로드
 */
export async function loadAllLearningData(): Promise<{
  synonyms: Map<string, string[]>;
  antonyms: Map<string, string[]>;
  thresholds: Map<string, number>;
}> {
  const [synonyms, antonyms, thresholds] = await Promise.all([
    loadLearnedSynonyms(),
    loadLearnedAntonyms(),
    loadLearnedThresholds(),
  ]);

  return { synonyms, antonyms, thresholds };
}

