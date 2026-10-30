import { AskButton } from '@/components/ask/ask-button';
import { GitHub, LinkedIn, Mail, Sparkle } from '@/components/ui/icons';
import { person } from '@/content/profile';

export function Contact() {
  const [mailbox, domain] = person.email.split('@');

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="reveal relative isolate overflow-hidden border-t border-line py-24 md:py-36"
    >
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 rotate-180" />
      <div className="page">
        <p className="label">Contact</p>
        <h2
          id="contact-title"
          tabIndex={-1}
          className="mt-4 max-w-3xl text-title font-semibold text-balance"
        >
          Interesting problems start with a conversation.
        </h2>
        {/* Sized to fit one line from 360px; narrower, it wraps before the @, never mid-word. */}
        <a
          href={person.links.email}
          className="mt-10 inline-flex max-w-full items-center gap-2.5 text-[clamp(1.125rem,5vw,1.5rem)] font-medium underline decoration-line-strong underline-offset-8 transition-colors hover:decoration-green sm:text-3xl md:text-4xl"
        >
          <Mail className="size-[1em] shrink-0 text-green" />
          <span className="min-w-0 break-words">
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
