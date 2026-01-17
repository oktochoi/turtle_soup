'use client';

import React from 'react';
import type { Problem } from '@/lib/types';

interface QuestionInputSectionProps {
  lang: string;
  questionText: string;
  suggestedAnswer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null;
  isAnalyzing: boolean;
  localQuestions: Array<{ question: string; answer: string; timestamp: number }>;
  onQuestionTextChange: (text: string) => void;
  onSuggestedAnswerChange: (answer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null) => void;
  onAnalyzeBeforeSubmit: () => void;
  onSubmitQuestion: () => void;
  onClearLocalQuestions: () => void;
  onBugReport: (type: 'wrong_yes_no', question: string, answer: string) => void;
  getAnswerBadge: (answer: string | null) => { text: string; color: string } | null;
  t: any;
}

export default function QuestionInputSection({
  lang,
  questionText,
  suggestedAnswer,
  isAnalyzing,
  localQuestions,
  onQuestionTextChange,
  onSuggestedAnswerChange,
  onAnalyzeBeforeSubmit,
  onSubmitQuestion,
  onClearLocalQuestions,
  onBugReport,
  getAnswerBadge,
  t,
}: QuestionInputSectionProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-slate-700">
      <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
        <i className="ri-question-line text-teal-400"></i>
        {t.problem.question}
      </h2>
      <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">
        {t.problem.questionDescription}
      </p>

      <div className="space-y-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={t.problem.questionPlaceholder}
            value={questionText}
            onChange={(e) => {
              onQuestionTextChange(e.target.value);
              onSuggestedAnswerChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!suggestedAnswer) {
                  onAnalyzeBeforeSubmit();
                } else {
                  onSubmitQuestion();
                }
              }
            }}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
          />

          {!suggestedAnswer && (
            <button
              onClick={onAnalyzeBeforeSubmit}
              disabled={!questionText.trim() || isAnalyzing}
              className="px-3 sm:px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm sm:text-base touch-manipulation"
              title="AI 답변 제안 받기"
            >
              {isAnalyzing ? t.problem.analyzing : '🔧'}
            </button>
          )}
        </div>

        {/* AI 제안 답변 표시 */}
        {suggestedAnswer && (
          <div className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs sm:text-sm text-slate-300">
                {t.problem.aiSuggestedAnswer}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (questionText && suggestedAnswer) {
                      onBugReport('wrong_yes_no', questionText, suggestedAnswer);
                    }
                  }}
                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all touch-manipulation flex items-center gap-1"
                  title={lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
                >
                  <i className="ri-bug-line"></i>
                  <span className="hidden sm:inline">
                    {lang === 'ko' ? '오류 리포트' : 'Report'}
                  </span>
                </button>

                <button
                  onClick={() => onSuggestedAnswerChange(null)}
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
                  <span
                    className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}
                  >
                    {badge.text}
                  </span>
                ) : null;
              })()}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => onSuggestedAnswerChange('yes')}
                className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                  suggestedAnswer === 'yes'
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t.problem.yes}
              </button>
              <button
                onClick={() => onSuggestedAnswerChange('no')}
                className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                  suggestedAnswer === 'no'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t.problem.no}
              </button>
              <button
                onClick={() => onSuggestedAnswerChange('irrelevant')}
                className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                  suggestedAnswer === 'irrelevant'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t.problem.irrelevant}
              </button>
              <button
                onClick={() => onSuggestedAnswerChange('decisive')}
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
          onClick={onSubmitQuestion}
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
            <h3 className="text-base sm:text-lg font-semibold">
              {t.problem.questionHistory}
            </h3>
            <button
              onClick={onClearLocalQuestions}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all text-xs sm:text-sm touch-manipulation"
            >
              <i className="ri-delete-bin-line mr-1"></i>
              {t.problem.clearHistory}
            </button>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {localQuestions.map((q, index) => {
              const answerColor =
                q.answer === 'yes' || q.answer === '예'
                  ? 'text-green-400'
                  : q.answer === 'no' || q.answer === '아니오'
                  ? 'text-red-400'
                  : q.answer === 'irrelevant' || q.answer === '상관없음'
                  ? 'text-yellow-400'
                  : q.answer === 'decisive' || q.answer === '결정적인'
                  ? 'text-purple-400'
                  : 'text-slate-400';

              return (
                <div
                  key={index}
                  className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700"
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-cyan-400 flex-shrink-0">
                        Q:
                      </span>
                      <p className="text-xs sm:text-sm text-white flex-1 break-words">
                        {q.question}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-teal-400 flex-shrink-0">
                        A:
                      </span>
                      <p className={`text-xs sm:text-sm font-semibold ${answerColor}`}>
                        {q.answer}
                      </p>
                    </div>

                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => {
                          onBugReport('wrong_yes_no', q.question, q.answer);
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
    </div>
  );
}

