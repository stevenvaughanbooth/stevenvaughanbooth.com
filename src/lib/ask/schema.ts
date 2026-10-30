import 'server-only';
import { z } from 'zod';
import { type AskRequest, HISTORY_MAX_ITEMS, QUESTION_MAX } from '@/lib/ask-contract';

/** Comfortably above the largest valid body: four 400-character strings, even fully \u-escaped. */
export const BODY_MAX_BYTES = 16 * 1024;

const question = z.string().trim().min(1).max(QUESTION_MAX);

/** Built from the shared contract, so the browser client and this schema agree by construction. */
export const askRequestSchema = z.object({
  question,
  history: z.array(question).max(HISTORY_MAX_ITEMS).default([]),
}) satisfies z.ZodType<Required<AskRequest>, AskRequest>;

export type ParsedAskRequest = z.infer<typeof askRequestSchema>;

export type ReadResult = { ok: true; data: ParsedAskRequest } | { ok: false };

/**
 * Parses a POST body: JSON content type, a hard byte cap enforced while reading (so a chunked
 * body without Content-Length cannot exhaust memory), then the schema.
 */
export async function readAskRequest(request: Request): Promise<ReadResult> {
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json') return { ok: false };

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > BODY_MAX_BYTES) return { ok: false };

  const text = await readText(request, BODY_MAX_BYTES);
  if (text === null) return { ok: false };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false };
  }

  const parsed = askRequestSchema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
}

async function readText(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return null;
  }
}
