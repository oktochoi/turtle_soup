import HomeClient from './HomeClient';
import { generateMetadata as buildMetadata, type Locale } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = 'ko';
  const title = '오늘의 바다거북스프 & 인기 퀴즈';
  const description = '매일 새로운 바다거북스프 문제와 인기 퀴즈를 즐기세요. 실시간 멀티플레이, 해설, 힌트 제공.';
  const keywords = ['바다거북스프', '추리 퀴즈', '오늘의 문제', '멀티플레이 퀴즈'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}`,
    locale,
    keywords,
  });
}

export default function HomePage() {
  return <HomeClient />;
}
