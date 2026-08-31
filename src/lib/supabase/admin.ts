import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Service-role client — bypasses RLS. Server-only.
 * Never import this from a client-side module.
 */
export function createAdminClient() {
  return createClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
