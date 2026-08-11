'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { QuizType, SINGLE_PLAYER_PROBLEM_TYPES } from '@/lib/types/quiz';
import QuizTypeSelector from '@/components/quiz/QuizTypeSelector';
import QuizFormSoup from '@/components/quiz/QuizFormSoup';
import QuizFormNonsense from '@/components/quiz/QuizFormNonsense';
import QuizFormMCQ from '@/components/quiz/QuizFormMCQ';
import QuizFormOX from '@/components/quiz/QuizFormOX';
import QuizFormImage from '@/components/quiz/QuizFormImage';
import QuizFormLogic from '@/components/quiz/QuizFormLogic';
import QuizFormFillBlank from '@/components/quiz/QuizFormFillBlank';
import { convertImageToSvgFile } from '@/lib/utils/imageToSvg';
import { triggerEvent } from '@/lib/progress-client';

export default function CreateProblem({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
  const router = useRouter();
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const [quizType, setQuizType] = useState<QuizType | null>('soup'); // 항상 soup
  
  // Soup 타입용
  const [content, setContent] = useState(''); // story
  const [answer, setAnswer] = useState(''); // truth
  const [hints, setHints] = useState<string[]>(['', '', '']); // 최대 3개
  const [originalAuthor, setOriginalAuthor] = useState(''); // 원작자 (선택사항)
  
  // Nonsense 타입용
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  
  // MCQ/OX 타입용
  const [options, setOptions] = useState<string[]>(['', '', '', '']); // 4지선다
  const [correctOption, setCorrectOption] = useState<number>(0); // MCQ 정답 인덱스
  const [correctOX, setCorrectOX] = useState<'O' | 'X'>('O'); // OX 정답
  
  // Image 타입용
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  
  // Balance 타입용
  const [balanceOptions, setBalanceOptions] = useState<string[]>(['', '']);
  
  // Logic 타입용
  const [logicContent, setLogicContent] = useState('');
  
  // FillBlank 타입용
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSoupForm, setShowSoupForm] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [loadingPageIndex, setLoadingPageIndex] = useState(0);

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

  // 제출 중 로딩 멘트 로테이션
  useEffect(() => {
    if (!isSubmitting) return;
    const id = setInterval(() => setLoadingMessageIndex((i) => (i + 1) % 6), 2500);
    return () => clearInterval(id);
  }, [isSubmitting]);

  // 초기 로딩 시 멘트 로테이션
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setLoadingPageIndex((i) => (i + 1) % 3), 2500);
    return () => clearInterval(id);
  }, [isLoading]);

  const handleSubmit = async () => {
    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!quizType) {
      alert(lang === 'ko' ? '퀴즈 유형을 선택해주세요.' : 'Please select a quiz type.');
      return;
    }

    // 유형별 필수 항목 검증
    if (!title.trim()) {
      alert(lang === 'ko' ? '제목을 입력해주세요.' : 'Please enter a title.');
      return;
    }

    if (quizType === 'soup') {
      if (!content.trim() || !answer.trim()) {
        alert(lang === 'ko' ? '모든 필수 항목을 입력해주세요.' : 'Please fill in all required fields.');
        return;
      }
    } else if (quizType === 'nonsense') {
      if (!answer.trim()) {
        alert(lang === 'ko' ? '정답을 입력해주세요.' : 'Please enter answer.');
        return;
      }
    } else if (quizType === 'mcq') {
      if (options.some(opt => !opt.trim())) {
        alert(lang === 'ko' ? '모든 선택지를 입력해주세요.' : 'Please enter all options.');
        return;
      }
    } else if (quizType === 'ox') {
      // OX 퀴즈는 질문 없이 제목만 사용
    } else if (quizType === 'image') {
      if (!imageFile && !imageUrl) {
        alert(lang === 'ko' ? '이미지를 업로드해주세요.' : 'Please upload an image.');
        return;
      }
      if (!answer.trim()) {
        alert(lang === 'ko' ? '정답을 입력해주세요.' : 'Please enter an answer.');
        return;
      }
    } else if (quizType === 'balance') {
      if (balanceOptions.some(opt => !opt.trim())) {
        alert(lang === 'ko' ? '모든 선택지를 입력해주세요.' : 'Please enter all options.');
        return;
      }
    } else if (quizType === 'logic') {
      if (!logicContent.trim() || !answer.trim()) {
        alert(lang === 'ko' ? '내용과 정답을 모두 입력해주세요.' : 'Please enter content and answer.');
        return;
      }
    } else if (quizType === 'fill_blank') {
      if (!fillBlankAnswer.trim()) {
        alert(lang === 'ko' ? '정답을 입력해주세요.' : 'Please enter answer.');
        return;
      }
    }

    if (!isSupabaseConfigured()) {
      alert(lang === 'ko' ? 'Supabase가 설정되지 않았습니다.' : 'Supabase is not configured.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Supabase 클라이언트 생성 (이미 로그인된 user 사용)
      const supabaseClient = createClient();
      
      // users 테이블에서 nickname 가져오기
      const { data: userData } = await supabaseClient
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      
      const authorName = userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User');
      
      // 퀴즈 타입별 콘텐츠 데이터 준비
      let quizContent: any = {};
      
      if (quizType === 'soup') {
        // 힌트 필터링 (빈 문자열 제거, 최대 3개)
        const validHints = hints.filter(h => h && h.trim()).slice(0, 3);
        quizContent = {
          story: content.trim(),
          answer: answer.trim(),
          hints: validHints.length > 0 ? validHints : undefined,
        };
      } else if (quizType === 'nonsense') {
        quizContent = {
          answer: answer.trim(),
          explanation: explanation.trim() || undefined,
        };
      } else if (quizType === 'mcq') {
        quizContent = {
          options: options.map(opt => opt.trim()),
          correct: correctOption,
          explanation: explanation.trim() || undefined,
        };
      } else if (quizType === 'ox') {
        quizContent = {
          correct: correctOX === 'O' ? 0 : 1, // O=0, X=1
          explanation: explanation.trim() || undefined,
        };
      } else if (quizType === 'balance') {
        quizContent = {
          question: question.trim() || undefined, // 설명 (선택사항)
          options: balanceOptions.map(opt => opt.trim()).filter(opt => opt),
        };
      }
      
      // 태그는 항상 "바다거북 스프"만
      const getTagsFromQuizType = (type: QuizType): string[] => {
        return ['바다거북 스프'];
      };
      
      // problems 테이블에 퀴즈 기본 정보 저장
      const insertData: any = {
        title: title.trim(),
        type: 'soup', // 항상 'soup'로 설정 (게임 유형은 tags로 구분)
        user_id: user.id,
        author: authorName, // 작성자 이름 추가
        status: 'published',
        difficulty: 'medium', // 중간 난이도 (TEXT 타입: 'easy', 'medium', 'hard')
        tags: getTagsFromQuizType(quizType), // 게임 유형에 맞는 태그 자동 추가
        lang: currentLang,
      };
      
      // 원작자가 있는 경우 추가 (soup 타입만)
      if (quizType === 'soup' && originalAuthor.trim()) {
        insertData.original_author = originalAuthor.trim();
      }
      
      // soup 타입은 기존 방식 유지 (하위 호환성)
      if (quizType === 'soup') {
        insertData.content = content.trim();
        insertData.answer = answer.trim();
        // 바다거북스프는 썸네일 없음
        const validHints = hints.filter(h => h && h.trim()).slice(0, 3);
        if (validHints.length > 0) {
          insertData.hints = validHints;
        }
        if (explanation.trim()) {
          insertData.explanation = explanation.trim();
        }
      } else if (quizType === 'balance') {
        // 밸런스 게임은 content 필드가 필수이므로 title을 content로 사용
        insertData.content = title.trim();
        insertData.answer = ''; // answer는 필수이므로 빈 문자열
      } else {
        // 다른 타입들도 content가 필수인 경우 처리
        // 질문 필드가 없는 타입들은 title을 content로 사용
        const questionTypesWithoutQuestion = ['nonsense', 'mcq', 'ox', 'image', 'logic', 'fill_blank'];
        if (questionTypesWithoutQuestion.includes(quizType)) {
          insertData.content = title.trim() || '';
        } else {
          insertData.content = question.trim() || title.trim() || '';
        }
        insertData.answer = answer?.trim() || '';
      }
      
      console.log('Insert 데이터 준비 완료:', { 
        titleLength: insertData.title?.length || 0,
        contentLength: insertData.content?.length || 0,
        answerLength: insertData.answer?.length || 0,
        userId: insertData.user_id,
        quizType: insertData.type
      });
      
      const { data: problem, error } = await supabaseClient
        .from('problems')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('문제 생성 DB 오류:', error);
        console.error('에러 코드:', error.code);
        console.error('에러 메시지:', error.message);
        console.error('에러 상세:', error.details);
        console.error('에러 힌트:', error.hint);
        throw error;
      }

      if (!problem) {
        throw new Error('문제가 생성되지 않았습니다.');
      }

      // 이미지 업로드 성공 여부 추적 (썸네일 URL = problems.image_url 업데이트용)
      let imageUploadFailed = false;
      let bucketNotFound = false;
      let uploadedThumbnailUrl: string | null = null;

      // 이미지 파일이 있으면 SVG로 변환 후 Supabase Storage에 업로드
      if (imageFile) {
        try {
          // 이미지를 SVG로 변환
          const svgFile = await convertImageToSvgFile(imageFile);
          const fileName = `${problem.id}_${Date.now()}.svg`;
          const filePath = `quiz-images/${fileName}`;

          const { error: uploadError } = await supabaseClient.storage
            .from('quiz-images')
            .upload(filePath, svgFile);

          if (uploadError) {
            console.error('이미지 업로드 오류:', uploadError);
            imageUploadFailed = true;
            
            // 버킷이 없는 경우 특별 처리
            if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket') || uploadError.message?.includes('does not exist')) {
              bucketNotFound = true;
              console.warn('⚠️ quiz-images 버킷이 없습니다. Supabase 대시보드에서 Storage > Buckets에서 "quiz-images" 버킷을 생성해주세요.');
            } else {
              // 다른 업로드 오류는 원본 파일로 재시도
              try {
                const fileExt = imageFile.name.split('.').pop();
                const fileNameOriginal = `${problem.id}_${Date.now()}.${fileExt}`;
                const filePathOriginal = `quiz-images/${fileNameOriginal}`;

                const { error: retryError } = await supabaseClient.storage
                  .from('quiz-images')
                  .upload(filePathOriginal, imageFile);

                if (!retryError) {
                  const { data: { publicUrl } } = supabaseClient.storage
                    .from('quiz-images')
                    .getPublicUrl(filePathOriginal);
                  
                  if (publicUrl) {
                    uploadedThumbnailUrl = publicUrl;
                    if (quizContent.image_url) {
                      quizContent.image_url = publicUrl;
                    } else if (quizType === 'image') {
                      quizContent.image_url = publicUrl;
                    }
                  }
                }
              } catch (retryError) {
                console.error('이미지 재업로드 오류:', retryError);
              }
            }
          } else {
            // 업로드 성공
            const { data: { publicUrl } } = supabaseClient.storage
              .from('quiz-images')
              .getPublicUrl(filePath);
            
            if (publicUrl) {
              uploadedThumbnailUrl = publicUrl;
              if (quizContent.image_url) {
                quizContent.image_url = publicUrl;
              } else if (quizType === 'image') {
                quizContent.image_url = publicUrl;
              }
            }
          }
        } catch (error: any) {
          console.error('이미지 SVG 변환 오류:', error);
          
          // SVG 변환 실패 시 원본 파일로 업로드 시도
          try {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${problem.id}_${Date.now()}.${fileExt}`;
            const filePath = `quiz-images/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
              .from('quiz-images')
              .upload(filePath, imageFile);

            if (uploadError) {
              imageUploadFailed = true;
              if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket') || uploadError.message?.includes('does not exist')) {
                bucketNotFound = true;
                console.warn('⚠️ quiz-images 버킷이 없습니다. Supabase 대시보드에서 Storage > Buckets에서 "quiz-images" 버킷을 생성해주세요.');
              } else {
                console.error('이미지 업로드 오류:', uploadError);
              }
            } else {
              const { data: { publicUrl } } = supabaseClient.storage
                .from('quiz-images')
                .getPublicUrl(filePath);
              
              if (publicUrl) {
                uploadedThumbnailUrl = publicUrl;
                if (quizContent.image_url) {
                  quizContent.image_url = publicUrl;
                } else if (quizType === 'image') {
                  quizContent.image_url = publicUrl;
                }
              }
            }
          } catch (retryError) {
            console.error('이미지 재업로드 오류:', retryError);
          }
        }
      }

      // quiz_contents 테이블에 타입별 세부 데이터 저장
      if (quizType !== 'soup' || Object.keys(quizContent).length > 0) {
        const { error: contentError } = await supabaseClient
          .from('quiz_contents')
          .insert({
            quiz_id: problem.id,
            content: quizContent,
          });

        if (contentError) {
          console.error('퀴즈 콘텐츠 저장 오류:', contentError);
          // quiz_contents 저장 실패는 무시 (하위 호환성)
        }
      }

      // 문제 생성 시 10 XP 지급
      try {
        await triggerEvent(null, null, user.id, 'create_problem', {});
      } catch (xpError) {
        // XP 지급 실패는 무시 (문제 생성은 성공)
        console.warn('XP 지급 오류:', xpError);
      }

      setIsSubmitting(false);
      
      // 버킷이 없어서 이미지 업로드가 실패한 경우 사용자에게 안내
      if (imageFile && bucketNotFound) {
        alert(
          lang === 'ko' 
            ? '✅ 문제는 성공적으로 생성되었습니다!\n\n⚠️ 하지만 이미지를 업로드할 수 없었습니다.\n\n📦 Supabase 대시보드에서 다음을 수행해주세요:\n1. Storage 메뉴로 이동\n2. Buckets 탭 클릭\n3. "New bucket" 버튼 클릭\n4. 이름: quiz-images\n5. Public bucket: 체크 ✅\n6. File size limit: 5MB (선택사항)\n7. Create 버튼 클릭\n\n버킷을 생성한 후 다시 이미지를 업로드해주세요!'
            : '✅ Problem created successfully!\n\n⚠️ However, image upload failed.\n\n📦 Please create a storage bucket in Supabase Dashboard:\n1. Go to Storage menu\n2. Click Buckets tab\n3. Click "New bucket"\n4. Name: quiz-images\n5. Check "Public bucket" ✅\n6. File size limit: 5MB (optional)\n7. Click Create\n\nAfter creating the bucket, you can upload images!'
        );
      }
      
      router.push(`/${lang}/problem/${problem.id}`);
    } catch (error: any) {
      console.error('문제 생성 오류:', error);
      console.error('오류 타입:', typeof error);
      console.error('오류 이름:', error?.name);
      console.error('오류 메시지:', error?.message);
      console.error('오류 코드:', error?.code);
      console.error('오류 상세:', JSON.stringify(error, null, 2));
      
      // AbortError는 무해한 에러이므로 무시 (단, 실제 DB 에러는 아님)
      // 하지만 DB 에러 코드가 있으면 실제 에러로 처리
      const isAbortError = (error?.name === 'AbortError' || 
                           (error?.message && error.message.includes('aborted')) ||
                           (error?.details && error.details.includes('aborted'))) &&
                           !error?.code && !error?.hint;
      
      if (isAbortError) {
        // AbortError이면서 DB 에러 코드가 없는 경우만 무시
        console.warn('AbortError 무시 (무해한 에러)');
        setIsSubmitting(false);
        return;
      }
      
      let errorMessage = '문제 생성에 실패했습니다.';
      
      // 에러 메시지가 있으면 표시
      if (error?.message) {
        errorMessage += `\n\n${error.message}`;
      }
      
      // PostgreSQL 에러 코드 처리
      if (error?.code) {
        if (error.code === '23502') {
          errorMessage = '필수 필드가 누락되었습니다. 데이터베이스 스키마를 확인해주세요.';
        } else if (error.code === '23503') {
          errorMessage = '참조 오류가 발생했습니다. 로그인 상태를 확인해주세요.';
        } else if (error.code === 'PGRST116') {
          errorMessage = '문제가 생성되지 않았습니다.';
        } else if (error.code === '42501') {
          errorMessage = '권한이 없습니다. 로그인 상태를 확인해주세요.';
        } else {
          errorMessage += `\n\n오류 코드: ${error.code}`;
        }
      }
      
      // 에러 힌트가 있으면 표시
      if (error?.hint) {
        errorMessage += `\n\n힌트: ${error.hint}`;
      }
      
      alert(errorMessage);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    const pageMsg = (t.problem as any)?.[`loadingPageMessage${(loadingPageIndex % 3) + 1}`] ?? t.common.loading;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.common.loading}</p>
          <p className="text-slate-500 text-sm mt-2">{pageMsg}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-3xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {lang === 'ko' ? '문제 만들기' : 'Create Problem'}
          </h1>
        </div>

        {/* 고전 퍼즐 안내 */}
        <div className="mb-4 sm:mb-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-xs sm:text-sm text-slate-200 space-y-2">
          <p className="font-semibold text-slate-100">
            {lang === 'ko'
              ? '고전 바다거북스프·논리 퍼즐 운영 원칙'
              : 'Classic Turtle Soup / Logic Puzzle Policy'}
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300">
            <li>
              {lang === 'ko'
                ? '아이디어·사고 구조 중심의 퍼즐은 저작권 침해가 아니며, 특정 문장을 그대로 복제하지 않는 한 문제가 없습니다.'
                : 'Idea/logic-based puzzles are not copyright infringement unless you copy exact wording.'}
            </li>
            <li>
              {lang === 'ko'
                ? '대부분의 고전 퍼즐은 원작자를 특정할 수 없으므로 개인 원작자 표기는 하지 않습니다.'
                : 'Most classic puzzles have no verifiable single author, so we do not name individuals.'}
            </li>
            <li>
              {lang === 'ko'
                ? '출처 표기 예시: Classic Turtle Soup (Public Domain), Classic Logic Puzzle (Unknown)'
                : 'Source examples: Classic Turtle Soup (Public Domain), Classic Logic Puzzle (Unknown)'}
            </li>
            <li>
              {lang === 'ko'
                ? '신뢰 가능한 집합 출처만 사용: 위키백과 등'
                : 'Use only reputable aggregate sources (e.g., Wikipedia).'}
            </li>
            <li className="text-slate-200 font-medium">
              {lang === 'ko'
                ? '본 플랫폼의 일부 문제는 전 세계적으로 공유되어 온 고전 바다거북스프 및 논리 퍼즐을 바탕으로 재구성되었습니다.'
                : 'Some puzzles here are reconstructed from globally shared classic Turtle Soup and logic puzzles.'}
            </li>
            <li className="text-slate-200 font-medium">
              {lang === 'ko'
                ? '본 플랫폼의 퍼즐 콘텐츠는 저작권상 명확한 법적 문제 없이 운영 가능하며, 윤리적 투명성을 위해 “고전 퍼즐 기반”임을 명시하는 방식을 채택합니다.'
                : 'Our puzzles are operated without copyright issues; we state they are “classic puzzle-based” for transparency.'}
            </li>
          </ul>
        </div>

        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          {/* 바다거북 스프 만들기 버튼 */}
          {!showSoupForm && (
            <div className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
                    {lang === 'ko' ? '🥣 바다거북 스프 게임 만들기' : '🥣 Create Turtle Soup Game'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    {lang === 'ko' 
                      ? 'Yes/No 질문으로 진실을 추리하는 게임을 만들어보세요'
                      : 'Create a game where players guess the truth with Yes/No questions'}
                  </p>
                </div>
                <button
                  onClick={() => setShowSoupForm(true)}
                  className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all duration-200 touch-manipulation whitespace-nowrap"
                >
                  {lang === 'ko' ? '만들기' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* 바다거북 스프 폼 */}
          {showSoupForm && (
            <>
              {/* 제목 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '제목' : 'Title'}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={lang === 'ko' ? '문제 제목을 입력하세요' : 'Enter problem title'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm sm:text-base"
                  maxLength={100}
                />
              </div>

              {/* 바다거북 스프 폼 */}
              <QuizFormSoup
                story={content}
                truth={answer}
                hints={hints}
                explanation={explanation}
                originalAuthor={originalAuthor}
                onStoryChange={setContent}
                onTruthChange={setAnswer}
                onHintsChange={setHints}
                onExplanationChange={setExplanation}
                onOriginalAuthorChange={setOriginalAuthor}
                lang={currentLang}
              />

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 mt-4 sm:mt-6 lg:mt-8 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
              >
                <i className={isSubmitting ? 'ri-loader-4-line animate-spin mr-2' : 'ri-add-circle-line mr-2'}></i>
                {isSubmitting
                  ? ((t.problem as any)?.[`createLoadingMessage${(loadingMessageIndex % 6) + 1}`] ?? (lang === 'ko' ? '문제 생성 중...' : 'Creating...'))
                  : (lang === 'ko' ? '문제 만들기' : 'Create Problem')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
