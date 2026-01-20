'use client';

import Link from 'next/link';
import UserLabel from '@/components/UserLabel';
import QuizPlayMCQ from '@/components/quiz/QuizPlayMCQ';
import QuizPlayOX from '@/components/quiz/QuizPlayOX';
import QuizPlayImage from '@/components/quiz/QuizPlayImage';
import QuizPlayBalance from '@/components/quiz/QuizPlayBalance';
import QuizPlayNonsense from '@/components/quiz/QuizPlayNonsense';
import QuizPlayLogic from '@/components/quiz/QuizPlayLogic';
import QuizPlayPattern from '@/components/quiz/QuizPlayPattern';
import QuizPlayFillBlank from '@/components/quiz/QuizPlayFillBlank';
import QuizPlayOrder from '@/components/quiz/QuizPlayOrder';
import type { Problem } from '@/lib/types';
import type { QuizType } from '@/lib/types/quiz';

interface ProblemContentProps {
  problem: Problem;
  lang: string;
  quizType: QuizType;
  quizContent: any;
  authorGameUserId: string | null;
  authorProfileImage?: string | null;
  isEditing: boolean;
  editTitle: string;
  editContent: string;
  editAnswer: string;
  onEditTitleChange: (value: string) => void;
  onEditContentChange: (value: string) => void;
  onEditAnswerChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  userQuizAnswer: any;
  onQuizAnswer: (answer: any) => void;
  quizShowAnswer: boolean;
  balanceVoteStats: number[];
  onBalanceVoteStatsChange: (stats: number[]) => void;
  hasVoted?: boolean; // 이미 투표했는지 여부 (밸런스 게임, 투표)
  t: any;
}

