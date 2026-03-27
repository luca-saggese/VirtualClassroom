import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createPasswordResetToken } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim() || '';

    if (!email) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Inserire l’email');
    }

    const result = await createPasswordResetToken(email);
    const resetUrl =
      result.resetToken && process.env.NODE_ENV !== 'production'
        ? `/auth?mode=reset&token=${encodeURIComponent(result.resetToken)}`
        : undefined;

    return apiSuccess({
      sent: true,
      message:
        'Se l’account esiste, è stato generato un link di recupero valido per 30 minuti.',
      ...(resetUrl ? { resetUrl } : {}),
    });
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Recupero password non riuscito',
      error instanceof Error ? error.message : String(error),
    );
  }
}
