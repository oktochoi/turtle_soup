import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문제 만들기',
  description: '바다거북스프 문제를 만들고 다른 사용자들과 공유하세요.',
};

export default function CreateProblemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

