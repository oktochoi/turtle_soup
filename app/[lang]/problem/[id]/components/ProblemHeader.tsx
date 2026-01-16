'use client';

import Link from 'next/link';
import type { Problem } from '@/lib/types';
import UserLabel from '@/components/UserLabel';

interface ProblemHeaderProps {
  problem: Problem;
  lang: string;
  isEditing: boolean;
  editTitle: string;
  onEditTitleChange: (value: string) => void;
  isOwner: boolean;
  onEditClick: () => void;
  onDeleteClick: () => Promise<void>;
  difficultyBadge: { text: string; color: string; emoji: string };
  averageRating: number;
  ratingCount: number;
  userRating: number | null;
  hoverRating: number | null;
  onRatingClick: (rating: number) => void;
  onRatingHover: (rating: number | null) => void;
  isLiked: boolean;
  onLikeClick: () => void;
  onShareClick: () => void;
  authorGameUserId: string | null;
  quizType?: string; // 퀴즈 타입 (밸런스 게임에서 별점 숨기기용)
  t: any;
}

export default function ProblemHeader({
  problem,
  lang,
  isEditing,
  editTitle,
  onEditTitleChange,
  isOwner,
  onEditClick,
  onDeleteClick,
  difficultyBadge,
  averageRating,
  ratingCount,
  userRating,
  hoverRating,
  onRatingClick,
  onRatingHover,
  isLiked,
  onLikeClick,
  onShareClick,
  authorGameUserId,
  quizType,
  t,
}: ProblemHeaderProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-slate-700">
      <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
        <div className="flex-1 w-full sm:w-auto">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
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
                    onClick={onEditClick}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all text-xs sm:text-sm"
                  >
                    <i className="ri-edit-line mr-1"></i>
                    <span className="hidden sm:inline">{t.common.edit}</span>
                  </button>
                  <button
                    onClick={onDeleteClick}
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
            onClick={onLikeClick}
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
            onClick={onShareClick}
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

      {/* 별점 투표 (밸런스 게임 제외) */}
      {quizType !== 'balance' && (
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
                    onClick={() => onRatingClick(star)}
                    onMouseEnter={() => onRatingHover(star)}
                    onMouseLeave={() => onRatingHover(null)}
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
      )}

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
    </div>
  );
}

