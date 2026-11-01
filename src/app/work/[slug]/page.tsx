import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CaseStudyArticle } from '@/components/case-study/case-study';
import { caseStudyPath, findCaseStudy } from '@/content/case-studies';
import { person, site } from '@/content/profile';
import { articleJsonLd, serializeJsonLd } from '@/lib/structured-data';

export { generateStaticParams } from './params';
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/work/[slug]'>): Promise<Metadata> {
  const study = findCaseStudy((await params).slug);
  if (!study) return {};
  const { title } = study.theme;
  const path = caseStudyPath(study.id);
  return {
    title,
    description: study.summary,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: path,
      siteName: person.name,
      title,
      description: study.summary,
      authors: [site.url],
    },
    twitter: { card: 'summary_large_image', title, description: study.summary },
  };
}

export default async function CaseStudyPage({ params }: PageProps<'/work/[slug]'>) {
  const study = findCaseStudy((await params).slug);
  if (!study) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd(study)) }}
      />
      <CaseStudyArticle study={study} />
    </>
  );
}
