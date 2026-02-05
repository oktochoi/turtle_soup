import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateMetadataForProblem } from './metadata';
import ProblemClient from './ProblemClient';
import type { Problem } from '@/lib/types';

type Props = { params: Promise<{ lang: string; id: string }> };

/** URL lang을 ko | en 로만 정규화 (ko: 한글 문제만, en: 영어 문제만) */
function normalizeLang(lang: string): 'ko' | 'en' {
  return lang === 'en' ? 'en' : 'ko';
}

// SEO: 메타데이터는 서버에서 생성
export async function generateMetadata({ params }: Props) {
  const { lang, id } = await params;
  return generateMetadataForProblem(id, normalizeLang(lang));
}

// 동적 라우트: ISR 또는 on-demand
export const dynamic = 'force-dynamic';

/** 문제 조회: id + 언어 일치 시에만 반환. ko → 한글 문제만, en → 영어 문제만 */
async function getProblem(problemId: string, requestLang: 'ko' | 'en'): Promise<Problem | null> {
  const supabase = await createClient();

  // 1) id + lang 조건으로 조회 시도 (lang 컬럼이 있는 DB)
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', problemId)
    .single();

  if (error) {
    // PGRST116: no rows → 해당 id 없음
    if (error.code === 'PGRST116') return null;
    // lang/language 컬럼 없음 등 스키마 오류 시 id만으로 조회한 뒤 JS에서 필터
    if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('lang')) {
      const fallback = await supabase
        .from('problems')
        .select('*')
        .eq('id', problemId)
        .single();
      if (fallback.error || !fallback.data) return null;
      const row = fallback.data as any;
      const problemLang = (row.lang ?? row.language ?? 'ko') === 'en' ? 'en' : 'ko';
      return problemLang === requestLang ? (row as Problem) : null;
    }
    return null;
  }

  if (!data) return null;

  const row = data as any;
  const problemLang = (row.lang ?? row.language ?? 'ko') === 'en' ? 'en' : 'ko';
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

  return (
    <ProblemClient
      initialProblem={problem}
      initialQuizContent={quizContent}
      lang={locale}
      problemId={id}
    />
  );
}
