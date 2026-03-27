import { type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getAuthUserFromRequest, getUserById } from '@/lib/server/auth';
import {
  buildRequestOrigin,
  deleteClassroom,
  isValidClassroomId,
  persistClassroom,
  readClassroom,
} from '@/lib/server/classroom-storage';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = getAuthUserFromRequest(request);
    if (!sessionUser) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 401, 'Autenticazione richiesta');
    }

    const user = await getUserById(sessionUser.id);
    if (!user) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 401, 'Sessione non valida');
    }

    const body = await request.json();
    const { stage, scenes } = body;

    if (!stage || !scenes) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required fields: stage, scenes',
      );
    }

    const id = stage.id || randomUUID();
    const existing = await readClassroom(id);
    if (existing?.ownerUserId && existing.ownerUserId !== user.id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 403, 'Accesso negato a questa classe');
    }
    const baseUrl = buildRequestOrigin(request);

    const persisted = await persistClassroom(
      {
        id,
        ownerUserId: user.id,
        ownerEmail: user.email,
        stage: { ...stage, id },
        scenes,
      },
      baseUrl,
    );

    return apiSuccess({ id: persisted.id, url: persisted.url }, 201);
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to store classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = getAuthUserFromRequest(request);
    if (!sessionUser) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 401, 'Autenticazione richiesta');
    }

    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required parameter: id',
      );
    }

    if (!isValidClassroomId(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const classroom = await readClassroom(id);
    if (!classroom) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'Classroom not found');
    }
    if (classroom.ownerUserId !== sessionUser.id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 403, 'Accesso negato a questa classe');
    }

    return apiSuccess({ classroom });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to retrieve classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = getAuthUserFromRequest(request);
    if (!sessionUser) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 401, 'Autenticazione richiesta');
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required parameter: id',
      );
    }
    if (!isValidClassroomId(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const classroom = await readClassroom(id);
    if (!classroom) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'Classroom not found');
    }
    if (classroom.ownerUserId !== sessionUser.id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 403, 'Accesso negato a questa classe');
    }

    await deleteClassroom(id);
    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to delete classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}
