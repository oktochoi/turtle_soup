'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { GuessCard } from '@/lib/types/guess';

export default function GuessPlayPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const setId = params?.setId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const playCountParam = searchParams?.get('count') || '10';
  const playCount = playCountParam === 'all' ? 'all' : parseInt(playCountParam);
  const timePerCardParam = searchParams?.get('time') || '30';
  const timePerCard = timePerCardParam === 'unlimited' ? null : parseInt(timePerCardParam);
  
  const [cards, setCards] = useState<GuessCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<GuessCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(timePerCard);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<Array<{card: GuessCard, isCorrect: boolean, userAnswer: string}>>([]);

  useEffect(() => {
    if (setId) {
      loadCards();
    }
  }, [setId]);

  useEffect(() => {
    // 카드가 로드되면 랜덤 선택 (Fisher-Yates 셔플)
    if (cards.length > 0 && selectedCards.length === 0) {
      const shuffled = [...cards];
      // Fisher-Yates 셔플 알고리즘
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const count = playCount === 'all' ? cards.length : playCount;
      setSelectedCards(shuffled.slice(0, Math.min(count, cards.length)));
    }
  }, [cards, playCount]);

  useEffect(() => {
    // 타이머 (무제한이 아닐 때만)
    if (timePerCard !== null && currentIndex < selectedCards.length && timeLeft !== null && timeLeft > 0 && !showResult) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timePerCard !== null && timeLeft === 0 && currentIndex < selectedCards.length) {
      // 시간 초과 - 자동으로 패스
      handlePass();
    }
  }, [timeLeft, currentIndex, selectedCards.length, showResult, timePerCard]);

  const loadCards = async () => {
    if (!setId) return;
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('guess_cards')
        .select('*')
        .eq('set_id', setId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setCards(data || []);
    } catch (error: any) {
      console.error('카드 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeAnswer = (answer: string): string => {
    return answer.trim().toLowerCase().replace(/\s+/g, ' ');
  };

  const checkAnswer = (userInput: string, correctAnswers: string[]): boolean => {
    const normalized = normalizeAnswer(userInput);
    return correctAnswers.some(correct => 
      normalizeAnswer(correct) === normalized
    );
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;

    const currentCard = selectedCards[currentIndex];
    if (!currentCard) return;

    const correct = checkAnswer(userAnswer, Array.isArray(currentCard.answers) ? currentCard.answers : []);
    setIsCorrect(correct);

    // 결과 기록
    const newResults = [...results, { card: currentCard, isCorrect: correct, userAnswer: userAnswer.trim() }];
    setResults(newResults);

    if (correct) {
      setScore(score + 1);
      // 정답이면 2초 후 다음 카드
      setTimeout(() => {
        nextCard();
      }, 2000);
    }
  };

  const handlePass = () => {
    // 패스 처리 - 오답으로 기록
    const currentCard = selectedCards[currentIndex];
    if (currentCard) {
      const newResults = [...results, { card: currentCard, isCorrect: false, userAnswer: '' }];
      setResults(newResults);
    }
    nextCard();
  };

  const nextCard = () => {
    if (currentIndex < selectedCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setTimeLeft(timePerCard);
      setIsCorrect(null);
    } else {
      // 마지막 카드
      setShowResult(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (selectedCards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{lang === 'ko' ? '카드를 불러올 수 없습니다.' : 'Cannot load cards.'}</p>
          <Link href={`/${lang}/guess/${setId}`}>
            <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg">
              {lang === 'ko' ? '돌아가기' : 'Go Back'}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (showResult) {
    const correctResults = results.filter(r => r.isCorrect);
    const incorrectResults = results.filter(r => !r.isCorrect);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* 결과 요약 */}
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 mb-6 text-center">
            <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              {lang === 'ko' ? '게임 종료!' : 'Game Over!'}
            </h1>
            <div className="text-5xl font-bold mb-4 text-teal-400">
              {score} / {selectedCards.length}
            </div>
            <p className="text-xl text-slate-300 mb-6">
              {lang === 'ko' ? `정답률: ${Math.round((score / selectedCards.length) * 100)}%` : `Accuracy: ${Math.round((score / selectedCards.length) * 100)}%`}
            </p>
          </div>

          {/* 맞춘 문제 */}
          {correctResults.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-4">
              <h2 className="text-xl font-bold mb-4 text-green-400 flex items-center gap-2">
                <i className="ri-checkbox-circle-fill"></i>
                {lang === 'ko' ? `맞춘 문제 (${correctResults.length})` : `Correct Answers (${correctResults.length})`}
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {correctResults.map((result, idx) => (
                  <div key={idx} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="text-green-400 text-lg font-bold">#{idx + 1}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-white mb-1">{result.card.question}</div>
                        <div className="text-sm text-slate-300">
                          {lang === 'ko' ? '내 답' : 'Your Answer'}: <span className="text-green-400">{result.userAnswer || (Array.isArray(result.card.answers) ? result.card.answers[0] : '')}</span>
                        </div>
                        <div className="text-sm text-slate-300">
                          {lang === 'ko' ? '정답' : 'Correct Answer'}: <span className="text-green-400">{Array.isArray(result.card.answers) ? result.card.answers.join(', ') : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 못 맞춘 문제 */}
          {incorrectResults.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
              <h2 className="text-xl font-bold mb-4 text-red-400 flex items-center gap-2">
                <i className="ri-close-circle-fill"></i>
                {lang === 'ko' ? `못 맞춘 문제 (${incorrectResults.length})` : `Incorrect Answers (${incorrectResults.length})`}
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {incorrectResults.map((result, idx) => (
                  <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="text-red-400 text-lg font-bold">#{idx + 1}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-white mb-1">{result.card.question}</div>
                        {result.userAnswer && (
                          <div className="text-sm text-slate-300 mb-1">
                            {lang === 'ko' ? '내 답' : 'Your Answer'}: <span className="text-red-400">{result.userAnswer}</span>
                          </div>
                        )}
                        <div className="text-sm text-slate-300">
                          {lang === 'ko' ? '정답' : 'Correct Answer'}: <span className="text-green-400">{Array.isArray(result.card.answers) ? result.card.answers.join(', ') : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href={`/${lang}/guess/${setId}`}>
            <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-4 py-3 rounded-xl transition-all">
              {lang === 'ko' ? '돌아가기' : 'Go Back'}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const currentCard = selectedCards[currentIndex];
  if (!currentCard) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* 진행 상태 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {currentIndex + 1} / {selectedCards.length}
            </span>
            <div className="flex-1 bg-slate-700 rounded-full h-2 max-w-xs">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / selectedCards.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {timePerCard !== null && timeLeft !== null ? (
              <div className={`text-lg font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-teal-400'}`}>
                <i className="ri-time-line mr-1"></i>
                {timeLeft}초
              </div>
            ) : (
              <div className="text-lg font-bold text-slate-400">
                <i className="ri-time-line mr-1"></i>
                {lang === 'ko' ? '무제한' : '∞'}
              </div>
            )}
            <div className="text-lg font-bold text-purple-400">
              <i className="ri-star-line mr-1"></i>
              {score}
            </div>
          </div>
        </div>

        {/* 카드 내용 */}
        <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 mb-6">
          {/* 질문 */}
          {currentCard.question && (
            <div className="text-2xl font-bold mb-4 text-white text-center">
              {currentCard.question}
            </div>
          )}

          {/* 이미지 (주관식, O/X) */}
          {(currentCard.card_type === 'text' || currentCard.card_type === 'ox') && 
           Array.isArray(currentCard.images) && 
           currentCard.images.length > 0 && (
            <div className="flex gap-4 overflow-x-auto mb-6 justify-center">
              {currentCard.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Question ${idx + 1}`}
                  className="max-h-64 object-contain rounded-lg"
                />
              ))}
            </div>
          )}

          {/* 미디어 (YouTube 영상) */}
          {currentCard.card_type === 'media' && currentCard.media_url && (
            <div className="mb-6 flex justify-center">
              {currentCard.media_url.includes('youtube.com') || currentCard.media_url.includes('youtu.be') ? (
                <div className="w-full max-w-2xl aspect-video">
                  <iframe
                    src={currentCard.media_url.replace(/youtube\.com\/watch\?v=/, 'youtube.com/embed/').replace(/youtu\.be\//, 'youtube.com/embed/').replace(/&t=(\d+)s/, '?start=$1').replace(/\?t=(\d+)s/, '?start=$1')}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full rounded-lg"
                  ></iframe>
                </div>
              ) : currentCard.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                <video
                  src={currentCard.media_url}
                  controls
                  className="max-w-full max-h-64 rounded-lg"
                />
              ) : (
                <audio
                  src={currentCard.media_url}
                  controls
                  className="w-full"
                />
              )}
            </div>
          )}

          {/* 정답 입력 (O/X가 아닐 때) */}
          {currentCard.card_type !== 'ox' && (
            <div className="mb-4">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isCorrect && userAnswer.trim()) {
                    handleSubmit();
                  }
                }}
                placeholder={lang === 'ko' ? '정답을 입력하세요' : 'Enter your answer'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isCorrect !== null}
              />
            </div>
          )}

          {/* O/X 버튼 */}
          {currentCard.card_type === 'ox' && (
            <div className="flex gap-4 mb-4 justify-center">
              <button
                onClick={() => {
                  const userAns = 'O';
                  setUserAnswer(userAns);
                  const correct = Array.isArray(currentCard.answers) && currentCard.answers[0] === 'O';
                  setIsCorrect(correct);
                  
                  // 결과 기록
                  const newResults = [...results, { card: currentCard, isCorrect: correct, userAnswer: userAns }];
                  setResults(newResults);
                  
                  if (correct) {
                    setScore(score + 1);
                    setTimeout(() => nextCard(), 1000);
                  }
                }}
                disabled={isCorrect !== null}
                className={`flex-1 p-6 rounded-lg border-2 text-4xl font-bold transition-all ${
                  isCorrect === true && userAnswer === 'O'
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : isCorrect === false && userAnswer === 'O'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600 disabled:opacity-50'
                }`}
              >
                O
              </button>
              <button
                onClick={() => {
                  const userAns = 'X';
                  setUserAnswer(userAns);
                  const correct = Array.isArray(currentCard.answers) && currentCard.answers[0] === 'X';
                  setIsCorrect(correct);
                  
                  // 결과 기록
                  const newResults = [...results, { card: currentCard, isCorrect: correct, userAnswer: userAns }];
                  setResults(newResults);
                  
                  if (correct) {
                    setScore(score + 1);
                    setTimeout(() => nextCard(), 1000);
                  }
                }}
                disabled={isCorrect !== null}
                className={`flex-1 p-6 rounded-lg border-2 text-4xl font-bold transition-all ${
                  isCorrect === true && userAnswer === 'X'
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : isCorrect === false && userAnswer === 'X'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600 disabled:opacity-50'
                }`}
              >
                X
              </button>
            </div>
          )}

          {/* 정답/오답 표시 */}
          {isCorrect === true && (
            <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-center">
              <i className="ri-checkbox-circle-fill mr-2 text-xl"></i>
              {lang === 'ko' ? '정답입니다!' : 'Correct!'}
            </div>
          )}
          {isCorrect === false && (
            <div className="mb-4">
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-center mb-2">
                <i className="ri-close-circle-fill mr-2 text-xl"></i>
                {lang === 'ko' ? '오답입니다' : 'Incorrect'}
              </div>
              <div className="text-sm text-slate-300 text-center mb-2">
                {lang === 'ko' ? '정답' : 'Answer'}: {Array.isArray(currentCard.answers) ? currentCard.answers.join(', ') : ''}
              </div>
              <button
                onClick={handlePass}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-all"
              >
                {lang === 'ko' ? '다음 문제' : 'Next'}
              </button>
            </div>
          )}

          {/* 제출/패스 버튼 */}
          {isCorrect === null && currentCard.card_type !== 'ox' && (
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-lg transition-all"
              >
                {lang === 'ko' ? '제출' : 'Submit'}
              </button>
              <button
                onClick={handlePass}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                {lang === 'ko' ? '패스' : 'Pass'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

