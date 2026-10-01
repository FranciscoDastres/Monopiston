import { Link, Navigate, useParams } from 'react-router-dom';

import { LEGAL_DISCLAIMER, legalDocs } from './legal-docs';

export function LegalPage() {
  const { doc } = useParams();
  const content = doc ? legalDocs[doc] : undefined;
  if (!content) return <Navigate replace to="/" />;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
          <Link
            className="font-display text-sm font-bold tracking-[0.12em] text-white uppercase"
            to="/"
          >
            Monopiston
          </Link>
          <Link className="text-muted hover:text-foreground text-sm" to="/">
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          {content.title}
        </h1>
        <p className="text-muted mt-2 text-sm">
          Última actualización: {content.updated}
        </p>
        <p className="mt-6 leading-7 text-[#c9c9c9]">{content.intro}</p>

        <div className="mt-10 space-y-8">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold">{section.heading}</h2>
              {section.body.map((paragraph, index) => (
                <p
                  className="text-muted mt-3 leading-7"
                  key={`${section.heading}-${index}`}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-[#8f8f8f]">
          {LEGAL_DISCLAIMER}
        </p>
      </main>
    </div>
  );
}
