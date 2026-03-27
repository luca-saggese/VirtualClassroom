import type { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/server/api-response';
import { clearAuthCookie } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  const response = apiSuccess({ loggedOut: true });
  clearAuthCookie(response, request);
  return response;
}
