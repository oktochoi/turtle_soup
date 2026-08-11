import { generateMetadata as buildMetadata, type Locale } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = 'ko';
  const title = 'FAQ - 자주 묻는 질문';
  const description = '바다거북스프와 퀴즈 플랫폼 이용 중 자주 묻는 질문과 답변을 확인하세요.';
  const keywords = ['바다거북스프 FAQ', '퀴즈 자주 묻는 질문', '플랫폼 이용 방법'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/faq`,
    locale,
    keywords,
  });
}

