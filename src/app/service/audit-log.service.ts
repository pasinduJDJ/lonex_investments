import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../../environments/environment';

export type ActivityModule = 'Members' | 'Loans' | 'Payments' | 'Settlement' | 'Finance';

export type ActivityAction =
  | 'Member Created'
  | 'Member Updated'
  | 'Loan Issued'
  | 'Payment Added'
  | 'Early Settlement / Rescheduling'
  | 'Expense Recorded'
  | 'Capital Deposit'
  | 'Cash In'
  | 'Cash Out'
  | 'Account Transfer';

export interface ActivityLogEvent {
  id: number;
  occurred_at: string;
  user_id: string;
  user_email: string;
  action: ActivityAction;
  module: ActivityModule;
  record_reference: string;
  description: string;
  amount: number | null;
  details: Record<string, unknown>;
}

export interface ActivityLogInput {
  action: ActivityAction;
  module: ActivityModule;
  recordReference: string;
  description: string;
  amount?: number | null;
  details?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ActivityLogFilters {
  module?: ActivityModule | 'All';
  action?: ActivityAction | 'All';
  user?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityLogPage {
  items: ActivityLogEvent[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly endpoint = this.buildEndpoint();

  constructor(private supabaseService: SupabaseService) {}

  isConfigured(): boolean {
    return Boolean(environment.auditProjectUrl?.trim() && environment.auditProjectPublishableKey?.trim());
  }

  createIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  /** Best-effort by design: it never rejects or changes the business result. */
  async logActivity(input: ActivityLogInput): Promise<boolean> {
    if (!this.isConfigured()) {
      console.info('Activity Log is not configured; successful action was not logged.');
      return false;
    }

    const token = await this.getAccessToken();
    if (!token) {
      console.warn('Activity Log skipped because no verified Supabase session is available.');
      return false;
    }

    const payload = {
      action: input.action,
      module: input.module,
      record_reference: input.recordReference,
      description: input.description,
      amount: input.amount ?? null,
      details: input.details ?? {},
      idempotency_key: input.idempotencyKey || this.createIdempotencyKey()
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: this.buildHeaders(token),
          body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 409) return true;

        const message = await this.readError(response);
        if (response.status >= 400 && response.status < 500) {
          console.warn(`Activity Log rejected the event: ${message}`);
          return false;
        }
      } catch (error) {
        if (attempt === 2) {
          console.warn('Successful action could not be written to Activity Log.', error);
        }
      }
    }

    return false;
  }

  async getLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogPage> {
    this.ensureConfigured();
    const token = await this.requireAccessToken();
    const response = await fetch(`${this.endpoint}?${this.buildQuery(filters).toString()}`, {
      method: 'GET',
      headers: this.buildHeaders(token)
    });
    if (!response.ok) throw new Error(await this.readError(response));
    return response.json() as Promise<ActivityLogPage>;
  }

  async getAllMatchingLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogEvent[]> {
    const all: ActivityLogEvent[] = [];
    let page = 1;
    while (true) {
      const result = await this.getLogs({ ...filters, page, pageSize: 500 });
      all.push(...result.items);
      if (all.length >= result.total || result.items.length === 0) break;
      page += 1;
    }
    return all;
  }

  private buildEndpoint(): string {
    const base = (environment.auditProjectUrl || '').replace(/\/$/, '');
    return base ? `${base}/functions/v1/activity-log` : '';
  }

  private buildQuery(filters: ActivityLogFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.module && filters.module !== 'All') params.set('module', filters.module);
    if (filters.action && filters.action !== 'All') params.set('action', filters.action);
    if (filters.user?.trim()) params.set('user', filters.user.trim());
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    params.set('page', String(Math.max(1, filters.page || 1)));
    params.set('page_size', String(filters.pageSize || 25));
    return params;
  }

  private buildHeaders(token: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      apikey: environment.auditProjectPublishableKey,
      Authorization: `Bearer ${token}`
    };
  }

  private async getAccessToken(): Promise<string | null> {
    const { data, error } = await this.supabaseService.getClient().auth.getSession();
    if (error) return null;
    return data.session?.access_token || null;
  }

  private async requireAccessToken(): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');
    return token;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Activity Log is not configured. Complete the separate audit project setup first.');
    }
  }

  private async readError(response: Response): Promise<string> {
    try {
      const body = await response.json();
      return body.error || body.message || `Request failed (${response.status})`;
    } catch {
      return `Request failed (${response.status})`;
    }
  }
}
