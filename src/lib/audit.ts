import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditEntry {
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: entry.ip ?? null,
  });

  if (error) {
    console.error('[Audit] Failed to log:', error.message);
  }
}
