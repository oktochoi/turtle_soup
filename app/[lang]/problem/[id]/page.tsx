'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import type { Problem, ProblemQuestion, ProblemComment } from '@/lib/types';
import { buildProblemKnowledge, analyzeQuestionV8, calculateAnswerSimilarity, initializeModel, type ProblemKnowledge } from '@/lib/ai-analyzer';
import { buildProblemKnowledge as buildProblemKnowledgeEn, analyzeQuestionV8 as analyzeQuestionV8En, calculateAnswerSimilarityEn, initializeModel as initializeModelEn, type ProblemKnowledge as ProblemKnowledgeEn } from '@/lib/ai-analyzer-en';
import ProblemAdminButtons from './ProblemAdminButtons';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';
import { createNotification } from '@/lib/notifications';
import { checkIfLearnedError } from '@/lib/check-learned-error';
import JsonLd from '@/components/JsonLd';
import NativeAd from '@/app/components/NativeAd';

export default function ProblemPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const problemId = resolvedParams.id;
  const router = useRouter();
  const t = useTranslations();

  // Toast 헬퍼 함수
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (typeof window !== 'undefined' && (window as any)[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`]) {
      (window as any)[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`](message);
    } else {
      alert(message);
    }
  };

  const [problem, setProblem] = useState<Problem | null>(null);
  const [questions, setQuestions] = useState<ProblemQuestion[]>([]);
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedAnswer, setSuggestedAnswer] = useState<'yes' | 'no' | 'irrelevant' | 'decisive' | null>(null);
  const [localQuestions, setLocalQuestions] = useState<Array<{ question: string; answer: string; timestamp: number }>>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [userGuess, setUserGuess] = useState('');
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [isCalculatingSimilarity, setIsCalculatingSimilarity] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const { user } = useAuth();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentIsSpoiler, setEditCommentIsSpoiler] = useState(false);
  const [problemKnowledge, setProblemKnowledge] = useState<ProblemKnowledge | ProblemKnowledgeEn | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [authorGameUserId, setAuthorGameUserId] = useState<string | null>(null);
  const [commentGameUserIds, setCommentGameUserIds] = useState<Map<string, string>>(new Map());
  const [showHints, setShowHints] = useState<boolean[]>([false, false, false]); // 힌트 1, 2, 3 표시 여부
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [nextProblem, setNextProblem] = useState<Problem | null>(null);
  const [previousProblem, setPreviousProblem] = useState<Problem | null>(null);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [bugReportType, setBugReportType] = useState<'wrong_answer' | 'wrong_yes_no' | 'wrong_irrelevant' | 'wrong_similarity' | 'other'>('wrong_yes_no');
  const [bugReportExpected, setBugReportExpected] = useState('');
  const [bugReportQuestion, setBugReportQuestion] = useState<string | null>(null);
  const [bugReportAnswer, setBugReportAnswer] = useState<string | null>(null);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const loadNextProblem = async () => {
    if (!problem) {
      console.log('loadNextProblem: problem이 없습니다.');
      return;
    }
    try {
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      // int_id 기준으로 다음 문제 찾기
      const currentIntId = (problem as any).int_id;
      
      console.log('loadNextProblem:', { 
        problemId: problem.id, 
        currentIntId, 
        lang: currentLang,
        problemData: problem 
      });
      
      // int_id가 없으면 다음 문제도 없음
      if (currentIntId === null || currentIntId === undefined) {
        console.warn('현재 문제에 int_id가 없습니다. 다음 문제를 찾을 수 없습니다.', { problem });
        setNextProblem(null);
        return;
      }
      
      const { data: next, error } = await supabase
        .from('problems')
        .select('*')
        .eq('lang', currentLang)
        .gt('int_id', currentIntId)
        .order('int_id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('다음 문제 로드 오류:', error);
        setNextProblem(null);
        return;
      }
      
      console.log('loadNextProblem 결과:', { next, found: !!next });
      setNextProblem(next || null);
    } catch (error) {
      console.error('다음 문제 로드 오류:', error);
      setNextProblem(null);
    }
  };

  const loadPreviousProblem = async () => {
    if (!problem) {
      console.log('loadPreviousProblem: problem이 없습니다.');
      return;
    }
    try {
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      // int_id 기준으로 이전 문제 찾기
      const currentIntId = (problem as any).int_id;
      
      console.log('loadPreviousProblem:', { 
        problemId: problem.id, 
        currentIntId, 
        lang: currentLang,
        problemData: problem 
      });
      
      // int_id가 없거나 0이면 이전 문제 없음
      if (currentIntId === null || currentIntId === undefined || currentIntId <= 0) {
        console.log('현재 문제에 int_id가 없거나 첫 번째 문제입니다. 이전 문제를 찾을 수 없습니다.', { currentIntId });
        setPreviousProblem(null);
        return;
      }
      
      const { data: previous, error } = await supabase
        .from('problems')
        .select('*')
        .eq('lang', currentLang)
        .lt('int_id', currentIntId)
        .order('int_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('이전 문제 로드 오류:', error);
        setPreviousProblem(null);
        return;
      }
      
      console.log('loadPreviousProblem 결과:', { previous, found: !!previous });
      setPreviousProblem(previous || null);
    } catch (error) {
      console.error('이전 문제 로드 오류:', error);
      setPreviousProblem(null);
    }
  };

  const handlePreviousProblem = () => {
    if (previousProblem) {
      router.push(`/${lang}/problem/${previousProblem.id}`);
    }
  };

  const handleCreateRoomFromProblem = async () => {
    if (!problem) {
      if (typeof window !== 'undefined' && (window as any).toastError) {
        (window as any).toastError(lang === 'ko' ? '문제 정보를 불러올 수 없습니다.' : 'Cannot load problem information.');
      } else {
        alert(lang === 'ko' ? '문제 정보를 불러올 수 없습니다.' : 'Cannot load problem information.');
      }
      return;
    }

    // 로그인 체크
    if (!user) {
      if (typeof window !== 'undefined' && (window as any).toastWarning) {
        (window as any).toastWarning(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      } else {
        alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      }
      router.push(`/${lang}/auth/login`);
      return;
    }

    setIsCreatingRoom(true);
    try {
      // 닉네임 가져오기
      let nickname = '';
      if (user) {
        // users 테이블에서 nickname 가져오기
        const { data: userData } = await supabase
          .from('users')
          .select('nickname')
          .eq('id', user.id)
          .maybeSingle();
        
        const { data: gameUser } = await supabase
          .from('game_users')
          .select('nickname')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        nickname = userData?.nickname || gameUser?.nickname || `User${user.id.substring(0, 6)}`;
      } else {
        // 게스트인 경우 임시 닉네임
        nickname = lang === 'ko' ? `게스트${Math.random().toString(36).substring(2, 6)}` : `Guest${Math.random().toString(36).substring(2, 6)}`;
      }

      // 방 코드 생성
      let roomCode = generateRoomCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('rooms')
          .select('code')
          .eq('code', roomCode)
          .maybeSingle();
        
        if (!existing) break;
        roomCode = generateRoomCode();
        attempts++;
      }

      if (attempts >= 10) {
        throw new Error('방 코드 생성 실패');
      }

      // 방 생성 (문제 기반)
      const insertData: any = {
        code: roomCode,
        story: problem.content,
        truth: problem.answer,
        host_nickname: nickname,
        max_questions: 30,
        lang: lang === 'ko' || lang === 'en' ? lang : 'ko',
        hints: problem.hints || null,
      };

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert(insertData)
        .select()
        .single();

      if (roomError) {
        // lang 컬럼이 없을 수 있으므로 재시도
        if (roomError.code === '42703' || roomError.message?.includes('column') || roomError.message?.includes('lang')) {
          delete insertData.lang;
          const retryResult = await supabase
            .from('rooms')
            .insert(insertData)
            .select()
            .single();
          
          if (retryResult.error) throw retryResult.error;
          
          // 호스트를 players 테이블에 추가
          await supabase
            .from('players')
            .insert({
              room_code: roomCode,
              nickname: nickname,
              is_host: true,
            });

          // 이벤트 로깅
          if (typeof window !== 'undefined') {
            console.log('problem_cta_create_room_click', { problemId, roomCode });
          }

          router.push(`/${lang}/room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname)}`);
          return;
        }
        throw roomError;
      }

      // 호스트를 players 테이블에 추가
      await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: nickname,
          is_host: true,
        });

      // 이벤트 로깅
      if (typeof window !== 'undefined') {
        console.log('problem_cta_create_room_click', { problemId, roomCode });
      }

      router.push(`/${lang}/room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname)}`);
    } catch (error: any) {
      console.error('방 생성 오류:', error);
      if (typeof window !== 'undefined' && (window as any).toastError) {
        (window as any).toastError(lang === 'ko' ? '방 생성에 실패했습니다. 다시 시도해주세요.' : 'Failed to create room. Please try again.');
      } else {
        alert(lang === 'ko' ? '방 생성에 실패했습니다. 다시 시도해주세요.' : 'Failed to create room. Please try again.');
      }
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!problem) return;

    // 이벤트 로깅
    if (typeof window !== 'undefined') {
      console.log('problem_cta_invite_copy', { problemId });
    }

    const url = `${window.location.origin}/${lang}/problem/${problemId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      showToast(lang === 'ko' ? '링크가 복사되었습니다!' : 'Link copied!', 'success');
    } catch (error) {
      // 폴백: 텍스트 영역 사용
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast(lang === 'ko' ? '링크가 복사되었습니다!' : 'Link copied!', 'success');
      } catch (err) {
        showToast(lang === 'ko' ? '링크 복사에 실패했습니다. URL을 직접 복사해주세요.' : 'Failed to copy link. Please copy the URL manually.', 'error');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleNextProblem = () => {
    if (nextProblem) {
      // 이벤트 로깅
      if (typeof window !== 'undefined') {
        console.log('problem_cta_next_problem', { fromProblemId: problemId, toProblemId: nextProblem.id });
      }
      router.push(`/${lang}/problem/${nextProblem.id}`);
    } else {
      // 다음 문제가 없으면 문제 목록으로
      router.push(`/${lang}/problems`);
    }
  };

  const handleSubmitBugReport = async () => {
    if (!problem) return;

    // 질문과 답변이 있는지 확인 (AI 제안 답변이나 질문 내역에서 온 경우, 또는 유사도 오류인 경우)
    const question = bugReportQuestion || questionText;
    const answer = bugReportAnswer || suggestedAnswer;

    // 유사도 오류인 경우 질문/답변 없이도 가능
    if (bugReportType !== 'wrong_similarity' && (!question || !answer)) {
      if (typeof window !== 'undefined' && (window as any).toastWarning) {
        (window as any).toastWarning(lang === 'ko' ? '질문과 답변 정보가 필요합니다.' : 'Question and answer information is required.');
      } else {
        alert(lang === 'ko' ? '질문과 답변 정보가 필요합니다.' : 'Question and answer information is required.');
      }
      return;
    }

    // 기대한 답변 필수 검증
    if (!bugReportExpected || !bugReportExpected.trim()) {
      if (typeof window !== 'undefined' && (window as any).toastError) {
        (window as any).toastError(lang === 'ko' ? '기대한 답변을 입력해주세요.' : 'Please enter the expected answer.');
      } else {
        alert(lang === 'ko' ? '기대한 답변을 입력해주세요.' : 'Please enter the expected answer.');
      }
      return;
    }

    // 학습된 오류인지 확인
    const learnedErrorCheck = await checkIfLearnedError(
      question || '',
      answer || '',
      bugReportExpected.trim(),
      bugReportType,
      similarityScore !== null ? similarityScore : undefined
    );

    if (learnedErrorCheck.isLearnedError) {
      if (typeof window !== 'undefined' && (window as any).toastInfo) {
        (window as any).toastInfo(
          lang === 'ko' 
            ? '이 오류는 이미 학습되어 수정되었습니다. AI가 이제 올바르게 동작할 것입니다.'
            : 'This error has already been learned and fixed. The AI should now work correctly.'
        );
      } else {
        alert(lang === 'ko' 
          ? '이 오류는 이미 학습되어 수정되었습니다. AI가 이제 올바르게 동작할 것입니다.'
          : 'This error has already been learned and fixed. The AI should now work correctly.');
      }
      // 학습된 오류라도 리포트는 저장 (통계용)
    }

    try {
      // 게스트 사용자 식별자 가져오기
      let userIdentifier: string | null = null;
      if (!user) {
        if (typeof window !== 'undefined') {
          userIdentifier = localStorage.getItem('guest_id') || `guest_${Date.now()}`;
          if (!localStorage.getItem('guest_id')) {
            localStorage.setItem('guest_id', userIdentifier);
          }
        }
      }

      const bugReportData: any = {
        problem_id: problemId, // 문제 ID 명시
        user_id: user?.id || null,
        user_identifier: userIdentifier,
        bug_type: bugReportType,
        question_text: question || (bugReportType === 'wrong_similarity' ? userGuess : null) || null,
        ai_suggested_answer: answer || (bugReportType === 'wrong_similarity' ? 'similarity_error' : null) || null,
        expected_answer: bugReportExpected.trim(),
        user_answer: userGuess?.trim() || null,
        correct_answer: problem.answer,
        similarity_score: similarityScore !== null ? Number(similarityScore.toFixed(2)) : null,
        problem_content: problem.content,
        hints: (problem as any).hints || null,
        language: lang === 'ko' || lang === 'en' ? lang : 'ko',
      };

      const { error } = await supabase
        .from('ai_bug_reports')
        .insert(bugReportData);

      if (error) {
        console.error('오류 리포트 전송 오류:', error);
        if (typeof window !== 'undefined' && (window as any).toastError) {
          (window as any).toastError(lang === 'ko' ? '오류 리포트 전송에 실패했습니다.' : 'Failed to send error report.');
        } else {
          alert(lang === 'ko' ? '오류 리포트 전송에 실패했습니다.' : 'Failed to send error report.');
        }
        return;
      }

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(lang === 'ko' ? '오류 리포트가 전송되었습니다.' : 'Error report has been sent.');
      } else {
        alert(lang === 'ko' ? '오류 리포트가 전송되었습니다.' : 'Error report has been sent.');
      }
      setShowBugReportModal(false);
      setBugReportExpected('');
      setBugReportQuestion(null);
      setBugReportAnswer(null);
    } catch (error) {
      console.error('오류 리포트 전송 오류:', error);
      if (typeof window !== 'undefined' && (window as any).toastError) {
        (window as any).toastError(lang === 'ko' ? '오류 리포트 전송에 실패했습니다.' : 'Failed to send error report.');
      } else {
        alert(lang === 'ko' ? '오류 리포트 전송에 실패했습니다.' : 'Failed to send error report.');
      }
    }
  };

  useEffect(() => {
    loadProblem();
    loadQuestions();
    loadComments();
    checkLike();
    loadLocalQuestions();
    loadRating();
    loadNextProblem();
    
    // AI 모델을 백그라운드에서 미리 로드 (첫 질문 속도 개선)
    if (lang === 'en') {
      initializeModelEn().catch(err => {
        console.error('AI 모델 사전 로딩 실패 (첫 질문 시 자동 로드됨):', err);
      });
    } else {
      initializeModel().catch(err => {
        console.error('AI 모델 사전 로딩 실패 (첫 질문 시 자동 로드됨):', err);
      });
    }
  }, [problemId, lang]);

  // 작성자 확인 (user_id 기반)
  useEffect(() => {
    if (problem && user) {
      setIsOwner(problem.user_id === user.id);
    } else {
      setIsOwner(false);
    }
  }, [problem, user]);

  const loadLocalQuestions = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(`problem_questions_${problemId}`);
      if (stored) {
        setLocalQuestions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('로컬 질문 로드 오류:', error);
    }
  };

  const saveLocalQuestion = (question: string, answer: string) => {
    if (typeof window === 'undefined') return;
    try {
      const newQuestion = {
        question,
        answer,
        timestamp: Date.now(),
      };
      const updated = [...localQuestions, newQuestion];
      setLocalQuestions(updated);
      localStorage.setItem(`problem_questions_${problemId}`, JSON.stringify(updated));
    } catch (error) {
      console.error('로컬 질문 저장 오류:', error);
    }
  };

  const clearLocalQuestions = () => {
    if (typeof window === 'undefined') return;
    try {
      setLocalQuestions([]);
      localStorage.removeItem(`problem_questions_${problemId}`);
    } catch (error) {
      console.error('로컬 질문 삭제 오류:', error);
    }
  };

  // 조회수 증가 (한 번만 실행)
  useEffect(() => {
    if (problem && !isLoading) {
      const updateViewCount = async () => {
        try {
          // 직접 업데이트 (RPC 함수 없이)
          await supabase
            .from('problems')
            .update({ view_count: (problem.view_count || 0) + 1 })
            .eq('id', problemId);
        } catch (error) {
          // 에러는 무시 (조회수 증가 실패는 치명적이지 않음)
          console.warn('조회수 증가 실패:', error);
        }
      };
      updateViewCount();
    }
  }, [problem?.id, isLoading]); // 문제 ID가 로드될 때 한 번만 실행

  const loadProblem = async () => {
    try {
      const { data, error } = await supabase
        .from('problems')
        .select('*')
        .eq('id', problemId)
        .single();

      if (error) throw error;
      setProblem(data);
      
      console.log('문제 로드 완료:', { 
        id: data.id, 
        int_id: (data as any).int_id, 
        lang: data.lang,
        hasIntId: (data as any).int_id !== null && (data as any).int_id !== undefined
      });
      
      // 작성자의 game_user_id 찾기
      if (data.user_id) {
        const { data: gameUser } = await supabase
          .from('game_users')
          .select('id')
          .eq('auth_user_id', data.user_id)
          .maybeSingle();

        if (gameUser) {
          setAuthorGameUserId(gameUser.id);
        }
      }
      
      // 문제 로드 후 다음/이전 문제 로드 (data를 직접 사용하여 state 업데이트 대기 불필요)
      // React state 업데이트는 비동기이므로, data를 직접 전달하는 방식으로 변경
      const loadNextWithData = async () => {
        const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
        const currentIntId = (data as any).int_id;
        
        if (currentIntId === null || currentIntId === undefined) {
          console.warn('현재 문제에 int_id가 없습니다.');
          setNextProblem(null);
          return;
        }
        
        const { data: next, error: nextError } = await supabase
          .from('problems')
          .select('*')
          .eq('lang', currentLang)
          .gt('int_id', currentIntId)
          .order('int_id', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (nextError) {
          console.error('다음 문제 로드 오류:', nextError);
          setNextProblem(null);
          return;
        }
        
        console.log('다음 문제 찾음:', { next, currentIntId });
        setNextProblem(next || null);
      };
      
      const loadPreviousWithData = async () => {
        const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
        const currentIntId = (data as any).int_id;
        
        if (currentIntId === null || currentIntId === undefined || currentIntId <= 0) {
          console.log('이전 문제 없음 (첫 번째 문제 또는 int_id 없음)');
          setPreviousProblem(null);
          return;
        }
        
        const { data: previous, error: prevError } = await supabase
          .from('problems')
          .select('*')
          .eq('lang', currentLang)
          .lt('int_id', currentIntId)
          .order('int_id', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (prevError) {
          console.error('이전 문제 로드 오류:', prevError);
          setPreviousProblem(null);
          return;
        }
        
        console.log('이전 문제 찾음:', { previous, currentIntId });
        setPreviousProblem(previous || null);
      };
      
      loadNextWithData();
      loadPreviousWithData();
      
      // 문제 로드 시 knowledge 생성 (언어에 따라 다른 분석기 사용)
      if (data && data.content && data.answer) {
        try {
          const hints = (data as any).hints as string[] | null | undefined;
          // 영어 문제는 영어 분석기 사용, 한국어는 기존 분석기 사용
          if (lang === 'en') {
            const knowledge = await buildProblemKnowledgeEn(data.content, data.answer, undefined, hints);
            setProblemKnowledge(knowledge);
          } else {
            const knowledge = await buildProblemKnowledge(data.content, data.answer, undefined, hints);
            setProblemKnowledge(knowledge);
          }
        } catch (err) {
          console.error('Knowledge 생성 오류:', err);
          // knowledge 생성 실패해도 계속 진행
        }
      }
    } catch (error) {
      console.error('문제 로드 오류:', error);
      showToast(t.problem.loadProblemFail, 'error');
      router.push(`/${lang}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('problem_questions')
        .select('*')
        .eq('problem_id', problemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('질문 로드 오류:', error);
    }
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('problem_comments')
        .select('*')
        .eq('problem_id', problemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);

      // 각 댓글 작성자의 game_user_id 찾기
      const userIds = new Map<string, string>();
      for (const comment of data || []) {
        if (comment.user_id) {
          const { data: gameUser } = await supabase
            .from('game_users')
            .select('id')
            .eq('auth_user_id', comment.user_id)
            .maybeSingle();

          if (gameUser) {
            userIds.set(comment.id, gameUser.id);
          }
        }
      }
      setCommentGameUserIds(userIds);
    } catch (error) {
      console.error('댓글 로드 오류:', error);
    }
  };

  const checkLike = async () => {
    try {
      if (!user) {
        setIsLiked(false);
        return;
      }

      const { data } = await supabase
        .from('problem_likes')
        .select('id')
        .eq('problem_id', problemId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
    } catch (error) {
      // 좋아요가 없으면 에러가 발생할 수 있음 (정상)
      setIsLiked(false);
    }
  };

  const loadRating = async () => {
    try {
      if (!user) {
        setUserRating(null);
      }
      
      // 평균 별점과 개수 계산
      const { data: ratings, error: ratingsError } = await supabase
        .from('problem_difficulty_ratings')
        .select('rating')
        .eq('problem_id', problemId);

      if (ratingsError) throw ratingsError;

      if (ratings && ratings.length > 0) {
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        const avg = sum / ratings.length;
        setAverageRating(Number(avg.toFixed(2)));
        setRatingCount(ratings.length);
      } else {
        setAverageRating(0);
        setRatingCount(0);
      }

      // 사용자 별점 확인 (로그인한 경우에만)
      if (user) {
        const { data: userRatingData } = await supabase
          .from('problem_difficulty_ratings')
          .select('rating')
          .eq('problem_id', problemId)
          .eq('user_id', user.id)
          .single();

        setUserRating(userRatingData?.rating || null);
      }
    } catch (error) {
      console.error('별점 로드 오류:', error);
      // 사용자 별점이 없는 경우 에러가 발생할 수 있음 (정상)
      if (user) {
        setUserRating(null);
      }
    }
  };

  const handleRatingClick = async (rating: number) => {
    if (!user) {
      showToast(t.problem.loginRequired, 'warning');
      router.push(`/${lang}/auth/login`);
      return;
    }

    try {
      // 기존 별점이 있으면 업데이트, 없으면 생성
      const { data: existing, error: existingError } = await supabase
        .from('problem_difficulty_ratings')
        .select('id')
        .eq('problem_id', problemId)
        .eq('user_id', user.id)
        .maybeSingle(); // single() 대신 maybeSingle() 사용 (데이터가 없어도 에러 발생 안 함)

      if (existingError && existingError.code !== 'PGRST116') { // PGRST116은 "no rows returned" 에러
        throw existingError;
      }

      if (existing) {
        // 업데이트
        const { error } = await supabase
          .from('problem_difficulty_ratings')
          .update({ rating, updated_at: new Date().toISOString() })
          .eq('problem_id', problemId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // 생성
        const { error } = await supabase
          .from('problem_difficulty_ratings')
          .insert({
            problem_id: problemId,
            user_id: user.id,
            rating,
          });

        if (error) throw error;
      }

      setUserRating(rating);
      await loadRating(); // 평균 별점 다시 계산
    } catch (error: any) {
      console.error('별점 투표 오류:', error);
      console.error('오류 메시지:', error?.message);
      console.error('오류 코드:', error?.code);
      console.error('오류 상세:', JSON.stringify(error, null, 2));
      
      let errorMessage = t.problem.ratingVoteFail;
      if (error?.message) {
        errorMessage = `${t.problem.ratingVoteFail}: ${error.message}`;
      } else if (error?.code) {
        errorMessage = `${t.problem.ratingVoteFail} (${t.common.error}: ${error.code})`;
      }
      
      showToast(errorMessage, 'error');
    }
  };

  const handleAnalyzeQuestion = async () => {
    if (!questionText.trim() || !problem) return;

    setIsAnalyzing(true);
    try {
      // 언어에 따라 적절한 분석기 사용
      let knowledge = problemKnowledge;
      if (!knowledge && problem.content && problem.answer) {
        const hints = (problem as any).hints as string[] | null | undefined;
        if (lang === 'en') {
          knowledge = await buildProblemKnowledgeEn(problem.content, problem.answer, undefined, hints);
        } else {
          knowledge = await buildProblemKnowledge(problem.content, problem.answer, undefined, hints);
        }
        setProblemKnowledge(knowledge);
      }
      
      if (knowledge) {
        const answer = lang === 'en' 
          ? await analyzeQuestionV8En(questionText, knowledge as ProblemKnowledgeEn)
          : await analyzeQuestionV8(questionText, knowledge as ProblemKnowledge);
        setSuggestedAnswer(answer);
      } else {
        // fallback: knowledge 생성 실패 시 기존 방식 사용
        const analyzer = lang === 'en' ? await import('@/lib/ai-analyzer-en') : await import('@/lib/ai-analyzer');
        const answer = await analyzer.analyzeQuestion(questionText, problem.content, problem.answer);
        setSuggestedAnswer(answer);
      }
    } catch (error) {
      console.error('질문 분석 오류:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeBeforeSubmit = async () => {
    if (!questionText.trim() || !problem) {
      showToast(t.problem.enterQuestionAlert, 'warning');
      return;
    }

    // AI가 답변 제안
    setIsAnalyzing(true);
    let aiAnswer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null = null;
    
    try {
      // V8 방식: knowledge가 있으면 재사용, 없으면 생성
      let knowledge = problemKnowledge;
      if (!knowledge && problem.content && problem.answer) {
        const hints = (problem as any).hints as string[] | null | undefined;
        knowledge = await buildProblemKnowledge(problem.content, problem.answer, undefined, hints);
        setProblemKnowledge(knowledge);
      }
      
      if (knowledge) {
        aiAnswer = await analyzeQuestionV8(questionText, knowledge);
      } else {
        // fallback
        const { analyzeQuestion } = await import('@/lib/ai-analyzer');
        aiAnswer = await analyzeQuestion(questionText, problem.content, problem.answer);
      }
      setSuggestedAnswer(aiAnswer);
    } catch (error) {
      console.error('AI 분석 오류:', error);
      setSuggestedAnswer(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!questionText.trim()) {
      alert(t.problem.enterQuestionAlert);
      return;
    }

    if (!problem) {
      alert(t.problem.loadProblemInfoFail);
      return;
    }

    // 질문 제출 시 자동으로 AI 분석 실행
    setIsAnalyzing(true);
    let aiAnswer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null = null;
    
    try {
      // V8 방식: knowledge가 있으면 재사용, 없으면 생성
      let knowledge = problemKnowledge;
      if (!knowledge && problem.content && problem.answer) {
        const hints = (problem as any).hints as string[] | null | undefined;
        knowledge = await buildProblemKnowledge(problem.content, problem.answer, undefined, hints);
        setProblemKnowledge(knowledge);
      }
      
      if (knowledge) {
        // AI가 답변 제안
        aiAnswer = await analyzeQuestionV8(questionText.trim(), knowledge);
      } else {
        // fallback
        const { analyzeQuestion } = await import('@/lib/ai-analyzer');
        aiAnswer = await analyzeQuestion(questionText.trim(), problem.content, problem.answer);
      }
      setSuggestedAnswer(aiAnswer);
      
      // AI 제안 답변 사용
      const finalAnswer = aiAnswer || 'irrelevant';
      const answerText = finalAnswer === 'yes' ? t.problem.yes : 
                        finalAnswer === 'no' ? t.problem.no : 
                        finalAnswer === 'irrelevant' ? t.problem.irrelevant : 
                        finalAnswer === 'decisive' ? t.problem.decisive : t.common.pending;
      
      // 로컬스토리지에 저장 (DB에는 저장하지 않음)
      saveLocalQuestion(questionText.trim(), answerText);
      setQuestionText('');
      setSuggestedAnswer(null);
    } catch (error) {
      console.error('AI 분석 오류:', error);
      // 오류 발생 시에도 질문은 저장 (답변은 '대기중'으로)
      saveLocalQuestion(questionText.trim(), t.common.pending);
      setQuestionText('');
      setSuggestedAnswer(null);
      showToast(t.problem.aiAnalysisError, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      showToast(t.problem.loginRequired, 'warning');
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!commentText.trim()) {
      showToast(t.problem.enterCommentAlert, 'warning');
      return;
    }

    try {
      // game_users에서 닉네임 가져오기
      const { data: gameUser } = await supabase
        .from('game_users')
        .select('nickname')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      // users 테이블에서 nickname 가져오기
      const { data: userData } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      
      const nickname = userData?.nickname || gameUser?.nickname || t.common.anonymous;

      const { error } = await supabase
        .from('problem_comments')
        .insert({
          problem_id: problemId,
          nickname: nickname,
          text: commentText.trim(),
          user_id: user.id,
          is_spoiler: isSpoiler,
        });

      if (error) throw error;

      setCommentText('');
      setIsSpoiler(false);
      loadComments();

      // 문제 작성자에게 알림 생성
      if (problem && problem.user_id && problem.user_id !== user.id) {
        const problemTitle = problem.title || (lang === 'ko' ? '문제' : 'Problem');
        await createNotification({
          userId: problem.user_id,
          type: 'comment_on_problem',
          title: lang === 'ko' 
            ? `"${problemTitle}"에 댓글이 달렸습니다`
            : `New comment on "${problemTitle}"`,
          message: lang === 'ko'
            ? `${nickname}님이 댓글을 남겼습니다: ${commentText.trim().substring(0, 50)}${commentText.trim().length > 50 ? '...' : ''}`
            : `${nickname} commented: ${commentText.trim().substring(0, 50)}${commentText.trim().length > 50 ? '...' : ''}`,
          link: `/${lang}/problem/${problemId}`,
        });
      }
    } catch (error) {
      console.error('댓글 제출 오류:', error);
      showToast(t.problem.commentSubmitFail, 'error');
    }
  };

  const handleEditComment = (comment: ProblemComment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setEditCommentIsSpoiler(comment.is_spoiler || false);
  };

  const handleSaveEditComment = async () => {
    if (!editingCommentId || !editCommentText.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('problem_comments')
        .update({ 
          text: editCommentText.trim(),
          is_spoiler: editCommentIsSpoiler,
        })
        .eq('id', editingCommentId)
        .eq('user_id', user.id); // 본인 댓글만 수정 가능

      if (error) throw error;

      setEditingCommentId(null);
      setEditCommentText('');
      setEditCommentIsSpoiler(false);
      loadComments();
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      showToast(t.problem.updateCommentFail, 'error');
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
    setEditCommentIsSpoiler(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t.community.deleteComment)) return;
    if (!user) return;

    try {
      const { error } = await supabase
        .from('problem_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id); // 본인 댓글만 삭제 가능

      if (error) throw error;

      loadComments();
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      showToast(t.community.commentDeleteFail, 'error');
    }
  };

  const handleLike = async () => {
    if (!problem) return;

    if (!user) {
      showToast(t.problem.loginRequired, 'warning');
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!user.id) {
      console.error('사용자 ID가 없습니다:', user);
      showToast(t.problem.loadUserInfoFail, 'error');
      return;
    }

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user.id)) {
      console.error('잘못된 사용자 ID 형식:', user.id);
      showToast(t.problem.invalidUserInfo, 'error');
      return;
    }

    if (!problemId || !uuidRegex.test(problemId)) {
      console.error('잘못된 문제 ID 형식:', problemId);
      showToast(t.problem.invalidProblemInfo, 'error');
      return;
    }

    const previousIsLiked = isLiked;
    const previousLikeCount = problem.like_count || 0;

    try {

      // Optimistic UI 업데이트
      const newIsLiked = !isLiked;
      const newLikeCount = newIsLiked 
        ? previousLikeCount + 1 
        : Math.max(previousLikeCount - 1, 0);
      
      setIsLiked(newIsLiked);
      setProblem(prev => prev ? { ...prev, like_count: newLikeCount } : null);

      if (newIsLiked) {
        // 먼저 이미 좋아요가 있는지 확인
        const { data: existingLike, error: checkError } = await supabase
          .from('problem_likes')
          .select('id')
          .eq('problem_id', problemId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116은 "not found" 에러
          console.error('좋아요 확인 오류:', checkError);
        }

        if (existingLike) {
          // 이미 좋아요가 있으므로 상태만 업데이트
          console.log('이미 좋아요가 존재함');
          setIsLiked(true);
          return;
        }

        // 좋아요 추가
        const insertData = {
          problem_id: problemId,
          user_id: user.id,
          user_identifier: null, // user_id를 사용하므로 user_identifier는 NULL
        };
        
        console.log('좋아요 추가 시도:', insertData);
        console.log('사용자 정보:', { id: user.id, email: user.email });
        console.log('문제 ID:', problemId);
        
        const { data, error } = await supabase
          .from('problem_likes')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          // 에러 객체 전체를 JSON으로 변환하여 로깅
          const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
          console.error('좋아요 추가 오류 상세:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: (error as any).status,
            statusText: (error as any).statusText,
            error: errorString,
            fullError: error
          });
          
          // UNIQUE 제약 조건 위반 (이미 좋아요가 있는 경우)
          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
            console.log('이미 좋아요가 존재함 (UNIQUE 제약 조건), 상태만 업데이트');
            // 이미 좋아요가 있으므로 상태만 업데이트
            setIsLiked(true);
            return;
          }
          
          // 400 에러인 경우 더 자세한 정보 로깅
          if (error.code === '400' || error.message?.includes('400') || (error as any).status === 400) {
            console.error('400 에러 상세 정보:', {
              insertData,
              user: { id: user.id, email: user.email },
              problemId: problemId,
              errorString: errorString,
              errorObject: error
            });
            
            // RLS 정책 문제일 수 있으므로 확인
            console.error('RLS 정책 확인 필요 - user_id가 auth.uid()와 일치하는지 확인');
            console.error('현재 auth.uid():', (await supabase.auth.getUser()).data.user?.id);
          }
          
          throw error;
        }
        
        console.log('좋아요 추가 성공:', data);
      } else {
        // 좋아요 취소
        console.log('좋아요 삭제 시도:', { problem_id: problemId, user_id: user.id });
        
        const { error: deleteError } = await supabase
          .from('problem_likes')
          .delete()
          .eq('problem_id', problemId)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('좋아요 삭제 오류 상세:', {
            message: deleteError.message,
            code: deleteError.code,
            details: deleteError.details,
            hint: deleteError.hint,
            error: deleteError
          });
          
          // 400 에러인 경우 더 자세한 정보 로깅
          if (deleteError.code === '400' || deleteError.message?.includes('400')) {
            console.error('400 에러 상세 정보 (삭제):', {
              problemId: problemId,
              userId: user.id,
              error: JSON.stringify(deleteError, null, 2)
            });
          }
          
          throw deleteError;
        }

        // 트리거가 비동기적으로 작동할 수 있으므로, 수동으로 카운트를 감소시킴
        const { error: updateError } = await supabase
          .from('problems')
          .update({ like_count: Math.max((problem.like_count || 0) - 1, 0) })
          .eq('id', problemId);

        if (updateError) {
          console.error('좋아요 개수 업데이트 오류:', updateError);
          // 에러가 나도 계속 진행 (트리거가 처리할 수 있음)
        }
      }

      // 트리거가 자동으로 카운트를 업데이트하지만, 확실하게 하기 위해 다시 로드
      // 약간의 지연을 두어 트리거가 완료될 시간을 줌
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: updatedProblem, error: loadError } = await supabase
        .from('problems')
        .select('*')
        .eq('id', problemId)
        .single();

      if (loadError) throw loadError;
      
      if (updatedProblem) {
        setProblem(updatedProblem);
        // 최신 좋아요 개수로 UI 업데이트
        setProblem(prev => prev ? { ...prev, like_count: updatedProblem.like_count } : null);
      }
    } catch (error: any) {
      console.error('좋아요 오류:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error: error
      });
      // 실패 시 롤백
      setIsLiked(previousIsLiked);
      setProblem(prev => prev ? { ...prev, like_count: previousLikeCount } : null);
      
      // 사용자에게 친화적인 오류 메시지 표시
      let errorMessage = t.problem.likeProcessFail;
      if (error?.message) {
        errorMessage += `\n\n${error.message}`;
      } else if (error?.code) {
        errorMessage += `\n\n${t.common.error}: ${error.code}`;
      }
      showToast(errorMessage, 'error');
    }
  };


  const handleAnswerQuestion = async (questionId: string, answer: 'yes' | 'no' | 'irrelevant' | 'decisive') => {
    if (!isOwner) return;

    try {
      const { error } = await supabase
        .from('problem_questions')
        .update({ answer })
        .eq('id', questionId);

      if (error) throw error;

      setSelectedQuestionId(null);
      loadQuestions();
    } catch (error) {
      console.error('답변 제출 오류:', error);
      showToast(t.problem.submitAnswerFail, 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!isOwner || !problem) return;

    if (!editTitle.trim() || !editContent.trim() || !editAnswer.trim()) {
      showToast(t.problem.enterAllFields, 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('problems')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          answer: editAnswer.trim(),
          difficulty: 'medium',
          tags: [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', problemId);

      if (error) throw error;

      setIsEditing(false);
      await loadProblem(); // 문제 재로드 (knowledge도 자동으로 재생성됨)
      showToast(t.problem.problemUpdated, 'success');
    } catch (error) {
      console.error('문제 수정 오류:', error);
      showToast(t.problem.updateProblemFail, 'error');
    }
  };

  const handleCancelEdit = () => {
    if (problem) {
      setEditTitle(problem.title);
      setEditContent(problem.content);
      setEditAnswer(problem.answer);
    }
    setIsEditing(false);
  };


  const getDifficultyFromRating = (rating: number): { text: string; color: string; emoji: string } => {
    if (rating === 0) {
      return { text: '평가 없음', color: 'bg-slate-500', emoji: '⚪' };
    } else if (rating < 2) {
      return { text: '매우 쉬움', color: 'bg-green-500', emoji: '🟢' };
    } else if (rating < 3) {
      return { text: '쉬움', color: 'bg-green-400', emoji: '🟢' };
    } else if (rating < 4) {
      return { text: '보통', color: 'bg-yellow-500', emoji: '🟡' };
    } else if (rating < 4.5) {
      return { text: '어려움', color: 'bg-orange-500', emoji: '🟠' };
    } else {
      return { text: '매우 어려움', color: 'bg-red-500', emoji: '🔴' };
    }
  };

  const getAnswerBadge = (answer: string | null) => {
    if (!answer) return null;
    const badges = {
      yes: { text: t.problem.yes, color: 'bg-green-500/20 text-green-400 border-green-500/50' },
      no: { text: t.problem.no, color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      irrelevant: { text: t.problem.irrelevant, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      decisive: { text: t.problem.decisive, color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    };
    return badges[answer as keyof typeof badges];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-6 relative w-24 h-24 mx-auto">
            {/* 거북이 애니메이션 */}
            <svg 
              className="w-full h-full animate-turtle-float"
              viewBox="0 0 100 100" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 거북이 몸통 */}
              <ellipse cx="50" cy="55" rx="30" ry="20" fill="#14b8a6" />
              {/* 거북이 등껍질 */}
              <ellipse cx="50" cy="50" rx="25" ry="18" fill="#0d9488" />
              {/* 등껍질 패턴 */}
              <path d="M 50 35 Q 45 40 50 45 Q 55 40 50 35" stroke="#0f766e" strokeWidth="1.5" fill="none" />
              <path d="M 35 50 Q 40 45 45 50 Q 40 55 35 50" stroke="#0f766e" strokeWidth="1.5" fill="none" />
              <path d="M 65 50 Q 60 45 55 50 Q 60 55 65 50" stroke="#0f766e" strokeWidth="1.5" fill="none" />
              {/* 머리 */}
              <ellipse cx="50" cy="30" rx="8" ry="10" fill="#14b8a6" />
              {/* 눈 */}
              <circle cx="47" cy="28" r="1.5" fill="white" />
              <circle cx="53" cy="28" r="1.5" fill="white" />
              {/* 다리들 */}
              <ellipse cx="35" cy="60" rx="5" ry="8" fill="#14b8a6" />
              <ellipse cx="65" cy="60" rx="5" ry="8" fill="#14b8a6" />
              <ellipse cx="30" cy="70" rx="6" ry="5" fill="#14b8a6" />
              <ellipse cx="70" cy="70" rx="6" ry="5" fill="#14b8a6" />
            </svg>
          </div>
          <p className="text-slate-400">{t.problem.loadingProblems}</p>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">{t.problem.problemNotFound}</p>
          <Link href={`/${lang}`} className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
            {t.common.backToHome}
          </Link>
        </div>
      </div>
    );
  }

  const difficultyBadge = getDifficultyFromRating(averageRating);

  // JSON-LD 구조화된 데이터
  const structuredData = problem ? {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": problem.title,
    "description": problem.content?.substring(0, 200) || '',
    "author": {
      "@type": "Person",
      "name": problem.author || 'Anonymous'
    },
    "datePublished": problem.created_at,
    "dateModified": problem.updated_at || problem.created_at,
    "interactionStatistic": [
      {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/ViewAction",
        "userInteractionCount": problem.view_count || 0
      },
      {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/LikeAction",
        "userInteractionCount": problem.like_count || 0
      }
    ],
    "commentCount": problem.comment_count || 0,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": typeof window !== 'undefined' ? `${window.location.origin}/${lang}/problem/${problemId}` : ''
    }
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {structuredData && <JsonLd data={structuredData} />}
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-6 xl:py-8 max-w-4xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        {/* 문제 헤더 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-slate-700">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
            <div className="flex-1 w-full sm:w-auto">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xl sm:text-2xl lg:text-3xl font-bold mb-3 bg-transparent border-b-2 border-purple-500 text-white focus:outline-none pb-2"
                  maxLength={100}
                />
              ) : (
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent break-words">
                  {problem.title}
                </h1>
              )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-400">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <i className="ri-eye-line"></i>
                    {problem.view_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-heart-line"></i>
                    {problem.like_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-chat-3-line"></i>
                    {problem.comment_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    {difficultyBadge.emoji} {difficultyBadge.text}
                  </span>
                  {averageRating > 0 && (
                    <span className="text-xs">
                      ⭐ {averageRating.toFixed(1)} ({ratingCount}명)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full sm:w-auto">
              {isOwner && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => {
                          if (problem) {
                            setEditTitle(problem.title);
                            setEditContent(problem.content);
                            setEditAnswer(problem.answer);
                          }
                          setIsEditing(true);
                        }}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all text-xs sm:text-sm"
                      >
                        <i className="ri-edit-line mr-1"></i>
                        <span className="hidden sm:inline">{t.common.edit}</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(t.problem.deleteProblemConfirm)) return;
                          try {
                            const { error } = await supabase
                              .from('problems')
                              .delete()
                              .eq('id', problemId);
                            if (error) throw error;
                            showToast(t.problem.problemDeleted, 'success');
                            router.push(`/${lang}/problems`);
                          } catch (error) {
                            console.error('문제 삭제 오류:', error);
                            showToast(t.problem.deleteProblemFail, 'error');
                          }
                        }}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all text-xs sm:text-sm"
                      >
                        <i className="ri-delete-bin-line mr-1"></i>
                        <span className="hidden sm:inline">{t.common.delete}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                  isLiked
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <i className={`ri-heart-${isLiked ? 'fill' : 'line'}`}></i>
                <span>{problem.like_count}</span>
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white"
                title="공유하기"
              >
                <i className="ri-share-line"></i>
                <span className="hidden sm:inline">{t.problem.share}</span>
              </button>
              <div className="flex items-center gap-1 sm:gap-2 text-slate-400 text-xs sm:text-sm">
                <i className="ri-chat-3-line"></i>
                <span>{problem.comment_count}</span>
              </div>
            </div>
          </div>

          {/* 별점 투표 */}
          <div className="mb-4 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap">{t.problem.difficulty}:</span>
              <div className="flex items-center gap-0.5 sm:gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const displayRating = hoverRating !== null ? hoverRating : userRating;
                  const isFilled = displayRating !== null && star <= displayRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingClick(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className={`text-xl sm:text-2xl transition-all touch-manipulation ${
                        isFilled
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-slate-600 hover:text-yellow-400'
                      }`}
                    >
                      <i className={`ri-star-${isFilled ? 'fill' : 'line'}`}></i>
                    </button>
                  );
                })}
              </div>
              {averageRating > 0 && (
                <span className="text-xs sm:text-sm text-slate-400">
                  {lang === 'ko' 
                    ? `${t.problem.average} ⭐ ${averageRating.toFixed(1)} (${ratingCount}${t.problem.ratings})`
                    : `${t.problem.average} ⭐ ${averageRating.toFixed(1)} (${ratingCount} ${t.problem.ratings})`}
                </span>
              )}
              {averageRating === 0 && (
                <span className="text-xs sm:text-sm text-slate-500">{t.problem.noRating}</span>
              )}
            </div>
          </div>

          {/* 태그 */}
          {problem.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {problem.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-lg text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 문제 내용 */}
          {isEditing ? (
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{t.problem.problemTitle}</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{t.problem.problemContent}</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-40 resize-none text-sm"
                  maxLength={2000}
                />
                <div className="text-right text-xs text-slate-500 mt-1">
                  {editContent.length} / 2000
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{t.problem.problemAnswer}</label>
                <textarea
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-40 resize-none text-sm"
                  maxLength={2000}
                />
                <div className="text-right text-xs text-slate-500 mt-1">
                  {editAnswer.length} / 2000
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 rounded-lg transition-all"
                >
                  {t.common.save}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition-all"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-lg p-4 sm:p-6 mb-4">
              {problem.author && (
                <div className="mb-3 pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                    <span>{t.problem.author}:</span>
                    {authorGameUserId ? (
                      <Link href={`/${lang}/profile/${authorGameUserId}`} className="hover:opacity-80 transition-opacity">
                        <UserLabel
                          userId={authorGameUserId}
                          nickname={problem.author}
                          size="sm"
                        />
                      </Link>
                    ) : (
                      <span className="text-cyan-400">{problem.author}</span>
                    )}
                  </div>
                </div>
              )}
              <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{problem.content}</p>
            </div>
          )}

        </div>

        {/* 질문하기 섹션 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <i className="ri-question-line text-teal-400"></i>
            {t.problem.question}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">{t.problem.questionDescription}</p>
          
          <div className="space-y-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder={t.problem.questionPlaceholder}
                value={questionText}
                onChange={(e) => {
                  setQuestionText(e.target.value);
                  setSuggestedAnswer(null); // 질문 변경 시 제안 초기화
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!suggestedAnswer) {
                      handleAnalyzeBeforeSubmit();
                    } else {
                      handleSubmitQuestion();
                    }
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
              />
              {!suggestedAnswer && (
                <button
                  onClick={handleAnalyzeBeforeSubmit}
                  disabled={!questionText.trim() || isAnalyzing}
                  className="px-3 sm:px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm sm:text-base touch-manipulation"
                  title="AI 답변 제안 받기"
                >
                  {isAnalyzing ? t.problem.analyzing : '🔧'}
                </button>
              )}
            </div>
            
            {/* AI 제안 답변 표시 및 수정 */}
            {suggestedAnswer && (
              <div className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs sm:text-sm text-slate-300">{t.problem.aiSuggestedAnswer}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (questionText && suggestedAnswer) {
                          setBugReportType('wrong_yes_no');
                          setBugReportQuestion(questionText);
                          setBugReportAnswer(suggestedAnswer);
                          setShowBugReportModal(true);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all touch-manipulation flex items-center gap-1"
                      title={lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
                    >
                      <i className="ri-bug-line"></i>
                      <span className="hidden sm:inline">{lang === 'ko' ? '오류 리포트' : 'Report'}</span>
                    </button>
                    <button
                      onClick={() => setSuggestedAnswer(null)}
                      className="text-xs text-slate-400 hover:text-slate-300 touch-manipulation"
                    >
                      {t.problem.reAnalyze}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {(() => {
                    const badge = getAnswerBadge(suggestedAnswer);
                    return badge ? (
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                        {badge.text}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setSuggestedAnswer('yes')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'yes'
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t.problem.yes}
                  </button>
                  <button
                    onClick={() => setSuggestedAnswer('no')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'no'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t.problem.no}
                  </button>
                  <button
                    onClick={() => setSuggestedAnswer('irrelevant')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'irrelevant'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t.problem.irrelevant}
                  </button>
                  <button
                    onClick={() => setSuggestedAnswer('decisive')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'decisive'
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t.problem.decisive}
                  </button>
                </div>
              </div>
            )}
            
            <button
              onClick={handleSubmitQuestion}
              disabled={!questionText.trim() || isAnalyzing}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
            >
              {t.problem.question}
            </button>
          </div>

          {/* 로컬 질문 내역 */}
          {localQuestions.length > 0 && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3">
                <h3 className="text-base sm:text-lg font-semibold">{t.problem.questionHistory}</h3>
                <button
                  onClick={clearLocalQuestions}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all text-xs sm:text-sm touch-manipulation"
                >
                  <i className="ri-delete-bin-line mr-1"></i>
                  {t.problem.clearHistory}
                </button>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {localQuestions.map((q, index) => {
                  const answerColor = q.answer === 'yes' || q.answer === '예' ? 'text-green-400' :
                                     q.answer === 'no' || q.answer === '아니오' ? 'text-red-400' :
                                     q.answer === 'irrelevant' || q.answer === '상관없음' ? 'text-yellow-400' :
                                     q.answer === 'decisive' || q.answer === '결정적인' ? 'text-purple-400' :
                                     'text-slate-400';
                  return (
                    <div 
                      key={index} 
                      className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-cyan-400 flex-shrink-0">Q:</span>
                          <p className="text-xs sm:text-sm text-white flex-1 break-words">{q.question}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-teal-400 flex-shrink-0">A:</span>
                          <p className={`text-xs sm:text-sm font-semibold ${answerColor}`}>{q.answer}</p>
                        </div>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => {
                              setBugReportType('wrong_yes_no');
                              setBugReportQuestion(q.question);
                              setBugReportAnswer(q.answer);
                              setShowBugReportModal(true);
                            }}
                            className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all touch-manipulation flex items-center gap-1"
                            title={lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
                          >
                            <i className="ri-bug-line"></i>
                            <span>{lang === 'ko' ? '오류 리포트' : 'Report'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 정답 입력 칸 */}
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <i className="ri-checkbox-circle-line text-purple-400"></i>
                {t.problem.submitAnswerTitle}
              </h3>
              <button
                onClick={() => {
                  if (userGuess && problem) {
                    setBugReportType('wrong_similarity');
                    setBugReportQuestion(null);
                    setBugReportAnswer(null);
                    setShowBugReportModal(true);
                  } else {
                    alert(lang === 'ko' ? '정답을 입력한 후 오류를 신고할 수 있습니다.' : 'Please enter an answer before reporting an error.');
                  }
                }}
                className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all touch-manipulation flex items-center gap-1"
                title={lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
              >
                <i className="ri-bug-line"></i>
                <span className="hidden sm:inline">{lang === 'ko' ? '오류 리포트' : 'Report'}</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">{t.problem.submitAnswerDescription}</p>
            
            <div className="space-y-3">
              <textarea
                placeholder={t.problem.answerPlaceholder}
                value={userGuess}
                onChange={(e) => {
                  setUserGuess(e.target.value);
                  setSimilarityScore(null); // 입력 변경 시 유사도 초기화
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 sm:h-32 resize-none text-sm sm:text-base"
                maxLength={500}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{userGuess.length} / 500</span>
                <button
                  onClick={async () => {
                    if (!userGuess.trim() || !problem) {
                      showToast(t.problem.enterAnswerAlert, 'warning');
                      return;
                    }

                    setIsCalculatingSimilarity(true);
                    try {
                      // 문제 내용도 전달하여 맥락을 고려한 정답률 계산
                      const similarity = lang === 'en'
                        ? await calculateAnswerSimilarityEn(
                            userGuess.trim(),
                            problem.answer,
                            problem.content,
                            problemKnowledge as ProblemKnowledgeEn | null
                          )
                        : await calculateAnswerSimilarity(
                        userGuess.trim(), 
                        problem.answer,
                        problem.content
                      );
                      setSimilarityScore(similarity);
                      setHasSubmittedAnswer(true);
                      
                      // 정답률 80% 이상이고 로그인한 사용자인 경우 정답 수 증가
                      if (similarity >= 80 && user) {
                        try {
                          // 이미 이 문제를 맞춘 기록이 있는지 확인
                          const { data: existingSolve } = await supabase
                            .from('user_problem_solves')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('problem_id', problemId)
                            .single();
                          
                          // 기록이 없으면 새로 추가
                          if (!existingSolve) {
                            const { error: solveError } = await supabase
                              .from('user_problem_solves')
                              .insert({
                                user_id: user.id,
                                problem_id: problemId,
                                similarity_score: Math.round(similarity),
                              });
                            
                            if (solveError) {
                              console.error('정답 기록 저장 오류:', solveError);
                            } else {
                              // 성공 메시지는 유사도 결과에 포함되어 있으므로 별도로 표시하지 않음
                            }
                          }
                        } catch (error) {
                          console.error('정답 수 증가 오류:', error);
                        }
                      }
                      } catch (error) {
                        console.error('유사도 계산 오류:', error);
                        showToast(t.problem.similarityCalculationFail, 'error');
                      } finally {
                      setIsCalculatingSimilarity(false);
                    }
                  }}
                  disabled={!userGuess.trim() || isCalculatingSimilarity}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm whitespace-nowrap touch-manipulation"
                >
                  {isCalculatingSimilarity ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-1"></i>
                      {t.problem.calculating}
                    </>
                  ) : (
                    <>
                      <i className="ri-checkbox-circle-line mr-1"></i>
                      {t.problem.submitAnswer}
                    </>
                  )}
                </button>
              </div>

              {/* 유사도 결과 표시 */}
              {similarityScore !== null && (
                <div className={`mt-3 rounded-lg p-4 border ${
                  similarityScore >= 80
                    ? 'bg-green-500/10 border-green-500/50'
                    : similarityScore >= 60
                    ? 'bg-yellow-500/10 border-yellow-500/50'
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                      {similarityScore >= 80 ? (
                        <>
                          <i className="ri-checkbox-circle-fill text-green-400"></i>
                          <span className="text-green-400">{t.problem.highMatch}</span>
                        </>
                      ) : similarityScore >= 60 ? (
                        <>
                          <i className="ri-alert-line text-yellow-400"></i>
                          <span className="text-yellow-400">{t.problem.mediumMatch}</span>
                        </>
                      ) : (
                        <>
                          <i className="ri-close-circle-line text-red-400"></i>
                          <span className="text-red-400">{t.problem.lowMatch}</span>
                        </>
                      )}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl sm:text-2xl font-bold ${
                        similarityScore >= 80
                          ? 'text-green-400'
                          : similarityScore >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}>
                        {similarityScore}%
                      </span>
                      <button
                        onClick={() => {
                          if (userGuess && problem) {
                            setBugReportType('wrong_similarity');
                            setBugReportQuestion(null);
                            setBugReportAnswer(null);
                            setShowBugReportModal(true);
                          }
                        }}
                        className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all touch-manipulation flex items-center gap-1"
                        title={lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
                      >
                        <i className="ri-bug-line"></i>
                        <span className="hidden sm:inline">{lang === 'ko' ? '오류 리포트' : 'Report'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2">
                    {similarityScore >= 80
                      ? t.problem.highMatchDesc
                      : similarityScore >= 60
                      ? t.problem.mediumMatchDesc
                      : t.problem.lowMatchDesc}
                  </p>
                </div>
              )}
        <NativeAd />

              {/* 힌트 보기 */}
              {problem && (problem as any).hints && Array.isArray((problem as any).hints) && (problem as any).hints.length > 0 && (
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
                  <h3 className="text-sm sm:text-base font-semibold mb-3 text-yellow-400">
                    <i className="ri-lightbulb-line mr-2"></i>
                    {lang === 'ko' ? '힌트' : 'Hints'}
                  </h3>
                  <div className="space-y-2">
                    {((problem as any).hints as string[]).map((hint, index) => (
                      <div key={index} className="bg-slate-800/50 rounded-lg border border-slate-700">
                        <button
                          onClick={() => {
                            const newShowHints = [...showHints];
                            newShowHints[index] = !newShowHints[index];
                            setShowHints(newShowHints);
                          }}
                          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-700/50 transition-colors rounded-lg"
                        >
                          <span className="text-sm sm:text-base text-slate-300">
                            <i className="ri-lightbulb-flash-line mr-2 text-yellow-400"></i>
                            {lang === 'ko' ? `힌트 ${index + 1}` : `Hint ${index + 1}`}
                          </span>
                          <i className={`ri-${showHints[index] ? 'eye-off' : 'eye'}-line text-slate-400`}></i>
                        </button>
                        {showHints[index] && (
                          <div className="px-4 pb-3 pt-2 border-t border-slate-700">
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{hint}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 정답 확인하기 버튼 */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
                {!hasSubmittedAnswer ? (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <p className="text-sm text-slate-400 text-center">
                      <i className="ri-information-line mr-2"></i>
                      {t.problem.submitFirst}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2.5 sm:py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
                  >
                    {showAnswer ? (
                      <>
                        <i className="ri-eye-off-line"></i>
                        {t.problem.hideAnswer}
                      </> 
                    ) : (
                      <>
                        <i className="ri-eye-line"></i>
                        {t.problem.showAnswer}
                      </>
                    )}
                  </button>
                )}

                {/* 정답 */}
                {showAnswer && problem && (
                  <div className="mt-3 sm:mt-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-3 sm:p-4 lg:p-6 border border-purple-500/50">
                    <h3 className="font-semibold mb-2 sm:mb-3 text-purple-400 text-sm sm:text-base">{t.problem.answer}</h3>
                    <p className="text-xs sm:text-sm lg:text-base leading-relaxed whitespace-pre-wrap break-words">{problem.answer}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DB 질문 목록 (관리자용) */}
          {isOwner && questions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">{t.problem.dbQuestionList}</h3>
              <div className="space-y-3">
                {questions.map(q => {
                  const badge = getAnswerBadge(q.answer);
                  return (
                    <div 
                      key={q.id} 
                      className={`bg-slate-900 rounded-lg p-4 border transition-all ${
                        selectedQuestionId === q.id && isOwner
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-700'
                      } ${isOwner && !q.answer ? 'cursor-pointer hover:border-purple-500/50' : ''}`}
                      onClick={() => {
                        if (isOwner && !q.answer) {
                          setSelectedQuestionId(q.id === selectedQuestionId ? null : q.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-semibold text-cyan-400">{q.nickname}</span>
                        {badge && (
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white">{q.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 관리자 답변 버튼 */}
          {isOwner && selectedQuestionId && (
            <div className="mt-4">
              <ProblemAdminButtons
                onAnswer={(answer) => handleAnswerQuestion(selectedQuestionId, answer)}
              />
            </div>
          )}
        </div>
        <NativeAd />

        {/* 댓글 섹션 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 border border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <i className="ri-chat-3-line text-teal-400"></i>
            댓글
          </h2>
          <div className="space-y-3 mb-4">
            {!user && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 rounded-lg p-3 text-sm">
                {t.problem.loginToComment}{' '}
                <Link href={`/${lang}/auth/login`} className="underline hover:text-yellow-300">
                  {t.problem.loginButton}
                </Link>
              </div>
            )}
            <textarea
              placeholder={user ? t.problem.commentPlaceholder : t.problem.loginRequired}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={!user}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 h-24 resize-none text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={500}
            />
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="spoiler-checkbox"
                checked={isSpoiler}
                onChange={(e) => setIsSpoiler(e.target.checked)}
                disabled={!user}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label 
                htmlFor="spoiler-checkbox" 
                className={`text-xs sm:text-sm cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : 'text-slate-300 hover:text-red-400'} transition-colors flex items-center gap-1`}
              >
                <i className="ri-eye-off-line text-red-400"></i>
                {lang === 'ko' ? '스포일러 표시' : 'Mark as spoiler'}
              </label>
            </div>
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || !user}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
            >
              {t.problem.writeComment}
            </button>
          </div>

          {/* 댓글 목록 */}
          <div className="space-y-2 sm:space-y-3 mt-4 sm:mt-6">
            {comments.length === 0 ? (
              <p className="text-slate-400 text-xs sm:text-sm">{t.problem.noComments}</p>
            ) : (
              comments.map(comment => {
                const isOwner = user && comment.user_id === user.id;
                const isEditingThis = editingCommentId === comment.id;
                
                return (
                  <div key={comment.id} className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {commentGameUserIds.get(comment.id) ? (
                          <Link href={`/${lang}/profile/${commentGameUserIds.get(comment.id)}`} className="hover:opacity-80 transition-opacity">
                            <UserLabel
                              userId={commentGameUserIds.get(comment.id)!}
                              nickname={comment.nickname}
                              size="sm"
                            />
                          </Link>
                        ) : (
                          <span className="text-xs sm:text-sm font-semibold text-cyan-400 break-words">{comment.nickname}</span>
                        )}
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-500">
                          {new Date(comment.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                        </span>
                        {comment.updated_at && comment.updated_at !== comment.created_at && (
                          <>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs text-slate-500">({t.common.edited})</span>
                          </>
                        )}
                      </div>
                      {isOwner && !isEditingThis && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEditComment(comment)}
                            className="text-xs text-slate-400 hover:text-teal-400 transition-colors p-1"
                            title={t.common.edit}
                          >
                            <i className="ri-edit-line"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-xs text-slate-400 hover:text-red-400 transition-colors p-1"
                            title={t.common.delete}
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm resize-none"
                          rows={3}
                          maxLength={500}
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="edit-spoiler-checkbox"
                            checked={editCommentIsSpoiler}
                            onChange={(e) => setEditCommentIsSpoiler(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500 focus:ring-2"
                          />
                          <label 
                            htmlFor="edit-spoiler-checkbox" 
                            className="text-xs sm:text-sm cursor-pointer text-slate-300 hover:text-red-400 transition-colors flex items-center gap-1"
                          >
                            <i className="ri-eye-off-line text-red-400"></i>
                            {lang === 'ko' ? '스포일러 표시' : 'Mark as spoiler'}
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{editCommentText.length} / 500</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleCancelEditComment}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-all"
                            >
                              {t.common.cancel}
                            </button>
                            <button
                              onClick={handleSaveEditComment}
                              disabled={!editCommentText.trim()}
                              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t.common.save}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {comment.is_spoiler && !revealedSpoilers.has(comment.id) ? (
                          <div
                            onClick={() => {
                              setRevealedSpoilers(prev => new Set(prev).add(comment.id));
                            }}
                            className="bg-red-500/20 border-2 border-red-500/50 border-dashed rounded-lg p-4 cursor-pointer hover:bg-red-500/30 transition-all group"
                          >
                            <div className="flex items-center justify-center gap-2 text-red-400">
                              <i className="ri-eye-off-line text-lg group-hover:scale-110 transition-transform"></i>
                              <span className="text-xs sm:text-sm font-semibold">
                                {lang === 'ko' ? '스포일러가 포함된 댓글입니다. 클릭하여 보기' : 'Spoiler comment. Click to reveal'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-xs sm:text-sm break-words whitespace-pre-wrap ${comment.is_spoiler ? 'text-red-300' : 'text-white'}`}>
                            {comment.text}
                            {comment.is_spoiler && (
                              <span className="ml-2 text-xs text-red-400 opacity-70">
                                <i className="ri-eye-off-line"></i>
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 공유 모달 */}
      {showShareModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-600 shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {t.problem.shareTitle}
              </h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            {/* 문제 미리보기 카드 */}
            <div className="bg-slate-900/50 rounded-xl p-4 sm:p-5 mb-6 border border-slate-600/50">
              <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
                {problem.title}
              </h3>
              <p className="text-sm text-slate-300 line-clamp-3 mb-3">
                {problem.content}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <i className="ri-eye-line"></i>
                  {problem.view_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-heart-line"></i>
                  {problem.like_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-chat-3-line"></i>
                  {problem.comment_count || 0}
                </span>
              </div>
            </div>

            {/* 공유 옵션 */}
            <div className="space-y-3">
              {/* URL 복사 (카카오스토리 공유 대체) */}
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/${lang}/problem/${problemId}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    showToast(lang === 'ko' ? '링크가 복사되었습니다! 카카오스토리에 직접 등록해보세요.' : 'Link copied! You can now paste it in KakaoStory.', 'success');
                    setShowShareModal(false);
                  } catch (error) {
                    // 폴백: 텍스트 영역 사용
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                      document.execCommand('copy');
                      showToast(lang === 'ko' ? '링크가 복사되었습니다! 카카오스토리에 직접 등록해보세요.' : 'Link copied! You can now paste it in KakaoStory.', 'success');
                      setShowShareModal(false);
                    } catch (err) {
                      showToast(lang === 'ko' ? '링크 복사에 실패했습니다. URL을 직접 복사해주세요.' : 'Failed to copy link. Please copy the URL manually.', 'error');
                    }
                    document.body.removeChild(textArea);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all font-medium shadow-lg"
              >
                <i className="ri-file-copy-line text-xl"></i>
                <span>{lang === 'ko' ? '링크 복사 (카카오스토리)' : 'Copy Link (KakaoStory)'}</span>
              </button>

              {/* 인스타그램 공유 */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/${lang}/problem/${problemId}`;
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  
                  if (isMobile) {
                    // 모바일: 인스타그램 스토리 공유 (스토리 URL 스킴)
                    const instagramUrl = `instagram://story-camera`;
                    window.location.href = instagramUrl;
                    
                    // 앱이 없으면 웹으로 폴백
                    setTimeout(() => {
                      // 인스타그램 웹에서는 직접 공유가 제한적이므로 링크 복사 안내
                      navigator.clipboard.writeText(url).then(() => {
                        showToast(t.problem.instagramLinkCopied, 'success');
                      }).catch(() => {
                        showToast(`${t.problem.instagramCopyLink}\n${url}`, 'info');
                      });
                    }, 2000);
                  } else {
                    // 데스크톱: 인스타그램 웹 (제한적)
                    navigator.clipboard.writeText(url).then(() => {
                      showToast(t.problem.linkCopiedInstagram, 'success');
                    }).catch(() => {
                      showToast(`${t.problem.instagramCopyLink}\n${url}`, 'info');
                    });
                  }
                  setShowShareModal(false);
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white rounded-lg transition-all font-medium shadow-lg"
              >
                <i className="ri-instagram-line text-xl"></i>
                <span>{t.problem.shareOnInstagram}</span>
              </button>

              {/* 트위터 공유 */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/${lang}/problem/${problemId}`;
                  const text = lang === 'ko' 
                    ? `${problem.title} - 거북이 국물 문제를 풀어보세요!`
                    : `${problem.title} - Try solving this Pelican Soup Riddle problem!`;
                  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                  window.open(twitterUrl, '_blank', 'width=550,height=420');
                  setShowShareModal(false);
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all font-medium"
              >
                <i className="ri-twitter-x-line text-xl"></i>
                <span>{t.problem.twitterShare}</span>
              </button>

              {/* 페이스북 공유 */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/${lang}/problem/${problemId}`;
                  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                  window.open(facebookUrl, '_blank', 'width=550,height=420');
                  setShowShareModal(false);
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
              >
                <i className="ri-facebook-line text-xl"></i>
                <span>{t.problem.facebookShare}</span>
              </button>

              {/* 링크 복사 (하단으로 이동) */}
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/${lang}/problem/${problemId}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    showToast(t.problem.linkCopied, 'success');
                    setShowShareModal(false);
                  } catch (error) {
                    // 폴백: 텍스트 영역 사용
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                      document.execCommand('copy');
                      showToast(t.problem.linkCopied, 'success');
                      setShowShareModal(false);
                    } catch (err) {
                      showToast(t.problem.copyLinkFail, 'error');
                    }
                    document.body.removeChild(textArea);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-medium border border-slate-600"
              >
                <i className="ri-file-copy-line text-xl"></i>
                <span>{t.problem.copyLink}</span>
              </button>
            </div>

            {/* URL 표시 */}
            <div className="mt-6 p-3 bg-slate-900/50 rounded-lg border border-slate-600/50">
              <p className="text-xs text-slate-400 mb-1">{t.problem.shareLink}</p>
              <p className="text-xs text-teal-400 break-all font-mono">
                {typeof window !== 'undefined' ? `${window.location.origin}/${lang}/problem/${problemId}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 고정 CTA 바 - 모바일 우선 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-800/95 backdrop-blur-xl border-t border-slate-700/50 z-50 shadow-2xl">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-4xl">
          {/* Primary 버튼: 이 문제로 방 만들기 */}
          <button
            onClick={handleCreateRoomFromProblem}
            disabled={isCreatingRoom}
            className="w-full mb-2 sm:mb-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:from-green-700 active:to-emerald-700 text-white font-bold py-3 sm:py-3.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95 text-sm sm:text-base"
          >
            {isCreatingRoom ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                {lang === 'ko' ? '방 생성 중...' : 'Creating room...'}
              </>
            ) : (
              <>
                <i className="ri-group-line mr-2"></i>
                {lang === 'ko' ? '이 문제로 방 만들기' : 'Create Room with This Problem'}
              </>
            )}
          </button>

          {/* Secondary 버튼 3개: 이전 문제, 초대 링크, 다음 문제 */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              onClick={handlePreviousProblem}
              disabled={!previousProblem}
              className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all duration-200 touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700/80"
            >
              <i className="ri-arrow-left-line text-base sm:text-lg"></i>
              <span className="text-xs sm:text-sm font-medium">{lang === 'ko' ? '이전 문제' : 'Previous'}</span>
            </button>
            <button
              onClick={handleCopyInviteLink}
              className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all duration-200 touch-manipulation active:scale-95"
            >
              <i className="ri-share-line text-base sm:text-lg"></i>
              <span className="text-xs sm:text-sm font-medium">{lang === 'ko' ? '초대 링크' : 'Invite'}</span>
            </button>
            <button
              onClick={handleNextProblem}
              disabled={!nextProblem}
              className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all duration-200 touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700/80"
            >
              <i className="ri-arrow-right-line text-base sm:text-lg"></i>
              <span className="text-xs sm:text-sm font-medium">{lang === 'ko' ? '다음 문제' : 'Next'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 오류 리포트 모달 */}
      {showBugReportModal && problem && (
        (bugReportType === 'wrong_similarity') || 
        ((bugReportQuestion || questionText) && (bugReportAnswer || suggestedAnswer))
      ) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 max-w-md w-full border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-red-400 flex items-center gap-2">
                <i className="ri-bug-line"></i>
                {lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
              </h3>
              <button
                onClick={() => {
                  setShowBugReportModal(false);
                  setBugReportExpected('');
                  setBugReportQuestion(null);
                  setBugReportAnswer(null);
                }}
                className="text-slate-400 hover:text-white transition-colors touch-manipulation"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '버그 유형' : 'Bug Type'}
                </label>
                <select
                  value={bugReportType}
                  onChange={(e) => setBugReportType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="wrong_yes_no">{lang === 'ko' ? '예/아니요 오류 (예여야 하는데 아니요로 판단)' : 'Yes/No Error (Should be Yes but got No)'}</option>
                  <option value="wrong_answer">{lang === 'ko' ? '정답 오류 (정답인데 오답으로 판단)' : 'Answer Error (Correct but marked wrong)'}</option>
                  <option value="wrong_irrelevant">{lang === 'ko' ? '무관 오류 (관련 있는데 무관으로 판단)' : 'Irrelevant Error (Relevant but marked irrelevant)'}</option>
                  <option value="wrong_similarity">{lang === 'ko' ? '유사도 계산 오류' : 'Similarity Calculation Error'}</option>
                  <option value="other">{lang === 'ko' ? '기타' : 'Other'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '문제 ID' : 'Problem ID'}
                </label>
                <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                  {problemId}
                </div>
              </div>

              {bugReportType !== 'wrong_similarity' && (bugReportQuestion || questionText) && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                    {lang === 'ko' ? '질문' : 'Question'}
                  </label>
                  <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                    {bugReportQuestion || questionText}
                  </div>
                </div>
              )}

              {bugReportType !== 'wrong_similarity' && (bugReportAnswer || suggestedAnswer) && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                    {lang === 'ko' ? 'AI 제안 답변' : 'AI Suggested Answer'}
                  </label>
                  <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                    {(() => {
                      const answer = bugReportAnswer || suggestedAnswer;
                      return answer === 'yes' ? (lang === 'ko' ? '예' : 'Yes') :
                             answer === 'no' ? (lang === 'ko' ? '아니요' : 'No') :
                             answer === 'irrelevant' ? (lang === 'ko' ? '무관' : 'Irrelevant') :
                             answer === 'decisive' ? (lang === 'ko' ? '결정적인' : 'Decisive') : answer;
                    })()}
                  </div>
                </div>
              )}

              {bugReportType === 'wrong_similarity' && userGuess && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                    {lang === 'ko' ? '제출한 정답' : 'Submitted Answer'}
                  </label>
                  <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                    {userGuess}
                  </div>
                </div>
              )}

              {bugReportType === 'wrong_similarity' && similarityScore !== null && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                    {lang === 'ko' ? '계산된 유사도' : 'Calculated Similarity'}
                  </label>
                  <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                    {similarityScore}%
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '기대한 답변' : 'Expected Answer'}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={bugReportExpected}
                  onChange={(e) => setBugReportExpected(e.target.value)}
                  placeholder={lang === 'ko' ? '예: 예, 아니요, 무관 등' : 'e.g., Yes, No, Irrelevant'}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'ko' 
                    ? 'AI가 어떤 답변을 해야 했는지 입력해주세요.' 
                    : 'Please enter what answer the AI should have given.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowBugReportModal(false);
                    setBugReportExpected('');
                    setBugReportQuestion(null);
                    setBugReportAnswer(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all font-semibold text-sm sm:text-base touch-manipulation"
                >
                  {lang === 'ko' ? '취소' : 'Cancel'}
                </button>
                <button
                  onClick={handleSubmitBugReport}
                  className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg transition-all font-semibold text-sm sm:text-base touch-manipulation"
                >
                  {lang === 'ko' ? '신고하기' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  <NativeAd />
      {/* CTA 바 공간 확보 (모바일에서 하단 버튼이 콘텐츠에 가려지지 않도록) */}
      <div className="h-24 sm:h-28"></div>
    </div>
  );
}

