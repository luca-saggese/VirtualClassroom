import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { authenticateUser, setAuthCookie } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const result = await authenticateUser(body.email || '', body.password || '');
    if (!result.user) {
      return apiError('INVALID_REQUEST', 401, result.error || 'Login non riuscito');
    }

    const response = apiSuccess({ user: result.user });
    setAuthCookie(response, result.user, request);
    return response;
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Login non riuscito',
      error instanceof Error ? error.message : String(error),
    );
  }
}
