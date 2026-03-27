import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { registerUser, setAuthCookie } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };

    const result = await registerUser({
      email: body.email || '',
      name: body.name || '',
      password: body.password || '',
    });

    if (!result.user) {
      return apiError('INVALID_REQUEST', 400, result.error || 'Registrazione non riuscita');
    }

    const response = apiSuccess({ user: result.user }, 201);
  setAuthCookie(response, result.user, request);
    return response;
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Registrazione non riuscita',
      error instanceof Error ? error.message : String(error),
    );
  }
}
