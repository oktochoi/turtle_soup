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
import QuizFormBalance from '@/components/quiz/QuizFormBalance';
import QuizFormLogic from '@/components/quiz/QuizFormLogic';
import QuizFormPattern from '@/components/quiz/QuizFormPattern';
import QuizFormFillBlank from '@/components/quiz/QuizFormFillBlank';
import QuizFormOrder from '@/components/quiz/QuizFormOrder';

export default function CreateProblem({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
  const router = useRouter();
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const [quizType, setQuizType] = useState<QuizType | null>('soup'); // 기본값: soup
  
  // Soup 타입용
  const [content, setContent] = useState(''); // story
  const [answer, setAnswer] = useState(''); // truth
  const [hints, setHints] = useState<string[]>(['', '', '']); // 최대 3개
  
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
  
  // Logic/Pattern 타입용
  const [logicContent, setLogicContent] = useState('');
  
  // FillBlank 타입용
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  
  // Order 타입용
  const [orderItems, setOrderItems] = useState<string[]>(['', '']);
  const [orderSequence, setOrderSequence] = useState<number[]>([]);
  
  const [title, setTitle] = useState('');
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
      if (!question.trim() || !answer.trim()) {
        alert(lang === 'ko' ? '질문과 정답을 입력해주세요.' : 'Please enter question and answer.');
        return;
      }
    } else if (quizType === 'mcq') {
      if (!question.trim() || options.some(opt => !opt.trim())) {
        alert(lang === 'ko' ? '질문과 모든 선택지를 입력해주세요.' : 'Please enter question and all options.');
        return;
      }
    } else if (quizType === 'ox') {
      if (!question.trim()) {
        alert(lang === 'ko' ? '질문을 입력해주세요.' : 'Please enter a question.');
        return;
      }
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
    } else if (quizType === 'logic' || quizType === 'pattern') {
      if (!question.trim() || !logicContent.trim() || !answer.trim()) {
        alert(lang === 'ko' ? '질문, 내용, 정답을 모두 입력해주세요.' : 'Please enter question, content, and answer.');
        return;
      }
    } else if (quizType === 'fill_blank') {
      if (!question.trim() || !fillBlankAnswer.trim()) {
        alert(lang === 'ko' ? '질문과 정답을 입력해주세요.' : 'Please enter question and answer.');
        return;
      }
    } else if (quizType === 'order') {
      if (!question.trim() || orderItems.length < 2 || orderItems.some(item => !item.trim())) {
        alert(lang === 'ko' ? '질문과 최소 2개의 항목을 입력해주세요.' : 'Please enter question and at least 2 items.');
        return;
      }
      if (orderSequence.length !== orderItems.length) {
        alert(lang === 'ko' ? '모든 항목의 순서를 입력해주세요.' : 'Please enter order for all items.');
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
          question: question.trim(),
          answer: answer.trim(),
          explanation: explanation.trim() || undefined,
        };
      } else if (quizType === 'mcq') {
        quizContent = {
          question: question.trim(),
          options: options.map(opt => opt.trim()),
          correct: correctOption,
          explanation: explanation.trim() || undefined,
        };
      } else if (quizType === 'ox') {
        quizContent = {
          question: question.trim(),
          correct: correctOX === 'O' ? 0 : 1, // O=0, X=1
          explanation: explanation.trim() || undefined,
        };
      } else if (quizType === 'balance') {
        quizContent = {
          question: question.trim() || undefined, // 설명 (선택사항)
          options: balanceOptions.map(opt => opt.trim()).filter(opt => opt),
        };
      }
      
      // problems 테이블에 퀴즈 기본 정보 저장
      const insertData: any = {
        title: title.trim(),
        type: quizType, // 퀴즈 타입 추가
        user_id: user.id,
        author: authorName, // 작성자 이름 추가
        status: 'published',
        difficulty: 'medium', // 중간 난이도 (TEXT 타입: 'easy', 'medium', 'hard')
        tags: [],
        lang: currentLang,
      };
      
      // soup 타입은 기존 방식 유지 (하위 호환성)
      if (quizType === 'soup') {
        insertData.content = content.trim();
        insertData.answer = answer.trim();
        const validHints = hints.filter(h => h && h.trim()).slice(0, 3);
        if (validHints.length > 0) {
          insertData.hints = validHints;
        }
      } else if (quizType === 'balance') {
        // 밸런스 게임은 content 필드가 필수이므로 title을 content로 사용
        insertData.content = title.trim();
        insertData.answer = ''; // answer는 필수이므로 빈 문자열
      } else {
        // 다른 타입들도 content가 필수인 경우 처리
        insertData.content = question.trim() || title.trim() || '';
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

      // 이미지 파일이 있으면 Supabase Storage에 업로드
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${problem.id}_${Date.now()}.${fileExt}`;
        const filePath = `quiz-images/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('quiz-images')
          .upload(filePath, imageFile);

        if (uploadError) {
          console.error('이미지 업로드 오류:', uploadError);
          // 이미지 업로드 실패는 무시 (URL로 대체 가능)
        } else {
          // 업로드된 이미지 URL 가져오기
          const { data: { publicUrl } } = supabaseClient.storage
            .from('quiz-images')
            .getPublicUrl(filePath);
          
          if (publicUrl) {
            // quizContent에 이미지 URL 업데이트
            if (quizContent.image_url) {
              quizContent.image_url = publicUrl;
            } else if (quizType === 'image') {
              quizContent.image_url = publicUrl;
            }
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

      setIsSubmitting(false);
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

        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          {/* 퀴즈 유형 선택 */}
          <div>
            <QuizTypeSelector
              selectedType={quizType}
              onSelect={setQuizType}
              lang={currentLang}
              disabled={isSubmitting}
            />
          </div>

          {/* 제목 (모든 유형 공통, 밸런스 게임은 "문제") */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? (quizType === 'balance' ? '문제' : '제목') : (quizType === 'balance' ? 'Question' : 'Title')}
              <span className="text-red-400 ml-1">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'ko' ? (quizType === 'balance' ? '문제를 입력하세요' : '문제 제목을 입력하세요') : (quizType === 'balance' ? 'Enter question' : 'Enter problem title')}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm sm:text-base"
              maxLength={100}
            />
          </div>

          {/* 유형별 폼 */}
          {quizType === 'soup' && (
            <QuizFormSoup
              story={content}
              truth={answer}
              hints={hints}
              onStoryChange={setContent}
              onTruthChange={setAnswer}
              onHintsChange={setHints}
              lang={currentLang}
            />
          )}

          {quizType === 'nonsense' && (
            <QuizFormNonsense
              question={question}
              answer={answer}
              explanation={explanation}
              onQuestionChange={setQuestion}
              onAnswerChange={setAnswer}
              onExplanationChange={setExplanation}
              lang={currentLang}
            />
          )}

          {quizType === 'mcq' && (
            <QuizFormMCQ
              question={question}
              options={options}
              correct={correctOption}
              explanation={explanation}
              onQuestionChange={setQuestion}
              onOptionsChange={setOptions}
              onCorrectChange={setCorrectOption}
              onExplanationChange={setExplanation}
              lang={currentLang}
            />
          )}

          {quizType === 'ox' && (
            <QuizFormOX
              question={question}
              correct={correctOX}
              explanation={explanation}
              onQuestionChange={setQuestion}
              onCorrectChange={setCorrectOX}
              onExplanationChange={setExplanation}
              lang={currentLang}
            />
          )}

          {quizType === 'image' && (
            <QuizFormImage
              question={question}
              answer={answer}
              explanation={explanation}
              imageUrl={imageUrl}
              onQuestionChange={setQuestion}
              onAnswerChange={setAnswer}
              onExplanationChange={setExplanation}
              onImageChange={setImageFile}
              onImageUrlChange={setImageUrl}
              lang={currentLang}
            />
          )}

          {quizType === 'balance' && (
            <QuizFormBalance
              question={question}
              options={balanceOptions}
              imageUrl={imageUrl}
              onQuestionChange={setQuestion}
              onOptionsChange={setBalanceOptions}
              onImageChange={setImageFile}
              onImageUrlChange={setImageUrl}
              lang={currentLang}
            />
          )}

          {quizType === 'logic' && (
            <QuizFormLogic
              question={question}
              content={logicContent}
              answer={answer}
              explanation={explanation}
              imageUrl={imageUrl}
              onQuestionChange={setQuestion}
              onContentChange={setLogicContent}
              onAnswerChange={setAnswer}
              onExplanationChange={setExplanation}
              onImageChange={setImageFile}
              onImageUrlChange={setImageUrl}
              lang={currentLang}
            />
          )}

          {quizType === 'pattern' && (
            <QuizFormPattern
              question={question}
              pattern={logicContent}
              answer={answer}
              explanation={explanation}
              imageUrl={imageUrl}
              onQuestionChange={setQuestion}
              onPatternChange={setLogicContent}
              onAnswerChange={setAnswer}
              onExplanationChange={setExplanation}
              onImageChange={setImageFile}
              onImageUrlChange={setImageUrl}
              lang={currentLang}
            />
          )}

          {quizType === 'fill_blank' && (
            <QuizFormFillBlank
              question={question}
              answer={fillBlankAnswer}
              explanation={explanation}
              imageUrl={imageUrl}
              onQuestionChange={setQuestion}
              onAnswerChange={setFillBlankAnswer}
              onExplanationChange={setExplanation}
              onImageChange={setImageFile}
              lang={currentLang}
            />
          )}

          {quizType === 'order' && (
            <QuizFormOrder
              question={question}
              items={orderItems}
              correctOrder={orderSequence}
              explanation={explanation}
              imageUrl={imageUrl}
              onQuestionChange={setQuestion}
              onItemsChange={setOrderItems}
              onCorrectOrderChange={setOrderSequence}
              onExplanationChange={setExplanation}
              onImageChange={setImageFile}
              lang={currentLang}
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 mt-4 sm:mt-6 lg:mt-8 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
          >
            <i className="ri-add-circle-line mr-2"></i>
            {isSubmitting ? (lang === 'ko' ? '문제 생성 중...' : 'Creating...') : (lang === 'ko' ? '문제 만들기' : 'Create Problem')}
          </button>
        </div>
      </div>
    </div>
  );
}
