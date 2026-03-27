import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resetPasswordWithToken, setAuthCookie } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!body.token || !body.password) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Token e password sono obbligatori');
    }

    const result = await resetPasswordWithToken(body.token, body.password);
    if (!result.user) {
      return apiError('INVALID_REQUEST', 400, result.error || 'Reset password non riuscito');
    }

    const response = apiSuccess({ user: result.user, reset: true });
  setAuthCookie(response, result.user, request);
    return response;
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Reset password non riuscito',
      error instanceof Error ? error.message : String(error),
    );
  }
}
