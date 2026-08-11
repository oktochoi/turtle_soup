import type { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '바다거북스프 문제 모음 | 레전드·어려운 문제·최신 문제',
    description: '재미있는 바다거북스프 문제를 한곳에서 풀어보세요. 레전드 문제, 어려운 문제, 공포·반전 문제, 최신 문제를 난이도별·카테고리별로 즐길 수 있습니다.',
    path: '/ko/problems',
    keywords: ['바다거북스프 문제', '바다거북스프 문제 모음', '거북이 스프 문제', '바다거북 스프 문제', '바다거북스프 사이트'],
  });
}

export default function ProblemsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