export default function ProblemContent({
  problem,
  lang,
  quizType,
  quizContent,
  authorGameUserId,
  authorProfileImage,
  isEditing,
  editTitle,
  editContent,
  editAnswer,
  onEditTitleChange,
  onEditContentChange,
  onEditAnswerChange,
  onSaveEdit,
  onCancelEdit,
  userQuizAnswer,
  onQuizAnswer,
  quizShowAnswer,
  balanceVoteStats,
  onBalanceVoteStatsChange,
  hasVoted = false,
  t,
}: ProblemContentProps) {
  if (isEditing) {
    return (
      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-300">{t.problem.problemTitle}</label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            maxLength={100}
          />
        </div>
        {quizType === 'soup' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">{t.problem.problemContent}</label>
              <textarea
                value={editContent}
                onChange={(e) => onEditContentChange(e.target.value)}
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
                onChange={(e) => onEditAnswerChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-40 resize-none text-sm"
                maxLength={2000}
              />
              <div className="text-right text-xs text-slate-500 mt-1">
                {editAnswer.length} / 2000
              </div>
            </div>
          </>
        )}
        <div className="flex gap-3">
          <button
            onClick={onSaveEdit}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 rounded-lg transition-all"
          >
            {t.common.save}
          </button>
          <button
            onClick={onCancelEdit}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition-all"
          >
            {t.common.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Soup 타입: 기존 방식 */}
      {quizType === 'soup' && (
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-4 border border-slate-700/50">
          {(problem.author || (problem as any).original_author) && (
            <div className="mb-3 pb-3 border-b border-slate-700 space-y-2">
              {problem.author && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                  <span>{t.problem.author}:</span>
                  {authorGameUserId ? (
                    <Link href={`/${lang}/profile/${authorGameUserId}`} className="hover:opacity-80 transition-opacity">
                      <UserLabel
                        userId={authorGameUserId}
                        nickname={problem.author}
                        size="sm"
                        showProfileImage={true}
                        profileImageUrl={authorProfileImage || null}
                      />
                    </Link>
                  ) : (
                    <span className="text-cyan-400">{problem.author}</span>
                  )}
                </div>
              )}
              {((problem as any).original_author || (problem as any).original_title) && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 flex-wrap">
                  <i className="ri-user-star-line text-purple-400"></i>
                  <span>{lang === 'ko' ? '원작' : 'Original'}:</span>
                  {(problem as any).original_title && (
                    <a
                      href={(problem as any).source_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
                      onClick={(e) => {
                        if (!(problem as any).source_url) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {(problem as any).original_title}
                    </a>
                  )}
                  {(problem as any).original_author && (
                    <>
                      {((problem as any).original_title) && <span className="text-slate-500">·</span>}
                      <a
                        href={(problem as any).source_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
                        onClick={(e) => {
                          if (!(problem as any).source_url) {
                            e.preventDefault();
                          }
                        }}
                      >
                        {(problem as any).original_author}
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{problem.content}</p>
        </div>
      )}

      {/* 다른 퀴즈 타입: 플레이 컴포넌트 */}
      {quizType !== 'soup' && quizContent && (
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-4 border border-slate-700/50">
          {(problem.author || (problem as any).original_author) && (
            <div className="mb-3 pb-3 border-b border-slate-700 space-y-2">
              {problem.author && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                  <span>{t.problem.author}:</span>
                  {authorGameUserId ? (
                    <Link href={`/${lang}/profile/${authorGameUserId}`} className="hover:opacity-80 transition-opacity">
                      <UserLabel
                        userId={authorGameUserId}
                        nickname={problem.author}
                        size="sm"
                        showProfileImage={true}
                        profileImageUrl={authorProfileImage || null}
                      />
                    </Link>
                  ) : (
                    <span className="text-cyan-400">{problem.author}</span>
                  )}
                </div>
              )}
              {((problem as any).original_author || (problem as any).original_title) && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 flex-wrap">
                  <i className="ri-user-star-line text-purple-400"></i>
                  <span>{lang === 'ko' ? '원작' : 'Original'}:</span>
                  {(problem as any).original_title && (
                    <a
                      href={(problem as any).source_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
                      onClick={(e) => {
                        if (!(problem as any).source_url) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {(problem as any).original_title}
                    </a>
                  )}
                  {(problem as any).original_author && (
                    <>
                      {((problem as any).original_title) && <span className="text-slate-500">·</span>}
                      <a
                        href={(problem as any).source_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
                        onClick={(e) => {
                          if (!(problem as any).source_url) {
                            e.preventDefault();
                          }
                        }}
                      >
                        {(problem as any).original_author}
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MCQ 퀴즈 */}
          {quizType === 'mcq' && quizContent.options && (
            <QuizPlayMCQ
              content={{
                question: problem.title, // 제목을 문제로 사용
                options: quizContent.options,
                correct: quizContent.correct ?? 0,
                explanation: quizContent.explanation,
              }}
              onAnswer={(selectedIndex) => {
                onQuizAnswer(selectedIndex);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={userQuizAnswer ?? undefined}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* OX 퀴즈 */}
          {quizType === 'ox' && (
            <QuizPlayOX
              question={problem.title} // 제목을 문제로 사용
              correct={quizContent.correct === 0 ? 'O' : 'X'}
              onAnswer={(answer) => {
                onQuizAnswer(answer);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={userQuizAnswer ?? undefined}
              explanation={quizContent.explanation}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 이미지 퀴즈 */}
          {quizType === 'image' && quizContent.image_url && (
            <QuizPlayImage
              imageUrl={quizContent.image_url}
              question={problem.title} // 제목을 문제로 사용
              answer={quizContent.answer || problem.answer || ''}
              onAnswer={(userAnswer) => {
                onQuizAnswer(userAnswer);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={typeof userQuizAnswer === 'string' ? userQuizAnswer : undefined}
              explanation={quizContent.explanation}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 넌센스 퀴즈 */}
          {quizType === 'nonsense' && quizContent.answer && (
            <QuizPlayNonsense
              question={problem.title} // 제목을 문제로 사용
              answer={quizContent.answer}
              explanation={quizContent.explanation}
              onAnswer={(userAnswer) => {
                onQuizAnswer(userAnswer);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={typeof userQuizAnswer === 'string' ? userQuizAnswer : undefined}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 논리 퍼즐 */}
          {quizType === 'logic' && quizContent.content && quizContent.answer && (
            <QuizPlayLogic
              question={problem.title} // 제목을 문제로 사용
              content={quizContent.content}
              answer={quizContent.answer}
              explanation={quizContent.explanation}
              onAnswer={(userAnswer) => {
                onQuizAnswer(userAnswer);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={typeof userQuizAnswer === 'string' ? userQuizAnswer : undefined}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 패턴 퀴즈 */}
          {quizType === 'pattern' && quizContent.pattern && quizContent.answer && (
            <QuizPlayPattern
              question={problem.title} // 제목을 문제로 사용
              pattern={quizContent.pattern}
              answer={quizContent.answer}
              explanation={quizContent.explanation}
              onAnswer={(userAnswer) => {
                onQuizAnswer(userAnswer);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={typeof userQuizAnswer === 'string' ? userQuizAnswer : undefined}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 빈칸 퀴즈 */}
          {quizType === 'fill_blank' && quizContent.answer && (
            <QuizPlayFillBlank
              question={problem.title} // 제목을 문제로 사용 (빈칸 포함)
              answer={quizContent.answer}
              explanation={quizContent.explanation}
              onAnswer={(userAnswer) => {
                onQuizAnswer(userAnswer);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={typeof userQuizAnswer === 'string' ? userQuizAnswer : undefined}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 순서맞추기 */}
          {quizType === 'order' && quizContent.items && quizContent.correctOrder && (
            <QuizPlayOrder
              question={problem.title} // 제목을 문제로 사용
              items={quizContent.items}
              correctOrder={quizContent.correctOrder}
              explanation={quizContent.explanation}
              onAnswer={(order) => {
                onQuizAnswer(order);
              }}
              showAnswer={quizShowAnswer}
              userAnswer={Array.isArray(userQuizAnswer) ? userQuizAnswer : undefined}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
            />
          )}

          {/* 밸런스 게임 */}
          {quizType === 'balance' && quizContent.options && quizContent.options.length >= 2 && (
            <>
              <QuizPlayBalance
                question={problem.title}
                options={quizContent.options}
                onAnswer={async (selectedIndex) => {
                  if (!hasVoted) {
                    onQuizAnswer(selectedIndex);
                    // 통계는 부모 컴포넌트에서 처리
                  }
                }}
                showAnswer={quizShowAnswer || hasVoted}
                userAnswer={typeof userQuizAnswer === 'number' ? userQuizAnswer : undefined}
                stats={balanceVoteStats}
                lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
              />
              {quizContent.description && (
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{quizContent.description}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

