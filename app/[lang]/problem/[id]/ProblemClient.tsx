'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Problem, ProblemQuestion, ProblemComment, ProblemUserAnswer, ProblemAnswerReply } from '@/lib/types';
import { buildProblemKnowledge, analyzeQuestionV8, calculateAnswerSimilarity, initializeModel, type ProblemKnowledge } from '@/lib/ai-analyzer';
import { buildProblemKnowledge as buildProblemKnowledgeEn, analyzeQuestionV8 as analyzeQuestionV8En, calculateAnswerSimilarityEn, initializeModel as initializeModelEn, type ProblemKnowledge as ProblemKnowledgeEn } from '@/lib/ai-analyzer-en';
import ProblemAdminButtons from './ProblemAdminButtons';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';
import { createNotification } from '@/lib/notifications';
import { checkIfLearnedError } from '@/lib/check-learned-error';
import JsonLd from '@/components/JsonLd';
import QuizPlayMCQ from '@/components/quiz/QuizPlayMCQ';
import QuizPlayOX from '@/components/quiz/QuizPlayOX';
import QuizPlayImage from '@/components/quiz/QuizPlayImage';
import QuizPlayBalance from '@/components/quiz/QuizPlayBalance';
import type { QuizType } from '@/lib/types/quiz';
import ProblemHeader from './components/ProblemHeader';
import ProblemContent from './components/ProblemContent';
import ShareModal from './components/ShareModal';
import CommentsSection from './components/CommentsSection';
import BugReportModal from './components/BugReportModal';
import ProblemCTABar from './components/ProblemCTABar';
import QuestionInputSection from './components/QuestionInputSection';
import AnswerInputSection from './components/AnswerInputSection';
import UserAnswersFeed from './components/UserAnswersFeed';
import AdminQuestionList from './components/AdminQuestionList';

type ProblemClientProps = {
  initialProblem: Problem;
  initialQuizContent: any;
  lang: string;
  problemId: string;
};

