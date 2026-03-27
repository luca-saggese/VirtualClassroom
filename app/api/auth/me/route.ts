import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthUserFromRequest, getUserById } from '@/lib/server/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const sessionUser = getAuthUserFromRequest(request);
  if (!sessionUser) {
    return apiError('INVALID_REQUEST', 401, 'Non autenticato');
  }

  const user = await getUserById(sessionUser.id);
  if (!user) {
    return apiError('INVALID_REQUEST', 401, 'Sessione non valida');
  }

  return apiSuccess({ user });
}
