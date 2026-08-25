import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

/**
 * Require logged-in user with users.is_admin = true.
 * Returns service-role client for privileged writes, or an error Response.
 */
export async function requireAdminSession(): Promise<
  | { ok: true; userId: string; admin: ReturnType<typeof createServiceClient> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, admin: createServiceClient() };
}
