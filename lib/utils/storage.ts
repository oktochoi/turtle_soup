/**
 * Supabase Storage 유틸리티
 */

import { createClient } from '@/lib/supabase/client';

/**
 * 버킷이 존재하는지 확인
 */
export async function bucketExists(bucketName: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('버킷 목록 조회 오류:', error);
      return false;
    }
    
    return data?.some(bucket => bucket.name === bucketName) || false;
  } catch (error) {
    console.error('버킷 확인 오류:', error);
    return false;
  }
}

/**
 * 버킷 생성 시도 (관리자 권한 필요)
 * 참고: Supabase Storage 버킷 생성은 일반적으로 서버 사이드에서만 가능합니다.
 * 클라이언트에서 시도해보고, 실패하면 사용자에게 안내합니다.
 */
export async function createBucket(bucketName: string, isPublic: boolean = true): Promise<{ success: boolean; error?: any }> {
  try {
    const supabase = createClient();
    
    // Supabase Storage API의 createBucket 메서드 사용
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: isPublic,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/*', 'image/svg+xml'],
    });
    
    if (error) {
      // 버킷이 이미 존재하는 경우는 성공으로 간주
      if (error.message?.includes('already exists') || error.message?.includes('duplicate') || error.message?.includes('409')) {
        return { success: true };
      }
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error: any) {
    // 네트워크 오류나 기타 오류
    console.error('버킷 생성 오류:', error);
    return { success: false, error };
  }
}

/**
 * 버킷이 없으면 생성 시도
 */
export async function ensureBucketExists(bucketName: string, isPublic: boolean = true): Promise<boolean> {
  const exists = await bucketExists(bucketName);
  
  if (exists) {
    return true;
  }
  
  // 버킷이 없으면 생성 시도
  const result = await createBucket(bucketName, isPublic);
  return result.success;
}

