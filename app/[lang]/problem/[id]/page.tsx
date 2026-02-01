import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateMetadataForProblem } from './metadata';
import ProblemClient from './ProblemClient';
import type { Problem } from '@/lib/types';

type Props = { params: Promise<{ lang: string; id: string }> };

// SEO: 메타데이터는 서버에서 생성
export async function generateMetadata({ params }: Props) {
  const { lang, id } = await params;
  return generateMetadataForProblem(id, lang);
}

// 동적 라우트: ISR 또는 on-demand
export const dynamic = 'force-dynamic';
// export const revalidate = 60; // ISR: 60초마다 재검증

async function getProblem(problemId: string, lang: string): Promise<Problem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', problemId)
    .single();

  if (error || !data) return null;

  const problemLang = data.lang || (data as any).language || 'ko';
  if (problemLang !== lang) return null;

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
  const problem = await getProblem(id, lang);

  if (!problem) notFound();

  const quizType = (problem as any).type || 'soup';
  const quizContent = await getQuizContent(id, quizType);

  return (
    <ProblemClient
      initialProblem={problem}
      initialQuizContent={quizContent}
      lang={lang}
      problemId={id}
    />
  );
}
