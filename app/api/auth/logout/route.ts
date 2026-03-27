import { apiSuccess } from '@/lib/server/api-response';
import { clearAuthCookie } from '@/lib/server/auth';

export async function POST() {
  const response = apiSuccess({ loggedOut: true });
  clearAuthCookie(response);
  return response;
}
