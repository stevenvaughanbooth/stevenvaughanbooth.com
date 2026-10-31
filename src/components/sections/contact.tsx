import { AskButton } from '@/components/ask/ask-button';
import { signalAddress, signalEnd } from '@/components/signal/signal';
import { GitHub, LinkedIn, Mail, Sparkle } from '@/components/ui/icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { person } from '@/content/profile';

export function Contact() {
  const [mailbox, domain] = person.email.split('@');

  // overflow-clip, not overflow-hidden: hidden would make the section a scroll container, and the
  // signal's arrival at the email would follow the section's scroll instead of the page's.
  return (
    <section
      id="contact"
      data-component="contact"
      aria-labelledby="contact-title"
      className="reveal relative isolate overflow-clip border-t border-line py-24 md:py-36"
    >
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 rotate-180" />
      <div className="page">
        <SectionHeading
          id="contact-title"
          label="Contact"
          title="Interesting problems start with a conversation."
        />
        {/*
         * Sized to fit one line from 360px; narrower, it wraps before the @, never mid-word.
         * The signal ends here: it turns into the envelope, then underlines the address in green.
         */}
        <a
          href={person.links.email}
          className={`${signalEnd} mt-10 inline-flex max-w-full items-center gap-2.5 text-[clamp(1.125rem,5vw,1.5rem)] font-medium underline decoration-line-strong underline-offset-8 transition-colors hover:decoration-green sm:text-3xl md:text-4xl`}
        >
          <Mail className="size-[1em] shrink-0 text-green" />
          <span data-address={person.email} className={`${signalAddress} min-w-0 break-words`}>
            {mailbox}
            <wbr />@{domain}
          </span>
        </a>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href={person.links.linkedin} className="pill pill-outline">
            <LinkedIn /> LinkedIn
          </a>
          <a href={person.links.github} className="pill pill-outline">
            <GitHub /> GitHub
          </a>
          <AskButton className="pill pill-outline">
            <Sparkle /> Ask Steven
          </AskButton>
        </div>
      </div>
    </section>
  );
}
