/**
 * V10 Learning Data Loader
 * 승인된 학습 데이터만 로드 (자동 반영 방지)
 */

import { createClient } from '@/lib/supabase/client';

export interface ApprovedLearningData {
  synonyms: Map<string, string[]>;
  antonyms: Map<string, string[]>;
  taxonomy: Array<{ parent: string; child: string }>;
  concepts: Map<string, string[]>;
}

let cachedApprovedData: ApprovedLearningData | null = null;
let loadPromise: Promise<ApprovedLearningData> | null = null;

/**
 * Load approved learning data from Supabase
 */
export async function loadApprovedLearningData(): Promise<ApprovedLearningData> {
  if (cachedApprovedData) {
    return cachedApprovedData;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const supabase = createClient();
      
      // Load approved synonyms
      const { data: synonymsData, error: synonymsError } = await supabase
        .rpc('get_approved_learning_data', {
          p_data_type: 'synonym',
          p_source_token: null,
        });

      if (synonymsError) {
        console.warn('[V10 Learning] Failed to load synonyms:', synonymsError);
      }

      // Load approved antonyms
      const { data: antonymsData, error: antonymsError } = await supabase
        .rpc('get_approved_learning_data', {
          p_data_type: 'antonym',
          p_source_token: null,
        });

      if (antonymsError) {
        console.warn('[V10 Learning] Failed to load antonyms:', antonymsError);
      }

      // Build maps
      const synonyms = new Map<string, string[]>();
      const antonyms = new Map<string, string[]>();
      const taxonomy: Array<{ parent: string; child: string }> = [];
      const concepts = new Map<string, string[]>();

      // Process synonyms
      if (synonymsData) {
        for (const item of synonymsData) {
          if (!synonyms.has(item.source_token)) {
            synonyms.set(item.source_token, []);
          }
          synonyms.get(item.source_token)!.push(item.target_token);
        }
      }

      // Process antonyms
      if (antonymsData) {
        for (const item of antonymsData) {
          if (!antonyms.has(item.source_token)) {
            antonyms.set(item.source_token, []);
          }
          antonyms.get(item.source_token)!.push(item.target_token);
        }
      }

      cachedApprovedData = {
        synonyms,
        antonyms,
        taxonomy,
        concepts,
      };

      return cachedApprovedData;
    } catch (error) {
      console.error('[V10 Learning] Failed to load approved data:', error);
      // Return empty data on error
      return {
        synonyms: new Map(),
        antonyms: new Map(),
        taxonomy: [],
        concepts: new Map(),
      };
    }
  })();

  return loadPromise;
}

/**
 * Clear cache (for testing or reload)
 */
export function clearApprovedLearningCache(): void {
  cachedApprovedData = null;
  loadPromise = null;
}

