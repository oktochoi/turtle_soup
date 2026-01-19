-- avatars Storage 버킷 생성 및 정책 설정
-- 참고: Supabase Storage 버킷은 SQL로 직접 생성할 수 없으므로,
-- Supabase 대시보드에서 수동으로 버킷을 생성해야 합니다.
-- 이 파일은 참고용이며, 실제 버킷 생성은 다음 단계를 따르세요:
--
-- 1. Supabase 대시보드 > Storage 메뉴로 이동
-- 2. "New bucket" 버튼 클릭
-- 3. Bucket name: "avatars" 입력
-- 4. Public bucket: 체크 (공개 액세스)
-- 5. File size limit: 5MB (또는 원하는 크기)
-- 6. Allowed MIME types: image/* (또는 image/jpeg, image/png, image/webp)
-- 7. "Create bucket" 클릭
--
-- 아래 SQL은 Storage 정책만 설정합니다.

-- Storage 버킷 정책 설정 (RLS)
-- 참고: 버킷이 생성된 후에만 아래 정책이 작동합니다.

-- 모든 사용자가 버킷의 파일을 읽을 수 있도록 설정 (공개 버킷)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 버킷에 대한 읽기 정책 (모든 사용자)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- 인증된 사용자가 파일을 업로드할 수 있도록 설정
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = 'profile-images'
);

-- 인증된 사용자가 자신이 업로드한 파일만 업데이트할 수 있도록 설정
CREATE POLICY "Users can update their own avatars" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = 'profile-images'
);

-- 인증된 사용자가 자신이 업로드한 파일만 삭제할 수 있도록 설정
CREATE POLICY "Users can delete their own avatars" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = 'profile-images'
);

