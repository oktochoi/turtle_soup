/**
 * 관리자 권한 체크 유틸리티
 */

import { createClient } from '@/lib/supabase/client';

/**
 * 사용자가 관리자인지 확인 (데이터베이스에서 조회)
 * @param userId 사용자 ID
 * @returns 관리자 여부 (비동기)
 */
export async function isAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('관리자 권한 확인 오류:', error);
      return false;
    }
    
    return data?.is_admin === true;
  } catch (error) {
    console.error('관리자 권한 확인 오류:', error);
    return false;
  }
}

/**
 * 사용자가 관리자인지 확인 (동기 버전 - 캐시된 값 사용)
 * @param isAdminValue 데이터베이스에서 조회한 is_admin 값
 * @returns 관리자 여부
 */
export function isAdminSync(isAdminValue: boolean | undefined | null): boolean {
  return isAdminValue === true;
}

