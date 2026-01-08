import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문제 목록',
  description: '바다거북스프 문제를 찾아 풀어보세요.',
};

export default function ProblemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

