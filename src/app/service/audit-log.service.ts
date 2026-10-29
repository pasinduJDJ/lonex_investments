import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type AuditOperation = 'Members' | 'Loans' | 'Payments' | 'Finance';

export type AuditAction =
  | 'Member Created'
  | 'Member Updated'
  | 'Loan Issued'
  | 'Loan Closed'
  | 'Payment Added'
  | 'Early Settlement / Rescheduling'
  | 'Capital Deposit'
  | 'Expense Recorded'
  | 'Cash In'
  | 'Cash Out'
  | 'Account Transfer';

export interface AuditLogEntry {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string;
  action: AuditAction;
  operation: AuditOperation;
  record_id: string;
  record_reference: string;
  description: string;
  amount: number | null;
  details: Record<string, unknown>;
  idempotency_key: string;
}

export interface AuditLogInput {
  action: AuditAction;
  operation: AuditOperation;
  recordId: string;
  recordReference: string;
  description: string;
  amount?: number | null;
  details?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface AuditLogFilters {
  operation?: AuditOperation | 'All';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  constructor(private supabaseService: SupabaseService) {}

  createIdempotencyKey(prefix = 'audit'): string {
    const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}:${suffix}`;
  }

  /** Best-effort only: audit failures never change the completed business result. */
  async log(input: AuditLogInput): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.warn('Audit event skipped because no verified user session is available.');
        return false;
      }

      const { error } = await supabase.from('audit').insert({
        user_id: user.id,
        user_email: user.email || user.id,
        action: input.action,
        operation: input.operation,
        record_id: input.recordId,
        record_reference: input.recordReference,
        description: input.description,
        amount: input.amount ?? null,
        details: input.details ?? {},
        idempotency_key: input.idempotencyKey || this.createIdempotencyKey()
      });

      if (!error || error.code === '23505') return true;
      console.warn('Completed action could not be written to the Audit Log.', error.message);
      return false;
    } catch (error) {
      console.warn('Completed action could not be written to the Audit Log.', error);
      return false;
    }
  }

  async getLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = [25, 50, 100].includes(filters.pageSize || 25) ? (filters.pageSize || 25) : 25;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('audit')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, end);

    if (filters.operation && filters.operation !== 'All') {
      query = query.eq('operation', filters.operation);
    }
    if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

    const search = this.safeSearch(filters.search || '');
    if (search) {
      query = query.or(
        `action.ilike.%${search}%,operation.ilike.%${search}%,record_reference.ilike.%${search}%,description.ilike.%${search}%,user_email.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { items: (data || []) as AuditLogEntry[], total: count || 0, page, pageSize };
  }

  private safeSearch(value: string): string {
    return value.replace(/[,()%]/g, ' ').trim().slice(0, 100);
  }
}
