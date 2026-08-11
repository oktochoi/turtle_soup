'use client';
import Link from 'next/link';
import { caseNumberFromId, difficultyStars } from '@/lib/investigation';

type Problem = {
  id: string;
  title: string;
  content: string;
  difficulty: string;
  tags: string[];
  like_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
};

export default function ProblemsListClient({ problems, lang }: { problems: Problem[]; lang: string }) {
  if (!problems.length) {
    return (
      <div className="text-center py-16 text-fog">
        아직 사건이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {problems.map((p) => {
        const caseNo = caseNumberFromId(p.id);
        const diff = (p.difficulty === 'easy' || p.difficulty === 'hard' ? p.difficulty : 'medium') as
          | 'easy'
          | 'medium'
          | 'hard';
        return (
          <Link
            key={p.id}
            href={`/${lang}/problem/${p.id}`}
            className="block surface rounded-xl p-5 transition hover:border-brass/45"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] tracking-[0.22em] text-teal-300/90 mb-1">CASE #{caseNo}</p>
                <h2 className="font-display text-lg text-bone mb-2 truncate">{p.title}</h2>
                <p className="text-fog text-sm line-clamp-2">{p.content}</p>
              </div>
              <span className="chip text-slate-300 border-slate-600 whitespace-nowrap">
                {difficultyStars(diff)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-3 text-xs text-fog-dim">
              <span>플레이 {p.view_count || 0}</span>
              <span className="text-teal-300/80">사건 수사 시작 →</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