export default function ProblemClient({
  initialProblem,
  initialQuizContent,
  lang,
  problemId,
}: ProblemClientProps) {
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

  const [problem, setProblem] = useState<Problem | null>(initialProblem);
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
  const [isLoading, setIsLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
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
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [problemKnowledge, setProblemKnowledge] = useState<ProblemKnowledge | ProblemKnowledgeEn | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [authorGameUserId, setAuthorGameUserId] = useState<string | null>(null);
  const [authorProfileImage, setAuthorProfileImage] = useState<string | null>(null);
  const [commentGameUserIds, setCommentGameUserIds] = useState<Map<string, string>>(new Map());
  const [commentProfileImages, setCommentProfileImages] = useState<Map<string, string | null>>(new Map());
  const [userAnswers, setUserAnswers] = useState<ProblemUserAnswer[]>([]);
  const [answerLikes, setAnswerLikes] = useState<Map<string, boolean>>(new Map());
  const [answerReplies, setAnswerReplies] = useState<Map<string, ProblemAnswerReply[]>>(new Map());
  const [answerGameUserIds, setAnswerGameUserIds] = useState<Map<string, string>>(new Map());
  const [answerProfileImages, setAnswerProfileImages] = useState<Map<string, string | null>>(new Map());
  const [showHints, setShowHints] = useState<boolean[]>([false, false, false]); // 힌트 1, 2, 3 표시 여부
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [nextProblem, setNextProblem] = useState<Problem | null>(null);
  const [previousProblem, setPreviousProblem] = useState<Problem | null>(null);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [bugReportType, setBugReportType] = useState<'wrong_answer' | 'wrong_yes_no' | 'wrong_irrelevant' | 'wrong_similarity' | 'other'>('wrong_yes_no');
  const [bugReportExpected, setBugReportExpected] = useState('');
  const [bugReportQuestion, setBugReportQuestion] = useState<string | null>(null);
  const [bugReportAnswer, setBugReportAnswer] = useState<string | null>(null);
  const [quizContent, setQuizContent] = useState<any>(initialQuizContent); // quiz_contents 테이블에서 로드한 타입별 데이터
  const [userQuizAnswer, setUserQuizAnswer] = useState<any>(null); // 사용자가 선택한 답
  const [quizShowAnswer, setQuizShowAnswer] = useState(false); // 정답 표시 여부
  const [balanceVoteStats, setBalanceVoteStats] = useState<number[]>([]); // 밸런스 게임 투표 통계
  const [hasVoted, setHasVoted] = useState(false); // 이미 투표했는지 여부 (밸런스 게임, 투표)
  const [answerCooldownUntil, setAnswerCooldownUntil] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // 문제 변경 시 localStorage에서 쿨다운 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(`answer_cooldown_${problemId}`);
    if (saved) {
      const until = parseInt(saved, 10);
      if (until > Date.now()) setAnswerCooldownUntil(until);
    }
  }, [problemId]);

  // 1분 쿨다운 타이머
  useEffect(() => {
    if (answerCooldownUntil <= Date.now()) {
      setCooldownRemaining(0);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`answer_cooldown_${problemId}`);
      }
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((answerCooldownUntil - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0 && typeof window !== 'undefined') {
        localStorage.removeItem(`answer_cooldown_${problemId}`);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [answerCooldownUntil, problemId]);

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

    // 정답 확인 칸이 보이지 않으면 정답 표시 요청
    if (!showAnswer) {
      if (typeof window !== 'undefined' && (window as any).toastInfo) {
        (window as any).toastInfo(lang === 'ko' ? '정답을 확인한 후 방을 만들 수 있습니다.' : 'Please check the answer before creating a room.');
      } else {
        alert(lang === 'ko' ? '정답을 확인한 후 방을 만들 수 있습니다.' : 'Please check the answer before creating a room.');
      }
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

          router.push(`/${lang}/turtle_room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname)}`);
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

      router.push(`/${lang}/turtle_room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname)}`);
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
    // SSR에서 initialProblem을 받았으므로 보조 데이터만 로드
    loadProblemSupplement(initialProblem);
    loadQuestions();
    loadComments();
    loadUserAnswers();
    checkLike();
    loadLocalQuestions();
    loadRating();
    
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

  // 작성자 및 관리자 확인 (user_id 기반)
  useEffect(() => {
    if (problem && user) {
      setIsOwner(problem.user_id === user.id);
      
      // 관리자 권한 확인 (데이터베이스에서 조회)
      const checkAdmin = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle();
          
          if (error) {
            console.error('관리자 권한 확인 오류:', error);
            setIsAdminUser(false);
            return;
          }
          
          const adminStatus = data?.is_admin === true;
          setIsAdminUser(adminStatus);
        } catch (error) {
          console.error('관리자 권한 확인 오류:', error);
          setIsAdminUser(false);
        }
      };
      
      checkAdmin();
    } else {
      setIsOwner(false);
      setIsAdminUser(false);
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
          const { data: updatedProblem, error } = await supabase
            .from('problems')
            .update({ view_count: (problem.view_count || 0) + 1 })
            .eq('id', problemId)
            .select()
            .single();

          if (error) throw error;
          
          // 조회수 업데이트 후 문제 데이터 갱신
          if (updatedProblem) {
            setProblem(updatedProblem);
          }
        } catch (error) {
          // 에러는 무시 (조회수 증가 실패는 치명적이지 않음)
          console.warn('조회수 증가 실패:', error);
        }
      };
      updateViewCount();
    }
  }, [problem?.id, isLoading]); // 문제 ID가 로드될 때 한 번만 실행

  // SSR에서 초기 데이터를 받았을 때 보조 데이터만 로드 (author, next/prev, balance, knowledge)
  const loadProblemSupplement = async (data: Problem) => {
    try {
      // 작성자의 game_user_id와 프로필 이미지 찾기
      if (data.user_id) {
        const { data: gameUser } = await supabase
          .from('game_users')
          .select('id, profile_image_url')
          .eq('auth_user_id', data.user_id)
          .maybeSingle();

        if (gameUser) {
          setAuthorGameUserId(gameUser.id);
          setAuthorProfileImage(gameUser.profile_image_url);
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
      
      // quiz_contents - SSR에서 initialQuizContent를 받았으므로 fetch 생략, localStorage/balance만 처리
      const quizType = (data as any).type || 'soup';
      if (quizType !== 'soup' && quizContent) {
        // localStorage에서 투표 여부 확인 (밸런스 게임, 투표)
          if (quizType === 'balance' || quizType === 'poll') {
            const votedKey = `quiz_voted_${data.id}`;
            const hasVotedBefore = localStorage.getItem(votedKey) === 'true';
            if (hasVotedBefore) {
              setHasVoted(true);
              setQuizShowAnswer(true);
              // 저장된 답변 불러오기
              const savedAnswer = localStorage.getItem(`quiz_answer_${data.id}`);
              if (savedAnswer !== null) {
                if (quizType === 'balance') {
                  setUserQuizAnswer(parseInt(savedAnswer, 10));
                } else {
                  setUserQuizAnswer(savedAnswer);
                }
              }
            }
          }
          
          // 밸런스 게임인 경우 투표 통계 로드
          if (quizType === 'balance') {
            const { data: votes } = await supabase
              .from('balance_game_votes')
              .select('option_index')
              .eq('quiz_id', data.id);
            
            if (votes && quizContent?.options) {
              const options = quizContent.options || [];
              const stats = new Array(options.length).fill(0);
              votes.forEach(vote => {
                if (vote.option_index >= 0 && vote.option_index < stats.length) {
                  stats[vote.option_index]++;
                }
              });
              setBalanceVoteStats(stats);
            }
          }
      }
      
      // 문제 로드 시 knowledge 생성 (언어에 따라 다른 분석기 사용)
      // soup 타입만 knowledge 생성
      if (quizType === 'soup' && data && data.content && data.answer) {
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
      console.error('보조 데이터 로드 오류:', error);
    }
  };

  // 수정 후 전체 재로드용 (handleSaveEdit에서 호출)
  const loadProblem = async () => {
    try {
      const { data, error } = await supabase
        .from('problems')
        .select('*')
        .eq('id', problemId)
        .single();
      if (error) throw error;
      setProblem(data);
      await loadProblemSupplement(data);
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

      // 각 댓글 작성자의 game_user_id와 프로필 이미지 찾기
      const userIds = new Map<string, string>();
      const profileImages = new Map<string, string | null>();
      for (const comment of data || []) {
        if (comment.user_id) {
          const { data: gameUser } = await supabase
            .from('game_users')
            .select('id, profile_image_url')
            .eq('auth_user_id', comment.user_id)
            .maybeSingle();

          if (gameUser) {
            userIds.set(comment.id, gameUser.id);
            profileImages.set(comment.id, gameUser.profile_image_url);
          }
        }
      }
      setCommentGameUserIds(userIds);
      setCommentProfileImages(profileImages);
    } catch (error) {
      console.error('댓글 로드 오류:', error);
    }
  };

  const loadUserAnswers = async () => {
    try {
      const { data, error } = await supabase
        .from('problem_user_answers')
        .select('id, problem_id, user_id, nickname, answer_text, similarity_score, like_count, reply_count, created_at')
        .eq('problem_id', problemId)
        .not('user_id', 'is', null) // 로그인한 사용자 답변만 표시
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserAnswers((data || []) as ProblemUserAnswer[]);

      // 각 답변 작성자의 game_user_id, 프로필 이미지, 좋아요 여부, 대댓글 로드
      const userIds = new Map<string, string>();
      const profileImages = new Map<string, string | null>();
      const likesMap = new Map<string, boolean>();
      const repliesMap = new Map<string, ProblemAnswerReply[]>();

      for (const answer of data || []) {
        if (answer.user_id) {
          const { data: gameUser } = await supabase
            .from('game_users')
            .select('id, profile_image_url')
            .eq('auth_user_id', answer.user_id)
            .maybeSingle();
          if (gameUser) {
            userIds.set(answer.id, gameUser.id);
            profileImages.set(answer.id, gameUser.profile_image_url);
          }
        }
      }

      const answerIds = (data || []).map((a: any) => a.id);
      if (user && answerIds.length > 0) {
        const { data: likes } = await supabase
          .from('problem_answer_likes')
          .select('answer_id')
          .eq('user_id', user.id)
          .in('answer_id', answerIds);
        for (const like of likes || []) {
          likesMap.set(like.answer_id, true);
        }
      }

      if (answerIds.length > 0) {
        const { data: replies } = await supabase
          .from('problem_answer_replies')
          .select('*')
          .in('answer_id', answerIds)
          .order('created_at', { ascending: true });
        for (const reply of replies || []) {
          const list = repliesMap.get(reply.answer_id) || [];
          list.push(reply as ProblemAnswerReply);
          repliesMap.set(reply.answer_id, list);
        }
      }

      setAnswerGameUserIds(userIds);
      setAnswerProfileImages(profileImages);
      setAnswerLikes(likesMap);
      setAnswerReplies(repliesMap);
    } catch (error) {
      console.error('사용자 답변 로드 오류:', error);
    }
  };

  const handleSaveUserAnswer = async (answerText: string, similarity: number) => {
    if (!user) return;
    try {
      const { data: gameUser } = await supabase
        .from('game_users')
        .select('nickname')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      const { data: userData } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      const nickname = userData?.nickname || gameUser?.nickname || t.common.anonymous;

      const { error } = await supabase
        .from('problem_user_answers')
        .insert({
          problem_id: problemId,
          user_id: user.id,
          nickname,
          answer_text: answerText,
          similarity_score: Math.round(similarity),
        });

      if (error) throw error;
      await loadUserAnswers();
    } catch (error) {
      console.error('답변 저장 오류:', error);
      showToast(t.problem.answerSaveFail, 'error');
    }
  };

  const handleLikeAnswer = async (answerId: string) => {
    if (!user) return;
    const isLiked = answerLikes.get(answerId);
    const delta = isLiked ? -1 : 1;
    // 낙관적 UI: 즉시 하트 개수 반영
    setUserAnswers((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? { ...a, like_count: Math.max(0, (a.like_count ?? 0) + delta) }
          : a
      )
    );
    setAnswerLikes((prev) => {
      const next = new Map(prev);
      next.set(answerId, !isLiked);
      return next;
    });
    try {
      if (isLiked) {
        await supabase
          .from('problem_answer_likes')
          .delete()
          .eq('answer_id', answerId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('problem_answer_likes')
          .insert({ answer_id: answerId, user_id: user.id });
      }
      await loadUserAnswers();
    } catch (error) {
      console.error('답변 좋아요 오류:', error);
      // 실패 시 롤백
      setUserAnswers((prev) =>
        prev.map((a) =>
          a.id === answerId
            ? { ...a, like_count: Math.max(0, (a.like_count ?? 0) - delta) }
            : a
        )
      );
      setAnswerLikes((prev) => {
        const next = new Map(prev);
        next.set(answerId, isLiked ?? false);
        return next;
      });
      await loadUserAnswers();
    }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!user) return;
    if (!confirm(t.problem.deleteAnswerConfirm)) return;
    try {
      const { error } = await supabase
        .from('problem_user_answers')
        .delete()
        .eq('id', answerId)
        .eq('user_id', user.id);

      if (error) throw error;
      await loadUserAnswers();
    } catch (error) {
      console.error('답변 삭제 오류:', error);
      showToast(t.problem.deleteAnswerFail, 'error');
    }
  };

  const handleReportAnswer = async (answerId: string, reportType: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('problem_answer_reports')
        .insert({
          answer_id: answerId,
          reporter_user_id: user.id,
          report_type: reportType,
        });

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          showToast(t.problem.reportAlreadySubmitted, 'info');
          return;
        }
        throw error;
      }
      showToast(t.problem.reportSuccess, 'success');
    } catch (error) {
      console.error('답변 신고 오류:', error);
      showToast(t.problem.reportFail, 'error');
    }
  };

  const handleSubmitAnswerReply = async (answerId: string, text: string) => {
    if (!user) return;
    try {
      const { data: gameUser } = await supabase
        .from('game_users')
        .select('nickname')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      const { data: userData } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      const nickname = userData?.nickname || gameUser?.nickname || t.common.anonymous;

      const { error } = await supabase
        .from('problem_answer_replies')
        .insert({
          answer_id: answerId,
          user_id: user.id,
          nickname,
          text,
        });

      if (error) throw error;
    } catch (error) {
      console.error('답글 작성 오류:', error);
      throw error;
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
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

  const handleSubmitComment = async (parentId?: string | null) => {
    if (!user) {
      showToast(t.problem.loginRequired, 'warning');
      router.push(`/${lang}/auth/login`);
      return;
    }

    const textToSubmit = parentId ? replyText.trim() : commentText.trim();
    if (!textToSubmit) {
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

      const insertData: any = {
        problem_id: problemId,
        nickname,
        text: textToSubmit,
        user_id: user.id,
        is_spoiler: parentId ? false : isSpoiler,
      };
      if (parentId) insertData.parent_id = parentId;

      const { error } = await supabase
        .from('problem_comments')
        .insert(insertData);

      if (error) throw error;

      if (parentId) {
        setReplyText('');
        setReplyingToId(null);
      } else {
        setCommentText('');
        setIsSpoiler(false);
      }
      loadComments();

      // 문제 작성자에게 알림 생성 (대댓글 제외)
      if (!parentId && problem && problem.user_id && problem.user_id !== user.id) {
        const problemTitle = problem.title || (lang === 'ko' ? '문제' : 'Problem');
        await createNotification({
          userId: problem.user_id,
          type: 'comment_on_problem',
          title: lang === 'ko' 
            ? `"${problemTitle}"에 댓글이 달렸습니다`
            : `New comment on "${problemTitle}"`,
          message: lang === 'ko'
            ? `${nickname}님이 댓글을 남겼습니다: ${textToSubmit.substring(0, 50)}${textToSubmit.length > 50 ? '...' : ''}`
            : `${nickname} commented: ${textToSubmit.substring(0, 50)}${textToSubmit.length > 50 ? '...' : ''}`,
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
          explanation: editExplanation.trim() || null,
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
      setEditExplanation((problem as any).explanation || '');
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
  const quizType = (problem as any)?.type || 'soup' as QuizType;

  // JSON-LD 구조화된 데이터
  const structuredData = problem ? {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": problem.title || '',
    "description": (problem.content && typeof problem.content === 'string') ? problem.content.substring(0, 200) : '',
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
      "@id": (typeof window !== 'undefined' ? `${window.location.origin}/${lang}/problem/${problemId}` : '')
    }
  } : null;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {structuredData && <JsonLd data={structuredData} />}
  
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-6 xl:py-8 max-w-4xl">
        {/* 뒤로가기 */}
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>
  
        {/* 문제 헤더 */}
        <ProblemHeader
          problem={problem}
          lang={lang}
          isEditing={isEditing}
          editTitle={editTitle}
          onEditTitleChange={setEditTitle}
          isOwner={isOwner}
          isAdmin={isAdminUser}
          onToggleFeatured={async () => {
            if (!problem || !isAdminUser) return;
            try {
              const currentStatus = (problem as any).status || 'published';
              const newStatus = currentStatus === 'featured' ? 'published' : 'featured';
              
              const { error } = await supabase
                .from('problems')
                .update({ status: newStatus })
                .eq('id', problemId);
              
              if (error) throw error;
              
              // 문제 상태 업데이트
              setProblem({
                ...problem,
                ...({ status: newStatus } as any),
              });
              
              showToast(
                newStatus === 'featured' 
                  ? (lang === 'ko' ? '관리자 채택되었습니다.' : 'Problem featured.')
                  : (lang === 'ko' ? '관리자 채택이 해제되었습니다.' : 'Feature removed.'),
                'success'
              );
            } catch (error) {
              console.error('관리자 채택 오류:', error);
              showToast(lang === 'ko' ? '관리자 채택 실패' : 'Failed to toggle feature', 'error');
            }
          }}
          onEditClick={() => {
            if (problem) {
              setEditTitle(problem.title);
              setEditContent(problem.content);
              setEditAnswer(problem.answer);
              setEditExplanation((problem as any).explanation || '');
            }
            setIsEditing(true);
          }}
          onDeleteClick={async () => {
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
          difficultyBadge={difficultyBadge}
          averageRating={averageRating}
          ratingCount={ratingCount}
          userRating={userRating}
          hoverRating={hoverRating}
          onRatingClick={handleRatingClick}
          onRatingHover={setHoverRating}
          isLiked={isLiked}
          onLikeClick={handleLike}
          onShareClick={() => setShowShareModal(true)}
          authorGameUserId={authorGameUserId}
          authorProfileImage={authorProfileImage}
          quizType={quizType}
          t={t}
        />
  
        {/* 문제 내용 / 퀴즈 플레이 */}
        <ProblemContent
          problem={problem}
          lang={lang}
          quizType={quizType}
          quizContent={quizContent}
          authorGameUserId={authorGameUserId}
          authorProfileImage={authorProfileImage}
          isEditing={isEditing}
          editTitle={editTitle}
          editContent={editContent}
          editAnswer={editAnswer}
          editExplanation={editExplanation}
          onEditTitleChange={setEditTitle}
          onEditContentChange={setEditContent}
          onEditAnswerChange={setEditAnswer}
          onEditExplanationChange={setEditExplanation}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          userQuizAnswer={userQuizAnswer}
          onQuizAnswer={async (answer) => {
            // 이미 투표한 경우 무시
            if (hasVoted && (quizType === 'balance' || quizType === 'poll')) {
              return;
            }

            setUserQuizAnswer(answer);
            setQuizShowAnswer(true);
            
            // localStorage에 투표 여부 저장
            if (quizType === 'balance' || quizType === 'poll') {
              localStorage.setItem(`quiz_voted_${problemId}`, 'true');
              localStorage.setItem(`quiz_answer_${problemId}`, String(answer));
              setHasVoted(true);
            }
  
            // 밸런스 게임 투표 저장
            if (quizType === 'balance' && typeof answer === 'number' && user) {
              try {
                const { data: existingVote } = await supabase
                  .from('balance_game_votes')
                  .select('id, option_index')
                  .eq('quiz_id', problemId)
                  .eq('user_id', user.id)
                  .maybeSingle();
  
                if (existingVote) {
                  if (existingVote.option_index !== answer) {
                    await supabase
                      .from('balance_game_votes')
                      .update({ option_index: answer })
                      .eq('id', existingVote.id);
  
                    const newStats = [...balanceVoteStats];
                    if (
                      existingVote.option_index >= 0 &&
                      existingVote.option_index < newStats.length
                    ) {
                      newStats[existingVote.option_index] = Math.max(
                        0,
                        newStats[existingVote.option_index] - 1
                      );
                    }
                    if (answer >= 0 && answer < newStats.length) {
                      newStats[answer]++;
                    }
                    setBalanceVoteStats(newStats);
                  }
                } else {
                  await supabase.from('balance_game_votes').insert({
                    quiz_id: problemId,
                    user_id: user.id,
                    option_index: answer,
                  });
  
                  const newStats = [...balanceVoteStats];
                  if (answer >= 0 && answer < newStats.length) {
                    newStats[answer]++;
                  }
                  setBalanceVoteStats(newStats);
                }
              } catch (error) {
                console.error('투표 저장 오류:', error);
              }
            }
          }}
          quizShowAnswer={quizShowAnswer}
          balanceVoteStats={balanceVoteStats}
          onBalanceVoteStatsChange={setBalanceVoteStats}
          hasVoted={hasVoted}
          t={t}
        />
  
        {/* 질문하기 섹션 (Soup 타입만) */}
        {quizType === 'soup' && (
          <>
            <QuestionInputSection
              lang={lang}
              questionText={questionText}
              suggestedAnswer={suggestedAnswer}
              isAnalyzing={isAnalyzing}
              localQuestions={localQuestions}
              onQuestionTextChange={(text) => {
                setQuestionText(text);
                setSuggestedAnswer(null);
              }}
              onSuggestedAnswerChange={setSuggestedAnswer}
              onAnalyzeBeforeSubmit={handleAnalyzeBeforeSubmit}
              onSubmitQuestion={handleSubmitQuestion}
              onClearLocalQuestions={clearLocalQuestions}
              onBugReport={(type, question, answer) => {
                setBugReportType(type);
                setBugReportQuestion(question);
                setBugReportAnswer(answer);
                setShowBugReportModal(true);
              }}
              getAnswerBadge={getAnswerBadge}
              t={t}
            />
            <AnswerInputSection
              lang={lang}
              problem={problem}
              userGuess={userGuess}
              similarityScore={similarityScore}
              isCalculatingSimilarity={isCalculatingSimilarity}
              hasSubmittedAnswer={hasSubmittedAnswer}
              showAnswer={showAnswer}
              showHints={showHints}
              hints={(problem as any)?.hints}
              cooldownRemaining={cooldownRemaining}
              onUserGuessChange={(guess) => {
                setUserGuess(guess);
                setSimilarityScore(null);
              }}
              onSubmitAnswer={async () => {
                if (!userGuess.trim() || !problem) {
                  showToast(t.problem.enterAnswerAlert, 'warning');
                  return;
                }

                setIsCalculatingSimilarity(true);
                try {
                  const similarity =
                    lang === 'en'
                      ? await calculateAnswerSimilarityEn(
                          userGuess.trim(),
                          problem.answer,
                          problem.content,
                          problemKnowledge as any
                        )
                      : await calculateAnswerSimilarity(
                          userGuess.trim(),
                          problem.answer,
                          problem.content
                        );

                  setSimilarityScore(similarity);
                  setHasSubmittedAnswer(true);
                  const cooldownEnd = Date.now() + 60000; // 1분 쿨다운
                  setAnswerCooldownUntil(cooldownEnd);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`answer_cooldown_${problemId}`, String(cooldownEnd));
                  }

                  // ✅ 사용자 답변 DB 저장 (다른 사람들이 볼 수 있게)
                  if (user) {
                    await handleSaveUserAnswer(userGuess.trim(), similarity);
                  }

                  // ✅ 맞춘 기록 저장
                  if (similarity >= 80 && user) {
                    try {
                      const { data: existingSolve } = await supabase
                        .from('user_problem_solves')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('problem_id', problemId)
                        .maybeSingle();

                      if (!existingSolve) {
                        const { error: solveError } = await supabase
                          .from('user_problem_solves')
                          .insert({
                            user_id: user.id,
                            problem_id: problemId,
                            similarity_score: Math.round(similarity),
                          });
                        if (solveError) console.error('정답 기록 저장 오류:', solveError);
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
              onShowAnswerToggle={() => setShowAnswer(!showAnswer)}
              onShowHintsChange={setShowHints}
              onBugReport={() => {
                if (userGuess && problem) {
                  setBugReportType('wrong_similarity');
                  setBugReportQuestion(null);
                  setBugReportAnswer(null);
                  setShowBugReportModal(true);
                }
              }}
              showToast={showToast}
              t={t}
            />
            <UserAnswersFeed
              lang={lang}
              problemId={problemId}
              user={user}
              answers={userAnswers}
              answerLikes={answerLikes}
              answerReplies={answerReplies}
              answerGameUserIds={answerGameUserIds}
              answerProfileImages={answerProfileImages}
              onLoadAnswers={loadUserAnswers}
              onLikeAnswer={handleLikeAnswer}
              onDeleteAnswer={handleDeleteAnswer}
              onReportAnswer={handleReportAnswer}
              onSubmitReply={async (answerId, text) => {
                await handleSubmitAnswerReply(answerId, text);
                setUserAnswers((prev) =>
                  prev.map((a) =>
                    a.id === answerId
                      ? { ...a, reply_count: (a.reply_count ?? 0) + 1 }
                      : a
                  )
                );
              }}
              getSimilarityColor={getSimilarityColor}
              showToast={showToast}
              t={t}
            />
          </>
        )}
  
        {/* DB 질문 목록 (관리자용) */}
        {isOwner && (
          <AdminQuestionList
            questions={questions}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestion={setSelectedQuestionId}
            onAnswerQuestion={handleAnswerQuestion}
            getAnswerBadge={getAnswerBadge}
            t={t}
          />
        )}
  
  
        {/* 댓글 섹션 */}
        <CommentsSection
          lang={lang}
          user={user}
          comments={comments}
          commentText={commentText}
          isSpoiler={isSpoiler}
          replyingToId={replyingToId}
          replyText={replyText}
          editingCommentId={editingCommentId}
          editCommentText={editCommentText}
          editCommentIsSpoiler={editCommentIsSpoiler}
          revealedSpoilers={revealedSpoilers}
          commentGameUserIds={commentGameUserIds}
          commentProfileImages={commentProfileImages}
          onCommentTextChange={setCommentText}
          onSpoilerChange={setIsSpoiler}
          onReplyToChange={setReplyingToId}
          onReplyTextChange={setReplyText}
          onSubmitComment={handleSubmitComment}
          onEditComment={handleEditComment}
          onEditCommentTextChange={setEditCommentText}
          onEditCommentSpoilerChange={setEditCommentIsSpoiler}
          onSaveEditComment={handleSaveEditComment}
          onCancelEditComment={handleCancelEditComment}
          onDeleteComment={handleDeleteComment}
          onRevealSpoiler={(commentId) => {
            setRevealedSpoilers((prev) => new Set(prev).add(commentId));
          }}
          t={t}
        />
  
        {/* 공유 모달 */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          problem={problem}
          problemId={problemId}
          lang={lang}
          showToast={showToast}
          t={t}
        />
  
        {/* 오류 리포트 모달 */}
        <BugReportModal
          isOpen={showBugReportModal}
          onClose={() => {
            setShowBugReportModal(false);
            setBugReportExpected('');
            setBugReportQuestion(null);
            setBugReportAnswer(null);
          }}
          onSubmit={handleSubmitBugReport}
          problemId={problemId}
          lang={lang}
          bugReportType={bugReportType}
          bugReportExpected={bugReportExpected}
          bugReportQuestion={bugReportQuestion}
          bugReportAnswer={bugReportAnswer}
          questionText={questionText}
          suggestedAnswer={suggestedAnswer}
          userGuess={userGuess}
          similarityScore={similarityScore}
          onBugReportTypeChange={setBugReportType}
          onBugReportExpectedChange={setBugReportExpected}
          t={t}
        />
      </div>
  
      {/* CTA 바 */}
      <ProblemCTABar
        lang={lang}
        isCreatingRoom={isCreatingRoom}
        onCreateRoomClick={handleCreateRoomFromProblem}
        onPreviousClick={handlePreviousProblem}
        onNextClick={handleNextProblem}
        onInviteClick={handleCopyInviteLink}
        hasPrevious={!!previousProblem}
        hasNext={!!nextProblem}
        showAnswer={showAnswer}
      />
  
      {/* 정답 표시 버튼 (항상 볼 수 있게, 정답이 안 보일 때만) */}
      {problem && !showAnswer && (
        <div className="fixed bottom-32 sm:bottom-36 right-4 z-40">
          <button
            onClick={() => setShowAnswer(true)}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
            title={lang === 'ko' ? '정답 보기' : 'Show Answer'}
          >
            <i className="ri-eye-line"></i>
            <span className="hidden sm:inline">{lang === 'ko' ? '정답 보기' : 'Show Answer'}</span>
          </button>
        </div>
      )}

      {/* CTA 바 공간 확보 */}
      <div className="h-24 sm:h-28"></div>
    </div>
  );
}