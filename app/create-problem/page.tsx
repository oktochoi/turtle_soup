'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function CreateProblem() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      alert('로그인이 필요합니다.');
      router.push('/auth/login');
      return;
    }
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, authLoading, router]);

  const handleSubmit = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      router.push('/auth/login');
      return;
    }

    if (!title.trim() || !content.trim() || !answer.trim()) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (!isSupabaseConfigured()) {
      alert('Supabase가 설정되지 않았습니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Supabase 클라이언트 생성 (이미 로그인된 user 사용)
      const supabaseClient = createClient();
      
      console.log('문제 생성 시작...', { 
        titleLength: title.trim().length, 
        contentLength: content.trim().length, 
        answerLength: answer.trim().length,
        userId: user.id 
      });
      
      // author 필드 자동 설정 (user_id 기반 또는 이메일)
      const authorName = user.email?.split('@')[0] || user.id.substring(0, 8) || '사용자';
      
      const insertData = {
        title: title.trim(),
        content: content.trim(),
        answer: answer.trim(),
        difficulty: 'medium' as const,
        tags: [] as string[],
        author: authorName,
        user_id: user.id,
      };
      
      console.log('Insert 데이터 준비 완료:', { 
        titleLength: insertData.title.length,
        contentLength: insertData.content.length,
        answerLength: insertData.answer.length,
        userId: insertData.user_id
      });
      
      console.log('Supabase insert 요청 시작...');
      console.log('Content 필드 길이:', insertData.content.length, '자');
      console.log('Content 필드 첫 100자:', insertData.content.substring(0, 100));
      
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

      setIsSubmitting(false);
      router.push(`/problem/${problem.id}`);
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
          <p className="text-slate-400">로딩 중...</p>
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
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              돌아가기
            </button>
          </Link>
        </div>

        <div className="text-center mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            문제 만들기
          </h1>
        </div>

        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          {/* 제목 */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문제 제목을 입력하세요"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm sm:text-base"
              maxLength={100}
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              내용
            </label>
            <p className="text-xs text-slate-400 mb-2">문제의 배경과 상황을 자세히 설명해주세요.</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문제의 배경과 상황을 자세히 설명해주세요."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 sm:h-40 resize-none text-sm sm:text-base"
              maxLength={2000}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {content.length} / 2000
            </div>
          </div>

          {/* 정답 */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              정답
            </label>
            <p className="text-xs text-slate-400 mb-2">문제의 정답과 해설을 작성해주세요.</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="문제의 정답과 해설을 작성해주세요."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 sm:h-40 resize-none text-sm sm:text-base"
              maxLength={2000}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {answer.length} / 2000
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 mt-4 sm:mt-6 lg:mt-8 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
          >
            <i className="ri-add-circle-line mr-2"></i>
            {isSubmitting ? '문제 생성 중...' : '문제 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
