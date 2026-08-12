import { buildCaseDossier, dossierFaqAnswer } from '@/lib/content/case-dossier';
import type { Problem } from '@/lib/types';

import { getSiteUrl } from '@/lib/site-config';

const siteUrl = getSiteUrl;

export function buildProblemArticleJsonLd(problem: Problem, lang: string) {
  const url = `${siteUrl()}/${lang}/problem/${problem.id}`;
  const description = (problem.content || '').replace(/\s+/g, ' ').trim().slice(0, 200);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: problem.title || '',
    description: description || `${problem.title} — 바다거북스프 AI 수사 사건`,
    author: {
      '@type': 'Person',
      name: problem.author || 'Anonymous',
    },
    datePublished: problem.created_at,
    dateModified: problem.updated_at || problem.created_at,
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: problem.view_count || 0,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: problem.like_count || 0,
      },
    ],
    commentCount: problem.comment_count || 0,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

export function buildProblemFaqJsonLd(problem: Problem) {
  const dossier = buildCaseDossier(problem);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `${dossier.title} — 이 사건은 어떤 유형인가요?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: dossierFaqAnswer(dossier),
        },
      },
      {
        '@type': 'Question',
        name: '바다거북스프 AI 수사는 어떻게 진행되나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: dossier.investigationMethod,
        },
      },
      {
        '@type': 'Question',
        name: `${dossier.categoryLabel} 유형 사건, 어떤 질문부터 시작하면 좋을까요?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: dossier.starterQuestions.slice(0, 3).join(' '),
        },
      },
    ],
  };
}

export function buildFaqPageJsonLd(
  faqs: { question: string; answer: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
