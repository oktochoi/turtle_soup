import { generateMetadata as buildMetadata, type Locale } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = 'ko';
  const title = '가이드 - 바다거북스프 & 퀴즈 플레이 방법';
  const description = '바다거북스프, 멀티플레이 퀴즈, 룰과 진행 방법을 자세히 안내합니다. 초보도 쉽게 따라 할 수 있는 가이드.';
  const keywords = ['바다거북스프 가이드', '퀴즈 플레이 방법', '추리 게임 룰', '초보자 가이드'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/guide`,
    locale,
    keywords,
  });
}

