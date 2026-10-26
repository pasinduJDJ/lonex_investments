import { createClient } from 'npm:@supabase/supabase-js@2.52.0';

const ACTION_MODULE: Record<string, string> = {
  'Member Created': 'Members',
  'Member Updated': 'Members',
  'Loan Issued': 'Loans',
  'Payment Added': 'Payments',
  'Early Settlement / Rescheduling': 'Settlement',
  'Expense Recorded': 'Finance',
  'Capital Deposit': 'Finance',
  'Cash In': 'Finance',
  'Cash Out': 'Finance',
  'Account Transfer': 'Finance'
};

const ALLOWED_PAGE_SIZES = new Set([25, 50, 100, 500]);

function json(body: unknown, status = 200, origin = ''): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin'
    }
  });
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin') || '';
  const allowed = (Deno.env.get('ALLOWED_APP_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!origin) return allowed[0] || '';
  return allowed.includes(origin) ? origin : null;
}

async function verifyPrimaryUser(request: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const primaryUrl = Deno.env.get('LONEX_SUPABASE_URL') || '';
  const primaryKey = Deno.env.get('LONEX_SUPABASE_PUBLISHABLE_KEY') || '';
  if (!token || !primaryUrl || !primaryKey) return null;

  const response = await fetch(`${primaryUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: primaryKey, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id && user?.email ? { id: user.id, email: user.email } : null;
}

function isManager(userId: string): boolean {
  const ids = (Deno.env.get('AUDIT_MANAGER_USER_IDS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function safeSearch(value: string): string {
  return value.replace(/[,()%]/g, ' ').trim().slice(0, 100);
}

Deno.serve(async request => {
  const origin = allowedOrigin(request);
  if (origin === null) return json({ error: 'Origin is not allowed.' }, 403, 'null');
  if (request.method === 'OPTIONS') return json({}, 200, origin);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, origin);

  try {
    const user = await verifyPrimaryUser(request);
    if (!user) return json({ error: 'A valid Lonex Supabase session is required.' }, 401, origin);

    const auditUrl = Deno.env.get('SUPABASE_URL') || '';
    const auditSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!auditUrl || !auditSecret) return json({ error: 'Audit service is not configured.' }, 500, origin);
    const audit = createClient(auditUrl, auditSecret, { auth: { persistSession: false } });

    if (request.method === 'POST') {
      const body = await request.json();
      const action = String(body.action || '');
      const module = String(body.module || '');
      const recordReference = String(body.record_reference || '').trim();
      const description = String(body.description || '').trim();
      const idempotencyKey = String(body.idempotency_key || '').trim();
      const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details : {};
      const amount = body.amount === null || body.amount === undefined || body.amount === '' ? null : Number(body.amount);

      if (!ACTION_MODULE[action] || ACTION_MODULE[action] !== module) {
        return json({ error: 'Unsupported action/module combination.' }, 400, origin);
      }
      if (!recordReference || recordReference.length > 120 || !description || description.length > 500) {
        return json({ error: 'Reference or description is invalid.' }, 400, origin);
      }
      if (idempotencyKey.length < 16 || idempotencyKey.length > 120) {
        return json({ error: 'A valid idempotency key is required.' }, 400, origin);
      }
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        return json({ error: 'Amount must be a non-negative number.' }, 400, origin);
      }
      if (JSON.stringify(details).length > 4000) {
        return json({ error: 'Activity details are too large.' }, 400, origin);
      }

      const { data, error } = await audit
        .from('activity_logs')
        .insert({
          user_id: user.id,
          user_email: user.email,
          action,
          module,
          record_reference: recordReference,
          description,
          amount,
          details,
          idempotency_key: idempotencyKey
        })
        .select('id, occurred_at')
        .single();

      if (error?.code === '23505') return json({ success: true, duplicate: true }, 200, origin);
      if (error) throw error;
      return json({ success: true, event: data }, 201, origin);
    }

    if (!isManager(user.id)) return json({ error: 'Management access is required.' }, 403, origin);

    const url = new URL(request.url);
    const requestedPage = Number(url.searchParams.get('page') || '1');
    const requestedPageSize = Number(url.searchParams.get('page_size') || '25');
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = ALLOWED_PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : 25;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = audit
      .from('activity_logs')
      .select('id, occurred_at, user_id, user_email, action, module, record_reference, description, amount, details', { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, end);

    const module = url.searchParams.get('module');
    const action = url.searchParams.get('action');
    const userFilter = safeSearch(url.searchParams.get('user') || '');
    const search = safeSearch(url.searchParams.get('search') || '');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    if (module && Object.values(ACTION_MODULE).includes(module)) query = query.eq('module', module);
    if (action && ACTION_MODULE[action]) query = query.eq('action', action);
    if (userFilter) query = query.ilike('user_email', `%${userFilter}%`);
    if (validDate(dateFrom)) query = query.gte('occurred_at', `${dateFrom}T00:00:00.000Z`);
    if (validDate(dateTo)) query = query.lt('occurred_at', `${dateTo}T23:59:59.999Z`);
    if (search) {
      query = query.or(`record_reference.ilike.%${search}%,description.ilike.%${search}%,user_email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return json({ items: data || [], total: count || 0, page, pageSize }, 200, origin);
  } catch (error) {
    console.error('activity-log function error', error);
    return json({ error: 'Activity Log request failed.' }, 500, origin || '');
  }
});
