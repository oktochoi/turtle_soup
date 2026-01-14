/**
 * 인증 및 권한 체크 헬퍼 함수
 */

import { createClient } from '@/lib/supabase/server';

/**
 * 현재 사용자가 인증되어 있는지 확인
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('Unauthorized: 로그인이 필요합니다.');
  }
  
  return { user, supabase };
}

/**
 * 현재 사용자가 관리자인지 확인
 * users 테이블의 is_admin 컬럼을 확인
 */
export async function requireAdmin() {
  const { user, supabase } = await requireAuth();
  
  // users 테이블에서 관리자 여부 확인
  const { data: userData, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  
  if (error || !userData) {
    console.error('사용자 정보 조회 오류:', error);
    throw new Error('Forbidden: 사용자 정보를 확인할 수 없습니다.');
  }
  
  if (!userData.is_admin) {
    throw new Error('Forbidden: 관리자 권한이 필요합니다.');
  }
  
  return { user, supabase };
}

