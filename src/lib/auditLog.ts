import { supabase } from '@/lib/supabase';

export async function logAction(
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  if (!userId) return;
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
  });
}
