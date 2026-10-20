import { ok, requireStaff } from '@/lib/admin/http';
import { integrationStatus } from '@/lib/integrations/registry';

export const dynamic = 'force-dynamic';
/** Reports only whether each service is configured, never the secret values. */
export async function GET(req: Request) {
  const g = await requireStaff(req, ['owner', 'admin']);
  if ('res' in g) return g.res;
  return ok(integrationStatus().map(({ key, name, purpose, env, docs, status, connected }) => ({ key, name, purpose, env, docs, status, connected })));
}
