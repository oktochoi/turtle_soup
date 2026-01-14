'use client';

import Link from 'next/link';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  lang?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  lang = 'ko',
}: EmptyStateProps) {
  const ActionButton = () => {
    if (!actionLabel) return null;

    const buttonClass = "px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-teal-500/50 text-sm sm:text-base touch-manipulation";

    if (actionHref) {
      return (
        <Link href={actionHref}>
          <button className={buttonClass}>
            {actionLabel}
          </button>
        </Link>
      );
    }

    if (onAction) {
      return (
        <button onClick={onAction} className={buttonClass}>
          {actionLabel}
        </button>
      );
    }

    return null;
  };

  return (
    <div className="text-center py-12 sm:py-16 bg-slate-800/50 rounded-xl border border-slate-700">
      <div className="mb-4 sm:mb-6">
        <i className={`${icon} text-5xl sm:text-6xl text-slate-500`}></i>
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-slate-400 mb-6 sm:mb-8 max-w-md mx-auto px-4">
        {description}
      </p>
      <ActionButton />
    </div>
  );
}

// 문제 목록 빈 상태
export function ProblemsEmptyState({ 
  lang = 'ko',
  onCreateClick,
}: { 
  lang?: string;
  onCreateClick?: () => void;
}) {
  return (
    <EmptyState
      icon="ri-inbox-line"
      title={lang === 'ko' ? '문제가 없습니다' : 'No problems found'}
      description={lang === 'ko' 
        ? '아직 등록된 문제가 없습니다. 첫 번째 문제를 만들어보세요!'
        : 'No problems have been created yet. Create the first one!'}
      actionLabel={lang === 'ko' ? '문제 만들기' : 'Create Problem'}
      actionHref={`/${lang}/create-problem`}
      lang={lang}
    />
  );
}

// 방 목록 빈 상태
export function RoomsEmptyState({ 
  lang = 'ko',
  hasSearchQuery = false,
  onClearSearch,
  onCreateClick,
}: { 
  lang?: string;
  hasSearchQuery?: boolean;
  onClearSearch?: () => void;
  onCreateClick?: () => void;
}) {
  if (hasSearchQuery) {
    return (
      <EmptyState
        icon="ri-search-line"
        title={lang === 'ko' ? '검색 결과가 없습니다' : 'No search results'}
        description={lang === 'ko' 
          ? '검색 조건에 맞는 방을 찾을 수 없습니다. 다른 검색어를 시도해보세요.'
          : 'No rooms match your search. Try different keywords.'}
        actionLabel={lang === 'ko' ? '검색 초기화' : 'Clear Search'}
        onAction={onClearSearch}
        lang={lang}
      />
    );
  }

  return (
    <EmptyState
      icon="ri-door-open-line"
      title={lang === 'ko' ? '활성 방이 없습니다' : 'No active rooms'}
      description={lang === 'ko' 
        ? '현재 참가할 수 있는 방이 없습니다. 새로운 방을 만들어보세요!'
        : 'There are no active rooms to join. Create a new room!'}
      actionLabel={lang === 'ko' ? '방 만들기' : 'Create Room'}
      actionHref={`/${lang}/create-room`}
      lang={lang}
    />
  );
}

// 커뮤니티 게시글 빈 상태
export function PostsEmptyState({ 
  lang = 'ko',
  category = 'all',
  onCreateClick,
}: { 
  lang?: string;
  category?: string;
  onCreateClick?: () => void;
}) {
  const categoryLabels: Record<string, { title: string; desc: string }> = {
    all: {
      title: lang === 'ko' ? '게시글이 없습니다' : 'No posts',
      desc: lang === 'ko' 
        ? '아직 작성된 게시글이 없습니다. 첫 번째 게시글을 작성해보세요!'
        : 'No posts have been created yet. Create the first one!',
    },
    notice: {
      title: lang === 'ko' ? '공지사항이 없습니다' : 'No notices',
      desc: lang === 'ko' 
        ? '등록된 공지사항이 없습니다.'
        : 'No notices have been posted.',
    },
    daily: {
      title: lang === 'ko' ? '일상 게시글이 없습니다' : 'No daily posts',
      desc: lang === 'ko' 
        ? '일상 게시글이 없습니다. 첫 번째 일상을 공유해보세요!'
        : 'No daily posts yet. Share your first daily!',
    },
    recommend: {
      title: lang === 'ko' ? '추천 게시글이 없습니다' : 'No recommendations',
      desc: lang === 'ko' 
        ? '추천 게시글이 없습니다.'
        : 'No recommendations yet.',
    },
    free: {
      title: lang === 'ko' ? '자유 게시글이 없습니다' : 'No free posts',
      desc: lang === 'ko' 
        ? '자유 게시글이 없습니다. 자유롭게 이야기를 나눠보세요!'
        : 'No free posts yet. Start a conversation!',
    },
    bug: {
      title: lang === 'ko' ? '버그 리포트가 없습니다' : 'No bug reports',
      desc: lang === 'ko' 
        ? '버그 리포트가 없습니다.'
        : 'No bug reports yet.',
    },
    hall_of_fame: {
      title: lang === 'ko' ? '명예의 전당이 비어있습니다' : 'Hall of Fame is empty',
      desc: lang === 'ko' 
        ? '아직 명예의 전당에 등록된 게시글이 없습니다.'
        : 'No posts in the Hall of Fame yet.',
    },
    funny: {
      title: lang === 'ko' ? '재미있는 게시글이 없습니다' : 'No funny posts',
      desc: lang === 'ko' 
        ? '재미있는 게시글이 없습니다. 유머를 공유해보세요!'
        : 'No funny posts yet. Share some humor!',
    },
    social: {
      title: lang === 'ko' ? '소셜 게시글이 없습니다' : 'No social posts',
      desc: lang === 'ko' 
        ? '소셜 게시글이 없습니다.'
        : 'No social posts yet.',
    },
  };

  const categoryInfo = categoryLabels[category] || categoryLabels.all;

  return (
    <EmptyState
      icon="ri-inbox-line"
      title={categoryInfo.title}
      description={categoryInfo.desc}
      actionLabel={category === 'all' || category === 'free' || category === 'daily' || category === 'funny' 
        ? (lang === 'ko' ? '게시글 작성하기' : 'Create Post')
        : undefined}
      actionHref={category === 'all' || category === 'free' || category === 'daily' || category === 'funny'
        ? `/${lang}/community/create`
        : undefined}
      lang={lang}
    />
  );
}

