'use client';

import Link from 'next/link';
import { caseNumberFromId, difficultyStars } from '@/lib/investigation';
import { CATEGORY_LABELS, type CaseCategory } from '@/lib/investigation/types';

export type CaseCardProblem = {
  id: string;
  title: string;
  content: string;
  difficulty?: string;
  tags?: string[];
  view_count?: number;
  like_count?: number;
  category?: string | null;
  status?: string | null;
};

function detectCategory(tags: string[] = [], difficulty?: string): CaseCategory {
  const joined = tags.map((t) => t.toLowerCase()).join(' ');
  if (/공포|scary|horror|소름/.test(joined)) return 'horror';
  if (/반전|twist|레전드|legend/.test(joined)) return 'twist';
  if (/감동|emotional|슬픈/.test(joined)) return 'emotional';
  if (/극악|extreme|최상/.test(joined) || difficulty === 'hard') return 'extreme';
  if (/범죄|crime|살인|시체/.test(joined)) return 'crime';
  return 'mystery';
}

function estimatedMinutes(difficulty?: string): number {
  if (difficulty === 'hard') return 15;
  if (difficulty === 'easy') return 8;
  return 12;
}

interface CaseCardProps {
  problem: CaseCardProblem;
  lang: string;
  ctaLabel?: string;
  compact?: boolean;
}

export default function CaseCard({
  problem,
  lang,
  ctaLabel = '사건 시작',
  compact = false,
}: CaseCardProps) {
  const caseNo = caseNumberFromId(problem.id);
  const diff = (problem.difficulty === 'easy' || problem.difficulty === 'hard'
    ? problem.difficulty
    : 'medium') as 'easy' | 'medium' | 'hard';
  const category = (problem.category as CaseCategory) || detectCategory(problem.tags || [], diff);
  const categoryLabel = CATEGORY_LABELS[category] || CATEGORY_LABELS.mystery;
  const minutes = estimatedMinutes(diff);
  const plays = problem.view_count || 0;
  const featured = problem.status === 'featured';

  return (
    <Link
      href={`/${lang}/problem/${problem.id}`}
      className="group surface rounded-2xl border border-slate-700/80 p-4 sm:p-5 flex flex-col h-full transition hover:border-teal-500/40 hover:bg-slate-900/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] tracking-[0.22em] text-teal-300/90">CASE #{caseNo}</p>
        {featured && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            채택
          </span>
        )}
      </div>
      <h3 className={`mt-2 font-display text-white group-hover:text-teal-50 ${compact ? 'text-base' : 'text-lg'} line-clamp-2`}>
        {problem.title}
      </h3>
      <p className={`mt-2 text-sm text-slate-400 ${compact ? 'line-clamp-2' : 'line-clamp-3'} flex-1`}>
        {problem.content}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>{categoryLabel}</span>
        <span aria-hidden>·</span>
        <span>{difficultyStars(diff)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        약 {minutes}분 · {plays.toLocaleString()}회 수사
      </p>
      <span className="btn-primary mt-4 w-full !py-2.5 text-sm text-center pointer-events-none">
        {ctaLabel}
      </span>
    </Link>
  );
}
