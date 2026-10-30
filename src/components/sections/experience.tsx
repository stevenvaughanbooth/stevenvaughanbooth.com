import { SectionHeading } from '@/components/ui/section-heading';
import { CareerTimeline } from '@/components/visuals/career-timeline';
import { awards, careerSummary, describeAward, person, recognitionAnchor } from '@/content/profile';

export function Experience() {
  return (
    <section
      id="experience"
      aria-labelledby="experience-title"
      className="reveal border-t border-line py-20 md:py-28"
    >
      <div className="page">
        <SectionHeading id="experience-title" label="Experience" title={careerSummary.title}>
          <p>{careerSummary.body}</p>
        </SectionHeading>

        <div className="mt-12">
          <CareerTimeline />
        </div>

        {/* Salesforce awards. The timeline card above already carries the Salesforce logo. */}
        <div
          id={recognitionAnchor}
          className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8"
        >
          <h3 tabIndex={-1} className="label">
            Recognition
          </h3>
          <ul className="mt-5 grid gap-6 md:grid-cols-2 md:gap-10">
            {awards.map((award) => (
              <li key={award.id}>
                <h4 className="text-lg font-semibold">
                  {award.name} <span className="font-normal text-subtle">· {award.year}</span>
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
                  {describeAward(award)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8">
            <p className="font-mono text-green" aria-hidden>
              ↳
            </p>
            <h3 className="mt-2 text-xl font-semibold">{person.builderNote.title}</h3>
            <p className="mt-3 leading-relaxed text-pretty text-muted">{person.builderNote.body}</p>
          </div>
          <div className="rounded-2xl border border-line p-6 md:p-8">
            <p className="label">Education</p>
            <p className="mt-3 font-medium">{person.education.degree}</p>
            <p className="mt-1 text-muted">{person.education.school}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
