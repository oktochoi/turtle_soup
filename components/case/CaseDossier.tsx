import Link from 'next/link';
import type { Problem } from '@/lib/types';
import { buildCaseDossier, buildEditorialNote } from '@/lib/content/case-dossier';

interface Props {
  problem: Problem;
  lang: string;
}

/**
 * Server-rendered editorial layer — maps game CASE → readable investigation guide.
 * Shown above the interactive play UI so readers see the dossier first.
 */
export default function CaseDossier({ problem, lang }: Props) {
  const d = buildCaseDossier(problem);
  const editorialNote = buildEditorialNote(d);

  return (
    <article className="border-b border-slate-800 bg-slate-950/40">
      <div className="page-shell max-w-4xl py-10 sm:py-12 space-y-10">
        <header>
          <p className="text-[11px] tracking-[0.22em] text-teal-300/90">INVESTIGATION DOSSIER</p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl text-white">
            CASE #{d.caseNumber} 수사 파일
          </h2>
          <p className="mt-2 text-lg text-slate-200">{d.title}</p>
          <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
            <div>
              <dt className="inline">유형 </dt>
              <dd className="inline text-slate-300">{d.categoryLabel}</dd>
            </div>
            <div>
              <dt className="inline">난이도 </dt>
              <dd className="inline text-slate-300">{d.stars}</dd>
            </div>
            <div>
              <dt className="inline">예상 </dt>
              <dd className="inline text-slate-300">약 {d.estimatedMinutes}분</dd>
            </div>
            <div>
              <dt className="inline">수사 </dt>
              <dd className="inline text-slate-300">{d.playCount.toLocaleString()}회</dd>
            </div>
          </dl>
        </header>

        <section>
          <h3 className="text-lg font-semibold text-white mb-3">사건 개요</h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{d.synopsis}</p>
          {d.tags.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              태그: {d.tags.join(' · ')}
            </p>
          )}
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-3">추천 수사 전략</h3>
          <ul className="space-y-2 text-sm text-slate-300 leading-relaxed list-disc pl-5">
            {d.strategy.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-3">이런 질문부터 시작해 보세요</h3>
          <p className="text-sm text-slate-400 mb-3">
            스포일러 없이 방향을 잡는 데 도움이 되는 예/아니요 질문 예시입니다.
          </p>
          <ol className="space-y-2 text-sm text-slate-300 list-decimal pl-5">
            {d.starterQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-3">수사 노트</h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{editorialNote}</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-teal-200 mb-3">{d.categoryGuide.title}</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{d.categoryGuide.body}</p>
          <h4 className="mt-5 text-sm font-semibold text-white mb-2">이 유형에서 배우는 것</h4>
          <ul className="space-y-1.5 text-sm text-slate-400 list-disc pl-5">
            {d.learningPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-3">AI 수사 방식</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{d.investigationMethod}</p>
        </section>

        {d.explanation && (
          <section>
            <details className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 group">
              <summary className="cursor-pointer text-sm font-semibold text-amber-200/90 list-none flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                사건 해설 (스포일러 · 수사 전 주의)
              </summary>
              <div className="mt-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap border-t border-slate-700 pt-4">
                {d.explanation}
              </div>
            </details>
          </section>
        )}

        <nav className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
          <a href="#case-play" className="btn-primary !text-xs !py-1.5">
            이 사건 수사 시작 ↓
          </a>
          <Link href={`/${lang}/guide`} className="btn-ghost !text-xs">
            수사 가이드 전체
          </Link>
          <Link href={`/${lang}/faq`} className="btn-ghost !text-xs">
            FAQ
          </Link>
          <Link href={`/${lang}/problems`} className="btn-ghost !text-xs">
            다른 사건
          </Link>
        </nav>
      </div>
    </article>
  );
}
