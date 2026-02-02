'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ProblemUserAnswer, ProblemAnswerReply } from '@/lib/types';

type AnswerSortOption = 'latest' | 'popular' | 'accuracy';

type ReportType = 'spam' | 'harassment' | 'inappropriate_content' | 'other';

interface UserAnswersFeedProps {
  lang: string;
  problemId: string;
  user: any;
  answers: ProblemUserAnswer[];
  answerLikes: Map<string, boolean>;
  answerReplies: Map<string, ProblemAnswerReply[]>;
  answerGameUserIds: Map<string, string>;
  answerProfileImages: Map<string, string | null>;
  onLoadAnswers: () => Promise<void>;
  onLikeAnswer: (answerId: string) => Promise<void>;
  onDeleteAnswer: (answerId: string) => Promise<void>;
  onReportAnswer: (answerId: string, reportType: ReportType) => Promise<void>;
  onSubmitReply: (answerId: string, text: string) => Promise<void>;
  getSimilarityColor: (score: number) => string;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  t: any;
}

export default function UserAnswersFeed({
  lang,
  problemId,
  user,
  answers,
  answerLikes,
  answerReplies,
  answerGameUserIds,
  answerProfileImages,
  onLoadAnswers,
  onLikeAnswer,
  onDeleteAnswer,
  onReportAnswer,
  onSubmitReply,
  getSimilarityColor,
  showToast,
  t,
}: UserAnswersFeedProps) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<AnswerSortOption>('latest');
  const [reportingAnswerId, setReportingAnswerId] = useState<string | null>(null);

  const sortedAnswers = [...answers].sort((a, b) => {
    switch (sortOption) {
      case 'popular':
        return (b.like_count || 0) - (a.like_count || 0);
      case 'accuracy':
        const scoreA = a.similarity_score ?? -1;
        const scoreB = b.similarity_score ?? -1;
        return scoreB - scoreA;
      default: // latest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const handleSubmitReply = async (answerId: string) => {
    if (!replyText.trim() || !user) return;
    setIsSubmittingReply(true);
    try {
      await onSubmitReply(answerId, replyText.trim());
      setReplyText('');
      setReplyingToId(null);
      await onLoadAnswers();
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const toggleReplies = (answerId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  };

  if (answers.length === 0) return null;

  return (
    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <i className="ri-group-line text-cyan-400"></i>
          {t.problem.userAnswersTitle}
        </h3>
        <div className="flex gap-1">
          {(['latest', 'popular', 'accuracy'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortOption(opt)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                sortOption === opt
                  ? 'bg-teal-500/30 text-teal-400 border border-teal-500/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700'
              }`}
            >
              {opt === 'latest' ? t.problem.sortLatest : opt === 'popular' ? t.problem.sortPopular : t.problem.sortAccuracy}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 sm:space-y-4">
        {sortedAnswers.map((answer) => {
          const isLiked = answerLikes.get(answer.id) ?? false;
          const replies = answerReplies.get(answer.id) || [];
          const hasReplies = replies.length > 0;
          const isExpanded = expandedReplies.has(answer.id);
          const isReplying = replyingToId === answer.id;
          const isOwnAnswer = user && answer.user_id === user.id;

          return (
            <div
              key={answer.id}
              className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {answerGameUserIds.get(answer.id) ? (
                    <Link href={`/${lang}/profile/${answerGameUserIds.get(answer.id)}`} className="hover:opacity-80 transition-opacity block">
                      {answerProfileImages.get(answer.id) ? (
                        <img
                          src={answerProfileImages.get(answer.id)!}
                          alt={answer.nickname}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-600"
                        />
                      ) : (
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm border border-slate-600">
                          {answer.nickname.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm border border-slate-600">
                      {answer.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {answerGameUserIds.get(answer.id) ? (
                      <Link href={`/${lang}/profile/${answerGameUserIds.get(answer.id)}`} className="hover:opacity-80">
                        <span className="text-sm font-semibold text-cyan-400">{answer.nickname}</span>
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-cyan-400">{answer.nickname}</span>
                    )}
                    <span className="text-xs text-slate-500">
                      {new Date(answer.created_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                    </span>
                    {answer.similarity_score !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${getSimilarityColor(answer.similarity_score)}`}>
                        {answer.similarity_score}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-slate-200 break-words whitespace-pre-wrap mb-2">
                    {answer.answer_text}
                  </p>
                  <div className="flex items-center gap-3">
                    {isOwnAnswer && (
                      <button
                        onClick={() => onDeleteAnswer(answer.id)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
                        title={t.problem.deleteAnswer}
                      >
                        <i className="ri-delete-bin-line"></i>
                        <span>{t.problem.deleteAnswer}</span>
                      </button>
                    )}
                    {user && !isOwnAnswer && (
                      <button
                        onClick={() => setReportingAnswerId(reportingAnswerId === answer.id ? null : answer.id)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
                        title={t.problem.reportAnswer}
                      >
                        <i className="ri-flag-line"></i>
                        <span>{t.problem.reportAnswer}</span>
                      </button>
                    )}
                    <button
                      onClick={() => user ? onLikeAnswer(answer.id) : null}
                      disabled={!user}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        user
                          ? isLiked
                            ? 'text-pink-400'
                            : 'text-slate-400 hover:text-pink-400'
                          : 'text-slate-500 cursor-default'
                      }`}
                      title={!user ? t.problem.loginToLikeReply : ''}
                    >
                      <i className={`ri-heart-${isLiked ? 'fill' : 'line'}`}></i>
                      <span>{answer.like_count ?? 0}</span>
                    </button>
                    <button
                      onClick={() => user ? (isReplying ? setReplyingToId(null) : setReplyingToId(answer.id)) : null}
                      disabled={!user}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        user ? 'text-slate-400 hover:text-teal-400' : 'text-slate-500 cursor-default'
                      }`}
                      title={!user ? t.problem.loginToLikeReply : ''}
                    >
                      <i className="ri-chat-3-line"></i>
                      <span>{Math.max(answer.reply_count ?? 0, replies.length)}</span>
                    </button>
                  </div>

                  {/* 신고 모달 */}
                  {reportingAnswerId === answer.id && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                      <p className="text-xs font-semibold text-slate-300 mb-2">{t.problem.reportAnswerTitle}</p>
                      <div className="flex flex-wrap gap-2">
                        {(['spam', 'harassment', 'inappropriate_content', 'other'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={async () => {
                              await onReportAnswer(answer.id, type);
                              setReportingAnswerId(null);
                            }}
                            className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-semibold"
                          >
                            {type === 'spam' ? t.problem.reportReasonSpam :
                             type === 'harassment' ? t.problem.reportReasonHarassment :
                             type === 'inappropriate_content' ? t.problem.reportReasonInappropriate :
                             t.problem.reportReasonOther}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setReportingAnswerId(null)}
                        className="mt-2 text-xs text-slate-400 hover:text-slate-300"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  )}

                  {/* 답글 입력 */}
                  {isReplying && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t.problem.replyPlaceholder}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none"
                        rows={2}
                        maxLength={500}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setReplyingToId(null); setReplyText(''); }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold"
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          onClick={() => handleSubmitReply(answer.id)}
                          disabled={!replyText.trim() || isSubmittingReply}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                        >
                          {isSubmittingReply ? '...' : t.problem.writeReply}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 대댓글 목록 */}
                  {hasReplies && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleReplies(answer.id)}
                        className="text-xs text-slate-400 hover:text-teal-400 flex items-center gap-1"
                      >
                        <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
                        {lang === 'ko' ? `답글 ${replies.length}개` : `${replies.length} replies`}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 space-y-2 pl-4 border-l-2 border-slate-700">
                          {replies.map((reply) => (
                            <div key={reply.id} className="text-sm">
                              <span className="font-semibold text-slate-300">{reply.nickname}</span>
                              <span className="text-slate-500 text-xs ml-2">
                                {new Date(reply.created_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                              </span>
                              <p className="text-slate-300 mt-0.5 break-words">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
