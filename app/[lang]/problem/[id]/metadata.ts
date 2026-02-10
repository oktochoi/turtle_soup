import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { generateMetadata, truncateDescription, sanitizeTitle } from '@/lib/seo';
import type { Locale } from '@/lib/seo';

function buildProblemDescription(
  rawContent: string | null | undefined,
  title: string,
  lang: 'ko' | 'en'
): string {
  const normalized = (rawContent || '').replace(/\s+/g, ' ').trim();

  let base =
    normalized ||
    (lang === 'ko'
      ? `${title}라는 상황을 바탕으로 한 바다거북스프 추리 문제입니다.`
      : `A turtle soup riddle based on the situation: ${title}.`);

  const suffix =
    lang === 'ko'
      ? ' 이 상황의 진짜 이유는 무엇일까요?'
      : ' What is really going on behind this situation?';

  const maxLen = 120 - suffix.length;
  base = base.slice(0, Math.max(1, maxLen));

  return (base + suffix).slice(0, 120);
}

/** lang은 정규화된 'ko' | 'en'. 해당 언어 문제만 메타 반환 */
export async function generateMetadataForProblem(
  problemId: string,
  lang: 'ko' | 'en' = 'ko'
): Promise<Metadata> {
  const supabase = await createClient();
  const { data: problem, error } = await supabase
    .from('problems')
    .select('title, content, created_at, updated_at, lang')
    .eq('id', problemId)
    .single();

  const notFoundMeta = (): Metadata =>
    generateMetadata({
      title: lang === 'ko' ? '문제를 찾을 수 없습니다' : 'Problem not found',
      description: lang === 'ko' ? '요청하신 문제를 찾을 수 없습니다.' : 'The requested problem was not found.',
      path: `/${lang}/problem/${problemId}`,
      noindex: true,
      locale: lang as Locale,
    });

  if (error || !problem) return notFoundMeta();

  const problemLang = (problem as any).lang ?? 'ko';
  const problemLangNorm = problemLang === 'en' ? 'en' : 'ko';
  if (problemLangNorm !== lang) return notFoundMeta();

  const rawTitle =
    problem.title ||
    (lang === 'ko' ? '바다거북스프 추리 문제' : 'Turtle Soup Mystery Puzzle');
  const baseTitle = sanitizeTitle(rawTitle);

  // HTML <title>
  const pageTitle =
    lang === 'ko'
      ? `${baseTitle} | 바다거북스프 반전 추리 문제`
      : `${baseTitle} | Turtle Soup Mystery Riddle`;

  // 본문 기반 100~120자 질문형 설명 (정답/반전 노출 금지: content 필드만 사용)
  const description = buildProblemDescription(problem.content, baseTitle, lang);

  // Open Graph 설명은 동일하거나 더 짧게
  const ogDescription = truncateDescription(description, 110);

  const keywords = [
    baseTitle,
    lang === 'ko' ? '바다거북스프' : 'turtle soup',
    lang === 'ko' ? '반전 추리 문제' : 'mystery riddle',
    lang === 'ko' ? '예 아니오 질문 게임' : 'yes no riddle',
    `problem-${problemId.slice(0, 6)}`,
  ];

  const lastMod = (problem as any).updated_at || (problem as any).created_at;

  // 기본 SEO 스키마는 공통 헬퍼로 생성한 뒤, 문제 전용 규칙으로 오버라이드
  const baseMeta = generateMetadata({
    title: baseTitle,
    description,
    path: `/${lang}/problem/${problemId}`,
    image: `/${lang}/problem/${problemId}/opengraph-image`,
    type: 'article',
    publishedTime: (problem as any).created_at,
    modifiedTime: lastMod,
    locale: lang as Locale,
    keywords,
  });

  return {
    ...baseMeta,
    // 1) 페이지 타이틀: "{문제 제목} | 바다거북스프 추리 문제"
    title: pageTitle,
    // 2) 검색 결과용 설명: 문제 본문 기반 질문형 요약
    description,
    // 3) Open Graph: og:title = 문제 제목, og:description = 동일하거나 더 짧게
    openGraph: {
      ...(baseMeta.openGraph ?? {}),
      title: baseTitle,
      description: ogDescription,
    },
  };
}

