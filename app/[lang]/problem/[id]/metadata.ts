import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { generateMetadata, truncateDescription, sanitizeTitle } from '@/lib/seo';

function buildProblemDescription(
  rawContent: string | null | undefined,
  title: string
): string {
  const normalized = (rawContent || '').replace(/\s+/g, ' ').trim();

  let base = normalized || `${title}라는 상황을 바탕으로 한 바다거북스프 추리 문제입니다.`;

  const suffix = ' 이 상황의 진짜 이유는 무엇일까요?';
  const maxLen = 120 - suffix.length;
  base = base.slice(0, Math.max(1, maxLen));

  return (base + suffix).slice(0, 120);
}

export async function generateMetadataForProblem(
  problemId: string
): Promise<Metadata> {
  const supabase = await createClient();
  const { data: problem, error } = await supabase
    .from('problems')
    .select('title, content, created_at, updated_at, lang, difficulty, tags')
    .eq('id', problemId)
    .single();

  const notFoundMeta = (): Metadata =>
    generateMetadata({
      title: '문제를 찾을 수 없습니다',
      description: '요청하신 문제를 찾을 수 없습니다.',
      path: `/ko/problem/${problemId}`,
      noindex: true,
    });

  if (error || !problem) return notFoundMeta();

  const rawTitle = problem.title || '바다거북스프 추리 문제';
  const baseTitle = sanitizeTitle(rawTitle);

  const difficulty = (problem as any).difficulty || 'medium';
  const tags: string[] = Array.isArray((problem as any).tags) ? (problem as any).tags : [];

  const getDifficultyLabel = (d: string) => {
    if (d === 'easy') return '쉬운';
    if (d === 'hard') return '어려운';
    return '';
  };

  const getTagLabel = (t: string[]) => {
    const scary = t.some(tag => ['공포', '무서운', '반전', 'horror', 'scary'].includes(tag.toLowerCase()));
    if (scary) return '공포';
    return '';
  };

  const diffLabel = getDifficultyLabel(difficulty);
  const tagLabel = getTagLabel(tags);
  const subLabel = tagLabel || diffLabel;

  const pageTitle = `${baseTitle} | ${subLabel ? subLabel + ' ' : ''}바다거북스프 추리 문제`;
  const description = buildProblemDescription(problem.content, baseTitle);
  const ogDescription = truncateDescription(description, 110);

  const keywords = [
    baseTitle,
    '바다거북스프',
    '반전 추리 문제',
    '예 아니오 질문 게임',
    `problem-${problemId.slice(0, 6)}`,
  ];

  const lastMod = (problem as any).updated_at || (problem as any).created_at;

  const baseMeta = generateMetadata({
    title: baseTitle,
    description,
    path: `/ko/problem/${problemId}`,
    image: `/ko/problem/${problemId}/opengraph-image`,
    type: 'article',
    publishedTime: (problem as any).created_at,
    modifiedTime: lastMod,
    keywords,
  });

  return {
    ...baseMeta,
    title: pageTitle,
    description,
    openGraph: {
      ...(baseMeta.openGraph ?? {}),
      title: baseTitle,
      description: ogDescription,
    },
  };
}
