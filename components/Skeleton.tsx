'use client';

// 문제 카드 스켈레톤
export function ProblemCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        </div>
        <div className="h-6 w-16 bg-slate-700 rounded"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-slate-700 rounded w-full"></div>
        <div className="h-4 bg-slate-700 rounded w-5/6"></div>
        <div className="h-4 bg-slate-700 rounded w-4/6"></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
        </div>
        <div className="h-8 w-20 bg-slate-700 rounded"></div>
      </div>
    </div>
  );
}

// 방 카드 스켈레톤
export function RoomCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-6 bg-slate-700 rounded w-24 mb-2"></div>
          <div className="h-4 bg-slate-700 rounded w-32"></div>
        </div>
        <div className="h-6 w-20 bg-slate-700 rounded"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-slate-700 rounded w-full"></div>
        <div className="h-4 bg-slate-700 rounded w-5/6"></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-700 rounded-full"></div>
          <div className="h-4 w-24 bg-slate-700 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
          <div className="h-8 w-20 bg-slate-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

// 커뮤니티 게시글 카드 스켈레톤
export function PostCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 bg-slate-700 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
            <div className="h-3 bg-slate-700 rounded w-32"></div>
          </div>
        </div>
        <div className="h-5 w-16 bg-slate-700 rounded"></div>
      </div>
      <div className="mb-3">
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-700 rounded w-5/6"></div>
          <div className="h-4 bg-slate-700 rounded w-4/6"></div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-700">
        <div className="flex items-center gap-4">
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
          <div className="h-4 w-16 bg-slate-700 rounded"></div>
        </div>
        <div className="h-4 w-20 bg-slate-700 rounded"></div>
      </div>
    </div>
  );
}

// 문제 상세 페이지 스켈레톤
export function ProblemDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
      <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 mb-6">
        <div className="h-8 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="space-y-3 mb-6">
          <div className="h-4 bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-700 rounded w-5/6"></div>
          <div className="h-4 bg-slate-700 rounded w-4/6"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-6 w-20 bg-slate-700 rounded"></div>
          <div className="h-6 w-20 bg-slate-700 rounded"></div>
          <div className="h-6 w-20 bg-slate-700 rounded"></div>
        </div>
      </div>
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="h-6 bg-slate-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          <div className="h-10 bg-slate-700 rounded"></div>
          <div className="h-10 bg-slate-700 rounded"></div>
          <div className="h-10 bg-slate-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

