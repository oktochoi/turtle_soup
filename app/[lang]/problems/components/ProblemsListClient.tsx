'use client';
import Link from 'next/link';

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
      <div className="text-center py-16 text-slate-400">
        {lang === 'ko' ? '아직 문제가 없습니다.' : 'No puzzles yet.'}
      </div>
    );
  }

  const getDifficultyLabel = (d: string) => {
    if (lang === 'ko') return d === 'easy' ? '쉬움' : d === 'hard' ? '어려움' : '보통';
    return d === 'easy' ? 'Easy' : d === 'hard' ? 'Hard' : 'Medium';
  };

  const getDifficultyColor = (d: string) => {
    return d === 'easy' ? 'text-green-400 bg-green-400/10' : d === 'hard' ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10';
  };

  return (
    <div className="space-y-4">
      {problems.map((p) => (
        <Link
          key={p.id}
          href={`/${lang}/problem/${p.id}`}
          className="block bg-slate-800/60 rounded-xl p-5 border border-slate-700 hover:border-teal-500/50 transition-all hover:bg-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white mb-2 truncate">{p.title}</h2>
              <p className="text-slate-400 text-sm line-clamp-2">{p.content}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${getDifficultyColor(p.difficulty)}`}>
              {getDifficultyLabel(p.difficulty)}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span>👁️ {p.view_count || 0}</span>
            <span>❤️ {p.like_count || 0}</span>
            <span>💬 {p.comment_count || 0}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
