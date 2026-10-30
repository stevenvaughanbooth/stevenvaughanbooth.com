import { publicProfile } from '@/lib/structured-data';

export const dynamic = 'force-static';

export function GET() {
  return new Response(`${JSON.stringify(publicProfile, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
