import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * A log-safe label for an error: its kind and HTTP status only. Messages are never logged because
 * they can echo request details; the key, the prompt and visitor addresses never reach the logs.
 */
export function errorLabel(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return 'aborted';
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'timeout';
  if (err instanceof Anthropic.APIConnectionError) return 'connection';
  if (err instanceof Anthropic.AuthenticationError) return 'authentication 401';
  if (err instanceof Anthropic.PermissionDeniedError) return 'permission 403';
  if (err instanceof Anthropic.NotFoundError) return 'not_found 404';
  if (err instanceof Anthropic.RateLimitError) return 'rate_limit 429';
  if (err instanceof Anthropic.BadRequestError) return 'bad_request 400';
  if (err instanceof Anthropic.InternalServerError) return `server ${err.status}`;
  if (err instanceof Anthropic.APIError) return `api ${err.status ?? 'error'}`;
  if (err instanceof Error) return err.name;
  return typeof err;
}

/** Logs a fixed, log-safe label for a stage, e.g. `[ask] botid: no verdict`. */
export function logAsk(stage: string, label: string): void {
  console.error(`[ask] ${stage}: ${label}`);
}

export function logAskError(stage: string, err: unknown): void {
  logAsk(stage, errorLabel(err));
}
