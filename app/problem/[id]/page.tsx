'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Problem, ProblemQuestion, ProblemComment } from '@/lib/types';
import { analyzeQuestion } from '@/lib/ai-analyzer';
import ProblemAdminButtons from './ProblemAdminButtons';

export default function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const problemId = resolvedParams.id;
  const router = useRouter();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [questions, setQuestions] = useState<ProblemQuestion[]>([]);
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentNickname, setCommentNickname] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedAnswer, setSuggestedAnswer] = useState<'yes' | 'no' | 'irrelevant' | 'decisive' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [localQuestions, setLocalQuestions] = useState<Array<{ question: string; answer: string; timestamp: number }>>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editDifficulty, setEditDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useEffect(() => {
    loadProblem();
    loadQuestions();
    loadComments();
    checkLike();
    loadLocalQuestions();
    loadRating();
  }, [problemId]);

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
          await supabase.rpc('increment_problem_view', { problem_id: problemId });
        } catch (error) {
          // RPC 함수가 없으면 직접 업데이트
          await supabase
            .from('problems')
            .update({ view_count: (problem.view_count || 0) + 1 })
            .eq('id', problemId);
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
    } catch (error) {
      console.error('문제 로드 오류:', error);
      alert('문제를 불러올 수 없습니다.');
      router.push('/');
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
    } catch (error) {
      console.error('댓글 로드 오류:', error);
    }
  };

  const checkLike = async () => {
    try {
      const userIdentifier = localStorage.getItem('user_id') || 'anonymous';
      const { data } = await supabase
        .from('problem_likes')
        .select('id')
        .eq('problem_id', problemId)
        .eq('user_identifier', userIdentifier)
        .single();

      setIsLiked(!!data);
    } catch (error) {
      // 좋아요가 없으면 에러가 발생할 수 있음 (정상)
    }
  };

  const loadRating = async () => {
    try {
      const userIdentifier = localStorage.getItem('user_id') || 'anonymous';
      
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

      // 사용자 별점 확인
      const { data: userRatingData } = await supabase
        .from('problem_difficulty_ratings')
        .select('rating')
        .eq('problem_id', problemId)
        .eq('user_identifier', userIdentifier)
        .single();

      setUserRating(userRatingData?.rating || null);
    } catch (error) {
      console.error('별점 로드 오류:', error);
    }
  };

  const handleRatingClick = async (rating: number) => {
    try {
      const userIdentifier = localStorage.getItem('user_id') || 'anonymous';
      
      // 기존 별점이 있으면 업데이트, 없으면 생성
      const { data: existing } = await supabase
        .from('problem_difficulty_ratings')
        .select('id')
        .eq('problem_id', problemId)
        .eq('user_identifier', userIdentifier)
        .single();

      if (existing) {
        // 업데이트
        const { error } = await supabase
          .from('problem_difficulty_ratings')
          .update({ rating, updated_at: new Date().toISOString() })
          .eq('problem_id', problemId)
          .eq('user_identifier', userIdentifier);

        if (error) throw error;
      } else {
        // 생성
        const { error } = await supabase
          .from('problem_difficulty_ratings')
          .insert({
            problem_id: problemId,
            user_identifier: userIdentifier,
            rating,
          });

        if (error) throw error;
      }

      setUserRating(rating);
      await loadRating(); // 평균 별점 다시 계산
    } catch (error) {
      console.error('별점 투표 오류:', error);
      alert('별점 투표에 실패했습니다.');
    }
  };

  const handleAnalyzeQuestion = async () => {
    if (!questionText.trim() || !problem) return;

    setIsAnalyzing(true);
    try {
      const answer = await analyzeQuestion(questionText, problem.content, problem.answer);
      setSuggestedAnswer(answer);
    } catch (error) {
      console.error('질문 분석 오류:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeBeforeSubmit = async () => {
    if (!questionText.trim() || !problem) {
      alert('질문을 입력해주세요.');
      return;
    }

    // AI가 답변 제안
    setIsAnalyzing(true);
    let aiAnswer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null = null;
    
    try {
      aiAnswer = await analyzeQuestion(questionText, problem.content, problem.answer);
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
      alert('질문을 입력해주세요.');
      return;
    }

    if (!problem) {
      alert('문제 정보를 불러올 수 없습니다.');
      return;
    }

    // 질문 제출 시 자동으로 AI 분석 실행
    setIsAnalyzing(true);
    let aiAnswer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null = null;
    
    try {
      // AI가 답변 제안
      aiAnswer = await analyzeQuestion(questionText.trim(), problem.content, problem.answer);
      setSuggestedAnswer(aiAnswer);
      
      // AI 제안 답변 사용
      const finalAnswer = aiAnswer || 'irrelevant';
      const answerText = finalAnswer === 'yes' ? '예' : 
                        finalAnswer === 'no' ? '아니오' : 
                        finalAnswer === 'irrelevant' ? '상관없음' : 
                        finalAnswer === 'decisive' ? '결정적인' : '대기중';
      
      // 로컬스토리지에 저장 (DB에는 저장하지 않음)
      saveLocalQuestion(questionText.trim(), answerText);
      setQuestionText('');
      setSuggestedAnswer(null);
    } catch (error) {
      console.error('AI 분석 오류:', error);
      // 오류 발생 시에도 질문은 저장 (답변은 '대기중'으로)
      saveLocalQuestion(questionText.trim(), '대기중');
      setQuestionText('');
      setSuggestedAnswer(null);
      alert('AI 분석 중 오류가 발생했습니다. 질문은 저장되었습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !commentNickname.trim()) {
      alert('닉네임과 댓글을 입력해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('problem_comments')
        .insert({
          problem_id: problemId,
          nickname: commentNickname.trim(),
          text: commentText.trim(),
        });

      if (error) throw error;

      setCommentText('');
      loadComments();
    } catch (error) {
      console.error('댓글 제출 오류:', error);
      alert('댓글 제출에 실패했습니다.');
    }
  };

  const handleLike = async () => {
    if (!problem) return;

    const previousIsLiked = isLiked;
    const previousLikeCount = problem.like_count || 0;

    try {
      // 사용자 식별자 가져오기 또는 생성
      let userIdentifier = localStorage.getItem('user_id');
      if (!userIdentifier) {
        userIdentifier = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('user_id', userIdentifier);
      }

      // Optimistic UI 업데이트
      const newIsLiked = !isLiked;
      const newLikeCount = newIsLiked 
        ? previousLikeCount + 1 
        : Math.max(previousLikeCount - 1, 0);
      
      setIsLiked(newIsLiked);
      setProblem(prev => prev ? { ...prev, like_count: newLikeCount } : null);

      if (newIsLiked) {
        // 좋아요 추가
        const { error } = await supabase
          .from('problem_likes')
          .insert({
            problem_id: problemId,
            user_identifier: userIdentifier,
          });

        if (error) {
          // UNIQUE 제약 조건 위반 (이미 좋아요가 있는 경우)
          if (error.code === '23505') {
            // 이미 좋아요가 있으므로 상태만 업데이트
            setIsLiked(true);
            return;
          }
          throw error;
        }
      } else {
        // 좋아요 취소
        const { error: deleteError } = await supabase
          .from('problem_likes')
          .delete()
          .eq('problem_id', problemId)
          .eq('user_identifier', userIdentifier);

        if (deleteError) throw deleteError;

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
    } catch (error) {
      console.error('좋아요 오류:', error);
      // 실패 시 롤백
      setIsLiked(previousIsLiked);
      setProblem(prev => prev ? { ...prev, like_count: previousLikeCount } : null);
      alert('좋아요 처리에 실패했습니다.');
    }
  };

  const handleAdminLogin = () => {
    if (!problem) return;
    
    if (adminPassword === problem.admin_password) {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPassword('');
      alert('관리자 모드가 활성화되었습니다.');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
      setAdminPassword('');
    }
  };

  const handleAnswerQuestion = async (questionId: string, answer: 'yes' | 'no' | 'irrelevant' | 'decisive') => {
    if (!isAdmin) return;

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
      alert('답변 제출에 실패했습니다.');
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !problem) return;

    if (!editTitle.trim() || !editContent.trim() || !editAnswer.trim()) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('problems')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          answer: editAnswer.trim(),
          difficulty: editDifficulty,
          tags: editTags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', problemId);

      if (error) throw error;

      setIsEditing(false);
      loadProblem();
      alert('문제가 수정되었습니다.');
    } catch (error) {
      console.error('문제 수정 오류:', error);
      alert('문제 수정에 실패했습니다.');
    }
  };

  const handleCancelEdit = () => {
    if (problem) {
      setEditTitle(problem.title);
      setEditContent(problem.content);
      setEditAnswer(problem.answer);
      setEditDifficulty(problem.difficulty);
      setEditTags(problem.tags);
    }
    setIsEditing(false);
  };

  const toggleTag = (tag: string) => {
    setEditTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const AVAILABLE_TAGS = [
    '공포', '추리', '개그', '역사', '과학', '일상', '판타지', '미스터리',
    '로맨스', '액션', '스릴러', '코미디', '드라마', 'SF', '호러', '범죄',
    '심리', '철학', '종교', '정치', '경제', '스포츠', '음악', '예술',
    '문학', '동물', '자연', '우주', '시간여행', '초능력', '좀비', '뱀파이어',
    '마법', '전쟁', '모험', '서바이벌', '의학', '법률', '교육', '직업'
  ];

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
      yes: { text: '예', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
      no: { text: '아니오', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      irrelevant: { text: '상관없음', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      decisive: { text: '결정적인', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    };
    return badges[answer as keyof typeof badges];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">문제를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">문제를 찾을 수 없습니다.</p>
          <Link href="/" className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const difficultyBadge = getDifficultyFromRating(averageRating);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-4xl">
        <div className="mb-4 sm:mb-6">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              돌아가기
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
                <span>출제자: {problem.author}</span>
                <div className="flex items-center gap-2 flex-wrap">
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
              {isAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-purple-500/50">
                    <span className="text-purple-400 text-xs font-semibold">
                      <i className="ri-vip-crown-line mr-1"></i>
                      관리자
                    </span>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all text-xs sm:text-sm"
                    >
                      <i className="ri-edit-line mr-1"></i>
                      <span className="hidden sm:inline">수정</span>
                    </button>
                  )}
                </div>
              )}
              {!isAdmin && (
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all text-xs sm:text-sm"
                >
                  <i className="ri-settings-3-line mr-1"></i>
                  <span className="hidden sm:inline">관리자 모드</span>
                </button>
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
              <div className="flex items-center gap-1 sm:gap-2 text-slate-400 text-xs sm:text-sm">
                <i className="ri-chat-3-line"></i>
                <span>{problem.comment_count}</span>
              </div>
            </div>
          </div>

          {/* 별점 투표 */}
          <div className="mb-4 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap">난이도 평가:</span>
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
                  평균: ⭐ {averageRating.toFixed(1)} ({ratingCount}명 평가)
                </span>
              )}
              {averageRating === 0 && (
                <span className="text-xs sm:text-sm text-slate-500">아직 평가가 없습니다</span>
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
                <label className="block text-sm font-medium mb-2 text-slate-300">제목</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">내용</label>
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
                <label className="block text-sm font-medium mb-2 text-slate-300">정답</label>
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
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">난이도</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditDifficulty('easy')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      editDifficulty === 'easy'
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    쉬움
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDifficulty('medium')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      editDifficulty === 'medium'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    중간
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDifficulty('hard')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      editDifficulty === 'hard'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    어려움
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">해시태그</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        editTags.includes(tag)
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {editTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editTags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 rounded-lg transition-all"
                >
                  저장
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition-all"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-lg p-4 sm:p-6 mb-4">
              <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{problem.content}</p>
            </div>
          )}

        </div>

        {/* 질문하기 섹션 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <i className="ri-question-line text-teal-400"></i>
            질문하기
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">예/아니오로 답변 가능한 질문을 입력하세요. 질문을 제출하면 AI가 자동으로 답변을 제안합니다:</p>
          
          <div className="space-y-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="질문을 입력하세요..."
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
                  {isAnalyzing ? '분석 중...' : '🔧'}
                </button>
              )}
            </div>
            
            {/* AI 제안 답변 표시 및 수정 */}
            {suggestedAnswer && (
              <div className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs sm:text-sm text-slate-300">AI 제안 답변:</p>
                  <button
                    onClick={() => setSuggestedAnswer(null)}
                    className="text-xs text-slate-400 hover:text-slate-300 touch-manipulation"
                  >
                    다시 분석
                  </button>
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
                    예
                  </button>
                  <button
                    onClick={() => setSuggestedAnswer('no')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'no'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    아니오
                  </button>
                  <button
                    onClick={() => setSuggestedAnswer('irrelevant')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'irrelevant'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    상관없음
                  </button>
                  <button
                    onClick={() => setSuggestedAnswer('decisive')}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                      suggestedAnswer === 'decisive'
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    결정적인
                  </button>
                </div>
              </div>
            )}
            
            <button
              onClick={handleSubmitQuestion}
              disabled={!questionText.trim() || isAnalyzing}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
            >
              질문하기
            </button>
          </div>

          {/* 로컬 질문 내역 */}
          {localQuestions.length > 0 && (
            <div className="mt-4 sm:mt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3">
                <h3 className="text-base sm:text-lg font-semibold">질문 내역</h3>
                <button
                  onClick={clearLocalQuestions}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all text-xs sm:text-sm touch-manipulation"
                >
                  <i className="ri-delete-bin-line mr-1"></i>
                  질문내역 지우기
                </button>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {localQuestions.map((q, index) => {
                  const answerColor = q.answer === '예' ? 'text-green-400' :
                                     q.answer === '아니오' ? 'text-red-400' :
                                     q.answer === '상관없음' ? 'text-yellow-400' :
                                     q.answer === '결정적인' ? 'text-purple-400' :
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DB 질문 목록 (관리자용) */}
          {isAdmin && questions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">DB 질문 목록 (관리자)</h3>
              <div className="space-y-3">
                {questions.map(q => {
                  const badge = getAnswerBadge(q.answer);
                  return (
                    <div 
                      key={q.id} 
                      className={`bg-slate-900 rounded-lg p-4 border transition-all ${
                        selectedQuestionId === q.id && isAdmin
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-700'
                      } ${isAdmin && !q.answer ? 'cursor-pointer hover:border-purple-500/50' : ''}`}
                      onClick={() => {
                        if (isAdmin && !q.answer) {
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
          {isAdmin && selectedQuestionId && (
            <div className="mt-4">
              <ProblemAdminButtons
                onAnswer={(answer) => handleAnswerQuestion(selectedQuestionId, answer)}
              />
            </div>
          )}

          {/* 정답 확인하기 버튼 */}
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2.5 sm:py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
            >
              {showAnswer ? (
                <>
                  <i className="ri-eye-off-line"></i>
                  정답 숨기기
                </>
              ) : (
                <>
                  <i className="ri-eye-line"></i>
                  정답 확인하기
                </>
              )}
            </button>

            {/* 정답 */}
            {showAnswer && (
              <div className="mt-3 sm:mt-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-3 sm:p-4 lg:p-6 border border-purple-500/50">
                <h3 className="font-semibold mb-2 sm:mb-3 text-purple-400 text-sm sm:text-base">정답</h3>
                <p className="text-xs sm:text-sm lg:text-base leading-relaxed whitespace-pre-wrap break-words">{problem.answer}</p>
              </div>
            )}
          </div>
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 border border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <i className="ri-chat-3-line text-teal-400"></i>
            댓글
          </h2>
          <div className="space-y-3 mb-4">
            <input
              type="text"
              placeholder="닉네임"
              value={commentNickname}
              onChange={(e) => setCommentNickname(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
              maxLength={20}
            />
            <textarea
              placeholder="댓글을 입력하세요..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 h-24 resize-none text-sm sm:text-base"
              maxLength={500}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || !commentNickname.trim()}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
            >
              댓글 작성
            </button>
          </div>

          {/* 댓글 목록 */}
          <div className="space-y-2 sm:space-y-3 mt-4 sm:mt-6">
            {comments.length === 0 ? (
              <p className="text-slate-400 text-xs sm:text-sm">아직 댓글이 없습니다.</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-cyan-400 break-words">{comment.nickname}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-white break-words">{comment.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 관리자 모드 로그인 모달 */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 max-w-md w-full border border-slate-700">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-white">관리자 모드</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">관리 비밀번호를 입력하세요.</p>
            <input
              type="password"
              placeholder="관리 비밀번호"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAdminLogin();
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3 sm:mb-4 text-sm sm:text-base"
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleAdminLogin}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all text-sm sm:text-base touch-manipulation"
              >
                로그인
              </button>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminPassword('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all text-sm sm:text-base touch-manipulation"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

