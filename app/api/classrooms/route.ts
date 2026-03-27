import { type NextRequest } from 'next/server';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { getAuthUserFromRequest } from '@/lib/server/auth';
import { listClassroomsByOwner } from '@/lib/server/classroom-storage';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUserFromRequest(request);
    if (!user) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 401, 'Autenticazione richiesta');
    }

    const classrooms = await listClassroomsByOwner(user.id);
    return apiSuccess({ classrooms });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to list classrooms',
      error instanceof Error ? error.message : String(error),
    );
  }
}
