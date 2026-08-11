import type { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '랭킹 | 바다거북스프 정답률 순위',
    description: '바다거북스프 퀴즈 정답률 순위를 확인하세요. 상위 랭커와 나의 순위를 비교할 수 있습니다.',
    path: '/ko/ranking',
    keywords: ['바다거북스프 랭킹', '퀴즈 정답률 순위', '바다거북스프 순위'],
  });
}

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
