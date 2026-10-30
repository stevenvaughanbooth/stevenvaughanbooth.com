'use client';

import { ErrorNotice } from '@/components/ui/error-notice';

/**
 * Shown inside the site chrome when part of a page fails to render, for example when a script
 * chunk can't load after a deploy or on a flaky connection.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div className="page pt-32 pb-20 md:pt-44 md:pb-28">
        <ErrorNotice title="This page didn’t load properly." error={error} retry={retry} />
      </div>
    </section>
  );
}
