import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { generateMetadataForProblem } from './metadata';
import ProblemClient from './ProblemClient';
import type { Problem } from '@/lib/types';

async function getRelatedProblems(currentId: string, lang: 'ko', difficulty: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('problems')
      .select('id, title, difficulty')
      .eq('lang', lang)
      .eq('difficulty', difficulty)
      .neq('id', currentId)
      .order('like_count', { ascending: false })
      .limit(4);
    return data || [];
  } catch {
    return [];
  }
}

function RelatedProblems({ problems, lang, difficulty }: { problems: any[]; lang: string; difficulty: string }) {
  const diffLabel = difficulty === 'easy' ? '쉬운' : difficulty === 'hard' ? '어려운' : '같은 난이도의';

  return (
    <div className="bg-ink-800 border-t border-brass/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h2 className="text-lg font-semibold text-white mb-4">
          {`${diffLabel} 바다거북스프 문제`}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {problems.map((p) => (
            <Link key={p.id} href={`/${lang}/problem/${p.id}`} className="block p-4 rounded-xl bg-ink-700/60 border border-brass/20 hover:border-brass/50 transition-all">
              <span className="text-white text-sm font-medium line-clamp-1">{p.title}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <Link href={`/${lang}/problems`} className="text-sm text-brass hover:text-brass-300 transition-colors">
            ← 전체 문제 모음
          </Link>
          <Link href={`/${lang}/problems/${difficulty === 'hard' ? 'hard' : difficulty === 'easy' ? 'easy' : 'latest'}`} className="text-sm text-brass hover:text-brass-300 transition-colors">
            {`${diffLabel} 문제 더보기 →`}
          </Link>
        </div>
      </div>
    </div>
  );
}

type Props = { params: Promise<{ lang: string; id: string }> };

function normalizeLang(lang: string): 'ko' {
  return 'ko';
}

// SEO: 메타데이터는 서버에서 생성
export async function generateMetadata({ params }: Props) {
  const { lang, id } = await params;
  return generateMetadataForProblem(id);
}

// 동적 라우트: ISR 또는 on-demand
export const dynamic = 'force-dynamic';

async function getProblem(problemId: string, requestLang: 'ko'): Promise<Problem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', problemId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('lang')) {
      const fallback = await supabase
        .from('problems')
        .select('*')
        .eq('id', problemId)
        .single();
      if (fallback.error || !fallback.data) return null;
      const row = fallback.data as any;
      const problemLang = (row.lang ?? row.language ?? 'ko') === 'ko' ? 'ko' : null;
      return problemLang === requestLang ? (row as Problem) : null;
    }
    return null;
  }

  if (!data) return null;

  const row = data as any;
  const problemLang = (row.lang ?? row.language ?? 'ko') === 'ko' ? 'ko' : null;
  if (problemLang !== requestLang) return null;

  return data as Problem;
}

async function getQuizContent(problemId: string, quizType: string): Promise<any> {
  if (quizType === 'soup') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('quiz_contents')
    .select('content')
    .eq('quiz_id', problemId)
    .maybeSingle();
  return data?.content ?? null;
}

export default async function ProblemPage({ params }: Props) {
  const { lang, id } = await params;
  const locale = normalizeLang(lang);
  const problem = await getProblem(id, locale);

  if (!problem) notFound();

  const quizType = (problem as any).type || 'soup';
  const quizContent = await getQuizContent(id, quizType);

  const difficulty = (problem as any).difficulty || 'medium';
  const relatedProblems = await getRelatedProblems(id, locale, difficulty);

  return (
    <>
      <ProblemClient
        initialProblem={problem}
        initialQuizContent={quizContent}
        lang={locale}
        problemId={id}
      />
      {relatedProblems.length > 0 && (
        <RelatedProblems problems={relatedProblems} lang={locale} difficulty={difficulty} />
      )}
    </>
  );
}
