'use client';

import React from 'react';
import type { Problem } from '@/lib/types';

interface AnswerInputSectionProps {
  lang: string;
  problem: Problem | null;
  userGuess: string;
  similarityScore: number | null;
  isCalculatingSimilarity: boolean;
  hasSubmittedAnswer: boolean;
  showAnswer: boolean;
  showHints: boolean[];
  hints: string[] | null | undefined;
  cooldownRemaining: number; // 0이면 제출 가능, >0이면 남은 초
  onUserGuessChange: (guess: string) => void;
  onSubmitAnswer: () => Promise<void>;
  onShowAnswerToggle: () => void;
  onShowHintsChange: (hints: boolean[]) => void;
  onBugReport: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  t: any;
}

export default function AnswerInputSection({
  lang,
  problem,
  userGuess,
  similarityScore,
  isCalculatingSimilarity,
  hasSubmittedAnswer,
  showAnswer,
  showHints,
  hints,
  cooldownRemaining,
  onUserGuessChange,
  onSubmitAnswer,
  onShowAnswerToggle,
  onShowHintsChange,
  onBugReport,
  showToast,
  t,
}: AnswerInputSectionProps) {
  const isCooldown = cooldownRemaining > 0;
  return (
    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <i className="ri-checkbox-circle-line text-purple-400"></i>
          {t.problem.submitAnswerTitle}
        </h3>

        <button
          onClick={() => {
            if (userGuess && problem) {
              onBugReport();
            } else {
              alert(
                lang === 'ko'
                  ? '정답을 입력한 후 오류를 신고할 수 있습니다.'
                  : 'Please enter an answer before reporting an error.'
              );
            }
          }}
          className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all touch-manipulation flex items-center gap-1"
          title={lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
        >
          <i className="ri-bug-line"></i>
          <span className="hidden sm:inline">{lang === 'ko' ? '오류 리포트' : 'Report'}</span>
        </button>
      </div>

      <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">
        {t.problem.submitAnswerDescription}
      </p>

      <div className="space-y-3">
        <textarea
          placeholder={t.problem.answerPlaceholder}
          value={userGuess}
          onChange={(e) => {
            onUserGuessChange(e.target.value);
          }}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 sm:h-32 resize-none text-sm sm:text-base"
          maxLength={500}
        />

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {userGuess.length} / 500
          </span>

          <button
            onClick={onSubmitAnswer}
            disabled={!userGuess.trim() || isCalculatingSimilarity || isCooldown}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm whitespace-nowrap touch-manipulation"
          >
            {isCalculatingSimilarity ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-1"></i>
                {t.problem.calculating}
              </>
            ) : isCooldown ? (
              <>
                <i className="ri-time-line mr-1"></i>
                {t.problem.answerCooldownRemaining.replace('{seconds}', String(cooldownRemaining))}
              </>
            ) : (
              <>
                <i className="ri-checkbox-circle-line mr-1"></i>
                {t.problem.submitAnswer}
              </>
            )}
          </button>
        </div>

        {/* 유사도 결과 */}
        {similarityScore !== null && (
          <div
            className={`mt-3 rounded-lg p-4 border ${
              similarityScore >= 80
                ? 'bg-green-500/10 border-green-500/50'
                : similarityScore >= 60
                ? 'bg-yellow-500/10 border-yellow-500/50'
                : 'bg-red-500/10 border-red-500/50'
            }`}
          >
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
                <span
                  className={`text-xl sm:text-2xl font-bold ${
                    similarityScore >= 80
                      ? 'text-green-400'
                      : similarityScore >= 60
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {similarityScore}%
                </span>

                <button
                  onClick={onBugReport}
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

        {/* 힌트: details/summary로 HTML에 포함 (AdSense 인덱싱) + 접기(UX) */}
        {problem &&
          hints &&
          Array.isArray(hints) &&
          hints.length > 0 && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
              <h3 className="text-sm sm:text-base font-semibold mb-3 text-yellow-400">
                <i className="ri-lightbulb-line mr-2"></i>
                {lang === 'ko' ? '힌트' : 'Hints'}
              </h3>

              <div className="space-y-2">
                {hints.map((hint, index) => (
                  <details key={index} className="group">
                    <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                      <div className="bg-slate-800/50 rounded-lg border border-slate-700 hover:border-yellow-500/30 transition-colors px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm sm:text-base text-slate-300">
                          <i className="ri-lightbulb-flash-line mr-2 text-yellow-400"></i>
                          {lang === 'ko' ? `힌트 ${index + 1}` : `Hint ${index + 1}`}
                        </span>
                        <i className="ri-arrow-down-s-line text-slate-400 group-open:rotate-180 transition-transform"></i>
                      </div>
                    </summary>
                    <div className="px-4 pb-3 pt-2 border border-slate-700 border-t-0 rounded-b-lg bg-slate-800/50">
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {hint}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

        {/* 정답: details/summary로 HTML에 포함 (AdSense 인덱싱) + 접기(UX 스포일러 방지) */}
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
          {problem && (
            <details className="group">
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                <div className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2.5 sm:py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation">
                  <i className="ri-eye-line group-open:hidden"></i>
                  <i className="ri-eye-off-line hidden group-open:inline"></i>
                  <span className="group-open:hidden">{t.problem.showAnswer}</span>
                  <span className="hidden group-open:inline">{t.problem.hideAnswer}</span>
                </div>
              </summary>
              <div className="mt-3 sm:mt-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-3 sm:p-4 lg:p-6 border border-purple-500/50">
                <h3 className="font-semibold mb-2 sm:mb-3 text-purple-400 text-sm sm:text-base">
                  {t.problem.answer}
                </h3>
                <p className="text-xs sm:text-sm lg:text-base leading-relaxed whitespace-pre-wrap break-words">
                  {problem.answer}
                </p>
              </div>
            </details>
          )}

          {/* 해설 & 추리 포인트: HTML에 포함(AdSense 인덱싱) + 접기(UX 스포일러 방지) */}
          {problem && (problem as any).explanation && (
            <details className="mt-4 sm:mt-6 group">
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-teal-500/30 transition-colors flex items-center justify-between">
                  <span className="font-semibold text-teal-400 text-sm sm:text-base flex items-center gap-2">
                    <i className="ri-book-open-line"></i>
                    {lang === 'ko' ? '해설 및 추리 포인트 보기' : 'View Explanation & Deduction Points'}
                  </span>
                  <i className="ri-arrow-down-s-line text-xl text-slate-400 group-open:rotate-180 transition-transform"></i>
                </div>
              </summary>
              <div className="mt-2 bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-slate-700/50 border-t-0 rounded-t-none">
                <p className="text-xs sm:text-sm lg:text-base leading-relaxed whitespace-pre-wrap text-slate-300">
                  {(problem as any).explanation}
                </p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

