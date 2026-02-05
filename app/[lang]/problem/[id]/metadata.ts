import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { generateMetadata, truncateDescription, sanitizeTitle } from '@/lib/seo';
import type { Locale } from '@/lib/seo';

export async function generateMetadataForProblem(
  problemId: string,
  lang: string = 'ko'
): Promise<Metadata> {
  const supabase = await createClient();
  const { data: problem } = await supabase
    .from('problems')
    .select('title, content, author, view_count, like_count, comment_count, created_at')
    .eq('id', problemId)
    .single();

  if (!problem) {
    return generateMetadata({
      title: '문제를 찾을 수 없습니다',
      description: '요청하신 문제를 찾을 수 없습니다.',
      path: `/${lang}/problem/${problemId}`,
      noindex: true,
      locale: lang as Locale,
    });
  }

  const title = problem.title || '바다거북스프 문제';
  const description = truncateDescription(
    problem.content || '추리와 질문으로 진실을 밝혀내는 바다거북스프 문제입니다.',
    155
  );
  const author = problem.author || '알 수 없음';
  const keywords = [
    sanitizeTitle(title),
    lang === 'ko' ? '바다거북스프' : 'turtle soup riddle',
    lang === 'ko' ? '추리 퀴즈' : 'logic puzzle',
  ];
  const lastMod = problem.updated_at || problem.created_at;

  return generateMetadata({
    title: sanitizeTitle(title),
    description: `${description} 작성자: ${author}. 조회수 ${problem.view_count || 0}, 좋아요 ${problem.like_count || 0}.`,
    path: `/${lang}/problem/${problemId}`,
    image: `/${lang}/problem/${problemId}/opengraph-image`,
    type: 'article',
    publishedTime: problem.created_at,
    modifiedTime: lastMod,
    author,
    locale: lang as Locale,
    keywords,
  });
}

