import { useEffect } from 'react';

interface ErrorNoticeProps {
  title: string;
  error: unknown;
  retry: () => void;
}

const reload = () => window.location.reload();

/**
 * The body of the error pages (app/error.tsx inside the site chrome, app/global-error.tsx without
 * it). Both boundaries load with every page, so they share this module and import no content.
 */
export function ErrorNotice({ title, error, retry }: ErrorNoticeProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <p className="label flex items-center gap-2">
        <span aria-hidden className="size-2 rounded-full bg-amber" />
        Error · Something went wrong
      </p>
      <h1 className="mt-6 max-w-3xl text-title font-semibold text-balance">{title}</h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted">
        It may be a brief network problem, or the site may have just been updated. Trying again
        usually fixes it; if not, reload the page.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <button type="button" onClick={retry} className="pill pill-solid">
          Try again
        </button>
        <button type="button" onClick={reload} className="pill pill-outline">
          Reload the page
        </button>
      </div>
    </>
  );
}
