'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';

export default function CreateGuessSetPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const router = useRouter();
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
      return;
    }
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, authLoading, router, lang]);

  const handleSubmit = async () => {
    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      return;
    }

    if (!title.trim()) {
      alert(lang === 'ko' ? '제목을 입력해주세요.' : 'Please enter a title.');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      
      let coverImageUrlFinal = coverImageUrl;
      
      // 커버 이미지 업로드
      if (coverImageFile) {
        setIsUploadingImage(true);
        const fileName = `cover_${Date.now()}_${coverImageFile.name}`;
        const filePath = `guess-sets/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('quiz-images')
          .upload(filePath, coverImageFile);

        if (uploadError) {
          console.error('이미지 업로드 오류:', uploadError);
          // 이미지 업로드 실패해도 계속 진행
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('quiz-images')
            .getPublicUrl(filePath);
          coverImageUrlFinal = publicUrl;
        }
        setIsUploadingImage(false);
      }
      
      // guess_set 생성 (항상 공개, 제한시간은 플레이 시 선택)
      const { data: guessSet, error } = await supabase
        .from('guess_sets')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          default_time_per_card: 15, // 기본값만 저장 (플레이 시 유저가 선택)
          is_public: true, // 항상 공개
          cover_image_url: coverImageUrlFinal || null,
        })
        .select()
        .single();

      if (error) {
        console.error('맞추기 세트 생성 오류:', error);
        throw error;
      }

      if (!guessSet) {
        throw new Error('세트가 생성되지 않았습니다.');
      }

      // 맞추기 세트 편집 페이지로 이동
      router.push(`/${lang}/guess/${guessSet.id}/edit`);
    } catch (error: any) {
      console.error('맞추기 세트 생성 오류:', error);
      alert(
        lang === 'ko' 
          ? `세트 생성에 실패했습니다.\n\n${error?.message || ''}` 
          : `Failed to create set.\n\n${error?.message || ''}`
      );
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-3xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}/create-problem`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {lang === 'ko' ? '맞추기 게임 만들기' : 'Create Guess Set'}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            {lang === 'ko' 
              ? '이미지를 보고 정답을 맞히는 게임 세트를 만들어보세요'
              : 'Create a game set where players guess answers from images'}
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 space-y-4 sm:space-y-5">
          {/* 제목 */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '세트 제목' : 'Set Title'}
              <span className="text-red-400 ml-1">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'ko' ? '예: 동물 맞추기' : 'e.g., Animal Guess'}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
              maxLength={100}
            />
          </div>

          {/* 커버 이미지 */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '세트 소개 이미지 (선택사항)' : 'Cover Image (Optional)'}
            </label>
            <div className="space-y-2">
              {(coverImageFile || coverImageUrl) && (
                <div className="relative w-full h-48 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                  <img
                    src={coverImageFile ? URL.createObjectURL(coverImageFile) : coverImageUrl}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      setCoverImageFile(null);
                      setCoverImageUrl('');
                    }}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCoverImageFile(file);
                    setCoverImageUrl('');
                  }
                }}
                className="hidden"
                id="cover-image-input"
              />
              <label
                htmlFor="cover-image-input"
                className="block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white cursor-pointer hover:bg-slate-800 transition-colors text-center text-sm sm:text-base"
              >
                <i className="ri-image-add-line mr-2"></i>
                {coverImageFile || coverImageUrl 
                  ? (lang === 'ko' ? '이미지 변경' : 'Change Image')
                  : (lang === 'ko' ? '이미지 선택' : 'Select Image')}
              </label>
              <input
                type="text"
                value={coverImageUrl}
                onChange={(e) => {
                  setCoverImageUrl(e.target.value);
                  setCoverImageFile(null);
                }}
                placeholder={lang === 'ko' ? '또는 이미지 URL 입력' : 'Or enter image URL'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '설명 (선택사항)' : 'Description (Optional)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'ko' ? '게임 세트에 대한 설명을 입력하세요' : 'Enter description for the game set'}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none text-sm sm:text-base"
              maxLength={500}
            />
          </div>



          {/* 제출 버튼 */}
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingImage || !title.trim()}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all duration-200 text-sm sm:text-base touch-manipulation"
            >
              {isSubmitting || isUploadingImage ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  {isUploadingImage 
                    ? (lang === 'ko' ? '이미지 업로드 중...' : 'Uploading image...')
                    : (lang === 'ko' ? '생성 중...' : 'Creating...')}
                </>
              ) : (
                <>
                  <i className="ri-check-line mr-2"></i>
                  {lang === 'ko' ? '다음: 카드 추가하기' : 'Next: Add Cards'}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <p className="text-xs sm:text-sm text-slate-400">
            <i className="ri-information-line mr-2"></i>
            {lang === 'ko' 
              ? '세트를 생성한 후 카드를 추가할 수 있습니다. 각 카드에 이미지와 정답을 설정하세요.'
              : 'After creating the set, you can add cards. Set images and answers for each card.'}
          </p>
        </div>
      </div>
    </div>
  );
}

